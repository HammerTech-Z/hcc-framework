# ADR: Locked Roadmap Drift Reset (2026-06-02)

> **Status**: PROPOSED (awaiting user acceptance)
> **Date**: 2026-06-02
> **Task ID**: HCC-20260602-LOCKED-ROADMAP-DRIFT-RESET
> **Author**: Claude Code (apply_patch + new ADR; no other state changes)
> **Supersedes**: none
> **Related**: `~/.hermes/pipeline-runs/HCC-20260602-HERMES-PRO-WORKTREE-AUDIT/01-report.md` § 2 + 10 (G8)

---

## 1. Context

The Hermes Pro worktree audit
(`HCC-20260602-HERMES-PRO-WORKTREE-AUDIT/01-report.md`) discovered
**pre-existing drift** in `docs/roadmap-locked-2026-05-28.md`:

| Field | Value |
|-------|-------|
| File | `docs/roadmap-locked-2026-05-28.md` |
| Diff stat | `+3/-3` (3 insertions, 3 deletions) |
| Drift source | a previous round of edits (mtime `May 31 11:05:52 2026`; pre-existing) |
| Nature of change | 3 hunk changes: (1) V7 row: removed `Mano-P` from `Ruflo/Mano-P/UI-TARS 暂缓` list; (2) Mano-P row: status `⏸️ 候选暂缓` → `⏸️ 待定项目`, description added "用户要求先放弃 Mano-P 相关推进"; (3) GUI-VLA 方向备注 rephrased: "Mano-P 暂缓" → "Mano-P 放入待定项目, 不作为近期候选试点" |
| Rule violated | Hermes Pro 路线图锁定规则 § "禁止 Agent 自行改路线图" |

The drift was **caught** before being committed, but was sitting
in the working tree as an uncommitted `M`. If committed, it
would have become permanent without a new ADR or user
acceptance.

The user has chosen **Option A** in the worktree audit: **revert
the locked roadmap drift to its HEAD state, then create this ADR
documenting the revert + the correct future procedure**.

---

## 2. Decision

### 2.1 Revert (executed in this round)

- **Action**: Revert `docs/roadmap-locked-2026-05-28.md` to the
  state at `HEAD` (commit `77ccfe003ea26d7c9d8d603024adf0eb01551717`).
- **Method**: `git show HEAD:docs/roadmap-locked-2026-05-28.md > /tmp/roadmap-baseline.md && cp /tmp/roadmap-baseline.md docs/roadmap-locked-2026-05-28.md`
- **Verification**: `git diff -- docs/roadmap-locked-2026-05-28.md` →
  empty; `git status --short docs/roadmap-locked-2026-05-28.md` →
  not in the modified list.

### 2.2 No further action (the locked roadmap is back to HEAD)

- No new commit is created in this round (the user can decide
  whether to commit the drift reset as a separate commit, or to
  leave the working tree uncommitted per Hermes Pro rules).
- No other file is modified in this round (CONTEXT.md,
  NEXT_STEP.md, current-fusion-plan, p3-dry-run-baseline-2026-06-01.md
  are not touched).
- No `git reset --hard`, no `git checkout -- .` (both forbidden
  by this ADR's hard constraints; per Hermes Pro rules: "发现
  计划 bug 时，Agent 可以报告 Roadmap Bug Report，由用户决定
  是否修改；不得自行改路线图" — a single targeted file copy
  is the minimal action; a `git reset --hard` would touch
  unrelated worktree changes).

---

## 3. The correct future procedure for modifying the locked roadmap

Per Hermes Pro 路线图锁定规则:

> 任何路线图变更必须新建 ADR + 用户确认。

The correct procedure is:

1. **Identify the change**: read the current `HEAD` of
   `docs/roadmap-locked-2026-05-28.md`; understand what the user
   wants to change and why.
2. **DO NOT edit the locked roadmap directly.** Instead:
3. **Create a new ADR** in `docs/adr/ADR-YYYYMMDD-<topic>.md`
   with sections: Context / Decision / Consequences / Rollout.
4. **Present the ADR to the user** in a Claude Code session.
5. **Wait for explicit user acceptance** (a separate prompt that
   says "I accept this ADR" or similar).
6. **After acceptance**, apply the change to
   `docs/roadmap-locked-2026-05-28.md` as a single targeted
   edit (or a patch from the ADR body, applied via
   `cp` / `git apply --include`), preserving unrelated lines.
