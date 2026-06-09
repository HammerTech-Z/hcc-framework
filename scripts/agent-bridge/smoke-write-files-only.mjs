#!/usr/bin/env node
// AGENT-BRIDGE-013 smoke tests.
//
// Runs only against disposable git repos under .agent-bridge/smoke/.
// Does not touch Hermes Pro product files, ~/.hermes, commit, or push.

import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const HERMES_REPO = resolve(new URL("../..", import.meta.url).pathname);
const RUNNER = join(HERMES_REPO, "scripts/agent-bridge/run-claude-task.mjs");
const AUDITOR = join(HERMES_REPO, "scripts/agent-bridge/audit-claude-result.mjs");
const SMOKE_ROOT = join(HERMES_REPO, ".agent-bridge/smoke/write-files-only");
const STUB = join(SMOKE_ROOT, "stub-claude.mjs");

function sh(cmd, args, opts = {}) {
  return spawnSync(cmd, args, {
    cwd: opts.cwd ?? HERMES_REPO,
    encoding: "utf8",
    timeout: opts.timeout ?? 30000,
    env: { ...process.env, ...(opts.env ?? {}) },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function resultObject(taskId, overrides = {}) {
  return {
    schema_version: "1.0.0",
    task_id: taskId,
    final_verdict: "complete",
    claimed_changes: "smoke",
    files_modified: ["allowed.txt"],
    commands_run: [],
    raw_outputs_summary: "stub",
    not_done: "",
    known_unknowns: [],
    claimed_commit: null,
    claimed_pushed: false,
    claimed_push_state: null,
    ...overrides,
  };
}

function writeStub() {
  mkdirSync(SMOKE_ROOT, { recursive: true });
  writeFileSync(
    STUB,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const mode = process.env.AGENT_BRIDGE_SMOKE_CASE;
const taskId = process.env.AGENT_BRIDGE_SMOKE_TASK_ID;
function emit(obj) {
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: JSON.stringify(obj) }) + "\\n");
}
function base(overrides = {}) {
  return {
    schema_version: "1.0.0",
    task_id: taskId,
    final_verdict: "complete",
    claimed_changes: "smoke",
    files_modified: ["allowed.txt"],
    commands_run: [],
    raw_outputs_summary: "stub",
    not_done: "",
    known_unknowns: [],
    claimed_commit: null,
    claimed_pushed: false,
    claimed_push_state: null,
    ...overrides,
  };
}
if (mode === "invalid-json") {
  process.stdout.write("not json\\n");
} else if (mode === "allowed") {
  writeFileSync("allowed.txt", "allowed write\\n", "utf8");
  emit(base());
} else if (mode === "forbidden") {
  writeFileSync("forbidden.txt", "forbidden write\\n", "utf8");
  emit(base({ files_modified: ["forbidden.txt"] }));
} else if (mode === "external") {
  const externalPath = process.env.AGENT_BRIDGE_SMOKE_EXTERNAL_PATH;
  if (!externalPath) {
    process.stderr.write("missing AGENT_BRIDGE_SMOKE_EXTERNAL_PATH\\n");
    process.exit(2);
  }
  writeFileSync(externalPath, "external write outside disposable repo\\n", "utf8");
  emit(base({
    final_verdict: "partial",
    claimed_changes: "external write smoke",
    files_modified: [],
    known_unknowns: ["runner does not observe arbitrary paths outside repo snapshots"],
  }));
} else if (mode === "commit-claim") {
  writeFileSync("allowed.txt", "commit claim write\\n", "utf8");
  emit(base({ claimed_commit: "abcdef1234567890abcdef1234567890abcdef12" }));
} else if (mode === "push-claim") {
  writeFileSync("allowed.txt", "push claim write\\n", "utf8");
  emit(base({ claimed_pushed: true }));
} else {
  process.stderr.write("unknown smoke case\\n");
  process.exit(2);
}
`,
    "utf8",
  );
  chmodSync(STUB, 0o755);
}

function initRepo(name) {
  const repo = join(SMOKE_ROOT, name);
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(repo, { recursive: true });
  sh("git", ["init", "-b", "hermes-pro-main"], { cwd: repo });
  sh("git", ["config", "user.email", "agent-bridge-smoke@example.invalid"], { cwd: repo });
  sh("git", ["config", "user.name", "Agent Bridge Smoke"], { cwd: repo });
  writeFileSync(join(repo, "allowed.txt"), "initial allowed\\n", "utf8");
  writeFileSync(join(repo, "forbidden.txt"), "initial forbidden\\n", "utf8");
  sh("git", ["add", "allowed.txt", "forbidden.txt"], { cwd: repo });
  sh("git", ["commit", "-m", "init"], { cwd: repo });
  sh("git", ["remote", "add", "origin", repo], { cwd: repo });
  sh("git", ["update-ref", "refs/remotes/origin/hermes-pro-main", "HEAD"], { cwd: repo });
  return repo;
}

function writeTask(repo, taskId, allowedFiles = ["allowed.txt"]) {
  const taskDir = join(repo, ".agent-bridge/tasks/pending");
  mkdirSync(taskDir, { recursive: true });
  const task = {
    schema_version: "1.0.0",
    task_id: taskId,
    mode: "write-files-only",
    objective: "Smoke write-files-only behavior.",
    allowed_files: allowedFiles,
    forbidden_files: [
      "forbidden.txt",
      ".gitignore",
      "docs/roadmap-locked-2026-05-28.md",
      "~/.hermes/config.yaml",
      "~/.hermes/handoff/packs",
      "~/.hermes/audit",
    ],
    allowed_commands: [],
    forbidden_actions: [
      "git commit",
      "git push",
      "git commit --amend",
      "git rebase",
      "git reset --hard",
      "squash",
      "live apply",
      "HCC Auto Executor",
    ],
    required_verification: ["Codex-side smoke"],
    report_schema: {},
    expected_authorization_type: "user-before-commit",
  };
  const taskPath = join(taskDir, `${taskId}.task.json`);
  writeFileSync(taskPath, JSON.stringify(task, null, 2) + "\n", "utf8");
  return taskPath;
}

function runTask(repo, taskPath, taskId, smokeCase) {
  return sh(
    "node",
    [
      RUNNER,
      "--repo",
      repo,
      "--task",
      taskPath,
      "--execute",
      "--claude-bin",
      STUB,
      "--timeout-ms",
      "30000",
    ],
    {
      cwd: repo,
      env: {
        AGENT_BRIDGE_SMOKE_CASE: smokeCase,
        AGENT_BRIDGE_SMOKE_TASK_ID: taskId,
      },
    },
  );
}

function audit(repo, taskPath, resultPath, auditId) {
  return sh("node", [
    AUDITOR,
    "--repo",
    repo,
    "--task",
    taskPath,
    "--result",
    resultPath,
    "--dry-run",
    "--audit-id",
    auditId,
  ], { cwd: repo });
}

function assertCase(name, condition, details) {
  if (!condition) {
    throw new Error(`${name} failed: ${details}`);
  }
  return { name, ok: true, details };
}

function main() {
  rmSync(SMOKE_ROOT, { recursive: true, force: true });
  writeStub();
  const results = [];

  {
    const taskId = "SMOKE-WRITE-ALLOWED";
    const repo = initRepo("allowed");
    const task = writeTask(repo, taskId);
    const r = runTask(repo, task, taskId, "allowed");
    const resultPath = join(repo, ".agent-bridge/results", `${taskId}.result.json`);
    results.push(assertCase("allowed file write succeeds", r.status === 0 && existsSync(resultPath), r.stderr || r.stdout));
  }

  {
    const taskId = "SMOKE-WRITE-FORBIDDEN";
    const repo = initRepo("forbidden");
    const task = writeTask(repo, taskId);
    const r = runTask(repo, task, taskId, "forbidden");
    const rawPath = join(repo, ".agent-bridge/results", `${taskId}.result.raw.txt`);
    results.push(assertCase("forbidden file write detected", r.status === 1 && existsSync(rawPath), r.stderr || r.stdout));
  }

  {
    const taskId = "SMOKE-WRITE-EXTERNAL-UNSUPPORTED";
    const repo = initRepo("external-unsupported/repo");
    const task = writeTask(repo, taskId);
    const externalPath = join(SMOKE_ROOT, "external-unsupported", "outside-disposable-repo.txt");
    const r = sh(
      "node",
      [
        RUNNER,
        "--repo",
        repo,
        "--task",
        task,
        "--execute",
        "--claude-bin",
        STUB,
        "--timeout-ms",
        "30000",
      ],
      {
        cwd: repo,
        env: {
          AGENT_BRIDGE_SMOKE_CASE: "external",
          AGENT_BRIDGE_SMOKE_TASK_ID: taskId,
          AGENT_BRIDGE_SMOKE_EXTERNAL_PATH: externalPath,
        },
      },
    );
    results.push(assertCase(
      "repo-external write is unsupported residual risk",
      r.status === 0 && existsSync(externalPath),
      r.stderr || r.stdout,
    ));
  }

  {
    const taskId = "SMOKE-WRITE-MISSING-ALLOWED";
    const repo = initRepo("missing-allowed");
    const task = writeTask(repo, taskId, []);
    const r = runTask(repo, task, taskId, "allowed");
    results.push(assertCase("missing allowed_files rejected", r.status === 2 && /requires non-empty allowed_files/.test(r.stderr), r.stderr || r.stdout));
  }

  for (const [label, smokeCase, pattern] of [
    ["commit claim rejected", "commit-claim", /claimed_commit must be null/],
    ["push claim rejected", "push-claim", /claimed_pushed must be false/],
  ]) {
    const taskId = `SMOKE-WRITE-${smokeCase.toUpperCase()}`;
    const repo = initRepo(smokeCase);
    const task = writeTask(repo, taskId);
    const r = runTask(repo, task, taskId, smokeCase);
    results.push(assertCase(label, r.status === 1 && pattern.test(r.stderr), r.stderr || r.stdout));
  }

  {
    const taskId = "SMOKE-WRITE-INVALID-JSON";
    const repo = initRepo("invalid-json");
    const task = writeTask(repo, taskId);
    const r = runTask(repo, task, taskId, "invalid-json");
    const rawPath = join(repo, ".agent-bridge/results", `${taskId}.result.raw.txt`);
    results.push(assertCase("invalid JSON writes raw result", r.status === 1 && existsSync(rawPath), r.stderr || r.stdout));
  }

  {
    const taskId = "SMOKE-WRITE-AUDIT-MISMATCH";
    const repo = initRepo("audit-mismatch");
    const task = writeTask(repo, taskId);
    const resultPath = join(repo, ".agent-bridge/results", `${taskId}.result.json`);
    mkdirSync(join(repo, ".agent-bridge/results"), { recursive: true });
    writeFileSync(
      resultPath,
      JSON.stringify({
        ...resultObject(taskId, { files_modified: ["allowed.txt"] }),
        _agent_bridge: {
          mode: "write-files-only",
          run_id: "smoke",
          changed_files: ["forbidden.txt"],
          post_run_validation: "passed",
        },
      }, null, 2) + "\n",
      "utf8",
    );
    const r = audit(repo, task, resultPath, `${taskId}.audit`);
    const parsed = JSON.parse(r.stdout);
    results.push(assertCase(
      "Codex-side audit catches mismatched file claims",
      r.status === 0 && parsed.final_decision === "NO_GO" && parsed.forbidden_path_findings.length > 0,
      r.stderr || r.stdout,
    ));
  }

  process.stdout.write(JSON.stringify({ ok: true, results }, null, 2) + "\n");
}

main();
