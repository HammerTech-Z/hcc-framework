# HCC-CONTROLLED-DISPATCH-ADAPTER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | adapter 40/40 | auto-executor 25 files / 610 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-controlled-dispatch-adapter.ts` (~640 lines) | `tests/auto-executor/hcc-controlled-dispatch-adapter.test.ts` (40) | preflight | closeout | go-no-go

## What this does

`controlledDispatch(input)` runs the input through 9 guards (planned_action_id non-empty, trigger_proof.explicit_user_trigger_token non-empty, trigger_proof.source_service recognized, executors.shell_executor / writer / patcher all functions, now() clock function) and dispatches against one of 4 backends:

- in_memory: returns `in-memory:<planned_action_id>`; no executor call.
- shell_command: looks up argv in `HCC_DISPATCH_SHELL_ALLOWLIST` (3 entries: `git.status`, `git.diff`, `git.show --stat HEAD`); allowlisted argv is forwarded to the injected `shell_executor`; non-allowlisted argv is denied. Free-form shell strings are never accepted.
- file_write: requires repo-local path under `docs/`, `src/`, or `tests/`, with `.md` / `.json` / `.ts` / `.tsx` / `.txt` extension; rejects `~`-prefixed, absolute, `..`-traversal, and locked paths (`src/main/index.ts`, `package.json`, `package-lock.json`, `docs/knowledge/**`); forwards to the injected `writer`.
- config_patch: same path rules as file_write; requires non-empty patch array of `{ key: string, value: unknown }` entries; forwards to the injected `patcher`.

`buildControlledDispatchAdapter(factory)` returns a `HCCFinalControlledRealDispatchAdapter` whose `dispatch` re-stamps the planned_action_id / kind / target_path from the final dispatch's call and forwards to `controlledDispatch`. Failures from `controlledDispatch` are thrown by the adapter so the final dispatch contract's NO-GO propagation works.

The lib never calls spawn / exec / child_process / writeFile / readFile. The injected executors are the only I/O surface. Tests inject mocks. Production wiring (future slice) supplies real executors.

## Boundary compliance

No product wiring. No CLI / IPC / renderer / preload / app boot / timer / cron / auto-arm. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- `HCC-TERMINAL-AGENT-INVOKER-001` (next slice) — Terminal Hermes agent invoker that consumes the shared invocation service + this adapter, user-explicit only, no auto-arm.
