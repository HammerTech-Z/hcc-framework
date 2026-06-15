# HCC-TERMINAL-PLAN-INVOKER-WIRING-001 — GO/NO-GO Matrix

Date: 2026-06-16
Slice: HCC-TERMINAL-PLAN-INVOKER-WIRING-001
Preflight: docs/plan/hcc-terminal-plan-invoker-wiring-preflight-2026-06-16.md

## Gate Matrix

| # | Gate | Status |
|---|------|--------|
| G1 | Typecheck passes | PENDING |
| G2 | Plan invoker tests pass | PENDING |
| G3 | Dispatch adapter tests pass | PENDING |
| G4 | Auto-executor suite no regression | PENDING |
| G5 | Safety suite passes | PENDING |
| G6 | No whitespace errors | PENDING |
| G7 | Forbidden files untouched | PENDING |
| G8 | Static source guard | PENDING |

## Runtime Behavior Gates

| # | Gate | Verified By |
|---|------|-------------|
| R1 | Real executors + file_write fixture -> CANDIDATE, writer called | Test |
| R2 | Real executors + shell_command fixture -> CANDIDATE, shell called | Test |
| R3 | Real executors + config_patch fixture -> CANDIDATE, patcher called | Test (via factory test) |
| R4 | Real executors + in_memory fixture -> CANDIDATE, no executor call | Test (via factory test) |
| R5 | No executorDeps -> no-op adapter path, dispatch never called | Test |
| R6 | Non-allowlisted shell -> DENIED, executor not called | Test |
| R7 | No-op default adapter preserved (backward compat) | Existing tests still pass |

## Final Verdict

- **GO** when all G1–G8 pass AND all R1–R7 verified
- **NO-GO** if any gate fails
