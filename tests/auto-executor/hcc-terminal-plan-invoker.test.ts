import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  parseTerminalPlanInvokerCliArgs,
  parsePlanFixture,
  runTerminalPlanInvokerCli,
  main,
  HCC_TERMINAL_PLAN_INVOKER_CLI_SCHEMA_VERSION,
  type HCCTerminalPlanInvokerCliArgs,
  type HCCTerminalPlanFixture,
} from "../../src/cli/hcc-terminal-plan-invoker";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";
import { evaluateControlledRealRunnerCandidate } from "../../src/shared/lib/hcc-controlled-real-runner";
import { planAuditActualWrite } from "../../src/shared/lib/hcc-audit-actual-write";
import { planRollbackActualRecovery } from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");
const NOW = "2026-06-15T12:00:00.000Z";
const ISSUED = "2026-06-15T11:00:00.000Z";
const EXPIRES = "2026-06-15T13:00:00.000Z";
const HASH = "sha256:abc123";

beforeEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeCliArgs(
  overrides: Partial<HCCTerminalPlanInvokerCliArgs> = {},
): HCCTerminalPlanInvokerCliArgs {
  return {
    plan_fixture_path: "/tmp/plan-fixture.json",
    terminal_agent_session_id: "term-sess-001",
    terminal_invocation_id: "term-inv-001",
    explicit_user_trigger_token: "trigger-001",
    feature_flag_enabled: true,
    ...overrides,
  };
}

function makeAuthorization() {
  return evaluateRealExecutionAuthorization(
    {
      task_id: "PLAN-INV-001",
      source_plan_ref: "plan:2026-06:task-inv-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-inv-001",
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
    task_id: "PLAN-INV-001",
    source_plan_ref: "plan:2026-06:task-inv-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-inv-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-inv-001",
  });
}

function makeAuditPlan() {
  const plan = planAuditActualWrite({
    task_id: "PLAN-INV-001",
    source_plan_ref: "plan:2026-06:task-inv-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-inv-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-inv-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-inv-001",
    target_path: "docs/audit/hcc/2026-06-15/PLAN-INV-001.md",
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
    task_id: "PLAN-INV-001",
    source_plan_ref: "plan:2026-06:task-inv-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-inv-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-inv-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/inv-001.md",
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
  });
}

function makeValidFixture(): HCCTerminalPlanFixture {
  const authorization = makeAuthorization();
  return {
    task_id: "PLAN-INV-001",
    source_plan_ref: "plan:2026-06:task-inv-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-inv-001",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-inv-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-inv-001",
    target_path: "src/shared/lib/notes/inv-001.md",
    authorization_result: authorization as unknown as Record<string, unknown>,
    runner_result: makeRunner(authorization) as unknown as Record<string, unknown>,
    audit_result: makeAuditPlan() as unknown as Record<string, unknown>,
    rollback_plan: makeRollbackPlan() as unknown as Record<string, unknown>,
    dispatch_backend: "file_write",
    dispatch_payload: { kind: "file", target_path: "src/shared/lib/notes/inv-001.md", content: "test" },
  };
}

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-inv-001" })),
  };
}

// ---------------------------------------------------------------------------
// parseTerminalPlanInvokerCliArgs
// ---------------------------------------------------------------------------

