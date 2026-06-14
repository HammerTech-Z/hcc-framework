# HCC-CONTROLLED-REAL-RUNNER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | runner 22/22 | auto-executor 19 files / 426 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-controlled-real-runner.ts` (~210 lines) | `tests/auto-executor/hcc-controlled-real-runner.test.ts` (22) | preflight | closeout | go-no-go

## What this does

`evaluateControlledRealRunnerCandidate(input)` is a pure evaluator that consumes a `HCCRealExecutionAuthorizationResult` plus the planned-action identity (planned_action_id, planned_action_kind in {shell_command, file_write, config_patch}, whitelist_action_id, dry_run_artifact_hash). All checks pass -> CONTROLLED-REAL-RUNNER-CANDIDATE with real_execution_ready_candidate=true. Otherwise NO-GO with a descriptive reason. Candidate does NOT mean execution ready. real_execution_ready stays false, would_execute=false, executed_commands=[], subprocess_count=0, auto_executor_started=false, any_command_executed=false, unattended_ready=false, night_run_ready=false, go_no_go=NO-GO. Guards: authorization verdict must be REAL-EXECUTION-AUTH-CANDIDATE; task_id / source_plan_ref / requested_by_user must match the authorization record; dry_run_artifact_hash must match; planned_action_id / planned_action_kind / whitelist_action_id must be present and kind must be supported. This slice does NOT execute commands. It only attests the static contract for a future controlled dispatch is satisfied.

## Boundary compliance

No arm/start/host imports, no submitDryRunAction, no spawn/exec, no IPC, no timer, no ~/.hermes write, no package changes. Real execution remains NO-GO; the runner cannot enable it alone. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
