# HCC-SHARED-INVOCATION-SERVICE-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | service 20/20 | auto-executor 24 files / 570 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-shared-invocation-service.ts` (~90 lines) | `tests/auto-executor/hcc-shared-invocation-service.test.ts` (20) | preflight | closeout | go-no-go

## What this does

`invokeSharedControlledRealDispatch(fixture)` is the single canonical shared entrypoint future Terminal Hermes agent and Hermes Pro app callers will share. The service consumes the same `HCCSharedInvocationFixture` (alias of `HCCUserExplicitInvocationFixture`) + `explicit_user_trigger_token` + injected `dispatch_adapter` protocol as the local invoker, and re-uses the same input / result schema. It is a thin facade: the synchronous guard `checkSharedInvocationFixture` is re-exported, and the async entrypoint delegates to `invokeUserExplicitControlledRealDispatch` after re-running the guard. The metadata function `getSharedInvocationServiceMetadata()` returns schema_version + service + protocol + literal-false fallback / default_execution / implicit_caller flags. There is no fallback, no default execution, and no implicit caller. The service is the only path from outside the lib to the final dispatch. App boot, IPC, timer, cron, and auto-arm paths cannot trigger the service because the trigger token must be supplied by a caller that obtained it from a real user-explicit path.

## Boundary compliance

Shared service only. No product entrypoint wired. No CLI, no IPC, no renderer, no preload, no app boot, no timer, no cron, no auto-arm path. No bootstrap / arm / start / host imports. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- `HCC-CONTROLLED-DISPATCH-ADAPTER-001` (next slice) — controlled dispatch adapter that the shared service will inject by default; covers the in-memory / shell / file / config dispatch backends.
