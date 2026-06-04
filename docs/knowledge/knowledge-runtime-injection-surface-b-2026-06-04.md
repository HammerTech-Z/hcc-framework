# Hermes Pro — Knowledge Runtime Injection Surface B Dry-run Implementation (2026-06-04)

> Slice 008F — Surface B Dry-run Implementation / No Runtime
> 范围: pure helper + tests + fixture + design doc;
> **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008E
> 下游: 008G (Prompt Snapshot Tests, 待批) / 008H (L5 Closeout / No L6, 待批) / 008 (Real Live Adapter, 另批)

## 1. Purpose

实现 008F — Surface B Dry-run Implementation Behind Flag。

实现一个 **Surface B (task prompt preamble) 的纯 dry-run implementation helper**。在 feature flag 开启、target/trigger/gate 通过时, 返回带 knowledge contract preamble 的 task prompt 字符串。

**仍不接入真实 dispatch、仍不启动 Agent、仍不改 default system prompt、仍不写真实 handoff/audit**。

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
- ❌ **不改 dispatch prompt runtime** (留 008G+ 显式批)
- ❌ **不改 prompt builder** (留 008+ 显式批)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C 已定型)

## 3. Surface B Boundary

**Surface B = task_prompt_preamble** (008A § 7 推荐)

| Allowed (5) | Forbidden (5) |
|-------------|----------------|
| Read feature flag `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` | Mutate default system prompt |
| Call 008C pure simulation helper (`buildKnowledgeAgentContractSnippet` via 007I) | Spawn Agent subprocess |
| Prepend `simulated_preamble` to base task prompt string | Call `knowledgeIngest` / `knowledgeSearch` / `fetch` |
| Preserve base task prompt verbatim | Write to `~/.hermes/handoff/packs` or `~/.hermes/audit` |
| Return composed prompt string | Set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default |

## 4. Feature Flag Behavior

| `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` | target | trigger | result |
|----|----|----|----|
| `false` | 任何 | 任何 | `preamble_attached=false`, `fallback_to_l4=true`, `skip_reason="flag_disabled"`, `final_task_prompt=baseTaskPrompt` |
| `true` | `claude_code` | save/research/handoff | attach |
| `true` | `codex` | save/research/handoff | attach |
| `true` | `hermes_pro` | save/research/handoff | attach |
| `true` | `hermes` (无 `hermesOverride`) | 任何 | reserved skip, `hermes_reserved_marker=true` |
| `true` | `hermes` + `hermesOverride=true` | trigger fired | attach with reserved marker text |
| `true` | 任何 + no trigger | — | `skip_reason="no_trigger_fired"` |

**生产默认**: `flag_enabled=false` → L4 handoff-only 行为保留。

## 5. Input / Output Schema

### 5.1 Input

```ts
interface KnowledgeSurfaceBInput {
  featureFlagEnabled: boolean;
  targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes";
  taskKind?: string;
  userRequest?: string;
  handoffContext?: {
    hasIngestDraft?: boolean;
    hasFlushPending?: boolean;
    hasLocalKnownAndNewlyFound?: boolean;
  };
  baseTaskPrompt: string;
  maxChars?: number;
  hermesOverride?: boolean;
  overridePreambleText?: string;  // test seam
  nowIso?: string;                 // test seam
}
```

### 5.2 Output

```ts
interface KnowledgeSurfaceBOutput {
  schema_version: "1.0.0";
  slice: "008F";
  mode: "surface_b_dry_run_implementation";
  feature_flag_name: "KNOWLEDGE_CONTRACT_INJECTION_ENABLED";
  feature_flag_enabled: boolean;
  feature_flag_default_state: false;
  surface: "task_prompt_preamble";
  target_agent: KnowledgeContractTargetAgent;
  preamble_attached: boolean;
  skip_reason: string | null;
  fallback_to_l4: boolean;
  trigger_flags: { save_keyword, research_keyword, research_task_kind, has_ingest_draft, has_flush_pending, has_local_known_and_newly_found };
  base_task_prompt_preserved: true;
  final_task_prompt: string;
  preamble_text: string | null;
  preamble_hash: string;
  truncated: boolean;
  max_chars: number;
  runtime_flush_allowed: false;
  runtime_dispatch_allowed: false;
  real_handoff_write_allowed: false;
  live_adapter_allowed: false;
  hermes_reserved_marker: boolean;
  created_at: string;
}
```

