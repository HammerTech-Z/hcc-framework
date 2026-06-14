# HCC-FINAL-CONTROLLED-REAL-DISPATCH-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | final-dispatch 32/32 | auto-executor 22 files / 523 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-final-controlled-real-dispatch.ts` (~430 lines) | `tests/auto-executor/hcc-final-controlled-real-dispatch.test.ts` (32) | preflight | closeout | go-no-go

## What this does

`evaluateFinalControlledRealDispatch(input)` is the final user-explicit async contract. It composes the 4 prior readiness-track contracts and is the ONLY slice in the HCC track that may flip `real_execution_ready: true`, `would_execute: true`, `any_command_executed: true`. Hard AND-combination of: authorization verdict = REAL-EXECUTION-AUTH-CANDIDATE; runner verdict = CONTROLLED-REAL-RUNNER-CANDIDATE; audit verdict = AUDIT-ACTUAL-WRITTEN; rollback verdict = ROLLBACK-ACTUAL-RECOVERY-CANDIDATE; identity agreement on task_id / source_plan_ref / requested_by_user / authorization_id / dry_run_artifact_hash / planned_action_id / planned_action_kind / whitelist_action_id across all 4 records + input; `explicit_user_triggered === true`; `dispatch_adapter` injected + `supportsKind` returns true; planned_action_kind is one of shell_command / file_write / config_patch. Valid path -> dispatch through `adapter.dispatch(planned_action_id, kind, target_path)` and return `controlled_command_id`. Success result: real_execution_ready=true, would_execute=true, any_command_executed=true, executed_commands=[controlled_command_id], subprocess_count=1. STILL KEEPS: unattended_ready=false, night_run_ready=false, go_no_go="NO-GO", auto_executor_started=false. The lib never calls spawn / exec / child_process / submitDryRunAction / git. The adapter is the only I/O surface; tests inject mocks.

## Boundary compliance

User-explicit only. No app boot, no IPC, no timer, no cron, no auto-arm path may trigger this. No bootstrap / arm / start / host imports. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
