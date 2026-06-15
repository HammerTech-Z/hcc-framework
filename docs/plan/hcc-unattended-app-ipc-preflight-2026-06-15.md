# HCC-UNATTENDED-APP-IPC-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ e754033 (`hcc: add unattended terminal cli entrypoint`)
Slice: HCC-UNATTENDED-APP-IPC-001 (in-app IPC handler contract for unattended HCC)

## 1. Goal

Add the in-app IPC handler contract for unattended HCC. The handler
consumes an app-side IPC payload and delegates to
`runAppUnattendedScheduledDispatch` from
`src/shared/lib/hcc-unattended-app-entrypoint.ts` (added in
`740b4f4`).

This slice is **main-process IPC handler only**. It does NOT
add a renderer button, a modal, app-boot registration, a timer,
a cron, or auto-arm. The handler is a pure async function; the
`ipcMain.handle` registration is delegated to a future wiring
slice (out of scope here, explicitly out of scope per slice spec).

## 2. Allowed files (5)

1. `src/main/ipc-handlers/hcc-unattended-app.ts` — handler source
2. `tests/auto-executor/hcc-unattended-app-ipc.test.ts` — handler tests
3. `docs/plan/hcc-unattended-app-ipc-preflight-2026-06-15.md` — this file
4. `docs/plan/hcc-unattended-app-ipc-go-no-go-2026-06-15.md` — per-gate GO/NO-GO matrix
5. `docs/closeout/hcc-unattended-app-ipc-001-closeout-2026-06-15.md` — closeout

`src/main/ipc-handlers/index.ts` was offered as an optional 6th
file ("if needed") but is NOT required: the handler is a pure
exported function and there is no `ipcMain.handle` registration
in this slice, so no installer is needed yet. Adding
`ipc-handlers/index.ts` with an installer function is a future
slice's concern.

## 3. Contract

```
handleHccUnattendedAppIpcRequest(request, deps) -> Promise<HCCUnattendedAppIpcResult>
```

- Async, pure over the IPC payload.
- Validates the payload shape up front. NO-GO short-circuits
  before the entrypoint is called.
- On valid payload, builds the entrypoint input and awaits the
  entrypoint. The entrypoint does its own re-validation.
- Returns a deterministic JSON-serializable result.

## 4. Identity gates (5 + 1 delegated)

| # | Gate | Source field |
|---|------|--------------|
| 1 | `app_session_id` | request.app_session_id (non-empty) |
| 2 | `app_invocation_id` | request.app_invocation_id (non-empty) |
| 3 | `user_confirmation === true` | request.user_confirmation |
| 4 | `explicit_unattended_trigger_token` | request.explicit_unattended_trigger_token (non-empty) |
| 5 | `feature_flag_enabled === true` | request.feature_flag_enabled |
| 6 | (delegated) scheduler input | scheduler_input.* (re-validated by entrypoint) |

Plus 3 structural scheduler-input gates (planned_action_kind
is one of `shell_command` / `file_write` / `config_patch`,
target_path non-empty, etc.).

## 5. NO-GO short-circuit ordering

The handler evaluates its identity gates synchronously up
front. If any gate fails, the handler returns
`verdict: "NO-GO"` with a typed reason and NEVER calls
`runAppUnattendedScheduledDispatch`.

On success, the handler awaits the entrypoint. The entrypoint
itself re-runs its own gates and either returns
`APP-UNATTENDED-SCHEDULED-DISPATCHED` (forwarded as the
handler's success result) or `NO-GO` (forwarded as the
handler's NO-GO result with the entrypoint's reason).

If the entrypoint itself throws (defense in depth — the
entrypoint catches runner / adapter throws and surfaces a typed
NO-GO, but if a future wiring injects a throwing runFn), the
handler returns typed `NO-GO` with the propagated reason.

## 6. What this slice does NOT do

- Does NOT call `setInterval` / `setTimeout` / `setImmediate`.
- Does NOT call `spawn` / `exec` / `child_process` directly.
- Does NOT call `submitDryRunAction`.
- Does NOT import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Does NOT write to `~/.hermes/**`.
- Does NOT register IPC, renderer, preload, or boot-time auto-start.
- Does NOT modify `src/main/index.ts`.
- Does NOT modify `package.json` or `package-lock.json`.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Does NOT set `go_no_go: "GO"`.
- Does NOT flip `night_run_ready: true`.
- Does NOT flip `auto_executor_started: true`.
- Does NOT perform any I/O beyond reading the function
  arguments and constructing the response object.

## 7. Preserved literals

- `night_run_ready: false` (literal, in both success and NO-GO paths)
- `go_no_go: "NO-GO"` (literal)
- `auto_executor_started: false` (literal)
- `would_execute: false` (literal)
- `real_execution_ready: false` (literal)
- `go_no_go: "GO"` does NOT appear anywhere as a runtime value.
  Enforced by static test with comments stripped.

## 8. Pre-Commit gates (must all pass)

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-app-ipc.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status -- package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
git diff --name-status -- src/main/index.ts
rg -n 'night-run|夜间|go_no_go: "GO"|night_run_ready: true|setInterval|setTimeout|child_process|submitDryRunAction|ipcMain\.handle|BrowserWindow|contextBridge|~/.hermes' \
    src/main/ipc-handlers/hcc-unattended-app.ts \
    tests/auto-executor/hcc-unattended-app-ipc.test.ts
```

## 9. Forbidden mutations

- Setting `go_no_go: "GO"` anywhere in the source.
- Setting `night_run_ready: true` anywhere in the source.
- Calling `ipcMain.handle` (registration is out of scope).
- Importing `submitDryRunAction`.
- Writing to `~/.hermes/**`.
- Touching `package.json` or `package-lock.json`.
- Touching `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Touching `src/main/index.ts`.

## 10. Commit / Push

- Commit only if all gates pass.
- Commit message: `hcc: add unattended app ipc handler contract`
- Push: per task spec, "pushed or not pushed" reported in closeout.
  No forced push. No rebase.
