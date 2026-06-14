# HCC-UNATTENDED-RUNNER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | runner 21/21 | auto-executor 30 files / 750 tests | e2e canary 16/16 | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-unattended-runner.ts` (~270 lines) | `tests/auto-executor/hcc-unattended-runner.test.ts` (21) | preflight | closeout | go-no-go

## What this does

`runUnattendedControlledDispatch(input)` is the first controlled unattended runner. It consumes the prior consumer's UNATTENDED-READY-CANDIDATE and dispatches the planned action through the injected dispatch adapter. Hard AND-combination of: ready_result.verdict === UNATTENDED-READY-CANDIDATE, ready_result.unattended_ready === true, feature_flag_enabled === true, dispatch_adapter present + supportsKind returns true, identity cross-check (task_id / source_plan_ref / requested_by_user / authorization_id) match across ready_result and input. All gates pass → CONTROLLED-UNATTENDED-RUNNER-DISPATCHED with the dispatch performed exactly once through the injected adapter. Any gate fail → NO-GO with the adapter never called. Adapter throws → NO-GO with propagated reason. Even on success, night_run_ready=false, go_no_go="NO-GO", auto_executor_started=false, would_execute=false are preserved. The runner never calls spawn / exec / child_process / submitDryRunAction. No app boot / CLI / renderer / preload / ipcMain registration / timer / cron / auto-arm.

## Side-effect field locations

- `any_command_executed: true` — `src/shared/lib/hcc-unattended-runner.ts:240` (in `dispatched()`)
- `subprocess_count: 1` — `src/shared/lib/hcc-unattended-runner.ts:242` (in `dispatched()`)
- `executed_commands: [controlled_command_id]` — `src/shared/lib/hcc-unattended-runner.ts:241` (in `dispatched()`)
- `unattended_ready: true` — `src/shared/lib/hcc-unattended-runner.ts:243` (carried from prior consumer)

All four side-effect fields are ONLY set in `dispatched()`. NO-GO paths always set them to literal-false/zero/`[]` in `noGo()`.

## Proof no direct execution surface

- `src/shared/lib/hcc-unattended-runner.ts` does NOT contain `spawn`, `exec`, `child_process`, `ipcMain`, `BrowserWindow`, `contextBridge`, `setInterval`, `setTimeout`, `submitDryRunAction`, `auto-executor-bootstrap`, `auto-executor-arm`, `auto-executor-start`, `auto-executor-host` (verified by static guard tests in the test file).
- The only execution surface is `await adapter.dispatch(...)` with the adapter fully injected.

## Boundary compliance

No I/O. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `night_run_ready: true`, and `go_no_go: "GO"` are never set. No prohibited readiness wording outside the historical variable `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- After merge, the unattended runner is available. A future slice will wire the runner into a controlled scheduler (still no app boot / CLI / timer / cron / auto-arm).
