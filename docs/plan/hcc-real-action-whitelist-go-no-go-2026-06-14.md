# HCC-REAL-ACTION-WHITELIST-001 — GO/NO-GO Report

- Task: `HCC-REAL-ACTION-WHITELIST-001`
- Date: 2026-06-14
- Source: `ec15ad190012e081bd25eaa5456ab47edfdaee50` (`origin/hermes-pro-main`)
- Module: `src/shared/lib/hcc-real-action-whitelist.ts`

## 0. Headline verdict

| Question | Answer |
|---|---|
| Whitelist contract landed? | **YES** — pure contract module, 48 tests PASS |
| Default deny? | **YES** — literal `default_deny: true` in posture |
| Closed-by-default surface set? | **YES** — 11 forbidden surfaces |
| Allowed low-risk actions? | **YES** — 4 entries (`read_repo_status`, `git_diff_inspection`, `propose_test_run`, `propose_docs_update`) |
| Dangerous actions refused? | **YES** — denies or `requires_user_approval` for moderate |
| Whitelist cannot imply unattended readiness? | **YES** — gate 6 denies any `unattended_ready=true` input |
| Real execution? | **NO-GO** |
| Unattended execution? | **NO-GO** |
| Night-run? | **NO-GO** |

## 1. Decision matrix verified

| Action class | Surface | Risk | Default | Result |
|---|---|---|---|---|
| `read_repo_status` | `repo_local_read` | low | `allow` | ✅ |
| `git_diff_inspection` | `repo_local_read` | low | `allow` | ✅ |
| `propose_test_run` | `test_run_dry` | low | `allow` (verifier-test-proposal) | ✅ |
| `propose_docs_update` | `docs_propose_only` | low | `allow` (rollback=git_revert_commit) | ✅ |
| `repo_local_dry_run_mutate` | `repo_local_dry_run_mutate` | moderate | `requires_user_approval` | ✅ |
| `real_command_execution` | (empty) | high | `deny` | ✅ |
| unknown id | any | n/a | `deny` (default) | ✅ |
| forbidden surface (any of 11) | any | forbidden | `deny` (gate 1) | ✅ |
| `implies_unattended=true` | any | n/a | `deny` (gate 2) | ✅ |
| `touches_hermes_config=true` | any | n/a | `deny` (gate 3) | ✅ |
| `requires_shell_spawn=true` | any | n/a | `deny` (gate 4) | ✅ |
| `auto_apply=true` | any | n/a | `deny` (gate 5) | ✅ |
| caller `unattended_ready=true` | any | n/a | `deny` (gate 6) | ✅ |
| surface not in entry.allowed_surfaces | mixed | n/a | `deny` (gate 8) | ✅ |

## 2. Forbidden surfaces (closed-by-default)

`shell_spawn`, `git_push`, `git_destructive`, `hermes_config_write`, `package_install`, `ipc_register`, `timer_register`, `browser_action`, `external_publish`, `credential_access`, `live_apply` — verified by 11 individual test cases.

## 3. Gates

| # | Gate | Status |
|---|---|---|
| G1 | Default deny | ✅ |
| G2 | Allowed low-risk actions | ✅ (4) |
| G3 | Dangerous actions refused | ✅ |
| G4 | Whitelist cannot imply unattended readiness | ✅ |
| G5 | `night_run_ready=false` / `go_no_go="NO-GO"` preserved | ✅ (6 invariant hits) |
| G6 | No spawn / exec / child_process | ✅ (static guard) |
| G7 | No IPC | ✅ (static guard) |
| G8 | No timer | ✅ (static guard) |
| G9 | No `~/.hermes` write | ✅ (contract comment only) |
| G10 | `src/main/index.ts` unchanged | ✅ |

10/10 ✅.

## 4. Verdict

| Question | Verdict |
|---|---|
| Whitelist contract sufficient? | **YES** |
| Real execution authorized? | **NO** |
| Unattended execution authorized? | **NO** |
| Night-run authorized? | **NO** |
| **GO COMMIT** | ✅ ready |
| **GO PUSH** | held |

## 5. Minimum next slice

```
HCC-ROLLBACK-REHEARSAL-001 (per NEXT_STEP distance-to-night-run list)
  scope: complete one controlled rollback rehearsal in an isolated worktree;
         record the artifact; gate #2 of night-run readiness flips satisfied=true
  pre:   re-run §3 gates on the rehearsal working copy
  does not: flip night_run_ready; flip go_no_go; write ~/.hermes/**;
           auto-apply; auto-arm; run real commands
```

## 6. Next prompt

> 1. **`GO COMMIT`** — commit 5 files. Push held.
> 2. **`GO PUSH`** — push to `origin`. Requires commit first.
> 3. **`GO HCC-ROLLBACK-REHEARSAL-001`** — next distance-to-night-run slice.
> 4. **No GO** — stop here.