# HCC-UNATTENDED-SCHEDULER-001 — Closeout

Date: 2026-06-15
Branch: hermes-pro-main (detached HEAD at df52642)
Base: origin/hermes-pro-main @ df52642
Slice: HCC-UNATTENDED-SCHEDULER-001

## 1. Outcome

**GO for the controlled unattended scheduler contract.** The slice is
contract-only: one export, no product wiring, no timer, no IPC, no CLI,
no renderer, no preload, no auto-arm.

## 2. Files (exactly 5)

| File | Role |
|------|------|
| `src/shared/lib/hcc-unattended-scheduler.ts` | scheduler contract |
| `tests/auto-executor/hcc-unattended-scheduler.test.ts` | gate + static-guard tests (28 cases) |
| `docs/plan/hcc-unattended-scheduler-preflight-2026-06-15.md` | preflight |
| `docs/plan/hcc-unattended-scheduler-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix |
| `docs/closeout/hcc-unattended-scheduler-001-closeout-2026-06-15.md` | this file |

No other files in the commit. Red-line files (`src/main/index.ts`,
`package.json`, `package-lock.json`, renderer/preload/IPC, src/main/auto-executor-*)
were not touched.

## 3. Gate Matrix — Result

| # | Gate | Required | Observed |
|---|------|----------|----------|
| 1 | `npm run typecheck:node` | clean | **PASS** (clean exit, 0 errors) |
| 2 | `npx vitest run tests/auto-executor/hcc-unattended-scheduler.test.ts` | all pass | **PASS** (28/28) |
| 3 | `npx vitest run tests/auto-executor/` | all pass | **PARTIAL** (see §4) |
| 4 | `npx vitest run tests/hcc/hcc-e2e-canary.test.ts` | all pass | **PASS** (16/16) |
| 5 | `npx vitest run tests/safety` | all pass | **PASS** (988/988) |
| 6 | `git diff --check` | clean | **PASS** (no whitespace errors in this slice) |
| 7 | `git diff --name-status -- src/main/index.ts package.json package-lock.json` | empty | **PRE-EXISTING DRIFT** (see §4) |
| 8 | forbidden-substring scan (`<forbidden-substring-a>` / `<forbidden-substring-b>`) | empty | **PASS** (empty) |

## 4. Pre-Existing Working-Tree Drift (NOT in this commit)

At the time of this commit, the working tree contains uncommitted
deletions of `src/main/auto-executor-bootstrap.ts`,
`src/main/auto-executor-host.ts`, `src/main/auto-executor-start.ts`,
`src/main/auto-executor-arm.ts`, and `src/main/auto-executor-dry-run-action.ts`,
plus a one-line modification to `src/main/index.ts` that removes the
`installAutoExecutorHost` import. This drift predates this session and
is NOT authored by the HCC-UNATTENDED-SCHEDULER-001 slice.

Consequences:

- `git diff --name-status -- src/main/index.ts package.json package-lock.json`
  shows `M src/main/index.ts`. The `M` is the pre-existing
  `installAutoExecutorHost` import removal, not a new change in this
  commit. `package.json` and `package-lock.json` are unchanged.
- `npx vitest run tests/auto-executor/` cannot collect 5 test files
  (`arm-integration.test.ts`, `bootstrap-integration.test.ts`,
  `host-lifecycle.test.ts`, `start-integration.test.ts`,
  `action-integration.test.ts`) because those files import the missing
  `auto-executor-bootstrap` / `auto-executor-host` modules. The error
  is a Vite import-resolution failure, not an assertion failure. The
  remaining 26 test files in `tests/auto-executor/` collect and pass:
  **686 / 686 cases pass**, including the existing
  `hcc-unattended-runner.test.ts` and the new
  `hcc-unattended-scheduler.test.ts`.

The drift is a separate housekeeping task. Restoring the deleted
files is out of scope for this slice (5-file scope, red lines forbid
touching `src/main/auto-executor-*`). Closeout does NOT claim those
files are touched.

## 5. Semantic GO/NO-GO Matrix

| Scenario | Verdict | Adapter called? | Side-effect fields |
|----------|---------|-----------------|--------------------|
| All gates pass | `CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED` | YES (once, by runner) | `any_command_executed: true`, `subprocess_count: 1`, `executed_commands: [controlled_command_id]` |
| `feature_flag_enabled: false` | `NO-GO` | NO | all literal-false / 0 / `[]` |
| `schedule_id: ""` | `NO-GO` | NO | literal |
| `scheduler_window` missing / malformed | `NO-GO` | NO | literal |
| `authorization_id` mismatch (input vs ready) | `NO-GO` | NO | literal |
| `ready_result.authorization_id` mismatch | `NO-GO` | NO | literal |
| `budget.present: false` | `NO-GO` | NO | literal |
| `budget.exceeded: true` | `NO-GO` | NO | literal |
| `blockers_resolved: false` | `NO-GO` | NO | literal |
| `ready_result.verdict` not `UNATTENDED-READY-CANDIDATE` | `NO-GO` | NO | literal |
| `ready_result.unattended_ready: false` | `NO-GO` | NO | literal |
| `ready_result.task_id` mismatch | `NO-GO` | NO | literal |
| `ready_result.source_plan_ref` mismatch | `NO-GO` | NO | literal |
| `ready_result.requested_by_user` mismatch | `NO-GO` | NO | literal |
| `planned_action` missing | `NO-GO` | NO | literal |
| `planned_action_kind` unsupported | `NO-GO` | NO | literal |
| `dispatch_adapter` missing | `NO-GO` | NO | literal |
| `dispatch_adapter.supportsKind` returns false | `NO-GO` | NO (no dispatch) | literal |
| Runner returns `NO-GO` (e.g. empty `controlled_command_id`) | `NO-GO` | YES (once, by runner) | literal |
| Adapter throws | `NO-GO` | YES (once, by runner) | literal |

## 6. Forbidden-Surface Scan — Result

| Token | Result |
|-------|--------|
| `spawn(` | NOT PRESENT |
| `exec(` | NOT PRESENT |
| `child_process` | NOT PRESENT |
| `ipcMain` | NOT PRESENT |
| `BrowserWindow` | NOT PRESENT |
| `contextBridge` | NOT PRESENT |
| `setInterval(`, `setTimeout(`, `setImmediate(` | NOT PRESENT |
| `auto-executor-bootstrap` | NOT PRESENT |
| `auto-executor-arm` | NOT PRESENT |
| `auto-executor-start` | NOT PRESENT |
| `auto-executor-host` | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT |
| `forbidden-substring-a` | NOT PRESENT |
| `forbidden-substring-b` | NOT PRESENT |

## 7. Side-Effect / Ready Field Locations

`night_run_ready: false` and `go_no_go: "NO-GO"` and
`auto_executor_started: false` and `would_execute: false` and
`real_execution_ready: false` are set as literal-false / literal-"NO-GO"
in BOTH `dispatched()` and `noGo()` in
`src/shared/lib/hcc-unattended-scheduler.ts`. The literals appear
inline (not via a shared constant) so a future reader cannot miss
them.

`go_no_go: "GO"` does NOT appear anywhere in the source. A static
test (`scheduler preserves night_run_ready:false + go_no_go:NO-GO
literals in source`) enforces this with a comments-stripped regex
match.

## 8. What This Slice Did Not Do

- Did not wire product entrypoints.
- Did not create a timer / cron / setInterval / setTimeout.
- Did not register IPC, renderer, preload, or `ipcMain`.
- Did not import `submitDryRunAction` (forbidden by runner governance).
- Did not write to `~/.hermes/**`.
- Did not touch `src/main/index.ts`, `package.json`, `package-lock.json`.
- Did not touch `src/main/auto-executor-bootstrap`,
  `src/main/auto-executor-host`, `src/main/auto-executor-start`,
  `src/main/auto-executor-arm`, or
  `src/main/auto-executor-dry-run-action`.
- Did not set `go_no_go: "GO"`.
- Did not flip `night_run_ready: true`.
- Did not flip `auto_executor_started: true`.
- Did not perform I/O. The scheduler is a pure async facade. All
  dispatch stays in the injected `dispatch_adapter` (the same adapter
  the runner uses).

## 9. Push

**Not pushed.** Push is deferred until the user confirms the
pre-existing working-tree drift in §4 should be carried, restored, or
discarded.

## 10. Next Step

Suggested follow-up (separate slice, separate GO-gated decision):

1. Restore the pre-existing working-tree drift in
   `src/main/index.ts` and the five `auto-executor-*` source files.
   Confirm the e2e canary, the safety suite, and the full
   `tests/auto-executor/` suite all pass with a clean working tree.
2. Land a separate slice that wires
   `scheduleControlledUnattendedRun` into a controlled host (timer,
   cron, IPC, or CLI). That slice is explicitly out of scope here.
3. Push the current commit to `origin/hermes-pro-main` once the
   housekeeping is complete.
