# Hermes Pro — Knowledge Reuse Protocol (2026-06-02)

> 协议层 (read-only / protocol layer)。纯函数 helper, 不读文件、不联网、不调 IPC。
> Hermes Pro v6 知识自动化主线 V6-MAIN-COMPLETE 之后的可插拔协议, 适用于所有研究类任务
> (GitHub 仓库对比 / 工具选型 / 技术选型 / 项目调研 / 通用调研)。

## 0. 适用范围

任何"先查后答"的研究类任务, 包括但不限于:

- `github_research`: GitHub 仓库对比 / star / commit / 活跃度
- `tool_comparison`: 工具横向对比 (e.g. A vs B)
- `technical_selection`: 技术选型 (前端框架 / 数据库 / agent harness)
- `project_research`: 项目背景调研 (成熟度 / 风险 / 维护方)
- `general_research`: 通用调研 (协议 / 规范 / 行业趋势)

## 1. 协议硬规则

1. **本地优先**。Agent 答研究类问题前, 必须先声明:
   - 是否查过本地计划 (`CONTEXT.md` / `NEXT_STEP.md` / `LOCK.md` / `docs/roadmap-locked-*`)。
   - 是否查过 `knowledgeSearch` 预加载结果。
   - 是否查过 Vault / GBrain typed links。
2. **若未查本地, 必须给出原因**。`local_lookup_done: false` 时, `local_lookup_skip_reason` 必填。
3. **本地知识 / 新检索 / Agent 判断**三段必须分栏标注, 不得混为一谈。
4. **过时计划目录不得作为当前事实源**。见 `STALE_PLAN_PATTERNS` (含 `archive/`、`v2-status.md`、旧 `iteration-plan-v2-updated.md` 等)。
5. **Vault / Knowledge 不得自动改 locked roadmap**。`assertKnowledgeDoesNotModifyRoadmap` 拒绝所有 locked roadmap mutation。
6. **路线图变更必须 ADR + 用户确认**。本协议不创建 ADR; 仅在 `KnowledgeIngestDraft.decision` 留字段。
7. **用户说"存到知识库"时, 必须生成可审查的 ingest draft, 不得静默写入**。`buildKnowledgeIngestDraft` 始终输出 draft 对象, 不调用 `knowledgeIngest` runtime。
8. **真实调用 `knowledgeIngest` 必须 trusted_user 显式确认**。`safe_to_use_as_instruction` 与 `user_authorized_flush` 均为 `false`, 直到 `trusted_user_confirmed: true`。
9. **Claude Code 默认只生成 draft, 不直接写 Hermes Knowledge**。除非用户在同一次对话里明确说"我授权 flush"。
10. **不得借协议改写任何 locked roadmap**。即使 trusted_user 确认, `roadmap_change_allowed` 仍为 `false`。

## 2. 步骤顺序 (canonical)

```
local_plan → knowledge_search → vault_gbrain → web_github → answer → optional_ingest_draft
```

- `local_plan` 必查。Agent 必声明查了什么、命中什么。
- `knowledge_search` 必查 (Hermes 预加载的 in-memory local pre-baked hits)。
- `vault_gbrain` 必查 (Vault 文件 + GBrain typed links, 复用 `typed-links.ts` 的 `Provenance` / `TrustLevel`)。
- `web_github` 仅在本地不充分时执行; 每条新检索需附 `source_uri` / `fetched_at` / `trust_level`。
- `answer` 必分三栏: 本地已知 / 新检索 / Agent 判断。
- `optional_ingest_draft` 仅在用户说"沉淀 / 存档 / 存到知识库"时执行。

## 3. Helper API (pure functions)

模块: `src/shared/lib/knowledge-reuse-protocol.ts`

### `buildKnowledgeReusePlan(input)`
- 返回 `KnowledgeReusePlan`, 含 `task_kind` / `query` / `created_at` / `local_lookup_done` / `local_lookup_skip_reason` / `steps[]`。
- 不读文件; 不查网络。

### `classifyKnowledgeSource(input)`
- 返回 `KnowledgeSourceClassification`: `bucket` (local/external), `trust_level`, `do_not_use_as_current_truth`, `reason`。
- `local_plan` 命中 `STALE_PLAN_PATTERNS` 时, 自动降级为 `untrusted_external` 并打 `do_not_use_as_current_truth: true`。

