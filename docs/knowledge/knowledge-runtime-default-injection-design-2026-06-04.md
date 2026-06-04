# Hermes Pro — Knowledge Runtime Default Injection Design (2026-06-04)

> Slice 008A — Runtime Default Injection Design / Spec Only
> 范围: design doc + tests + design fixture JSON; **不修改** runtime, **不接** system prompt, **不写真实** handoff, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程。
> 上游: 004-007N
> 下游: 008B (Runtime injection dry-run feature flag design, 仍 no runtime) / 007H-1 (renderer GateCard implementation, 若用户批 UI 实装) / 008 (real live adapter, 另批)

## 1. Purpose

设计 Runtime Default Injection。定义未来如何把 Knowledge Contract Snippet 注入 Claude Code / Codex / hermes_pro 的默认任务提示词或 handoff dispatch prompt。

当前状态 (007N closeout):
- L0-L4 ✅ reached (dry-run handoff contract layer)
- L5 (runtime default injection) ❌ not reached
- L6 (live search / live flush) ❌ not reached

本 slice 是 **design only**, 不实现 L5。L5 实施留 Slice 008B+ 显式批。

## 2. Non-goals

- ❌ 不实现 L5 (runtime default injection)
- ❌ 不写真实 `~/.hermes/handoff/packs`
- ❌ 不写真实 `~/.hermes/audit`
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ 不改 Claude Code runtime binary
- ❌ 不启动 Claude Code / Codex / Hermes 子进程
- ❌ **不改 default system prompt runtime** (L5 留未来 slice 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L 已定型)

## 3. L4 vs L5 Boundary

| Layer | 描述 | 状态 | 范围 |
|-------|------|------|------|
| **L4** | dry-run handoff payload can carry snippet (`payload.context.contracts.knowledge_reuse`) | ✅ reached (Slice 007K / 007L / 007M) | 内存 / tmpDir, 永不写真实 handoff |
| **L5** | runtime default injection attaches snippet during real task dispatch / prompt assembly | ❌ not reached (008A 仅 design) | 真实 runtime prompt |

**008A scope**:
- ✅ Design L5 (how it would work, what surfaces, what gates)
- ❌ Do NOT implement L5
- ❌ Do NOT modify any runtime, default system prompt, or handoff writer
- ❌ Do NOT spawn Claude Code / Codex / Hermes subprocess

L5 实施留未来 slice 显式批 (推荐 008B dry-run feature flag design first)。

## 4. Injection Targets

| Target | Default inject? | 理由 |
|--------|-----------------|------|
| `claude_code` | ✅ true | primary executor for P3 code/project tasks; contract snippet is the canonical way to prevent Obsidian / MEMORY / .wolf behavior |
| `codex` | ✅ true | OpenAI Codex compatibility; same 8-rule contract; target-adjusted but core preserved |
| `hermes_pro` | opt-in | reserved for future Hermes self-call opt-in; today not default-injected to avoid recursion |
| `hermes` (self-call) | ❌ false | reserved: no default attach to avoid recursion. Explicit override only. |

## 5. Trigger Conditions (沿用 007I / 007J)

snippet attach 触发 (任一):

1. **User says save/ingest keyword** — "save" / "persist" / "ingest" / "archive" / "存到" / "沉淀" / "写入" (zh or en)
2. **User says research keyword** — "research" / "compare" / "analyze" / "调研" / "对比" / "选型" (zh or en)
3. **task_kind ∈ research family** — `github_research` / `tool_comparison` / `technical_selection` / `project_research` / `general_research`
4. **Handoff context has ingest_draft or flush_pending: true**
5. **Handoff context has both local_known + newly_found** (canonical 4-section answer shape required)

**No trigger**:
- Ordinary code-only task (refactor / bug fix / test addition) without knowledge save intent
- Simple chat / greeting ("hi")
- Purely local file operation (e.g. "list files in src")
- Hermes self-call (reserved; no default attach even with all triggers firing)

