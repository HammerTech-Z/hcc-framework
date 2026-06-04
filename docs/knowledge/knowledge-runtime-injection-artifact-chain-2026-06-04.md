# Hermes Pro — Knowledge Runtime Injection Dry-run Artifact Chain (2026-06-04)

> Slice 008D — Runtime Injection Dry-run Artifact Chain Test / No Runtime
> 范围: chain test + chain fixture + design doc;
> **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008C
> 下游: 007H-1 (renderer GateCard implementation, 若用户批 UI 实装) / 008 (real live adapter, 另批)

## 1. Purpose

实现 008D — Runtime Injection Dry-run Artifact Chain Test。

把 008A/008B/008C 串成 artifact-level chain test:
**design fixture → simulation helper → dry-run artifact → JSON round-trip → invariant verification**。

仍然 **0 runtime、0 dispatch、0 prompt builder mutation、0 real handoff write**。

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
- ❌ **不改 default system prompt runtime** (留 008+ 显式批)
- ❌ **不改 dispatch prompt runtime** (留 008+ 显式批)
- ❌ **不改 prompt builder** (留 008+ 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C 已定型)

## 3. Chain Stages (5 stages)

```
[ stage 1: design_assumptions ]
  Source: tests/fixtures/knowledge-reuse/runtime-default-injection-design.json
          tests/fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json
  Kind: static_read
  Output: design assumptions (surfaces, target agent matrix, trigger conditions, 11 safety gates, 8 failure modes, 5-step rollback)
  Side effects: none

[ stage 2: simulation_helper ]
  Source: src/shared/lib/knowledge-runtime-injection-simulation.ts
  Kind: pure_function
  Output: KnowledgeRuntimeInjectionSimulation (7 representative inputs)
  Side effects: none

[ stage 3: dry_run_artifact ]
  Source: tests/safety/knowledge-runtime-injection-artifact-chain.test.ts (buildChainArtifact)
  Kind: pure_aggregation
  Output: ChainArtifact (matrix_results + invariant_results + content_hash)
  Side effects: none

[ stage 4: json_round_trip ]
  Source: tests/safety/knowledge-runtime-injection-artifact-chain.test.ts
  Kind: pure_io_in_memory
  Output: JSON.stringify → JSON.parse → equality check
  Side effects: none

[ stage 5: invariant_verification ]
  Source: tests/safety/knowledge-runtime-injection-artifact-chain.test.ts (runInvariants)
  Kind: pure_assertion
  Output: 20 invariants × 7 simulations = 140 check records (all pass=true)
  Side effects: none
```

每 stage 均为 pure。**0 real handoff write**, **0 IPC**, **0 runtime call**, **0 prompt builder mutation**。

## 4. Artifact Schema

```ts
interface ChainArtifact {
  schema_version: "1.0.0";
  slice: "008D";
  mode: "runtime_injection_artifact_chain";
  generated_from: ReadonlyArray<string>;          // ["008A", "008B", "008C"]
  source_fixtures: {
    design_a: unknown;                            // 008A design fixture
    design_b: unknown;                            // 008B design fixture
    simulation: unknown;                          // 008C simulation fixture
    chain: unknown;                               // 008D chain fixture
  };
  simulations: ReadonlyArray<KnowledgeRuntimeInjectionSimulation>;
  feature_flag_matrix_results: ReadonlyArray<{
    name: string;
    snippet_attached: boolean;
    fallback_to_l4: boolean;
    skip_reason: string | null;
    runtime_flush_allowed: boolean;                // literal false
    runtime_dispatch_allowed: boolean;             // literal false
    real_handoff_write_allowed: boolean;           // literal false
    live_adapter_allowed: boolean;                 // literal false
  }>;
  invariant_results: ReadonlyArray<{
    name: string;
    pass: boolean;
    detail: string;
  }>;
  no_runtime_checked: true;
  created_at: string;
  content_hash: string;                            // sha256:
}
```

## 5. Feature Flag Matrix (7 entries)

