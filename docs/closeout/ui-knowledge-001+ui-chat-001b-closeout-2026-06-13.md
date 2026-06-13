# UI-KNOWLEDGE-001 + UI-CHAT-001b — Closeout

> **Closeout-time status**: implemented in isolated worktree, **NOT pushed**, awaiting user GO for merge.
> **Date**: 2026-06-13
> **Worktree**: `~/hermes-pro-work/.claude/worktrees/ui-knowledge-chat`
> **Branch**: `ui-knowledge-001+ui-chat-001b`
> **Base**: `f754e38` (main HEAD at closeout-time)
> **Scope**: implementation of two preflight-approved UI slices
> **No push, no merge, no src-uplift — awaiting separate user GO.**

---

## 1. What was implemented

### UI-KNOWLEDGE-001 — Knowledge Control: Redaction + Card Layout

Per `docs/design/preflight/UI-KNOWLEDGE-001-redaction-cards.md`:

| Area | Change |
|------|--------|
| `KnowledgeControl.tsx` | Added page-level "录入请前往「知识」页" notice to prevent write-misunderstanding |
| `KnowledgeColumn.tsx` | Column labels → Chinese: 收件箱/候选/已验证/已链接/过期/归档 |
| `KnowledgeCard.tsx` | Card four-element order: **title → source badge → trust badge → prompt_use badge** (fixed order per audit §D.4) |
| `TrustBadge.tsx` | Added "来源未验证" indicator when `trustLevel=unverified` AND `provenanceCount=0` AND `verifiedAt=null` |
| `knowledge-control-model.ts` | `redactSecrets()` extended additively: GitHub PAT (`ghp_…`), PEM private key blocks, 40-char hex heuristic |
| `main.css` | Added `.knowledge-control-notice` + card four-element flex order + `.knowledge-control-prompt-use` data-allowed style + `.knowledge-control-trust-warn` |

### UI-CHAT-001b — Approval Bar Hardening + Chinese Regex

Per `docs/design/preflight/UI-CHAT-001b-approval-bar.md`:

| Area | Change |
|------|--------|
| `Chat.tsx` | Added `APPROVAL_RE_CN` regex (4 categories: 需要.*?(确认\|审批), 是否(继续\|执行\|运行), 危险操作, 请(确认\|批准)); combined into `APPROVAL_RE_COMBINED`; existing English `APPROVAL_RE` **untouched** (additive only) |
| `Chat.tsx` | Approval bar visual upgrade: `hp-approval-bar` (orange left-edge + warning bg), `hp-approval-bar-header` (⚠ 代理请求审批), `hp-approval-bar-excerpt` (truncated 200 chars), `hp-approval-bar-actions`, `hp-approval-bar-note` ("按钮将以消息形式发送给代理，不是本地开关") |
| `main.css` | Added `.hp-approval-bar*` styles using existing `--hp-state-warn` token |

---

## 2. Files modified / added

```
 docs/knowledge/vault-health-report-2026-06-12.md            | 104 +++--- (telemetry drift; excluded from commit per policy)
 src/renderer/src/assets/main.css                            |  89 +
 src/renderer/src/screens/Chat/Chat.tsx                      |  43 ++-
 src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx |  4 +
 src/renderer/src/screens/KnowledgeControl/components/KnowledgeCard.tsx       | 14 ++-
 src/renderer/src/screens/KnowledgeControl/components/KnowledgeColumn.tsx    | 12 +-
 src/renderer/src/screens/KnowledgeControl/components/TrustBadge.tsx          |  7 +-
 src/renderer/src/screens/KnowledgeControl/knowledge-control-model.ts        | 11 ++-
 tests/knowledge-control-readonly.test.ts                    | 98 +
 tests/chat-approval-regex-cn.test.ts                        | NEW (53 lines)
```

Total: **9 files changed, 312 insertions(+), 70 deletions(-)** (excluding the regenerated telemetry drift on `vault-health-report-2026-06-12.md`).

---

