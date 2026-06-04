# Hermes Pro — Knowledge Live Flush Renderer Fixture Acceptance Spec (2026-06-03)

> Slice 007F — Renderer Fixture Acceptance Spec / No Implementation
> 范围: spec doc + tests + spec fixture JSON; **不写** React 组件, **不写** .tsx, **不接** IPC, **不改** preload, **不启** dev server, **不跑** Playwright。
> 上游: 004-007E (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck + 3 fixtures / 007E renderer plan)
> 下游: 007G (renderer implementation readiness review, 仍 no impl) / 008A (real adapter design, 仍 no runtime) / 真实 renderer 实装 (另批)

## 1. Purpose

为未来 7 个 renderer 组件定义**fixture-based acceptance spec**。

- 把 007E § 5 组件边界 + 007D 3 fixture 固化为可重跑的测试契约
- 把 forbidden copy / a11y / keyboard / screenshot 验收标准自动化
- 把"approved ≠ 已写入"硬规则嵌入 acceptance matrix
- 防止未来实装时:
  - 误把 `confirm` 等同"已写入"
  - 误走 `window.hermesAPI.knowledgeIngest(`
  - 误用 `MEMORY.md` / Obsidian vault / `.wolf/*`
  - 误隐藏 stale_sources
  - 误跨 slice 提前接 Slice 008 live adapter
  - 误丢 a11y / 键盘 / 截屏 验收

## 2. Non-goals (本 slice 明确不做)

- ❌ 不实现任何 React 组件 / `.tsx` 文件
- ❌ 不新增任何 `.tsx` 文件
- ❌ 不改 `src/renderer/src/**` 任何文件
- ❌ 不改 `src/preload/index.ts` / `src/preload/index.d.ts` (no preload changes)
- ❌ 不接 IPC, 不改 preload (no IPC, no preload)
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 IPC, 不改 preload (no IPC, no preload)
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter
- ❌ 不在 Claude / Codex / Hermes default system prompt 落地契约
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ 不做 i18n 翻译 (本 slice 仅列 key namespace)
- ❌ 不实装 a11y (本 slice 仅列 a11y 验收契约)
- ❌ 不实装键盘流 (本 slice 仅列键盘事件验收契约)
- ❌ 不实装截屏采集 (本 slice 仅列截屏验收契约)

## 3. Fixture inventory (3 existing + 3 new spec)

### 3.1 现有 3 fixture (007D)

| Fixture | 路径 | 状态 |
|---------|------|------|
| `draft-ready-pass.json` | `tests/fixtures/knowledge-reuse/ui-confirmation/draft-ready-pass.json` | 5 pass gates, confirm disabled |
| `blocked-by-source-fidelity.json` | `tests/fixtures/knowledge-reuse/ui-confirmation/blocked-by-source-fidelity.json` | source_fidelity=fail, confirm disabled, terminal 指向 edit+review |
| `confirmation-captured-pending-adapter.json` | `tests/fixtures/knowledge-reuse/ui-confirmation/confirmation-captured-pending-adapter.json` | 终态 pending_live_flush, confirm 不可点 |

每 fixture 必含 12 key: `schema_version` / `state` / `mode` / `runtime_flush_allowed` / `live_adapter_approval` / `header_copy` / `body_copy` / `gate_cards` / `risk_cards` / `confirm_button` / `terminal_copy` / `forbidden_phrase_scan`。

### 3.2 新增 3 spec fixture (本 slice)

| Spec fixture | 路径 | 用途 |
|--------------|------|------|
| `component-acceptance-matrix.json` | `tests/fixtures/knowledge-reuse/ui-render-acceptance/component-acceptance-matrix.json` | 7 组件 × 3 fixture × 4-5 acceptance bullets 矩阵 |
| `forbidden-copy-assertions.json` | `tests/fixtures/knowledge-reuse/ui-render-acceptance/forbidden-copy-assertions.json` | forbidden 短语清单 + scanner 集成契约 + CI gate |
| `keyboard-flow-assertions.json` | `tests/fixtures/knowledge-reuse/ui-render-acceptance/keyboard-flow-assertions.json` | 20 步 tab order + 9 key event + phrase input + risk ack + focus trap + reduced motion |

