# HCC-TERMINAL-PLAN-INVOKER-WIRING-001 — Preflight

Date: 2026-06-16
Branch: hermes-pro-main
Base: f708de3 (origin/hermes-pro-main @ cdfb54e + plan-fixture-generator)
Slice: HCC-TERMINAL-PLAN-INVOKER-WIRING-001 (real adapter wiring for terminal plan invoker)

## 1. Goal

Wire the terminal Hermes plan invoker to a real `HCCFinalControlledRealDispatchAdapter` path. The previous slice (cdfb54e) shipped a CLI that used a no-op adapter by default. The slice before that (f708de3) shipped a fixture generator. This slice connects the two: converts a generated fixture's `dispatch_backend`/`dispatch_payload` into a real adapter backed by injected `executors.{shell_executor, writer, patcher}`.

## 2. Allowed files (9)

1. `src/cli/hcc-terminal-plan-invoker.ts` — accept optional `executorDeps`; build real adapter from fixture
2. `src/shared/lib/hcc-controlled-dispatch-adapter.ts` — fix `derivePayloadFromKind` to pass through `config_patch` payloads (surgical 6-line addition)
3. `src/shared/lib/hcc-terminal-agent-invoker.ts` — unchanged (type-only)
4. `src/shared/lib/hcc-plan-fixture-generator.ts` — add `buildDispatchAdapterFromPlanFixture` factory
5. `tests/auto-executor/hcc-terminal-plan-invoker.test.ts` — add 4 wiring tests
6. `tests/auto-executor/hcc-controlled-dispatch-adapter.test.ts` — verify no regression
7. `docs/plan/hcc-terminal-plan-invoker-wiring-preflight-2026-06-16.md` — this file
8. `docs/plan/hcc-terminal-plan-invoker-wiring-go-no-go-2026-06-16.md` — gate matrix
9. `docs/closeout/hcc-terminal-plan-invoker-wiring-001-closeout-2026-06-16.md` — closeout

## 3. Forbidden files (untouched)

- `src/main/index.ts`
- `src/preload/**`
- `src/renderer/**`
- `package.json`
- `package-lock.json`
- `docs/knowledge/vault-health-report-2026-06-12.md`
- `.wolf/memory.md`
- `.claude/settings.json`

## 4. Design

- **Pure factory** — `buildDispatchAdapterFromPlanFixture(fixture, executors, now?)` returns a fresh `HCCFinalControlledRealDispatchAdapter` closure. No I/O, no spawn, no `~/.hermes` writes.
- **Injectable executors** — caller supplies `executors.{shell_executor, writer, patcher}`. Factory wires them into the controlled dispatch adapter; executor calls remain the only execution surface.
- **Backward compatible** — CLI's no-op default path preserved. Tests that pass only `dispatchAdapter` and no `executorDeps` continue to work exactly as before.
- **4 backends** — `in_memory` / `shell_command` / `file_write` / `config_patch`. Each routes to its corresponding executor.

## 5. Governance checklist

- [x] NO background timer / cron / setInterval / setTimeout
- [x] NO direct spawn / exec / child_process
- [x] NO submitDryRunAction
- [x] NO bootstrap / arm / start / host imports
- [x] NO writes to ~/.hermes/**
- [x] NO automatic start on app launch
- [x] NO ipcMain / BrowserWindow / contextBridge
- [x] NO runtime go_no_go: "GO"
- [x] NO runtime night_run_ready: true
- [x] Real side effects only through injected executors
- [x] CLI no-op default path preserved (existing tests still pass)
- [x] static source guard: no forbidden runtime surfaces

## 6. Gate plan

1. `npm run typecheck:node`
2. `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts`
3. `npx vitest run tests/auto-executor/hcc-controlled-dispatch-adapter.test.ts`
4. `npx vitest run tests/auto-executor/`
5. `npx vitest run tests/safety`
6. `git diff --check`
7. `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md .claude/settings.json`
