#!/usr/bin/env node
// AGENT-BRIDGE-002 — Codex ⇄ Claude Code file-bridge skeleton.
//
// In AGENT-BRIDGE-002 this script only:
//   - parses CLI flags
//   - reads and validates a task packet
//   - prints a dry-run summary
//
// It does NOT:
//   - call claude
//   - call codex
//   - write .agent-bridge/ state
//   - modify repo files
//
// Phase 3 will add Claude invocation separately.

import { readFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";

// -----------------------------------------------------------------
// Required forbidden actions
// -----------------------------------------------------------------

const REQUIRED_FORBIDDEN_ACTIONS = [
  "git commit",
  "git push",
  "git commit --amend",
  "git rebase",
  "git reset --hard",
  "live apply",
  "HCC Auto Executor",
];

// -----------------------------------------------------------------
// Required task packet fields
// -----------------------------------------------------------------

const REQUIRED_FIELDS = [
  "schema_version",
  "task_id",
  "mode",
  "objective",
  "allowed_files",
  "forbidden_files",
  "allowed_commands",
  "forbidden_actions",
  "required_verification",
  "report_schema",
  "expected_authorization_type",
];

// -----------------------------------------------------------------
// Forbidden path patterns (rejected outright)
// -----------------------------------------------------------------

// Hard-forbidden paths: these may NEVER appear in allowed_files.
// They are still allowed in forbidden_files (as declarations of intent).
const HARD_FORBIDDEN_PATHS = [
  "~/.hermes/config.yaml",
  "~/.hermes/handoff/packs",
  "~/.hermes/audit",
  "docs/roadmap-locked-2026-05-28.md",
];

function isHardForbiddenPath(p) {
  if (typeof p !== "string") return false;
  for (const forbidden of HARD_FORBIDDEN_PATHS) {
    if (p === forbidden) return true;
  }
  // Any path under ~/.hermes/ is hard-forbidden.
  if (p === "~/.hermes" || p.startsWith("~/.hermes/")) return true;
  return false;
}

function isExplicitHermesForbiddenPath(p) {
  // The task packet may declare an explicit ~/.hermes/... forbidden path
  // (in forbidden_files), which is absolute. Other absolute paths are
  // rejected.
  if (typeof p !== "string") return false;
  if (isHardForbiddenPath(p)) return true;
  return false;
}

function validatePathList(name, paths, opts = {}) {
  const allowHardForbidden = opts.allowHardForbidden === true;
  if (!Array.isArray(paths)) {
    throw new Error(`validate: ${name} must be an array`);
  }
  for (const p of paths) {
    if (typeof p !== "string" || p.length === 0) {
      throw new Error(`validate: ${name} contains non-string or empty entry`);
    }
    if (p.includes("..")) {
      throw new Error(`validate: ${name} contains path traversal "..": ${p}`);
    }
    if (!allowHardForbidden && isHardForbiddenPath(p)) {
      throw new Error(
        `validate: ${name} contains hard-forbidden path: ${p}`,
      );
    }
    if (isAbsolute(p) && !isExplicitHermesForbiddenPath(p)) {
      throw new Error(`validate: ${name} contains absolute path not in explicit-allowlist: ${p}`);
    }
  }
}

// -----------------------------------------------------------------
// CLI parser (no deps)
// -----------------------------------------------------------------

function parseArgs(argv) {
  const out = { task: null, repo: null, dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--task") {
      out.task = argv[++i] ?? null;
    } else if (a === "--repo") {
      out.repo = argv[++i] ?? null;
    } else if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--help" || a === "-h") {
      out.help = true;
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return out;
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/agent-bridge/run-claude-task.mjs [options]",
      "",
      "Options:",
      "  --task <path>     Path to task packet JSON",
      "  --repo <path>     Path to repo root",
      "  --dry-run         Validate only; do not execute (required in AGENT-BRIDGE-002)",
      "  --help, -h        Print this message",
      "",
      "AGENT-BRIDGE-002 supports --dry-run only. Non-dry-run execution is",
      "not implemented in this slice.",
      "",
    ].join("\n"),
  );
}

