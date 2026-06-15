# HCC-UNATTENDED-APP-IPC-PRODUCTION-WIRING-001 — Closeout

Date: 2026-06-15
Branch: hcc-unattended-app-ipc-production-wiring-001 (local)
Base: origin/hermes-pro-main @ 2e193e3
Slice: HCC-UNATTENDED-APP-IPC-PRODUCTION-WIRING-001

## 1. Outcome

**GO for the production wiring slice.** The wire helper now
accepts a `buildProductionHandlerDeps` factory. The factory
is called once on the first successful arming and the
resolved deps are cached for idempotency. Existing behavior
is preserved when no factory is provided.

## 2. Files (5)

| File | Role | Status |
|------|------|--------|
| `src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts` | wire helper — factory + cache | M |
| `tests/auto-executor/hcc-unattended-app-ipc-production-wiring.test.ts` | 11 tests | A |
| `docs/plan/hcc-unattended-app-ipc-production-wiring-preflight-2026-06-15.md` | preflight | A |
| `docs/plan/hcc-unattended-app-ipc-production-wiring-go-no-go-2026-06-15.md` | matrix | A |
| `docs/closeout/hcc-unattended-app-ipc-production-wiring-001-closeout-2026-06-15.md` | this file | A |

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-app-ipc-production-wiring.test.ts` | 11/11 PASS |
| 3 | `npx vitest run tests/auto-executor/` | 39/39 files, 917/917 PASS |
| 4 | `npx vitest run tests/safety` | 36/36 files, 988/988 PASS |
| 5 | `git diff --check` | clean |

## 4. Whether `src/main/index.ts` changed

**NO.** The existing `setupIPC` call
`handleHccUnattendedAppIpcInstallGesture(payload, { ipcMainLike: ipcMain })`
remains valid and safe. Production wiring is opt-in via
the new `buildProductionHandlerDeps` factory. With no
factory provided, the installer receives
`handler_deps: undefined` and the existing safe NO-GO
fallback is preserved.

## 5. Whether production deps are default-on or only injected

**Only injected.** Default behavior (no factory) is
`handler_deps: undefined` → safe NO-GO fallback. Production
wiring is opt-in by the caller passing a
`buildProductionHandlerDeps` factory.

## 6. Red-line confirmation

- `src/main/index.ts` unchanged.
- `src/preload/**` / `src/renderer/**` unchanged.
- `package.json` / `package-lock.json` unchanged.
- `docs/knowledge/vault-health-report-2026-06-12.md` /
  `.wolf/memory.md` unchanged.
- No `spawn` / `exec` / `child_process` /
  `ipcMain.handle` (at module load) / `BrowserWindow` /
  `contextBridge` / `setInterval` / `setTimeout` /
  `submitDryRunAction` / `~/.hermes` writes / runtime
  `go_no_go: "GO"` / runtime `night_run_ready: true` in the
  wire helper source.

## 7. Push

NOT pushed. Local branch only. Push deferred.

## 8. Next slice: end-to-end smoke

HCC-UNATTENDED-APP-IPC-E2E-SMOKE-001 — wire the production
deps from a real `setupIPC` call site and add an end-to-end
test that exercises the chain from renderer button click →
arming → install → IPC request → runner dispatch. This is
the final integration milestone.
