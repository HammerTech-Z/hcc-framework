# HCC-TERMINAL-PRODUCTION-SHELL-RUNNER-001 — Preflight

Date: 2026-06-16
Branch: hermes-pro-main
Base: d276258
Slice: HCC-TERMINAL-PRODUCTION-SHELL-RUNNER-001 (production shell runner using child_process.spawn)

## 1. Goal

Implement the standalone production shell runner that maps to `child_process.spawn`. The runner is the ONLY module in the HCC terminal stack that may import `node:child_process`. It is consumed by `hcc-terminal-executor-impl.ts` via the `ShellSpawnRunner` injection point.

## 2. Allowed files (5 required, 2 optional)

**Required:**
1. `src/shared/lib/hcc-terminal-shell-runner.ts` — runner source
2. `tests/auto-executor/hcc-terminal-shell-runner.test.ts` — runner tests
3. `docs/plan/hcc-terminal-shell-runner-preflight-2026-06-16.md` — this file
4. `docs/plan/hcc-terminal-shell-runner-go-no-go-2026-06-16.md` — gate matrix
5. `docs/closeout/hcc-terminal-shell-runner-001-closeout-2026-06-16.md` — closeout

**Optional (only if needed):**
- `src/shared/lib/hcc-terminal-executor-impl.ts`
- `tests/auto-executor/hcc-terminal-executor-impl.test.ts`

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

### Allowlist (re-validated defensively)
The runner re-checks argv against `HCC_DISPATCH_SHELL_ALLOWLIST`:
- `git.status` -> `["git", "status"]`
- `git.diff` -> `["git", "diff"]`
- `git.show` -> `["git", "show", "--stat", "HEAD"]`

The check is defensive (the executor impl already enforces it). The runner never accepts free-form shell strings.

### Timeout
- Default: 30,000ms (`HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS`)
- On timeout: `child.kill("SIGKILL")` and resolve with `timed_out: true, code: -1, signal: "SIGKILL"`
- Per-invocation only (no persistent timer / cron / setInterval)

### cwd
- Must be inside `repoRoot`
- Defaults to `repoRoot`
- Validated at factory construction time

### env
- Whitelist: `["PATH"]` (`HCC_SHELL_RUNNER_ENV_WHITELIST`)
- All other `process.env` keys dropped
- Empty / undefined values dropped

### Output capture
- stdout + stderr: `HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES` (1 MiB) per stream
- Truncation marker: `\n[truncated]` appended when limit exceeded
- Encoding: utf-8

### Spawn opts (enforced)
- `shell: false` — NEVER pass argv through a shell
- `windowsHide: true`
- `stdio: ["ignore", "pipe", "pipe"]`

## 5. Governance checklist

- [x] NO background timer / cron / setInterval (timeout is per-invocation only)
- [x] NO direct spawn / exec / child_process in other modules
- [x] NO submitDryRunAction
- [x] NO bootstrap / arm / start / host imports
- [x] NO writes to ~/.hermes/**
- [x] NO automatic start on app launch
- [x] NO ipcMain / BrowserWindow / contextBridge
- [x] NO runtime go_no_go: "GO"
- [x] NO runtime night_run_ready: true
- [x] Real side effects only through injected `spawn` (production wires `child_process.spawn`)
- [x] Free-form shell strings rejected (allowlist re-validated)
- [x] CLI NOT modified
- [x] No app boot, IPC, scheduler, cron, timer persistence, auto-arm wiring added
- [x] spawn is ONLY in this module (static guard test confirms)

## 6. Gate plan

1. `npm run typecheck:node`
2. `npx vitest run tests/auto-executor/hcc-terminal-shell-runner.test.ts`
3. `npx vitest run tests/auto-executor/hcc-terminal-executor-impl.test.ts`
4. `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts`
5. `npx vitest run tests/auto-executor/`
6. `npx vitest run tests/safety`
7. `git diff --check`
8. `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md .claude/settings.json`
