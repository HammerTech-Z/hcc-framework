# HCC-TERMINAL-HERMES-PLAN-INVOKER-001 — Closeout

Date: 2026-06-15
Slice: HCC-TERMINAL-HERMES-PLAN-INVOKER-001
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 740b4f4
Commit: held (standing policy: no commit without explicit user approval)
Worktree: /Users/midoudou/hermes-pro

## Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/cli/hcc-terminal-plan-invoker.ts` | ADD | ~340 |
| `bin/hcc-terminal-plan-invoker.mjs` | ADD | ~75 |
| `tests/auto-executor/hcc-terminal-plan-invoker.test.ts` | ADD | ~430 |
| `docs/plan/hcc-terminal-plan-invoker-preflight-2026-06-15.md` | ADD | ~120 |
| `docs/plan/hcc-terminal-plan-invoker-go-no-go-2026-06-15.md` | ADD | ~50 |
| `docs/closeout/hcc-terminal-plan-invoker-001-closeout-2026-06-15.md` | ADD | this file |
| `bin/` | ADD (dir) | — |

## Gate Matrix (Final)

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G1 | `npm run typecheck:node` | PASS | no errors |
| G2 | `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts` | PASS | 39/39 tests pass |
| G3 | `npx vitest run tests/auto-executor/` | PASS | 34 files / 863 tests pass |
| G4 | `npx vitest run tests/safety` | PASS | 36 files / 988 tests pass |
| G5 | `git diff --check` | PASS | no whitespace errors |
| G6 | Forbidden files untouched by this slice | PASS | only pre-existing changes in working tree; no new modifications |
| G7 | Static source guard (forbidden surfaces) | PASS | test strips comments, verifies no forbidden strings |

## Forbidden Files Verification

Pre-existing working tree modifications to the following files are from earlier slices, NOT from this slice:
- `.wolf/memory.md` (M) — pre-existing
- `docs/knowledge/vault-health-report-2026-06-12.md` (M) — pre-existing
- `src/renderer/**` (M/D) — pre-existing

This slice added only new files (`??` in git status). No existing files were modified.

## Success JSON Shape

```json
{
  "schema_version": "1.0.0",
  "verdict": "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE",
  "reason": "",
  "terminal_agent_session_id": "term-sess-001",
  "terminal_invocation_id": "term-inv-001",
  "task_id": "PLAN-INV-001",
  "planned_action_id": "act-inv-001",
  "unattended_ready": false,
  "night_run_ready": false,
  "go_no_go": "NO-GO"
}
```

## NO-GO JSON Shape

```json
{
  "schema_version": "1.0.0",
  "verdict": "NO-GO",
  "reason": "missing or empty --plan-fixture",
  "terminal_agent_session_id": "",
  "terminal_invocation_id": "",
  "task_id": "",
  "planned_action_id": "",
  "unattended_ready": false,
  "night_run_ready": false,
  "go_no_go": "NO-GO"
}
```

## Example Terminal Command

```bash
# Build first:
npx esbuild src/cli/hcc-terminal-plan-invoker.ts --bundle --format=esm --platform=node --target=node20 --outfile=out/cli/hcc-terminal-plan-invoker.mjs

# Then invoke:
node bin/hcc-terminal-plan-invoker.mjs \
  --plan-fixture /tmp/hermes-plan-fixture.json \
  --terminal-agent-session-id "term-sess-$(uuidgen)" \
  --terminal-invocation-id "term-inv-$(uuidgen)" \
  --explicit-user-trigger-token "user-trigger-$(uuidgen)" \
  --feature-flag-enabled
```

## Remaining Gap to Terminal Hermes Agent Usage

1. **Adapter wiring**: The CLI uses a no-op adapter. To reach real dispatch,
   a production wiring slice must inject a real
   `HCCFinalControlledRealDispatchAdapter` backed by actual executors.

2. **Plan fixture generation**: The CLI reads a pre-built fixture JSON.
   The Hermes Pro pipeline must produce this fixture — computing the 4
   prior verdicts (authorization, runner, audit, rollback), packaging
   them into the fixture, and writing it to a path the terminal agent
   can read.

3. **Terminal Hermes agent integration**: The terminal Hermes agent
   (which lives outside this repo) must be wired to call this CLI with
   the correct identity fields and fixture path. The agent is
   responsible for minting `terminal_agent_session_id` and
   `terminal_invocation_id`, and for presenting the
   `explicit_user_trigger_token` to the user.

4. **Real executor injection**: The `dispatch_adapter` in the fixture
   chain must be backed by real `shell_executor`, `writer`, and
   `patcher` implementations. The adapter library
   (`hcc-controlled-dispatch-adapter.ts`) already supports this; only
   the wiring is missing.

5. **Go/No-Go flip**: Even on success, `go_no_go` remains `"NO-GO"` at
   the type level. The final approval to flip this requires an explicit
   HCC governance decision — not a code change.

## Pushed

NO — push held per standing policy.