## 6. Injection Surfaces (3 方案比较)

| Surface | 描述 | 范围 | 回滚 | blast radius |
|---------|------|------|------|--------------|
| **A** handoff payload `context.contracts.knowledge_reuse` | HCC handoff payload 构建时插入 snippet; read-only contract data; payload 仍在内存 / tmpDir 直至 008+ | narrow (仅 handoff payload) | 从 builder 移除; fall back to L4 handoff-only | **low** |
| **B** task prompt preamble | snippet 作为 task prompt preamble 段在 dispatch 时插入; read-only contract data; task prompt 其余不变 | medium (每个 Hermes 派发的 task 都收 preamble) | 从 dispatch prompt assembly 移除 preamble step | medium |
| **C** default system prompt fragment | 修改 agent 的 default system prompt 永久嵌入 snippet; 影响所有 task, 不止 Hermes 派发 | global (agent 所有 task) | revert system prompt change | **high** (污染所有 task) |

## 7. Recommended Surface

**推荐: B (task prompt preamble) 作为 Phase 1**

**理由**:
1. Surface A 已被 L4 覆盖 (Slice 007K / 007L / 007M); A 不需 L5 进一步工作
2. Surface B 比 C 范围更窄: 仅 Hermes 派发的 task 收 preamble
3. Surface C 修改 global default system prompt 且污染所有 task (含非 Hermes); 高 blast radius
4. Surface B 可逐 slice 回滚: 若 preamble 行为异常, 仅移除 preamble step, 不动 system prompt

**Phase 2 (留未来 slice + ADR + 显式批)**: Surface B 稳定后, 可重新评估 Surface C 作为 global optimization, 但需 separate ADR + 显式批。

**不推荐**: 直接改 global default system prompt 作为 first step (高 blast radius, 不可逐 slice 回滚, 污染所有 task)。

## 8. Prompt Snippet Source

- **Snippet 必须来自** `buildKnowledgeAgentContractSnippet` (Slice 007I) 或 `buildKnowledgeHandoffContractSnippet` (Slice 007J)
- **禁止**: inline literal, hardcoded copy, 或 caller-modified copy
- **Source of truth**: Slice 007I / 007J pure helpers; helper 自我校验通过 `assertSnippetShape` (20 required + 5 forbidden)

## 9. Dispatch / Handoff Integration Options

Surface B (task prompt preamble) 与 L4 handoff payload 集成方式:

| Option | 描述 | 备注 |
|--------|------|------|
| B.1: Read envelope from handoff | dispatch prompt assembly 时, 读 `payload.context.contracts.knowledge_reuse` 构造 preamble | 优先, 与 L4 集成 |
| B.2: Re-build envelope at dispatch | dispatch 时独立调 `buildKnowledgeHandoffContractSnippet` | 与 handoff 解耦, 但重复 envelope |
| B.3: 缓存 envelope | 缓存 envelope 在 session 内, 多 task 共享 | 性能优化, 留 future |

**推荐**: **B.1 (Read envelope from handoff)** — 优先与 L4 集成, 不重复 envelope 构造。

## 10. Runtime Safety Gates (10 项)

未来 L5 实施时必过:

