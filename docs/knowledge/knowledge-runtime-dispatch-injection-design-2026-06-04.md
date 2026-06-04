# Hermes Pro — Knowledge Runtime Dispatch Injection Design (2026-06-04)

> Slice 008I — Real Runtime Dispatch Design / No Implementation
> 范围: design doc + design fixture + design tests;
> **不接** runtime, **不改** default system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008H
> 下游: 008J (Real Runtime Dispatch Implementation, IF user 显式批) / 007H-1 (Renderer GateCard, IF user 要 UI) / 008 (Real Live Adapter, 另批)

## 1. Purpose

完成 008I: Real Runtime Dispatch Design / No Implementation。

只做真实 runtime dispatch 接入设计, **不做任何实装**。输出未来 008J 若要实装时的:
- exact dispatch surface
- allowed files
- forbidden files
- feature flag gate
- trigger gate
- target agent gate
- rollback plan
- PR gate
- stop conditions

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
- ❌ **不改 prompt builder** (留 008J+ 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C / 008F 已定型)

## 3. Current L5 dry-run status

| Layer | 状态 |
|-------|------|
| L0-L4 | ✅ reached (Slice 007K/007L/007M) |
| L5 (Surface B dry-run) | ✅ reached in dry-run form (Slice 008A-008G) |
| L5 (real runtime default injection) | ❌ not reached |
| L5 (real runtime dispatch) | ❌ not reached (008I 设计) |
| L6 (live knowledgeSearch / knowledgeIngest / flush) | ❌ not reached |

008I 是 008H closeout 之后的下一步: 设计真实 dispatch 接入, 但 **0 implementation**。

## 4. Code Discovery Summary (6 surfaces)

| ID | Path | future_touch | risk |
|----|------|--------------|------|
| `surface_b_task_prompt_preamble` | `src/shared/lib/knowledge-runtime-injection-surface-b.ts` | consume_only | low |
| `surface_b_chain_consumer` | NEW file (e.g. `src/main/task-dispatch-prompt-builder.ts`) | new_file_only | medium |
| `existing_task_prompt_builder_chain` | 不存在独立文件; 008J 必须先 identify the actual chain before wiring | do_not_modify | medium |
| `default_system_prompt_fragment` | 不存在 mutation | **forbidden** | high |
| `ipc_gateway_live_adapter` | 不存在; renderer-bound preload 是 user-invoked separate path | **forbidden** | high |
| `agent_subprocess_spawn` | 不存在; HCC Auto Executor 未批 | **forbidden** | high |

**Bash rg 验证**:
- `buildTaskPrompt|dispatchPrompt|assemblePrompt|buildPrompt`: 0 命中 (除 008F/008C 自身)
- `systemPrompt|defaultPrompt|defaultSystemPrompt`: 0 命中
- `claude|launch|spawn|delegate` in src/main/index.ts: 0 命中
- `playbook-runner.ts` 是 rules engine (suggested_playbook 字段), 不是执行器

## 5. Recommended Surface

**`surface_b_chain_consumer` — 008J Real Runtime Dispatch — NEW pure task-dispatch-prompt-builder**

Phase 1 (real runtime dispatch, **IF user 显式批**).

Rationale:
1. Surface B dry-run 成熟且锁定 (008F + 008G + 008H); 缺的是 real prompt-builder wiring
2. 008I 推荐 NEW file (不是 in-place mutation); 现有 chain 不变, change is reversible
3. NEW file PURE: read flag, call 008F helper, return composed prompt; 现有 chain 调用它 before sending prompt
4. Surface C (default system prompt) 高 blast radius, 冻结; 不是推荐 entry point
5. IPC / gateway / live adapter 超出 scope, 不是推荐 entry point

## 6. Rejected Surfaces

