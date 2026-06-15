# HCC-UNATTENDED-APP-IPC-DISPATCH-ADAPTER-INJECTION-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ d936991

## 1. Adapter injection semantic matrix

| # | Scenario | Expected verdict | Entrypoint called? | Adapter passed? |
|---|----------|------------------|--------------------|-----------------|
| 1 | `deps.dispatch_adapter` absent → default no-op is used | `NO-GO` (ready_result blocks) | YES | NO — default no-op |
| 2 | Real adapter injected → real adapter is passed to `scheduler_input` | `NO-GO` (ready_result blocks) | YES | YES — the adapter reference is passed exactly |
| 3 | Real adapter injected → handler does NOT call `supportsKind` or `dispatch` on the adapter (handler only passes adapter through) | N/A | YES | YES (passed through, NOT consumed) |
| 4 | Real adapter injected → still NO-GO because ready_result is scaffold NO-GO | `NO-GO` | YES | YES (proves adapter/ready_result independence) |
| 5 | Malformed IPC payload → entrypoint NOT called, adapter NOT required | `NO-GO` (payload gate) | NO | N/A |
| 6 | `defaultNoOpDispatchAdapter().supportsKind` returns false for all 3 kinds | N/A | N/A | N/A |
| 7 | `defaultNoOpDispatchAdapter().dispatch` throws | N/A | N/A | N/A |

## 2. Forbidden-surface scan

The following regexes are checked against the handler source
and test file (with comments stripped on the handler source).

| Forbidden token | result |
|-----------------|--------|
| `\bspawn\s*\(` | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT |
| `child_process` | NOT PRESENT |
| `ipcMain\.handle` | NOT PRESENT |
| `BrowserWindow` | NOT PRESENT |
| `contextBridge` | NOT PRESENT |
| `set(?:Interval|Immediate|Timeout)\s*\(` | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT |
| `\.hermes/` or `\.hermes\*\*` (filesystem path) | NOT PRESENT |
| `go_no_go:\s*"GO"` (runtime value) | NOT PRESENT |
| `night_run_ready:\s*true` (runtime value) | NOT PRESENT |
| `night_run_ready:\s*false` (literal) | PRESENT |
| `go_no_go:\s*"NO-GO"` (literal) | PRESENT |

## 3. Unresolved concern: ready_result

Both the injected-adapter path AND the default-adapter path
return `NO-GO` because `ready_result.verdict` is
`"NO-GO"`. This is by design — the adapter injection does
not relax the ready_result gate. The next slice
(HCC-UNATTENDED-APP-IPC-READY-RESULT-INJECTION-001) adds
`ready_result` to `HCCUnattendedAppIpcHandlerDeps` and
passes it through to the entrypoint input. Once both
`dispatch_adapter` and `ready_result` are injectable, the
entrypoint chain can reach the runner's `dispatch` call.

## 4. Verdict

**GO** for the adapter injection slice, contingent on the
gate matrices in §1 passing in
`npx vitest run tests/auto-executor/hcc-unattended-app-ipc-dispatch-adapter-injection.test.ts`,
plus the broader gates listed in the preflight.
