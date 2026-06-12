# HCC-AUTO-EXECUTOR-AUTH-IMPL-PREFLIGHT-001 — Implementation Preflight

- Task: `HCC-AUTO-EXECUTOR-AUTH-IMPL-PREFLIGHT-001`
- Date: 2026-06-13
- Branch: `hermes-pro-main`
- Predecessor (closed): `HCC-AUTO-EXECUTOR-AUTH-AUDIT-001` — closeout at `041cf3a` (on `origin`)
- Scope: **docs-only implementation preflight**. Scopes how each of the 8 audit preconditions would be addressed by an implementation. **No implementation, no runtime, no surface open.**

---

## 1. Canonical repo baseline (verified locally 2026-06-13)

| Fact | Value |
|---|---|
| `git rev-parse HEAD` | `63e36e1f04ea868fce073a34000ef5d6ad9af917` |
| `git rev-parse origin/hermes-pro-main` | `63e36e1f04ea868fce073a34000ef5d6ad9af917` |
| HEAD == origin | **true** |
| Audit preflight (on origin) | `a6503ac2fdd0406d972e6b072886df1b6bed234f` |
| Audit closeout (on origin) | `041cf3a12e8608a576133c0e111d6aae81d6803e` |
| Latest vault snapshot (on origin) | `63e36e1f04ea868fce073a34000ef5d6ad9af917` |
| HCC-STABLE | accepted |
| HCC Phase B | 8/8 complete |

## 2. Working tree at preflight time (named explicitly — no false clean-state claim)

| Path | Status | Reason | Action this commit |
|---|---|---|---|
| `.claude/settings.json` | `M` | Local Cozempic harness config | **excluded by policy** — not staged, not restored, not modified |
| `docs/knowledge/vault-health-report-2026-06-12.md` | `M` | Generated telemetry drift (re-snapshot on disk after `63e36e1`) | **excluded from this preflight commit** — same shape as drift already captured at `63e36e1` (timestamp regen, +0.1pp score drift, no semantic change); will be handled in a separate vault-snapshot commit if and when user GO is issued |

Two files dirty. Neither is part of this preflight. Neither is staged by this commit. The preflight does **not** claim the working tree is clean.

## 3. Verification (gates re-run at preflight time)

| Gate | Result |
|---|---|
| `git status --short -uall` | `M .claude/settings.json` + `M docs/knowledge/vault-health-report-2026-06-12.md` (see §2) |
| `git rev-parse HEAD` | `63e36e1f04ea868fce073a34000ef5d6ad9af917` |
| `git rev-parse origin/hermes-pro-main` | `63e36e1f04ea868fce073a34000ef5d6ad9af917` |
| `npm run typecheck` | PASS (node + web, no errors) |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | `PASS=46 FAIL=0` |

---

## 4. Precondition addressing plan (the 8 from closeout §3)

For each precondition: **what "addressed" means, the minimum design, the empirical gate that proves it, and the unknowns that remain.**

### 4.1 Security review

- **What "addressed" means:** a documented STRIDE-style threat model for the autonomous action surface, with each threat mapped to a control or to an explicit "accepted risk" entry signed by the user.
- **Minimum design:** one markdown doc `docs/security/hcc-auto-executor-threat-model.md` with sections per STRIDE category (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege), each row = `threat | surface | control | status`.
- **Empirical gate:** the doc exists, is reviewed by user, and the `status` column is `controlled` or `accepted` for every threat.
- **Unknowns:** who else reviews it (just user, or peer?). Default: user-only. Subject to change.

### 4.2 Wrong repo / worktree guard

- **What "addressed" means:** before any action, the executor asserts the working tree is the expected repo, branch, HEAD sha, and cwd; refuses on mismatch.
- **Minimum design:** a runtime guard module that pins `{expectedRepoRoot, expectedBranch, expectedHead, expectedCwd}` at executor construction time and refuses any action that would mutate outside that envelope. Pin values are passed by the GO record, not inferred.
- **Empirical gate:** unit tests for the guard covering: correct match (proceed), branch mismatch (refuse), HEAD sha mismatch (refuse), cwd mismatch (refuse), repo-root mismatch (refuse). Tests pass on the implementation working copy.
- **Unknowns:** how strictly to handle uncommitted dirt (current `M .claude/settings.json`-style policy-excluded dirt is a normal case). Default: refuse if any non-excluded dirty file exists at action time.

### 4.3 Kill switch (one-command local + remote stop)

- **What "addressed" means:** a single command halts the executor within a defined SLO, locally and (if applicable) remotely. The command is documented and idempotent.
- **Minimum design:** a process-level signal handler (`SIGTERM` first, `SIGKILL` fallback after grace period) and a control file the executor watches (e.g. `~/.hermes/runtime/auto-executor.kill` — note: `~/.hermes` writes still require a separate per-write GO, see §4.8). SLO target: stop within 5s of signal / control file appearance.
- **Empirical gate:** integration test: start executor, trigger kill signal, assert process exit within 5s and no further actions executed post-signal. Test run on the implementation working copy.
- **Unknowns:** whether remote kill needs an RPC channel or is sufficient via shared control file. Default: shared control file for v1.

