# HCC-ROLLBACK-REHEARSAL-001 — GO/NO-GO Report

- Task: `HCC-ROLLBACK-REHEARSAL-001`
- Date: 2026-06-14
- Source: `ec1e8febc96d982638044caa544c356be0c2dc12` (`origin/hermes-pro-main`)
- Module: `src/shared/lib/hcc-rollback-rehearsal.ts`

## 0. Headline verdict

| Question | Answer |
|---|---|
| Rehearsal contract landed? | **YES** — 38 tests PASS |
| Default non-executing? | **YES** — `would_execute: false`, `executed_commands: []` |
| Allowed strategies? | **YES** — 4 (`git_revert_commit`, `drop_commit`, `restore_file_from_origin`, `abort_if_dirty_worktree`) |
| Forbidden strategies? | **YES** — 8 (destructive git, shell, hermes, package, IPC, timer) |
| Rehearsal does not imply real execution? | **YES** (gate 2) |
| Rehearsal does not imply unattended execution? | **YES** (gate 3) |
| Real execution? | **NO-GO** |
| Unattended execution? | **NO-GO** |
| Night-run? | **NO-GO** |

## 1. Strategy matrix verified

| Strategy | Risk | Verdict | Reason |
|---|---|---|---|
| `git_revert_commit` | low (proposal) | `rehearse` | gate passes |
| `drop_commit` | low (proposal) | `rehearse` | gate passes |
| `restore_file_from_origin` | low (proposal) | `rehearse` | gate passes |
| `abort_if_dirty_worktree` + clean | inert | `rehearse` (inert) | gate 4 |
| `abort_if_dirty_worktree` + dirty | refusal | `abort_dirty_worktree` | gate 4 |
| `git_reset_hard` | forbidden | `deny` | gate 1 |
| `git_checkout_destructive` | forbidden | `deny` | gate 1 |
| `git_push` | forbidden | `deny` | gate 1 |
| `shell_spawn` | forbidden | `deny` | gate 1 |
| `hermes_config_write` | forbidden | `deny` | gate 1 |
| `package_mutation` | forbidden | `deny` | gate 1 |
| `ipc_register` | forbidden | `deny` | gate 1 |
| `timer_register` | forbidden | `deny` | gate 1 |
| `implies_real_execution=true` (any strategy) | n/a | `deny` | gate 2 |
| `implies_unattended=true` (any strategy) | n/a | `deny` | gate 3 |

## 2. Artifact invariants (all verified literal in source)

| Field | Value | Pinned by |
|---|---|---|
| `would_execute` | `false` | "git_revert_commit rehearsal records would_execute=false" |
| `executed_commands` | `[]` | same |
| `subprocess_count` | `0` | "git_revert_commit rehearsal records would_execute=false" |
| `implies_real_execution` | `false` | "denies when caller claims implies_real_execution=true" |
| `implies_unattended` | `false` | "denies when caller claims implies_unattended=true" |
| `night_run_ready` (posture) | `false` | posture test |
| `go_no_go` (posture) | `"NO-GO"` | posture test |

## 3. Gates

| # | Gate | Status |
|---|---|---|
| G1 | Clean rehearsal plan | ✅ (3 tests) |
| G2 | Dirty worktree abort | ✅ (2 tests) |
| G3 | Forbidden rollback strategy deny | ✅ (8 tests, one per forbidden strategy) |
| G4 | Artifact has `executed_commands=[]` | ✅ (in all 8 forbidden + 4 allowed) |
| G5 | Rehearsal does not imply real execution | ✅ |
| G6 | Rehearsal does not imply unattended execution | ✅ |
| G7 | `night_run_ready=false` / `go_no_go="NO-GO"` preserved | ✅ |
| G8 | No `git reset --hard` / `git checkout` / `git push` command | ✅ (static guard) |
| G9 | No `spawn` / `exec` / `child_process` | ✅ (static guard) |
| G10 | No `ipcMain` / `setInterval` / `setTimeout` | ✅ (static guard) |
| G11 | No `~/.hermes` write | ✅ (static guard) |
| G12 | `src/main/index.ts` unchanged | ✅ |

12/12 ✅.

## 4. Verdict

| Question | Verdict |
|---|---|
| Rehearsal contract sufficient? | **YES** |
| Real execution authorized? | **NO** |
| Unattended execution authorized? | **NO** |
| Night-run authorized? | **NO** |
| **GO COMMIT** | ✅ ready |
| **GO PUSH** | held |

## 5. Minimum next slice

```
HCC-BUDGET-RATE-LIMIT-001
  scope: calibrate tokens / wall-clock / subprocess budget against
         a controlled dry-run; document nominal defaults;
         gate #5 of night-run readiness flips satisfied=true
  pre:   re-run §3 gates on the calibration working copy
  does not: flip night_run_ready; flip go_no_go; write ~/.hermes/**;
           auto-apply; auto-arm; run real commands
```

## 6. Next prompt

> 1. **`GO COMMIT`** — commit 5 files. Push held.
> 2. **`GO PUSH`** — push to `origin`. Requires commit first.
> 3. **`GO HCC-BUDGET-RATE-LIMIT-001`** — next distance-to-night-run slice.
> 4. **No GO** — stop here.