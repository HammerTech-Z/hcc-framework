# Hermes Pro — Knowledge Runtime Injection L5 Closeout / No L6 (2026-06-04)

> Slice 008H — L5 Closeout / No L6 / Spec & Test Only
> 范围: closeout doc + closeout fixture + closeout tests;
> **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008G
> 下游: 008I (Real Runtime Dispatch Design, no implementation, IF user 显式批) / 007H-1 (Renderer GateCard, IF user 显式批) / 008 (Real Live Adapter, 另批)

## 1. Purpose

完成 008H: L5 Closeout / No L6。

汇总并锁定 008A-008G 的 L5 dry-run Surface B 成果, 明确:
- L5 dry-run Surface B path is **complete**
- Real runtime dispatch remains **NOT-GO**
- L6 live knowledgeSearch / knowledgeIngest / live flush remains **NOT-GO**
- Surface C default system prompt remains **NOT-GO**

## 2. Non-goals

- ❌ 不实现真实 dispatch / launcher
- ❌ 不改真实 prompt builder 调用链
- ❌ 不改 default system prompt
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
- ❌ **不改 default system prompt runtime** (Surface C 留 Phase 2)
- ❌ **不改 dispatch prompt runtime**
- ❌ **不改 prompt builder**
- ❌ **不改 real handoff writer**
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C / 008F 已定型)

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
| **008H** | **L5 Closeout / No L6 (71 tests, 本 slice)** | **✅ PASS** |

## 4. Layer Status L4 / L5 / L6

| Layer | 描述 | 状态 |
|-------|------|------|
| **L0** | no contract awareness | past |
| **L1** | prompt-contract awareness when manually provided | reached (Slice 005) |
| **L2** | tested dry-run behavior with evaluation prompt | reached (Slice 006.7) |
| **L3** | contract snippet helper available | reached (Slice 007I) |
| **L4** | dry-run handoff payload can carry snippet | ✅ **reached** (Slice 007K/007L/007M) |
| **L5 (dry-run Surface B)** | pure simulation helper + dry-run artifact + surface B dry-run implementation + prompt snapshot tests | ✅ **reached in dry-run form** (Slice 008A-008G) |
| **L5 (real runtime default injection)** | snippet auto-injected into agent default system prompt + handoff write | ❌ **not reached** (留 008+ 显式批) |
| **L5 (real runtime dispatch)** | real Surface B integration in dispatch path | ❌ **not reached** (留 008+ 显式批) |
| **L6 (live knowledgeSearch)** | agent calls `knowledgeSearch()` before answering | ❌ **not reached** (留 separate ADR + 显式批) |
| **L6 (live knowledgeIngest / flush)** | real `knowledgeIngest` flush | ❌ **not reached** (留 separate ADR + 显式批) |

## 5. What is Complete

- ✅ 008A — Runtime Default Injection Design (3 surfaces compared; Surface B recommended; 10 safety gates + 8 failure modes + 5-step rollback)
- ✅ 008B — Feature Flag Dry-run Design (`KNOWLEDGE_CONTRACT_INJECTION_ENABLED`, default false; 11 safety gates + 8 failure modes + 5-step rollback)
- ✅ 008C — Pure Simulation Helper (`buildKnowledgeRuntimeInjectionSimulation` + `assertKnowledgeRuntimeInjectionSimulationNoRuntime`; 32 tests; 4 literal false runtime flags)
- ✅ 008D — Artifact Chain Test (5-stage chain: design → sim → artifact → round-trip → verify; 56 tests; 20+ invariants)
- ✅ 008E — Implementation Readiness Review (8 discovered surfaces; 11 safety gates + 12 stop conditions; 3 touch-allowed / 5 touch-forbidden; 44 tests)
- ✅ 008F — Surface B Dry-run Implementation (`buildTaskPromptWithKnowledgeContractSurfaceB`; 4 functions + 6 字面量 + 4 literal false; 58 tests; 18 invariants)
- ✅ 008G — Prompt Snapshot Tests (8 snapshots + 24 invariants; 49 tests; byte-level behavior locked)
- ✅ 008H — L5 Closeout (本 slice; 71 tests; aggregate rollup)

## 6. What is Not Complete

