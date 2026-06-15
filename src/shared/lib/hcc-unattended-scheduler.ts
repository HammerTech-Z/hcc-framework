// HCC Controlled Unattended Scheduler.
//
// This is the **scheduler contract only** slice (HCC-UNATTENDED-SCHEDULER-001).
// It consumes the prior unattended runner
// (`runUnattendedControlledDispatch` from `df52642`) and adds a
// controlled gate layer in front of it.
//
// Per HCC governance (preflight `hcc-unattended-scheduler-preflight-2026-06-15`):
//   - The scheduler is a pure async facade. It performs NO I/O.
//   - Actual dispatch is delegated through the existing injected
//     `dispatch_adapter` path that the runner already uses.
//   - The scheduler NEVER calls spawn / exec / child_process /
//     submitDryRunAction.
//   - The scheduler does NOT import bootstrap / arm / start / host.
//   - The scheduler does NOT trigger app boot / timer / cron /
//     setInterval / setTimeout / auto-arm.
//   - There is NO product wiring in this slice. The export is
//     referenced only by tests; no entrypoint imports it.
//   - Even on success the scheduler preserves the runner's
//     `night_run_ready: false`, `go_no_go: "NO-GO"`, and
//     `auto_executor_started: false` literals.
//   - The scheduler must NOT set `go_no_go: "GO"`. The
//     `go_no_go: "NO-GO"` literal is preserved from the runner.

import {
  runUnattendedControlledDispatch,
  type HCCUnattendedPlannedAction,
  type HCCUnattendedRunnerResult,
} from "./hcc-unattended-runner";
import type {
  HCCFinalControlledRealDispatchAdapter,
} from "./hcc-final-controlled-real-dispatch";
import type {
  HCCUnattendedReadyConsumerResult,
} from "./hcc-unattended-ready-consumer";

export const HCC_UNATTENDED_SCHEDULER_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedSchedulerVerdict =
  | "CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED"
  | "NO-GO";

/**
 * Explicit scheduler window. The scheduler refuses to run if the
 * window is missing or malformed. The window is descriptive only;
 * the scheduler does NOT compare against wall-clock and does NOT
 * create a timer. The window is a contract that a future host may
 * check before invoking `scheduleControlledUnattendedRun`.
 */
export interface HCCUnattendedSchedulerWindow {
  start_iso: string;
  end_iso: string;
  /** IANA timezone identifier, e.g. "Asia/Shanghai". */
  tz: string;
}

export interface HCCUnattendedSchedulerBudget {
  present: boolean;
  exceeded: boolean;
}

export interface HCCUnattendedSchedulerInput {
  /** Required, non-empty. The scheduler's own id. */
  schedule_id: string;
  /** Required, non-empty, descriptive only. The scheduler is a contract, not a clock. */
  scheduler_window: HCCUnattendedSchedulerWindow;
  /** Task / plan identity, must match `ready_result`. */
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  /** Required, non-empty. Must match `ready_result.authorization_id`. */
  authorization_id: string;
  /** Re-asserted defensive feature flag. */
  feature_flag_enabled: boolean;
  /** Required, must be UNATTENDED-READY-CANDIDATE with `unattended_ready: true`. */
  ready_result: HCCUnattendedReadyConsumerResult;
  /** Required, structurally valid, with a supported kind. */
  planned_action: HCCUnattendedPlannedAction;
  /** Required, present, not exceeded. */
  budget: HCCUnattendedSchedulerBudget;
  /** Required, all blockers must be resolved. */
  blockers_resolved: boolean;
  /** Required, injected dispatch adapter. */
  dispatch_adapter: HCCFinalControlledRealDispatchAdapter;
}

export interface HCCUnattendedSchedulerResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedSchedulerVerdict;
  reason: string;
  schedule_id: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind: string;
  /** Forwarded from the runner on success; literal-false / empty on NO-GO. */
  controlled_command_id: string;
  /** Side-effect fields. Forwarded from the runner on success; literal on NO-GO. */
  any_command_executed: boolean;
  executed_commands: readonly string[];
  subprocess_count: number;
  /** Executor side-effect fields. ALWAYS literal-false / literal "NO-GO". */
  would_execute: false;
  auto_executor_started: false;
  unattended_ready: boolean;
  night_run_ready: false;
  go_no_go: "NO-GO";
  real_execution_ready: false;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isSupportedPlannedActionKind(
  v: unknown,
): v is HCCUnattendedPlannedAction["planned_action_kind"] {
  return v === "shell_command" || v === "file_write" || v === "config_patch";
}

function isValidSchedulerWindow(
  v: unknown,
): v is HCCUnattendedSchedulerWindow {
  if (!v || typeof v !== "object") return false;
  const w = v as Record<string, unknown>;
  return (
    isNonEmptyString(w.start_iso) &&
    isNonEmptyString(w.end_iso) &&
    isNonEmptyString(w.tz)
  );
}

/**
 * Controlled unattended scheduler. Async facade.
 *
 * All gates evaluated synchronously up front. NO-GO short-circuits
 * before the runner is invoked. On success, the runner is awaited
 * and its result is forwarded with the scheduler's identity fields
 * added (`schedule_id`).
 */
export async function scheduleControlledUnattendedRun(
  input: HCCUnattendedSchedulerInput,
): Promise<HCCUnattendedSchedulerResult> {
  // Defensive identity / presence checks for the scheduler's own fields.
  if (!isNonEmptyString(input.schedule_id)) {
    return noGo(input, "missing schedule_id");
  }
  if (!isValidSchedulerWindow(input.scheduler_window)) {
    return noGo(input, "missing or malformed scheduler_window");
  }
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

  // Gate 1: feature flag.
  if (input.feature_flag_enabled !== true) {
    return noGo(input, "feature_flag_enabled must be true");
  }

  // Gate 2: ready_result verdict + readiness flag.
  if (input.ready_result.verdict !== "UNATTENDED-READY-CANDIDATE") {
    return noGo(
      input,
      `ready_result.verdict must be UNATTENDED-READY-CANDIDATE; got "${String(
        input.ready_result.verdict,
      )}"`,
    );
  }
  if (input.ready_result.unattended_ready !== true) {
    return noGo(input, "ready_result.unattended_ready must be true");
  }

  // Gate 3: authorization_id matches the ready/runner identity.
  if (input.ready_result.authorization_id !== input.authorization_id) {
    return noGo(
      input,
      "ready_result.authorization_id does not match input.authorization_id",
    );
  }

  // Identity cross-checks between the scheduler input and the
  // ready_result. These mirror the runner's own cross-checks; failing
  // them here short-circuits before the runner is invoked.
  if (input.ready_result.task_id !== input.task_id) {
    return noGo(input, "ready_result.task_id does not match input.task_id");
  }
  if (input.ready_result.source_plan_ref !== input.source_plan_ref) {
    return noGo(
      input,
      "ready_result.source_plan_ref does not match input.source_plan_ref",
    );
  }
  if (input.ready_result.requested_by_user !== input.requested_by_user) {
    return noGo(
      input,
      "ready_result.requested_by_user does not match input.requested_by_user",
    );
  }

  // Gate 4: budget.
  if (!input.budget || input.budget.present !== true) {
    return noGo(input, "budget.present must be true");
  }
  if (input.budget.exceeded === true) {
    return noGo(input, "budget.exceeded must be false");
  }

  // Gate 5: blockers.
  if (input.blockers_resolved !== true) {
    return noGo(input, "blockers_resolved must be true");
  }

  // Gate 6: planned_action identity + supported kind.
  if (!input.planned_action) {
    return noGo(input, "missing planned_action");
  }
  if (!isNonEmptyString(input.planned_action.planned_action_id)) {
    return noGo(input, "missing planned_action.planned_action_id");
  }
  if (
    !isSupportedPlannedActionKind(input.planned_action.planned_action_kind)
  ) {
    return noGo(
      input,
      `unsupported planned_action.planned_action_kind: "${String(
        input.planned_action.planned_action_kind,
      )}"`,
    );
  }
  if (!isNonEmptyString(input.planned_action.target_path)) {
    return noGo(input, "missing planned_action.target_path");
  }

  // Gate 7: dispatch_adapter present + structurally valid.
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
  if (
    adapter.supportsKind(input.planned_action.planned_action_kind) !== true
  ) {
    return noGo(
      input,
      `dispatch_adapter does not support planned_action_kind "${input.planned_action.planned_action_kind}"`,
    );
  }

  // All 7 scheduler gates satisfied. Delegate to the runner.
  // The runner is awaited; the scheduler itself remains a pure
  // facade (no I/O of its own). If the runner throws (it never
  // should — the runner already catches adapter throws) we surface
  // a typed NO-GO.
  let runnerResult: HCCUnattendedRunnerResult;
  try {
    runnerResult = await runUnattendedControlledDispatch({
      task_id: input.task_id,
      source_plan_ref: input.source_plan_ref,
      requested_by_user: input.requested_by_user,
      authorization_id: input.authorization_id,
      feature_flag_enabled: input.feature_flag_enabled,
      ready_result: input.ready_result,
      planned_action: input.planned_action,
      dispatch_adapter: input.dispatch_adapter,
    });
  } catch (err) {
    return noGo(
      input,
      `runUnattendedControlledDispatch raised: ${
        (err as Error).message ?? String(err)
      }`,
    );
  }

  if (runnerResult.verdict !== "CONTROLLED-UNATTENDED-RUNNER-DISPATCHED") {
    return noGo(
      input,
      `runUnattendedControlledDispatch returned NO-GO: ${runnerResult.reason}`,
    );
  }

  return dispatched(input, runnerResult);
}