## 6. Target Agent Matrix

| Agent | default_inject | 008F behavior |
|-------|----------------|---------------|
| `claude_code` | true | attach when flag+trigger+research/save/ingest intent |
| `codex` | true | attach when flag+trigger+research/save/ingest intent |
| `hermes_pro` | opt-in | attach when flag+trigger; today not default-injected |
| `hermes` (self-call) | false | reserved skip unless `hermesOverride=true`; reserved marker text only |

## 7. Trigger Matrix (8 triggers)

| Trigger | Detected by |
|---------|-------------|
| `save_keyword` (en/zh) | 007I pattern: save/persist/store/ingest + 保存/沉淀/写入/存档/存到/入库/记到/记录 |
| `research_keyword` (en) | 007I pattern: research/investigate/compare/vs./alternative/what is/how does |
| `research_keyword` (zh) | 007I pattern: 调研/研究/了解/对比/比较/选型 |
| `research_task_kind` | `taskKind ∈ {github_research, tool_comparison, technical_selection, project_research, general_research}` |
| `has_ingest_draft` | `handoffContext.hasIngestDraft === true` |
| `has_flush_pending` | `handoffContext.hasFlushPending === true` |
| `has_local_known_and_newly_found` | `handoffContext.hasLocalKnownAndNewlyFound === true` |
| ordinary code task | fires 0 triggers → skip |

## 8. Skip Reasons (3 类)

| `skip_reason` | 含义 |
|---------------|------|
| `flag_disabled` | feature flag 关闭 |
| `hermes_self_call_reserved` | hermes self-call 保留, 无 override |
| `no_trigger_fired` | flag 开 + target OK + 无 trigger firing |

When skipped: `final_task_prompt === baseTaskPrompt` (verbatim, no preamble).

## 9. Preamble Construction

- **Source**: `buildKnowledgeAgentContractSnippet` (007I) — 8-line contract
- **NOT inline literal**; always pulled from 007I helper
- **Format**:
  ```
  # Hermes Knowledge Reuse Contract — Surface B dry-run preamble
  # target_agent: <target>
  # feature_flag: KNOWLEDGE_CONTRACT_INJECTION_ENABLED=<true|false>
  # runtime_flush_allowed: false | dry_run_only: true
  
  <007I contract snippet body>
  ```
- **maxChars**: 2048 default; overflow → body truncated, `truncated=true`
- **hermes reserved marker** (when `hermesOverride=true` + hermes target): uses literal `[reserved — no default attach for hermes self-call]` text instead of 8-line contract

## 10. Base Prompt Preservation

- `baseTaskPrompt` **preserved verbatim** — no mutation, no rewrite
- When preamble attached: `final_task_prompt = ${preamble}\n\n${baseTaskPrompt}`
- When skipped: `final_task_prompt === baseTaskPrompt`
- `base_task_prompt_preserved: true` is a literal in output

## 11. No-Runtime Invariants (16 项)

1. `schema_version === "1.0.0"` (literal)
2. `slice === "008F"` (literal)
3. `mode === "surface_b_dry_run_implementation"` (literal)
4. `feature_flag_name === "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"` (literal)
5. `feature_flag_default_state === false` (literal)
6. `surface === "task_prompt_preamble"` (literal)
7. `runtime_flush_allowed === false` (literal)
8. `runtime_dispatch_allowed === false` (literal)
9. `real_handoff_write_allowed === false` (literal)
10. `live_adapter_allowed === false` (literal)
11. `base_task_prompt_preserved === true` (literal)
12. `preamble_attached === true` only when flag+target allowed+trigger fired+(hermes override OR not hermes)
13. `skip_reason ∈ {flag_disabled, hermes_self_call_reserved, no_trigger_fired, null}`
14. `fallback_to_l4 === !preamble_attached`
15. Preamble source = `buildKnowledgeAgentContractSnippet` (007I) or reserved marker; never inline literal
16. `max_chars` default 2048; overflow → `truncated=true`; `preamble_hash` = sha256(wrapped)
17. No call expression in `preamble_text` / `final_task_prompt`
18. No deceptive copy (已保存 / 写入成功 / saved successfully / will be written after confirm)

