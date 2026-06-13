# HCC Controlled Executor — Night-Run Readiness Report

- Task: `HCC-CONTROLLED-EXECUTOR-NIGHT-RUN-READINESS-001`
- Date: 2026-06-13
- Source commit: `b8e4048903744ff779148e2846546ac6b5cf2198` (`origin/hermes-pro-main`)
- Companion preflight: `docs/plan/hcc-controlled-executor-impl-preflight-2026-06-13.md`
- Companion closeout: `docs/closeout/hcc-controlled-executor-readiness-001-closeout-2026-06-13.md`
- Module under review: `src/shared/lib/hcc-controlled-executor.ts`

---

## 0. Headline verdict

| Question | Answer |
|---|---|
| `night_run_ready` | **false** (literal in source; type-level enforced) |
| `go_no_go` | **NO-GO** |
| Minimum next slice | `HCC-AUTO-EXECUTOR-EXEC-IMPL-001` |

The controlled executor is **ready for human-driven, single-task, isolated-worktree use**. It is **not ready** to run unsupervised overnight.

---

## 1. Gates (all unsatisfied)

| # | Gate | Satisfied | Evidence ref | Remediation |
|---|---|---|---|---|
| 1 | `user_authorization_signed` | false | `docs/governance/hcc-go-authorization-2026-06-11.md` §2.2 — explicit non-authorization for Auto Executor constant runtime | user must sign a fresh, scope-limited GO for night-run auto-execution |
| 2 | `rollback_rehearsal_one_completed` | false | `docs/plan/hcc-stable-adjudication-preflight-2026-06-12.md` — zero rollback rehearsals completed for night-run surface | complete one controlled rollback rehearsal in an isolated worktree and capture the artifact |
| 3 | `auto_executor_host_lifecycle_test_passes` | false | `docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md` §5 — host lifecycle test contract only, not yet implemented | implement host per exec-preflight §4 and pass §5 lifecycle tests on the implementation working copy |
| 4 | `bootstrap_activation_go_recorded` | false | `docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md` §4.4 — bootstrap activation is a separate explicit GO, not yet issued | issue explicit GO for bootstrap activation of the host into `src/main/index.ts` |
| 5 | `rate_cap_and_token_budget_calibrated` | false | `src/shared/lib/hcc-controlled-executor.ts` §4 budgets are nominal; calibration against real workload data missing | run a controlled dry-run to calibrate tokens / wall-clock / subprocess budget |

Five gates. Five `false`. One verdict: NO-GO.

---

## 2. What this slice adds toward closing the gates

This slice adds a **pure contract layer** — six submodules in `src/shared/lib/hcc-controlled-executor.ts` — that can be inspected, tested, and reasoned about without running anything. The contract layer:

- Distinguishes three readiness levels; `night_run_ready` is `false` literal at the type level.
- Defines admission policy: single-task / single-branch / single-commit / isolated-worktree; six action classes hard-wired to `requires_user_approval`.
- Defines a dry-run harness with `[DRY-RUN]` prefix enforcement and literal-false `executable` / `executed` / `will_execute` fields.
- Defines a health-check contract with six stop conditions and `max_subprocess_count: 0`.
- Defines an audit artifact shape that cannot record real execution (`executed_commands: readonly []`).
- Defines a night-run readiness report that is hard-wired `NO-GO`.

The contract layer makes the gates machine-readable. It does not close any of them.

---

## 3. What this slice does NOT close

- **No host code.** `src/main/auto-executor-host.ts` does not exist. Gate #3 cannot flip without it.
- **No bootstrap wiring.** `src/main/index.ts` is unchanged. Gate #4 cannot flip without a bootstrap GO.
- **No rollback rehearsal.** Gate #2 requires a real rollback in an isolated worktree.
- **No calibrated budgets.** Gate #5 requires a controlled dry-run producing token/wall-clock data.
- **No fresh user GO.** Gate #1 requires the user to sign a scope-limited authorization for night-run.

---

## 4. Tail-risks this slice names

These are the risks a night-run auto-execution would create. The contract layer does not eliminate them; it surfaces them.

