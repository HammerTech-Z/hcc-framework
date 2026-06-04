# Hermes Pro — Knowledge Handoff Builder Chain Closeout (2026-06-04)

> Slice 007M — Handoff Builder Fixture Closeout / Chain Test
> 范围: 端到端 chain test (plan → 007L builder → 007K fixture shape 对比 → invariant) + tmpDir-only fixture write/read + closeout 文档; **不写真实** `~/.hermes/handoff/packs`, **不接** runtime, **不启动** Claude Code / Codex / Hermes 子进程。
> 上游: 004-007L
> 下游: 007N (Claude Code Default Contract Landing Closeout) / 008A (real adapter design, 仍 no runtime) / 真实 handoff runtime 接线 (另批)

## 1. Purpose

做 Handoff builder fixture closeout / chain test, 验证:

`request/plan → buildHCCHandoffPayload(... knowledgeContract ...) → payload.context.contracts.knowledge_reuse → 对比 007K fixture shape → invariant check`

本 slice 仍是 tests / docs / fixture closeout, **不写真实** handoff 写入, **不接** runtime。

## 2. Non-goals

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
- ❌ 不接 IPC / gateway / serve / run / agent / delegate / playbook
- ❌ 不改 `package.json` / `electron.vite.config.ts`

## 3. Chain under test

```
[ representative HCCTaskPlan ]
  ↓ buildHCCHandoffPayload(plan, { knowledgeContract: { ... } })
[ HCCHandoffPayload (in memory) ]
  ↓ payload.context.contracts.knowledge_reuse
[ KnowledgeHandoffContractSnippet ]
  ↓ validate / assertNoRuntime
[ 13 字段 envelope + 4 字面量 ]
  ↓ JSON.stringify → writeHCCHandoffPayloadFixture → tmpDir/<subdir>/payload-<task_id>.json
[ on-disk fixture in tmpDir ONLY ]
  ↓ readHCCHandoffPayloadFixture
[ restored HCCHandoffPayload (in memory) ]
  ↓ shape compare vs tests/fixtures/knowledge-reuse/handoff-contract/*.json
[ fixture comparison invariant ]
```

每 stage 均为 pure 或 tmpDir-only。**0 real handoff write**, **0 IPC**, **0 runtime call**。

## 4. Target agent matrix (4 类)

| Agent | targetAgent | snippet | reserved | attach_reason |
|-------|-------------|--------|----------|---------------|
| `claude_code` | "claude_code" | 8 条 contract 完整 | false | "user-request-contains-save-keyword" / "task-kind-is-..." / "user-request-contains-research-keyword" |
| `codex` | "codex" | 8 条 contract 完整 | false | 同上 |
| `hermes_pro` | "hermes_pro" | 8 条 contract 完整 | false | 同上 (留 future opt-in) |
| `hermes` | "hermes" | "[reserved — no default attach for hermes self-call]" | true (envelope 仍附) | "hermes-reserved-no-default-attach" |

## 5. Fixture comparison (007K vs 007M builder)

| 007K fixture | 007M builder | Schema key set |
|--------------|---------------|----------------|
| `claude-code-handoff-contract.json` | `buildForAgent("claude_code")` | 12 必含 key 全部匹配 |
| `codex-handoff-contract.json` | `buildForAgent("codex")` | 12 必含 key 全部匹配 |
| `hermes-handoff-contract-reserved.json` | `buildForAgent("hermes")` | hermes reserved 语义匹配 (attach_reason 含 "reserved", snippet_text 含 "[reserved ...]") |

## 6. Invariants verified (12 项)

1. ✅ placement exact: `payload.context.contracts.knowledge_reuse` (PLACEMENT_KEY)
2. ✅ `dry_run_only: true` (literal)
3. ✅ `runtime_flush_allowed: false` (literal)
4. ✅ `forbidden_runtime_checked: true` (literal)
5. ✅ `snippet_version: "1.0.0"` (stable)
6. ✅ `attach_reason` non-empty
7. ✅ `trigger_flags` 6 booleans 全为 boolean 类型
8. ✅ `snippet_text.length <= max_chars`
9. ✅ `executable_steps` 未在 payload 出现
10. ✅ `verificationCommands` 未在 payload 出现
11. ✅ `next_actions[].action` 不含 call-form runtime action (`knowledgeIngest(` / `runPlaybook(` / `triggerCronJob(`)
12. ✅ `validateKnowledgeHandoffContractSnippet(env)` ok=true + `assertKnowledgeHandoffContractNoRuntime(env)` 不 throw

## 7. TmpDir-only write/read

- 写盘唯一合法路径: `os.tmpdir()` (e.g. `/tmp/claude-501/hcc-007M-xxxx/`)
- `writeHCCHandoffPayloadFixture` 防御 guard: subdir `..` → throw "escapes tmpDir"
- 写盘文件名: `payload-<task_id>.json` (含 task_id, 不可绕过)
- `readHCCHandoffPayloadFixture` 仅读 tmpDir 内, 防御 guard 同 write
- 测试 `beforeAll` 创建 tmpDir, `afterAll` `rmSync({ recursive: true, force: true })` 清理
- 0 写真实 `~/.hermes/handoff/packs`

## 8. Real handoff / audit mtime guard (CRITICAL)

```
before tests:  ~/.hermes/handoff/packs mtime=1780195726
               ~/.hermes/audit       mtime=1780230084

after tests:   ~/.hermes/handoff/packs mtime=1780195726  ✓ unchanged
               ~/.hermes/audit       mtime=1780230084  ✓ unchanged
```

**结果**: 真实目录 mtime **完全不变**。

## 9. Results

| Test file | tests | result |
|-----------|-------|--------|
| `tests/safety/hcc-handoff-knowledge-contract-chain.test.ts` (新增) | 35 | **PASS** |
| `tests/safety/hcc-handoff-knowledge-contract.test.ts` (007L) | 36 | **PASS** (无回归) |
| `tests/safety/hcc-handoff-pack.test.ts` (既存) | 29 | **PASS** (无回归) |
| `tests/knowledge-handoff-contract-fixture.test.ts` (007K) | 101 | **PASS** (无回归) |
| 全 suite (`npx vitest run`) | 2031 | **2031/2031 PASS** (67 files) |
| typecheck (node + web) | — | **EXIT 0** (双端) |
| `git diff --check` | — | clean |
| 真实 `~/.hermes/handoff/packs` mtime | — | **unchanged** (1780195726) |
| 真实 `~/.hermes/audit` mtime | — | **unchanged** (1780230084) |

## 10. Remaining gaps

未来 slice 必做 (007M 不解):

- ❌ **真实 handoff 写盘** — 留 008+ 显式批, 需先经 Slice 008A real adapter design
- ❌ **真实 audit log 写盘** — 留 008+ 显式批
- ❌ **renderer UI 实装** — 留 007H-1~7 (用户批 UI 实装)
- ❌ **system prompt 落地** — 留 007N Claude Code Default Contract Landing Closeout
- ❌ **i18n 资源** — 留 008+ 实施时补

## 11. Next slices

按依赖顺序:

### 11.1 Slice 007N — Claude Code Default Contract Landing Closeout (推荐下一步)

- 范围: 把 snippet helper 落地为 Claude Code / Codex / Hermes Pro 的 default system prompt 段, **仍 spec only**, 不接 runtime
- 触发条件: 007M 通过 + 用户**显式批**
- 预计文件:
  - `docs/knowledge/knowledge-claude-code-default-contract-landing-2026-06-XX.md` (待批)
  - `tests/knowledge-claude-code-default-contract.test.ts` (待批)
- 预计内容: 三端 system prompt 段 / fallback 链 / override 机制 / forbidden copy scanner gate

### 11.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec, 含 Handoff Pack / audit log / 幂等 / rate limit / rollback
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)
- 预计 test:
  - adapter shape 校验 (待批)

### 11.3 真实 handoff builder 实际写盘 (留 008+ 显式批)

- 触发条件: 007M 通过 + 007N + 008A + 用户**显式批**
- 必跑 007M 全部 12 invariant + mtime guard

## 12. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 速查: `docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md` (Slice 006.6)
- 评估: `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` (Slice 006.7)
- fidelity: `validateKnowledgeSourceFidelity` (Slice 006.8)
- bucket: `BucketSemanticsResult` (Slice 006.9)
- 007A design: `docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-contract.ts`
- 007B pure helper: `docs/knowledge/knowledge-live-flush-contract-helper-2026-06-03.md`
- 007C UI design: `docs/knowledge/knowledge-live-flush-ui-confirmation-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-ui-contract.ts`
- 007D copy deck: `docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md` + 3 fixtures
- 007E renderer plan: `docs/knowledge/knowledge-live-flush-renderer-implementation-plan-2026-06-03.md`
- 007F fixture acceptance: `docs/knowledge/knowledge-live-flush-renderer-fixture-acceptance-spec-2026-06-03.md` + 3 spec fixture
- 007G readiness review: `docs/knowledge/knowledge-live-flush-renderer-readiness-review-2026-06-03.md` + readiness-review.json
- 007H slice plan: `docs/knowledge/knowledge-live-flush-renderer-slice-plan-2026-06-03.md` + renderer-slice-plan.json
- 007I contract landing: `docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md` + `src/shared/lib/knowledge-agent-contract-snippet.ts`
- 007J handoff insertion: `docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md` + `src/shared/lib/knowledge-handoff-contract.ts`
- 007K dry-run fixture: `docs/knowledge/knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md` + 3 handoff-contract fixture
- 007L handoff builder insertion: `docs/knowledge/knowledge-handoff-builder-insertion-dry-run-2026-06-03.md` + 改 `src/main/hcc-handoff-pack.ts`
- **007M (本 slice)**: 本 doc + `tests/safety/hcc-handoff-knowledge-contract-chain.test.ts` (35 tests)
- 007N (待批): Claude Code Default Contract Landing Closeout
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 13. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
