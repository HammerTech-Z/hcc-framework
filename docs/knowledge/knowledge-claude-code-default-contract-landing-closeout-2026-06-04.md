# Hermes Pro — Claude Code Default Contract Landing Closeout (2026-06-04)

> Slice 007N — Claude Code Default Contract Landing Closeout / Spec Only
> 范围: closeout 文档 + tests + closeout fixture JSON; **不接** runtime, **不写真实** handoff 写入, **不启动** Claude Code / Codex / Hermes 子进程, **不改** Claude Code runtime, **不接** default system prompt runtime injection。
> 上游: 004-007M
> 下游: 008A (runtime default injection design only) / 007H-1 (renderer GateCard implementation, 若用户批 UI 实装) / 008 (real live adapter, 另批)

## 1. Purpose

做 Claude Code Default Contract Landing 的 closeout 审查。明确当前已经达到的**关联等级** (L0-L6) 和未达到的边界, 输出 GO/NO-GO 决策和后续 implementation slice 要求。

本 slice 是 closeout only, **不接** runtime, **不接** default system prompt runtime injection, **不写真实** handoff。

## 2. Non-goals

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
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ **不接 default system prompt runtime injection** (L5 不在 007N 范围)
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime builder (007L 已定型)

## 3. Evidence reviewed

本 slice 复审 6 上游 slice 证据:

| Slice | 证据 | 关键产出 |
|-------|------|----------|
| 006.7 | `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` + `tests/fixtures/knowledge-reuse/tri-agent-evaluation-input.json` | 三端 (Claude Code / Codex / Hermes) 在 dry-run 评估中 clean PASS, 4 栏回答 shape 验证 |
| 007I | `docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md` + `src/shared/lib/knowledge-agent-contract-snippet.ts` | snippet helper (3 纯函数) + 5 trigger attach 判断 |
| 007J | `docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md` + `src/shared/lib/knowledge-handoff-contract.ts` | `KnowledgeHandoffContractSnippet` schema (13 字段, 4 字面量) + placement `context.contracts.knowledge_reuse` |
| 007K | `docs/knowledge/knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md` + 3 fixture | 3 golden handoff fixture (claude_code / codex / hermes-reserved) |
| 007L | `docs/knowledge/knowledge-handoff-builder-insertion-dry-run-2026-06-03.md` + `src/main/hcc-handoff-pack.ts` | builder 接入 snippet, 36 tests + mtime guard |
| 007M | `docs/knowledge/knowledge-handoff-builder-chain-closeout-2026-06-04.md` + `tests/safety/hcc-handoff-knowledge-contract-chain.test.ts` | 35 chain tests + 12 invariants + tmpDir write/read + mtime guard |

## 4. Landing levels (L0-L6, 7 层)

| Level | 名称 | 描述 | 状态 |
|-------|------|------|------|
| **L0** | no contract awareness | Agent 不知道 Hermes Knowledge Reuse 契约; 默认问 Obsidian vault / 写 MEMORY.md / 发明任意 note 路径 | 历史默认值, 已跨越 |
| **L1** | prompt-contract awareness when manually provided | 用户手动粘贴 snippet 到 prompt 时, agent 遵守; 无 helper, 无自动 attach | 已达到 (Slice 005 验证) |
| **L2** | tested dry-run behavior with evaluation prompt | tri-agent evaluation pack (Slice 006.7) 测试, 4 栏 shape 持续生效 | **已达到** (Slice 006.7) |
| **L3** | contract snippet helper available | 纯 helper (`buildKnowledgeAgentContractSnippet`) 产出 8 条 contract, `shouldAttachKnowledgeContract` 决策 attach | **已达到** (Slice 007I) |
| **L4** | dry-run handoff payload can carry snippet | HCC dry-run builder 接入 snippet 到 `payload.context.contracts.knowledge_reuse`; read-only contract data, 无 executable payload | **已达到** (Slice 007K / 007L / 007M) |
| **L5** | real runtime default injection / real handoff write | snippet 自动注入到 agent default system prompt + handoff 写真实到 `~/.hermes/handoff/packs` | ❌ **未达到** (待 Slice 008A 显式批) |
| **L6** | live knowledge search / live flush | agent 调 `knowledgeSearch()` + 真实 `knowledgeIngest` flush | ❌ **未达到** (待 Slice 008+ 显式批) |

## 5. Current status by level

| Level | Claude Code | Codex | hermes_pro | hermes (self-call) |
|-------|-------------|-------|------------|---------------------|
| L0 | ✅ past | ✅ past | ✅ past | ✅ past |
| L1 | ✅ | ✅ | ✅ | ✅ |
| L2 | ✅ | ✅ | ✅ | ✅ |
| L3 | ✅ | ✅ | ✅ | ✅ (helper available) |
| **L4** | **✅ reached** | **✅ reached** | **✅ opt-in reached** | **reserved / no default attach** |
| L5 | ❌ not reached | ❌ not reached | ❌ not reached | ❌ not reached |
| L6 | ❌ not reached | ❌ not reached | ❌ not reached | ❌ not reached |

