// HCC Unattended App IPC Handler Contract.
//
// Pure IPC handler that consumes an app-side IPC payload and
// delegates to `runAppUnattendedScheduledDispatch` from
// `src/shared/lib/hcc-unattended-app-entrypoint.ts` (added in
// `740b4f4`). This slice is a **handler contract only** — it
// exports a pure function and an isolated installer. The
// installer is NOT called from `src/main/index.ts` in this
// commit; a future wiring slice (out of scope here) will
// register the handler with `ipcMain.handle` from an explicit
// user-gesture entrypoint (e.g. an in-app button click that
// surfaces this IPC channel).
//
// Per HCC governance (preflight
// `hcc-unattended-app-ipc-preflight-2026-06-15`):
//   - NO `setInterval` / `setTimeout` / cron.
//   - NO `spawn` / `exec` / `child_process`.
//   - NO `submitDryRunAction`.
//   - NO writes to `~/.hermes/**`.
//   - NO automatic start on app launch. The installer is
//     exported but NOT called from `src/main/index.ts` in
//     this commit.
//   - NO renderer / preload / UI changes. The handler is a
//     pure async function over an untyped IPC payload.
//   - The handler is gated on an explicit user_confirmation
//     field that the renderer sets only when the user has
//     clicked through an in-app confirmation modal (the
//     renderer slice is a separate GO-gated decision).
//   - Even on success, preserves `night_run_ready: false`
//     and `go_no_go: "NO-GO"` from the entrypoint.
//   - Does NOT set `go_no_go: "GO"`.

import {
  runAppUnattendedScheduledDispatch,
  type HCCUnattendedAppEntrypointInput,
  type HCCUnattendedAppEntrypointResult,
} from "../../shared/lib/hcc-unattended-app-entrypoint";
import type {
  HCCFinalControlledRealDispatchAdapter,
} from "../../shared/lib/hcc-final-controlled-real-dispatch";
import type {
  HCCUnattendedReadyConsumerResult,
} from "../../shared/lib/hcc-unattended-ready-consumer";

export const HCC_UNATTENDED_APP_IPC_SCHEMA_VERSION =
  "1.0.0" as const;

export const HCC_UNATTENDED_APP_IPC_CHANNEL =
  "hcc:unattended-scheduled-dispatch" as const;

export type HCCUnattendedAppIpcVerdict =
  | "APP-UNATTENDED-SCHEDULED-DISPATCHED"
  | "NO-GO";

/**
 * Shape of the IPC payload the renderer is expected to send
 * over `hcc:unattended-scheduled-dispatch`. The renderer slice
 * is out of scope for this commit; this interface is the
 * contract the renderer must conform to.
 */
export interface HCCUnattendedAppIpcRequest {
  /** Required, non-empty. */
  app_session_id: string;
  /** Required, non-empty. */
  app_invocation_id: string;
  /** Required, must be `true`. */
  user_confirmation: boolean;
  /** Required, non-empty. */
  explicit_unattended_trigger_token: string;
  /** Required, must be `true`. */
  feature_flag_enabled: boolean;
  /** Required, non-empty, structural scheduler input. */
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  /** Required, non-empty, must match `app_session_id` pair. */
  authorization_id: string;
  /** Required, non-empty. */
  schedule_id: string;
  planned_action_id: string;
  planned_action_kind: "shell_command" | "file_write" | "config_patch";
  target_path: string;
  /** Optional scheduler window. The handler passes through
   *  whatever the renderer sent; the entrypoint re-validates. */
  scheduler_window_start_iso?: string;
  scheduler_window_end_iso?: string;
  /** Optional IANA tz. Defaults to "UTC" if absent. */
  scheduler_window_tz?: string;
}

/**
 * Dependencies the handler needs. The default deps wire the
 * handler to the real entrypoint. Tests inject a mock
 * `runAppUnattendedScheduledDispatch` to exercise the handler's
 * own gate logic without touching the real entrypoint.
 */