- ❌ Real runtime default injection into agent prompts (L5 real)
- ❌ Real runtime dispatch integration (L5 real)
- ❌ Real handoff write to `~/.hermes/handoff/packs`
- ❌ Real audit log write to `~/.hermes/audit`
- ❌ Live `knowledgeSearch()` calls
- ❌ Live `knowledgeIngest` / flush
- ❌ IPC adapter (harness / gateway / serve / run / agent / delegate / playbook)
- ❌ Agent subprocess spawn
- ❌ Renderer UI implementation
- ❌ Surface C (default system prompt fragment)
- ❌ Locked roadmap mutation (`docs/roadmap-locked-2026-05-28.md`)
- ❌ Default system prompt mutation
- ❌ Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default

## 7. Surface B Closeout

**Surface B (task_prompt_preamble) — reached in dry-run form**

| Field | Value |
|-------|-------|
| Surface | `task_prompt_preamble` |
| Source helper | `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) |
| Snippet source | `buildKnowledgeAgentContractSnippet` (007I) |
| Preamble format | 4 header lines + 1 blank + 007I 8-line body |
| Separator | `\n\n` (stable) |
| Hash | sha256(wrapped preamble), 64-char hex |
| Base prompt | preserved byte-for-byte |
| Skip case | `final_task_prompt === baseTaskPrompt` |

## 8. Surface C Frozen

**Surface C (default_system_prompt_fragment) — frozen, NOT-GO as first step**

| Field | Value |
|-------|-------|
| Status | **frozen** |
| Phase | 2 (not first step) |
| Rationale | High blast radius (affects ALL tasks including non-Hermes); not slice-reversible; touches locked files (CLAUDE.md / AGENTS.md / Hermes default) |
| Trigger for unfreeze | Surface B stable + separate ADR + 显式批 |

## 9. Feature Flag Final State

| Field | Value |
|-------|-------|
| Name | `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` |
| Default | `false` (must stay false until 008+ 显式批) |
| Scope | Surface B task prompt preamble only |
| Behavior when disabled | no preamble attached; `final_task_prompt === baseTaskPrompt`; fallback L4 |
| Behavior when enabled + no trigger | `skip_reason="no_trigger_fired"`; fallback L4 |
| Behavior when enabled + trigger | preamble attached; `preamble_attached=true`; 4 runtime flags literal `false` |

**Does NOT affect**:
- global default system prompt (Surface C)
- live flush
- knowledgeSearch
- knowledgeIngest
- real handoff write to `~/.hermes/handoff/packs`
- real audit log write to `~/.hermes/audit`
- IPC / gateway / serve / run / agent / delegate / playbook / cron
- HCC Auto Executor
- renderer UI (留 007H-1)

## 10. Target Agent Matrix

| Agent | 008H behavior |
|-------|---------------|
| `claude_code` | default_attach_when_flag_on_and_trigger_fired |
| `codex` | default_attach_when_flag_on_and_trigger_fired |
| `hermes_pro` | opt_in_attach_when_flag_on_and_trigger_fired |
| `hermes` (self-call) | **reserved_skip_by_default**; only_attach_with_hermesOverride_true |

## 11. Invariant Rollup

| Slice | 关键 invariants |
|-------|------------------|
| 008A | 10 safety gates + 8 failure modes + 5-step rollback |
| 008B | 11 feature flag gates + 8 failure modes + 5-step rollback |
| 008C | 4 literal false runtime flags + 32 tests |
| 008D | 20+ artifact invariants + 56 tests |
| 008E | 11 safety gates + 12 stop conditions + 8 discovered surfaces |
| 008F | 18 invariants + 4 literal false runtime flags + 58 tests |
| 008G | 24 prompt snapshot invariants + 8 snapshots + 49 tests |
| **008H** | **rollup of all above + 12 no_go_matrix entries + 4 final decision GO + 9 NOT-GO + 71 tests** |

## 12. Stop Conditions (12 类, 沿用 008E)

1. Discovers need to mutate default system prompt
2. Discovers need for IPC / gateway wiring
3. Discovers need for live handoff writer
4. Ordinary code-only task gets snippet injected
5. Feature flag default != false
6. Hermes self-call gets default injection
7. Base task prompt is overwritten
8. Runtime flags can be forged to true
9. Forbidden copy appears in preamble
10. mtime changes on `~/.hermes/handoff/packs` or `~/.hermes/audit`
11. `knowledgeIngest(` / `knowledgeSearch(` / `fetch(` appears as call expression
12. `executable_steps` / `verificationCommands` / `next_actions` call-form action appears

## 13. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008H 单独
npx vitest run tests/knowledge-runtime-injection-l5-closeout.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/knowledge-runtime-injection-l5-closeout.test.ts \
  tests/fixtures/knowledge-reuse/runtime-injection-l5-closeout.json \
  docs/knowledge/knowledge-runtime-injection-l5-closeout-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 14. Remaining Gaps

008H 不解 (留未来 slice):

- ❌ **L5 真实 runtime default injection** — 留 008+ 显式批
- ❌ **L5 真实 runtime dispatch** — 留 008+ 显式批
- ❌ **L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest** — 留 separate ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1 显式批
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default** — 留 008+ 显式批

## 15. Future Slices

按依赖顺序:

### 15.1 Slice 008I — Real Runtime Dispatch Design (no implementation) — IF user 显式批

- 范围: design only — define Surface B integration point in real dispatch path
- 触发条件: 用户**显式批**
- 必跑 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E + 008F 18 + 008G 24 + 008H rollup invariants

### 15.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 范围: 渲染层 GateCard
- 触发条件: 用户**显式批**本 slice
- 必跑 7 项 PR gate (007H § 5)

### 15.3 Slice 008 — Real Live Adapter (留 008+ 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: 008H 通过 + 用户**显式批**
- 必跑 P2.5 safety foundation + 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E + 008F 18 + 008G 24 + 008H rollup

### 15.4 远期: Surface C (Phase 2, 留 ADR + 显式批)

- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- **不推荐**作为 first step (高 blast radius)

## 16. Final Answer to User: Claude Code Association Status

**问题**: "Claude Code 能和知识库关联了吗？"

**回答** (中文, 详细):

> 是, 已达到 **L5 dry-run Surface B (task prompt preamble)** 层能力 (Slice 008A-008H):
>
> - **L4 reached**: dry-run handoff payload 可携带 knowledge contract snippet (`payload.context.contracts.knowledge_reuse`)
> - **L5 dry-run Surface B reached**: `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) + prompt snapshot tests (008G) 已锁住 8 个 matrix case 的 byte-level preamble 拼接输出
> - Surface A (L4 handoff payload) + Surface B (L5 dry-run preamble) 已完成
>
> 不是, 还没到:
>
> - **L5 真实 runtime default injection** — agent default system prompt 仍需用户手动粘贴或显式触发 (留 008+ 显式批)
> - **L5 真实 runtime dispatch** — prompt builder 未接入 Surface B (留 008+ 显式批)
> - **L6 live search** — agent 仍不调 `knowledgeSearch()` (留 separate ADR + 显式批)
> - **L6 live flush** — 真实 `knowledgeIngest` 仍不执行 (留 separate ADR + 显式批)
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
> 真实写入 / runtime 默认注入 / live flush / live search 仍需另批 (008+ 起步)。

**回答** (英文, 简短):

> Yes, L5 dry-run Surface B (task prompt preamble) reached (008A-008H). No L5 real runtime default injection or L5 real dispatch yet. No L6 live search / live flush. Real handoff write still needs separate approval. Obsidian / MEMORY / .wolf fully resolved in dry-run + contract-snippet layer.

## 17. Frozen Forbidden List (任一未来 slice 也不得触碰, 除非用户在新批)

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
- **接 dispatch prompt runtime injection** (留 008+ 显式批)
- **改 prompt builder** (留 008+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **把 008F final_task_prompt 拼接到真实 dispatcher** (留 008+ 显式批)

## 18. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts` (snippet source)
- 007J: `src/shared/lib/knowledge-handoff-contract.ts`
- 007L: `src/main/hcc-handoff-pack.ts`
- 007M: chain test
- 007N: landing closeout
- 008A: design
- 008B: feature flag design
- 008C: pure simulation helper
- 008D: artifact chain test
- 008E: readiness review
- 008F: Surface B dry-run implementation
- 008G: prompt snapshot tests
- **008H (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-injection-l5-closeout.json` + `tests/knowledge-runtime-injection-l5-closeout.test.ts` (71 tests 跨 15 describe)
- 008I (待批, IF user 显式批): Real Runtime Dispatch Design
- 007H-1 (待批, IF user 显式批): Renderer GateCard
- 008 (待批): Real Live Adapter
