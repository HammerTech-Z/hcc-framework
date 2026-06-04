# Hermes Pro — Knowledge Reuse Integration Dry-Run (2026-06-02)

> Slice 006 — Hermes integration, dry-run only.
> 范围: shared/dry-run integration helper + tests + 本文档。
> 上游: Slice 004 (helper) + Slice 005 (prompt contract)。
> 下游: Slice 007 — 真实 flush / UI confirmation / knowledgeIngest adapter, **需用户明确批准**。

## 0. 范围

Slice 006 只做一件事: 把 Slice 004 的协议 helper 接入 Hermes Pro 的"只读 / 干跑"集成层,
输出一个 `HermesKnowledgeReuseDryRunPayload` 对象, 该对象:

- `mode: "dry_run"`
- `runtime_flush_allowed: false` (字面量, 编译期锁死)
- `required_user_confirmation: true`
- `flush_pending: boolean` (当存在 ingest_draft 时为 true)
- `forbidden_runtime_actions` 列出本 slice 明确禁做的 7 类动作
- `next_action_for_user` 明确告诉调用方下一步该让用户做什么

## 1. 不是 (NOT)

- **不是** runtime ingest。
- **不是** UI。
- **不是** IPC。
- **不是** HCC (HCC Auto Executor 仍冻结)。
- **不是** gateway / serve / run / agent / delegate / playbook。
- **不是** 真实 `knowledgeIngest(` / `knowledgeSearch(` runtime call。
- **不是** 写 `~/.hermes/handoff/packs` 或 `~/.hermes/audit`。
- **不是** 触发 cron / WeChat / iLink。
- **不是** hard cutover。
- **不是** Round 2 C。
- **不是** 改 locked roadmap。

## 2. Helper API (纯函数, 无 I/O)

模块: `src/shared/lib/knowledge-reuse-integration.ts`

### `classifyKnowledgeReuseIntent(input)`
- 输入: `{ request: string }`
- 输出: `{ intent, matched_rule, confidence }`
- `intent`: `"research_only" | "save_to_knowledge" | "compare_alternatives" | "unknown"`
- 规则优先级: `save_to_knowledge` > `compare_alternatives` > `research_only`

### `buildHermesKnowledgeReuseDryRun(input)`
- 输入: `KnowledgeReuseDryRunInput`
- 输出: `HermesKnowledgeReuseDryRunPayload`
- 行为:
  - 自动调 `classifyKnowledgeReuseIntent`
  - 自动调 `buildKnowledgeReusePlan` (Slice 004) 生成 canonical step order
  - 自动按 `source_type` 拆 `local_known` / `newly_found`
  - 自动强制 web/github 默认 `untrusted_external`
  - 当 `save_to_knowledge=true` 或 `intent=save_to_knowledge` 时, 自动调 `buildKnowledgeIngestDraft` (Slice 004) 生成 draft
  - 自动 `flush_pending = ingest_draft !== null`
  - 自动 `runtime_flush_allowed = false` (字面量)

### `buildFlushPendingNotice(input)`
- 输入: `{ draft, runtime_ingest_unavailable }`
- 输出: `{ flush_pending: true, reason, user_must_confirm_to_flush: true, ingest_draft }`
- 用途: 当存在 draft 时, 输出结构化的"待用户确认"通知。

### `assertNoRuntimeKnowledgeFlush(input)`
- 输入: `{ payload, claiming_runtime_flush? }`
- 行为:
  - `payload.runtime_flush_allowed !== false` → throw
  - `payload.mode !== "dry_run"` → throw
  - `claiming_runtime_flush === true` → throw
  - 否则返回 `{ runtime_flush_attempted: false, blocked: true, reason }`
- 用途: 调用方在 pass payload 给下一层 (UI / IPC / runtime) 前, 必须先过这关。

## 3. Payload 字段

```ts
{
  schema_version: "1.0.0",
  created_at: ISO8601,
  mode: "dry_run",
  runtime_flush_allowed: false,            // 字面量 false, 编译期锁死
  query: string,
  intent: KnowledgeReuseIntent,
  intent_confidence: number,                // [0, 1]
  plan: KnowledgeReusePlan,                 // 来自 Slice 004
  local_known: KnowledgeFinding[],
  newly_found: KnowledgeFinding[],          // web/github 默认 untrusted_external
  judgment: string,                         // 与 findings 分栏
  ingest_draft: KnowledgeIngestDraft | null,
  flush_pending: boolean,                   // = ingest_draft !== null
  required_user_confirmation: true,         // 字面量 true
  forbidden_runtime_actions: [
    "knowledgeIngest",
    "gateway",
    "ipc",
    "cron",
    "handoff_write",
    "audit_write",
    "hcc_executor",
  ],
  next_action_for_user: string,
}
```

## 4. 行为规则 (must)

