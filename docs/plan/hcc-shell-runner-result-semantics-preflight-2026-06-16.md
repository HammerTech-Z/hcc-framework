# HCC-SHELL-RUNNER-RESULT-SEMANTICS-001 — Preflight

Date: 2026-06-16
Branch: hermes-pro-main
Base: 76b4df3
Slice: HCC-SHELL-RUNNER-RESULT-SEMANTICS-001 (fix shell runner result semantics)

## 1. Goal

Fix the shell runner result semantics in `buildTerminalExecutors().shell_executor` so that timeout, non-zero exit code, or signal termination CANNOT produce `FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE`. Only `code === 0 && !timed_out && signal === null` may produce a successful dispatch.

## 2. Allowed files (8)

1. `src/shared/lib/hcc-terminal-executor-impl.ts` — post-runner check in shell_executor
2. `src/shared/lib/hcc-terminal-shell-runner.ts` — widen `ShellSpawnRunner` to include optional timed_out/signal
3. `tests/auto-executor/hcc-terminal-shell-runner.test.ts` — verify runner result shape
4. `tests/auto-executor/hcc-terminal-executor-impl.test.ts` — add 4 new semantic tests
5. `tests/auto-executor/hcc-terminal-e2e-integration.test.ts` — update timeout test, add 3 new e2e semantic tests
6. `docs/plan/hcc-shell-runner-result-semantics-preflight-2026-06-16.md` — this file
7. `docs/plan/hcc-shell-runner-result-semantics-go-no-go-2026-06-16.md` — gate matrix
8. `docs/closeout/hcc-shell-runner-result-semantics-001-closeout-2026-06-16.md` — closeout

## 3. Forbidden files (untouched)

- `src/cli/hcc-terminal-plan-invoker.ts`
- `src/main/index.ts`
- `src/preload/**`
- `src/renderer/**`
- `package.json`
- `package-lock.json`
- `docs/knowledge/vault-health-report-2026-06-12.md`
- `.wolf/memory.md`
- `.claude/settings.json`

## 4. Design

The runner returns `{ stdout, stderr, code, timed_out?, signal? }`. The executor impl, after `await shellRunner(...)`, validates:

- `result.timed_out === true` → throw `EXECUTOR_REJECTED`
- `result.signal !== null && result.signal !== undefined` → throw `EXECUTOR_REJECTED`
- `result.code !== 0` → throw `EXECUTOR_REJECTED`

Only when all three are clean does the executor return `{ command_id }`, which the dispatch adapter can then surface as `controlled_command_id`. Throwing propagates as `EXECUTOR_REJECTED` through the dispatch adapter, which then returns a typed `NO-GO` from the final dispatch.

## 5. Governance checklist

- [x] NO background timer / cron / setInterval
- [x] NO direct spawn / exec / child_process added in this slice
- [x] NO submitDryRunAction
- [x] NO bootstrap / arm / start / host imports
- [x] NO writes to ~/.hermes/**
- [x] NO automatic start on app launch
- [x] NO ipcMain / BrowserWindow / contextBridge
- [x] NO runtime go_no_go: "GO"
- [x] NO runtime night_run_ready: true
- [x] Allowlist rules unchanged
- [x] No app / IPC / scheduler / default CLI wiring added
- [x] CLI NOT modified

## 6. Gate plan

1. `npm run typecheck:node`
2. `npx vitest run tests/auto-executor/hcc-terminal-e2e-integration.test.ts`
3. `npx vitest run tests/auto-executor/hcc-terminal-shell-runner.test.ts`
4. `npx vitest run tests/auto-executor/hcc-terminal-executor-impl.test.ts`
5. `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts`
6. `npx vitest run tests/auto-executor/`
7. `npx vitest run tests/safety`
8. `git diff --check`
9. `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md .claude/settings.json`
