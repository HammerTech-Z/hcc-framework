// HCC App User-Explicit IPC Invoker Contract.
//
// Main-process handler contract for the Hermes Pro app
// user-explicit invocation surface. This slice is the
// PURE CONTRACT ONLY. The lib does NOT register an
// Electron main-process handler, does NOT touch preload,
// does NOT touch the renderer, does NOT trigger app boot,
// timer, cron, or auto-arm.
//
// The lib exposes a `handleAppIpcInvocation(request)`
// function that accepts a structured IPC-shaped request
// produced by a future main-process bridge. The bridge
// itself is a separate concern: the renderer surfaces a
// user-explicit button click, the preload exposes a
// typed `ipcRenderer.invoke` channel, and the main process
// turns that into a request object that this lib
// validates. Wiring that bridge is a future slice; this
// slice is the validation + dispatch contract only.
//
// Per HCC governance (origin `b818d17`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//   - The contract does NOT call `submitDryRunAction`

import {
  checkSharedInvocationFixture,
  invokeSharedControlledRealDispatch,
  type HCCSharedInvocationFixture,
  type HCCSharedInvocationResult,
} from "./hcc-shared-invocation-service";

export const HCC_APP_USER_EXPLICIT_IPC_SCHEMA_VERSION = "1.0.0" as const;

/**
 * App session id. Mints at app start by the future main
 * bridge. The contract refuses any request that does not
 * carry this id. The id is opaque; the contract only
 * checks presence + non-empty.
 */
export type HCCAppSessionId = string;

/**
 * App invocation id. Mints per user click. The contract
 * refuses any request that does not carry this id.
 */
export type HCCAppInvocationId = string;

/**
 * Explicit user confirmation payload. The contract
 * requires a confirmation of one of the supported kinds
 * to prove the request came from a real user-explicit
 * path (a click, a menu, etc.) and not from app boot or
 * a default UI flow. A future slice may extend the
 * union (e.g. add a confirmation of a different kind) but
 * MUST do so without weakening the requirement.
 */
export type HCCAppUserConfirmationKind =
  | "renderer_button_click"
  | "menu_action"
  | "keyboard_shortcut";

export interface HCCAppUserConfirmation {
  /** The kind of confirmation the user produced. */
  kind: HCCAppUserConfirmationKind;
  /** A nonce the renderer can correlate with the response. */
  nonce: string;
  /**
   * The text the UI displayed to the user. The contract
   * only checks presence + non-empty. The future main
   * bridge is expected to enforce content review before
   * constructing the request.
   */
  display_text: string;
  /**
   * The time at which the user produced the confirmation,
   * in ISO-8601. The contract checks the value is a
   * non-empty string; it does not enforce freshness here
   * because the future bridge is expected to enforce
   * a freshness window before passing the request.
   */
  confirmed_at: string;
}

/**
 * IPC-shaped request. The future main bridge is expected
 * to construct one of these from a typed preload
 * channel. The contract validates every field.
 */
export interface HCCAppIpcRequest {
  /** Stable id of the app session. */
  app_session_id: HCCAppSessionId;
  /** Stable id of the user click / menu / shortcut. */
  app_invocation_id: HCCAppInvocationId;
  /** The explicit user confirmation payload. */
  user_confirmation: HCCAppUserConfirmation;
  /** The shared fixture carrying the planned action identity. */
  shared_fixture: HCCSharedInvocationFixture;
}

/**
 * IPC-shaped result. Mirrors the shared result plus
 * app caller identity + app invocation id + a typed
 * failure reason. NO-GO is propagated; the success
 * fields may carry the final dispatch's ready-bit flip
 * because the shared service contract already gates
 * that.
 */
export type HCCAppIpcResult =
  | (HCCSharedInvocationResult & {
      app_session_id: HCCAppSessionId;
      app_invocation_id: HCCAppInvocationId;
      reason: string;
    })
  | {
      schema_version: "1.0.0";
      verdict: "NO-GO";
      reason: string;
      task_id: string;
      source_plan_ref: string;
      requested_by_user: string;
      authorization_id: string;
      dry_run_artifact_hash: string;
      planned_action_id: string;
      planned_action_kind:
        | "shell_command"
        | "file_write"
        | "config_patch"
        | "";
      whitelist_action_id: string;
      controlled_command_id: string;
      real_execution_ready: false;
      would_execute: false;
      any_command_executed: false;
      executed_commands: readonly [];
      subprocess_count: 0;
      auto_executor_started: false;
      unattended_ready: false;
      night_run_ready: false;
      go_no_go: "NO-GO";
      app_session_id: HCCAppSessionId;
      app_invocation_id: HCCAppInvocationId;
    };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Synchronous guard. Returns `null` if the request is OK;
 * otherwise returns a human-readable reason string. The
 * shared service is the single source of truth for the
 * 4 prior verdicts / identity agreement; this guard
 * covers app-local concerns:
 *   - app_session_id non-empty
 *   - app_invocation_id non-empty
 *   - user_confirmation present with kind + nonce +
 *     display_text + confirmed_at all non-empty
 *   - shared_fixture passes checkSharedInvocationFixture
 */
