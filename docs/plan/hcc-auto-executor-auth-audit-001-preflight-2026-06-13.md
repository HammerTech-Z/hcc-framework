# HCC-AUTO-EXECUTOR-AUTH-AUDIT-001 — Preflight

- Task ID: `HCC-AUTO-EXECUTOR-AUTH-AUDIT-001`
- Date: 2026-06-13
- Branch: `hermes-pro-main`
- Local HEAD: `f279ad568c971a4ce39a7303923704eebc348355`
- Remote `origin/hermes-pro-main`: `293c5c373dadf1aa210e3bde08c54b0b18778a4c`
- Divergence: local +1 (f279ad5), origin +0
- Scope: **docs-only preflight** for Auto Executor authorization audit
- Status: **NOT authorized to implement, NOT authorized to start, NOT authorized to push**

---

## 1. Current Baseline (verified locally 2026-06-13)

| Check | Result |
|---|---|
| `git status --short -uall` | `M .claude/settings.json` only |
| `git rev-parse HEAD` | `f279ad568c971a4ce39a7303923704eebc348355` |
| `git rev-parse origin/hermes-pro-main` | `293c5c373dadf1aa210e3bde08c54b0b18778a4c` |
| `git log --oneline -10` | f279ad5 → 293c5c3 → 0efb442 → cedd3cc → 6a1150c → 0f6fda2 → 46a69ae → 4ab391d → d6b4e41 → d2b4321 |
| `git diff --check` | clean (no whitespace/conflict markers) |
| `npm run typecheck` | PASS (node + web, no errors) |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | `PASS=46 FAIL=0` |
| HCC-STABLE | accepted (user sign-off recorded) |
| HCC Phase B | 8/8 complete (B-1 → B-6) |
| Vault strays | all closed |
| `.claude/settings.json` dirty | local Cozempic harness config — excluded by policy, do not restore / commit / modify |
| `f279ad5` push status | not yet pushed |

Local ahead-of-remote = 1 commit. No rebase required for this preflight.

---

## 2. What "Auto Executor authorization" actually means

"Auto Executor" in this context is the path that would let Hermes Pro execute proposed actions (apply path, live ranking mutations, live flush auto-apply, route mutations, model changes, vault writes, sub-process spawns) **without an inline user confirmation per action**.

Authorization is the gate between:
- **(a) dry-run / preview / audit** — current state, every proposed action still requires explicit per-action user GO, and
- **(b) autonomous execution** — proposed actions execute under policy guardrails without per-action prompts.

This preflight is **(a)** extended. It defines the audit surface and the gate conditions for **(b)**. It does **not** cross into **(b)**.

### Current authorization boundary (still in force)

| Capability | State |
|---|---|
| Apply path | **closed** |
| Auto Executor runtime | **not started** |
| Live Ranking mutation | **closed** |
| Live Flush auto-apply | **closed** |
| Subprocess execution from runtime | **off** (dry-run only) |
| `~/.hermes/**` writes | **off** unless separately approved |
| Push to `origin/hermes-pro-main` | **held** (preflight commits stay local) |

Any drift from this table is a redline violation. Stop and report.

---

## 3. Authorization preconditions (gate checklist for any future GO)

To move from (a) → (b) **all** of the following must be true and **separately** approved by user:

1. **Security review**
   - Threat model for autonomous action surface (STRIDE or equivalent).
   - Secret handling: no plaintext keys in env / logs / crash dumps; vault reads only via approved accessor.
   - Process isolation: Auto Executor must not share address space with UI / renderer in ways that allow a compromised renderer to drive execution.
   - IPC surface minimized and allowlisted.
2. **Hardware / cloud validation**
   - Confirmed host is a dev/audit machine, not a shared or production host.
   - Cloud side (if any): sandbox account, scoped creds, no prod IAM.
   - Resource caps (CPU/RAM/disk/network) defined and enforceable.
3. **Explicit user action**
   - A standalone, named GO with task ID — not a chat continuation, not an inferred consent.
   - Scope bounded: which action classes, for how long, with what per-action ceiling.
   - Revocable mid-flight: user can revoke and the executor halts within a defined SLO.
4. **Rollback / kill switch**
   - One-command stop (local + remote if applicable).
   - Snapshot of pre-execution state (git tree, vault version, live rank table) to enable rollback.
   - Idempotency: re-running a stopped action must not double-apply.
5. **Audit logging design**
   - Every proposed action logged with: timestamp, source prompt hash, proposed diff, decision (allow/deny), execution result.
   - Logs are append-only and outside the executor's writable surface.
   - Retention policy defined.
