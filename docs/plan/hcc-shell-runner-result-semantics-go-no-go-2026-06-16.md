# HCC-SHELL-RUNNER-RESULT-SEMANTICS-001 — GO/NO-GO Matrix

Date: 2026-06-16
Slice: HCC-SHELL-RUNNER-RESULT-SEMANTICS-001
Preflight: docs/plan/hcc-shell-runner-result-semantics-preflight-2026-06-16.md

## Gate Matrix

| # | Gate | Status |
|---|------|--------|
| G1 | Typecheck passes | PENDING |
| G2 | e2e integration tests pass | PENDING |
| G3 | shell runner tests pass | PENDING |
| G4 | executor impl tests pass | PENDING |
| G5 | plan invoker tests pass | PENDING |
| G6 | auto-executor suite no regression | PENDING |
| G7 | safety suite passes | PENDING |
| G8 | no whitespace errors | PENDING |
| G9 | forbidden files untouched | PENDING |

## Runtime Behavior Gates (Post-Fix)

| # | Gate | Verified By |
|---|------|-------------|
| R1 | shell exit code 0 → CANDIDATE (regression) | e2e test |
| R2 | shell exit code 0 with `signal: null` and `!timed_out` → command_id returned | executor impl test |
| R3 | shell exit code 1 → NO-GO via EXECUTOR_REJECTED | e2e + executor impl tests |
| R4 | shell signal (SIGTERM) → NO-GO via EXECUTOR_REJECTED | e2e + executor impl tests |
| R5 | shell timeout → NO-GO via EXECUTOR_REJECTED, runner kill(SIGKILL) | e2e test |
| R6 | runner throws → propagates unchanged | executor impl test |
| R7 | Allowlist rules unchanged | pre-existing tests still pass |
| R8 | No app/IPC/scheduler/CLI wiring added | static source guard |

## Final Verdict

- **GO** when all G1–G9 pass AND all R1–R8 verified
- **NO-GO** if any gate fails