| name | flag | target | trigger | expected |
|------|------|--------|---------|----------|
| `flag_disabled_fallback_to_l4` | false | claude_code | save | skip `flag_disabled`, fallback_to_l4 |
| `flag_enabled_claude_code_save` | true | claude_code | save | attach, snippet_attached |
| `flag_enabled_codex_handoff_ingest_draft` | true | codex | handoff ingest_draft | attach |
| `flag_enabled_hermes_pro_local_newly` | true | hermes_pro | local+newly | attach |
| `flag_enabled_hermes_reserved_skip` | true | hermes | save | reserved skip, hermes_reserved_marker |
| `flag_enabled_ordinary_code_skip` | true | claude_code | (none) | skip `no_trigger_fired` |
| `flag_enabled_max_chars_truncation` | true | claude_code | save | attach, truncated=true, max_chars=64 |

## 6. Target Agent Matrix

| Agent | default_inject | 008D behavior |
|-------|----------------|---------------|
| `claude_code` | true | attach when flag+trigger; tested with save keyword |
| `codex` | true | attach when flag+trigger; tested with handoff ingest_draft |
| `hermes_pro` | opt-in | attach when flag+trigger; tested with local+newly |
| `hermes` (self-call) | false (reserved) | skip by default; only attach with `hermesOverride=true` (uses reserved marker text) |

## 7. Trigger Matrix (8 triggers)

| Trigger | Detected by |
|---------|-------------|
| `save_keyword` (en/zh) | `shouldAttachKnowledgeContract` regex test on `userRequest.toLowerCase()` |
| `save_keyword` (zh) | 007I pattern includes 保存/沉淀/写入/存档/存到/入库/记到/记录 |
| `research_keyword` (en) | 007I pattern includes research/investigate/compare/vs./alternative/what is/how does |
| `research_keyword` (zh) | 007I pattern includes 调研/研究/了解/对比/比较/选型 |
| `research_task_kind` | `taskKind ∈ {github_research, tool_comparison, technical_selection, project_research, general_research}` |
| `has_ingest_draft` | `handoffContext.hasIngestDraft === true` |
| `has_flush_pending` | `handoffContext.hasFlushPending === true` |
| `has_local_known_and_newly_found` | `handoffContext.hasLocalKnownAndNewlyFound === true` |

Ordinary code task (e.g. "fix the bug in src/foo.ts", "refactor the foo module") fires 0 triggers.

## 8. Fallback to L4

3 类 skip → fallback to L4:

1. `flag_disabled` — feature flag 关闭
2. `hermes_self_call_reserved` — hermes self-call 保留, 无 override
3. `no_trigger_fired` — flag 开 + target OK + 无 trigger firing

Fallback 行为: `simulated_dispatch_prompt = baseTaskPrompt` (verbatim, 无 preamble); `runtime_flush_allowed` 等 4 flag 仍 `false`; `simulated_preamble === null`; `fallback_to_l4 === true`。

## 9. No-Runtime Invariants (14+ 项, 实跑 20 invariants × 7 simulations = 140 checks)

每 simulation 验:

1. `runtime_flush_allowed === false` (literal)
2. `runtime_dispatch_allowed === false` (literal)
3. `real_handoff_write_allowed === false` (literal)
4. `live_adapter_allowed === false` (literal)
5. `feature_flag.default_state === false` (literal)
6. `surface === "task_prompt_preamble"` (literal)
7. `mode === "runtime_injection_simulation"` (literal)
8. `schema_version === "1.0.0"` (literal)
9. `snippet_attached === !fallback_to_l4` (XOR)
10. `executable_steps` 字段 absent
11. `verificationCommands` 字段 absent

Chain-level:

12. `no_executable_steps_field` 字段 absent in artifact blob
13. `no_verificationCommands_field` 字段 absent
14. `no_next_actions_field` 字段 absent
15. chain-level blob (excl. simulations[]) 无 call 表达式
16. `assertKnowledgeRuntimeInjectionSimulationNoRuntime(sim)` 对每个 sim 不 throw
17. JSON round-trip stable
18. `simulated_dispatch_prompt` 保留 base task prompt verbatim
19. `simulated_preamble` 含 007I 必含 + 不含 5 句 deceptive copy
20. 真实 `~/.hermes/handoff/packs` mtime 不变
21. 真实 `~/.hermes/audit` mtime 不变

