import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateFinalControlledRealDispatch,
  HCC_FINAL_CONTROLLED_REAL_DISPATCH_SCHEMA_VERSION,
  type HCCFinalControlledRealDispatchInput,
  type HCCFinalControlledRealDispatchAdapter,
} from "../../src/shared/lib/hcc-final-controlled-real-dispatch";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";
import { evaluateControlledRealRunnerCandidate } from "../../src/shared/lib/hcc-controlled-real-runner";
import {
  planAuditActualWrite,
  executeAuditActualWrite,
  type HCCAuditWriteDeps,
} from "../../src/shared/lib/hcc-audit-actual-write";
import { planRollbackActualRecovery } from "../../src/shared/lib/hcc-rollback-actual-recovery";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = "2026-06-14T12:00:00.000Z";
const ISSUED = "2026-06-14T11:00:00.000Z";
const EXPIRES = "2026-06-14T13:00:00.000Z";
const HASH = "sha256:abc123";

function makeAuthorization() {
  return evaluateRealExecutionAuthorization(
    {
      task_id: "PLAN-FINAL-001",
      source_plan_ref: "plan:2026-06:task-final-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-final-001",
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
    task_id: "PLAN-FINAL-001",
    source_plan_ref: "plan:2026-06:task-final-001",
    requested_by_user: "u-requester",
    authorization_result: authorization,
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-final-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-final-001",
  });
}

function makeAuditPlan() {
  return planAuditActualWrite({
    task_id: "PLAN-FINAL-001",
    source_plan_ref: "plan:2026-06:task-final-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-final-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-final-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-final-001",
    target_path: "docs/audit/hcc/2026-06-14/PLAN-FINAL-001.md",
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
}

async function makeAuditWritten() {
  const plan = makeAuditPlan();
  const deps: HCCAuditWriteDeps = {
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  };
  return executeAuditActualWrite(
    {
      task_id: "PLAN-FINAL-001",
      source_plan_ref: "plan:2026-06:task-final-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-final-001",
      runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
      dry_run_artifact_hash: HASH,
      planned_action_id: "act-final-001",
      planned_action_kind: "file_write",
      whitelist_action_id: "wl-final-001",
      target_path: "docs/audit/hcc/2026-06-14/PLAN-FINAL-001.md",
      audit_payload: {
        would_execute: false as const,
        real_execution_ready: false as const,
        unattended_ready: false as const,
        any_command_executed: false as const,
        executed_commands: [] as const,
        go_no_go: "NO-GO" as const,
        body: "audit body",
      },
    },
    deps,
  );
}

function makeRollbackPlan() {
  return planRollbackActualRecovery({
    task_id: "PLAN-FINAL-001",
    source_plan_ref: "plan:2026-06:task-final-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-final-001",
    runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    planned_action_id: "act-final-001",
    planned_action_kind: "file_write",
    target_path: "src/shared/lib/notes/final-001.md",
    before_hash: "sha256:before",
    after_hash: "sha256:after",
    recovery_strategy: "restore_file_from_snapshot",
  });
}

function makeMockAdapter(): HCCFinalControlledRealDispatchAdapter & {
  dispatch: ReturnType<typeof vi.fn>;
  supportsKind: ReturnType<typeof vi.fn>;
} {
  return {
    supportsKind: vi.fn((k: string) =>
      k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-001" })),
  };
}

function makeAuditWrittenPlan() {
  // Synthetic AUDIT-ACTUAL-WRITTEN plan. Real executeAuditActualWrite
  // requires async + injected writer; for unit tests we just need
  // a plan-like shape with the right verdict so identity / verdict
  // guards fire correctly. The `executeAuditActualWrite` path is
  // covered in its own dedicated test file.
  const plan = makeAuditPlan();
  return { ...plan, verdict: "AUDIT-ACTUAL-WRITTEN" as const, written: true };
}

function makeInput(
  overrides: Partial<HCCFinalControlledRealDispatchInput> = {},
): HCCFinalControlledRealDispatchInput {
  const authorization = makeAuthorization();
  const runner_result = makeRunner(authorization);
  return {
    task_id: "PLAN-FINAL-001",
    source_plan_ref: "plan:2026-06:task-final-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-final-001",
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-final-001",
    planned_action_kind: "file_write",
    whitelist_action_id: "wl-final-001",
    explicit_user_triggered: true,
    target_path: "src/shared/lib/notes/final-001.md",
    authorization_result: authorization,
    runner_result,
    audit_result: makeAuditWrittenPlan(),
    rollback_plan: makeRollbackPlan(),
    dispatch_adapter: makeMockAdapter(),
    ...overrides,
  };
}

describe("HCC final controlled real-dispatch: valid candidate", () => {
  it("all gates pass -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE", async () => {
    const r = await evaluateFinalControlledRealDispatch(makeInput());
    expect(r.verdict).toBe("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });

  it("candidate flips real_execution_ready / would_execute / any_command_executed to true", async () => {
    const r = await evaluateFinalControlledRealDispatch(makeInput());
    expect(r.real_execution_ready).toBe(true);
    expect(r.would_execute).toBe(true);
    expect(r.any_command_executed).toBe(true);
  });

  it("candidate keeps unattended_ready / night_run_ready / go_no_go literal-false / NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(makeInput());
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("candidate keeps auto_executor_started literal-false (user-explicit, not boot)", async () => {
    const r = await evaluateFinalControlledRealDispatch(makeInput());
    expect(r.auto_executor_started).toBe(false);
  });

  it("candidate records controlled_command_id and executed_commands", async () => {
    const r = await evaluateFinalControlledRealDispatch(makeInput());
    expect(r.controlled_command_id).toBe("cc-001");
    expect(r.executed_commands).toEqual(["cc-001"]);
    expect(r.subprocess_count).toBe(1);
  });

  it("candidate calls adapter.dispatch exactly once", async () => {
    const adapter = makeMockAdapter();
    await evaluateFinalControlledRealDispatch(
      makeInput({ dispatch_adapter: adapter }),
    );
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
    expect(adapter.dispatch).toHaveBeenCalledWith(
      "act-final-001",
      "file_write",
      "src/shared/lib/notes/final-001.md",
    );
  });
});

describe("HCC final controlled real-dispatch: trigger guards", () => {
  it("explicit_user_triggered=false -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ explicit_user_triggered: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/explicit_user_triggered|user-explicit/);
  });

  it("explicit_user_triggered missing (cast undefined) -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ explicit_user_triggered: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC final controlled real-dispatch: adapter guards", () => {
  it("missing dispatch_adapter -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ dispatch_adapter: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch_adapter");
  });

  it("adapter does not support kind -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    (adapter.supportsKind as ReturnType<typeof vi.fn>).mockReturnValue(false);
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ dispatch_adapter: adapter }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("does not support");
  });

  it("adapter.dispatch throwing -> error propagates", async () => {
    const adapter = makeMockAdapter();
    (adapter.dispatch as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("dispatch boom");
    });
    await expect(
      evaluateFinalControlledRealDispatch(
        makeInput({ dispatch_adapter: adapter }),
      ),
    ).rejects.toThrow("dispatch boom");
  });
});

describe("HCC final controlled real-dispatch: prior verdict guards", () => {
  it("authorization verdict missing (cast) -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        authorization_result: { ...makeAuthorization(), verdict: "NO-GO" as never },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("REAL-EXECUTION-AUTH-CANDIDATE");
  });

  it("runner verdict missing (cast) -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        runner_result: { ...makeInput().runner_result, verdict: "NO-GO" as never },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("CONTROLLED-REAL-RUNNER-CANDIDATE");
  });

  it("audit verdict not WRITTEN -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        audit_result: { ...makeAuditPlan(), verdict: "AUDIT-ACTUAL-WRITE-CANDIDATE" as never },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("AUDIT-ACTUAL-WRITTEN");
  });

  it("rollback verdict missing (cast) -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        rollback_plan: { ...makeRollbackPlan(), verdict: "NO-GO" as never },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("ROLLBACK-ACTUAL-RECOVERY-CANDIDATE");
  });
});

