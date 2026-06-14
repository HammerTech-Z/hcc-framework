# HCC-ROLLBACK-REHEARSAL-001 — Implementation Preflight

- Task: `HCC-ROLLBACK-REHEARSAL-001`
- Date: 2026-06-14
- Branch: `hcc-rollback-rehearsal-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `ec1e8fe hcc: add real action whitelist contract`
- Scope: **rollback rehearsal contract only**. No real git command. No shell. No `~/.hermes/**` write. No Auto Executor start.

## 1. Canonical repo baseline

| Fact | Value |
|---|---|
| `HEAD` (worktree) | `ec1e8febc96d982638044caa544c356be0c2dc12` (= `origin/hermes-pro-main`) |
| `origin` | `ec1e8febc96d982638044caa544c356be0c2dc12` |
| HCC minimal dry-run loop | closed (`9c514f7`) |
| HCC real action whitelist | landed (`ec1e8fe`) |
| real execution / unattended execution / `~/.hermes/**` write | **NOT APPROVED / NO-GO** |
| `night_run_ready` literal | `false` |
| `go_no_go` literal | `"NO-GO"` |

## 2. Working tree

| Path | Status | Reason |
|---|---|---|
| `src/shared/lib/hcc-rollback-rehearsal.ts` | A | rehearsal contract |
| `tests/auto-executor/hcc-rollback-rehearsal.test.ts` | A | 38 tests |
| `docs/plan/hcc-rollback-rehearsal-preflight-2026-06-14.md` | A | this preflight |
| `docs/closeout/hcc-rollback-rehearsal-001-closeout-2026-06-14.md` | A | closeout |
| `docs/plan/hcc-rollback-rehearsal-go-no-go-2026-06-14.md` | A | GO/NO-GO report |

Files **NOT** staged:
- `src/main/index.ts` — unchanged
- `package.json` / `package-lock.json` — unchanged
- `~/.hermes/**` — not touched
- `docs/knowledge/vault-health-report-2026-06-12.md` — policy-excluded drift

## 3. Verification

| Gate | Result |
|---|---|
| `npm run typecheck:node` | EXIT 0 (pre-existing `playbook.ts:132` warning is not in this slice) |
| `npx vitest run tests/auto-executor/hcc-rollback-rehearsal.test.ts` | 38/38 PASS |
| `npx vitest run tests/auto-executor/` | 10 files / 235 tests PASS |
| `git diff --check` | clean |
| `git diff --name-status -- src/main/index.ts package.json package-lock.json` | empty |
| `rg "night_run_ready: false\|go_no_go: \"NO-GO\""` | 6 hits, unchanged |
| `rg "reset --hard\|git checkout\|git push\|spawn\(\|exec\(\|child_process\|ipcMain\|setInterval\|setTimeout\|~/.hermes" src/shared/lib/hcc-rollback-rehearsal.ts` | doc comments only (forbidden-strategy list) |

## 4. What this slice adds

`src/shared/lib/hcc-rollback-rehearsal.ts` (~290 lines, pure):

- `HCCRollbackStrategy` = 12-strategy enum (4 allowed, 8 forbidden)
- `HCC_ROLLBACK_ALLOWED_STRATEGIES` = 4 entries:
  - `git_revert_commit` (proposal only)
  - `drop_commit` (proposal only)
  - `restore_file_from_origin` (proposal only)
  - `abort_if_dirty_worktree` (refusal/inert)
- `HCC_ROLLBACK_FORBIDDEN_STRATEGIES` = 8 entries:
  - `git_reset_hard`, `git_checkout_destructive`, `git_push`
  - `shell_spawn`, `hermes_config_write`, `package_mutation`
  - `ipc_register`, `timer_register`
- `rehearseRollback(input)` enforces 4 gates:
  1. forbidden strategy → deny
  2. `implies_real_execution=true` → deny
  3. `implies_unattended=true` → deny
  4. `abort_if_dirty_worktree` + `worktree_dirty=true` → `abort_dirty_worktree`; else `rehearse`
- Result literal fields: `would_execute: false`, `executed_commands: []`, `subprocess_count: 0`, `implies_unattended: false`, `implies_real_execution: false`
- `getHccRollbackRehearsalPosture()` returns literal-`false` / literal-`"NO-GO"` posture

## 5. Decision

| Question | Verdict |
|---|---|
| Rehearsal contract sufficient? | **YES** |
| Real execution authorized? | **NO** |
| Unattended execution authorized? | **NO** |
| Night-run authorized? | **NO** |
| Commit? | **YES** |
| Push? | **held** |

## 6. Next prompt

> 1. **`GO COMMIT`** — commit 5 files. Push held.
> 2. **`GO PUSH`** — push to `origin`. Requires commit first.
> 3. **No GO** — stop here.