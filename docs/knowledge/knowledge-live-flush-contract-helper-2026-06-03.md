# Hermes Pro — Live Flush Pure Contract Helper (2026-06-03)

> Slice 007B — Live Flush Pure Contract Helper Expansion
> 范围: pure helper / tests / doc; **不接 runtime**, **不写知识库**, **不调 IPC**。
> 上游: 004-007A (helper / contract / dry-run integration / fidelity / bucket / design)
> 下游: 007C (UI confirmation design, 仍 dry-run) / 008 (real live adapter, 另批)

## 1. 007B 是什么 / 不是什么

**是**:
- 把 Slice 007A 的设计进一步固化为可执行可测试的纯函数 contract
- 让未来真实 adapter 只负责"按已验证 payload 调 IPC", 不再临场判断
- 4 个新纯函数: `buildPendingLiveFlushRequest` / `buildHermesKnowledgeFrontmatter` / `classifyLiveFlushFailure` / `assertLiveFlushStillDryRun`

**不是**:
- ❌ 不是 live adapter 接线
- ❌ 不执行任何写入
- ❌ 不构造"已 flush" 的状态
- ❌ 不创建 `live_adapter_approved: true` / `flushed: true` 等伪造状态
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不启动 HCC Auto Executor
- ❌ 不改 locked roadmap
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`

## 2. Helper API (纯函数, 0 runtime)

模块: `src/shared/lib/knowledge-live-flush-contract.ts` (007A 增量, 不改既有 API)

### 2.1 `buildPendingLiveFlushRequest(input) -> LiveFlushRequest`

构造 `mode: "pending_live_flush"` 的 payload, 输出 14 字段 FlushRequest (沿用 Slice 007A 形状)。

输入: `BuildPendingLiveFlushRequestInput`
- `ingest_draft: KnowledgeIngestDraft` (必须 `roadmap_change_allowed: false` + `user_authorized_flush: true` + `safe_to_use_as_instruction: true`)
- `draft_id: string` (非空)
- `dry_run_artifact_ref: string` (非空)
- `user_confirmation: LiveFlushUserConfirmation` (同一次对话明确说 "我授权 flush")
- `source_fidelity_result: { ok, issues[] }` (来自 Slice 006.8)
- `bucket_semantics_result: { ok, issues?[] }` (来自 Slice 006.9)
- `roadmap_guard_result: { allowed: true, reason }` (来自 Slice 004)
- `now_iso?` (ISO 8601, 默认 now)
- `next_required_approval?` (默认字面量)

行为: 校验 4 项 invariants, 任何不满足 → throw。

输出: `LiveFlushRequest`, 含 14 必含字段; `mode: "pending_live_flush"`, `runtime_flush_allowed: false` (字面量), `runtime_adapter_required: true` (字面量), `target_store: "hermes_managed_knowledge_store"`, `next_required_approval` 非空。

### 2.2 `buildHermesKnowledgeFrontmatter(input) -> HermesKnowledgeFrontmatter`

构造未来 live adapter 写入知识库条目时的 frontmatter, 输出 16 必含字段 (沿用 Slice 007A 形状)。

输入: `BuildHermesKnowledgeFrontmatterInput`
- `ingest_draft: KnowledgeIngestDraft`
- `draft_id: string`
- `source_findings: KnowledgeFinding[]`
- `user_confirmed_at: string` (ISO 8601)
- `now_iso?` (ISO 8601, 默认 now)

行为:
- 分离 `stale_sources` (`do_not_use_as_current_truth: true`) 与 `live_sources`
- 主源 = 第一个 live finding; 若全 stale, 第一个 stale (含明确 rationale: stale 不可作 current truth)
- `source_uri` 与 `fetched_at` **逐字保留**自主源
- `vault` source_type 仅给 `vault://...` URI (不自动纠正误标, 由 Slice 006.8 validator 检测)
- `local_findings` / `web_findings` 从 `ingest_draft` pass-through
- `stale_sources` 单独保存, 不混入 `local_findings` / `web_findings`

输出: `HermesKnowledgeFrontmatter`, 16 字段; `created_by: "Hermes Pro Knowledge Reuse Adapter"` (字面量); `created_from_draft_id` 与 `user_confirmed_at` 与 FlushRequest 同步。

### 2.3 `classifyLiveFlushFailure(input) -> LiveFlushFailure`

把 live flush 失败归类为 8 个稳定 code 之一 + human-readable message。

输入: `ClassifyLiveFlushFailureInput` (含可选 `request` / `frontmatter` / `request_validation` / `frontmatter_validation` / `raw_error_message`)

8 个 code (优先级降序):
1. `runtime_flush_forbidden` — `runtime_flush_allowed !== false`
2. `runtime_adapter_not_approved` — `next_required_approval` 缺失/非字面量
3. `roadmap_mutation_blocked` — `ingest_draft.roadmap_change_allowed !== false`
4. `source_fidelity_failed` — `source_fidelity_result.ok === false`
5. `bucket_semantics_failed` — `bucket_semantics_result.ok === false`
6. `missing_user_confirmation` — `user_confirmation.confirmed_in_session !== true`
7. `secret_like_field_detected` — `request_validation.issues` 含 secret-related code
8. `stale_source_used_as_current_truth` — `ingest_draft.local_findings` 含 `do_not_use_as_current_truth: true`

