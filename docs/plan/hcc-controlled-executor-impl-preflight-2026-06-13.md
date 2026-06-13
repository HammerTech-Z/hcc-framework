# HCC-CONTROLLED-EXECUTOR-READINESS-001 — Implementation Preflight

- Task: `HCC-CONTROLLED-EXECUTOR-READINESS-001`
- Date: 2026-06-13
- Branch: `hcc-controlled-executor-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001` (committed at `b8e4048` on `origin`)
- Scope: **docs + one pure shared-lib module + one pure test file**. No host wiring, no bootstrap, no live execution, no surface open.

---

## 1. Canonical repo baseline (verified locally 2026-06-13)

| Fact | Value |
|---|---|
| Worktree | `/Users/midoudou/hermes-pro-work/.claude/worktrees/hcc-controlled-executor-001` |
| Branch | `hcc-controlled-executor-001` (tracks `origin/hermes-pro-main`) |
| `git rev-parse HEAD` | `b8e4048903744ff779148e2846546ac6b5cf2198` |
| `git rev-parse origin/hermes-pro-main` | `b8e4048903744ff779148e2846546ac6b5cf2198` |
| HEAD == origin | **true** |
| Audit preflight (on origin) | `a6503ac2fdd0406d972e6b072886df1b6bed234f` |
| Audit closeout (on origin) | `041cf3a12e8608a576133c0e111d6aae81d6803e` |
| Implementation preflight (on origin) | `be7053fd5e7ec538aaed8d8fec60e9c31546bc0d` |
| Implementation (on origin) | `466e42bb0d0105f20693d211c8d42c8415afceb7` |
| Implementation buglog (on origin) | `d0062abad3ee87a6670816c8cfebdb00326f0430` |
| Execution preflight (on origin) | `b8e4048903744ff779148e2846546ac6b5cf2198` (this commit) |
| Boundary library | `src/shared/lib/auto-executor/**` (10 files, idle) |
| `night_run_ready` literal | `false` (type-hard-wired) |

## 2. Working tree at preflight time (named explicitly)

The worktree is isolated off `origin/hermes-pro-main`. `git status --short -uall` reports only the two new files this slice intends to stage:

| Path | Status | Reason | Action this commit |
|---|---|---|---|
| `src/shared/lib/hcc-controlled-executor.ts` | `A` | New pure shared-lib module | **staged by this commit** |
| `tests/safety/hcc-controlled-executor.test.ts` | `A` | New pure vitest | **staged by this commit** |
| `docs/plan/hcc-controlled-executor-impl-preflight-2026-06-13.md` | `A` | This preflight | **staged by this commit** |
| `docs/closeout/hcc-controlled-executor-readiness-001-closeout-2026-06-13.md` | `A` | Closeout companion | **staged by this commit** |
| `docs/plan/hcc-controlled-executor-night-run-readiness-2026-06-13.md` | `A` | Night-run NO-GO report | **staged by this commit** |

Files **NOT staged** by this commit:
- `package.json` / `package-lock.json` — untouched
- `src/main/**` / `src/renderer/**` / `src/screens/**` / `src/preload/**` — untouched (locked paths)
- `src/shared/lib/auto-executor/**` — untouched (boundary library; wiring is a separate GO)
- `~/.hermes/**` — not touched at all (no per-write approval given)

The preflight does **not** claim the working tree is clean upstream — `docs/knowledge/vault-health-report-2026-06-12.md` and `.claude/settings.json` are policy-excluded drift on the upstream worktree, not on this isolated worktree.

## 3. Verification (gates re-run at preflight time)