describe("HCC terminal plan invoker CLI: parse args", () => {
  it("missing --plan-fixture -> parse error", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--terminal-agent-session-id", "sess",
        "--terminal-invocation-id", "inv",
        "--explicit-user-trigger-token", "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("plan-fixture");
  });

  it("missing --terminal-agent-session-id -> parse error", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "/tmp/f.json",
        "--terminal-invocation-id", "inv",
        "--explicit-user-trigger-token", "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("terminal-agent-session-id");
  });

  it("missing --terminal-invocation-id -> parse error", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "/tmp/f.json",
        "--terminal-agent-session-id", "sess",
        "--explicit-user-trigger-token", "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("terminal-invocation-id");
  });

  it("missing --explicit-user-trigger-token -> parse error", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "/tmp/f.json",
        "--terminal-agent-session-id", "sess",
        "--terminal-invocation-id", "inv",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("explicit-user-trigger-token");
  });

  it("missing --feature-flag-enabled -> parse error", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "/tmp/f.json",
        "--terminal-agent-session-id", "sess",
        "--terminal-invocation-id", "inv",
        "--explicit-user-trigger-token", "t",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("feature flag");
  });

  it("valid flags -> ok", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "/tmp/f.json",
        "--terminal-agent-session-id", "sess",
        "--terminal-invocation-id", "inv",
        "--explicit-user-trigger-token", "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.plan_fixture_path).toBe("/tmp/f.json");
      expect(r.args.terminal_agent_session_id).toBe("sess");
      expect(r.args.terminal_invocation_id).toBe("inv");
      expect(r.args.explicit_user_trigger_token).toBe("t");
      expect(r.args.feature_flag_enabled).toBe(true);
    }
  });

  it("env var fallback for identity flags", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      ["--plan-fixture", "/tmp/f.json", "--feature-flag-enabled"],
      {
        HCC_TERMINAL_AGENT_SESSION_ID: "env-sess",
        HCC_TERMINAL_INVOCATION_ID: "env-inv",
        HCC_EXPLICIT_USER_TRIGGER_TOKEN: "env-trigger",
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.terminal_agent_session_id).toBe("env-sess");
      expect(r.args.terminal_invocation_id).toBe("env-inv");
      expect(r.args.explicit_user_trigger_token).toBe("env-trigger");
    }
  });

  it("CLI flag takes precedence over env var", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "/tmp/f.json",
        "--terminal-agent-session-id", "cli-sess",
        "--terminal-invocation-id", "cli-inv",
        "--explicit-user-trigger-token", "cli-trigger",
        "--feature-flag-enabled",
      ],
      {
        HCC_TERMINAL_AGENT_SESSION_ID: "env-sess",
        HCC_TERMINAL_INVOCATION_ID: "env-inv",
        HCC_EXPLICIT_USER_TRIGGER_TOKEN: "env-trigger",
      },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.args.terminal_agent_session_id).toBe("cli-sess");
      expect(r.args.terminal_invocation_id).toBe("cli-inv");
      expect(r.args.explicit_user_trigger_token).toBe("cli-trigger");
    }
  });

  it("empty flag value -> parse error", () => {
    const r = parseTerminalPlanInvokerCliArgs(
      [
        "--plan-fixture", "",
        "--terminal-agent-session-id", "sess",
        "--terminal-invocation-id", "inv",
        "--explicit-user-trigger-token", "t",
        "--feature-flag-enabled",
      ],
      {},
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("plan-fixture");
  });
});

// ---------------------------------------------------------------------------
// parsePlanFixture
// ---------------------------------------------------------------------------

describe("HCC terminal plan invoker CLI: parsePlanFixture", () => {
  it("valid fixture JSON -> ok", () => {
    const raw = JSON.stringify(makeValidFixture());
    const r = parsePlanFixture(raw);
    expect(r.ok).toBe(true);
  });

  it("malformed JSON -> NO-GO", () => {
    const r = parsePlanFixture("{not json}");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("not valid JSON");
  });

  it("non-object JSON -> NO-GO", () => {
    const r = parsePlanFixture("null");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("must be a JSON object");
  });

  it("array JSON -> NO-GO", () => {
    const r = parsePlanFixture("[]");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("must be a JSON object");
  });

  it("missing task_id -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).task_id;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("task_id");
  });

  it("missing authorization_result -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).authorization_result;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("authorization_result");
  });

  it("missing runner_result -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).runner_result;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("runner_result");
  });

  it("missing audit_result -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).audit_result;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("audit_result");
  });

  it("missing rollback_plan -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).rollback_plan;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("rollback_plan");
  });

  it("missing dispatch_backend -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).dispatch_backend;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("dispatch_backend");
  });

  it("missing dispatch_payload -> NO-GO", () => {
    const f = makeValidFixture();
    delete (f as Record<string, unknown>).dispatch_payload;
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("dispatch_payload");
  });

  it("invalid planned_action_kind -> NO-GO", () => {
    const f = makeValidFixture();
    (f as Record<string, unknown>).planned_action_kind = "delete_file";
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("planned_action_kind");
  });

  it("invalid dispatch_backend -> NO-GO", () => {
    const f = makeValidFixture();
    (f as Record<string, unknown>).dispatch_backend = "rm_rf";
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("dispatch_backend");
  });

  it("empty string field -> NO-GO", () => {
    const f = makeValidFixture();
    (f as Record<string, unknown>).task_id = "";
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("task_id");
  });

  it("non-object authorization_result -> NO-GO", () => {
    const f = makeValidFixture();
    (f as Record<string, unknown>).authorization_result = "not-an-object";
    const r = parsePlanFixture(JSON.stringify(f));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("authorization_result");
  });
});

