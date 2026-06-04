# Hermes Pro — Knowledge Handoff Contract Snippet Dry-run Fixtures (2026-06-03)

> Slice 007K — Handoff Dry-run Fixture with Contract Snippet / No Real Write
> 范围: spec doc + tests + 3 fixture JSON + optional pure helper extension; **不写真实** `~/.hermes/handoff/packs`, **不接** runtime, **不启动** Claude Code / Codex / Hermes 子进程, **不改** Claude Code runtime。
> 上游: 004-007J (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck / 007E renderer plan / 007F fixture acceptance / 007G readiness / 007H slice plan / 007I contract landing / 007J handoff insertion design)
> 下游: 007L (Handoff builder insertion dry-run pure integration, 仍 no real write) / 008A (real adapter design, 仍 no runtime) / 真实 handoff runtime 接线 (另批)

## 1. Purpose

构造 Handoff dry-run fixture 样例, 验证 `knowledge_contract_snippet` 在 dry-run payload 中的位置 / target agent 差异 / 禁止 runtime 指令。

当前状态 (007J 完成):

- ✅ `KnowledgeHandoffContractSnippet` schema 已定义 (13 字段, 4 字面量)
- ✅ `buildKnowledgeHandoffContractSnippet` / `validate*` / `assert*` 3 纯函数已落地
- ✅ placement `context.contracts.knowledge_reuse` 已推荐
- ❌ **未构造** 实际 handoff dry-run fixture 样例
- ❌ **未验证** 3 target agent 差异

