# Hermes Pro — Knowledge Live Flush Renderer Readiness Review (2026-06-03)

> Slice 007G — Renderer Implementation Readiness Review / No Implementation
> 范围: review / spec / tests / review fixture JSON; 不实现 React 组件, 不写 .tsx, 不接 IPC, 不改 preload, 不启 dev server, 不跑 Playwright。
> 上游: 004-007F (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck / 007E renderer plan / 007F fixture acceptance)
> 下游: 007H (renderer implementation slice plan, 仍 no code) / 008A (real adapter design, 仍 no runtime) / 真实 renderer 实装 (另批, 需用户显式批)

## 1. Purpose

为未来 renderer 实装做一次 readiness review。

- 复审 007C / 007D / 007E / 007F 的一致性
- 确认未来 renderer 实装顺序: leaf → composed panel → top-level container
- 输出 PR gate / Test gate / Forbidden copy gate / a11y gate / Keyboard gate / Screenshot gate / Runtime safety gate
- 列出 blockers
- 输出 go / no-go 决策

**输出**: 复审报告 + review fixture JSON (`readiness-review.json`)。
**决策**: **GO for renderer implementation planning only** — 仍不是 GO for runtime / IPC / live adapter / real write。

## 2. Non-goals (本 slice 明确不做)

- ❌ 不实现任何 React 组件 / `.tsx` 文件
- ❌ 不新增任何 `.tsx` 文件
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
- ❌ 不发明新写路径
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ 不做 i18n 翻译 (本 slice 仅列 key namespace)
- ❌ 不实装 a11y (仅复审 + 验收契约)
- ❌ 不实装键盘流 (仅复审 + 验收契约)
- ❌ 不实装截屏采集 (留 007H+ 跑)
- ❌ 不写 React 组件 / 不做 PR

## 3. Scope reviewed

本 slice 复审 4 个上游 slice:

| Slice | 标题 | 文档 | helper / fixture | readiness |
|-------|------|------|------------------|-----------|
| 007C | UI confirmation design/helper | `docs/knowledge/knowledge-live-flush-ui-confirmation-design-2026-06-03.md` | `src/shared/lib/knowledge-live-flush-ui-contract.ts` | **ready** |
| 007D | UI copy deck + golden UI fixtures | `docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md` | 3 fixtures + `buildKnowledgeFlushCopyDeck` / `scanForbiddenFlushUiCopy` | **ready** |
| 007E | renderer implementation plan/spec | `docs/knowledge/knowledge-live-flush-renderer-implementation-plan-2026-06-03.md` | 7 未来组件 + 数据流 + i18n + a11y + keyboard | **ready** |
| 007F | renderer fixture acceptance spec | `docs/knowledge/knowledge-live-flush-renderer-fixture-acceptance-spec-2026-06-03.md` | 3 spec fixture (matrix / forbidden / keyboard) | **ready** |

复审未覆盖: 007A / 007B (上游契约已就绪, 复审重点在 UI 层), 008 (未批准, 不复审)。

## 4. Cross-document consistency review

7 项一致性检查, 全部 **PASS**:

| 检查项 | 来源 (007C) | 来源 (007D) | 来源 (007E) | 来源 (007F) | 一致? |
|--------|-------------|-------------|-------------|-------------|------|
| **UI states** | 4 phase: closed / open / approved / rejected | 7 state copy: closed / open×3 / approved / rejected / blocked_by_validation | 3 step wizard | 3 fixture state | ✓ |
| **user actions** | 6 action: open / advance_to / go_back / approve / reject / close | (沿用 007C) | 沿用 007C | (沿用) | ✓ |
| **5 gates** | user_confirmation / source_fidelity / bucket_semantics / roadmap_guard / secret_guard | 5 gate card copy (pass/warn/fail × 5) | 5/5 component acceptance bullets | 5/5 in matrix | ✓ |
| **6 risks** | roadmap_mutation / stale_source_promotion / secret_leak / vault_authority_claim / external_instruction_authority / live_flush_pending_hardening | 6 risk card copy | 6/6 component acceptance bullets | 6/6 in matrix | ✓ |
| **7 components** | (helper 不分组件) | (copy deck 不分组件) | 7: ConfirmationPanel / DraftPreview / GateCard / RiskCard / SourceFidelityPanel / BucketSemanticsPanel / FooterActions | 7 in matrix | ✓ |
| **no-runtime wording** | "renderer 仅消费 LiveFlushRequest props" / "approve 仅 transition state" | safety footer 必含 `runtime_flush_allowed = false` | "renderer 0 IPC 调用" / "approve action 只改 UI state" | shared render contract 10 条 | ✓ |
| **no-overpromise wording** | reducer 不构造 flushed state | forbidden promise phrases 18 + destination 12 | "approved ≠ 已写入" / runtime_flush_allowed=false | forbidden copy 30 phrases | ✓ |

