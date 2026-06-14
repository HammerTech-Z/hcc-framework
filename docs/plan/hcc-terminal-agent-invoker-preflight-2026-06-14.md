# HCC-TERMINAL-AGENT-INVOKER-001 — Preflight

- Task: `HCC-TERMINAL-AGENT-INVOKER-001` | Date: 2026-06-14 | Branch: `hcc-terminal-agent-invoker-001` | Predecessor: `b2521bc`

## 1. Baseline — `HEAD = origin/main = b2521bc`

## 2. What this slice adds — terminal Hermes agent invoker (first terminal-facing HCC entrypoint). Wraps the shared invocation service + the controlled dispatch adapter (fully injected) with terminal-local identity (terminal_agent_session_id, terminal_invocation_id). The invoker exposes `checkTerminalFixture(fixture)` synchronous guard (returns null on a valid fixture, a reason string otherwise); `invokeTerminalAgentControlledRealDispatch(fixture)` async top-level that runs the guard, delegates to `invokeSharedControlledRealDispatch`, and re-shapes the result with the terminal identity; `buildTerminalDispatchAdapter(factory)` helper that re-exports `buildControlledDispatchAdapter` for terminal callers that want to construct their own adapter. The fixture must carry `explicit_user_trigger_token` (non-empty) and `terminal_agent_session_id` (non-empty). The dispatch adapter is fully injected; the invoker never calls spawn / exec / child_process. Dispatch adapter throws are caught and surfaced as a NO-GO with a typed reason. No CLI / IPC / renderer / preload / app boot / timer / cron / auto-arm path. No `package.json` script or bin entry is added; the invoker is a library callable. The terminal Hermes agent (which lives outside this repo) is expected to import this lib in a future slice

## 3. Verification — typecheck EXIT 0, 29/29 terminal-invoker tests, 26 files / 639 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