| Surface | 理由 |
|---------|------|
| `default_system_prompt_fragment` | 008A § 7 + 008H NO-GO; 高 blast radius; 触 locked files (CLAUDE.md / AGENTS.md / Hermes default); not slice-reversible |
| `ipc_gateway_live_adapter` | 008E / 008H NOT-GO; L6 separate ADR + 显式批; 不在 008J scope |
| `agent_subprocess_spawn` | 008H NOT-GO; spawn / child_process / runPlaybook / sendMessage 全部 forbidden; HCC Auto Executor 未批 |
| `in_place_mutation_of_existing_chain` | 008I 要求 NEW pure file; in-place mutation 不 slice-reversible, 增加 blast radius |

## 7. Allowed Future Files (3 个, 008J 若实装)

| Path | Role | Constraints |
|------|------|-------------|
| `src/main/task-dispatch-prompt-builder.ts` (NEW, 008J) | Pure entry point: read `KNOWLEDGE_CONTRACT_INJECTION_ENABLED`, call 008F helper, return composed prompt | pure / no I/O / no fetch / no spawn / no IPC / no runPlaybook / no real handoff/audit write / no Agent subprocess |
| `src/main/task-dispatch-prompt-builder.test.ts` (NEW, 008J) | Unit test | no real prompt builder mutation / no spawn / pure assertion only |
| `tests/fixtures/knowledge-reuse/task-dispatch-prompt-builder.json` (NEW, 008J) | Snapshot fixture | declarative only / no real write |

## 8. Forbidden Future Files (12+ 条)

- `src/main/dispatch/` (any new directory attempting to wire IPC / gateway / serve / run / agent / delegate / playbook)
- `src/main/agent-launcher.ts` (any Agent subprocess spawn wrapper)
- `src/main/system-prompt-fragment.ts` (any default system prompt mutation)
- `src/main/live-handoff-writer.ts` (any real `~/.hermes/handoff/packs` writer)
- `src/main/live-audit-writer.ts` (any real `~/.hermes/audit` writer)
- `src/main/knowledge-flush.ts` (any real knowledgeIngest / knowledgeSearch adapter)
- `src/main/gateway.ts` (any HTTP gateway to Hermes backend)
- modifications to `src/main/hermes.ts` (no real execution entry point)
- modifications to `src/main/index.ts` (no new IPC handlers)
- modifications to `src/main/cronjobs.ts` (no new cron delivery)
- modifications to `src/main/skills.ts` (no skill dispatch change)
- modifications to `CLAUDE.md` (no agent default system prompt change)
- modifications to `AGENTS.md` (no Codex default system prompt change)
- modifications to `docs/roadmap-locked-2026-05-28.md` (no locked roadmap change)

## 9. Feature Flag Gate

| Field | Value |
|-------|-------|
| Name | `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` |
| Default | `false` (must stay false until 008J+ 显式批) |
| Scope | Surface B task prompt preamble ONLY |
| Does NOT affect | default system prompt / live flush / knowledgeSearch / knowledgeIngest / IPC / gateway / handoff/audit write / HCC Auto Executor / renderer UI |
| Evaluation point | before the existing dispatch chain sends the prompt to the target agent |
| Off behavior | return base task prompt verbatim (no preamble, no mutation) |
| On behavior | read flag, call 008F helper, if apply then use composed prompt else use base |
| Rollback | set flag false at evaluation point; entry point returns base prompt verbatim; no code revert needed |

## 10. Target Agent Gate

| Agent | 008J behavior |
|-------|---------------|
| `claude_code` | allowed_behind_flag (Surface B attach when flag+trigger) |
| `codex` | allowed_behind_flag (Surface B attach when flag+trigger) |
| `hermes_pro` | allowed_behind_flag (opt-in pattern preserved) |
| `hermes_self_call` | reserved_skip_by_default (only attach with `hermesOverride=true`; reserved marker text) |

## 11. Trigger Gate (6 triggers, 沿用 008C/008F)

1. `save_keyword` (en/zh)
2. `research_keyword` (en/zh)
3. `research_task_kind` ∈ {`github_research`, `tool_comparison`, `technical_selection`, `project_research`, `general_research`}
4. `handoff_context.has_ingest_draft`
5. `handoff_context.has_flush_pending`
6. `handoff_context.has_local_known_and_newly_found`

