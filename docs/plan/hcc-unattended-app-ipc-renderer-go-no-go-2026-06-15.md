# HCC-UNATTENDED-APP-IPC-RENDERER-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ b4dbaa7

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-APP-IPC-RENDERER-001 slice. The slice adds a
renderer-side confirmation entrypoint for the HCC
unattended app IPC arming channel.

## 1. Renderer click-flow gate matrix (3 gates + delegated)

| # | Perturbation | `verdict` displayed | `arm()` called? | `arm()` calls count |
|---|--------------|---------------------|-----------------|---------------------|
| 1 | render only | `IDLE` (未操作) | NO | 0 |
| 2 | first button click | `IDLE` (no change) | NO | 0 |
| 3 | cancel | `IDLE` (no change) | NO | 0 |
| 4 | confirm | `INSTALLED` (or `ALREADY-INSTALLED` / `NO-GO` / `ERROR` depending on bridge response) | YES (once) | 1 |
| 5 | confirm with bridge returning `verdict: "ALREADY-INSTALLED"` | `ALREADY-INSTALLED` (已开启 · already armed) | YES (once) | 1 |
| 6 | confirm with bridge returning `verdict: "NO-GO"` | `NO-GO` (未开启 · <reason>) | YES (once) | 1 |
| 7 | confirm with bridge throwing | `ERROR` (未开启 · <error message>) | YES (once, throws) | 1 |
| 8 | confirm twice (token uniqueness) | first: `INSTALLED`; second: `ALREADY-INSTALLED` | YES (twice) | 2 — but each call is independent, with a fresh per-click token |

## 2. Token generation

| Property | Value |
|----------|-------|
| Length | 32 hex chars (16 bytes × 2) |
| Source | `crypto.getRandomValues(Uint8Array(16))` (browser / jsdom) or `Math.random()` fallback |
| Generation trigger | only on `handleConfirm` (user explicitly clicked through the dialog) |
| Per-click uniqueness | YES — two consecutive confirm clicks produce two distinct non-empty tokens |

## 3. Preload bridge surface

| # | Check | Result |
|---|-------|--------|
| 1 | `armHccUnattendedAppIpc` exposed on `hermesAPI` (via `contextBridge.exposeInMainWorld`) | YES |
| 2 | raw `ipcRenderer` NOT exposed to renderer | YES — `contextBridge` exposes only `electron` and `hermesAPI`; raw `ipcRenderer` stays in the preload's module scope |
| 3 | payload type enforced in `index.d.ts` | YES — `{ user_confirmation: true; explicit_unattended_trigger_token: string; feature_flag_enabled: true }` (literal types) |
| 4 | response type returned to renderer | YES — typed `HccUnattendedArmingResult` with literal verdict / channel / channel_armed |

## 4. Forbidden-Surface Scan (static guard results)

The following regexes are checked against the changed files
(with comments stripped on the component source).

### `HccUnattendedArming.tsx` (renderer component)

| Forbidden token | Result |
|----------------|--------|
| `\bipcRenderer\b` | NOT PRESENT |
| `\bipcMain\b` | NOT PRESENT |
| `\bcontextBridge\b` | NOT PRESENT |
| `from\s+["']\.\.\/\.\.\/main` | NOT PRESENT |
| `from\s+["']electron["']` | NOT PRESENT |
| `from\s+["']\.\.\/\.\.\/preload` | NOT PRESENT |
| `set(?:Interval|Immediate|Timeout)\s*\(` | NOT PRESENT |
| `\bspawn\s*\(` | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT |
| `child_process` | NOT PRESENT |
| `submitDryRunAction` | NOT PRESENT |
| `\.hermes\//` (filesystem path) | NOT PRESENT |
| `\.hermes\*\*/` (filesystem path) | NOT PRESENT |

### `src/preload/index.ts` (preload bridge)

The preload IS the IPC bridge surface. It legitimately
imports `ipcRenderer` and `contextBridge`. The forbidden
check is that the renderer side does NOT import these.

## 5. `src/renderer/src/screens/AgentMonitor/index.tsx` integration (surgical)

| # | Check | Result |
|---|-------|--------|
| 1 | one new import (the component) | YES (line 13) |
| 2 | one new mount block (`<HccUnattendedArming />`) | YES (before the closing `</div>` of the monitor container) |
| 3 | no other `src/renderer/src/screens/AgentMonitor/index.tsx` change | YES |
| 4 | component is rendered inline (not conditionally) | YES — the section is always present |

## 6. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Import `ipcRenderer` / `ipcMain` / `contextBridge` in
  the renderer component.
- Call `setInterval` / `setTimeout` / `setImmediate` in
  the renderer component.
- Call the arming bridge on mount, on any effect, on a
  timer, or on polling.
- Call the final HCC dispatch channel from the renderer.
- Import `submitDryRunAction`.
- Write to `~/.hermes/**`.
- Touch `package.json` or `package-lock.json`.
- Touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.

## 7. Verdict

**GO** for the renderer arming slice, contingent on the
gate matrices in §1 and §2 passing in
`npx vitest run src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx`,
plus the broader gates listed in the preflight.

The slice wires the renderer to the existing
`HCC_UNATTENDED_APP_IPC_INSTALL_CHANNEL` arming channel
introduced in `b4dbaa7`. The renderer is safe by default:
the arming bridge is only called after the user has
explicitly clicked through the confirmation dialog. A
future production wiring slice (out of scope here) is
responsible for injecting a real dispatch adapter so the
arm-then-dispatch chain can actually perform a dispatch.
