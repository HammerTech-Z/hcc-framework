# Hermes Pro — Knowledge Claude Code Contract Landing (2026-06-03)

> Slice 007I — Claude Code Knowledge Contract Landing / No Runtime
> 范围: spec doc + tests + pure prompt/template helper; **不接** runtime, **不调用** 知识库, **不写** 知识库, **不改** Claude Code runtime binary, **不启动** Claude Code 子进程。
> 上游: 004-007H (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck / 007E renderer plan / 007F fixture acceptance / 007G readiness / 007H slice plan)
> 下游: 007J (Handoff payload insertion design, 仍 no runtime write) / 007H-1 (renderer GateCard implementation, 待用户批) / 真实 handoff runtime 接线 (另批)

## 1. Purpose

把 Hermes Knowledge Reuse quick reference 落到 Claude Code 任务交接/提示词模板层, 让 Hermes 派给 Claude Code 的研究/保存类任务**默认携带知识库契约**。

当前状态:

- ✅ prompt-contract level 已关联 (Slice 005)
- ✅ dry-run behavior 已验证 (Slice 006 + 006.7 + 006.8 + 006.9)
- ❌ **default landing / task handoff level 未落地**
- ❌ runtime / live write 未接

本 slice 把"contract snippet"从"开发者手动复制粘贴"升级为"helper 自动构造 + 触发判断", 但仍**不接 runtime**; 真实 handoff payload 自动插入留 007J。

## 2. Non-goals (本 slice 明确不做)

- ❌ 不实现任何 runtime 接线
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter
- ❌ 不在 Claude / Codex / Hermes default system prompt 落地契约 (本 slice 仅产出 snippet; 系统 prompt 落地留 007J)
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ **不改 Claude Code runtime binary** (本 slice 0 binary 改动)
- ❌ **不启动 Claude Code 子进程** (本 slice 0 进程启动)
- ❌ 不改 `src/main/hcc-handoff-pack.ts` / `hcc-handoff-page-summary*.ts` / `hcc-dry-run.ts` 等已有 handoff builder
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook

## 3. Trigger conditions (何时插入 contract snippet)

snippet 在下列任一条件下被插入到 Claude Code 任务 prompt:

| # | 触发 | 来源 |
|---|------|------|
| 1 | 用户说"保存 / 沉淀 / 存档 / 写入 / 存到 / 入库 / 记到 / 记录 / 存入 / add to knowledge / save to knowledge / persist / store / ingest" | 用户原话 |
| 2 | 用户说"调研 / 研究 / 解释 / 介绍 / 告诉我 / 检索 / search / research / investigate / what is / how does / 对比 / 比较 / vs / compare / 选型 / alternative" (任一研究/对比关键词) | 用户原话 |
| 3 | 上游 task_kind ∈ {`github_research`, `tool_comparison`, `technical_selection`, `project_research`, `general_research`} | Slice 004 KnowledgeReusePlan |
| 4 | handoff context 含 `ingest_draft` 或 `flush_pending: true` (任一) | Slice 006.5 / 006 handoff payload |
| 5 | handoff context 同时含 `local_known` + `newly_found` (说明有本地+新查, 必走 4 栏回答) | Slice 006 handoff payload |

**不适用** (snippet 不插入):

- 普通代码修改任务 (refactor / bug fix / test addition) 且用户未要求沉淀知识
- 简单聊天 / 问候 / 解释性问答, 不涉及研究/保存
- 完全本地操作 (e.g. "列出目录"), 不涉及 GitHub/web/repo

## 4. Contract snippet (8 条, 可直接贴入 prompt)

