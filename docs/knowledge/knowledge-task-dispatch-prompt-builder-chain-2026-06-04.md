# Hermes Pro — Knowledge Task Dispatch Prompt Builder Chain (2026-06-04)

> Slice 008K — Prompt Builder Integration Snapshot / Chain Test / No L6
> 范围: chain fixture + chain tests + design doc;
> **不接** runtime, **不启动** Agent 子进程, **不接** IPC / gateway / cron / HCC executor, **不调** knowledgeIngest / knowledgeSearch / fetch, **不写真实** `~/.hermes/handoff/packs` / `~/.hermes/audit`, **不改** default system prompt, **不做** Surface C, **不做** L6, **不做** renderer UI, **不要求** Obsidian Vault / MEMORY.md / .wolf / 任意 notes 路径, **不声称** 已写入知识库, **不做** in-place mutation。
> 上游: 004-008J
> 下游: 008L (L5 Runtime Dispatch Closeout / No L6, 待批) / 007H-1 (Renderer GateCard, IF user 要 UI) / 008 (Real Live Adapter, 另批)

## 1. Purpose

完成 008K: Prompt Builder Integration Snapshot / Chain Test。

把 008F + 008G + 008J 串成 integration chain:
**008F Surface B helper → 008J task dispatch prompt builder → snapshot fixture → JSON round-trip → no-runtime invariant verification**。