**复审结论**: 4 个上游文档在 UI states / user actions / 5 gates / 6 risks / 7 components / no-runtime wording / no-overpromise wording 7 项上一致。helper (`knowledge-live-flush-ui-contract.ts`) 与 3 fixture 与 3 spec fixture 形状兼容。

## 5. Helper readiness review

`src/shared/lib/knowledge-live-flush-ui-contract.ts` (007C + 007D 扩展) readiness:

| API | 类型 | 状态 | 未来实装用? |
|-----|------|------|------------|
| `projectRequestToSummary` | pure function | ✓ ready | 是, DraftPreview 消费 |
| `projectGates` | pure function | ✓ ready | 是, GateCard 消费 |
| `projectRisks` | pure function | ✓ ready | 是, RiskCard 消费 |
| `computeConfirmButtonEnabled` | pure function | ✓ ready | 是, FooterActions 消费 |
| `reduceConfirmation` | pure reducer | ✓ ready | 是, ConfirmationPanel 消费 |
| `buildKnowledgeFlushCopyDeck` | pure function | ✓ ready | 是, i18n 资源填充时消费 |
| `scanForbiddenFlushUiCopy` | pure scanner | ✓ ready | 是, CI gate 消费 |
| `flattenCopyDeckForScan` | pure helper | ✓ ready | 是, 组件 test 消费 |
| `classifyLiveFlushFailure` | pure function | ✓ ready | 是, 终态失败 body 消费 |
| `buildPendingLiveFlushRequest` | pure builder | ✓ ready | 是, 上游 caller 消费 (留 008) |
| `buildHermesKnowledgeFrontmatter` | pure builder | ✓ ready | 是, 留 008 实装消费 |
| `assertLiveFlushStillDryRun` | pure guard | ✓ ready | 是, 防御性 guard |

**结论**: 12 个 pure API 全部 ready, 无 blocking 缺口。测试覆盖: 44 (007C) + ~50 (007D) = 94 tests。

## 6. Fixture readiness review

3 existing fixture + 3 spec fixture readiness:

| Fixture | 类型 | 必含字段 | 状态 |
|---------|------|---------|------|
| `draft-ready-pass.json` | golden UI render | 12 必含 key | ✓ ready |
| `blocked-by-source-fidelity.json` | golden UI render | 12 必含 key | ✓ ready |
| `confirmation-captured-pending-adapter.json` | golden UI render | 12 必含 key | ✓ ready |
| `component-acceptance-matrix.json` | spec | 7 组件 × 4-5 bullets | ✓ ready |
| `forbidden-copy-assertions.json` | spec | 30 forbidden + scanner 契约 | ✓ ready |
| `keyboard-flow-assertions.json` | spec | 20 tab + 9 key + phrase/risk/enable | ✓ ready |

**结论**: 6 fixture 全部 ready, 3+3 双层结构对齐。

## 7. Component implementation order (推荐)

按依赖深度排序: **leaf → composed panel → top-level container**。

### 7.1 推荐顺序

1. **`KnowledgeFlushGateCard`** (leaf, 纯展示)
2. **`KnowledgeFlushRiskCard`** (leaf, 纯展示)
3. **`KnowledgeFlushDraftPreview`** (composed, 调 `projectRequestToSummary`)
4. **`KnowledgeFlushSourceFidelityPanel`** (composed, 渲染 3 list)
5. **`KnowledgeFlushBucketSemanticsPanel`** (composed, 渲染 3 bucket)
6. **`KnowledgeFlushFooterActions`** (interactive, 调 `computeConfirmButtonEnabled` + `dispatch`)
7. **`KnowledgeFlushConfirmationPanel`** (top-level container, `useReducer`)

