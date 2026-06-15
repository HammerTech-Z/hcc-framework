# HCC-UNATTENDED-TERMINAL-CLI-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 740b4f4

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-TERMINAL-CLI-001 slice. The CLI is a thin shell
that consumes `runTerminalUnattendedScheduledDispatch`.

## 1. CLI parse gate matrix (12 flags)

| # | Gate | Perturbation | Expected outcome | `reason` contains | Entrypoint called? |
|---|------|--------------|------------------|-------------------|--------------------|
| 1 | terminal_agent_session_id | missing | exit 2, NO-GO JSON | `terminal-agent-session-id` | NO |
| 2 | terminal_invocation_id | missing | exit 2, NO-GO JSON | `terminal-invocation-id` | NO |
| 3 | explicit_unattended_trigger_token | missing | exit 2, NO-GO JSON | `explicit-unattended-trigger-token` | NO |
| 4 | feature_flag_enabled | missing | exit 2, NO-GO JSON | `feature flag` | NO |
| 5 | task_id | missing | exit 2, NO-GO JSON | `task-id` | NO |
| 6 | source_plan_ref | missing | exit 2, NO-GO JSON | `source-plan-ref` | NO |
| 7 | requested_by_user | missing | exit 2, NO-GO JSON | `requested-by-user` | NO |
| 8 | authorization_id | missing | exit 2, NO-GO JSON | `authorization-id` | NO |
| 9 | schedule_id | missing | exit 2, NO-GO JSON | `schedule-id` | NO |
| 10 | planned_action_id | missing | exit 2, NO-GO JSON | `planned-action-id` | NO |
| 11 | planned_action_kind | unsupported | exit 2, NO-GO JSON | `unsupported` | NO |
| 12 | target_path | missing | exit 2, NO-GO JSON | `target-path` | NO |
| 13 | env-var fallback | flags absent, env present | ok | n/a | YES (via runTerminalCli) |
| 14 | all flags present | n/a | ok | n/a | YES (via runTerminalCli) |

## 2. Entrypoint propagation (delegated)

| # | Scenario | Expected outcome | Reason text |
|---|----------|------------------|-------------|
| E1 | entrypoint returns NO-GO | exit 2, entrypoint JSON on stdout | entrypoint's reason |
| E2 | entrypoint throws | runTerminalCli re-throws (verified in test) | propagated error message |
| E3 | entrypoint returns TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED | exit 0, entrypoint JSON on stdout | entrypoint's reason |

## 3. Success path side-effect fields (entrypoint-result forwarded)

| Field | Value |
|-------|-------|
| `night_run_ready` | `false` (literal) |
| `go_no_go` | `"NO-GO"` (literal) |
| `auto_executor_started` | `false` (literal) |
| `would_execute` | `false` (literal) |
| `real_execution_ready` | `false` (literal) |
| `unattended_ready` | forwarded from entrypoint |
| `any_command_executed` | forwarded from entrypoint |
| `executed_commands` | forwarded from entrypoint |
| `subprocess_count` | forwarded from entrypoint |
| `controlled_command_id` | forwarded from entrypoint |

## 4. Forbidden-Surface Scan (static guard results)

The following regexes are checked against the CLI source with all
comments stripped:

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
| `go_no_go:\s*"GO"` (runtime value) | NOT PRESENT |
| `night_run_ready:\s*true` (runtime value) | NOT PRESENT |
| `\.hermes` (path reference) | NOT PRESENT |

## 5. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Call `runTerminalUnattendedScheduledDispatch` from anywhere
  except the single `await` inside `runTerminalCli`.
- Import `submitDryRunAction`.
- Write to `~/.hermes/**`.
- Touch `package.json` or `package-lock.json`.
- Touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Register IPC, renderer, preload, timer, cron, or auto-arm.

## 6. Verdict

**GO** for the terminal CLI shell slice, contingent on the gate
matrices in §1 and §2 passing in
`npx vitest run tests/auto-executor/hcc-unattended-terminal-cli.test.ts`,
plus the broader gates listed in the preflight.

The slice is a CLI shell only. No background timer, no
auto-arm, no app boot trigger. The CLI is invoked by an explicit
shell call. The next slice that wires a `package.json` `bin`
field, a real ready_result fixture loader, or a real dispatch
adapter is a separate GO-gated decision.
