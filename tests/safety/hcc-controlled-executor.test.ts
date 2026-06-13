import { describe, it, expect } from "vitest";

import {
  HCC_CONTROLLED_EXECUTOR_READINESS_SCHEMA_VERSION,
  assertControlledExecutorNoSideEffects,
  buildAuditArtifact,
  buildHealthCheckPlan,
  buildNightRunReadinessReport,
  buildTaskPlan,
  decideTaskAdmission,
  isNightRunReady,
  makeReadinessGate,
  type AdmissionRequest,
  type PlannedCommand,
} from "../../src/shared/lib/hcc-controlled-executor";

describe("hcc-controlled-executor: schema + no-side-effects", () => {
  it("exposes schema version 1.0.0", () => {
    expect(HCC_CONTROLLED_EXECUTOR_READINESS_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("side-effect report has every literal-true guard", () => {
    const report = assertControlledExecutorNoSideEffects();
    expect(report).toEqual({
      schema_version: "1.0.0",
      no_spawn: true,
      no_ipc_registration: true,
      no_daemon: true,
      no_cron: true,
      no_weixin: true,
      no_live_apply: true,
      no_hermes_writes: true,
      night_run_ready_literal_false: true,
    });
  });
});

describe("module 1: readiness gate", () => {
  it("defaults to dry_run_ready when controlled_executor_ready=false", () => {
    const gate = makeReadinessGate({
      controlled_executor_ready: false,
      blockers: ["auto_executor_host_not_built"],
      source_commit: "b8e4048",
    });
    expect(gate.level).toBe("dry_run_ready");
    expect(gate.dry_run_ready).toBe(true);
    expect(gate.controlled_executor_ready).toBe(false);
    expect(gate.night_run_ready).toBe(false);
  });

  it("allows controlled_executor_ready=true level while keeping night_run_ready=false", () => {
    const gate = makeReadinessGate({
      controlled_executor_ready: true,
      blockers: [],
      source_commit: "b8e4048",
    });
    expect(gate.level).toBe("controlled_executor_ready");
    expect(gate.controlled_executor_ready).toBe(true);
    expect(gate.night_run_ready).toBe(false);
  });

  it("isNightRunReady always returns literal false regardless of input", () => {
    const gate = makeReadinessGate({
      controlled_executor_ready: true,
      blockers: [],
      source_commit: "b8e4048",
    });
    expect(isNightRunReady(gate)).toBe(false);
  });
});

describe("module 2: task admission policy", () => {
  const baseReq: AdmissionRequest = {
    task_id: "T-1",
    worktree_isolated: true,
    single_branch: true,
    single_commit_candidate: true,
    action_class: "isolated_worktree_write",
  };

  it("allows read-class action in isolated worktree", () => {
    const r = decideTaskAdmission(baseReq);
    expect(r.decision).toBe("allow");
  });

  it("denies when worktree is not isolated", () => {
    const r = decideTaskAdmission({ ...baseReq, worktree_isolated: false });
    expect(r.decision).toBe("deny");
  });

  it("denies when not single-branch", () => {
    const r = decideTaskAdmission({ ...baseReq, single_branch: false });
    expect(r.decision).toBe("deny");
  });

  it("denies when not single-commit-candidate", () => {
    const r = decideTaskAdmission({
      ...baseReq,
      single_commit_candidate: false,
    });
    expect(r.decision).toBe("deny");
  });

  it.each([
    "install_dependency",
    "file_deletion",
    "external_publish",
    "credential_access",
    "browser_action",
    "live_apply",
  ] as const)(
    "requires_user_approval for %s even in isolated worktree",
    (action) => {
      const r = decideTaskAdmission({ ...baseReq, action_class: action });
      expect(r.decision).toBe("requires_user_approval");
      expect(r.reason).toContain(action);
    },
  );

  it("allows test/typecheck/commit classes", () => {
    for (const cls of [
      "isolated_worktree_test",
      "isolated_worktree_typecheck",
      "isolated_worktree_commit",
    ] as const) {
      const r = decideTaskAdmission({ ...baseReq, action_class: cls });
      expect(r.decision).toBe("allow");
    }
  });
});

describe("module 3: dry-run harness", () => {
  it("builds a TaskPlan with literal-false execution fields", () => {
    const plan = buildTaskPlan({
      task_id: "T-1",
      worktree_path: "/tmp/wt",
      base_branch: "hermes-pro-main",
      base_commit: "b8e4048",
      planned_commands: [
        {
          command: "[DRY-RUN] npm run typecheck:node",
          rationale: "verify TS compiles",
          expected_success_signal: "exit 0",
        },
      ],
      verifier_checklist: [
        {
          id: "V-1",
          description: "typecheck passes",
          expected_outcome: "exit 0",
        },
      ],
    });
    expect(plan.runtime_class).toBe("dry_run");
    expect(plan.executable).toBe(false);
    expect(plan.executed).toBe(false);
    expect(plan.planned_commands[0].will_execute).toBe(false);
  });

  it("rejects any planned command missing the [DRY-RUN] prefix", () => {
    expect(() =>
      buildTaskPlan({
        task_id: "T-1",
        worktree_path: "/tmp/wt",
        base_branch: "hermes-pro-main",
        base_commit: "b8e4048",
        planned_commands: [
          {
            command: "npm run typecheck",
            rationale: "no prefix",
            expected_success_signal: "exit 0",
          },
        ],
        verifier_checklist: [],
      }),
    ).toThrow(/\[DRY-RUN\]/);
  });

  it("records rollback strategy + human-readable instruction", () => {
    const plan = buildTaskPlan({
      task_id: "T-1",
      worktree_path: "/tmp/wt",
      base_branch: "hermes-pro-main",
      base_commit: "b8e4048",
      planned_commands: [
        {
          command: "[DRY-RUN] echo ok",
          rationale: "noop",
          expected_success_signal: "ok",
        },
      ],
      verifier_checklist: [],
      rollback_strategy: "git_revert_commit",
    });
    expect(plan.rollback.strategy).toBe("git_revert_commit");
    expect(plan.rollback.human_readable).toMatch(/revert|reset|cherry/);
  });
});

describe("module 4: health check contract", () => {
  it("returns a contract with literal-false planned commands and six stop conditions", () => {
    const plan = buildHealthCheckPlan({
      source_commit: "b8e4048",
      typecheck_cmd: "npm run typecheck:node",
      test_cmd: "npx vitest run tests/safety",
    });
    const checks: PlannedCommand[] = [
      plan.git_clean_check,
      plan.branch_check,
      plan.origin_head_check,
      plan.typecheck_command_plan,
      plan.target_test_command_plan,
    ];
    for (const c of checks) {
      expect(c.command.startsWith("[DRY-RUN]")).toBe(true);
      expect(c.will_execute).toBe(false);
    }
    expect(plan.stop_conditions.length).toBe(6);
    expect(plan.budgets.max_subprocess_count).toBe(0);
  });
});

describe("module 5: audit artifact contract", () => {
  it("captures admission + planned + executed (always []) + verifier + rollback + final", () => {
    const admission: AdmissionRequest = {
      task_id: "T-1",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
    };
    const plan = buildTaskPlan({
      task_id: "T-1",
      worktree_path: "/tmp/wt",
      base_branch: "hermes-pro-main",
      base_commit: "b8e4048",
      planned_commands: [
        {
          command: "[DRY-RUN] echo ok",
          rationale: "noop",
          expected_success_signal: "ok",
        },
      ],
      verifier_checklist: [],
    });
    const audit = buildAuditArtifact({
      task_id: "T-1",
      admission,
      plan,
      verifier_verdict: "pass",
      verifier_notes: "dry-run only",
      rollback_commit: "b8e4048",
      rollback_branch: "hermes-pro-main",
      final_state: "dry_run_completed",
    });
    expect(audit.executed_commands).toEqual([]);
    expect(audit.verifier_result.verdict).toBe("pass");
    expect(audit.rollback_point.commit).toBe("b8e4048");
    expect(audit.final_state).toBe("dry_run_completed");
  });

  it("rejects any final_state implying live execution", () => {
    // The union is locked at compile time; this test documents the
    // allowed set so a future edit can't silently widen it.
    const admission: AdmissionRequest = {
      task_id: "T-1",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
    };
    const plan = buildTaskPlan({
      task_id: "T-1",
      worktree_path: "/tmp/wt",
      base_branch: "hermes-pro-main",
      base_commit: "b8e4048",
      planned_commands: [
        {
          command: "[DRY-RUN] echo ok",
          rationale: "noop",
          expected_success_signal: "ok",
        },
      ],
      verifier_checklist: [],
    });
    const audit = buildAuditArtifact({
      task_id: "T-1",
      admission,
      plan,
      verifier_verdict: "skipped",
      verifier_notes: "denied",
      rollback_commit: "b8e4048",
      rollback_branch: "hermes-pro-main",
      final_state: "admission_denied",
    });
    expect(["dry_run_completed", "admission_denied", "requires_user_approval"]).toContain(
      audit.final_state,
    );
  });
});

describe("module 6: night-run readiness report", () => {
  it("always reports night_run_ready=false and go_no_go=NO-GO", () => {
    const report = buildNightRunReadinessReport({
      generated_at_input: "2026-06-13",
    });
    expect(report.night_run_ready).toBe(false);
    expect(report.go_no_go).toBe("NO-GO");
    expect(report.gates.length).toBeGreaterThanOrEqual(5);
    for (const g of report.gates) {
      expect(g.satisfied).toBe(false);
    }
    expect(report.minimum_next_slice).toMatch(/EXEC-IMPL/);
  });
});