function dispatched(
  input: HCCUnattendedSchedulerInput,
  runner: HCCUnattendedRunnerResult,
): HCCUnattendedSchedulerResult {
  return {
    schema_version: "1.0.0",
    verdict: "CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED",
    reason:
      "all scheduler gates satisfied (schedule_id, scheduler_window, feature_flag, authorization match, budget, blockers, ready_candidate, planned_action, adapter supportsKind) and the runner dispatched through the injected adapter; side-effect fields reflect the injected adapter result",
    schedule_id: input.schedule_id,
    task_id: runner.task_id,
    source_plan_ref: runner.source_plan_ref,
    requested_by_user: runner.requested_by_user,
    authorization_id: runner.authorization_id,
    planned_action_id: runner.planned_action_id,
    planned_action_kind: runner.planned_action_kind,
    controlled_command_id: runner.controlled_command_id,
    any_command_executed: runner.any_command_executed,
    executed_commands: runner.executed_commands,
    subprocess_count: runner.subprocess_count,
    would_execute: false,
    auto_executor_started: false,
    unattended_ready: runner.unattended_ready,
    night_run_ready: false,
    go_no_go: "NO-GO",
    real_execution_ready: false,
  };
}

function noGo(
  input: HCCUnattendedSchedulerInput,
  reason: string,
): HCCUnattendedSchedulerResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    schedule_id: input.schedule_id ?? "",
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization_id ?? "",
    planned_action_id: input.planned_action?.planned_action_id ?? "",
    planned_action_kind: (input.planned_action?.planned_action_kind as
      | HCCUnattendedPlannedAction["planned_action_kind"]
      | "") ?? "",
    controlled_command_id: "",
    any_command_executed: false,
    executed_commands: [],
    subprocess_count: 0,
    would_execute: false,
    auto_executor_started: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    real_execution_ready: false,
  };
}
