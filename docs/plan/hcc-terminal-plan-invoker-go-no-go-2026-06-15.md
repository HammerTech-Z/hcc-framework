# HCC-TERMINAL-HERMES-PLAN-INVOKER-001 — GO/NO-GO Matrix

Date: 2026-06-15
Slice: HCC-TERMINAL-HERMES-PLAN-INVOKER-001
Preflight: docs/plan/hcc-terminal-plan-invoker-preflight-2026-06-15.md

## Gate Matrix

| # | Gate | Status | Evidence |
|---|------|--------|----------|
| G1 | Typecheck passes | PENDING | `npm run typecheck:node` |
| G2 | Slice tests pass | PENDING | `npx vitest run tests/auto-executor/hcc-terminal-plan-invoker.test.ts` |
| G3 | Auto-executor suite no regression | PENDING | `npx vitest run tests/auto-executor/` |
| G4 | Safety suite passes | PENDING | `npx vitest run tests/safety` |
| G5 | No whitespace errors | PENDING | `git diff --check` |
| G6 | Forbidden files untouched | PENDING | `git diff --name-status -- src/main/index.ts src/preload src/renderer package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` |
| G7 | Static source guard: no forbidden surfaces | PENDING | Test strips comments, scans for spawn/exec/child_process/setInterval/setTimeout/cron/auto-arm/ipcMain/BrowserWindow/contextBridge/go_no_go:"GO"/night_run_ready:true/submitDryRunAction/~/.hermes |

## Runtime Behavior Gates

| # | Gate | Required | Verified By |
|---|------|----------|-------------|
| R1 | Missing plan-fixture → NO-GO + exit 2 | YES | Test |
| R2 | Missing explicit-user-trigger-token → NO-GO + exit 2 | YES | Test |
| R3 | Malformed JSON fixture → NO-GO + exit 2 | YES | Test |
| R4 | Valid fixture + injected adapter → FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE + exit 0 | YES | Test |
| R5 | dispatch_adapter.dispatch called exactly once | YES | Test |
| R6 | `unattended_ready: false` preserved | YES | Test |
| R7 | `night_run_ready: false` preserved | YES | Test |
| R8 | `go_no_go: "NO-GO"` preserved | YES | Test |
| R9 | terminal_agent_session_id preserved | YES | Test |
| R10 | terminal_invocation_id preserved | YES | Test |
| R11 | Bin wrapper missing bundle → typed NO-GO + exit 2 | YES | Manual / integration |
| R12 | No spawn/exec/child_process in source | YES | Static source guard test |
| R13 | No setInterval/setTimeout/cron in source | YES | Static source guard test |

## Final Verdict

- **GO** when all G1–G7 pass AND all R1–R13 verified
- **NO-GO** if any gate fails
