# HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ b544409 (`hcc: add controlled unattended scheduler contract`)
Slice: HCC-UNATTENDED-PRODUCT-ENTRYPOINTS-001 (gated unattended product entrypoints)

## 1. Goal

Add the first product-facing unattended HCC entrypoint contract for
both:

1. Terminal Hermes agent path
2. Hermes Pro app path

This slice consumes the controlled unattended scheduler from
`b544409` (`scheduleControlledUnattendedRun`). It does NOT
introduce background timers, cron, boot-time auto-start, or
automatic arming. Each entrypoint is a pure async facade that
gates on an explicit invocation identity, then delegates to the
scheduler.

## 2. Why a "contract only" slice

The two entrypoints are pure shared/lib facades. No `src/main` wiring
in this commit. No CLI bin wiring. No IPC registration. No renderer
button. A future slice may add the actual CLI / IPC / UI wiring; that
slice is a separate GO-gated decision.

## 3. Allowed files (5)

1. `src/shared/lib/hcc-unattended-terminal-entrypoint.ts`
2. `src/shared/lib/hcc-unattended-app-entrypoint.ts`
3. `tests/auto-executor/hcc-unattended-product-entrypoints.test.ts`
4. `docs/plan/hcc-unattended-product-entrypoints-preflight-2026-06-15.md`
5. `docs/closeout/hcc-unattended-product-entrypoints-001-closeout-2026-06-15.md`
6. `docs/plan/hcc-unattended-product-entrypoints-go-no-go-2026-06-15.md`

(Six files in this slice, not five. The earlier scheduler slice used
five because it had one source + one test + three docs. This slice
has two sources + one test + three docs = six.)

## 4. Identity gates

### Terminal path (4 gates)

| # | Gate | Source field |
|---|------|--------------|
| T1 | `terminal_agent_session_id` non-empty | `invocation.terminal_agent_session_id` |
| T2 | `terminal_invocation_id` non-empty | `invocation.terminal_invocation_id` |
| T3 | `explicit_unattended_trigger_token` non-empty | `invocation.explicit_unattended_trigger_token` |
| T4 | `feature_flag_enabled === true` | `feature_flag_enabled` |

### App path (5 gates)

| # | Gate | Source field |
|---|------|--------------|
| A1 | `app_session_id` non-empty | `invocation.app_session_id` |
| A2 | `app_invocation_id` non-empty | `invocation.app_invocation_id` |
| A3 | `user_confirmation === true` | `invocation.user_confirmation` |
| A4 | `explicit_unattended_trigger_token` non-empty | `invocation.explicit_unattended_trigger_token` |
| A5 | `feature_flag_enabled === true` | `feature_flag_enabled` |

## 5. NO-GO short-circuit ordering

The entrypoint evaluates its identity gates synchronously up front.
If any gate fails, the entrypoint returns `verdict: "NO-GO"` and
NEVER calls `scheduleControlledUnattendedRun`. The scheduler itself
is never called from a NO-GO path; the runner is never called from
a NO-GO path; the dispatch adapter is never called from a NO-GO path.

On success, the entrypoint awaits the scheduler. The scheduler
itself re-runs its own gates and either returns
`CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED` (success) or
`NO-GO` (scheduler-level failure, propagated as entrypoint
`NO-GO` with the scheduler's reason).

If the scheduler itself throws (it should not — the scheduler
catches runner / adapter throws — but defense in depth), the
entrypoint returns typed `NO-GO` with the propagated reason.

## 6. What this slice does NOT do

- Does NOT call `setInterval` / `setTimeout` / `setImmediate`.
- Does NOT call `spawn` / `exec` / `child_process` directly.
- Does NOT call `submitDryRunAction`.
- Does NOT import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Does NOT write to `~/.hermes/**`.
- Does NOT register IPC, renderer, preload, or boot-time auto-start.
- Does NOT add a CLI bin. The terminal entrypoint is a
  shared/lib facade that a future CLI slice imports; the CLI
  slice is out of scope here.
- Does NOT modify `package.json` or `package-lock.json`.
- Does NOT touch renderer / UI drift in the dirty worktree.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.

## 7. Preserved literals

- `night_run_ready: false` (literal, in both `dispatched()` and `noGo()` in each entrypoint)
- `go_no_go: "NO-GO"` (literal, in both `dispatched()` and `noGo()` in each entrypoint)
- `auto_executor_started: false` (literal)
- `would_execute: false` (literal)
- `real_execution_ready: false` (literal)
- `go_no_go: "GO"` does NOT appear anywhere as a runtime value.
  Enforced by static test with comments stripped.

## 8. Pre-Commit gates (must all pass)

```
npm run typecheck:node
npx vitest run tests/auto-executor/hcc-unattended-product-entrypoints.test.ts
npx vitest run tests/auto-executor/
npx vitest run tests/hcc/hcc-e2e-canary.test.ts
npx vitest run tests/safety
git diff --check
git diff --name-status -- package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md
rg -n 'go_no_go: "GO"|night_run_ready: true|setInterval|setTimeout|child_process|submitDryRunAction|auto-executor-bootstrap|auto-executor-arm|auto-executor-start|auto-executor-host|~/.hermes' \
    <changed files>
```

## 9. Forbidden mutations

- Setting `go_no_go: "GO"` anywhere in the source.
- Setting `night_run_ready: true` anywhere in the source.
- Setting `auto_executor_started: true` anywhere in the source.
- Calling `scheduleControlledUnattendedRun` from anywhere except
  the single `await` inside each entrypoint (post all-gates).
- Importing `submitDryRunAction`.
- Writing to `~/.hermes/**`.
- Touching `package.json` or `package-lock.json`.
- Touching `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.

## 10. Commit / Push

- Commit only if all gates pass.
- Commit message: `hcc: add gated unattended product entrypoints`
- Push: per task spec, "pushed or not pushed" reported in closeout.
  No forced push. No rebase.
