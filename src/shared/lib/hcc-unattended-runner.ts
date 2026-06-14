// HCC Unattended Runner.
//
// First controlled unattended runner. Consumes the
// UNATTENDED-READY-CANDIDATE from
// `HCC-UNATTENDED-READY-CONSUMER-001` and dispatches the
// planned action through the injected dispatch adapter.
//
// Per HCC governance (origin `d693116`):
//   - The runner is the first slice allowed to actually
//     perform the controlled unattended dispatch. The flip
//     of `unattended_ready: true` is gated on the prior
//     consumer's verdict.
//   - The runner NEVER calls spawn / exec / child_process /
//     submitDryRunAction. The dispatch adapter is fully
//     injected; the lib never imports bootstrap / arm /
//     start / host.
//   - The runner must NOT trigger app boot / CLI / renderer /
//     preload / ipcMain registration / timer / cron /
//     auto-arm. There is no product wiring in this slice.
//   - Even on success, the runner keeps `night_run_ready:
//     false`, `go_no_go: "NO-GO"`, and
//     `auto_executor_started: false`. The flip of
//     `unattended_ready: true` is owned by the prior
//     consumer slice.

import type {
  HCCUnattendedReadyConsumerResult,
} from "./hcc-unattended-ready-consumer";
import type {
  HCCFinalControlledRealDispatchAdapter,
} from "./hcc-final-controlled-real-dispatch";

export const HCC_UNATTENDED_RUNNER_SCHEMA_VERSION = "1.0.0" as const;

export type HCCUnattendedDispatchActionKind =
  | "shell_command"
  | "file_write"
  | "config_patch";

export type HCCUnattendedRunnerVerdict =
  | "CONTROLLED-UNATTENDED-RUNNER-DISPATCHED"
  | "NO-GO";

export interface HCCUnattendedPlannedAction {
  planned_action_id: string;
  planned_action_kind: HCCUnattendedDispatchActionKind;
  target_path: string;
}

export interface HCCUnattendedRunnerInput {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  /** Defensive re-assertion; the consumer already checked it. */
  feature_flag_enabled: boolean;
  ready_result: HCCUnattendedReadyConsumerResult;
  planned_action: HCCUnattendedPlannedAction;
  /**
   * Injected dispatch adapter. The lib never calls
   * spawn / exec / child_process directly. Production
   * wiring supplies the real adapter; tests inject mocks.
   */
  dispatch_adapter: HCCFinalControlledRealDispatchAdapter;
}

export interface HCCUnattendedRunnerResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedRunnerVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind: HCCUnattendedDispatchActionKind | "";
  controlled_command_id: string;
  /** Side-effect fields. ONLY true on a dispatched result. */
  any_command_executed: boolean;
  executed_commands: readonly string[];
  subprocess_count: number;
  /** Executor side-effect fields. ALWAYS literal-false. */
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

function isSupportedKind(v: unknown): v is HCCUnattendedDispatchActionKind {
  return v === "shell_command" || v === "file_write" || v === "config_patch";
}

/**
 * Controlled unattended runner. Async. The runner consumes
 * the prior consumer's UNATTENDED-READY-CANDIDATE and
 * dispatches through the injected adapter.
 *
 * NO-GO on any failed gate; the adapter is never called.
 * Catches adapter throws and surfaces them as a typed
 * NO-GO with a propagated reason.
 */
export async function runUnattendedControlledDispatch(
  input: HCCUnattendedRunnerInput,
): Promise<HCCUnattendedRunnerResult> {
  // Defensive identity check.
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
  if (!input.planned_action) {
    return noGo(input, "missing planned_action");
  }
  if (!isNonEmptyString(input.planned_action.planned_action_id)) {
    return noGo(input, "missing planned_action.planned_action_id");
  }
  if (!isSupportedKind(input.planned_action.planned_action_kind)) {
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

  // Gate: feature flag.
  if (input.feature_flag_enabled !== true) {
    return noGo(input, "feature_flag_enabled must be true");
  }

  // Gate: ready consumer verdict.
  if (input.ready_result.verdict !== "UNATTENDED-READY-CANDIDATE") {
    return noGo(
      input,
      `ready_result.verdict must be UNATTENDED-READY-CANDIDATE; got "${input.ready_result.verdict}"`,
    );
  }
  if (input.ready_result.unattended_ready !== true) {
    return noGo(input, "ready_result.unattended_ready must be true");
  }

  // Identity cross-check: ready_result fields must match input.
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
  if (input.ready_result.authorization_id !== input.authorization_id) {
    return noGo(
      input,
      "ready_result.authorization_id does not match input.authorization_id",
    );
  }

  // Gate: dispatch adapter present + supports kind.
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
  if (adapter.supportsKind(input.planned_action.planned_action_kind) !== true) {
    return noGo(
      input,
      `dispatch_adapter does not support planned_action_kind "${input.planned_action.planned_action_kind}"`,
    );
  }

  // All gates satisfied. Dispatch through the injected adapter.
  let result: { controlled_command_id: string };
  try {
    result = await adapter.dispatch(
      input.planned_action.planned_action_id,
      input.planned_action.planned_action_kind,
      input.planned_action.target_path,
    );
  } catch (err) {
    return noGo(
      input,
      `dispatch_adapter raised: ${(err as Error).message ?? String(err)}`,
    );
  }
  if (
    !result ||
    typeof result.controlled_command_id !== "string" ||
    result.controlled_command_id.length === 0
  ) {
    return noGo(
      input,
      "dispatch_adapter.dispatch did not return a controlled_command_id",
    );
  }

  return dispatched(input, result.controlled_command_id);
}

function dispatched(
  input: HCCUnattendedRunnerInput,
  controlled_command_id: string,
): HCCUnattendedRunnerResult {
  return {
    schema_version: "1.0.0",
    verdict: "CONTROLLED-UNATTENDED-RUNNER-DISPATCHED",
    reason:
      "all gates satisfied: ready_candidate + feature_flag + identity + adapter supportsKind; dispatch performed through injected adapter only; side-effect fields reflect the injected adapter result",
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization_id,
    planned_action_id: input.planned_action.planned_action_id,
    planned_action_kind: input.planned_action.planned_action_kind,
    controlled_command_id,
    any_command_executed: true,
    executed_commands: [controlled_command_id],
    subprocess_count: 1,
    would_execute: false,
    auto_executor_started: false,
    unattended_ready: true,
    night_run_ready: false,
    go_no_go: "NO-GO",
    real_execution_ready: false,
  };
}

function noGo(
  input: HCCUnattendedRunnerInput,
  reason: string,
): HCCUnattendedRunnerResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization_id ?? "",
    planned_action_id: input.planned_action?.planned_action_id ?? "",
    planned_action_kind: (input.planned_action?.planned_action_kind as
      | HCCUnattendedDispatchActionKind
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