// ---------------------------------------------------------------------------
// runTerminalPlanInvokerCli
// ---------------------------------------------------------------------------

describe("HCC terminal plan invoker CLI: runTerminalPlanInvokerCli", () => {
  it("valid fixture + injected adapter -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      adapter,
      () => fixtureJSON,
    );
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });

  it("calls dispatch_adapter.dispatch exactly once", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    await runTerminalPlanInvokerCli(makeCliArgs(), adapter, () => fixtureJSON);
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
  });

  it("preserves terminal_agent_session_id in result", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs({ terminal_agent_session_id: "my-session-42" }),
      adapter,
      () => fixtureJSON,
    );
    expect(r.terminal_agent_session_id).toBe("my-session-42");
  });

  it("preserves terminal_invocation_id in result", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs({ terminal_invocation_id: "my-inv-42" }),
      adapter,
      () => fixtureJSON,
    );
    expect(r.terminal_invocation_id).toBe("my-inv-42");
  });

  it("preserves unattended_ready: false", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(makeCliArgs(), adapter, () => fixtureJSON);
    expect(r.unattended_ready).toBe(false);
  });

  it("preserves night_run_ready: false", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(makeCliArgs(), adapter, () => fixtureJSON);
    expect(r.night_run_ready).toBe(false);
  });

  it("preserves go_no_go: NO-GO", async () => {
    const adapter = makeMockAdapter();
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(makeCliArgs(), adapter, () => fixtureJSON);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("missing fixture file on disk -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      adapter,
      () => {
        throw new Error("ENOENT: no such file");
      },
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("cannot read plan fixture");
  });

  it("malformed JSON fixture -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      adapter,
      () => "{not json}",
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("not valid JSON");
  });

  it("default no-op adapter -> NO-GO (adapter refuses)", async () => {
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      undefined, // use default no-op adapter
      () => fixtureJSON,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("does not support");
  });

  it("adapter that throws -> NO-GO", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("dispatch denied: test rejection");
      }),
    };
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      adapter,
      () => fixtureJSON,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch denied");
  });

  it("NO-GO result has NO-GO go_no_go", async () => {
    const fixtureJSON = JSON.stringify(makeValidFixture());
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      undefined,
      () => fixtureJSON,
    );
    expect(r.go_no_go).toBe("NO-GO");
  });
});

// ---------------------------------------------------------------------------
// main() integration
// ---------------------------------------------------------------------------

describe("HCC terminal plan invoker CLI: main()", () => {
  it("main with missing args -> exit code 2 and NO-GO JSON", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await main([]);
    expect(code).toBe(2);
    const output = write.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.verdict).toBe("NO-GO");
    write.mockRestore();
  });

  it("main returns typed NO-GO shape", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const code = await main(["--plan-fixture", "/nonexistent"]);
    expect(code).toBe(2);
    const output = write.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(output);
    expect(parsed.verdict).toBe("NO-GO");
    expect(parsed.schema_version).toBe(HCC_TERMINAL_PLAN_INVOKER_CLI_SCHEMA_VERSION);
    expect(parsed.unattended_ready).toBe(false);
    expect(parsed.night_run_ready).toBe(false);
    expect(parsed.go_no_go).toBe("NO-GO");
    write.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// static source guard
// ---------------------------------------------------------------------------

describe("HCC terminal plan invoker CLI: static source guard", () => {
  it("source does not contain forbidden runtime surfaces", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/cli/hcc-terminal-plan-invoker.ts"),
      "utf-8",
    );

    // Strip single-line comments (//) and block comments (/* */)
    const stripped = src
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    const FORBIDDEN = [
      "spawn(",
      "exec(",
      "execSync(",
      "child_process",
      "setInterval(",
      "setTimeout(",
      "cron",
      "auto-arm",
      "auto_arm",
      "ipcMain",
      "BrowserWindow",
      "contextBridge",
      'go_no_go: "GO"',
      'go_no_go:"GO"',
      "night_run_ready: true",
      "night_run_ready:true",
      "submitDryRunAction",
      "~/.hermes",
    ];

    for (const forbidden of FORBIDDEN) {
      expect(stripped).not.toContain(forbidden);
    }
  });
});

