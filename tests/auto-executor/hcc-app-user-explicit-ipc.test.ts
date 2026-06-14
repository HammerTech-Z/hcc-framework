import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  checkAppIpcRequest,
  handleAppIpcInvocation,
  HCC_APP_USER_EXPLICIT_IPC_SCHEMA_VERSION,
  type HCCAppIpcRequest,
} from "../../src/shared/lib/hcc-app-user-explicit-ipc";
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
      task_id: "PLAN-APP-001",
      source_plan_ref: "plan:2026-06:task-app-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-app-001",
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
    task_id: "PLAN-APP-001",
    source_plan_ref: "plan:2026-06:task-app-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-app-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-app-001",
  });
}

function makeAuditPlan() {
  return {
    ...planAuditActualWrite({
      task_id: "PLAN-APP-001",
      source_plan_ref: "plan:2026-06:task-app-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-app-001",
      runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-app-001",
      planned_action_kind: "file_write",
      whitelist_action_id: "wl-app-001",
      target_path: "docs/audit/hcc/2026-06-14/PLAN-APP-001.md",
      audit_payload: {
        would_execute: false as const,
        real_execution_ready: false as const,
        unattended_ready: false as const,
        any_command_executed: false as const,
        executed_commands: [] as const,
        go_no_go: "NO-GO" as const,
        body: "audit body",
      },
    }),
    verdict: "AUDIT-ACTUAL-WRITTEN" as const,
    written: true,
  };
}

