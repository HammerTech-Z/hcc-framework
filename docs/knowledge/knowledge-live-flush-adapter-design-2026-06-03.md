# Hermes Pro — Live Flush Adapter Design (2026-06-03)

> Slice 007A — Live Flush Adapter Design / Spec Only
> 范围: spec / contract / tests, **不接 runtime**, **不写知识库**, **不调 IPC**。
> 上游: 004 helper / 005 contract / 006 dry-run integration / 006.5-006.9 hardening
> 三端 dry-run 评估: Claude / Codex / Hermes 均 clean PASS (2026-06-03)
> 下游: Slice 007B (pure contract helper) / 007C (UI confirmation design) / 真实 adapter 另批

## 1. Purpose

定义 **live flush adapter** 的契约: 当用户在同一对话明确说 "我授权 flush" 后, 未来如何
把 `KnowledgeIngestDraft` 转成对 Hermes Pro 知识库的**真实写入请求**。

本 slice 只产出**设计规范**; 任何真实 `knowledgeIngest` IPC 调用仍冻结, 需独立批。

## 2. Non-goals (本 slice 明确不做)

- ❌ 不实现真实 `knowledgeIngest` runtime 调用。
- ❌ 不接 IPC / Electron / preload bridge。
- ❌ 不启动 HCC Auto Executor / gateway / serve / run / agent / delegate / playbook。
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`。
- ❌ 不触发 cron / WeChat / iLink。
- ❌ 不改 locked roadmap (`docs/roadmap-locked-2026-05-28.md`)。
- ❌ 不做 UI 渲染 (留给 Slice 007C)。
- ❌ 不实现真实 adapter 接线 (留给未来独立批)。
- ❌ 不进 Round 2 C, 不做 hard cutover。
- ❌ 不发明新写路径: 不写 Obsidian Vault 路径, 不写 `MEMORY.md`, 不写 `.wolf/cerebrum.md`, 不发明 `notes/<topic>.md` 等任意自定义笔记路径 (沿用 Slice 005/006.6 契约)。

## 3. Preconditions (进入 live flush 路径前必满足)

进入 live flush 路径**全部**满足:

1. `HermesKnowledgeReuseDryRunPayload.mode === "dry_run"` (Slice 006)
2. `runtime_flush_allowed === false` (本 slice 仍 false, 升级路径见 § 11)
3. `required_user_confirmation === true`
4. `ingest_draft !== null`
5. 用户在**同一次对话**明确说 "我授权 flush"
6. `ingest_draft.user_authorized_flush === true`
7. `ingest_draft.roadmap_change_allowed === false` (恒 false, 类型字面量)
8. `ingest_draft.safe_to_use_as_instruction === true` (仅 trusted_user 确认后)
9. `validateKnowledgeSourceFidelity` 通过 (Slice 006.8)
10. 5 项 bucket semantics 校验通过 (Slice 006.9)
11. `assertKnowledgeDoesNotModifyRoadmap` 通过 (Slice 004)
12. Draft 内 0 secret-like 字段 (Slice 004 secret guard)

## 4. User confirmation gate

- 用户确认 ≠ 立即写入。
- 用户确认仅让 draft **eligible for approved flush path**。
- 真实 flush 仍需:
  1. `user_authorized_flush=true` (本契约层)
  2. Live adapter 单独批准 (本 slice 之外)
  3. 一次用户在场 flush 验收
- "我授权 flush" 必须出现在**同一次对话**, 不得从历史消息推断。

## 5. Draft validation gate

Future live adapter 收到 `FlushRequest` 后, 必须再过一次:

| # | 校验项 | 失败时 |
|---|--------|--------|
| 1 | `ingest_draft.title` 非空, ≤ 30 字 | 拒绝 flush |
| 2 | `ingest_draft.summary` 非空, 1-3 句 | 拒绝 flush |
| 3 | `ingest_draft.sources[]` 至少 1 项 | 拒绝 flush |
| 4 | `ingest_draft.provenance` 完整 (source_type / source_uri / fetched_at / trust_level) | 拒绝 flush |
| 5 | `ingest_draft.trust_level` ∈ {trusted_verified, trusted_external, semi_trusted_local, untrusted_external, unknown} | 拒绝 flush |
| 6 | `ingest_draft.retrieval_keywords[]` 至少 1 项, lowercase, 去重 | 拒绝 flush |
| 7 | `ingest_draft.roadmap_change_allowed === false` | **直接拒绝, 不可绕过** (类型字面量锁死) |
| 8 | `ingest_draft.safe_to_use_as_instruction === true` | 拒绝 flush (未确认) |
| 9 | `ingest_draft.user_authorized_flush === true` | 拒绝 flush (未授权) |
| 10 | 0 secret-like 字段 (Slice 004 walkForSecrets 抛错) | 拒绝 flush |

## 6. Source fidelity gate

沿用 Slice 006.8 `validateKnowledgeSourceFidelity`:

- `source_uri` 逐字保留 input
- `fetched_at` 逐字保留 input (不得漂移)
- `source_type: "vault"` 仅用于 `vault://...` URI
- 本地文件路径 (`/Users/...` / `docs/...` / `Desktop知识/...`) 必须保留 `local_plan` 或非 vault 分类
- 默认 SOFT FAIL; vault-on-non-vault **借以声称 trusted vault instruction authority** 时升级 HARD FAIL (throw)

