// HCC Rollback Rehearsal — first version contract.
//
// Models a *rehearsal* of a rollback strategy. This is a contract only:
// no real git command is ever invoked. The rehearsal produces a
// proposed-cmd set (informational) and a verifier checklist; the
// artifact records `would_execute: false` and `executed_commands: []`.
//
// Per HCC governance:
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO (HCC origin `ec1e8fe`)
//   - `night_run_ready` is a type-level `false` literal
//   - Auto Executor 常驻 must NOT be armed implicitly
//
// Supported strategies:
//   - git_revert_commit       (proposal only; never invokes git)
//   - drop_commit             (proposal only; never invokes git)
//   - restore_file_from_origin(proposal only; never invokes git)
//   - abort_if_dirty_worktree (refusal; not destructive)
//
// Forbidden strategies (closed-by-default):
//   - git_reset_hard
//   - git_checkout_destructive
//   - git_push
//   - shell_spawn / exec / child_process
//   - hermes_config_write
//   - package mutation
//   - ipc_register / timer_register
//
// All forbidden strategies are denied at the gate (gate 3). The
// contract's `would_execute` and `executed_commands` fields are
// literal-false / literal-[] in this source file; editing the literal
// is the audit signal.

export const HCC_ROLLBACK_REHEARSAL_SCHEMA_VERSION = "1.0.0" as const;

/** Strategy proposed by the rehearsal. The contract never executes it. */
export type HCCRollbackStrategy =
  | "git_revert_commit"
  | "drop_commit"
  | "restore_file_from_origin"
  | "abort_if_dirty_worktree"
  | "git_reset_hard"
  | "git_checkout_destructive"
  | "git_push"
  | "shell_spawn"
  | "hermes_config_write"
  | "package_mutation"
  | "ipc_register"
  | "timer_register";

export const HCC_ROLLBACK_ALLOWED_STRATEGIES = [
  "git_revert_commit",
  "drop_commit",
  "restore_file_from_origin",
  "abort_if_dirty_worktree",
] as const satisfies readonly HCCRollbackStrategy[];

export const HCC_ROLLBACK_FORBIDDEN_STRATEGIES = [
  "git_reset_hard",
  "git_checkout_destructive",
  "git_push",
  "shell_spawn",
  "hermes_config_write",
  "package_mutation",
  "ipc_register",
  "timer_register",
] as const satisfies readonly HCCRollbackStrategy[];

export type HCCRollbackRehearsalDecision =
  | "rehearse"
  | "deny"
  | "abort_dirty_worktree";

export interface HCCRollbackRehearsalPlan {
  schema_version: "1.0.0";
  /** Stable id; used in audit entries. */
  plan_id: string;
  /** The rehearsal target: a commit that, in a real execution, would be reverted. */
  target_commit: string;
  /** The strategy proposed for the rollback. */
  strategy: HCCRollbackStrategy;
  /** Information-only description of the proposed command sequence. */
  proposed_commands: readonly string[];
  /** The verifier checklist. */
  verifier_checklist: readonly HCCRollbackVerifierEntry[];
}

export interface HCCRollbackVerifierEntry {
  id: string;
  description: string;
  expected_outcome: string;
}

export interface HCCRollbackRehearsalResult {
  schema_version: "1.0.0";
  plan_id: string;
  target_commit: string;
  strategy: HCCRollbackStrategy;
  decision: HCCRollbackRehearsalDecision;
  reason: string;
  /**
   * The proposed-cmd set as it appears in the audit artifact.
   * Always informational; never executed.
   */
  proposed_commands: readonly string[];
  /**
   * The verifier checklist as it appears in the audit artifact.
   */
  verifier_checklist: readonly HCCRollbackVerifierEntry[];
  /** Literal: no command was ever executed. */
  would_execute: false;
  /** Literal: empty. */
  executed_commands: readonly [];
  /** Literal: 0. */
  subprocess_count: 0;
  /** ISO timestamp at rehearsal. */
  rehearsed_at: string;
  /** Literal-false: rehearsal does not imply unattended execution. */
  implies_unattended: false;
  /** Literal-false: rehearsal does not imply real execution. */
  implies_real_execution: false;
}

// -----------------------------------------------------------------
// Pure helpers
// -----------------------------------------------------------------

function deny(
  plan_id: string,
  target_commit: string,
  strategy: HCCRollbackStrategy,
  reason: string,
  proposed_commands: readonly string[],
  verifier_checklist: readonly HCCRollbackVerifierEntry[],
  rehearsed_at: string,
): HCCRollbackRehearsalResult {
  return {
    schema_version: "1.0.0",
    plan_id,
    target_commit,
    strategy,
    decision: "deny",
    reason,
    proposed_commands,
    verifier_checklist,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    rehearsed_at,
    implies_unattended: false,
    implies_real_execution: false,
  };
}

/**
 * Check whether a strategy is forbidden. A strategy that maps to
 * any of `HCC_ROLLBACK_FORBIDDEN_STRATEGIES` is denied at the gate.
 */
