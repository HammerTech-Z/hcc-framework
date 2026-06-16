# HCC-TERMINAL-E2E-INTEGRATION-001 — Closeout

Date: 2026-06-16
Slice: HCC-TERMINAL-E2E-INTEGRATION-001
Branch: hermes-pro-main
Base: 5baafa5
Worktree: /Users/midoudou/hermes-pro/.claude/worktrees/hcc-terminal-plan-invoker-review

## Files Changed (4)

| File | Action | Purpose |
|------|--------|---------|
| `tests/auto-executor/hcc-terminal-e2e-integration.test.ts` | ADD | 13 integration tests covering full chain composition |
| `docs/plan/hcc-terminal-e2e-integration-preflight-2026-06-16.md` | ADD | Preflight |
| `docs/plan/hcc-terminal-e2e-integration-go-no-go-2026-06-16.md` | ADD | Gate matrix |
| `docs/closeout/hcc-terminal-e2e-integration-001-closeout-2026-06-16.md` | ADD | This file |

`src/cli/hcc-terminal-plan-invoker.ts` NOT modified. No source files modified — tests only.

## Proof: Full Chain is Mock-Only and App-Agnostic

The integration test exercises:

```
generatePlanFixture(input, path, undefined)            // pure
  -> parsePlanFixture(json)                            // pure
  -> buildProductionShellRunner({ spawn: mockSpawn })  // mockSpawn, not real
  -> buildTerminalExecutors({                          // fs = mockFs, shellRunner = above
        shellRunner,
        fs: { writeFile: vi.fn, readFile: vi.fn },
      })
  -> runTerminalPlanInvokerCli(args, undefined, () => json, executors)
                                                       // executorDeps wins
  -> FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE
```

**App-agnostic proof:**

1. `static source guard > test file does not import app boot, IPC, ...`:
   - No `from "src/main"` / `src/preload"` / `src/renderer"`
   - No `require("child_process")` / `from "child_process"`
   - No `ipcMain()` / `BrowserWindow()` / `contextBridge()` calls
   - No `setInterval()` / `submitDryRunAction()` calls
   - No `go_no_go:"GO"` / `night_run_ready:true` literals
   - No `~/.hermes` literal

2. `vi.fn()` mock spawn returns `EventEmitter` child — no real `child_process.spawn` invoked
3. `vi.fn()` mock fs uses in-memory `Map` — no real filesystem I/O
4. `vi.fn()` mock setTimeout — no real timers persist
5. `runTerminalPlanInvokerCli` called directly (not via `main()`) — CLI's `main()` is not invoked, so no `process.exit`, no `process.stdout.write`
6. No production wiring imported: no `src/main/index.ts`, no IPC handler, no scheduler hook

## Pushed

Held per standing policy. Commit hash pending.

## Remaining Gap to Hermes Pro App IPC/UI + Unattended Runtime Wiring

1. **App IPC handler** — `hcc-unattended-app-ipc-handler` must call the full chain on user-explicit trigger
2. **End-to-end smoke at runtime** — production shell runner must be wired in (this slice uses mock only)
3. **Unattended scheduler runtime** — `ready_result` injection at scheduler runtime, then call wired CLI on schedule
4. **UI surface** — no UI changes; terminal agent is the only caller
5. **Go/No-Go flip** — `go_no_go` stays `"NO-GO"` at type level; requires HCC governance decision

## Next Slice (recommended)

**HCC-TERMINAL-CLI-DEFAULT-WIRING-001** — provide a `main()` helper that accepts optional `executorDeps` + optional `realShellRunner` for production use. Optional injection keeps tests mock-only; production wires real `buildProductionShellRunner`. Still no app-boot wiring — only a CLI entrypoint that user code (future Hermes Pro pipeline) can call.
