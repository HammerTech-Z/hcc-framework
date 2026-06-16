# HCC-TERMINAL-E2E-INTEGRATION-001 — Preflight

Date: 2026-06-16
Branch: hermes-pro-main
Base: 5baafa5
Slice: HCC-TERMINAL-E2E-INTEGRATION-001 (end-to-end integration test for terminal chain)

## 1. Goal

Add a pure async end-to-end integration test that composes the entire terminal chain WITHOUT touching app boot, IPC, scheduler, cron, timer, auto-arm, or default CLI paths:

```
generatePlanFixture
  -> buildProductionShellRunner
  -> buildTerminalExecutors({ shellRunner })
  -> buildDispatchAdapterFromPlanFixture
  -> runTerminalPlanInvokerCli
  -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE
```

All execution surfaces remain injected. No real spawn. No real file write.

## 2. Allowed files (4 required, 4 optional)

**Required:**
1. `tests/auto-executor/hcc-terminal-e2e-integration.test.ts` — integration test
2. `docs/plan/hcc-terminal-e2e-integration-preflight-2026-06-16.md` — this file
3. `docs/plan/hcc-terminal-e2e-integration-go-no-go-2026-06-16.md` — gate matrix
4. `docs/closeout/hcc-terminal-e2e-integration-001-closeout-2026-06-16.md` — closeout

**Optional (only if needed):**
- `tests/auto-executor/hcc-terminal-plan-invoker.test.ts`
- `tests/auto-executor/hcc-terminal-shell-runner.test.ts`
- `tests/auto-executor/hcc-terminal-executor-impl.test.ts`
- `tests/auto-executor/hcc-plan-fixture-generator.test.ts`

## 3. Forbidden files (untouched)

- `src/cli/hcc-terminal-plan-invoker.ts` (NOT modified)
- `src/main/index.ts`
- `src/preload/**`
- `src/renderer/**`
- `package.json`
- `package-lock.json`
- `docs/knowledge/vault-health-report-2026-06-12.md`
- `.wolf/memory.md`
- `.claude/settings.json`

## 4. Design

The test is a pure composition. It uses:

- `vi.fn()` mock spawn that returns a fake `EventEmitter` child (so real `child_process` is never invoked)
- In-memory `Map` filesystem mock (so real `writeFile` is never invoked)
- Manual `setTimeout`/`clearTimeout` injection (so the timeout path is deterministic)

The test verifies:

- 3 allowlisted shell cases (git.status, git.diff, git.show) reach CANDIDATE
- Fixture generator output round-trips through `parsePlanFixture`
- Executor + runner remain mockable
- No real shell string execution
- No hidden file writes
- Non-allowlisted argv rejected
- Shell runner timeout fires `kill(SIGKILL)` and result is still controlled
- Static source guard verifies no new forbidden surfaces

## 5. Governance checklist

- [x] NO background timer / cron / setInterval
- [x] NO direct spawn / exec / child_process in test
- [x] NO submitDryRunAction
- [x] NO bootstrap / arm / start / host imports
- [x] NO writes to ~/.hermes/**
- [x] NO automatic start on app launch
- [x] NO ipcMain / BrowserWindow / contextBridge
- [x] NO runtime go_no_go: "GO"
- [x] NO runtime night_run_ready: true
- [x] Real subprocess execution is via injected mock (not real)
- [x] Real file writes are via injected mock (not real)
- [x] CLI NOT modified
- [x] No app boot, IPC, scheduler, cron, timer persistence, auto-arm wiring added
- [x] Test file does not import src/main, src/preload, src/renderer

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
