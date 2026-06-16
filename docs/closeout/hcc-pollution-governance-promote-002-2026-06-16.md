# HCC-POLLUTION-GOVERNANCE-PROMOTE-002-2026-06-16 — Closeout (REPAIRED)

Date: 2026-06-16
Slice: HCC-POLLUTION-GOVERNANCE-PROMOTE-002-LOCAL-STATE-SCOPE (repair)
State: plan_repaired
Worktree: hcc-pollution-governance-promote-002 execution worktree (fresh worktree at base 434dd98)
Base: 434dd98

## Repair Log

- 2026-06-16: G4 widened to allow 4 untracked local docs (2 Layer 1 audit + 2 Layer 2 plan/closeout) + P1 M; G5 wording fixed (forbidden excluding P1 must be empty; P1 M is evidence only); commit-content gate added (C1-C4); all local absolute worktree paths replaced with generic labels ("main physical worktree", "the repo's primary checkout"); Layer 1 local audit docs explicitly forbidden in the commit; all local absolute path examples removed from the payload.

## Files

| File | Action |
|------|--------|
| docs/plan/hcc-pollution-governance-promote-002-2026-06-16.md | UPDATED (G4 widened, G5 wording, C1-C4 added, paths de-localized) |
| docs/closeout/hcc-pollution-governance-promote-002-2026-06-16.md | UPDATED (this file) |

## Plan State (post-repair)

- plan id: HCC-POLLUTION-GOVERNANCE-PROMOTE-002
- layer: 2 (pollution governance policy only)
- base: 434dd98
- target: origin/hermes-pro-main
- push range: 434dd98..<new commit> (1 commit)
- allowed files: 2 (Layer 2 plan + closeout)
- forbidden files: universal set; Layer 1 local audit docs explicitly forbidden in commit
- required gates: 10 (G4 widened, G5 wording fixed)
- commit-content gate: C1-C4 (2 files only)
- stop conditions: 9
- P1 policy: tracked_generated_file, do NOT clean, do NOT include in commit
- explicit user authorization required: yes
- FROZEN_DO_NOT_USE worktrees excluded: 4
- Layer 3 deferred
- no local absolute worktree paths in payload
- no local mtime/generated-timestamp evidence in payload

## Rules in Plan (8, unchanged)

- R1 P1 tracked_generated_file policy
- R2 stale report policy (post-gate re-verify)
- R3 worktree reuse pollution policy
- R4 FROZEN_DO_NOT_USE policy as a rule
- R5 main physical worktree risk policy
- R6 plan-reality mismatch triggers NEED_PLAN_REPAIR
- R7 compact agent packet rule
- R8 forbidden file scope (universal)

## Required Next Action

User must explicitly authorize with `Push OK` for the Layer 2 commit + push. The execution slice must:
- Read this plan
- Run all 10 gates
- Stage ONLY the 2 Layer 2 files (plan + closeout); explicitly NOT stage Layer 1 local audit docs
- Verify C1-C4 (commit contains exactly the 2 Layer 2 files)
- Verify G10 (post-push HEAD == origin == 434dd98+1; ls-tree shows the 2 files)
- NOT commit or push without an explicit `Push OK` directive

## Red Lines

- No source / test / package / docs/knowledge / .wolf/memory.md / src/main/index.ts modifications
- No commit / push / merge / rebase / reset --hard (this slice is plan-only; the actual push is a future user-authorized slice)
- No main worktree touched
- No runtime / IPC / daemon / timer / cron / auto executor / app boot
- No ~/.hermes writes
- No Layer 3 promotion in this slice
- No inclusion of `.claude/worktrees/_registry.json` in the commit
- No inclusion of P1 in the commit
- No inclusion of Layer 1 local audit docs in the commit
- No inclusion of local absolute worktree paths in the commit payload
- No inclusion of local mtime / generated-timestamp evidence in the commit payload
