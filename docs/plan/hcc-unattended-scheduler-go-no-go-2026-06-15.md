# HCC-UNATTENDED-SCHEDULER-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ df52642

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-SCHEDULER-001 slice. The scheduler is a contract only;
no product wiring is added in this slice. The "verdict" column is what
`scheduleControlledUnattendedRun` returns under the named perturbation.

## 1. Gate Matrix (10 gates + 3 identity cross-checks)

| # | Gate | Perturbation | Expected verdict | `reason` contains | Runner / adapter called? |
|---|------|--------------|------------------|-------------------|--------------------------|
| 1 | feature flag | `feature_flag_enabled: false` | `NO-GO` | `feature_flag_enabled` | NO |
| 2 | schedule_id | `schedule_id: ""` | `NO-GO` | `schedule_id` | NO |
| 3 | scheduler_window | `scheduler_window: undefined` | `NO-GO` | `scheduler_window` | NO |
| 3b | scheduler_window | `tz: ""` | `NO-GO` | `scheduler_window` | NO |
| 4 | authorization match | `authorization_id: "auth-OTHER"` | `NO-GO` | `authorization_id` | NO |
| 4b | authorization match | `ready_result.authorization_id: "auth-OTHER"` | `NO-GO` | `authorization_id` | NO |
| 5 | budget missing | `budget.present: false` | `NO-GO` | `budget` | NO |
| 5b | budget exceeded | `budget.exceeded: true` | `NO-GO` | `budget` | NO |
| 6 | blockers | `blockers_resolved: false` | `NO-GO` | `blockers_resolved` | NO |
| 7 | ready verdict | `ready_result.verdict: "NO-GO"` | `NO-GO` | `UNATTENDED-READY-CANDIDATE` | NO |
| 8 | ready flag | `ready_result.unattended_ready: false` | `NO-GO` | `unattended_ready` | NO |
| 9 | planned_action unsupported | `planned_action_kind: "remote_exec"` | `NO-GO` | `unsupported` | NO |
| 9b | planned_action missing | `planned_action: undefined` | `NO-GO` | `planned_action` | NO |
| 10 | adapter missing | `dispatch_adapter: undefined` | `NO-GO` | `dispatch_adapter` | NO |
| 10b | adapter supportsKind=false | `supportsKind: () => false` | `NO-GO` | `does not support` | NO (no dispatch) |
| 11 | runner NO-GO | `dispatch` returns `controlled_command_id: ""` | `NO-GO` | `runUnattendedControlledDispatch` | adapter called once, runner returns NO-GO |
| 12 | adapter throw | `dispatch` throws | `NO-GO` | `runUnattendedControlledDispatch` | adapter called once, runner returns typed NO-GO |
| 13 | identity task_id | `task_id: "OTHER"` | `NO-GO` | `task_id` | NO |
| 14 | identity source_plan_ref | `source_plan_ref: "OTHER"` | `NO-GO` | `source_plan_ref` | NO |
| 15 | identity requested_by_user | `requested_by_user: "OTHER"` | `NO-GO` | `requested_by_user` | NO |

## 2. Success Path

| # | Condition | Expected verdict | Side-effect fields |
|---|-----------|------------------|--------------------|
| S1 | all gates pass | `CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED` | `any_command_executed: true`, `subprocess_count: 1`, `executed_commands: ["cc-unatt-sched-001"]` |
| S2 | success preserves `night_run_ready: false` | literal | `false` |
| S3 | success preserves `go_no_go: "NO-GO"` | literal | `"NO-GO"` |
| S4 | success preserves `auto_executor_started: false` | literal | `false` |
| S5 | success preserves `would_execute: false` | literal | `false` |
| S6 | success does **not** set `go_no_go: "GO"` | forbidden | n/a (test asserts the source contains no `go_no_go: "GO"`) |

## 3. Forbidden-Surface Scan (static guard results)

The following regexes are checked against the scheduler source with
all comments stripped:

| Forbidden token | Result |
|-----------------|--------|
| `\bspawn\s*\(` | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT |
| `child_process` | NOT PRESENT |
| `ipcMain` | NOT PRESENT |
| `BrowserWindow` | NOT PRESENT |
| `contextBridge` | NOT PRESENT |
| `set(?:Interval|Immediate|Timeout)\s*\(` | NOT PRESENT |
| `auto-executor-bootstrap` | NOT PRESENT |
| `auto-executor-arm` | NOT PRESENT |
| `auto-executor-start` | NOT PRESENT |
| `auto-executor-host` | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT |
| `forbidden-substring-a` (literal substring) | NOT PRESENT |
| `forbidden-substring-b` (literal substring) | NOT PRESENT |

## 4. Side-Effect / Ready Field Locations

### On success (dispatched)

| Field | Value | Set in |
|-------|-------|--------|
| `verdict` | `"CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED"` | `dispatched()` |
| `night_run_ready` | `false` (literal) | `dispatched()` |
| `go_no_go` | `"NO-GO"` (literal) | `dispatched()` |
| `auto_executor_started` | `false` (literal) | `dispatched()` |
| `would_execute` | `false` (literal) | `dispatched()` |
| `real_execution_ready` | `false` (literal) | `dispatched()` |
| `unattended_ready` | forwarded from runner | `dispatched()` |
| `any_command_executed` | forwarded from runner | `dispatched()` |
| `executed_commands` | forwarded from runner | `dispatched()` |
| `subprocess_count` | forwarded from runner | `dispatched()` |
| `controlled_command_id` | forwarded from runner | `dispatched()` |

### On NO-GO

| Field | Value | Set in |
|-------|-------|--------|
| `verdict` | `"NO-GO"` | `noGo()` |
| `night_run_ready` | `false` (literal) | `noGo()` |
| `go_no_go` | `"NO-GO"` (literal) | `noGo()` |
| `auto_executor_started` | `false` (literal) | `noGo()` |
| `would_execute` | `false` (literal) | `noGo()` |
| `real_execution_ready` | `false` (literal) | `noGo()` |
| `unattended_ready` | `false` (literal) | `noGo()` |
| `any_command_executed` | `false` (literal) | `noGo()` |
| `executed_commands` | `[]` (literal) | `noGo()` |
| `subprocess_count` | `0` (literal) | `noGo()` |
| `controlled_command_id` | `""` (literal) | `noGo()` |

## 5. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Call `runUnattendedControlledDispatch` from anywhere except the single
  `await` inside `scheduleControlledUnattendedRun` (post all-gates).
- Import `submitDryRunAction` (forbidden by runner governance).
- Write to `~/.hermes/**`.
- Touch `src/main/index.ts`, `package.json`, `package-lock.json`.
- Register IPC, renderer, preload, timer, cron, or auto-arm.

## 6. Verdict

**GO** for the controlled unattended scheduler contract slice, contingent on
all 8 gate matrices in §1 and the success-path matrix in §2 passing in
`npx vitest run tests/auto-executor/hcc-unattended-scheduler.test.ts`,
plus the broader gates listed in the preflight.

The slice is a contract only. No product entrypoint imports
`scheduleControlledUnattendedRun` in this commit. The next slice that
wires it into a host (timer, cron, IPC, CLI) is a separate
GO-gated decision and is explicitly out of scope here.