6. **No `~/.hermes` writes** unless the user has separately approved the specific write path in this same session.
7. **No push** of any execution-enabling change without a separate user GO.
8. **Empirical gates** must pass in the local checkout that will host the executor — not a previous CI run, not a summary file.

---

## 4. Risk matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Runaway execution (loop, retry storm, flood) | Medium | High | Per-action rate cap, monotonic budget, kill switch, watchdog |
| Wrong repo / wrong worktree | Medium | High | Executor pins cwd + branch + HEAD sha; refuses mismatch; pre-action guard |
| Secret exposure (env leak, log dump, crash report) | Medium | Critical | Secret redaction filter at log boundary; no secrets in prompt context; vault accessor only |
| Unintended writes (apply path, vault, live rank) | High | High | All write classes remain closed; this preflight does not change that |
| Subprocess abuse (shell injection, path traversal) | Medium | High | Argv-only invocation, no shell, allowlisted binaries, cwd locked |
| Stale context / hallucinated state | High | Medium | Empirical gates re-run before any GO; never trust prior summaries (Karpathy rule, §8) |
| Drift between local config and committed state | Low | Medium | `lock-verify` + `typecheck` + `git diff --check` on every preflight (already passing) |
| Push race (local f279ad5 not yet pushed) | Low | Low | Preflight commits stay local; push requires separate GO |

---

## 5. Verification plan (run before any future GO)

Mandatory gates, all run from the executor's intended working copy:

1. `git status --short -uall` — must show only policy-excluded dirt (e.g. `.claude/settings.json`).
2. `git rev-parse HEAD` — must match the sha recorded in the GO record.
3. `git log --oneline -10` — must show the expected pre-execution chain.
4. `git diff --check` — no whitespace / conflict markers.
5. `bash ~/hermes-pro-work/scripts/lock-verify.sh` — `PASS=46 FAIL=0`.
6. `npm run typecheck` — exit 0.
7. Targeted tests if any write class is being opened (route mutation, live ranking, vault write) — must pass for the specific surface being opened, not "all tests green".
8. `~/.hermes/**` write audit — must be empty unless the specific write was approved in the same GO.

A GO is **invalid** if any gate is skipped or its result is older than the current HEAD.

---

## 6. Redlines (hard)

This preflight **does not**:

- Modify `src/**`
- Modify `tests/**`
- Modify `package.json` / `package-lock.json`
- Modify `.claude/settings.json`
- Write to `~/.hermes/**`
- Start any runtime / dev server / Auto Executor
- Open the apply path
- Open Live Ranking mutation
- Open Live Flush auto-apply
- Push to `origin/hermes-pro-main`

If any of the above change as a side effect of this task, that is a bug — log to `.wolf/buglog.json` and stop.

---

## 7. Bellard-perspective

- **Minimal diff.** One file, one fact, one commit. No drive-by edits.
- **Docs-only.** No executable surface touched.
- **No mixed concerns.** Authorization audit stays separate from implementation and from any GO record.
- **Exact commit landed or not.** Verification uses `git rev-parse`, not memory.
- **Boring is correct.** The preflight's value is the checklist, not novelty.

If a future diff grows beyond one doc for an audit, it has drifted. Re-scope.

---

## 8. Karpathy-perspective

- **Empirical gates, not summaries.** Every claim in §1 was re-checked locally. No inherited trust.
- **Fresh local checks before READY.** A GO is READY only if §5 was run on the working copy that will host execution, within the same session.
- **Design audit ≠ execution.** This document authorizes *the audit* of authorization. It does not authorize execution. The two must not be conflated.
- **Do not trust prior summaries without local verification.** f279ad5 was re-confirmed via `git rev-parse`, not read from a status file.
- **Visible failure mode.** If any gate fails, the GO is not READY — full stop, no negotiation.

---

## 9. Recommendation

- **Now:** proceed with this preflight commit. Audit-only. No execution surface touched.
- **Next step (separate user GO):** any implementation of Auto Executor authorization, or any of: opening the apply path / Live Ranking mutation / Live Flush auto-apply / `~/.hermes` writes / push.
- **Hard rule:** the same session that runs §5 gates and confirms READY must be the one that issues the GO. No cross-session carry-over.

---

## Appendix — preflight commit metadata (filled at commit time)

- Commit id: _filled by executor_
- Files changed: `docs/plan/hcc-auto-executor-auth-audit-001-preflight-2026-06-13.md` (this file)
- Verification: see §5 results appended to final report
- Push: **not performed** — held for separate user GO
