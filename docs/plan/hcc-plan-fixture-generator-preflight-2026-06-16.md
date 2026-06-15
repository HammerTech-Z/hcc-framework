# HCC-PLAN-FIXTURE-GENERATOR-001 — Preflight

Date: 2026-06-16
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ cdfb54e
Slice: HCC-PLAN-FIXTURE-GENERATOR-001 (pure fixture generator for terminal plan invoker)

## 1. Goal

Add a pure async fixture generator that serializes the four prior HCC verdict
objects plus `dispatch_backend`/`dispatch_payload` into the exact JSON shape
consumed by `bin/hcc-terminal-plan-invoker.mjs` /
`src/cli/hcc-terminal-plan-invoker.ts::parsePlanFixture`.

The generator is the upstream dependency for the future wiring slice
(HCC-TERMINAL-PLAN-INVOKER-WIRING-001) — without it, the terminal CLI has
nothing to consume at runtime.

## 2. Allowed files (5)

1. `src/shared/lib/hcc-plan-fixture-generator.ts` — generator source
2. `tests/auto-executor/hcc-plan-fixture-generator.test.ts` — generator tests
3. `docs/plan/hcc-plan-fixture-generator-preflight-2026-06-16.md` — this file
4. `docs/plan/hcc-plan-fixture-generator-go-no-go-2026-06-16.md` — per-gate matrix
5. `docs/closeout/hcc-plan-fixture-generator-001-closeout-2026-06-16.md` — closeout

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

- **Pure async function** — `generatePlanFixture(input, fixture_path, writer?)`
- **Injectable writer** — production wiring supplies real writer; tests inject mock; no writer → dry-run mode
- **No direct I/O** — no `writeFileSync`, no `~/.hermes/**` writes
- **Identity preservation** — all 9 identity fields passed through unchanged
- **No mutation** — verdict objects deep-equal before/after
- **Output JSON shape** — matches `HCCTerminalPlanFixture` exactly
- **Deterministic metadata** — `schema_version`, `fixture_path`, `bytes`, `task_id`, `planned_action_id`, `go_no_go:"NO-GO"`, `dry_run`, `wrote_to_disk`

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
- [x] Real side effects only through injected `writer`
- [x] Pure function — no side effects except via injected `writer`
- [x] Output JSON shape matches CLI's `parsePlanFixture` (verified by interop test)

## 6. Gate plan

1. `npm run typecheck:node`
2. `npx vitest run tests/auto-executor/hcc-plan-fixture-generator.test.ts`
3. `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts`
4. `npx vitest run tests/auto-executor/`
5. `npx vitest run tests/safety`
6. `git diff --check`
7. `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md .claude/settings.json`
