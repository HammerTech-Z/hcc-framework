# HCC-UNATTENDED-APP-IPC-PRODUCTION-WIRING-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 2e193e3 (`hcc: add ready_result injection to app ipc handler`)
Slice: HCC-UNATTENDED-APP-IPC-PRODUCTION-WIRING-001

## 1. Goal

Wire production handler_deps into the existing app IPC
arming chain. The slice connects BOTH already-existing
injectable slots:
- `ready_result` (added in `2e193e3`)
- `dispatch_adapter` (added in `1a997aa`)

This is the final slice before the full end-to-end chain
from renderer button click to actual dispatch.

## 2. Approach: factory on the wire helper

The wire helper at
`src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts`
(added in `b4dbaa7`) already forwards `handler_deps` to
the installer. This slice adds an OPTIONAL
`buildProductionHandlerDeps?: () => unknown` factory to
the wire helper's `HCCUnattendedAppIpcInstallGestureDeps`.
On a successful arming, the wire helper:
1. Calls the factory exactly once (cached for idempotency).
2. Passes the resolved deps to the installer.

The existing `src/main/index.ts` call is unchanged —
production wiring is opt-in via the new factory. With no
factory provided, the existing safe NO-GO fallback is
preserved (installer receives `handler_deps: undefined`).

## 3. Allowed files (5)

1. `src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts` — M (narrow)
2. `tests/auto-executor/hcc-unattended-app-ipc-production-wiring.test.ts` — A
3. `docs/plan/hcc-unattended-app-ipc-production-wiring-preflight-2026-06-15.md` — A
4. `docs/plan/hcc-unattended-app-ipc-production-wiring-go-no-go-2026-06-15.md` — A
5. `docs/closeout/hcc-unattended-app-ipc-production-wiring-001-closeout-2026-06-15.md` — A

`src/main/index.ts` is NOT touched. The existing
`setupIPC` call
`handleHccUnattendedAppIpcInstallGesture(payload, { ipcMainLike: ipcMain })`
remains valid and safe — it just won't pass production
deps. A future slice may opt in to production wiring
by extending the call site.

## 4. Implementation

### Wire helper changes (4 narrow edits)

1. `HCCUnattendedAppIpcInstallGestureDeps` gains an optional
   `buildProductionHandlerDeps?: () => unknown` factory.
2. `HCCUnattendedAppIpcInstallGestureDeps.stateStore` gains
   an optional `cachedHandlerDeps?: unknown` field.
3. The default `stateStore` shape includes
   `cachedHandlerDeps?: unknown`.
4. The install-call section resolves `handler_deps` from
   `stateStore.cachedHandlerDeps` (priority 1) →
   `deps.buildProductionHandlerDeps()` (priority 2, called
   once and cached) → `deps.handler_deps` (priority 3,
   static) → `undefined` (priority 4, safe default). The
   resolved value is cached on successful install.

## 5. What this slice does NOT do

- Does NOT modify `src/main/index.ts`.
- Does NOT touch `src/preload/**` / `src/renderer/**`.
- Does NOT touch `package.json` / `package-lock.json`.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`
  or `.wolf/memory.md`.
- Does NOT add timers / cron / auto-arm / shell / file writes.
- Does NOT call `ipcMain.handle` at module load time.
- Does NOT set `go_no_go: "GO"` or flip `night_run_ready: true`.

## 6. Pre-Commit gates

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-app-ipc-production-wiring.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status 2e193e3..HEAD -- src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
```

## 7. Commit / Push

- Commit on local branch
  `hcc-unattended-app-ipc-production-wiring-001`.
- Push deferred until user explicitly authorizes.