// -----------------------------------------------------------------
// Validation
// -----------------------------------------------------------------

function validateTaskPacket(packet) {
  if (packet === null || typeof packet !== "object" || Array.isArray(packet)) {
    throw new Error("validate: task packet must be a JSON object");
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in packet)) {
      throw new Error(`validate: missing required field: ${field}`);
    }
  }
  validatePathList("allowed_files", packet.allowed_files);
  validatePathList("forbidden_files", packet.forbidden_files, {
    allowHardForbidden: true,
  });

  // Intersection check: a normalized path in allowed_files may not
  // also appear in forbidden_files. Equality is string equality on
  // the entries themselves (post-trim, no normalization; the same
  // path must be spelled identically in both lists to collide).
  const forbiddenSet = new Set(packet.forbidden_files);
  for (const allowed of packet.allowed_files) {
    if (forbiddenSet.has(allowed)) {
      throw new Error(
        `validate: allowed_files overlaps forbidden_files: ${allowed}`,
      );
    }
  }
  if (!Array.isArray(packet.allowed_commands)) {
    throw new Error("validate: allowed_commands must be an array");
  }
  if (!Array.isArray(packet.forbidden_actions)) {
    throw new Error("validate: forbidden_actions must be an array");
  }
  for (const required of REQUIRED_FORBIDDEN_ACTIONS) {
    if (!packet.forbidden_actions.includes(required)) {
      throw new Error(
        `validate: forbidden_actions missing required entry: ${required}`,
      );
    }
  }
  if (!Array.isArray(packet.required_verification)) {
    throw new Error("validate: required_verification must be an array");
  }
  if (typeof packet.report_schema !== "object" || packet.report_schema === null) {
    throw new Error("validate: report_schema must be an object");
  }
  if (typeof packet.expected_authorization_type !== "string") {
    throw new Error("validate: expected_authorization_type must be a string");
  }
  if (typeof packet.task_id !== "string" || packet.task_id.length === 0) {
    throw new Error("validate: task_id must be a non-empty string");
  }
  if (typeof packet.mode !== "string" || packet.mode.length === 0) {
    throw new Error("validate: mode must be a non-empty string");
  }
  if (typeof packet.objective !== "string" || packet.objective.length === 0) {
    throw new Error("validate: objective must be a non-empty string");
  }
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

  if (!args.task) {
    process.stderr.write("error: --task <path> is required\n");
    printUsage();
    process.exit(2);
  }
  if (!args.repo) {
    process.stderr.write("error: --repo <path> is required\n");
    printUsage();
    process.exit(2);
  }

  if (!args.dryRun) {
    process.stderr.write(
      "Execution mode is not implemented in AGENT-BRIDGE-002.\n",
    );
    process.exit(1);
  }

  // Read task packet.
  let raw;
  try {
    raw = readFileSync(args.task, "utf8");
  } catch (e) {
    process.stderr.write(`error: failed to read task packet: ${e.message}\n`);
    process.exit(2);
  }

  let packet;
  try {
    packet = JSON.parse(raw);
  } catch (e) {
    process.stderr.write(`error: task packet is not valid JSON: ${e.message}\n`);
    process.exit(2);
  }

  // Validate.
  try {
    validateTaskPacket(packet);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }

  // Resolve repo path (validation only; no file writes).
  const repoRoot = resolve(args.repo);
  if (!isAbsolute(repoRoot)) {
    process.stderr.write("error: resolved repo path is not absolute\n");
    process.exit(2);
  }

  // Print dry-run summary.
  const out = {
    task_id: packet.task_id,
    mode: packet.mode,
    objective: packet.objective,
    allowed_files_count: packet.allowed_files.length,
    forbidden_files_count: packet.forbidden_files.length,
    allowed_commands_count: packet.allowed_commands.length,
    forbidden_actions_count: packet.forbidden_actions.length,
    required_verification_count: packet.required_verification.length,
    expected_authorization_type: packet.expected_authorization_type,
    would_invoke_claude: false,
    would_modify_files: false,
    repo_root: repoRoot,
    note: "AGENT-BRIDGE-002 dry-run only; no runtime execution.",
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(0);
}

main();