### 4.4 Rollback behavior

- **What "addressed" means:** every action class has a recorded pre-state (git tree ref, vault version, live rank table snapshot) and a defined revert path. Re-running a stopped action does not double-apply.
- **Minimum design:** an `ActionRecord { id, type, preState, postState, revertFn }` shape. `revertFn` is generated per action class and tested for idempotency.
- **Empirical gate:** unit tests for `revertFn` on each action class the implementation will open. Idempotency tested by calling `revertFn` twice and asserting the second call is a no-op. Tests pass.
- **Unknowns:** which action classes the v1 implementation will open. Default: zero — every action class requires its own GO. Pre-snapshot overhead is acceptable for any class that does open.

### 4.5 Audit logging design

- **What "addressed" means:** every proposed action is logged with `timestamp, sourcePromptHash, proposedDiff, decision, executionResult`. The log is append-only and lives outside the executor's writable surface.
- **Minimum design:** a log file with write-once semantics (append-only mode, or rotated with old files marked immutable). Path outside the executor's cwd and outside any directory the executor can `rm`/`mv`. Log entries are JSON-line format for parseability.
- **Empirical gate:** unit test asserts the executor cannot delete / overwrite a past log entry (attempted delete fails or no-ops). Integration test asserts a complete trace exists for a representative action lifecycle.
- **Unknowns:** retention policy. Default: 90 days local, indefinite on the audit-log host if applicable.

### 4.6 Subprocess boundary

- **What "addressed" means:** subprocesses are invoked with `argv` (never via shell), with a fixed allowlist of binaries, with cwd locked, and with environment scrubbed of secrets.
- **Minimum design:** a `safeExec(binary, args, opts)` helper that: rejects binaries not on the allowlist, rejects any `args` element containing shell metacharacters, sets `cwd` from a pinned value, sets `env` to a known-safe subset.
- **Empirical gate:** unit tests for: (a) binary-not-on-allowlist refused, (b) shell metacharacter in args refused, (c) cwd-pin enforced even if cwd requested differently. Tests pass.
- **Unknowns:** what the allowlist is for v1. Default: empty allowlist (no subprocesses). Each entry on the allowlist requires its own GO.

### 4.7 Secrets boundary

- **What "addressed" means:** no plaintext secrets in env / logs / crash dumps / prompt context. Vault access is through an approved accessor only.
- **Minimum design:** a `secretAccessor` interface with `get(name) -> value` and `redact(text) -> text`. The accessor returns values only at the call site that needs them, and a log filter redacts known secret patterns before any log write.
- **Empirical gate:** unit test asserts: (a) secret value never appears in any log line, (b) secret value is not in `process.env` outside the accessor call, (c) crash dump (if generated) contains redacted form. Tests pass.
- **Unknowns:** secret inventory. Default: assume `.hermes/vault/secrets/` and any `*_TOKEN` / `*_KEY` env var are secrets. Subject to expansion.

### 4.8 `~/.hermes` write policy

- **What "addressed" means:** the executor never writes to `~/.hermes/**` unless a specific per-write GO is in force for that exact path. The policy is enforced at runtime, not just documented.
- **Minimum design:** a runtime check on every filesystem write: if the resolved path is under `~/.hermes/`, refuse unless the call site presents a per-write token issued by the current session's GO record. Token is single-use.
- **Empirical gate:** unit test asserts: (a) write under `~/.hermes/` without token refused, (b) write under `~/.hermes/` with valid token allowed, (c) token reuse refused. Tests pass.
- **Unknowns:** token format and storage. Default: token in the GO record (in-session, not persisted), checked against the path being written.

---

## 5. Empirical gates (re-run by implementation GO, not by this preflight)

This preflight **does not run the implementation gates**. The implementation GO must re-run, on the implementation working copy:

1. `git status --short -uall` — only policy-excluded dirt allowed.
2. `git rev-parse HEAD` — must match the sha recorded in the implementation GO.
3. `git diff --check` — clean.
4. `bash ~/hermes-pro-work/scripts/lock-verify.sh` — `PASS=46 FAIL=0`.
5. `npm run typecheck` — exit 0.
6. `npm test` (or the targeted test set for §4.2, §4.3, §4.4, §4.5, §4.6, §4.7, §4.8) — exit 0 for each precondition addressed.
7. `~/.hermes/**` write audit — must be empty unless the specific write was approved in the same GO.

A GO is **invalid** if any gate is skipped or its result predates the current HEAD.

---

## 6. Decision

