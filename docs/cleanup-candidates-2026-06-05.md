# Hermes Pro — Cleanup Candidates (2026-06-05)

> Status: proposal only. No files are deleted, moved, or modified by this document.
> Scope: local repository cleanup candidates found after UI spec approval sync.
> Rule: do not remove historical evidence without user approval. Archive/current-plan boundaries still follow `docs/roadmap-locked-2026-05-28.md` and `docs/deprecation-candidates-2026-05-28.md`.

## 1. Current Repository State

- Branch: `hermes-pro-main`
- Local status after doc sync: clean before this proposal was added.
- Local branch may be ahead of `origin/hermes-pro-main`; do not push unless the user explicitly approves.
- UI Design Spec direction is approved as of 2026-06-05, but UI implementation has not started.
- Slice 0 Contract Audit is unblocked, but still requires separate user approval.

## 2. Confirmed Historical / Do Not Use As Current Truth

These are not deletion targets by default. They are intentionally retained as historical evidence.

| Path | Status | Recommendation |
|---|---|---|
| `/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/` | archive / historical-only | Keep excluded from indexing; read only when user explicitly names a file. |
| `docs/archive/` | archive directory | Keep as historical-only. Current repo only has `docs/archive/README.md`. |
| `docs/v2-status.md` | historical status | Keep for history; do not use as current plan source. |
| `docs/v3-status.md` | historical status | Keep for history; do not use as current plan source. |
| `docs/deprecation-candidates-2026-05-28.md` | previous cleanup ledger | Keep as prior cleanup history. |
| Older 007C-007H UI confirm plan docs | superseded for confirm path | Keep as design history; future confirm work must start with 007H-0A/0B safety contract proposal/freeze. |

## 3. Tracked Cleanup Candidates

These files are tracked by git and therefore require explicit user approval before deletion, archival, or conversion to ignored local state.

| Candidate | Reason | Risk | Proposed action |
|---|---|---:|---|
| `electron.vite.config.ts.bak` | Backup file in repo root; likely historical config residue. | Medium | Review against current `electron.vite.config.ts`; if no longer needed, move to archive or delete in a dedicated cleanup commit. |
| `src/main/installer.ts.upstream` | Upstream snapshot / merge residue. | Medium | Compare with `src/main/installer.ts`; if only historical, archive/delete in dedicated cleanup commit. |
| `src/main/utils.ts.upstream` | Upstream snapshot / merge residue. | Medium | Compare with `src/main/utils.ts`; if only historical, archive/delete in dedicated cleanup commit. |
| `.claude/settings.20260519_195826.bak` | Local Claude settings backup tracked in repo. | Low/Medium | Confirm whether repo should track local Claude settings backups; likely remove from git and add ignore rule. |
| `.claude/settings.20260520_231814.bak` | Local Claude settings backup tracked in repo. | Low/Medium | Same as above. |
| `.claude/settings.20260521_230609.bak` | Local Claude settings backup tracked in repo. | Low/Medium | Same as above. |
| `.claude/settings.20260522_091515.bak` | Local Claude settings backup tracked in repo. | Low/Medium | Same as above. |

## 4. Untracked / Local Noise Candidates

These are not tracked by git at the time of this audit. They can usually be cleaned locally, but this document does not remove them.

| Candidate | Reason | Proposed action |
|---|---|---|
| `.DS_Store` | macOS Finder metadata. | Remove locally; ensure `.gitignore` covers it. |
| `docs/.DS_Store` | macOS Finder metadata. | Remove locally; ensure `.gitignore` covers it. |
| `src/.DS_Store` | macOS Finder metadata. | Remove locally; ensure `.gitignore` covers it. |
| `node_modules/.DS_Store` | macOS Finder metadata under dependencies. | Remove locally if desired; no repo impact. |
| `out/.DS_Store` | macOS Finder metadata under build output. | Remove locally if desired; no repo impact. |
| `tsconfig.node.tsbuildinfo` | TypeScript incremental build cache. | Remove locally if not tracked; ensure `.gitignore` covers `*.tsbuildinfo`. |
| `tsconfig.web.tsbuildinfo` | TypeScript incremental build cache. | Remove locally if not tracked; ensure `.gitignore` covers `*.tsbuildinfo`. |

## 5. Superseded / Needs-Review Docs

These are not necessarily obsolete. They need a human decision before any archive/move action.

| Candidate | Why flagged | Proposed action |
|---|---|---|
| `P2-UI-DESIGN.md` | Likely superseded by `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` for current UI redesign direction. | Add a superseded header or archive after confirming it has no unique current requirements. |
| `docs/css-audit-2026-05-26.md` | Older CSS audit; may still be useful as historical CSS inventory. | Keep unless UI Slice 0 proves it conflicts with current design spec. |
| `docs/iteration-plan-v2-updated.md` | Compatibility index, not the primary plan. | Keep; do not delete because it intentionally points to current plan docs. |
| `docs/current-fusion-plan-2026-05-30.md` | Current fusion reference with some historical baselines. | Keep; update only via explicit doc-sync if it drifts. |

## 6. Not Cleanup Targets

These looked like possible candidates during broad text scans but should not be treated as cleanup targets.

| Path / pattern | Reason |
|---|---|
| `src/renderer/src/assets/fonts/GoogleSans-Bold.ttf` / `GoogleSans-SemiBold.ttf` | Font assets may still be used by the current UI; UI spec says future font stack should adopt system font, but implementation has not happened. |
| `.claude/skills/impeccable/scripts/cleanup-deprecated.mjs` | Skill utility script; name contains cleanup/deprecated but is not project stale content. |
| `docs/superpowers/**` | Superpower planning/spec artifacts; not part of Hermes Pro stale plan cleanup unless separately requested. |
| `node_modules/**` | Dependency tree; excluded from cleanup proposal except local metadata noise. |
| `out/**` | Build output; local cleanup only, not source cleanup. |

## 7. Recommended Cleanup Order

1. **Local noise cleanup**: remove untracked `.DS_Store` and `*.tsbuildinfo` locally, then confirm `git status` remains clean.
2. **Tracked backup review**: compare `*.upstream` / `.bak` files to their live counterparts and decide whether to archive or delete.
3. **Claude settings backup policy**: decide whether `.claude/settings.*.bak` should remain tracked.
4. **UI historical doc labeling**: decide whether `P2-UI-DESIGN.md` should get a superseded header pointing to the approved UI design spec.

## 8. Guardrails

- Do not delete files from this proposal without user approval.
- Do not modify `docs/roadmap-locked-2026-05-28.md`.
- Do not treat archive/historical-only material as current truth.
- Do not clean `node_modules` or build outputs as part of source cleanup unless the user explicitly requests local disk cleanup.
- Prefer one cleanup commit per risk group.

