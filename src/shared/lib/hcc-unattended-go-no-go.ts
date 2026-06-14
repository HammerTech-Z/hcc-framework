// HCC Unattended Execution GO/NO-GO — first version contract.
//
// Final gate before unattended execution would be permitted. This is a
// **contract only**: the module evaluates evidence and explicit user
// authorization and reports a verdict. Nothing in this module starts
// the Auto Executor, executes any command, writes to `~/.hermes/**`,
// registers IPC, or starts a timer.
//
// Default verdict: NO-GO. The verdict GO-CANDIDATE is only returned
// when ALL evidence gates are satisfied=true AND explicit user
// authorization is recorded. Even at GO-CANDIDATE, no real execution
// occurs; the verdict is a descriptor, not a runtime transition.
//
// Per HCC governance (origin `acc156d`):
//   - real execution NOT APPROVED / NO-GO
//   - unattended execution NOT APPROVED / NO-GO
//   - `~/.hermes/**` write NOT APPROVED / NO-GO
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal

export const HCC_UNATTENDED_GO_NO_GO_SCHEMA_VERSION = "1.0.0" as const;

// -----------------------------------------------------------------
// Evidence gate
// -----------------------------------------------------------------

export interface HCCUnattendedEvidenceGate {
  id: string;
  description: string;
  /** Whether the evidence exists and has been verified. */
  satisfied: boolean;
  /** Reference to the evidence artifact. */
  evidence_ref: string;
}

export interface HCCUnattendedVerifierGate {
  id: string;
  description: string;
  /** Whether the verifier has run and passed. */
  satisfied: boolean;
  /** Path to the verifier report. */
  verifier_ref: string;
}

export interface HCCUnattendedBlocker {
  id: string;
  description: string;
  /** Whether this blocker is resolved. */
  resolved: boolean;
}

// -----------------------------------------------------------------
// Verdict
// -----------------------------------------------------------------

export type HCCUnattendedVerdict = "NO-GO" | "GO-CANDIDATE";

export interface HCCUnattendedGoNoGoReport {
  schema_version: "1.0.0";
  /** The verdict. Default NO-GO. */
  verdict: HCCUnattendedVerdict;
  /** The reason string. */
  reason: string;
  /** Evidence gates (all must be satisfied for GO-CANDIDATE). */
  evidence_gates: readonly HCCUnattendedEvidenceGate[];
  /** Verifier gates (all must be satisfied for GO-CANDIDATE). */
  verifier_gates: readonly HCCUnattendedVerifierGate[];
  /** Blockers still unresolved. */
  blockers: readonly HCCUnattendedBlocker[];
  /** The explicit user authorization flag. */
  explicit_user_authorization_recorded: boolean;
  /** Literal: the contract does NOT start the executor. */
  auto_executor_started: false;
  /** Literal: no command was ever executed. */
  any_command_executed: false;
  /** Literal: no file was ever written. */
  any_file_written: false;
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** ISO 8601. */
  generated_at: string;
}

// -----------------------------------------------------------------
// Default evidence matrix
// -----------------------------------------------------------------

export const HCC_UNATTENDED_EVIDENCE_GATES: readonly HCCUnattendedEvidenceGate[] = [
  {
    id: "real_action_whitelist_present",
    description: "Real action whitelist contract landed on origin",
    satisfied: false,
    evidence_ref: "src/shared/lib/hcc-real-action-whitelist.ts (origin ec1e8fe)",
  },
  {
    id: "rollback_rehearsal_present",
    description: "Rollback rehearsal contract landed on origin",
    satisfied: false,
    evidence_ref: "src/shared/lib/hcc-rollback-rehearsal.ts (origin 99ce2de)",
  },
  {
    id: "budget_rate_limit_present",
    description: "Budget / rate limit contract landed on origin",
    satisfied: false,
    evidence_ref: "src/shared/lib/hcc-budget-rate-limit.ts (origin c5b769b)",
  },
  {
    id: "audit_artifact_persistence_present",
    description: "Audit artifact persistence contract landed on origin",
    satisfied: false,
    evidence_ref: "src/shared/lib/hcc-audit-artifact-persistence.ts (origin acc156d)",
  },
  {
    id: "rollback_rehearsal_passed",
    description: "At least one rollback rehearsal PASS in test (38/38, origin 99ce2de)",
    satisfied: false,
    evidence_ref: "tests/auto-executor/hcc-rollback-rehearsal.test.ts",
  },
  {
    id: "budget_caps_calibrated",
    description: "Budget hard caps calibrated (nominal defaults at c5b769b)",
    satisfied: false,
    evidence_ref: "src/shared/lib/hcc-budget-rate-limit.ts (HCC_BUDGET_HARD_LIMITS literal)",
  },
  {
    id: "audit_path_policy_valid",
    description: "Audit path policy denies ~/.hermes, src/*, and package files (28/28 tests)",
    satisfied: false,
    evidence_ref: "tests/auto-executor/hcc-audit-artifact-persistence.test.ts",
  },
];