本 slice 只做 test/fixture/doc/report。**不要接真实 dispatch, 不要启动 Agent, 不要写真实 handoff/audit**。

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
- ❌ **不改 dispatch prompt runtime**
- ❌ **不改 prompt builder** (留 008+ 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 008F / 008J helper (已定型, 008K 仅 consume)

## 3. Source Slices

| Slice | 角色 | 状态 |
|-------|------|------|
| 008F | Surface B dry-run implementation | consumed |
| 008G | Prompt snapshot tests | consumed (alignment verified) |
| 008J | Task dispatch prompt builder | consumed |
| 008H | L5 closeout (rollup) | referenced (fixture cross-validation) |

## 4. Chain Stages (5 stages)

```
[ stage 1: read_source_fixtures ]
  Sources: 008F + 008G + 008J + 008H fixtures
  Kind: static_read
  Output: design assumptions (surfaces, target agent matrix, trigger conditions, 4 literal false runtime flags, no_l6=true)
  Side effects: none

[ stage 2: call_008J_builder ]
  Source: src/main/task-dispatch-prompt-builder.ts (buildTaskDispatchPrompt)
  Kind: pure_function
  Output: 8 TaskDispatchPromptOutput instances (one per chain example)
  Side effects: none
  Note: 008J internally consumes 008F helper; 0 mutate

[ stage 3: compare_with_008G_snapshot ]
  Source: tests/fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json
  Kind: pure_comparison
  Output: byte-level alignment between 008J output and 008G snapshot
  Side effects: none

[ stage 4: json_round_trip ]
  Source: JSON.stringify / JSON.parse
  Kind: pure_io_in_memory
  Output: deep-equal original → round
  Side effects: none

[ stage 5: no_runtime_invariant_verification ]
  Source: assertTaskDispatchPromptBuilderNoRuntime + cross-validate via 008F assertKnowledgeSurfaceBNoRuntime
  Kind: pure_assertion
  Output: 4 literal false runtime flags preserved; no_l6=true; no forbidden call expression; no deceptive copy
  Side effects: none
```

每 stage 均为 pure 或 in-memory。**0 real handoff write**, **0 IPC**, **0 runtime call**, **0 prompt builder mutation**, **0 Agent subprocess**。

## 5. Fixture Schema

```ts
interface ChainFixture {
  schema_version: "1.0.0";
  slice: "008K";
  mode: "task_dispatch_prompt_builder_chain";
  description: string;
  source_slices: string[];          // ["008F", "008G", "008J"]
  chain_stages: ChainStage[];       // 5 entries
  snapshot_links_008g: string[];    // 8 entries
  builder_links_008j: string[];     // 8 entries
  examples: ChainExample[];         // 8 entries
  invariants: string[];            // 26+ entries
  no_l6: true;
  forbidden_runtime_checked: true;
  forbidden_call_tokens: string[];
  forbidden_deceptive_phrases: string[];
  forbidden_path_markers: string[];
  forbidden_call_form_fields: string[];
  mtime_baseline: { handoff_packs: number; audit: number };
}
```

## 6. Snapshot Linkage (008G)

8 chain example names map 1:1 to 008G snapshot ids:

| 008J example | 008G snapshot |
|--------------|---------------|
| `flag_disabled_no_attach` | `flag_disabled_no_preamble` |
| `claude_code_research_attach` | `claude_code_research_preamble` |
| `codex_ingest_draft_attach` | `codex_ingest_draft_preamble` |
| `hermes_pro_local_newly_attach` | `hermes_pro_local_newly_preamble` |
| `hermes_reserved_skip` | `hermes_reserved_no_preamble` |
| `ordinary_code_skip` | `ordinary_code_no_preamble` |
| `truncated_prompt` | `truncated_preamble` |
| `multiline_base_prompt_preserved` | `base_prompt_preserved_multiline` |

008K chain test verifies 008J output behavior aligned with 008G snapshot semantics (same skip_reason, same fallback_to_l4, same preamble when attached, same base task prompt preservation).

## 7. Builder Linkage (008J)

8 chain examples correspond 1:1 to 008J fixture examples. Each example's `input` is consumed by `buildTaskDispatchPrompt(input)`, and the chain test verifies `knowledge_contract_attached`, `fallback_to_l4`, `skip_reason`, `trigger_flags`, `final_task_prompt` byte-align with the 008J fixture expected behavior.

## 8. Target Agent Matrix

| Agent | 008J/008K behavior |
|-------|---------------------|
| `claude_code` | default_attach_when_flag_on_and_trigger_fired |
| `codex` | default_attach_when_flag_on_and_trigger_fired |
| `hermes_pro` | opt_in_attach_when_flag_on_and_trigger_fired |
| `hermes_self_call` | reserved_skip_by_default; only attach with `hermesOverride=true` (reserved marker text) |

## 9. Trigger Matrix (6 triggers, 沿用 008F/008C/008J)

1. `save_keyword` (en/zh)
2. `research_keyword` (en/zh)
3. `research_task_kind` ∈ {`github_research`, `tool_comparison`, `technical_selection`, `project_research`, `general_research`}
4. `handoffContext.hasIngestDraft === true`
5. `handoffContext.hasFlushPending === true`
6. `handoffContext.hasLocalKnownAndNewlyFound === true`

## 10. No-Runtime Invariants (26+ 项)

1. `schema_version === "1.0.0"` (literal)
2. `slice === "008K"` (literal)
3. `mode === "task_dispatch_prompt_builder_chain"` (literal)
4. `source_slices` lists 008F/008G/008J in order
5. chain has 5 stages (read → call → compare → round-trip → verify)
6. `snapshot_links_008g` covers 8 distinct 008G snapshot ids
7. `builder_links_008j` covers 8 distinct 008J example ids
8. every chain example aligns with both 008G snapshot + 008J builder output
9. 008J output byte-aligned with 008G snapshot for the matching case
10. 008F helper output byte-aligned with 008J builder output (008J delegates to 008F)
11. `slice === "008J"` (literal) on every chain output
12. `mode === "task_dispatch_prompt_builder"` (literal)
13. `feature_flag_name === "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"` (literal)
14. `feature_flag_default_state === false` (literal)
15. `surface === "task_prompt_preamble"` (literal)
16. `no_l6 === true` (literal)
17. `runtime_flush_allowed === false` (literal)
18. `runtime_dispatch_allowed === false` (literal)
19. `real_handoff_write_allowed === false` (literal)
20. `live_adapter_allowed === false` (literal)
21. `base_task_prompt_preserved === true` (literal)
22. `knowledge_contract_attached` only when flag+target+trigger+(hermes override OR not hermes)
23. `skip_reason ∈ {flag_disabled, hermes_self_call_reserved, no_trigger_fired, null}`
24. `fallback_to_l4 === !knowledge_contract_attached`
25. `final_task_prompt` 仅作为 returned string (no I/O, no dispatch)
26. no call expression in `preamble_text` / `final_task_prompt`
27. no call-form fields (`executable_steps` / `verificationCommands` / `next_actions[].action` call-form)
28. no deceptive copy (已保存 / 写入成功 / saved successfully / will be written after confirm)
29. no positive path recommendation (Obsidian / MEMORY.md / .wolf/cerebrum.md positive guidance)
30. `baseTaskPrompt` preserved byte-for-byte when skipped; appears as final substring when attached
31. `max_chars` default 2048
32. `assertTaskDispatchPromptBuilderNoRuntime` rejects forged true runtime flags
33. JSON round-trip stable

## 11. No-L6 边界

`no_l6: true` 是 literal 在 008J output 和 008K chain fixture. 显式声明本链路**不接 L6** (live adapter / live flush / live knowledgeSearch / live knowledgeIngest).

L6 任何:
- ❌ L6 live adapter
- ❌ L6 live flush
- ❌ L6 live knowledgeSearch
- ❌ L6 live knowledgeIngest
- ❌ L6 real handoff write to `~/.hermes/handoff/packs`
- ❌ L6 real audit log write to `~/.hermes/audit`

L6 任何留 separate ADR + 显式批 (008+).

## 12. Failure Modes (8 类, 沿用 008I)

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | `flag_enabled_for_wrong_task` | shouldApply=false AND flag=true | return base verbatim; skip silently |
| 2 | `flag_disabled_but_expected` | flag=false AND shouldApply=true | respect flag; return base verbatim |
| 3 | `snippet_overlong` | body.length > maxChars | 008F helper truncates; entry point passes composed prompt verbatim |
| 4 | `target_agent_blocked` | target=hermes AND override!==true | 008F helper returns reserved skip |
| 5 | `runtime_token_detected` | `assertTaskDispatchPromptBuilderNoRuntime` throws | abort; do NOT call dispatch chain |
| 6 | `prompt_overpromise_detected` | forbidden deceptive-phrase present | abort |
| 7 | `008F_008J_misalignment` | 008J output ≠ 008F output | fail chain test; investigate helper |
| 8 | `008G_snapshot_drift` | 008J output ≠ 008G snapshot semantics | fail chain test; update snapshot or fix 008J |

## 13. Stop Conditions (15 类, 沿用 008I/008J)

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
13. `executable_steps` / `verificationCommands` / `next_actions` call-form action appears
14. Agent subprocess spawn attempted
15. Renderer UI mutation attempted

## 14. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008K 单独
npx vitest run tests/safety/task-dispatch-prompt-builder-chain.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/safety/task-dispatch-prompt-builder-chain.test.ts \
  tests/fixtures/knowledge-reuse/task-dispatch-prompt-builder-chain.json \
  docs/knowledge/knowledge-task-dispatch-prompt-builder-chain-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 15. Remaining Gaps

008K 不解 (留未来 slice):

- ❌ **L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest** — 留 separate ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1 显式批
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **In-place mutation of existing dispatch chain** — NEW file only (008I forbidden)
- ❌ **Setting `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default** — 留 008+ 显式批

## 16. Next Slices

按依赖顺序:

### 16.1 Slice 008L — L5 Runtime Dispatch Closeout / No L6 (推荐下一步)

- 范围: Closeout review for L5 (real runtime dispatch via 008J NEW file pattern + 008F Surface B helper). Mark L5 reached. NOT-GO for L6.
- 触发条件: 008K 通过 + 用户**显式批**
- 必跑 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E + 008F 18 + 008G 24 + 008H rollup + 008I invariants + 008J 24 + 008K 33 invariants

### 16.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**
- 与 008K 互不依赖

### 16.3 Slice 008 — Real Live Adapter (L6, 留 008+ 显式批)

- 范围: 真实 IPC adapter
- 触发条件: separate ADR + 用户**显式批**

### 16.4 远期: Surface C (Phase 2, 留 ADR + 显式批)

- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- **不推荐**作为 first step (高 blast radius)

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
- **接 dispatch prompt runtime injection** (008J NEW file only, no in-place mutation)
- **改 prompt builder** (008J NEW file only)
- **写真实 runtime injection** (008J NEW file only, 留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **In-place mutation of existing dispatch chain** (NEW file only, 008I forbidden)
- **把 008J composed prompt 拼接到真实 dispatcher (无 NEW file pattern)** (留 008+ 显式批)
- **L6 任何** (`no_l6: true` literal) (留 separate ADR + 显式批)

## 18. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 008F: `src/shared/lib/knowledge-runtime-injection-surface-b.ts` (consumed by 008J, transitively by 008K)
- 008G: prompt snapshot tests (consumed by 008K for alignment verification)
- 008H: L5 closeout (referenced by 008K fixture)
- 008I: dispatch design (referenced by 008K fixture)
- 008J: `src/main/task-dispatch-prompt-builder.ts` (consumed by 008K)
- **008K (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/task-dispatch-prompt-builder-chain.json` (5 chain stages + 8 snapshot_links + 8 builder_links + 8 examples + 33 invariants + `no_l6: true`) + `tests/safety/task-dispatch-prompt-builder-chain.test.ts` (62 tests 跨 22 describe)
- 008L (待批): L5 Runtime Dispatch Closeout / No L6
- 007H-1 (待批): Renderer GateCard
- 008 (待批): Real Live Adapter
