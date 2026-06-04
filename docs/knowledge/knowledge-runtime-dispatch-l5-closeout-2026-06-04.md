# Hermes Pro — Knowledge Runtime Dispatch L5 Closeout / No L6 (2026-06-04)

> Slice 008L — L5 Runtime Dispatch Closeout / No L6 / Spec & Test Only
> 范围: closeout doc + closeout fixture + closeout tests;
> **不接** runtime, **不启动** Agent 子进程, **不接** IPC / gateway / cron / HCC executor, **不调** knowledgeIngest / knowledgeSearch / fetch, **不写真实** `~/.hermes/handoff/packs` / `~/.hermes/audit`, **不改** default system prompt, **不做** Surface C, **不做** L6, **不做** renderer UI, **不要求** Obsidian Vault / MEMORY.md / .wolf / 任意 notes 路径, **不声称** 已写入知识库, **不做** in-place mutation。
> 上游: 004-008K
> 下游: 008M (Pause / Observation, 推荐) / 007H-1 (Renderer GateCard, IF user 要 UI) / 008 (Real Live Adapter, 另批) / Surface C (Phase 2, 另批)

## 1. Purpose

完成 008L: L5 Runtime Dispatch Closeout / No L6。

汇总并锁定 008A-008K 的所有成果, 明确:
- L5 runtime dispatch prompt builder layer is **complete**
- builder remains pure and behind flag
- no Agent subprocess
- no IPC / gateway
- no L6 live adapter / live search / live ingest / live flush
- no default system prompt mutation
- no real handoff / audit write

## 2. Non-goals

- ❌ 不实现真实 dispatch / launcher
- ❌ 不在现有 chain in-place mutation
- ❌ 不改 default system prompt
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter (L6 留 separate ADR)
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径
- ❌ 不启 dev server / 不跑 Playwright / 不采集截屏
- ❌ 不改 Claude Code runtime binary
- ❌ 不启动 Claude Code / Codex / Hermes 子进程
- ❌ **不改 default system prompt runtime** (Surface C 留 Phase 2)
- ❌ **不改 dispatch prompt runtime** (NEW file only, 008J+ chain integration 留 008+ 显式批)
- ❌ **不改 prompt builder** (NEW file only)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C / 008F / 008J 已定型)

## 3. Reviewed Slices

| Slice | 主题 | 状态 |
|-------|------|------|
| 008A | Runtime Default Injection Design | ✅ PASS |
| 008B | Feature Flag Dry-run Design | ✅ PASS |
| 008C | Pure Simulation Helper (32 tests) | ✅ PASS |
| 008D | Artifact Chain Test (56 tests) | ✅ PASS |
| 008E | Implementation Readiness Review (44 tests) | ✅ PASS |
| 008F | Surface B Dry-run Implementation (58 tests) | ✅ PASS |
| 008G | Prompt Snapshot Tests (49 tests) | ✅ PASS |
| 008H | L5 Closeout (71 tests) | ✅ PASS |
| 008I | Real Runtime Dispatch Design (79 tests) | ✅ PASS |
| 008J | Task Dispatch Prompt Builder (70 tests) | ✅ PASS |
| 008K | Prompt Builder Integration Chain (62 tests) | ✅ PASS |
| **008L** | **L5 Runtime Dispatch Closeout (94 tests, 本 slice)** | **✅ PASS** |

## 4. Layer Status L4 / L5 / L6

| Layer | 描述 | 状态 |
|-------|------|------|
| L0 | no contract awareness | past |
| L1 | prompt-contract awareness when manually provided | reached (Slice 005) |
| L2 | tested dry-run behavior with evaluation prompt | reached (Slice 006.7) |
| L3 | contract snippet helper available | reached (Slice 007I) |
| L4 | dry-run handoff payload can carry snippet | ✅ **reached** (Slice 007K/007L/007M) |
| L5 (dry-run Surface B) | pure simulation helper + dry-run artifact + surface B dry-run implementation + prompt snapshot tests | ✅ **reached in dry-run form** (Slice 008A-008G) |
| **L5 (task dispatch prompt builder)** | NEW pure main-side entry point behind flag, no Agent subprocess, no IPC, no L6 | ✅ **reached** (Slice 008J + 008K) |
| L5 (real agent subprocess) | spawn / child_process / runPlaybook | ❌ **not reached** |
| L5 (real runtime dispatch invocation) | existing chain actually calls 008J | ❌ **not reached** (008J+ chain integration 留 008+ 显式批) |
| L5 (real runtime default injection into default system prompt) | Surface C | ❌ **not reached** (留 Phase 2 + ADR) |
| L6 (live knowledgeSearch) | agent calls `knowledgeSearch()` | ❌ **not reached** (留 separate ADR + 显式批) |
| L6 (live knowledgeIngest) | real `knowledgeIngest` flush | ❌ **not reached** (留 separate ADR + 显式批) |
| L6 (live flush) | real handoff/audit write | ❌ **not reached** (留 separate ADR + 显式批) |