### `buildKnowledgeIngestDraft(input)`
- 返回 `KnowledgeIngestDraft`:
  - `title` / `summary` / `sources` / `local_findings` / `web_findings`
  - `comparison` / `decision` (Agent 判断独立分栏)
  - `provenance` (复用 `typed-links.ts` 的 `Provenance`)
  - `trust_level` (取所有 findings 中最高)
  - `retrieval_keywords` (归一化、去重、lowercase)
  - `created_at`
  - `safe_to_use_as_instruction: false` (除非 `trusted_user_confirmed: true`)
  - `roadmap_change_allowed: false` (硬锁定, 不可覆盖)
  - `user_authorized_flush: false` (除非 `trusted_user_confirmed: true`)
- **Defence in depth**: 输入里若出现 `api_key` / `token` / `password` / `Bearer …` / `sk-…` 等, 直接 throw。
- **不**调用 `knowledgeIngest`。draft 拿到后, 调用方自行决定是否真正 flush (且必须经 `assertKnowledgeDoesNotModifyRoadmap` 校验)。

### `assertKnowledgeDoesNotModifyRoadmap(input)`
- `is_locked_roadmap: true` → throw。
- `ingest_draft.roadmap_change_allowed !== false` → throw。
- `ingest_draft.user_authorized_flush !== true` → throw。
- 其余情况返回 `{ allowed: true, reason: "non-locked target with safe ingest draft" }`。

## 4. 调用约定

Claude Code / Codex / Hermes Agent 三端默认 prompt 应包含:

> 遇到研究 / GitHub 对比 / 技术选型类任务时:
> 1. 先查本地计划和知识库 (CONTEXT.md / NEXT_STEP.md / LOCK.md / docs/roadmap-locked-* / knowledgeSearch 预加载 / Vault / GBrain typed links)
> 2. 再查 Vault / GBrain typed links
> 3. 如果本地没有或过期, 再联网检索
> 4. 回答时区分: 本地已有知识 / 新查到的网络信息 / Agent 判断
> 5. 如果用户要求沉淀, 则生成 `KnowledgeIngestDraft` (本协议 helper), 等用户确认
> 6. 存储时必须带: title / source URLs / summary / comparison / decision / provenance / trust_level / date / retrieval_keywords
> 7. 不得借本协议改写 locked roadmap

## 5. 与现有底座的关系

| 现有底座 | 关系 |
|----------|------|
| `knowledgeSearch` / `knowledgeIngest` preload API | 本协议只生成 draft, 不调用 runtime |
| `listVaultFiles` / `readVaultFile` / `getVaultStats` | 本协议不直接调用; 留接口给上层 agent 在执行 `vault_gbrain` 步骤时使用 |
| `typed-links.ts` `Provenance` / `TrustLevel` | 直接复用, 避免分叉 |
| `usage-feedback.ts` (P1.5) | 不影响本协议; 本协议不写 usage feedback |
| `hcc-cockpit-readonly` / `p3-dry-run-baseline-2026-06-01.md` | 本协议不启动 HCC; 写文档不触发 auto executor |
| `docs/roadmap-locked-2026-05-28.md` | 本协议对此文件只读; 任何 mutation 都被 `assertKnowledgeDoesNotModifyRoadmap` 拒绝 |

## 6. 验证

- `npm run typecheck`
- `npx vitest run tests/knowledge-reuse-protocol.test.ts`
- `npx vitest run`
- `git diff --check`
- `rg` 自查: 协议源文件不含 `fetch` / `axios` / `child_process` / `ipcMain` / `knowledgeIngest(` / `knowledgeSearch(` / `runPlaybook` / `sendMessage` / `triggerCronJob`

## 7. 已知非目标 (out of scope)

- 不实现真实 `knowledgeIngest` runtime 调用。
- 不启动 HCC Auto Executor。
- 不改 locked roadmap。
- 不动 Hermes Agent hard cutover / Round 2 C。
- 不写 `~/.hermes/handoff/packs` / `~/.hermes/audit`。
- 不接 cron / WeChat / gateway / serve / agent / delegate / playbook runtime。

## 8. 后续建议

1. 把第 4 节调用约定写入 Claude / Codex / Hermes 三端的默认 task prompt (CLAUDE.md / AGENTS.md / Hermes Pro 系统提示)。
2. 在 `hcc-cockpit-readonly` 旁加 `hcc-knowledge-reuse-readonly` 视图, 展示最近 30 天的 `KnowledgeIngestDraft` 草稿数 (只读, 不 flush)。
3. 待 V6-MAIN-COMPLETE 后的下一个 ADR 决定是否把本协议从 read-only 升级为 "draft + flush on confirm"。
