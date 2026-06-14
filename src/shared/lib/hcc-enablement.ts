// HCC Enablement — wiring all unattended-readiness contracts.
//
// Aggregates the posture of all five contracts + the gate contract into
// a single enablement report. The report is a pure projection: nothing
// in this module starts the Auto Executor, executes any command, writes
// to `~/.hermes/**`, registers IPC, or starts a timer.
//
// The enablement report is rooted in these invariants (all literal):
//   - real_execution_ready: false
//   - unattended_ready: false
//   - night_run_ready: false
//   - auto_executor_started: false
//   - any_command_executed: false
//   - any_file_written: false
//
// Even when the unattended gate returns GO-CANDIDATE, the enablement
// report records `go_candidate_but_not_started: true` and does NOT
// auto-start. The enablement verdict is a descriptor, not a runtime
// transition.

import { getHccRealActionWhitelistPosture } from "./hcc-real-action-whitelist";
import { getHccRollbackRehearsalPosture } from "./hcc-rollback-rehearsal";
import { getHccBudgetPosture } from "./hcc-budget-rate-limit";
import { getAuditArtifactPersistencePosture } from "./hcc-audit-artifact-persistence";
import {
  evaluateUnattendedGoNoGo,
  getUnattendedGoNoGoPosture,
  type HCCUnattendedGoNoGoInput,
  type HCCUnattendedGoNoGoReport,
} from "./hcc-unattended-go-no-go";

export const HCC_ENABLEMENT_SCHEMA_VERSION = "1.0.0" as const;

// -----------------------------------------------------------------
// Enablement posture (aggregated)
// -----------------------------------------------------------------

export interface HCCEnablementReport {
  schema_version: "1.0.0";
  /** The unattended gate verdict. */
  gate_verdict: string;
  /** GO-CANDIDATE from the gate does NOT mean started. */
  go_candidate_but_not_started: boolean;
  /** Posture from each contract. */
  contracts: {
    whitelist: ReturnType<typeof getHccRealActionWhitelistPosture>;
    rollback_rehearsal: ReturnType<typeof getHccRollbackRehearsalPosture>;
    budget: ReturnType<typeof getHccBudgetPosture>;
    audit_persistence: ReturnType<typeof getAuditArtifactPersistencePosture>;
    unattended_gate: ReturnType<typeof getUnattendedGoNoGoPosture>;
  };
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** Current production posture: always NO-GO. */
  go_no_go: "NO-GO";
  /** Literal. */
  auto_executor_started: false;
  /** Literal. */
  any_command_executed: false;
  /** Literal. */
  any_file_written: false;
  /** Literal. */
  readiness_level: "controlled_executor_ready";
  /** ISO 8601. */
  generated_at: string;
}

/**
 * Evaluate the full enablement path. Returns an aggregated report.
 * The gate contract's `evaluateUnattendedGoNoGo` is called with the
 * caller-supplied input. If the input has all evidence + verifiers +
 * blockers + auth satisfied, the gate returns GO-CANDIDATE, which the
 * enablement report records as `go_candidate_but_not_started: true`.
 *
 * Even at GO-CANDIDATE, the enablement report has literal-false for
 * all execution fields. The enablement path is a *descriptor*, not a
 * runtime transition.
 */
export function evaluateEnablement(
  gateInput: HCCUnattendedGoNoGoInput,
): HCCEnablementReport {
  const gateReport: HCCUnattendedGoNoGoReport =
    evaluateUnattendedGoNoGo(gateInput);

  return {
    schema_version: "1.0.0",
    gate_verdict: gateReport.verdict,
    go_candidate_but_not_started: gateReport.verdict === "GO-CANDIDATE",
    contracts: {
      whitelist: getHccRealActionWhitelistPosture(),
      rollback_rehearsal: getHccRollbackRehearsalPosture(),
      budget: getHccBudgetPosture(),
      audit_persistence: getAuditArtifactPersistencePosture(),
      unattended_gate: getUnattendedGoNoGoPosture(),
    },
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    auto_executor_started: false,
    any_command_executed: false,
    any_file_written: false,
    readiness_level: "controlled_executor_ready",
    generated_at: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------
// Helpers for constructing gate input with all evidence satisfied
// -----------------------------------------------------------------

import {
  HCC_UNATTENDED_EVIDENCE_GATES,
  HCC_UNATTENDED_VERIFIER_GATES,
  HCC_UNATTENDED_BLOCKERS,
} from "./hcc-unattended-go-no-go";

export function allEvidenceSatisfied(): Record<string, true> {
  const r: Record<string, true> = {};
  for (const g of HCC_UNATTENDED_EVIDENCE_GATES) r[g.id] = true;
  return r;
}

export function allVerifiersSatisfied(): Record<string, true> {
  const r: Record<string, true> = {};
  for (const g of HCC_UNATTENDED_VERIFIER_GATES) r[g.id] = true;
  return r;
}

export function allBlockersResolved(): Record<string, true> {
  const r: Record<string, true> = {};
  for (const b of HCC_UNATTENDED_BLOCKERS) r[b.id] = true;
  return r;
}