**3 spec fixture 均为 spec-only JSON**, 不触发 runtime, 不被 `runtime` 加载, 仅供未来 007G+ component test 引用。

## 4. Component acceptance matrix (7 组件 × 4-5 bullets)

详见 `tests/fixtures/knowledge-reuse/ui-render-acceptance/component-acceptance-matrix.json` (`matrix[]` 数组)。

### 4.1 `KnowledgeFlushConfirmationPanel`

- renders state badge (pending_live_flush / live adapter approval pending)
- renders 3-step flow (review_request → review_evidence → review_risks)
- renders safety footer (runtime_flush_allowed = false · live adapter not approved · confirmation only makes the draft eligible)
- owns reducer state only (no parent-owned state for the dialog)
- confirm only changes UI state, not live write

### 4.2 `KnowledgeFlushDraftPreview`

- renders title / summary / local_findings / web_findings / stale_sources
- renders provenance / trust_level / retrieval_keywords
- does not hide stale_sources (stale_sources must be visible, never silently dropped)
- does not show 'saved' / 'written' / '已保存' / '写入成功' / 'saved successfully' / 'will be written after confirm' language

### 4.3 `KnowledgeFlushGateCard`

- renders pass / warn / fail states (3 distinct visual states)
- fail blocks confirmation (Fail component propagates 'gate failed' to reducer)
- includes accessible label (aria-label = gate name)
- covers 5 gates (user_confirmation / source_fidelity / bucket_semantics / roadmap_guard / secret_guard)

### 4.4 `KnowledgeFlushRiskCard`

- renders 6 risk cards (roadmap_mutation / stale_source_promotion / secret_leak / vault_authority_claim / external_instruction_authority / live_flush_pending_hardening)
- hard risks require acknowledgement (block severity → risks_acked must be true before Confirm Flush enabled)
- info risk does not block by itself (live_flush_pending_hardening is always info)
- no overpromise wording (no '已保存' / '写入成功' / 'will be written' / 'saved successfully' / '已写入' / '确认后将写入')

### 4.5 `KnowledgeFlushSourceFidelityPanel`

- renders exact source_uri preservation (verbatim from input, no rewrite, no drift)
- renders exact fetched_at preservation (verbatim from input, no rewrite, no drift)
- renders vault source_type only for vault:// URI (vault on non-vault URI is HARD FAIL)
- fail blocks confirmation (HARD FAIL propagates to reducer as blocking_issue_count > 0)

### 4.6 `KnowledgeFlushBucketSemanticsPanel`

- renders local_known / newly_found / historical_only buckets as 3 distinct visual sections
- blocks local_plan in newly_found (misplacement surfaces as soft_fail issue)
- blocks stale/archive in newly_found (do_not_use_as_current_truth=true cannot live in newly_found)

### 4.7 `KnowledgeFlushFooterActions`

- renders disabled reason (one of: awaiting_phrase / awaiting_risks_ack / blocked_by_validation)
- confirm disabled until phrase + risk ack + no blocking issue (3-gate enablement)
- reject / cancel are available in every state (no state hides them)
- copy draft json is non-mutating (renders a deep-cloned JSON, never mutates request)

## 5. Shared render contract (硬规则, 适用全部 7 组件)

未来任何 renderer 实装必守 10 条 (本 slice 校验, 留 007G+ 跑):

1. **components receive projected data only** — 7 组件接收 props, 不直接读 `LiveFlushRequest` raw 字段, 仅调 007C 投影函数。
2. **components do not call helper validation directly unless explicitly allowed** — validation 由 reducer 集中算, 组件不重做。
3. **components do not call IPC** — `window.hermesAPI.*` 全部禁止。
4. **components do not call gateway** — gateway 调用全部禁止。
5. **components do not call knowledgeIngest** — knowledgeIngest 调用全部禁止。
6. **components do not call knowledgeSearch** — knowledgeSearch 调用全部禁止。
7. **components do not mutate draft payload** — 任何 mutation 视为 bug; 深拷贝 / 不可变数据。
8. **components do not claim saved / written** — 永不出现 "已保存" / "saved" / "written" / "已写入" 等承诺词。
9. **components render runtime_flush_allowed=false** — badge / footer 必显。
10. **components render live adapter approval pending** — badge / footer 必显。

## 6. Component-specific acceptance specs (7 节)

