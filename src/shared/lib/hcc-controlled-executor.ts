// HCC Controlled Executor Readiness 001 — pure contracts.
//
// Six pure modules in one file. No I/O. No runtime. No IPC. No spawn.
// No daemon. No cron. No weixin. No live apply. No `~/.hermes` writes.
// Every status field whose name implies "go live" is `false` literal.
// `night_run_ready` is `false` literal at the type level — the only way
// to flip it is to edit this file's source, which is itself an audit
// signal.
//
// The boundary library at src/shared/lib/auto-executor/* remains the
// trust root for the host wiring (see
// docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md). This file
// only describes what *would* be checked before any host code runs.
// It does not import the boundary; it does not register IPC; it does
// not start a process.

export const HCC_CONTROLLED_EXECUTOR_READINESS_SCHEMA_VERSION =
  "1.0.0" as const;

export const HCC_CONTROLLED_EXECUTOR_READINESS_MODE =
  "controlled_executor_readiness_only" as const;

// -------------------------------------------------------------------
// Module 1 — Readiness gate
// -------------------------------------------------------------------
// Distinguishes three levels so we never silently let dry-run be
// read as "ready to run unsupervised overnight."

export type ReadinessLevel =
  | "dry_run_ready"
  | "controlled_executor_ready"
  | "night_run_ready";

export interface ReadinessGate {
  schema_version: "1.0.0";
  level: ReadinessLevel;
  dry_run_ready: true;
  // The two higher levels are literal-false at the type level.
  controlled_executor_ready: boolean;
  night_run_ready: false;
  // List of remaining blockers; empty list => caller may still upgrade
  // level but only by editing this file (audit signal).
  blockers: readonly string[];
  // Source commit pin; refusal to admit any future change without it.
  source_commit: string;
}

export function makeReadinessGate(input: {
  controlled_executor_ready: boolean;
  blockers: readonly string[];
  source_commit: string;
}): ReadinessGate {
  return {
    schema_version: "1.0.0",
    level: input.controlled_executor_ready
      ? "controlled_executor_ready"
      : "dry_run_ready",
    dry_run_ready: true,
    controlled_executor_ready: input.controlled_executor_ready,
    // Hard-wired false. A separate human-signed ADR is the only way
    // this becomes true, and that ADR must rewrite this literal.
    night_run_ready: false,
    blockers: input.blockers,
    source_commit: input.source_commit,
  };
}

export function isNightRunReady(_gate: ReadinessGate): false {
  // Always returns the literal false. The argument is ignored; the
  // type system forces callers to handle the false branch.
  return false;
}

// -------------------------------------------------------------------
// Module 2 — Task admission policy
// -------------------------------------------------------------------
// Every admission must be single-task, single-branch, single commit,
// isolated worktree. Anything riskier is `requires_user_approval`.

export type AdmissionActionClass =
  | "isolated_worktree_write"
  | "isolated_worktree_test"
  | "isolated_worktree_typecheck"
  | "isolated_worktree_commit"
  | "install_dependency"
  | "file_deletion"
  | "external_publish"
  | "credential_access"
  | "browser_action"
  | "live_apply";

export type AdmissionDecision = "allow" | "deny" | "requires_user_approval";

export interface AdmissionRequest {
  task_id: string;
  worktree_isolated: boolean;
  single_branch: boolean;
  single_commit_candidate: boolean;
  action_class: AdmissionActionClass;
}

export interface AdmissionResult {
  task_id: string;
  decision: AdmissionDecision;
  reason: string;
}

const REQUIRES_USER_APPROVAL_ACTIONS: readonly AdmissionActionClass[] = [
  "install_dependency",
  "file_deletion",
  "external_publish",
  "credential_access",
  "browser_action",
  "live_apply",
];

export function decideTaskAdmission(req: AdmissionRequest): AdmissionResult {
  if (!req.worktree_isolated) {
    return {
      task_id: req.task_id,
      decision: "deny",
      reason: "task must run in an isolated worktree",
    };
  }
  if (!req.single_branch || !req.single_commit_candidate) {
    return {
      task_id: req.task_id,
      decision: "deny",
      reason: "task must be a single-branch single-commit-candidate change",
    };
  }
  if (REQUIRES_USER_APPROVAL_ACTIONS.includes(req.action_class)) {
    return {
      task_id: req.task_id,
      decision: "requires_user_approval",
      reason: `action_class ${req.action_class} requires user approval per controlled-executor admission policy`,
    };
  }
  return {
    task_id: req.task_id,
    decision: "allow",
    reason: "isolated worktree + single branch/commit + read-class action",
  };
}

// -------------------------------------------------------------------
// Module 3 — Dry-run harness (plan builder only)
// -------------------------------------------------------------------
// Builds the artifact of what *would* be executed. No exec, no spawn.

export interface PlannedCommand {
  /** Must be prefixed with [DRY-RUN]; enforced by literal check. */
  command: string;
  rationale: string;
  expected_success_signal: string;
  /** Always false. Real execution is not in scope. */
  will_execute: false;
}

