// HCC Unattended App IPC Installer — Wire Helper.
//
// Pure async helper that gates the install gesture for the
// HCC unattended app IPC installer. The renderer posts to
// `HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL` (the arming channel)
// when the user has explicitly clicked through an in-app
// confirmation modal. This helper validates the gesture
// payload and, on success, calls the installer.
//
// Per HCC governance (preflight
// `hcc-unattended-app-ipc-wire-preflight-2026-06-15`):
//   - The wire helper is a pure async function. It does NOT
//     perform I/O beyond `ipcMain.handle` registration (which
//     happens at the call site — typically `src/main/index.ts`
//     inside `setupIPC()`).
//   - The final HCC dispatch channel
//     (`HCC_UNATTENDED_APP_IPC_CHANNEL` from `56ed9d0`) is
//     NOT registered by this helper on app boot. The helper
//     registers the FINAL dispatch handler ONLY when the
//     renderer sends an explicit install gesture.
//   - Repeated valid install gestures are idempotent. A
//     second call returns the original install result and
//     does NOT call `ipcMain.handle` twice.
//   - NO `setInterval` / `setTimeout` / cron.
//   - NO `spawn` / `exec` / `child_process`.
//   - NO `submitDryRunAction`.
//   - NO writes to `~/.hermes/**`.
//   - Does NOT set `go_no_go: "GO"` or flip
//     `night_run_ready: true`.

import {
  installHccUnattendedAppIpc,
  type HCCUnattendedAppIpcInstallDeps,
  type HCCUnattendedAppIpcInstallResult,
} from "./install-hcc-unattended-app";

export const HCC_UNATTENDED_APP_IPC_INSTALL_SCHEMA_VERSION =
  "1.0.0" as const;

export const HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL =
  "hcc:unattended-app-ipc-install" as const;

export type HCCUnattendedAppIpcInstallGestureVerdict =
  | "INSTALLED"
  | "ALREADY-INSTALLED"
  | "NO-GO";

/**
 * Payload the renderer is expected to send over the
 * `HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL` arming channel.
 * The renderer slice is out of scope for this commit; this
 * interface is the contract the renderer must conform to.
 */
export interface HCCUnattendedAppIpcInstallGesturePayload {
  /** Required, must be `true`. The user must have explicitly
   *  clicked through an in-app confirmation modal. */
  user_confirmation: boolean;
  /** Required, non-empty. A one-shot signal that the user
   *  pressed the install button — NOT a long-lived credential. */
  explicit_unattended_trigger_token: string;
  /** Required, must be `true`. */
  feature_flag_enabled: boolean;
}

/**
 * Dependencies the wire helper needs. Production code wires
 * the real `ipcMain` and the real `installHccUnattendedAppIpc`.
 * Tests inject mocks.
 */
export interface HCCUnattendedAppIpcInstallGestureDeps {
  ipcMainLike: unknown;
  installHccUnattendedAppIpc?: (
    ipcMainLike: unknown,
    installerDeps: {
      handler_deps?: unknown;
    },
  ) => HCCUnattendedAppIpcInstallResult;
  /**
   * Optional `handler_deps` passthrough to the installer.
   * When the caller supplies this AND
   * `buildProductionHandlerDeps` is absent, the wire helper
   * passes the value verbatim. When the caller supplies
   * `buildProductionHandlerDeps`, the wire helper calls it
   * lazily on the first successful arming and caches the
   * result for the idempotent re-arm path.
   */
  handler_deps?: unknown;
  /**
   * Optional factory that produces the `handler_deps` for the
   * installer. The factory is called exactly once per
   * successful arming (idempotency: repeated arming does NOT
   * re-call the factory). The factory is pure: it must NOT
   * perform I/O (no files, no shell, no IPC, no timers). It
   * may construct production instances from injected
   * fixtures, executors, and ready-state evaluators.
   *
   * Default: undefined. When absent, the wire helper passes
   * `handler_deps: undefined` to the installer, which
   * preserves the existing safe NO-GO fallback.
   */
  buildProductionHandlerDeps?: () => unknown;
  /**
   * `Date.now` indirection. Default: `() => Date.now()`. The
   * wire helper stamps a `gesture_handled_at` ISO 8601 on
   * every response (success or NO-GO) so the renderer can
   * surface a deterministic timestamp.
   */
  now?: () => number;
  /**
   * State store for idempotency. Tests inject a custom store.
   * Default: a module-scoped `boolean` that flips to `true`
   * after the first successful install.
   */
  stateStore?: {
    installed: boolean;
    lastResult?: HCCUnattendedAppIpcInstallResult;
    /** Cached production handler_deps (computed once on first arming). */
    cachedHandlerDeps?: unknown;
  };
}

/**
 * Response shape returned to the renderer over the arming
 * channel. Mirrors the installer's result plus
 * `gesture_verdict` and `gesture_handled_at`.
 */