本 slice 构造 3 fixture 样例 + 12+ 测试覆盖, 仍 **fixture only, no real write**。

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
- ❌ **不启动 Claude Code / Codex / Hermes 子进程**
- ❌ 不改 `src/main/hcc-handoff-pack.ts` 任何代码
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`

## 3. Fixture inventory

3 fixture, 路径 `tests/fixtures/knowledge-reuse/handoff-contract/`:

| Fixture | 状态 | 角色 |
|---------|------|------|
| `claude-code-handoff-contract.json` | ✅ ready | 3 fixture 主体, snippet 完整, 8 条 contract |
| `codex-handoff-contract.json` | ✅ ready | 3 fixture 主体, 同 schema, snippet 同样含 8 条 |
| `hermes-handoff-contract-reserved.json` | ✅ ready | reserved=true, snippet_text="" 留作未来 opt-in |

每 fixture 必含 12 字段: `schema_version` / `kind` / `purpose` / `created_at` / `mode` / `runtime_flush_allowed` / `required_user_confirmation` / `owner` / `task_kind` / `task_id` / `query` / `next_actions` / `artifact_ref` / `context.contracts.knowledge_reuse` (13 字段) / `forbidden_runtime_checked_at_creation`。

## 4. Target agent behavior (3 类)

### 4.1 `claude_code` (default attach)

- `target_agent: "claude_code"`
- `snippet_text` 含 8 条 contract
- `attach_reason: "user-request-contains-save-keyword"`
- `trigger_flags.save_keyword: true` (因 fixture query "把分析保存到 Hermes Pro 知识库")
- `trigger_flags.research_keyword: true` (因 "对比")
- `trigger_flags.research_task_kind: true` (因 task_kind=github_research)
- snippet 完整保留 007I 8 条
- dry_run_only / runtime_flush_allowed / forbidden_runtime_checked 全部字面量

### 4.2 `codex` (default attach)

- `target_agent: "codex"`
- `snippet_text` 含 8 条 contract (与 claude_code 同源, snippet 可 target-adjusted 但保留核心 rules)
- `attach_reason: "user-request-contains-save-keyword"`
- `trigger_flags.save_keyword: true` (因 "persist conclusion to Hermes Pro knowledge base")
- dry_run_only / runtime_flush_allowed / forbidden_runtime_checked 全部字面量

### 4.3 `hermes` (reserved, no default attach)

- `target_agent: "hermes"`
- `snippet_text: ""` (空)
- `attach_reason: "hermes-reserved-no-default-attach"`
- `trigger_flags` 全部 false
- `reserved: true` + `reserved_reason: "Hermes is reserved: no default attach to avoid recursion. Future slice may opt in."`
- dry_run_only / runtime_flush_allowed / forbidden_runtime_checked 仍字面量 (合规)
- 核心设计: 留作未来 Hermes 自调用 opt-in, 当前 slice 不 attach

## 5. Handoff payload placement

**全部 3 fixture** 用同一 placement 路径:

```
context.contracts.knowledge_reuse.<13 字段>
```

不放:

- ❌ `executable_steps` (snippet 不应混入)
- ❌ `verificationCommands` (snippet 不应混入)
- ❌ `next_actions[].action` 不应是 `knowledgeIngest(` 之类的 call
- ❌ `audit` 路径
- ❌ `~/.hermes/handoff/packs` 真路径

`next_actions` 仍为只读 audit step, 描述 owner 的预期动作 (review_dry_run / await_user_confirmation), 不包含 call 形式的 runtime action。

## 6. Dry-run invariants (硬规则)

每 fixture 必满足 9 项:

1. `schema_version: "1.0.0"`
2. `mode: "dry_run"`
3. `runtime_flush_allowed: false`
4. `required_user_confirmation: true`
5. `context.contracts.knowledge_reuse.dry_run_only: true`
6. `context.contracts.knowledge_reuse.runtime_flush_allowed: false`
7. `context.contracts.knowledge_reuse.forbidden_runtime_checked: true`
8. `context.contracts.knowledge_reuse.source_doc` 引用 007I doc 路径
9. `context.contracts.knowledge_reuse.snippet_text` ≤ `max_chars` (默认 2048)

claude_code / codex fixture 必满足 12 项 (上述 + snippet_text 非空 + 3 trigger 至少 1 true):

10. `snippet_text` 含 "Hermes Pro internal knowledge store"
11. `snippet_text` 含 "Do not ask the user for an Obsidian Vault path"
12. `snippet_text` 含 "Do not write to MEMORY.md"

hermes fixture 必满足 13 项 (上述 + reserved=true + snippet_text=""):

13. `context.contracts.knowledge_reuse.reserved: true`

任一违例 → 拒绝 fixture。

## 7. Verifier expectations

未来 verifier (留 008A) 必过 11 项:

1. ✅ `payload.context.contracts.knowledge_reuse.dry_run_only === true`
2. ✅ `payload.context.contracts.knowledge_reuse.runtime_flush_allowed === false`
3. ✅ `payload.context.contracts.knowledge_reuse.forbidden_runtime_checked === true`
4. ✅ `payload.context.contracts.knowledge_reuse.target_agent ∈ {claude_code, codex, hermes}`
5. ✅ `payload.context.contracts.knowledge_reuse.snippet_text` 长度 ≤ `max_chars`
6. ✅ `payload.context.contracts.knowledge_reuse.snippet_text` 不含 forbidden call (knowledgeIngest( / knowledgeSearch( / runPlaybook( / triggerCronJob( / sendMessage()
7. ✅ `payload.context.contracts.knowledge_reuse.source_doc` 引用 007I doc 路径
8. ✅ `payload.context.contracts.knowledge_reuse.attach_reason` 非空
9. ✅ `payload.runtime_flush_allowed === false`
10. ✅ `payload.next_actions[].action` 不含 forbidden call
11. ✅ `payload.context` 必含 `contracts.knowledge_reuse` 字段 (placement assertion)

任一失败 → 拒绝 handoff 写盘 (留 007L 实施时实接)。

## 8. Forbidden placement assertions (硬规则)

未来 verifier 必拒以下 5 类 misplaced:

1. **`executable_steps` 含 snippet** — 拒绝
2. **`verificationCommands` 含 snippet** — 拒绝
3. **`next_actions[].action` 是 call 形式 runtime action** (e.g. `knowledgeIngest(`, `runPlaybook(`) — 拒绝
4. **`audit` 路径引用** — 拒绝
5. **`~/.hermes/handoff/packs` 真路径引用** — 拒绝

placement 唯一合法路径: `context.contracts.knowledge_reuse`。

## 9. Future implementation slices

按依赖顺序:

### 9.1 Slice 007L — Handoff Builder Insertion Dry-run Pure Integration (推荐下一步)

- 范围: 写 `src/main/hcc-handoff-pack.ts` 的 **dry-run builder** 实际接入 `buildKnowledgeHandoffContractSnippet` (007J helper), 输出 fixture-shaped dry-run payload, **仍 no real write to `~/.hermes/handoff/packs`**
- 触发条件: 用户**显式批**本 slice
- 预计文件:
  - `src/main/hcc-handoff-pack.ts` (实际接线, 用 `tmpDir` 而非 `~/.hermes/handoff/packs`)
  - `tests/safety/hcc-handoff-contract-builder.test.ts` (集成 test)
- 预计内容: builder 接受 task + attach context, 调 helper 构造 envelope, 插入 `context.contracts.knowledge_reuse`, 仍 dry-run

### 9.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)

### 9.3 真实 handoff builder 实际写盘 (留 008+ 显式批)

- 范围: 改 `src/main/hcc-handoff-pack.ts` 写真实 `~/.hermes/handoff/packs`
- 触发条件: 007L 通过 + 用户**显式批**
- 必跑 007K 全部 11 项 verifier expectations

## 10. 链路索引

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
- 007J handoff insertion: `docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md` + `src/shared/lib/knowledge-handoff-contract.ts`
- **007K (本 slice)**: 本 doc + 3 fixture (`claude-code-handoff-contract.json` / `codex-handoff-contract.json` / `hermes-handoff-contract-reserved.json`) + `tests/knowledge-handoff-contract-fixture.test.ts`
- 007L (待批): Handoff builder insertion dry-run pure integration (无 real write)
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

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
- 真实 renderer 组件实装
- 真实 live adapter
- 真实 `~/.hermes/handoff/packs` / `~/.hermes/audit` 写入
- 启 dev server / 跑 Playwright / 采集截屏
- 改 Claude Code runtime binary
- 启动 Claude Code / Codex / Hermes 子进程
- 写真实 handoff payload 到 `~/.hermes/handoff/packs` (留 007L 用 tmpDir, 008+ 写真实)
