# HCC-TERMINAL-EXECUTOR-IMPL-001 — Closeout

Date: 2026-06-16
Slice: HCC-TERMINAL-EXECUTOR-IMPL-001
Branch: hermes-pro-main
Base: 9a51cac
Worktree: /Users/midoudou/hermes-pro/.claude/worktrees/hcc-terminal-plan-invoker-review

## Files Changed (3)

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/lib/hcc-terminal-executor-impl.ts` | ADD | Factory: buildTerminalExecutors() returns shell_executor + writer + patcher |
| `tests/auto-executor/hcc-terminal-executor-impl.test.ts` | ADD | 37 tests covering allowlist, path gates, factory, end-to-end, static guard |
| `docs/plan/hcc-terminal-executor-impl-preflight-2026-06-16.md` | ADD | Preflight |
| `docs/plan/hcc-terminal-executor-impl-go-no-go-2026-06-16.md` | ADD | Gate matrix |
| `docs/closeout/hcc-terminal-executor-impl-001-closeout-2026-06-16.md` | ADD | This file |

`src/cli/hcc-terminal-plan-invoker.ts` NOT modified. `src/main/index.ts` / `src/preload/**` / `src/renderer/**` / `package.json` / `package-lock.json` NOT modified.

## Allowlist Rules

```
1. git.status  -> ["git", "status"]
2. git.diff    -> ["git", "diff"]
3. git.show    -> ["git", "show", "--stat", "HEAD"]
```

Re-exported from `HCC_DISPATCH_SHELL_ALLOWLIST` (the slice-local source-of-truth). `command_id` and `argv` must match an entry EXACTLY. Free-form shell strings rejected before runner call.

## No-Auto-Start Proof

The factory is a pure function:
- `buildTerminalExecutors({ repoRoot, shellRunner?, fs?, now? })` — returns `{ shell_executor, writer, patcher }`
- It does NOT register IPC, scheduler, timer, cron, auto-arm, or any lifecycle hook
- It does NOT call `child_process` directly — `shellRunner` is the only spawn surface
- It does NOT modify any state outside the function's return value
- The default `shell_executor` is **disabled** (throws on any call when no `shellRunner` injected)
- The CLI (`src/cli/hcc-terminal-plan-invoker.ts`) does NOT import this module; the wiring slice only imports it indirectly through controlled dispatch adapter when `executorDeps` is passed
- Tests verify the source has no `child_process` import; static source guard confirms

## API

```ts
import { buildTerminalExecutors } from "hcc-terminal-executor-impl";

// Production wiring (future slice):
const execs = buildTerminalExecutors({
  repoRoot: "/path/to/repo",
  shellRunner: async (argv) => {
    // Maps to child_process.spawn. Caller-supplied.
    const { spawn } = await import("node:child_process");
    return new Promise((resolve, reject) => {
      const child = spawn(argv[0], argv.slice(1));
      child.on("close", (code) => resolve({ stdout: "", stderr: "", code: code ?? 0 }));
      child.on("error", reject);
    });
  },
});

// Use:
await execs.shell_executor("git.status", ["git", "status"]);
await execs.writer("src/notes/test.md", "hello");
await execs.patcher("docs/config.json", [{ key: "k", value: "v" }]);
```

## Boundary Preservation

- `go_no_go: "NO-GO"` always (type-level + runtime)
- `night_run_ready: false` (implied)
- `unattended_ready: false` (implied)
- No `child_process` import in this file
- No `setInterval` / `setTimeout` / `cron` / `ipcMain` / `BrowserWindow` / `contextBridge` / `submitDryRunAction` / `~/.hermes` writes in code (static source guard)

## Pushed

Held per standing policy. Commit hash pending.
