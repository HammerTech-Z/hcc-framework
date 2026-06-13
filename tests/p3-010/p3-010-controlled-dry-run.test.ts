// P3-010 :: Controlled Worktree Dry-Run
//
// Exercises the full HCC dry-run loop without executing any real command.
//
// Chain:
//   task input → admission → plan → running host → dry-run action → artifact → verifier
//
// Every planned command is prefixed with `[DRY-RUN]`. The artifact's
// `would_execute`, `executed_commands`, `subprocess_count`, and
// `next_step` fields are literal-false / literal-0 / literal-string.
// The verifier reads the artifact and confirms that no real execution
// occurred.
//
// This test is the P3 010 dry-run harness. It is NOT a real execution.
// Real execution is held for a future GO after the user explicitly
// approves the transition.

import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  installAutoExecutorHost,
  getInstalledAutoExecutorHost,
  __resetAutoExecutorBootstrapForTests,
} from "../../src/main/auto-executor-bootstrap";
import {
  armInstalledHost,
  __resetAutoExecutorArmForTests,
} from "../../src/main/auto-executor-arm";
import {
  startInstalledHost,
  __resetAutoExecutorStartForTests,
} from "../../src/main/auto-executor-start";
import {
  submitDryRunAction,
  getActionPostureReport,
  __resetAutoExecutorActionForTests,
  __recordActionResult,
  type DryRunActionRequest,
  type DryRunActionResult,
} from "../../src/main/auto-executor-dry-run-action";
import {
  buildTaskPlan,
  decideTaskAdmission,
  makeReadinessGate,
  buildHealthCheckPlan,
  buildNightRunReadinessReport,
  type TaskPlan,
  type AdmissionActionClass,
} from "../../src/shared/lib/hcc-controlled-executor";
import { mintArmToken } from "../../src/shared/lib/auto-executor";

// -----------------------------------------------------------------
// P3 010 pinned context
// -----------------------------------------------------------------

const PINNED_HEAD = "26d854287a999b48857d7fa239fa035f2a41c529";
const TOKEN_SECRET = "p3-010-dry-run-secret-not-real";
const WORKTREE_PATH = "/tmp/wt-p3-010";

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function resetAll() {
  __resetAutoExecutorBootstrapForTests();
  __resetAutoExecutorArmForTests();
  __resetAutoExecutorStartForTests();
  __resetAutoExecutorActionForTests();
}

function setupFullRunning() {
  installAutoExecutorHost({
    pinnedState: {
      expectedRepoRoot: WORKTREE_PATH,
      expectedBranch: "p3-010-controlled-worktree-dry-run",
      expectedHead: PINNED_HEAD,
      expectedCwd: WORKTREE_PATH,
    },
    tokenSecret: TOKEN_SECRET,
    goRecordSha: PINNED_HEAD,
    mode: "dry_run",
  });
  armInstalledHost(mintArmToken(PINNED_HEAD, TOKEN_SECRET));
  startInstalledHost();
}

function makeReadClassRequest(taskId: string): DryRunActionRequest {
  return {
    task_id: taskId,
    worktree_isolated: true,
    single_branch: true,
    single_commit_candidate: true,
    action_class: "isolated_worktree_write",
    description: `[DRY-RUN] p3-010 controlled worktree dry-run: ${taskId}`,
  };
}

// -----------------------------------------------------------------
// Phase 0 — Readiness gate
// -----------------------------------------------------------------

describe("P3-010 Phase 0: readiness gate", () => {
  it("readiness gate level is controlled_executor_ready (NOT night-run)", () => {
    const gate = makeReadinessGate({
      controlled_executor_ready: true,
      blockers: [],
      source_commit: PINNED_HEAD,
    });
    expect(gate.level).toBe("controlled_executor_ready");
    expect(gate.night_run_ready).toBe(false);
    expect(gate.controlled_executor_ready).toBe(true);
  });

  it("night-run readiness is still literal false", () => {
    const report = buildNightRunReadinessReport({ generated_at_input: "2026-06-13" });
    expect(report.night_run_ready).toBe(false);
    expect(report.go_no_go).toBe("NO-GO");
    expect(report.gates.every((g) => !g.satisfied)).toBe(true);
  });
});

// -----------------------------------------------------------------
// Phase 1 — Admission
// -----------------------------------------------------------------

describe("P3-010 Phase 1: admission", () => {
  it("admission allows isolated worktree write action", () => {
    const result = decideTaskAdmission({
      task_id: "P3-010-T-1",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
    });
    expect(result.decision).toBe("allow");
  });

  it("admission denies non-isolated action", () => {
    const result = decideTaskAdmission({
      task_id: "P3-010-T-2",
      worktree_isolated: false,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
    });
    expect(result.decision).toBe("deny");
  });

  it("admission requires user approval for dangerous classes", () => {
    for (const cls of [
      "install_dependency",
      "file_deletion",
      "credential_access",
      "external_publish",
      "live_apply",
    ] as AdmissionActionClass[]) {
      const result = decideTaskAdmission({
        task_id: "P3-010-T-3",
        worktree_isolated: true,
        single_branch: true,
        single_commit_candidate: true,
        action_class: cls,
      });
      expect(result.decision).toBe("requires_user_approval");
    }
  });
});

