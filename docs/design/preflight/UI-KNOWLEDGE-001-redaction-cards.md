# Preflight — UI-KNOWLEDGE-001 (Knowledge Control: Redaction + Card Layout)

> Status: **AWAITING APPROVAL**. No implementation has started.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` P2-4, D.4, H
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §6.3

---

## 1. Objective

Fix P2-4 (readVaultFile renders vault contents without redaction) and improve KnowledgeControl card layout per audit §D.4:

1. **Secret redaction**: scan vault text before render for common secret patterns (AKIA/sk-/ghp_/private-key headers/high-entropy strings); fold matched sections into obscured blocks requiring click-to-reveal with confirmation
2. **Card four-element layout**: title / source badge / trust status / allow_prompt_use — fixed order
3. **Column Chinese labels**: inbox/候选/已验证/已链接/过期/归档
4. **Trust/provenance display**: show "来源未验证" when fields are missing (instead of blank)

**Non-goal**: any write/drag/live-ingest UI (per audit §J). This page remains strictly read-only.

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx` | Add secret redaction pass before render; restyle card layout; add column labels | MEDIUM |
| `src/renderer/src/assets/main.css` | Card four-element layout + redaction block styles | LOW |

**Not touched**: `src/screens/Knowledge/Knowledge.tsx` (ingest write path stays there), IPC handlers, preload, main process, package.json.

---

## 3. Expected Diff (draft)

### 3.1 Secret redaction (client-side, before render)

```ts
// Local redaction pass — runs in renderer, zero IPC
const SECRET_PATTERNS = [
  /\bAKIA[0-9A-Z]{16}\b/,              // AWS Access Key
  /\bsk-[a-zA-Z0-9]{32,}\b/,           // Stripe / OpenAI secret key
  /\bghp_[a-zA-Z0-9]{36}\b/,           // GitHub personal access token
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END/, // Private key blocks
  /\b[a-f0-9]{40}\b.*?(secret|token|key|password)/i,  // Heuristic: 40-char hex near secret keywords
];

function redactVaultText(content: string): RedactedContent {
  // Return array of {type: "text"|"redacted", value: string} segments
  // Redacted segments: display as ●●●● 已遮蔽 · 点击显示
  // Click triggers: confirm("确认查看敏感内容？此操作不会记录。") → reveal
}
```

### 3.2 Card four-element layout

```tsx
<div className="knowledge-card">
  <h4 className="knowledge-card-title">{card.title}</h4>
  <div className="knowledge-card-meta">
    <SourceBadge sourceType={card.source_type} />   {/* vault 路径 或 ingest 来源 */}
    <TrustBadge level={card.trust_level} />          {/* 已验证 ✓ · 未验证 ○ · 过期 ⚠ */}
    <PromptUseBadge allowed={card.allow_prompt_use} /> {/* 可用于回答 / 禁止用于回答 */}
  </div>
</div>
```

### 3.3 Column Chinese labels

```tsx
const COLUMN_LABELS: Record<string, string> = {
  inbox:    '收件箱',
  candidate:'候选',
  verified: '已验证',
  linked:   '已链接',
  stale:    '过期',
  archived: '归档',
};
```

### 3.4 Page-level notice (anti-write misunderstanding)

```tsx
<div className="knowledge-control-notice">
  录入请前往「知识」页（保留显式写入路径）
</div>
```

---

## 4. Test Commands

```bash
# Baseline
npx vitest run tests/knowledge-control-readonly.test.ts tests/screen-boundary-contract.test.ts

# New tests:
# 1. Construct fixture vault file containing "sk-proj-abc123...secret" → assert rendered output does NOT contain plaintext secret
# 2. Assert redacted block shows "●●●● 已遮蔽"
# 3. Assert click-to-reveal requires confirmation
# 4. Assert allow_prompt_use badge renders (yes/no variants)
# 5. Assert "来源未验证" shown when trust/provenance fields are absent
# 6. Assert no ingest/write/drag entry points exist in DOM
```

---

## 5. Rollback

```bash
git checkout -- src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx src/renderer/src/assets/main.css
```

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

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

---

## 7. Approval Gate

- [ ] User confirms redaction pattern list (AWS/Stripe/GitHub/private-key/heuristic)
- [ ] User confirms click-to-reveal requires confirmation dialog
- [ ] User confirms card four-element order: title → source → trust → prompt_use
- [ ] User confirms column Chinese labels per audit table
- [ ] Execute after `UI-CN-001a` (Chinese badge vocabulary available)
- [ ] Execute after `UI-SAFETY-001` (redaction test added to hardened test suite)
