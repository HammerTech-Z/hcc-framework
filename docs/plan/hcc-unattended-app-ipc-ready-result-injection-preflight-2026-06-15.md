# HCC-UNATTENDED-APP-IPC-READY-RESULT-INJECTION-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 1a997aa (`hcc: add dispatch adapter injection to app ipc handler`)
Slice: HCC-UNATTENDED-APP-IPC-READY-RESULT-INJECTION-001

## 1. Goal

Add a narrow `ready_result` injection contract for the HCC
app IPC handler. A caller/test/installer deps chain can
inject a real `HCCUnattendedReadyConsumerResult` into
`scheduler_input.ready_result`. The fallback is the existing
safe no-go scaffold.

This is the second of two injectable deps fields needed
before a production dispatch can fire:
(a) `dispatch_adapter` (added in `1a997aa`)
(b) `ready_result` (added in this slice)

## 2. Allowed files (5)

1. `src/main/ipc-handlers/hcc-unattended-app.ts` — M (narrow)
2. `tests/auto-executor/hcc-unattended-app-ipc-ready-result-injection.test.ts` — A
3. `docs/plan/hcc-unattended-app-ipc-ready-result-injection-preflight-2026-06-15.md` — A (this file)
4. `docs/plan/hcc-unattended-app-ipc-ready-result-injection-go-no-go-2026-06-15.md` — A
5. `docs/closeout/hcc-unattended-app-ipc-ready-result-injection-001-closeout-2026-06-15.md` — A

## 3. Surgical changes

1. Import `HCCUnattendedReadyConsumerResult` from `hcc-unattended-ready-consumer`.
2. Add `ready_result?: HCCUnattendedReadyConsumerResult` to `HCCUnattendedAppIpcHandlerDeps`.
3. Extract the inline no-go ready_result scaffold into `defaultNoGoReadyResult(request)`.
4. Replace: `ready_result: deps.ready_result ?? defaultNoGoReadyResult(request)`.
5. All forbidden-surface red lines preserved. See §8 gate roster.

## 4. What this slice does NOT do

- Does NOT synthesize a real ready_result from the IPC payload.
- Does NOT modify `src/main/index.ts`, `src/preload/**`, `src/renderer/**`.
- Does NOT touch `package*.json`, `vault-health`, `.wolf`.
- Same red-line list as prior slices.

## 5. Commit / Push

- Commit on local branch `hcc-unattended-app-ipc-ready-result-injection-001`.
- Push is deferred until user explicitly authorizes.