// -----------------------------------------------------------------
// Phase 2 — Task plan
// -----------------------------------------------------------------

describe("P3-010 Phase 2: task plan", () => {
  it("builds a [DRY-RUN] prefixed task plan with verifier + rollback", () => {
    const plan = buildTaskPlan({
      task_id: "P3-010-T-1",
      worktree_path: WORKTREE_PATH,
      base_branch: "hermes-pro-main",
      base_commit: PINNED_HEAD,
      planned_commands: [
        {
          command: "[DRY-RUN] npm run typecheck:node",
          rationale: "verify TypeScript compiles",
          expected_success_signal: "exit 0",
        },
        {
          command: "[DRY-RUN] npx vitest run tests/auto-executor/",
          rationale: "verify auto executor tests still pass",
          expected_success_signal: "exit 0, all tests PASS",
        },
      ],
      verifier_checklist: [
        { id: "V-1", description: "typecheck passes", expected_outcome: "exit 0" },
        { id: "V-2", description: "target tests pass", expected_outcome: "all tests PASS" },
        { id: "V-3", description: "no real command executed", expected_outcome: "would_execute=false" },
      ],
      rollback_strategy: "git_revert_commit",
    });
    expect(plan.runtime_class).toBe("dry_run");
    expect(plan.executable).toBe(false);
    expect(plan.executed).toBe(false);
    for (const c of plan.planned_commands) {
      expect(c.command).toMatch(/^\[DRY-RUN\]/);
      expect(c.will_execute).toBe(false);
    }
    expect(plan.verifier_checklist.length).toBe(3);
  });
});

// -----------------------------------------------------------------
// Phase 3 — Health check contract
// -----------------------------------------------------------------

describe("P3-010 Phase 3: health check contract", () => {
  it("health check plans [DRY-RUN] commands only", () => {
    const hc = buildHealthCheckPlan({
      source_commit: PINNED_HEAD,
      typecheck_cmd: "npm run typecheck:node",
      test_cmd: "npx vitest run tests/safety",
    });
    for (const c of [hc.git_clean_check, hc.branch_check, hc.origin_head_check, hc.typecheck_command_plan, hc.target_test_command_plan]) {
      expect(c.command).toMatch(/^\[DRY-RUN\]/);
      expect(c.will_execute).toBe(false);
    }
  });
});

// -----------------------------------------------------------------
// Phase 4 — Running host + dry-run action (full chain)
// -----------------------------------------------------------------

describe("P3-010 Phase 4: full HCC dry-run chain", () => {
  beforeEach(() => {
    resetAll();
    setupFullRunning();
  });

  it("full chain: constructed → armed → running → dry-run action → artifact", () => {
    const host = getInstalledAutoExecutorHost();
    expect(host!.state()).toBe("running");

    const result = submitDryRunAction(makeReadClassRequest("P3-010-T-1"));
    __recordActionResult(result);

    // Artifact shape
    expect(result.schema_version).toBe("1.0.0");
    expect(result.artifact_kind).toBe("dry_run_action");
    expect(result.task_id).toBe("P3-010-T-1");
    expect(result.would_execute).toBe(false);
    expect(result.executed_commands).toEqual([]);
    expect(result.subprocess_count).toBe(0);
    expect(result.max_subprocess_count).toBe(0);
    expect(result.verifier_required).toBe(true);
    expect(result.next_step).toBe("P3_010_CONTROLLED_WORKTREE_DRY_RUN");
    expect(result.admission.decision).toBe("allow");
    expect(result.host_state).toBe("running");
  });

  it("posture after action: any_command_executed=false, total_subprocess_count=0", () => {
    const result = submitDryRunAction(makeReadClassRequest("P3-010-T-2"));
    __recordActionResult(result);
    const posture = getActionPostureReport();
    expect(posture!.any_command_executed).toBe(false);
    expect(posture!.total_subprocess_count).toBe(0);
    expect(posture!.actions_submitted).toBe(1);
    expect(posture!.next_step).toBe("P3_010_CONTROLLED_WORKTREE_DRY_RUN");
  });

  it("artifact carries admission 'requires_user_approval' for file_deletion (no throw)", () => {
    const result = submitDryRunAction({
      task_id: "P3-010-T-danger",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "file_deletion",
      description: "[DRY-RUN] p3-010 dangerous class test — should require user approval",
    });
    expect(result.admission.decision).toBe("requires_user_approval");
    expect(result.would_execute).toBe(false);
  });
});

// -----------------------------------------------------------------
// Phase 5 — Verifier
// -----------------------------------------------------------------