## 6. Claude Code status (L4 reached)

- **Reached level**: L4
- **Evidence refs**: Slice 006.7 / 007I / 007J / 007K / 007L / 007M
- **Snippet attached**: ✅ (8-line contract)
- **Snippet content**:
  - L1: Hermes Pro internal knowledge store; do not ask for Obsidian Vault path
  - L2: Do not write to MEMORY.md / .wolf/cerebrum.md / arbitrary note paths
  - L3: Do not use deceptive-phrase patterns; no write has happened
  - L4: 4-section answer (local_known / newly_found / judgment / ingest_draft)
  - L5: source_uri / fetched_at verbatim; vault only for vault://
  - L6: Bucket semantics; local_plan → local_known, github/web → newly_found
  - L7: Confirmation only makes eligible; runtime_flush_allowed = false
  - L8: Do not call knowledgeIngest / knowledgeSearch / fetch / runPlaybook / etc.
- **Behavior in dry-run**: 接受 snippet, 输出 4 栏, 拒 Obsidian / MEMORY / .wolf 路径, 拒调 knowledgeIngest 或任何 runtime token

## 7. Codex status (L4 reached)

- **Reached level**: L4
- **Evidence refs**: Slice 006.7 / 007J / 007K / 007L / 007M
- **Snippet attached**: ✅ (8-line contract, 同 Claude Code, target-adjusted 但核心 rules 保留)
- **Behavior in dry-run**: 同 Claude Code

## 8. Hermes / hermes_pro status

### 8.1 hermes_pro (L4 opt-in)

- **Reached level**: L4 opt-in (caller 显式 attach 时才 emit)
- **Evidence refs**: Slice 007J / 007L / 007M
- **Snippet attached when**: caller 显式提供 `targetAgent: "hermes_pro"` + attach_context
- **Behavior in dry-run**: 完整 8-line contract, 行为同 Claude Code / Codex

### 8.2 hermes (self-call, reserved)

- **Reached level**: L3 (reserved, helper available)
- **Reserved**: true
- **Evidence refs**: Slice 007J § 7.2 / 007K (hermes fixture) / 007L (hermes reserved marker logic) / 007M (hermes reserved semantics)
- **Envelope shape**: `context.contracts.knowledge_reuse` envelope 仍存在, 但 `snippet_text = "[reserved — no default attach for hermes self-call]"`, `attach_reason = "hermes-reserved-no-default-attach"`, `trigger_flags` 全部 false
- **Behavior in dry-run**: Builder emit reserved envelope, 不附 8-line contract, 避免 self-call 递归

## 9. What is still not connected

| Item | 状态 | 下一 slice |
|------|------|------------|
| Real handoff write to `~/.hermes/handoff/packs` | ❌ not connected | Slice 008+ 显式批 |
| Default system prompt runtime injection into Claude Code / Codex / Hermes Pro | ❌ not connected | Slice 008A 显式批 |
| Live `knowledgeSearch()` before answering | ❌ not connected | Slice 008+ |
| Live `knowledgeIngest` / flush | ❌ not connected | Slice 008+ |
| IPC / gateway adapter | ❌ not connected | Slice 008A |
| Renderer UI implementation (007H-1 ~ 007H-9) | ❌ not connected | 用户批 UI 实装 |
| HCC Auto Executor | ❌ not connected | 待用户显式批 |
| WeChat / iLink delivery | ❌ not connected | 待独立 ticket |
| Cron-driven real execution | ❌ not connected | 待独立 ticket |
| Locked roadmap mutation | ❌ frozen | 永不 |

## 10. Safety boundaries (mtime guard 验证)

```
before 007L tests:  ~/.hermes/handoff/packs mtime=1780195726
                     ~/.hermes/audit       mtime=1780230084
after  007L tests:   ~/.hermes/handoff/packs mtime=1780195726  ✓ unchanged
                     ~/.hermes/audit       mtime=1780230084  ✓ unchanged
after  007M tests:   ~/.hermes/handoff/packs mtime=1780195726  ✓ unchanged
                     ~/.hermes/audit       mtime=1780230084  ✓ unchanged
```

**结果**: 真实目录 mtime **完全不变**, 证明 L0-L4 全部为 dry-run / pure 状态, 无任何真实写入。

## 11. GO / NO-GO decision

### 11.1 GO

- ✅ **dry-run handoff contract landing can be considered closed for L0-L4**

### 11.2 NOT-GO

