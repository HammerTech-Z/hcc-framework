import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildFinalDispatchInputFromFixture,
  checkUserExplicitFixture,
  HCC_USER_EXPLICIT_LOCAL_INVOKER_SCHEMA_VERSION,
  invokeUserExplicitControlledRealDispatch,
  type HCCUserExplicitInvocationFixture,
} from "../../src/shared/lib/hcc-user-explicit-local-invoker";
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
  return {
    ...planAuditActualWrite({
      task_id: "PLAN-INV-001",
      source_plan_ref: "plan:2026-06:task-inv-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-inv-001",
      runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-inv-001",
      planned_action_kind: "file_write",
      whitelist_action_id: "wl-inv-001",
      target_path: "docs/audit/hcc/2026-06-14/PLAN-INV-001.md",
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

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-inv-001" })),
  };
}

function makeFixture(
  overrides: Partial<HCCUserExplicitInvocationFixture> = {},
): HCCUserExplicitInvocationFixture {
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
    explicit_user_trigger_token: "user-token-XYZ-123",
    dispatch_adapter: makeMockAdapter(),
    authorization_result: authorization,
    runner_result: makeRunner(authorization),
    audit_result: makeAuditPlan(),
    rollback_plan: makeRollbackPlan(),
    ...overrides,
  };
}

describe("HCC user-explicit local invoker: checkUserExplicitFixture (sync guard)", () => {
  it("valid fixture -> null (no guard reason)", () => {
    const r = checkUserExplicitFixture(makeFixture());
    expect(r).toBeNull();
  });

  it("missing explicit_user_trigger_token -> reason", () => {
    const r = checkUserExplicitFixture(
      makeFixture({ explicit_user_trigger_token: "" }),
    );
    expect(r).toContain("explicit_user_trigger_token");
  });

  it("whitespace-only token -> reason", () => {
    const r = checkUserExplicitFixture(
      makeFixture({ explicit_user_trigger_token: "   " }),
    );
    expect(r).toContain("explicit_user_trigger_token");
  });

  it("missing dispatch_adapter -> reason", () => {
    const r = checkUserExplicitFixture(
      makeFixture({ dispatch_adapter: undefined as never }),
    );
    expect(r).toContain("dispatch_adapter");
  });

  it("adapter missing supportsKind -> reason", () => {
    const adapter = makeMockAdapter();
    (adapter as { supportsKind?: unknown }).supportsKind = undefined;
    const r = checkUserExplicitFixture(
      makeFixture({ dispatch_adapter: adapter as never }),
    );
    expect(r).toContain("supportsKind");
  });

  it("adapter missing dispatch -> reason", () => {
    const adapter = makeMockAdapter();
    (adapter as { dispatch?: unknown }).dispatch = undefined;
    const r = checkUserExplicitFixture(
      makeFixture({ dispatch_adapter: adapter as never }),
    );
    expect(r).toContain("dispatch");
  });

  it("missing task_id -> reason", () => {
    const r = checkUserExplicitFixture(makeFixture({ task_id: "" }));
    expect(r).toContain("task_id");
  });

  it("unsupported planned_action_kind -> reason", () => {
    const r = checkUserExplicitFixture(
      makeFixture({ planned_action_kind: "remote_exec" as never }),
    );
    expect(r).toContain("planned_action_kind");
  });
});

describe("HCC user-explicit local invoker: buildFinalDispatchInputFromFixture", () => {
  it("valid fixture -> builds input with explicit_user_triggered=true", () => {
    const input = buildFinalDispatchInputFromFixture(makeFixture());
    expect(input.explicit_user_triggered).toBe(true);
    expect(input.task_id).toBe("PLAN-INV-001");
    expect(input.dry_run_artifact_hash).toBe(HASH);
  });

  it("invalid fixture -> throws", () => {
    expect(() =>
      buildFinalDispatchInputFromFixture(
        makeFixture({ explicit_user_trigger_token: "" }),
      ),
    ).toThrow(/explicit_user_trigger_token|invoker refused/);
  });
});

describe("HCC user-explicit local invoker: invokeUserExplicitControlledRealDispatch (async)", () => {
  it("valid fixture -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(makeFixture());
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });

  it("candidate preserves user-explicit boundary (unattended / night / go_no_go)", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(makeFixture());
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("candidate flips real_execution_ready / would_execute / any_command_executed", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(makeFixture());
    expect(r.real_execution_ready).toBe(true);
    expect(r.would_execute).toBe(true);
    expect(r.any_command_executed).toBe(true);
  });

  it("candidate calls dispatch_adapter.dispatch exactly once with (id, kind, path)", async () => {
    const adapter = makeMockAdapter();
    await invokeUserExplicitControlledRealDispatch(
      makeFixture({ dispatch_adapter: adapter }),
    );
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
    expect(adapter.dispatch).toHaveBeenCalledWith(
      "act-inv-001",
      "file_write",
      "src/shared/lib/notes/inv-001.md",
    );
  });

  it("missing trigger token -> NO-GO, adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await invokeUserExplicitControlledRealDispatch(
      makeFixture({
        explicit_user_trigger_token: "",
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing dispatch_adapter -> NO-GO", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(
      makeFixture({ dispatch_adapter: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch_adapter");
  });

  it("NO-GO from final dispatch propagates (e.g. identity mismatch in final)", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(
      makeFixture({ task_id: "PLAN-OTHER" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("NO-GO from final dispatch propagates (audit verdict wrong)", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(
      makeFixture({
        audit_result: {
          ...makeAuditPlan(),
          verdict: "AUDIT-ACTUAL-WRITE-CANDIDATE" as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC user-explicit local invoker: NO-GO preserves user-explicit boundary", () => {
  it("invoker-local NO-GO keeps unattended_ready / night_run_ready / go_no_go literal", async () => {
    const r = await invokeUserExplicitControlledRealDispatch(
      makeFixture({ explicit_user_trigger_token: "" }),
    );
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
  });
});

describe("HCC user-explicit local invoker: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_USER_EXPLICIT_LOCAL_INVOKER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("lib does NOT set unattended_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-user-explicit-local-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
  });

  it("lib does NOT set night_run_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-user-explicit-local-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });

  it("lib does NOT set go_no_go: \"GO\"", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-user-explicit-local-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-user-explicit-local-invoker.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  it("lib does NOT call ipcMain / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-user-explicit-local-invoker.ts",
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
        "src/shared/lib/hcc-user-explicit-local-invoker.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});
