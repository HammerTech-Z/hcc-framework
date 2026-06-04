# Hermes Pro — Knowledge Task Dispatch Prompt Builder (2026-06-04)

> Slice 008J — Real Runtime Dispatch Implementation Behind Flag / No L6
> 范围: NEW main-side entry point + tests + fixture + design doc;
> **不启动** Agent 子进程, **不接** IPC / gateway / cron / HCC executor, **不调** knowledgeIngest / knowledgeSearch / fetch, **不写真实** `~/.hermes/handoff/packs` / `~/.hermes/audit`, **不改** default system prompt, **不做** Surface C, **不接** renderer UI。
> 上游: 004-008I
> 下游: 008K (Prompt Builder Integration Snapshot / Chain Test, 待批) / 007H-1 (Renderer GateCard, IF user 要 UI) / 008 (Real Live Adapter, 另批)

## 1. Purpose

完成 008J: Real Runtime Dispatch Implementation Behind Flag。

实现一个 main-side **task dispatch prompt builder**, 作为未来 dispatch 链消费的**唯一入口**。本 slice 只新增 behind-flag prompt builder + tests + fixture + doc, 不动现有 dispatch chain, 不启动 Agent, 不接 IPC/gateway, 不 live write, 不 L6。

## 2. Non-goals

- ❌ 不实现真实 dispatch / launcher
- ❌ 不在现有 chain in-place mutation
- ❌ 不改 default system prompt (Surface C 留 Phase 2)
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
- ❌ **不改 default system prompt runtime**
- ❌ **不改 dispatch prompt runtime** (NEW file only, 不 mutate existing chain)
- ❌ **不改 prompt builder** (NEW file only)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C / 008F 已定型)

## 3. 008I Design Source

008I 推荐入口: `src/main/task-dispatch-prompt-builder.ts` (NEW file pattern)

**Allowed (3)**:
- `src/main/task-dispatch-prompt-builder.ts` (NEW, 008J) — pure entry point
- `src/main/task-dispatch-prompt-builder.test.ts` (NEW, 008J)
- `tests/fixtures/knowledge-reuse/task-dispatch-prompt-builder.json` (NEW, 008J)

**Forbidden (14)** (008I § 8):
- `src/main/dispatch/` (any new directory)
- `src/main/agent-launcher.ts` / `src/main/system-prompt-fragment.ts` / `src/main/live-handoff-writer.ts` / `src/main/live-audit-writer.ts` / `src/main/knowledge-flush.ts` / `src/main/gateway.ts`
- modifications to `src/main/hermes.ts` / `index.ts` / `cronjobs.ts` / `skills.ts`
- modifications to `CLAUDE.md` / `AGENTS.md` / `docs/roadmap-locked-2026-05-28.md`

008J 严格遵守 008I 文件边界: **仅** 新增 1 个 src file + 1 个 test + 1 个 fixture + 1 个 doc.

## 4. Builder Boundary

**`src/main/task-dispatch-prompt-builder.ts`**

