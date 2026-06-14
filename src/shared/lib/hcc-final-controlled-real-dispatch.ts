// HCC Final Controlled Real Dispatch Contract.
//
// This is the first (and only) HCC contract allowed to flip
// real_execution_ready / would_execute / any_command_executed to
// true. The flip is gated on a hard AND-combination of every
// prior contract in the readiness track:
//
//   1. real-execution authorization record is valid
//      (REAL-EXECUTION-AUTH-CANDIDATE)
//   2. controlled real-runner plan is valid
//      (CONTROLLED-REAL-RUNNER-CANDIDATE)
//   3. audit actual write was performed
//      (AUDIT-ACTUAL-WRITTEN)
//   4. rollback actual recovery plan is valid
//      (ROLLBACK-ACTUAL-RECOVERY-CANDIDATE)
//   5. identity fields agree across all four records
//      (task_id, source_plan_ref, requested_by_user,
//      authorization_id, dry_run_artifact_hash, planned_action_id,
//      planned_action_kind, whitelist_action_id)
//   6. explicit_user_triggered === true
//   7. dispatch_adapter is injected and supports planned_action_kind
//   8. whitelist_action_id is non-empty
//
// The dispatch itself goes through an injected adapter; the lib
// never calls spawn / exec / child_process directly. The adapter
// is the only surface that may actually perform the action.
//
// This contract is USER-EXPLICIT, NOT unattended. It MUST NOT be
// triggered by app boot, IPC, timer, cron, or any auto-arm path.
// `unattended_ready: false`, `night_run_ready: false`, and
// `go_no_go: "NO-GO"` are preserved as literal-false / literal
// "NO-GO" in the success result to make the user-explicit
// boundary visible to every consumer.

import type {
  HCCRealExecutionAuthorizationResult,
} from "./hcc-real-execution-authorization";
import type {
  HCCControlledRealRunnerResult,
} from "./hcc-controlled-real-runner";
import type { HCCAuditActualWriteResult } from "./hcc-audit-actual-write";
import type { HCCRollbackActualRecoveryPlan } from "./hcc-rollback-actual-recovery";

export const HCC_FINAL_CONTROLLED_REAL_DISPATCH_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCControlledRealDispatchActionKind =
  | "shell_command"
  | "file_write"
  | "config_patch";

/**
 * Verdict returned by `evaluateFinalControlledRealDispatch`.
 *
 * - `FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE` — every gate
 *   passed; the user-explicit dispatch was performed through the
 *   injected adapter. `real_execution_ready: true`,
 *   `would_execute: true`, `any_command_executed: true` are
 *   permitted on this verdict.
 * - `NO-GO` — at least one gate failed. The success fields stay
 *   literal-false.
 */
export type HCCFinalControlledRealDispatchVerdict =
  | "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE"
  | "NO-GO";

/**
 * Injected dispatch adapter. The lib never spawns / never execs.
 * The adapter is the only surface that may actually perform the
 * action. Tests inject mocks.
 */
export interface HCCFinalControlledRealDispatchAdapter {
  /**
   * Whether this adapter can dispatch the given kind. The lib
   * checks this BEFORE calling `dispatch`. The check is pure
   * (no side effects).
   */
  supportsKind: (kind: HCCControlledRealDispatchActionKind) => boolean;
  /**
   * Perform the controlled dispatch. Returns a structured id
   * the caller can use to cross-reference the action. MUST NOT
   * throw on success; on failure it MUST throw.
   */
  dispatch: (
    planned_action_id: string,
    kind: HCCControlledRealDispatchActionKind,
    target_path: string,
  ) => Promise<{ controlled_command_id: string }> | { controlled_command_id: string };
}

/**
 * Input to the final dispatch contract. Every field is treated
 * as untrusted until validated.
 */
