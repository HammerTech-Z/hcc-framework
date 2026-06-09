#!/usr/bin/env node
// AGENT-BRIDGE-010 — task packet publisher.
//
// Creates AGENT-BRIDGE task JSON packets under ignored
// .agent-bridge/tasks/pending/. Standardizes task creation so
// Codex/user can create Claude tasks without hand-copying prompts.
//
// Does NOT:
//   - execute Claude or Codex
//   - commit / push
//   - write outside .agent-bridge/tasks/pending/
//   - write to ~/.hermes/*

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, isAbsolute, sep } from "node:path";

// -----------------------------------------------------------------
// Safe task-id pattern
// -----------------------------------------------------------------

const TASK_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function validateTaskId(id) {
  if (!id || typeof id !== "string" || id.length === 0) {
    return "task-id must be a non-empty string";
  }
  if (id.includes("/") || id.includes("\\")) {
    return "task-id must not contain path separators";
  }
  if (id.includes("..")) {
    return "task-id must not contain path traversal";
  }
  if (isAbsolute(id)) {
    return "task-id must not be an absolute path";
  }
  if (!TASK_ID_PATTERN.test(id)) {
    return "task-id must match [A-Za-z0-9._-]+";
  }
  return null;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const SUPPORTED_MODES = new Set(["design-only", "read-only"]);

const HARD_FORBIDDEN_ACTIONS = [
  "git commit",
  "git push",
  "git commit --amend",
  "git rebase",
  "git reset --hard",
  "live apply",
  "HCC Auto Executor",
];

const HARD_FORBIDDEN_FILES = [
  "~/.hermes/config.yaml",
  "~/.hermes/handoff/packs",
  "~/.hermes/audit",
  "docs/roadmap-locked-2026-05-28.md",
];

// -----------------------------------------------------------------
// CLI
// -----------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    repo: null,
    taskId: null,
    mode: null,
    objective: null,
    allowedFiles: [],
    forbiddenFiles: [],
    allowedCommands: [],
    requiredVerification: [],
    expectedAuthorizationType: "none",
    dryRun: false,
    writeTask: false,
    bridgeRoot: null,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") out.repo = argv[++i] ?? null;
    else if (a === "--task-id") out.taskId = argv[++i] ?? null;
    else if (a === "--mode") out.mode = argv[++i] ?? null;
    else if (a === "--objective") out.objective = argv[++i] ?? null;
    else if (a === "--allowed-file") out.allowedFiles.push(argv[++i] ?? "");
    else if (a === "--forbidden-file") out.forbiddenFiles.push(argv[++i] ?? "");
    else if (a === "--allowed-command") out.allowedCommands.push(argv[++i] ?? "");
    else if (a === "--required-verification") out.requiredVerification.push(argv[++i] ?? "");
    else if (a === "--expected-authorization-type") out.expectedAuthorizationType = argv[++i] ?? null;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--write-task") out.writeTask = true;
    else if (a === "--bridge-root") out.bridgeRoot = argv[++i] ?? null;
    else if (a === "--help" || a === "-h") out.help = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/agent-bridge/publish-task-packet.mjs [options]",
      "",
      "Options:",
      "  --repo <path>               Path to repo root",
      "  --task-id <id>              Task identifier [A-Za-z0-9._-]+",
      "  --mode <mode>               design-only | read-only",
      "  --objective <text>          1-3 sentence description",
      "  --allowed-file <path>       Repeatable",
      "  --forbidden-file <path>     Repeatable",
      "  --allowed-command <cmd>     Repeatable",
      "  --required-verification <v> Repeatable",
      "  --expected-authorization-type <type>  Default: none",
      "  --dry-run                   Print packet JSON; do not write",
      "  --write-task                Write .agent-bridge/tasks/pending/<id>.task.json",
      "  --bridge-root <path>        Optional; default = <repo>/.agent-bridge",
      "  --help, -h                  Print this message",
      "",
      "Exactly one of --dry-run or --write-task must be provided.",
      "Hard forbidden actions and files are always included automatically.",
      "write-files-only is rejected in AGENT-BRIDGE-010.",
      "",
    ].join("\n"),
  );
}

// -----------------------------------------------------------------
// Bridge-root sandboxing
// -----------------------------------------------------------------

function resolveBridgeRoot(args, repoRoot) {
  const repoBridgeRoot = resolve(repoRoot, ".agent-bridge");
  const bridgeRoot = args.bridgeRoot
    ? resolve(args.bridgeRoot)
    : repoBridgeRoot;
  const within =
    bridgeRoot === repoBridgeRoot ||
    bridgeRoot.startsWith(repoBridgeRoot + sep);
  if (!within) {
    process.stderr.write(
      `error: --bridge-root must resolve inside ${repoBridgeRoot}\n`,
    );
    process.exit(2);
  }
  return bridgeRoot;
}

// -----------------------------------------------------------------
// Path validation (parity with run-claude-task.mjs)
// -----------------------------------------------------------------

function isHardForbiddenPath(p) {
  if (typeof p !== "string") return false;
  if (p === "~/.hermes" || p.startsWith("~/.hermes/")) return true;
  if (p === "docs/roadmap-locked-2026-05-28.md") return true;
  return false;
}

