// HCC Unattended Ready Consumer.
//
// First consumer slice that may flip actual `unattended_ready`
// to `true`, but ONLY behind all existing gates and an
// explicit feature flag. This slice consumes the enablement
// candidate from `HCC-UNATTENDED-EXECUTION-ENABLEMENT-001`
// together with the final controlled real dispatch result,
// and produces either UNATTENDED-READY-CANDIDATE or NO-GO.
//
// The consumer is a PURE EVALUATOR. It does NOT dispatch
// commands, does NOT call the executor, does NOT touch IPC,
// does NOT start app boot / timer / cron / auto-arm. The
// flip of `unattended_ready: true` is a readiness signal
// for a future runner that will consume this result.
//
// Per HCC governance (origin `45a15ab`):
//   - The actual executor must NOT self-arm or self-start
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - The consumer does NOT call `submitDryRunAction`
//   - No writes to `~/.hermes/**`

import type {
  HCCUnattendedExecutionEnablementResult,
} from "./hcc-unattended-execution-enablement";
import type {
  HCCFinalControlledRealDispatchResult,
} from "./hcc-final-controlled-real-dispatch";

export const HCC_UNATTENDED_READY_CONSUMER_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedReadyConsumerVerdict =
  | "UNATTENDED-READY-CANDIDATE"
  | "NO-GO";

export interface HCCUnattendedReadyConsumerInput {
  /** Task / plan identity for cross-check. */
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;

  /** Gate 1: Feature flag. Defensive re-check. */
  feature_flag_enabled: boolean;

  /** Gate 2: The enablement result from the prior contract. */
  enablement_result: HCCUnattendedExecutionEnablementResult;

  /** Gate 3: The final controlled real dispatch result. */
  final_dispatch_result: HCCFinalControlledRealDispatchResult;

  /** Gate 4: Authorization cross-check. */
  authorization: {
    authorized: boolean;
    authorization_id: string;
    scope: "controlled_unattended_enablement";
  };

  /** Gate 5: Budget still within caps. */
  budget: {
    present: boolean;
    exceeded: boolean;
  };

  /** Gate 6: Audit is confirmed WRITTEN. */
  confirmed_audit_written: boolean;

  /** Gate 7: Rollback is confirmed candidate. */
  confirmed_rollback_candidate: boolean;

  /** Gate 8: All blockers resolved. */
  blockers_resolved: boolean;
}

export interface HCCUnattendedReadyConsumerResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedReadyConsumerVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  enablement_verdict: string;
  final_dispatch_verdict: string;
  /** Readiness fields. */
  unattended_ready: boolean;
  night_run_ready: false;
  go_no_go: "NO-GO";
  auto_executor_started: false;
  /** Execution side-effects. ALWAYS literal-false / zero. */
  would_execute: false;
  executed_commands: readonly [];
  subprocess_count: 0;
  any_command_executed: false;
  real_execution_ready: false;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const REQUIRED_DISPATCH_VERDICT = "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE";

/**
 * Pure evaluator. Consumes the enablement candidate + the final
 * dispatch result + feature flag, and returns either
 * UNATTENDED-READY-CANDIDATE with `unattended_ready: true`
 * or NO-GO. No I/O, no dispatch, no executor calls.
 */
