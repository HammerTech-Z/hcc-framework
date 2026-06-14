# HCC-UNATTENDED-RUNNER-001 — Preflight

- Task: `HCC-UNATTENDED-RUNNER-001` | Date: 2026-06-15 | Branch: `hcc-unattended-runner-001` | Predecessor: `d693116`

## 1. Baseline — `HEAD = origin/main = d693116`

## 2. What this slice adds — first controlled unattended runner. Consumes the `UNATTENDED-READY-CANDIDATE` from the prior consumer slice and dispatches the planned action through the injected dispatch adapter. Hard AND-combination: ready_result.verdict === UNATTENDED-READY-CANDIDATE, ready_result.unattended_ready === true, feature_flag_enabled === true, dispatch_adapter present + supportsKind returns true, identity cross-check (task_id / source_plan_ref / requested_by_user / authorization_id) match across ready_result and input. All gates pass → CONTROLLED-UNATTENDED-RUNNER-DISPATCHED with any_command_executed=true, subprocess_count=1, executed_commands=[controlled_command_id], unattended_ready=true (carried from prior consumer). Any gate fail → NO-GO with the adapter never called. Adapter throws → NO-GO with propagated reason. Even on success, night_run_ready=false, go_no_go="NO-GO", auto_executor_started=false, would_execute=false are preserved. The runner never calls spawn / exec / child_process / submitDryRunAction. No app boot / CLI / renderer / preload / ipcMain registration / timer / cron / auto-arm

## 3. Verification — typecheck EXIT 0, 21/21 runner tests, 30 files / 750 tests auto-executor, 16/16 e2e canary, 36 files / 988 tests safety PASS, diff clean, invariants 6

## 4. Decision — Commit YES, Push held, Unattended execution controlled by feature flag
