# HCC-AUTO-EXECUTOR-EXEC-IMPL-001 — Implementation Preflight

- Task: `HCC-AUTO-EXECUTOR-EXEC-IMPL-001`
- Date: 2026-06-13
- Branch: `hcc-auto-executor-exec-impl-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001` (committed at `b8e4048`, then base shifted by `HCC-CONTROLLED-EXECUTOR-READINESS-001` commit `39e9745` on `origin/hermes-pro-main`)
- Scope: **host lifecycle implementation + lifecycle tests**. No bootstrap wiring, no live execution, no surface open.

---

## 1. Canonical repo baseline (verified locally 2026-06-13)

| Fact | Value |
|---|---|
| Worktree | `/Users/midoudou/hermes-pro-work/.claude/worktrees/hcc-auto-executor-exec-impl-001` |
| Branch | `hcc-auto-executor-exec-impl-001` (tracks `origin/hermes-pro-main`) |
| `git rev-parse HEAD` | `39e974508e7935d7775acb8d484bb97a45564ae7` |
| `git rev-parse origin/hermes-pro-main` | `39e974508e7935d7775acb8d484bb97a45564ae7` |
| HEAD == origin | **true** |
| Audit preflight (on origin) | `a6503ac2fdd0406d972e6b072886df1b6bed234f` |
| Audit closeout (on origin) | `041cf3a12e8608a576133c0e111d6aae81d6803e` |
| Impl preflight (on origin) | `be7053fd5e7ec538aaed8d8fec60e9c31546bc0d` |
| Implementation (on origin) | `466e42bb0d0105f20693d211c8d42c8415afceb7` |
| Implementation buglog (on origin) | `d0062abad3ee87a6670816c8cfebdb00326f0430` |
| Execution preflight (on origin) | `b8e4048903744ff779148e2846546ac6b5cf2198` |
| Controlled-executor readiness (on origin) | `39e974508e7935d7775acb8d484bb97a45564ae7` |
| Boundary library | `src/shared/lib/auto-executor/**` (10 files, idle) |
| New module | `src/main/auto-executor-host.ts` (~260 lines) |
| New test | `tests/auto-executor/host-lifecycle.test.ts` (~200 lines, 21 tests) |
| Targeted vitest (host-lifecycle) | **21/21 PASS** |
| Targeted vitest (auto-executor dir) | **4 files, 78 tests PASS** |
| Full vitest (`tests/safety`) | **36 files, 988 tests PASS** (no regression) |
| `npm run typecheck:node` | EXIT 0 |
| `git diff --check` | clean |
| `night_run_ready` literal | `false` (type-hard-wired, unchanged) |
| `go_no_go` literal | `"NO-GO"` (unchanged) |

## 2. Working tree at preflight time (named explicitly)

Files staged or staged-to-be by this commit:

| Path | Status | Reason |
|---|---|---|
| `src/main/auto-executor-host.ts` | A | New host lifecycle module |
| `tests/auto-executor/host-lifecycle.test.ts` | A | New lifecycle vitest |
| `docs/plan/hcc-auto-executor-exec-impl-preflight-2026-06-13.md` | A | This preflight |
| `docs/closeout/hcc-auto-executor-exec-impl-001-closeout-2026-06-13.md` | A | Closeout companion |
| `docs/plan/hcc-auto-executor-exec-impl-go-no-go-2026-06-13.md` | A | GO/NO-GO report |

Files **NOT** staged by this commit:
- `package.json` / `package-lock.json` — untouched (no new deps)
- `src/shared/lib/auto-executor/**` — untouched (boundary library is the trust root; host imports it but does not modify it)
- `src/renderer/**` / `src/preload/**` / `src/screens/**` — untouched
- `~/.hermes/**` — not touched
- `docs/knowledge/vault-health-report-2026-06-12.md` — policy-excluded telemetry drift, not part of this slice
- `src/main/index.ts` — untouched (bootstrap activation is a separate explicit GO per exec-preflight §4.4)

## 3. Verification (gates re-run at preflight time)

| Gate | Result |
|---|---|
| `git rev-parse HEAD` | `39e974508e7935d7775acb8d484bb97a45564ae7` |
| `git rev-parse origin/hermes-pro-main` | `39e974508e7935d7775acb8d484bb97a45564ae7` |
| `npm run typecheck:node` | EXIT 0 |
| `npx vitest run tests/auto-executor/host-lifecycle.test.ts` | 21/21 PASS |
| `npx vitest run tests/auto-executor/` | 4 files, 78 tests PASS |
| `npx vitest run tests/safety` | 36 files, 988 tests PASS (no regression) |
| `git diff --check` | clean |
| `rg "night_run_ready: false\|go_no_go: \"NO-GO\"\|requires_user_approval\|Auto Executor" src tests docs` | hits in this slice's source + contracts (unchanged from prior slices) |

