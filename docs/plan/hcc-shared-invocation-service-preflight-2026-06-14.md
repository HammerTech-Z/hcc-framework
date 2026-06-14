# HCC-SHARED-INVOCATION-SERVICE-001 — Preflight

- Task: `HCC-SHARED-INVOCATION-SERVICE-001` | Date: 2026-06-14 | Branch: `hcc-shared-invocation-service-001` | Predecessor: `7179eee`

## 1. Baseline — `HEAD = origin/main = 7179eee`

## 2. What this slice adds — shared invocation service facade. Re-exports the canonical `HCCSharedInvocationFixture` (alias of `HCCUserExplicitInvocationFixture`) and `HCCSharedInvocationResult` (alias of `HCCFinalControlledRealDispatchResult`). Re-exports the sync guard as `checkSharedInvocationFixture`. Exposes a single async entrypoint `invokeSharedControlledRealDispatch(fixture)` that delegates to `invokeUserExplicitControlledRealDispatch`. Exposes `getSharedInvocationServiceMetadata()` returning schema_version + service + protocol + literal-false fallback/default_execution/implicit_caller. The service is the single canonical entrypoint future Terminal Hermes agent and Hermes Pro app callers will share. No product entrypoint is wired here. There is no CLI, no IPC, no renderer, no preload, no app boot, no timer, no cron, no auto-arm path. Missing trigger token or dispatch_adapter -> NO-GO and the adapter is never called. Success still preserves `unattended_ready=false`, `night_run_ready=false`, `go_no_go="NO-GO"`, `auto_executor_started=false`

## 3. Verification — typecheck EXIT 0, 20/20 service tests, 24 files / 570 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