export const HCC_UNATTENDED_VERIFIER_GATES: readonly HCCUnattendedVerifierGate[] = [
  {
    id: "verifier_required",
    description: "Verifier is mandatory before any GO-CANDIDATE can be issued",
    satisfied: false,
    verifier_ref: "docs/p3-010/p3-010-verifier-report-2026-06-13.md",
  },
];

export const HCC_UNATTENDED_BLOCKERS: readonly HCCUnattendedBlocker[] = [
  {
    id: "p3_real_execution_not_approved",
    description: "P3 real execution remains NOT APPROVED",
    resolved: false,
  },
  {
    id: "hermes_config_write_not_approved",
    description: "~/.hermes/** write remains NOT APPROVED",
    resolved: false,
  },
  {
    id: "auto_executor_self_arming_forbidden",
    description: "Auto Executor must NOT self-arm or self-start",
    resolved: false,
  },
  {
    id: "night_run_ready_literal_false",
    description: "night_run_ready is a type-level false literal in src/shared/lib/hcc-controlled-executor.ts",
    resolved: false,
  },
];

// -----------------------------------------------------------------
// Decision function
// -----------------------------------------------------------------

export interface HCCUnattendedGoNoGoInput {
  /** Whether the evidence gates are satisfied. */
  evidence_satisfied: Record<string, boolean | undefined>;
  /** Whether the verifier gates are satisfied. */
  verifier_satisfied: Record<string, boolean | undefined>;
  /** Whether explicit user authorization is recorded. Default false. */
  explicit_user_authorization_recorded?: boolean;
  /** Whether any blocker is resolved. Default false. */
  blockers_resolved: Record<string, boolean | undefined>;
}

/**
 * Evaluate the unattended execution gate. Default NO-GO.
 *
 * GO-CANDIDATE is only returned when:
 *   (a) ALL evidence gates are satisfied=true
 *   (b) ALL verifier gates are satisfied=true
 *   (c) ALL blockers are resolved=true
 *   (d) explicit_user_authorization_recorded === true
 *
 * Even at GO-CANDIDATE, the contract does NOT start the executor.
 */
