# HCC-UNATTENDED-APP-IPC-INSTALL-001 — Closeout

Date: 2026-06-15
Branch: hcc-unattended-app-ipc-install-001 (local, not pushed)
Base: origin/hermes-pro-main @ 56ed9d0
Slice: HCC-UNATTENDED-APP-IPC-INSTALL-001

## 1. Outcome

**GO for the HCC unattended app IPC installer contract.** A
pure function `installHccUnattendedAppIpc(ipcMainLike, deps?)`
added at `src/main/ipc-handlers/install-hcc-unattended-app.ts`.
The installer calls `ipcMainLike.handle` exactly once on
`HCC_UNATTENDED_APP_IPC_CHANNEL` and delegates the registered
handler to `handleHccUnattendedAppIpcRequest` from `56ed9d0`.
No app-boot wiring, no renderer button, no timer, no
`~/.hermes/**` write, no `package.json` change.

## 2. Files (5)

| File | Role |
|------|------|
| `src/main/ipc-handlers/install-hcc-unattended-app.ts` | installer source |
| `tests/auto-executor/hcc-unattended-app-ipc-install.test.ts` | 17 installer tests |
| `docs/plan/hcc-unattended-app-ipc-install-preflight-2026-06-15.md` | preflight |
| `docs/plan/hcc-unattended-app-ipc-install-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix |
| `docs/closeout/hcc-unattended-app-ipc-install-001-closeout-2026-06-15.md` | this file |

No other files in the commit. Red-line files
(`src/main/index.ts`, `package.json`, `package-lock.json`,
`docs/knowledge/vault-health-report-2026-06-12.md`,
`.wolf/memory.md`, renderer/UI drift) were not touched.

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS (clean exit) |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-app-ipc-install.test.ts` | 17/17 PASS |
| 3 | `npx vitest run tests/auto-executor/` | all pass |
| 4 | `npx vitest run tests/safety` | all pass |
| 5 | `git diff --check` | clean |
| 6 | `git diff --name-status -- src/main/index.ts package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` | empty |
| 7 | forbidden-token scan (per preflight §7) | clean |

## 4. Installer GO/NO-GO Matrix

| Scenario | Verdict | `ipcMainLike.handle` called? |
|----------|---------|------------------------------|
| Valid `ipcMainLike` (handle is a function) | `INSTALLED` | YES (once) |
| `ipcMainLike = undefined` | `NO-GO` | NO |
| `ipcMainLike = null` | `NO-GO` | NO |
| `ipcMainLike` is an object without `handle` | `NO-GO` | NO |
| `ipcMainLike.handle` is non-function (e.g. string) | `NO-GO` | NO |
| Injected `handleHccUnattendedAppIpcRequest` is used | `INSTALLED` | YES (once) |
| Injected `now()` provides deterministic `installed_at` | `INSTALLED` | YES (once) |
| Registered handler delegates to the real handler | `INSTALLED` (handler call is what happens) | YES (once) |

## 5. Forbidden-Surface Scan — Result

All forbidden tokens NOT PRESENT in the installer source (with
comments stripped). The full list is in
`docs/plan/hcc-unattended-app-ipc-install-go-no-go-2026-06-15.md` §4.

## 6. What This Slice Did Not Do

- Did not modify `src/main/index.ts`.
- Did not call `ipcMain.handle` at module load time.
- Did not call `ipcMain.handle` from any code path that runs
  on app boot.
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
- Did not perform any I/O beyond calling
  `ipcMainLike.handle` once and constructing the result.

## 7. Push

Per slice spec, the commit lands on a local branch named
`hcc-unattended-app-ipc-install-001`. **NOT pushed.** Push is
deferred until the user explicitly authorizes
`git push origin <hash>:hermes-pro-main`.

## 8. Next Step

Suggested follow-up (separate slice, separate GO-gated decision):

1. **Wire the installer into `src/main/index.ts`** — a
   follow-up wiring slice that adds a single call to
   `installHccUnattendedAppIpc(ipcMain)` from an explicit
   user-gesture entrypoint (NOT on app boot). The wiring
   slice must be explicitly authorized because it touches
   `src/main/index.ts`. Same red lines: no
   `setInterval` / `setTimeout` / cron / auto-arm; preserve
   `night_run_ready: false` and `go_no_go: "NO-GO"`; no
   `submitDryRunAction`; no `~/.hermes/**` writes.
2. **Add the renderer-side confirmation modal and button**
   that posts to `hcc:unattended-scheduled-dispatch`. This is
   a renderer-side change and requires a renderer-aware
   GO-gated decision. Depends on the wiring slice landing
   first.
3. **Inject a real dispatch adapter** in the handler. The
   current no-op adapter throws on `dispatch`; a production
   wiring slice injects a real adapter via
   `deps.dispatchAdapter`. This is the prerequisite for the
   handler to actually perform a dispatch.