### 7.2 顺序理由

- **先 leaf components**: 1-2 是纯展示, 无 props 依赖, 无 state, 无 dispatch。最容易单测, 错误定位最快。
- **后 composed panels**: 3-5 仅调一个投影函数, 单一职责, snapshot test 容易。
- **再 interactive footer**: 6 引入 dispatch + enablement, 是第一个引入 reducer action 的组件, 错误定位需前 5 个组件稳定。
- **最后 top-level reducer container**: 7 组合前 6 个, 持有 `useReducer`, 是最复杂的。如前 6 个未稳定, 第 7 个组件 bug 无法定位。
- **7 个组件用同一 spec fixture (matrix)** — 7×4-5 acceptance bullets + 3 fixture mount, 测试金字塔统一。

### 7.3 反顺序 (拒)

- ❌ 先 ConfirmationPanel 再 leaf — 缺底层, 错误定位难
- ❌ 先 FooterActions 再 leaf — 缺视觉基础, a11y 验收延迟
- ❌ 平行实装 7 组件 — PR 大爆炸, review 成本高, blockers 暴露晚

## 8. PR gate (8 项)

未来 renderer PR 必跑:

1. **no IPC / preload diff unless explicitly approved** — 任何 `src/preload/**` 改动必带 ADR + 用户显式批
2. **no knowledgeIngest / gateway / runtime calls** — `window.hermesAPI.*` 全部禁
3. **no forbidden promise copy** — 18 短语 + 30 phrase 含 destination
4. **no forbidden destination copy** — Obsidian Vault / MEMORY.md / .wolf 路径
5. **fixtures render clean** — 3 ui-confirmation fixture 的 `forbidden_phrase_scan.ok === true`
6. **typecheck pass** — `npm run typecheck` 双端 EXIT 0
7. **vitest pass** — `npx vitest run` 全 suite 1611/1611 PASS
8. **git diff --check clean** — 无 whitespace error
9. **screenshot plan deferred** — 截屏采集留 007H+ 实装, 本 slice 不启 dev server / 不跑 Playwright

任一失败 → 拒绝 merge。

## 9. Test gate (5 项)

未来实装时必跑:

1. **existing pure helper tests** — 007C 44 tests (reducer / 投影) + 007B 60+ tests (contract)
2. **copy deck tests** — 007D ~50 tests (scanner / 3 fixture / forbidden phrase)
3. **renderer fixture acceptance tests** — 007F 94 tests (matrix / forbidden / keyboard)
4. **future component tests** — 007H+ 写 `tests/renderer/KnowledgeFlush*.test.tsx` (本 slice 不写)
5. **future Playwright screenshots** — 仅在 007H+ dev server 启动后跑 (本 slice 不跑)

## 10. Forbidden copy gate (3 项)

1. **`scanForbiddenFlushUiCopy(flattenCopyDeckForScan(buildKnowledgeFlushCopyDeck()))` → `ok=true`**
2. **3 ui-confirmation fixture 的 `forbidden_phrase_scan.ok === true`**
3. **未来组件 rendered text passes scanner in component test** — `expect(scanForbiddenFlushUiCopy({ text: container.textContent ?? '' }).ok).toBe(true)`

任一失败 → 拒绝 merge。

## 11. Accessibility gate (8 项)

1. dialog role=alertdialog / aria-modal=true / aria-labelledby
2. Confirm Flush aria-disabled 反映 enablement
3. gate fail card 触发 aria-live=assertive (one-shot)
4. gate pass/warn card role=status / aria-live=polite
5. phrase input aria-required / aria-invalid / aria-describedby
6. risks checkbox aria-required
7. focus trap 在终态
8. reduced motion: 无 fade / slide / pulse

## 12. Keyboard gate (7 项)

1. 20 步 tab order
2. 9 key event 必触发对应 reducer action
3. phrase input: 实时 mismatch/match 视觉
4. risk ack: Space toggle state.risks_acknowledged
5. Confirm Flush enablement: 三重门 (phrase + ack + 0 block)
6. Escape → close (无 reject_reason)
7. 终态 focus trap

## 13. Screenshot gate (5 项)