| Risk | Where surfaced | How it is bounded |
|---|---|---|
| Stuck task / no heartbeat | `buildHealthCheckPlan` stop condition #2 | `max_wall_seconds: 1_800` |
| Mis-commit to main branch | `decideTaskAdmission` requires `single_branch` + `worktree_isolated` | denied if not isolated |
| Out-of-scope write | `decideTaskAdmission` hard-wires `install_dependency` / `file_deletion` / `external_publish` / `credential_access` / `browser_action` / `live_apply` to `requires_user_approval` | denied without user |
| Token blow-up | `buildHealthCheckPlan.budgets.max_tokens: 500_000` + stop condition #5 | exceeded ⇒ stop |
| Test false positive | `buildAuditArtifact.executed_commands: readonly []` (cannot record real execution) + `verifier_result.verdict` ∈ {`pass`, `fail`, `skipped`} | audit cannot lie |
| Worktree contamination | `decideTaskAdmission` requires `worktree_isolated: true` + audit captures rollback point | denial otherwise |
| Unattended destructive rollback | `buildTaskPlan` rollback default `git_revert_commit`; `git_reset_to_origin` documented `DESTRUCTIVE; requires user approval` | destructive strategy flagged |

---

## 5. Minimum next slice (literal)

```
HCC-AUTO-EXECUTOR-EXEC-IMPL-001
  scope: implement host per docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md §4
         pass §5 lifecycle tests on the implementation working copy
  pre:   re-run §5 gates on the implementation working copy
  post:  issue separate explicit GO for bootstrap activation
  does not: spawn real subprocess; open apply path; mutate Live Ranking;
            auto-apply Live Flush; write ~/.hermes/**; push execution-enabling code
```

Until that slice lands and its §5 lifecycle tests pass, gate #3 cannot flip. Until gates #3 + #4 both flip, gate #1 cannot be reasonably requested. Until gate #1 is signed, `night_run_ready` is `false` literal.

---

## 6. Bellard-perspective

- **Five gates, one verdict.** No "almost ready," no "soft GO." Either every gate flips, or the verdict is NO-GO. The table is the table.
- **No new runtime surface.** This slice adds a pure module. The contract layer compiles to ~12KB and returns objects. Night-run requires the host (which is not built). Building the host requires a separate GO. Sequence is enforced.
- **Boring is correct.** A NO-GO report that says "five gates, five false, next slice is host impl" is the most useful report possible right now.

## 7. Karpathy-perspective

- **NO-GO is the honest answer.** Any softer wording ("mostly ready," "ready with caveats") would be a lie.
- **The contract ≠ the runtime.** This slice proves the contract exists and the tests pass. It does **not** prove night-run is safe. The 23/23 tests cover the contract, not the runtime.
- **Tail-risks are named, not enumerated exhaustively.** §4 lists seven. Other risks (LLM cost spikes, vault corruption during dry-run, harness-clock drift) are out of scope for this slice and named as unknowns.
- **Unknowns are named explicitly.** §3 says "this slice does not close" five things, each with the gate it leaves unsatisfied. A reader cannot mistake this for "ready."
- **The word READY does not appear in any positive sense.** `night_run_ready: false`, `go_no_go: "NO-GO"`. The literal type prevents the compiler from accepting `true`. Editing the literal is the audit signal.

---

## 8. Next prompt (commit + push + next slice)

> Night-run readiness report says **NO-GO**. Five gates unsatisfied. Auto Executor **execution** is still NOT authorized. Auto Executor **host implementation** is unblocked as a separate step.
>
> Issue one of:
>
> 1. **`GO commit`** — commit the 5 new files onto `hcc-controlled-executor-001`. Push held.
> 2. **`GO push`** — push the commit to `origin/hermes-pro-main`. Requires commit GO first.
> 3. **`GO HCC-AUTO-EXECUTOR-EXEC-IMPL-001`** — begin host implementation per exec-preflight §4 contract and pass §5 lifecycle tests on the implementation working copy.
> 4. **No GO** — stop here. Files stay local; nothing is committed or pushed.