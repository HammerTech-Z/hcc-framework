# Hermes Pro — Knowledge Runtime Dispatch Pause / Observation (2026-06-04)

> Slice 008M — Pause / Observation Pack / No New Capability
> 范围: observation pack doc + fixture + tests;
> **不新增** 能力, **不接** runtime, **不接** L6, **0 src 改动**, **0 fixture 突变**。
> 上游: 004-008L
> 下游: pause 期间无新切片; 恢复分支: 007H-1 (UI 独立) / 008N (L6 design only, 显式批) / 008O (008J+ chain integration, 显式批) / Surface C (Phase 2, 显式批且不推荐 first step)

## 1. Purpose

完成 008M Pause / Observation Pack。

不新增能力, 不接 runtime, 不接 L6。
**只把当前 L4/L5 状态、禁止边界、恢复入口、下一步分支写成观察包**, 方便之后继续。

## 2. Non-goals

- ❌ 不实现新能力
- ❌ 不接 runtime
- ❌ 不接 L6
- ❌ 不修改 src (008J + 008F + 007I 已定型)
- ❌ 不修改 008K / 008L fixture
- ❌ 不启动 Agent 子进程
- ❌ 不接 IPC / gateway / cron / HCC executor
- ❌ 不调 knowledgeIngest / knowledgeSearch
- ❌ 不写真实 `~/.hermes/handoff/packs`
- ❌ 不写真实 `~/.hermes/audit`
- ❌ 不做 live flush
- ❌ 不改 default system prompt (Surface C 留 Phase 2)
- ❌ 不做 Surface C
- ❌ 不做 renderer UI

## 3. Current State Snapshot

| Layer | 状态 |
|-------|------|
| L0-L4 | ✅ reached (Slice 007K/007L/007M) |
| L5 (Surface B dry-run) | ✅ reached in dry-run form (Slice 008A-008G) |
| **L5 (task dispatch prompt builder)** | ✅ **reached** (Slice 008J + 008K; 008J NEW pure file `src/main/task-dispatch-prompt-builder.ts`; behind `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` flag; 4 literal false runtime flags + `no_l6: true` literal) |
| L5 (real agent subprocess) | ❌ not reached |
| L5 (real runtime dispatch invocation) | ❌ not reached (008J+ chain integration 留 008+ 显式批) |
| L5 (real default system prompt injection) | ❌ not reached (Surface C 留 Phase 2) |
| L6 (live search / live ingest / live flush) | ❌ not reached |

**Recommended state**: `pause_observation` (当前状态).

## 4. L5 Main-side Entry Point (唯一)

**File**: `src/main/task-dispatch-prompt-builder.ts`