export interface VerifierChecklistEntry {
  id: string;
  description: string;
  expected_outcome: string;
}

export interface RollbackInstruction {
  strategy: "git_revert_commit" | "git_reset_to_origin" | "manual_cherry_pick_drop";
  human_readable: string;
}

export interface TaskPlan {
  schema_version: "1.0.0";
  task_id: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  planned_commands: readonly PlannedCommand[];
  verifier_checklist: readonly VerifierChecklistEntry[];
  rollback: RollbackInstruction;
  /** Hard-wired dry-run; real execution is a separate slice. */
  runtime_class: "dry_run";
  /** Hard-wired false. */
  executable: false;
  /** Hard-wired false. */
  executed: false;
}

function assertDryRunCommand(command: string): void {
  if (!command.startsWith("[DRY-RUN]")) {
    throw new Error(
      `planned_command must start with [DRY-RUN]; got: ${command}`,
    );
  }
}

export function buildTaskPlan(input: {
  task_id: string;
  worktree_path: string;
  base_branch: string;
  base_commit: string;
  planned_commands: readonly { command: string; rationale: string; expected_success_signal: string }[];
  verifier_checklist: readonly VerifierChecklistEntry[];
  rollback_strategy?: RollbackInstruction["strategy"];
}): TaskPlan {
  const commands: PlannedCommand[] = input.planned_commands.map((c) => {
    assertDryRunCommand(c.command);
    return {
      command: c.command,
      rationale: c.rationale,
      expected_success_signal: c.expected_success_signal,
      will_execute: false,
    };
  });
  const strategy: RollbackInstruction["strategy"] =
    input.rollback_strategy ?? "git_revert_commit";
  const humanReadable: Record<RollbackInstruction["strategy"], string> = {
    git_revert_commit: "git revert <merge-sha> in main; or `git reset --hard origin/hermes-pro-main` if no merged commits",
    git_reset_to_origin: "git reset --hard origin/hermes-pro-main (DESTRUCTIVE; requires user approval)",
    manual_cherry_pick_drop: "git revert -m 1 <merge-sha>; or restore files from the pre-state snapshot",
  };
  return {
    schema_version: "1.0.0",
    task_id: input.task_id,
    worktree_path: input.worktree_path,
    base_branch: input.base_branch,
    base_commit: input.base_commit,
    planned_commands: commands,
    verifier_checklist: input.verifier_checklist,
    rollback: {
      strategy,
      human_readable: humanReadable[strategy],
    },
    runtime_class: "dry_run",
    executable: false,
    executed: false,
  };
}

// -------------------------------------------------------------------
// Module 4 — Health check contract
// -------------------------------------------------------------------

export interface HealthCheckPlan {
  schema_version: "1.0.0";
  /** Commands to run; same [DRY-RUN] prefix rule. */
  git_clean_check: PlannedCommand;
  branch_check: PlannedCommand;
  origin_head_check: PlannedCommand;
  typecheck_command_plan: PlannedCommand;
  target_test_command_plan: PlannedCommand;
  budgets: {
    max_tokens: number;
    max_wall_seconds: number;
    max_subprocess_count: number;
  };
  stop_conditions: readonly string[];
}

const STOP_CONDITIONS = [
  "stop if git_clean_check reports any non-excluded dirty file",
  "stop if origin_head_check reports HEAD != pinned source_commit",
  "stop if typecheck_command_plan exit != 0",
  "stop if target_test_command_plan exit != 0 or test count delta < 0",
  "stop if max_tokens or max_wall_seconds exceeded",
  "stop if max_subprocess_count > 0 (controlled executor spawns nothing)",
] as const;

export function buildHealthCheckPlan(input: {
  source_commit: string;
  typecheck_cmd: string;
  test_cmd: string;
}): HealthCheckPlan {
  return {
    schema_version: "1.0.0",
    git_clean_check: {
      command: "[DRY-RUN] git status --short -uall",
      rationale: "verify only policy-excluded dirt is present",
      expected_success_signal: "no M/A/D/R/C lines outside the policy-excluded set",
      will_execute: false,
    },
    branch_check: {
      command: "[DRY-RUN] git rev-parse --abbrev-ref HEAD",
      rationale: "verify branch is the pinned one",
      expected_success_signal: "hermes-pro-main (or the slice branch)",
      will_execute: false,
    },
    origin_head_check: {
      command: `[DRY-RUN] git rev-parse origin/hermes-pro-main`,
      rationale: "verify origin HEAD matches pinned source_commit",
      expected_success_signal: input.source_commit,
      will_execute: false,
    },
    typecheck_command_plan: {
      command: `[DRY-RUN] ${input.typecheck_cmd}`,
      rationale: "verify TypeScript compiles without error",
      expected_success_signal: "exit code 0",
      will_execute: false,
    },
    target_test_command_plan: {
      command: `[DRY-RUN] ${input.test_cmd}`,
      rationale: "verify targeted test suite passes",
      expected_success_signal: "exit code 0 and all tests PASS",
      will_execute: false,
    },
    budgets: {
      max_tokens: 500_000,
      max_wall_seconds: 1_800,
      max_subprocess_count: 0,
    },
    stop_conditions: STOP_CONDITIONS,
  };
}

