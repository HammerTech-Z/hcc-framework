# Hermes Pro — Knowledge Handoff Builder Insertion Dry-run (2026-06-03)

> Slice 007L — Handoff Builder Insertion Dry-run Pure Integration
> 范围: 改 `src/main/hcc-handoff-pack.ts` 的 dry-run builder 接入 007J helper + tests; **不写真实** `~/.hermes/handoff/packs`, **不接** runtime, **不启动** Claude Code / Codex / Hermes 子进程。
> 上游: 004-007K (helper / contract / dry-run / fidelity / bucket / 007A design / 007B pure helper / 007C UI design / 007D copy deck / 007E renderer plan / 007F fixture acceptance / 007G readiness / 007H slice plan / 007I contract landing / 007J handoff insertion design / 007K dry-run fixture)
> 下游: 007M (Handoff builder fixture closeout / chain test) / 008A (real adapter design, 仍 no runtime) / 真实 handoff runtime 接线 (另批)

## 1. Purpose

把 knowledge contract snippet 接入 HCC handoff dry-run builder, 使 dry-run handoff payload 可在内存/测试 fixture 中包含 `payload.context.contracts.knowledge_reuse`。

当前状态 (007K 完成):

- ✅ `KnowledgeHandoffContractSnippet` schema 已定义 (13 字段, 4 字面量)
- ✅ `buildKnowledgeHandoffContractSnippet` / `validate*` / `assert*` 3 纯函数已落地
- ✅ 3 golden fixture (claude_code / codex / hermes-reserved)
- ❌ **未接入** `src/main/hcc-handoff-pack.ts` 实际 builder

本 slice 在 builder 添加 optional `knowledgeContract` option, 当 caller 传时构造 envelope 并插入 `payload.context.contracts.knowledge_reuse`。**dry-run only, no real write, no IPC, no runtime**。

## 2. Non-goals (本 slice 明确不做)

- ❌ 不写真实 `~/.hermes/handoff/packs` (本 slice 仍 dry-run)
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

## 3. Builder changes (新增)

### 3.1 `HCCHandoffPayload` schema (新增 optional `context` 字段)

```ts
export interface HCCHandoffPayload {
  // ... 既有 20+ 字段不变 ...
  // Slice 007L: read-only contract field. Always absent (or present) per
  // knowledgeContract option. NEVER carries executable payload. NEVER
  // overrides dry_run_only / runtime_flush_allowed invariants.
  context?: {
    contracts?: {
      knowledge_reuse?: KnowledgeHandoffContractSnippet;
    };
  };
}
```

**未传 `knowledgeContract` option 时** `payload.context` 完全缺席, 旧行为零变化。

### 3.2 `BuildHCCHandoffPayloadOptions` 新增

```ts
knowledgeContract?: {
  targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes";
  userRequest?: string;
  taskKind?: string;
  hasIngestDraft?: boolean;
  hasFlushPending?: boolean;
  hasLocalKnownAndNewlyFound?: boolean;
};
```

完全 optional; 未传时旧行为不变。

### 3.3 Builder logic (新增 30 行)

```ts
if (options.knowledgeContract) {
  const kc = options.knowledgeContract;
  const isHermes = kc.targetAgent === "hermes";
  const envelope = buildKnowledgeHandoffContractSnippet({
    target_agent: kc.targetAgent,
    now_iso: createdAt,
    max_chars: 2048,
    // 007L: caller is the HCC handoff builder at the system boundary;
    // explicit attach intent. Bypass 007J's shouldAttach trigger check
    // (which expects end-user-style request_text). The envelope's own
    // literal invariants still apply.
    caller_explicit_attach: true,
    attach_context: { ... },
    // For hermes, force a reserved marker so the contract is inert.
    override_snippet_text: isHermes
      ? "[reserved — no default attach for hermes self-call]"
      : undefined,
  });
  if (isHermes) {
    envelope.attach_reason = "hermes-reserved-no-default-attach";
  }
  payload.context = { contracts: { knowledge_reuse: envelope } };
}
```

## 4. Target agent behavior

| Agent | targetAgent | snippet | reserved | attach_reason |
|-------|-------------|--------|----------|---------------|
| `claude_code` | "claude_code" | 8 条 contract 完整 | false | "user-request-contains-save-keyword" / "task-kind-is-..." / "user-request-contains-research-keyword" |
| `codex` | "codex" | 8 条 contract 完整 | false | 同上 |
| `hermes_pro` | "hermes_pro" | 8 条 contract 完整 | false | 同上 (留 future opt-in) |
| `hermes` | "hermes" | "[reserved — no default attach for hermes self-call]" | true (附 envelope, attach_reason = "hermes-reserved-no-default-attach") |  |

## 5. Placement assertions (硬规则, 8 项)

