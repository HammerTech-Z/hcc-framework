// HCC Unattended Product Entrypoints — Terminal Path.
//
// First product-facing terminal entrypoint for the controlled
// unattended scheduler. Consumed by the Terminal Hermes agent
// (CLI) path. This module is a **pure async facade** — it
// evaluates an explicit terminal invocation identity, and only
// when every gate passes does it call
// `scheduleControlledUnattendedRun`.
//
// Per HCC governance (preflight
// `hcc-unattended-product-entrypoints-preflight-2026-06-15`):
//   - NO background timer / cron / setInterval / setTimeout.
//   - NO direct spawn / exec / child_process / submitDryRunAction.
//   - NO bootstrap / arm / start / host imports.
//   - NO writes to `~/.hermes/**`.
//   - NO automatic start on app launch. The terminal path is
//     invoked by an explicit CLI call carrying a session id, an
//     invocation id, and a one-shot explicit trigger token.
//   - Even on success, preserves `night_run_ready: false` and
//     `go_no_go: "NO-GO"` from the scheduler.
//   - Does NOT set `go_no_go: "GO"`.

import {
  scheduleControlledUnattendedRun,
  type HCCUnattendedSchedulerInput,
  type HCCUnattendedSchedulerResult,
} from "./hcc-unattended-scheduler";

export const HCC_UNATTENDED_TERMINAL_ENTRYPOINT_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedTerminalEntrypointVerdict =
  | "TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED"
  | "NO-GO";

/**
 * Explicit terminal invocation identity. The terminal path will
 * refuse to run unless every field is present and non-empty. The
 * trigger token is a one-shot signal that the operator pressed
 * enter / sent the request — it is NOT a long-lived credential.
 */
export interface HCCUnattendedTerminalInvocation {
  terminal_agent_session_id: string;
  terminal_invocation_id: string;
  explicit_unattended_trigger_token: string;
}

/**
 * Input to the terminal entrypoint. The `invocation` block is the
 * terminal identity gate. The `scheduler_input` block is the
 * scheduler input as defined by `HCCUnattendedSchedulerInput`. The
 * terminal entrypoint does NOT relax any scheduler gate; it adds
 * its own gates and forwards a structurally identical
 * `HCCUnattendedSchedulerInput` to the scheduler.
 */
export interface HCCUnattendedTerminalEntrypointInput {
  invocation: HCCUnattendedTerminalInvocation;
  /** Re-asserted defensive feature flag (must be true). */
  feature_flag_enabled: boolean;
  /** The full scheduler input. */
  scheduler_input: HCCUnattendedSchedulerInput;
}

export interface HCCUnattendedTerminalEntrypointResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedTerminalEntrypointVerdict;
  reason: string;
  terminal_agent_session_id: string;
  terminal_invocation_id: string;
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

function isValidTerminalInvocation(
  v: unknown,
): v is HCCUnattendedTerminalInvocation {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    isNonEmptyString(t.terminal_agent_session_id) &&
    isNonEmptyString(t.terminal_invocation_id) &&
    isNonEmptyString(t.explicit_unattended_trigger_token)
  );
}

/**
 * Terminal entrypoint. Async facade.
 *
 * All terminal-identity gates evaluated synchronously up front.
 * NO-GO short-circuits before the scheduler is invoked. On
 * success, the scheduler is awaited and its result is forwarded
 * with the terminal identity fields added.
 */
export async function runTerminalUnattendedScheduledDispatch(
  input: HCCUnattendedTerminalEntrypointInput,
): Promise<HCCUnattendedTerminalEntrypointResult> {
  if (!isValidTerminalInvocation(input.invocation)) {
    return noGo(
      input,
      "missing or malformed terminal invocation identity (terminal_agent_session_id, terminal_invocation_id, explicit_unattended_trigger_token)",
    );
  }
  if (input.feature_flag_enabled !== true) {
    return noGo(input, "feature_flag_enabled must be true");
  }
  if (!input.scheduler_input) {
    return noGo(input, "missing scheduler_input");
  }

  // Delegate to the scheduler. The terminal entrypoint itself
  // performs no I/O. If the scheduler throws (it never should — the
  // scheduler catches runner / adapter throws and surfaces a typed
  // NO-GO), the entrypoint surfaces a typed NO-GO.
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
  input: HCCUnattendedTerminalEntrypointInput,
  scheduler: HCCUnattendedSchedulerResult,
): HCCUnattendedTerminalEntrypointResult {
  return {
    schema_version: "1.0.0",
    verdict: "TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED",
    reason:
      "all terminal identity gates satisfied (terminal_agent_session_id, terminal_invocation_id, explicit_unattended_trigger_token) and feature_flag_enabled=true; scheduler dispatched through the injected adapter; side-effect fields reflect the injected adapter result",
    terminal_agent_session_id: input.invocation.terminal_agent_session_id,
    terminal_invocation_id: input.invocation.terminal_invocation_id,
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
  input: HCCUnattendedTerminalEntrypointInput,
  reason: string,
): HCCUnattendedTerminalEntrypointResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    terminal_agent_session_id: input.invocation?.terminal_agent_session_id ?? "",
    terminal_invocation_id: input.invocation?.terminal_invocation_id ?? "",
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