```
# Hermes Knowledge Reuse Contract (for <target_agent>, slice 007I)

1. The canonical knowledge store is the Hermes Pro internal knowledge store.
   It is managed by Hermes Pro. Do not ask the user for an Obsidian Vault path.

2. Do not write to MEMORY.md, .claude/memory/MEMORY.md, .wolf/cerebrum.md,
   .wolf/anatomy.md, .wolf/memory.md, or any other custom note path
   (notes/<topic>.md, research/<date>.md, etc.).

3. Do not claim 'saved' / '已保存' / 'written' / '写入成功' /
   'saved successfully' / 'will be written after confirm'.
   Until runtime flush is approved, no write has happened.

4. Output the answer in 4 sections:
   (a) local_known (vault:// / knowledge:// / docs/...),
   (b) newly_found (https://..., trust_level=untrusted_external),
   (c) judgment (your analysis, kept separate from findings),
   (d) ingest_draft (only if the user said 'save to knowledge').

5. Preserve source_uri and fetched_at exactly as input.
   Do not rewrite, truncate, or drift them.
   source_type='vault' is reserved for vault:// URIs only.

6. Bucket semantics: local_plan / vault / knowledge_search / gbrain_typed_link
   go to local_known. github / web go to newly_found.
   Stale / archive / *.before-* / v*-status.md / docs/archive/* /
   Desktop知识/归档/ go to historical_only (do_not_use_as_current_truth=true).
   Do not place stale findings in newly_found.

7. Confirmation only makes the draft eligible for an approved flush path.
   runtime_flush_allowed = false.
   Real flush requires a separate live adapter implementation slice to be approved.

8. Do not start serve / run / agent / delegate / playbook / gateway / cron / handoff_write /
   audit_write / hcc_executor. Do not call knowledgeIngest / knowledgeSearch /
   fetch / axios / XMLHttpRequest / runPlaybook / triggerCronJob / sendMessage.
```

**总长度**: ~1.1 KB。直接粘入 Claude Code 任务 prompt 头部, 8 条 / 3 不写 / 3 不调, 覆盖 Slice 004-007D 所有规则。

**实现**: `src/shared/lib/knowledge-agent-contract-snippet.ts` 中 `buildKnowledgeAgentContractSnippet(target_agent)` 纯函数输出上述字符串。

## 5. Handoff integration point

未来 handoff builder (留 007J) 在构造 `HandoffPackPayload` 时:

```ts
// 留 007J 实施, 本 slice 不动
if (shouldAttachKnowledgeContract({
  request_text: handoffTaskRequestText,
  task_kind: handoffTaskKind,
  handoff_context: {
    has_ingest_draft: payload.ingest_draft !== null,
    has_flush_pending: payload.flush_pending === true,
    has_local_known: payload.local_known.length > 0,
    has_newly_found: payload.newly_found.length > 0,
    owner: payload.owner,
  },
})) {
  payload.contract_snippet = buildKnowledgeAgentContractSnippet("claude_code");
}
```

**本 slice 不接**: 上述代码**不**在 `src/main/hcc-handoff-pack.ts` 中实装, 仅在 spec doc + helper 暴露, 留 007J。

## 6. Task prompt insertion point

未来 Claude Code 任务 prompt 构造时:

```
[USER REQUEST]
<user 原话>

[HERMES KNOWLEDGE CONTRACT]
<buildKnowledgeAgentContractSnippet("claude_code") 输出的 8 条>

[TASK HINT]
<可选: 上游 task_kind / 已知 findings 引用>

[EXECUTE]
- 4 栏回答 (local_known / newly_found / judgment / ingest_draft)
- 走 buildKnowledgeIngestDraft (Slice 004) 仅当用户说"保存"
- 真实 knowledgeIngest 永远不调
```

插入位置: user request 之后, task hint 之前。Claude Code 看到 snippet 后必守 8 条。

## 7. Expected Claude Code behavior

插入 snippet 后, Claude Code 必:

1. **输出 4 栏** (local_known / newly_found / judgment / ingest_draft)
2. **不发明** Obsidian Vault / MEMORY.md / .wolf 路径
3. **不调** knowledgeIngest / knowledgeSearch / fetch / runPlaybook 等
4. **不声称** "已保存" / "写入成功"
5. **保留** source_uri / fetched_at verbatim
6. **bucket** 正确归类
7. **等用户** 说"我授权 flush"才标 `user_authorized_flush: true`
8. **遵守** `runtime_flush_allowed = false`, 输出 `flush_pending: true`

## 8. Forbidden Claude Code behavior

插入 snippet 后, Claude Code 永**不**:

