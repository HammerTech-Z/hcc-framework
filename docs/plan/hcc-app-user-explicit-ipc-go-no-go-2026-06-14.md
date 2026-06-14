# HCC-APP-USER-EXPLICIT-IPC-001 — Commit-Ready Report

## Gate results (all PASS)

typecheck EXIT 0 | app-IPC 32/32 | auto-executor 27 files / 671 tests | safety 36 files / 988 tests | diff clean | locked empty | invariants 6 | forbidden only-comments

## Files staged-ready (5)

`src/shared/lib/hcc-app-user-explicit-ipc.ts` (~270 lines) | `tests/auto-executor/hcc-app-user-explicit-ipc.test.ts` (32) | preflight | closeout | go-no-go

## What this does

`handleAppIpcInvocation(request)` is the first app-side HCC entrypoint. It wraps the shared invocation service + the controlled dispatch adapter with app-local identity (app_session_id, app_invocation_id, user_confirmation). The synchronous guard `checkAppIpcRequest` covers: app_session_id non-empty, app_invocation_id non-empty, user_confirmation present with kind in {renderer_button_click, menu_action, keyboard_shortcut} + nonce + display_text + confirmed_at all non-empty, shared_fixture present, and the shared service's own guard (delegated). The async entrypoint runs the guard; on guard failure it returns NO-GO with a typed reason without ever touching the adapter. On guard success it delegates to the shared invocation service; if the dispatch adapter throws, the throw is caught and re-shaped as a NO-GO with a typed reason so the bridge does not have to handle two error channels. The result is re-shaped with the app identity on every code path. The user-explicit boundary (unattended_ready=false, night_run_ready=false, go_no_go="NO-GO", auto_executor_started=false) is preserved.

There is no Electron main-process handler registration, no preload change, no renderer change, no `src/main/index.ts` change, no app boot / timer / cron / auto-arm path. The lib is a pure contract; a future slice will wire the main-process bridge to call this handler.

## Boundary compliance

No product wiring. No CLI / IPC / renderer / preload / app boot / timer / cron / auto-arm. No bootstrap / arm / start / host imports. No `~/.hermes` write. No `package.json` / `package-lock.json` change. `unattended_ready: true`, `night_run_ready: true`, and `go_no_go: "GO"` are never set. No "night-run" wording except the historical variable name `night_run_ready`.

## Next step

- `GO COMMIT` → commit 5 files
- `HCC-E2E-CANARY-001` (next slice) — end-to-end canary that composes the terminal agent invoker + the app IPC handler against the shared service + controlled dispatch adapter + a real executor backing, behind a feature flag, user-explicit only, no auto-arm.