## 12. Surface B Helper Usage (008J consumption)

008J 的 NEW file 调用 008F pure helper:
- `buildTaskPromptWithKnowledgeContractSurfaceB(input)` — 构造 output
- `assertKnowledgeSurfaceBNoRuntime(output)` — 防御性扫描
- 字面量 `SURFACE_B_NAME` (`task_prompt_preamble`) 用于 runtime metadata

008J **不修改** 008F helper 任何部分。

## 13. Exact Future Implementation Boundary (008J)

Allowed:
- ✅ Read `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` flag
- ✅ Call 008F pure simulation helper
- ✅ Return composed prompt string
- ✅ Preserve base task prompt verbatim
- ✅ Reuse 008F surface literals for metadata

Forbidden:
- ❌ Mutate default system prompt
- ❌ Spawn Agent subprocess
- ❌ Call `knowledgeIngest` / `knowledgeSearch` / `fetch`
- ❌ Write to `~/.hermes/handoff/packs` or `~/.hermes/audit`
- ❌ Set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default
- ❌ Mutate existing dispatch chain in place
- ❌ Add new IPC handlers
- ❌ Add new cron delivery
- ❌ Mutate CLAUDE.md / AGENTS.md / Hermes default prompt

## 14. Rollback Strategy (5 步)

