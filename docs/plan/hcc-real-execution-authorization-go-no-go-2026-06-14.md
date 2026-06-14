# HCC-REAL-EXECUTION-AUTHORIZATION-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | auth 24/24 | auto-executor 18 files / 404 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-real-execution-authorization.ts` (~200 lines) | `tests/auto-executor/hcc-real-execution-authorization.test.ts` (24) | preflight | closeout | go-no-go

## What this does

`evaluateRealExecutionAuthorization(input, nowIso)` is a pure evaluator of a real-execution authorization record. Required: task_id, source_plan_ref, requested_by_user, authorized_by_user, authorization_id, authorization_scope=controlled_real_execution_candidate, one_shot=true, dry_run_verdict=GO-CANDIDATE_DRY_RUN_PRODUCED, dry_run_artifact_hash, issued_at < expires_at, and now in [issued_at, expires_at]. Any missing/invalid/expired field returns NO-GO with a descriptive reason. Valid record returns REAL-EXECUTION-AUTH-CANDIDATE only. Even candidate preserves literal-false execution fields: would_execute=false, executed_commands=[], subprocess_count=0, auto_executor_started=false, any_command_executed=false, real_execution_ready=false, unattended_ready=false, night_run_ready=false, go_no_go=NO-GO. This slice defines and validates the authorization contract only. No command is executed. No I/O occurs.

## Boundary compliance

No arm/start/host imports, no submitDryRunAction, no spawn/exec, no IPC, no timer, no ~/.hermes write, no package changes. Real execution remains NO-GO; the contract cannot enable it alone. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
