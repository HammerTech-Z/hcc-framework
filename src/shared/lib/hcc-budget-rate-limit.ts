// HCC Budget / Rate Limit — first version contract.
//
// Models a *budget* for any future real-execution attempt. The contract
// is closed-by-default: the posture is "real execution NOT APPROVED",
// "unattended execution NOT APPROVED", and "night-run NOT APPROVED".
//
// This slice is a contract only: nothing in this module spawns anything,
// writes to `~/.hermes/**`, registers IPC, starts a timer, or
// transitions `night_run_ready` to true. All limits are literal in
// the source.
//
// Hard limits (all literal):
//   max_task_count
//   max_wall_clock_ms
//   max_subprocess_count
//   max_token_budget
//   max_output_bytes
//   max_failure_count
//
// Verdicts:
//   within_budget       : all observed counters <= their caps
//   soft_stop_required  : any counter > 80% of its cap (warn)
//   hard_stop_required  : any counter > its cap
//   deny_unattended     : caller claims unattended_ready=true (always)

export const HCC_BUDGET_RATE_LIMIT_SCHEMA_VERSION = "1.0.0" as const;

export interface HCCBudgetHardLimits {
  /** Maximum number of tasks in a single execution window. */
  max_task_count: number;
  /** Maximum wall-clock in milliseconds. */
  max_wall_clock_ms: number;
  /** Maximum number of subprocesses spawned in the window. */
  max_subprocess_count: number;
  /** Maximum total tokens consumed in the window. */
  max_token_budget: number;
  /** Maximum total output bytes produced. */
  max_output_bytes: number;
  /** Maximum number of failed tasks before hard stop. */
  max_failure_count: number;
}

export const HCC_BUDGET_HARD_LIMITS: Readonly<HCCBudgetHardLimits> = Object.freeze({
  max_task_count: 5,
  max_wall_clock_ms: 1_800_000, // 30 minutes
  max_subprocess_count: 0, // closed-by-default
  max_token_budget: 500_000,
  max_output_bytes: 5_000_000,
  max_failure_count: 1,
});

export const HCC_BUDGET_SOFT_STOP_RATIO = 0.8 as const;

export type HCCBudgetVerdict =
  | "within_budget"
  | "soft_stop_required"
  | "hard_stop_required"
  | "deny_unattended";

export interface HCCBudgetObserved {
  task_count: number;
  wall_clock_ms: number;
  subprocess_count: number;
  token_used: number;
  output_bytes: number;
  failure_count: number;
}

export interface HCCBudgetCheckResult {
  schema_version: "1.0.0";
  verdict: HCCBudgetVerdict;
  reason: string;
  observed: HCCBudgetObserved;
  limits: HCCBudgetHardLimits;
  /** If hard stop is required, list of fields that exceeded their cap. */
  exceeded_fields: readonly string[];
  /** If soft stop is required, list of fields that are at >= 80% of cap. */
  warn_fields: readonly string[];
  /** Literal: the budget contract does not imply real execution. */
  implies_real_execution: false;
  /** Literal: the budget contract does not imply unattended execution. */
  implies_unattended: false;
  /** Literal: a checked budget never spawns. */
  subprocess_count: 0;
}

// -----------------------------------------------------------------
// Pure helpers
// -----------------------------------------------------------------

function hardStop(
  observed: HCCBudgetObserved,
  exceeded: readonly string[],
  reason: string,
): HCCBudgetCheckResult {
  return {
    schema_version: "1.0.0",
    verdict: "hard_stop_required",
    reason,
    observed,
    limits: HCC_BUDGET_HARD_LIMITS,
    exceeded_fields: exceeded,
    warn_fields: [],
    implies_real_execution: false,
    implies_unattended: false,
    subprocess_count: 0,
  };
}

function softStop(
  observed: HCCBudgetObserved,
  warn: readonly string[],
): HCCBudgetCheckResult {
  return {
    schema_version: "1.0.0",
    verdict: "soft_stop_required",
    reason: `soft stop: ${warn.length} field(s) at >= ${Math.round(HCC_BUDGET_SOFT_STOP_RATIO * 100)}% of cap`,
    observed,
    limits: HCC_BUDGET_HARD_LIMITS,
    exceeded_fields: [],
    warn_fields: warn,
    implies_real_execution: false,
    implies_unattended: false,
    subprocess_count: 0,
  };
}

