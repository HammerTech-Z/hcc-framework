# HCC-CONTROLLED-DRY-RUN-CALLSURFACE-001 — Implementation Preflight

- Task: `HCC-CONTROLLED-DRY-RUN-CALLSURFACE-001`
- Date: 2026-06-14
- Branch: `hcc-controlled-dry-run-call-surface-001`
- Predecessor: `ccfcf72 hcc: add controlled dry-run entrypoint`
- Scope: **call surface library only**.

## 1. Baseline

`HEAD = origin = ccfcf72`

## 2. What this slice adds

`src/shared/lib/hcc-controlled-dry-run-call-surface.ts`: `callControlledDryRun(input)` resolves gate input (mode or override + optional auth record), invokes `runControlledDryRunEntrypoint`, returns surface result with literal-false execution fields.

## 3. Verification

typecheck EXIT 0 | 20/20 call-surface | 16 files / 360 auto-executor tests PASS | 36 files / 988 safety tests PASS | diff clean | locked empty | invariants 6 | forbidden wording 0

## 4. Decision

| Question | Verdict |
|---|---|
| Commit? | **YES** |
| Push? | **held** |
| Real / unattended execution? | **NO-GO** |