## 4. Host lifecycle contract (exec-preflight §5)

The host `src/main/auto-executor-host.ts` satisfies all 8 contract items from exec-preflight §5:

| §5 Item | Test |
|---|---|
| 1. Construction without state change (state=`constructed`, alive=true, subprocess_count=0) | "construction does not change state (initial = constructed)" |
| 2. Arming with invalid token refuses; state stays `constructed` | "arm with invalid token refuses and state stays constructed" |
| 3. Arming with valid token flips state to `armed` | "arm with valid token flips state to armed" |
| 4. `assertReady` reflects state + kill switch + worktree guard | "assertReady via boundary reflects state, kill switch, worktree guard" |
| 5. `start()` returns false from `constructed`; true from `armed` | "start() from constructed returns false" + "start() from armed returns true" |
| 6. Action is mock / no-op; `would_execute: false`, no spawn | "runMockAction returns would_execute:false; no spawn occurs" |
| 7. `abort()` triggers kill switch; state=`aborted`; `isKilled()=true` | "abort() triggers kill switch and sets state to aborted" |
| 8. `disarm()` while running is a no-op | "disarm() while running is a no-op (state stays running)" |

Additional lifecycle hooks (per task brief):

| Hook | Test coverage |
|---|---|
| `health()` | reports subprocess_count=0, max_subprocess_count=0, mode, sampled_at |
| `status()` | pins go_record_sha, branch, head, cwd |
| `grantLease` / `checkLease` / `expireLease` | lease lifecycle + null for unknown task |
| `getTimeoutConfig` / `setTimeoutConfig` | defaults 30min/60s, override works |
| `rollbackHook(actionId)` | descriptive-only, found=false |
| `runMockAction` admission | deny → throws; requires_user_approval → returns without throwing |

## 5. What this slice adds

- **`src/main/auto-executor-host.ts`** (~260 lines)
  - `createAutoExecutorHost(config)` factory
  - Host modes: `"dry_run"` (default) / `"controlled"`; `"live_run"` rejected at construction
  - Subprocess count literal `0` in `HostHealth`; `max_subprocess_count` literal `0`
  - `runMockAction()` delegates admission to `decideTaskAdmission()` from `src/shared/lib/hcc-controlled-executor.ts` (the contract layer)
  - `arm`/`start`/`abort`/`disarm`/`assertReady` delegated to boundary
  - `safeExec.allowlist.binaries` = empty Set (closed-by-default)
  - `secretAllowlist` = empty Set (closed-by-default)
  - `hermesWriteGuard` = constructed with `tokenSecret` only (no `isWriteAllowed` override; closed-by-default behavior inherited from boundary)
  - All 6 dangerous action classes (`install_dependency`/`file_deletion`/`external_publish`/`credential_access`/`browser_action`/`live_apply`) return `requires_user_approval` via the contract layer; the host does not throw — the caller is responsible for honoring the approval gate

- **`tests/auto-executor/host-lifecycle.test.ts`** (~200 lines, 21 tests)
  - All 8 §5 contract tests + 10 lifecycle hook tests + 3 config validation tests

## 6. What this slice does NOT add

- No bootstrap wiring — `src/main/index.ts` does not import `auto-executor-host.ts`
- No new dependencies — `package.json` / `package-lock.json` unchanged
- No boundary-library changes — `src/shared/lib/auto-executor/**` untouched
- No subprocess spawning — `runMockAction` returns `would_execute: false`
- No IPC handler registration
- No daemon, no cron, no weixin, no live apply
- No `~/.hermes/**` writes
- No `git push` of this commit (push held for separate user GO)

## 7. Predecessor linkage

| Predecessor | Status | Linkage |
|---|---|---|
| `HCC-AUTO-EXECUTOR-AUTH-AUDIT-001` | ✅ closed (`041cf3a`) | established 8 preconditions |
| `HCC-AUTO-EXECUTOR-AUTH-IMPL-PREFLIGHT-001` | ✅ closed (`be7053f`) | addressed 8 preconditions in §4 |
| `HCC-AUTO-EXECUTOR-AUTH-IMPL-001` | ✅ landed (`466e42b`) | materialized `src/shared/lib/auto-executor/**` (boundary library) |
| `HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001` | ✅ closed (`b8e4048`) | scoped host location + lifecycle test contract |
| `HCC-CONTROLLED-EXECUTOR-READINESS-001` | ✅ landed (`39e9745`) | established `decideTaskAdmission` + `night_run_ready` literal `false` |

