# HCC-TERMINAL-PRODUCTION-SHELL-RUNNER-001 — GO/NO-GO Matrix

Date: 2026-06-16
Slice: HCC-TERMINAL-PRODUCTION-SHELL-RUNNER-001
Preflight: docs/plan/hcc-terminal-shell-runner-preflight-2026-06-16.md

## Gate Matrix

| # | Gate | Status |
|---|------|--------|
| G1 | Typecheck passes | PENDING |
| G2 | Shell runner tests pass | PENDING |
| G3 | Executor impl tests pass (regression) | PENDING |
| G4 | Plan invoker tests pass (regression) | PENDING |
| G5 | Auto-executor suite no regression | PENDING |
| G6 | Safety suite passes | PENDING |
| G7 | No whitespace errors | PENDING |
| G8 | Forbidden files untouched | PENDING |
| G9 | Static guard: spawn ONLY in this module | PENDING |

## Runtime Behavior Gates

| # | Gate | Verified By |
|---|------|-------------|
| R1 | validateAllowlistedArgv rejects free-form shell strings | Test |
| R2 | validateAllowlistedArgv rejects non-allowlisted argv | Test |
| R3 | validateAllowlistedArgv accepts all 3 allowlist entries | Test |
| R4 | projectWhitelistedEnv forwards only whitelisted keys | Test |
| R5 | Factory rejects cwd outside repoRoot | Test |
| R6 | Factory rejects non-positive timeoutMs | Test |
| R7 | Allowlisted argv -> spawn called with EXACTLY the allowlist argv | Test |
| R8 | Non-allowlisted argv -> throws before spawn | Test |
| R9 | Empty argv -> throws before spawn | Test |
| R10 | stdout + stderr captured | Test |
| R11 | Non-zero exit code captured | Test |
| R12 | SIGTERM signal captured | Test |
| R13 | Error event -> rejection | Test |
| R14 | stdout / stderr truncated beyond max bytes | 2 Tests |
| R15 | Timeout -> kill(SIGKILL) and timed_out=true | Test |
| R16 | Spawn opts: cwd, shell=false, windowsHide, stdio | 2 Tests |
| R17 | Env contains only whitelisted keys | Test |
| R18 | Static guard: spawn only in this module | Test |
| R19 | Static guard: no IPC / setInterval / auto-arm in this module | Test |

## Final Verdict

- **GO** when all G1–G9 pass AND all R1–R19 verified
- **NO-GO** if any gate fails