function withinBudget(observed: HCCBudgetObserved): HCCBudgetCheckResult {
  return {
    schema_version: "1.0.0",
    verdict: "within_budget",
    reason: "all observed counters <= their hard limits",
    observed,
    limits: HCC_BUDGET_HARD_LIMITS,
    exceeded_fields: [],
    warn_fields: [],
    implies_real_execution: false,
    implies_unattended: false,
    subprocess_count: 0,
  };
}

function denyUnattended(
  observed: HCCBudgetObserved,
  reason: string,
): HCCBudgetCheckResult {
  return {
    schema_version: "1.0.0",
    verdict: "deny_unattended",
    reason,
    observed,
    limits: HCC_BUDGET_HARD_LIMITS,
    exceeded_fields: [],
    warn_fields: [],
    implies_real_execution: false,
    implies_unattended: false,
    subprocess_count: 0,
  };
}

// -----------------------------------------------------------------
// Decision function
// -----------------------------------------------------------------

export interface HCCBudgetCheckInput {
  observed: HCCBudgetObserved;
  /** Optional: caller claims unattended readiness. Default false. */
  unattended_ready?: boolean;
}

export function checkBudget(input: HCCBudgetCheckInput): HCCBudgetCheckResult {
  const { observed } = input;
  const limits = HCC_BUDGET_HARD_LIMITS;

  // Gate 1: caller cannot claim unattended readiness.
  if (input.unattended_ready) {
    return denyUnattended(
      observed,
      "unattended_ready=true: budget contract cannot imply unattended execution",
    );
  }

  // Gate 2: hard-stop on any cap exceeded.
  const exceeded: string[] = [];
  if (observed.task_count > limits.max_task_count) exceeded.push("task_count");
  if (observed.wall_clock_ms > limits.max_wall_clock_ms) exceeded.push("wall_clock_ms");
  if (observed.subprocess_count > limits.max_subprocess_count) exceeded.push("subprocess_count");
  if (observed.token_used > limits.max_token_budget) exceeded.push("token_used");
  if (observed.output_bytes > limits.max_output_bytes) exceeded.push("output_bytes");
  if (observed.failure_count > limits.max_failure_count) exceeded.push("failure_count");
  if (exceeded.length > 0) {
    return hardStop(
      observed,
      exceeded,
      `hard stop: ${exceeded.length} field(s) exceeded their cap`,
    );
  }

  // Gate 3: soft-stop on any field at >= 80% of cap. Skip caps that
  // are 0 (closed-by-default); those are hard-stop fields.
  const warn: string[] = [];
  if (limits.max_task_count > 0 && observed.task_count >= limits.max_task_count * HCC_BUDGET_SOFT_STOP_RATIO) warn.push("task_count");
  if (limits.max_wall_clock_ms > 0 && observed.wall_clock_ms >= limits.max_wall_clock_ms * HCC_BUDGET_SOFT_STOP_RATIO) warn.push("wall_clock_ms");
  if (limits.max_subprocess_count > 0 && observed.subprocess_count >= limits.max_subprocess_count * HCC_BUDGET_SOFT_STOP_RATIO) warn.push("subprocess_count");
  if (limits.max_token_budget > 0 && observed.token_used >= limits.max_token_budget * HCC_BUDGET_SOFT_STOP_RATIO) warn.push("token_used");
  if (limits.max_output_bytes > 0 && observed.output_bytes >= limits.max_output_bytes * HCC_BUDGET_SOFT_STOP_RATIO) warn.push("output_bytes");
  if (limits.max_failure_count > 0 && observed.failure_count >= limits.max_failure_count * HCC_BUDGET_SOFT_STOP_RATIO) warn.push("failure_count");
  if (warn.length > 0) {
    return softStop(observed, warn);
  }

  return withinBudget(observed);
}

// -----------------------------------------------------------------
// Posture
// -----------------------------------------------------------------

export interface HCCBudgetPosture {
  schema_version: "1.0.0";
  hard_limits: HCCBudgetHardLimits;
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** Literal. */
  go_no_go: "NO-GO";
  /** Literal. */
  implies_real_execution: false;
  /** Literal. */
  implies_unattended: false;
  /** Literal. */
  subprocess_count: 0;
}

export function getHccBudgetPosture(): HCCBudgetPosture {
  return {
    schema_version: "1.0.0",
    hard_limits: HCC_BUDGET_HARD_LIMITS,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    implies_real_execution: false,
    implies_unattended: false,
    subprocess_count: 0,
  };
}