- ❌ **runtime default injection** (L5) — 待 Slice 008A 显式批
- ❌ **real handoff write** (L5) — 待 Slice 008+ 显式批
- ❌ **live flush** (L6) — 待 Slice 008+ 显式批
- ❌ **live search adapter** (L6) — 待 Slice 008+ 显式批
- ❌ **IPC / gateway adapter** (L5) — 待 Slice 008A
- ❌ **renderer UI implementation** — 用户显式批 + Slice 007H-1 显式批

## 12. Future implementation slices

按依赖顺序:

### 12.1 Slice 008A — Runtime Default Injection Design (no runtime) (推荐下一步, 若用户要 L5)

- 范围: 设计 default system prompt runtime injection, 含 hook point / override 机制 / fallback 链, **设计 only, 仍 no runtime injection**
- 触发条件: 007N 通过 + 用户**显式批**
- 预计文件:
  - `docs/knowledge/knowledge-runtime-default-injection-design-2026-06-XX.md` (待批)
  - `src/main/runtime-default-injection.d.ts` (类型 only, 待批)
  - `tests/knowledge-runtime-default-injection.test.ts` (待批)
- 预计内容: Claude Code / Codex / Hermes Pro 三端 system prompt 段 / fallback 链 / override 机制 / forbidden copy scanner gate

### 12.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**本 slice
- 必跑 7 项 PR gate (007H § 5)

### 12.3 真实 handoff 写盘 (留 008+ 显式批)

- 范围: 改 `src/main/hcc-handoff-pack.ts` 写真实 `~/.hermes/handoff/packs`
- 触发条件: 007N + 008A + 用户**显式批**
- 必跑 007L 全部 verifier expectations + 007M chain test + mtime guard

### 12.4 真实 live adapter (留 008+ 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: 用户**显式批**
- 必跑 P2.5 safety foundation (builder/verifier separation / 8 invariant)

## 13. Final answer to user question

**问题**: "Claude Code 能和知识库关联了吗？"

**回答** (中文, 详细):

> 是, 已达到 dry-run handoff contract 层关联 (L4):
>
> - Claude Code / Codex 在 dry-run handoff payload 中可携带 knowledge contract snippet
> - snippet 含 8 条契约 (不写 Obsidian / MEMORY / .wolf, 4 栏回答, source_uri verbatim, bucket semantics, runtime_flush_allowed = false, 不调 knowledgeIngest / knowledgeSearch / fetch / runPlaybook 等)
> - hermes self-call: reserved, no default attach (避免递归)
> - hermes_pro: L4 opt-in (caller 显式 attach 时 emit)
>
> 不是, 还没到:
>
> - runtime 默认注入 (L5) — agent default system prompt 仍需用户手动粘贴
> - live search (L6) — agent 仍不调 `knowledgeSearch()`
> - live flush (L6) — 真实 `knowledgeIngest` 仍不执行
> - real handoff write — payload 仍仅在内存 / tmpDir, 不写真实 `~/.hermes/handoff/packs`
>
> 已解决 (dry-run evaluation 中已 clean PASS):
>
> - 原本问 Obsidian Vault 路径 → 拒
> - 原本写 MEMORY.md → 拒
> - 原本写 .wolf/cerebrum.md → 拒
> - 原本发明 arbitrary note 路径 → 拒
>
> 真实写入 / runtime 默认注入 / live flush 仍需另批 (008A 起步)。

**回答** (英文, 简短):

> Yes, dry-run handoff contract landing at L4. No L5 (runtime default injection) or L6 (live search / flush) yet. Obsidian / MEMORY / .wolf fully resolved in dry-run. Real handoff write still needs separate approval.

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
- 007J handoff insertion: `docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md` + `src/shared/lib/knowledge-handoff-contract.ts`
- 007K dry-run fixture: `docs/knowledge/knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md` + 3 handoff-contract fixture
- 007L handoff builder insertion: `docs/knowledge/knowledge-handoff-builder-insertion-dry-run-2026-06-03.md` + 改 `src/main/hcc-handoff-pack.ts`
- 007M chain closeout: `docs/knowledge/knowledge-handoff-builder-chain-closeout-2026-06-04.md` + 35 chain tests
- **007N (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/claude-code-contract-landing-closeout.json` + `tests/knowledge-claude-code-contract-landing-closeout.test.ts`
- 008A (待批): runtime default injection design (无 runtime)
- 007H-1 (待批): renderer GateCard implementation
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
- 启动 Claude Code / Codex / Hermes 子进程
- 改 `payload.executable_steps` / `payload.verificationCommands` / `next_actions[].action` 为 call 形式
- 改 `payload.artifact_ref` 路径
- 接 default system prompt runtime injection (留 Slice 008A 显式批)