| Gate | Result |
|---|---|
| `git rev-parse HEAD` | `b8e4048903744ff779148e2846546ac6b5cf2198` |
| `git rev-parse origin/hermes-pro-main` | `b8e4048903744ff779148e2846546ac6b5cf2198` |
| `npm run typecheck:node` | EXIT 0 (no errors) |
| `npx vitest run tests/safety/hcc-controlled-executor.test.ts` | 23/23 PASS |
| `npx vitest run tests/safety` | 36 files, 988 tests PASS (no regression) |
| `git diff --check` | clean |
| `rg -n "HCC Controlled Executor\|night_run_ready\|controlled_executor_ready\|requires_user_approval\|night-run readiness" src tests/safety/hcc-controlled-executor.test.ts` | all hits are this slice (pre-existing matches in model-strategy / profile-rollout / handoff-policy are unrelated) |

## 4. What this slice adds

A single pure module `src/shared/lib/hcc-controlled-executor.ts` containing six pure submodules:

1. **Readiness gate** — three explicit levels (`dry_run_ready` / `controlled_executor_ready` / `night_run_ready`); `night_run_ready` is `false` literal at the type level. `isNightRunReady()` returns the literal `false` regardless of input. The only way to make night-run go is to edit this file, which is itself the audit signal.
2. **Task admission policy** — single-task / single-branch / single-commit-candidate / isolated-worktree gate. Six action classes (`install_dependency`, `file_deletion`, `external_publish`, `credential_access`, `browser_action`, `live_apply`) are hard-wired to `requires_user_approval`. Everything else in an isolated worktree is `allow`.
3. **Executor dry-run harness** — `buildTaskPlan()` constructs a `TaskPlan` with literal-false `executable`/`executed` fields and `[DRY-RUN]`-prefix enforcement on every planned command. No exec, no spawn. `RollbackInstruction` defaults to `git_revert_commit`; the `git_reset_to_origin` strategy is documented as `DESTRUCTIVE; requires user approval`.
4. **Health check contract** — git clean / branch / origin HEAD / typecheck / target test, all `[DRY-RUN]`-prefixed planned commands. Six explicit stop conditions. `max_subprocess_count: 0` literal. Budgets (tokens / wall-seconds / subprocess count) are nominal and require calibration.
5. **Audit artifact contract** — captures `task_id`, admission input, planned commands, executed commands (always `[]`), verifier verdict, rollback point, and final state (one of `dry_run_completed` / `admission_denied` / `requires_user_approval`).
6. **Night-run readiness report** — five gates all `satisfied: false`; output is hard-wired `night_run_ready: false` and `go_no_go: "NO-GO"`. `minimum_next_slice` points to `HCC-AUTO-EXECUTOR-EXEC-IMPL-001`.

A side-effect assertion `assertControlledExecutorNoSideEffects()` returns a literal-true report covering `no_spawn` / `no_ipc_registration` / `no_daemon` / `no_cron` / `no_weixin` / `no_live_apply` / `no_hermes_writes` / `night_run_ready_literal_false`.

## 5. What this slice does NOT add

- No host module (e.g. `src/main/auto-executor-host.ts` does not exist; not introduced here).
- No bootstrap wiring into `src/main/index.ts`.
- No boundary-library changes — `src/shared/lib/auto-executor/**` is untouched.
- No new dependencies — `package.json` / `package-lock.json` unchanged.
- No daemon, no cron, no weixin, no channel runtime, no live apply.
- No `~/.hermes/**` writes.
- No `git push` of this commit (push held for separate user GO).

## 6. Predecessor linkage

This slice sits **one level below** `HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001` (`b8e4048`). The exec preflight scoped what the *host* would look like (location, imports, lifecycle tests). This slice scopes what the **controlled-executor contract** looks like (six pure submodules, all literal-false at the "go live" fields). Both are pre-execution scaffolding. Neither authorizes host implementation or bootstrap.

## 7. Decision

| Question | Verdict |
|---|---|
| Is the **scope** of this implementation sufficient? | **YES** — six pure submodules cover the six objectives without runtime, without host wiring, without new dependencies. |
| May this implementation be **committed**? | **YES** — pure shared-lib + tests; no surface open; no host bootstrap. |
| May this implementation be **pushed**? | **held** — push requires separate user GO. |
| Is **host implementation** authorized? | **NO** — separate `HCC-AUTO-EXECUTOR-EXEC-IMPL-001` GO required (exec-preflight §5 lifecycle tests on implementation working copy). |
| Is **bootstrap activation** authorized? | **NO** — separate explicit GO required. |
| Is **night-run** authorized? | **NO** — `night_run_ready` is `false` literal; report says `NO-GO`; minimum_next_slice points to `EXEC-IMPL-001`. |