1. Set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=false` at evaluation point; entry point returns base task prompt verbatim; no code revert needed
2. Remove entry point from dispatch chain; 008F helper still exists but is not called; no surface regression
3. Fall back to 008F dry-run + L4 handoff-only (007L `payload.context.contracts.knowledge_reuse` 仍 works as data contract)
4. No real handoff/audit write at any point; mtime guard baseline preserved (`handoff_packs=1780195726`, `audit=1780230084`)
5. `knowledgeIngest` / `knowledgeSearch` / live flush still NOT called; 4 runtime flags still literal `false`

## 15. Failure Modes (8 类)

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | `flag_enabled_for_wrong_task` | shouldApply=false AND flag=true | return base task prompt verbatim; skip silently |
| 2 | `flag_disabled_but_expected` | flag=false AND shouldApply=true | respect flag; return base verbatim |
| 3 | `snippet_overlong` | body.length > maxChars | 008F helper truncates + `truncated=true`; entry point passes composed prompt verbatim |
| 4 | `target_agent_blocked` | target=hermes AND override!==true | 008F helper returns reserved skip; entry point returns base verbatim |
| 5 | `runtime_token_detected` | 008F `assertKnowledgeSurfaceBNoRuntime` throws | abort; do NOT call dispatch chain; surface error in dry-run artifact |
| 6 | `prompt_overpromise_detected` | forbidden deceptive-phrase present | abort; do NOT call dispatch chain; surface error |
| 7 | `default_system_prompt_mutation_discovered` | 008J impl requires CLAUDE.md / AGENTS.md change | abort impl; raise as separate ADR; Surface C is Phase 2 only |
| 8 | `ipc_gateway_required` | 008J impl requires IPC / gateway / serve | abort impl; raise as separate ADR for L6; not 008J scope |

## 16. Stop Conditions (15 条)

1. Discovers need to mutate default system prompt (CLAUDE.md / AGENTS.md / Hermes default)
2. Discovers need for IPC / gateway / serve / run / agent / delegate / playbook / cron
3. Discovers need for real handoff writer to `~/.hermes/handoff/packs`
4. Discovers need for real audit log writer to `~/.hermes/audit`
5. Ordinary code-only task gets snippet injected (skip_reason should be `no_trigger_fired`)
6. Feature flag default != false
7. Hermes self-call gets default injection
8. Base task prompt is overwritten
9. Runtime flags can be forged to true
10. Forbidden deceptive-phrase copy appears in simulated preamble
11. mtime changes on `~/.hermes/handoff/packs` or `~/.hermes/audit`
12. `knowledgeIngest(` / `knowledgeSearch(` / `fetch(` appears as call expression in entry point output
13. `executable_steps` / `verificationCommands` / `next_actions` call-form action appears in any payload
14. Agent subprocess spawn attempted (no spawn / child_process / runPlaybook)
15. Renderer UI mutation attempted (留 007H-1)

## 17. PR Gate (9 项)

1. typecheck EXIT 0
2. 008J unit tests PASS
3. vitest full suite PASS (no regression)
4. `git diff --check` clean
5. forbidden token scan: 0 真 runtime call 表达式 in entry point + test + fixture + doc
6. mtime guard: `~/.hermes/handoff/packs` unchanged AND `~/.hermes/audit` unchanged
7. `assertKnowledgeSurfaceBNoRuntime` passes for normal composed prompt
8. 4 literal false runtime flags preserved
9. 008E / 008F / 008G / 008H invariants still PASS

## 18. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008I 单独
npx vitest run tests/knowledge-runtime-dispatch-injection-design.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/knowledge-runtime-dispatch-injection-design.test.ts \
  tests/fixtures/knowledge-reuse/runtime-dispatch-injection-design.json \
  docs/knowledge/knowledge-runtime-dispatch-injection-design-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 19. Remaining Gaps

008I 不解 (留未来 slice):

- ❌ **L5 真实 runtime dispatch implementation** — 008J (IF user 显式批)
- ❌ **L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest** — 留 separate ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1 显式批
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default** — 留 008J+ 显式批

## 20. Future Slices

按依赖顺序:

### 20.1 Slice 008J — Real Runtime Dispatch Implementation (IF user 显式批)

- 范围: NEW file `src/main/task-dispatch-prompt-builder.ts` (pure entry point); call 008F helper; existing chain consumes
- 触发条件: 008I 通过 + 用户**显式批**
- 必跑 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E + 008F 18 + 008G 24 + 008H rollup + 008I invariants + 008J PR gate

### 20.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**
- 必跑 7 项 PR gate (007H § 5)

### 20.3 Slice 008 — Real Live Adapter (L6, 留 008+ 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: separate ADR + 用户**显式批**

### 20.4 远期: Surface C (Phase 2, 留 ADR + 显式批)

- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- **不推荐**作为 first step (高 blast radius)

## 21. Frozen Forbidden List (任一未来 slice 也不得触碰, 除非用户在新批)

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
- **接 dispatch prompt runtime injection** (008J 实施若 user 显式批, 必过 PR gate)
- **改 prompt builder** (008J NEW file only, 不 mutate existing)
- **写真实 runtime injection** (008J NEW file only)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008J+ 显式批)
- **把 008J composed prompt 拼接到真实 dispatcher (无 NEW file pattern)** (留 008+ 显式批)
- **In-place mutation of existing dispatch chain** (NEW file only, 008J § 13)

## 22. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 007J: `src/shared/lib/knowledge-handoff-contract.ts`
- 007L: `src/main/hcc-handoff-pack.ts`
- 008A: design
- 008B: feature flag design
- 008C: pure simulation helper
- 008D: artifact chain test
- 008E: readiness review
- 008F: Surface B dry-run implementation
- 008G: prompt snapshot tests
- 008H: L5 closeout
- **008I (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-dispatch-injection-design.json` (6 discovered_surfaces + recommended + 4 rejected + 3 allowed + 14 forbidden + 9 feature_flag_invariants + 4 target_agent_matrix + 6 trigger_matrix + 5 rollback + 8 failure_modes + 15 stop_conditions + 9 pr_gate + 1 GO + 8 NOT-GO) + `tests/knowledge-runtime-dispatch-injection-design.test.ts` (79 tests 跨 17 describe)
- 008J (待批, IF user 显式批): Real Runtime Dispatch Implementation
- 007H-1 (待批, IF user 要 UI): Renderer GateCard
- 008 (待批): Real Live Adapter
