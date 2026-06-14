# HCC E2E Canary

This document is the durable design artifact for the HCC
end-to-end canary. The canary is a test-only composition of
the terminal agent invoker and the app user-explicit IPC
handler against the shared invocation service + the
controlled dispatch adapter. It does NOT enable unattended
execution, does NOT trigger app boot, does NOT call
`submitDryRunAction`, does NOT write to `~/.hermes/**`.

## What the canary proves

- A real Hermes Pro plan item can flow through BOTH the
  terminal agent invoker and the app user-explicit IPC
  handler, end-to-end, against the shared invocation
  service + the controlled dispatch adapter.
- Both paths use the SAME controlled dispatch adapter
  shape; the dispatcher is fully injected; the lib never
  calls `spawn` / `exec` / `child_process` directly.
- Both paths preserve the user-explicit boundary
  (`unattended_ready: false`, `night_run_ready: false`,
  `go_no_go: "NO-GO"`, `auto_executor_started: false`).
- Both paths surface a typed `NO-GO` with a reason when
  the adapter throws, and the adapter is not called when
  the input is missing any required field.
- The shell command allowlist (`HCC_DISPATCH_SHELL_ALLOWLIST`
  with 3 entries: `git.status`, `git.diff`, `git.show`) is
  reachable from both paths; non-allowlisted argv is
  refused.
- Locked paths (`src/main/index.ts`, `package.json`,
  `package-lock.json`, `docs/knowledge/**`) are refused
  from both paths.
- Both paths preserve their caller identity in the
  result: `terminal_agent_session_id` +
  `terminal_invocation_id` for the terminal path;
  `app_session_id` + `app_invocation_id` for the app path.

## Backend policy

The canary test injects the dispatch adapter. The
production executor wiring is a separate concern: a future
slice supplies real executors behind a feature flag. The
canary does not need real executors to prove the
composition; it needs the typed adapter contract to be
honored on every code path. The tests inject a mock
adapter that simulates a successful dispatch (returns a
stable `controlled_command_id`) and a separate mock
adapter that simulates the deny paths (throws the typed
failure a real `controlledDispatch` would throw).

## Where the canary lives

- Test: `tests/hcc/hcc-e2e-canary.test.ts`
- Plan: `docs/plan/hcc-e2e-canary-preflight-2026-06-14.md`
- Closeout: `docs/closeout/hcc-e2e-canary-001-closeout-2026-06-14.md`
- Go/No-Go: `docs/plan/hcc-e2e-canary-go-no-go-2026-06-14.md`

## Next slice

`HCC-UNATTENDED-EXECUTION-ENABLEMENT-001` — controlled,
opt-in unattended execution enablement behind a feature
flag. This slice does NOT touch the canary; the canary
remains a user-explicit assertion only.
