# Hermes Pro — Knowledge Runtime Injection Prompt Snapshot Tests (2026-06-04)

> Slice 008G — Prompt Snapshot Tests / No Runtime
> 范围: snapshot fixture + snapshot tests + design doc;
> **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008F
> 下游: 008H (L5 Closeout / No L6, 待批) / 008 (Real Live Adapter, 另批)

## 1. Purpose

完成 008G: Prompt Snapshot Tests。

只新增 snapshot/fixture/doc/test, **锁住 008F 的 prompt 拼接输出**。不接 runtime、不改 dispatch、不启动 Agent、不写真实 handoff/audit。

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
- ❌ **不改 default system prompt runtime**
- ❌ **不改 dispatch prompt runtime**
- ❌ **不改 prompt builder**
- ❌ **不改 real handoff writer**
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C / 008F 已定型)

## 3. Snapshot Inventory (8 snapshots)

| id | flag | target | trigger | expected |
|----|------|--------|---------|----------|
| `flag_disabled_no_preamble` | false | claude_code | save | skip `flag_disabled`, `final_task_prompt === baseTaskPrompt` |
| `claude_code_research_preamble` | true | claude_code | research_keyword | attach, preamble includes 007I snippet + header |
| `codex_ingest_draft_preamble` | true | codex | has_ingest_draft | attach |
| `hermes_pro_local_newly_preamble` | true | hermes_pro | has_local_known_and_newly_found | attach |
| `hermes_reserved_no_preamble` | true | hermes | save | reserved skip, `hermes_reserved_marker=true` |
| `ordinary_code_no_preamble` | true | claude_code | (none) | skip `no_trigger_fired` |
| `truncated_preamble` | true | claude_code | save | attach with `maxChars=64`, `truncated=true` |
| `base_prompt_preserved_multiline` | true | claude_code | save | attach, multiline base prompt preserved verbatim |

## 4. Prompt Construction Boundary

**Source helper**: `buildTaskPromptWithKnowledgeContractSurfaceB` (008F) — pure function
**Snippet source**: `buildKnowledgeAgentContractSnippet` (007I) — never inline literal

**Format**:
- Preamble header: 4 comment lines + 1 blank line (stable)
  ```
  # Hermes Knowledge Reuse Contract — Surface B dry-run preamble
  # target_agent: <target>
  # feature_flag: KNOWLEDGE_CONTRACT_INJECTION_ENABLED=<true|false>
  # runtime_flush_allowed: false | dry_run_only: true
  <blank>
  ```
- Preamble body: 007I 8-line contract (claude_code / codex / hermes_pro) or reserved marker (hermes with override)
- Separator: `\n\n` (stable, no implicit drift)
- Attach case: `final_task_prompt = preamble + '\n\n' + baseTaskPrompt`
- Skip case: `final_task_prompt === baseTaskPrompt`

## 5. Preamble Stability Rules

- Header template byte-stable: 4 lines + 1 blank
- Body source: 007I helper, never inline literal
- 007I `assertSnippetShape` invariant guarantees required positive rules + excludes 5 forbidden deceptive phrases
- Override seam (`overridePreambleText`) only for tests; production callers do not use
- Hash: sha256(wrapped preamble), 64-char hex, deterministic

## 6. Base Prompt Preservation

- `baseTaskPrompt` **preserved byte-for-byte** — no rewrite, no trim, no escape
- When attached: appears as final substring of `final_task_prompt`
- When skipped: `final_task_prompt === baseTaskPrompt` (verbatim)
- Unicode / multi-line / special characters: preserved as-is
- Test seam: `base_prompt_preserved_multiline` snapshot verifies `$pecial & <chars> and unicode 你好`

## 7. Attach / Skip Matrix

| flag | target | trigger | result | skip_reason |
|------|--------|---------|--------|-------------|
| `false` | 任何 | 任何 | skip | `flag_disabled` |
| `true` | `claude_code` | save/research/handoff | attach | `null` |
| `true` | `codex` | save/research/handoff | attach | `null` |
| `true` | `hermes_pro` | save/research/handoff | attach | `null` |
| `true` | `hermes` (无 override) | 任何 | skip | `hermes_self_call_reserved` |
| `true` | `hermes` + override + trigger | — | attach (reserved marker text) | `null` |
| `true` | 任何 + no trigger | — | skip | `no_trigger_fired` |