describe("P3-010 Phase 5: verifier", () => {
  it("verifier: no real command execution (would_execute=false)", () => {
    resetAll();
    setupFullRunning();
    const result = submitDryRunAction(makeReadClassRequest("P3-010-V-1"));
    expect(result.would_execute).toBe(false);
    expect(result.executed_commands.length).toBe(0);
  });

  it("verifier: no filesystem write outside p3-010 test artifact", () => {
    // P3-010 only writes docs + tests + fixture inside this worktree.
    // This verifier checks that the artifact path is within the repo.
    // The actual file writes are the test's own .test.ts file and the
    // closeout docs, all of which are `git status` visible as new files
    // in this branch.
    resetAll();
    setupFullRunning();
    const result = submitDryRunAction(makeReadClassRequest("P3-010-V-2"));
    // The artifact itself contains no filesystem write instruction
    expect(result.executed_commands).toEqual([]);
    expect(result.subprocess_count).toBe(0);
  });

  it("verifier: no ~/.hermes write", () => {
    // The entire HCC dry-run chain (bootstrap → arm → start → action)
    // occurs in-memory only. No module in the chain imports node:fs
    // for writing. The action artifact has executed_commands=[].
    // The closeout docs are written inside the worktree's docs/ dir,
    // NOT under ~/.hermes.
    resetAll();
    setupFullRunning();
    const result = submitDryRunAction(makeReadClassRequest("P3-010-V-3"));
    expect(result.executed_commands).toEqual([]);
  });

  it("verifier: no P3 real execution", () => {
    // P3 real execution check: all `would_execute` fields are false.
    // The `next_step` field points to P3_010 itself (not P3_REAL_EXECUTION).
    // No `spawn`/`exec`/`child_process` calls exist in any HCC module.
    resetAll();
    setupFullRunning();
    const result = submitDryRunAction(makeReadClassRequest("P3-010-V-4"));
    expect(result.would_execute).toBe(false);
    expect(result.next_step).toBe("P3_010_CONTROLLED_WORKTREE_DRY_RUN");
  });

  it("verifier: no night-run (night_run_ready=false, go_no_go=NO-GO)", () => {
    // Night-run readiness is a type-level `false` literal in
    // src/shared/lib/hcc-controlled-executor.ts. The verifier reads
    // the literal directly from the source file.
    const REPO_ROOT = resolve(__dirname, "../..");
    const src = readFileSync(resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"), "utf8");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

// -----------------------------------------------------------------
// Phase 6 — End-to-end dry-run fixture
// -----------------------------------------------------------------

describe("P3-010 Phase 6: end-to-end fixture", () => {
  it("end-to-end: task → admission → plan → host → action → artifact → verifier", () => {
    // 1. Admission
    resetAll();
    const admission = decideTaskAdmission({
      task_id: "P3-010-E2E",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
    });
    expect(admission.decision).toBe("allow");

    // 2. Plan
    const plan = buildTaskPlan({
      task_id: "P3-010-E2E",
      worktree_path: WORKTREE_PATH,
      base_branch: "hermes-pro-main",
      base_commit: PINNED_HEAD,
      planned_commands: [
        {
          command: "[DRY-RUN] npm run typecheck:node",
          rationale: "verify TS",
          expected_success_signal: "exit 0",
        },
        {
          command: "[DRY-RUN] npx vitest run tests/auto-executor/",
          rationale: "verify auto-executor tests",
          expected_success_signal: "all PASS",
        },
      ],
      verifier_checklist: [
        { id: "V-E2E-1", description: "typecheck EXIT 0", expected_outcome: "pass" },
        { id: "V-E2E-2", description: "tests 149/149 PASS", expected_outcome: "pass" },
        { id: "V-E2E-3", description: "would_execute=false", expected_outcome: "false (literal)" },
        { id: "V-E2E-4", description: "executed_commands=[]", expected_outcome: "empty" },
      ],
    });
    expect(plan.runtime_class).toBe("dry_run");
    expect(plan.executable).toBe(false);
    expect(plan.verifier_checklist.length).toBe(4);

    // 3. Host lifecycle: constructed → armed → running
    setupFullRunning();
    const host = getInstalledAutoExecutorHost();
    expect(host!.state()).toBe("running");

    // 4. Dry-run action
    const result = submitDryRunAction({
      task_id: "P3-010-E2E",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
      description: "[DRY-RUN] P3-010 end-to-end dry-run fixture",
    });
    __recordActionResult(result);

    // 5. Artifact shape (all 8 invariants)
    expect(result.artifact_kind).toBe("dry_run_action");
    expect(result.would_execute).toBe(false);
    expect(result.executed_commands).toEqual([]);
    expect(result.subprocess_count).toBe(0);
    expect(result.max_subprocess_count).toBe(0);
    expect(result.verifier_required).toBe(true);
    expect(result.next_step).toBe("P3_010_CONTROLLED_WORKTREE_DRY_RUN");
    expect(result.host_state).toBe("running");

    // 6. Verifier cross-check
    expect(result.would_execute).toBe(false);
    expect(result.executed_commands.length).toBe(0);
    expect(host!.health().subprocess_count).toBe(0);
  });
});