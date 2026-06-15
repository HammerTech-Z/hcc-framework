# HCC-UNATTENDED-TERMINAL-CLI-001 — Closeout

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 740b4f4
Slice: HCC-UNATTENDED-TERMINAL-CLI-001

## 1. Outcome

**GO for the unattended terminal CLI shell.** A single-file TypeScript
CLI at `src/cli/hcc-unattended-terminal.ts` that consumes
`runTerminalUnattendedScheduledDispatch` from `740b4f4`. The CLI
parses 12 CLI flags (4 identity + 8 scheduler-input) and prints
deterministic JSON to `process.stdout`. Exit 0 on success, exit 2
on any NO-GO path. No background timer, no IPC, no renderer, no
preload, no app boot, no `~/.hermes/**` write, no
`package.json` change.

## 2. Files (5)

| File | Role |
|------|------|
| `src/cli/hcc-unattended-terminal.ts` | CLI source (parse + runTerminalCli + main) |
| `tests/auto-executor/hcc-unattended-terminal-cli.test.ts` | 19 tests (parse, runTerminalCli, main, static guards) |
| `docs/plan/hcc-unattended-terminal-cli-preflight-2026-06-15.md` | preflight |
| `docs/plan/hcc-unattended-terminal-cli-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix |
| `docs/closeout/hcc-unattended-terminal-cli-001-closeout-2026-06-15.md` | this file |

`package.json` and `package-lock.json` were NOT touched. The
slice stays inside the 5-file scope. The CLI is invoked via
`node --experimental-strip-types src/cli/hcc-unattended-terminal.ts ...`
(uses Node 24's built-in TypeScript type-stripping).

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS (clean exit) |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-terminal-cli.test.ts` | 19/19 PASS |
| 3 | `npx vitest run tests/auto-executor/` | 33/33 files, 824/824 PASS (collection CLEAN — the 5 prior collection errors are now resolved because the 6 `auto-executor-*` source files were restored) |
| 4 | `npx vitest run tests/safety` | 36/36 files, 988/988 PASS |
| 5 | `git diff --check` | clean |
| 6 | `git diff --name-status -- src/main/{index,auto-executor-*}.ts` | empty |
| 7 | `git diff --name-status -- package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` | empty for the 4 forbidden files |
| 8 | forbidden-token scan (per preflight §9) | clean |

## 4. CLI GO/NO-GO Matrix

| Scenario | Exit | Verdict on stdout | Entrypoint called? |
|----------|------|-------------------|--------------------|
| All 12 flags present | 0 | entrypoint's verdict (or `TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED` if entrypoint succeeds) | YES (once) |
| Missing `--terminal-agent-session-id` | 2 | `NO-GO` | NO |
| Missing `--terminal-invocation-id` | 2 | `NO-GO` | NO |
| Missing `--explicit-unattended-trigger-token` | 2 | `NO-GO` | NO |
| Missing `--feature-flag-enabled` | 2 | `NO-GO` | NO |
| Missing any scheduler-input flag | 2 | `NO-GO` | NO |
| `--planned-action-kind` unsupported | 2 | `NO-GO` | NO |
| Env vars used when flags absent | 0 | entrypoint's verdict | YES (once) |
| Entrypoint returns NO-GO | 2 | entrypoint's NO-GO JSON | YES (once) |
| Entrypoint throws | 2 (or unhandled rejection if auto-exec) | propagated | YES (once, throws) |

## 5. Forbidden-Surface Scan — Result

All forbidden tokens NOT PRESENT in the CLI source (with comments
stripped). The full list is in
`docs/plan/hcc-unattended-terminal-cli-go-no-go-2026-06-15.md` §4.

## 6. Side-Effect / Ready Field Locations

`night_run_ready: false` and `go_no_go: "NO-GO"` and
`auto_executor_started: false` and `would_execute: false` and
`real_execution_ready: false` are set as literal-false / literal-"NO-GO"
in the embedded no-op `ready_result` (CLI scaffold). The
`runTerminalCli` function forwards the entrypoint's verdict and
side-effect fields verbatim. The CLI itself never constructs an
entrypoint result with `go_no_go: "GO"` or `night_run_ready: true`.

## 7. What This Slice Did Not Do

- Did not modify `package.json` or `package-lock.json`.
- Did not create a `bin/hermes-unattended.mjs` wrapper.
- Did not add a real `ready_result` fixture loader.
- Did not inject a real dispatch adapter (the CLI uses a
  no-op adapter that throws on `dispatch`; the entrypoint
  catches the throw and surfaces a typed NO-GO).
- Did not call `setInterval` / `setTimeout` / `setImmediate`.
- Did not call `spawn` / `exec` / `child_process` directly.
- Did not call `submitDryRunAction`.
- Did not import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Did not write to `~/.hermes/**`.
- Did not register IPC, renderer, preload, or boot-time auto-start.
- Did not touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Did not set `go_no_go: "GO"`.
- Did not flip `night_run_ready: true`.
- Did not flip `auto_executor_started: true`.
- Did not perform any I/O beyond `process.argv` read and
  `process.stdout` write.

## 8. CLI Ready-Result Scaffolding (limitation, by design)

The CLI does NOT synthesize a real `ready_result`. The
`HCCUnattendedSchedulerInput.ready_result` field is a no-op
scaffold with `verdict: "NO-GO"`. The scheduler will refuse with
`ready_result.verdict must be UNATTENDED-READY-CANDIDATE` and the
entrypoint will surface that as a typed NO-GO. This is by design:
the CLI is a shell, not a ready-state producer. A real CLI caller
(future slice) provides a real ready_result by:

- adding a `--ready-result <path-to-json>` flag; or
- calling the entrypoint directly from a richer shell.

This slice does NOT add the JSON-fixture flag — it is explicitly
out of scope here.

## 9. Push

Per task spec, the slice did not carry an explicit push
authorization. The commit is local. Push is deferred until the
user explicitly authorizes `git push origin <hash>:hermes-pro-main`.

## 10. Next Step

Suggested follow-up (separate slice, separate GO-gated decision):

1. **Add a `package.json` `bin` field** so the CLI can be
   invoked as `hermes-unattended` rather than
   `node --experimental-strip-types src/cli/hcc-unattended-terminal.ts ...`.
   This requires touching `package.json` (separate gate; the
   slice must explicitly opt in to that file).
2. **Add a `--ready-result <path-to-json>` flag** so a real
   caller can supply a real `ready_result` and the CLI can
   actually dispatch through a real adapter.
3. **Add a real dispatch adapter** wired to the production
   whitelist. The current no-op adapter is a test fixture;
   the production wiring is a separate slice.
4. **Add the app IPC handler** (`HCC-UNATTENDED-APP-IPC-001`)
   for the in-app path. This is the next recommended slice
   after the CLI lands.