- 写 MEMORY.md / .wolf/cerebrum.md / Obsidian Vault / 任意自定义 note path
- 调 knowledgeIngest / knowledgeSearch / fetch / axios / runPlaybook / triggerCronJob / sendMessage
- 声称 "已保存" / "saved successfully" / "will be written after confirm"
- 把 local_plan / vault finding 放 newly_found
- 把 stale / archive finding 放 newly_found
- 改写 / 截断 source_uri 或 fetched_at
- 把本地文件路径标 `source_type: "vault"`
- 启 serve / run / agent / delegate / playbook / gateway / cron / hcc_executor
- 写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- 改 locked roadmap

## 9. Dry-run only boundary

- 本 slice **仅**产出 snippet + helper + spec doc
- **不**改 `src/main/hcc-handoff-pack.ts` 任何代码
- **不**改 `src/renderer/src/**` 任何代码
- **不**接任何 runtime
- 真实 handoff payload 自动插入 snippet 留 007J 显式批
- 真实 Claude Code 子进程启动留 008A 显式批

## 10. Tests / acceptance criteria

未来 PR 必过:

1. ✅ helper `buildKnowledgeAgentContractSnippet` 返回 snippet 含 8 条
2. ✅ snippet 文本含全部 20 项 required rules (helper 自检 `assertSnippetShape`)
3. ✅ snippet 文本不含任何 forbidden promise phrase
4. ✅ helper `shouldAttachKnowledgeContract` 5 trigger 全部返回 true
5. ✅ helper `shouldAttachKnowledgeContract` 4 not-attach 全部返回 false
6. ✅ helper `assertKnowledgeContractNoRuntime` 对 snippet 自身返回 ok=true (snippet 提到 token 但未 call)
7. ✅ helper 源 0 命中 runtime forbidden tokens
8. ✅ `npm run typecheck` 双端 EXIT 0
9. ✅ `npx vitest run` 全 suite 无回归
10. ✅ `git diff --check` clean
11. ✅ `rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" src/shared/lib/knowledge-agent-contract-snippet.ts` 0 命中 (排除 doc comment / 字面量引用)

## 11. Future implementation slices

按依赖顺序:

### 11.1 Slice 007J — Handoff Payload Insertion Design (推荐下一步)

- 范围: 设计 `HandoffPackPayload` schema 加 `contract_snippet` 字段, 含 `shouldAttachKnowledgeContract` 触发判断, **设计 only, 仍 no runtime write**
- 仍不动 `src/main/hcc-handoff-pack.ts` 实际接线
- 预计文件:
  - `docs/knowledge/knowledge-handoff-payload-insertion-design-2026-06-XX.md` (待批)
  - `tests/knowledge-handoff-payload-insertion.test.ts` (待批)
- 预计内容: 触发判定 + 字段 schema + dry-run boundary + forbidden copy scanner

### 11.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)
- 预计 test:
  - adapter shape 校验 (待批)

### 11.3 Slice 007H-1 — Renderer GateCard Implementation (若用户批 UI 实装)

- 范围: 写 `src/renderer/src/components/Flush/KnowledgeFlushGateCard.tsx` + `.test.tsx`
- 触发条件: 用户**显式批**本 slice
- 必跑 7 项 PR gate

### 11.4 真实 handoff payload 自动插入 snippet

- 范围: 改 `src/main/hcc-handoff-pack.ts` 实际接线
- 触发条件: 007J 通过 + 用户显式批
- 必跑 forbidden copy scanner

## 12. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
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
- 007G readiness review: `docs/knowledge/knowledge-live-flush-renderer-readiness-review-2026-06-03.md` + readiness-review.json
- 007H slice plan: `docs/knowledge/knowledge-live-flush-renderer-slice-plan-2026-06-03.md` + renderer-slice-plan.json
- **007I (本 slice)**: 本 doc + `src/shared/lib/knowledge-agent-contract-snippet.ts` (3 纯函数) + `tests/knowledge-agent-contract-snippet.test.ts`
- 007J (待批): Handoff payload insertion design (无 runtime)
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 13. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
- 改 Claude Code runtime binary
- 启动 Claude Code 子进程
- 改 `src/main/hcc-handoff-pack.ts` 实际接线
