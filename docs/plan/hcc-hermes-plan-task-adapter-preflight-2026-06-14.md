# HCC-HERMES-PLAN-TASK-ADAPTER-001 — Preflight

- Task: `HCC-HERMES-PLAN-TASK-ADAPTER-001` | Date: 2026-06-14 | Branch: `hcc-hermes-plan-task-adapter-001` | Predecessor: `ca43c7c`

## 1. Baseline — `HEAD = origin = ca43c7c`

## 2. What this slice adds — `adaptHermesPlanTaskToDryRun(task)` adapter. Three AND-combined gates: (G1) `requested_by_user` non-empty, (G2) `authorization.authorized === true`, (G3) `gate_input_override` present AND fully satisfied (evidence + verifier + blockers). Authorization is NOT a substitute for evidence. Dispatches to call surface only when all three pass. Returns HermesPlanTaskAdapterResult with literal-false execution fields

## 3. Verification — typecheck EXIT 0, 20/20 adapter, 20/380 auto-executor, diff clean, invariants 6, 36 files / 988 tests safety PASS

## 4. Decision — Commit YES, Push held, Real/unattended NO-GO