1. screenshot capture only after future renderer implementation (007H+ slice)
2. current slice does not start dev server
3. current slice does not run Playwright
4. current slice does not capture screenshots
5. 3 target paths: `.wolf/designqc-captures/knowledge-flush-{draft-ready,blocked,pending}.png`

## 14. Runtime safety gate (6 项)

1. **no IPC calls**: `window.hermesAPI.knowledgeIngest` / `knowledgeSearch` / `runPlaybook` / `sendMessage` / `triggerCronJob` / `gateway*` 全部禁
2. **no fetch / axios / XMLHttpRequest** in renderer
3. **no overpromise copy**: "已保存" / "写入成功" / "确认后将写入" / "saved successfully" / "will be written after confirm" 全部禁
4. **no destination copy**: "Obsidian Vault path" / "MEMORY.md" / ".wolf/cerebrum" / ".wolf/anatomy" 全部禁
5. **approve action only transitions state**; 永不发任何 IPC / 网络请求 / 文件写
6. **approved phase != '已写入'**; UI 文案必含 "Pending live flush adapter approval"

## 15. Blockers (4 项)

| ID | 标题 | 影响 | 缓解 |
|----|------|------|------|
| **B1** | renderer implementation slice (007H+) 未批准 | 无法写任何 React / .tsx | 本 slice (007G) 是 GO for planning only; 未来 007H 必须先经用户显式批 |
| **B2** | Slice 008 (real live adapter) 未批准 | 无法接真实 knowledgeIngest IPC; renderer 仅能 transition 到 'approved' state | 008 是独立下游批, 不在 renderer 实施范围 |
| **B3** | Playwright + dev server 未启 | 无法采集真实截屏; `.wolf/designqc-captures/` 仍空 | 留 007H+ dev server 批后跑; 本 slice 明确不启 |
| **B4** | i18n 资源文件未新增 | 无法跑真实 i18n key lookup; 组件 test 必用 raw `t()` fallback 或 mock | 留 007H+; 本 slice 仅列 key namespace |

## 16. Go / No-go decision

### 16.1 决策

**GO for renderer implementation planning only**

### 16.2 显式 NOT-GO

- ❌ **不是** GO for runtime — 0 knowledgeIngest / knowledgeSearch / gateway / serve / run / agent / delegate / playbook 调用
- ❌ **不是** GO for IPC — 0 `window.hermesAPI.*` 调用
- ❌ **不是** GO for live adapter — Slice 008 仍未批准
- ❌ **不是** GO for real write — 0 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ **不是** GO for dev server 启动
- ❌ **不是** GO for Playwright 跑
- ❌ **不是** GO for 截屏采集
- ❌ **不是** GO for React 组件实装

### 16.3 后续实装前置

未来 007H (renderer implementation slice plan) 必先经用户显式批, 方可写任何 React / .tsx / IPC 接线。

## 17. Future implementation slices

按依赖顺序:

### 17.1 Slice 007H — Renderer Implementation Slice Plan (推荐下一步)

- 范围: 基于本 slice 复审, 输出 7 组件实装分 PR 计划 + 共享 hook 设计 + 测试金字塔
- 仍不写 .tsx
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-renderer-implementation-slice-plan-2026-06-XX.md` (待批)
  - `tests/knowledge-live-flush-renderer-implementation-slice-plan.test.ts` (待批)
- 预计内容: 7 PR 拆分 / 共享 hook / 7 组件 × 3 fixture mount / 截屏采集计划终稿

### 17.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)
- 预计 test:
  - adapter shape 校验 (待批)

### 17.3 Slice 008 — Real Live Adapter (最后, 需用户显式批)

- 范围: 真实 IPC + audit + Handoff Pack 兼容
- 需用户显式批 + 一次用户在场 flush 验收
- 不在本规划范围

## 18. 链路索引

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
- 007D copy deck: `docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md` + 3 fixtures
- 007E renderer plan: `docs/knowledge/knowledge-live-flush-renderer-implementation-plan-2026-06-03.md`
- 007F fixture acceptance: `docs/knowledge/knowledge-live-flush-renderer-fixture-acceptance-spec-2026-06-03.md` + 3 spec fixture
- **007G (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/ui-render-acceptance/readiness-review.json`
- 007H (待批): renderer implementation slice plan (无 code)
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 19. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