function makeRollbackPlan() {
  return planRollbackActualRecovery({
    task_id: "PLAN-APP-001",
    source_plan_ref: "plan:2026-06:task-app-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-app-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-app-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/app-001.md",
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
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-app-001" })),
  };
}

function makeRequest(
  overrides: Partial<HCCAppIpcRequest> = {},
): HCCAppIpcRequest {
  const authorization = makeAuthorization();
  const sharedAdapter = makeMockAdapter();
  return {
    app_session_id: "app-session-001",
    app_invocation_id: "app-inv-001",
    user_confirmation: {
      kind: "renderer_button_click",
      nonce: "nonce-001",
      display_text: "Confirm dispatch?",
      confirmed_at: "2026-06-14T11:55:00.000Z",
    },
    shared_fixture: {
      task_id: "PLAN-APP-001",
      source_plan_ref: "plan:2026-06:task-app-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-app-001",
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-app-001",
      planned_action_kind: "file_write",
      whitelist_action_id: "wl-app-001",
      target_path: "src/shared/lib/notes/app-001.md",
      explicit_user_trigger_token: "user-token-app-001",
      dispatch_adapter: sharedAdapter,
      authorization_result: authorization,
      runner_result: makeRunner(authorization),
      audit_result: makeAuditPlan(),
      rollback_plan: makeRollbackPlan(),
    },
    ...overrides,
  };
}

describe("HCC app user-explicit IPC: checkAppIpcRequest (sync guard)", () => {
  it("valid request -> null", () => {
    expect(checkAppIpcRequest(makeRequest())).toBeNull();
  });

  it("missing app_session_id -> reason", () => {
    const r = checkAppIpcRequest(makeRequest({ app_session_id: "" }));
    expect(r).toContain("app_session_id");
  });

  it("missing app_invocation_id -> reason", () => {
    const r = checkAppIpcRequest(makeRequest({ app_invocation_id: "" }));
    expect(r).toContain("app_invocation_id");
  });

  it("missing user_confirmation -> reason", () => {
    const r = checkAppIpcRequest(
      makeRequest({ user_confirmation: undefined as never }),
    );
    expect(r).toContain("user_confirmation");
  });

  it("unsupported user_confirmation.kind -> reason", () => {
    const r = checkAppIpcRequest(
      makeRequest({
        user_confirmation: {
          kind: "auto_boot" as never,
          nonce: "nonce-001",
          display_text: "x",
          confirmed_at: "2026-06-14T11:55:00.000Z",
        },
      }),
    );
    expect(r).toMatch(/user_confirmation\.kind/);
  });

  it("user_confirmation missing nonce -> reason", () => {
    const r = checkAppIpcRequest(
      makeRequest({
        user_confirmation: {
          kind: "renderer_button_click",
          nonce: "",
          display_text: "x",
          confirmed_at: "2026-06-14T11:55:00.000Z",
        },
      }),
    );
    expect(r).toContain("nonce");
  });

  it("shared_fixture missing explicit_user_trigger_token -> reason", () => {
    const r = checkAppIpcRequest(
      makeRequest({
        shared_fixture: {
          ...makeRequest().shared_fixture,
          explicit_user_trigger_token: "",
        },
      }),
    );
    expect(r).toContain("explicit_user_trigger_token");
  });

  it("shared_fixture guard fail -> propagated reason", () => {
    const r = checkAppIpcRequest(
      makeRequest({
        shared_fixture: {
          ...makeRequest().shared_fixture,
          task_id: "",
        },
      }),
    );
    expect(r).toContain("shared_fixture");
  });
});

describe("HCC app user-explicit IPC: handleAppIpcInvocation (async)", () => {
  it("valid request -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const r = await handleAppIpcInvocation(makeRequest());
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });

  it("candidate preserves app identity", async () => {
    const r = await handleAppIpcInvocation(makeRequest());
    expect(r.app_session_id).toBe("app-session-001");
    expect(r.app_invocation_id).toBe("app-inv-001");
  });

  it("candidate preserves user-explicit boundary", async () => {
    const r = await handleAppIpcInvocation(makeRequest());
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
  });

  it("candidate flips real_execution_ready / would_execute / any_command_executed", async () => {
    const r = await handleAppIpcInvocation(makeRequest());
    expect(r.real_execution_ready).toBe(true);
    expect(r.would_execute).toBe(true);
    expect(r.any_command_executed).toBe(true);
  });

  it("valid in_memory backend path through injected adapter", async () => {
    const adapter = makeMockAdapter();
    const r = await handleAppIpcInvocation(
      makeRequest({
        shared_fixture: {
          ...makeRequest().shared_fixture,
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.controlled_command_id).toBe("cc-app-001");
    expect(adapter.supportsKind).toHaveBeenCalled();
  });

  it("valid allowlisted shell_command path through injected executor (adapter happy)", async () => {
    const adapter = makeMockAdapter();
    const authorization = makeAuthorization();
    // Recompute the runner + audit + rollback with
    // shell_command kind so the final dispatch identity
    // agreement check passes.
    const runner = evaluateControlledRealRunnerCandidate({
      task_id: "PLAN-APP-001",
      source_plan_ref: "plan:2026-06:task-app-001",
      requested_by_user: "u-requester",
      authorization_result: authorization,
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-app-001",
      planned_action_kind: "shell_command",
      whitelist_action_id: "wl-app-001",
    });
    const audit = {
      ...planAuditActualWrite({
        task_id: "PLAN-APP-001",
        source_plan_ref: "plan:2026-06:task-app-001",
        requested_by_user: "u-requester",
        authorization_id: "auth-app-001",
        runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
        dry_run_artifact_hash: HASH,
        planned_action_id: "act-app-001",
        planned_action_kind: "shell_command",
        whitelist_action_id: "wl-app-001",
        target_path: "docs/audit/hcc/2026-06-14/PLAN-APP-001.md",
        audit_payload: {
          would_execute: false as const,
          real_execution_ready: false as const,
          unattended_ready: false as const,
          any_command_executed: false as const,
          executed_commands: [] as const,
          go_no_go: "NO-GO" as const,
          body: "audit body",
        },
      }),
      verdict: "AUDIT-ACTUAL-WRITTEN" as const,
      written: true,
    };
    const rollback = planRollbackActualRecovery({
      task_id: "PLAN-APP-001",
      source_plan_ref: "plan:2026-06:task-app-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-app-001",
      runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
      audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
      planned_action_id: "act-app-001",
      planned_action_kind: "shell_command",
      target_path: "src/shared/lib/notes/argv.md",
      before_hash: "sha256:before",
      after_hash: "sha256:after",
      recovery_strategy: "restore_file_from_snapshot",
    });
    const r = await handleAppIpcInvocation(
      makeRequest({
        shared_fixture: {
          task_id: "PLAN-APP-001",
          source_plan_ref: "plan:2026-06:task-app-001",
          requested_by_user: "u-requester",
          authorization_id: "auth-app-001",
          dry_run_artifact_hash: HASH,
          planned_action_id: "act-app-001",
          planned_action_kind: "shell_command",
          whitelist_action_id: "wl-app-001",
          target_path: "(argv)",
          explicit_user_trigger_token: "user-token-app-001",
          dispatch_adapter: adapter,
          authorization_result: authorization,
          runner_result: runner,
          audit_result: audit,
          rollback_plan: rollback,
        },
      }),
    );
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });
});

describe("HCC app user-explicit IPC: denial paths", () => {
  it("missing explicit_user_trigger_token -> NO-GO, adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await handleAppIpcInvocation(
      makeRequest({
        shared_fixture: {
          ...makeRequest().shared_fixture,
          explicit_user_trigger_token: "",
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing app_session_id -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await handleAppIpcInvocation(
      makeRequest({
        app_session_id: "",
        shared_fixture: {
          ...makeRequest().shared_fixture,
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing app_invocation_id -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await handleAppIpcInvocation(
      makeRequest({
        app_invocation_id: "",
        shared_fixture: {
          ...makeRequest().shared_fixture,
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing user_confirmation -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await handleAppIpcInvocation(
      makeRequest({
        user_confirmation: undefined as never,
        shared_fixture: {
          ...makeRequest().shared_fixture,
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing shared_fixture -> NO-GO", async () => {
    const r = await handleAppIpcInvocation(
      makeRequest({ shared_fixture: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("shared_fixture guard fail -> NO-GO, adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await handleAppIpcInvocation(
      makeRequest({
        shared_fixture: {
          ...makeRequest().shared_fixture,
          task_id: "",
          dispatch_adapter: adapter,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("adapter throw -> typed NO-GO with propagated reason", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("dispatch boom");
      }),
    };
    const r = await handleAppIpcInvocation(
      makeRequest({
        shared_fixture: {
          ...makeRequest().shared_fixture,
          dispatch_adapter: adapter as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch boom");
  });
});

describe("HCC app user-explicit IPC: NO-GO preserves user-explicit boundary", () => {
  it("invoker-local NO-GO keeps unattended / night / go_no_go literal", async () => {
    const r = await handleAppIpcInvocation(
      makeRequest({ app_session_id: "" }),
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
    expect(r.app_session_id).toBe("");
  });
});

describe("HCC app user-explicit IPC: no unattended enablement", () => {
  it("NO-GO verdict can never carry unattended_ready / night_run_ready / go_no_go=GO", async () => {
    const r = await handleAppIpcInvocation(
      makeRequest({ app_session_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC app user-explicit IPC: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_APP_USER_EXPLICIT_IPC_SCHEMA_VERSION).toBe("1.0.0");
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
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call ipcMain / BrowserWindow / contextBridge", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
  });

  it("lib does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/\bexec\s*\(/);
  });

  it("lib does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("lib does NOT write ~/.hermes/**", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-app-user-explicit-ipc.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/writeFile/);
  });
});
