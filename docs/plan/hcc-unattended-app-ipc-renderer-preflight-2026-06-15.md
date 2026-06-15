# HCC-UNATTENDED-APP-IPC-RENDERER-001 — Preflight

Date: 2026-06-15
Branch: hermes-pro-main
Base: origin/hermes-pro-main @ b4dbaa7
Slice: HCC-UNATTENDED-APP-IPC-RENDERER-001 (renderer-side confirmation entrypoint for HCC unattended app IPC arming)

## 1. Goal

Add the user-visible Hermes Pro app confirmation entrypoint
for the HCC unattended app IPC arming channel. The renderer:

- Calls `armHccUnattendedAppIpc(payload)` on
  `window.hermesAPI` ONLY after an explicit user
  confirmation click.
- Does NOT call the final HCC dispatch channel
  (`HCC_UNATTENDED_APP_IPC_CHANNEL` from `56ed9d0`) — that
  channel is registered by the main-side installer in
  response to a successful arming gesture.
- Does NOT auto-trigger on mount, on any effect, on a timer,
  or on polling.

## 2. Allowed files (8)

1. `src/preload/index.ts` — add `armHccUnattendedAppIpc` to `hermesAPI`.
2. `src/preload/index.d.ts` — add the typed method to the `HermesAPI` interface.
3. `src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.tsx` — new component.
4. `src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx` — vitest + React Testing Library.
5. `src/renderer/src/screens/AgentMonitor/index.tsx` — surgical: +1 import, +1 mount block.
6. `docs/plan/hcc-unattended-app-ipc-renderer-preflight-2026-06-15.md` — this file.
7. `docs/plan/hcc-unattended-app-ipc-renderer-go-no-go-2026-06-15.md` — per-gate GO/NO-GO matrix.
8. `docs/closeout/hcc-unattended-app-ipc-renderer-001-closeout-2026-06-15.md` — closeout.

## 3. Preload bridge contract

```ts
window.hermesAPI.armHccUnattendedAppIpc(payload: {
  user_confirmation: true;
  explicit_unattended_trigger_token: string;
  feature_flag_enabled: true;
}): Promise<{
  schema_version: "1.0.0";
  verdict: "INSTALLED" | "ALREADY-INSTALLED" | "NO-GO";
  reason: string;
  channel: string;
  handler_count: number;
  installed_at: string;
  gesture_verdict: "INSTALLED" | "ALREADY-INSTALLED" | "NO-GO";
  gesture_handled_at: string;
  channel_armed: "hcc:unattended-app-ipc-install";
}>
```

The preload bridge is the ONLY IPC surface reachable from
the renderer for arming. Raw `ipcRenderer` is NOT exposed
to the renderer (`contextBridge.exposeInMainWorld` exposes
only `hermesAPI` and `electron`). The renderer cannot call
`HCC_UNATTENDED_APP_IPC_CHANNEL` (the final dispatch channel)
— that channel is registered only by the main-side
installer in response to a successful arming gesture.

## 4. Component contract

```
HccUnattendedArming({ arm? }) -> ReactElement
```

- `arm` is an optional dependency. Defaults to
  `window.hermesAPI.armHccUnattendedAppIpc`. Tests inject a
  mock.
- The component maintains local state: `confirmOpen`
  (boolean) and `verdict` (one of `IDLE`, `INSTALLED`,
  `ALREADY-INSTALLED`, `NO-GO`, `ERROR`).
- First click on the visible button opens a
  `ConfirmDialog`. The arming bridge is NOT called.
- Confirm click generates a per-click
  `explicit_unattended_trigger_token` (32-char hex from
  `crypto.getRandomValues` with `Math.random` fallback) and
  posts to the arming bridge.
- Cancel click closes the dialog. The arming bridge is
  NOT called.
- No useEffect / timer / polling / auto-call. Render is
  safe by default.

## 5. NO-GO short-circuit ordering

The component does NOT enforce payload-shape gates — the
3-field payload is hard-coded by the component on confirm
click. The arming bridge and the main-side wire helper
(`hcc-unattended-app-ipc-wire`) enforce the gates. A
NO-GO from the bridge is rendered as a deterministic
status text. An exception from the bridge is rendered as
`ERROR` with the error message.

## 6. What this slice does NOT do

- Does NOT call `setInterval` / `setTimeout` / `setImmediate`.
- Does NOT call `spawn` / `exec` / `child_process` directly.
- Does NOT call `submitDryRunAction`.
- Does NOT import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Does NOT import `ipcRenderer` / `ipcMain` / `contextBridge`
  in the renderer component.
- Does NOT import from `src/main` / `electron` / `src/preload`
  in the renderer component.
- Does NOT write to `~/.hermes/**`.
- Does NOT modify `package.json` or `package-lock.json`.
- Does NOT touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Does NOT register the final HCC dispatch channel.
- Does NOT call the final HCC dispatch channel.
- Does NOT call the arming bridge on mount, on any effect,
  on a timer, or on polling.
- Does NOT set `go_no_go: "GO"`.
- Does NOT flip `night_run_ready: true`.
- Does NOT flip `auto_executor_started: true`.

## 7. Preserved literals (delegated to arming bridge / main-side chain)

The component does NOT directly produce
`night_run_ready` / `go_no_go` / `auto_executor_started`
values. Those are produced by the main-side
entrypoint / scheduler / runner chain (`56ed9d0`, `b4dbaa7`,
`70948f9`). The component displays the arming bridge's
deterministic response verbatim.

## 8. Pre-Commit gates (must all pass)

```
npm run typecheck:node
npx vitest run src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx
npx vitest run tests/auto-executor/
npx vitest run tests/safety
git diff --check
git diff --name-status -- src/main/index.ts package.json package-lock.json \
    docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md
rg -n 'ipcRenderer|ipcMain|contextBridge|setInterval|setTimeout|child_process|spawn\(|exec\(|submitDryRunAction|auto-executor-bootstrap|auto-executor-arm|auto-executor-start|auto-executor-host|go_no_go: "GO"|night_run_ready: true' \
    src/preload/index.ts \
    src/preload/index.d.ts \
    src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.tsx \
    src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx \
    src/renderer/src/screens/AgentMonitor/index.tsx
```

The renderer source must NOT contain `ipcRenderer`,
`ipcMain`, or `contextBridge` (the renderer must use only
`window.hermesAPI`). The preload source may contain
`ipcRenderer` and `contextBridge` (the preload IS the
bridge surface) — but the renderer side must not.

## 9. Forbidden mutations

- Setting `go_no_go: "GO"` anywhere in the source.
- Setting `night_run_ready: true` anywhere in the source.
- Setting `auto_executor_started: true` anywhere in the source.
- Importing `ipcRenderer` / `ipcMain` / `contextBridge` in
  the renderer component.
- Calling `setInterval` / `setTimeout` / `setImmediate` in
  the renderer component.
- Calling the arming bridge on mount, on any effect, on a
  timer, or on polling.
- Calling the final HCC dispatch channel from the renderer
  (the renderer cannot reach the final dispatch channel —
  the main-side installer is the only path).
- Importing `submitDryRunAction`.
- Writing to `~/.hermes/**`.
- Touching `package.json` or `package-lock.json`.
- Touching `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Touching `src/renderer/**` files outside the mount-screen
  (`AgentMonitor/index.tsx`) and the new component
  (`HccUnattendedArming.tsx` + test).

## 10. Commit / Push

- Commit only if all gates pass.
- Commit on a local branch named
  `hcc-unattended-app-ipc-renderer-001` (per slice spec).
- Do NOT push unless explicitly authorized by the user.