1. **snippet source** must come from `buildKnowledgeAgentContractSnippet` (Slice 007I) 或 `buildKnowledgeHandoffContractSnippet` (Slice 007J) — no inline literal
2. **`assertKnowledgeContractNoRuntime`** (Slice 007I) must pass before snippet is attached
3. **`assertKnowledgeHandoffContractNoRuntime`** (Slice 007J) must pass before snippet is attached
4. **snippet envelope** must carry `runtime_flush_allowed=false` 和 `dry_run_only=true` (Phase 1 dry-run only)
5. **snippet** must not contain call expressions: `knowledgeIngest(` / `knowledgeSearch(` / `runPlaybook(` / `triggerCronJob(` / `sendMessage(` / `fetch(`
6. **snippet** must not contain Obsidian / MEMORY / .wolf 路径推荐
7. **snippet** must not contain deceptive-phrase (`已保存` / `写入成功` / `saved successfully` / `will be written after confirm`)
8. **target_agent** must not be `'hermes'` (self-call reserved) unless caller provides explicit override flag, AND even then guarded by `shouldAttachKnowledgeContract` + `caller_explicit_attach`
9. **injection must be visible in a dry-run artifact** (e.g. handoff payload's `context.contracts.knowledge_reuse` envelope) before any real dispatch
10. **snippet length** must be ≤ `max_chars` (default 2048); overflow truncated with `truncated=true` and audit trail

## 11. Target Agent Matrix

| Agent | Surface A (L4) | Surface B (L5 推荐) | Surface C (Phase 2) |
|-------|----------------|---------------------|---------------------|
| `claude_code` | ✅ reached | ✅ recommended | ⏸️ Phase 2 |
| `codex` | ✅ reached | ✅ recommended | ⏸️ Phase 2 |
| `hermes_pro` | ✅ opt-in | opt-in | ⏸️ Phase 2 |
| `hermes` (self-call) | reserved L3 | ❌ false (reserved) | ❌ false |

## 12. Failure Modes (8 类)

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | **snippet missing when expected** | triggers fire but no envelope | fail dispatch; emit dry-run artifact; do not silently send prompt without contract |
| 2 | **snippet attached to ordinary code task** | request_text no save/research keyword AND task_kind ∉ research family AND handoff context no ingest/flush/local+newly | fall back to L4 (no preamble) |
| 3 | **snippet attached to hermes self-call** | target_agent === 'hermes' AND no explicit override | throw; emit dry-run artifact showing rejection |
| 4 | **runtime token leakage** | `assertKnowledgeContractNoRuntime` / `assertKnowledgeHandoffContractNoRuntime` returns hit | throw; abort dispatch; emit dry-run artifact |
| 5 | **overlong snippet** | snippet_text.length > max_chars | truncate + truncated=true + audit trail; do not silently drop truncated portion |
| 6 | **user-visible overpromise wording** | `scanForbiddenFlushUiCopy` returns hit | throw; abort dispatch; emit dry-run artifact |
| 7 | **source fidelity or bucket semantics omitted** | `assertSnippetShape` returns ok=false | throw; abort dispatch; emit dry-run artifact |
| 8 | **dispatch prompt changed without artifact** | injection_observed_in_runtime AND dry_run_artifact NOT updated | throw; abort dispatch; refuse to inject without matching dry-run artifact |

## 13. Rollback Strategy

### 13.1 Feature flag

- **Name**: `KNOWLEDGE_CONTRACT_INJECTION_ENABLED`
- **Default**: `false` (L4 handoff-only is the production default)
- **Scope**: process-wide; can be toggled per task or per workspace

### 13.2 Remove from dispatch prompt (Surface B rollback)

- 从 dispatch prompt assembly 移除 preamble step
- **不动** agent default system prompt
- **不动** HCC handoff builder (L4 行为保留)

### 13.3 Fall back to L4

- Surface B rollback 后, handoff payload's `context.contracts.knowledge_reuse` 仍为 snippet 唯一存在处
- L4 行为完全保留

### 13.4 Preserve no-write

- Rollback **不写真实** `~/.hermes/handoff/packs` / `~/.hermes/audit`
- mtime guard 必保持: `~/.hermes/handoff/packs` mtime 不变 / `~/.hermes/audit` mtime 不变

### 13.5 Keep live flush disabled

- Rollback 后, `runtime_flush_allowed` 仍为 `false`
- `knowledgeIngest` 仍不调
- live search 仍不调

## 14. Test Plan

| Layer | Test | 状态 |
|-------|------|------|
| unit (007I) | `buildKnowledgeAgentContractSnippet` invariants | ✅ Slice 007I |
| unit (007I) | `shouldAttachKnowledgeContract` 5 trigger true + 4 not-attach false | ✅ Slice 007I |
| unit (007J) | `buildKnowledgeHandoffContractSnippet` 13-field envelope | ✅ Slice 007J |
| integration (007L) | dry-run handoff payload carries envelope | ✅ Slice 007L |
| integration (007M) | chain test end-to-end | ✅ Slice 007M |
| design (008A 本 slice) | `tests/knowledge-runtime-default-injection-design.test.ts` | ✅ (本 slice) |
| L5 dry-run (008B) | payload.context.contracts.knowledge_reuse 作为 dispatch prompt preamble 输入 | ⏸️ future |
| L5 runtime (008+) | 真实 injection 跑 | ⏸️ future + 显式批 |

## 15. Go / No-Go Decision

### 15.1 GO

- ✅ **008A design only** (L5 design documented; Surface B recommended; 10 safety gates + 8 failure modes + 5-step rollback defined)

### 15.2 NOT-GO

- ❌ **L5 runtime default injection implementation** (留 future slice + 显式批)
- ❌ **Surface C (global default system prompt) as first step** (高 blast radius, 不可逐 slice 回滚)
- ❌ **Real handoff write** (留 008+)
- ❌ **Live flush** (留 008+)
- ❌ **Live search adapter** (留 008+)
- ❌ **IPC / gateway adapter** (留 008+)
- ❌ **Renderer UI implementation** (留 007H-1+)

## 16. Future Implementation Slices

按依赖顺序:

### 16.1 Slice 008B — Runtime Injection Dry-run Feature Flag Design (推荐下一步, 若用户要 L5)

- 范围: 设计 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` feature flag + 008A Surface B 接入 dry-run harness, **设计 only, 仍 no runtime injection**
- 触发条件: 008A 通过 + 用户**显式批**
- 预计文件:
  - `docs/knowledge/knowledge-runtime-injection-feature-flag-design-2026-06-XX.md` (待批)
  - `src/main/runtime-injection-flag.d.ts` (类型 only, 待批)
  - `tests/knowledge-runtime-injection-feature-flag.test.ts` (待批)
- 预计内容: feature flag / dry-run harness / Surface B 接入 / override 机制 / abort 路径

### 16.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**本 slice
- 必跑 7 项 PR gate (007H § 5)

### 16.3 真实 L5 runtime default injection (留 008+ 显式批)

- 范围: 实施 Surface B task prompt preamble injection
- 触发条件: 008B 通过 + 用户**显式批**
- 必跑 008A 全部 10 safety gates + 8 failure modes + 5-step rollback

### 16.4 Surface C (Phase 2, 留 future ADR + 显式批)

- 范围: 评估 Surface C (global default system prompt fragment) 作为 global optimization
- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- 必跑 separate ADR review

## 17. 链路索引

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
- 007K dry-run fixture: `docs/knowledge/knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md` + 3 handoff-contract fixture
- 007L handoff builder insertion: `docs/knowledge/knowledge-handoff-builder-insertion-dry-run-2026-06-03.md` + 改 `src/main/hcc-handoff-pack.ts`
- 007M chain closeout: `docs/knowledge/knowledge-handoff-builder-chain-closeout-2026-06-04.md` + 35 chain tests
- 007N landing closeout: `docs/knowledge/knowledge-claude-code-default-contract-landing-closeout-2026-06-04.md` + 1 closeout fixture + 69 tests
- **008A (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-default-injection-design.json` + `tests/knowledge-runtime-default-injection-design.test.ts`
- 008B (待批): Runtime injection dry-run feature flag design
- 007H-1 (待批): renderer GateCard implementation
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 18. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
- 改 `payload.executable_steps` / `payload.verificationCommands` / `next_actions[].action` 为 call 形式
- 改 `payload.artifact_ref` 路径
- **接 default system prompt runtime injection (L5)** (留 008B+ 显式批)
- **改 global default system prompt as first step (Surface C)** (高 blast radius, 留 Phase 2 + 显式批)
- **写真实 runtime injection (留 008+ 显式批)**
