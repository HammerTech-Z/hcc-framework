# Hermes Pro — Knowledge Runtime Injection Feature Flag Dry-run Design (2026-06-04)

> Slice 008B — Runtime Injection Dry-run Feature Flag Design / No Runtime
> 范围: design doc + tests + design fixture JSON; **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程。
> 上游: 004-008A
> 下游: 008C (Runtime injection pure simulation helper, 仍 no runtime) / 007H-1 (renderer GateCard implementation, 若用户批 UI 实装) / 008 (real live adapter, 另批)

## 1. Purpose

设计 L5 的 feature flag + dry-run harness。定义未来如何用 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` 控制 Surface B task prompt preamble 注入, 并在 dry-run artifact 中可见。

当前状态 (008A closeout):
- L0-L4 ✅ reached (dry-run handoff contract layer)
- L5 (runtime default injection) ❌ not reached
- L6 (live search / live flush) ❌ not reached

本 slice 是 **design only**, 不实现 L5 runtime, 不接 Surface B, 不改 prompt builder, 不写真实 handoff。

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
- ❌ **不改 default system prompt runtime** (留 008C+ 显式批)
- ❌ **不改 dispatch prompt runtime** (留 008C+ 显式批)
- ❌ **不改 prompt builder** (留 008C+ 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L 已定型)

## 3. Feature Flag Definition

| Field | Value |
|-------|-------|
| **Name** | `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` |
| **Default** | `false` |
| **Scope** | task dispatch / task prompt preamble only (Surface B from Slice 008A) |
| **Does NOT affect** | global default system prompt, live flush, knowledgeSearch, knowledgeIngest, IPC / gateway / handoff write (all still 留 008+ 显式批) |
| **Evaluated when** | before runtime dispatch in future implementation slice |
| **Visible in dry-run artifact** | required |

**生产默认**: L4 handoff-only (Slice 007L / 007M / 007N baseline)。

## 4. Default State

- **flag_value**: `false`
- **behavior_when_disabled**: 不附 Surface B preamble; dispatch prompt 不变; L4 handoff-only 行为保留
- **production_default**: L4 handoff-only (无 Surface B 注入, 无 global default system prompt 修改)

## 5. Surface B Task Prompt Preamble (Definition)

- **Snippet source options**:
  - `buildKnowledgeAgentContractSnippet` (Slice 007I) — 8 条 contract
  - `buildKnowledgeHandoffContractSnippet` (Slice 007J) — 13 字段 envelope
- **Placement**: before task-specific instructions, after safety boundary section
- **max_chars**: 2048 (default)
- **truncation**: `snippet_text.length > 2048` → truncate + `truncated=true` + audit trail
- **Target agent restrictions**:
  - `claude_code`: default_inject = true
  - `codex`: default_inject = true
  - `hermes_pro`: opt-in (caller explicit attach)
  - `hermes` (self-call): skip unless explicit override flag
- **skip_when**:
  - ordinary code-only task (refactor / bug fix / test addition) without knowledge save intent
  - simple chat / greeting
  - purely local file operation
  - hermes self-call (reserved; no default attach even with all triggers firing)
- **attach_when**:
  - user request contains save / persist / ingest / archive keyword (zh or en)
  - user request contains research / compare / analyze keyword
  - task_kind ∈ {`github_research`, `tool_comparison`, `technical_selection`, `project_research`, `general_research`}
  - handoff context has `ingest_draft` or `flush_pending: true`
  - handoff context has both `local_known` + `newly_found`

## 6. Dry-run Harness Behavior (Pure, No Runtime)

- **no_real_dispatch**: ✅
- **no_agent_subprocess**: ✅
- **no_prompt_builder_mutation**: ✅
- **constructs_simulated_dispatch_prompt**: ✅ (in memory, never persisted to real builder)
- **writes_only_to_test_fixture_or_future_artifact**: ✅ (no real handoff)
- **Recorded fields** (8 项):
  1. `feature_flag`: `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` (boolean)
  2. `target_agent`: `claude_code | codex | hermes_pro | hermes`
  3. `trigger_flags`: 6 booleans (per Slice 007J / 008A)
  4. `snippet_attached`: boolean
  5. `snippet_hash_or_content_hash`: string (sha256 or similar)
  6. `max_chars`: number (default 2048)
  7. `safety_gate_result`: `pass | fail with reason`
  8. `fallback_to_l4`: boolean

## 7. Artifact Visibility Requirements

未来 dry-run artifact 必满足 7 项:

1. **must show whether snippet was attached**: future artifact records `snippet_attached: boolean`; future artifact must surface this field
2. **if skipped must show skip reason**: future artifact records `skip_reason: string` (e.g. "flag_disabled" / "no_trigger_fired" / "hermes_self_call_reserved" / "snippet_overlong_truncated")
3. **if blocked must show failure code**: future artifact records `failure_code: string` (e.g. "flag_enabled_for_wrong_task" / "target_agent_blocked" / "runtime_token_detected" / "prompt_overpromise_detected" / "fallback_to_l4_failed")
4. **must not contain runtime call instructions**: artifact description / payload 永不显 `knowledgeIngest(` / `runPlaybook(` / `triggerCronJob(` / `sendMessage(` 等 call 形式
5. **must keep runtime_flush_allowed=false**: snippet envelope 字面量 `runtime_flush_allowed: false`; artifact 必显
6. **must keep live flush disabled**: artifact records `live_flush_disabled: true`; never calls `knowledgeIngest`
7. **must keep dry_run_only=true in dry-run phase**: snippet envelope 字面量 `dry_run_only: true`; 切到 production phase 时改 false

## 8. Safety Gates (11 项)

未来 L5 实施时必过:

1. feature flag `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` must be evaluated before dispatch
2. snippet source must come from `buildKnowledgeAgentContractSnippet` (007I) 或 `buildKnowledgeHandoffContractSnippet` (007J) — no inline literal
3. `assertKnowledgeContractNoRuntime` (007I) must pass before snippet is attached
4. `assertKnowledgeHandoffContractNoRuntime` (007J) must pass before snippet is attached
5. snippet envelope must carry `runtime_flush_allowed=false` + `dry_run_only=true` (during dry-run phase)
6. snippet must not contain call expressions: `knowledgeIngest(` / `knowledgeSearch(` / `runPlaybook(` / `triggerCronJob(` / `sendMessage(` / `fetch(`
7. snippet must not contain Obsidian / MEMORY / .wolf 路径推荐
8. snippet must not contain deceptive-phrase (`已保存` / `写入成功` / `saved successfully` / `will be written after confirm`)
9. target_agent must not be `'hermes'` (self-call reserved) unless caller provides explicit override flag
10. snippet length must be ≤ `max_chars` (default 2048); overflow truncated with `truncated=true` + audit trail
11. injection must be visible in dry-run artifact before any real dispatch (Slice 008B does not implement dispatch; this is a future invariant)

## 9. Failure Modes (8 类)

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | **flag_enabled_for_wrong_task** | `shouldAttachKnowledgeContract` returns false AND flag is true | fall back to L4 (no preamble); do not inject; emit dry-run artifact showing flag=true but skipped |
| 2 | **flag_disabled_but_expected** | flag is false AND `shouldAttachKnowledgeContract` returns true | respect flag; do not inject; emit dry-run artifact showing flag=false and skipped reason; surface as config alert (not error) |
| 3 | **snippet_missing** | triggers fire but no envelope (helper throws) | fall back to L4 (no preamble); emit dry-run artifact |
| 4 | **snippet_overlong** | `snippet_text.length > max_chars` | truncate + `truncated=true` + audit trail |
| 5 | **target_agent_blocked** | `target_agent === 'hermes'` AND `override !== true` | skip injection; emit dry-run artifact showing `target_agent_blocked` and reason='hermes self-call reserved' |
| 6 | **runtime_token_detected** | `assertKnowledgeContractNoRuntime` / `assertKnowledgeHandoffContractNoRuntime` returns hit | abort injection; emit dry-run artifact showing offending token; refuse to dispatch |
| 7 | **prompt_overpromise_detected** | `scanForbiddenFlushUiCopy` returns hit | abort injection; emit dry-run artifact showing offending copy |
| 8 | **fallback_to_l4_failed** | L4 fallback fails (handoff builder unavailable, envelope missing) | abort injection; emit dry-run artifact; refuse to dispatch with no contract at all |

## 10. Rollback Strategy (5 步)

### 10.1 Set flag false

- Set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` to false at the dispatch boundary
- 0 code path remains for Surface B preamble

### 10.2 Remove Surface B preamble

- 从 dispatch prompt assembly 移除 preamble step
- L4 行为完全保留 (handoff payload's `context.contracts.knowledge_reuse` 仍为 snippet 唯一存在处)

### 10.3 Use L4 handoff-only

- Rollback 后, 生产默认变 L4 handoff-only
- 无 Surface B 注入, 无 global default system prompt 修改

### 10.4 Keep live flush disabled

- Rollback 后, `runtime_flush_allowed` 仍为 `false`
- `knowledgeIngest` 仍不调
- live search 仍不调
- 无 real handoff write

### 10.5 Preserve no-write

- Rollback **不写真实** `~/.hermes/handoff/packs` / `~/.hermes/audit`
- mtime guard 必保持: `~/.hermes/handoff/packs` mtime=1780195726 (不变) / `~/.hermes/audit` mtime=1780230084 (不变)

## 11. Test Plan

| Layer | Test | 状态 |
|-------|------|------|
| unit (007I) | `buildKnowledgeAgentContractSnippet` invariants | ✅ Slice 007I |
| unit (007I) | `shouldAttachKnowledgeContract` 5 trigger true + 4 not-attach false | ✅ Slice 007I |
| unit (007J) | `buildKnowledgeHandoffContractSnippet` 13-field envelope | ✅ Slice 007J |
| integration (007L) | dry-run handoff payload carries envelope | ✅ Slice 007L |
| integration (007M) | chain test end-to-end | ✅ Slice 007M |
| design (008A) | 3 surfaces compared + Surface B recommended | ✅ Slice 008A |
| **design (008B 本 slice)** | feature flag + dry-run harness + artifact visibility + 8 failure modes + 5-step rollback | ✅ (本 slice) |
| L5 dry-run simulation (008C future) | pure simulation helper that records dry-run artifact fields without any real dispatch | ⏸️ future |
| L5 runtime injection (008+ future) | 真实 injection 跑 | ⏸️ future + 显式批 |

## 12. Go / No-Go Decision

### 12.1 GO

- ✅ **008B design only** (feature flag defined; dry-run harness behavior recorded; artifact visibility defined; 11 safety gates + 8 failure modes + 5-step rollback defined)

### 12.2 NOT-GO

- ❌ **L5 runtime default injection implementation** (留 008C+ 显式批)
- ❌ **dispatch prompt mutation in this slice** (本 slice 是 design only)
- ❌ **prompt builder modification** (留 008C+ 显式批)
- ❌ **real handoff write** (留 008+)
- ❌ **live flush** (留 008+)
- ❌ **live search adapter** (留 008+)
- ❌ **IPC / gateway adapter** (留 008+)
- ❌ **renderer UI implementation** (留 007H-1+)

## 13. Future Implementation Slices

按依赖顺序:

### 13.1 Slice 008C — Runtime Injection Pure Simulation Helper (推荐下一步, 若用户要 L5)

- 范围: 写 pure simulation helper (e.g. `src/shared/lib/knowledge-injection-simulation.ts`), 模拟 Surface B preamble assembly + dry-run artifact 构造, **0 runtime, 0 dispatch**, 仅 in-memory dry-run
- 触发条件: 008B 通过 + 用户**显式批**
- 预计文件:
  - `src/shared/lib/knowledge-injection-simulation.ts` (pure helper, 待批)
  - `tests/knowledge-injection-simulation.test.ts` (待批)
  - `tests/fixtures/knowledge-reuse/runtime-injection-simulation-cases.json` (待批)
- 预计内容: buildSimulatedDispatch / recordDryRunArtifact / 8 recorded fields / 11 safety gates

### 13.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**本 slice
- 必跑 7 项 PR gate (007H § 5)

### 13.3 真实 L5 runtime default injection (留 008+ 显式批)

- 范围: 实施 Surface B task prompt preamble injection
- 触发条件: 008C 通过 + 用户**显式批**
- 必跑 008B 全部 11 safety gates + 8 failure modes + 5-step rollback

### 13.4 Surface C (Phase 2, 留 future ADR + 显式批)

- 范围: 评估 Surface C (global default system prompt fragment) 作为 global optimization
- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- 必跑 separate ADR review

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
- 007N landing closeout: `docs/knowledge/knowledge-claude-code-default-contract-landing-closeout-2026-06-04.md` + 1 closeout fixture + 69 tests
- 008A runtime default injection design: `docs/knowledge/knowledge-runtime-default-injection-design-2026-06-04.md` + 1 design fixture + 71 tests
- **008B (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json` + `tests/knowledge-runtime-injection-feature-flag-design.test.ts`
- 008C (待批): Runtime injection pure simulation helper
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
- **接 default system prompt runtime injection (Surface C)** (留 008+ 显式批)
- **改 global default system prompt as first step** (高 blast radius, 留 Phase 2 + 显式批)
- **接 dispatch prompt runtime injection** (留 008C+ 显式批)
- **改 prompt builder** (留 008C+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008C+ 显式批)