## 3. Verification (gates re-run on this implementation)

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` (node + web) | **EXIT 0** (PASS, no errors) |
| `npx vitest run tests/knowledge-control-readonly.test.ts tests/screen-boundary-contract.test.ts tests/chat-approval-regex-cn.test.ts` | **3 files / 49 tests PASS** |
| `npx vitest run` (full suite) | **157 files / 4221 tests PASS**, 1 file pre-existing failure (unrelated; baseline `f754e38` reproduces it: `tests/layout-route-table.test.ts` fails on `Failed to resolve import "recharts"` — environment, not code) |
| Read-only boundary | KnowledgeControl.tsx still calls only approved read APIs (`listVaultFiles`, `getVaultStats`, `getGbrainStats`, `readVaultFile`, `knowledgeSearch`); no `knowledgeIngest`/`fetch`/`dnd-kit`; import-graph hardened (UI-SAFETY-001) test still PASS |
| Zero new IPC channels | confirmed — no `ipcMain`/`ipcRenderer`/`preload` touched |
| Zero write paths added | confirmed — KnowledgeControl remains read-only; ingest write path stays in `screens/Knowledge/Knowledge.tsx` unchanged |
| Zero new packages | confirmed — `package.json` not touched |
| APPROVAL_RE English patterns | preserved unchanged; `APPROVAL_RE_CN` is additive |
| No `~/.hermes/` writes | confirmed |
| No Auto Executor / Productionization / L6 flush / hard cutover | confirmed — none of these surfaces opened |

---

## 4. Forbidden Items Check (per audit §J)

| Item | Status |
|------|--------|
| Knowledge write/drag/drop UI | ZERO added |
| Live knowledge injection UI (L6) | ZERO added |
| "Preview future feature" greyed-out UI | ZERO added |
| Ingest/new-entry buttons | ZERO added |
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| New IPC channels | ZERO added |
| Write path to vault | EXISTING ingest tab in Knowledge.tsx preserved unchanged |
| Structured approval protocol (ACUI event type) | NOT in scope — regex only |
| Backend message parsing changes | NONE |
| Removal of existing APPROVAL_RE English patterns | NONE removed — additive only |

---

## 5. Test additions

### `tests/knowledge-control-readonly.test.ts` — added describe block

| Test | Asserts |
|------|---------|
| `redactSecrets masks GitHub personal access tokens` | `ghp_…` (36 chars) → redacted |
| `redactSecrets masks PEM private key blocks` | `-----BEGIN RSA PRIVATE KEY-----…-----END …-----` → redacted, boundaries preserved |
| `redactSecrets masks 40-char hex adjacent to secret keywords` | hex40 with `token…key` neighbor → `HEX40-REDACTED` |
| `renders column labels in Chinese per audit` | KnowledgeColumn.tsx literal match all 6 keys |
| `renders card title before source/trust/prompt_use badges (fixed order)` | DOM order: titleIdx < metaRowIdx < promptIdx |
| `shows 来源未验证 when trustLevel=unverified and no provenance` | model: frontmatter-only unverified → provenanceCount=0, verifiedAt=null |
| `renders page-level notice pointing users to Knowledge screen for ingest` | KnowledgeControl.tsx contains `knowledge-control-notice` + 录入请前往 |
| `does not introduce write/ingest/drag entry points` | KnowledgeCard.tsx no `knowledgeIngest`/`onDrop`/`onDrag`/`draggable`/`dnd-kit` |

### `tests/chat-approval-regex-cn.test.ts` — new file (6 tests)

| Test | Asserts |
|------|---------|
| `matches '需要你的确认才能继续'` | APPROVAL_RE_CN pattern coverage |
| `matches '是否继续执行？'` | APPROVAL_RE_CN pattern coverage |
| `matches '危险操作，请确认'` | APPROVAL_RE_CN pattern coverage |
| `does NOT match benign Chinese like '今天天气怎么样'` | no false-positive on neutral text |
| `preserves the original English APPROVAL_RE (additive only)` | Chat.tsx source contains English + CN constants + COMBINED |
| `renders the upgraded approval bar with Chinese title and disclaimer` | Chat.tsx source contains `hp-approval-bar` + 代理请求审批 + 按钮将以消息形式发送给代理，不是本地开关 |

---

## 6. Rollback

```bash
cd ~/hermes-pro-work/.claude/worktrees/ui-knowledge-chat
git checkout f754e38 -- src/renderer/src/assets/main.css \
  src/renderer/src/screens/Chat/Chat.tsx \
  src/renderer/src/screens/KnowledgeControl/
rm tests/chat-approval-regex-cn.test.ts
git checkout HEAD -- tests/knowledge-control-readonly.test.ts
```

After rollback: typecheck + 3 target tests should remain at pre-change state.

---

## 7. Next prompt

> Implementation of `UI-KNOWLEDGE-001` + `UI-CHAT-001b` complete in isolated worktree (3/49 target tests PASS, typecheck EXIT 0, no redline opened). Branch `ui-knowledge-001+ui-chat-001b`, base `f754e38`, **not pushed**.
>
> Issue one of:
>
> 1. **`GO MERGE UI-KNOWLEDGE-001+UI-CHAT-001b`** — merge branch to `hermes-pro-main`, push; then re-run typecheck + 3 target tests on `origin/hermes-pro-main`.
> 2. **Iterate on either slice** — point at a specific test or preflight item to revise.
> 3. **Discard** — `git branch -D ui-knowledge-001+ui-chat-001b && git worktree remove ~/hermes-pro-work/.claude/worktrees/ui-knowledge-chat --force`.
>
> This closeout is **not** pushed. Push requires separate user GO.

---

## 8. Redline Confirmation

| Redline | Held |
|---------|------|
| Auto Executor runtime/startup | ❌ NOT started |
| Productionization write surface | ❌ NOT open |
| Live Flush enabled | ❌ NOT enabled |
| P3 real execution | ❌ NOT approved |
| hard cutover | ❌ NOT executed |
| `~/.hermes/**` write | ❌ NOT executed |
| `git push` | ❌ NOT executed |
| Source/uplift to `~/hermes-pro/` (uchg-locked) | ❌ NOT touched (changes only in `~/hermes-pro-work/.claude/worktrees/`) |
| `package.json` / dependency changes | ❌ NOT touched |
| New IPC channels | ❌ ZERO added |
| Write path to vault | ❌ NOT added (existing `screens/Knowledge/Knowledge.tsx` ingest preserved unchanged) |

---

*Closeout generated 2026-06-13. Worktree path: `~/hermes-pro-work/.claude/worktrees/ui-knowledge-chat`. Branch: `ui-knowledge-001+ui-chat-001b`. Base: `f754e38`. Awaiting user GO for merge/push.*