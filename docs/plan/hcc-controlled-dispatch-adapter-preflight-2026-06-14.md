# HCC-CONTROLLED-DISPATCH-ADAPTER-001 — Preflight

- Task: `HCC-CONTROLLED-DISPATCH-ADAPTER-001` | Date: 2026-06-14 | Branch: `hcc-controlled-dispatch-adapter-001` | Predecessor: `c57f0ff`

## 1. Baseline — `HEAD = origin/main = c57f0ff`

## 2. What this slice adds — controlled dispatch adapter layer with 4 explicit backends (in_memory / shell_command / file_write / config_patch). All 4 backends run through fully injected executors; the lib never calls spawn / exec / child_process / writeFile / readFile directly. The lib exposes `controlledDispatch(input)` returning a typed `HCCControlledDispatchResult` (ok + value, or ok: false + typed failure with kind DENIED / BACKEND_UNAVAILABLE / EXECUTOR_REJECTED / INVALID_INPUT) and `buildControlledDispatchAdapter(factory)` that produces a `HCCFinalControlledRealDispatchAdapter` compatible with the final dispatch contract. Every dispatch requires `trigger_proof.explicit_user_trigger_token` (non-empty) and `trigger_proof.source_service` recognized as either `hcc-shared-invocation-service` or `hcc-user-explicit-local-invoker`. shell_command dispatches only from `HCC_DISPATCH_SHELL_ALLOWLIST` (3 entries: `git.status`, `git.diff`, `git.show`); free-form shell strings are refused. file_write / config_patch require repo-local paths under `docs/`, `src/`, or `tests/` with `.md` / `.json` / `.ts` / `.tsx` / `.txt` extension; reject `~`-prefixed, absolute, `..`-traversal, and locked paths (`src/main/index.ts`, `package.json`, `package-lock.json`, `docs/knowledge/**`). No product wiring. No CLI / IPC / renderer / preload / app boot / timer / cron / auto-arm

## 3. Verification — typecheck EXIT 0, 40/40 adapter tests, 25 files / 610 tests auto-executor, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution NO-GO