### 2.4 `assertLiveFlushStillDryRun(input) -> { still_dry_run: true, reason: string }`

守卫: 拒绝任何"出 dry-run / 升级 live flush 状态"的尝试。纯函数。throw on violation。

拒绝场景:
- `runtime_flush_allowed !== false`
- `mode !== "pending_live_flush"`
- `target_store !== HERMES_MANAGED_KNOWLEDGE_STORE`
- `next_required_approval` 缺失
- `claiming_live_flush_approved: true` (caller 显式声称)
- 伪造字段 `live_adapter_approved: true` / `flushed: true`

## 3. 跨函数不变量 (must)

- 任何 `LiveFlushRequest` 由 `buildPendingLiveFlushRequest` 构造, 必满足 14 字段 + 4 字面量 (mode / runtime_flush_allowed / runtime_adapter_required / target_store / next_required_approval)
- 任何 `HermesKnowledgeFrontmatter` 由 `buildHermesKnowledgeFrontmatter` 构造, 必满足 16 字段 + 4 字面量 (source_type / source_uri / fetched_at / indexed_at / trust_level / safe_to_use_as_instruction / created_by)
- 任何 `stale_sources` 必单独保存, 永不混入 `local_findings` / `web_findings`
- 任何 `vault` source_type 必对应 `vault://...` URI (本 slice 不自动纠正, 由 Slice 006.8 validator 检测)
- 任何 `runtime_flush_allowed === true` 一律拒绝 (007A 末 invariants 跨 007B 仍守)

## 4. 与上游底座的关系

| 上游 | 关系 |
|------|------|
| `src/shared/lib/knowledge-live-flush-contract.ts` (007A) | 本 slice 增量, 既有 5 常量 + 4 类型 + 2 纯函数 (`validateLiveFlushRequest` / `validateHermesKnowledgeFrontmatter`) 不动 |
| `src/shared/lib/knowledge-reuse-protocol.ts` (004) | 复用 `KnowledgeIngestDraft` / `KnowledgeFinding` / `KnowledgeSourceType` / `TrustLevel` |
| `src/shared/lib/knowledge-reuse-integration.ts` (006) | 复用 `validateKnowledgeSourceFidelity` (006.8) 与 bucket semantics (006.9) 结果; 不重写 |
| `docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md` (007A) | 严格遵守 12 preconditions + 4 gates + Failure modes; 007B 把 007A 设计固化为可执行 pure helper |
| `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` (006.5) | `buildHermesKnowledgeFrontmatter` 测试复用其 `local_known` 字段, 验证 `source_uri` 逐字保留 |
| `docs/roadmap-locked-2026-05-28.md` | 本 slice 不触碰; `assertKnowledgeDoesNotModifyRoadmap` (Slice 004) 在 preconditions 中复用 |

## 5. 验证

- `npm run typecheck` (node + web)
- `npx vitest run tests/knowledge-live-flush-adapter-design.test.ts tests/knowledge-live-flush-contract.test.ts`
- `npx vitest run`
- `git diff --check`
- `rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" src/shared/lib/knowledge-live-flush-contract.ts docs/knowledge/knowledge-live-flush-contract-helper-2026-06-03.md tests/knowledge-live-flush-contract.test.ts`

## 6. 已知非目标 (out of scope, 已记录)

- 不实现真实 `knowledgeIngest` runtime 调用 (留给 Slice 008)。
- 不接 IPC, 不写 `~/.hermes/handoff/packs` / `~/.hermes/audit`。
- 不启动 HCC / hard cutover / Round 2 C。
- 不在 Claude / Codex / Hermes default system prompt 真正落地契约 (留待 Slice 006 末尾提案; 实际落地仍需新批)。
- 不实现 UI 渲染 (留给 Slice 007C)。
- `classifyLiveFlushFailure` 优先级硬编码; 未来若需可配置优先级, 需独立 slice。

## 7. 后续建议 (Slice 007C 提案)

按 task spec:

- **Slice 007C**: UI confirmation design (Hermes Pro renderer 加 "Confirm Flush" 按钮 + 渲染 FlushRequest draft + confirmation dialog), 仍 dry-run, 不接 IPC。
- **Slice 008** (待批, 必经一次用户在场 flush 验收): real live adapter, 接 IPC + 调 `knowledgeIngest` runtime + audit log + Handoff Pack 兼容。

继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批):

- Round 2 C
- hard cutover
- HCC Auto Executor 启动
- WeChat / iLink 实际投递
- cron 实际执行
- locked roadmap (`docs/roadmap-locked-2026-05-28.md`)

## 8. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 样例: `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` (Slice 006.5)
- 速查: `docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md` (Slice 006.6)
- 评估: `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` (Slice 006.7)
- fidelity: `validateKnowledgeSourceFidelity` (Slice 006.8)
- bucket: `BucketSemanticsResult` (Slice 006.9)
- 007A (design): `docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-contract.ts` (validateLiveFlushRequest / validateHermesKnowledgeFrontmatter)
- **007B (本 slice)**: 4 新纯函数 (`buildPendingLiveFlushRequest` / `buildHermesKnowledgeFrontmatter` / `classifyLiveFlushFailure` / `assertLiveFlushStillDryRun`) + 本文档
- 007C (next): UI confirmation design
- 008 (待批): real live adapter
- 009 (待批): post-implementation hardening
