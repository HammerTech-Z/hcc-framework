# HCC-UNATTENDED-APP-IPC-PRODUCTION-WIRING-001 — GO/NO-GO Matrix

Date: 2026-06-15
Base: origin/hermes-pro-main @ 2e193e3

## 1. Production wiring semantic matrix

| # | Scenario | Verdict | factory called? | installer called? | dispatch called? |
|---|----------|---------|-----------------|--------------------|------------------|
| 1 | no factory (default) | INSTALLED | NO (none provided) | YES (once) | NO (no deps) |
| 2 | factory provided | INSTALLED | YES (once) | YES (once) | N/A at arm time |
| 3 | repeated arming with factory | ALREADY-INSTALLED | NO (cached) | NO (idempotent) | N/A |
| 4 | invalid arming payload | NO-GO | NO (NOT built) | NO | N/A |
| 5 | valid IPC request via real handler w/ production deps | APP-UNATTENDED-SCHEDULED-DISPATCHED | N/A | N/A | YES (once) |
| 6 | ready_result identity mismatch | NO-GO | N/A | N/A | NO |
| 7 | adapter supportsKind false | NO-GO | N/A | N/A | NO |
| 8 | adapter dispatch throws | NO-GO (propagated reason) | N/A | N/A | YES (then throws) |

## 2. Forbidden-surface scan

| Token | Result |
|-------|--------|
| `spawn(` / `exec(` / `child_process` | NOT PRESENT |
| `ipcMain.handle` | NOT PRESENT (registration delegated to installer + caller) |
| `BrowserWindow` / `contextBridge` | NOT PRESENT |
| `setInterval` / `setTimeout` / `setImmediate` | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT |
| `~/.hermes/` or `~/.hermes/**` | NOT PRESENT |
| `go_no_go: "GO"` runtime | NOT PRESENT |
| `night_run_ready: true` runtime | NOT PRESENT |

## 3. Verdict

**GO**