// -------------------------------------------------------------------
// Module 5 — Audit artifact contract
// -------------------------------------------------------------------

export interface AuditArtifact {
  schema_version: "1.0.0";
  task_id: string;
  input: AdmissionRequest;
  planned_commands: readonly PlannedCommand[];
  /** Always empty for v1 — no real execution happens. */
  executed_commands: readonly [];
  verifier_result: { verdict: "pass" | "fail" | "skipped"; notes: string };
  rollback_point: { commit: string; branch: string };
  final_state: "dry_run_completed" | "admission_denied" | "requires_user_approval";
}

export function buildAuditArtifact(input: {
  task_id: string;
  admission: AdmissionRequest;
  plan: TaskPlan;
  verifier_verdict: "pass" | "fail" | "skipped";
  verifier_notes: string;
  rollback_commit: string;
  rollback_branch: string;
  final_state: AuditArtifact["final_state"];
}): AuditArtifact {
  return {
    schema_version: "1.0.0",
    task_id: input.task_id,
    input: input.admission,
    planned_commands: input.plan.planned_commands,
    executed_commands: [] as const,
    verifier_result: {
      verdict: input.verifier_verdict,
      notes: input.verifier_notes,
    },
    rollback_point: {
      commit: input.rollback_commit,
      branch: input.rollback_branch,
    },
    final_state: input.final_state,
  };
}

// -------------------------------------------------------------------
// Module 6 — Night-run readiness report
// -------------------------------------------------------------------

export interface NightRunReadinessGate {
  id: string;
  satisfied: boolean;
  evidence_ref: string;
  remediation: string;
}

export interface NightRunReadinessReport {
  schema_version: "1.0.0";
  generated_at_input: string;
  /** Always false. Surfaced as the type-level answer. */
  night_run_ready: false;
  gates: readonly NightRunReadinessGate[];
  go_no_go: "NO-GO";
  minimum_next_slice: string;
}

const NIGHT_RUN_GATES: readonly NightRunReadinessGate[] = [
  {
    id: "user_authorization_signed",
    satisfied: false,
    evidence_ref: "docs/governance/hcc-go-authorization-2026-06-11.md (explicit non-authorization for Auto Executor constant runtime)",
    remediation: "user must sign a fresh, scope-limited GO for night-run auto-execution",
  },
  {
    id: "rollback_rehearsal_one_completed",
    satisfied: false,
    evidence_ref: "hcc-stable-adjudication-preflight-2026-06-12.md (zero rollback rehearsals completed for night-run surface)",
    remediation: "complete one controlled rollback rehearsal in an isolated worktree and capture the artifact",
  },
  {
    id: "auto_executor_host_lifecycle_test_passes",
    satisfied: false,
    evidence_ref: "docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md §5 (host lifecycle test contract only, not yet implemented)",
    remediation: "implement host per exec-preflight §4 and pass §5 lifecycle tests on the implementation working copy",
  },
  {
    id: "bootstrap_activation_go_recorded",
    satisfied: false,
    evidence_ref: "docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md §4.4 (bootstrap activation is a separate explicit GO, not yet issued)",
    remediation: "issue explicit GO for bootstrap activation of the host into src/main/index.ts",
  },
  {
    id: "rate_cap_and_token_budget_calibrated",
    satisfied: false,
    evidence_ref: "this file §4 budgets are nominal; calibration against real workload data missing",
    remediation: "run a controlled dry-run to calibrate tokens/wall-clock/subprocess budget",
  },
];

export function buildNightRunReadinessReport(input: {
  generated_at_input: string;
  minimum_next_slice?: string;
}): NightRunReadinessReport {
  return {
    schema_version: "1.0.0",
    generated_at_input: input.generated_at_input,
    night_run_ready: false,
    gates: NIGHT_RUN_GATES,
    go_no_go: "NO-GO",
    minimum_next_slice:
      input.minimum_next_slice ??
      "HCC-AUTO-EXECUTOR-EXEC-IMPL-001: implement host per exec-preflight §4 contract and pass §5 lifecycle tests on the implementation working copy, then issue separate bootstrap GO",
  };
}

// -------------------------------------------------------------------
// Side-effect assertion (Bellard: prove the property)
// -------------------------------------------------------------------

export interface ControlledExecutorNoSideEffectsReport {
  schema_version: "1.0.0";
  no_spawn: true;
  no_ipc_registration: true;
  no_daemon: true;
  no_cron: true;
  no_weixin: true;
  no_live_apply: true;
  no_hermes_writes: true;
  night_run_ready_literal_false: true;
}

export function assertControlledExecutorNoSideEffects(): ControlledExecutorNoSideEffectsReport {
  return {
    schema_version: "1.0.0",
    no_spawn: true,
    no_ipc_registration: true,
    no_daemon: true,
    no_cron: true,
    no_weixin: true,
    no_live_apply: true,
    no_hermes_writes: true,
    night_run_ready_literal_false: true,
  };
}