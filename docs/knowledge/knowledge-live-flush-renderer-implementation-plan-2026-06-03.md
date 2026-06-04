# Hermes Pro — Knowledge Live Flush Renderer Implementation Plan (2026-06-03)

> Slice 007E — Renderer Implementation Plan / Spec Only
> 范围: 规划文档 + 测试; 不实现 React 组件, 不改 renderer/src, 不接 IPC, 不改 preload。
> 上游: 004-007D (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck + 3 fixtures)
> 下游: 007F (renderer fixture acceptance spec, 仍 no impl) / 008A (real adapter design, 仍 no runtime) / 真实 renderer 实装 (另批)

## 1. Purpose

为未来 renderer 实装 **Knowledge Live Flush confirmation UI** 制定 implementation plan / spec。

- 规划组件边界, 不写组件
- 规划数据流, 不接 IPC
- 规划 i18n 键表, 不改 `locales/`
- 规划 a11y / 键盘流, 不写 React
- 规划 Playwright 截屏采集, 不启 dev server / 不跑 Playwright

防止未来实装时:

- 误把 `confirm` 等同"已写入"
- 误走 `window.hermesAPI.knowledgeIngest(`
- 误新增 IPC bridge
- 误用 `MEMORY.md` / Obsidian vault / `.wolf/*` 等错误 destination
- 误跨 slice 提前接 Slice 008 live adapter

## 2. Non-goals (本 slice 明确不做)