## 5. What is Complete

- ✅ 008A — Runtime Default Injection Design (3 surfaces; Surface B recommended; 10 safety gates + 8 failure modes + 5-step rollback)
- ✅ 008B — Feature Flag Dry-run Design (`KNOWLEDGE_CONTRACT_INJECTION_ENABLED`, default false; 11 safety gates + 8 failure modes + 5-step rollback)
- ✅ 008C — Pure Simulation Helper (32 tests; 4 literal false runtime flags)
- ✅ 008D — Artifact Chain Test (56 tests; 20+ invariants)
- ✅ 008E — Implementation Readiness Review (44 tests; 8 discovered surfaces; 11 safety gates + 12 stop conditions)
- ✅ 008F — Surface B Dry-run Implementation (58 tests; 18 invariants; 4 literal false runtime flags)
- ✅ 008G — Prompt Snapshot Tests (49 tests; 8 snapshots + 24 invariants; byte-level locked)
- ✅ 008H — L5 Closeout (71 tests; rollup of 008A-008G)
- ✅ 008I — Real Runtime Dispatch Design (79 tests; NEW file pattern; 9 pr_gate; 15 stop conditions)
- ✅ 008J — Task Dispatch Prompt Builder (70 tests; NEW file `src/main/task-dispatch-prompt-builder.ts`; 4 literal false runtime flags + `no_l6: true` literal)
- ✅ 008K — Prompt Builder Integration Chain (62 tests; 5-stage chain; 33 invariants; 8 snapshot_links_008g + 8 builder_links_008j)
- ✅ 008L — L5 Runtime Dispatch Closeout (本 slice; 94 tests; aggregate rollup)

## 6. What is Not Complete

- ❌ Real Agent subprocess spawn (spawn / child_process / runPlaybook / sendMessage)
- ❌ Real runtime dispatch invocation (008J+ chain integration 留 008+ 显式批)
- ❌ Real handoff write to `~/.hermes/handoff/packs`
- ❌ Real audit log write to `~/.hermes/audit`
- ❌ Live `knowledgeSearch()` calls
- ❌ Live `knowledgeIngest` / flush
- ❌ IPC adapter (harness / gateway / serve / run / agent / delegate / playbook)
- ❌ Renderer UI implementation
- ❌ Surface C (default system prompt fragment)
- ❌ Locked roadmap mutation (`docs/roadmap-locked-2026-05-28.md`)
- ❌ Default system prompt mutation
- ❌ Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default
- ❌ In-place mutation of existing dispatch chain (NEW file only per 008I design)

## 7. Task Dispatch Prompt Builder Closeout

**File**: `src/main/task-dispatch-prompt-builder.ts`

