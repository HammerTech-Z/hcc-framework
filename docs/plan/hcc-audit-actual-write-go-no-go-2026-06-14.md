# HCC-AUDIT-ACTUAL-WRITE-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | audit-write 29/29 | auto-executor 20 files / 455 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-audit-actual-write.ts` (~270 lines) | `tests/auto-executor/hcc-audit-actual-write.test.ts` (29) | preflight | closeout | go-no-go

## What this does

`planAuditActualWrite(input)` is a pure planner. `executeAuditActualWrite(input, deps)` performs mkdir+writeFile through an injected writer dependency. The contract WRITES ONLY to repo-local `docs/audit/hcc/**` with `.md` or `.json` extension. Path guards reject `~`-prefixed targets, paths outside the allowed prefix, paths without allowed extension, `..` traversal segments, and target paths that are the bare allowed prefix (no file). Input guards require: task_id / source_plan_ref / authorization_id / planned_action_id / planned_action_kind / whitelist_action_id / dry_run_artifact_hash non-empty, runner_verdict=CONTROLLED-REAL-RUNNER-CANDIDATE. Payload shape is enforced: would_execute=false, real_execution_ready=false, unattended_ready=false, any_command_executed=false, executed_commands=[], go_no_go=NO-GO. Execution fields stay literal-false on CANDIDATE, WRITTEN, and NO-GO. NO-GO short-circuits with zero I/O. Writer failures propagate. This slice does NOT execute commands and does NOT write to `~/.hermes/**`.

## Boundary compliance

No arm/start/host imports, no submitDryRunAction, no spawn/exec, no IPC, no timer, no `~/.hermes` write, no package changes. The injected-writer pattern keeps I/O testable; production wiring uses `node:fs/promises`. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