export function evaluateUnattendedReadyConsumer(
  input: HCCUnattendedReadyConsumerInput,
): HCCUnattendedReadyConsumerResult {
  if (!isNonEmptyString(input.task_id)) {
    return noGo(input, "missing task_id");
  }
  if (!isNonEmptyString(input.source_plan_ref)) {
    return noGo(input, "missing source_plan_ref");
  }
  if (!isNonEmptyString(input.requested_by_user)) {
    return noGo(input, "missing requested_by_user");
  }

  // Gate 1: Feature flag.
  if (input.feature_flag_enabled !== true) {
    return noGo(input, "feature_flag_enabled must be true (unattended execution is opt-in)");
  }

  // Gate 2: Enablement result must be a candidate.
  if (input.enablement_result.verdict !== "ENABLEMENT-CANDIDATE") {
    return noGo(
      input,
      `enablement_result.verdict must be ENABLEMENT-CANDIDATE; got "${input.enablement_result.verdict}"`,
    );
  }
  if (input.enablement_result.unattended_ready_candidate !== true) {
    return noGo(input, "enablement_result.unattended_ready_candidate must be true");
  }

  // Gate 3: Final dispatch must be a candidate.
  if (input.final_dispatch_result.verdict !== REQUIRED_DISPATCH_VERDICT) {
    return noGo(
      input,
      `final_dispatch_result.verdict must be ${REQUIRED_DISPATCH_VERDICT}; got "${input.final_dispatch_result.verdict}"`,
    );
  }

  // Gate 4: Authorization cross-check.
  if (input.authorization.authorized !== true) {
    return noGo(input, "authorization.authorized must be true");
  }
  if (input.authorization.scope !== "controlled_unattended_enablement") {
    return noGo(
      input,
      `authorization.scope must be controlled_unattended_enablement; got "${input.authorization.scope}"`,
    );
  }
  if (!isNonEmptyString(input.authorization.authorization_id)) {
    return noGo(input, "missing authorization.authorization_id");
  }

  // Gate 5: Budget still within caps.
  if (input.budget.present !== true) {
    return noGo(input, "budget.present must be true");
  }
  if (input.budget.exceeded === true) {
    return noGo(input, "budget.exceeded must be false");
  }

  // Gate 6: Audit WRITTEN confirmed.
  if (input.confirmed_audit_written !== true) {
    return noGo(input, "confirmed_audit_written must be true");
  }

  // Gate 7: Rollback candidate confirmed.
  if (input.confirmed_rollback_candidate !== true) {
    return noGo(input, "confirmed_rollback_candidate must be true");
  }

  // Gate 8: Blockers all resolved.
  if (input.blockers_resolved !== true) {
    return noGo(input, "blockers_resolved must be true");
  }

  // Identity cross-check: task_id / source_plan_ref /
  // requested_by_user must match across enablement result,
  // final dispatch result, and input.
  if (input.enablement_result.task_id !== input.task_id) {
    return noGo(input, "enablement_result.task_id does not match input.task_id");
  }
  if (input.final_dispatch_result.task_id !== input.task_id) {
    return noGo(input, "final_dispatch_result.task_id does not match input.task_id");
  }
  if (input.enablement_result.source_plan_ref !== input.source_plan_ref) {
    return noGo(input, "enablement_result.source_plan_ref does not match");
  }
  if (input.final_dispatch_result.source_plan_ref !== input.source_plan_ref) {
    return noGo(input, "final_dispatch_result.source_plan_ref does not match");
  }
  if (input.enablement_result.requested_by_user !== input.requested_by_user) {
    return noGo(input, "enablement_result.requested_by_user does not match");
  }
  if (input.final_dispatch_result.requested_by_user !== input.requested_by_user) {
    return noGo(input, "final_dispatch_result.requested_by_user does not match");
  }
  if (input.enablement_result.authorization_id !== input.authorization.authorization_id) {
    return noGo(input, "enablement_result.authorization_id does not match authorization.authorization_id");
  }

  // All 8 gates + identity cross-checks satisfied.
  return candidate(input);
}

function candidate(
  input: HCCUnattendedReadyConsumerInput,
): HCCUnattendedReadyConsumerResult {
  return {
    schema_version: "1.0.0",
    verdict: "UNATTENDED-READY-CANDIDATE",
    reason:
      "all 8 gates satisfied: feature_flag, enablement, final_dispatch, authorization, budget, audit_written, rollback, blockers + identity cross-check; unattended_ready=true (first slice allowed to flip this field in the full track)",
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization.authorization_id,
    enablement_verdict: input.enablement_result.verdict,
    final_dispatch_verdict: input.final_dispatch_result.verdict,
    unattended_ready: true,
    night_run_ready: false,
    go_no_go: "NO-GO",
    auto_executor_started: false,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    any_command_executed: false,
    real_execution_ready: false,
  };
}

function noGo(
  input: HCCUnattendedReadyConsumerInput,
  reason: string,
): HCCUnattendedReadyConsumerResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization?.authorization_id ?? "",
    enablement_verdict: input.enablement_result?.verdict ?? "",
    final_dispatch_verdict: input.final_dispatch_result?.verdict ?? "",
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    auto_executor_started: false,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    any_command_executed: false,
    real_execution_ready: false,
  };
}
