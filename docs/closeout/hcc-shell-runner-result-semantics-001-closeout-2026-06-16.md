# HCC-SHELL-RUNNER-RESULT-SEMANTICS-001 — Closeout

Date: 2026-06-16
Slice: HCC-SHELL-RUNNER-RESULT-SEMANTICS-001
Branch: hermes-pro-main
Base: 76b4df3
Worktree: /Users/midoudou/hermes-pro/.claude/worktrees/hcc-terminal-plan-invoker-review

## Files Changed (3)

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/lib/hcc-terminal-executor-impl.ts` | MOD | Widen `ShellSpawnRunner` type; add post-runner check in `shell_executor` |
| `tests/auto-executor/hcc-terminal-executor-impl.test.ts` | MOD | +4 new semantic tests |
| `tests/auto-executor/hcc-terminal-e2e-integration.test.ts` | MOD | Update timeout test, +3 new e2e semantic tests |
| `docs/plan/hcc-shell-runner-result-semantics-preflight-2026-06-16.md` | ADD | Preflight |
| `docs/plan/hcc-shell-runner-result-semantics-go-no-go-2026-06-16.md` | ADD | Gate matrix |
| `docs/closeout/hcc-shell-runner-result-semantics-001-closeout-2026-06-16.md` | ADD | This file |

`src/shared/lib/hcc-terminal-shell-runner.ts` was NOT modified (only type widening in executor impl). `tests/auto-executor/hcc-terminal-shell-runner.test.ts` NOT modified.

## Proof: Timeout/Non-Zero/Signal Now Produce NO-GO

The fix is in `buildTerminalExecutors().shell_executor` (executor impl):

```ts
const result = await shellRunner(match.argv);
if (result.timed_out === true) {
  throw new Error(`shell_executor: shell timed out ...`);
}
if (result.signal !== null && result.signal !== undefined) {
  throw new Error(`shell_executor: shell terminated by signal ${result.signal} ...`);
}
if (result.code !== 0) {
  throw new Error(`shell_executor: shell exited with non-zero code ${result.code} ...`);
}
```

Verified by tests:

| Test | Result |
|------|--------|
| `shell exits non-zero -> NO-GO via EXECUTOR_REJECTED, runner called once` | **PASS** |
| `shell terminated by signal -> NO-GO via EXECUTOR_REJECTED, runner called once` | **PASS** |
| `shell runner timeout -> NO-GO via EXECUTOR_REJECTED, runner kill(SIGKILL)` | **PASS** |
| `runner returns timed_out:true -> shell_executor throws` | **PASS** |
| `runner returns non-null signal -> shell_executor throws` | **PASS** |
| `runner returns non-zero code (no signal, not timed_out) -> shell_executor throws` | **PASS** |

## Proof: Exit Code 0 Still Produces CANDIDATE

`runner returns code 0 with no signal and not timed_out -> command_id returned` — **PASS**

`shell exit 0 -> CANDIDATE (regression: success path still works)` (e2e) — **PASS**

The 3 allowlisted shell cases (git.status / git.diff / git.show) in the e2e integration test still reach `FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE` because all 3 use `exitCode: 0` in their mock children.

## Gate Matrix

| # | Gate | Status |
|---|------|--------|
| G1 | `npm run typecheck:node` | **PASS** |
| G2 | e2e integration tests | **PASS** (16/16, +3 new) |
| G3 | shell runner tests | **PASS** (29/29) |
| G4 | executor impl tests | **PASS** (41/41, +4 new) |
| G5 | plan invoker tests | **PASS** (49/49) |
| G6 | `vitest run tests/auto-executor/` | **PASS** (45 files / 1080 tests) |
| G7 | `vitest run tests/safety` | **PASS** (36 files / 988 tests) |
| G8 | `git diff --check` | **PASS** |
| G9 | Forbidden files untouched | **PASS** |

## Pushed

Held per standing policy. Commit hash pending.

## Remaining Gap to Hermes Pro App IPC/UI + Unattended Runtime Wiring

1. **App IPC handler** — `hcc-unattended-app-ipc-handler` must call the full chain on user-explicit trigger
2. **Production shell wiring** — `buildProductionShellRunner` must be called with real `child_process.spawn` in production; the executor's post-runner check now ensures bad children always produce NO-GO
3. **Unattended scheduler runtime** — `ready_result` injection at scheduler runtime, then call wired CLI on schedule
4. **UI surface** — no UI changes; terminal agent is the only caller
5. **Go/No-Go flip** — `go_no_go` stays `"NO-GO"` at type level; requires HCC governance decision