## 8. Still NOT authorized (explicit redline list)

| Surface | State |
|---|---|
| Apply path | **closed** |
| Auto Executor runtime | **not started** |
| Live Ranking mutation | **closed** |
| Live Flush auto-apply | **closed** |
| `~/.hermes/**` writes | **off** |
| `git push` of execution-enabling change | **held** |
| Bootstrap activation (host into `src/main/index.ts`) | **held** |
| Host implementation | **held** (next slice: `EXEC-IMPL-001`) |
| Night-run auto-execution | **NO-GO** (literal `false`) |

Any drift from this table is a redline violation. Stop and report.

---

## 9. Bellard-perspective

- **One module, six pure functions.** No class hierarchies, no DI containers, no observables. Each module is ≤ 80 lines; the file totals 455 lines including comments and types. A reader can hold the whole thing in their head.
- **No new dependency, no runtime, no daemon.** `package.json` untouched. The module compiles to ~12KB and does nothing at runtime except return objects. This is correct for a pre-execution contract.
- **Each `false` is a literal in source.** `night_run_ready: false`, `executable: false`, `executed: false`, `will_execute: false`, `night_run_ready_literal_false: true`. The type system forces callers to handle the false branch. Editing the literal is the audit signal — no hidden boolean toggles.
- **Boring is correct.** A pre-execution contract should be boring. Six submodules, no surprises.

## 10. Karpathy-perspective

- **No false clean-state claim.** §2 names the staged files. §3 records the gate results without overstating.
- **Dry-run harness ≠ real execution.** `buildTaskPlan()` builds a plan that includes planned commands with the `[DRY-RUN]` prefix. The `will_execute` field is `false` literal. Nothing in this module spawns, IPC-registers, or writes a process. A reader cannot misread this as "the executor runs."
- **Readiness levels are explicit, not implicit.** The literal type `night_run_ready: false` makes it impossible for the compiler to accept `night_run_ready: true`. The only way to flip it is to edit source — which is itself the audit signal.
- **Audit evidence vs deployment reliability.** This preflight proves the contract exists and the tests pass. It does **not** prove the controlled executor can run safely; that requires the host impl per exec-preflight §4, which is a separate slice.
- **Tail-risks named explicitly.** Health-check contract enumerates six stop conditions. `max_subprocess_count: 0` says the controlled executor spawns nothing. The `git_reset_to_origin` rollback strategy is documented as `DESTRUCTIVE; requires user approval`. Audit artifact `executed_commands` is `readonly []` — real execution cannot accidentally be recorded.
- **Unknowns named explicitly.** Budgets are nominal (`max_tokens: 500_000`, `max_wall_seconds: 1_800`). Calibration is a gate in the night-run readiness report.

---

## 11. Next prompt (commit + push + next slice)

> Implementation `HCC-CONTROLLED-EXECUTOR-READINESS-001` complete in isolated worktree `hcc-controlled-executor-001`. `night_run_ready` literal `false`; report says `NO-GO`.
>
> Issue one of:
>
> 1. **`GO commit impl`** — commit the three new files (`src/shared/lib/hcc-controlled-executor.ts` + `tests/safety/hcc-controlled-executor.test.ts` + this preflight) onto `hcc-controlled-executor-001`. Push held.
> 2. **`GO push impl`** — push the commit to `origin/hermes-pro-main`. Requires commit GO first.
> 3. **`GO HCC-AUTO-EXECUTOR-EXEC-IMPL-001`** — begin host implementation per exec-preflight §4 contract and pass §5 lifecycle tests on the implementation working copy.
> 4. **No GO** — stop here. Files stay local; nothing is committed or pushed.