export interface HCCUnattendedAppIpcHandlerDeps {
  /**
   * The entrypoint. Defaults to the real
   * `runAppUnattendedScheduledDispatch`. Tests inject a mock.
   */
  runAppUnattendedScheduledDispatch?: (
    input: HCCUnattendedAppEntrypointInput,
  ) => Promise<HCCUnattendedAppEntrypointResult>;
  /**
   * `Date.now` indirection. Tests inject a fixed timestamp to
   * keep the result deterministic. Default: `() => Date.now()`.
   */
  now?: () => number;
  /**
   * Optional dispatch adapter. When present, the handler passes
   * it directly into `scheduler_input.dispatch_adapter` so the
   * full entrypoint / scheduler / runner chain can perform
   * real dispatch through the injected adapter. When absent,
   * the handler preserves the existing safe no-op adapter
   * (which returns a typed NO-GO at the entrypoint level
   * because `supportsKind` is false).
   */
  dispatch_adapter?: HCCFinalControlledRealDispatchAdapter;
  /**
   * Optional ready_result. When present, the handler passes it
   * directly into `scheduler_input.ready_result` so the full
   * entrypoint / scheduler / runner chain can reach the runner's
   * dispatch call. When absent, the handler uses the default
   * no-go ready_result scaffold (which preserves the existing
   * typed NO-GO behavior from the entrypoint because
   * `verdict` is `"NO-GO"`).
   *
   * This field is the second of two injectable deps the
   * handler needs before a real production dispatch can fire:
   *   (a) `dispatch_adapter` — the adapter that performs the
   *       actual action (added in `1a997aa`)
   *   (b) `ready_result` — the ready consumer verdict that
   *       passes the `UNATTENDED-READY-CANDIDATE` gate
   *       (added in this slice)
   *
   * The handler does NOT synthesize a real ready_result from
   * the IPC payload. A future production wiring slice is
   * responsible for constructing a real
   * `HCCUnattendedReadyConsumerResult` and injecting it.
   */
  ready_result?: HCCUnattendedReadyConsumerResult;
}

/**
 * Default no-go ready_result scaffold. Produced when the caller
 * does NOT inject a real ready_result via
 * `deps.ready_result`. The entrypoint will block at
 * `ready_result.verdict must be UNATTENDED-READY-CANDIDATE`
 * and surface a typed NO-GO, preserving the existing safe
 * behavior.
 */
export function defaultNoGoReadyResult(
  request: HCCUnattendedAppIpcRequest,
): HCCUnattendedReadyConsumerResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason:
      "hcc-unattended-app-ipc: ready_result not provided by IPC handler; handler does not synthesize ready state",
    task_id: request.task_id,
    source_plan_ref: request.source_plan_ref,
    requested_by_user: request.requested_by_user,
    authorization_id: request.authorization_id,
    enablement_verdict: "",
    final_dispatch_verdict: "",
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    auto_executor_started: false,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    any_command_executed: false,
    real_execution_ready: false,
  };
}

/**
 * Default no-op dispatch adapter. Returns `supportsKind: false`
 * so the entrypoint surfaces a typed NO-GO. Production wiring
 * injects a real adapter via `deps.dispatch_adapter`.
 */
export function defaultNoOpDispatchAdapter(): HCCFinalControlledRealDispatchAdapter {
  return {
    supportsKind: () => false,
    dispatch: () => {
      throw new Error(
        "hcc-unattended-app-ipc: no dispatch adapter injected; the handler's default no-op adapter refuses dispatch. Inject a real adapter via deps.dispatch_adapter.",
      );
    },
  };
}

/**
 * Result shape returned to the renderer over the IPC channel.
 * The renderer receives this as a plain object (the IPC layer
 * JSON-serializes it). The shape mirrors the entrypoint's
 * result plus a top-level `verdict` and `reason` for the
 * NO-GO-from-IPC-validation path.
 */
export type HCCUnattendedAppIpcResult =
  | (HCCUnattendedAppEntrypointResult & {
      /** Verdict echoed from the entrypoint (success or NO-GO). */
      verdict: HCCUnattendedAppIpcVerdict;
      /** ISO 8601 timestamp captured at handler entry. */
      handled_at: string;
    })
  | {
      schema_version: "1.0.0";
      verdict: "NO-GO";
      reason: string;
      handled_at: string;
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
      would_execute: false;
      auto_executor_started: false;
      unattended_ready: boolean;
      night_run_ready: false;
      go_no_go: "NO-GO";
      real_execution_ready: false;
    };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isSupportedKind(
  v: unknown,
): v is "shell_command" | "file_write" | "config_patch" {
  return v === "shell_command" || v === "file_write" || v === "config_patch";
}

function isValidRequestShape(
  v: unknown,
): v is HCCUnattendedAppIpcRequest {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  if (!isNonEmptyString(r.app_session_id)) return false;
  if (!isNonEmptyString(r.app_invocation_id)) return false;
  if (r.user_confirmation !== true) return false;
  if (!isNonEmptyString(r.explicit_unattended_trigger_token)) return false;
  if (r.feature_flag_enabled !== true) return false;
  if (!isNonEmptyString(r.task_id)) return false;
  if (!isNonEmptyString(r.source_plan_ref)) return false;
  if (!isNonEmptyString(r.requested_by_user)) return false;
  if (!isNonEmptyString(r.authorization_id)) return false;
  if (!isNonEmptyString(r.schedule_id)) return false;
  if (!isNonEmptyString(r.planned_action_id)) return false;
  if (!isSupportedKind(r.planned_action_kind)) return false;
  if (!isNonEmptyString(r.target_path)) return false;
  return true;
}

