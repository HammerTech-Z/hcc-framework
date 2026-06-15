# HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ b544409

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001 slice. Two entrypoints are
added: terminal and app. Both consume
`scheduleControlledUnattendedRun` from `b544409`.

## 1. Terminal path (4 identity gates + 1 delegated)

| # | Gate | Perturbation | Expected verdict | `reason` contains | Scheduler called? |
|---|------|--------------|------------------|-------------------|-------------------|
| T1 | terminal_agent_session_id | `""` | `NO-GO` | `terminal invocation identity` | NO |
| T2 | terminal_invocation_id | `""` | `NO-GO` | `terminal invocation identity` | NO |
| T3 | explicit_unattended_trigger_token | `""` | `NO-GO` | `terminal invocation identity` | NO |
| T4 | feature flag | `feature_flag_enabled: false` | `NO-GO` | `feature_flag_enabled` | NO |
| T5 | scheduler NO-GO | scheduler returns `NO-GO` | `NO-GO` | `scheduler refused` | YES (once) |
| T6 | scheduler throw | scheduler throws `Error("...")` | `NO-GO` | propagated error message | YES (once, throws) |
| TS | all gates pass | n/a | `TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED` | n/a | YES (once) |

## 2. App path (5 identity gates + 1 delegated)

| # | Gate | Perturbation | Expected verdict | `reason` contains | Scheduler called? |
|---|------|--------------|------------------|-------------------|-------------------|
| A1 | app_session_id | `""` | `NO-GO` | `app invocation identity` | NO |
| A2 | app_invocation_id | `""` | `NO-GO` | `app invocation identity` | NO |
| A3 | user_confirmation | `user_confirmation: false` | `NO-GO` | `app invocation identity` | NO |
| A4 | explicit_unattended_trigger_token | `""` | `NO-GO` | `app invocation identity` | NO |
| A5 | feature flag | `feature_flag_enabled: false` | `NO-GO` | `feature_flag_enabled` | NO |
| A6 | scheduler NO-GO | scheduler returns `NO-GO` | `NO-GO` | `scheduler refused` | YES (once) |
| A7 | scheduler throw | scheduler throws `Error("...")` | `NO-GO` | propagated error message | YES (once, throws) |
| AS | all gates pass | n/a | `APP-UNATTENDED-SCHEDULED-DISPATCHED` | n/a | YES (once) |

## 3. Success-path side-effect fields

### Terminal dispatched

| Field | Value | Set in |
|-------|-------|--------|
| `verdict` | `"TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED"` | `dispatched()` |
| `night_run_ready` | `false` (literal) | `dispatched()` |
| `go_no_go` | `"NO-GO"` (literal) | `dispatched()` |
| `auto_executor_started` | `false` (literal) | `dispatched()` |
| `would_execute` | `false` (literal) | `dispatched()` |
| `real_execution_ready` | `false` (literal) | `dispatched()` |
| `unattended_ready` | forwarded from scheduler | `dispatched()` |
| `any_command_executed` | forwarded from scheduler | `dispatched()` |
| `executed_commands` | forwarded from scheduler | `dispatched()` |
| `subprocess_count` | forwarded from scheduler | `dispatched()` |
| `controlled_command_id` | forwarded from scheduler | `dispatched()` |
| terminal identity fields | echoed from `input.invocation` | `dispatched()` |

### App dispatched

| Field | Value | Set in |
|-------|-------|--------|
| `verdict` | `"APP-UNATTENDED-SCHEDULED-DISPATCHED"` | `dispatched()` |
| `night_run_ready` | `false` (literal) | `dispatched()` |
| `go_no_go` | `"NO-GO"` (literal) | `dispatched()` |
| `auto_executor_started` | `false` (literal) | `dispatched()` |
| `would_execute` | `false` (literal) | `dispatched()` |
| `real_execution_ready` | `false` (literal) | `dispatched()` |
| `unattended_ready` | forwarded from scheduler | `dispatched()` |
| `any_command_executed` | forwarded from scheduler | `dispatched()` |
| `executed_commands` | forwarded from scheduler | `dispatched()` |
| `subprocess_count` | forwarded from scheduler | `dispatched()` |
| `controlled_command_id` | forwarded from scheduler | `dispatched()` |
| app identity fields | echoed from `input.invocation` | `dispatched()` |

### NO-GO (both paths)

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

## 4. Forbidden-Surface Scan (static guard results)

The following regexes are checked against both entrypoint sources
with all comments stripped:

| Forbidden token | Terminal | App |
|-----------------|----------|-----|
| `\bspawn\s*\(` | NOT PRESENT | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT | NOT PRESENT |
| `child_process` | NOT PRESENT | NOT PRESENT |
| `ipcMain` | NOT PRESENT | NOT PRESENT |
| `BrowserWindow` | NOT PRESENT | NOT PRESENT |
| `contextBridge` | NOT PRESENT | NOT PRESENT |
| `set(?:Interval|Immediate|Timeout)\s*\(` | NOT PRESENT | NOT PRESENT |
| `auto-executor-bootstrap` | NOT PRESENT | NOT PRESENT |
| `auto-executor-arm` | NOT PRESENT | NOT PRESENT |
| `auto-executor-start` | NOT PRESENT | NOT PRESENT |
| `auto-executor-host` | NOT PRESENT | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT | NOT PRESENT |
| `go_no_go:\s*"GO"` (runtime value) | NOT PRESENT | NOT PRESENT |
| `night_run_ready:\s*true` (runtime value) | NOT PRESENT | NOT PRESENT |
| `\.hermes` (any path reference) | NOT PRESENT | NOT PRESENT |

## 5. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Call `scheduleControlledUnattendedRun` from anywhere except the
  single `await` inside each entrypoint (post all-gates).
- Import `submitDryRunAction`.
- Write to `~/.hermes/**`.
- Touch `package.json` or `package-lock.json`.
- Touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Register IPC, renderer, preload, timer, cron, or auto-arm.

## 6. Verdict

**GO** for the gated unattended product entrypoints slice, contingent
on the gate matrices in §1 and §2 passing in
`npx vitest run tests/auto-executor/hcc-unattended-product-entrypoints.test.ts`,
plus the broader gates listed in the preflight.

The slice is a contract only. No product entrypoint imports
`runTerminalUnattendedScheduledDispatch` or
`runAppUnattendedScheduledDispatch` in this commit. The next slice
that wires the terminal path into a CLI bin or the app path into an
IPC handler / UI button is a separate GO-gated decision and is
explicitly out of scope here.
