# HCC-REAL-ACTION-WHITELIST-001 — Implementation Preflight

- Task: `HCC-REAL-ACTION-WHITELIST-001`
- Date: 2026-06-14
- Branch: `hcc-real-action-whitelist-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `ec15ad1 docs: clarify unattended execution wording` on `origin/hermes-pro-main`
- Scope: **real action whitelist contract only**. Default deny. Closed-by-default surface set. No real execution. No `~/.hermes/**` write. No Auto Executor start. No P3 real execution.

## 1. Canonical repo baseline

| Fact | Value |
|---|---|
| `HEAD` (worktree) | `ec15ad190012e081bd25eaa5456ab47edfdaee50` (= `origin/hermes-pro-main`) |
| `origin` | `ec15ad190012e081bd25eaa5456ab47edfdaee50` |
| HCC minimal dry-run loop | closed (P3 010 verifier at `9c514f7`) |
| real execution / unattended execution / `~/.hermes/**` write | **NOT APPROVED / NO-GO** |
| `night_run_ready` literal | `false` (in `src/shared/lib/hcc-controlled-executor.ts`) |
| `go_no_go` literal | `"NO-GO"` (same) |

## 2. Working tree

| Path | Status | Reason |
|---|---|---|
| `src/shared/lib/hcc-real-action-whitelist.ts` | A | whitelist contract (allow/deny/requires_user_approval) |
| `tests/auto-executor/hcc-real-action-whitelist.test.ts` | A | 48 tests covering default deny, allowed low-risk, dangerous surfaces, unattended refusal, controlled-executor invariants, src static guard |
| `docs/plan/hcc-real-action-whitelist-preflight-2026-06-14.md` | A | this preflight |
| `docs/closeout/hcc-real-action-whitelist-001-closeout-2026-06-14.md` | A | closeout |
| `docs/plan/hcc-real-action-whitelist-go-no-go-2026-06-14.md` | A | GO/NO-GO report |

Files **NOT** staged:
- `src/main/index.ts` — unchanged
- `package.json` / `package-lock.json` — unchanged
- `~/.hermes/**` — not touched at all
- `docs/knowledge/vault-health-report-2026-06-12.md` — policy-excluded drift

## 3. Verification

| Gate | Result |
|---|---|
| `npm run typecheck:node` | EXIT 0 |
| `npx vitest run tests/auto-executor/hcc-real-action-whitelist.test.ts` | 48/48 PASS |
| `npx vitest run tests/auto-executor/` | 9 files / 197 tests PASS |
| `git diff --check` | clean |
| `rg "night_run_ready: false\|go_no_go: \"NO-GO\"" src/shared/lib/hcc-controlled-executor.ts` | 6 hits, unchanged |
| `rg "spawn\(\|exec\(\|child_process\|ipcMain\|setInterval\|setTimeout\|~/.hermes" src/shared/lib/hcc-real-action-whitelist.ts` | comments only (in forbidden-surface doc list); static guard test pins no code call |

## 4. What this slice adds

`src/shared/lib/hcc-real-action-whitelist.ts` (~280 lines, pure):

- `HCCRealActionDescriptor` (id, surfaces, implies_unattended, touches_hermes_config, requires_shell_spawn, auto_apply)
- `HCCRealActionWhitelistEntry` with literal-false flags: `may_imply_unattended: false`, `may_touch_hermes_config: false`, `may_shell_spawn: false`
- `HCCRealActionDecision` = `allow` | `deny` | `requires_user_approval`
- `HCCRealActionRiskLevel` = `low` | `moderate` | `high` | `forbidden`
- `HCC_REAL_ACTION_WHITELIST` built-in matrix of 6 candidate actions:
  - `read_repo_status` → allow (low)
  - `git_diff_inspection` → allow (low)
  - `propose_test_run` → allow (low; test_run_dry surface; verifier-test-proposal)
  - `propose_docs_update` → allow (low; docs_propose_only surface; rollback = git_revert_commit)
  - `repo_local_dry_run_mutate` → requires_user_approval (moderate; rollback = git_revert_commit)
  - `real_command_execution` → deny (high)
- `decideRealAction(input)` enforces 9 gates:
  1. forbidden surface → deny
  2. `implies_unattended` → deny
  3. `touches_hermes_config` → deny
  4. `requires_shell_spawn` → deny
  5. `auto_apply` → deny
  6. caller-set `unattended_ready=true` → deny (whitelist cannot imply unattended readiness)
  7. unknown id → deny
  8. surface not in entry.allowed_surfaces → deny
  9. entry's `default_decision` is the result
- `getHccRealActionWhitelistPosture()` returns literal-`true` `default_deny`, literal-`false` `night_run_ready`, literal-`"NO-GO"` `go_no_go`, plus `may_imply_unattended: false`, `may_touch_hermes_config: false`, `may_shell_spawn: false`

## 5. Forbidden surfaces (closed-by-default)

`shell_spawn`, `git_push`, `git_destructive`, `hermes_config_write`, `package_install`, `ipc_register`, `timer_register`, `browser_action`, `external_publish`, `credential_access`, `live_apply` — any descriptor with at least one of these is denied by gate 1.

## 6. Decision

| Question | Verdict |
|---|---|
| Whitelist contract sufficient? | **YES** (default deny + closed-by-default surface set) |
| Real execution authorized? | **NO** |
| Unattended execution authorized? | **NO** |
| Night-run authorized? | **NO** |
| Auto Executor 常驻? | **NO** |
| `~/.hermes/**` write? | **NO** |
| Commit? | **YES** |
| Push? | **held** |

## 7. Next prompt

> 1. **`GO COMMIT`** — commit 5 files. Push held.
> 2. **`GO PUSH`** — push to `origin`. Requires commit first.
> 3. **No GO** — stop here.