- ❌ 不实现任何 React 组件 / `.tsx` 文件
- ❌ 不改 `src/renderer/src/**` 任何文件
- ❌ 不改 `src/preload/index.ts` / `src/preload/index.d.ts`
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter
- ❌ 不在 Claude / Codex / Hermes default system prompt 落地契约
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径 (Obsidian Vault / MEMORY.md / .wolf/* / `notes/<topic>.md`)
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ 不做 i18n 翻译 (本 slice 仅列 key namespace)

## 3. Current prerequisites (上游已交付)

| Slice | 状态 | 关键文件 |
|-------|------|----------|
| 004 | ✅ | `src/shared/lib/knowledge-reuse-protocol.ts` (`KnowledgeIngestDraft` shape) |
| 005 | ✅ | `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Agent prompt 契约) |
| 006 | ✅ | `src/shared/lib/knowledge-reuse-integration.ts` (`HermesKnowledgeReuseDryRunPayload`) |
| 006.5-006.9 | ✅ | `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` + `validateKnowledgeSourceFidelity` + `validateKnowledgeBucketSemantics` |
| 007A | ✅ | `src/shared/lib/knowledge-live-flush-contract.ts` (`LiveFlushRequest` shape) |
| 007B | ✅ | `src/shared/lib/knowledge-live-flush-contract.ts` (`buildPendingLiveFlushRequest` / `buildHermesKnowledgeFrontmatter` / `classifyLiveFlushFailure` / `assertLiveFlushStillDryRun`) |
| 007C | ✅ | `src/shared/lib/knowledge-live-flush-ui-contract.ts` (`reduceConfirmation` + 5 投影 + enablement) |
| **007D** | ✅ | `docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md` + 3 fixtures + `buildKnowledgeFlushCopyDeck` / `scanForbiddenFlushUiCopy` |

**核心契约**: renderer 永远不接 IPC, 仅消费 007C 投影 + 007D copy deck 字符串。状态机由 `reduceConfirmation` 驱动。

## 4. Proposed renderer entry point

未来实装的**唯一入口** (顶层 React 组件):

```tsx
// 未来实装, 本 slice 不写
<KnowledgeFlushConfirmationPanel
  request={liveFlushRequest}            // LiveFlushRequest, 来自上游 IPC 调用方 (留 008)
  now_iso={isoString}                   // ISO 8601, 用于 reducer 时间戳
  onClose={...}                        // 父组件回调, 留空函数
  onRejected={...}                     // 同上
  onCapturedPending={...}              // 同上, 仅通知 "draft 标为 pending"
/>
```

**关键**: 顶层组件**不接 IPC**, 仅消费 props。`request` 由父组件 (留 008 决策) 注入, 本 slice 不指定注入方式。

**集成位置**: Hermes Pro Knowledge 屏 (`src/renderer/src/screens/Knowledge/Knowledge.tsx`), 沿用现有 `KnowledgeTab` 体系, 新增 `knowledgeFlushConfirm` tab。**当前 slice 不改 Knowledge.tsx**。

## 5. Component boundary plan (规划, 非实装)

未来 7 个组件, 严格按职责拆分。**仅规划, 不写 .tsx**。

### 5.1 `KnowledgeFlushConfirmationPanel` (顶层容器)

- **职责**: 持 `useReducer(reduceConfirmation, INITIAL_CONFIRMATION_STATE)`, 渲染 3 步向导
- **props**: `request: LiveFlushRequest` / `now_iso?: string` / `onClose` / `onRejected` / `onCapturedPending`
- **不接 IPC**
- **不直接读 `request.ingest_draft.*` raw** — 仅调 007C 投影函数

### 5.2 `KnowledgeFlushDraftPreview`

- **职责**: 渲染 `projectRequestToSummary(request)` — title / summary / primary source / counts / keywords
- **不接 IPC**
- **不持有 state**

### 5.3 `KnowledgeFlushGateCard`

- **职责**: 渲染单张 gate card (label + status + summary + issues)
- **props**: `card: UIGateCard` (007C 类型)
- **可复用 5 次** (user_confirmation / source_fidelity / bucket_semantics / roadmap_guard / secret_guard)
- **不接 IPC**

### 5.4 `KnowledgeFlushRiskCard`

- **职责**: 渲染单张 risk card (category + severity + copy)
- **props**: `card: UIRiskCard` (007C 类型)
- **可复用 6 次**
- **不接 IPC**

### 5.5 `KnowledgeFlushSourceFidelityPanel`

- **职责**: 渲染 `local_findings` / `web_findings` / `stale_sources` 三段列表
- **props**: `request: LiveFlushRequest`
- **invariant**: 严格只读, 不修改 finding
- **不接 IPC**

### 5.6 `KnowledgeFlushBucketSemanticsPanel`

- **职责**: 渲染 5 项 bucket semantics 校验结果 (来自 Slice 006.9)
- **props**: `bucketReport: KnowledgeBucketValidationReport` (006.9 类型)
- **不接 IPC**

### 5.7 `KnowledgeFlushFooterActions`

- **职责**: 渲染 Confirm Flush / Reject / Close 按钮 + phrase 输入框 + risks checkbox + safety footer
- **职责** 包含: 调用 `computeConfirmButtonEnabled`, 触发 `dispatch({ type: "approve", ... })` 等 reducer action
- **不接 IPC** — approve 只转 state 到 `approved`, 不调任何 IPC

## 6. Data flow plan (硬规则)

```
上游 (留 008 决策)
    │
    │  buildPendingLiveFlushRequest()  ← 来自 007B helper
    │  ↓
    │  LiveFlushRequest
    │
    ▼
KnowledgeFlushConfirmationPanel (props.request)
    │
    │  useReducer(reduceConfirmation, INITIAL_CONFIRMATION_STATE)
    │  ↓
    │  ConfirmationState
    │
    ▼
KnowledgeFlushDraftPreview / KnowledgeFlushGateCard × 5 / KnowledgeFlushRiskCard × 6
    │
    │  仅调 007C 纯函数 (projectRequestToSummary / projectGates / projectRisks)
    │  ↓
    │  渲染 UISummaryCard / UIGateCard[] / UIRiskCard[]
    │
    ▼
KnowledgeFlushFooterActions
    │
    │  computeConfirmButtonEnabled({ state, expected_phrase })
    │  ↓
    │  按钮 disabled/enabled
    │
    │  点击 Confirm Flush:
    │  dispatch({ type: "approve", confirmation_phrase: "我授权 flush" })
    │  ↓
    │  reducer 内部三门检查 (phrase + acks + 0 block)
    │  ↓
    │  state.phase = "approved"
    │
    ▼
onCapturedPending (props callback)  ──→  父组件 (留 008 决策)
    │
    │  注意: 这一步**不**触发任何 IPC
    │  IPC 调用留待 Slice 008 真实 adapter 实装
    │
    ▼
(state, UI 不再变化, 等待 dialog 关闭)
```

### 6.1 硬规则 (任何未来实装都必守)

1. **renderer 仅消费 `LiveFlushRequest` props**, 不构造, 不修改。
2. **renderer 仅调 007C 纯函数**, 不写自己的 fetch / 不写自己的 localStorage 读取。
3. **renderer 0 IPC 调用** — `window.hermesAPI.knowledgeIngest(` / `knowledgeSearch(` / 任何 `runPlaybook` / `sendMessage` / `triggerCronJob` 全部禁止。  
   硬规则英文: `renderer does not call knowledgeIngest` / `renderer does not call knowledgeSearch` / `renderer does not call IPC`。
4. **renderer 0 gateway 调用** — `window.hermesAPI.gateway*` 全部禁止。  
   硬规则英文: `renderer does not call gateway`。
5. **approve action 只改 UI state** — 状态机从 `open` 转 `approved`, 不发任何网络请求, 不调任何 IPC, 不写任何文件。  
   硬规则英文: `confirm action only changes UI state` / `approve action only changes UI state`。
6. **approved ≠ 已写入** — UI 文案沿用 007D § 9 `terminal_copy.approved`, 显式说明 "no write to the knowledge base has happened"。
7. **close action 必清空所有 input 字段** — 防止 stale state 复发 (phrase / acks)。
8. **renderer 不发明 destination** — 不出现 Obsidian Vault 路径输入框 / 不出现 MEMORY.md 路径输入框 / 不出现 `.wolf/cerebrum.md` 路径输入框 (沿用 007D § 11.2 forbidden)。
9. **renderer 永不假装 flush 成功** — 即使用户完成三门 (phrase + acks + 0 block), 也仅 transition 到 `approved`, 文案明示 "Pending live flush adapter approval"。

**数据流输入/输出硬约束 (英文规则字面)**:

- `renderer consumes already-built pending/dry-run payload`
- `renderer calls only pure helper projections`
- `renderer does not call knowledgeIngest`
- `renderer does not call knowledgeSearch`
- `renderer does not call gateway`
- `renderer does not call IPC`
- `confirm action only changes UI state`
- `approve action only changes UI state`
- `no live write from renderer in this phase`
- `confirm only changes UI state, not live write` (variant, substring match)
- `approve only changes UI state, not live write` (variant, substring match)

## 7. Helper usage contract

renderer 必遵守 007C helper 投影契约, 不得直接读 `LiveFlushRequest` raw 字段:

| 渲染位置 | 应调函数 | 禁止直接读 |
|---------|---------|-----------|
| Draft preview | `projectRequestToSummary(request)` | `request.ingest_draft.title` / `request.ingest_draft.summary` / `request.ingest_draft.sources[0]?.source_uri` |
| 5 gate cards | `projectGates(request, validation.issues)` | `request.source_fidelity_result.ok` / `request.bucket_semantics_result.ok` / `request.roadmap_guard_result.allowed` |
| 6 risk cards | `projectRisks(request, { blocking_issue_count })` | `request.ingest_draft.roadmap_change_allowed` / `request.ingest_draft.local_findings[0].do_not_use_as_current_truth` |
| Confirm button | `computeConfirmButtonEnabled({ state, expected_phrase })` | 直接比较 `state.confirmation_phrase_typed === "我授权 flush"` |
| All copy | `buildKnowledgeFlushCopyDeck()` + `t("knowledge.flush.*")` | 任何硬编码字符串 |
| Scanner | `scanForbiddenFlushUiCopy({ text: <flattened copy> })` | 任何手写 substring 检查 |
| Reducer | `reduceConfirmation(state, action)` | 直接 `useState` 模拟 step |

**唯一允许直接读**: `request.draft_id` (用于埋点 / 调试日志, **不入 audit**) 与 `request.user_confirmation.confirmed_at` (用于 Step 1 文案展示)。

## 8. i18n key plan

未来实装时, 把 007D copy deck 全部字符串迁到 i18n 资源。namespace 固定 `knowledge.flush.*` (沿用 Hermes Pro 现有 i18n 体系)。

### 8.1 建议 key namespace

```
knowledge.flush.header.title
knowledge.flush.header.subtitle
knowledge.flush.header.pendingBadge

knowledge.flush.body.reviewRequest.intro
knowledge.flush.body.reviewRequest.primarySourceCaption
knowledge.flush.body.reviewEvidence.intro
knowledge.flush.body.reviewEvidence.staleCaption
knowledge.flush.body.reviewRisks.intro
knowledge.flush.body.reviewRisks.phraseLabel
knowledge.flush.body.reviewRisks.risksAcknowledgementLabel

knowledge.flush.gate.userConfirmation.label
knowledge.flush.gate.userConfirmation.pass
knowledge.flush.gate.userConfirmation.warn
knowledge.flush.gate.userConfirmation.fail
knowledge.flush.gate.sourceFidelity.label
knowledge.flush.gate.sourceFidelity.pass
knowledge.flush.gate.sourceFidelity.warn
knowledge.flush.gate.sourceFidelity.fail
knowledge.flush.gate.bucketSemantics.label
knowledge.flush.gate.bucketSemantics.pass
knowledge.flush.gate.bucketSemantics.warn
knowledge.flush.gate.bucketSemantics.fail
knowledge.flush.gate.roadmapGuard.label
knowledge.flush.gate.roadmapGuard.pass
knowledge.flush.gate.roadmapGuard.warn
knowledge.flush.gate.roadmapGuard.fail
knowledge.flush.gate.secretGuard.label
knowledge.flush.gate.secretGuard.pass
knowledge.flush.gate.secretGuard.warn
knowledge.flush.gate.secretGuard.fail

knowledge.flush.risk.roadmapMutation.label
knowledge.flush.risk.roadmapMutation.explainer
knowledge.flush.risk.staleSourcePromotion.label
knowledge.flush.risk.staleSourcePromotion.explainer
knowledge.flush.risk.secretLeak.label
knowledge.flush.risk.secretLeak.explainer
knowledge.flush.risk.vaultAuthorityClaim.label
knowledge.flush.risk.vaultAuthorityClaim.explainer
knowledge.flush.risk.externalInstructionAuthority.label
knowledge.flush.risk.externalInstructionAuthority.explainer
knowledge.flush.risk.liveFlushPendingHardening.label
knowledge.flush.risk.liveFlushPendingHardening.explainer

knowledge.flush.confirmation.inputLabel
knowledge.flush.confirmation.expectedPhrase
knowledge.flush.confirmation.matchHelper

knowledge.flush.disabledReason.awaitingPhrase
knowledge.flush.disabledReason.awaitingRisksAck
knowledge.flush.disabledReason.blockedByValidation

knowledge.flush.terminal.approved.title
knowledge.flush.terminal.approved.body
knowledge.flush.terminal.approved.nextStepPendingLiveAdapter
knowledge.flush.terminal.rejected.title
knowledge.flush.terminal.rejected.bodyDefault
knowledge.flush.terminal.rejected.bodyWithReason
knowledge.flush.terminal.blockedByValidation.title
knowledge.flush.terminal.blockedByValidation.body
knowledge.flush.terminal.blockedByValidation.nextStepEditOrReview

knowledge.flush.safetyFooter

knowledge.flush.scanner.label
knowledge.flush.scanner.okLabel
knowledge.flush.scanner.failLabel
```

**本 slice 不写 i18n 资源文件** (沿用 007D § 12 future 提案)。i18n 实装留待未来 008/009 之后的 renderer 批次。

## 9. Accessibility plan

### 9.1 Focus order (DOM 顺序)

```
1. Dialog title (h2)
2. Close button (top-right)
3. Step 1 intro (read-only)
4. Draft preview fields
5. Next button (advance_to step 1→2)
6. Step 2 intro
7. Gate card 1 (user_confirmation)
8. Gate card 2 (source_fidelity)
9. Gate card 3 (bucket_semantics)
10. Gate card 4 (roadmap_guard)
11. Gate card 5 (secret_guard)
12. local_findings / web_findings / stale_sources (折叠)
13. Next button (advance_to step 2→3)
14. Step 3 intro
15. Risk card 1-6
16. Confirmation phrase input
17. Risks acknowledgement checkbox
18. Confirm Flush button (always in tab order, but aria-disabled)
19. Reject button
20. Safety footer (read-only)
```

### 9.2 ARIA labels

| Element | `aria-*` |
|---------|---------|
| Dialog | `role="dialog"` / `aria-modal="true"` / `aria-labelledby="flush-dialog-title"` |
| Confirm Flush button | `aria-disabled={!confirm_button_enabled}` / `aria-describedby="confirm-button-reason"` |
| Disabled reason | `id="confirm-button-reason"` / `aria-live="polite"` |
| Gate card fail | `role="alert"` / `aria-live="assertive"` (只触发一次) |
| Gate card pass/warn | `role="status"` / `aria-live="polite"` |
| Risk card | `aria-label` = category name (e.g. "Roadmap mutation risk") |
| Phrase input | `aria-required="true"` / `aria-invalid={!matches}` / `aria-describedby="phrase-helper"` |
| Risks checkbox | `aria-required="true"` |
| Safety footer | `role="contentinfo"` |

### 9.3 Keyboard-only confirmation flow

| Key | 上下文 | 行为 |
|-----|--------|------|
| `Tab` / `Shift+Tab` | 任意 | 顺序焦点切换 (按 § 9.1) |
| `Enter` | Step 1 焦点在 Next 按钮 | `dispatch({ type: "advance_to", step: "review_evidence" })` |
| `Enter` | Step 2 焦点在 Next 按钮 | `dispatch({ type: "advance_to", step: "review_risks" })` |
| `Enter` | Step 3 焦点在 Confirm Flush (enabled) | `dispatch({ type: "approve", confirmation_phrase })` |
| `Enter` | Step 3 焦点在 Confirm Flush (disabled) | 无操作 (focus trap) |
| `Escape` | 任意 | `dispatch({ type: "close" })` |
| `Cmd+Enter` | 任意 | 同 `Enter` (Mac 习惯) |
| `Space` | Risk checkbox | toggle `state.risks_acknowledged` (via reducer action) |

### 9.4 Reduced motion / no animation

- 默认无动画 (instant render)
- 任何 step 切换不 fade / 不 slide (避免 animation 触发 `prefers-reduced-motion` 用户分心)
- 任何 disabled 状态变化不闪烁 / 不 pulse

## 10. Keyboard flow (详细步骤)

### 10.1 用户进入 dialog

1. 焦点在 Close 按钮 (top-right)
2. 用户可 `Tab` 到 Step 1 intro 段 (skip link), 或 `Shift+Tab` 反向

### 10.2 Step 1 (review_request)

- 焦点循环: Draft preview fields → Next button
- 必显: header / 5 字段 (title / summary / primary source / counts / keywords) / pending_badge
- `Enter` (Next 按钮) → step 2
- `Escape` → close

### 10.3 Step 2 (review_evidence)

- 焦点循环: 5 gate cards → local_findings 折叠区 → bucket semantics panel → Next button
- 必显: 5 gate status (pass / warn / fail), 失败 gate 顶置 + `aria-live="assertive"`
- 折叠区默认 collapsed, `Space` / `Enter` 展开
- `Enter` (Next 按钮) → step 3
- `Escape` → close

### 10.4 Step 3 (review_risks)

- 焦点循环: 6 risk cards → phrase input → risks checkbox → Confirm Flush (disabled) → Reject → safety footer
- 必显: 6 risk severity badge, 第 6 张恒 info
- phrase 输入后, **focus 保留在 input**, 实时显示 match/unmatch
- 勾选 risks checkbox → 实时 enable 检查
- Confirm Flush 启用条件 (computed by 007C): phrase 严格匹配 + risks_acked + 0 block
- `Enter` (Confirm Flush enabled) → `dispatch approve` → state 转 `approved` → 终态 body 显 "Pending live flush adapter approval"
- `Enter` (Confirm Flush disabled) → focus trap, 无操作
- `Escape` → close (等同 Reject, 无 reject_reason)

### 10.5 终态 (approved / rejected / blocked_by_validation)

- 焦点: Reject/Close button (若无) → Close button
- `Escape` → close
- `Tab` 锁在 dialog 内 (focus trap)

## 11. Visual states

3 个 fixture 状态对应 3 个 visual state:

| Fixture | Visual state | Confirm Flush |
|---------|--------------|---------------|
| `draft-ready-pass.json` | All pass (绿色 badge) | disabled (灰) |
| `blocked-by-source-fidelity.json` | 1 fail (红色 badge) | disabled (灰) |
| `confirmation-captured-pending-adapter.json` | Terminal pending (黄 badge) | disabled (灰, label="Awaiting live flush adapter approval") |

颜色与现有 Hermes Pro theme 对齐 (light + dark 双模), 不引入新色板。

- pass: `text-green-600 dark:text-green-400`
- warn: `text-amber-600 dark:text-amber-400`
- fail: `text-red-600 dark:text-red-400`
- block (risk): 同 fail
- info (risk): `text-muted-foreground`
- pending: `text-amber-600 dark:text-amber-400` (复用 warn)

## 12. Test plan

### 12.1 已存在 (本 slice 不补)

- `tests/knowledge-live-flush-ui-confirmation.test.ts` — 007C reducer / 投影 (44 tests)
- `tests/knowledge-live-flush-ui-copy-deck.test.ts` — 007D copy deck / fixtures / scanner (~50 tests)

### 12.2 未来实装待补 (renderer 组件, 留 008 后)

- `tests/renderer/KnowledgeFlushConfirmationPanel.test.tsx`
  - mount with fixture `draft-ready-pass.json` → snapshot + a11y check
  - 3 步切换 dispatch 序列
  - phrase 错/对 → Confirm Flush 启用切换
  - risks checkbox toggle → Confirm Flush 启用切换
  - approve (enabled) → 终态 terminal 渲染 "Confirmation captured"
  - approve (disabled) → focus trap, 无操作
  - escape → close → state.reset
  - forbidden copy scanner 跑在 mount 后 flatten copy → 0 hit

- `tests/renderer/KnowledgeFlushGateCard.test.tsx`
  - 5 gates × 3 status (pass / warn / fail) → snapshot
  - fail 触发 `aria-live="assertive"`

- `tests/renderer/KnowledgeFlushRiskCard.test.tsx`
  - 6 risks × 多 severity → snapshot
  - block severity 标红 + label 不可点

- `tests/renderer/KnowledgeFlushFooterActions.test.tsx`
  - 三重门 enablement 行为

### 12.3 单元 (本 slice 已覆盖, 不重写)

- 007C reducer / 投影 (44 tests) — 已是纯函数, 视同 renderer 单元测试输入
- 007D scanner / fixtures (~50 tests) — 已是 fixture 渲染契约

### 12.4 集成 (未来实装, 留 008 后)

- fixture → 投影 → renderer mount 端到端
- IPC absence assertion: grep `src/renderer/src/screens/Knowledge/KnowledgeFlushConfirm*` 无 `window.hermesAPI.knowledgeIngest` / `knowledgeSearch` / `runPlaybook` 等

### 12.5 Forbidden copy scanner test (本 slice 已覆盖)

- `tests/knowledge-live-flush-ui-copy-deck.test.ts` § 7 / § 8 跑 scanner, 期望 `ok=true`
- 未来 renderer 组件 test 加 `expect(scanForbiddenFlushUiCopy({ text: render.textContent })).ok === true`

### 12.6 No-runtime token rg assertion (本 slice 已存在, 未来实装仍跑)

```bash
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" \
  src/renderer/src/screens/Knowledge/KnowledgeFlush* \
  src/renderer/src/components/KnowledgeFlush*
```

期望 0 命中 (排除 doc comment / 自查字面量)。

## 13. Playwright screenshot plan (留 008 后, 本 slice 不跑)

### 13.1 3 fixture 对应 3 截图

| Fixture | Screenshot | 验证点 |
|---------|-----------|--------|
| `draft-ready-pass.json` | `.wolf/designqc-captures/knowledge-flush-draft-ready.png` | 5 pass gates, Confirm Flush 灰 |
| `blocked-by-source-fidelity.json` | `.wolf/designqc-captures/knowledge-flush-blocked.png` | source_fidelity 红色, terminal 指向 edit/review |
| `confirmation-captured-pending-adapter.json` | `.wolf/designqc-captures/knowledge-flush-pending.png` | 终态 "Awaiting live flush adapter approval" label |

> 显式声明: screenshot only after future renderer implementation。本 slice 不启 dev server, 不跑 Playwright, 不采集截屏 (current slice does not start dev server / does not run Playwright / does not capture screenshots)。

### 13.2 采集流程 (留 008 后实装)

```bash
# 1. 起 dev server (留 008 决策)
pnpm dev

# 2. 跑 Playwright fixture 模式 (留 008 决策)
pnpm test:e2e:knowledge-flush

# 3. 跑 designqc 截屏
openwolf designqc --routes /knowledge/flush-confirm
```

### 13.3 本 slice 明确不跑

- ❌ 不启 dev server
- ❌ 不跑 Playwright
- ❌ 不采集截屏
- ❌ 不调用 `openwolf designqc`

未来实装时, 必须先经用户显式批准 + Slice 008 真实 adapter 至少一端已实装。

## 14. Forbidden copy scan plan

任何 renderer PR 必跑:

```bash
npx vitest run tests/knowledge-live-flush-ui-copy-deck.test.ts
```

期望: 全部 PASS, 含:

- `scanForbiddenFlushUiCopy({ text: flattenCopyDeckForScan(deck) })` → `ok=true`
- 3 fixture 的 `forbidden_phrase_scan.ok === true`
- 未来组件 test 跑 scanner over rendered text → `ok=true`

新增文案必先经 scanner, 命中即 reject PR (must pass scanner before merge)。

## 15. No-runtime acceptance criteria

未来实装 PR 必须满足下列全部条件方准入主线:

1. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.knowledgeIngest(`
2. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.knowledgeSearch(`
3. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.runPlaybook(` / `sendMessage(` / `triggerCronJob(`
4. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.gateway*(`
5. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `fetch(` / `axios` / `XMLHttpRequest`
6. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 "已保存" / "写入成功" / "确认后将写入" / "saved successfully" / "will be written after confirm"
7. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 "Obsidian Vault path" / "MEMORY.md" / ".wolf/cerebrum" / ".wolf/anatomy"
8. `7 个未来组件全部存在, 文件名严格按 § 5 命名`
9. `npx vitest run tests/renderer/KnowledgeFlush*` 全部 PASS
10. `npx vitest run` 全 suite 无回归
11. `npm run typecheck` 双端 EXIT 0
12. `git diff --check` clean
13. `rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" src/renderer/src/screens/Knowledge/KnowledgeFlush* src/renderer/src/components/KnowledgeFlush*` 0 命中
14. `Playwright 截屏采集 3 fixture, 入 .wolf/designqc-captures/`
15. `forbidden_phrase_scan` 在所有 3 fixture 跑通, `ok=true`

任一失败 → 拒绝 merge。

## 16. Future implementation slices

按依赖顺序:

### 16.1 Slice 007F (renderer fixture acceptance spec) — 推荐下一步

- 范围: 为 7 个未来组件的每一类写**组件级 acceptance test spec** (无 .tsx), 含 mock 投影 / 3 fixture 注入 / a11y 断言
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-renderer-fixture-acceptance-2026-06-XX.md` (待批)
  - `tests/knowledge-live-flush-renderer-fixture-acceptance.test.ts` (本 slice 不写, 留 007F)
- 仍不写 React / 不接 IPC

### 16.2 Slice 008A (real adapter implementation design) — 后启动

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)
- 预计 test:
  - adapter shape 校验 (待批)

### 16.3 Slice 008 (real live adapter) — 最后

- 范围: 真实 IPC + audit + Handoff Pack 兼容
- 需用户显式批 + 一次用户在场 flush 验收
- 不在本规划范围

## 17. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 样例: `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` (Slice 006.5)
- 速查: `docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md` (Slice 006.6)
- 评估: `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` (Slice 006.7)
- fidelity: `validateKnowledgeSourceFidelity` (Slice 006.8)
- bucket: `BucketSemanticsResult` (Slice 006.9)
- 007A design: `docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-contract.ts`
- 007B pure helper: `docs/knowledge/knowledge-live-flush-contract-helper-2026-06-03.md`
- 007C UI design: `docs/knowledge/knowledge-live-flush-ui-confirmation-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-ui-contract.ts` (核心 reducer / 投影)
- 007D copy deck: `docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md` + 3 fixtures + helper 扩展
- **007E (本 slice)**: 本 doc + `tests/knowledge-live-flush-renderer-plan.test.ts`
- 007F (待批): renderer fixture acceptance spec (无 React)
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 18. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

- Round 2 C
- hard cutover
- HCC Auto Executor 启动
- WeChat / iLink 实际投递
- cron 实际执行
- locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- Hermes Agent default system prompt 改写
- Claude Code `CLAUDE.md` 契约改写
- Codex `AGENTS.md` 契约改写
- 真实 renderer 组件实装
- 真实 live adapter
- 真实 `~/.hermes/handoff/packs` / `~/.hermes/audit` 写入
- 启 dev server / 跑 Playwright / 采集截屏