## 7. Bucket semantics gate

沿用 Slice 006.9 5 项 bucket semantics 校验 (待 slice 实施; 本设计先列出):

1. `local_known` 与 `newly_found` 严格按 `source_type` 拆 (web/github → newly_found; 其他 → local_known)
2. `judgment` 与 findings 分栏, 不混入数据
3. web/github 默认 `untrusted_external`
4. `ingest_draft.local_findings` 引用 `local_known` 全部或子集
5. `ingest_draft.web_findings` 引用 `newly_found` 全部或子集

## 8. Roadmap mutation guard

沿用 Slice 004 `assertKnowledgeDoesNotModifyRoadmap`:

- 任何 `is_locked_roadmap: true` 的 target → 直接拒绝
- `ingest_draft.roadmap_change_allowed !== false` → 直接拒绝
- `ingest_draft.user_authorized_flush !== true` → 直接拒绝
- locked roadmap (`docs/roadmap-locked-2026-05-28.md` 任何 ADR 引用) 永不可由 ingest 改写

## 9. FlushRequest schema (未来 live adapter 输入)

```ts
interface LiveFlushRequest {
  schema_version: "1.0.0";
  mode: "pending_live_flush";                 // 升级自 "dry_run"
  created_at: string;                          // ISO 8601
  draft_id: string;                            // UUID / ULID, draft 全局唯一
  user_confirmation: {
    confirmed_in_session: true;                // 同一次对话
    confirmed_at: string;                      // ISO 8601
    confirmation_phrase: "我授权 flush" | 等价明确语义
  };
  ingest_draft: KnowledgeIngestDraft;          // Slice 004 shape
  source_fidelity_result: KnowledgeSourceFidelityReport;  // Slice 006.8
  bucket_semantics_result: BucketSemanticsResult;          // Slice 006.9
  roadmap_guard_result: { allowed: true; reason: string }; // Slice 004
  target_store: "hermes_managed_knowledge_store";          // 字面量, 不可指向其它
  runtime_adapter_required: true;              // 字面量
  runtime_flush_allowed: false;                // 本 slice 仍 false; 真实 flush 需另批
  dry_run_artifact_ref: string;                // 引用 Slice 006.5/006.7 fixture 路径
  next_required_approval: "live_adapter_implementation_slice";  // 字面量
}
```

## 10. Metadata / frontmatter schema (未来知识库写入条目)

```yaml
---
title: "<= 30 字>"
summary: "<1-3 句>"
source_type: "local_plan | vault | github | web | knowledge_search | gbrain_typed_link | user_supplied"
source_uri: "<exact from input>"
fetched_at: "<ISO 8601, exact from input>"
indexed_at: "<ISO 8601, ingest time>"
trust_level: "trusted_verified | trusted_external | semi_trusted_local | untrusted_external | unknown"
safe_to_use_as_instruction: true | false
retrieval_keywords: ["lowercase", "deduped"]
local_findings: [KnowledgeFinding, ...]
web_findings:  [KnowledgeFinding, ...]
stale_sources: [KnowledgeFinding, ...]   # do_not_use_as_current_truth=true 的全部 finding
provenance: { source_type, source_uri, fetched_at, indexed_at, trust_level, safe_to_use_as_instruction }
created_by: "Hermes Pro Knowledge Reuse Adapter"  # 字面量
created_from_draft_id: "<ULID, 与 FlushRequest.draft_id 同步>"
user_confirmed_at: "<ISO 8601, 与 FlushRequest.user_confirmation.confirmed_at 同步>"
---
```

## 11. Failure modes (未来 live adapter 必须实现)

| 场景 | 行为 |
|------|------|
| `runtime_flush_allowed: false` 但 caller 试图触发 | 抛 `RuntimeFlushNotAllowedError` |
| `user_authorized_flush: false` | 抛 `UserConfirmationMissingError` |
| `roadmap_change_allowed: true` | 抛 `RoadmapMutationBlockedError` (类型字面量应阻止, runtime 仍 throw 防御) |
| `source_fidelity_result.ok === false` (含 hard_fail) | 抛 `SourceFidelityHardFailError` |
| `bucket_semantics_result.ok === false` | 抛 `BucketSemanticsError` |
| `roadmap_guard_result.allowed === false` | 抛 `RoadmapGuardError` |
| `target_store !== "hermes_managed_knowledge_store"` | 抛 `InvalidTargetStoreError` |
| 真实 `knowledgeIngest` IPC 失败 (e.g. network, schema) | 抛 `LiveFlushAdapterError`, 走 § 12 rollback |

## 12. Rollback / no-write fallback

未来 live adapter 必须实现:

1. **Pre-write validation** — § 5-8 全部通过才进入写阶段。
2. **Atomic write** — 单次 IPC 调用要么全部成功要么全部不写; 不得半写。
3. **Audit log** — 每次尝试 (成功 / 失败) 必写 `~/.hermes/audit` (append-only); 不允许静默失败。
4. **Handoff Pack** — 成功后自动写 Handoff Pack entry (P0.5 MVP)。
5. **No-write fallback** — 任何失败 → 返回 draft + `flush_pending: true` + `failure_reason`, **不得**回退到 dry-run 假装成功。
6. **Idempotency** — `draft_id` 重复提交时返回 "already flushed" + 之前 flush 的 entry 引用; 不得重复写。
7. **Rate limit** — 同一用户同 `draft_id` 每小时最多 1 次 (待 Slice 007B/C 设计)。

## 13. Future implementation slices

按依赖顺序:

1. **Slice 007B**: `src/shared/lib/knowledge-live-flush-contract.ts` (纯 contract helper)
   - 类型: `LiveFlushRequest` / `LiveFlushResponse` / `LiveFlushError`
   - 纯 validator: `validateLiveFlushRequest(req) -> { ok, errors[] }`
   - 0 I/O, 0 IPC, 0 runtime 调用
2. **Slice 007C**: UI confirmation design
   - Hermes Pro renderer 加 "Confirm Flush" 按钮
   - 渲染 Slice 007A FlushRequest draft (read-only) + confirmation dialog
   - 不接 IPC, 仅设计
3. **Slice 008** (真实 adapter, 需用户**新批**):
   - `src/main/knowledge-flush-adapter.ts` (preload + main process)
   - 接 IPC, 调 `knowledgeIngest` runtime
   - 必须经一次用户在场 flush 验收
   - 任何 Handoff Pack / audit log 写入必须先经安全基座 (P2.5) 校验
4. **Slice 009** (后验收, 需新批):
   - Rollback / idempotency / rate limit 实施
   - Append-only audit
   - 多端灰度 (Hermes / Codex / Claude Code)

## 14. 硬不变量 (must, 跨所有未来 slice)

- `runtime_flush_allowed` 在 Slice 007A 仍为 `false`
- 真实 flush 永远不"自动" — 必须 `user_authorized_flush=true` + live adapter 批准 + 一次用户在场验收
- 任何 `roadmap_change_allowed=true` 的 draft 一律拒绝
- 任何 vault-on-non-vault 借以声称 trusted instruction authority → 拒绝 (HARD FAIL)
- 任何 secret-like 字段 → 拒绝
- 任何 `target_store !== "hermes_managed_knowledge_store"` → 拒绝

## 15. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 样例: `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` (Slice 006.5)
- 速查: `docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md` (Slice 006.6)
- 评估: `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` (Slice 006.7)
- fidelity: `validateKnowledgeSourceFidelity` (Slice 006.8)
- bucket: `BucketSemanticsResult` (Slice 006.9)
- 007A (本 slice): design only
- 007B (next): pure contract helper
- 007C (next): UI confirmation design
- 008 (待批): real live adapter
- 009 (待批): post-implementation hardening
