# HCC-TERMINAL-AGENT-INVOKER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | terminal-invoker 29/29 | auto-executor 26 files / 639 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-terminal-agent-invoker.ts` (~250 lines) | `tests/auto-executor/hcc-terminal-agent-invoker.test.ts` (29) | preflight | closeout | go-no-go

## What this does

`invokeTerminalAgentControlledRealDispatch(fixture)` is the first terminal-facing HCC entrypoint. It wraps the shared invocation service + the controlled dispatch adapter with terminal-local identity (terminal_agent_session_id, terminal_invocation_id). The synchronous guard `checkTerminalFixture` covers: terminal_agent_session_id non-empty, terminal_invocation_id non-empty, dispatch_adapter present with supportsKind + dispatch functions, shared_fixture present, explicit_user_trigger_token non-empty, and the shared service's own guard (delegated). The async entrypoint runs the guard; on guard failure it returns NO-GO with a typed reason without ever touching the adapter. On guard success it delegates to the shared invocation service; if the dispatch adapter throws, the throw is caught and re-shaped as a NO-GO with a typed reason so the terminal caller does not have to handle two error channels. The result is re-shaped with the terminal identity on every code path.

There is no CLI process and no `package.json` change in this slice. The invoker is a library callable. The terminal Hermes agent (which lives outside this repo) is expected to import this lib in a future slice.

## Boundary compliance

No product wiring. No CLI / IPC / renderer / preload / app boot / timer / cron / auto-arm. No bootstrap / arm / start / host imports. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- `HCC-APP-USER-EXPLICIT-IPC-001` (next slice) — Hermes Pro app user-explicit IPC invoker that consumes the shared invocation service, user-explicit only, no app boot / no renderer / no auto-arm.