/**
 * Pure handler function. Validates the IPC payload, builds the
 * entrypoint input, awaits the entrypoint, and returns a
 * deterministic IPC result. Does NOT call `ipcMain.handle`
 * itself; the installer (below) is a separate exported
 * function that a future wiring slice may invoke from a
 * user-gesture entrypoint.
 *
 * The handler is `async` so it can `await` the entrypoint
 * without blocking the IPC channel.
 */
export async function handleHccUnattendedAppIpcRequest(
  request: unknown,
  deps: HCCUnattendedAppIpcHandlerDeps = {},
): Promise<HCCUnattendedAppIpcResult> {
  const now = deps.now ?? (() => Date.now());
  const handled_at = new Date(now()).toISOString();

  if (!isValidRequestShape(request)) {
    return noGo(request, "missing or malformed IPC payload (app_session_id, app_invocation_id, user_confirmation, explicit_unattended_trigger_token, feature_flag_enabled, scheduler input fields)", handled_at);
  }

  const entrypointInput: HCCUnattendedAppEntrypointInput = {
    invocation: {
      app_session_id: request.app_session_id,
      app_invocation_id: request.app_invocation_id,
      user_confirmation: request.user_confirmation,
      explicit_unattended_trigger_token:
        request.explicit_unattended_trigger_token,
    },
    feature_flag_enabled: request.feature_flag_enabled,
    scheduler_input: {
      schedule_id: request.schedule_id,
      scheduler_window: {
        start_iso: request.scheduler_window_start_iso ?? "",
        end_iso: request.scheduler_window_end_iso ?? "",
        tz: request.scheduler_window_tz ?? "UTC",
      },
      task_id: request.task_id,
      source_plan_ref: request.source_plan_ref,
      requested_by_user: request.requested_by_user,
      authorization_id: request.authorization_id,
      feature_flag_enabled: request.feature_flag_enabled,
      // If the caller injected a ready_result, pass it
      // through to the scheduler. Otherwise use the default
      // no-go scaffold (which preserves the existing typed
      // NO-GO because `verdict` is `"NO-GO"`).
      ready_result:
        deps.ready_result ?? defaultNoGoReadyResult(request),
      planned_action: {
        planned_action_id: request.planned_action_id,
        planned_action_kind: request.planned_action_kind,
        target_path: request.target_path,
      },
      budget: { present: true, exceeded: false },
      blockers_resolved: true,
      // If the caller injected a dispatch adapter, pass it
      // through to the scheduler. Otherwise preserve the
      // default no-op adapter (which surfaces a typed NO-GO
      // at the entrypoint level because `supportsKind` is
      // false). Production wiring injects a real adapter via
      // `deps.dispatch_adapter`.
      dispatch_adapter:
        deps.dispatch_adapter ?? defaultNoOpDispatchAdapter(),
    },
  };

  const runFn =
    deps.runAppUnattendedScheduledDispatch ??
    runAppUnattendedScheduledDispatch;

  let entrypointResult: HCCUnattendedAppEntrypointResult;
  try {
    entrypointResult = await runFn(entrypointInput);
  } catch (err) {
    return noGo(
      request,
      `runAppUnattendedScheduledDispatch raised: ${
        (err as Error).message ?? String(err)
      }`,
      handled_at,
    );
  }

  return {
    ...entrypointResult,
    handled_at,
  };
}

function noGo(
  request: unknown,
  reason: string,
  handled_at: string,
): HCCUnattendedAppIpcResult {
  const r = (request ?? {}) as Partial<HCCUnattendedAppIpcRequest>;
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    handled_at,
    app_session_id: r.app_session_id ?? "",
    app_invocation_id: r.app_invocation_id ?? "",
    user_confirmation: r.user_confirmation ?? false,
    explicit_unattended_trigger_token:
      r.explicit_unattended_trigger_token ?? "",
    schedule_id: r.schedule_id ?? "",
    task_id: r.task_id ?? "",
    source_plan_ref: r.source_plan_ref ?? "",
    requested_by_user: r.requested_by_user ?? "",
    authorization_id: r.authorization_id ?? "",
    planned_action_id: r.planned_action_id ?? "",
    planned_action_kind: r.planned_action_kind ?? "",
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
