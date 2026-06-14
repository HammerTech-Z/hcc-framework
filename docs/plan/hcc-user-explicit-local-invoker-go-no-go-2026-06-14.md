# HCC-USER-EXPLICIT-LOCAL-INVOKER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | invoker 27/27 | auto-executor 23 files / 550 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-user-explicit-local-invoker.ts` (~210 lines) | `tests/auto-executor/hcc-user-explicit-local-invoker.test.ts` (27) | preflight | closeout | go-no-go

## What this does

`invokeUserExplicitControlledRealDispatch(fixture)` is the local user-explicit entrypoint to the final controlled real dispatch. The invoker is driven solely by an explicit `HCCUserExplicitInvocationFixture`; there is no other entrypoint, no default fixture, no fallback. The fixture must carry `explicit_user_trigger_token` (non-empty) and a fully-injected `dispatch_adapter` (object with `supportsKind` and `dispatch` functions). The synchronous guard `checkUserExplicitFixture` returns a reason if either is missing; the async entrypoint then either projects the fixture into a final-dispatch input (`explicit_user_triggered=true`) and delegates, or returns NO-GO with the guard reason without ever calling the adapter. The invoker never calls `spawn` / `exec` / `child_process` / `submitDryRunAction` directly. App boot, IPC, timer, cron, and auto-arm paths cannot trigger this invoker because the trigger token must be supplied by a caller that obtained it from a real user-explicit path. The user-explicit boundary (`unattended_ready=false`, `night_run_ready=false`, `go_no_go="NO-GO"`, `auto_executor_started=false`) is preserved on both success and NO-GO. The flip of `real_execution_ready` is delegated to the final dispatch contract which is gated on its own 4-verdict AND-combination.

## Boundary compliance

User-explicit only. No app boot, no IPC, no timer, no cron, no auto-arm path may trigger this. No bootstrap / arm / start / host imports. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
