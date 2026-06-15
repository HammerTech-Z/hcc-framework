# HCC-UNATTENDED-APP-IPC-E2E-SMOKE-001 — Preflight

Date: 2026-06-15
Base: origin/hermes-pro-main @ 69e01d0
Slice: HCC-UNATTENDED-APP-IPC-E2E-SMOKE-001

## 1. Goal

Final end-to-end smoke test proving the full HCC
unattended app IPC chain works in-process:

```
renderer button click
  -> ConfirmDialog
  -> armHccUnattendedAppIpc
  -> handleHccUnattendedAppIpcInstallGesture
  -> real installer
  -> final IPC handler registered
  -> valid final IPC request
  -> real handler / entrypoint / scheduler / runner
  -> injected dispatch_adapter.dispatch
```

This is the final integration milestone. No runtime
code change in this slice — tests + docs only.

## 2. Allowed files (4)

1. `tests/auto-executor/hcc-unattended-app-ipc-e2e-smoke.test.ts` — A
2. `docs/plan/hcc-unattended-app-ipc-e2e-smoke-preflight-2026-06-15.md` — A (this file)
3. `docs/plan/hcc-unattended-app-ipc-e2e-smoke-go-no-go-2026-06-15.md` — A
4. `docs/closeout/hcc-unattended-app-ipc-e2e-smoke-001-closeout-2026-06-15.md` — A

## 3. How the test crosses the IPC boundary

The test sets `window.hermesAPI.armHccUnattendedAppIpc` to a
preload-style async function that delegates to
`handleHccUnattendedAppIpcInstallGesture` from the wire
helper module. The renderer component only sees the bridge
surface; the test injects a fake `ipcMainLike.handle` that
captures the real handler the installer registers.

## 4. Tests (7)

| # | Test | Outcome |
|---|------|---------|
| 1 | render does NOT arm | `registerCount === 0` |
| 2 | first button click opens confirmation only | `registerCount === 0`, dialog visible |
| 3 | confirm click arms exactly once | `registerCount === 1`, channel is `HCC_UNATTENDED_APP_IPC_CHANNEL` |
| 4 | valid final IPC request reaches dispatch_adapter.dispatch exactly once | `verdict: APP-UNATTENDED-SCHEDULED-DISPATCHED`, `dispatch` called once |
| 5 | cancel does NOT arm | `registerCount === 0` |
| 6 | ready_result task_id mismatch returns NO-GO | `verdict: NO-GO`, `dispatch` not called |
| 7 | repeated confirm is idempotent | second arm returns ALREADY-INSTALLED, `registerCount` stays 1 |

## 5. Pre-Commit gates

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-app-ipc-e2e-smoke.test.ts
npx vitest run tests/auto-executor/
npx vitest run src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx
npx vitest run tests/safety
git diff --check
git diff --name-status 69e01d0..HEAD -- src/main/index.ts src/preload package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
```

## 6. Commit / Push

- Commit on local branch `hcc-unattended-app-ipc-e2e-smoke-001`.
- Push deferred until user explicitly authorizes.