export interface HCCFinalControlledRealDispatchInput {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  dry_run_artifact_hash: string;
  planned_action_id: string;
  planned_action_kind: HCCControlledRealDispatchActionKind;
  whitelist_action_id: string;
  /**
   * MUST be true. The lib refuses any input where this is not
   * explicitly set to true. This is the user-explicit trigger.
   */
  explicit_user_triggered: boolean;
  /**
   * Target path the adapter would write to / spawn at / patch.
   * Captured in the success result for audit cross-check.
   */
  target_path: string;
  authorization_result: HCCRealExecutionAuthorizationResult;
  runner_result: HCCControlledRealRunnerResult;
  audit_result: HCCAuditActualWriteResult;
  rollback_plan: HCCRollbackActualRecoveryPlan;
  /** Injected dispatch adapter. */
  dispatch_adapter: HCCFinalControlledRealDispatchAdapter;
}

export interface HCCFinalControlledRealDispatchResult {
  schema_version: "1.0.0";
  verdict: HCCFinalControlledRealDispatchVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  dry_run_artifact_hash: string;
  planned_action_id: string;
  planned_action_kind: HCCControlledRealDispatchActionKind | "";
  whitelist_action_id: string;
  controlled_command_id: string;
  /** Success fields. ONLY true on a valid candidate. */
  real_execution_ready: boolean;
  would_execute: boolean;
  any_command_executed: boolean;
  executed_commands: readonly string[];
  subprocess_count: number;
  auto_executor_started: false;
  /** User-explicit boundary. MUST stay literal-false. */
  unattended_ready: false;
  night_run_ready: false;
  go_no_go: "NO-GO";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isSupportedKind(
  v: unknown,
): v is HCCControlledRealDispatchActionKind {
  return v === "shell_command" || v === "file_write" || v === "config_patch";
}

/**
 * Compose the four prior contracts, validate cross-record
 * identity, check the user-explicit trigger, validate the
 * injected adapter, and dispatch through the adapter.
 *
 * NO-GO on any failed check. NO-GO is the synchronous path; the
 * adapter is never called. CANDIDATE is the async path; the
 * adapter IS called.
 */
export async function evaluateFinalControlledRealDispatch(
  input: HCCFinalControlledRealDispatchInput,
): Promise<HCCFinalControlledRealDispatchResult> {
  if (!isNonEmptyString(input.task_id)) {
    return noGo(input, "missing task_id");
  }
  if (!isNonEmptyString(input.source_plan_ref)) {
    return noGo(input, "missing source_plan_ref");
  }
  if (!isNonEmptyString(input.requested_by_user)) {
    return noGo(input, "missing requested_by_user");
  }
  if (!isNonEmptyString(input.authorization_id)) {
    return noGo(input, "missing authorization_id");
  }
  if (!isNonEmptyString(input.dry_run_artifact_hash)) {
    return noGo(input, "missing dry_run_artifact_hash");
  }
  if (!isNonEmptyString(input.planned_action_id)) {
    return noGo(input, "missing planned_action_id");
  }
  if (!isSupportedKind(input.planned_action_kind)) {
    return noGo(
      input,
      `unsupported planned_action_kind: "${String(input.planned_action_kind)}"`,
    );
  }
  if (!isNonEmptyString(input.whitelist_action_id)) {
    return noGo(input, "missing whitelist_action_id");
  }
  if (input.explicit_user_triggered !== true) {
    return noGo(
      input,
      "explicit_user_triggered must be true (dispatch is user-explicit, never unattended)",
    );
  }
  if (!isNonEmptyString(input.target_path)) {
    return noGo(input, "missing target_path");
  }
  if (!input.dispatch_adapter || typeof input.dispatch_adapter !== "object") {
    return noGo(input, "missing dispatch_adapter");
  }
  const adapter = input.dispatch_adapter;
  if (typeof adapter.supportsKind !== "function") {
    return noGo(input, "dispatch_adapter.supportsKind must be a function");
  }
  if (typeof adapter.dispatch !== "function") {
    return noGo(input, "dispatch_adapter.dispatch must be a function");
  }
  if (!adapter.supportsKind(input.planned_action_kind)) {
    return noGo(
      input,
      `dispatch_adapter does not support planned_action_kind "${input.planned_action_kind}"`,
    );
  }

  // Verdict guards: every prior contract must have produced its
  // candidate / written verdict.
  if (
    input.authorization_result.verdict !== "REAL-EXECUTION-AUTH-CANDIDATE"
  ) {
    return noGo(
      input,
      `authorization_result.verdict must be REAL-EXECUTION-AUTH-CANDIDATE; got "${input.authorization_result.verdict}"`,
    );
  }
  if (
    input.runner_result.verdict !== "CONTROLLED-REAL-RUNNER-CANDIDATE"
  ) {
    return noGo(
      input,
      `runner_result.verdict must be CONTROLLED-REAL-RUNNER-CANDIDATE; got "${input.runner_result.verdict}"`,
    );
  }
  if (input.audit_result.verdict !== "AUDIT-ACTUAL-WRITTEN") {
    return noGo(
      input,
      `audit_result.verdict must be AUDIT-ACTUAL-WRITTEN; got "${input.audit_result.verdict}"`,
    );
  }
  if (
    input.rollback_plan.verdict !== "ROLLBACK-ACTUAL-RECOVERY-CANDIDATE"
  ) {
    return noGo(
      input,
      `rollback_plan.verdict must be ROLLBACK-ACTUAL-RECOVERY-CANDIDATE; got "${input.rollback_plan.verdict}"`,
    );
  }

  // Identity guards: task / source / requester / authorization /
  // hash / planned-action / whitelist must all agree across the
  // four records.
  if (input.authorization_result.task_id !== input.task_id) {
    return noGo(
      input,
      "authorization_result.task_id does not match input.task_id",
    );
  }
  if (input.runner_result.task_id !== input.task_id) {
    return noGo(input, "runner_result.task_id does not match input.task_id");
  }
  if (input.audit_result.task_id !== input.task_id) {
    return noGo(input, "audit_result.task_id does not match input.task_id");
  }
  if (input.rollback_plan.task_id !== input.task_id) {
    return noGo(
      input,
      "rollback_plan.task_id does not match input.task_id",
    );
  }

  if (input.authorization_result.source_plan_ref !== input.source_plan_ref) {
    return noGo(
      input,
      "authorization_result.source_plan_ref does not match",
    );
  }
  if (input.runner_result.source_plan_ref !== input.source_plan_ref) {
    return noGo(input, "runner_result.source_plan_ref does not match");
  }
  if (input.audit_result.source_plan_ref !== input.source_plan_ref) {
    return noGo(input, "audit_result.source_plan_ref does not match");
  }
  if (input.rollback_plan.source_plan_ref !== input.source_plan_ref) {
    return noGo(input, "rollback_plan.source_plan_ref does not match");
  }

  if (
    input.authorization_result.requested_by_user !== input.requested_by_user
  ) {
    return noGo(
      input,
      "authorization_result.requested_by_user does not match",
    );
  }
  if (input.runner_result.requested_by_user !== input.requested_by_user) {
    return noGo(
      input,
      "runner_result.requested_by_user does not match",
    );
  }
  if (input.audit_result.requested_by_user !== input.requested_by_user) {
    return noGo(
      input,
      "audit_result.requested_by_user does not match",
    );
  }
  if (input.rollback_plan.requested_by_user !== input.requested_by_user) {
    return noGo(
      input,
      "rollback_plan.requested_by_user does not match",
    );
  }

  if (input.authorization_result.authorization_id !== input.authorization_id) {
    return noGo(
      input,
      "authorization_result.authorization_id does not match",
    );
  }
  if (input.audit_result.authorization_id !== input.authorization_id) {
    return noGo(
      input,
      "audit_result.authorization_id does not match",
    );
  }
  if (input.rollback_plan.authorization_id !== input.authorization_id) {
    return noGo(
      input,
      "rollback_plan.authorization_id does not match",
    );
  }

  if (
    input.authorization_result.dry_run_artifact_hash !==
    input.dry_run_artifact_hash
  ) {
    return noGo(
      input,
      "authorization_result.dry_run_artifact_hash does not match",
    );
  }
  // The runner, audit, and rollback records do not carry
  // dry_run_artifact_hash on their result/plan shape; the
  // authorization record is the canonical carrier. Cross-check
  // between input and authorization is sufficient.

  if (input.runner_result.planned_action_id !== input.planned_action_id) {
    return noGo(
      input,
      "runner_result.planned_action_id does not match",
    );
  }
  if (input.audit_result.planned_action_id !== input.planned_action_id) {
    return noGo(
      input,
      "audit_result.planned_action_id does not match",
    );
  }
  if (input.rollback_plan.planned_action_id !== input.planned_action_id) {
    return noGo(
      input,
      "rollback_plan.planned_action_id does not match",
    );
  }

  if (input.runner_result.planned_action_kind !== input.planned_action_kind) {
    return noGo(
      input,
      "runner_result.planned_action_kind does not match",
    );
  }
  if (input.audit_result.planned_action_kind !== input.planned_action_kind) {
    return noGo(
      input,
      "audit_result.planned_action_kind does not match",
    );
  }
  if (input.rollback_plan.planned_action_kind !== input.planned_action_kind) {
    return noGo(
      input,
      "rollback_plan.planned_action_kind does not match",
    );
  }

  if (input.runner_result.whitelist_action_id !== input.whitelist_action_id) {
    return noGo(
      input,
      "runner_result.whitelist_action_id does not match",
    );
  }
  if (input.audit_result.whitelist_action_id !== input.whitelist_action_id) {
    return noGo(
      input,
      "audit_result.whitelist_action_id does not match",
    );
  }
  // rollback_plan does not carry whitelist_action_id on its
  // plan shape; runner + audit are the canonical carriers and
  // are cross-checked above.

  // All gates passed. Dispatch through the injected adapter.
  const dispatched = await adapter.dispatch(
    input.planned_action_id,
    input.planned_action_kind,
    input.target_path,
  );
  if (
    !dispatched ||
    typeof dispatched.controlled_command_id !== "string" ||
    dispatched.controlled_command_id.length === 0
  ) {
    return noGo(
      input,
      "dispatch_adapter.dispatch did not return a controlled_command_id",
    );
  }

  return candidate(input, dispatched.controlled_command_id);
}

function noGo(
  input: HCCFinalControlledRealDispatchInput,
  reason: string,
): HCCFinalControlledRealDispatchResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization_id ?? "",
    dry_run_artifact_hash: input.dry_run_artifact_hash ?? "",
    planned_action_id: input.planned_action_id ?? "",
    planned_action_kind: (input.planned_action_kind as
      | HCCControlledRealDispatchActionKind
      | "") ?? "",
    whitelist_action_id: input.whitelist_action_id ?? "",
    controlled_command_id: "",
    real_execution_ready: false,
    would_execute: false,
    any_command_executed: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}

function candidate(
  input: HCCFinalControlledRealDispatchInput,
  controlled_command_id: string,
): HCCFinalControlledRealDispatchResult {
  return {
    schema_version: "1.0.0",
    verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE",
    reason:
      "all 4 prior contracts valid + identity agreement + explicit_user_triggered=true + adapter supports kind; user-explicit dispatch performed through injected adapter (NOT unattended)",
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization_id,
    dry_run_artifact_hash: input.dry_run_artifact_hash,
    planned_action_id: input.planned_action_id,
    planned_action_kind: input.planned_action_kind,
    whitelist_action_id: input.whitelist_action_id,
    controlled_command_id,
    real_execution_ready: true,
    would_execute: true,
    any_command_executed: true,
    executed_commands: [controlled_command_id],
    subprocess_count: 1,
    auto_executor_started: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}
