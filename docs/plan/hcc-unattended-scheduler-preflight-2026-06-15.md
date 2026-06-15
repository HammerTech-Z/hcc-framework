# HCC-UNATTENDED-SCHEDULER-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ df52642 (`hcc: add unattended runner (consume ready-candidate + injected dispatch)`)
Slice: HCC-UNATTENDED-SCHEDULER-001 (controlled unattended scheduler contract only)

## 1. Goal

Add a controlled **scheduler** contract that consumes the existing unattended runner
(`runUnattendedControlledDispatch` from `df52642`), but does **not** wire product
entrypoints. This slice is **scheduler contract only**:

- no app boot
- no timer / cron / setInterval / setTimeout
- no CLI bin / process.argv wiring
- no renderer / preload / IPC registration
- no auto-arm / bootstrap / start / host import
- no `submitDryRunAction`
- no direct `spawn` / `exec` / `child_process`
- no `~/.hermes/**` writes

The scheduler is a pure async facade that returns a structured verdict. Actual
dispatch is delegated through the existing injected `dispatch_adapter` path that
the runner already uses. The scheduler itself does no I/O.

## 2. Allowed Files (exactly 5)

1. `src/shared/lib/hcc-unattended-scheduler.ts` — scheduler contract
2. `tests/auto-executor/hcc-unattended-scheduler.test.ts` — gate + static guard tests
3. `docs/plan/hcc-unattended-scheduler-preflight-2026-06-15.md` — this file
4. `docs/closeout/hcc-unattended-scheduler-001-closeout-2026-06-15.md` — closeout
5. `docs/plan/hcc-unattended-scheduler-go-no-go-2026-06-15.md` — gate-by-gate GO/NO-GO matrix

## 3. Contract Shape

```
scheduleControlledUnattendedRun(input) -> Promise<HCCUnattendedSchedulerResult>
```

- Async, pure facade (no I/O, no side effects beyond awaiting the injected runner).
- All 10 gates evaluated up front. Any failure → `verdict: "NO-GO"` and the
  runner / adapter is **never** called.
- On success → `verdict: "CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED"` and the
  scheduler delegates to `runUnattendedControlledDispatch`. The scheduler
  itself never performs the action; dispatch stays in the injected adapter.
- All side-effect fields stay `literal-false / 0` on NO-GO and are forwarded
  unchanged from the runner result on success.
- `night_run_ready: false`, `go_no_go: "NO-GO"`, `auto_executor_started: false`
  preserved on every result (success or NO-GO).

## 4. Gate Matrix (10 gates)

| # | Gate | Source | Field checked |
|---|------|--------|---------------|
| 1 | feature flag | input | `feature_flag_enabled === true` |
| 2 | schedule_id | input | non-empty string |
| 3 | scheduler_window | input | non-empty `SchedulerWindow` (start + end + tz) |
| 4 | authorization match | input vs `ready_result` | `input.authorization_id === ready_result.authorization_id` |
| 5 | budget | input | `budget.present === true && budget.exceeded === false` |
| 6 | blockers resolved | input | `blockers_resolved === true` |
| 7 | ready_result.verdict | input | `=== "UNATTENDED-READY-CANDIDATE"` |
| 8 | ready_result.unattended_ready | input | `=== true` |
| 9 | planned_action identity + support | input | non-empty id + supported kind + `dispatch_adapter.supportsKind === true` |
| 10 | dispatch_adapter | input | present and structurally valid (`supportsKind` + `dispatch` are functions) |

Plus three identity cross-checks (task_id / source_plan_ref / requested_by_user)
between input and `ready_result` — these are the same identity the runner will
re-check. Failing them at the scheduler layer short-circuits before the runner
is invoked.

## 5. What This Slice Is **Not**

- It is **not** a timer. Nothing in this slice creates a clock.
- It is **not** a queue. Nothing in this slice enqueues work.
- It is **not** an entrypoint. Nothing imports this module. The export exists
  for the next slice to import.
- It is **not** an auto-arm. The slice returns a verdict; it does not call
  `arm()` / `start()` / `bootstrap()`.
- It is **not** an authorization owner. The scheduler only re-asserts the
  `authorization_id` matches the ready-candidate; it does not mint one.

## 6. Why This Slice Can Land at df52642

The runner commit `df52642` is the immediate ancestor on `hermes-pro-main`.
The scheduler is a thin layer above the runner. It does not change runner
semantics, runner types, or the runner's NO-GO path. The scheduler only
**refuses to call the runner** when its own gates fail.

## 7. Pre-Commit Gates (must all pass)

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-scheduler.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/hcc/hcc-e2e-canary.test.ts
npx vitest run tests/safety
git diff --check
git diff --name-status -- src/main/index.ts package.json package-lock.json
rg -n '<forbidden-substring-a>|<forbidden-substring-b>' src/shared/lib/hcc-unattended-scheduler.ts \
    docs/plan/hcc-unattended-scheduler-*.md \
    docs/closeout/hcc-unattended-scheduler-001-closeout-2026-06-15.md
```

The last `rg` should be **empty** — the two forbidden substrings (one ASCII, one CJK)
must not appear in the new code or docs (we use the type-level `night_run_ready: false`
literal and that is not the forbidden surface).

## 8. Forbidden Surfaces (static guards in the test)

The test asserts the scheduler source contains none of:

- `spawn(`, `exec(`, `child_process`
- `ipcMain`, `BrowserWindow`, `contextBridge`
- `setInterval`, `setImmediate`, `setTimeout`
- `submitDryRunAction`
- imports of `auto-executor-bootstrap`, `auto-executor-arm`,
  `auto-executor-start`, `auto-executor-host`
- any direct write under `~/.hermes`

## 9. Commit / Push

- Commit only if all gates pass.
- Commit message: `hcc: add controlled unattended scheduler contract`
- Push: per task spec, "pushed or not pushed" reported in closeout. No
  forced push. No rebase.
