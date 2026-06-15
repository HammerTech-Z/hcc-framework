# HCC-TERMINAL-EXECUTOR-IMPL-001 — GO/NO-GO Matrix

Date: 2026-06-16
Slice: HCC-TERMINAL-EXECUTOR-IMPL-001
Preflight: docs/plan/hcc-terminal-executor-impl-preflight-2026-06-16.md

## Gate Matrix

| # | Gate | Status |
|---|------|--------|
| G1 | Typecheck passes | PENDING |
| G2 | Executor impl tests pass | PENDING |
| G3 | Plan invoker tests pass (regression) | PENDING |
| G4 | Dispatch adapter tests pass (regression) | PENDING |
| G5 | Auto-executor suite no regression | PENDING |
| G6 | Safety suite passes | PENDING |
| G7 | No whitespace errors | PENDING |
| G8 | Forbidden files untouched | PENDING |
| G9 | Static source guard: no child_process import, no forbidden surfaces | PENDING |

## Runtime Behavior Gates

| # | Gate | Verified By |
|---|------|-------------|
| R1 | shell_executor rejects calls when no runner injected | Test |
| R2 | shell_executor accepts all 3 allowlist entries | 3 Tests |
| R3 | shell_executor rejects non-allowlisted argv BEFORE runner call | Test |
| R4 | shell_executor rejects free-form shell strings | Test |
| R5 | shell_executor rejects command_id mismatch | Test |
| R6 | shell_executor rejects empty / non-string argv | 2 Tests |
| R7 | shell_executor propagates runner throws | Test |
| R8 | writer accepts repo-local safe paths | Test |
| R9 | writer rejects path traversal (`..`) | Test |
| R10 | writer rejects absolute paths outside repo | Test |
| R11 | writer rejects `~` paths | Test |
| R12 | writer rejects disallowed extensions | Test |
| R13 | writer rejects locked paths (incl. `docs/knowledge/vault-health-report-2026-06-12.md`) | 2 Tests |
| R14 | writer rejects relative paths outside allowed prefixes | Test |
| R15 | patcher reads, merges, writes JSON | Test |
| R16 | patcher on missing file starts fresh | Test |
| R17 | patcher rejects locked paths | Test |
| R18 | patcher rejects non-array / empty / non-string-key patches | 3 Tests |
| R19 | patcher rejects `~` paths | Test |
| R20 | Factory never throws on construction | Test |
| R21 | Factory returns 3 keys (shell_executor, writer, patcher) | Test |
| R22 | End-to-end: dispatch adapter routes file_write to writer | Test |
| R23 | Static guard: source does NOT import child_process | Test |
| R24 | Static guard: source has no forbidden runtime surfaces | Test |
| R25 | Static guard: source documents the spawn boundary | Test |

## Final Verdict

- **GO** when all G1–G9 pass AND all R1–R25 verified
- **NO-GO** if any gate fails
