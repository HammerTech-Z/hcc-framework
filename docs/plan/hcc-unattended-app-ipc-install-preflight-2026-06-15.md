# HCC-UNATTENDED-APP-IPC-INSTALL-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 56ed9d0 (`hcc: add unattended app ipc handler contract`)
Slice: HCC-UNATTENDED-APP-IPC-INSTALL-001 (installer for the HCC unattended app IPC handler)

## 1. Goal

Add a thin installer for the existing HCC unattended app IPC
handler (added in `56ed9d0`). The installer calls
`ipcMain.handle` on `HCC_UNATTENDED_APP_IPC_CHANNEL` and
delegates the registered handler to
`handleHccUnattendedAppIpcRequest`.

This slice is **installer contract only**. The installer is
exported as a pure function. It is NOT called from
`src/main/index.ts` in this commit. A future wiring slice
(out of scope here) is responsible for invoking the
installer from an explicit user-gesture entrypoint (NOT on
app boot).

## 2. Allowed files (5)

1. `src/main/ipc-handlers/install-hcc-unattended-app.ts` — installer source
2. `tests/auto-executor/hcc-unattended-app-ipc-install.test.ts` — installer tests
3. `docs/plan/hcc-unattended-app-ipc-install-preflight-2026-06-15.md` — this file
4. `docs/plan/hcc-unattended-app-ipc-install-go-no-go-2026-06-15.md` — per-gate GO/NO-GO matrix
5. `docs/closeout/hcc-unattended-app-ipc-install-001-closeout-2026-06-15.md` — closeout

## 3. Installer contract

```
installHccUnattendedAppIpc(ipcMainLike, deps?) -> HCCUnattendedAppIpcInstallResult
```

- Pure function over its arguments.
- Validates `ipcMainLike` (must be an object with a `handle(channel, handler)` method).
- On validation failure → returns typed NO-GO result WITHOUT registering.
- On success → registers exactly one handler on `HCC_UNATTENDED_APP_IPC_CHANNEL` and returns `{ verdict: "INSTALLED", channel, handler_count: 1, installed_at }`.
- Optional `deps` bag:
  - `handleHccUnattendedAppIpcRequest` — defaults to the real handler; tests inject a mock.
  - `now` — `() => number`; tests inject a fixed timestamp.
- The installer does NOT call `ipcMain.handle` at module load time; a future wiring slice is responsible for invoking it.

## 4. NO-GO short-circuit ordering

The installer validates `ipcMainLike` synchronously. If
`ipcMainLike` is missing, null, an object without a `handle`
method, or has a non-function `handle`, the installer returns
`verdict: "NO-GO"` and the `ipcMainLike.handle` method is
NEVER called.

On success, the installer calls `ipcMainLike.handle` exactly
once with `(HCC_UNATTENDED_APP_IPC_CHANNEL, asyncFn)` and
returns the deterministic install result.

## 5. What this slice does NOT do

- Does NOT call `setInterval` / `setTimeout` / `setImmediate`.
- Does NOT call `spawn` / `exec` / `child_process` directly.
- Does NOT call `submitDryRunAction`.
- Does NOT import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Does NOT write to `~/.hermes/**`.
- Does NOT modify `src/main/index.ts`.
- Does NOT register the installer on app boot.
- Does NOT modify `package.json` or `package-lock.json`.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Does NOT set `go_no_go: "GO"`.
- Does NOT flip `night_run_ready: true`.
- Does NOT flip `auto_executor_started: true`.
- Does NOT perform any I/O beyond calling
  `ipcMainLike.handle` once and constructing the result.

## 6. Preserved literals (delegated to handler)

The installer's result does NOT carry
`night_run_ready` / `go_no_go` / `auto_executor_started` —
those are part of the **handler's** result, not the
installer's. The installer preserves the channel constant as
a string literal:
- `channel: "hcc:unattended-scheduled-dispatch"` (literal,
  imported from the handler module as
  `HCC_UNATTENDED_APP_IPC_CHANNEL`).

The installer DOES NOT set `go_no_go: "GO"` or
`night_run_ready: true` anywhere in its source. Enforced by
static test with comments stripped.

## 7. Pre-Commit gates (must all pass)

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-app-ipc-install.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status -- src/main/index.ts package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
rg -n 'setInterval|setTimeout|child_process|spawn\(|exec\(|submitDryRunAction|auto-executor-bootstrap|auto-executor-arm|auto-executor-start|auto-executor-host|~/.hermes|go_no_go: "GO"|night_run_ready: true' \
    src/main/ipc-handlers/install-hcc-unattended-app.ts \
    tests/auto-executor/hcc-unattended-app-ipc-install.test.ts
```

## 8. Forbidden mutations

- Setting `go_no_go: "GO"` anywhere in the source.
- Setting `night_run_ready: true` anywhere in the source.
- Setting `auto_executor_started: true` anywhere in the source.
- Calling `ipcMain.handle` at module load time (registration
  must be deferred to a future wiring slice).
- Importing `submitDryRunAction`.
- Writing to `~/.hermes/**`.
- Touching `package.json` or `package-lock.json`.
- Touching `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Touching `src/main/index.ts`.
- Registering IPC, renderer, preload, timer, cron, or auto-arm.

## 9. Commit / Push

- Commit only if all gates pass.
- Commit on a local branch named `hcc-unattended-app-ipc-install-001`
  (per slice spec).
- Do NOT push unless explicitly authorized by the user.