### 6.1 KnowledgeFlushConfirmationPanel

- **职责**: 顶层 useReducer, 渲染 3 步向导
- **props**: `request: LiveFlushRequest` / `now_iso?: string` / `onClose` / `onRejected` / `onCapturedPending`
- **fixtures_covered**: 3 全部
- **assertions**:
  - state badge 显 "Pending live flush adapter approval"
  - 3 步按 CONFIRMATION_STEPS 顺序: review_request → review_evidence → review_risks
  - safety footer 显 runtime_flush_allowed=false 文案
  - reducer 状态归此组件, 父组件不持有
  - approve 仅 transition state, 不发任何网络请求
- **forbidden copy**: 不显 "已保存" / "写入成功" / "确认后将写入" / "saved successfully" / "will be written after confirm"
- **a11y**: dialog role=alertdialog / aria-modal=true / focus trap 启用

### 6.2 KnowledgeFlushDraftPreview

- **职责**: 渲染 `projectRequestToSummary(request)`
- **props**: `request: LiveFlushRequest`
- **fixtures_covered**: 3 全部
- **assertions**:
  - title / summary / primary_source_uri / primary_trust_level / counts / keywords 字段全显
  - provenance 块显 source_type / source_uri / fetched_at / trust_level / safe_to_use_as_instruction
  - stale_sources 段**永不隐藏** (即使空也显空状态文案)
  - 0 forbidden promise 短语
- **a11y**: 标题 `<h3>` / 列表 `<ul>` / source_uri 用 `<code>`

### 6.3 KnowledgeFlushGateCard

- **职责**: 单张 gate card (×5)
- **props**: `card: UIGateCard`
- **fixtures_covered**: 3 全部 (pass 5 / fail 1 / 5 pass)
- **assertions**:
  - 3 状态视觉: pass (绿) / warn (黄) / fail (红)
  - fail 时 card 触发 `aria-live=assertive` (fail-only)
  - 5 门名称显: user_confirmation / source_fidelity / bucket_semantics / roadmap_guard / secret_guard
  - 0 forbidden 短语
- **a11y**: aria-label = gate name, role=status (pass/warn) / role=alert (fail)

### 6.4 KnowledgeFlushRiskCard

- **职责**: 单张 risk card (×6)
- **props**: `card: UIRiskCard`
- **fixtures_covered**: 3 全部 (6 / 2 / 1)
- **assertions**:
  - 6 risk 全显: roadmap_mutation / stale_source_promotion / secret_leak / vault_authority_claim / external_instruction_authority / live_flush_pending_hardening
  - block severity (red) → 必触发 risks_acked
  - info severity (gray) → 永不 block (live_flush_pending_hardening 恒 info)
  - 0 forbidden 短语
- **a11y**: aria-label = category name

### 6.5 KnowledgeFlushSourceFidelityPanel

- **职责**: 渲染 `local_findings` / `web_findings` / `stale_sources` 三段
- **props**: `request: LiveFlushRequest`
- **fixtures_covered**: 3 全部
- **assertions**:
  - source_uri 逐字保留 (verbatim), 不重写, 不漂移
  - fetched_at 逐字保留 (verbatim), 不重写, 不漂移
  - vault source_type 仅对应 `vault://` URI (vault on non-vault URI = HARD FAIL)
  - HARD FAIL 必传 blocking_issue_count > 0
  - 0 forbidden 短语
- **a11y**: source_uri 用 `<code>`, fetched_at 用 `<time>`

### 6.6 KnowledgeFlushBucketSemanticsPanel

- **职责**: 渲染 5 项 bucket semantics 校验结果 (来自 Slice 006.9)
- **props**: `bucketReport: KnowledgeBucketValidationReport`
- **fixtures_covered**: 3 全部
- **assertions**:
  - 3 bucket 段显: local_known / newly_found / historical_only
  - `local_plan` 进 `newly_found` = 软失败, panel 高亮
  - `do_not_use_as_current_truth=true` 进 `newly_found` = 拒绝, panel 高亮
- **a11y**: 段标题 `<h4>`, 错误项 `role=alert`

### 6.7 KnowledgeFlushFooterActions