## 12. Failure Modes

| # | Failure | Detection | Response |
|---|---------|-----------|----------|
| 1 | `flag_enabled_for_wrong_task` | shouldAttach=false AND flag=true | skip `no_trigger_fired`; fall back to L4 |
| 2 | `flag_disabled_but_expected` | flag=false AND shouldAttach=true | skip `flag_disabled`; fall back to L4 |
| 3 | `snippet_overlong` | body.length > maxChars | truncate + truncated=true |
| 4 | `target_agent_blocked` | targetAgent=hermes AND override!==true | reserved skip |
| 5 | `runtime_token_detected` | assertNoRuntime returns hit | throw; abort build |
| 6 | `prompt_overpromise_detected` | forbidden deceptive-phrase present | throw; abort build |
| 7 | `base_prompt_overwritten` | baseTaskPrompt not substring of final | throw; abort build |

008F 不引入新 failure mode; 1-7 沿用 008B § 9 + 008C § 14 + 008D § 10。

## 13. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008F 单独
npx vitest run tests/knowledge-runtime-injection-surface-b.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  src/shared/lib/knowledge-runtime-injection-surface-b.ts \
  docs/knowledge/knowledge-runtime-injection-surface-b-2026-06-04.md \
  tests/knowledge-runtime-injection-surface-b.test.ts \
  tests/fixtures/knowledge-reuse/runtime-injection-surface-b.json

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 14. Remaining Gaps

008F 不解 (留未来 slice):

- ❌ **L5 真实 runtime default injection** — 008F 是 dry-run implementation, 不进真实 prompt builder
- ❌ **L6 live search / live flush** — 留独立 ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1~7
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **Prompt Snapshot Tests** — 留 008G
- ❌ **L5 Closeout** — 留 008H

## 15. Next Slices

按依赖顺序:

### 15.1 Slice 008G — Prompt Snapshot Tests (推荐下一步, 若用户要 L5 closeout)

- 范围: Capture prompt snapshots for full feature flag matrix + trigger matrix + target agent matrix. Verify preamble composition matches 008C simulation output (byte-for-byte when override is set). Pure test only; no runtime.
- 触发条件: 008F 通过 + 用户**显式批**

### 15.2 Slice 008H — L5 Closeout / No L6

- 范围: Closeout review for L5 (Surface B behind flag). Mark L5 reached. NOT-GO for L6 (live search / live flush). Stop at L5; L6留 separate ADR + explicit user approval.
- 触发条件: 008G 通过 + 用户**显式批**

### 15.3 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**本 slice
- 与 008F 互不依赖

### 15.4 Slice 008 — Real Live Adapter (留 008+ 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: 008H 通过 + 用户**显式批**
- 必跑 P2.5 safety foundation + 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008F invariants

### 15.5 远期: Surface C (Phase 2, 留 ADR + 显式批)

- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- **不推荐**作为 first step

## 16. Frozen Forbidden List (任一未来 slice 也不得触碰, 除非用户在新批)

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
- **改 global default system prompt as first step** (高 blast radius, 留 Phase 2 + 显式批)
- **接 dispatch prompt runtime injection** (留 008G+ 显式批)
- **改 prompt builder** (留 008+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **把 008F final_task_prompt 拼接到真实 dispatcher** (留 008+ 显式批)

## 17. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 007J: `src/shared/lib/knowledge-handoff-contract.ts`
- 007L: `src/main/hcc-handoff-pack.ts`
- 007M: chain test
- 007N: landing closeout
- 008A: design
- 008B: feature flag design
- 008C: pure simulation helper
- 008D: artifact chain test
- 008E: readiness review
- **008F (本 slice)**: 本 doc + `src/shared/lib/knowledge-runtime-injection-surface-b.ts` + `tests/knowledge-runtime-injection-surface-b.test.ts` (58 tests 跨 15 describe) + `tests/fixtures/knowledge-reuse/runtime-injection-surface-b.json` (7 examples + 18 invariants)
- 008G (待批): Prompt Snapshot Tests
- 008H (待批): L5 Closeout / No L6
- 007H-1 (待批): Renderer GateCard
- 008 (待批): Real Live Adapter
