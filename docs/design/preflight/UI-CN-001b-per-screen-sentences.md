# Preflight — UI-CN-001b (Per-Screen Chinese Sentences + Confirm Dialog Template)

> Status: **EXECUTED 2026-06-11**. Per-screen disclaimers + ConfirmDialog complete.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` F, G, H
> Parent preflight: `docs/design/preflight/UI-CN-001a-badge-localization.md`
> Scope note: this was originally part of `UI-CN-001` (audit H table), split into 001a (badge component) and 001b (this doc — per-screen sentences + confirm dialog).

---

## 1. Objective

Complete the Chinese-localization layer after `UI-CN-001a` (badge component):

1. **Read-only page fixed sentences**: add the bilingual fixed disclaimer to Mission, KnowledgeControl, and HccCockpit top sections
2. **Dangerous-action confirmation dialog template**: a reusable component for all write/runtime actions across the app
3. **Four high-frequency confirm scenarios**: delete-file, install-dependency, batch-modify, cron-manual-trigger — pre-built instances of the template

---

## 4. Expected Diff (draft)

### 4.1 Read-Only Page Fixed Sentence

Per audit §G:

```
本页仅展示状态，不会自动执行任何操作。
Status display only · No automatic execution
```

Applies to: `Mission.tsx`, `KnowledgeControl.tsx`, `HccCockpit.tsx` — placed at top of main content area, low-saturation style.

---

### 4.2 Confirm Dialog Template

Per audit §G table — unified across all write/runtime actions:

```
标题：确认执行「{动作名}」？
正文：{影响范围一句话}。此操作{可/不可}撤销。
辅助：上次执行：{时间 · 结果}（如适用）
按钮：[取消]（默认聚焦） [确认执行]（橙色）
```

**Component props**:
```ts
interface ConfirmDialogProps {
  actionName: string;
  description: string;
  reversible: boolean;
  lastRun?: { time: string; result: string };
  onConfirm: () => void;
  onCancel: () => void;
}
```

**Four pre-built scenarios** (per audit §G):

| Scenario | actionName | description | reversible |
|---|---|---|---|
| Delete file | 删除文件 | 删除文件需要人工确认 | false |
| Install dependency | 安装依赖 | 安装依赖会改变运行环境，需审批后执行 | false |
| Batch modify | 批量修改 | 将修改 {n} 个文件。批量修改风险较高，请先确认影响范围 | false |
| Cron manual trigger | 运行定时任务 | 将立即运行「{job}」 | true |

---

## 5. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/Mission/Mission.tsx` | Add `<ReadOnlyDisclaimer />` at top | LOW |
| `src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx` | Add `<ReadOnlyDisclaimer />` at top | LOW |
| `src/renderer/src/screens/HccCockpit/HccCockpit.tsx` | Add `<ReadOnlyDisclaimer />` at top | LOW |
| `src/renderer/src/components/ConfirmDialog/ConfirmDialog.tsx` | **NEW** — reusable dialog component, zero IPC | LOW |
| `src/renderer/src/assets/main.css` | Dialog overlay + button styles | LOW |

**Not touched**: IPC handlers, route table, preload, main process, package.json.

---

## 6. Test Commands

```bash
# Baseline
npx vitest run tests/mission-control-readonly.test.ts tests/knowledge-control-readonly.test.ts tests/screen-boundary-contract.test.ts

# New assertions:
# 1. Mission.tsx renders "本页仅展示状态" fixed sentence
# 2. KnowledgeControl.tsx renders same sentence
# 3. ConfirmDialog renders Chinese title + description + correct button labels
# 4. "取消" button gets default focus
# 5. "确认执行" button uses orange accent
```

---

## 7. Rollback

```bash
rm -rf src/renderer/src/components/ConfirmDialog/
git checkout -- src/renderer/src/screens/Mission/Mission.tsx src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx src/renderer/src/screens/HccCockpit/HccCockpit.tsx src/renderer/src/assets/main.css
```

---

## 8. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Structured approval protocol | NOT in scope |
| Light mode polish | NOT in scope |
| New IPC channels | ZERO added |
| Package dependency changes | NONE |

---

## 9. Approval Gate

- [ ] User confirms read-only disclaimer wording (audit §G)
- [ ] User confirms confirm dialog template wording
- [ ] User confirms four pre-built scenarios are complete
- [ ] Execute after `UI-CN-001a` (badge component must exist first)
