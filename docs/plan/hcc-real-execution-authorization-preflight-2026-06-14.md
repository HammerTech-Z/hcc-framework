# HCC-REAL-EXECUTION-AUTHORIZATION-001 — Preflight

- Task: `HCC-REAL-EXECUTION-AUTHORIZATION-001` | Date: 2026-06-14 | Branch: `hcc-real-execution-authorization-001` | Predecessor: `f8f7e78`

## 1. Baseline — `HEAD = origin/main = f8f7e78`

## 2. What this slice adds — pure shared library contract `evaluateRealExecutionAuthorization(input, nowIso)` that validates a real-execution authorization record. Required fields: task_id, source_plan_ref, requested_by_user, authorized_by_user, authorization_id, authorization_scope=controlled_real_execution_candidate, one_shot=true, dry_run_verdict=GO-CANDIDATE_DRY_RUN_PRODUCED, dry_run_artifact_hash, issued_at < expires_at, now within [issued_at, expires_at]. Any missing/invalid/expired field returns NO-GO with a reason. Valid record returns REAL-EXECUTION-AUTH-CANDIDATE only. Even candidate preserves literal-false execution fields (would_execute=false, executed_commands=[], subprocess_count=0, auto_executor_started=false, any_command_executed=false, real_execution_ready=false, unattended_ready=false, go_no_go=NO-GO). No execution path is unlocked by this slice

## 3. Verification — typecheck EXIT 0, 24/24 auth tests, N/M auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Real execution NO-GO
