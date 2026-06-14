// HCC Rollback Actual Recovery Contract.
//
// Pure planner + injected recovery adapter. This slice proves HCC
// has a repo-local recovery path for controlled changes. It does
// NOT execute rollback, NOT call git, NOT spawn, NOT write to
// `~/.hermes/**`, NOT call `submitDryRunAction`, NOT import
// bootstrap / arm / start / host.
//
// Per HCC governance (origin `665ba1c`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//
// Recovery strategies are limited to a narrow allow-list:
//   - `restore_file_from_snapshot`  — restore `target_path` from
//     a caller-supplied in-memory snapshot blob.
//   - `restore_file_from_origin`    — restore `target_path` from
//     a caller-supplied in-memory "origin" blob (e.g. an upstream
//     pinned version held in memory by the caller).
//   - `abort_if_dirty_worktree`     — signal the caller to abort
//     because the worktree is dirty; no file I/O.
//
// All three strategies are pure projections over the in-memory
// adapter; the lib does NOT call the destructive git forms
// (those are guarded at a layer above this contract). The
// adapter is provided by the caller; tests
// inject a mock so no real I/O happens during unit tests.

export const HCC_ROLLBACK_ACTUAL_RECOVERY_SCHEMA_VERSION =
  "1.0.0" as const;

const PATH_SEP_PATTERN = /[\\/]/;

/**
 * Allowed recovery strategies. Anything else is NO-GO.
 */
export type HCCRollbackActualRecoveryStrategy =
  | "restore_file_from_snapshot"
  | "restore_file_from_origin"
  | "abort_if_dirty_worktree";

const ALLOWED_STRATEGIES: ReadonlySet<HCCRollbackActualRecoveryStrategy> =
  new Set([
    "restore_file_from_snapshot",
    "restore_file_from_origin",
    "abort_if_dirty_worktree",
  ]);

/**
 * Required preceding verdicts. The rollback contract only fires
 * when both the runner and the audit-write contract were OK.
 */
export type HCCRollbackPredecessorVerdict =
  | "CONTROLLED-REAL-RUNNER-CANDIDATE"
  | "AUDIT-ACTUAL-WRITTEN";

/**
 * Injected recovery adapter. The lib never calls git, never
 * spawns. Production adapters would route through the audit
 * snapshot store; tests inject mocks.
 */
export interface HCCRollbackRecoveryAdapter {
  /**
   * Optional. Returns `true` if the worktree is dirty. Used by
   * the `abort_if_dirty_worktree` strategy. Tests inject mocks
   * that return a known value.
   */
  isWorktreeDirty?: () => boolean;
  /**
   * Returns the snapshot blob for `target_path` if the strategy
   * is `restore_file_from_snapshot`.
   */
  readSnapshot?: (target_path: string) => string | null;
  /**
   * Returns the origin blob for `target_path` if the strategy is
   * `restore_file_from_origin`.
   */
  readOrigin?: (target_path: string) => string | null;
}

/**
 * Result of `planRollbackActualRecovery`. Pure projection.
 */
export type HCCRollbackActualRecoveryVerdict =
  | "ROLLBACK-ACTUAL-RECOVERY-CANDIDATE"
  | "NO-GO";

export interface HCCRollbackActualRecoveryInput {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  runner_verdict: HCCRollbackPredecessorVerdict;
  audit_write_verdict: HCCRollbackPredecessorVerdict;
  planned_action_id: string;
  planned_action_kind:
    | "shell_command"
    | "file_write"
    | "config_patch";
  /**
   * Repo-local path the rollback would target. Must be a
   * repo-local file (no `~`, no `..`, no `src/main/index.ts`,
   * no `package.json` / `package-lock.json`, no
   * `docs/knowledge/**`).
   */
  target_path: string;
  /** Content hash before the change, for cross-check. */
  before_hash: string;
  /** Content hash after the change, for cross-check. */
  after_hash: string;
  /** Recovery strategy. Must be one of the supported strategies. */
  recovery_strategy: HCCRollbackActualRecoveryStrategy;
}