function validatePathList(name, paths, opts = {}) {
  const allowHardForbidden = opts.allowHardForbidden === true;
  if (!Array.isArray(paths)) {
    throw new Error(`${name} must be an array`);
  }
  for (const p of paths) {
    if (typeof p !== "string" || p.length === 0) {
      return `${name} contains empty or non-string entry`;
    }
    if (p.includes("..")) {
      return `${name} contains path traversal "..": ${p}`;
    }
    if (!allowHardForbidden && isHardForbiddenPath(p)) {
      return `${name} contains hard-forbidden path: ${p}`;
    }
    if (isAbsolute(p)) {
      return `${name} contains absolute path not allowed: ${p}`;
    }
  }
  return null;
}

function validateArgs(args) {
  // Validate path lists
  const allowedErr = validatePathList("allowed_files", args.allowedFiles);
  if (allowedErr) return allowedErr;
  const forbiddenErr = validatePathList("forbidden_files", args.forbiddenFiles, { allowHardForbidden: true });
  if (forbiddenErr) return forbiddenErr;

  // Overlap check: if a path appears in both lists, reject.
  const forbiddenSet = new Set(args.forbiddenFiles);
  for (const p of args.allowedFiles) {
    if (forbiddenSet.has(p)) {
      return `allowed_files overlaps forbidden_files: ${p}`;
    }
  }

  // expected_authorization_type must be non-empty string
  if (!args.expectedAuthorizationType || typeof args.expectedAuthorizationType !== "string" || args.expectedAuthorizationType.length === 0) {
    return "expected_authorization_type must be a non-empty string";
  }

  return null; // valid
}

function buildPacket(args) {
  const forbidden = new Set([...args.forbiddenFiles, ...HARD_FORBIDDEN_FILES]);
  return {
    schema_version: "1.0.0",
    task_id: args.taskId,
    mode: args.mode,
    objective: args.objective,
    allowed_files: args.allowedFiles,
    forbidden_files: Array.from(forbidden),
    allowed_commands: args.allowedCommands,
    forbidden_actions: HARD_FORBIDDEN_ACTIONS,
    required_verification: args.requiredVerification,
    report_schema: {
      schema_version: "string",
      task_id: "string",
      final_verdict: "string (complete | partial | failed)",
      claimed_changes: "string",
      files_modified: ["string"],
      commands_run: ["string"],
      raw_outputs_summary: "string",
      not_done: "string",
      known_unknowns: ["string"],
      claimed_commit: "string|null",
      claimed_pushed: "boolean",
      claimed_push_state: "object|null",
    },
    expected_authorization_type: args.expectedAuthorizationType,
  };
}

// -----------------------------------------------------------------
// Main
// -----------------------------------------------------------------

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    printUsage();
    process.exit(2);
  }

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (args.dryRun && args.writeTask) {
    process.stderr.write("error: --dry-run and --write-task are mutually exclusive.\n");
    process.exit(2);
  }
  if (!args.dryRun && !args.writeTask) {
    process.stderr.write("error: exactly one of --dry-run or --write-task must be provided.\n");
    printUsage();
    process.exit(2);
  }

  if (!args.repo) exitErr("--repo <path> is required");
  if (!args.taskId) exitErr("--task-id <id> is required");
  if (!args.mode) exitErr("--mode <mode> is required");
  if (!args.objective) exitErr("--objective <text> is required");

  const idErr = validateTaskId(args.taskId);
  if (idErr !== null) {
    process.stderr.write(`error: invalid --task-id: ${idErr}\n`);
    process.exit(2);
  }

  if (!SUPPORTED_MODES.has(args.mode)) {
    if (args.mode === "write-files-only") {
      process.stderr.write(
        "error: write-files-only is not supported in AGENT-BRIDGE-010. Only design-only and read-only are supported.\n",
      );
    } else {
      process.stderr.write(
        `error: unsupported --mode "${args.mode}". Only design-only and read-only are supported in AGENT-BRIDGE-010.\n`,
      );
    }
    process.exit(2);
  }

  // Validate path lists and cross-field constraints before building packet.
  const validationErr = validateArgs(args);
  if (validationErr !== null) {
    process.stderr.write(`error: ${validationErr}\n`);
    process.exit(2);
  }

  // Dedupe repeatable arrays
  args.allowedFiles = Array.from(new Set(args.allowedFiles));
  args.forbiddenFiles = Array.from(new Set(args.forbiddenFiles));
  args.allowedCommands = Array.from(new Set(args.allowedCommands));
  args.requiredVerification = Array.from(new Set(args.requiredVerification));

  const repoRootRaw = args.repo;
  if (!isAbsolute(repoRootRaw)) {
    process.stderr.write("error: --repo path must be absolute\n");
    process.exit(2);
  }
  const repoRoot = resolve(repoRootRaw);
  const bridgeRoot = resolveBridgeRoot(args, repoRoot);

  const packet = buildPacket(args);

  if (args.dryRun) {
    process.stdout.write(JSON.stringify(packet, null, 2) + "\n");
    process.exit(0);
  }

  const pendingDir = join(bridgeRoot, "tasks", "pending");
  mkdirSync(pendingDir, { recursive: true });
  const taskPath = join(pendingDir, `${args.taskId}.task.json`);

  if (existsSync(taskPath)) {
    process.stderr.write(
      `error: task file already exists: ${taskPath}\nTo overwrite, remove the file first or use a different --task-id.\n`,
    );
    process.exit(1);
  }

  writeFileSync(taskPath, JSON.stringify(packet, null, 2) + "\n", "utf8");

  process.stdout.write(
    JSON.stringify(
      { task_id: args.taskId, task_path: taskPath, mode: args.mode },
      null,
      2,
    ) + "\n",
  );
  process.exit(0);
}

function exitErr(msg) {
  process.stderr.write(`error: ${msg}\n`);
  printUsage();
  process.exit(2);
}

main();