| Question | Verdict |
|---|---|
| Is the **scope** of the implementation preflight sufficient? | **YES** — all 8 preconditions from closeout §3 are addressed in §4. |
| May the implementation preflight be **committed and pushed**? | **YES** — it is a docs-only artifact. |
| Is **implementation** itself authorized? | **NO** — requires a separate implementation GO, with §5 gates re-run. |
| Is **execution / startup** of Auto Executor authorized? | **NO** — closed. |
| Is any **write surface** opened by this preflight? | **NO** — apply path, Live Ranking mutation, Live Flush auto-apply, `~/.hermes/**` writes, `src/**` / `tests/**` / `package*.json` modifications all remain closed. |

## 7. Still NOT authorized (explicit redline list)

| Surface | State |
|---|---|
| Apply path | **closed** |
| Auto Executor runtime | **not started** |
| Live Ranking mutation | **closed** |
| Live Flush auto-apply | **closed** |
| `~/.hermes/**` writes | **off** (no per-write approval given) |
| `git push` of any execution-enabling change | **held** (this preflight is docs-only and may be pushed under a separate user GO) |
| `src/**` / `tests/**` / `package*.json` modification | **held** (no GO) |

Any drift from this table is a redline violation. Stop and report.

---

## 8. Bellard-perspective

- **One doc, one decision.** This preflight scopes the implementation surface; it does not authorize implementation. The decision recorded is "scope is sufficient; commit the preflight." No second decision smuggled in.
- **No executable surface touched.** Source, tests, deps, settings — untouched. Only `docs/plan/...` is new.
- **Dirty telemetry not mixed in.** Vault drift named in §2, classified, explicitly excluded. Will not ride this commit. Intent separation preserved.
- **Each precondition got the minimum, not the maximum.** §4 specs are the smallest designs that meet the closeout's bar. They are not a fully-engineered implementation. That is correct for a preflight.
- **Exact commit landed or not.** `git rev-parse` used at every step. Staged set re-verified via `git diff --cached --name-only` before commit.
- **Boring is correct.** A preflight that lists 8 preconditions, says "address each this way," and refuses to open any surface is the only useful preflight right now.

## 9. Karpathy-perspective

- **No false clean-state claim.** §2 names both dirty files. The preflight does not say "tree clean."
- **Preflight scope ≠ implementation reliability.** This doc proves the *design surface* is scoped. It does **not** prove the designs in §4 will work, will pass their gates, or will be implemented as specified. Two different statements; this doc holds only the first.
- **Implementation must pass its own gates.** §5 lists the gates the implementation GO must re-run. None is assumed satisfied by this preflight. None is assumed satisfied by any prior session.
- **Unknowns named explicitly.** Each §4.x subsection ends with an "Unknowns" line. Each `default` is the safe default. A "specified" or "decided" claim without that line would be a lie.
- **No READY declaration.** The verdict (§6) is "scope sufficient; preflight may be committed and pushed; implementation requires separate GO." The word READY does not appear in this document and should not appear in the implementation doc unless the §5 gates are first run and recorded.
- **Audit evidence vs. deployment reliability** (closeout distinction, restated): the closeout at `041cf3a` proved the audit was recorded. This preflight proves the *implementation surface* is scoped. Neither proves the implementation will work.

---

## 10. Next prompt (implementation GO only, not implementation itself)

> Implementation preflight `HCC-AUTO-EXECUTOR-AUTH-IMPL-PREFLIGHT-001` committed. Auto Executor **execution** is still NOT authorized. Auto Executor **implementation** is unblocked as a separate step.
>
> Issue one of:
>
> 1. **`GO push impl preflight`** — push the preflight commit to `origin/hermes-pro-main`. Note: the vault drift on disk (`M docs/knowledge/vault-health-report-2026-06-12.md`) is uncommitted and will block the push until you decide what to do with it (commit separately / discard / leave dirty — each requires its own GO).
> 2. **`GO HCC-AUTO-EXECUTOR-AUTH-IMPL-001`** — begin implementation. Must (a) re-run §5 gates on the implementation working copy, (b) implement §4.1–§4.8 designs with passing tests, (c) end with a separate explicit GO request for execution. No execution, no surface open, no push of execution-enabling code.
> 3. **No GO** — stop here. Preflight stays local, vault drift stays dirty, no further work.
>
> The preflight itself is **not** pushed by this commit. Push requires a separate user GO.

---

## Appendix — preflight commit metadata (filled at commit time)

- Commit id: _filled by executor_
- Files staged: `docs/plan/hcc-auto-executor-auth-impl-preflight-2026-06-13.md` (this file)
- Files NOT staged: `.claude/settings.json` (policy-excluded), `docs/knowledge/vault-health-report-2026-06-12.md` (telemetry drift, deferred)
- Push: **not performed** — held for separate user GO
