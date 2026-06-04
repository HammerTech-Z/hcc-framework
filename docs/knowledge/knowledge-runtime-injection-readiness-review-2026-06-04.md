# Hermes Pro — Knowledge Runtime Injection Implementation Readiness Review (2026-06-04)

> Slice 008E — Runtime Injection Implementation Readiness Review / No Code
> 范围: readiness spec + review fixture + tests + design doc;
> **不接** runtime, **不改** system prompt, **不改** dispatch prompt, **不改** prompt builder, **不改** real handoff writer, **不写真实** handoff 写入, **不接** IPC, **不启动** Claude Code / Codex / Hermes 子进程, **不调** knowledgeIngest / knowledgeSearch / fetch。
> 上游: 004-008D
> 下游: 008F (Runtime Injection Surface B Dry-run Implementation Behind Flag, 待批) / 008G (Prompt Snapshot Tests, 待批) / 008H (L5 Closeout, 待批) / 007H-1 (Renderer GateCard, 若用户批 UI) / 008 (Real Live Adapter, 另批)

## 1. Purpose

完成 008E: Runtime Injection Implementation Readiness Review。

只做 readiness/spec/fixture/test, **不做 runtime 实装**。

重点: 识别未来 L5 Surface B (task prompt preamble) 真实接入点、允许文件、禁止文件、feature flag gate、rollback、PR gate、stop conditions。

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
- ❌ **不改 default system prompt** (Surface C 留 Phase 2)
- ❌ **不改 dispatch prompt builder** (008F 才允许新文件)
- ❌ **不改 real handoff writer** (留 008+ 显式批)
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`
- ❌ 不动 runtime helper / builder (007I / 007J / 007L / 008C 已定型)

## 3. Code Surface Discovery (8 surfaces)

| ID | Path | Role | Touch? | Risk | Rollback |
|----|------|------|--------|------|----------|
| `surface_a_handoff_payload_context` | `src/main/hcc-handoff-pack.ts` (buildHCCHandoffPayload, payload.context.contracts.knowledge_reuse) | HCC handoff builder injects snippet envelope at L4 (Slice 007K/007L/007M) | ✅ | low | low |
| `surface_b_task_prompt_preamble` | no real prompt builder exists in src/main; would be NEW function (e.g. `src/main/task-prompt-builder.ts`) gated by `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` | Future: prepend dry-run contract snippet to base task prompt at dispatch time (Phase 1 recommendation from 008A) | ✅ | medium | medium |
| `surface_c_default_system_prompt` | no agent default system prompt mutation anywhere; would be NEW fragment in agent system prompt (e.g. Claude Code CLAUDE.md, Codex AGENTS.md, Hermes default prompt) | Future Phase 2: embed contract snippet as global default system prompt fragment | ❌ | high | high |
| `surface_renderer_knowledge_ui` | `src/renderer/src/screens/Knowledge/Knowledge.tsx` + `src/preload/index.ts` (knowledgeIngest/knowledgeSearch wrappers hit 127.0.0.1:8643) | Renderer-side knowledge UI; uses renderer-bound IPC; no main-side dispatch involvement | ❌ | medium | low |
| `surface_ipc_knowledge_adapters` | `src/preload/index.ts` lines 800-820 (knowledgeSearch / knowledgeIngest / knowledgeStats) + matching main process IPC handler | Renderer-bound fetch to Hermes backend; user-invoked, not task-dispatched | ❌ | medium | low |
| `surface_audit_handoff_writer` | no real handoff/audit writer in current scope; 008D chain returns in-memory artifact only; 007L handoff fixture write/read limited to tmpDir | Future: real handoff write to `~/.hermes/handoff/packs` and `~/.hermes/audit` | ❌ | high | high |
| `surface_task_runner_dry_run` | `src/main/hcc-task-runner.ts` (buildHCCTaskPlan, executable=false literal) | Pure dry-run planning skeleton; HCC Auto Executor not approved, not started | ❌ | low | low |
| `surface_simulation_helper_008c` | `src/shared/lib/knowledge-runtime-injection-simulation.ts` | Pure simulation helper; produces dry-run artifact only; no I/O, no IPC | ✅ | low | low |

**Touch allowed**: 3/8 (surface_a, surface_b, surface_simulation_helper_008c).
**Touch forbidden**: 5/8 (surface_c, surface_renderer_knowledge_ui, surface_ipc_knowledge_adapters, surface_audit_handoff_writer, surface_task_runner_dry_run).

## 4. Recommended Surface (Surface B)

**Surface B — task_prompt_preamble — Phase 1 recommendation**

Rationale (008A § 7):
1. Surface A already covered by L4 (Slice 007K/007L/007M); no L5 work needed for A.
2. Surface B narrower than C: only Hermes-dispatched tasks receive preamble.
3. Surface C mutates global default system prompt; high blast radius, pollutes non-Hermes tasks.
4. Surface B is reversible per slice: misbehave → remove preamble step; C is not.

## 5. Not Recommended Surface (Surface C)

**Surface C — default system prompt fragment — Phase 2, NOT first step**

Rationale:
1. High blast radius: affects ALL tasks the agent handles, including non-Hermes-dispatched.
2. Not slice-reversible: requires revert of system prompt change; rollback more complex than B.
3. 008A § 7 explicit: not recommended as first step; revisit only after B stable in production.
4. Touches locked files (CLAUDE.md, AGENTS.md, Hermes default prompt) which are explicitly frozen by 007N / 008D.

## 6. Future Implementation Boundary (008F)

Allowed:
- ✅ Read feature flag `KNOWLEDGE_CONTRACT_INJECTION_ENABLED`
- ✅ Call 008C pure simulation helper (`buildKnowledgeRuntimeInjectionSimulation`)
- ✅ Prepend `simulated_preamble` to base task prompt string
- ✅ Preserve base task prompt verbatim
- ✅ Return composed prompt string

Forbidden:
- ❌ Mutate default system prompt
- ❌ Spawn Agent subprocess
- ❌ Call `knowledgeIngest` / `knowledgeSearch` / `fetch`
- ❌ Write to `~/.hermes/handoff/packs` or `~/.hermes/audit`
- ❌ Set `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` as default

## 7. Feature Flag Readiness

| Field | Value |
|-------|-------|
| name | `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` |
| default | `false` (must stay false until 008F+ explicit user approval) |
| off | `snippet_attached=false` + `fallback_to_l4=true` + `skip_reason='flag_disabled'` |
| on | still requires trigger fired + target allowed (claude_code/codex/hermes_pro; hermes reserved skip) |
| hermes | default reserved skip unless `hermesOverride=true` (uses reserved marker text) |

## 8. Target Agent Matrix (008F)

| Agent | default_inject | 008F behavior |
|-------|----------------|---------------|
| `claude_code` | true | attach when flag+trigger+research/save/ingest intent |
| `codex` | true | attach when flag+trigger+research/save/ingest intent |
| `hermes_pro` | opt-in | attach when flag+trigger; today not default-injected |
| `hermes` (self-call) | false | reserved skip unless `hermesOverride=true`; reserved marker text only |

## 9. Safety Gate Matrix (11 gates)

1. `no_runtime_write` — 4 literal false flags (runtime_flush_allowed / runtime_dispatch_allowed / real_handoff_write_allowed / live_adapter_allowed)
2. `no_ipc` — no ipcMain / ipcRenderer / window.hermesAPI.* in 008F helper
3. `no_gateway` — no serve / run / agent / delegate / playbook / cron in 008F helper
4. `no_ingest_search` — no `knowledgeIngest(` / `knowledgeSearch(` / `fetch(` call expression in 008F helper output
5. `no_agent_subprocess_in_tests` — no spawn / child_process / runPlaybook in 008F test
6. `no_default_system_prompt_mutation` — no write to CLAUDE.md / AGENTS.md / Hermes default prompt
7. `no_dispatch_builder_mutation` — no write to src/main dispatch prompt builder path; new file only
8. `no_deceptive_copy` — no 已保存 / 写入成功 / saved successfully / will be written after confirm in preamble
9. `no_obsidian_memory_wolf_path` — no positive recommendation in preamble
10. `no_source_fidelity_drift` — 007I `assertSnippetShape` ok=true must hold
11. `no_bucket_semantics_drift` — 007I bucket rules preserved in preamble

## 10. Stop Conditions (12 conditions)

1. Discovers need to mutate default system prompt (CLAUDE.md / AGENTS.md / Hermes default)
2. Discovers need for IPC / gateway wiring
3. Discovers need for live handoff writer to `~/.hermes/handoff/packs` or `~/.hermes/audit`
4. Ordinary code-only task gets snippet injected (`skip_reason` should be `no_trigger_fired`)
5. Feature flag default != false (must stay false until 008F+ explicit user approval)
6. Hermes self-call gets default injection (must stay reserved skip unless explicit override)
7. Base task prompt is overwritten (must be preserved verbatim, only preamble prepended)
8. Runtime flags can be forged to true (008C `assertNoRuntime` must reject)
9. Forbidden copy appears in simulated preamble (no 已保存 / 写入成功 / saved successfully / will be written after confirm)
10. mtime changes on `~/.hermes/handoff/packs` or `~/.hermes/audit`
11. `knowledgeIngest(` / `knowledgeSearch(` / `fetch(` appears as call expression in 008F output
12. `executable_steps` / `verificationCommands` / `next_actions` call-form action appears in payload

## 11. Future Slice Proposal (008F / 008G / 008H)

### 11.1 Slice 008F — Runtime Injection Surface B Dry-run Implementation Behind Flag

- 范围: Implement narrow Surface B preamble assembly behind `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` flag. Read flag, call 008C simulation helper, prepend `simulated_preamble` to base task prompt string. Return composed prompt; **do NOT call any real dispatcher**. Pure string composition only.
- 触发条件: 008E passes + user explicit approval
- Allowed: read feature flag / call 008C helper / prepend preamble / preserve base / return composed string
- Forbidden: mutate default system prompt / spawn Agent subprocess / call knowledgeIngest or knowledgeSearch / write to real handoff/audit / set flag default true

### 11.2 Slice 008G — Runtime Injection Prompt Snapshot Tests

- 范围: Capture prompt snapshots for full feature flag matrix + trigger matrix + target agent matrix. Verify preamble composition matches 008C simulation output (byte-for-byte when override is set). Pure test only; no runtime.
- 触发条件: 008F passes + user explicit approval

### 11.3 Slice 008H — L5 Closeout / No L6

- 范围: Closeout review for L5 (Surface B behind flag). Mark L5 reached. **NOT-GO for L6** (live search / live flush). Stop at L5; L6留 separate ADR + explicit user approval.
- 触发条件: 008G passes + user explicit approval

## 12. Go / No-Go Decision

### 12.1 GO

- ✅ **GO** for 008F implementation planning (narrow Surface B dry-run implementation behind flag)
- ✅ **GO** for 008G prompt snapshot tests
- ✅ **GO** for 008H L5 closeout

### 12.2 NOT-GO

- ❌ **NOT-GO** for default system prompt mutation (Surface C留 Phase 2)
- ❌ **NOT-GO** for live adapter / live flush / live knowledgeSearch / live knowledgeIngest
- ❌ **NOT-GO** for gateway / IPC / Agent subprocess in dispatch path
- ❌ **NOT-GO** for real handoff write to `~/.hermes/handoff/packs` or `~/.hermes/audit`
- ❌ **NOT-GO** for changing `KNOWLEDGE_CONTRACT_INJECTION_ENABLED` default to true
- ❌ **NOT-GO** for renderer UI实装 (留 007H-1)

## 13. Validation Commands

```bash
cd /Users/midoudou/hermes-pro

# 1. typecheck
npm run typecheck

# 2. 008E 单独
npx vitest run tests/knowledge-runtime-injection-readiness-review.test.ts

# 3. 全 suite
npx vitest run

# 4. git diff clean
git diff --check

# 5. forbidden token scan
rg -n "knowledgeIngest\(|knowledgeSearch\(|fetch\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task" \
  tests/knowledge-runtime-injection-readiness-review.test.ts \
  tests/fixtures/knowledge-reuse/runtime-injection-readiness-review.json \
  docs/knowledge/knowledge-runtime-injection-readiness-review-2026-06-04.md

# 6. mtime guard
stat -f "%m %N" /Users/midoudou/.hermes/handoff/packs /Users/midoudou/.hermes/audit
```

## 14. Remaining Gaps

008E 不解 (留未来 slice):

- ❌ **L5 真实 runtime default injection** — 008F (Surface B) 仍需用户显式批
- ❌ **L6 live search / live flush** — 留独立 ADR + 显式批
- ❌ **真实 handoff 写入** — 留 008+ 显式批
- ❌ **真实 audit log 写入** — 留 008+ 显式批
- ❌ **IPC adapter** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1~7
- ❌ **Surface C (global default system prompt)** — 留 Phase 2 + ADR + 显式批

## 15. Next Slices

按依赖顺序:

### 15.1 Slice 007H-1 — Renderer GateCard Implementation (若用户要 UI)

- 范围: 渲染层 GateCard
- 触发条件: 用户**显式批**本 slice
- 与 008E 互不依赖

### 15.2 Slice 008F — Surface B Dry-run Implementation Behind Flag (推荐, 若用户要 L5)

- 触发条件: 008E 通过 + 用户**显式批**
- 必跑 11 safety gates + 12 stop conditions + 008A 10 + 008B 11 + 008C 4 字面量 false 验证 + 008D 20 invariants

### 15.3 Slice 008G — Prompt Snapshot Tests

- 触发条件: 008F 通过 + 用户**显式批**

### 15.4 Slice 008H — L5 Closeout / No L6

- 触发条件: 008G 通过 + 用户**显式批**
- 必跑 008A/008B/008C/008D/008E/008F/008G 全量

### 15.5 Slice 008 — Real Live Adapter (留 008+ 显式批)

- 范围: 真实 IPC adapter (Handoff Pack / audit log / 幂等 / rate limit / rollback)
- 触发条件: 008H 通过 + 用户**显式批**

### 15.6 远期 — Surface C (Phase 2, 留 ADR + 显式批)

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
- **接 dispatch prompt runtime injection** (留 008F+ 显式批)
- **改 prompt builder** (留 008F+ 显式批)
- **写真实 runtime injection** (留 008+ 显式批)
- **设 `KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true` 默认值** (留 008F+ 显式批)
- **把 008D chain artifact 输入到真实 prompt builder** (留 008F+ 显式批)
- **把 `simulated_dispatch_prompt` 拼接到真实 dispatch prompt** (留 008F+ 显式批)

## 17. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 007I: `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 007J: `src/shared/lib/knowledge-handoff-contract.ts`
- 007L: `src/main/hcc-handoff-pack.ts` (handoff builder)
- 007M: chain test
- 007N: landing closeout
- 008A: design
- 008B: feature flag design
- 008C: pure simulation helper
- 008D: artifact chain test
- **008E (本 slice)**: 本 doc + `tests/fixtures/knowledge-reuse/runtime-injection-readiness-review.json` + `tests/knowledge-runtime-injection-readiness-review.test.ts` (44 tests)
- 008F (待批): Surface B Dry-run Implementation Behind Flag
- 008G (待批): Prompt Snapshot Tests
- 008H (待批): L5 Closeout / No L6
- 007H-1 (待批): Renderer GateCard
- 008 (待批): Real Live Adapter
