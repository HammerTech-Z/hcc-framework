# HCC-TERMINAL-PRODUCTION-SHELL-RUNNER-001 — Closeout

Date: 2026-06-16
Slice: HCC-TERMINAL-PRODUCTION-SHELL-RUNNER-001
Branch: hermes-pro-main
Base: d276258
Worktree: /Users/midoudou/hermes-pro/.claude/worktrees/hcc-terminal-plan-invoker-review

## Files Changed (3)

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/lib/hcc-terminal-shell-runner.ts` | ADD | Production shell runner (child_process.spawn) |
| `tests/auto-executor/hcc-terminal-shell-runner.test.ts` | ADD | 29 tests covering allowlist, timeout, cwd, env, capture, static guard |
| `docs/plan/hcc-terminal-shell-runner-preflight-2026-06-16.md` | ADD | Preflight |
| `docs/plan/hcc-terminal-shell-runner-go-no-go-2026-06-16.md` | ADD | Gate matrix |
| `docs/closeout/hcc-terminal-shell-runner-001-closeout-2026-06-16.md` | ADD | This file |

`src/cli/hcc-terminal-plan-invoker.ts` NOT modified. Optional files NOT modified.

## Exact Allowlist, Timeout, cwd, env Rules

### Allowlist (re-validated defensively)
```
git.status  -> ["git", "status"]
git.diff    -> ["git", "diff"]
git.show    -> ["git", "show", "--stat", "HEAD"]
```

### Timeout
- Default: `HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS = 30_000` (30s)
- On timeout: `child.kill("SIGKILL")`, resolve `{ code: -1, timed_out: true, signal: "SIGKILL" }`
- Per-invocation only (no persistent timer / setInterval / cron)

### cwd
- Must be absolute path inside `repoRoot`
- Defaults to `repoRoot`
- Validated at factory construction; throws if outside

### env Whitelist
```
HCC_SHELL_RUNNER_ENV_WHITELIST = ["PATH"]
```
- Only `PATH` is forwarded to the child
- All other `process.env` keys dropped
- Empty / undefined values dropped

### Spawn opts (always)
- `shell: false` (NEVER pass argv through a shell)
- `windowsHide: true`
- `stdio: ["ignore", "pipe", "pipe"]`

### Output cap
- `HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES = 1_048_576` (1 MiB) per stream
- Truncation marker: `\n[truncated]`

## Proof: spawn Exists Only in This Module

The static source guard test (`hcc-terminal-shell-runner.test.ts > static source guard`) reads `src/shared/lib/{executor-impl, controlled-dispatch-adapter, plan-fixture-generator}.ts` and `src/cli/hcc-terminal-plan-invoker.ts` and asserts:

```ts
expect(src).not.toMatch(/from\s+["']node:child_process["']/);
expect(src).not.toMatch(/from\s+["']child_process["']/);
expect(src).not.toMatch(/\bspawn\s*\(/);
```

All 4 sibling modules pass. The only file with `node:child_process` is `src/shared/lib/hcc-terminal-shell-runner.ts`.

Additionally, the runner module's own static guard strips comments and verifies no `ipcMain` / `BrowserWindow` / `contextBridge` / `setInterval` / `auto-arm` / `go_no_go:"GO"` / `night_run_ready:true` in the source.

## API

```ts
import { buildProductionShellRunner } from "hcc-terminal-shell-runner";

const runner = buildProductionShellRunner({
  repoRoot: "/path/to/repo",
  // cwd: undefined, // defaults to repoRoot
  // timeoutMs: 30_000, // default
});

// Inject into the executor factory:
const execs = buildTerminalExecutors({
  repoRoot: "/path/to/repo",
  shellRunner: runner,
});
```

## Pushed

Held per standing policy. Commit hash pending.

## Remaining Gap to Hermes Pro App IPC/UI + Unattended Runtime Wiring

1. **Hermes Pro app IPC handler** — `hcc-unattended-app-ipc-handler` must call `buildProductionShellRunner` + `buildTerminalExecutors` + `buildDispatchAdapterFromPlanFixture` on user-explicit trigger
2. **End-to-end smoke** — pipeline must compute 4 prior verdicts → call `generatePlanFixture` → call `runTerminalPlanInvokerCli` with `executorDeps` from `buildTerminalExecutors`
3. **Unattended scheduler runtime** — inject `ready_result` at scheduler runtime, then call the wired CLI on schedule
4. **UI surface** — no UI changes; terminal agent is the only caller
5. **Go/No-Go flip** — `go_no_go` stays `"NO-GO"` at type level; requires HCC governance decision
