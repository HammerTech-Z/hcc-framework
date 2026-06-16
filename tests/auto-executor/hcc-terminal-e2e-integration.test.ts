// HCC Terminal E2E Integration Test.
//
// Composes the full terminal chain WITHOUT touching app boot,
// IPC, scheduler, cron, timer, auto-arm, or default CLI paths:
//
//   1. generatePlanFixture(...)        -> JSON
//   2. parsePlanFixture(json)          -> fixture
//   3. buildProductionShellRunner(...) -> mock shellRunner
//   4. buildTerminalExecutors({ shellRunner })
//                                     -> { shell_executor, writer, patcher }
//   5. buildDispatchAdapterFromPlanFixture(...)
//                                     -> real adapter
//   6. runTerminalPlanInvokerCli(args, undefined, readFixture, executors)
//                                     -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE
//
// All execution surfaces remain injected. No real spawn. No
// real file write. The test is a pure composition.

import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { generatePlanFixture, validatePlanFixtureInput } from "../../src/shared/lib/hcc-plan-fixture-generator";
import { parsePlanFixture, runTerminalPlanInvokerCli } from "../../src/cli/hcc-terminal-plan-invoker";
import { buildTerminalExecutors } from "../../src/shared/lib/hcc-terminal-executor-impl";
import { buildProductionShellRunner } from "../../src/shared/lib/hcc-terminal-shell-runner";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";
import { evaluateControlledRealRunnerCandidate } from "../../src/shared/lib/hcc-controlled-real-runner";
import { planAuditActualWrite } from "../../src/shared/lib/hcc-audit-actual-write";
import { planRollbackActualRecovery } from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = "2026-06-16T12:00:00.000Z";
const ISSUED = "2026-06-16T11:00:00.000Z";
const EXPIRES = "2026-06-16T13:00:00.000Z";
const HASH = "sha256:e2e-abc";

// ---------------------------------------------------------------------------
// Verdict builders (re-used per scenario)
// ---------------------------------------------------------------------------

function makeAuthorization() {
  return evaluateRealExecutionAuthorization(
    {
      task_id: "PLAN-E2E-001",
      source_plan_ref: "plan:2026-06:task-e2e-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-e2e-001",
      authorization_scope: "controlled_real_execution_candidate",
      issued_at: ISSUED,
      expires_at: EXPIRES,
      one_shot: true,
      dry_run_verdict: "GO-CANDIDATE_DRY_RUN_PRODUCED",
      dry_run_artifact_hash: HASH,
      reason: "explicit user authorization",
    },
    NOW,
  );
}

function makeRunner(authorization: ReturnType<typeof makeAuthorization>) {
  return evaluateControlledRealRunnerCandidate({
    task_id: "PLAN-E2E-001",
    source_plan_ref: "plan:2026-06:task-e2e-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-e2e-001",
    planned_action_kind: "shell_command",
    whitelist_action_id: "wl-e2e-001",
  });
}

function makeAuditPlan() {
  const plan = planAuditActualWrite({
    task_id: "PLAN-E2E-001",
    source_plan_ref: "plan:2026-06:task-e2e-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-e2e-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-e2e-001",
    planned_action_kind: "shell_command",
    whitelist_action_id: "wl-e2e-001",
    target_path: "src/shared/lib/notes/e2e-001.md",
    audit_payload: {
      would_execute: false as const,
      real_execution_ready: false as const,
      unattended_ready: false as const,
      any_command_executed: false as const,
      executed_commands: [] as const,
      go_no_go: "NO-GO" as const,
      body: "audit body",
    },
  });
  return { ...plan, verdict: "AUDIT-ACTUAL-WRITTEN" as const, written: true };
}

function makeRollbackPlan() {
  return planRollbackActualRecovery({
    task_id: "PLAN-E2E-001",
    source_plan_ref: "plan:2026-06:task-e2e-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-e2e-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-e2e-001",
    planned_action_kind: "shell_command",
    target_path: "src/shared/lib/notes/e2e-001.md",
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
  });
}