This slice (`HCC-AUTO-EXECUTOR-EXEC-IMPL-001`) materializes the host per exec-preflight §4, satisfies §5 lifecycle tests, and uses `decideTaskAdmission` from the controlled-executor readiness slice for admission policy.

## 8. Decision

| Question | Verdict |
|---|---|
| Is the **host lifecycle scope** sufficient? | **YES** — §4 contract + §5 lifecycle tests cover the minimum surface |
| May the host implementation be **committed**? | **YES** — host module + tests; no bootstrap; no surface open |
| May the host implementation be **pushed**? | **held** — push requires separate user GO |
| Is **bootstrap activation** authorized? | **NO** — separate explicit GO required (exec-preflight §4.4) |
| Is **night-run auto-execution** authorized? | **NO** — `night_run_ready` literal `false`; report says `NO-GO` |

## 9. Still NOT authorized (explicit redline list)

| Surface | State |
|---|---|
| Apply path | **closed** |
| Auto Executor runtime | **not started** |
| Live Ranking mutation | **closed** |
| Live Flush auto-apply | **closed** |
| `~/.hermes/**` writes | **off** |
| `git push` of execution-enabling change | **held** |
| Bootstrap activation (host into `src/main/index.ts`) | **held** (next slice) |
| Night-run auto-execution | **NO-GO** (literal `false`) |

Any drift from this table is a redline violation. Stop and report.

---

## 10. Bellard-perspective

- **One module, one factory.** ~260 lines including comments. No class hierarchies, no DI containers, no observables.
- **No new dependency, no runtime, no daemon.** `package.json` untouched. The host compiles and returns objects; it does not start a process, register IPC, or spawn a subprocess. This is correct for a pre-execution host.
- **Each `false` is a literal.** `subprocess_count: 0`, `max_subprocess_count: 0`, `would_execute: false`. The type system forces callers to handle the false branch. Editing the literal is the audit signal.
- **Default OFF is enforced at the module level.** The host file does not export a side-effectful entry point. Importing it has no observable effect. Bootstrapping it from `src/main/index.ts` is a separate GO.
- **Boring is correct.** A host lifecycle that says "construction → arm → start → running, no spawn" is the most useful host possible right now.

## 11. Karpathy-perspective

- **No false clean-state claim.** §2 names the staged files. §3 records gate results without overstating.
- **Host ≠ runtime.** This host does not start itself. The boundary inside it does not start itself. The only way to start is to (a) construct the host, (b) arm with a valid token, (c) call `start()`. None of these happen without a test or a future bootstrap GO.
- **Lifecycle tests are pinned.** All 8 §5 contract items are pinned by named tests. Drift is detectable in CI.
- **Admission policy is shared, not duplicated.** The host delegates to `decideTaskAdmission()` from the controlled-executor readiness slice. The two source-of-truth patterns (preflight admission + host lifecycle) stay aligned.
- **Tail-risks named.** Health always reports `subprocess_count=0` and `max_subprocess_count=0`; rollback is descriptive-only; abort triggers kill switch + state=aborted; disarm while running is a no-op (state stays running). Each is pinned by a test.
- **Unknowns named.** `night_run_ready` remains `false` literal; `go_no_go` remains `"NO-GO"`. Bootstrap activation is held for a separate GO. Night-run auto-execution is held until all 5 night-run readiness gates flip.

---

## 12. Next prompt (commit + push + next slice)

> Implementation `HCC-AUTO-EXECUTOR-EXEC-IMPL-001` complete in isolated worktree `hcc-auto-executor-exec-impl-001`. Host lifecycle §5 contract satisfied. Auto Executor **execution** is still NOT authorized. Auto Executor **bootstrap activation** is unblocked as a separate step.
>
> Issue one of:
>
> 1. **`GO commit impl`** — commit the 5 new files onto `hcc-auto-executor-exec-impl-001`. Push held.
> 2. **`GO push impl`** — push the commit to `origin/hermes-pro-main`. Requires commit GO first.
> 3. **`GO HCC-AUTO-EXECUTOR-BOOTSTRAP-001`** — begin bootstrap activation (host into `src/main/index.ts`) with separate GO. Not yet issued; this slice does not request it.
> 4. **No GO** — stop here. Files stay local; nothing is committed or pushed.