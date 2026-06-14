// HCC Hermes Pro Plan Task Adapter.
//
// Pure adapter that converts a Hermes Pro plan task descriptor into a
// callControlledDryRun(input) invocation. The adapter is a library:
// nothing in this module starts the Auto Executor, executes any
// command, spawns a subprocess, writes to `~/.hermes/**`, registers
// IPC, or starts a timer.
//
// Per HCC governance (origin `ca43c7c`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//   - The adapter does NOT call `submitDryRunAction` (that is a
//     different surface held for a future slice)

import {
  callControlledDryRun,
  type DryRunCallInput,
  type DryRunCallResult,
} from "./hcc-controlled-dry-run-call-surface";
import type { HCCUnattendedGoNoGoInput } from "./hcc-unattended-go-no-go";

export const HCC_HERMES_PLAN_TASK_ADAPTER_SCHEMA_VERSION = "1.0.0" as const;

// -----------------------------------------------------------------
// Hermes Pro plan task descriptor (input)
// -----------------------------------------------------------------

export interface HermesPlanTaskAuthorization {
  /** Whether the user has explicitly authorized this task. */
  authorized: boolean;
  /** The user id who authorized. */
  user_id?: string;
  /** An authorization token issued by the user-explicit flow. */
  authorization_token?: string;
}

export interface HermesPlanTaskDescriptor {
  /** Stable id of the plan task. */
  task_id: string;
  /** Human-readable title of the plan task. */
  title: string;
  /** Reference to the source plan (e.g. plan id + entry id). */
  source_plan_ref: string;
  /** The user who requested the task. Required for the adapter. */
  requested_by_user: string;
  /** The explicit authorization record. Required. */
  authorization: HermesPlanTaskAuthorization;
  /**
   * Optional gate input override. When provided, takes precedence
   * over the call-surface mode resolution. The adapter is a pure
   * projection: it does not auto-arm the gate.
   */
  gate_input_override?: HCCUnattendedGoNoGoInput;
}

export type HermesPlanTaskAdapterVerdict =
  | "GO-CANDIDATE_DRY_RUN_PRODUCED"
  | "NO-GO";

