// HCC Unattended App IPC Installer.
//
// Thin installer for the existing HCC unattended app IPC
// handler (added in `56ed9d0`). Calls `ipcMain.handle` on
// `HCC_UNATTENDED_APP_IPC_CHANNEL` and delegates the registered
// handler to `handleHccUnattendedAppIpcRequest`.
//
// Per HCC governance (preflight
// `hcc-unattended-app-ipc-install-preflight-2026-06-15`):
//   - The installer is exported as a pure function. It is
//     NOT called from `src/main/index.ts` in this commit. A
//     future wiring slice (out of scope here) is responsible
//     for invoking the installer from an explicit
//     user-gesture entrypoint (NOT on app boot).
//   - NO `setInterval` / `setTimeout` / cron.
//   - NO `spawn` / `exec` / `child_process`.
//   - NO `submitDryRunAction`.
//   - NO `auto-executor-bootstrap|arm|start|host` imports.
//   - NO writes to `~/.hermes/**`.
//   - NO `ipcMain.handle` registration on app boot. The
//     installer is a thin wrapper that requires a caller to
//     inject an `ipcMainLike`; the slice does not call
//     `ipcMain.handle` itself at module load time.
//   - Even on success, preserves `night_run_ready: false` and
//     `go_no_go: "NO-GO"` from the underlying handler /
//     entrypoint chain.
//   - Does NOT set `go_no_go: "GO"`.

import {
  handleHccUnattendedAppIpcRequest,
  HCC_UNATTENDED_APP_IPC_CHANNEL,
  type HCCUnattendedAppIpcHandlerDeps,
  type HCCUnattendedAppIpcResult,
} from "./hcc-unattended-app";

export const HCC_UNATTENDED_APP_IPC_INSTALL_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedAppIpcInstallVerdict =
  | "INSTALLED"
  | "NO-GO";

/**
 * Minimal IPC-main shape the installer needs. Production code
 * passes Electron's `ipcMain`; tests pass a mock with a single
 * `handle(channel, handler)` method.
 */
export interface HCCUnattendedAppIpcMainLike {
  handle: (
    channel: string,
    handler: (payload: unknown) => Promise<HCCUnattendedAppIpcResult>,
  ) => void;
}

export interface HCCUnattendedAppIpcInstallDeps {
  /**
   * The handler. Defaults to the real
   * `handleHccUnattendedAppIpcRequest`. Tests inject a mock
   * via the installer's deps object.
   */
  handleHccUnattendedAppIpcRequest?: (
    payload: unknown,
    handlerDeps?: HCCUnattendedAppIpcHandlerDeps,
  ) => Promise<HCCUnattendedAppIpcResult>;
  /**
   * Deps to pass through to the registered handler on every
   * IPC call. Lets the installer (or a future wiring slice)
   * inject `now()` for deterministic `handled_at`, or a
   * mocked dispatch adapter, without exposing those knobs
   * on the installer's own result.
   */
  handler_deps?: HCCUnattendedAppIpcHandlerDeps;
  /**
   * `Date.now` indirection. Default: `() => Date.now()`.
   * Used only for the installer's own `installed_at`
   * timestamp. Handler-side timestamps are governed by
   * `handler_deps.now` (if provided).
   */
  now?: () => number;
}

export interface HCCUnattendedAppIpcInstallResult {
  schema_version: "1.0.0";
  verdict: HCCUnattendedAppIpcInstallVerdict;
  reason: string;
  channel: typeof HCC_UNATTENDED_APP_IPC_CHANNEL | "";
  handler_count: number;
  installed_at: string;
}

/**
 * Construct a typed NO-GO result without registering a handler.
 */
function noInstallResult(
  reason: string,
  now: () => number,
): HCCUnattendedAppIpcInstallResult {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    channel: "",
    handler_count: 0,
    installed_at: new Date(now()).toISOString(),
  };
}

function isValidIpcMainLike(
  v: unknown,
): v is HCCUnattendedAppIpcMainLike {
  if (!v || typeof v !== "object") return false;
  const m = v as Record<string, unknown>;
  return typeof m.handle === "function";
}

/**
 * Install the HCC unattended app IPC handler.
 *
 * The installer takes an injected `ipcMainLike` and an
 * optional `deps` bag. It validates the `ipcMainLike`; on
 * validation failure it returns a typed NO-GO result without
 * registering. On success it registers exactly one handler on
 * `HCC_UNATTENDED_APP_IPC_CHANNEL` and returns
 * `{ installed: true, channel, handler_count: 1 }`.
 *
 * The installer is a **pure function** over its arguments. It
 * does not perform any I/O beyond calling `ipcMainLike.handle`
 * once and constructing the result. It does NOT call
 * `ipcMain.handle` at module load time; a future wiring slice
 * is responsible for invoking the installer.
 */
export function installHccUnattendedAppIpc(
  ipcMainLike: unknown,
  deps: HCCUnattendedAppIpcInstallDeps = {},
): HCCUnattendedAppIpcInstallResult {
  const now = deps.now ?? (() => Date.now());

  if (!isValidIpcMainLike(ipcMainLike)) {
    return noInstallResult(
      "ipcMainLike must be an object with a handle(channel, handler) method",
      now,
    );
  }

  const handleFn =
    deps.handleHccUnattendedAppIpcRequest ?? handleHccUnattendedAppIpcRequest;

  // Register exactly one handler on the channel. The handler
  // is a thin wrapper that delegates to the injected handler
  // function with the installer's `handler_deps` (if any)
  // passed through. The installer's own `deps.now` is NOT
  // passed to the handler — the handler has its own `now`
  // indirection via `handler_deps.now` (which the installer
  // forwards verbatim).
  const handlerDeps = deps.handler_deps;
  ipcMainLike.handle(
    HCC_UNATTENDED_APP_IPC_CHANNEL,
    async (payload: unknown) => {
      return handleFn(payload, handlerDeps);
    },
  );

  return {
    schema_version: "1.0.0",
    verdict: "INSTALLED",
    reason:
      "HCC unattended app IPC handler installed on channel hcc:unattended-scheduled-dispatch; delegated to handleHccUnattendedAppIpcRequest; no side effects beyond the handle() call",
    channel: HCC_UNATTENDED_APP_IPC_CHANNEL,
    handler_count: 1,
    installed_at: new Date(now()).toISOString(),
  };
}