1. ✅ `payload.context.contracts.knowledge_reuse.dry_run_only === true`
2. ✅ `payload.context.contracts.knowledge_reuse.runtime_flush_allowed === false`
3. ✅ `payload.context.contracts.knowledge_reuse.forbidden_runtime_checked === true`
4. ✅ `payload.context.contracts.knowledge_reuse.target_agent` 在白名单
5. ✅ `payload.context.contracts.knowledge_reuse.snippet_text` ≤ `max_chars`
6. ✅ `payload.context.contracts.knowledge_reuse.snippet_text` 不含 forbidden call
7. ✅ `payload.context.contracts.knowledge_reuse.attach_reason` 非空
8. ✅ 顶层 `payload.runtime_flush_allowed === false` (经 `payload.safety.redaction_status = "not_run"` 验证)

**不放**:
- ❌ `executable_steps` (新增 0 行)
- ❌ `verificationCommands` (新增 0 行)
- ❌ `next_actions[].action` 改为 call 形式 (保持 audit step)
- ❌ `payload.artifact_ref` 改向 `~/.hermes/handoff/packs` (仍 `hcc-dry-run://` 前缀)

## 6. Tests added

新增 `tests/safety/hcc-handoff-knowledge-contract.test.ts` (8 大组 36 tests):

- no knowledgeContract option → payload.context 缺席
- claude_code + save trigger → context 含 knowledge_reuse
- codex + save trigger → context 含 knowledge_reuse
- hermes target → reserved / no default attach
- placement exact: `context.contracts.knowledge_reuse`
- snippet NOT in executable_steps / verificationCommands
- next_actions do not contain call-form runtime action
- 007J invariant: no `knowledgeIngest(` as a call in payload
- JSON round trip
- real `~/.hermes/handoff/packs` mtime unchanged
- real `~/.hermes/audit` mtime unchanged
- existing handoff invariants preserved (next_actions / safety / current_state)

## 7. Verifier expectations

未来 verifier (留 008A) 必过:

1. `payload.context?.contracts?.knowledge_reuse` 存在 当 `options.knowledgeContract` 提供
2. `dry_run_only: true` (literal)
3. `runtime_flush_allowed: false` (literal)
4. `forbidden_runtime_checked: true` (literal)
5. 13 字段 envelope shape 通过 `validateKnowledgeHandoffContractSnippet`
6. `target_agent` ∈ {claude_code / codex / hermes_pro / hermes}
7. `snippet_text.length <= max_chars`
8. `payload.executable_steps === undefined`
9. `payload.verificationCommands === undefined`
10. `next_actions[].action` 不含 `knowledgeIngest(` / `runPlaybook(`
11. 真实 `~/.hermes/handoff/packs` mtime 不变 (CRITICAL)

## 8. Forbidden placement assertions (硬规则)

未来 verifier 必拒以下 5 类 misplaced:

1. `executable_steps` 含 snippet
2. `verificationCommands` 含 snippet
3. `next_actions[].action` 是 call 形式 runtime action
4. `artifact_ref` 改向 `~/.hermes/handoff/packs`
5. `audit` 路径引用

唯一合法 placement: `payload.context.contracts.knowledge_reuse` (read-only contract field)。

## 9. Future implementation slices

按依赖顺序:

### 9.1 Slice 007M — Handoff Builder Fixture Closeout / Chain Test (推荐下一步)

- 范围: 端到端 chain test, 从 plan 构造 → 007L builder 接入 → 007K fixture 形状对比 → 12+ invariant 校验, **仍 no real write**
- 预计文件:
  - `tests/safety/hcc-handoff-contract-chain.test.ts` (新 test, 端到端)
- 预计内容: 全链路 dry-run chain test

### 9.2 Slice 008A — Real Adapter Implementation Design (no runtime)

- 范围: 真实 IPC adapter 的 design-only spec
- 仍不动 IPC
- 预计文件:
  - `docs/knowledge/knowledge-live-flush-adapter-implementation-design-2026-06-XX.md` (待批)
  - `src/main/knowledge-flush-adapter.d.ts` (类型 only, 待批)

### 9.3 真实 handoff builder 实际写盘 (留 008+ 显式批)

- 触发条件: 007M 通过 + 用户**显式批**
- 必跑 007L 全部 verifier expectations + 007M chain test

## 10. 链路索引

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
- **007L (本 slice)**: 本 doc + 改 `src/main/hcc-handoff-pack.ts` (新增 `context` 字段 + `knowledgeContract` option) + `tests/safety/hcc-handoff-knowledge-contract.test.ts`
- 007M (待批): Handoff builder fixture closeout / chain test
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening

## 11. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

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
- 真实 `~/.hermes/handoff/packs` / `~/.hermes/audit` 写入 (留 008+ 显式批)
- 写真实 handoff payload (本 slice 仍 dry-run)
- 启 dev server / 跑 Playwright / 采集截屏
- 改 Claude Code runtime binary
- 启动 Claude Code / Codex / Hermes 子进程
- 改 `payload.executable_steps` / `payload.verificationCommands` / `next_actions[].action` 为 call 形式
