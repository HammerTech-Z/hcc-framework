# Hermes Pro — Knowledge Handoff Contract Snippet Insertion Design (2026-06-03)

> Slice 007J — Handoff Payload Insertion Design / No Runtime Write
> 范围: spec doc + tests + pure helper/schema; **不写真实** `~/.hermes/handoff/packs`, **不接** runtime, **不启动** Claude Code 子进程, **不改** Claude Code runtime。
> 上游: 004-007I (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck / 007E renderer plan / 007F fixture acceptance / 007G readiness / 007H slice plan / 007I Claude Code contract landing)
> 下游: 007K (Handoff dry-run fixture with contract snippet, 仍 no real write) / 008A (real adapter design, 仍 no runtime) / 真实 handoff runtime 接线 (另批)

## 1. Purpose

设计 Handoff Pack payload 如何携带 Knowledge contract snippet, 让未来 Hermes 派发 Claude Code 研究/保存类任务时, 能在 **dry-run payload** 中携带契约。

当前状态 (007I 完成):

- ✅ snippet helper (`buildKnowledgeAgentContractSnippet`) 已落地
- ✅ attach triggers (`shouldAttachKnowledgeContract`) 已验证
- ✅ runtime 防御 (`assertKnowledgeContractNoRuntime`) 已通过
- ❌ **未设计** snippet 如何嵌入 `HandoffPackPayload`
- ❌ **未接** `src/main/hcc-handoff-pack.ts` 实际 builder
- ❌ **未批** 真实 `~/.hermes/handoff/packs` 写入

本 slice 把"snippet → payload 字段"路径固化为:

- 1 schema (`KnowledgeHandoffContractSnippet`)
- 1 placement (`context.contracts.knowledge_reuse`)
- 3 纯函数 (`build` / `validate` / `assertNoRuntime`)

**不接** handoff builder, **不改** `src/main/hcc-handoff-pack.ts`。真实接线留 007K 显式批。

## 2. Non-goals (本 slice 明确不做)

