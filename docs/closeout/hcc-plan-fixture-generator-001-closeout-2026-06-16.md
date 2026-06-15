# HCC-PLAN-FIXTURE-GENERATOR-001 — Closeout

Date: 2026-06-16
Slice: HCC-PLAN-FIXTURE-GENERATOR-001
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ cdfb54e
Worktree: /Users/midoudou/hermes-pro/.claude/worktrees/hcc-terminal-plan-invoker-review

## Files Changed (5)

| File | Action | Purpose |
|------|--------|---------|
| `src/shared/lib/hcc-plan-fixture-generator.ts` | ADD | Pure async generator + builders + validator |
| `tests/auto-executor/hcc-plan-fixture-generator.test.ts` | ADD | 25+ tests covering validation, builders, generation, writer injection, interop |
| `docs/plan/hcc-plan-fixture-generator-preflight-2026-06-16.md` | ADD | Preflight doc |
| `docs/plan/hcc-plan-fixture-generator-go-no-go-2026-06-16.md` | ADD | Gate matrix |
| `docs/closeout/hcc-plan-fixture-generator-001-closeout-2026-06-16.md` | ADD | This file |

## API

```ts
import {
  generatePlanFixture,
  buildPlanFixtureJson,
  validatePlanFixtureInput,
  type HCCPlanFixtureGeneratorInput,
} from "hcc-plan-fixture-generator";

// Pure async, injectable writer.
const r = await generatePlanFixture(
  { task_id, ..., dispatch_payload, dry_run?: boolean },
  "/tmp/plan-fixture.json",
  writer,  // optional; if absent, runs in dry-run mode
);

if (r.ok) {
  // r.result.fixture_json, .fixture_path, .bytes, .go_no_go:"NO-GO", etc.
}
```

## Interop Proof

Generated JSON round-trips through the CLI's `parsePlanFixture`:

```ts
const r = await generatePlanFixture(input, "/tmp/plan.json");
const parsed = parsePlanFixture(r.result.fixture_json);
// parsed.ok === true
// parsed.fixture.task_id === "PLAN-FIX-001"
// parsed.fixture.dispatch_backend === "file_write"
```

Verified by `hcc-plan-fixture-generator.test.ts > interop` test group.

## Boundary Preservation

- `go_no_go: "NO-GO"` always (type-level + runtime)
- `night_run_ready: false` (implied by NO-GO at all layers)
- `unattended_ready: false` (implied)
- No `spawn`/`exec`/`child_process`/`setInterval`/`setTimeout`/`cron`/`ipcMain`/`BrowserWindow`/`contextBridge`/`submitDryRunAction`/`~/.hermes` in code (static source guard test)

## Remaining Gap to HCC-TERMINAL-PLAN-INVOKER-WIRING-001

1. **Real writer injection** — production wiring must supply a writer that
   actually writes to disk (e.g., `fs/promises.writeFile` wrapper). Generator
   does not call filesystem directly; only the injected writer does.

2. **Adapter wiring in CLI** — the wiring slice must:
   - Convert the generator's output into `HCCTerminalInvocationFixture`
   - Build a real `HCCFinalControlledRealDispatchAdapter` from
     `dispatch_backend` + `dispatch_payload` fields
   - Inject into `runTerminalPlanInvokerCli(..., dispatchAdapter)`

3. **End-to-end flow** — Hermes Pro pipeline must:
   - Compute 4 prior verdicts via `evaluate*` functions
   - Call `generatePlanFixture(...)` to produce JSON
   - Write JSON to a path the terminal agent can read
   - Invoke `bin/hcc-terminal-plan-invoker.mjs --plan-fixture <path> ...`

## Pushed

Held per standing policy. Commit hash pending.