| Aspect | 008J |
|--------|------|
| Layer | main side (per 008I design) |
| Pattern | NEW pure function file |
| Consumes | `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) |
| Returns | structured output (preamble + final_task_prompt + metadata) |
| Side effects | none |
| I/O | none |
| IPC | none |
| Spawn | none |
| Mutates existing chain | none (NEW file only) |
| Default system prompt | untouched |

## 5. Feature Flag Behavior

| `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` | target | trigger | result |
|----|----|----|----|
| `false` | 任何 | 任何 | `knowledge_contract_attached=false`, `fallback_to_l4=true`, `skip_reason="flag_disabled"`, `final_task_prompt === baseTaskPrompt` |
| `true` | `claude_code` | save/research/handoff | attach |
| `true` | `codex` | save/research/handoff | attach |
| `true` | `hermes_pro` | save/research/handoff | attach |
| `true` | `hermes` (无 `hermesOverride`) | 任何 | reserved skip, `hermes_reserved_marker=true` |
| `true` | `hermes` + `hermesOverride=true` + trigger | — | attach with reserved marker text |
| `true` | 任何 + no trigger | — | `skip_reason="no_trigger_fired"` |

**生产默认**: `flag_enabled=false` → L4 handoff-only 行为保留。

## 6. Target Agent Matrix

| Agent | default_inject | 008J behavior |
|-------|----------------|---------------|
| `claude_code` | true | attach when flag+trigger+research/save/ingest intent |
| `codex` | true | attach when flag+trigger+research/save/ingest intent |
| `hermes_pro` | opt-in | attach when flag+trigger; today not default-injected |
| `hermes` (self-call) | false | reserved skip unless `hermesOverride=true`; reserved marker text only |

## 7. Trigger Matrix (8 triggers, 沿用 008F/008C)

1. `save_keyword` (en/zh)
2. `research_keyword` (en/zh)
3. `research_task_kind` ∈ {`github_research`, `tool_comparison`, `technical_selection`, `project_research`, `general_research`}
4. `handoffContext.hasIngestDraft === true`
5. `handoffContext.hasFlushPending === true`
6. `handoffContext.hasLocalKnownAndNewlyFound === true`
7. ordinary code task → fires 0 triggers → skip
8. hermes default → reserved skip regardless of trigger (unless override)

## 8. Skip Reasons (3 类)

| `skip_reason` | 含义 |
|---------------|------|
| `flag_disabled` | feature flag 关闭 |
| `hermes_self_call_reserved` | hermes self-call 保留, 无 override |
| `no_trigger_fired` | flag 开 + target OK + 无 trigger firing |

When skipped: `final_task_prompt === baseTaskPrompt` (verbatim, no preamble).

## 9. Surface B Helper Usage

008J 内部消费 008F helper:
- `buildTaskPromptWithKnowledgeContractSurfaceB(input)` (renamed to `buildSurfaceBPrompt` in import)
- 008F 内部进一步消费 007I `buildKnowledgeAgentContractSnippet` (snippet source)
- 008J **不复制** 任何 contract 文案; preamble 始终来自 007I source
- `assertKnowledgeSurfaceBNoRuntime` 通过 `assertTaskDispatchPromptBuilderNoRuntime` 二次验证 (belt-and-suspenders)

## 10. Base Prompt Preservation

- `baseTaskPrompt` **preserved byte-for-byte** — no rewrite, no trim, no escape
- When attached: `final_task_prompt = ${preamble}\n\n${baseTaskPrompt}`
- When skipped: `final_task_prompt === baseTaskPrompt`
- Multiline / unicode / special chars (`$pecial & <chars> 你好`): preserved
- `base_task_prompt_preserved: true` 是 literal 在 output

## 11. No-Runtime Invariants (24+ 项, 实跑 70 tests)

1. `schema_version === "1.0.0"` (literal)
2. `slice === "008J"` (literal)
3. `mode === "task_dispatch_prompt_builder"` (literal)
4. `feature_flag_name === "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"` (literal)
5. `feature_flag_default_state === false` (literal)
6. `surface === "task_prompt_preamble"` (literal)
7. `no_l6 === true` (literal)
8. `runtime_flush_allowed === false` (literal)
9. `runtime_dispatch_allowed === false` (literal)
10. `real_handoff_write_allowed === false` (literal)
11. `live_adapter_allowed === false` (literal)
12. `base_task_prompt_preserved === true` (literal)
13. `knowledge_contract_attached === true` only when flag+target+trigger+(hermes override OR not hermes)
14. `skip_reason ∈ {flag_disabled, hermes_self_call_reserved, no_trigger_fired, null}`
15. `fallback_to_l4 === !knowledge_contract_attached`
16. `final_task_prompt` 仅作为 returned string (no I/O, no dispatch)
17. 内部消费 008F helper (buildTaskPromptWithKnowledgeContractSurfaceB); 永不 inline literal preamble
18. No call expression in `preamble_text` or `final_task_prompt`
19. No deceptive copy in preamble (已保存 / 写入成功 / saved successfully / will be written after confirm)
20. No positive path recommendation (Obsidian / MEMORY.md / .wolf/cerebrum.md positive guidance; 007I mentions as "do not" allowed)
21. `baseTaskPrompt` preserved byte-for-byte when skipped; appears as final substring when attached
22. `max_chars` default 2048
23. `assertTaskDispatchPromptBuilderNoRuntime` rejects forged true runtime flags
24. JSON round-trip stable

## 12. Failure Modes (8 类, 沿用 008I)

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | `flag_enabled_for_wrong_task` | shouldApply=false AND flag=true | return base verbatim; skip silently |
| 2 | `flag_disabled_but_expected` | flag=false AND shouldApply=true | respect flag; return base verbatim |
| 3 | `snippet_overlong` | body.length > maxChars | 008F helper truncates; entry point passes composed prompt verbatim |
| 4 | `target_agent_blocked` | target=hermes AND override!==true | 008F helper returns reserved skip; entry point returns base verbatim |
| 5 | `runtime_token_detected` | 008F `assertKnowledgeSurfaceBNoRuntime` throws | abort; do NOT call dispatch chain; surface error |
| 6 | `prompt_overpromise_detected` | forbidden deceptive-phrase present | abort; do NOT call dispatch chain; surface error |
| 7 | `default_system_prompt_mutation_discovered` | 008J requires CLAUDE.md/AGENTS.md change | abort impl; raise as separate ADR |
| 8 | `ipc_gateway_required` | 008J requires IPC/gateway/serve | abort impl; raise as separate ADR for L6 |

## 13. Stop Conditions (15 类, 沿用 008I)

1. Discovers need to mutate default system prompt
2. Discovers need for IPC / gateway / serve / run / agent / delegate / playbook / cron
3. Discovers need for real handoff writer
4. Discovers need for real audit log writer
5. Ordinary code-only task gets snippet injected
6. Feature flag default != false
7. Hermes self-call gets default injection
8. Base task prompt is overwritten
9. Runtime flags can be forged to true
10. Forbidden deceptive-phrase copy appears in simulated preamble
11. mtime changes on `~/.hermes/handoff/packs` or `~/.hermes/audit`
12. `knowledgeIngest(` / `knowledgeSearch(` / `fetch(` appears as call expression
13. `executable_steps` / `verificationCommands` / `next_actions` call-form action
14. Agent subprocess spawn attempted
15. Renderer UI mutation attempted

## 14. Rollback Strategy (5 步, 沿用 008I)

1. Set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=false` at evaluation point; entry point returns base task prompt verbatim; no code revert needed
2. Remove call site in dispatch chain; 008J file still exists but is not invoked; no surface regression
3. Fall back to 008F dry-run + L4 handoff-only (007L payload.context.contracts.knowledge_reuse 仍 works as data contract)
4. No real handoff/audit write at any point; mtime guard baseline preserved
5. `knowledgeIngest` / `knowledgeSearch` / live flush still NOT called; 4 runtime flags still literal `false`

## 15. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008J 单独
npx vitest run tests/task-dispatch-prompt-builder.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  src/main/task-dispatch-prompt-builder.ts \
  docs/knowledge/knowledge-task-dispatch-prompt-builder-2026-06-04.md \
  tests/task-dispatch-prompt-builder.test.ts \
  tests/fixtures/knowledge-reuse/task-dispatch-prompt-builder.json

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 16. Remaining Gaps

008J 不解 (留未来 slice):

- ❌ **L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest** — 留 separate ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default** — 留 008+ 显式批
- ❌ **In-place mutation of existing dispatch chain** — NEW file only (008I forbidden)

## 17. Next Slices

按依赖顺序:

### 17.1 Slice 008K — Prompt Builder Integration Snapshot / Chain Test (推荐下一步)

- 范围: Chain test for 008J entry point + existing dispatch chain (mock) + dry-run artifact chain; verify byte-level behavior
- 触发条件: 008J 通过 + 用户**显式批**
- 必跑 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E + 008F 18 + 008G 24 + 008H rollup + 008I invariants + 008J PR gate

### 17.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**
- 与 008J 互不依赖

### 17.3 Slice 008 — Real Live Adapter (L6, 留 008+ 显式批)

- 范围: 真实 IPC adapter
- 触发条件: separate ADR + 用户**显式批**

### 17.4 远期: Surface C (Phase 2, 留 ADR + 显式批)

- **不推荐**作为 first step (高 blast radius)

## 18. Frozen Forbidden List (任一未来 slice 也不得触碰, 除非用户在新批)

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
- **接 dispatch prompt runtime injection** (008J NEW file only, no in-place mutation)
- **改 prompt builder** (008J NEW file only)
- **写真实 runtime injection** (008J NEW file only, 留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **In-place mutation of existing dispatch chain** (NEW file only, 008I forbidden)
- **把 008J composed prompt 拼接到真实 dispatcher (无 NEW file pattern)** (留 008+ 显式批)
- **L6 任何** (`no_l6: true` literal in 008J output) (留 separate ADR + 显式批)

## 19. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 007J: `src/shared/lib/knowledge-handoff-contract.ts`
- 007L: `src/main/hcc-handoff-pack.ts`
- 008F: `src/shared/lib/knowledge-runtime-injection-surface-b.ts` (consumed by 008J)
- 008H: `docs/knowledge/knowledge-runtime-injection-l5-closeout-2026-06-04.md`
- 008I: `docs/knowledge/knowledge-runtime-dispatch-injection-design-2026-06-04.md`
- **008J (本 slice)**: 本 doc + `src/main/task-dispatch-prompt-builder.ts` (3 函数 + 6 字面量 + 4 literal false + `no_l6: true` literal) + `tests/task-dispatch-prompt-builder.test.ts` (70 tests 跨 17 describe) + `tests/fixtures/knowledge-reuse/task-dispatch-prompt-builder.json` (8 examples + 24 invariants)
- 008K (待批): Prompt Builder Integration Snapshot / Chain Test
- 007H-1 (待批): Renderer GateCard
- 008 (待批): Real Live Adapter
