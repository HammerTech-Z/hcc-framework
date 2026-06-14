# HCC-FINAL-CONTROLLED-REAL-DISPATCH-001 — Preflight

- Task: `HCC-FINAL-CONTROLLED-REAL-DISPATCH-001` | Date: 2026-06-14 | Branch: `hcc-final-controlled-real-dispatch-001` | Predecessor: `000b649`

## 1. Baseline — `HEAD = origin/main = 000b649`

## 2. What this slice adds — final user-explicit controlled real dispatch contract. Composes the 4 prior contracts (real-execution auth / controlled real-runner candidate / audit actual write / rollback actual recovery) into one async evaluator. Hard AND-combination: every prior verdict must be its candidate/WRITTEN value, all identity fields must agree across the 4 records, `explicit_user_triggered === true` (no boot/IPC/timer/auto-arm trigger), `dispatch_adapter` injected + `supportsKind` returns true, planned_action_id/kind/whitelist_action_id all match. Valid -> `FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE` with `real_execution_ready: true`, `would_execute: true`, `any_command_executed: true`, `executed_commands: [controlled_command_id]`, `subprocess_count: 1`. Still keeps `unattended_ready: false`, `night_run_ready: false`, `go_no_go: "NO-GO"`, `auto_executor_started: false`. This is user-explicit, never unattended. NO-GO on any failed check; adapter never called on NO-GO

## 3. Verification — typecheck EXIT 0, 32/32 final-dispatch tests, 22 files / 523 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
