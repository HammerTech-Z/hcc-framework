# Hermes Pro — Knowledge Runtime Injection Pure Simulation Helper (2026-06-04)

> Slice 008C — Runtime Injection Pure Simulation Helper / No Runtime
> 范围: pure simulation helper + tests + fixture + design doc;
> **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008B
> 下游: 008D (Runtime injection dry-run artifact chain test, 仍 no runtime) / 007H-1 (renderer GateCard implementation, 若用户批 UI 实装) / 008 (real live adapter, 另批)

## 1. Purpose

实现 008C — Runtime Injection Pure Simulation Helper。把 008A/008B 的设计转成纯函数 simulation helper, 验证 feature flag 开/关、target agent、trigger conditions、safety gates 下, 未来 task prompt preamble 是否会被"模拟注入"。

这是 **pure simulation**, 不是 runtime injection。

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
- ❌ **不改 default system prompt runtime** (留 008D+ 显式批)
- ❌ **不改 dispatch prompt runtime** (留 008D+ 显式批)
- ❌ **不改 prompt builder** (留 008D+ 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L 已定型)

## 3. What 008C adds

| 文件 | 类型 | 描述 |
|------|------|------|
| `src/shared/lib/knowledge-runtime-injection-simulation.ts` | pure helper | 4 函数 + 5 字面量 + 6 类型 |
| `tests/knowledge-runtime-injection-simulation.test.ts` | tests | 32 tests 跨 9 describe |
| `tests/fixtures/knowledge-reuse/runtime-injection-simulation.json` | fixture | 8 examples |
| `docs/knowledge/knowledge-runtime-injection-simulation-helper-2026-06-04.md` | doc | 本文档 |

不修改任何已存在 runtime / helper / builder / IPC / handoff writer。

## 4. Pure Helper API

### 4.1 入口函数

| 函数 | 返回 | 描述 |
|------|------|------|
| `buildKnowledgeRuntimeInjectionSimulation(input)` | `KnowledgeRuntimeInjectionSimulation` | 构造完整 simulation artifact |
| `shouldSimulateKnowledgeContractInjection(input)` | `boolean` | 纯判断: 是否应"模拟注入" |
| `buildSimulatedTaskPromptPreamble(input)` | `{ preamble, truncated, hash }` | 构造模拟 preamble 字符串 |
| `assertKnowledgeRuntimeInjectionSimulationNoRuntime(payload)` | `void` (throws) | 防御 forged runtime flag / forbidden call |

### 4.2 字面量 (5 个)

| 字面量 | 值 | 描述 |
|--------|----|------|
| `KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION` | `"1.0.0"` | schema version |
| `KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG` | `"KNOWLEDGE_CONTRACT_INJECTION_ENABLED"` | feature flag name |
| `RECOMMENDED_INJECTION_SURFACE` | `"task_prompt_preamble"` | Surface B from Slice 008A |
| `SIMULATION_MODE` | `"runtime_injection_simulation"` | mode literal |
| `DEFAULT_SIMULATION_MAX_CHARS` | `2048` | max chars |

### 4.3 4 个硬编码 `false` safety flags

| 字段 | 值 |
|------|----|
| `runtime_flush_allowed` | `false` |
| `runtime_dispatch_allowed` | `false` |
| `real_handoff_write_allowed` | `false` |
| `live_adapter_allowed` | `false` |

由 `RUNTIME_FLUSH_ALLOWED_LITERAL` / `RUNTIME_DISPATCH_ALLOWED_LITERAL` / `REAL_HANDOFF_WRITE_ALLOWED_LITERAL` / `LIVE_ADAPTER_ALLOWED_LITERAL` 字面量提供; TypeScript 字面量类型保证。

## 5. Input / Output

### 5.1 Input 字段 (8 项)

```ts
interface KnowledgeRuntimeInjectionSimulationInput {
  featureFlagEnabled: boolean;
  targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes";
  taskKind?: string;
  userRequest?: string;
  handoffContext?: {
    hasIngestDraft?: boolean;
    hasFlushPending?: boolean;
    hasLocalKnownAndNewlyFound?: boolean;
  };
  baseTaskPrompt?: string;
  maxChars?: number;
  hermesOverride?: boolean;
  overrideSnippetText?: string;
  nowIso?: string;
}
```

