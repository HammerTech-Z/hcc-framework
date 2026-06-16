# HCC-TERMINAL-E2E-INTEGRATION-001 — GO/NO-GO Matrix

Date: 2026-06-16
Slice: HCC-TERMINAL-E2E-INTEGRATION-001
Preflight: docs/plan/hcc-terminal-e2e-integration-preflight-2026-06-16.md

## Gate Matrix

| # | Gate | Status |
|---|------|--------|
| G1 | Typecheck passes | PENDING |
| G2 | e2e integration tests pass | PENDING |
| G3 | shell runner regression | PENDING |
| G4 | executor impl regression | PENDING |
| G5 | plan invoker regression | PENDING |
| G6 | auto-executor suite no regression | PENDING |
| G7 | safety suite passes | PENDING |
| G8 | no whitespace errors | PENDING |
| G9 | forbidden files untouched | PENDING |

## Runtime Behavior Gates

| # | Gate | Verified By |
|---|------|-------------|
| R1 | Full chain returns CANDIDATE for git.status | Test |
| R2 | Full chain returns CANDIDATE for git.diff | Test |
| R3 | Full chain returns CANDIDATE for git.show --stat HEAD | Test |
| R4 | Generator output is accepted by parsePlanFixture | Test |
| R5 | Generator output preserves all 4 prior verdict objects | Test |
| R6 | validatePlanFixtureInput accepts the generator input | Test |
| R7 | shellRunner mock is the only shell surface (no real spawn) | Test |
| R8 | fs mock is the only filesystem surface (no real write) | Test |
| R9 | Non-allowlisted argv -> NO-GO via DENIED, runner not called | Test |
| R10 | Free-form shell string -> NO-GO, runner not called | Test |
| R11 | Shell runner timeout -> kill(SIGKILL), result still controlled | Test |
| R12 | Test file does not import src/main/preload/renderer | Test |
| R13 | Test file does not call forbidden runtime APIs | Test |

## Final Verdict

- **GO** when all G1–G9 pass AND all R1–R13 verified
- **NO-GO** if any gate fails
