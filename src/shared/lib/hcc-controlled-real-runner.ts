// HCC Controlled Real-Runner Candidate Contract.
//
// Pure shared library. Consumes a
// `HCCRealExecutionAuthorizationResult` plus the planned-action
// identity the runner intends to dispatch, and decides whether
// the call is at most a CONTROLLED-REAL-RUNNER-CANDIDATE.
//
// This module NEVER executes commands. It NEVER spawns, NEVER
// writes to `~/.hermes/**`, NEVER imports bootstrap / arm / start
// / host, NEVER calls `submitDryRunAction`.
//
// Per HCC governance (origin `52b4bd6`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//
// Even when the result is CANDIDATE, the runner has NOT executed
// anything. It has only attested that all the static checks for a
// future real-execution dispatch have been satisfied. The flip of
// `real_execution_ready` to `true` remains gated on a future slice
// that consumes this candidate and (only then) authorizes the
// controlled dispatch path.

import type {
  HCCRealExecutionAuthorizationResult,
} from "./hcc-real-execution-authorization";

export const HCC_CONTROLLED_REAL_RUNNER_SCHEMA_VERSION = "1.0.0" as const;

/**
 * The kind of planned action the runner intends to dispatch. The
 * list is intentionally narrow and frozen: the runner must be
 * told exactly what it would dispatch, and that intent must be
 * one of the supported kinds. Unknown kinds are always NO-GO.
 */
export type HCCControlledRealRunnerActionKind =
  | "shell_command"
  | "file_write"
  | "config_patch";

/**
 * Verdict returned by `evaluateControlledRealRunnerCandidate`.
 *
 * - `CONTROLLED-REAL-RUNNER-CANDIDATE` — every check passed. The
 *   runner is allowed to consider dispatching the planned action.
 *   Execution fields are still literal-false; this verdict only
 *   attests that the static contract is satisfied.
 * - `NO-GO` — at least one check failed. `reason` describes which.
 */
export type HCCControlledRealRunnerVerdict =
  | "CONTROLLED-REAL-RUNNER-CANDIDATE"
  | "NO-GO";

/**
 * Input to the runner candidate evaluator. Pure data; every field
 * is treated as untrusted until validated.
 */
export interface HCCControlledRealRunnerInput {
  /** Stable id of the plan task this runner would handle. */
  task_id: string;
  /** Reference to the source plan (e.g. plan id + entry id). */
  source_plan_ref: string;
  /** The user who requested the task. */
  requested_by_user: string;
  /**
   * The authorization record produced by the prior contract. The
   * runner candidate is only valid when this verdict is
   * REAL-EXECUTION-AUTH-CANDIDATE.
   */
  authorization_result: HCCRealExecutionAuthorizationResult;
  /**
   * Hash (or content id) of the dry-run artifact the runner will
   * reproduce. MUST match `authorization_result.dry_run_artifact_hash`.
   */
  dry_run_artifact_hash: string;
  /**
   * Stable id of the planned action the runner would dispatch.
   * Required: the runner must be told what it would do.
   */
  planned_action_id: string;
  /** Kind of the planned action. Must be one of the supported kinds. */
  planned_action_kind: HCCControlledRealRunnerActionKind;
  /**
   * Id of the whitelist entry that authorizes this planned action.
   * Required: the runner must point at the whitelist entry it
   * claims covers the action.
   */
  whitelist_action_id: string;
}

/**
 * Result of `evaluateControlledRealRunnerCandidate`.
 *
 * Execution fields are ALWAYS literal-false, regardless of verdict.
 * A consumer of this module MUST NOT set those fields to `true`
 * based on `verdict` alone.
 */
export interface HCCControlledRealRunnerResult {
  schema_version: "1.0.0";
  verdict: HCCControlledRealRunnerVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind: HCCControlledRealRunnerActionKind | "";
  whitelist_action_id: string;
  /** The candidate flag. ONLY true on a valid candidate. */
  real_execution_ready_candidate: boolean;
  /** Execution fields. ALWAYS literal-false, regardless of verdict. */
  would_execute: false;
  executed_commands: readonly [];
  subprocess_count: 0;
  auto_executor_started: false;
  any_command_executed: false;
  real_execution_ready: false;
  unattended_ready: false;
  night_run_ready: false;
  go_no_go: "NO-GO";
}