export function checkAppIpcRequest(
  request: HCCAppIpcRequest,
): string | null {
  if (!isNonEmptyString(request.app_session_id)) {
    return "missing app_session_id (handler is app-session-explicit)";
  }
  if (!isNonEmptyString(request.app_invocation_id)) {
    return "missing app_invocation_id";
  }
  if (!request.user_confirmation) {
    return "missing user_confirmation";
  }
  const conf = request.user_confirmation;
  if (
    conf.kind !== "renderer_button_click" &&
    conf.kind !== "menu_action" &&
    conf.kind !== "keyboard_shortcut"
  ) {
    return `unsupported user_confirmation.kind: "${String(conf.kind)}"`;
  }
  if (!isNonEmptyString(conf.nonce)) {
    return "missing user_confirmation.nonce";
  }
  if (!isNonEmptyString(conf.display_text)) {
    return "missing user_confirmation.display_text";
  }
  if (!isNonEmptyString(conf.confirmed_at)) {
    return "missing user_confirmation.confirmed_at";
  }
  if (!request.shared_fixture) {
    return "missing shared_fixture";
  }
  if (!isNonEmptyString(request.shared_fixture.explicit_user_trigger_token)) {
    return "missing explicit_user_trigger_token on shared_fixture";
  }
  const sharedReason = checkSharedInvocationFixture(request.shared_fixture);
  if (sharedReason !== null) {
    return `shared_fixture: ${sharedReason}`;
  }
  return null;
}

/**
 * Build an app-shaped NO-GO result with the app identity
 * fields populated from the request. Pure projection. Used
 * by `handleAppIpcInvocation` when the guard fails or
 * the shared service raises.
 */
function noGo(
  request: Partial<HCCAppIpcRequest>,
  reason: string,
): HCCAppIpcResult {
  const shared =
    request.shared_fixture ??
    ({} as Partial<HCCSharedInvocationFixture>);
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: shared.task_id ?? "",
    source_plan_ref: shared.source_plan_ref ?? "",
    requested_by_user: shared.requested_by_user ?? "",
    authorization_id: shared.authorization_id ?? "",
    dry_run_artifact_hash: shared.dry_run_artifact_hash ?? "",
    planned_action_id: shared.planned_action_id ?? "",
    planned_action_kind:
      (shared.planned_action_kind as
        | "shell_command"
        | "file_write"
        | "config_patch"
        | "") ?? "",
    whitelist_action_id: shared.whitelist_action_id ?? "",
    controlled_command_id: "",
    real_execution_ready: false,
    would_execute: false,
    any_command_executed: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    app_session_id: request.app_session_id ?? "",
    app_invocation_id: request.app_invocation_id ?? "",
  };
}

/**
 * Top-level app IPC handler. Async. The future main
 * bridge is expected to call this from the main-process
 * IPC channel that the preload exposes. The lib does
 * NOT register the handler itself; that wiring is a
 * separate concern.
 *
 * The handler is the only way to reach the final
 * dispatch from the app side. There is no other path.
 * Catches dispatch adapter throws and surfaces them
 * as a typed NO-GO with a reason so the bridge does
 * not have to handle two error channels.
 */
export async function handleAppIpcInvocation(
  request: HCCAppIpcRequest,
): Promise<HCCAppIpcResult> {
  const guardReason = checkAppIpcRequest(request);
  if (guardReason !== null) {
    return noGo(request, `app IPC handler refused: ${guardReason}`);
  }

  let sharedResult: HCCSharedInvocationResult;
  try {
    sharedResult = await invokeSharedControlledRealDispatch(
      request.shared_fixture,
    );
  } catch (err) {
    return noGo(
      request,
      `dispatch adapter raised: ${(err as Error).message ?? String(err)}`,
    );
  }

  return {
    ...sharedResult,
    app_session_id: request.app_session_id,
    app_invocation_id: request.app_invocation_id,
  };
}
