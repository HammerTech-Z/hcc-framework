# HCC-UNATTENDED-APP-IPC-WIRE-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 70948f9

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-APP-IPC-WIRE-001 slice. The wire helper is a
pure async function that gates the install gesture and
delegates to the installer. `src/main/index.ts` registers
only the arming channel inside `setupIPC()`.

## 1. Wire-helper gesture gate matrix (3 gates + 1 delegated)

| # | Perturbation | `gesture_verdict` | `verdict` | `ipcMainLike.handle` called? | Installer called? |
|---|--------------|-------------------|-----------|------------------------------|-------------------|
| 1 | valid payload (first time) | `INSTALLED` | `INSTALLED` | YES (once) | YES (once) |
| 2 | valid payload (subsequent, after first install) | `ALREADY-INSTALLED` | `INSTALLED` (cached) | NO (cached) | NO (cached) |
| 3 | `user_confirmation: false` | `NO-GO` | `NO-GO` | NO | NO |
| 4 | missing `explicit_unattended_trigger_token` (`""`) | `NO-GO` | `NO-GO` | NO | NO |
| 5 | `feature_flag_enabled: false` | `NO-GO` | `NO-GO` | NO | NO |
| 6 | null payload | `NO-GO` | `NO-GO` | NO | NO |
| 7 | non-object payload (e.g. string) | `NO-GO` | `NO-GO` | NO | NO |
| 8 | valid payload followed by invalid payload | `INSTALLED` then `NO-GO` | `INSTALLED` then `NO-GO` | YES (once) then NO | YES (once) then NO |
| 9 | NO-GO payload followed by valid payload (state is not poisoned) | `NO-GO` then `INSTALLED` | `NO-GO` then `INSTALLED` | NO then YES (once) | NO then YES (once) |

## 2. `src/main/index.ts` integration (5 static checks)

| # | Check | Expected | Verification |
|---|-------|----------|--------------|
| 1 | `src/main/index.ts` imports the wire helper | `from "./ipc-handlers/wire-hcc-unattended-app-ipc"` present | static |
| 2 | `src/main/index.ts` registers only the arming channel | `HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL` referenced exactly once via `ipcMain.handle` | static |
| 3 | `src/main/index.ts` does NOT register the final HCC dispatch channel | `HCC_UNATTENDED_APP_IPC_CHANNEL` NOT present (after comments stripped) | static |
| 4 | `src/main/index.ts` does NOT import or call `runAppUnattendedScheduledDispatch` | absent | static |
| 5 | `src/main/index.ts` does NOT import the entrypoint module | `hcc-unattended-app-entrypoint` NOT present | static |

## 3. Forbidden-Surface Scan (static guard results)

The following regexes are checked against the wire helper
source and `src/main/index.ts` (with all comments stripped):

| Forbidden token | Wire helper | `src/main/index.ts` |
|-----------------|-------------|---------------------|
| `\bspawn\s*\(` | NOT PRESENT | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT | NOT PRESENT |
| `child_process` | NOT PRESENT | NOT PRESENT |
| `BrowserWindow` | NOT PRESENT | NOT PRESENT |
| `contextBridge` | NOT PRESENT | NOT PRESENT |
| `set(?:Interval|Immediate|Timeout)\s*\(` | NOT PRESENT | NOT PRESENT |
| `auto-executor-bootstrap` | NOT PRESENT | NOT PRESENT (pre-existing) |
| `auto-executor-arm` | NOT PRESENT | NOT PRESENT (pre-existing) |
| `auto-executor-start` | NOT PRESENT | NOT PRESENT (pre-existing) |
| `auto-executor-host` | NOT PRESENT | NOT PRESENT (pre-existing) |
| `submitDryRunAction` | NOT PRESENT | NOT PRESENT |
| `runAppUnattendedScheduledDispatch` | NOT PRESENT | NOT PRESENT |
| `HCC_UNATTENDED_APP_IPC_CHANNEL` (the final dispatch channel) | NOT PRESENT | NOT PRESENT (after comments stripped) |
| `go_no_go:\s*"GO"` (runtime value) | NOT PRESENT | NOT PRESENT |
| `night_run_ready:\s*true` (runtime value) | NOT PRESENT | NOT PRESENT |
| `\.hermes` (path reference) | NOT PRESENT | NOT PRESENT |

## 4. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Register the final HCC dispatch channel in `src/main/index.ts`.
- Call `runAppUnattendedScheduledDispatch` from `src/main/index.ts`.
- Import `submitDryRunAction`.
- Write to `~/.hermes/**`.
- Touch `package.json` or `package-lock.json`.
- Touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Touch `src/renderer/**` or `src/preload/**`.

## 5. Verdict

**GO** for the wire slice, contingent on the gate matrices in
§1 and §2 passing in
`npx vitest run tests/auto-executor/hcc-unattended-app-ipc-wire.test.ts`,
plus the broader gates listed in the preflight.

The slice wires the installer into the main process through
an explicit user-gesture arming channel. The final HCC
dispatch channel is NOT registered on app boot. A future
renderer slice (out of scope here) is responsible for
posting the install gesture when the user has explicitly
clicked through an in-app confirmation modal.
