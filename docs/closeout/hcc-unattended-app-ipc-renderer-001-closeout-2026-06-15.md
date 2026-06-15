# HCC-UNATTENDED-APP-IPC-RENDERER-001 — Closeout

Date: 2026-06-15
Branch: hcc-unattended-app-ipc-renderer-001 (local, not pushed)
Base: origin/hermes-pro-main @ b4dbaa7
Slice: HCC-UNATTENDED-APP-IPC-RENDERER-001

## 1. Outcome

**GO for the renderer arming entrypoint.** A new React
component `HccUnattendedArming` at
`src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.tsx`
provides a user-visible confirmation entrypoint for the
HCC unattended appIPC arming channel. The component is
mounted in `src/renderer/src/screens/AgentMonitor/index.tsx`
(surgical: +1 import, +1 mount block). The preload exposes
a narrow `armHccUnattendedAppIpc(payload)` method on
`window.hermesAPI` that calls
`ipcRenderer.invoke("hcc:unattended-app-ipc-install", payload)`.
Raw `ipcRenderer` is NOT exposed to the renderer. The
final HCC dispatch channel is NOT exposed to the renderer.

## 2. Files (8)

| File | Role | Status |
|------|------|--------|
| `src/preload/index.ts` | preload bridge — added `armHccUnattendedAppIpc` to `hermesAPI` | M |
| `src/preload/index.d.ts` | preload types — added `armHccUnattendedAppIpc` to `HermesAPI` | M |
| `src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.tsx` | renderer component | A |
| `src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx` | vitest + RTL component tests (14 cases) | A |
| `src/renderer/src/screens/AgentMonitor/index.tsx` | mount screen — surgical: +1 import, +1 JSX block | M |
| `docs/plan/hcc-unattended-app-ipc-renderer-preflight-2026-06-15.md` | preflight | A |
| `docs/plan/hcc-unattended-app-ipc-renderer-go-no-go-2026-06-15.md` | per-gate GO/NO-GO matrix | A |
| `docs/closeout/hcc-unattended-app-ipc-renderer-001-closeout-2026-06-15.md` | this file | A |

No other files in the commit. Red-line files
(`package.json`, `package-lock.json`,
`docs/knowledge/vault-health-report-2026-06-12.md`,
`.wolf/memory.md`, `src/main/index.ts`) were not touched.

## 3. Gate Matrix — Result

| # | Gate | Result |
|---|------|--------|
| 1 | `npm run typecheck:node` | PASS (clean exit) |
| 2 | `npx vitest run src/renderer/src/components/HccUnattendedArming/HccUnattendedArming.test.tsx` | 14/14 PASS |
| 3 | `npx vitest run tests/auto-executor/` | all pass |
| 4 | `npx vitest run tests/safety` | all pass |
| 5 | `git diff --check` | clean |
| 6 | `git diff --name-status -- src/main/index.ts package.json package-lock.json docs/knowledge/vault-health-report-2026-06-12.md .wolf/memory.md` | empty |

## 4. Renderer GO/NO-GO Matrix

| Scenario | `verdict` displayed | `arm()` called? | Calls count |
|----------|---------------------|-----------------|-------------|
| render only | `IDLE` (未操作) | NO | 0 |
| first button click | `IDLE` (no change) | NO | 0 |
| cancel | `IDLE` (no change) | NO | 0 |
| confirm (bridge returns INSTALLED) | `INSTALLED` (已开启 · armed) | YES (once) | 1 |
| confirm (bridge returns ALREADY-INSTALLED) | `ALREADY-INSTALLED` (已开启 · already armed) | YES (once) | 1 |
| confirm (bridge returns NO-GO) | `NO-GO` (未开启 · <reason>) | YES (once) | 1 |
| confirm (bridge throws) | `ERROR` (未开启 · <error>) | YES (once, throws) | 1 |
| confirm twice (token uniqueness) | first: `INSTALLED`; second: `ALREADY-INSTALLED` | YES (twice) | 2 — each call gets a fresh per-click token |

## 5. Preload Bridge Summary

The preload exposes exactly one new method on `hermesAPI`:

```ts
armHccUnattendedAppIpc(payload: {
  user_confirmation: true;            // literal type
  explicit_unattended_trigger_token: string;
  feature_flag_enabled: true;          // literal type
}): Promise<HccUnattendedArmingResult>
```

