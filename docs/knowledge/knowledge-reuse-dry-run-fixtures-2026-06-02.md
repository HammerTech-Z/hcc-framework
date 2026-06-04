# Hermes Pro — Knowledge Reuse Dry-run Fixtures (2026-06-02)

> Slice 006.5 — Knowledge Reuse Dry-run Fixture / Golden Example
> 范围: fixture / example / doc / test 层。仅只读。仅声明样例, 不接 runtime 写入。
> 上游: Slice 004 (helper) + Slice 005 (prompt contract) + Slice 006 (dry-run integration)
> 下游: Slice 007 — live flush adapter + UI confirmation, **需用户明确批准**。

## 0. 目的

Slice 006.5 提供一组**金标准 dry-run fixture**, 让 Claude Code / Codex / Hermes 三端在
"研究 GitHub / 检索网页 / 读本地计划 / 用户说保存到知识库" 场景下, 有:

- 一个**可测试**的输出样例 (JSON 可 parse, shape 可校验)
- 一个**可复用**的标准模板 (字段顺序 / 必含元素 / trust_level 默认)
- 一个**不会误写**的安全样例 (无 MEMORY.md / .wolf / Obsidian Vault 路径建议)

Fixture 不是 runtime 输出, 是契约样例。

## 1. Fixture 文件

`tests/fixtures/knowledge-reuse/github-research-save-dry-run.json`

模拟真实场景:

> 用户让 Agent 检索若干 GitHub 仓库 / 网页 / 本地计划文档, 得出结论后说:
> "把有价值内容保存到 Hermes Pro 知识库"

场景覆盖:

- **local_plan (fresh)**: `docs/current-fusion-plan-2026-05-30.md` (trusted_verified)
- **local_plan (stale)**: `docs/archive/v2-status.md` (do_not_use_as_current_truth: true)
- **vault**: `vault://hermes-pro/docs/v6-knowledge-automation-plan.md` (semi_trusted_local)
- **github**: `https://github.com/multica-ai/andrej-karpathy-skills` (untrusted_external)
- **web**: `https://www.anthropic.com/news/claude-sonnet-4-6` (untrusted_external)

四栏输出:

```
local_known  — 本地已知 (3 项, 含 1 项 stale)
newly_found  — 本次新查 (2 项: github + web)
judgment     — Agent 判断 (与 findings 分栏)
ingest_draft — 可沉淀草稿 (待 trusted_user 确认)
```

## 2. 字段清单 (must)

| 字段 | 值/类型 | 说明 |
|------|---------|------|
| `schema_version` | `"1.0.0"` | 来自 Slice 006 payload |
| `created_at` | ISO 8601 | 固定时间, 便于测试比对 |
| `mode` | `"dry_run"` | 类型字面量 |
| `runtime_flush_allowed` | `false` | 类型字面量, 编译期锁死 |
| `required_user_confirmation` | `true` | 类型字面量 |
| `query` | string | 用户原话 + 研究问题 |
| `intent` | `"save_to_knowledge"` | 关键字匹配 save |
| `intent_confidence` | `0.95` | 高置信度 |
| `intent_matched_rule` | `"explicit-save-keyword"` | 命中规则名 |
| `plan` | `KnowledgeReusePlan` | 6 步 canonical order |
| `local_known` | `KnowledgeFinding[]` | 含 fresh + stale |
| `newly_found` | `KnowledgeFinding[]` | github + web |
| `judgment` | string | Agent 判断分栏 |
| `ingest_draft` | `KnowledgeIngestDraft` | 含 14 必含字段 |
| `flush_pending` | `true` | 因 ingest_draft 非空 |
| `forbidden_runtime_actions` | 7 项数组 | 显式声明禁动 |
| `next_action_for_user` | string | 提示用户下一步 |

每个 `KnowledgeFinding` 必含:

| 子字段 | 说明 |
|--------|------|
| `source_type` | `"local_plan"` / `"vault"` / `"github"` / `"web"` |
| `source_uri` | `vault://<path>` 或 `https://...` |
| `finding` | 一句话事实 |
| `fetched_at` | ISO 8601 |
| `trust_level` | 见下表 |
| `provenance` | 复用 `typed-links.ts` `Provenance` |
| `do_not_use_as_current_truth` | `true` 仅对 stale |

`ingest_draft` 必含 14 字段 (来自 Slice 004):

`title` / `summary` / `sources` / `local_findings` / `web_findings` / `comparison` /
`decision` / `provenance` / `trust_level` / `retrieval_keywords` / `created_at` /
`safe_to_use_as_instruction` (false) / `roadmap_change_allowed` (false) /
`user_authorized_flush` (false)

## 3. 信任等级 (fixture 强约束)

| source_type | 默认 trust_level | stale 时 |
|-------------|------------------|----------|
| `local_plan` (fresh) | `trusted_verified` | `untrusted_external` + `do_not_use_as_current_truth: true` |
| `local_plan` (stale) | `untrusted_external` | n/a |
| `vault` | `semi_trusted_local` | n/a |
| `gbrain_typed_link` | `semi_trusted_local` | n/a |
| `knowledge_search` | `trusted_verified` | n/a |
| `user_supplied` | `trusted_verified` | n/a |
| `web` | `untrusted_external` | n/a |
| `github` | `untrusted_external` | n/a |

GitHub / web **不能**在 fixture 中以 `trusted_verified` 出现。
只有经过人工核验并显式声明 `trusted_external` 时才能升级, 仍非 `trusted_verified`。

