// HCC Real Execution Authorization Contract.
//
// Pure shared library. Evaluates a real execution authorization
// record and decides whether the caller is at most a
// REAL-EXECUTION-AUTH-CANDIDATE. This module NEVER executes
// anything, NEVER spawns, NEVER writes to ~/.hermes/**, NEVER
// imports bootstrap / arm / start / host, NEVER calls
// submitDryRunAction.
//
// Per HCC governance (origin `f8f7e78`):
//   - real execution / unattended execution / ~/.hermes/** writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//
// This contract only validates the authorization record. Even when
// the record is valid, the result preserves literal-false execution
// fields so no consumer of this module can accidentally treat a
// candidate as ready-for-execution.

export const HCC_REAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION = "1.0.0" as const;

/**
 * The only accepted authorization scope for this contract.
 *
 * A future slice may extend the union (e.g. read-only or
 * audit-only scopes) but MUST do so without weakening the
 * `controlled_real_execution_candidate` requirement.
 */
export type HCCRealExecutionAuthorizationScope =
  | "controlled_real_execution_candidate";

/**
 * The dry-run verdict this contract requires as a precondition.
 *
 * The dry-run path is the only source of evidence the contract
 * trusts; a missing or NO-GO dry-run verdict always returns NO-GO.
 */
export type HCCRealExecutionDryRunVerdict =
  | "GO-CANDIDATE_DRY_RUN_PRODUCED";

/**
 * Verdict returned by `evaluateRealExecutionAuthorization`.
 *
 * - `REAL-EXECUTION-AUTH-CANDIDATE` — the record passed every
 *   validation check. The result still preserves literal-false
 *   execution fields; this verdict only attests that the
 *   authorization record is well-formed and unexpired.
 * - `NO-GO` — at least one check failed. `reason` describes which.
 */
export type HCCRealExecutionAuthorizationVerdict =
  | "REAL-EXECUTION-AUTH-CANDIDATE"
  | "NO-GO";

/**
 * Input authorization record. Pure data; the contract treats every
 * field as untrusted until validated.
 */
export interface HCCRealExecutionAuthorizationInput {
  /** Stable id of the plan task this authorization covers. */
  task_id: string;
  /** Reference to the source plan (e.g. plan id + entry id). */
  source_plan_ref: string;
  /** The user who requested the task. */
  requested_by_user: string;
  /** The user who explicitly authorized the real execution. */
  authorized_by_user: string;
  /** Unique id of this authorization record. */
  authorization_id: string;
  /** Scope of authorization. Must be the controlled candidate scope. */
  authorization_scope: HCCRealExecutionAuthorizationScope;
  /** ISO-8601 issuance timestamp. */
  issued_at: string;
  /** ISO-8601 expiry timestamp. Must be strictly greater than issued_at. */
  expires_at: string;
  /**
   * Whether the authorization may be consumed at most once.
   * The contract REQUIRES this to be `true`; the runner (future
   * slice) is responsible for actually consuming it.
   */
  one_shot: boolean;
  /**
   * The dry-run verdict the executor must have already produced.
   * The contract REQUIRES the candidate verdict.
   */
  dry_run_verdict: HCCRealExecutionDryRunVerdict;
  /**
   * Hash (or content id) of the dry-run artifact. Acts as the
   * evidence fingerprint the real execution must reproduce.
   */
  dry_run_artifact_hash: string;
  /** Free-form reason describing why authorization was issued. */
  reason: string;
}

/**
 * Result of `evaluateRealExecutionAuthorization`.
 *
 * Even when `verdict === "REAL-EXECUTION-AUTH-CANDIDATE"`, the
 * execution fields below remain literal-false. A consumer of this
 * module MUST NOT set those fields to `true` based on the verdict
 * alone; the executor is the only place that may flip them, and
 * only after a future slice unlocks real execution.
 */