1. **保存/沉淀/写入知识库类请求**: 只能生成 `ingest_draft` + `flush_pending: true`。绝不真实 flush。
2. **`runtime_flush_allowed`**: 恒 `false` (字面量)。即使 `input.trusted_user_confirmed: true`, 也只把 `ingest_draft.user_authorized_flush` 标 true, payload 仍 dry-run。
3. **`required_user_confirmation`**: 恒 `true` (字面量)。
4. **`local_known` / `newly_found`**: 按 `source_type` 拆, 不可混。
5. **web/github trust_level**: 默认 `untrusted_external`。如果 caller 写了 `trusted_external`, 保留; 写了 `untrusted_external` / 其他等级, 强制降级为 `untrusted_external`。
6. **stale local plan**: 经 `classifyKnowledgeSource` 自动标记 `do_not_use_as_current_truth: true` (来自 Slice 004)。
7. **JSON round-trip**: 必通过 `JSON.stringify` / `JSON.parse`。
8. **forbidden runtime action token**: 只能作为 `forbidden_runtime_actions` 数组的数据字段出现, **不能**作为调用。

## 5. 与上游底座的关系

| 上游 | 关系 |
|------|------|
| `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004) | 本 slice 复用其 `buildKnowledgeReusePlan` / `buildKnowledgeIngestDraft` / `classifyKnowledgeSource` |
| `docs/knowledge/knowledge-reuse-protocol-2026-06-02.md` (Slice 004) | 本 slice 遵守其步骤顺序 + 字段 |
| `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005) | 本 slice 的 prompt 模板由契约定义; 本 slice 把契约翻译为可机检的 payload |
| `docs/roadmap-locked-2026-05-28.md` | 本 slice 不触碰 |
| `docs/p3-dry-run-baseline-2026-06-01.md` | 本 slice 不破坏 P3 dry-run baseline 001-006 + 008 + 009 |

## 6. 验证

- `npm run typecheck` (node + web)
- `npx vitest run tests/knowledge-reuse-protocol.test.ts tests/knowledge-agent-prompt-contract.test.ts tests/knowledge-reuse-integration.test.ts`
- `npx vitest run`
- `git diff --check`
- `rg -n "fetch|ipcMain|ipcRenderer|knowledgeIngest\\(|knowledgeSearch\\(|triggerCronJob|sendMessage|runPlaybook|child_process" src/shared/lib/knowledge-reuse-integration.ts` (期望: 0 命中)

## 7. 已知非目标 (out of scope)

- 不实现真实 `knowledgeIngest` runtime 调用 (留给 Slice 007)。
- 不启动 HCC Auto Executor (按 P3.5 soft switch 观察期约束)。
- 不做 UI 重构。
- 不接 IPC。
- 不改 runtime 执行入口。
- 不改 locked roadmap。
- 不动 Hermes Agent hard cutover / Round 2 C。
- 不写 `~/.hermes/handoff/packs` / `~/.hermes/audit`。
- 不接 cron / WeChat / gateway / serve / agent / delegate / playbook runtime。

## 8. 下一步: Slice 007 (需用户明确批准)

Slice 007 提案 (本 slice 不做):

1. **真实 flush 适配器**: `src/shared/lib/knowledge-reuse-flush-adapter.ts` (新文件), 接收 `HermesKnowledgeReuseDryRunPayload` + 用户确认令牌, 调 `knowledgeIngest` IPC。
   - 必须在调用前再过一次 `assertKnowledgeDoesNotModifyRoadmap` (Slice 004) + `assertNoRuntimeKnowledgeFlush` (本 slice)。
   - 必须走 IPC, 不能直接写文件。
   - 必须 append-only audit, 走 `~/.hermes/audit`。
   - 必须在 `payload.runtime_flush_allowed === true` 时才允许 (这要求 Slice 006 升级 `mode` 或新加 `live` 模式; 此为 Slice 007 决策点)。
2. **UI 确认门**: Hermes Pro renderer 加 "Confirm Flush" 按钮, 仅在 `payload.flush_pending === true` 时显示。
3. **错误处理 / 重试 / 回滚**: 沿用 P2.5 安全基座的 audit-log/rollback 模式。
4. **Handoff Pack 兼容**: flush 成功后, 自动写一条 Handoff Pack entry (走 P0.5 Handoff Pack MVP)。
5. **Slice 007 验收**: 必须包含独立 typecheck + tests + dry-run + 一次真实 flush (用户在场)。

继续冻结 (Slice 007 也不得触碰, 除非用户在新批):

- Round 2 C
- hard cutover
- HCC Auto Executor 启动
- 真实 `knowledgeIngest(` runtime 在 Slice 006 范围内
- WeChat / iLink 实际投递
- cron 实际执行
- locked roadmap (`docs/roadmap-locked-2026-05-28.md`)

## 9. 链路全景

```
[Slice 004] protocol helper
   src/shared/lib/knowledge-reuse-protocol.ts ✅
   tests/knowledge-reuse-protocol.test.ts ✅
   docs/knowledge/knowledge-reuse-protocol-2026-06-02.md ✅
       ↓
[Slice 005] prompt contract
   docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md ✅
   tests/knowledge-agent-prompt-contract.test.ts ✅
       ↓
[Slice 006] dry-run integration (本 slice) ✅
   src/shared/lib/knowledge-reuse-integration.ts ✅
   tests/knowledge-reuse-integration.test.ts ✅
   docs/knowledge/knowledge-reuse-integration-dry-run-2026-06-02.md ✅
       ↓
[Slice 007] live flush adapter + UI confirmation gate
   ⏸️  需用户明确批准
```