### 5.2 Output 字段 (15 项 + 4 子对象)

```ts
interface KnowledgeRuntimeInjectionSimulation {
  schema_version: "1.0.0";
  mode: "runtime_injection_simulation";
  feature_flag: { name, enabled, default_state: false };
  target_agent: KnowledgeContractTargetAgent;
  surface: "task_prompt_preamble";
  snippet_attached: boolean;
  skip_reason: string | null;
  fallback_to_l4: boolean;
  trigger_flags: { save_keyword, research_keyword, research_task_kind, has_ingest_draft, has_flush_pending, has_local_known_and_newly_found };
  safety_gate_result: { pass: boolean, reason: string };
  simulated_preamble: string | null;
  simulated_dispatch_prompt: string;
  snippet_hash_or_content_hash: string;
  max_chars: number;
  truncated: boolean;
  runtime_flush_allowed: false;
  runtime_dispatch_allowed: false;
  real_handoff_write_allowed: false;
  live_adapter_allowed: false;
  hermes_reserved_marker: boolean;
  created_at: string;
  source_doc: string;
}
```

## 6. Feature Flag Behavior (008B § 3)

| `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` | targetAgent | 行为 |
|----|----|----|
| `false` | 任何 | `snippet_attached=false`, `fallback_to_l4=true`, `skip_reason="flag_disabled"` |
| `true` | `claude_code` + trigger | `snippet_attached=true`, `fallback_to_l4=false` |
| `true` | `codex` + trigger | `snippet_attached=true`, `fallback_to_l4=false` |
| `true` | `hermes_pro` + trigger | `snippet_attached=true`, `fallback_to_l4=false` |
| `true` | `hermes` (无 `hermesOverride`) | `snippet_attached=false`, `skip_reason="hermes_self_call_reserved"`, `hermes_reserved_marker=true` |
| `true` | `hermes` + `hermesOverride=true` + trigger | `snippet_attached=true`, 用 reserved marker 替换 snippet text |

## 7. Trigger Conditions (沿用 007I / 007J / 008A)

`shouldSimulateKnowledgeContractInjection` 返回 `true` 当且仅当:

1. `featureFlagEnabled === true`
2. `targetAgent` ∈ {`claude_code`, `codex`, `hermes_pro`, `hermes`}
3. `targetAgent !== "hermes"` OR `hermesOverride === true`
4. `shouldAttachKnowledgeContract(attach_context)` (007I) returns `true`

任一条件不满足 → `snippet_attached=false` + `fallback_to_l4=true`。

## 8. Skip Reason (5 类)

| `skip_reason` | 含义 |
|---------------|------|
| `flag_disabled` | feature flag 关闭 |
| `hermes_self_call_reserved` | hermes self-call 保留, 无 override |
| `no_trigger_fired` | flag 开 + target OK + 无 trigger firing |
| `null` | `snippet_attached=true` |

## 9. Safety Gate Result (2 类)

| `safety_gate_result.pass` | `reason` | 含义 |
|---------------------------|----------|------|
| `true` | `"all_gates_pass"` | preamble 已构造, 全部 safety gate 过 |
| `false` | `skip_reason ?? "no_preamble_built"` | preamble 未构造, 给出原因 |

## 10. Simulated Dispatch Prompt

| `snippet_attached` | `simulated_dispatch_prompt` |
|--------------------|------------------------------|
| `true` | `${simulated_preamble}\n\n${baseTaskPrompt}` |
| `false` | `${baseTaskPrompt}` (verbatim, no preamble) |

`baseTaskPrompt` 默认空字符串; 若提供则 verbatim 保留; 不修改 user task 内容。

## 11. Snippet Source

- `buildSimulatedTaskPromptPreamble` 调用 `buildKnowledgeAgentContractSnippet` (Slice 007I) 作为 snippet source
- 不使用 inline literal
- `assertKnowledgeContractNoRuntime` (007I) + `assertKnowledgeHandoffContractNoRuntime` (007J) 的语义由 007I helper 自我保证; 008C 不重复实现
- `overrideSnippetText` 仅作为 test seam; production caller 不使用