export interface HCCRollbackActualRecoveryPlan {
  schema_version: "1.0.0";
  verdict: HCCRollbackActualRecoveryVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind:
    | "shell_command"
    | "file_write"
    | "config_patch"
    | "";
  target_path: string;
  before_hash: string;
  after_hash: string;
  recovery_strategy: HCCRollbackActualRecoveryStrategy | "";
  /** Whether a snapshot/origin blob was resolved by the adapter. */
  resolved: boolean;
  /** Execution fields. ALWAYS literal-false on plan. */
  would_execute: false;
  executed_commands: readonly [];
  subprocess_count: 0;
  auto_executor_started: false;
  any_command_executed: false;
  real_execution_ready: false;
  unattended_ready: false;
  night_run_ready: false;
  go_no_go: "NO-GO";
  /** Whether the recovery was actually performed. */
  performed: boolean;
}

const FORBIDDEN_TARGETS: ReadonlySet<string> = new Set([
  "src/main/index.ts",
  "package.json",
  "package-lock.json",
]);

function splitPath(p: string): string[] {
  return p.split(PATH_SEP_PATTERN).filter((seg) => seg.length > 0);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isRepoLocalPath(p: string): boolean {
  if (!isNonEmptyString(p)) return false;
  if (p.startsWith("~")) return false;
  if (!p.startsWith("docs/") && !p.startsWith("src/")) {
    // Recovery scope is narrow: only repo-local files under docs/
    // or src/. We do NOT allow top-level files or arbitrary paths.
    return false;
  }
  const segs = splitPath(p);
  for (const seg of segs) {
    if (seg === "..") return false;
  }
  return true;
}

function isForbiddenTarget(p: string): boolean {
  // Exact match OR .gitignore-style sub-paths.
  if (FORBIDDEN_TARGETS.has(p)) return true;
  // Reject `docs/knowledge/**` (drift-prone; not a recovery target).
  const segs = splitPath(p);
  if (segs.length >= 2 && segs[0] === "docs" && segs[1] === "knowledge") {
    return true;
  }
  return false;
}

function isSupportedPredecessorVerdict(
  v: unknown,
): v is HCCRollbackPredecessorVerdict {
  return (
    v === "CONTROLLED-REAL-RUNNER-CANDIDATE" ||
    v === "AUDIT-ACTUAL-WRITTEN"
  );
}

function isSupportedStrategy(
  v: unknown,
): v is HCCRollbackActualRecoveryStrategy {
  return ALLOWED_STRATEGIES.has(
    v as HCCRollbackActualRecoveryStrategy,
  );
}

/**
 * Pure planner. Validates input, path scope, strategy allow-list,
 * and predecessor verdicts. Returns either a CANDIDATE plan or a
 * NO-GO reason. No I/O.
 */
export function planRollbackActualRecovery(
  input: HCCRollbackActualRecoveryInput,
): HCCRollbackActualRecoveryPlan {
  if (!isNonEmptyString(input.task_id)) {
    return noGoPlan(input, "missing task_id");
  }
  if (!isNonEmptyString(input.source_plan_ref)) {
    return noGoPlan(input, "missing source_plan_ref");
  }
  if (!isNonEmptyString(input.requested_by_user)) {
    return noGoPlan(input, "missing requested_by_user");
  }
  if (!isNonEmptyString(input.authorization_id)) {
    return noGoPlan(input, "missing authorization_id");
  }
  if (!isSupportedPredecessorVerdict(input.runner_verdict)) {
    return noGoPlan(
      input,
      `runner_verdict must be CONTROLLED-REAL-RUNNER-CANDIDATE; got "${String(
        input.runner_verdict,
      )}"`,
    );
  }
  if (!isSupportedPredecessorVerdict(input.audit_write_verdict)) {
    return noGoPlan(
      input,
      `audit_write_verdict must be AUDIT-ACTUAL-WRITTEN; got "${String(
        input.audit_write_verdict,
      )}"`,
    );
  }
  if (!isNonEmptyString(input.planned_action_id)) {
    return noGoPlan(input, "missing planned_action_id");
  }
  if (!isNonEmptyString(input.target_path)) {
    return noGoPlan(input, "missing target_path");
  }
  if (!isRepoLocalPath(input.target_path)) {
    return noGoPlan(
      input,
      "target_path must be repo-local under docs/ or src/ (no ~, no ..)",
    );
  }
  if (isForbiddenTarget(input.target_path)) {
    return noGoPlan(
      input,
      `target_path is in a forbidden recovery scope: ${input.target_path}`,
    );
  }
  if (!isNonEmptyString(input.before_hash)) {
    return noGoPlan(input, "missing before_hash");
  }
  if (!isNonEmptyString(input.after_hash)) {
    return noGoPlan(input, "missing after_hash");
  }
  if (input.before_hash === input.after_hash) {
    return noGoPlan(
      input,
      "before_hash must differ from after_hash (nothing to roll back)",
    );
  }
  if (!isSupportedStrategy(input.recovery_strategy)) {
    return noGoPlan(
      input,
      `unsupported recovery_strategy: "${String(input.recovery_strategy)}"`,
    );
  }

  return candidatePlan(input);
}

/**
 * Resolve a candidate plan by reading the relevant blob from the
 * injected adapter. Returns a NO-GO plan if the adapter cannot
 * provide the blob. Does NOT perform any I/O outside the
 * adapter.
 */
export function resolveRollbackActualRecovery(
  input: HCCRollbackActualRecoveryInput,
  adapter: HCCRollbackRecoveryAdapter,
): HCCRollbackActualRecoveryPlan {
  const plan = planRollbackActualRecovery(input);
  if (plan.verdict === "NO-GO") return plan;

  if (plan.recovery_strategy === "abort_if_dirty_worktree") {
    if (typeof adapter.isWorktreeDirty === "function") {
      const dirty = adapter.isWorktreeDirty();
      if (dirty) {
        return {
          ...plan,
          verdict: "NO-GO",
          reason: "worktree is dirty; abort_if_dirty_worktree refuses to roll back",
          resolved: false,
        };
      }
    }
    return { ...plan, resolved: true };
  }

  if (plan.recovery_strategy === "restore_file_from_snapshot") {
    if (typeof adapter.readSnapshot !== "function") {
      return {
        ...plan,
        verdict: "NO-GO",
        reason:
          "restore_file_from_snapshot requires adapter.readSnapshot",
        resolved: false,
      };
    }
    const blob = adapter.readSnapshot(input.target_path);
    if (blob === null) {
      return {
        ...plan,
        verdict: "NO-GO",
        reason: "snapshot blob not found for target_path",
        resolved: false,
      };
    }
    if (typeof blob !== "string") {
      return {
        ...plan,
        verdict: "NO-GO",
        reason: "snapshot blob is not a string",
        resolved: false,
      };
    }
    return { ...plan, resolved: true };
  }

  if (plan.recovery_strategy === "restore_file_from_origin") {
    if (typeof adapter.readOrigin !== "function") {
      return {
        ...plan,
        verdict: "NO-GO",
        reason: "restore_file_from_origin requires adapter.readOrigin",
        resolved: false,
      };
    }
    const blob = adapter.readOrigin(input.target_path);
    if (blob === null) {
      return {
        ...plan,
        verdict: "NO-GO",
        reason: "origin blob not found for target_path",
        resolved: false,
      };
    }
    if (typeof blob !== "string") {
      return {
        ...plan,
        verdict: "NO-GO",
        reason: "origin blob is not a string",
        resolved: false,
      };
    }
    return { ...plan, resolved: true };
  }

  return plan;
}

function candidatePlan(
  input: HCCRollbackActualRecoveryInput,
): HCCRollbackActualRecoveryPlan {
  return {
    schema_version: "1.0.0",
    verdict: "ROLLBACK-ACTUAL-RECOVERY-CANDIDATE",
    reason:
      "input valid; recovery plan ready (rollback not yet performed)",
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization_id,
    planned_action_id: input.planned_action_id,
    planned_action_kind: input.planned_action_kind,
    target_path: input.target_path,
    before_hash: input.before_hash,
    after_hash: input.after_hash,
    recovery_strategy: input.recovery_strategy,
    resolved: false,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    performed: false,
  };
}

function noGoPlan(
  input: HCCRollbackActualRecoveryInput,
  reason: string,
): HCCRollbackActualRecoveryPlan {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization_id ?? "",
    planned_action_id: input.planned_action_id ?? "",
    planned_action_kind: (input.planned_action_kind as
      | "shell_command"
      | "file_write"
      | "config_patch"
      | "") ?? "",
    target_path: input.target_path ?? "",
    before_hash: input.before_hash ?? "",
    after_hash: input.after_hash ?? "",
    recovery_strategy:
      (input.recovery_strategy as
        | HCCRollbackActualRecoveryStrategy
        | "") ?? "",
    resolved: false,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    performed: false,
  };
}