## 4. Fixture 不是 (NOT)

- **不是** live flush。
- **不是** 真实写入知识库。
- **不是** runtime 输出。
- **不是** IPC 触发样例。
- **不是** UI 渲染样例。
- **不是** HCC plan。
- **不是** handoff pack 入口。
- **不是** audit log entry。

Fixture 仅供:

- 测试断言 (单元测试 / golden test)
- prompt 模板示例 (给 Claude/Codex/Hermes 看)
- 文档化标准样例
- 未来 Slice 007 flush adapter 的输入格式参考

## 5. 与上游底座的关系

| 上游 | 关系 |
|------|------|
| `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006) | Fixture 是其 `buildHermesKnowledgeReuseDryRun` 的"金标准输入 → 预期输出"样例 |
| `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004) | Fixture 字段与类型完全对齐 Slice 004 helper 输出 |
| `docs/knowledge/knowledge-reuse-integration-dry-run-2026-06-02.md` (Slice 006) | Fixture 是该文档"payload 字段"小节的具体实例 |
| `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005) | Fixture 体现契约第 1.4 节"四栏回答" |
| `docs/knowledge/knowledge-reuse-protocol-2026-06-02.md` (Slice 004) | Fixture 体现协议第 2 节"步骤顺序" |
| `docs/roadmap-locked-2026-05-28.md` | Fixture 不触碰 |

## 6. 验证

- `npm run typecheck` (node + web)
- `npx vitest run tests/knowledge-reuse-protocol.test.ts tests/knowledge-agent-prompt-contract.test.ts tests/knowledge-reuse-integration.test.ts tests/knowledge-reuse-fixture.test.ts`
- `npx vitest run`
- `git diff --check`
- `rg -n "MEMORY\\.md|\\.wolf|ObsidianVault|knowledgeIngest\\(|knowledgeSearch\\(|fetch\\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process" tests/fixtures/knowledge-reuse docs/knowledge/knowledge-reuse-dry-run-fixtures-2026-06-02.md tests/knowledge-reuse-fixture.test.ts`
  (期望: fixture 0 命中; doc/test 命中仅作为"禁止项字面量引用"或 self-check 字面量)

## 7. 用户确认语义

Fixture 表达的用户确认流程:

```
1. Agent 答完 research 答案, 用户说 "保存到 Hermes Pro 知识库"
2. Agent 调 buildHermesKnowledgeReuseDryRun → 输出 payload (含 ingest_draft + flush_pending:true)
3. Agent 把 payload 渲染成 markdown 给用户审
4. 用户审 draft 内容, 决定是否要真写入
5. 如要真写入, 用户必须明确说 "我授权 flush" (同一次对话)
6. trusted_user_confirmed=true 之后, ingest_draft.user_authorized_flush=true
7. runtime_flush_allowed 仍为 false (Slice 006 dry-run gate)
8. 真实 flush 必须 Slice 007 live flush adapter 显式批准才允许
```

未到第 8 步, 永远是 dry-run; 永远不写。

## 8. 已知非目标 (out of scope)

- 不实现真实 `knowledgeIngest` runtime 调用 (留给 Slice 007)。
- 不启动 HCC Auto Executor (按 P3.5 soft switch 观察期约束)。
- 不做 UI 重构。
- 不接 IPC。
- 不改 runtime 执行入口。
- 不改 locked roadmap。
- 不动 Hermes Agent hard cutover / Round 2 C。
- 不写 `~/.hermes/handoff/packs` / `~/.hermes/audit`。
- 不接 cron / WeChat / gateway / serve / agent / delegate / playbook runtime。
- 不在 fixture 中推荐 MEMORY.md / .wolf / Obsidian Vault 写入路径 (测试 12 验证)。
- 不在 fixture 中模拟 `flush_pending: false` 同时 `ingest_draft` 非空 (语义矛盾, 测试拒绝)。

## 9. 后续建议 (Slice 007 提案)

Slice 007 仍按 Slice 006 末尾提案: 真实 flush adapter + UI 确认门 + 一次真实 flush 验收。
本 slice 不暗中推进 Slice 007, 任何 Slice 007 动作必须用户新批。

继续冻结 (Slice 007 也不得触碰, 除非用户在新批):

- Round 2 C
- hard cutover
- HCC Auto Executor 启动
- 真实 `knowledgeIngest(` runtime 调用 (Slice 006.5 范围内不调用, Slice 007 才允许, 且仅在新批下)
- WeChat / iLink 实际投递
- cron 实际执行
- locked roadmap (`docs/roadmap-locked-2026-05-28.md`)

## 10. 链路全景

```
[Slice 004] protocol helper           ✅
[Slice 005] prompt contract           ✅
[Slice 006] dry-run integration       ✅
[Slice 006.5] golden fixtures         ✅ (本 slice)
   tests/fixtures/knowledge-reuse/github-research-save-dry-run.json
   tests/knowledge-reuse-fixture.test.ts
   docs/knowledge/knowledge-reuse-dry-run-fixtures-2026-06-02.md
       ↓
[Slice 007] live flush adapter + UI confirmation gate
   ⏸️  需用户明确批准
```

链路已具备:

- 协议 helper (004)
- 契约文档 (005)
- dry-run 集成 + 守卫 (006)
- 金标准 fixture (006.5)

仍缺:

- 真实 flush 接线 (007, 待批)
- UI 确认门 (007, 待批)
- 一次用户在场 flush 验收 (007, 待批)
