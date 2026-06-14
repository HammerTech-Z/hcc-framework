// HCC Unattended Execution Enablement Contract.
//
// Controlled, opt-in unattended execution enablement behind
// an explicit feature flag. This is the FINAL enablement
// contract in the HCC readiness track — it decides whether
// the system MAY consider a future unattended execution
// path. The contract itself NEVER executes anything, NEVER
// flips the actual `unattended_ready` to `true` at the
// executor level, and NEVER dispatches.
//
// The contract is a pure evaluator:
//   `evaluateUnattendedExecutionEnablement(input)`
// It returns either:
//   - `ENABLEMENT-CANDIDATE` with `unattended_ready_candidate: true`
//     when all 8 gates pass, OR
//   - `NO-GO` with a typed reason.
//
// Even on ENABLEMENT-CANDIDATE, the result keeps:
//   `unattended_ready: false`   (historical executor field)
//   `night_run_ready: false`    (type-level literal)
//   `go_no_go: "NO-GO"`         (type-level literal)
//   `auto_executor_started: false`
//
// A future slice that actually wires the unattended path
// MUST consume this contract AND the final controlled
// real dispatch AND the user-explicit trigger token, NOT
// replace them.
//
// Per HCC governance (origin `a501ea4`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - the enablement evaluator does NOT call `submitDryRunAction`
//   - Auto Executor must NOT self-arm or self-start

export const HCC_UNATTENDED_EXECUTION_ENABLEMENT_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedEnablementVerdict =
  | "ENABLEMENT-CANDIDATE"
  | "NO-GO";

export interface HCCUnattendedAuthorizationRecord {
  /** MUST be true for the authorization gate to pass. */
  authorized: boolean;
  /** Unique id of the authorization record. */
  authorization_id: string;
  /** The user who authorized the unattended execution. */
  authorized_by_user: string;
  /** Scope. Must be the controlled enablement scope. */
  scope: "controlled_unattended_enablement";
  /** ISO-8601. Must be <= now. */
  issued_at: string;
  /** ISO-8601. Must be > now. */
  expires_at: string;
}

const REQUIRED_AUTH_SCOPE = "controlled_unattended_enablement" as const;

export interface HCCUnattendedReadinessEvidence {
  /** Task-level evidence flags. */
  real_action_whitelist_present: boolean;
  rollback_rehearsal_present: boolean;
  budget_rate_limit_present: boolean;
  audit_artifact_persistence_present: boolean;
  rollback_rehearsal_passed: boolean;
  budget_caps_calibrated: boolean;
  audit_path_policy_valid: boolean;
  /** Verifier satisfied. */
  verifier_satisfied: boolean;
}

export interface HCCUnattendedBudgetCaps {
  /** Whether the budget caps are present. */
  present: boolean;
  /** Whether the budget is currently exceeded. */
  exceeded: boolean;
  /** Optional current budget usage as a fraction. */
  usage_fraction?: number;
}

export interface HCCUnattendedBlocker {
  /** Stable id of the blocker. */
  id: string;
  /** Whether the blocker is resolved. */
  resolved: boolean;
  /** Human-readable description of the blocker. */
  description: string;
}

export interface HCCUnattendedExecutionEnablementInput {
  /** Task / plan identity. */
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;

  /** Gate 1: Feature flag. */
  feature_flag_enabled: boolean;

  /** Gate 2: Explicit unattended authorization record. */
  authorization: HCCUnattendedAuthorizationRecord;

  /** Gate 3: Readiness evidence (mirrors dry-run evidence shape). */
  readiness_evidence: HCCUnattendedReadinessEvidence;

  /** Gate 4: Final controlled real dispatch must have produced its CANDIDATE. */
  final_dispatch_verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" | "NO-GO";

  /** Gate 5: Audit must have written. */
  audit_write_verdict: "AUDIT-ACTUAL-WRITTEN" | "AUDIT-ACTUAL-WRITE-CANDIDATE" | "NO-GO";

  /** Gate 6: Rollback must be a candidate. */
  rollback_candidate_verdict: "ROLLBACK-ACTUAL-RECOVERY-CANDIDATE" | "NO-GO";

  /** Gate 7: Budget / rate-limit caps. */
  budget: HCCUnattendedBudgetCaps;

  /** Gate 8: Blocker list. */
  blockers: readonly HCCUnattendedBlocker[];
}

export interface HCCUnattendedExecutionEnablementResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedEnablementVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  /** The candidate flag. ONLY true on ENABLEMENT-CANDIDATE. */
  unattended_ready_candidate: boolean;
  /** Historical executor fields. ALWAYS literal-false. */
  would_execute: false;
  executed_commands: readonly [];
  subprocess_count: 0;
  auto_executor_started: false;
  any_command_executed: false;
  real_execution_ready: false;
  /** The actual unattended_ready flag stays false here;
   *  the unattended_ready_candidate is the only field that
   *  flips on a fully-gated candidate. */
  unattended_ready: false;
  night_run_ready: false;
  go_no_go: "NO-GO";
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIsoTimestamp(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0) return false;
  return Number.isFinite(Date.parse(v));
}

/**
 * Pure evaluator. No I/O, no clock access except the
 * caller-supplied `nowIso` for expiry checks. Returns
 * either a CANDIDATE with `unattended_ready_candidate: true`
 * or a NO-GO with a descriptive reason.
 */