export type HCCUnattendedAppIpcInstallGestureResult =
  HCCUnattendedAppIpcInstallResult & {
    gesture_verdict: HCCUnattendedAppIpcInstallGestureVerdict;
    gesture_handled_at: string;
    channel_armed: typeof HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL;
  };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isValidPayload(
  v: unknown,
): v is HCCUnattendedAppIpcInstallGesturePayload {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  if (p.user_confirmation !== true) return false;
  if (!isNonEmptyString(p.explicit_unattended_trigger_token)) return false;
  if (p.feature_flag_enabled !== true) return false;
  return true;
}

/**
 * Module-scoped idempotency state. Tests inject a custom
 * `stateStore` to keep tests isolated from each other.
 */
const defaultStateStore: {
  installed: boolean;
  lastResult?: HCCUnattendedAppIpcInstallResult;
  cachedHandlerDeps?: unknown;
} = {
  installed: false,
};

/**
 * Process the HCC unattended app IPC install gesture. Pure
 * async over the payload and deps.
 *
 * Returns:
 *   - `INSTALLED` on the first successful install (verdict
 *     mirrors the installer's `INSTALLED`)
 *   - `ALREADY-INSTALLED` on subsequent valid gestures
 *     (idempotent — does NOT call `ipcMain.handle` twice)
 *   - `NO-GO` on invalid payload (installer NOT called)
 *
 * The helper is async so it can `await` future async gates
 * without blocking the IPC channel. The current synchronous
 * gate path returns a resolved promise.
 */
export async function handleHccUnattendedAppIpcInstallGesture(
  payload: unknown,
  deps: HCCUnattendedAppIpcInstallGestureDeps,
): Promise<HCCUnattendedAppIpcInstallGestureResult> {
  const now = deps.now ?? (() => Date.now());
  const gesture_handled_at = new Date(now()).toISOString();
  const stateStore = deps.stateStore ?? defaultStateStore;

  if (!isValidPayload(payload)) {
    return {
      schema_version: "1.0.0" as const,
      verdict: "NO-GO" as const,
      reason:
        "missing or malformed install gesture payload (user_confirmation, explicit_unattended_trigger_token, feature_flag_enabled)",
      channel: "",
      handler_count: 0,
      installed_at: gesture_handled_at,
      gesture_verdict: "NO-GO" as const,
      gesture_handled_at,
      channel_armed: HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
    };
  }

  // Idempotent: a second valid gesture returns the cached
  // install result and does NOT call the installer (and
  // therefore does NOT call `ipcMain.handle` twice).
  if (stateStore.installed && stateStore.lastResult) {
    return {
      ...stateStore.lastResult,
      gesture_verdict: "ALREADY-INSTALLED" as const,
      gesture_handled_at,
      channel_armed: HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
    };
  }

  const installFn: (
    ipcMainLike: unknown,
    deps: HCCUnattendedAppIpcInstallDeps,
  ) => HCCUnattendedAppIpcInstallResult =
    deps.installHccUnattendedAppIpc ?? installHccUnattendedAppIpc;

  // Resolve the production handler_deps. Three sources, in
  // priority order:
  //   1. `stateStore.cachedHandlerDeps` — set on a previous
  //      successful arming. Idempotent: the factory is NOT
  //      re-called.
  //   2. `deps.buildProductionHandlerDeps` — the factory the
  //      caller injected. Called exactly once on the first
  //      successful arming. The factory is pure (no I/O).
  //   3. `deps.handler_deps` — the static value the caller
  //      supplied. Used verbatim (no factory invocation).
  //   4. undefined — safe default. Preserves the existing
  //      NO-GO fallback when no production wiring is provided.
  let resolvedHandlerDeps: unknown;
  if (stateStore.cachedHandlerDeps !== undefined) {
    resolvedHandlerDeps = stateStore.cachedHandlerDeps;
  } else if (deps.buildProductionHandlerDeps) {
    resolvedHandlerDeps = deps.buildProductionHandlerDeps();
  } else {
    resolvedHandlerDeps = deps.handler_deps;
  }

  const installResult: HCCUnattendedAppIpcInstallResult = installFn(
    deps.ipcMainLike,
    {
      handler_deps: resolvedHandlerDeps as
        | HCCUnattendedAppIpcInstallDeps["handler_deps"]
        | undefined,
    },
  );

  // Cache the result AND the resolved deps for idempotency. We
  // only cache success — a NO-GO result is not cached so a
  // future retry can re-attempt with a possibly-fixed payload.
  if (installResult.verdict === "INSTALLED") {
    stateStore.installed = true;
    stateStore.lastResult = installResult;
    stateStore.cachedHandlerDeps = resolvedHandlerDeps;
  }

  return {
    ...installResult,
    gesture_verdict:
      installResult.verdict === "INSTALLED"
        ? ("INSTALLED" as const)
        : ("NO-GO" as const),
    gesture_handled_at,
    channel_armed: HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
  };
}
