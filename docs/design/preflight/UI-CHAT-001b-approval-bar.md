# Preflight — UI-CHAT-001b (Approval Bar Hardening + Chinese Regex)

> Status: **AWAITING APPROVAL**. No implementation has started.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` P2-3, D.3, H, I-3, I-7
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §6.1.1

---

## 1. Objective

Fix P2-3: Chat approval bar detection uses only English regex patterns, missing Chinese-language danger prompts from agents. Also upgrade the approval bar visual design to make approval semantics clearer.

**Target**:
- Add Chinese regex patterns to `APPROVAL_RE` without removing existing English patterns
- Upgrade approval bar visuals: full-width orange left-edge strip, Chinese title, explicit button labels
- Log approval bar appearance events for future regex calibration

**Non-goal**: structured approval message protocol (ACUI `approval.requested` event type) — that is a protocol-layer change requiring separate approval per audit §J.

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/Chat/Chat.tsx` | Add Chinese patterns to `APPROVAL_RE`; restyle approval bar rendering | MEDIUM — touches safety UI |
| `src/renderer/src/assets/main.css` | Approval bar styling (orange left-edge, Chinese button labels) | LOW |

**Not touched**: IPC handlers, backend message parsing, message protocol.

---

## 3. Expected Diff (draft)

### 3.1 `APPROVAL_RE` — append Chinese patterns

```diff
  const APPROVAL_RE = /⚠️.*dangerous|requires? (your )?approval|\/approve.*\/deny|do you want (me )?to (proceed|continue|run|execute)/i;
+ // Chinese patterns added 2026-06 per audit P2-3
+ const APPROVAL_RE_CN = /需要.*(确认|审批)|是否(继续|执行|运行)|危险操作|请(确认|批准)/i;
+ const APPROVAL_RE_COMBINED = new RegExp(APPROVAL_RE.source + '|' + APPROVAL_RE_CN.source, 'i');
```

**Pattern rationale** (per audit D.3):

| Chinese pattern | Catches |
|---|---|
| `需要.*(确认\|审批)` | "需要你的确认" / "需要审批" |
| `是否(继续\|执行\|运行)` | "是否继续执行？" / "是否运行？" |
| `危险操作` | Direct danger marker |
| `请(确认\|批准)` | "请确认" / "请批准" |

### 3.2 Approval bar visual upgrade

```tsx
// Before: compact row with Approve/Deny buttons
// After:
<div className="hp-approval-bar">
  <div className="hp-approval-bar-header">
    ⚠ 代理请求审批
  </div>
  <div className="hp-approval-bar-excerpt">
    {agentMessageExcerpt}
  </div>
  <div className="hp-approval-bar-actions">
    <button onClick={() => sendMessage("/approve")}>
      批准（发送 /approve）
    </button>
    <button onClick={() => sendMessage("/deny")}>
      拒绝（发送 /deny）
    </button>
  </div>
  <div className="hp-approval-bar-note">
    按钮将以消息形式发送给代理，不是本地开关。
  </div>
</div>
```

### 3.3 CSS

```css
.hp-approval-bar {
  border-left: 3px solid var(--hp-state-warn);
  background: rgba(255,159,10,0.08);
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 0 var(--hp-radius-md) var(--hp-radius-md) 0;
}
```

---

## 4. Test Commands

```bash
# Baseline
npx vitest run tests/screen-boundary-contract.test.ts

# New test cases (add to Chat test suite):
# 1. APPROVAL_RE_CN matches "需要你的确认才能继续"
# 2. APPROVAL_RE_CN matches "是否继续执行？"
# 3. APPROVAL_RE_CN matches "危险操作，请确认"
# 4. APPROVAL_RE_CN does NOT match "今天天气怎么样"
# 5. Approval bar renders Chinese title "代理请求审批"
# 6. Buttons display explicit message-send semantics
```

---

## 5. Rollback

```bash
git checkout -- src/renderer/src/screens/Chat/Chat.tsx src/renderer/src/assets/main.css
```

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Structured approval protocol (ACUI event type) | NOT in scope — regex only |
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| New IPC channels | ZERO added |
| Backend message parsing changes | NONE |
| Removal of existing APPROVAL_RE English patterns | NONE removed — additive only |

---

## 7. Approval Gate

- [ ] User reviews and approves Chinese regex patterns (4 categories)
- [ ] User confirms button labels: `批准（发送 /approve）` / `拒绝（发送 /deny）`
- [ ] User confirms "按钮将以消息形式发送" disclaimer
- [ ] Execute after `UI-CN-001a` (Chinese badge/title vocabulary available)
- [ ] Approval regex changes require test case review per audit I-7
