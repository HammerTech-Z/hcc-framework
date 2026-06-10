#!/usr/bin/env node
// AGENT-BRIDGE-002/002A/002B/003/003A/005/005A/005B/005C/005D/009/012/013/014 — Codex ⇄ Claude Code file-bridge.
//
// AGENT-BRIDGE-014 changes (runner-side):
//   - write-files-only spawn errors/timeouts still take an after snapshot.
//   - partial changed files are recorded in lifecycle log, latest pointer,
//     and .result.raw.txt while the run remains failed.
//
// AGENT-BRIDGE-013 changes (runner-side):
//   - adds controlled mode=write-files-only execution.
//   - write mode exposes only Read/Grep/Glob/Edit/MultiEdit/Write.
//   - Bash, Task, web tools, commit, push, amend, rebase, squash, live apply,
//     and HCC Auto Executor remain forbidden.
//   - runner snapshots local repo/hermes state before Claude and rejects the
//     result unless post-run changes are confined to allowed_files.
//
// AGENT-BRIDGE-012/012C changes (runner-side):
//   - adds opt-in --read-only-tools for mode=read-only task packets.
//   - default execution still disables all Claude tools.
//   - read-only tool mode allows Read/Grep/Glob only; Bash is not exposed.
//   - runner injects a small local git read-only context instead of allowing
//     Claude to run git commands.
//   - read-only tool mode uses Claude --json-schema output and local
//     validation of structured_output or Claude Code 2.1.141 result-string
//     JSON envelopes.
//   - lifecycle logs include read_only_tools and a non-secret Claude argv
//     summary that omits the prompt body.
//
// AGENT-BRIDGE-009 changes (runner-side):
//   - adds run_id to lifecycle log for idempotent artifact resolution.
//   - on successful .result.json write, archives stale same-task .result.raw.txt
//     to .agent-bridge/archive/<task_id>/ so consumers never see ambiguous
//     active artifacts.
//   - run_id is <task_id>-<started_at_epoch_ms>.
//
// AGENT-BRIDGE-005/005A/005B/005C/005D changes (runner-side):
//   - prompt now requires a strict JSON-only response (no markdown prose).
//   - result is written to .result.json when stdout is valid JSON with
//     all required result-schema fields and correct types; otherwise stdout is
//     written to .result.raw.txt and the run exits non-zero.
//   - .result.md is no longer produced; the .result.json (or .result.raw.txt)
//     pair is the only result artifact for this slice.
//
// AGENT-BRIDGE-003 still adds:
//   - --execute mode (design-only / read-only task packets)
//   - Claude invocation via spawnSync in non-interactive print mode
//   - tools disabled, no file edits by Claude
//
// This script does NOT:
//   - call codex
//   - automate commit / push / live apply
//   - write to ~/.hermes/*
//   - write to docs/roadmap-locked-2026-05-28.md
//   - write to .agent-bridge/tasks/
//   - allow Claude to approve, commit, or push its own work

import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { join, resolve, isAbsolute, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

// -----------------------------------------------------------------
// Required forbidden actions
// -----------------------------------------------------------------

const REQUIRED_FORBIDDEN_ACTIONS = [
  "git commit",
  "git push",
  "git commit --amend",
  "git rebase",
  "git reset --hard",
  "squash",
  "live apply",
  "HCC Auto Executor",
];

const READ_ONLY_CLAUDE_TOOLS = "Read,Grep,Glob";
const WRITE_FILES_CLAUDE_TOOLS = "Read,Grep,Glob,Edit,MultiEdit,Write";
const DISALLOWED_CLAUDE_TOOLS = [
  "Bash",
  "Edit",
  "MultiEdit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Task",
];
const WRITE_FILES_DISALLOWED_CLAUDE_TOOLS = [
  "Bash",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
  "Task",
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

// Modes supported in AGENT-BRIDGE --execute.
const EXECUTE_SUPPORTED_MODES = new Set(["design-only", "read-only", "write-files-only"]);

const RESULT_JSON_SCHEMA = {
  type: "object",
  properties: {
    schema_version: { type: "string" },
    task_id: { type: "string" },
    final_verdict: { type: "string" },
    claimed_changes: { type: "string" },
    files_modified: { type: "array", items: { type: "string" } },
    commands_run: { type: "array", items: { type: "string" } },
    raw_outputs_summary: { type: "string" },
    not_done: { type: "string" },
    known_unknowns: { type: "array", items: { type: "string" } },
    claimed_commit: { type: ["string", "null"] },
    claimed_pushed: { type: "boolean" },
    claimed_push_state: { type: ["object", "null"] },
  },
  required: [
    "schema_version",
    "task_id",
    "final_verdict",
    "claimed_changes",
    "files_modified",
    "commands_run",
    "raw_outputs_summary",
    "not_done",
    "known_unknowns",
    "claimed_commit",
    "claimed_pushed",
    "claimed_push_state",
  ],
  additionalProperties: true,
};

// -----------------------------------------------------------------
// Hard-forbidden paths
// -----------------------------------------------------------------

const HARD_FORBIDDEN_PATHS = [
  "~/.hermes/config.yaml",
  "~/.hermes/handoff/packs",
  "~/.hermes/audit",
  "docs/roadmap-locked-2026-05-28.md",
];

function isHardForbiddenPath(p) {
  if (typeof p !== "string") return false;
  if (p === ".git" || p.startsWith(".git/")) return true;
  for (const forbidden of HARD_FORBIDDEN_PATHS) {
    if (p === forbidden) return true;
  }
  if (p === "~/.hermes" || p.startsWith("~/.hermes/")) return true;
  return false;
}

function isExplicitHermesForbiddenPath(p) {
  if (typeof p !== "string") return false;
  return isHardForbiddenPath(p);
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
// task_id safety (AGENT-BRIDGE-003)
// -----------------------------------------------------------------

const TASK_ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function validateTaskId(taskId) {
  if (typeof taskId !== "string" || taskId.length === 0) {
    throw new Error("validate: task_id must be a non-empty string");
  }
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new Error(
      `validate: task_id contains illegal characters (only A-Z a-z 0-9 . _ - allowed): ${taskId}`,
    );
  }
  if (
    taskId.includes("/") ||
    taskId.includes("\\") ||
    taskId.includes("..")
  ) {
    throw new Error(`validate: task_id contains path separator: ${taskId}`);
  }
}

// -----------------------------------------------------------------
// CLI parser (no deps)
// -----------------------------------------------------------------

function parseArgs(argv) {
  const out = {
    task: null,
    repo: null,
    dryRun: false,
    execute: false,
    bridgeRoot: null,
    claudeBin: "claude",
    timeoutMs: 300000,
    readOnlyTools: false,
    help: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--task") {
      out.task = argv[++i] ?? null;
    } else if (a === "--repo") {
      out.repo = argv[++i] ?? null;
    } else if (a === "--dry-run") {
      out.dryRun = true;
    } else if (a === "--execute") {
      out.execute = true;
    } else if (a === "--read-only-tools") {
      out.readOnlyTools = true;
    } else if (a === "--bridge-root") {
      out.bridgeRoot = argv[++i] ?? null;
    } else if (a === "--claude-bin") {
      out.claudeBin = argv[++i] ?? null;
    } else if (a === "--timeout-ms") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) {
        throw new Error("--timeout-ms must be a positive number");
      }
      out.timeoutMs = v;
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
      "  --task <path>          Path to task packet JSON",
      "  --repo <path>          Path to repo root",
      "  --dry-run              Validate only; do not execute",
      "  --execute              Invoke Claude (design-only / read-only / write-files-only)",
      "  --read-only-tools      Opt-in read-only Claude tools for mode=read-only only",
      "  --bridge-root <path>    Optional; default = <repo>/.agent-bridge",
      "  --claude-bin <path>     Optional; default = claude",
      "  --timeout-ms <number>   Optional; default = 300000",
      "  --help, -h              Print this message",
      "",
      "Exactly one of --dry-run or --execute must be provided.",
      "AGENT-BRIDGE --execute supports mode = design-only, read-only, or write-files-only.",
      "Tools are disabled by default; --read-only-tools enables read-only inspection only.",
      "mode=write-files-only automatically enables Read/Grep/Glob/Edit/MultiEdit/Write only.",
      "No commit / push / live apply automation; user authorization remains required.",
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
  validateTaskId(packet.task_id);
  validatePathList("allowed_files", packet.allowed_files);
  validatePathList("forbidden_files", packet.forbidden_files, {
    allowHardForbidden: true,
  });

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
  if (typeof packet.mode !== "string" || packet.mode.length === 0) {
    throw new Error("validate: mode must be a non-empty string");
  }
  if (typeof packet.objective !== "string" || packet.objective.length === 0) {
    throw new Error("validate: objective must be a non-empty string");
  }
  if (packet.mode === "write-files-only") {
    if (packet.allowed_files.length === 0) {
      throw new Error("validate: write-files-only requires non-empty allowed_files");
    }
    if (packet.allowed_commands.length > 0) {
      throw new Error("validate: write-files-only does not expose Bash; allowed_commands must be empty");
    }
  }
}

// -----------------------------------------------------------------
// Prompt construction
// -----------------------------------------------------------------

function buildPrompt(packet, opts = {}) {
  const readOnlyTools = opts.readOnlyTools === true;
  const writeFilesTools = opts.writeFilesTools === true;
  const localReadOnlyContext = opts.localReadOnlyContext ?? null;
  const lines = [];
  lines.push(
    writeFilesTools
      ? "AGENT-BRIDGE-013 write-files-only task execution."
      : readOnlyTools
        ? "AGENT-BRIDGE-012 read-only task execution."
        : "AGENT-BRIDGE-005D task execution.",
  );
  lines.push("");
  lines.push(`task_id: ${packet.task_id}`);
  lines.push(`mode: ${packet.mode}`);
  lines.push(`objective: ${packet.objective}`);
  lines.push("");
  lines.push("allowed_files (write allowlist):");
  for (const p of packet.allowed_files) lines.push(`  - ${p}`);
  lines.push("");
  lines.push("forbidden_files:");
  for (const p of packet.forbidden_files) lines.push(`  - ${p}`);
  lines.push("");
  lines.push("forbidden_actions:");
  for (const a of packet.forbidden_actions) lines.push(`  - ${a}`);
  lines.push("");
  lines.push("required_verification:");
  for (const v of packet.required_verification) lines.push(`  - ${v}`);
  lines.push("");
  lines.push("Return ONLY a single JSON object. No markdown, no code fences, no commentary.");
  lines.push("The response MUST start with { and end with }.");
  lines.push("");
  lines.push("CANONICAL EXAMPLE (use these exact types, fill in values):");
  lines.push("{");
  lines.push('  "schema_version": "1.0.0",');
  lines.push(`  "task_id": "${packet.task_id}",`);
  lines.push('  "final_verdict": "complete",');
  lines.push('  "claimed_changes": "",');
  lines.push('  "files_modified": [],');
  lines.push('  "commands_run": [],');
  lines.push('  "raw_outputs_summary": "",');
  lines.push('  "not_done": "",');
  lines.push('  "known_unknowns": [],');
  lines.push('  "claimed_commit": null,');
  lines.push('  "claimed_pushed": false,');
  lines.push('  "claimed_push_state": null');
  lines.push("}");
  lines.push("");
  lines.push("TYPE RULES (strict, no shortcuts):");
  lines.push("- known_unknowns MUST be an array, use [] if none.");
  lines.push("- claimed_pushed MUST be boolean true/false, use false if no push happened.");
  lines.push("- claimed_push_state MUST be object or null, use null if no push happened.");
  lines.push("- claimed_commit MUST be string or null, use null if no commit happened.");
  lines.push("- files_modified and commands_run MUST be arrays, use [] if none.");
  lines.push("- Never use empty string \"\" as a substitute for null, false, or [].");
  lines.push("");
  lines.push("ANTI-OVERCLAIM RULES:");
  if (writeFilesTools) {
    lines.push("- Write tools are available ONLY for repo-local edits to allowed_files.");
    lines.push("- You may use Read/Grep/Glob/Edit/MultiEdit/Write only.");
    lines.push("- Bash is disabled. Do not run tests, install dependencies, git commands,");
    lines.push("  network commands, live apply, HCC Auto Executor, or any shell command.");
    lines.push("- You MUST modify only paths listed in allowed_files. Do not create, delete,");
    lines.push("  or modify any forbidden_files, .gitignore, roadmap, package files,");
    lines.push("  source/runtime/test files not listed in allowed_files, .git metadata,");
    lines.push("  ~/.hermes, ~/.ssh, .env, absolute paths, ~ paths, .. paths, or secrets.");
    lines.push("- You cannot approve your own work. claimed_commit MUST be null,");
    lines.push("  claimed_pushed MUST be false, and claimed_push_state MUST be null.");
    lines.push("- commands_run must be [] because Bash is disabled. Put unrun checks in");
    lines.push("  not_done or known_unknowns for Codex-side audit.");
    lines.push("- The final response must satisfy the provided JSON schema. No prose,");
    lines.push("  markdown, code fences, or explanation outside the structured result.");
  } else if (readOnlyTools) {
    lines.push("- Read-only tools are available ONLY for inspection inside the repo.");
    lines.push("- Use Read/Grep/Glob for repo-local file inspection. Bash is disabled.");
    lines.push("- allowed_commands and required_verification are descriptive only; they do");
    lines.push("  not grant command access.");
    lines.push("- Do not read absolute paths, ~ paths, .. paths, ~/.hermes, ~/.ssh, .env,");
    lines.push("  secret files, credentials, or files outside the repo.");
    lines.push("- Do not run exploratory write, install, network, commit, push, amend,");
    lines.push("  rebase, reset, checkout, clean, live apply, or HCC Auto Executor commands.");
    lines.push("- Do not modify any file. Do not write source, runtime, test, docs, .gitignore,");
    lines.push("  package, lockfile, or ~/.hermes files. Do not create temp files.");
    lines.push("- commands_run must list only commands you actually ran. files_modified must");
    lines.push("  be [] because this task is read-only.");
    lines.push("- The final response must satisfy the provided JSON schema. No prose,");
    lines.push("  markdown, code fences, or explanation outside the structured result.");
    if (localReadOnlyContext !== null) {
      lines.push("");
      lines.push("runner_collected_local_context:");
      lines.push("```json");
      lines.push(JSON.stringify(localReadOnlyContext, null, 2));
      lines.push("```");
    }
  } else {
    lines.push("- Tools are DISABLED. You cannot run git status, stat, rg, or any shell");
    lines.push("  command. Do not claim you verified local git status, file mtimes,");
    lines.push("  roadmap diff, or working tree state.");
    lines.push("- If you did not actually run a command, you MUST NOT say you verified that");
    lines.push("  fact. Use known_unknowns or not_done for facts you could not verify.");
    lines.push("- files_modified and commands_run must be empty arrays [] because you cannot");
    lines.push("  modify files or run commands in this mode.");
  }
  return lines.join("\n");
}

// AGENT-BRIDGE-005A strict result type validation — all checks are in
// validateResultJson(). REQUIRED_RESULT_FIELDS is retained for docs only.

function validateResultJson(stdout, expectedTaskId) {
  // Returns { ok: true, parsed } on success; { ok: false, error } on parse or type error.
  if (typeof stdout !== "string") {
    return { ok: false, error: "stdout is not a string" };
  }
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "stdout is empty" };
  }
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return { ok: false, error: "stdout is not a JSON object (must start with '{' and end with '}')" };
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${e.message}` };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "JSON root is not an object" };
  }

  const typeErrors = [];

  // schema_version: string, non-empty
  if (!("schema_version" in parsed)) typeErrors.push("missing schema_version");
  else if (typeof parsed.schema_version !== "string" || parsed.schema_version.length === 0)
    typeErrors.push("schema_version must be a non-empty string");

  // task_id: string, non-empty, must equal expected task_id
  if (!("task_id" in parsed)) typeErrors.push("missing task_id");
  else if (typeof parsed.task_id !== "string" || parsed.task_id.length === 0)
    typeErrors.push("task_id must be a non-empty string");
  else if (parsed.task_id !== expectedTaskId)
    typeErrors.push(`task_id mismatch: result has "${parsed.task_id}", expected "${expectedTaskId}"`);

  // final_verdict: string, non-empty
  if (!("final_verdict" in parsed)) typeErrors.push("missing final_verdict");
  else if (typeof parsed.final_verdict !== "string" || parsed.final_verdict.length === 0)
    typeErrors.push("final_verdict must be a non-empty string");

  // claimed_changes: string
  if (!("claimed_changes" in parsed)) typeErrors.push("missing claimed_changes");
  else if (typeof parsed.claimed_changes !== "string")
    typeErrors.push("claimed_changes must be a string");

  // files_modified: string[]
  if (!("files_modified" in parsed)) typeErrors.push("missing files_modified");
  else if (!Array.isArray(parsed.files_modified))
    typeErrors.push("files_modified must be an array");
  else if (parsed.files_modified.some((x) => typeof x !== "string"))
    typeErrors.push("files_modified must contain only strings (no null/object/number)");

  // commands_run: string[]
  if (!("commands_run" in parsed)) typeErrors.push("missing commands_run");
  else if (!Array.isArray(parsed.commands_run))
    typeErrors.push("commands_run must be an array");
  else if (parsed.commands_run.some((x) => typeof x !== "string"))
    typeErrors.push("commands_run must contain only strings (no null/object/number)");

  // raw_outputs_summary: string
  if (!("raw_outputs_summary" in parsed)) typeErrors.push("missing raw_outputs_summary");
  else if (typeof parsed.raw_outputs_summary !== "string")
    typeErrors.push("raw_outputs_summary must be a string");

  // not_done: string
  if (!("not_done" in parsed)) typeErrors.push("missing not_done");
  else if (typeof parsed.not_done !== "string")
    typeErrors.push("not_done must be a string");

  // known_unknowns: string[]
  if (!("known_unknowns" in parsed)) typeErrors.push("missing known_unknowns");
  else if (!Array.isArray(parsed.known_unknowns))
    typeErrors.push("known_unknowns must be an array");
  else if (parsed.known_unknowns.some((x) => typeof x !== "string"))
    typeErrors.push("known_unknowns must contain only strings (no null/object/number)");

  // claimed_commit: string | null
  if (!("claimed_commit" in parsed)) typeErrors.push("missing claimed_commit");
  else {
    const t = typeof parsed.claimed_commit;
    if (parsed.claimed_commit !== null && t !== "string")
      typeErrors.push("claimed_commit must be a string or null");
  }

  // claimed_pushed: boolean
  if (!("claimed_pushed" in parsed)) typeErrors.push("missing claimed_pushed");
  else if (typeof parsed.claimed_pushed !== "boolean")
    typeErrors.push("claimed_pushed must be a boolean");

  // claimed_push_state: object | null
  if (!("claimed_push_state" in parsed)) typeErrors.push("missing claimed_push_state");
  else {
    const ps = parsed.claimed_push_state;
    if (ps !== null) {
      if (typeof ps !== "object" || Array.isArray(ps))
        typeErrors.push("claimed_push_state must be an object or null");
      else {
        // Validate push_state sub-fields if present.
        if ("head" in ps && typeof ps.head !== "string")
          typeErrors.push("claimed_push_state.head must be a string");
        if ("origin_head" in ps && typeof ps.origin_head !== "string")
          typeErrors.push("claimed_push_state.origin_head must be a string");
        if ("ahead" in ps && typeof ps.ahead !== "number")
          typeErrors.push("claimed_push_state.ahead must be a number");
        if ("behind" in ps && typeof ps.behind !== "number")
          typeErrors.push("claimed_push_state.behind must be a number");
      }
    }
  }

  if (typeErrors.length > 0) {
    return { ok: false, error: `schema validation failed: ${typeErrors.join("; ")}`, parsed };
  }
  return { ok: true, parsed };
}

// -----------------------------------------------------------------
// Lifecycle log helpers
// -----------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

function validateReadOnlyCommands(packet) {
  if (packet.allowed_commands.length > 0) {
    return "--read-only-tools does not expose Bash; allowed_commands must be empty";
  }
  return null;
}

function validateWriteFilesCommands(packet) {
  if (packet.allowed_commands.length > 0) {
    return "write-files-only does not expose Bash; allowed_commands must be empty";
  }
  return null;
}

function runLocalGitContext(repoRoot, args) {
  const r = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 10000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    command: `git ${args.join(" ")}`,
    exit_code: r.status ?? (r.error ? 1 : 0),
    stdout: (r.stdout ?? "").slice(0, 12000),
    stderr: (r.stderr ?? "").slice(0, 4000),
    error: r.error ? r.error.message : null,
  };
}

function buildLocalReadOnlyContext(repoRoot) {
  return {
    repo_root: repoRoot,
    head: runLocalGitContext(repoRoot, ["rev-parse", "HEAD"]),
    origin_head: runLocalGitContext(repoRoot, ["rev-parse", "origin/hermes-pro-main"]),
    ahead: runLocalGitContext(repoRoot, ["rev-list", "--count", "origin/hermes-pro-main..HEAD"]),
    behind: runLocalGitContext(repoRoot, ["rev-list", "--count", "HEAD..origin/hermes-pro-main"]),
    status_short: runLocalGitContext(repoRoot, ["status", "--short", "-uall"]),
    recent_log: runLocalGitContext(repoRoot, ["log", "--oneline", "--decorate", "--max-count=12"]),
  };
}

function readSnapshotFiles(repoRoot) {
  const tracked = spawnSync("git", ["ls-files", "--cached"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const untracked = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ignored = spawnSync("git", [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--",
    ":!.agent-bridge",
    ":!node_modules",
  ], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (tracked.status !== 0 || untracked.status !== 0 || ignored.status !== 0) {
    throw new Error("failed to list repo files for write-files-only snapshot");
  }
  return Array.from(
    new Set(
      `${tracked.stdout ?? ""}\n${untracked.stdout ?? ""}\n${ignored.stdout ?? ""}`
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith(".agent-bridge/")),
    ),
  ).sort();
}

function hashFile(path) {
  const data = readFileSync(path);
  return createHash("sha256").update(data).digest("hex");
}

function snapshotRepoFiles(repoRoot) {
  const files = new Map();
  for (const rel of readSnapshotFiles(repoRoot)) {
    const abs = join(repoRoot, rel);
    try {
      const st = statSync(abs);
      if (!st.isFile()) continue;
      files.set(rel, hashFile(abs));
    } catch {
      files.set(rel, null);
    }
  }
  return files;
}

function diffRepoSnapshots(before, after) {
  const out = [];
  const all = new Set([...before.keys(), ...after.keys()]);
  for (const rel of Array.from(all).sort()) {
    if (before.get(rel) !== after.get(rel)) {
      out.push(rel);
    }
  }
  return out;
}

function snapshotRefs(repoRoot) {
  return {
    head: runLocalGitContext(repoRoot, ["rev-parse", "HEAD"]).stdout.trim(),
    origin_head: runLocalGitContext(repoRoot, ["rev-parse", "origin/hermes-pro-main"]).stdout.trim(),
    ahead: Number(runLocalGitContext(repoRoot, ["rev-list", "--count", "origin/hermes-pro-main..HEAD"]).stdout.trim()),
    behind: Number(runLocalGitContext(repoRoot, ["rev-list", "--count", "HEAD..origin/hermes-pro-main"]).stdout.trim()),
  };
}

function snapshotHermesMtime() {
  const paths = {
    config_yaml: "/Users/midoudou/.hermes/config.yaml",
    handoff_packs: "/Users/midoudou/.hermes/handoff/packs",
    audit: "/Users/midoudou/.hermes/audit",
  };
  const out = {};
  for (const [key, path] of Object.entries(paths)) {
    try {
      out[key] = Math.floor(statSync(path).mtimeMs / 1000);
    } catch {
      out[key] = null;
    }
  }
  return out;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function validateWriteFilesPostRun(packet, parsed, beforeState, afterState) {
  const errors = [];
  const changedFiles = diffRepoSnapshots(beforeState.files, afterState.files);
  const allowed = new Set(packet.allowed_files);
  const forbidden = new Set(packet.forbidden_files);

  for (const file of changedFiles) {
    if (!allowed.has(file)) {
      errors.push(`changed file outside allowed_files: ${file}`);
    }
    if (forbidden.has(file) || isHardForbiddenPath(file)) {
      errors.push(`changed forbidden file: ${file}`);
    }
  }
  for (const file of parsed.files_modified) {
    if (!changedFiles.includes(file)) {
      errors.push(`result.files_modified claims file not changed during run: ${file}`);
    }
  }
  for (const file of changedFiles) {
    if (!parsed.files_modified.includes(file)) {
      errors.push(`changed file missing from result.files_modified: ${file}`);
    }
  }
  if (parsed.commands_run.length > 0) {
    errors.push("write-files-only result.commands_run must be [] because Bash is disabled");
  }
  if (parsed.claimed_commit !== null) {
    errors.push("write-files-only result.claimed_commit must be null");
  }
  if (parsed.claimed_pushed !== false) {
    errors.push("write-files-only result.claimed_pushed must be false");
  }
  if (parsed.claimed_push_state !== null) {
    errors.push("write-files-only result.claimed_push_state must be null");
  }
  if (!sameJson(beforeState.hermes, afterState.hermes)) {
    errors.push("~/.hermes mtimes changed during write-files-only run");
  }
  if (beforeState.refs.head !== afterState.refs.head) {
    errors.push("HEAD changed during write-files-only run; commits are forbidden");
  }
  if (beforeState.refs.origin_head !== afterState.refs.origin_head) {
    errors.push("origin/hermes-pro-main changed during write-files-only run; pushes/fetches are forbidden");
  }
  if (beforeState.refs.ahead !== afterState.refs.ahead || beforeState.refs.behind !== afterState.refs.behind) {
    errors.push("ahead/behind changed during write-files-only run");
  }
  return {
    ok: errors.length === 0,
    errors,
    changedFiles,
  };
}

function validateWriteFilesPartialPostRun(packet, beforeState, afterState) {
  const errors = [];
  const changedFiles = diffRepoSnapshots(beforeState.files, afterState.files);
  const allowed = new Set(packet.allowed_files);
  const forbidden = new Set(packet.forbidden_files);

  for (const file of changedFiles) {
    if (!allowed.has(file)) {
      errors.push(`partial changed file outside allowed_files: ${file}`);
    }
    if (forbidden.has(file) || isHardForbiddenPath(file)) {
      errors.push(`partial changed forbidden file: ${file}`);
    }
  }
  if (!sameJson(beforeState.hermes, afterState.hermes)) {
    errors.push("~/.hermes mtimes changed during partial write-files-only run");
  }
  if (beforeState.refs.head !== afterState.refs.head) {
    errors.push("HEAD changed during partial write-files-only run; commits are forbidden");
  }
  if (beforeState.refs.origin_head !== afterState.refs.origin_head) {
    errors.push("origin/hermes-pro-main changed during partial write-files-only run; pushes/fetches are forbidden");
  }
  if (beforeState.refs.ahead !== afterState.refs.ahead || beforeState.refs.behind !== afterState.refs.behind) {
    errors.push("ahead/behind changed during partial write-files-only run");
  }

  return {
    ok: errors.length === 0,
    partial: true,
    errors,
    changedFiles,
  };
}

function buildClaudeArgv(packet, prompt, opts = {}) {
  const readOnlyTools = opts.readOnlyTools === true;
  const writeFilesTools = opts.writeFilesTools === true;
  const argv = [
    "-p",
    prompt,
    "--output-format",
  ];

  if (readOnlyTools || writeFilesTools) {
    const tools = writeFilesTools ? WRITE_FILES_CLAUDE_TOOLS : READ_ONLY_CLAUDE_TOOLS;
    const disallowed = writeFilesTools
      ? WRITE_FILES_DISALLOWED_CLAUDE_TOOLS
      : DISALLOWED_CLAUDE_TOOLS;
    argv.unshift("--bare");
    argv.push(
      "json",
      "--json-schema",
      JSON.stringify(RESULT_JSON_SCHEMA),
      "--tools",
      tools,
      "--allowedTools",
      tools,
      "--disallowedTools",
      disallowed.join(","),
      "--permission-mode",
      "default",
    );
  } else {
    argv.push(
      "text",
      "--tools",
      "",
      "--permission-mode",
      "default",
    );
  }

  return argv;
}

function extractStructuredOutput(stdout) {
  let envelope;
  try {
    envelope = JSON.parse(stdout.trim());
  } catch (e) {
    return { ok: false, error: `Claude JSON envelope parse error: ${e.message}` };
  }
  if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { ok: false, error: "Claude JSON envelope root is not an object" };
  }
  if (envelope.is_error === true) {
    return { ok: false, error: "Claude JSON envelope is_error=true" };
  }
  if ("structured_output" in envelope) {
    const structured = envelope.structured_output;
    if (structured === null || typeof structured !== "object" || Array.isArray(structured)) {
      return { ok: false, error: "Claude structured_output is not an object" };
    }
    return { ok: true, structured };
  }

  if (typeof envelope.result !== "string") {
    return { ok: false, error: "Claude JSON envelope missing structured_output and string result fallback" };
  }
  const resultText = envelope.result.trim();
  if (!resultText.startsWith("{") || !resultText.endsWith("}")) {
    return { ok: false, error: "Claude JSON envelope result fallback is not a raw JSON object string" };
  }
  let structured;
  try {
    structured = JSON.parse(resultText);
  } catch (e) {
    return { ok: false, error: `Claude JSON envelope result fallback parse error: ${e.message}` };
  }
  if (structured === null || typeof structured !== "object" || Array.isArray(structured)) {
    return { ok: false, error: "Claude JSON envelope result fallback is not an object" };
  }
  return { ok: true, structured };
}

function summarizeClaudeArgv(argv) {
  const summary = [];
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "-p" || value === "--print" || value === "--json-schema") {
      summary.push(value);
      if (i + 1 < argv.length) {
        summary.push(value === "--json-schema" ? "<json schema omitted>" : "<prompt omitted>");
        i++;
      }
    } else {
      summary.push(value);
    }
  }
  return summary;
}

function writeLatestPointer(path, fields) {
  writeFileSync(
    path,
    JSON.stringify(
      {
        task_id: fields.task_id,
        run_id: fields.run_id,
        status: fields.status,
        result_path: fields.result_path,
        log_path: fields.log_path,
        created_at: fields.created_at,
        claude_exit_code: fields.claude_exit_code,
        partial_changed_files: fields.partial_changed_files ?? null,
        partial_post_run_validation: fields.partial_post_run_validation ?? null,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );
}

function buildLog(packet, fields) {
  return JSON.stringify(
    {
      task_id: packet.task_id,
      run_id: fields.run_id,
      started_at: fields.started_at,
      finished_at: fields.finished_at,
      claude_exit_code: fields.claude_exit_code,
      result_path: fields.result_path,
      mode: packet.mode,
      would_modify_files: packet.mode === "write-files-only",
      tools_disabled: fields.tools_disabled !== false,
      read_only_tools: fields.read_only_tools === true,
      write_files_tools: fields.write_files_tools === true,
      claude_argv_summary: fields.claude_argv_summary ?? null,
      post_run_validation: fields.post_run_validation ?? null,
      partial_changed_files: fields.partial_changed_files ?? null,
      partial_post_run_validation: fields.partial_post_run_validation ?? null,
      note: fields.note ?? null,
    },
    null,
    2,
  ) + "\n";
}

// -----------------------------------------------------------------
// Main
// -----------------------------------------------------------------

function loadTaskPacket(args) {
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
  try {
    validateTaskPacket(packet);
  } catch (e) {
    process.stderr.write(`error: ${e.message}\n`);
    process.exit(2);
  }
  return packet;
}

function printDryRunSummary(packet, repoRoot) {
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
    would_modify_files: packet.mode === "write-files-only",
    repo_root: repoRoot,
    note: "AGENT-BRIDGE dry-run only; no runtime execution.",
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

function runExecute(args, packet, repoRoot) {
  if (!EXECUTE_SUPPORTED_MODES.has(packet.mode)) {
    process.stderr.write(
      `error: Execution mode only supports design-only/read-only/write-files-only tasks. Got mode=${packet.mode}.\n`,
    );
    process.exit(2);
  }
  if (args.readOnlyTools && packet.mode !== "read-only") {
    process.stderr.write(
      `error: --read-only-tools is only supported for mode=read-only. Got mode=${packet.mode}.\n`,
    );
    process.exit(2);
  }
  if (args.readOnlyTools) {
    const readOnlyCommandErr = validateReadOnlyCommands(packet);
    if (readOnlyCommandErr !== null) {
      process.stderr.write(`error: ${readOnlyCommandErr}\n`);
      process.exit(2);
    }
  }
  const writeFilesTools = packet.mode === "write-files-only";
  if (writeFilesTools) {
    const writeCommandErr = validateWriteFilesCommands(packet);
    if (writeCommandErr !== null) {
      process.stderr.write(`error: ${writeCommandErr}\n`);
      process.exit(2);
    }
  }

  // Bridge-root sandboxing: the bridge may only write inside the
  // repo-local `.agent-bridge/` directory. The default is
  // `<repo>/.agent-bridge`; explicit `--bridge-root` values must
  // resolve either to that exact path or to a sub-path of it. This
  // prevents the script from ever writing into:
  //   - `~/.hermes/*` (under any user home)
  //   - repo tracked source dirs (`scripts/`, `docs/`, `src/`, `tests/`)
  //   - `/tmp/*` or any other external location
  const repoBridgeRoot = resolve(repoRoot, ".agent-bridge");
  const bridgeRoot = args.bridgeRoot
    ? resolve(args.bridgeRoot)
    : repoBridgeRoot;
  const withinRepoBridge =
    bridgeRoot === repoBridgeRoot ||
    bridgeRoot.startsWith(repoBridgeRoot + sep);
  if (!withinRepoBridge) {
    process.stderr.write(
      `error: --bridge-root must resolve inside ${repoBridgeRoot}\n`,
    );
    process.exit(2);
  }
  const resultsDir = join(bridgeRoot, "results");
  const logsDir = join(bridgeRoot, "logs");
  const resultJsonPath = join(resultsDir, `${packet.task_id}.result.json`);
  const resultRawPath = join(resultsDir, `${packet.task_id}.result.raw.txt`);
  const latestJsonPath = join(resultsDir, `${packet.task_id}.latest.json`);
  const logPath = join(logsDir, `${packet.task_id}.log`);

  mkdirSync(resultsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  const started_at = nowIso();
  const run_id = `${packet.task_id}-${Date.now()}`;
  const beforeWriteState = writeFilesTools
    ? {
        files: snapshotRepoFiles(repoRoot),
        refs: snapshotRefs(repoRoot),
        hermes: snapshotHermesMtime(),
      }
    : null;
  const localReadOnlyContext = args.readOnlyTools
    ? buildLocalReadOnlyContext(repoRoot)
    : null;
  const prompt = buildPrompt(packet, {
    readOnlyTools: args.readOnlyTools,
    writeFilesTools,
    localReadOnlyContext,
  });
  const argsForClaude = buildClaudeArgv(packet, prompt, {
    readOnlyTools: args.readOnlyTools,
    writeFilesTools,
  });
  const logFields = {
    tools_disabled: !args.readOnlyTools && !writeFilesTools,
    read_only_tools: args.readOnlyTools,
    write_files_tools: writeFilesTools,
    claude_argv_summary: summarizeClaudeArgv(argsForClaude),
  };
  const result = spawnSync(args.claudeBin, argsForClaude, {
    encoding: "utf8",
    timeout: args.timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: repoRoot,
    env: process.env,
  });
  const finished_at = nowIso();

  if (result.error) {
    let partialPostRunValidation = null;
    if (writeFilesTools) {
      try {
        const afterWriteState = {
          files: snapshotRepoFiles(repoRoot),
          refs: snapshotRefs(repoRoot),
          hermes: snapshotHermesMtime(),
        };
        partialPostRunValidation = validateWriteFilesPartialPostRun(
          packet,
          beforeWriteState,
          afterWriteState,
        );
      } catch (e) {
        partialPostRunValidation = {
          ok: false,
          partial: true,
          errors: [`failed to snapshot partial write-files-only run: ${e.message}`],
          changedFiles: [],
        };
      }
    }
    const partialChangedFiles = partialPostRunValidation?.changedFiles ?? null;
    const partialNote = partialChangedFiles && partialChangedFiles.length > 0
      ? `; partial_changed_files=${partialChangedFiles.join(", ")}`
      : "";
    const partialErrors = partialPostRunValidation?.errors?.length > 0
      ? `; partial_errors=${partialPostRunValidation.errors.join("; ")}`
      : "";
    const note = `BLOCKED: spawn error: ${result.error.message}${partialNote}${partialErrors}`;
    // Write a short error note to .result.raw.txt so latest pointer
    // always points to an existing file.
    writeFileSync(
      resultRawPath,
      [
        `AGENT-BRIDGE spawn error: ${result.error.message}`,
        partialChangedFiles
          ? `partial_changed_files: ${JSON.stringify(partialChangedFiles)}`
          : null,
        partialPostRunValidation
          ? `partial_post_run_validation: ${JSON.stringify(partialPostRunValidation)}`
          : null,
        "--- stdout ---",
        result.stdout ?? "",
        "--- stderr ---",
        result.stderr ?? "",
      ].filter((line) => line !== null).join("\n") + "\n",
      "utf8",
    );
    writeFileSync(
      logPath,
      buildLog(packet, {
        run_id,
        started_at,
        finished_at,
        claude_exit_code: null,
        result_path: resultRawPath,
        note,
        partial_changed_files: partialChangedFiles,
        partial_post_run_validation: partialPostRunValidation,
        ...logFields,
      }),
      "utf8",
    );
    process.stderr.write(`error: ${note}\n`);
    writeLatestPointer(latestJsonPath, {
      task_id: packet.task_id, run_id, status: "failed",
      result_path: resultRawPath, log_path: logPath,
      created_at: finished_at, claude_exit_code: null,
      partial_changed_files: partialChangedFiles,
      partial_post_run_validation: partialPostRunValidation,
    });
    process.exit(1);
  }

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const exitCode = result.status ?? -1;

  // Non-zero exit: persist raw stdout to .result.raw.txt for debugging,
  // write log, exit non-zero. Do not attempt to validate.
  if (exitCode !== 0) {
    writeFileSync(resultRawPath, stdout, "utf8");
    const note = `BLOCKED: claude non-zero exit; stderr summary follows.`;
    writeFileSync(
      logPath,
      buildLog(packet, {
        run_id,
        started_at,
        finished_at,
        claude_exit_code: exitCode,
        result_path: resultRawPath,
        note,
        ...logFields,
      }) + "\n--- stderr summary ---\n" + stderr.slice(0, 4000) + "\n",
      "utf8",
    );
    process.stderr.write(
      `error: claude exited with code ${exitCode}. See ${logPath} for stderr summary; raw stdout at ${resultRawPath}\n`,
    );
    writeLatestPointer(latestJsonPath, {
      task_id: packet.task_id, run_id, status: "failed",
      result_path: resultRawPath, log_path: logPath,
      created_at: finished_at, claude_exit_code: exitCode,
    });
    process.exit(1);
  }

  // Zero exit: validate JSON schema and types against AGENT-BRIDGE-005A
  // strict result contract. Default tools-disabled mode expects raw JSON on
  // stdout. Read-only/write-files tools mode uses Claude --output-format json +
  // --json-schema, then validates the envelope's structured_output locally.
  // Do not attempt to repair malformed JSON. Do not infer missing fields.
  // Do not silently coerce invalid types.
  let validation;
  if (args.readOnlyTools || writeFilesTools) {
    const structured = extractStructuredOutput(stdout);
    if (!structured.ok) {
      validation = { ok: false, error: structured.error };
    } else {
      validation = validateResultJson(
        JSON.stringify(structured.structured),
        packet.task_id,
      );
    }
  } else {
    validation = validateResultJson(stdout, packet.task_id);
  }
  if (!validation.ok) {
    writeFileSync(resultRawPath, stdout, "utf8");
    const note = `BLOCKED: AGENT-BRIDGE-005 schema validation failed: ${validation.error}`;
    writeFileSync(
      logPath,
      buildLog(packet, {
        run_id,
        started_at,
        finished_at,
        claude_exit_code: exitCode,
        result_path: resultRawPath,
        note,
        ...logFields,
      }),
      "utf8",
    );
    process.stderr.write(`error: ${note}\n`);
    writeLatestPointer(latestJsonPath, {
      task_id: packet.task_id, run_id, status: "failed",
      result_path: resultRawPath, log_path: logPath,
      created_at: finished_at, claude_exit_code: exitCode,
    });
    process.exit(1);
  }

  let postRunValidation = null;
  if (writeFilesTools) {
    const afterWriteState = {
      files: snapshotRepoFiles(repoRoot),
      refs: snapshotRefs(repoRoot),
      hermes: snapshotHermesMtime(),
    };
    postRunValidation = validateWriteFilesPostRun(
      packet,
      validation.parsed,
      beforeWriteState,
      afterWriteState,
    );
    if (!postRunValidation.ok) {
      writeFileSync(resultRawPath, stdout, "utf8");
      const note = `BLOCKED: AGENT-BRIDGE-013 post-run validation failed: ${postRunValidation.errors.join("; ")}`;
      writeFileSync(
        logPath,
        buildLog(packet, {
          run_id,
          started_at,
          finished_at,
          claude_exit_code: exitCode,
          result_path: resultRawPath,
          note,
          post_run_validation: postRunValidation,
          ...logFields,
        }),
        "utf8",
      );
      process.stderr.write(`error: ${note}\n`);
      writeLatestPointer(latestJsonPath, {
        task_id: packet.task_id, run_id, status: "failed",
        result_path: resultRawPath, log_path: logPath,
        created_at: finished_at, claude_exit_code: exitCode,
      });
      process.exit(1);
    }
    validation.parsed._agent_bridge = {
      mode: "write-files-only",
      run_id,
      changed_files: postRunValidation.changedFiles,
      post_run_validation: "passed",
    };
  }

  // Valid JSON with all required fields and correct types. Write .result.json.
  // Before writing, archive any stale same-task .result.raw.txt from a
  // previous failed run so consumers see only this run's active artifacts.
  if (existsSync(resultRawPath)) {
    const archiveDir = join(bridgeRoot, "archive", packet.task_id);
    mkdirSync(archiveDir, { recursive: true });
    // Use the previous run's run_id for archive provenance, not the
    // current successful run_id.
    let previousRunId = null;
    try {
      if (existsSync(logPath)) {
        const prevLog = JSON.parse(readFileSync(logPath, "utf8"));
        if (prevLog && typeof prevLog.run_id === "string") {
          previousRunId = prevLog.run_id;
        }
      }
    } catch {
      // Previous log is missing or malformed; fall through.
    }
    const archiveName = previousRunId !== null
      ? `${previousRunId}.result.raw.txt`
      : `unknown-previous-run-${run_id}.result.raw.txt`;
    const archivePath = join(archiveDir, archiveName);
    if (existsSync(archivePath)) {
      rmSync(archivePath);
    }
    renameSync(resultRawPath, archivePath);
  }

  writeFileSync(
    resultJsonPath,
    JSON.stringify(validation.parsed, null, 2) + "\n",
    "utf8",
  );
  writeFileSync(
    logPath,
    buildLog(packet, {
      run_id,
      started_at,
      finished_at,
      claude_exit_code: exitCode,
      result_path: resultJsonPath,
      post_run_validation: postRunValidation,
      ...logFields,
    }),
    "utf8",
  );

  writeLatestPointer(latestJsonPath, {
    task_id: packet.task_id, run_id, status: "success",
    result_path: resultJsonPath, log_path: logPath,
    created_at: finished_at, claude_exit_code: exitCode,
  });

  const summary = {
    task_id: packet.task_id,
    exit_code: exitCode,
    result_path: resultJsonPath,
    log_path: logPath,
    stdout_bytes: stdout.length,
  };
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  process.exit(0);
}

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

  if (args.dryRun && args.execute) {
    process.stderr.write(
      "error: --dry-run and --execute are mutually exclusive.\n",
    );
    process.exit(2);
  }
  if (!args.dryRun && !args.execute) {
    process.stderr.write(
      "error: exactly one of --dry-run or --execute must be provided.\n",
    );
    printUsage();
    process.exit(2);
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

  const repoRoot = resolve(args.repo);
  if (!isAbsolute(repoRoot)) {
    process.stderr.write("error: resolved repo path is not absolute\n");
    process.exit(2);
  }

  const packet = loadTaskPacket(args);
  if (args.readOnlyTools && packet.mode !== "read-only") {
    process.stderr.write(
      `error: --read-only-tools is only supported for mode=read-only. Got mode=${packet.mode}.\n`,
    );
    process.exit(2);
  }
  if (args.readOnlyTools) {
    const readOnlyCommandErr = validateReadOnlyCommands(packet);
    if (readOnlyCommandErr !== null) {
      process.stderr.write(`error: ${readOnlyCommandErr}\n`);
      process.exit(2);
    }
  }

  if (args.dryRun) {
    printDryRunSummary(packet, repoRoot);
    process.exit(0);
  }

  runExecute(args, packet, repoRoot);
}

main();