export function isForbiddenRollbackStrategy(
  strategy: HCCRollbackStrategy,
): boolean {
  return (HCC_ROLLBACK_FORBIDDEN_STRATEGIES as readonly string[]).includes(
    strategy,
  );
}

// -----------------------------------------------------------------
// Decision function
// -----------------------------------------------------------------

export interface HCCRollbackRehearsalInput {
  plan: HCCRollbackRehearsalPlan;
  /** Whether the worktree is dirty. Provided by the caller. */
  worktree_dirty: boolean;
  /** Optional: caller claims rehearsal implies unattended execution. */
  implies_unattended?: boolean;
  /** Optional: caller claims rehearsal implies real execution. */
  implies_real_execution?: boolean;
}

/**
 * Rehearse a rollback plan. This is a *contract* function: it returns
 * a `HCCRollbackRehearsalResult` whose `would_execute: false` and
 * `executed_commands: []` are literal. No git / shell / IPC / timer /
 * hermes write ever happens here.
 */
export function rehearseRollback(
  input: HCCRollbackRehearsalInput,
): HCCRollbackRehearsalResult {
  const { plan } = input;
  const rehearsed_at = new Date().toISOString();

  // Gate 1: forbidden strategy → deny.
  if (isForbiddenRollbackStrategy(plan.strategy)) {
    return deny(
      plan.plan_id,
      plan.target_commit,
      plan.strategy,
      `strategy '${plan.strategy}' is forbidden by HCC rollback contract`,
      plan.proposed_commands,
      plan.verifier_checklist,
      rehearsed_at,
    );
  }

  // Gate 2: caller cannot escalate rehearsal to real execution.
  if (input.implies_real_execution) {
    return deny(
      plan.plan_id,
      plan.target_commit,
      plan.strategy,
      "implies_real_execution: rehearsal does not imply real execution",
      plan.proposed_commands,
      plan.verifier_checklist,
      rehearsed_at,
    );
  }

  // Gate 3: caller cannot escalate rehearsal to unattended execution.
  if (input.implies_unattended) {
    return deny(
      plan.plan_id,
      plan.target_commit,
      plan.strategy,
      "implies_unattended: rehearsal does not imply unattended execution",
      plan.proposed_commands,
      plan.verifier_checklist,
      rehearsed_at,
    );
  }

  // Gate 4: abort_if_dirty_worktree only fires when worktree is dirty.
  if (plan.strategy === "abort_if_dirty_worktree") {
    return {
      schema_version: "1.0.0",
      plan_id: plan.plan_id,
      target_commit: plan.target_commit,
      strategy: plan.strategy,
      decision: input.worktree_dirty ? "abort_dirty_worktree" : "rehearse",
      reason: input.worktree_dirty
        ? "worktree is dirty; abort_if_dirty_worktree refuses to proceed"
        : "worktree is clean; rehearsal of abort_if_dirty_worktree allowed (inert)",
      proposed_commands: plan.proposed_commands,
      verifier_checklist: plan.verifier_checklist,
      would_execute: false,
      executed_commands: [],
      subprocess_count: 0,
      rehearsed_at,
      implies_unattended: false,
      implies_real_execution: false,
    };
  }

  // Default: rehearse the proposed strategy. The contract still
  // records `would_execute: false`. Real execution is held.
  return {
    schema_version: "1.0.0",
    plan_id: plan.plan_id,
    target_commit: plan.target_commit,
    strategy: plan.strategy,
    decision: "rehearse",
    reason: `rehearsal of strategy '${plan.strategy}' is non-executing; no real git command invoked`,
    proposed_commands: plan.proposed_commands,
    verifier_checklist: plan.verifier_checklist,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    rehearsed_at,
    implies_unattended: false,
    implies_real_execution: false,
  };
}

// -----------------------------------------------------------------
// Posture
// -----------------------------------------------------------------

export interface HCCRollbackRehearsalPosture {
  schema_version: "1.0.0";
  allowed_strategies: readonly string[];
  forbidden_strategies: readonly string[];
  total_allowed: number;
  total_forbidden: number;
  /** Literal: the contract never executes anything. */
  would_execute: false;
  /** Literal: rehearsal never implies real execution. */
  implies_real_execution: false;
  /** Literal: rehearsal never implies unattended execution. */
  implies_unattended: false;
  /** Literal. */
  night_run_ready: false;
  /** Literal. */
  go_no_go: "NO-GO";
}

export function getHccRollbackRehearsalPosture(): HCCRollbackRehearsalPosture {
  return {
    schema_version: "1.0.0",
    allowed_strategies: [...HCC_ROLLBACK_ALLOWED_STRATEGIES],
    forbidden_strategies: [...HCC_ROLLBACK_FORBIDDEN_STRATEGIES],
    total_allowed: HCC_ROLLBACK_ALLOWED_STRATEGIES.length,
    total_forbidden: HCC_ROLLBACK_FORBIDDEN_STRATEGIES.length,
    would_execute: false,
    implies_real_execution: false,
    implies_unattended: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}