| Field | Value |
|-------|-------|
| Pattern | NEW pure file (per 008I design) |
| Consumes | `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) |
| Cross-validate | `assertKnowledgeSurfaceBNoRuntime` (008F) via `assertTaskDispatchPromptBuilderNoRuntime` |
| Exports | `buildTaskDispatchPrompt` / `shouldApplyKnowledgeContractToDispatchPrompt` / `assertTaskDispatchPromptBuilderNoRuntime` |
| Literal constants | 6 (`SCHEMA_VERSION` / `SLICE` / `MODE` / `SURFACE` / `DEFAULT_MAX_CHARS` / `NO_L6=true`) |
| Literal false runtime flags | 4 (`runtime_flush_allowed` / `runtime_dispatch_allowed` / `real_handoff_write_allowed` / `live_adapter_allowed`) |
| `no_l6` | true (literal) |
| Side effects | none (pure function; no I/O; no IPC; no spawn; no fetch) |
| In-place mutation | none (NEW file only) |

## 8. Chain Test Closeout

**File**: `tests/safety/task-dispatch-prompt-builder-chain.test.ts`

- 5-stage chain: read_source_fixtures → call_008J_builder → compare_with_008G_snapshot → json_round_trip → no_runtime_invariant_verification
- 008F helper output byte-aligned with 008J builder output (008J delegates to 008F)
- 008J builder output byte-aligned with 008G snapshot semantics (same skip_reason / fallback_to_l4 / preamble when attached / base task prompt preservation)
- 008K chain test cross-validates 008J output against 008F `assertKnowledgeSurfaceBNoRuntime`
- 4 literal false runtime flags preserved across 8 chain examples
- `no_l6: true` literal preserved across 8 chain examples

## 9. Surface B Final State

| Field | Value |
|-------|-------|
| Surface | `task_prompt_preamble` |
| Layer 1 helper | `buildKnowledgeAgentContractSnippet` (007I) |
| Layer 2 helper | `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) |
| Layer 3 entry | `buildTaskDispatchPrompt` (008J, in `src/main/task-dispatch-prompt-builder.ts`) |
| Pattern | 008J NEW pure file consumes 008F consumes 007I |
| Preamble format | 4 header lines + 1 blank + 007I 8-line body |
| Separator | `\n\n` (stable) |
| Hash | sha256(wrapped preamble) |
| Base prompt | preserved byte-for-byte |

## 10. Surface C Frozen

**Surface C (default_system_prompt_fragment) — frozen, NOT-GO as first step**

| Field | Value |
|-------|-------|
| Status | **frozen** |
| Phase | 2 (not first step) |
| Rationale | High blast radius (affects ALL tasks including non-Hermes); not slice-reversible; touches locked files (CLAUDE.md / AGENTS.md / Hermes default) |
| Trigger for unfreeze | L5 task dispatch prompt builder stable + separate ADR + 显式批 |

## 11. Feature Flag Final State

| Field | Value |
|-------|-------|
| Name | `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` |
| Default | `false` (must stay false until 008+ 显式批) |
| Scope | Surface B task prompt preamble + 008J task dispatch prompt builder entry point |
| Does NOT affect | default system prompt / live flush / knowledgeSearch / knowledgeIngest / real handoff write / real audit write / IPC / gateway / HCC Auto Executor / Agent subprocess / renderer UI |
| Behavior when disabled | 008J builder returns base task prompt verbatim; no preamble; fallback L4 |
| Behavior when enabled + no trigger | skip `no_trigger_fired`; fallback L4 |
| Behavior when enabled + trigger + target allowed | preamble attached; `knowledge_contract_attached=true`; 4 runtime flags literal `false`; `no_l6: true` |
| Evaluation point | before the existing dispatch chain sends the prompt to the target agent (008J entry point returns composed string; existing chain consumes) |
| Rollback | set flag false at evaluation point; entry point returns base verbatim; no code revert needed |

## 12. Target Agent Matrix

| Agent | 008L behavior |
|-------|---------------|
| `claude_code` | allowed_behind_flag (Surface B attach when flag+trigger) |
| `codex` | allowed_behind_flag (Surface B attach when flag+trigger) |
| `hermes_pro` | allowed_behind_flag (opt-in pattern preserved) |
| `hermes` (self-call) | **reserved_skip_by_default**; only attach with `hermesOverride=true` (reserved marker text) |

## 13. Invariant Rollup (008A-008K)

| Slice | 关键 invariants |
|-------|------------------|
| 008A | 10 safety gates + 8 failure modes + 5-step rollback |
| 008B | 11 feature flag gates + 8 failure modes + 5-step rollback |
| 008C | 4 literal false runtime flags + 32 tests |
| 008D | 20+ artifact invariants + 56 tests |
| 008E | 11 safety gates + 12 stop conditions + 8 discovered surfaces (3 touch-allowed / 5 touch-forbidden) |
| 008F | 18 invariants + 4 literal false runtime flags + 58 tests |
| 008G | 24 prompt snapshot invariants + 8 snapshots + 49 tests |
| 008H | rollup of 008A-008G + 71 tests |
| 008I | 9 pr_gate + 15 stop conditions + 79 tests |
| 008J | 24 invariants + 4 literal false runtime flags + `no_l6: true` + 70 tests |
| 008K | 33 chain invariants + 5 chain stages + 62 tests |
| **008L** | **rollup of all above + 9 layer_status + 11 no_go_matrix + 5 GO + 10 NOT-GO + 94 tests** |

