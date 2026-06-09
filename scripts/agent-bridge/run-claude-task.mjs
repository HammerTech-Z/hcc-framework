#!/usr/bin/env node
// AGENT-BRIDGE-002/002A/002B/003/003A/005/005A/005B/005C/005D/009 — Codex ⇄ Claude Code file-bridge.
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
//   - allow Claude to use tools or edit files in this slice

import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, isAbsolute, sep } from "node:path";
import { spawnSync } from "node:child_process";

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

// Modes supported in AGENT-BRIDGE-003 --execute.
const EXECUTE_SUPPORTED_MODES = new Set(["design-only", "read-only"]);

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
      "  --execute              Invoke Claude (design-only / read-only tasks only)",
      "  --bridge-root <path>    Optional; default = <repo>/.agent-bridge",
      "  --claude-bin <path>     Optional; default = claude",
      "  --timeout-ms <number>   Optional; default = 300000",
      "  --help, -h              Print this message",
      "",
      "Exactly one of --dry-run or --execute must be provided.",
      "AGENT-BRIDGE-003 --execute only supports mode = design-only or read-only.",
      "Tools are disabled; Claude will not edit files in this slice.",
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
}

// -----------------------------------------------------------------
// Prompt construction
// -----------------------------------------------------------------

function buildPrompt(packet) {
  const lines = [];
  lines.push("AGENT-BRIDGE-005D task execution.");
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
  lines.push("- Tools are DISABLED. You cannot run git status, stat, rg, or any shell");
  lines.push("  command. Do not claim you verified local git status, file mtimes,");
  lines.push("  roadmap diff, or working tree state.");
  lines.push("- If you did not actually run a command, you MUST NOT say you verified that");
  lines.push("  fact. Use known_unknowns or not_done for facts you could not verify.");
  lines.push("- files_modified and commands_run must be empty arrays [] because you cannot");
  lines.push("  modify files or run commands in this mode.");
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
      would_modify_files: false,
      tools_disabled: true,
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
    would_modify_files: false,
    repo_root: repoRoot,
    note: "AGENT-BRIDGE-003 dry-run only; no runtime execution.",
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

function runExecute(args, packet, repoRoot) {
  if (!EXECUTE_SUPPORTED_MODES.has(packet.mode)) {
    process.stderr.write(
      `error: Execution mode only supports design-only/read-only tasks in AGENT-BRIDGE-003. Got mode=${packet.mode}.\n`,
    );
    process.exit(2);
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
  const prompt = buildPrompt(packet);
  const argsForClaude = [
    "-p",
    prompt,
    "--output-format",
    "text",
    "--tools",
    "",
    "--permission-mode",
    "default",
  ];
  const result = spawnSync(args.claudeBin, argsForClaude, {
    encoding: "utf8",
    timeout: args.timeoutMs,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: repoRoot,
    env: process.env,
  });
  const finished_at = nowIso();

  if (result.error) {
    const note = `BLOCKED: spawn error: ${result.error.message}`;
    // Write a short error note to .result.raw.txt so latest pointer
    // always points to an existing file.
    writeFileSync(
      resultRawPath,
      `AGENT-BRIDGE spawn error: ${result.error.message}\n`,
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
      }),
      "utf8",
    );
    process.stderr.write(`error: ${note}\n`);
    writeLatestPointer(latestJsonPath, {
      task_id: packet.task_id, run_id, status: "failed",
      result_path: resultRawPath, log_path: logPath,
      created_at: finished_at, claude_exit_code: null,
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
  // strict result contract. Two outcomes:
  //   (a) stdout is not valid JSON, not an object, empty, or has missing
  //       fields, wrong types => write .result.raw.txt, log note, exit 1.
  //   (b) all fields present with correct types => write .result.json, exit 0.
  // Do not attempt to repair malformed JSON. Do not infer missing fields.
  // Do not silently coerce invalid types.
  const validation = validateResultJson(stdout, packet.task_id);
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

  if (args.dryRun) {
    printDryRunSummary(packet, repoRoot);
    process.exit(0);
  }

  runExecute(args, packet, repoRoot);
}

main();
