# HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001 — Closeout

Date: 2026-06-15
Branch: hermes-pro-main (detached HEAD at b544409 + 1 commit)
Base: origin/hermes-pro-main @ b544409
Slice: HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001

## 1. Outcome

**GO for the gated unattended product entrypoints.** Two pure
async facades added: a terminal entrypoint and an app entrypoint.
Both consume `scheduleControlledUnattendedRun` from `b544409` and
add their own identity gates. No background timer, no IPC, no
CLI bin, no renderer, no preload, no auto-arm, no app-boot
auto-start, no `~/.hermes/**` write.

## 2. Files (6)

| File | Role |
|------|------|
| `src/shared/lib/hcc-unattended-terminal-entrypoint.ts` | terminal entrypoint contract |
| `src/shared/lib/hcc-unattended-app-entrypoint.ts` | app entrypoint contract |
| `tests/auto-executor/hcc-unattended-product-entrypoints.test.ts` | gate + static-guard tests |
| `docs/plan/hcc-unattended-product-entrypoints-preflight-2026-06-15.md` | preflight |
| `docs/plan/hcc-unattended-product-entrypoints-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix |
| `docs/closeout/hcc-unattended-product-entrypoints-001-closeout-2026-06-15.md` | this file |

No other files in the commit. Red-line files (`package.json`,
`package-lock.json`, `docs/knowledge/vault-health-report-2026-06-12.md`,
`.wolf/memory.md`, renderer/UI drift, `src/main/auto-executor-*`)
were not touched.

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS (clean exit) |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-product-entrypoints.test.ts` | all pass |
| 3 | `npx vitest run tests/auto-executor/` | all pass |
| 4 | `npx vitest run tests/hcc/hcc-e2e-canary.test.ts` | all pass |
| 5 | `npx vitest run tests/safety` | all pass |
| 6 | `git diff --check` | clean |
| 7 | `git diff --name-status -- package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md` | empty |
| 8 | forbidden-token scan (per preflight) | clean |

## 4. Semantic GO/NO-GO Matrix

### Terminal path (verified by tests)

| Scenario | Verdict | Scheduler called? |
|----------|---------|-------------------|
| All gates pass | `TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED` | YES (once) |
| `terminal_agent_session_id: ""` | `NO-GO` | NO |
| `terminal_invocation_id: ""` | `NO-GO` | NO |
| `explicit_unattended_trigger_token: ""` | `NO-GO` | NO |
| `feature_flag_enabled: false` | `NO-GO` | NO |
| Scheduler returns `NO-GO` | `NO-GO` (propagated reason) | YES (once) |
| Scheduler throws | `NO-GO` (propagated reason) | YES (once, throws) |

### App path (verified by tests)

| Scenario | Verdict | Scheduler called? |
|----------|---------|-------------------|
| All gates pass | `APP-UNATTENDED-SCHEDULED-DISPATCHED` | YES (once) |
| `app_session_id: ""` | `NO-GO` | NO |
| `app_invocation_id: ""` | `NO-GO` | NO |
| `user_confirmation: false` | `NO-GO` | NO |
| `explicit_unattended_trigger_token: ""` | `NO-GO` | NO |
| `feature_flag_enabled: false` | `NO-GO` | NO |
| Scheduler returns `NO-GO` | `NO-GO` (propagated reason) | YES (once) |
| Scheduler throws | `NO-GO` (propagated reason) | YES (once, throws) |

## 5. Forbidden-Surface Scan — Result

All forbidden tokens NOT PRESENT in both entrypoint sources (with
comments stripped). The full list is in
`docs/plan/hcc-unattended-product-entrypoints-go-no-go-2026-06-15.md` §4.

## 6. Side-Effect / Ready Field Locations

`night_run_ready: false` and `go_no_go: "NO-GO"` and
`auto_executor_started: false` and `would_execute: false` and
`real_execution_ready: false` are set as literal-false / literal-"NO-GO"
in BOTH `dispatched()` and `noGo()` in BOTH entrypoint files. The
literals appear inline (not via a shared constant) so a future reader
cannot miss them.

`go_no_go: "GO"` and `night_run_ready: true` do NOT appear anywhere
as runtime values. Two static tests (one per file) enforce this with
comments-stripped regex matches.

## 7. What This Slice Did Not Do

- Did not wire product entrypoints (no CLI bin, no IPC handler, no
  UI button).
- Did not create a timer / cron / setInterval / setTimeout.
- Did not register IPC, renderer, preload, or boot-time auto-start.
- Did not import `submitDryRunAction`.
- Did not write to `~/.hermes/**`.
- Did not touch `package.json` or `package-lock.json`.
- Did not touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Did not touch `src/main/auto-executor-bootstrap`,
  `src/main/auto-executor-host`, `src/main/auto-executor-start`,
  `src/main/auto-executor-arm`, or
  `src/main/auto-executor-dry-run-action`.
- Did not set `go_no_go: "GO"`.
- Did not flip `night_run_ready: true`.
- Did not flip `auto_executor_started: true`.
- Did not perform I/O. Both entrypoints are pure async facades.
  All dispatch stays in the injected `dispatch_adapter` (the
  scheduler / runner / adapter chain is unchanged).

## 8. Push

Reported in the final slice report.

## 9. Next Step

Suggested follow-up (separate slice, separate GO-gated decision):

1. Wire the terminal entrypoint into a CLI bin (e.g. a
   `hermes-pro` / `hermes` command that takes the four
   terminal-identity flags and forwards to
   `runTerminalUnattendedScheduledDispatch`). The CLI bin lives
   under a new `bin/` directory or as a `package.json` `bin`
   field — the latter would require touching `package.json`,
   which is a separate gate.
2. Wire the app entrypoint into an IPC handler
   (`hcc-attended-scheduled-dispatch`) and a UI button in
   the Hermes Pro app. The IPC handler would be a thin
   bridge: it reads the four app-identity fields from the
   renderer (after the user clicks through an in-app
   confirmation) and calls
   `runAppUnattendedScheduledDispatch`. The handler lives in
   `src/main/`, not `src/shared/lib`, so this slice is
   strictly a `src/main/` change.
3. The two wiring slices above are explicitly out of scope
   for HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001. Each is its
   own GO-gated decision against the matrix in
   `docs/plan/hcc-unattended-product-entrypoints-go-no-go-2026-06-15.md`.
