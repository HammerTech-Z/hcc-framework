# HCC-USER-EXPLICIT-LOCAL-INVOKER-001 — Preflight

- Task: `HCC-USER-EXPLICIT-LOCAL-INVOKER-001` | Date: 2026-06-14 | Branch: `hcc-user-explicit-local-invoker-001` | Predecessor: `6c18185`

## 1. Baseline — `HEAD = origin/main = 6c18185`

## 2. What this slice adds — local user-explicit invocation surface that consumes `evaluateFinalControlledRealDispatch`. Three functions: `checkUserExplicitFixture(fixture)` synchronous guard (returns `null` or a reason); `buildFinalDispatchInputFromFixture(fixture)` pure projection with `explicit_user_triggered=true`; `invokeUserExplicitControlledRealDispatch(fixture)` async top-level entrypoint that runs the guard and delegates to the final dispatch. The invoker is driven solely by an explicit `HCCUserExplicitInvocationFixture`; the fixture MUST carry `explicit_user_trigger_token` (non-empty) and a fully-injected `dispatch_adapter`. Missing either -> NO-GO and the adapter is never called. The invoker never calls `spawn` / `exec` / `child_process` / `submitDryRunAction` directly. Success path may inherit `real_execution_ready=true` / `would_execute=true` / `any_command_executed=true` from the final dispatch (gated on the final dispatch's own 4-verdict AND-combination). Still keeps `unattended_ready=false`, `night_run_ready=false`, `go_no_go="NO-GO"`, `auto_executor_started=false`. App boot, IPC, timer, cron, and auto-arm paths cannot trigger this invoker because the trigger token must be supplied by a caller that obtained it from a real user-explicit path

## 3. Verification — typecheck EXIT 0, 27/27 invoker tests, 23 files / 550 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