## 14. Stop Conditions (15 类)

1. Discovers need to mutate default system prompt (CLAUDE.md / AGENTS.md / Hermes default)
2. Discovers need for IPC / gateway / serve / run / agent / delegate / playbook / cron
3. Discovers need for real handoff writer to `~/.hermes/handoff/packs`
4. Discovers need for real audit log writer to `~/.hermes/audit`
5. Ordinary code-only task gets snippet injected
6. Feature flag default != false
7. Hermes self-call gets default injection
8. Base task prompt is overwritten
9. Runtime flags can be forged to true
10. Forbidden copy / deceptive-phrase appears in simulated preamble
11. mtime changes on `~/.hermes/handoff/packs` or `~/.hermes/audit`
12. `knowledgeIngest(` / `knowledgeSearch(` / `fetch(` appears as call expression
13. `executable_steps` / `verificationCommands` / `next_actions` call-form action appears
14. Agent subprocess spawn attempted
15. 008J in-place mutation of existing dispatch chain attempted / Renderer UI mutation attempted

## 15. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008L 单独
npx vitest run tests/knowledge-runtime-dispatch-l5-closeout.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/knowledge-runtime-dispatch-l5-closeout.test.ts \
  tests/fixtures/knowledge-reuse/runtime-dispatch-l5-closeout.json \
  docs/knowledge/knowledge-runtime-dispatch-l5-closeout-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 16. Remaining Gaps

008L 不解 (留未来 slice):

- ❌ **L5 real runtime dispatch invocation** — 008J+ chain integration 留 008+ 显式批
- ❌ **L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest** — 留 separate ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1 显式批
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **In-place mutation of existing dispatch chain** — NEW file only (008I forbidden)
- ❌ **Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default** — 留 008+ 显式批

## 17. Future Slices

按依赖顺序:

### 17.1 Slice 008M — Pause / Observation (推荐, 当前状态推荐)

- 范围: 当前 L5 dry-run + L5 task dispatch prompt builder 已完整, 等待用户对 L6 live / Surface C / in-place chain integration 的显式批
- 触发条件: 当前已满足; 无需新动作
- 价值: 避免非必要推进, 维持 L5 锁定

### 17.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**
- 必跑 7 项 PR gate (007H § 5)

### 17.3 Slice 008 (L6) — Real Live Adapter (留 separate ADR + 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: separate ADR + 用户**显式批**
- 必跑 P2.5 safety foundation + 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E + 008F 18 + 008G 24 + 008H rollup + 008I + 008J 24 + 008K 33 + 008L rollup invariants

### 17.4 远期: Surface C (Phase 2, 留 ADR + 显式批)

- 触发条件: L5 task dispatch prompt builder 稳定 + 单独 ADR + 显式批
- **不推荐**作为 first step (高 blast radius)

## 18. Final Answer to User: Current Association Status

**问题**: "Claude Code / Hermes 现在能 dispatch 任务了吗？"

**回答** (中文, 详细):

