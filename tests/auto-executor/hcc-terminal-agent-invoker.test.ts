import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildTerminalDispatchAdapter,
  checkTerminalFixture,
  HCC_TERMINAL_AGENT_INVOKER_SCHEMA_VERSION,
  invokeTerminalAgentControlledRealDispatch,
  type HCCTerminalInvocationFixture,
} from "../../src/shared/lib/hcc-terminal-agent-invoker";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";
import { evaluateControlledRealRunnerCandidate } from "../../src/shared/lib/hcc-controlled-real-runner";
import { planAuditActualWrite } from "../../src/shared/lib/hcc-audit-actual-write";
import { planRollbackActualRecovery } from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = "2026-06-14T12:00:00.000Z";
const ISSUED = "2026-06-14T11:00:00.000Z";
const EXPIRES = "2026-06-14T13:00:00.000Z";
const HASH = "sha256:abc123";

function makeAuthorization() {
  return evaluateRealExecutionAuthorization(
    {
      task_id: "PLAN-TERM-001",
      source_plan_ref: "plan:2026-06:task-term-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-term-001",
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
    task_id: "PLAN-TERM-001",
    source_plan_ref: "plan:2026-06:task-term-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-term-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-term-001",
  });
}

function makeAuditPlan() {
  // Synthetic AUDIT-ACTUAL-WRITTEN plan. The terminal
  // invoker threads the audit through the shared service +
  // final dispatch; both require the WRITTEN verdict for
  // the gate chain to pass.
  const plan = planAuditActualWrite({
    task_id: "PLAN-TERM-001",
    source_plan_ref: "plan:2026-06:task-term-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-term-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-term-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-term-001",
    target_path: "docs/audit/hcc/2026-06-14/PLAN-TERM-001.md",
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
    task_id: "PLAN-TERM-001",
    source_plan_ref: "plan:2026-06:task-term-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-term-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-term-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/term-001.md",
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
  });
}

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-term-001" })),
  };
}

function makeFixture(
  overrides: Partial<HCCTerminalInvocationFixture> = {},
): HCCTerminalInvocationFixture {
  const authorization = makeAuthorization();
  const sharedAdapter = makeMockAdapter();
  return {
    terminal_agent_session_id: "terminal-session-001",
    terminal_invocation_id: "terminal-inv-001",
    shared_fixture: {
      task_id: "PLAN-TERM-001",
      source_plan_ref: "plan:2026-06:task-term-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-term-001",
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-term-001",
      planned_action_kind: "file_write",
      whitelist_action_id: "wl-term-001",
      target_path: "src/shared/lib/notes/term-001.md",
      explicit_user_trigger_token: "user-token-term-001",
      dispatch_adapter: sharedAdapter,
      authorization_result: authorization,
      runner_result: makeRunner(authorization),
      audit_result: makeAuditPlan(),
      rollback_plan: makeRollbackPlan(),
    },
    dispatch_adapter: sharedAdapter,
    ...overrides,
  };
}

describe("HCC terminal agent invoker: checkTerminalFixture (sync guard)", () => {
  it("valid fixture -> null", () => {
    expect(checkTerminalFixture(makeFixture())).toBeNull();
  });

  it("missing terminal_agent_session_id -> reason", () => {
    const r = checkTerminalFixture(
      makeFixture({ terminal_agent_session_id: "" }),
    );
    expect(r).toContain("terminal_agent_session_id");
  });

  it("missing terminal_invocation_id -> reason", () => {
    const r = checkTerminalFixture(
      makeFixture({ terminal_invocation_id: "" }),
    );
    expect(r).toContain("terminal_invocation_id");
  });

  it("missing dispatch_adapter -> reason", () => {
    const r = checkTerminalFixture(
      makeFixture({ dispatch_adapter: undefined as never }),
    );
    expect(r).toContain("dispatch_adapter");
  });

  it("shared_fixture missing explicit_user_trigger_token -> reason", () => {
    const r = checkTerminalFixture(
      makeFixture({
        shared_fixture: {
          ...makeFixture().shared_fixture,
          explicit_user_trigger_token: "",
        },
      }),
    );
    expect(r).toContain("explicit_user_trigger_token");
  });
});

