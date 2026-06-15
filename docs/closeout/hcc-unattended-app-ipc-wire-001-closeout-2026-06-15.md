# HCC-UNATTENDED-APP-IPC-WIRE-001 — Closeout

Date: 2026-06-15
Branch: hcc-unattended-app-ipc-wire-001 (local, not pushed)
Base: origin/hermes-pro-main @ 70948f9
Slice: HCC-UNATTENDED-APP-IPC-WIRE-001

## 1. Outcome

**GO for the wire slice.** A pure async wire helper
`handleHccUnattendedAppIpcInstallGesture(payload, deps)`
added at `src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts`,
and a surgical 2-line change in `src/main/index.ts` (one
import + one `ipcMain.handle` call inside `setupIPC()`) that
registers only the arming channel
`HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL`. The final HCC
dispatch channel is NOT registered on app boot — it is
registered only on explicit user gesture via the arming
channel. The wire helper is idempotent.

## 2. Files (6)

| File | Role | Status |
|------|------|--------|
| `src/main/index.ts` | existing — surgical change: +1 import, +1 `ipcMain.handle` | M (small) |
| `src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts` | wire helper source | A |
| `tests/auto-executor/hcc-unattended-app-ipc-wire.test.ts` | 18 wire tests | A |
| `docs/plan/hcc-unattended-app-ipc-wire-preflight-2026-06-15.md` | preflight | A |
| `docs/plan/hcc-unattended-app-ipc-wire-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix | A |
| `docs/closeout/hcc-unattended-app-ipc-wire-001-closeout-2026-06-15.md` | this file | A |

No other files in the commit. Red-line files
(`package.json`, `package-lock.json`,
`docs/knowledge/vault-health-report-2026-06-12.md`,
`.wolf/memory.md`, `src/renderer/**`, `src/preload/**`) were
not touched.

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS (clean exit) |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-app-ipc-wire.test.ts` | 18/18 PASS |
| 3 | `npx vitest run tests/auto-executor/` | all pass |
| 4 | `npx vitest run tests/safety` | all pass |
| 5 | `git diff --check` | clean |
| 6 | `git diff --name-status -- package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` | empty |
| 7 | `git diff --name-status -- src/renderer src/preload` | empty |
| 8 | forbidden-token scan (per preflight §9) | all matches are in **comments / docs / test descriptions** explicitly forbidding the tokens; no runtime values |

## 4. Arming GO/NO-GO Matrix

| Scenario | `gesture_verdict` | `verdict` | `ipcMainLike.handle` called? | Installer called? |
|----------|-------------------|-----------|------------------------------|-------------------|
| Valid payload (first time) | `INSTALLED` | `INSTALLED` | YES (once) | YES (once) |
| Valid payload (subsequent, after first install) | `ALREADY-INSTALLED` | `INSTALLED` (cached) | NO (cached) | NO (cached) |
| `user_confirmation: false` | `NO-GO` | `NO-GO` | NO | NO |
| Missing `explicit_unattended_trigger_token` | `NO-GO` | `NO-GO` | NO | NO |
| `feature_flag_enabled: false` | `NO-GO` | `NO-GO` | NO | NO |
| Null payload | `NO-GO` | `NO-GO` | NO | NO |
| Non-object payload | `NO-GO` | `NO-GO` | NO | NO |
| Valid payload followed by invalid payload | `INSTALLED` then `NO-GO` | `INSTALLED` then `NO-GO` | YES (once) then NO | YES (once) then NO |
| NO-GO payload followed by valid payload (state not poisoned) | `NO-GO` then `INSTALLED` | `NO-GO` then `INSTALLED` | NO then YES (once) | NO then YES (once) |

## 5. `src/main/index.ts` diff summary

Two surgical additions, no other changes:

1. **Imports block (after line 84, in the existing import
   group):** one new import — the wire helper.

2. **`setupIPC()` body (just before the existing
   `createKnowledgeIpcStartup(ipcMain)` call):** one new
   `ipcMain.handle(HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL, ...)`.
   The handler is a thin wrapper that delegates to
   `handleHccUnattendedAppIpcInstallGesture(payload, { ipcMainLike: ipcMain })`.

No existing `ipcMain.handle` calls are touched. The
`createKnowledgeIpcStartup(ipcMain)` call is unchanged. The
function `setupIPC` and the rest of `src/main/index.ts` are
unchanged.

Static checks confirm:
- The arming channel constant is referenced exactly once via `ipcMain.handle`.
- The final dispatch channel constant is NOT present (after comments stripped).
- `runAppUnattendedScheduledDispatch` is NOT present.
- The entrypoint module import is NOT present.

## 6. Forbidden-Surface Scan — Result

All forbidden tokens NOT PRESENT in the wire helper source
and in `src/main/index.ts` (with comments stripped). The full
list is in
`docs/plan/hcc-unattended-app-ipc-wire-go-no-go-2026-06-15.md` §3.

## 7. What This Slice Did Not Do

- Did not execute HCC on app boot. The final dispatch
  channel is NOT registered on app boot.
- Did not call `setInterval` / `setTimeout` / `setImmediate`.
- Did not call `spawn` / `exec` / `child_process` directly.
- Did not call `submitDryRunAction`.
- Did not import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Did not write to `~/.hermes/**`.
- Did not modify `package.json` or `package-lock.json`.
- Did not touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Did not touch `src/renderer/**` or `src/preload/**`.
- Did not set `go_no_go: "GO"`.
- Did not flip `night_run_ready: true`.
- Did not flip `auto_executor_started: true`.

## 8. Push

Per slice spec, the commit lands on a local branch named
`hcc-unattended-app-ipc-wire-001`. **NOT pushed.** Push is
deferred until the user explicitly authorizes
`git push origin hcc-unattended-app-ipc-wire-001:hermes-pro-main`.

## 9. Next Step

Suggested follow-up (separate slice, separate GO-gated decision):

1. **Renderer-side confirmation modal and button** — the
   next slice (HCC-UNATTENDED-APP-IPC-RENDERER-001) adds an
   in-app button + confirmation modal. The button click
   handler posts to
   `HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL` (the arming
   channel) with the required 3-field payload. The button
   is disabled until the user has explicitly clicked through
   the confirmation modal. The renderer-side change is the
   only change in this slice — `src/main/index.ts` is NOT
   touched. The renderer slice must keep all the same red
   lines: no `setInterval` / `setTimeout` / cron / auto-arm;
   preserve `night_run_ready: false` and `go_no_go: "NO-GO"`;
   no `submitDryRunAction`; no `~/.hermes/**` writes.
2. **Inject a real dispatch adapter** in the handler. The
   current no-op adapter throws on `dispatch`; a production
   wiring slice injects a real adapter via
   `deps.dispatchAdapter`. This is the prerequisite for the
   handler to actually perform a dispatch.
3. **Production real-adapter wiring** in the dispatch
   path. The handler in `56ed9d0` already supports an
   injected dispatch adapter; a future slice wires the
   production adapter.