export function evaluateUnattendedExecutionEnablement(
  input: HCCUnattendedExecutionEnablementInput,
  nowIso: string,
): HCCUnattendedExecutionEnablementResult {
  // Gate 1: Feature flag.
  if (input.feature_flag_enabled !== true) {
    return noGo(input, "feature_flag_enabled must be true (unattended execution is opt-in)");
  }

  // Gate 2: Explicit unattended authorization.
  if (!isNonEmptyString(input.requested_by_user)) {
    return noGo(input, "missing requested_by_user");
  }
  if (!isNonEmptyString(input.source_plan_ref)) {
    return noGo(input, "missing source_plan_ref");
  }
  if (!input.authorization) {
    return noGo(input, "missing authorization record");
  }
  if (input.authorization.authorized !== true) {
    return noGo(input, "authorization.authorized must be true");
  }
  if (input.authorization.scope !== REQUIRED_AUTH_SCOPE) {
    return noGo(
      input,
      `authorization.scope must be "${REQUIRED_AUTH_SCOPE}"; got "${input.authorization.scope}"`,
    );
  }
  if (!isNonEmptyString(input.authorization.authorization_id)) {
    return noGo(input, "missing authorization.authorization_id");
  }
  if (!isNonEmptyString(input.authorization.authorized_by_user)) {
    return noGo(input, "missing authorization.authorized_by_user");
  }
  if (!isIsoTimestamp(input.authorization.issued_at)) {
    return noGo(input, "authorization.issued_at is not a valid ISO timestamp");
  }
  if (!isIsoTimestamp(input.authorization.expires_at)) {
    return noGo(input, "authorization.expires_at is not a valid ISO timestamp");
  }
  if (!(input.authorization.issued_at < input.authorization.expires_at)) {
    return noGo(input, "authorization.issued_at must be strictly less than expires_at");
  }
  if (!(withinWindow(input.authorization.issued_at, input.authorization.expires_at, nowIso))) {
    return noGo(input, "authorization expired (now > expires_at)");
  }

  // Gate 3: Readiness evidence (all must be true).
  const ev = input.readiness_evidence;
  if (ev.real_action_whitelist_present !== true) {
    return noGo(input, "readiness_evidence.real_action_whitelist_present must be true");
  }
  if (ev.rollback_rehearsal_present !== true) {
    return noGo(input, "readiness_evidence.rollback_rehearsal_present must be true");
  }
  if (ev.budget_rate_limit_present !== true) {
    return noGo(input, "readiness_evidence.budget_rate_limit_present must be true");
  }
  if (ev.audit_artifact_persistence_present !== true) {
    return noGo(input, "readiness_evidence.audit_artifact_persistence_present must be true");
  }
  if (ev.rollback_rehearsal_passed !== true) {
    return noGo(input, "readiness_evidence.rollback_rehearsal_passed must be true");
  }
  if (ev.budget_caps_calibrated !== true) {
    return noGo(input, "readiness_evidence.budget_caps_calibrated must be true");
  }
  if (ev.audit_path_policy_valid !== true) {
    return noGo(input, "readiness_evidence.audit_path_policy_valid must be true");
  }
  if (ev.verifier_satisfied !== true) {
    return noGo(input, "readiness_evidence.verifier_satisfied must be true");
  }

  // Gate 4: Final controlled real dispatch must be a CANDIDATE.
  if (input.final_dispatch_verdict !== "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE") {
    return noGo(
      input,
      `final_dispatch_verdict must be FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE; got "${input.final_dispatch_verdict}"`,
    );
  }

  // Gate 5: Audit must have written.
  if (input.audit_write_verdict !== "AUDIT-ACTUAL-WRITTEN") {
    return noGo(
      input,
      `audit_write_verdict must be AUDIT-ACTUAL-WRITTEN; got "${input.audit_write_verdict}"`,
    );
  }

  // Gate 6: Rollback must be a candidate.
  if (input.rollback_candidate_verdict !== "ROLLBACK-ACTUAL-RECOVERY-CANDIDATE") {
    return noGo(
      input,
      `rollback_candidate_verdict must be ROLLBACK-ACTUAL-RECOVERY-CANDIDATE; got "${input.rollback_candidate_verdict}"`,
    );
  }

  // Gate 7: Budget caps must be present and not exceeded.
  if (input.budget.present !== true) {
    return noGo(input, "budget.present must be true");
  }
  if (input.budget.exceeded === true) {
    return noGo(input, "budget.exceeded must be false");
  }

  // Gate 8: Blocker list must be empty or all resolved.
  const unresolved = input.blockers.filter((b) => b.resolved !== true);
  if (unresolved.length > 0) {
    return noGo(
      input,
      `unresolved blockers: ${unresolved.map((b) => b.id).join(", ")}`,
    );
  }

  // All 8 gates satisfied.
  return candidate(input);
}

function candidate(
  input: HCCUnattendedExecutionEnablementInput,
): HCCUnattendedExecutionEnablementResult {
  return {
    schema_version: "1.0.0",
    verdict: "ENABLEMENT-CANDIDATE",
    reason:
      "all 8 gates satisfied: feature_flag, authorization, readiness_evidence, final_dispatch, audit_write, rollback, budget, blockers; unattended_ready_candidate is true, actual unattended_ready remains false",
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization.authorization_id,
    unattended_ready_candidate: true,
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
  input: HCCUnattendedExecutionEnablementInput,
  reason: string,
): HCCUnattendedExecutionEnablementResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization?.authorization_id ?? "",
    unattended_ready_candidate: false,
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

function withinWindow(
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
