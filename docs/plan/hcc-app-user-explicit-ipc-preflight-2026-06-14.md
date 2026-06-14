# HCC-APP-USER-EXPLICIT-IPC-001 — Preflight

- Task: `HCC-APP-USER-EXPLICIT-IPC-001` | Date: 2026-06-14 | Branch: `hcc-app-user-explicit-ipc-001` | Predecessor: `b818d17`

## 1. Baseline — `HEAD = origin/main = b818d17`

## 2. What this slice adds — main-process app IPC handler contract. PURE CONTRACT ONLY. The lib exposes `checkAppIpcRequest(request)` synchronous guard (returns null on a valid request, a reason string otherwise) and `handleAppIpcInvocation(request)` async top-level that runs the guard, delegates to `invokeSharedControlledRealDispatch`, and re-shapes the result with the app identity. The request must carry `app_session_id` (non-empty), `app_invocation_id` (non-empty), `user_confirmation` (kind in {renderer_button_click, menu_action, keyboard_shortcut} + nonce + display_text + confirmed_at all non-empty), and a `shared_fixture` that passes the shared service's own guard. The lib does NOT register an Electron main-process handler, does NOT touch preload, does NOT touch the renderer, does NOT trigger app boot / timer / cron / auto-arm. Wiring the bridge is a future slice; this slice is the validation + dispatch contract only. Dispatch adapter throws are caught and surfaced as a typed NO-GO with a reason

## 3. Verification — typecheck EXIT 0, 32/32 app-IPC tests, 27 files / 671 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
