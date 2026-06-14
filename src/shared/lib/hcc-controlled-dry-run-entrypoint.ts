// HCC Controlled Dry-Run Entrypoint.
//
// Explicit user-authorized entrypoint that evaluates the enablement
// projection and, only when gate_verdict === "GO-CANDIDATE", produces
// a dry-run artifact. The artifact is a pure descriptor — nothing in
// this module starts the Auto Executor, executes any command, spawns
// any subprocess, writes to `~/.hermes/**`, registers IPC, or starts a
// timer.
//
// Entrypoint flow:
//   1. Call evaluateEnablement(gateInput)
//   2. Gate: gate_verdict must be "GO-CANDIDATE"
//   3. Produce DryRunArtifact with literal-false execution fields
//
// Hard constraints (all literal in source):
//   - would_execute: false
//   - executed_commands: []
//   - auto_executor_started: false
//   - any_command_executed: false
//   - real_execution_ready: false
//   - unattended_ready: false
//   - night_run_ready: false
//   - go_no_go: "NO-GO"

import {
  evaluateEnablement,
  allEvidenceSatisfied,
  allVerifiersSatisfied,
  allBlockersResolved,
  type HCCEnablementReport,
} from "./hcc-enablement";
import type { HCCUnattendedGoNoGoInput } from "./hcc-unattended-go-no-go";

export const HCC_DRY_RUN_ENTRYPOINT_SCHEMA_VERSION = "1.0.0" as const;

export type DryRunEntrypointVerdict =
  | "GO-CANDIDATE_DRY_RUN_PRODUCED"
  | "NO-GO";

export interface DryRunArtifact {
  schema_version: "1.0.0";
  artifact_kind: "controlled_dry_run_entrypoint";
  /** The entrypoint verdict. */
  verdict: DryRunEntrypointVerdict;
  /** Explanation. */
  reason: string;
  /** Underlying enablement report. */
  enablement: HCCEnablementReport;
  /** Literal: no command is ever invoked. */
  would_execute: false;
  /** Literal: always empty. */
  executed_commands: readonly [];
  /** Literal: always 0. */
  subprocess_count: 0;
  /** Literal. */
  auto_executor_started: false;
  /** Literal. */
  any_command_executed: false;
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** Literal. */
  go_no_go: "NO-GO";
  /** Literal. */
  readiness_level: "controlled_executor_ready";
  /** ISO 8601. */
  generated_at: string;
}

/**
 * Run the controlled dry-run entrypoint.
 *
 * Only produces a GO-CANDIDATE_DRY_RUN_PRODUCED result when the
 * underlying gate_verdict is "GO-CANDIDATE". In all other cases,
 * returns an artifact with verdict "NO-GO" and literal-false
 * execution fields.
 *
 * Even when the artifact has verdict GO-CANDIDATE_DRY_RUN_PRODUCED,
 * `auto_executor_started`, `would_execute`, `executed_commands`,
 * `real_execution_ready`, `unattended_ready`, `night_run_ready`,
 * `go_no_go`, and `any_command_executed` are all literal-false /
 * literal-0 in this source file. Editing the literal is the audit
 * signal.
 *
 * NEVER calls host.arm(), host.start(), host.runMockAction().
 * NEVER spawns a subprocess. NEVER writes ~/.hermes/**.
 */
export function runControlledDryRunEntrypoint(
  gateInput: HCCUnattendedGoNoGoInput,
): DryRunArtifact {
  const enablement = evaluateEnablement(gateInput);
  const generated_at = new Date().toISOString();

  if (enablement.gate_verdict !== "GO-CANDIDATE") {
    return {
      schema_version: "1.0.0",
      artifact_kind: "controlled_dry_run_entrypoint",
      verdict: "NO-GO",
      reason: `gate_verdict is '${enablement.gate_verdict}' — GO-CANDIDATE required. Reason: ${enablement.gate_verdict === "NO-GO" ? "at least one gate not satisfied" : "unknown"}`,
      enablement,
      would_execute: false,
      executed_commands: [],
      subprocess_count: 0,
      auto_executor_started: false,
      any_command_executed: false,
      real_execution_ready: false,
      unattended_ready: false,
      night_run_ready: false,
      go_no_go: "NO-GO",
      readiness_level: "controlled_executor_ready",
      generated_at,
    };
  }

  // GO-CANDIDATE — produce dry-run artifact.
  // NOTE: auto_executor_started=false. would_execute=false.
  // executed_commands=[]. This is a descriptor, not a runtime
  // transition. The actual start/execution sequence is held for
  // a future, separately-approved GO.
  return {
    schema_version: "1.0.0",
    artifact_kind: "controlled_dry_run_entrypoint",
    verdict: "GO-CANDIDATE_DRY_RUN_PRODUCED",
    reason: "gate_verdict is GO-CANDIDATE — dry-run artifact produced (not started)",
    enablement,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    readiness_level: "controlled_executor_ready",
    generated_at,
  };
}

/**
 * Shortcut: build gate input with all evidence satisfied, all
 * verifiers satisfied, all blockers resolved, and explicit user
 * authorization. Use only in tests (GO-CANDIDATE simulation).
 */
export function makeGoCandidateGateInput(): HCCUnattendedGoNoGoInput {
  return {
    evidence_satisfied: allEvidenceSatisfied(),
    verifier_satisfied: allVerifiersSatisfied(),
    blockers_resolved: allBlockersResolved(),
    explicit_user_authorization_recorded: true,
  };
}

export function makeNoGoGateInput(): HCCUnattendedGoNoGoInput {
  return {
    evidence_satisfied: {},
    verifier_satisfied: {},
    blockers_resolved: {},
    explicit_user_authorization_recorded: false,
  };
}