export interface HCCRealExecutionAuthorizationResult {
  schema_version: "1.0.0";
  verdict: HCCRealExecutionAuthorizationVerdict;
  reason: string;
  authorization_id: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorized_by_user: string;
  authorization_scope: HCCRealExecutionAuthorizationScope | "";
  issued_at: string;
  expires_at: string;
  one_shot: false;
  dry_run_verdict: HCCRealExecutionDryRunVerdict | "";
  dry_run_artifact_hash: string;
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

const AUTHORIZATION_SCOPE: HCCRealExecutionAuthorizationScope =
  "controlled_real_execution_candidate";
const REQUIRED_DRY_RUN_VERDICT: HCCRealExecutionDryRunVerdict =
  "GO-CANDIDATE_DRY_RUN_PRODUCED";

/**
 * Pure evaluator. Returns either a NO-GO result with a reason, or
 * a CANDIDATE result with all literal-false execution fields. The
 * function does not consult any global state, clock, or I/O.
 *
 * Callers MUST pass a `nowIso` so the result is deterministic and
 * unit-testable. Production callers should pass the current
 * ISO-8601 time; tests pass a fixed value to assert expiry paths.
 */
export function evaluateRealExecutionAuthorization(
  input: HCCRealExecutionAuthorizationInput,
  nowIso: string,
): HCCRealExecutionAuthorizationResult {
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
  if (!isNonEmptyString(input.authorized_by_user)) {
    return noGo(base, "missing authorized_by_user");
  }
  if (!isNonEmptyString(input.authorization_id)) {
    return noGo(base, "missing authorization_id");
  }
  if (input.authorization_scope !== AUTHORIZATION_SCOPE) {
    return noGo(
      base,
      `authorization_scope must be "${AUTHORIZATION_SCOPE}"; got "${String(
        input.authorization_scope,
      )}"`,
    );
  }
  if (input.one_shot !== true) {
    return noGo(base, "one_shot must be true");
  }
  if (input.dry_run_verdict !== REQUIRED_DRY_RUN_VERDICT) {
    return noGo(
      base,
      `dry_run_verdict must be "${REQUIRED_DRY_RUN_VERDICT}"; got "${String(
        input.dry_run_verdict,
      )}"`,
    );
  }
  if (!isNonEmptyString(input.dry_run_artifact_hash)) {
    return noGo(base, "missing dry_run_artifact_hash / evidence_hash");
  }
  if (!isIsoTimestamp(input.issued_at)) {
    return noGo(base, "invalid issued_at (must be ISO-8601)");
  }
  if (!isIsoTimestamp(input.expires_at)) {
    return noGo(base, "invalid expires_at (must be ISO-8601)");
  }
  if (!(input.issued_at < input.expires_at)) {
    return noGo(base, "issued_at must be strictly less than expires_at");
  }
  if (!isWithinWindow(input.issued_at, input.expires_at, nowIso)) {
    return noGo(base, "authorization expired (now > expires_at)");
  }

  return candidate(base);
}

interface MutableBase {
  authorization_id: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorized_by_user: string;
  authorization_scope: HCCRealExecutionAuthorizationScope | "";
  issued_at: string;
  expires_at: string;
  dry_run_verdict: HCCRealExecutionDryRunVerdict | "";
  dry_run_artifact_hash: string;
}

function makeBaseResult(
  input: HCCRealExecutionAuthorizationInput,
): MutableBase {
  return {
    authorization_id: input.authorization_id ?? "",
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorized_by_user: input.authorized_by_user ?? "",
    authorization_scope:
      (input.authorization_scope as
        | HCCRealExecutionAuthorizationScope
        | "") ?? "",
    issued_at: input.issued_at ?? "",
    expires_at: input.expires_at ?? "",
    dry_run_verdict:
      (input.dry_run_verdict as HCCRealExecutionDryRunVerdict | "") ?? "",
    dry_run_artifact_hash: input.dry_run_artifact_hash ?? "",
  };
}

function candidate(
  base: MutableBase,
): HCCRealExecutionAuthorizationResult {
  return {
    schema_version: "1.0.0",
    verdict: "REAL-EXECUTION-AUTH-CANDIDATE",
    reason:
      "authorization record valid: scope=controlled_real_execution_candidate, dry_run_verdict=GO-CANDIDATE_DRY_RUN_PRODUCED, unexpired, one_shot=true",
    ...base,
    one_shot: false,
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
): HCCRealExecutionAuthorizationResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    ...base,
    one_shot: false,
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

function isIsoTimestamp(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

function isWithinWindow(
  issued_at: string,
  expires_at: string,
  nowIso: string,
): boolean {
  const issued = Date.parse(issued_at);
  const expires = Date.parse(expires_at);
  const now = Date.parse(nowIso);
  if (
    !Number.isFinite(issued) ||
    !Number.isFinite(expires) ||
    !Number.isFinite(now)
  ) {
    return false;
  }
  return now >= issued && now <= expires;
}
