# HCC-UNATTENDED-APP-IPC-001 — Closeout

Date: 2026-06-15
Branch: hermes-pro-main (detached HEAD at e754033 + 1 commit)
Base: origin/hermes-pro-main @ e754033
Slice: HCC-UNATTENDED-APP-IPC-001

## 1. Outcome

**GO for the in-app IPC handler contract.** A pure async
handler `handleHccUnattendedAppIpcRequest(request, deps)`
added at `src/main/ipc-handlers/hcc-unattended-app.ts`. The
handler delegates to `runAppUnattendedScheduledDispatch` from
`740b4f4` and produces a deterministic JSON-serializable
result. No `ipcMain.handle` registration, no app-boot wiring,
no renderer button, no timer, no IPC handler auto-arming.

## 2. Files (5)

| File | Role |
|------|------|
| `src/main/ipc-handlers/hcc-unattended-app.ts` | handler source |
| `tests/auto-executor/hcc-unattended-app-ipc.test.ts` | 22 handler tests |
| `docs/plan/hcc-unattended-app-ipc-preflight-2026-06-15.md` | preflight |
| `docs/plan/hcc-unattended-app-ipc-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix |
| `docs/closeout/hcc-unattended-app-ipc-001-closeout-2026-06-15.md` | this file |

`src/main/ipc-handlers/index.ts` was offered as an optional
6th file but is NOT included — the handler is a pure exported
function with no installer, so no index file is needed in this
slice. A future wiring slice that adds the `ipcMain.handle`
registration may add `src/main/ipc-handlers/index.ts` as its
own installer export.

No other files in the commit. Red-line files
(`src/main/index.ts`, `package.json`, `package-lock.json`,
`docs/knowledge/vault-health-report-2026-06-12.md`,
`.wolf/memory.md`, renderer/UI drift) were not touched.

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS (clean exit) |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-app-ipc.test.ts` | 22/22 PASS |
| 3 | `npx vitest run tests/auto-executor/` | all pass |
| 4 | `npx vitest run tests/safety` | all pass |
| 5 | `git diff --check` | clean |
| 6 | `git diff --name-status -- package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` | empty |
| 7 | `git diff --name-status -- src/main/index.ts` | empty |
| 8 | forbidden-token scan (per preflight §8) | clean |

## 4. IPC GO/NO-GO Matrix

| Scenario | Verdict | Entrypoint called? |
|----------|---------|--------------------|
| All gates pass (mocked entrypoint) | `APP-UNATTENDED-SCHEDULED-DISPATCHED` | YES (once) |
| All gates pass (real entrypoint) | `NO-GO` (entrypoint surfaces the no-op ready_result scaffold) | YES (once) |
| Missing `app_session_id` | `NO-GO` | NO |
| Missing `app_invocation_id` | `NO-GO` | NO |
| `user_confirmation: false` | `NO-GO` | NO |
| Missing `explicit_unattended_trigger_token` | `NO-GO` | NO |
| `feature_flag_enabled: false` | `NO-GO` | NO |
| Unsupported `planned_action_kind` | `NO-GO` | NO |
| Missing `target_path` | `NO-GO` | NO |
| Null payload | `NO-GO` | NO |
| Non-object payload | `NO-GO` | NO |
| Entrypoint returns NO-GO | `NO-GO` (propagated reason) | YES (once) |
| Entrypoint throws | `NO-GO` (propagated reason) | YES (once, throws) |

## 5. Forbidden-Surface Scan — Result

All forbidden tokens NOT PRESENT in the handler source (with
comments stripped). The full list is in
`docs/plan/hcc-unattended-app-ipc-go-no-go-2026-06-15.md` §3.

The handler source also does NOT call `ipcMain.handle`
(registration is a future wiring slice, out of scope here).
This is enforced by a static test.

## 6. Side-Effect / Ready Field Locations

`night_run_ready: false` and `go_no_go: "NO-GO"` and
`auto_executor_started: false` and `would_execute: false` and
`real_execution_ready: false` are set as literal-false / literal-"NO-GO"
in the handler's `noGo()` function. The success path forwards
the entrypoint's result verbatim.

`go_no_go: "GO"` and `night_run_ready: true` do NOT appear
anywhere as runtime values. A static test enforces this with
comments-stripped regex matches.

## 7. What This Slice Did Not Do

- Did not modify `src/main/index.ts`.
- Did not call `ipcMain.handle` (registration is a future
  wiring slice).
- Did not add a renderer button or modal.
- Did not register IPC, renderer, preload, timer, cron, or
  boot-time auto-start.
- Did not import `submitDryRunAction`.
- Did not import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Did not write to `~/.hermes/**`.
- Did not modify `package.json` or `package-lock.json`.
- Did not touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Did not set `go_no_go: "GO"`.
- Did not flip `night_run_ready: true`.
- Did not flip `auto_executor_started: true`.
- Did not perform any I/O beyond reading the function
  arguments and constructing the response object.

## 8. Push

Per task spec, the slice did not carry an explicit push
authorization. The commit is local. Push is deferred until the
user explicitly authorizes `git push origin <hash>:hermes-pro-main`.

## 9. Next Step

Suggested follow-up (separate slice, separate GO-gated decision):

1. **Wire the handler into `ipcMain.handle`** — add an
   exported installer function (e.g. `installHccUnattendedAppIpc`)
   in a new file under `src/main/ipc-handlers/`. The installer
   calls `ipcMain.handle(HCC_UNATTENDED_APP_IPC_CHANNEL, async (event, payload) => handleHccUnattendedAppIpcRequest(payload))`. A second
   `src/main/index.ts` change registers the installer from
   an explicit user-gesture entrypoint (NOT on app boot). The
   IPC handler is registered only when the user has
   confirmed an in-app action. This slice is explicitly out
   of scope here and requires its own GO-gated decision
   against the matrix in
   `docs/plan/hcc-unattended-app-ipc-go-no-go-2026-06-15.md`.
2. **Add the renderer-side confirmation modal and button**
   that posts to `hcc:unattended-scheduled-dispatch`. This is
   a renderer-side change and requires a renderer-aware GO-gated
   decision.
3. **Inject a real dispatch adapter** in the IPC handler. The
   current no-op adapter throws on `dispatch`; a production
   wiring slice injects a real adapter via
   `deps.dispatchAdapter`. This is the prerequisite for the
   handler to actually perform a dispatch.