export interface HermesPlanTaskAdapterResult {
  schema_version: "1.0.0";
  task_id: string;
  title: string;
  source_plan_ref: string;
  requested_by_user: string;
  /** The verifier the adapter produced. */
  verdict: HermesPlanTaskAdapterVerdict;
  /** Reason string. */
  reason: string;
  /** The surface result. */
  surface_result: DryRunCallResult;
  /** The artifact is a pure descriptor. */
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

// -----------------------------------------------------------------
// Adapter
// -----------------------------------------------------------------

/**
 * Convert a Hermes plan task descriptor into a call-surface input,
 * invoke the call surface, and return the result.
 *
 * Validation (all three gates are AND-combined):
 *   - Gate 1: If `requested_by_user` is empty, return NO-GO with
 *     reason "missing requested_by_user".
 *   - Gate 2: If `authorization.authorized` is not true, return NO-GO
 *     with reason "missing or false authorization".
 *   - Gate 3: `gate_input_override` is REQUIRED. Authorization is
 *     NOT a substitute for evidence. If the override is missing OR any
 *     of its `evidence_satisfied` / `verifier_satisfied` /
 *     `blockers_resolved` flags are not all true, return NO-GO with
 *     reason noting the missing/incomplete gate_input_override /
 *     evidence state.
 *   - Only when all three gates pass does the adapter dispatch to the
 *     call surface with
 *     `mode: "explicit_user_authorized_go_candidate"` and the
 *     explicit `explicit_user_authorization_record` set.
 *
 * The adapter never auto-arms, never calls submitDryRunAction, never
 * spawns a subprocess, never writes to `~/.hermes/**`. All execution
 * fields in the result are literal-false.
 */
export function adaptHermesPlanTaskToDryRun(
  task: HermesPlanTaskDescriptor,
): HermesPlanTaskAdapterResult {
  // Gate 1: requested_by_user must be non-empty.
  if (!task.requested_by_user || task.requested_by_user.trim().length === 0) {
    return makeNoGoResult(
      task,
      "missing requested_by_user — Hermes plan task must identify the requesting user",
    );
  }

  // Gate 2: explicit authorization must be recorded as true.
  if (!task.authorization || task.authorization.authorized !== true) {
    return makeNoGoResult(task, "missing or false authorization — Hermes plan task requires explicit_user_authorization_record.authorized=true");
  }

  // Gate 3: gate_input_override is REQUIRED and must be fully
  // satisfied. Authorization alone does NOT imply evidence satisfied.
  const gateResult = evaluateGateInputOverride(task.gate_input_override);
  if (gateResult.kind === "missing") {
    return makeNoGoResult(
      task,
      "missing gate_input_override — authorization is not a substitute for evidence; evidence state must be supplied explicitly",
    );
  }
  if (gateResult.kind === "incomplete") {
    return makeNoGoResult(
      task,
      `incomplete gate_input_override — evidence state not fully satisfied: ${gateResult.unsatisfied}`,
    );
  }

  // All three gates satisfied. Dispatch to call surface.
  const callInput: DryRunCallInput = {
    mode: "explicit_user_authorized_go_candidate",
    plan_execution_id: task.task_id,
    explicit_user_authorization_record: {
      authorized: true,
      user_id: task.authorization.user_id ?? task.requested_by_user,
      authorization_token: task.authorization.authorization_token,
    },
    ...(task.gate_input_override
      ? { gate_input_override: task.gate_input_override }
      : {}),
  };

  const surface_result = callControlledDryRun(callInput);

  // Re-project surface result to ensure all literal-false fields are
  // present even if the call surface returns an artifact that
  // omits any of them.
  const verdict: HermesPlanTaskAdapterVerdict =
    surface_result.artifact.verdict === "GO-CANDIDATE_DRY_RUN_PRODUCED"
      ? "GO-CANDIDATE_DRY_RUN_PRODUCED"
      : "NO-GO";

  const reason =
    verdict === "GO-CANDIDATE_DRY_RUN_PRODUCED"
      ? "explicit user authorization recorded + requested_by_user present; call surface returned GO-CANDIDATE_DRY_RUN_PRODUCED (not started)"
      : "explicit authorization + requested_by_user present, but call surface returned NO-GO";

  return {
    schema_version: "1.0.0",
    task_id: task.task_id,
    title: task.title,
    source_plan_ref: task.source_plan_ref,
    requested_by_user: task.requested_by_user,
    verdict,
    reason,
    surface_result,
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

/**
 * Build a NO-GO HermesPlanTaskAdapterResult without invoking the call
 * surface. Used when the adapter gates reject the task before dispatch.
 * Pure projection: literal-false execution fields, no I/O.
 */
function makeNoGoResult(
  task: HermesPlanTaskDescriptor,
  reason: string,
): HermesPlanTaskAdapterResult {
  return {
    schema_version: "1.0.0",
    task_id: task.task_id,
    title: task.title,
    source_plan_ref: task.source_plan_ref,
    requested_by_user: task.requested_by_user ?? "",
    verdict: "NO-GO",
    reason,
    surface_result: makeNoGoSurfaceResult(reason),
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

type GateOverrideEval =
  | { kind: "satisfied" }
  | { kind: "missing" }
  | { kind: "incomplete"; unsatisfied: string };

/**
 * Evaluate `gate_input_override`. Authorization is NOT evidence; the
 * override must be present AND fully satisfied across evidence,
 * verifier, and blockers.
 */
function evaluateGateInputOverride(
  override: HCCUnattendedGoNoGoInput | undefined,
): GateOverrideEval {
  if (!override) {
    return { kind: "missing" };
  }
  const unsatisfied: string[] = [];
  const ev = override.evidence_satisfied ?? {};
  const requiredEvidence: Array<[string, boolean | undefined]> = [
    ["real_action_whitelist_present", ev.real_action_whitelist_present],
    ["rollback_rehearsal_present", ev.rollback_rehearsal_present],
    ["budget_rate_limit_present", ev.budget_rate_limit_present],
    ["audit_artifact_persistence_present", ev.audit_artifact_persistence_present],
    ["rollback_rehearsal_passed", ev.rollback_rehearsal_passed],
    ["budget_caps_calibrated", ev.budget_caps_calibrated],
    ["audit_path_policy_valid", ev.audit_path_policy_valid],
  ];
  for (const [name, value] of requiredEvidence) {
    if (value !== true) {
      unsatisfied.push(`evidence.${name}=${String(value)}`);
    }
  }
  if ((override.verifier_satisfied?.verifier_required ?? false) !== true) {
    unsatisfied.push("verifier_satisfied.verifier_required!=true");
  }
  const bl = override.blockers_resolved ?? {};
  const requiredBlockers: Array<[string, boolean | undefined]> = [
    ["p3_real_execution_not_approved", bl.p3_real_execution_not_approved],
    ["hermes_config_write_not_approved", bl.hermes_config_write_not_approved],
    ["auto_executor_self_arming_forbidden", bl.auto_executor_self_arming_forbidden],
    ["night_run_ready_literal_false", bl.night_run_ready_literal_false],
  ];
  for (const [name, value] of requiredBlockers) {
    if (value !== true) {
      unsatisfied.push(`blockers.${name}=${String(value)}`);
    }
  }
  if (override.explicit_user_authorization_recorded !== true) {
    unsatisfied.push("explicit_user_authorization_recorded!=true");
  }
  if (unsatisfied.length > 0) {
    return { kind: "incomplete", unsatisfied: unsatisfied.join(", ") };
  }
  return { kind: "satisfied" };
}

/**
 * Build a NO-GO DryRunCallResult without invoking the call surface.
 * Used when the adapter gates reject the task before dispatch.
 */
function makeNoGoSurfaceResult(reason: string): DryRunCallResult {
  // Synthetic NO-GO result. The artifact is a stub with literal-false
  // execution fields. We do NOT call the call surface here; this is
  // a pure projection.
  return {
    schema_version: "1.0.0",
    mode: "default_no_go",
    artifact: {
      schema_version: "1.0.0",
      artifact_kind: "controlled_dry_run_entrypoint",
      verdict: "NO-GO",
      reason: reason,
      enablement: {
        schema_version: "1.0.0",
        gate_verdict: "NO-GO",
        go_candidate_but_not_started: false,
        contracts: {
          whitelist: {
            schema_version: "1.0.0",
            default_deny: true,
            total_entries: 0,
            allow_entries: 0,
            approval_entries: 0,
            deny_entries: 0,
            night_run_ready: false,
            go_no_go: "NO-GO",
            may_imply_unattended: false,
            may_touch_hermes_config: false,
            may_shell_spawn: false,
          },
          rollback_rehearsal: {
            schema_version: "1.0.0",
            allowed_strategies: [],
            forbidden_strategies: [],
            total_allowed: 0,
            total_forbidden: 0,
            would_execute: false,
            implies_real_execution: false,
            implies_unattended: false,
            night_run_ready: false,
            go_no_go: "NO-GO",
          },
          budget: {
            schema_version: "1.0.0",
            hard_limits: {
              max_task_count: 0,
              max_wall_clock_ms: 0,
              max_subprocess_count: 0,
              max_token_budget: 0,
              max_output_bytes: 0,
              max_failure_count: 0,
            },
            real_execution_ready: false,
            unattended_ready: false,
            night_run_ready: false,
            go_no_go: "NO-GO",
            implies_real_execution: false,
            implies_unattended: false,
            subprocess_count: 0,
          },
          audit_persistence: {
            schema_version: "1.0.0",
            allowed_prefix: "docs/audit/hcc",
            denied_prefixes: ["~/.hermes"],
            denied_exact: [],
            would_persist: false,
            executed_commands: [],
            real_execution_ready: false,
            unattended_ready: false,
            night_run_ready: false,
            go_no_go: "NO-GO",
          },
          unattended_gate: {
            schema_version: "1.0.0",
            unattended_ready: false,
            night_run_ready: false,
            go_no_go: "NO-GO",
            real_execution_ready: false,
            auto_executor_started: false,
            any_command_executed: false,
            any_file_written: false,
            total_evidence_gates: 0,
            total_verifier_gates: 0,
            total_blockers: 0,
          },
        },
        real_execution_ready: false,
        unattended_ready: false,
        night_run_ready: false,
        go_no_go: "NO-GO",
        auto_executor_started: false,
        any_command_executed: false,
        any_file_written: false,
        readiness_level: "controlled_executor_ready",
        generated_at: new Date(0).toISOString(),
      },
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
      generated_at: new Date(0).toISOString(),
    },
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    go_no_go: "NO-GO",
    generated_at: new Date(0).toISOString(),
  };
}