/**
 * Pure evaluator. Returns either a NO-GO result with a reason, or
 * a CANDIDATE result with `real_execution_ready_candidate: true`
 * and ALL execution fields literal-false.
 *
 * The function does not consult any global state, clock, or I/O.
 * It does not invoke the whitelist module; it only checks that the
 * caller supplied a non-empty `whitelist_action_id` it claims to
 * cover the action. Actual whitelist resolution is the executor's
 * job (future slice).
 */
export function evaluateControlledRealRunnerCandidate(
  input: HCCControlledRealRunnerInput,
): HCCControlledRealRunnerResult {
  const base = makeBaseResult(input);

  if (!isNonEmptyString(input.task_id)) {
    return noGo(base, "missing task_id");
  }
  if (!isNonEmptyString(input.source_plan_ref)) {
    return noGo(base, "missing source_plan_ref");
  }
  if (!isNonEmptyString(input.requested_by_user)) {
    return noGo(base, "missing requested_by_user");
  }
  if (!isNonEmptyString(input.dry_run_artifact_hash)) {
    return noGo(base, "missing dry_run_artifact_hash");
  }
  if (!isNonEmptyString(input.planned_action_id)) {
    return noGo(base, "missing planned_action_id");
  }
  if (!isSupportedActionKind(input.planned_action_kind)) {
    return noGo(
      base,
      `unsupported planned_action_kind: "${String(input.planned_action_kind)}"`,
    );
  }
  if (!isNonEmptyString(input.whitelist_action_id)) {
    return noGo(base, "missing whitelist_action_id");
  }

  if (input.authorization_result.verdict !== "REAL-EXECUTION-AUTH-CANDIDATE") {
    return noGo(
      base,
      `authorization_result.verdict must be REAL-EXECUTION-AUTH-CANDIDATE; got "${input.authorization_result.verdict}"`,
    );
  }

  if (input.task_id !== input.authorization_result.task_id) {
    return noGo(base, "task_id does not match authorization_result.task_id");
  }
  if (
    input.source_plan_ref !== input.authorization_result.source_plan_ref
  ) {
    return noGo(
      base,
      "source_plan_ref does not match authorization_result.source_plan_ref",
    );
  }
  if (
    input.requested_by_user !== input.authorization_result.requested_by_user
  ) {
    return noGo(
      base,
      "requested_by_user does not match authorization_result.requested_by_user",
    );
  }
  if (
    input.dry_run_artifact_hash !==
    input.authorization_result.dry_run_artifact_hash
  ) {
    return noGo(
      base,
      "dry_run_artifact_hash does not match authorization_result.dry_run_artifact_hash",
    );
  }

  return candidate(base, input);
}

interface MutableBase {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind: HCCControlledRealRunnerActionKind | "";
  whitelist_action_id: string;
}

function makeBaseResult(
  input: HCCControlledRealRunnerInput,
): MutableBase {
  return {
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization_result?.authorization_id ?? "",
    planned_action_id: input.planned_action_id ?? "",
    planned_action_kind:
      (input.planned_action_kind as
        | HCCControlledRealRunnerActionKind
        | "") ?? "",
    whitelist_action_id: input.whitelist_action_id ?? "",
  };
}

function candidate(
  base: MutableBase,
  input: HCCControlledRealRunnerInput,
): HCCControlledRealRunnerResult {
  return {
    schema_version: "1.0.0",
    verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE",
    reason:
      "authorization CANDIDATE + planned action identity + dry-run hash all match; runner is a candidate, NOT ready for execution",
    ...base,
    planned_action_kind: input.planned_action_kind,
    real_execution_ready_candidate: true,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}

function noGo(
  base: MutableBase,
  reason: string,
): HCCControlledRealRunnerResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    ...base,
    real_execution_ready_candidate: false,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isSupportedActionKind(
  v: unknown,
): v is HCCControlledRealRunnerActionKind {
  return (
    v === "shell_command" ||
    v === "file_write" ||
    v === "config_patch"
  );
}
