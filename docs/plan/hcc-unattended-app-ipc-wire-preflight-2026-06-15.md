# HCC-UNATTENDED-APP-IPC-WIRE-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 70948f9 (`hcc: add unattended app ipc installer contract`)
Slice: HCC-UNATTENDED-APP-IPC-WIRE-001 (wire installer into Electron main process via explicit user-gesture arming channel)

## 1. Goal

Wire the HCC unattended app IPC installer (added in
`70948f9`) into the Electron main process through an
**explicit user-gesture arming channel**.

- The final HCC dispatch channel
  (`HCC_UNATTENDED_APP_IPC_CHANNEL` from `56ed9d0`) is NOT
  registered on app boot.
- It is registered ONLY when the renderer sends an explicit
  install gesture to the arming channel
  `HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL` ("hcc:unattended-app-ipc-install").
- Repeated valid gestures are idempotent. A second call
  returns the original install result and does NOT call
  `ipcMain.handle` twice.

## 2. Allowed files (6)

1. `src/main/index.ts` — register the arming channel inside `setupIPC()`.
2. `src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts` — wire helper source.
3. `tests/auto-executor/hcc-unattended-app-ipc-wire.test.ts` — wire tests.
4. `docs/plan/hcc-unattended-app-ipc-wire-preflight-2026-06-15.md` — this file.
5. `docs/plan/hcc-unattended-app-ipc-wire-go-no-go-2026-06-15.md` — per-gate GO/NO-GO matrix.
6. `docs/closeout/hcc-unattended-app-ipc-wire-001-closeout-2026-06-15.md` — closeout.

## 3. Wire helper contract

```
handleHccUnattendedAppIpcInstallGesture(payload, deps) -> Promise<HCCUnattendedAppIpcInstallGestureResult>
```

- Pure async function over the gesture payload and deps.
- Validates the gesture payload (3 fields) synchronously. NO-GO short-circuits before calling the installer.
- On valid payload, calls `installHccUnattendedAppIpc(ipcMainLike, { handler_deps })`.
- Idempotent: a second valid gesture returns the cached install result; the installer is NOT called a second time.
- The `stateStore` (default: module-scoped) is a `(installed: boolean, lastResult?: HCCUnattendedAppIpcInstallResult)` object. Tests inject a custom store to keep tests isolated.

## 4. Gesture payload fields (3)

| # | Field | Required shape |
|---|-------|----------------|
| 1 | `user_confirmation` | `=== true` |
| 2 | `explicit_unattended_trigger_token` | non-empty string |
| 3 | `feature_flag_enabled` | `=== true` |

## 5. NO-GO short-circuit ordering

The wire helper evaluates its 3 identity gates synchronously
up front. If any gate fails, it returns
`verdict: "NO-GO"` and NEVER calls the installer.

On success, the wire helper:
- Checks idempotency state. If a previous install is cached, returns the cached result with `gesture_verdict: "ALREADY-INSTALLED"`.
- Otherwise calls the installer. The installer's result is forwarded with `gesture_verdict: "INSTALLED"`. The state store is updated for idempotency.

## 6. `src/main/index.ts` change (surgical)

One new import at the top of the existing imports:

```ts
import {
  handleHccUnattendedAppIpcInstallGesture,
  HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
} from "./ipc-handlers/wire-hcc-unattended-app-ipc";
```

One new `ipcMain.handle` call inside `setupIPC()`, placed
right before the existing
`createKnowledgeIpcStartup(ipcMain)` call:

```ts
ipcMain.handle(
  HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL,
  async (_event, payload) =>
    handleHccUnattendedAppIpcInstallGesture(payload, {
      ipcMainLike: ipcMain,
    }),
);
```

No other `src/main/index.ts` change. The final HCC dispatch
channel (`HCC_UNATTENDED_APP_IPC_CHANNEL`) is NOT registered
in `src/main/index.ts` — it is registered only by the
installer, which only runs on explicit user gesture.

## 7. What this slice does NOT do

- Does NOT call `setInterval` / `setTimeout` / `setImmediate`.
- Does NOT call `spawn` / `exec` / `child_process` directly.
- Does NOT call `submitDryRunAction`.
- Does NOT import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Does NOT write to `~/.hermes/**`.
- Does NOT execute HCC on app boot. The wire helper is only
  invoked on explicit user gesture.
- Does NOT register the final HCC dispatch channel on app
  boot. The final dispatch channel is registered only when
  the renderer posts to the arming channel.
- Does NOT modify `package.json` or `package-lock.json`.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Does NOT touch `src/renderer/**` or `src/preload/**`.
- Does NOT set `go_no_go: "GO"`.
- Does NOT flip `night_run_ready: true`.
- Does NOT flip `auto_executor_started: true`.

## 8. Preserved literals

- `night_run_ready: false` (literal, in the installer's NO-GO result path)
- `go_no_go: "NO-GO"` (literal)
- `auto_executor_started: false` (literal)
- `would_execute: false` (literal)
- `real_execution_ready: false` (literal)
- `go_no_go: "GO"` does NOT appear anywhere as a runtime value.
  Enforced by static test with comments stripped.

## 9. Pre-Commit gates (must all pass)

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-app-ipc-wire.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status -- package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
git diff --name-status -- src/renderer src/preload
rg -n 'setInterval|setTimeout|child_process|spawn\(|exec\(|submitDryRunAction|auto-executor-bootstrap|auto-executor-arm|auto-executor-start|auto-executor-host|~/.hermes|go_no_go: "GO"|night_run_ready: true' \
    src/main/index.ts \
    src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts \
    tests/auto-executor/hcc-unattended-app-ipc-wire.test.ts
```

## 10. Forbidden mutations

- Setting `go_no_go: "GO"` anywhere in the source.
- Setting `night_run_ready: true` anywhere in the source.
- Setting `auto_executor_started: true` anywhere in the source.
- Calling `ipcMain.handle` at app boot for the final HCC
  dispatch channel. The final channel is registered only on
  explicit user gesture.
- Calling `runAppUnattendedScheduledDispatch` from
  `src/main/index.ts`.
- Importing `submitDryRunAction`.
- Writing to `~/.hermes/**`.
- Touching `package.json` or `package-lock.json`.
- Touching `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Touching `src/renderer/**` or `src/preload/**`.

## 11. Commit / Push

- Commit only if all gates pass.
- Commit on a local branch named
  `hcc-unattended-app-ipc-wire-001` (per slice spec).
- Do NOT push unless explicitly authorized by the user.
