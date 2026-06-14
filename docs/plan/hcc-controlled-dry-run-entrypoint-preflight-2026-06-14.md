# HCC-CONTROLLED-DRY-RUN-ENTRYPOINT-001 — Implementation Preflight

- Task: `HCC-CONTROLLED-DRY-RUN-ENTRYPOINT-001`
- Date: 2026-06-14
- Branch: `hcc-controlled-dry-run-entrypoint-001`
- Predecessor: `7f15f88 hcc: add unattended enablement projection`
- Scope: **entrypoint descriptor only**. Calls enablement, gates on GO-CANDIDATE, produces dry-run artifact. No execution.

## 1. Baseline

`HEAD = origin = 7f15f88`. All unattended-readiness contracts + enablement projection landed.

## 2. What this slice adds

`src/shared/lib/hcc-controlled-dry-run-entrypoint.ts`: `runControlledDryRunEntrypoint(gateInput)` calls `evaluateEnablement`, gates on GO-CANDIDATE, produces `DryRunArtifact` with literal-false execution fields. Helper functions `makeGoCandidateGateInput()` / `makeNoGoGateInput()`.

## 3. Verification

typecheck EXIT 0 | entrypoint 16/16 | auto-executor 15/340 | diff clean | locked empty | invariants 6 | forbidden wording 0

## 4. Decision

| Question | Verdict |
|---|---|
| Commit? | **YES** |
| Push? | **held** |
| Real / unattended execution? | **NO-GO** |

## 5. Next prompt

> 1. **`GO COMMIT`** — commit 5 files.
> 2. **`GO PUSH`** — push to `origin`.