| Field | Value |
|-------|-------|
| Pattern | NEW pure file (per 008I design) |
| In-place mutation of existing chain | **forbidden** (008I design) |
| Exports | `buildTaskDispatchPrompt` / `shouldApplyKnowledgeContractToDispatchPrompt` / `assertTaskDispatchPromptBuilderNoRuntime` |
| Consumes | `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) |
| Cross-validate | `assertKnowledgeSurfaceBNoRuntime` (008F) via `assertTaskDispatchPromptBuilderNoRuntime` |
| Literal constants | 6 (`SCHEMA_VERSION=1.0.0` / `SLICE=008J` / `MODE=task_dispatch_prompt_builder` / `SURFACE=task_prompt_preamble` / `DEFAULT_MAX_CHARS=2048` / `NO_L6=true`) |
| Literal false runtime flags | 4 (`runtime_flush_allowed` / `runtime_dispatch_allowed` / `real_handoff_write_allowed` / `live_adapter_allowed`) |
| Side effects | none (pure function; no I/O; no IPC; no spawn; no fetch) |

008M is the **only** L5 main-side entry point. No other file in `src/main` is allowed to inject contract snippet into dispatch path.

## 5. Feature Flag Final State

| Field | Value |
|-------|-------|
| Name | `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` |
| Default | **`false`** (must stay false until 008+ 显式批) |
| Scope | Surface B task prompt preamble + 008J task dispatch prompt builder entry point |
| Off | 008J builder returns base task prompt verbatim; no preamble; fallback L4 |
| On + no trigger | skip `no_trigger_fired`; fallback L4 |
| On + trigger + target allowed | preamble attached; `knowledge_contract_attached=true`; 4 runtime flags literal `false`; `no_l6=true` |
| Does NOT affect | default system prompt / live flush / knowledgeSearch / knowledgeIngest / real handoff write / real audit write / IPC / gateway / HCC Auto Executor / Agent subprocess / renderer UI (10 entries) |

## 6. NOT-GO Matrix (12 entries)

| Key | Status |
|-----|--------|
| `real_agent_subprocess` | NOT-GO |
| `real_runtime_dispatch_invocation` | NOT-GO (008J+ chain integration 留 008+ 显式批) |
| `real_handoff_write_to_handoff_packs` | NOT-GO (留 008+ 显式批) |
| `real_audit_log_write_to_audit` | NOT-GO (留 008+ 显式批) |
| `ipc_adapter` | NOT-GO (留 008+ 显式批) |
| `live_knowledge_search` | NOT-GO (L6 留 separate ADR + 显式批) |
| `live_knowledge_ingest` | NOT-GO (L6 留 separate ADR + 显式批) |
| `live_flush` | NOT-GO (L6 留 separate ADR + 显式批) |
| `default_system_prompt_mutation` | NOT-GO (Surface C 留 Phase 2 + separate ADR) |
| `gateway_serve_run_agent_delegate_playbook_cron` | NOT-GO |
| `in_place_mutation_of_existing_dispatch_chain` | NOT-GO (008I NEW file pattern only) |
| `renderer_ui_implementation` | NOT-GO (留 007H-1 显式批) |

## 7. Resume Branches (4)

### 7.1 Slice 007H-1 — Renderer GateCard Implementation (UI 独立线)

- **Scope**: 渲染层 GateCard; 7 PR gates from 007H § 5
- **Trigger**: user explicit approval
- **Depends on**: 008L closeout (no L5 / L6 change)
- **Isolation**: UI 独立线; 不动 L5 main-side entry point

### 7.2 Slice 008N — L6 Live Adapter Design Only (no implementation)

- **Scope**: design real IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback); L6 live search / live flush / knowledgeSearch / knowledgeIngest
- **Trigger**: user explicit approval + separate ADR
- **Depends on**: 008L closeout (L5 task dispatch prompt builder stable)
- **Isolation**: design only; **0 implementation; 0 src change; 0 spawn / 0 IPC / 0 ingest / 0 flush**
- **explicit_not_implementation**: true

### 7.3 Slice 008O — 008J+ Chain Integration (real runtime dispatch invocation)

- **Scope**: wire 008J builder output into existing dispatch chain
- **Trigger**: user explicit approval + separate ADR
- **Depends on**: 008L closeout (L5 task dispatch prompt builder stable)
- **Isolation**: in-place mutation **forbidden** (008I design); only NEW file additions to dispatch chain
- **explicit_not_in_place_mutation**: true

### 7.4 Surface C ADR — Default System Prompt Fragment (Phase 2)

- **Scope**: default system prompt fragment (mutate CLAUDE.md / AGENTS.md / Hermes default)
- **Trigger**: L5 task dispatch prompt builder stable + user explicit approval + separate ADR
- **Depends on**: 008L closeout
- **Isolation**: **not recommended as first step**; high blast radius; touches locked files
- **explicit_not_recommended_as_first_step**: true

## 8. Observation Checklist (8 items)

| # | Item | Check | Expected |
|---|------|-------|----------|
| 1 | `claude_code_asks_obsidian_or_memory_path` | Claude Code / Codex / Hermes Pro 是否仍询问 Obsidian Vault / MEMORY.md / .wolf/cerebrum.md / notes/<topic>.md 路径 | 否 (008J builder preamble 含 007I 'Do not write to MEMORY.md' 等禁止条款) |
| 2 | `no_false_save_claim` | 是否误声称已保存 (已保存 / 写入成功 / saved successfully / will be written after confirm) | 否 (008J builder preamble 排除 5 句 deceptive copy) |
| 3 | `no_source_uri_drift` | source_uri / fetched_at 是否漂移 (007I 强调 verbatim) | no drift (008J builder 是 prepend-only, 不 mutate base task prompt) |
| 4 | `no_ordinary_code_injection` | ordinary code task (fix bug / refactor / rename) 是否被误注入 | 否 (008J builder 0 trigger → skip `no_trigger_fired`, fallback L4) |
| 5 | `feature_flag_default_false` | feature flag `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` 是否保持 default false | 是 (008J output `feature_flag_default_state` literal `false`) |
| 6 | `runtime_flags_all_false` | 4 runtime flags 是否保持 literal `false` | 是 (008J output `runtime_flush_allowed` / `runtime_dispatch_allowed` / `real_handoff_write_allowed` / `live_adapter_allowed` 都为 `false`) |
| 7 | `no_l6_true` | `no_l6` 字段是否保持 `true` literal | 是 (008J output `no_l6` `true` literal) |
| 8 | `mtime_baseline_preserved` | mtime guard baseline 是否保持不变 | 是 (handoff_packs=1780195726 / audit=1780230084 不变) |

## 9. Rollback During Pause

008M is **inherently reversible**:

1. **`no_code_to_revert`**: 008J builder 是 NEW file; 既存在文件 0 修改; 008M is pure observation; 0 src 改动
2. **`feature_flag_off_immediate`**: set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=false` at evaluation point; 008J builder returns base task prompt verbatim; no in-place chain mutation needed
3. **`fall_back_to_L4`**: 008J builder returns base; HCC handoff payload's `payload.context.contracts.knowledge_reuse` still works as data contract; L4 behavior fully preserved

