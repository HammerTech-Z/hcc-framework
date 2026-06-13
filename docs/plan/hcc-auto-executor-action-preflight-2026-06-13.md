# HCC-AUTO-EXECUTOR-DRY-RUN-ACTION-001 — Implementation Preflight

- Task: `HCC-AUTO-EXECUTOR-DRY-RUN-ACTION-001`
- Date: 2026-06-13
- Branch: `hcc-auto-executor-action-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `HCC-AUTO-EXECUTOR-START-001` (committed at `0c086cb` on `origin`)
- Scope: **dry-run action helper only**. Accepts a dry-run action descriptor from a running host. Produces a dry-run artifact. No real execution. No spawn. No auto-action on app boot.

## 1. Canonical repo baseline (verified locally 2026-06-13)

| Fact | Value |
|---|---|
| Worktree | `.claude/worktrees/hcc-auto-executor-action-001` |
| Branch | `hcc-auto-executor-action-001` |
| `git rev-parse HEAD` | `0c086cb8ef22a2430d4b13400f0c0504b1f6c139` |
| `git rev-parse origin/hermes-pro-main` | `0c086cb8ef22a2430d4b13400f0c0504b1f6c139` |
| HEAD == origin | **true** |

## 2. Working tree

| Path | Status | Reason |
|---|---|---|
| `src/main/auto-executor-dry-run-action.ts` | A | `submitDryRunAction(req)`, `getActionPostureReport()` |
| `tests/auto-executor/action-integration.test.ts` | A | 25 tests |
| `docs/plan/hcc-auto-executor-action-preflight-2026-06-13.md` | A | This preflight |
| `docs/closeout/hcc-auto-executor-action-001-closeout-2026-06-13.md` | A | Closeout |
| `docs/plan/hcc-auto-executor-action-go-no-go-2026-06-13.md` | A | GO/NO-GO report |

Files **NOT** staged by this commit:
- `src/main/index.ts` — unchanged (no auto-action on boot)
- `package.json` / `package-lock.json` — unchanged (no new deps)
- `src/shared/lib/auto-executor/**` — unchanged (boundary library idle)
- `src/shared/lib/hcc-controlled-executor.ts` — unchanged (`night_run_ready: false` / `go_no_go: "NO-GO"` preserved)
- `src/main/auto-executor-bootstrap.ts` / `arm.ts` / `start.ts` / `host.ts` — unchanged
- `~/.hermes/**` — not touched at all

## 3. Verification (gates re-run at preflight time)

| Gate | Result |
|---|---|
| `git rev-parse HEAD` | `0c086cb8ef22a2430d4b13400f0c0504b1f6c139` |
| `git rev-parse origin/hermes-pro-main` | `0c086cb8ef22a2430d4b13400f0c0504b1f6c139` |
| `npm run typecheck:node` | EXIT 0 |
| `npx vitest run tests/auto-executor/action-integration.test.ts` | 25/25 PASS |
| `npx vitest run tests/auto-executor/` | 8 files / 149 tests PASS |
| `npx vitest run tests/safety` | 36 files / 988 tests PASS (no regression) |
| `git diff --check` | clean |
| `git diff --name-status -- src/main/index.ts package.json package-lock.json` | empty |
| `rg "night_run_ready: false\|go_no_go: \"NO-GO\""` | 6 hits, unchanged |
| `rg "spawn\(\|exec\(\|child_process\|ipcMain\|setInterval\|setTimeout\|~/.hermes" src/main/auto-executor-dry-run-action.ts` | comments only |
| `rg "would_execute: false\|executed_commands\|dry_run_action\|P3_010" src tests docs` | all present in module + test + docs |

## 4. What this slice adds

A single module `src/main/auto-executor-dry-run-action.ts` that:

1. Accepts `DryRunActionRequest` from a **running** host only
2. Refuses if host is not installed / constructed / armed / aborted
3. Delegates admission to `decideTaskAdmission()` from the controlled-executor readiness slice
4. Returns a `DryRunActionResult` with literal-false fields:
   - `would_execute: false` — no command is ever invoked
   - `executed_commands: []` — always empty
   - `subprocess_count: 0` — always 0
   - `max_subprocess_count: 0` — always 0
   - `artifact_kind: "dry_run_action"` — type-level label
   - `verifier_required: true` — downstream verifier is mandatory
   - `next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN"` — explicit pointer to the next slice
5. Dangerous action classes (`install_dependency`, `file_deletion`, `external_publish`, `credential_access`, `browser_action`, `live_apply`) return `requires_user_approval` (no throw — artifact carries the admission signal)
6. Denied admissions throw

Plus `getActionPostureReport()` returning literal-false `any_command_executed: false` and `total_subprocess_count: 0`.

## 5. What this slice does NOT add

- No real command execution (`would_execute: false` literal)
- No subprocess spawning (`safeExec.allowlist.binaries` = empty; `subprocess_count: 0` literal)
- No `~/.hermes/**` writes (action module never touches filesystem)
- No credential access (`secretAllowlist` = empty; `credential_access` → `requires_user_approval`)
- No external publish (`external_publish` → `requires_user_approval`)
- No browser action (`browser_action` → `requires_user_approval`)
- No live apply (`live_apply` → `requires_user_approval`)
- No IPC channel registration
- No cron / timer / daemon
- No `package.json` / `package-lock.json` modification
- No `src/main/index.ts` modification (no auto-action on boot)
- No boundary library modification (`src/shared/lib/auto-executor/**` idle)
- No controlled-executor readiness contract modification (`night_run_ready: false` / `go_no_go: "NO-GO"` preserved)
- No `git push`

## 6. Predecessor linkage

| Predecessor | Status | Linkage |
|---|---|---|
| `HCC-AUTO-EXECUTOR-BOOTSTRAP-001` | ✅ landed (`7564030`) | installs host in `constructed` |
| `HCC-AUTO-EXECUTOR-ARM-001` | ✅ landed (`cdf8278`) | `constructed → armed` |
| `HCC-AUTO-EXECUTOR-START-001` | ✅ landed (`0c086cb`) | `armed → running` |
| `HCC-CONTROLLED-EXECUTOR-READINESS-001` | ✅ landed (`39e9745`) | `decideTaskAdmission` + `night_run_ready` literal `false` |

## 7. Still NOT authorized (explicit redline list)

| Surface | State |
|---|---|
| Real command execution | **NO-GO** — `would_execute: false` literal |
| Spawn / exec / child_process | **NO-GO** — safeExec allowlist empty; static guard verified |
| `~/.hermes/**` writes | **off** |
| Credential access | **closed** — `requires_user_approval` |
| External publish | **closed** — `requires_user_approval` |
| Live apply / Live Flush / cron | **closed** |
| `git push` of execution-enabling change | **held** |
| Night-run auto-execution | **NO-GO** — literal `false` |
| P3 real execution | **NO-GO** — `next_step = "P3_010_CONTROLLED_WORKTREE_DRY_RUN"` |

Any drift from this table is a redline violation. Stop and report.

## 8. Bellard-perspective

- **One module, one function.** `submitDryRunAction(req)` is the entire surface. ~230 lines including comments and types.
- **No new dependency, no runtime, no daemon.** `package.json` untouched. The module compiles to ~8KB and returns objects at runtime.
- **Each `false` is a literal in source.** `would_execute: false`, `executed_commands: []`, `subprocess_count: 0`, `max_subprocess_count: 0`, `verifier_required: true`, `any_command_executed: false`, `total_subprocess_count: 0`. The type system forces callers to handle the false branch. Editing the literal is the audit signal.
- **Boring is correct.** A dry-run action that returns a descriptor and never executes a command is the most useful action possible right now.

## 9. Karpathy-perspective

- **No false clean-state claim.** §2 names the staged files. §3 records gate results without overstating.
- **Dry-run action ≠ real execution.** `submitDryRunAction()` builds a result with `would_execute: false` literal. Nothing in this module spawns, IPC-registers, or writes a process. A reader cannot misread this as "the executor runs."
- **Admission policy is shared, not duplicated.** The action delegates to `decideTaskAdmission()` from `src/shared/lib/hcc-controlled-executor.ts`. Two source-of-truth patterns stay aligned.
- **Tail-risks named.** §7 names every closed surface. `requires_user_approval` is honored by the action (carried in the artifact, not bypassed). `deny` is enforced (throws). `next_step` points to the next slice so the caller cannot misread this as terminal.
- **Unknowns named.** `night_run_ready` literal `false`; `go_no_go` literal `"NO-GO"`. Real execution is NO-GO. Night-run is NO-GO.
- **Audit evidence vs deployment reliability.** This preflight proves the action descriptor exists and the tests pass. It does **not** prove the action can be safely executed; that requires the next slice (`P3_010`).

## 10. Next prompt (commit + push + next slice)

> Preflight `HCC-AUTO-EXECUTOR-DRY-RUN-ACTION-001` complete. Dry-run action artifact produced. Real execution is still NO-GO. Night-run is still NO-GO.
>
> Issue one of:
>
> 1. **`GO commit`** — commit the 5 files (`src/main/auto-executor-dry-run-action.ts` + `tests/auto-executor/action-integration.test.ts` + 3 docs) onto `hcc-auto-executor-action-001`. Push held.
> 2. **`GO push`** — push the commit to `origin/hermes-pro-main`. Requires commit GO first.
> 3. **`GO P3_010_CONTROLLED_WORKTREE_DRY_RUN`** — begin P3 010 slice (NOT part of this slice; held for a future GO).
> 4. **No GO** — stop here. Files stay local; nothing is committed or pushed.