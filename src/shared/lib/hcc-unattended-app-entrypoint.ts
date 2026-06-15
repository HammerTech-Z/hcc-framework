// HCC Unattended Product Entrypoints — App Path.
//
// First product-facing app entrypoint for the controlled
// unattended scheduler. Consumed by the Hermes Pro app (Electron)
// path. This module is a **pure async facade** — it evaluates
// an explicit app invocation identity (session id, invocation
// id, user confirmation, and a one-shot explicit trigger token),
// and only when every gate passes does it call
// `scheduleControlledUnattendedRun`.
//
// Per HCC governance (preflight
// `hcc-unattended-product-entrypoints-preflight-2026-06-15`):
//   - NO background timer / cron / setInterval / setTimeout.
//   - NO direct spawn / exec / child_process / submitDryRunAction.
//   - NO bootstrap / arm / start / host imports.
//   - NO writes to `~/.hermes/**`.
//   - NO automatic start on app launch. The app path is invoked
//     by an explicit in-app user action carrying a session id,
//     an invocation id, an explicit user_confirmation, and a
//     one-shot explicit trigger token.
//   - Even on success, preserves `night_run_ready: false` and
//     `go_no_go: "NO-GO"` from the scheduler.
//   - Does NOT set `go_no_go: "GO"`.

import {
  scheduleControlledUnattendedRun,
  type HCCUnattendedSchedulerInput,
  type HCCUnattendedSchedulerResult,
} from "./hcc-unattended-scheduler";

export const HCC_UNATTENDED_APP_ENTRYPOINT_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedAppEntrypointVerdict =
  | "APP-UNATTENDED-SCHEDULED-DISPATCHED"
  | "NO-GO";

/**
 * Explicit app invocation identity. The app path will refuse to
 * run unless every field is present and non-empty. `user_confirmation`
 * is a boolean the UI sets only when the user has explicitly
 * clicked through an in-app confirmation surface. The trigger
 * token is a one-shot signal that the user pressed the action
 * button — it is NOT a long-lived credential.
 */
export interface HCCUnattendedAppInvocation {
  app_session_id: string;
  app_invocation_id: string;
  user_confirmation: boolean;
  explicit_unattended_trigger_token: string;
}

/**
 * Input to the app entrypoint. The `invocation` block is the
 * app identity gate. The `scheduler_input` block is the
 * scheduler input as defined by `HCCUnattendedSchedulerInput`. The
 * app entrypoint does NOT relax any scheduler gate; it adds its
 * own gates and forwards a structurally identical
 * `HCCUnattendedSchedulerInput` to the scheduler.
 */
export interface HCCUnattendedAppEntrypointInput {
  invocation: HCCUnattendedAppInvocation;
  /** Re-asserted defensive feature flag (must be true). */
  feature_flag_enabled: boolean;
  /** The full scheduler input. */
  scheduler_input: HCCUnattendedSchedulerInput;
}

export interface HCCUnattendedAppEntrypointResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedAppEntrypointVerdict;
  reason: string;
  app_session_id: string;
  app_invocation_id: string;
  user_confirmation: boolean;
  explicit_unattended_trigger_token: string;
  schedule_id: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind: string;
  controlled_command_id: string;
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

function isValidAppInvocation(v: unknown): v is HCCUnattendedAppInvocation {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    isNonEmptyString(a.app_session_id) &&
    isNonEmptyString(a.app_invocation_id) &&
    a.user_confirmation === true &&
    isNonEmptyString(a.explicit_unattended_trigger_token)
  );
}

/**
 * App entrypoint. Async facade.
 *
 * All app-identity gates evaluated synchronously up front. NO-GO
 * short-circuits before the scheduler is invoked. On success,
 * the scheduler is awaited and its result is forwarded with the
 * app identity fields added.
 */