export function evaluateUnattendedGoNoGo(
  input: HCCUnattendedGoNoGoInput,
): HCCUnattendedGoNoGoReport {
  const generated_at = new Date().toISOString();

  const explicitAuth = input.explicit_user_authorization_recorded ?? false;

  // Resolve evidence gates.
  const resolvedEvidence: HCCUnattendedEvidenceGate[] =
    HCC_UNATTENDED_EVIDENCE_GATES.map((g) => ({
      ...g,
      satisfied: input.evidence_satisfied[g.id] === true,
    }));

  const resolvedVerifiers: HCCUnattendedVerifierGate[] =
    HCC_UNATTENDED_VERIFIER_GATES.map((g) => ({
      ...g,
      satisfied: input.verifier_satisfied[g.id] === true,
    }));

  const resolvedBlockers: HCCUnattendedBlocker[] = HCC_UNATTENDED_BLOCKERS.map(
    (b) => ({
      ...b,
      resolved: input.blockers_resolved[b.id] === true,
    }),
  );

  // Gate 1: explicit user authorization.
  if (!explicitAuth) {
    return {
      schema_version: "1.0.0",
      verdict: "NO-GO",
      reason: "explicit_user_authorization_recorded is false — unattended execution requires explicit user authorization",
      evidence_gates: resolvedEvidence,
      verifier_gates: resolvedVerifiers,
      blockers: resolvedBlockers,
      explicit_user_authorization_recorded: explicitAuth,
      auto_executor_started: false,
      any_command_executed: false,
      any_file_written: false,
      real_execution_ready: false,
      unattended_ready: false,
      night_run_ready: false,
      generated_at,
    };
  }

  // Gate 2: all evidence gates must be satisfied.
  const missingEvidence = resolvedEvidence.filter((e) => !e.satisfied);
  if (missingEvidence.length > 0) {
    return {
      schema_version: "1.0.0",
      verdict: "NO-GO",
      reason: `${missingEvidence.length} evidence gate(s) unsatisfied: ${missingEvidence.map((e) => e.id).join(", ")}`,
      evidence_gates: resolvedEvidence,
      verifier_gates: resolvedVerifiers,
      blockers: resolvedBlockers,
      explicit_user_authorization_recorded: explicitAuth,
      auto_executor_started: false,
      any_command_executed: false,
      any_file_written: false,
      real_execution_ready: false,
      unattended_ready: false,
      night_run_ready: false,
      generated_at,
    };
  }

  // Gate 3: all verifier gates must be satisfied.
  const missingVerifiers = resolvedVerifiers.filter((v) => !v.satisfied);
  if (missingVerifiers.length > 0) {
    return {
      schema_version: "1.0.0",
      verdict: "NO-GO",
      reason: `${missingVerifiers.length} verifier gate(s) unsatisfied: ${missingVerifiers.map((v) => v.id).join(", ")}`,
      evidence_gates: resolvedEvidence,
      verifier_gates: resolvedVerifiers,
      blockers: resolvedBlockers,
      explicit_user_authorization_recorded: explicitAuth,
      auto_executor_started: false,
      any_command_executed: false,
      any_file_written: false,
      real_execution_ready: false,
      unattended_ready: false,
      night_run_ready: false,
      generated_at,
    };
  }

  // Gate 4: all blockers must be resolved.
  const unresolvedBlockers = resolvedBlockers.filter((b) => !b.resolved);
  if (unresolvedBlockers.length > 0) {
    return {
      schema_version: "1.0.0",
      verdict: "NO-GO",
      reason: `${unresolvedBlockers.length} blocker(s) unresolved: ${unresolvedBlockers.map((b) => b.id).join(", ")}`,
      evidence_gates: resolvedEvidence,
      verifier_gates: resolvedVerifiers,
      blockers: resolvedBlockers,
      explicit_user_authorization_recorded: explicitAuth,
      auto_executor_started: false,
      any_command_executed: false,
      any_file_written: false,
      real_execution_ready: false,
      unattended_ready: false,
      night_run_ready: false,
      generated_at,
    };
  }

  // All gates satisfied + explicit authorization → GO-CANDIDATE.
  // NOTE: GO-CANDIDATE is NOT the same as "started." The contract
  // still records literal-false for all execution fields.
  return {
    schema_version: "1.0.0",
    verdict: "GO-CANDIDATE",
    reason: "all evidence + verifier + blocker gates satisfied, explicit user authorization recorded — GO-CANDIDATE (not started)",
    evidence_gates: resolvedEvidence,
    verifier_gates: resolvedVerifiers,
    blockers: resolvedBlockers,
    explicit_user_authorization_recorded: explicitAuth,
    auto_executor_started: false,
    any_command_executed: false,
    any_file_written: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    generated_at,
  };
}

// -----------------------------------------------------------------
// Posture
// -----------------------------------------------------------------

export interface HCCUnattendedGoNoGoPosture {
  schema_version: "1.0.0";
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** Current production posture: always NO-GO. */
  go_no_go: "NO-GO";
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  auto_executor_started: false;
  /** Literal. */
  any_command_executed: false;
  /** Literal. */
  any_file_written: false;
  total_evidence_gates: number;
  total_verifier_gates: number;
  total_blockers: number;
}

export function getUnattendedGoNoGoPosture(): HCCUnattendedGoNoGoPosture {
  return {
    schema_version: "1.0.0",
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    real_execution_ready: false,
    auto_executor_started: false,
    any_command_executed: false,
    any_file_written: false,
    total_evidence_gates: HCC_UNATTENDED_EVIDENCE_GATES.length,
    total_verifier_gates: HCC_UNATTENDED_VERIFIER_GATES.length,
    total_blockers: HCC_UNATTENDED_BLOCKERS.length,
  };
}