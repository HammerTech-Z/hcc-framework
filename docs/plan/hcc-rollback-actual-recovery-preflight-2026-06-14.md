# HCC-ROLLBACK-ACTUAL-RECOVERY-001 — Preflight

- Task: `HCC-ROLLBACK-ACTUAL-RECOVERY-001` | Date: 2026-06-14 | Branch: `hcc-rollback-actual-recovery-001` | Predecessor: `665ba1c`

## 1. Baseline — `HEAD = origin/main = 665ba1c`

## 2. What this slice adds — pure planner + injected-recovery-adapter resolver for repo-local rollback. `planRollbackActualRecovery(input)` validates task_id / source_plan_ref / authorization_id / planned_action_id / planned_action_kind / before_hash / after_hash (must differ) / target_path (repo-local under docs/ or src/, no ~, no .., not src/main/index.ts, not package.json, not package-lock.json, not docs/knowledge/**) / recovery_strategy in {restore_file_from_snapshot, restore_file_from_origin, abort_if_dirty_worktree} / runner_verdict=CONTROLLED-REAL-RUNNER-CANDIDATE / audit_write_verdict=AUDIT-ACTUAL-WRITTEN. `resolveRollbackActualRecovery(input, adapter)` reads the snapshot/origin/dirty flag from the injected adapter; tests inject mocks. Any forbidden strategy / path / missing field -> NO-GO. Valid input -> ROLLBACK-ACTUAL-RECOVERY-CANDIDATE. Candidate still keeps would_execute=false, executed_commands=[], subprocess_count=0, auto_executor_started=false, any_command_executed=false, real_execution_ready=false, unattended_ready=false, go_no_go=NO-GO. No git call, no shell, no ~/.hermes write

## 3. Verification — typecheck EXIT 0, 36/36 rollback tests, 21 files / 491 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Real execution NO-GO
