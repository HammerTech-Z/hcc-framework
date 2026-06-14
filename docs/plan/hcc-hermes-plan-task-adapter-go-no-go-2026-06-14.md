# HCC-HERMES-PLAN-TASK-ADAPTER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | adapter 20/20 | auto-executor 20/380 | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-hermes-plan-task-adapter.ts` (~360 lines) | test (20) | preflight | closeout | go-no-go

## What this does

`adaptHermesPlanTaskToDryRun(task)` enforces three AND-combined gates: (G1) `requested_by_user` non-empty, (G2) `authorization.authorized === true`, (G3) `gate_input_override` present AND fully satisfied across evidence / verifier / blockers. **Authorization is NOT a substitute for evidence** — auth=true with missing or incomplete `gate_input_override` returns NO-GO. Only when all three pass does the adapter dispatch to `callControlledDryRun` with `mode: "explicit_user_authorized_go_candidate"` + `explicit_user_authorization_record`. Returns `HermesPlanTaskAdapterResult` with literal-false execution fields. G1 fail → NO-GO "missing requested_by_user". G2 fail → NO-GO "missing or false authorization". G3 missing → NO-GO "missing gate_input_override — authorization is not a substitute for evidence". G3 incomplete → NO-GO "incomplete gate_input_override — evidence state not fully satisfied: {flags}"

## Boundary compliance

No arm/start/host imports, no submitDryRunAction, no spawn/exec, no IPC, no timer, no ~/.hermes write, no package changes.

## Next step

- `GO COMMIT` → commit 5 files
