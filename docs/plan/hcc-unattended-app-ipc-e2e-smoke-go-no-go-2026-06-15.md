# HCC-UNATTENDED-APP-IPC-E2E-SMOKE-001 — GO/NO-GO Matrix

Date: 2026-06-15
Base: origin/hermes-pro-main @ 69e01d0

## 1. E2E smoke matrix

| # | Step | Outcome | Verified by |
|---|------|---------|-------------|
| 1 | render does NOT arm | `registerCount === 0` | test |
| 2 | first button click opens confirmation only | `registerCount === 0` | test |
| 3 | confirm click arms exactly once | `registerCount === 1` | test |
| 4 | registered channel is `HCC_UNATTENDED_APP_IPC_CHANNEL` | assert `expect(channel).toBe(...)` | test |
| 5 | valid final IPC request reaches `dispatch_adapter.dispatch` exactly once | `dispatch` called once | test |
| 6 | final result: `verdict === "APP-UNATTENDED-SCHEDULED-DISPATCHED"` | assert | test |
| 7 | final result: `night_run_ready === false`, `go_no_go === "NO-GO"` | assert | test |
| 8 | dispatch args match request fields | assert `dispatch` called with `(planned_action_id, planned_action_kind, target_path)` | test |
| 9 | cancel does NOT arm | `registerCount === 0` | test |
| 10 | ready_result task_id mismatch returns NO-GO | `verdict === "NO-GO"`, `dispatch` not called | test |
| 11 | repeated confirm is idempotent | second arm returns ALREADY-INSTALLED, `registerCount` stays 1 | test |
| 12 | static guard: no spawn/exec/child_process/timer/ipcMain/BrowserWindow/contextBridge/submitDryRunAction in wire helper | assert | test |
| 13 | static guard: no runtime go_no_go: GO / night_run_ready: true in wire helper | assert | test |
| 14 | arming channel constant matches documented value | assert `HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL === "hcc:unattended-app-ipc-install"` | test |

## 2. Verdict

**GO**