## 12. Max Chars Enforcement

- `maxChars` 默认 `2048`
- `body.length > maxChars` → `truncated=true`, body 截断到 `maxChars`
- 截断后 `snippet_hash_or_content_hash` 重新计算 (基于 truncated body + wrapper)
- 截断前的部分不静默丢失; `truncated=true` 字面量字段是 audit trail

## 13. No Runtime Guarantee (4 字面量)

```ts
runtime_flush_allowed: false       // 永 false
runtime_dispatch_allowed: false    // 永 false
real_handoff_write_allowed: false  // 永 false
live_adapter_allowed: false        // 永 false
```

`assertKnowledgeRuntimeInjectionSimulationNoRuntime` 防御性扫描:
- 4 个 runtime flag 字段必须字面 `false`, 否则 throw
- `simulated_preamble` / `simulated_dispatch_prompt` 内不得含 call 表达式 `knowledgeIngest(` / `knowledgeSearch(` / `runPlaybook(` / `triggerCronJob(` / `sendMessage(` / `fetch(`, 否则 throw

## 14. Test Coverage (32 tests 跨 9 describe)

| Describe | Tests | 覆盖 |
|----------|-------|------|
| schema/mode | 2 | `schema_version` / `mode` / `surface` / `feature_flag.name` / `default_state` |
| feature flag behavior | 4 | flag disabled; claude_code + save; codex + research + tool_comparison; hermes_pro + research |
| skip / fallback | 5 | hermes self-call; ordinary code; ingest_draft; flush_pending; local_known+newly_found |
| max_chars | 2 | truncation; default 2048 |
| simulated_dispatch_prompt | 3 | preamble only when attached; base task preserved; empty base prefix |
| hard safety flags | 4 | 4 false literals |
| no-runtime guard | 6 | pass normal; reject 4 forged flags; reject forbidden call in output |
| shouldSimulate / build helpers | 3 | mirror matrix; null when no attach; non-null + hash when attach |
| JSON round trip + fixture | 2 | round-trip; fixture has ≥7 examples |
| no real handoff/audit write | 1 | mtime before==after, baseline matches 008B |

`tests/knowledge-runtime-injection-simulation.test.ts` → 32/32 PASS。
全 suite → 71 files / 2278 tests PASS (从 70 / 2246 → 71 / 2278, +32 新)。

## 15. Forbidden Token Scan (验收命令)

```bash
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" \
  src/shared/lib/knowledge-runtime-injection-simulation.ts \
  docs/knowledge/knowledge-runtime-injection-simulation-helper-2026-06-04.md \
  tests/knowledge-runtime-injection-simulation.test.ts \
  tests/fixtures/knowledge-reuse/runtime-injection-simulation.json
```

**结果**: 全部命中为非 call 表达式:
- 注释 (`// ... no agent subprocess ...`)
- 字段名 (`target_agent`, `simulated_dispatch_prompt`)
- 类型字符串 (`"claude_code"`, `"codex"`, `"hermes_pro"`)
- 文档 prose (`hermes self-call reserved`)
- forbidden-token 列表字符串本身 (`"knowledgeIngest("` in assertKnowledgeRuntimeInjectionSimulationNoRuntime)
- poison test 字符串 (`poisoned.simulated_preamble + "\nknowledgeIngest(x)"`)

**0 真 call 表达式命中**。

## 16. Real Directory mtime Guard

```
before 008C tests:  ~/.hermes/handoff/packs mtime=1780195726 (sec)
                    ~/.hermes/audit       mtime=1780230084 (sec)
after  008C tests:   ~/.hermes/handoff/packs mtime=1780195726  ✓ unchanged
                     ~/.hermes/audit       mtime=1780230084  ✓ unchanged
```

**结果**: 真实目录 mtime **完全不变**, 证明 008C 是 pure simulation, 0 real runtime write。

## 17. Target Agent Matrix

