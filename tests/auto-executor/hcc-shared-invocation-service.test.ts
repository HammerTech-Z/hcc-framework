import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  checkSharedInvocationFixture,
  getSharedInvocationServiceMetadata,
  HCC_SHARED_INVOCATION_SERVICE_SCHEMA_VERSION,
  invokeSharedControlledRealDispatch,
  type HCCSharedInvocationFixture,
} from "../../src/shared/lib/hcc-shared-invocation-service";
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
      task_id: "PLAN-SVC-001",
      source_plan_ref: "plan:2026-06:task-svc-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-svc-001",
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
    task_id: "PLAN-SVC-001",
    source_plan_ref: "plan:2026-06:task-svc-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-svc-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-svc-001",
  });
}

function makeAuditPlan() {
  return {
    ...planAuditActualWrite({
      task_id: "PLAN-SVC-001",
      source_plan_ref: "plan:2026-06:task-svc-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-svc-001",
      runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-svc-001",
      planned_action_kind: "file_write",
      whitelist_action_id: "wl-svc-001",
      target_path: "docs/audit/hcc/2026-06-14/PLAN-SVC-001.md",
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
    task_id: "PLAN-SVC-001",
    source_plan_ref: "plan:2026-06:task-svc-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-svc-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-svc-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/svc-001.md",
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
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-svc-001" })),
  };
}

function makeFixture(
  overrides: Partial<HCCSharedInvocationFixture> = {},
): HCCSharedInvocationFixture {
  const authorization = makeAuthorization();
  return {
    task_id: "PLAN-SVC-001",
    source_plan_ref: "plan:2026-06:task-svc-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-svc-001",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-svc-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-svc-001",
    target_path: "src/shared/lib/notes/svc-001.md",
    explicit_user_trigger_token: "user-token-svc-001",
    dispatch_adapter: makeMockAdapter(),
    authorization_result: authorization,
    runner_result: makeRunner(authorization),
    audit_result: makeAuditPlan(),
    rollback_plan: makeRollbackPlan(),
    ...overrides,
  };
}

describe("HCC shared invocation service: metadata", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_SHARED_INVOCATION_SERVICE_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("service metadata is the shared service with no fallback / default / implicit", () => {
    const m = getSharedInvocationServiceMetadata();
    expect(m.service).toBe("hcc-shared-invocation-service");
    expect(m.protocol).toBe("user-explicit-fixture");
    expect(m.fallback).toBe(false);
    expect(m.default_execution).toBe(false);
    expect(m.implicit_caller).toBe(false);
  });
});

describe("HCC shared invocation service: checkSharedInvocationFixture", () => {
  it("valid fixture -> null", () => {
    expect(checkSharedInvocationFixture(makeFixture())).toBeNull();
  });

  it("missing explicit_user_trigger_token -> reason", () => {
    const r = checkSharedInvocationFixture(
      makeFixture({ explicit_user_trigger_token: "" }),
    );
    expect(r).toContain("explicit_user_trigger_token");
  });

  it("missing dispatch_adapter -> reason", () => {
    const r = checkSharedInvocationFixture(
      makeFixture({ dispatch_adapter: undefined as never }),
    );
    expect(r).toContain("dispatch_adapter");
  });

  it("unsupported planned_action_kind -> reason", () => {
    const r = checkSharedInvocationFixture(
      makeFixture({ planned_action_kind: "remote_exec" as never }),
    );
    expect(r).toContain("planned_action_kind");
  });
});

describe("HCC shared invocation service: invokeSharedControlledRealDispatch", () => {
  it("valid fixture -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const r = await invokeSharedControlledRealDispatch(makeFixture());
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });

  it("candidate flips real_execution_ready / would_execute / any_command_executed", async () => {
    const r = await invokeSharedControlledRealDispatch(makeFixture());
    expect(r.real_execution_ready).toBe(true);
    expect(r.would_execute).toBe(true);
    expect(r.any_command_executed).toBe(true);
  });

  it("candidate preserves user-explicit boundary", async () => {
    const r = await invokeSharedControlledRealDispatch(makeFixture());
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
  });

  it("candidate calls dispatch_adapter.dispatch exactly once", async () => {
    const adapter = makeMockAdapter();
    await invokeSharedControlledRealDispatch(
      makeFixture({ dispatch_adapter: adapter }),
    );
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
    expect(adapter.dispatch).toHaveBeenCalledWith(
      "act-svc-001",
      "file_write",
      "src/shared/lib/notes/svc-001.md",
    );
  });

  it("missing trigger token -> NO-GO, adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await invokeSharedControlledRealDispatch(
      makeFixture({
        explicit_user_trigger_token: "",
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing dispatch_adapter -> NO-GO", async () => {
    const r = await invokeSharedControlledRealDispatch(
      makeFixture({ dispatch_adapter: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch_adapter");
  });

  it("NO-GO propagates when final dispatch rejects (identity mismatch)", async () => {
    const r = await invokeSharedControlledRealDispatch(
      makeFixture({ task_id: "PLAN-OTHER" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC shared invocation service: NO-GO preserves user-explicit boundary", () => {
  it("invoker-local NO-GO keeps unattended / night / go_no_go literal", async () => {
    const r = await invokeSharedControlledRealDispatch(
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

describe("HCC shared invocation service: schema + static guard", () => {
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
        "src/shared/lib/hcc-shared-invocation-service.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
    expect(src).not.toMatch(/night_run_ready:\s*true/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-shared-invocation-service.ts",
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
        "src/shared/lib/hcc-shared-invocation-service.ts",
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
        "src/shared/lib/hcc-shared-invocation-service.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT write ~/.hermes/**", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-shared-invocation-service.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/writeFile/);
  });
});
