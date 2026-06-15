# HCC-UNATTENDED-APP-IPC-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ e754033

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-APP-IPC-001 slice. The handler is a pure async
function that consumes an IPC payload and delegates to
`runAppUnattendedScheduledDispatch`.

## 1. Identity gate matrix (5 gates + 1 delegated)

| # | Gate | Perturbation | Expected verdict | `reason` contains | Entrypoint called? |
|---|------|--------------|------------------|-------------------|--------------------|
| 1 | `app_session_id` | `""` | `NO-GO` | `missing or malformed` | NO |
| 2 | `app_invocation_id` | `""` | `NO-GO` | `missing or malformed` | NO |
| 3 | `user_confirmation` | `false` | `NO-GO` | `missing or malformed` | NO |
| 4 | `explicit_unattended_trigger_token` | `""` | `NO-GO` | `missing or malformed` | NO |
| 5 | `feature_flag_enabled` | `false` | `NO-GO` | `missing or malformed` | NO |
| 6 | structural: `planned_action_kind` | unsupported | `NO-GO` | `missing or malformed` | NO |
| 7 | structural: `target_path` | `""` | `NO-GO` | `missing or malformed` | NO |
| 8 | null payload | `null` | `NO-GO` | `missing or malformed` | NO |
| 9 | non-object payload | `"string"` | `NO-GO` | `missing or malformed` | NO |
| 10 | all gates pass | n/a | `APP-UNATTENDED-SCHEDULED-DISPATCHED` (with mocked entrypoint) OR `NO-GO` (with real entrypoint, due to no-op ready_result scaffold) | n/a | YES (once) |
| 11 | entrypoint returns NO-GO | mocked | `NO-GO` (propagated reason) | entrypoint's reason | YES (once) |
| 12 | entrypoint throws | mocked | `NO-GO` (propagated reason) | propagated error message | YES (once, throws) |

## 2. Success path side-effect fields

### Success (with mocked entrypoint)

| Field | Value | Set in |
|-------|-------|--------|
| `verdict` | `"APP-UNATTENDED-SCHEDULED-DISPATCHED"` | forwarded from entrypoint |
| `night_run_ready` | `false` (literal) | forwarded from entrypoint |
| `go_no_go` | `"NO-GO"` (literal) | forwarded from entrypoint |
| `auto_executor_started` | `false` (literal) | forwarded from entrypoint |
| `would_execute` | `false` (literal) | forwarded from entrypoint |
| `real_execution_ready` | `false` (literal) | forwarded from entrypoint |
| `unattended_ready` | forwarded from entrypoint | forwarded |
| `any_command_executed` | forwarded from entrypoint | forwarded |
| `executed_commands` | forwarded from entrypoint | forwarded |
| `subprocess_count` | forwarded from entrypoint | forwarded |
| `controlled_command_id` | forwarded from entrypoint | forwarded |
| `handled_at` | ISO 8601 from `deps.now()` | captured at handler entry |

### NO-GO (both handler-level and entrypoint-level)

| Field | Value | Set in |
|-------|-------|--------|
| `verdict` | `"NO-GO"` | handler's `noGo()` or forwarded from entrypoint |
| `night_run_ready` | `false` (literal) | handler's `noGo()` |
| `go_no_go` | `"NO-GO"` (literal) | handler's `noGo()` |
| `auto_executor_started` | `false` (literal) | handler's `noGo()` |
| `would_execute` | `false` (literal) | handler's `noGo()` |
| `real_execution_ready` | `false` (literal) | handler's `noGo()` |
| `unattended_ready` | `false` (literal) | handler's `noGo()` |
| `any_command_executed` | `false` (literal) | handler's `noGo()` |
| `executed_commands` | `[]` (literal) | handler's `noGo()` |
| `subprocess_count` | `0` (literal) | handler's `noGo()` |
| `controlled_command_id` | `""` (literal) | handler's `noGo()` |
| `handled_at` | ISO 8601 from `deps.now()` | captured at handler entry |

## 3. Forbidden-Surface Scan (static guard results)

The following regexes are checked against the handler source
with all comments stripped:

| Forbidden token | Result |
|-----------------|--------|
| `\bspawn\s*\(` | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT |
| `child_process` | NOT PRESENT |
| `ipcMain\.handle` (registration is out of scope) | NOT PRESENT |
| `BrowserWindow` | NOT PRESENT |
| `contextBridge` | NOT PRESENT |
| `set(?:Interval|Immediate|Timeout)\s*\(` | NOT PRESENT |
| `auto-executor-bootstrap` | NOT PRESENT |
| `auto-executor-arm` | NOT PRESENT |
| `auto-executor-start` | NOT PRESENT |
| `auto-executor-host` | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT |
| `go_no_go:\s*"GO"` (runtime value) | NOT PRESENT |
| `night_run_ready:\s*true` (runtime value) | NOT PRESENT |
| `\.hermes` (path reference) | NOT PRESENT |

## 4. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Call `ipcMain.handle` anywhere in the source (registration
  is a future wiring slice).
- Call `runAppUnattendedScheduledDispatch` from anywhere except
  the single `await` inside `handleHccUnattendedAppIpcRequest`
  (or via `deps.runAppUnattendedScheduledDispatch`).
- Import `submitDryRunAction`.
- Write to `~/.hermes/**`.
- Touch `package.json` or `package-lock.json`.
- Touch `src/main/index.ts`.
- Touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Register IPC, renderer, preload, timer, cron, or auto-arm.

## 5. Verdict

**GO** for the in-app IPC handler contract slice, contingent on
the gate matrices in §1 and §2 passing in
`npx vitest run tests/auto-executor/hcc-unattended-app-ipc.test.ts`,
plus the broader gates listed in the preflight.

The slice is a handler contract only. The handler is exported
as a pure async function; the `ipcMain.handle` registration
is a future wiring slice's concern. No renderer button or
modal is added in this commit. The next slice that wires the
handler into `ipcMain.handle` (registered from an explicit
user-gesture entrypoint) is a separate GO-gated decision and
is explicitly out of scope here.