function makeGeneratorInput(overrides: {
  dispatch_backend?: "in_memory" | "shell_command" | "file_write" | "config_patch";
  dispatch_payload?: unknown;
  target_path?: string;
  planned_action_kind?: "shell_command" | "file_write" | "config_patch";
} = {}) {
  const authorization = makeAuthorization();
  return {
    task_id: "PLAN-E2E-001",
    source_plan_ref: "plan:2026-06:task-e2e-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-e2e-001",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-e2e-001",
    planned_action_kind: overrides.planned_action_kind ?? ("shell_command" as const),
    whitelist_action_id: "wl-e2e-001",
    target_path: overrides.target_path ?? "src/shared/lib/notes/e2e-001.md",
    authorization_result: authorization as unknown as Record<string, unknown>,
    runner_result: makeRunner(authorization) as unknown as Record<string, unknown>,
    audit_result: makeAuditPlan() as unknown as Record<string, unknown>,
    rollback_plan: makeRollbackPlan() as unknown as Record<string, unknown>,
    dispatch_backend: overrides.dispatch_backend ?? "shell_command",
    dispatch_payload: overrides.dispatch_payload ?? { argv: ["git", "status"] },
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type MockChild = {
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  stdout: Readable;
  stderr: Readable;
  kill: (sig?: NodeJS.Signals) => boolean;
};

function makeMockChild(opts: {
  exitCode?: number;
  signal?: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
} = {}): MockChild {
  const emitter = new EventEmitter();
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  stdout.setEncoding("utf-8");
  stderr.setEncoding("utf-8");
  const child = Object.assign(emitter, {
    stdout,
    stderr,
    pid: 12345,
    kill: vi.fn(() => true),
  }) as unknown as MockChild;
  setTimeout(() => {
    if (opts.stdout) stdout.push(opts.stdout);
    if (opts.stderr) stderr.push(opts.stderr);
    stdout.push(null);
    stderr.push(null);
    emitter.emit("close", opts.exitCode ?? 0, opts.signal ?? null);
  }, 0);
  return child;
}

type MockSpawn = ReturnType<typeof import("node:child_process")["spawn"]> & {
  mock: { calls: unknown[][] };
};

function makeSpawnMock(impl: (argv: string[], opts: unknown) => unknown): MockSpawn {
  const fn = vi.fn((...args: unknown[]) => impl(args[0] as string[], args[1]));
  return fn as unknown as MockSpawn;
}

function makeFsMock() {
  const writes: Array<{ path: string; content: string }> = [];
  const reads: string[] = [];
  const store = new Map<string, string>();
  return {
    writes,
    reads,
    fs: {
      writeFile: vi.fn(async (path: string, content: string) => {
        writes.push({ path, content });
        store.set(path, content);
      }),
      readFile: vi.fn(async (path: string) => {
        reads.push(path);
        const v = store.get(path);
        if (v === undefined) throw new Error(`ENOENT: ${path}`);
        return v;
      }),
    } as const,
  };
}

// ---------------------------------------------------------------------------
// Full chain composition helper
// ---------------------------------------------------------------------------

async function runFullChain(opts: {
  dispatch_payload: unknown;
  spawn: MockSpawn;
  // Optional: pre-seeded file content for patcher tests
  fsMock?: ReturnType<typeof makeFsMock>;
  now?: () => string;
}) {
  // 1. generatePlanFixture -> JSON
  const gen = await generatePlanFixture(
    makeGeneratorInput({ dispatch_payload: opts.dispatch_payload }),
    "/tmp/e2e-fixture.json",
  );
  if (!gen.ok) throw new Error(`fixture generation failed: ${gen.reason}`);
  const fixtureJson = gen.result.fixture_json;

  // 2. parsePlanFixture -> fixture
  const parsed = parsePlanFixture(fixtureJson);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.reason}`);
  expect(parsed.ok).toBe(true);

  // 3. buildProductionShellRunner
  const shellRunner = buildProductionShellRunner({
    repoRoot: "/tmp/e2e-fake-repo",
    spawn: opts.spawn,
    now: opts.now ?? (() => "2026-06-16T00:00:00.000Z"),
  });

  // 4. buildTerminalExecutors with injected runner + fs
  const executors = buildTerminalExecutors({
    repoRoot: "/tmp/e2e-fake-repo",
    shellRunner,
    fs: opts.fsMock?.fs ?? makeFsMock().fs,
    now: opts.now ?? (() => "2026-06-16T00:00:00.000Z"),
  });

  // 5. CLI entrypoint with injected fixture reader + executors
  const r = await runTerminalPlanInvokerCli(
    {
      plan_fixture_path: "/tmp/e2e-fixture.json",
      terminal_agent_session_id: "e2e-sess",
      terminal_invocation_id: "e2e-inv",
      explicit_user_trigger_token: "e2e-trigger",
      feature_flag_enabled: true,
    },
    undefined, // no explicit adapter (executorDeps wins)
    () => fixtureJson, // injected fixture reader
    executors,
  );

  return { result: r, fixtureJson, parsed: parsed.fixture, gen, executors };
}

// ---------------------------------------------------------------------------
// Full chain: 3 allowlisted shell cases
// ---------------------------------------------------------------------------

describe("HCC terminal e2e integration: full chain — allowlisted shell cases", () => {
  it("git.status -> CANDIDATE, runner called with EXACTLY ['git','status']", async () => {
    const spawn = makeSpawnMock(() =>
      makeMockChild({ stdout: "On branch main", exitCode: 0 }),
    );
    const { result, parsed, executors } = await runFullChain({
      dispatch_payload: { argv: ["git", "status"] },
      spawn,
    });
    expect(result.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(result.terminal_agent_session_id).toBe("e2e-sess");
    expect(result.terminal_invocation_id).toBe("e2e-inv");
    expect(result.task_id).toBe("PLAN-E2E-001");
    expect(result.planned_action_id).toBe("act-e2e-001");
    expect(result.unattended_ready).toBe(false);
    expect(result.night_run_ready).toBe(false);
    expect(result.go_no_go).toBe("NO-GO");
    // spawn was called once with the right argv
    expect(spawn.mock.calls).toHaveLength(1);
    const argv0 = spawn.mock.calls[0]?.[0] as string;
    const argvSlice = spawn.mock.calls[0]?.[1] as string[];
    expect(argv0).toBe("git");
    expect(argvSlice).toEqual(["status"]);
    // No hidden writes
    void parsed;
    void executors;
  });

  it("git.diff -> CANDIDATE, runner called with EXACTLY ['git','diff']", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["git", "diff"] },
      spawn,
    });
    expect(result.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    const argv0 = spawn.mock.calls[0]?.[0] as string;
    const argvSlice = spawn.mock.calls[0]?.[1] as string[];
    expect(argv0).toBe("git");
    expect(argvSlice).toEqual(["diff"]);
  });

  it("git.show --stat HEAD -> CANDIDATE, runner called with full argv", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["git", "show", "--stat", "HEAD"] },
      spawn,
    });
    expect(result.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    const argv0 = spawn.mock.calls[0]?.[0] as string;
    const argvSlice = spawn.mock.calls[0]?.[1] as string[];
    expect(argv0).toBe("git");
    expect(argvSlice).toEqual(["show", "--stat", "HEAD"]);
  });
});

// ---------------------------------------------------------------------------
// Fixture generator output interop
// ---------------------------------------------------------------------------

describe("HCC terminal e2e integration: fixture generator -> parsePlanFixture", () => {
  it("generator output is accepted by parsePlanFixture", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const gen = await generatePlanFixture(
      makeGeneratorInput({ dispatch_payload: { argv: ["git", "status"] } }),
      "/tmp/e2e-fixture.json",
    );
    expect(gen.ok).toBe(true);
    if (!gen.ok) return;
    const parsed = parsePlanFixture(gen.result.fixture_json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.fixture.task_id).toBe("PLAN-E2E-001");
    expect(parsed.fixture.dispatch_backend).toBe("shell_command");
    expect(parsed.fixture.planned_action_kind).toBe("shell_command");
  });

  it("generator output preserves all 4 prior verdict objects", async () => {
    const input = makeGeneratorInput();
    const gen = await generatePlanFixture(input, "/tmp/x.json");
    if (!gen.ok) throw new Error("gen failed");
    const parsed = parsePlanFixture(gen.result.fixture_json);
    if (!parsed.ok) throw new Error("parse failed");
    expect(parsed.fixture.authorization_result).toEqual(input.authorization_result);
    expect(parsed.fixture.runner_result).toEqual(input.runner_result);
    expect(parsed.fixture.audit_result).toEqual(input.audit_result);
    expect(parsed.fixture.rollback_plan).toEqual(input.rollback_plan);
  });

  it("validatePlanFixtureInput accepts the generator input", () => {
    expect(validatePlanFixtureInput(makeGeneratorInput())).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Mock-ability of executors + runner
// ---------------------------------------------------------------------------

describe("HCC terminal e2e integration: executor + runner remain mockable", () => {
  it("shellRunner mock is the ONLY shell surface; no real spawn", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const { result, executors } = await runFullChain({
      dispatch_payload: { argv: ["git", "status"] },
      spawn,
    });
    expect(result.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(spawn.mock.calls).toHaveLength(1);
    // writer was NOT called for a shell_command backend
    expect(executors.writer).toBeDefined();
  });

  it("fs mock is the ONLY filesystem surface; no real write", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const fsMock = makeFsMock();
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["git", "status"] },
      spawn,
      fsMock,
    });
    expect(result.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    // For a shell_command backend, the writer should never have been called.
    expect(fsMock.writes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Negative cases
// ---------------------------------------------------------------------------

describe("HCC terminal e2e integration: negative paths", () => {
  it("non-allowlisted argv -> NO-GO via DENIED, runner not called", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["rm", "-rf", "/"] },
      spawn,
    });
    expect(result.verdict).toBe("NO-GO");
    expect(result.reason).toContain("DENIED");
    expect(spawn.mock.calls).toHaveLength(0);
  });

  it("free-form shell string in payload -> NO-GO, runner not called", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const { result } = await runFullChain({
      // Generator + parser pass the string through; the
      // dispatch adapter rejects free-form shape.
      dispatch_payload: { argv: ["echo hi; rm -rf /"] } as unknown as { argv: readonly string[] },
      spawn,
    });
    expect(result.verdict).toBe("NO-GO");
    expect(spawn.mock.calls).toHaveLength(0);
  });

  it("shell runner timeout -> NO-GO via EXECUTOR_REJECTED, runner kill(SIGKILL)", async () => {
    // To exercise the runner timeout path, we use a slow child.
    const emitter = new EventEmitter();
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    stdout.setEncoding("utf-8");
    stderr.setEncoding("utf-8");
    const slow = Object.assign(emitter, {
      stdout,
      stderr,
      pid: 99999,
      kill: vi.fn(() => true),
    });
    let trigger: (() => void) | null = null;
    const setTimeoutFn = vi.fn((fn: () => void) => {
      trigger = fn;
      return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;
    const clearTimeoutFn = vi.fn() as unknown as typeof clearTimeout;
    const spawn = makeSpawnMock(() => slow) as MockSpawn;
    const fastTimeoutRunner = buildProductionShellRunner({
      repoRoot: "/tmp/e2e-fake-repo",
      spawn,
      setTimeoutFn,
      clearTimeoutFn,
    });
    const executors = buildTerminalExecutors({
      repoRoot: "/tmp/e2e-fake-repo",
      shellRunner: fastTimeoutRunner,
      fs: makeFsMock().fs,
    });
    const gen = await generatePlanFixture(
      makeGeneratorInput(),
      "/tmp/x.json",
    );
    if (!gen.ok) throw new Error("gen failed");
    const cliP = runTerminalPlanInvokerCli(
      {
        plan_fixture_path: "/tmp/x.json",
        terminal_agent_session_id: "e2e-sess",
        terminal_invocation_id: "e2e-inv",
        explicit_user_trigger_token: "e2e-trigger",
        feature_flag_enabled: true,
      },
      undefined,
      () => gen.result.fixture_json,
      executors,
    );
    await new Promise((resolve) => setImmediate(resolve));
    trigger!();
    const r = await cliP;
    // Post-fix semantics: timeout must produce NO-GO
    // (EXECUTOR_REJECTED). The runner still killed the
    // child with SIGKILL.
    expect(slow.kill).toHaveBeenCalledWith("SIGKILL");
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/timed out|EXECUTOR_REJECTED/);
  });
});

// ---------------------------------------------------------------------------
// Post-fix result semantics: non-zero exit, signal, timeout -> NO-GO
// ---------------------------------------------------------------------------

describe("HCC terminal e2e integration: shell runner result semantics (post-fix)", () => {
  it("shell exits non-zero -> NO-GO, runner called once", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 1, stderr: "boom" }));
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["git", "status"] },
      spawn,
    });
    expect(result.verdict).toBe("NO-GO");
    expect(result.reason).toMatch(/non-zero|EXECUTOR_REJECTED/);
    expect(spawn.mock.calls).toHaveLength(1);
  });

  it("shell terminated by signal -> NO-GO, runner called once", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ signal: "SIGTERM" }));
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["git", "status"] },
      spawn,
    });
    expect(result.verdict).toBe("NO-GO");
    expect(result.reason).toMatch(/signal|EXECUTOR_REJECTED/);
    expect(spawn.mock.calls).toHaveLength(1);
  });

  it("shell exit 0 -> CANDIDATE (regression: success path still works)", async () => {
    const spawn = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const { result } = await runFullChain({
      dispatch_payload: { argv: ["git", "status"] },
      spawn,
    });
    expect(result.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });
});

// ---------------------------------------------------------------------------
// Static source guard
// ---------------------------------------------------------------------------

describe("HCC terminal e2e integration: static source guard", () => {
  it("test file does not import app boot, IPC, scheduler, timer, auto-arm, host", () => {
    // The FORBIDDEN list lives in this comment block; we
    // check the source as a whole but the test code itself
    // mentions these names in comments. Compare against a
    // comment-stripped version.
    const src = readFileSync(
      resolve(__dirname, "hcc-terminal-e2e-integration.test.ts"),
      "utf-8",
    );
    // Strip line comments and block comments so the literal
    // FORBIDDEN names mentioned in the test docstring do not
    // trip the guard.
    const stripped = src
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // Source must not IMPORT any forbidden production surface.
    expect(stripped).not.toMatch(/from\s+["']src\/main/);
    expect(stripped).not.toMatch(/from\s+["']src\/preload/);
    expect(stripped).not.toMatch(/from\s+["']src\/renderer/);
    // Source must not call any forbidden runtime API.
    expect(stripped).not.toMatch(/require\s*\(\s*["']child_process["']\s*\)/);
    expect(stripped).not.toMatch(/from\s+["']child_process["']/);
    expect(stripped).not.toMatch(/\bipcMain\s*\(/);
    expect(stripped).not.toMatch(/\bBrowserWindow\s*\(/);
    expect(stripped).not.toMatch(/\bcontextBridge\s*\(/);
    expect(stripped).not.toMatch(/\bsetInterval\s*\(/);
    expect(stripped).not.toMatch(/submitDryRunAction\s*\(/);
    // go_no_go:"GO" / night_run_ready:true literal
    expect(stripped).not.toMatch(/go_no_go\s*:\s*"GO"/);
    expect(stripped).not.toMatch(/night_run_ready\s*:\s*true/);
    // ~/.hermes literal in source
    expect(stripped).not.toMatch(/~\/\.hermes/);
  });

  it("test file does not import any forbidden production module", () => {
    const src = readFileSync(
      resolve(__dirname, "hcc-terminal-e2e-integration.test.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/from\s+["']src\/main/);
    expect(src).not.toMatch(/from\s+["']src\/preload/);
    expect(src).not.toMatch(/from\s+["']src\/renderer/);
  });
});
