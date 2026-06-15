# HCC-TERMINAL-HERMES-PLAN-INVOKER-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 740b4f4
Slice: HCC-TERMINAL-HERMES-PLAN-INVOKER-001 (terminal Hermes agent plan invoker CLI)

## 1. Goal

Implement a "terminal Hermes agent plan invoker" CLI that reads a
Hermes Pro remaining execution plan from an explicit JSON fixture file,
constructs a `HCCTerminalInvocationFixture`, and calls
`invokeTerminalAgentControlledRealDispatch(...)`.

This is the first terminal-facing CLI that can reach
`FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE` through the existing
terminal invoker library path. The existing `hcc-unattended-terminal`
CLI is gated by `ready_result` not provided by the CLI shell, so it
always produces NO-GO. This new CLI bypasses the unattended scheduler
entirely and directly invokes the shared invocation service through
the terminal agent invoker.

## 2. Key design decisions

1. **Fixture-driven**: The CLI reads all plan data from a JSON file
   (path specified by `--plan-fixture`). No plan data comes from CLI
   flags (identity fields only). This keeps the CLI surface minimal
   and makes the fixture the single source of truth for the plan.

2. **Explicit user trigger**: The `--explicit-user-trigger-token`
   flag + `terminal_agent_session_id` + `terminal_invocation_id` form
   the identity gate. All three must be present and non-empty.

3. **Adapter injection**: The CLI uses the same default no-op adapter
   pattern as `hcc-unattended-terminal.ts`. Tests inject a mock
   adapter. Production wiring (future slice) supplies the real
   adapter through the overloaded entrypoint.

4. **No scheduler dependency**: Unlike the unattended terminal CLI,
   this CLI does NOT go through the scheduler. It directly invokes
   `invokeTerminalAgentControlledRealDispatch`, which delegates to
   the shared invocation service → local invoker → final dispatch.

5. **Preserves HCC boundaries**:
   - `unattended_ready: false`
   - `night_run_ready: false`
   - `go_no_go: "NO-GO"` (even on success)

## 3. Allowed files (7)

1. `src/cli/hcc-terminal-plan-invoker.ts` — CLI source
2. `bin/hcc-terminal-plan-invoker.mjs` — bin wrapper (dynamic loader)
3. `tests/auto-executor/hcc-terminal-plan-invoker.test.ts` — CLI tests
4. `docs/plan/hcc-terminal-plan-invoker-preflight-2026-06-15.md` — this file
5. `docs/plan/hcc-terminal-plan-invoker-go-no-go-2026-06-15.md` — per-gate GO/NO-GO matrix
6. `docs/closeout/hcc-terminal-plan-invoker-001-closeout-2026-06-15.md` — closeout
7. `bin/` — new directory (created by this slice)

## 4. Forbidden files (untouched)

- `src/main/index.ts`
- `src/preload/**`
- `src/renderer/**`
- `package.json`
- `package-lock.json`
- `docs/knowledge/vault-health-report-2026-06-12.md`
- `.wolf/memory.md`

## 5. CLI usage

```
node bin/hcc-terminal-plan-invoker.mjs \
  --plan-fixture <path> \
  --terminal-agent-session-id <id> \
  --terminal-invocation-id <id> \
  --explicit-user-trigger-token <token> \
  --feature-flag-enabled
```

Or directly via source (TypeScript):

```
node --experimental-strip-types \
  src/cli/hcc-terminal-plan-invoker.ts \
  --plan-fixture <path> \
  --terminal-agent-session-id <id> \
  --terminal-invocation-id <id> \
  --explicit-user-trigger-token <token> \
  --feature-flag-enabled
```

## 6. Plan fixture schema

```json
{
  "task_id": "PLAN-001",
  "source_plan_ref": "plan:2026-06:task-001",
  "requested_by_user": "u-requester",
  "authorization_id": "auth-001",
  "dry_run_artifact_hash": "sha256:abc123",
  "planned_action_id": "act-001",
  "planned_action_kind": "file_write",
  "whitelist_action_id": "wl-001",
  "target_path": "src/shared/lib/notes/test.md",
  "authorization_result": { "...": "..." },
  "runner_result": { "...": "..." },
  "audit_result": { "...": "..." },
  "rollback_plan": { "...": "..." },
  "dispatch_backend": "file_write",
  "dispatch_payload": { "kind": "file", "target_path": "...", "content": "..." }
}
```

## 7. Exit codes

| Code | Condition |
|------|-----------|
| 0 | `FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE` |
| 2 | `NO-GO` (parse error, missing flag, fixture malformed, invoker refused, adapter threw) |

## 8. Governance checklist

- [x] NO background timer / cron / setInterval / setTimeout
- [x] NO direct spawn / exec / child_process
- [x] NO submitDryRunAction
- [x] NO bootstrap / arm / start / host imports
- [x] NO writes to ~/.hermes/**
- [x] NO automatic start on app launch
- [x] NO ipcMain / BrowserWindow / contextBridge
- [x] NO runtime go_no_go: "GO"
- [x] NO runtime night_run_ready: true
- [x] Real side effects only through injected dispatch adapter
- [x] User-explicit: requires terminal_agent_session_id + terminal_invocation_id + explicit_user_trigger_token
- [x] No auto-arm: must be triggered by explicit shell command

## 9. Gate plan

1. `npm run typecheck:node` — must pass
2. `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts` — all tests must pass
3. `npx vitest run tests/auto-executor/` — no regression in existing tests
4. `npx vitest run tests/safety` — safety tests must pass
5. `git diff --check` — no whitespace errors
6. `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` — must be empty