// ---------------------------------------------------------------------------
// Real adapter wiring (HCC-TERMINAL-PLAN-INVOKER-WIRING-001)
// ---------------------------------------------------------------------------

describe("HCC terminal plan invoker CLI: real adapter wiring", () => {
  function makeExecutorDeps() {
    return {
      shell_executor: vi.fn(async (command_id: string) => ({ command_id })),
      writer: vi.fn(async () => ({ controlled_command_id: "wired-cc" })),
      patcher: vi.fn(async () => ({ controlled_command_id: "wired-cc" })),
    };
  }

  it("real executors + file_write fixture -> CANDIDATE, writer called", async () => {
    const executorDeps = makeExecutorDeps();
    const fixture = makeValidFixture();
    fixture.dispatch_backend = "file_write";
    fixture.dispatch_payload = {
      kind: "file",
      target_path: "src/shared/lib/notes/wired-001.md",
      content: "wired",
    };
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      undefined, // no explicit adapter
      () => JSON.stringify(fixture),
      executorDeps,
    );
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(executorDeps.writer).toHaveBeenCalledTimes(1);
  });

  it("real executors + shell_command fixture -> CANDIDATE, shell called", async () => {
    const executorDeps = makeExecutorDeps();
    const base = makeValidFixture();
    const fixture: typeof base = {
      ...base,
      dispatch_backend: "shell_command",
      planned_action_kind: "shell_command",
      target_path: "src/shared/lib/notes/allowlist-target",
      dispatch_payload: { argv: ["git", "status"] },
    };
    // Re-stamp runner_result and audit_result to match the new kind.
    fixture.runner_result = {
      ...fixture.runner_result,
      planned_action_kind: "shell_command",
      planned_action_id: fixture.planned_action_id,
    } as typeof fixture.runner_result;
    fixture.audit_result = {
      ...fixture.audit_result,
      planned_action_kind: "shell_command",
      planned_action_id: fixture.planned_action_id,
      target_path: fixture.target_path,
    } as typeof fixture.audit_result;
    fixture.rollback_plan = {
      ...fixture.rollback_plan,
      planned_action_kind: "shell_command",
      planned_action_id: fixture.planned_action_id,
      target_path: fixture.target_path,
    } as typeof fixture.rollback_plan;
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      undefined,
      () => JSON.stringify(fixture),
      executorDeps,
    );
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(executorDeps.shell_executor).toHaveBeenCalledTimes(1);
  });

  it("no executorDeps -> no-op adapter path, dispatch never called", async () => {
    const fixture = makeValidFixture();
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      undefined, // no adapter
      () => JSON.stringify(fixture),
      undefined, // no executors
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("executorDeps + non-allowlisted shell -> NO-GO via controlled dispatch deny", async () => {
    const executorDeps = {
      shell_executor: vi.fn(async (cid: string) => ({ command_id: cid })),
      writer: vi.fn(async () => ({ controlled_command_id: "x" })),
      patcher: vi.fn(async () => ({ controlled_command_id: "x" })),
    };
    const base = makeValidFixture();
    const fixture: typeof base = {
      ...base,
      dispatch_backend: "shell_command",
      planned_action_kind: "shell_command",
      dispatch_payload: { argv: ["rm", "-rf", "/"] },
    };
    fixture.runner_result = {
      ...fixture.runner_result,
      planned_action_kind: "shell_command",
      planned_action_id: fixture.planned_action_id,
    } as typeof fixture.runner_result;
    fixture.audit_result = {
      ...fixture.audit_result,
      planned_action_kind: "shell_command",
      planned_action_id: fixture.planned_action_id,
      target_path: fixture.target_path,
    } as typeof fixture.audit_result;
    fixture.rollback_plan = {
      ...fixture.rollback_plan,
      planned_action_kind: "shell_command",
      planned_action_id: fixture.planned_action_id,
      target_path: fixture.target_path,
    } as typeof fixture.rollback_plan;
    const r = await runTerminalPlanInvokerCli(
      makeCliArgs(),
      undefined,
      () => JSON.stringify(fixture),
      executorDeps,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("DENIED");
    expect(executorDeps.shell_executor).not.toHaveBeenCalled();
  });
});