describe("HCC final controlled real-dispatch: identity guards", () => {
  it("task_id mismatch in authorization -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        authorization_result: {
          ...makeAuthorization(),
          task_id: "OTHER",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("task_id");
  });

  it("dry_run_artifact_hash mismatch -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        authorization_result: {
          ...makeAuthorization(),
          dry_run_artifact_hash: "sha256:different",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dry_run_artifact_hash");
  });

  it("whitelist_action_id mismatch in runner -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        runner_result: {
          ...makeInput().runner_result,
          whitelist_action_id: "wl-other",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("whitelist_action_id");
  });

  it("planned_action_id mismatch in rollback -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({
        rollback_plan: {
          ...makeRollbackPlan(),
          planned_action_id: "act-other",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("planned_action_id");
  });
});

describe("HCC final controlled real-dispatch: input guards", () => {
  it("missing task_id -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ task_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("missing authorization_id -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ authorization_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("unsupported planned_action_kind -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ planned_action_kind: "remote_exec" as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("planned_action_kind");
  });

  it("missing whitelist_action_id -> NO-GO", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ whitelist_action_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC final controlled real-dispatch: NO-GO preserves user-explicit boundary", () => {
  it("any NO-GO keeps unattended_ready / night_run_ready / go_no_go / auto_executor_started literal", async () => {
    const r = await evaluateFinalControlledRealDispatch(
      makeInput({ task_id: "" }),
    );
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.controlled_command_id).toBe("");
  });
});

describe("HCC final controlled real-dispatch: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_FINAL_CONTROLLED_REAL_DISPATCH_SCHEMA_VERSION).toBe("1.0.0");
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
        "src/shared/lib/hcc-final-controlled-real-dispatch.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
  });

  it("lib does NOT set night_run_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-final-controlled-real-dispatch.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });

  it("lib does NOT set go_no_go: \"GO\"", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-final-controlled-real-dispatch.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-final-controlled-real-dispatch.ts",
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
        "src/shared/lib/hcc-final-controlled-real-dispatch.ts",
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
        "src/shared/lib/hcc-final-controlled-real-dispatch.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});
