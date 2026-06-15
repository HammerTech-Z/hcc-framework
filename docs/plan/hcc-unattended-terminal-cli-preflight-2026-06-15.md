# HCC-UNATTENDED-TERMINAL-CLI-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 740b4f4
Slice: HCC-UNATTENDED-TERMINAL-CLI-001 (terminal CLI shell for user/agent explicit unattended HCC)

## 1. Goal

Add a terminal CLI entrypoint that calls
`runTerminalUnattendedScheduledDispatch` from
`src/shared/lib/hcc-unattended-terminal-entrypoint.ts` (added in
`740b4f4`).

This slice is **CLI shell only**. The CLI:

- parses 12 required CLI flags + identity env vars
- builds the entrypoint input
- delegates to `runTerminalUnattendedScheduledDispatch`
- prints deterministic JSON to `process.stdout`
- returns exit code 0 (success) or 2 (NO-GO)

The CLI does **not**:
- create a timer / cron / setInterval / setTimeout
- call `spawn` / `exec` / `child_process`
- call `submitDryRunAction`
- import `auto-executor-bootstrap` / `arm` / `start` / `host`
- write to `~/.hermes/**`
- register IPC, renderer, preload, or app boot trigger

## 2. Allowed files (5)

1. `src/cli/hcc-unattended-terminal.ts` — CLI source
2. `tests/auto-executor/hcc-unattended-terminal-cli.test.ts` — CLI tests
3. `docs/plan/hcc-unattended-terminal-cli-preflight-2026-06-15.md` — this file
4. `docs/plan/hcc-unattended-terminal-cli-go-no-go-2026-06-15.md` — per-gate GO/NO-GO matrix
5. `docs/closeout/hcc-unattended-terminal-cli-001-closeout-2026-06-15.md` — closeout

`package.json` and `package-lock.json` are NOT in scope. The CLI
is invoked directly via:

```
node --experimental-strip-types \
  src/cli/hcc-unattended-terminal.ts \
  --terminal-agent-session-id <id> \
  --terminal-invocation-id <id> \
  --explicit-unattended-trigger-token <token> \
  --feature-flag-enabled \
  --task-id <id> \
  --source-plan-ref <ref> \
  --requested-by-user <id> \
  --authorization-id <id> \
  --schedule-id <id> \
  --planned-action-id <id> \
  --planned-action-kind <shell_command|file_write|config_patch> \
  --target-path <path>
```

A future slice may add a `package.json` `bin` field — that
slice is out of scope here and would explicitly opt in to
touching `package.json`.

## 3. Required flags (4 identity + 8 scheduler-input)

| # | Flag | Identity gate? |
|---|------|----------------|
| 1 | `--terminal-agent-session-id <id>` | yes |
| 2 | `--terminal-invocation-id <id>` | yes |
| 3 | `--explicit-unattended-trigger-token <token>` | yes |
| 4 | `--feature-flag-enabled` | yes |
| 5 | `--task-id <id>` | (scheduler input) |
| 6 | `--source-plan-ref <ref>` | (scheduler input) |
| 7 | `--requested-by-user <id>` | (scheduler input) |
| 8 | `--authorization-id <id>` | (scheduler input) |
| 9 | `--schedule-id <id>` | (scheduler input) |
| 10 | `--planned-action-id <id>` | (scheduler input) |
| 11 | `--planned-action-kind <shell_command\|file_write\|config_patch>` | (scheduler input) |
| 12 | `--target-path <path>` | (scheduler input) |

Env-var fallbacks (CLI flags take precedence):

- `HCC_TERMINAL_AGENT_SESSION_ID`
- `HCC_TERMINAL_INVOCATION_ID`
- `HCC_EXPLICIT_UNATTENDED_TRIGGER_TOKEN`
- `HCC_FEATURE_FLAG_ENABLED` (`1` or `true`)
- `HCC_SCHEDULER_WINDOW_TZ`
- `HCC_SCHEDULER_WINDOW_START_ISO`
- `HCC_SCHEDULER_WINDOW_END_ISO`

## 4. Identity gate order

