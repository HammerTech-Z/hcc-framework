# HCC-UNATTENDED-APP-IPC-INSTALL-001 — GO/NO-GO Matrix

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ 56ed9d0

This document records the per-gate GO/NO-GO outcomes for the
HCC-UNATTENDED-APP-IPC-INSTALL-001 slice. The installer is a
pure function that registers a single IPC handler on
`HCC_UNATTENDED_APP_IPC_CHANNEL`.

## 1. Installer gate matrix

| # | Perturbation | Verdict | `ipcMainLike.handle` called? | `channel` |
|---|--------------|---------|------------------------------|-----------|
| 1 | valid `ipcMainLike` (handle is a function) | `INSTALLED` | YES (once) | `"hcc:unattended-scheduled-dispatch"` |
| 2 | `ipcMainLike = undefined` | `NO-GO` | NO | `""` |
| 3 | `ipcMainLike = null` | `NO-GO` | NO | `""` |
| 4 | `ipcMainLike` is an object without `handle` | `NO-GO` | NO | `""` |
| 5 | `ipcMainLike.handle` is non-function (e.g. string) | `NO-GO` | NO | `""` |
| 6 | injected `handleHccUnattendedAppIpcRequest` is used | `INSTALLED` | YES (once) | `"hcc:unattended-scheduled-dispatch"` |
| 7 | injected `now()` provides deterministic `installed_at` | `INSTALLED` | YES (once) | `"hcc:unattended-scheduled-dispatch"` |
| 8 | registered handler delegates to the real `handleHccUnattendedAppIpcRequest` | `INSTALLED` (handler call is what happens) | YES (once) | `"hcc:unattended-scheduled-dispatch"` |

## 2. Success-path result shape

| Field | Value |
|-------|-------|
| `schema_version` | `"1.0.0"` |
| `verdict` | `"INSTALLED"` |
| `reason` | (descriptive string) |
| `channel` | `"hcc:unattended-scheduled-dispatch"` |
| `handler_count` | `1` |
| `installed_at` | ISO 8601 from `deps.now()` (default: `Date.now()`) |

## 3. NO-GO result shape

| Field | Value |
|-------|-------|
| `schema_version` | `"1.0.0"` |
| `verdict` | `"NO-GO"` |
| `reason` | (typed reason: missing ipcMainLike, malformed handle, etc.) |
| `channel` | `""` |
| `handler_count` | `0` |
| `installed_at` | ISO 8601 from `deps.now()` |

## 4. Forbidden-Surface Scan (static guard results)

The following regexes are checked against the installer source
with all comments stripped:

| Forbidden token | Result |
|-----------------|--------|
| `\bspawn\s*\(` | NOT PRESENT |
| `\bexec\s*\(` | NOT PRESENT |
| `child_process` | NOT PRESENT |
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
| `from\s+["'].*index\.ts["']` (src/main/index.ts import) | NOT PRESENT |

## 5. Forbidden Mutations

This slice MUST NOT:

- Set `go_no_go: "GO"` anywhere in the source.
- Set `night_run_ready: true` anywhere in the source.
- Set `auto_executor_started: true` anywhere in the source.
- Call `ipcMain.handle` at module load time.
- Import `submitDryRunAction`.
- Write to `~/.hermes/**`.
- Touch `package.json` or `package-lock.json`.
- Touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Touch `src/main/index.ts`.
- Register IPC, renderer, preload, timer, cron, or auto-arm.

## 6. Verdict

**GO** for the installer contract slice, contingent on the
gate matrices in §1 and §2 passing in
`npx vitest run tests/auto-executor/hcc-unattended-app-ipc-install.test.ts`,
plus the broader gates listed in the preflight.

The slice is an installer contract only. The installer is
exported as a pure function. No app-boot wiring is added in
this commit. The next slice that wires the installer into
`src/main/index.ts` (registered from an explicit user-gesture
entrypoint, NOT on app boot) is a separate GO-gated decision
and is explicitly out of scope here.
