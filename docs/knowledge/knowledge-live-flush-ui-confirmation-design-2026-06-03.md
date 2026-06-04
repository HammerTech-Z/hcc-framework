# Hermes Pro — Knowledge Live Flush UI Confirmation Design (2026-06-03)

> Slice 007C — UI Confirmation Design / Spec Only
> 范围: spec / UI behavior contract / pure UI helper / tests; **不接 runtime**, **不写知识库**, **不调 IPC**, **不渲染真实 UI 组件**。
> 上游: 004-007B (helper / contract / dry-run integration / fidelity / bucket / design / pure contract expansion)
> 下游: 008 (real live adapter, 另批) / 真实 UI 组件实装 (另批)

## 1. 007C 是什么 / 不是什么

**是**:
- 把 Slice 007A 设计的 user confirmation gate 转化为**可渲染的 UI 行为契约**
- 5 个 gate card + 6 个 hard risk card + 3 步向导的纯投影函数
- 1 个 pure reducer (`reduceConfirmation`) 驱动对话框状态机
- 1 个 pure enablement helper (`computeConfirmButtonEnabled`)
- 1 个 failure → UI 友好视图的投影 (`projectFailureToUI`)
- renderer 未来实装时**只**调用这些纯函数, 自身**只**渲染, **不**触发任何 IPC

**不是**:
- ❌ 不是 UI 组件实装
- ❌ 不是 IPC bridge
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- ❌ 不写 Hermes Knowledge / Vault / 任何文件
- ❌ 不实现真实 live adapter
- ❌ 不做多端落地 (Claude/Codex/Hermes default system prompt 改写)

## 2. UI 信息架构 (3 步向导)

```
Step 1: Review Request      (review_request)
  - Summary card (title / summary / primary source / counts)
  - Dry-run artifact ref
  - Runtime flush state: "pending_live_flush" badge
  - User confirmation: confirmed_in_session + phrase + timestamp

Step 2: Review Evidence     (review_evidence)
  - 5 Gate cards (PASS/WARN/FAIL):
    - user_confirmation
    - source_fidelity
    - bucket_semantics
    - roadmap_guard
    - secret_guard
  - local_findings / web_findings 列表
  - stale_sources (单独高亮, 不可作主源)

Step 3: Review Risks        (review_risks)
  - 6 Hard risk cards (info / warn / block):
    - roadmap_mutation
    - stale_source_promotion
    - secret_leak
    - vault_authority_claim
    - external_instruction_authority
    - live_flush_pending_hardening
  - "I understand the risks" checkbox (必须勾选)
  - Confirmation phrase input (必须输入 "我授权 flush" 或 SUPPORTED_CONFIRMATION_PHRASES 任一)
  - Confirm Flush button (disabled until all 3 conditions met)
  - Reject button (any step, with optional reason)
  - Close button
```

## 3. Pure UI Helper API

模块: `src/shared/lib/knowledge-live-flush-ui-contract.ts` (新增, 不改 007A/007B)

### 3.1 `projectRequestToSummary(request) -> UISummaryCard`
- 5 字段: title / summary / primary_source_uri / primary_trust_level / counts / keywords
- Pure. Throws 不会 (无 invariant 输入)。
- 投影源: `request.ingest_draft` (非 `request.frontmatter`, 后者由 007B helper 构造, 未来 UI 单独渲染)。

### 3.2 `projectGates(request, validation_issues) -> UIGateCard[]`
- 固定 5 张卡, 顺序固定。
- 每卡: `gate` / `status` (pass/warn/fail) / `summary` / `issues[]`
- `source_fidelity` 软问题 → warn; `bucket_semantics` 失败 → fail; `secret_guard` secret 检出 → fail (block severity) 或 warn (soft)
- Pure.

### 3.3 `projectRisks(request, validation) -> UIRiskCard[]`
- 固定 6 张卡, 顺序固定 (1-5 硬风险, 第 6 永远是 info)。
- `stale_source_promotion`: `local_findings` 含 `do_not_use_as_current_truth` → block
- `vault_authority_claim`: source_fidelity 出现 hard_fail + vault → block
- `external_instruction_authority`: web/github finding 标 trusted_* → warn
- `live_flush_pending_hardening`: 永远 info
- Pure.

### 3.4 `reduceConfirmation(state, action) -> ConfirmationState`
- 6 个 action: `open` / `advance_to` / `go_back` / `approve` / `reject` / `close`
- `open` 必调 `validateLiveFlushRequest`, 自动算出 `blocking_issue_count`
- `approve` 3 重门: phrase match + risks acked + 0 blocking
- 任何 invariant 违例 (e.g. phase=closed 时收到 advance_to) → no-op
- Pure. 无 side effect. 无 setTimeout. 无 IPC.

### 3.5 `computeConfirmButtonEnabled({ state, expected_phrase }) -> boolean`
- 纯 enablement 谓词: phase=open + 0 blocking + risks_acked + phrase 严格匹配
- 与 `reduceConfirmation.approve` 内部判定**双源同根**: 两边都重新计算
- 未来 renderer 可单独 use 决定 button disabled / enabled

### 3.6 `projectFailureToUI(code) -> UIFailureView`
- 把 8 个 `LiveFlushFailureCode` 投影为 1 行 summary + suggested action
- 显式 exhaustive switch (never-checked) 防未来加 code 漏 case
- Pure.

## 4. State Machine