- **职责**: Confirm Flush / Reject / Close 按钮 + phrase 输入 + risks checkbox + safety footer
- **props**: `state: ConfirmationState` / `dispatch: (action: ConfirmationAction) => void` / `expected_phrase: string`
- **fixtures_covered**: 3 全部
- **assertions**:
  - 3 disabled_reason 显: awaiting_phrase / awaiting_risks_ack / blocked_by_validation
  - Confirm Flush enablement = phase=open && blocking=0 && acked && phrase match
  - Reject / Cancel 永远在 tab order, 任何 state 不隐藏
  - "Copy draft json" 按钮走深拷贝, 不 mutate request
  - 0 forbidden 短语
- **a11y**: phrase input aria-required / aria-invalid / aria-describedby; risks checkbox aria-required; Confirm Flush aria-disabled; Reject aria-label="Reject draft"

## 7. Forbidden copy assertions

详见 `tests/fixtures/knowledge-reuse/ui-render-acceptance/forbidden-copy-assertions.json`。

- 30 forbidden phrase (7 中文 promise + 6 英文 promise + 3 中文 implied + 5 英文 implied + 12 destination)
- scanner 函数: `scanForbiddenFlushUiCopy` (来自 007D)
- 期望行为: 干净 copy deck + 3 fixture + 未来组件 rendered text 全部 `ok=true`
- 任何命中 → CI gate 拒绝 merge

## 8. Accessibility assertions

详见 `keyboard-flow-assertions.json` + 007E § 9。

- dialog role=alertdialog / aria-modal=true / aria-labelledby
- Confirm Flush aria-disabled 反映 `!computeConfirmButtonEnabled(...)`
- gate fail card 触发 aria-live=assertive (一次性)
- gate pass/warn card role=status / aria-live=polite
- phrase input aria-required / aria-invalid / aria-describedby
- risks checkbox aria-required
- focus trap 在终态启用
- reduced motion: 无 fade / slide / pulse

## 9. Keyboard assertions

详见 `keyboard-flow-assertions.json`。

- 20 步 tab order
- 9 key event 必触发对应 reducer action
- phrase input: 实时 mismatch 标红, match 标绿
- risk ack: Space toggle state.risks_acknowledged
- confirm enablement: 三重门 (phrase + ack + 0 block)
- Escape → close (无 reject_reason)
- 终态 focus trap

## 10. Screenshot acceptance plan (留 007G+ 跑)

### 10.1 3 fixture 对应 3 截屏目标

| Fixture | Screenshot 路径 | 验证点 |
|---------|----------------|--------|
| `draft-ready-pass.json` | `.wolf/designqc-captures/knowledge-flush-draft-ready.png` | 5 pass gates (绿), Confirm Flush 灰, 3 step 1 焦点 |
| `blocked-by-source-fidelity.json` | `.wolf/designqc-captures/knowledge-flush-blocked.png` | source_fidelity 红, terminal 指向 edit+review |
| `confirmation-captured-pending-adapter.json` | `.wolf/designqc-captures/knowledge-flush-pending.png` | 终态黄 badge, label "Awaiting live flush adapter approval" |

### 10.2 采集流程 (留 007G+ 跑, 本 slice 不启)

```bash
# 1. 启 dev server (留 008 决策)
pnpm dev

# 2. 跑 Playwright fixture 模式 (留 008 决策)
pnpm test:e2e:knowledge-flush

# 3. 跑 designqc 截屏
openwolf designqc --routes /knowledge/flush-confirm
```

### 10.3 本 slice 明确不跑

- ❌ 不启 dev server
- ❌ 不跑 Playwright
- ❌ 不采集截屏
- ❌ 不调用 `openwolf designqc`

## 11. Future test enablement plan (留 007G+)

### 11.1 单元 (本 slice 已覆盖, 不重写)

- 007C reducer / 投影 (44 tests)
- 007D scanner / fixtures (~50 tests)
- 007E plan (83 tests)
- **本 slice 007F spec doc + 3 spec fixture + tests**

### 11.2 组件级 (留 007G+ 写)