| Agent | flag | trigger | result |
|-------|------|---------|--------|
| `claude_code` | false | 任何 | `snippet_attached=false`, `fallback_to_l4=true`, `skip_reason="flag_disabled"` |
| `claude_code` | true | save keyword | `snippet_attached=true`, `trigger_flags.save_keyword=true` |
| `claude_code` | true | research keyword | `snippet_attached=true`, `trigger_flags.research_keyword=true` |
| `claude_code` | true | research task_kind | `snippet_attached=true`, `trigger_flags.research_task_kind=true` |
| `claude_code` | true | handoff ingest_draft | `snippet_attached=true`, `trigger_flags.has_ingest_draft=true` |
| `claude_code` | true | handoff flush_pending | `snippet_attached=true`, `trigger_flags.has_flush_pending=true` |
| `claude_code` | true | handoff local+newly | `snippet_attached=true`, `trigger_flags.has_local_known_and_newly_found=true` |
| `claude_code` | true | ordinary code | `snippet_attached=false`, `skip_reason="no_trigger_fired"` |
| `codex` | true | 任何 trigger | `snippet_attached=true` |
| `codex` | true | ordinary code | `snippet_attached=false`, `skip_reason="no_trigger_fired"` |
| `hermes_pro` | true | 任何 trigger | `snippet_attached=true`, `hermes_reserved_marker=false` |
| `hermes` | true | 任何 trigger (无 override) | `snippet_attached=false`, `skip_reason="hermes_self_call_reserved"`, `hermes_reserved_marker=true` |
| `hermes` | true | trigger + `hermesOverride=true` | `snippet_attached=true`, snippet text = reserved marker |

## 18. 不允许的下一步 (008D 之前)

- ❌ 把 simulation artifact 输入到真实 prompt builder
- ❌ 把 `simulated_dispatch_prompt` 拼接到真实 dispatch prompt
- ❌ 把 `simulated_preamble` 写入 `payload.context.contracts.knowledge_reuse` (虽然 placement 同 key, 但 008C 不与 HCC builder 接线)
- ❌ 改 default system prompt
- ❌ 改 dispatch prompt assembly
- ❌ 改 prompt builder
- ❌ 设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值
- ❌ 启任何 gateway / serve / run / agent / delegate / playbook

## 19. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 007I contract landing: `docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md` + `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 007J handoff insertion: `docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md` + `src/shared/lib/knowledge-handoff-contract.ts`
- 007K dry-run fixture: `docs/knowledge/knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md` + 3 handoff-contract fixture
- 007L handoff builder insertion: `docs/knowledge/knowledge-handoff-builder-insertion-dry-run-2026-06-03.md` + 改 `src/main/hcc-handoff-pack.ts`
- 007M chain closeout: `docs/knowledge/knowledge-handoff-builder-chain-closeout-2026-06-04.md` + 35 chain tests
- 007N landing closeout: `docs/knowledge/knowledge-claude-code-default-contract-landing-closeout-2026-06-04.md` + 1 closeout fixture + 69 tests
- 008A runtime default injection design: `docs/knowledge/knowledge-runtime-default-injection-design-2026-06-04.md` + 1 design fixture + 71 tests
- 008B runtime injection feature flag dry-run design: `docs/knowledge/knowledge-runtime-injection-feature-flag-dry-run-design-2026-06-04.md` + 1 design fixture + tests
- **008C (本 slice)**: 本 doc + `src/shared/lib/knowledge-runtime-injection-simulation.ts` + `tests/knowledge-runtime-injection-simulation.test.ts` (32 tests) + `tests/fixtures/knowledge-reuse/runtime-injection-simulation.json` (8 examples)
- 008D (待批): Runtime injection dry-run artifact chain test, 仍 no runtime
- 007H-1 (待批): renderer GateCard implementation
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 20. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
- **接 dispatch prompt runtime injection** (留 008D+ 显式批)
- **改 prompt builder** (留 008D+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008D+ 显式批)
- **把 008C simulation artifact 输入到真实 prompt builder** (留 008D+ 显式批)
- **把 `simulated_dispatch_prompt` 拼接到真实 dispatch prompt** (留 008D+ 显式批)
