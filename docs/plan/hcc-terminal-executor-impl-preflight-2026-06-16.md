# HCC-TERMINAL-EXECUTOR-IMPL-001 — Preflight

Date: 2026-06-16
Branch: hermes-pro-main
Base: 9a51cac
Slice: HCC-TERMINAL-EXECUTOR-IMPL-001 (production executor implementations for terminal plan invoker)

## 1. Goal

Add production implementations of the 3 executors that the wiring slice (9a51cac) accepts as `executorDeps`:
- `shell_executor` — strict allowlist-gated argv runner
- `writer` — repo-local path-gated file writer
- `patcher` — locked-path-gated structured JSON patcher

This is the first slice that may introduce a real shell execution surface. It MUST be:
- Isolated (factory-only; no global state)
- Injectable (callers supply `shellRunner` / `fs`; defaults to no-spawn / fs/promises)
- Disabled by default (`shell_executor` throws unless a `shellRunner` is explicitly injected)
- Not wired to app boot, IPC, scheduler, cron, timer, or auto-arm

## 2. Allowed files (5 required, 2 optional)

**Required:**
1. `src/shared/lib/hcc-terminal-executor-impl.ts` — factory source
2. `tests/auto-executor/hcc-terminal-executor-impl.test.ts` — factory tests
3. `docs/plan/hcc-terminal-executor-impl-preflight-2026-06-16.md` — this file
4. `docs/plan/hcc-terminal-executor-impl-go-no-go-2026-06-16.md` — gate matrix
5. `docs/closeout/hcc-terminal-executor-impl-001-closeout-2026-06-16.md` — closeout

**Optional (only if needed):**
- `src/shared/lib/hcc-controlled-dispatch-adapter.ts`
- `tests/auto-executor/hcc-controlled-dispatch-adapter.test.ts`

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

### Allowlist
The shell executor accepts ONLY structured argv from `HCC_DISPATCH_SHELL_ALLOWLIST` (re-exported from `hcc-controlled-dispatch-adapter.ts`):
- `git.status` — `["git", "status"]`
- `git.diff` — `["git", "diff"]`
- `git.show` — `["git", "show", "--stat", "HEAD"]`

Free-form shell strings (e.g. `"echo hi; rm -rf /"`) are NEVER accepted — the runner is only invoked if argv matches an allowlist entry EXACTLY.

### Path gate
Writer + patcher accept ONLY:
- Relative paths under `docs/`, `src/`, or `tests/`
- Absolute paths inside `repoRoot`
- Reject: paths starting with `~`, traversal (`..`), windows-absolute (`C:\...`), non-allowed extensions, locked paths

Locked paths: `src/main/index.ts`, `package.json`, `package-lock.json`, `docs/knowledge/vault-health-report-2026-06-12.md`, `.claude/settings.json`, `.wolf/memory.md`.

### Default-disabled
`shell_executor` is **disabled by default** — calling it without an injected `shellRunner` throws `"shell_executor disabled: no spawn runner injected"`. This enforces the "no real subprocess in tests" property.

### Injectable boundaries
- `shellRunner` — production wiring maps to `child_process.spawn`; tests inject a mock
- `fs` — defaults to `fs/promises.{writeFile, readFile}`; tests inject a mock
- `now` — defaults to `() => new Date().toISOString()`; tests inject a fixed clock

## 5. Governance checklist

- [x] NO background timer / cron / setInterval / setTimeout
- [x] NO direct spawn / exec / child_process in this file
- [x] NO submitDryRunAction
- [x] NO bootstrap / arm / start / host imports
- [x] NO writes to ~/.hermes/**
- [x] NO automatic start on app launch
- [x] NO ipcMain / BrowserWindow / contextBridge
- [x] NO runtime go_no_go: "GO"
- [x] NO runtime night_run_ready: true
- [x] NO runtime unattended_ready: true
- [x] Real side effects only through injected `shellRunner` / `fs`
- [x] shell_executor disabled by default (no runner = throws)
- [x] shell_executor accepts only structured allowlist argv
- [x] writer / patcher reject traversal, absolute-outside-repo, ~ paths
- [x] writer / patcher reject locked paths
- [x] CLI NOT modified
- [x] No app boot, IPC, scheduler, cron, timer, auto-arm wiring added

## 6. Gate plan

1. `npm run typecheck:node`
2. `npx vitest run tests/auto-executor/hcc-terminal-executor-impl.test.ts`
3. `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts`
4. `npx vitest run tests/auto-executor/hcc-controlled-dispatch-adapter.test.ts`
5. `npx vitest run tests/auto-executor/`
6. `npx vitest run tests/safety`
7. `git diff --check`
8. `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md .claude/settings.json`
