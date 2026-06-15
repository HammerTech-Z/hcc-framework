# HCC-UNATTENDED-APP-IPC-DISPATCH-ADAPTER-INJECTION-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ d936991 (`hcc: add renderer arming entrypoint`)
Slice: HCC-UNATTENDED-APP-IPC-DISPATCH-ADAPTER-INJECTION-001

## 1. Goal

Add a narrow main-side dispatch adapter injection contract
for the HCC app IPC handler at
`src/main/ipc-handlers/hcc-unattended-app.ts` (added in
`56ed9d0`). The handler currently has a hardcoded no-op
`dispatch_adapter`; this slice replaces it with a
`deps.dispatch_adapter` slot so a caller (test, installer,
or future wiring) can inject a real
`HCCFinalControlledRealDispatchAdapter` that performs the
actual dispatch.

This slice does NOT solve ready_result. The handler may
still return NO-GO through the real entrypoint because
`ready_result` is still the scaffold NO-GO. The two concerns
(adapter injection + ready_result injection) are
independent; this slice addresses the former.

## 2. Allowed files (5)

1. `src/main/ipc-handlers/hcc-unattended-app.ts` — M (narrow)
2. `tests/auto-executor/hcc-unattended-app-ipc-dispatch-adapter-injection.test.ts` — A
3. `docs/plan/hcc-unattended-app-ipc-dispatch-adapter-injection-preflight-2026-06-15.md` — A (this file)
4. `docs/plan/hcc-unattended-app-ipc-dispatch-adapter-injection-go-no-go-2026-06-15.md` — A
5. `docs/closeout/hcc-unattended-app-ipc-dispatch-adapter-injection-001-closeout-2026-06-15.md` — A

## 3. Surgical changes in the handler (3 additions, 1 replacement)

1. **Import the adapter type.**
   ```ts
   import type { HCCFinalControlledRealDispatchAdapter } from "../../shared/lib/hcc-final-controlled-real-dispatch";
   ```

2. **Add `dispatch_adapter` to `HCCUnattendedAppIpcHandlerDeps`.**
   ```ts
   dispatch_adapter?: HCCFinalControlledRealDispatchAdapter;
   ```

3. **Extract the no-op adapter into a named export.**
   ```ts
   export function defaultNoOpDispatchAdapter(): HCCFinalControlledRealDispatchAdapter { ... }
   ```
   The default is `supportsKind: () => false` and `dispatch: () => { throw ... }`.
   The handler's existing behavior is 100% preserved when the caller does NOT
   inject a dispatch adapter — the named function is a drop-in replacement for
   the prior inlined no-op object.

4. **Replace the hardcoded `dispatch_adapter` slot.**
   ```ts
   dispatch_adapter: deps.dispatch_adapter ?? defaultNoOpDispatchAdapter(),
   ```
   When `deps.dispatch_adapter` is present, it is passed directly to
   `scheduler_input.dispatch_adapter`. When absent, the default no-op adapter
   is used.

## 4. What this slice does NOT do

- Does NOT change any `ipcMain.handle` registration.
- Does NOT modify `src/main/index.ts`, `src/preload/**`, `src/renderer/**`.
- Does NOT modify `package.json` or `package-lock.json`.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Does NOT synthesize or supply a real `ready_result`.
- Does NOT call `setInterval` / `setTimeout` / `setImmediate`.
- Does NOT call `spawn` / `exec` / `child_process`.
- Does NOT call `submitDryRunAction`.
- Does NOT write to `~/.hermes/**`.
- Does NOT set `go_no_go: "GO"` or flip `night_run_ready: true`.

## 5. Ready_result status (unchanged)

The handler's `ready_result` is still the scaffold NO-GO from
`56ed9d0`. Injecting a real dispatch adapter does NOT make
the entrypoint call `dispatch` — the entrypoint still blocks
at `ready_result.verdict must be UNATTENDED-READY-CANDIDATE`.
The test "real entrypoint with injected adapter still returns
NO-GO because ready_result is still not provided" enforces
this contract. The ready_result injection is the NEXT slice
(HCC-UNATTENDED-APP-IPC-READY-RESULT-INJECTION-001) and is
explicitly out of scope here.

## 6. Pre-Commit gates

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-app-ipc-dispatch-adapter-injection.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status -- src/main/index.ts src/preload src/renderer \
    package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
rg -n 'spawn\(|exec\(|child_process|ipcMain\.handle|BrowserWindow|contextBridge|setInterval|setTimeout|setImmediate|submitDryRunAction|\.hermes/|go_no_go: "GO"|night_run_ready: true' \
    src/main/ipc-handlers/hcc-unattended-app.ts \
    tests/auto-executor/hcc-unattended-app-ipc-dispatch-adapter-injection.test.ts
```

## 7. Commit / Push

- Commit only if all gates pass.
- Commit on local branch named
  `hcc-unattended-app-ipc-dispatch-adapter-injection-001`.
- Do NOT push unless explicitly authorized by the user.
