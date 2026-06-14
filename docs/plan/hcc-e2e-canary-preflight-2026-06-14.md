# HCC-E2E-CANARY-001 — Preflight

- Task: `HCC-E2E-CANARY-001` | Date: 2026-06-14 | Branch: `hcc-e2e-canary-001` | Predecessor: `9dec60c`

## 1. Baseline — `HEAD = origin/main = 9dec60c`

## 2. What this slice adds — end-to-end canary that composes the terminal agent invoker + the app user-explicit IPC handler against the shared invocation service + the controlled dispatch adapter. Test-only, library-composing canary. No real executor backing. No app boot / renderer / preload / ipcMain registration / cron / timer / auto-arm. The dispatch adapter is fully injected; the lib never calls `spawn` / `exec` / `child_process` directly. The canary proves: (1) terminal valid canary produces `FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE`; (2) app valid canary produces the same verdict; (3) missing token / confirmation in the respective paths returns NO-GO with the adapter NOT called; (4) non-allowlisted shell is denied in both paths; (5) locked path is denied in both paths; (6) adapter throw becomes typed NO-GO in both paths; (7) caller identities are preserved; (8) success paths preserve `unattended_ready=false` / `night_run_ready=false` / `go_no_go="NO-GO"` / `auto_executor_started=false`. The canary is composition-only; it does NOT enable real execution

## 3. Verification — typecheck EXIT 0, 16/16 canary tests, 27 files / 671 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
