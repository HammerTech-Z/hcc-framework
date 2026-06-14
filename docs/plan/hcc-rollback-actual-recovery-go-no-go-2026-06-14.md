# HCC-ROLLBACK-ACTUAL-RECOVERY-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | rollback 36/36 | auto-executor 21 files / 491 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-rollback-actual-recovery.ts` (~310 lines) | `tests/auto-executor/hcc-rollback-actual-recovery.test.ts` (36) | preflight | closeout | go-no-go

## What this does

`planRollbackActualRecovery(input)` is a pure planner. `resolveRollbackActualRecovery(input, adapter)` reads the relevant blob from the injected adapter. The contract ONLY plans repo-local rollback for controlled changes. It does NOT execute rollback, NOT call git, NOT spawn, NOT touch the shell, NOT write to `~/.hermes/**`, NOT call `submitDryRunAction`. Recovery strategies are limited to: `restore_file_from_snapshot`, `restore_file_from_origin`, `abort_if_dirty_worktree`. Path scope is narrow: repo-local under `docs/` or `src/`, with explicit forbiddance on `src/main/index.ts`, `package.json`, `package-lock.json`, `docs/knowledge/**`, paths starting with `~`, and `..` traversal. Predecessor verdicts required: runner_verdict=CONTROLLED-REAL-RUNNER-CANDIDATE, audit_write_verdict=AUDIT-ACTUAL-WRITTEN. before_hash and after_hash must differ. Execution fields stay literal-false on CANDIDATE, NO-GO, and resolved states. NO-GO plans short-circuit with zero adapter calls. Adapter is fully injectable; tests use mocks so no real I/O happens during unit tests.

## Boundary compliance

No arm/start/host imports, no submitDryRunAction, no spawn/exec, no IPC, no timer, no destructive git forms, no `~/.hermes` write, no package changes. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