describe("HCC terminal agent invoker: invokeTerminalAgentControlledRealDispatch", () => {
  it("valid fixture -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(makeFixture());
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });

  it("candidate preserves terminal identity", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(makeFixture());
    expect(r.terminal_agent_session_id).toBe("terminal-session-001");
    expect(r.terminal_invocation_id).toBe("terminal-inv-001");
  });

  it("candidate preserves user-explicit boundary", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(makeFixture());
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
  });

  it("candidate flips real_execution_ready / would_execute / any_command_executed", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(makeFixture());
    expect(r.real_execution_ready).toBe(true);
    expect(r.would_execute).toBe(true);
    expect(r.any_command_executed).toBe(true);
  });

  it("candidate calls dispatch_adapter.dispatch exactly once", async () => {
    const adapter = makeMockAdapter();
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        dispatch_adapter: adapter,
        shared_fixture: {
          ...makeFixture().shared_fixture,
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
  });

  it("valid in_memory backend path through injected adapter", async () => {
    const adapter = makeMockAdapter();
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        dispatch_adapter: adapter,
        shared_fixture: {
          ...makeFixture().shared_fixture,
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.controlled_command_id).toBe("cc-term-001");
    expect(adapter.supportsKind).toHaveBeenCalled();
  });

  it("non-allowlisted shell_command denied by adapter (typed failure propagates)", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: DENIED: argv is not in the shell allowlist");
      }),
    };
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        dispatch_adapter: adapter as never,
        shared_fixture: {
          ...makeFixture().shared_fixture,
          dispatch_adapter: adapter as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("locked path denied by adapter (typed failure propagates)", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("controlled dispatch denied: DENIED: target_path is in a locked scope");
      }),
    };
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        dispatch_adapter: adapter as never,
        shared_fixture: {
          ...makeFixture().shared_fixture,
          dispatch_adapter: adapter as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC terminal agent invoker: denial paths", () => {
  it("missing explicit_user_trigger_token -> NO-GO, adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        shared_fixture: {
          ...makeFixture().shared_fixture,
          explicit_user_trigger_token: "",
        },
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing terminal_agent_session_id -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        terminal_agent_session_id: "",
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing dispatch_adapter -> NO-GO", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({ dispatch_adapter: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch_adapter");
  });

  it("missing shared_fixture (undefined) -> NO-GO", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({ shared_fixture: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("adapter failure (throws) -> NO-GO with propagated reason", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("dispatch boom");
      }),
    };
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({
        dispatch_adapter: adapter as never,
        shared_fixture: {
          ...makeFixture().shared_fixture,
          dispatch_adapter: adapter as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC terminal agent invoker: NO-GO preserves user-explicit boundary", () => {
  it("invoker-local NO-GO keeps unattended / night / go_no_go literal", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({ terminal_agent_session_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.real_execution_ready).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.controlled_command_id).toBe("");
    expect(r.terminal_agent_session_id).toBe("");
  });
});

describe("HCC terminal agent invoker: buildTerminalDispatchAdapter helper", () => {
  it("builds adapter that supports shell / file / config", () => {
    const adapter = buildTerminalDispatchAdapter(() => ({
      planned_action_id: "act-001",
      backend: "file_write",
      payload: {
        kind: "file",
        target_path: "docs/notes/x.md",
        content: "x",
      },
      trigger_proof: {
        explicit_user_trigger_token: "tok",
        source_service: "hcc-shared-invocation-service",
      },
      executors: {
        shell_executor: vi.fn(),
        writer: vi.fn(),
        patcher: vi.fn(),
      },
      now: () => "2026-06-14T12:00:00.000Z",
    }));
    expect(adapter.supportsKind("file_write")).toBe(true);
    expect(adapter.supportsKind("shell_command")).toBe(true);
    expect(adapter.supportsKind("config_patch")).toBe(true);
  });
});

describe("HCC terminal agent invoker: no unattended enablement", () => {
  it("NO-GO verdict can never carry unattended_ready / night_run_ready / go_no_go=GO", async () => {
    const r = await invokeTerminalAgentControlledRealDispatch(
      makeFixture({ terminal_agent_session_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC terminal agent invoker: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_TERMINAL_AGENT_INVOKER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("lib does NOT set unattended_ready: true / night_run_ready: true / go_no_go: \"GO\"", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-terminal-agent-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-terminal-agent-invoker.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/\bexec\s*\(/);
  });

  it("lib does NOT call ipcMain / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-terminal-agent-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-terminal-agent-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-terminal-agent-invoker.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("lib does NOT write ~/.hermes/**", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-terminal-agent-invoker.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/writeFile/);
  });
});