7. **Commit** the change as a single, descriptive commit. The
   commit message must reference the ADR by ID
   (e.g. "roadmap: apply ADR-YYYYMMDD-<topic>").

The forbidden actions:

- ❌ Do **not** edit `docs/roadmap-locked-2026-05-28.md` directly
  without an accepted ADR.
- ❌ Do **not** use `git reset --hard` or `git checkout -- .` to
  "clean up" a drift — both can destroy unrelated changes.
- ❌ Do **not** commit a drift in the same commit as other
  unrelated work (this is how the drift became hard to detect).
- ❌ Do **not** "auto-promote" an in-progress change to a locked
  roadmap on the assumption that the user will accept.

---

## 4. Consequences

### 4.1 What the user loses

The 3-line Mano-P + GUI-VLA update that was sitting in the
working tree is **rolled back**. The next round, the user can:

- **A. Accept the loss**: the locked roadmap stays as it was at
  HEAD; the Mano-P status remains `⏸️ 候选暂缓` (the original
  text).
- **B. Re-apply via ADR**: user creates a new ADR for the
  Mano-P status change to `⏸️ 待定项目` (and the GUI-VLA
  direction rephrase); the ADR is accepted; the change is
  re-applied through the correct procedure (§3).

### 4.2 What the user gains

- **No accidental permanent change**: the locked roadmap is back
  to its committed state; if the change is not wanted, the user
  has not lost anything.
- **A documented record**: this ADR captures the drift, the
  reason for the revert, and the correct future procedure.
- **Future automation can detect drift earlier**: the audit
  round that found the drift (HCC-20260602-HERMES-PRO-WORKTREE-
  AUDIT) can be repeated; the report template documents the
  drift as a red flag.

### 4.3 What is unchanged

- All 18 other M files in the worktree (CONTEXT.md, NEXT_STEP.md,
  5 plan docs, 7 P2.5/P3 harness source files, 2 BaiLongma UI
  files, 2 build files) are NOT touched in this round.
- All 21 untracked files (hcc-*, safety/, config/, usage-feedback,
  3 plan docs, 20 tests/safety, debug-list.mjs, .wolf/,
  .claude/skills/) are NOT touched in this round.
- All 5 D files (before-*, archive/) are NOT touched in this
  round.
- HCC Auto Executor remains frozen.
- P3.5 Round 2 C remains frozen.
- hard cutover remains unapproved.
- soft switch observation period continues independently.
- `~/.hermes/handoff/packs` and `~/.hermes/audit` mtimes are
  unchanged (no command was invoked in this round).
- Live hermes-agent and candidate are not modified.

---

## 5. Rollout

| Step | Action | Status |
|------|--------|--------|
| 1 | Capture `git show HEAD:docs/roadmap-locked-2026-05-28.md` baseline | ✅ done |
| 2 | Apply the baseline to the working tree file | ✅ done |
| 3 | Verify `git diff -- docs/roadmap-locked-2026-05-28.md` empty | ✅ done |
| 4 | Verify `git status --short docs/roadmap-locked-2026-05-28.md` not in modified list | ✅ done |
| 5 | Verify `git diff --check` clean | ✅ done |
| 6 | Create this ADR | ✅ done |
| 7 | Write `HCC-20260602-LOCKED-ROADMAP-DRIFT-RESET/01-report.md` documenting the round | ✅ done |
| 8 | (User decision) Commit the revert as a separate commit, or leave the working tree uncommitted | ⏳ pending user decision |

---

## 6. Acceptance Checklist

For the user to accept this ADR:

- [ ] User has read this ADR end-to-end
- [ ] User agrees the 3-line drift is to be reverted (and not
      re-applied without a new ADR)
- [ ] User agrees with the future procedure in §3 (single ADR →
      user acceptance → targeted edit → single commit)
- [ ] User decides what to do with the working tree state: commit
      the revert as a separate commit, or leave it uncommitted

---

## 7. Related

- `~/.hermes/pipeline-runs/HCC-20260602-HERMES-PRO-WORKTREE-AUDIT/01-report.md` — the audit that surfaced the drift (G8)
- `docs/roadmap-locked-2026-05-28.md` (HEAD) — the locked roadmap baseline that was restored
- `~/.hermes/HERMES-SOUL.md` v5.3 — Hermes Pro rules (路线图锁定规则)
- `docs/deprecation-candidates-2026-05-28.md` § F — documents the 2026-05-30 cleanup that moved old backup files off-repo