- `tests/renderer/KnowledgeFlushConfirmationPanel.test.tsx` — 3 fixture mount + a11y check
- `tests/renderer/KnowledgeFlushGateCard.test.tsx` — 5 gates × 3 status snapshot
- `tests/renderer/KnowledgeFlushRiskCard.test.tsx` — 6 risks × severity snapshot
- `tests/renderer/KnowledgeFlushFooterActions.test.tsx` — 三重门 enablement
- `tests/renderer/KnowledgeFlushDraftPreview.test.tsx` — 字段渲染 + stale 不隐藏
- `tests/renderer/KnowledgeFlushSourceFidelityPanel.test.tsx` — verbatim source_uri / fetched_at
- `tests/renderer/KnowledgeFlushBucketSemanticsPanel.test.tsx` — 3 bucket 段

### 11.3 集成 (留 007G+ 写)

- fixture → 投影 → renderer mount 端到端
- IPC absence assertion: grep `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 无 `window.hermesAPI.*`

### 11.4 Forbidden copy scanner 自动化 (本 slice 已覆盖)

- `tests/knowledge-live-flush-ui-copy-deck.test.ts` § 7 / § 8 跑 scanner
- 未来组件 test 加 `expect(scanForbiddenFlushUiCopy({ text: render.textContent })).ok === true`

### 11.5 No-runtime token rg assertion (本 slice 已存在, 未来实装仍跑)

```bash
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" \
  src/renderer/src/screens/Knowledge/KnowledgeFlush* \
  src/renderer/src/components/KnowledgeFlush*
```

期望 0 命中 (排除 doc comment / 自查字面量)。

## 12. No-runtime acceptance criteria (15 项)

未来实装 PR 必须满足下列全部条件方准入主线:

1. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.knowledgeIngest(`
2. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.knowledgeSearch(`
3. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.runPlaybook(` / `sendMessage(` / `triggerCronJob(`
4. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `window.hermesAPI.gateway*(`
5. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 `fetch(` / `axios` / `XMLHttpRequest`
6. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 "已保存" / "写入成功" / "确认后将写入" / "saved successfully" / "will be written after confirm"
7. `src/renderer/src/screens/Knowledge/KnowledgeFlush*` 0 处 "Obsidian Vault path" / "MEMORY.md" / ".wolf/cerebrum" / ".wolf/anatomy"
8. `7 个未来组件全部存在, 文件名严格按 § 4 命名`
9. `npx vitest run tests/renderer/KnowledgeFlush*` 全部 PASS
10. `npx vitest run` 全 suite 无回归
11. `npm run typecheck` 双端 EXIT 0
12. `git diff --check` clean
13. `rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" src/renderer/src/screens/Knowledge/KnowledgeFlush* src/renderer/src/components/KnowledgeFlush*` 0 命中
14. `Playwright 截屏采集 3 fixture, 入 .wolf/designqc-captures/`
15. `forbidden_phrase_scan` 在所有 3 fixture 跑通, `ok=true`

任一失败 → 拒绝 merge。

## 13. Future implementation slices (留 007G+)

按依赖顺序:

### 13.1 Slice 007G — Renderer Implementation Readiness Review (推荐下一步)

- 范围: 复审 007F 验收契约 + 3 spec fixture + 7 组件 matrix, 决定实装次序
- 仍不写 .tsx
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-renderer-readiness-review-2026-06-XX.md` (待批)
  - `tests/knowledge-live-flush-renderer-readiness.test.ts` (待批)
- 预计内容: 7 组件实现顺序 / 共享 hook 设计 / 测试金字塔 / 截屏采集计划终稿

### 13.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)
- 预计 test:
  - adapter shape 校验 (待批)

### 13.3 Slice 008 — Real Live Adapter (最后, 需用户显式批)

- 范围: 真实 IPC + audit + Handoff Pack 兼容
- 需用户显式批 + 一次用户在场 flush 验收
- 不在本规划范围

## 14. 链路索引

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
- 007C UI design: `docs/knowledge/knowledge-live-flush-ui-confirmation-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-ui-contract.ts`
- 007D copy deck: `docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md` + 3 fixtures + helper 扩展
- 007E renderer plan: `docs/knowledge/knowledge-live-flush-renderer-implementation-plan-2026-06-03.md`
- **007F (本 slice)**: 本 doc + 3 spec fixture (`component-acceptance-matrix.json` / `forbidden-copy-assertions.json` / `keyboard-flow-assertions.json`) + `tests/knowledge-live-flush-renderer-fixture-acceptance.test.ts`
- 007G (待批): renderer implementation readiness review (无 impl)
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 15. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