```
closed ──open(req)──> open(review_request)
                          │
                          ├──advance_to(review_evidence)──> open(review_evidence)
                          │                                       │
                          │                                       ├──advance_to(review_risks)──> open(review_risks)
                          │                                       │                               │
                          │                                       │                               ├──approve(phrase)──> approved (if enabled)
                          │                                       │                               │
                          │                                       │                               ├──reject(reason)──> rejected
                          │                                       │                               │
                          │                                       │                               └──close──> closed
                          │                                       │
                          │                                       └──go_back──> open(review_request)
                          │
                          ├──go_back──> no-op
                          │
                          ├──reject(reason)──> rejected
                          │
                          └──close──> closed
```

不变量:
- `closed` 收到任何 transition action → no-op (state 不变)
- `approved` / `rejected` 是终态; 只有 `close` 能回到 `closed`
- `confirm_button_enabled` 仅在 `phase=open` 期间为 true; 转入 `approved` / `rejected` 后必为 false
- `request` 在 `closed` 必为 null

## 5. 与 007A/007B 的关系

| 上游 | 关系 |
|------|------|
| `LiveFlushRequest` (007A) | UI 唯一输入; renderer 永远不解 draft 内容, 只用本 slice 投影函数 |
| `validateLiveFlushRequest` (007A) | `reduceConfirmation.open` 内部调用, 算 blocking 数 |
| `LiveFlushFailureCode` (007B) | `projectFailureToUI` 输入, 8 个 code 全部覆盖 |
| `buildPendingLiveFlushRequest` (007B) | 不在 UI helper 调用; 上游 caller (renderer 或 service worker) 用之造 payload, 再喂给 `reduceConfirmation.open` |
| `SUPPORTED_CONFIRMATION_PHRASES` (007A) | 复用作 phrase 校验白名单 (re-exported 路径) |
| `KnowledgeIngestDraft` (004) | 通过 `LiveFlushRequest.ingest_draft` 间接读, 不直接 import |

## 6. 渲染契约 (renderer 须守的规则)

未来 renderer 实现 ConfirmationDialog 时:

1. **只能**从 007C helper 读数据, **不得**直接读 `LiveFlushRequest` 原始字段。
   例: 不得在 JSX 里写 `request.ingest_draft.sources[0].source_uri`; 必须 `projectRequestToSummary(request).primary_source_uri`。
2. **不得**新增任何 IPC 调用; `confirm_button_enabled=true` 后点击只能 dispatch `approve` action, 状态机转 `approved`。
3. `approved` 状态**不等于**真实 flush; renderer 只显示 "Draft marked pending_live_flush. Real flush requires Slice 008 approval." 文案。
4. `rejected` 状态可选择: (a) 关 dialog, (b) 留 dialog 等用户改 draft (re-open)。
5. 任何 `phishing` 文案 (e.g. "Click here to write to Hermes Pro!") **禁止**; 标题 / 描述必须是 spec 文案 (留待 i18n 键表)。
6. `close` 动作必清空所有 input 字段 (phrase / acks / state), 防 stale state 复发。
7. i18n key 走 `t("knowledge.flushConfirm.reviewRequest.title")` 等, 不硬编码。

## 7. 渲染实装建议 (待 Slice 008 后, 另批)

未来 renderer 实装可分 3 块:

- `<KnowledgeFlushConfirmDialog />` — 顶层, 接 `state` / `dispatch`
- `<FlushGateCard card={...} />` — 5 张 gate card
- `<FlushRiskCard card={...} />` — 6 张 risk card

均不接 IPC, 不发网络请求, 不读文件系统。

## 8. 验证 (Slice 007C 自身)

- `npm run typecheck` — EXIT 0 (双端)
- `npx vitest run tests/knowledge-live-flush-ui-confirmation.test.ts` — 44/44 PASS
- `npx vitest run` — 205/205 (含 6 个 knowledge test 文件)
- `git diff --check` — clean
- `rg -n "knowledgeIngest\\(|knowledgeSearch\\(|fetch\\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" src/shared/lib/knowledge-live-flush-ui-contract.ts docs/knowledge/knowledge-live-flush-ui-confirmation-design-2026-06-03.md tests/knowledge-live-flush-ui-confirmation.test.ts`
  (期望: 仅命中 doc 第 1 节"不是"清单的字面量引用 + test self-check 字面量)

## 9. 已知非目标 (out of scope)

- 不实现真实 UI 组件 (`.tsx`)
- 不接 IPC / Electron / preload bridge
- 不接 `window.hermesAPI.knowledgeIngest(`
- 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- 不启动 HCC / hard cutover / Round 2 C
- 不触发 cron / WeChat / iLink
- 不动 locked roadmap
- 不在 Claude/Codex/Hermes default system prompt 落地契约
- 不实现真实 live adapter
- 不在 renderer 端 `approved` 之后自动调任何 IPC; 真 flush 永远在 IPC 缺席下转 `pending_live_flush` 状态

## 10. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 样例: `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` (Slice 006.5)
- 速查: `docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md` (Slice 006.6)
- 评估: `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` (Slice 006.7)
- fidelity: `validateKnowledgeSourceFidelity` (Slice 006.8)
- bucket: `BucketSemanticsResult` (Slice 006.9)
- 007A design: `docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-contract.ts`
- 007B pure helper: `docs/knowledge/knowledge-live-flush-contract-helper-2026-06-03.md` (4 纯函数)
- **007C (本 slice)**: `src/shared/lib/knowledge-live-flush-ui-contract.ts` + `tests/knowledge-live-flush-ui-confirmation.test.ts` (44 tests) + 本文档
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening (rollback / idempotency / rate limit / 多端灰度)

## 11. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

- Round 2 C
- hard cutover
- HCC Auto Executor 启动
- WeChat / iLink 实际投递
- cron 实际执行
- locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- Hermes Agent default system prompt 改写
- Claude Code `CLAUDE.md` 契约改写
- Codex `AGENTS.md` 契约改写