## 10. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008M 单独
npx vitest run tests/knowledge-runtime-dispatch-pause-observation.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/knowledge-runtime-dispatch-pause-observation.test.ts \
  tests/fixtures/knowledge-reuse/runtime-dispatch-pause-observation.json \
  docs/knowledge/knowledge-runtime-dispatch-pause-observation-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 11. Observation Period Best Practices

- 暂停期间仅做 read-only / lightweight 使用 `008J builder` 接口 (例如 `buildTaskDispatchPrompt(input)` 调用)
- 避免 008J+ chain integration (008O 留待批) / L6 live adapter (008N 留待批) / Surface C (留 Phase 2)
- 监控 `~/.hermes/handoff/packs` 和 `~/.hermes/audit` mtime 变化 (mtime guard baseline preserved)
- 监控 `008J builder` 4 runtime flags 仍 literal `false`
- 监控 `008J builder` `no_l6` 仍 `true` literal
- 观察期结束决定 pause / resume 分支 / 升 L6 design

## 12. Remaining Gaps (留未来 slice)

- ❌ **L5 real runtime dispatch invocation** — 008J+ chain integration 留 008+ 显式批
- ❌ **L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest** — 留 separate ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1 显式批
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **In-place mutation of existing dispatch chain** — NEW file only (008I forbidden)
- ❌ **Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default** — 留 008+ 显式批

## 13. Go / No-go (Pause Recommended)

### 13.1 GO (Recommended for current state)

- ✅ **GO** for pause / observation (current state, recommended)
- ✅ **GO** for 007H-1 Renderer GateCard — IF user wants UI
- ✅ **GO** for 008N L6 Live Adapter Design Only — IF user explicitly approves
- ✅ **GO** for 008O 008J+ Chain Integration — IF user explicitly approves
- ✅ **GO** for Surface C ADR — IF L5 stable + user explicitly approves (NOT recommended as first step)

### 13.2 NOT-GO (Pause Period, 留 显式批)

- ❌ **NOT-GO** for any new L5 / L6 implementation in pause period
- ❌ **NOT-GO** for any src modification in pause period
- ❌ **NOT-GO** for any fixture mutation in pause period
- ❌ **NOT-GO** for Agent subprocess / IPC / gateway / cron / HCC executor
- ❌ **NOT-GO** for L6 live adapter implementation (design only 留 008N)
- ❌ **NOT-GO** for Surface C as first step (Phase 2 + separate ADR)

## 14. Frozen Forbidden List (任一未来 slice 也不得触碰, 除非用户在新批)

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

## 15. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts` (transitively consumed)
- 008F: `src/shared/lib/knowledge-runtime-injection-surface-b.ts` (consumed by 008J)
- 008G: prompt snapshot tests
- 008H: `docs/knowledge/knowledge-runtime-injection-l5-closeout-2026-06-04.md`
- 008I: `docs/knowledge/knowledge-runtime-dispatch-injection-design-2026-06-04.md`
- 008J: `src/main/task-dispatch-prompt-builder.ts` (consumed by 008K + 008L + 008M observation)
- 008K: `docs/knowledge/knowledge-task-dispatch-prompt-builder-chain-2026-06-04.md`
- 008L: `docs/knowledge/knowledge-runtime-dispatch-l5-closeout-2026-06-04.md`
- **008M (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-dispatch-pause-observation.json` (12 reviewed_slices + 10 current_state + 9 l5_entry_point fields + 11 feature_flag fields + 12 not_go_matrix + 4 resume_branches + 8 observation_checklist + 3 rollback_during_pause + mtime_baseline + 3 no_*_capability flags) + `tests/knowledge-runtime-dispatch-pause-observation.test.ts` (70 tests 跨 13 describe)
- 007H-1 (待批, IF user 要 UI): Renderer GateCard
- 008N (待批, IF user 显式批): L6 Live Adapter Design Only
- 008O (待批, IF user 显式批): 008J+ Chain Integration
- Surface C (待批, IF L5 stable + user 显式批 + separate ADR): Default System Prompt Fragment