> 是, 已达到 **L5 task dispatch prompt builder** 层能力 (Slice 008A-008L):
>
> - **L4 reached**: dry-run handoff payload 可携带 knowledge contract snippet (`payload.context.contracts.knowledge_reuse`)
> - **L5 dry-run Surface B reached**: 008F `buildTaskPromptWithKnowledgeContractSurfaceB` + 008G snapshot tests
> - **L5 task dispatch prompt builder reached**: 008J `buildTaskDispatchPrompt` (NEW pure file `src/main/task-dispatch-prompt-builder.ts`) + 008K chain test 验证 008F → 008J → 008G 字节级对齐
> - 该能力 **behind feature flag** `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` (default false)
> - 4 runtime flags literal `false` (runtime_flush_allowed / runtime_dispatch_allowed / real_handoff_write_allowed / live_adapter_allowed)
> - `no_l6: true` literal
> - Surface A (L4 handoff payload) + Surface B (L5 dry-run + L5 task dispatch prompt builder) 已完成
>
> 不是, 还没到:
>
> - **L5 真实 Agent subprocess** — 仍未启动 spawn / child_process / runPlaybook
> - **L5 真实 runtime dispatch invocation** — 008J builder 返回 string only; 既存 chain consumes; 008J+ chain integration 留 008+ 显式批
> - **L5 真实 runtime default injection into default system prompt** — Surface C 留 Phase 2
> - **L6 live search** — agent 仍不调 `knowledgeSearch()`
> - **L6 live flush** — 真实 `knowledgeIngest` 仍不执行
> - **真实 handoff 写入** — payload 仍仅在内存 / tmpDir, 不写真实 `~/.hermes/handoff/packs`
> - **真实 audit log 写入** — 不写真实 `~/.hermes/audit`
>
> 已解决 (dry-run evaluation 中已 clean PASS):
>
> - 原本问 Obsidian Vault 路径 → 拒
> - 原本写 MEMORY.md / .claude/memory/MEMORY.md / .wolf/cerebrum.md / .wolf/anatomy.md / .wolf/memory.md / notes/<topic>.md / research/<date>.md → 拒
> - 原本发明 arbitrary note 路径 → 拒
> - 原本使用 deceptive-phrase (已保存 / 写入成功 / saved successfully / will be written after confirm) → 拒
> - 原本调 knowledgeIngest / knowledgeSearch / fetch / runPlaybook / triggerCronJob / sendMessage → 拒
>
> 真实写入 / runtime 默认注入 / live flush / live search / Surface C 必须另批 (008+ 起步)。

**回答** (英文, 简短):

> Yes, L5 task dispatch prompt builder layer reached (008A-008L). 008J NEW pure file `src/main/task-dispatch-prompt-builder.ts` is the only main-side entry point; behind `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` flag (default false). 4 literal false runtime flags + `no_l6: true` literal. No L5 real Agent subprocess, no L5 real runtime dispatch invocation, no L5 real default system prompt injection, no L6 live search / live flush / live ingest. Real handoff write + Surface C still needs separate approval. Obsidian / MEMORY / .wolf fully resolved in dry-run + Surface B preamble.

## 19. Frozen Forbidden List (任一未来 slice 也不得触碰, 除非用户在新批)

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
- **接 default system prompt runtime injection (Surface C)** (留 Phase 2 + 显式批)
- **改 global default system prompt as first step** (高 blast radius)
- **接 dispatch prompt runtime injection** (008J+ chain integration 留 008+ 显式批)
- **改 prompt builder** (008J NEW file only)
- **写真实 runtime injection** (008J+ chain integration 留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **把 008J composed prompt 拼接到真实 dispatcher (无 NEW file pattern)** (留 008+ 显式批)
- **In-place mutation of existing dispatch chain** (NEW file only, 008I forbidden)
- **L6 任何** (`no_l6: true` literal in 008J output) (留 separate ADR + 显式批)

## 20. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts` (snippet source, transitively consumed)
- 008F: `src/shared/lib/knowledge-runtime-injection-surface-b.ts` (consumed by 008J, transitively by 008L)
- 008G: prompt snapshot tests
- 008H: `docs/knowledge/knowledge-runtime-injection-l5-closeout-2026-06-04.md`
- 008I: `docs/knowledge/knowledge-runtime-dispatch-injection-design-2026-06-04.md`
- 008J: `src/main/task-dispatch-prompt-builder.ts` (consumed by 008K + 008L)
- 008K: `tests/safety/task-dispatch-prompt-builder-chain.test.ts` (consumed by 008L)
- **008L (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-dispatch-l5-closeout.json` (11 reviewed_slices + 9 layer_status + 11 invariant_rollup + 3 surface_matrix + 4 target_agent_matrix + 12 no_go_matrix + 4 future_slices + 5 GO + 10 NOT-GO) + `tests/knowledge-runtime-dispatch-l5-closeout.test.ts` (94 tests 跨 17 describe)
- 008M (推荐, 当前状态): Pause / Observation
- 007H-1 (待批, IF user 要 UI): Renderer GateCard
- 008 (待批, separate ADR): Real Live Adapter
- Surface C (待批, Phase 2): Default System Prompt Fragment
