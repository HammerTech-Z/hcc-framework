# HCC-TERMINAL-PLAN-INVOKER-WIRING-001 — Closeout

Date: 2026-06-16
Slice: HCC-TERMINAL-PLAN-INVOKER-WIRING-001
Branch: hermes-pro-main
Base: f708de3
Worktree: /Users/midoudou/hermes-pro/.claude/worktrees/hcc-terminal-plan-invoker-review

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `src/cli/hcc-terminal-plan-invoker.ts` | MOD | Accept optional `executorDeps`; build real adapter from fixture when provided |
| `src/shared/lib/hcc-controlled-dispatch-adapter.ts` | MOD (surgical) | `derivePayloadFromKind` now passes through `config_patch` payloads (6 lines added) |
| `src/shared/lib/hcc-plan-fixture-generator.ts` | MOD | Added `buildDispatchAdapterFromPlanFixture` pure factory |
| `src/shared/lib/hcc-terminal-agent-invoker.ts` | NONE | Type-only reference |
| `tests/auto-executor/hcc-terminal-plan-invoker.test.ts` | MOD | +4 wiring tests |
| `tests/auto-executor/hcc-controlled-dispatch-adapter.test.ts` | NONE | Verified no regression via G3 |
| `docs/plan/hcc-terminal-plan-invoker-wiring-preflight-2026-06-16.md` | ADD | Preflight |
| `docs/plan/hcc-terminal-plan-invoker-wiring-go-no-go-2026-06-16.md` | ADD | Gate matrix |
| `docs/closeout/hcc-terminal-plan-invoker-wiring-001-closeout-2026-06-16.md` | ADD | This file |

## API

```ts
// Generator (pure factory):
import { buildDispatchAdapterFromPlanFixture } from "hcc-plan-fixture-generator";

const adapter = buildDispatchAdapterFromPlanFixture(
  { task_id, planned_action_id, dispatch_backend, dispatch_payload },
  { shell_executor, writer, patcher },
  () => new Date().toISOString(),  // optional
);

// CLI (production wiring):
import { runTerminalPlanInvokerCli } from "hcc-terminal-plan-invoker";

await runTerminalPlanInvokerCli(
  args,
  defaultNoOpAdapter,  // overridden by executorDeps
  readFixture,
  { shell_executor, writer, patcher },  // <- new
);
```

## Interop Proof

Generator output still flows into CLI's `parsePlanFixture` unchanged (factory uses parsed fixture fields directly). Wiring path: `parsePlanFixture(fixture_json)` -> `buildDispatchAdapterFromPlanFixture(...)` -> `invokeTerminalAgentControlledRealDispatch(...)`.

Verified by:
- `hcc-plan-fixture-generator.test.ts > parsePlanFixture interop` (3 tests, all PASS)
- `hcc-plan-fixture-generator.test.ts > buildDispatchAdapterFromPlanFixture` (6 tests, all PASS)
- `hcc-terminal-plan-invoker.test.ts > real adapter wiring` (4 tests, all PASS)

## Boundary Preservation

- `go_no_go: "NO-GO"` always (type-level + runtime)
- `night_run_ready: false` (implied)
- `unattended_ready: false` (implied)
- No `spawn`/`exec`/`child_process`/`setInterval`/`setTimeout`/`cron`/`ipcMain`/`BrowserWindow`/`contextBridge`/`submitDryRunAction`/`~/.hermes` in code (static source guard test)

## Pushed

Held per standing policy. Commit hash pending.
