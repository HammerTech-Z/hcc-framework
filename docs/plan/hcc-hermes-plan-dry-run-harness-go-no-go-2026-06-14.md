# HCC-HERMES-PLAN-DRY-RUN-HARNESS-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | harness 13/13 | auto-executor 17 files / 380 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`tests/hcc/hcc-hermes-plan-dry-run-harness.test.ts` | `docs/hcc/hcc-hermes-plan-dry-run-harness-2026-06-14.md` | preflight | closeout | go-no-go

## What this does

Local/test harness that builds a fixture `HermesPlanTaskDescriptor` with `task_id` / `title` / `source_plan_ref` / `requested_by_user` / `authorization.authorized === true` / fully-satisfied `gate_input_override`, invokes `adaptHermesPlanTaskToDryRun(task)`, and asserts `verdict === GO-CANDIDATE_DRY_RUN_PRODUCED` while all execution fields remain literal-false / zero (would_execute=false, executed_commands=[], subprocess_count=0, auto_executor_started=false, any_command_executed=false, real_execution_ready=false, unattended_ready=false, go_no_go=NO-GO). Negative fixtures cover auth-true-but-override-missing (NO-GO "missing gate_input_override") and override-incomplete (NO-GO "incomplete gate_input_override — evidence state not fully satisfied"). End-to-end proof that the Hermes Pro plan dry-run path is wired through the adapter; real execution is NOT enabled.

## Boundary compliance

Test/local harness only. No `src/main/index.ts` wiring, no IPC, no renderer, no preload, no `submitDryRunAction`, no `spawn`/`exec`/`child_process`, no writes to `~/.hermes/**`, no `package.json` / `package-lock.json` change. `night_run_ready: false` and `go_no_go: "NO-GO"` literals preserved. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
