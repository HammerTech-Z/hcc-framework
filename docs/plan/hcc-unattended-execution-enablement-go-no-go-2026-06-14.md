# HCC-UNATTENDED-EXECUTION-ENABLEMENT-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | enablement 34/34 | auto-executor 28 files / 705 tests | e2e canary 16/16 | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-unattended-execution-enablement.ts` (~280 lines) | `tests/auto-executor/hcc-unattended-execution-enablement.test.ts` (34) | preflight | closeout | go-no-go

## What this does

`evaluateUnattendedExecutionEnablement(input, nowIso)` is a pure evaluator of the unattended-execution readiness contract. 8 AND-combined gates:

1. **feature_flag_enabled === true** — opt-in; missing/false → NO-GO
2. **authorization** — authorized=true, scope=controlled_unattended_enablement, non-empty authorization_id/authorized_by_user, issued < expires, now within window. Missing/expired/wrong scope → NO-GO
3. **readiness evidence** — 8 flags all must be true (real_action_whitelist_present, rollback_rehearsal_present, budget_rate_limit_present, audit_artifact_persistence_present, rollback_rehearsal_passed, budget_caps_calibrated, audit_path_policy_valid, verifier_satisfied). Any false → NO-GO
4. **final_dispatch_verdict** — must be FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE. Otherwise NO-GO
5. **audit_write_verdict** — must be AUDIT-ACTUAL-WRITTEN. Otherwise NO-GO
6. **rollback_candidate_verdict** — must be ROLLBACK-ACTUAL-RECOVERY-CANDIDATE. Otherwise NO-GO
7. **budget** — present=true, exceeded=false. Otherwise NO-GO
8. **blockers** — empty or all resolved. Any unresolved → NO-GO

All 8 pass → ENABLEMENT-CANDIDATE with `unattended_ready_candidate: true`. Even candidate keeps: `unattended_ready: false`, `night_run_ready: false`, `go_no_go: "NO-GO"`, `real_execution_ready: false`, `would_execute: false`, `executed_commands: []`, `subprocess_count: 0`, `auto_executor_started: false`, `any_command_executed: false`.

The evaluator never calls any adapter, never dispatches, never touches the executor. No product wiring.

## Boundary compliance

No I/O. No spawn / exec / child_process / ipcMain / BrowserWindow / contextBridge / setInterval / setTimeout / submitDryRunAction / bootstrap / arm / start / host calls. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No prohibited readiness wording outside the historical variable `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- After merge, the unattended execution contract is available in shared lib. A future slice will wire the unattended path by consuming this evaluator + the final controlled real dispatch + the user-explicit trigger token.