The method calls
`ipcRenderer.invoke("hcc:unattended-app-ipc-install", payload)`.
The result mirrors the wire helper's response shape
(`HCCUnattendedAppIpcInstallGestureResult`).

Raw `ipcRenderer` is NOT exposed to the renderer. The
`contextBridge.exposeInMainWorld("hermesAPI", hermesAPI)`
call exposes only the typed bridge.

The final HCC dispatch channel
(`HCC_UNATTENDED_APP_IPC_CHANNEL`) is NOT registered in
`src/main/index.ts` and is NOT reachable from the
renderer. It is registered only by the main-side
installer in response to a successful arming gesture.

## 6. Mounted Screen Summary

The component is mounted in
`src/renderer/src/screens/AgentMonitor/index.tsx`. The
mount is a surgical +1 import and +1 mount block:

```tsx
import { HccUnattendedArming } from "../../components/HccUnattendedArming/HccUnattendedArming";
// ... (no other changes to the existing import block)
```

```tsx
{/* HCC Unattended App IPC arming entrypoint */}
<div className="monitor-section">
  <HccUnattendedArming />
</div>
```

The mount is unconditional — the component is always
present in the AgentMonitor screen, but it is safe by
default: the arming bridge is only called after the user
has explicitly clicked through the confirmation dialog.
No other renderer files are touched.

## 7. Forbidden-Surface Scan — Result

All forbidden tokens NOT PRESENT in the component source
(with comments stripped). The preload source legitimately
imports `ipcRenderer` and `contextBridge` (it IS the bridge
surface); the renderer side does not.

## 8. What This Slice Did Not Do

- Did not modify `package.json` or `package-lock.json`.
- Did not modify `src/main/index.ts`.
- Did not register the final HCC dispatch channel.
- Did not call the final HCC dispatch channel from the
  renderer.
- Did not import `ipcRenderer` / `ipcMain` / `contextBridge`
  in the renderer component.
- Did not call `setInterval` / `setTimeout` / `setImmediate`
  in the renderer component.
- Did not call `spawn` / `exec` / `child_process` directly.
- Did not call `submitDryRunAction`.
- Did not import `auto-executor-bootstrap`,
  `auto-executor-arm`, `auto-executor-start`,
  `auto-executor-host`.
- Did not write to `~/.hermes/**`.
- Did not touch `docs/knowledge/vault-health-report-2026-06-12.md`,
  `.wolf/memory.md`, or any unrelated UI drift.
- Did not set `go_no_go: "GO"`.
- Did not flip `night_run_ready: true`.
- Did not flip `auto_executor_started: true`.
- Did not call the arming bridge on mount, on any effect,
  on a timer, or on polling.

## 9. Push

Per slice spec, the commit lands on a local branch named
`hcc-unattended-app-ipc-renderer-001`. **NOT pushed.** Push
is deferred until the user explicitly authorizes
`git push origin hcc-unattended-app-ipc-renderer-001:hermes-pro-main`.

## 10. Remaining Gap to Real App Unattended Dispatch

The HCC-UNATTENDED-APP-IPC-RENDERER-001 slice completes the
arming chain (renderer button → preload bridge →
`hcc:unattended-app-ipc-install` IPC channel → main-side
wire helper → installer → registered final dispatch
channel). The remaining gap to a real end-to-end
unattended dispatch is:

1. **Inject a real dispatch adapter** in the handler. The
   current no-op adapter in `56ed9d0` throws on `dispatch`.
   A production wiring slice injects a real adapter via
   `deps.dispatchAdapter`. The real adapter performs the
   actual action (e.g. shell command, file write) under the
   existing dispatcher whitelist.
2. **Renderer-side ready_result wiring** — the handler in
   `56ed9d0` uses a no-op `ready_result` scaffold; a real
   ready_result must be supplied. A future renderer-side
   helper can pass a real ready_result via the entrypoint
   input, OR the wire helper can accept an explicit
   `ready_result` parameter from the renderer.
3. **End-to-end smoke test** — once 1 and 2 land, an
   end-to-end test from the renderer button click to the
   dispatch adapter's `dispatch` call is the next milestone.

These three items are the remaining gap to "real app
unattended dispatch." Each is a separate GO-gated slice.
