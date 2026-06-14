# HCC Hermes Pro Plan Dry-Run Harness

This document is the durable design artifact for the local/test harness
that proves a Hermes Pro plan item can flow through the controlled
dry-run path:

`HermesPlanTaskDescriptor` → `adaptHermesPlanTaskToDryRun()` →
`HermesPlanTaskAdapterResult`

This is **dry-run only**. Real execution remains `NO-GO`. The harness
never calls `submitDryRunAction`, never spawns a subprocess, never
writes to `~/.hermes/**`, and never arms / starts / hosts the Auto
Executor.

## What the harness proves

- The plan item descriptor can be constructed with:
  - `task_id`, `title`, `source_plan_ref`
  - `requested_by_user`
  - `authorization.authorized === true`
  - a fully-satisfied `gate_input_override`
- The adapter returns `GO-CANDIDATE_DRY_RUN_PRODUCED` when all three
  AND-combined gates pass.
- All execution fields in the result remain literal-false / zero:
  `would_execute: false`, `executed_commands: []`, `subprocess_count: 0`,
  `auto_executor_started: false`, `any_command_executed: false`,
  `real_execution_ready: false`, `unattended_ready: false`,
  `night_run_ready: false`, `go_no_go: "NO-GO"`.

## What the harness does NOT prove (and must not be extended to prove without a new slice)

- Real execution of any plan item.
- `real_execution_ready: true` anywhere in the result.
- Any I/O against `~/.hermes/**`.
- Any IPC, timer, or auto-arming of the Auto Executor.

## Negative cases (also dry-run only)

- `authorization.authorized === true` but no `gate_input_override` →
  `NO-GO` ("missing gate_input_override — authorization is not a
  substitute for evidence").
- `gate_input_override` present but a required evidence flag or blocker
  is not `true` → `NO-GO` ("incomplete gate_input_override — evidence
  state not fully satisfied").

These two negative cases prove that **authorization is not a substitute
for evidence** at the harness level as well as the unit-test level.

## Boundary compliance

- Test/local harness only.
- No `src/main/index.ts` wiring.
- No IPC, no renderer, no preload.
- No `submitDryRunAction`.
- No `spawn` / `exec` / `child_process`.
- No writes to `~/.hermes/**`.
- No `package.json` / `package-lock.json` change.
- `night_run_ready: false` and `go_no_go: "NO-GO"` literals preserved
  in the adapter and in the controlled executor.
- No use of "night-run" wording, except for the historical
  variable name `night_run_ready`.