## 10. Failure Modes (8 类 — 沿用 008B § 9)

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | `flag_enabled_for_wrong_task` | shouldAttach=false AND flag=true | fall back to L4; emit dry-run artifact |
| 2 | `flag_disabled_but_expected` | flag=false AND shouldAttach=true | respect flag; emit dry-run artifact |
| 3 | `snippet_missing` | trigger fires but no envelope | fall back to L4; emit dry-run artifact |
| 4 | `snippet_overlong` | snippet_text.length > max_chars | truncate + truncated=true |
| 5 | `target_agent_blocked` | targetAgent=hermes AND override!==true | skip; emit dry-run artifact (hermes_reserved_marker=true) |
| 6 | `runtime_token_detected` | assertNoRuntime returns hit | abort; emit dry-run artifact |
| 7 | `prompt_overpromise_detected` | forbidden deceptive-phrase present | abort; emit dry-run artifact |
| 8 | `fallback_to_l4_failed` | L4 fallback itself fails | abort; refuse to dispatch |

008D 验证 1-5 行为; 6-7 由 008C 验证 (008D chain test 复用 008C assertNoRuntime); 8 留 008+ 验证。

## 11. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008D 单独
npx vitest run tests/safety/knowledge-runtime-injection-artifact-chain.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/safety/knowledge-runtime-injection-artifact-chain.test.ts \
  tests/fixtures/knowledge-reuse/runtime-injection-artifact-chain.json

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
# expected: 1780195726 /Users/midoudou/.hermes/handoff/packs
#           1780230084 /Users/midoudou/.hermes/audit
```

## 12. Remaining Gaps

008D 不解 (留未来 slice):

- ❌ **L5 真实 runtime default injection** — 留 008+ 显式批 (Surface B task prompt preamble 真正注入)
- ❌ **L6 live search / live flush** — 留 008+ 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1~7 (用户批 UI 实装)
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批

## 13. Next Slices

按依赖顺序:

### 13.1 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 范围: 渲染层 GateCard, 配合 007E / 007F / 007G / 007H
- 触发条件: 用户**显式批**
- 必跑 7 项 PR gate (007H § 5)
- 与 008D 互不依赖, 可独立推进

### 13.2 Slice 008 — Real Live Adapter (另批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: 008D 通过 + 用户**显式批**
- 必跑 P2.5 safety foundation + 008A 10 safety gates + 008B 11 safety gates + 008C 4 字面量 false 验证 + 008D 20 invariants

### 13.3 远期 — Surface C (Phase 2)

- 范围: 评估 Surface C (global default system prompt fragment) 作为 global optimization
- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- 必跑 separate ADR review
- **不推荐**作为 first step (高 blast radius)

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
- **接 default system prompt runtime injection (Surface C)** (留 008+ 显式批)
- **改 global default system prompt as first step** (高 blast radius, 留 Phase 2 + 显式批)
- **接 dispatch prompt runtime injection** (留 008+ 显式批)
- **改 prompt builder** (留 008+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **把 008D chain artifact 输入到真实 prompt builder** (留 008+ 显式批)
- **把 `simulated_dispatch_prompt` 拼接到真实 dispatch prompt** (留 008+ 显式批)

## 15. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts` + `docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md`
- 007J: `src/shared/lib/knowledge-handoff-contract.ts` + `docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md`
- 007L: `src/main/hcc-handoff-pack.ts` + `docs/knowledge/knowledge-handoff-builder-insertion-dry-run-2026-06-03.md`
- 007M: `docs/knowledge/knowledge-handoff-builder-chain-closeout-2026-06-04.md` + chain test
- 007N: `docs/knowledge/knowledge-claude-code-default-contract-landing-closeout-2026-06-04.md` + 69 tests
- 008A: `docs/knowledge/knowledge-runtime-default-injection-design-2026-06-04.md` + design fixture
- 008B: `docs/knowledge/knowledge-runtime-injection-feature-flag-dry-run-design-2026-06-04.md` + design fixture
- 008C: `docs/knowledge/knowledge-runtime-injection-simulation-helper-2026-06-04.md` + `src/shared/lib/knowledge-runtime-injection-simulation.ts` + 32 tests + fixture
- **008D (本 slice)**: 本 doc + `tests/safety/knowledge-runtime-injection-artifact-chain.test.ts` (56 tests 跨 10 describe) + `tests/fixtures/knowledge-reuse/runtime-injection-artifact-chain.json`
- 007H-1 (待批): renderer GateCard implementation
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening
