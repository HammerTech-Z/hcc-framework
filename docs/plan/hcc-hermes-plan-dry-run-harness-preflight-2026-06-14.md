# HCC-HERMES-PLAN-DRY-RUN-HARNESS-001 — Preflight

- Task: `HCC-HERMES-PLAN-DRY-RUN-HARNESS-001` | Date: 2026-06-14 | Branch: `hcc-hermes-plan-dry-run-harness-001` | Predecessor: `edfd153`

## 1. Baseline — `HEAD = origin/main = edfd153`

## 2. What this slice adds — local/test harness `tests/hcc/hcc-hermes-plan-dry-run-harness.test.ts` proving the dry-run flow `HermesPlanTaskDescriptor -> adaptHermesPlanTaskToDryRun() -> HermesPlanTaskAdapterResult`. 1 GO fixture (all three gates satisfied), 2 NO-GO fixtures (override missing, override incomplete), invariants + static guard on the adapter. No real execution, no real_execution_ready flip, no IPC/timer/spawn/~/.hermes write, no package changes

## 3. Verification — typecheck EXIT 0, 13/13 harness, 17 files / 380 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Real/unattended NO-GO