export async function runAppUnattendedScheduledDispatch(
  input: HCCUnattendedAppEntrypointInput,
): Promise<HCCUnattendedAppEntrypointResult> {
  if (!isValidAppInvocation(input.invocation)) {
    return noGo(
      input,
      "missing or malformed app invocation identity (app_session_id, app_invocation_id, user_confirmation, explicit_unattended_trigger_token)",
    );
  }
  if (input.feature_flag_enabled !== true) {
    return noGo(input, "feature_flag_enabled must be true");
  }
  if (!input.scheduler_input) {
    return noGo(input, "missing scheduler_input");
  }

  // Delegate to the scheduler. The app entrypoint itself performs
  // no I/O. If the scheduler throws, the entrypoint surfaces a
  // typed NO-GO.
  let schedulerResult: HCCUnattendedSchedulerResult;
  try {
    schedulerResult = await scheduleControlledUnattendedRun(
      input.scheduler_input,
    );
  } catch (err) {
    return noGo(
      input,
      `scheduleControlledUnattendedRun raised: ${
        (err as Error).message ?? String(err)
      }`,
    );
  }

  if (
    schedulerResult.verdict !== "CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED"
  ) {
    return noGo(
      input,
      `scheduleControlledUnattendedRun returned NO-GO: ${schedulerResult.reason}`,
    );
  }

  return dispatched(input, schedulerResult);
}

function dispatched(
  input: HCCUnattendedAppEntrypointInput,
  scheduler: HCCUnattendedSchedulerResult,
): HCCUnattendedAppEntrypointResult {
  return {
    schema_version: "1.0.0",
    verdict: "APP-UNATTENDED-SCHEDULED-DISPATCHED",
    reason:
      "all app identity gates satisfied (app_session_id, app_invocation_id, user_confirmation=true, explicit_unattended_trigger_token) and feature_flag_enabled=true; scheduler dispatched through the injected adapter; side-effect fields reflect the injected adapter result",
    app_session_id: input.invocation.app_session_id,
    app_invocation_id: input.invocation.app_invocation_id,
    user_confirmation: input.invocation.user_confirmation,
    explicit_unattended_trigger_token:
      input.invocation.explicit_unattended_trigger_token,
    schedule_id: scheduler.schedule_id,
    task_id: scheduler.task_id,
    source_plan_ref: scheduler.source_plan_ref,
    requested_by_user: scheduler.requested_by_user,
    authorization_id: scheduler.authorization_id,
    planned_action_id: scheduler.planned_action_id,
    planned_action_kind: scheduler.planned_action_kind,
    controlled_command_id: scheduler.controlled_command_id,
    any_command_executed: scheduler.any_command_executed,
    executed_commands: scheduler.executed_commands,
    subprocess_count: scheduler.subprocess_count,
    would_execute: false,
    auto_executor_started: false,
    unattended_ready: scheduler.unattended_ready,
    night_run_ready: false,
    go_no_go: "NO-GO",
    real_execution_ready: false,
  };
}

function noGo(
  input: HCCUnattendedAppEntrypointInput,
  reason: string,
): HCCUnattendedAppEntrypointResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    app_session_id: input.invocation?.app_session_id ?? "",
    app_invocation_id: input.invocation?.app_invocation_id ?? "",
    user_confirmation: input.invocation?.user_confirmation ?? false,
    explicit_unattended_trigger_token:
      input.invocation?.explicit_unattended_trigger_token ?? "",
    schedule_id: input.scheduler_input?.schedule_id ?? "",
    task_id: input.scheduler_input?.task_id ?? "",
    source_plan_ref: input.scheduler_input?.source_plan_ref ?? "",
    requested_by_user: input.scheduler_input?.requested_by_user ?? "",
    authorization_id: input.scheduler_input?.authorization_id ?? "",
    planned_action_id: input.scheduler_input?.planned_action?.planned_action_id ?? "",
    planned_action_kind: (input.scheduler_input?.planned_action?.planned_action_kind as
      | string
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
