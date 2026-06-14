# HCC-UNATTENDED-READY-CONSUMER-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | consumer 24/24 | auto-executor 29 files / 729 tests | e2e canary 16/16 | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-unattended-ready-consumer.ts` (~250 lines) | `tests/auto-executor/hcc-unattended-ready-consumer.test.ts` (24) | preflight | closeout | go-no-go

## What this does

`evaluateUnattendedReadyConsumer(input)` is a pure evaluator that consumes the enablement result + the final controlled real dispatch result + 8 gates + identity cross-check, and decides whether the system is UNATTENDED-READY. Any gate fail → NO-GO with `unattended_ready: false`. All gates pass → UNATTENDED-READY-CANDIDATE with `unattended_ready: true` (first and only slice in the HCC track allowed to flip this field). Even candidate keeps `night_run_ready: false`, `go_no_go: "NO-GO"`, `auto_executor_started: false`, and all execution side-effects literal-false/zero. No I/O, no dispatch, no product wiring. Readiness signal only; a future runner will consume this result.

## Location of `unattended_ready: true`

`src/shared/lib/hcc-unattended-ready-consumer.ts:201` — the `candidate()` function body sets `unattended_ready: true`. This is the ONLY location in the entire HCC track where this field is set to true. Conditional: gated on all 8 gates + identity cross-check.

## Boundary compliance

No I/O. No spawn / exec / child_process / ipcMain / BrowserWindow / contextBridge / setInterval / setTimeout / submitDryRunAction / bootstrap / arm / start / host calls. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `night_run_ready: true`, and `go_no_go: "GO"` are never set. No prohibited readiness wording outside the historical variable `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- After merge, the unattended ready consumer is the final readiness signal. A future slice will wire the unattended runner to consume this result.