- ❌ 不写真实 `~/.hermes/handoff/packs`
- ❌ 不写真实 `~/.hermes/audit`
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ **不改 Claude Code runtime binary**
- ❌ **不启动 Claude Code 子进程**
- ❌ 不改 `src/main/hcc-handoff-pack.ts` 任何代码
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`

## 3. Current Handoff Pack boundary

`src/main/hcc-handoff-pack.ts` 现状 (P3 dry-run baseline 005/006 已通过):

- schema_version: `"1.0.0"`
- 必含字段: `next_actions[]` (owner ∈ {claude_code, hermes, user}) / `artifact_ref` / `verificationCommands` / `decisions`
- 已含 dry-run flags: `mode: "dry_run"`, `runtime_flush_allowed: false`, `required_user_confirmation: true`
- 必无执行性 step 命令 (Slice 008 才接)

本 slice 留其原状, 仅在 schema 层加 `context.contracts.knowledge_reuse` 字段, 由 future 007K 实际接入 builder。

## 4. Trigger conditions (与 007I 共享)

snippet 在 handoff payload 中**存在**当且仅当 `shouldAttachKnowledgeContract(ctx)` 返回 `true`。任一触发:

1. 用户说保存关键词 (zh + en, ~14 词)
2. 用户说研究/对比/选型关键词
3. task_kind ∈ {`github_research`, `tool_comparison`, `technical_selection`, `project_research`, `general_research`}
4. handoff context 含 `ingest_draft` 或 `flush_pending: true`
5. handoff context 同时含 `local_known` + `newly_found`

不适用 (snippet 字段不出现):

- 普通代码任务 (refactor / bug fix)
- 简单聊天
- 完全本地操作

## 5. Proposed payload schema

`KnowledgeHandoffContractSnippet` (新增 interface, `src/shared/lib/knowledge-handoff-contract.ts`):

```ts
interface KnowledgeHandoffContractSnippet {
  target_agent: "claude_code" | "codex" | "hermes";
  snippet_version: "1.0.0";
  snippet_text: string;
  attach_reason: string;
  trigger_flags: {
    save_keyword: boolean;
    research_keyword: boolean;
    research_task_kind: boolean;
    has_ingest_draft: boolean;
    has_flush_pending: boolean;
    has_local_known_and_newly_found: boolean;
  };
  dry_run_only: true;          // type literal
  runtime_flush_allowed: false; // type literal
  source_doc: "docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md";
  created_at: string;          // ISO 8601
  max_chars: number;
  truncated: boolean;
  forbidden_runtime_checked: true; // type literal
}
```

13 必含字段, 4 字面量 (`dry_run_only: true` / `runtime_flush_allowed: false` / `forbidden_runtime_checked: true` / `source_doc: SOURCE_DOC_ID`)。

## 6. Field placement

推荐放在 **`context.contracts.knowledge_reuse`** (新增 context 子树, 未来 007K builder 实施时写入):

```jsonc
{
  "schema_version": "1.0.0",
  "mode": "dry_run",
  "runtime_flush_allowed": false,
  "next_actions": [...],            // 既有, 不动
  "artifact_ref": "hcc-dry-run://.../handoff-payload",
  "context": {                      // 新增 context 子树
    "contracts": {
      "knowledge_reuse": {          // 新增 knowledge_reuse 字段
        "target_agent": "claude_code",
        "snippet_version": "1.0.0",
        "snippet_text": "...",
        "attach_reason": "user-request-contains-save-keyword",
        "trigger_flags": { ... },
        "dry_run_only": true,
        "runtime_flush_allowed": false,
        "source_doc": "docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md",
        "created_at": "2026-06-03T...",
        "max_chars": 2048,
        "truncated": false,
        "forbidden_runtime_checked": true
      }
    }
  }
}
```

**不放**:

- ❌ `executable_steps` / `verificationCommands` (非可执行)
- ❌ `next_actions` 内部 (不是命令式 runtime action)
- ❌ `audit` / `~/.hermes/audit` 路径
- ❌ `~/.hermes/handoff/packs` 真写入路径

## 7. Target agent rules

| Agent | 默认 attach? | 备注 |
|-------|-------------|------|
| `claude_code` | yes (default) | Hermes 默认派发目标 |
| `codex` | yes (default) | OpenAI Codex 兼容 |
| `hermes` | no (reserved) | 留作未来 Hermes 自调用, 默认不 attach 避免递归 |

实际 attach 由 `shouldAttachKnowledgeContract(ctx)` + `target_agent` 决定, 见 007I。

## 8. Snippet size / truncation rules

- `snippet_text` 长度 ≤ `max_chars` (default 2048)
- 超出 → 截断 + `truncated: true` (绝不丢失 `runtime_flush_allowed = false` 关键句)
- `max_chars` 在 builder 时可由 caller override; 默认 2048 = 007I 实际 snippet (~1.1 KB) 2x buffer
- 截断策略: 简单 `slice(0, maxChars)`, 截断后仍需通过 `validateKnowledgeHandoffContractSnippet` 校验 (snippet_text 非空)
- 永不二次压缩 (留 future 008B ADR)

## 9. Dry-run safety invariants (硬规则)

1. `dry_run_only: true` (type literal, 编译期锁死)
2. `runtime_flush_allowed: false` (type literal, 编译期锁死)
3. `forbidden_runtime_checked: true` (type literal, 编译期锁死)
4. 字段 `executable_command` / `verification_command` / `command_to_run` / `shell_command` / `fetch_url` / `write_to_path` 禁出现
5. snippet 文本不包含 `knowledgeIngest(` / `knowledgeSearch(` / `runPlaybook(` / `triggerCronJob(` / `sendMessage(` call 形式 (negative-clause 字面引用 OK)
6. snippet 不引用 `~` 路径 (`~/.claude/...`, `~/.hermes/...`)
7. snippet 不引用外部 URL (除 `vault://` 内部 schema)
8. `next_actions` 字段不变 (不是 snippet 容器)
9. `artifact_ref` 仍指向 `hcc-dry-run://` 前缀, 不改

## 10. Verifier expectations

未来 verifier (留 008A) 必过:

1. ✅ `validateKnowledgeHandoffContractSnippet(payload)` → ok=true
2. ✅ `assertKnowledgeHandoffContractNoRuntime(payload)` → 不 throw
3. ✅ `payload.context.contracts.knowledge_reuse.dry_run_only === true`
4. ✅ `payload.context.contracts.knowledge_reuse.runtime_flush_allowed === false`
5. ✅ `payload.context.contracts.knowledge_reuse.snippet_text` 长度 ≤ `max_chars`
6. ✅ `payload.context.contracts.knowledge_reuse.snippet_text` 不含 forbidden call
7. ✅ `payload.next_actions` 不变 (与现有 baseline 兼容)
8. ✅ `payload.artifact_ref` 不变
9. ✅ `payload.context.contracts.knowledge_reuse.target_agent ∈ {claude_code, codex, hermes}`
10. ✅ `payload.context.contracts.knowledge_reuse.forbidden_runtime_checked === true`
11. ✅ `payload.context.contracts.knowledge_reuse.source_doc` 引用 007I doc 路径

任一失败 → 拒绝 handoff 写盘 (留 007K 实施时做实接)。

## 11. Forbidden runtime instructions

snippet 自身**禁止**包含:

- 任何 `executable_command` / `verification_command` 字段
- 任何 `command_to_run` / `shell_command` 字段
- 任何 `fetch_url` / `write_to_path` 字段
- 任何 `~` 路径 (`~/.claude/...`, `~/.hermes/...`, `~/Desktop/...`)
- 任何外部 URL (`https://...`, `http://...`)
- 任何 call 形式的 `knowledgeIngest(` / `knowledgeSearch(` / `runPlaybook(` / `triggerCronJob(` / `sendMessage(`
- 任何承诺 "已保存" / "写入成功" / "saved successfully" / "will be written after confirm"

builder 必扫 `assertKnowledgeHandoffContractNoRuntime(payload)`, 命中 → throw, 不发 handoff。

## 12. Failure modes

| 场景 | 行为 |
|------|------|
| `runtime_flush_allowed: true` | `validate` reject (block) |
| `dry_run_only: false` | `validate` reject (block) |
| snippet_text 含 `knowledgeIngest(` | `assertNoRuntime` throw |
| snippet_text > max_chars | `build` 自动 truncate + `truncated: true` |
| max_chars ≤ 0 | `validate` reject (block) |
| attach_reason 空 | `validate` reject (block) |
| `target_agent` 不在白名单 | `validate` reject (block) |
| forbidden 字段出现 (executable_command 等) | `assertNoRuntime` throw |
| snippet_version ≠ 1.0.0 | `validate` reject (block) |
| attach_context 不通过 shouldAttach | `build` throw (refuse to emit) |
| JSON round-trip 失败 (序列化异常) | 抛 JSON 异常, 上层 catch |

## 13. Future implementation slices

按依赖顺序:

### 13.1 Slice 007K — Handoff Dry-run Fixture with Contract Snippet (推荐下一步)

- 范围: 构造 `tests/fixtures/knowledge-reuse/handoff-with-contract-snippet-dry-run.json`, 含 `context.contracts.knowledge_reuse` 字段, **fixture only, 仍 no real write**
- 仍不动 `src/main/hcc-handoff-pack.ts` 实际 builder
- 预计文件:
  - `tests/fixtures/knowledge-reuse/handoff-with-contract-snippet-dry-run.json` (新 fixture)
  - `tests/knowledge-handoff-contract-fixture.test.ts` (新 test)
- 预计内容: 3 fixture (claude_code / codex / hermes) × 5 trigger 组合 + 4 forbidden case 拒绝 fixture

### 13.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)
- 预计 test:
  - adapter shape 校验 (待批)

### 13.3 真实 handoff builder 实际接线 (留 007L+ 显式批)

- 范围: 改 `src/main/hcc-handoff-pack.ts` 实际接入
- 触发条件: 007K 通过 + 用户**显式批**
- 必跑 007J 全部 11 项 verifier expectations

## 14. 链路索引

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
- 007I contract landing: `docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md` + `src/shared/lib/knowledge-agent-contract-snippet.ts`
- **007J (本 slice)**: 本 doc + `src/shared/lib/knowledge-handoff-contract.ts` (3 纯函数) + `tests/knowledge-handoff-contract.test.ts`
- 007K (待批): Handoff dry-run fixture with contract snippet (无 real write)
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
- 改 Claude Code runtime binary
- 启动 Claude Code 子进程
- 改 `src/main/hcc-handoff-pack.ts` 实际接线