## 8. Forbidden Copy Rules

**Deceptive copy MUST NOT appear in preamble**:
- `已保存`
- `写入成功`
- `已写入`
- `saved successfully`
- `written successfully`
- `will be written after confirm`

**Path recommendations MUST NOT positively recommend**:
- Obsidian Vault (007I mentions as `Do not ask` allowed)
- MEMORY.md (007I mentions as `Do not write to` allowed)
- .wolf/cerebrum.md (007I mentions as `Do not write to` allowed)
- notes/<topic>.md (007I mentions as `Do not write to` allowed)
- research/<date>.md (same)

**Call expressions MUST NOT appear** in `preamble_text` / `final_task_prompt`:
- `knowledgeIngest(`
- `knowledgeSearch(`
- `runPlaybook(`
- `triggerCronJob(`
- `sendMessage(`
- `fetch(`

## 9. Runtime False Invariants (per snapshot)

Each of 8 snapshots must satisfy:
- `runtime_flush_allowed === false` (literal)
- `runtime_dispatch_allowed === false` (literal)
- `real_handoff_write_allowed === false` (literal)
- `live_adapter_allowed === false` (literal)
- `feature_flag_default_state === false` (literal)
- `feature_flag_name === "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"` (literal)

Forged `true` for any of the 4 runtime flags is rejected by `assertKnowledgeSurfaceBNoRuntime`.

## 10. Snapshot Update Policy

When updating snapshots:
- **Never** weaken invariant coverage (existing 24 invariants must hold)
- **Never** introduce inline literal preamble (must remain 007I-derived)
- **Never** allow deceptive copy
- **Always** preserve `baseTaskPrompt` verbatim
- **Always** preserve separator `\n\n`
- **Always** preserve preamble header byte-stable (4 lines + 1 blank)
- **Always** keep 4 runtime flags as `false` literal
- 008F helper changes require updating snapshots + this doc + chained test

## 11. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008G 单独
npx vitest run tests/knowledge-runtime-injection-prompt-snapshot.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/knowledge-runtime-injection-prompt-snapshot.test.ts \
  tests/fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json \
  docs/knowledge/knowledge-runtime-injection-prompt-snapshots-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 12. Remaining Gaps

008G 不解 (留未来 slice):

- ❌ **L5 真实 runtime default injection** — 008G 是 snapshot test, 不进真实 dispatch
- ❌ **L6 live search / live flush** — 留独立 ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1~7
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批
- ❌ **L5 Closeout** — 留 008H
- ❌ **Real Live Adapter** — 留 008+

## 13. Next Slices

按依赖顺序:

### 13.1 Slice 008H — L5 Closeout / No L6 (推荐下一步)

- 范围: Closeout review for L5 (Surface B behind flag). Mark L5 reached. NOT-GO for L6 (live search / live flush). Stop at L5; L6留 separate ADR + explicit user approval.
- 触发条件: 008G 通过 + 用户**显式批**
- 必跑 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E readiness + 008F 18 + 008G 24 invariants

### 13.2 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 触发条件: 用户**显式批**本 slice
- 与 008G 互不依赖

### 13.3 Slice 008 — Real Live Adapter (留 008+ 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: 008H 通过 + 用户**显式批**
- 必跑 P2.5 safety foundation + 008A 10 + 008B 11 + 008C 4 + 008D 20 + 008E readiness + 008F 18 + 008G 24 invariants

### 13.4 远期: Surface C (Phase 2, 留 ADR + 显式批)

- 触发条件: Surface B 稳定 + 单独 ADR + 显式批
- **不推荐**作为 first step

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
- **接 dispatch prompt runtime injection** (留 008+ 显式批)
- **改 prompt builder** (留 008+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008+ 显式批)
- **把 008G snapshot final_task_prompt 拼接到真实 dispatcher** (留 008+ 显式批)

## 15. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts` (snippet source for 008F preamble, used by 008G)
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
- **008G (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json` (8 snapshots + 24 invariants) + `tests/knowledge-runtime-injection-prompt-snapshot.test.ts` (49 tests 跨 9 describe)
- 008H (待批): L5 Closeout / No L6
- 007H-1 (待批): Renderer GateCard
- 008 (待批): Real Live Adapter