1. `--terminal-agent-session-id` (non-empty) — else parse error → exit 2
2. `--terminal-invocation-id` (non-empty) — else parse error → exit 2
3. `--explicit-unattended-trigger-token` (non-empty) — else parse error → exit 2
4. `--feature-flag-enabled` (present) — else parse error → exit 2
5. All scheduler-input flags (non-empty) — else parse error → exit 2
6. `--planned-action-kind` is one of `shell_command` / `file_write` / `config_patch` — else parse error → exit 2

The CLI does NOT call the entrypoint until all 12 flags are valid.
The entrypoint does its own re-validation (gates 1-10 of
`scheduleControlledUnattendedRun`).

## 5. NO-GO surfaces

- **CLI parse error** → JSON `{verdict: "NO-GO", reason: "..."}` on stdout, exit 2. The entrypoint is NOT called.
- **Entrypoint returns NO-GO** → the entrypoint's NO-GO result is forwarded as JSON. The CLI's own JSON has `verdict: "NO-GO"` only when the CLI itself refuses (parse error). When the entrypoint returns NO-GO, the entrypoint's `verdict` is in the JSON. Exit 2.
- **Entrypoint throws** → the CLI's `main()` propagates the rejection. The test suite verifies the underlying `runTerminalCli` re-throws. (The CLI's auto-exec wrapper has no try/catch — a thrown error from the entrypoint reaches Node's unhandled-rejection handler. A future hardening slice may catch + JSON-print + exit 2.)

## 6. Ready-result scaffolding (CLI limitation)

The CLI does NOT synthesize a real `ready_result`. The
`HCCUnattendedSchedulerInput.ready_result` field is a no-op
scaffold with `verdict: "NO-GO"`. The scheduler will refuse with
`ready_result.verdict must be UNATTENDED-READY-CANDIDATE` and the
entrypoint will surface that as a typed NO-GO.

This is by design: the CLI is a shell. A real CLI caller
(future slice) provides a real ready_result by:

- extending the CLI's input fixture to accept a JSON file
  (`--ready-result <path-to-json>`); or
- calling the entrypoint directly from a richer shell.

This slice does NOT add the JSON-fixture flag — it is explicitly
out of scope here. The slice's success-path test injects a
mocked entrypoint result to verify the CLI's plumbing end-to-end.

## 7. What This Slice Does NOT Do

- Does not call `setInterval` / `setTimeout` / `setImmediate`.
- Does not call `spawn` / `exec` / `child_process` directly.
- Does not call `submitDryRunAction`.
- Does not import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Does not write to `~/.hermes/**`.
- Does not register IPC, renderer, preload, or boot-time auto-start.
- Does not modify `package.json` or `package-lock.json`.
- Does not touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Does not synthesize a real `ready_result` (the CLI is a shell,
  not a ready-state producer).

## 8. Preserved literals

- `night_run_ready: false` (literal, in the embedded no-op `ready_result` and in the `verdict: "NO-GO"` path)
- `go_no_go: "NO-GO"` (literal)
- `auto_executor_started: false` (literal)
- `would_execute: false` (literal)
- `real_execution_ready: false` (literal)
- `go_no_go: "GO"` does NOT appear anywhere as a runtime value.
  Enforced by static test with comments stripped.

## 9. Pre-Commit gates (must all pass)

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-terminal-cli.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status -- src/main/index.ts \
    src/main/auto-executor-arm.ts \
    src/main/auto-executor-bootstrap.ts \
    src/main/auto-executor-dry-run-action.ts \
    src/main/auto-executor-host.ts \
    src/main/auto-executor-start.ts
git diff --name-status -- package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
rg -n 'night-run|夜间|go_no_go: "GO"|night_run_ready: true|setInterval|setTimeout|child_process|submitDryRunAction|ipcMain|BrowserWindow|contextBridge|auto-executor-bootstrap|auto-executor-arm|auto-executor-start|auto-executor-host|~/.hermes' \
    src/cli/hcc-unattended-terminal.ts \
    tests/auto-executor/hcc-unattended-terminal-cli.test.ts
```

## 10. Commit / Push

- Commit only if all gates pass.
- Commit message: `hcc: add unattended terminal cli entrypoint`
- Push: per task spec, "pushed or not pushed" reported in closeout.
  No forced push. No rebase.
