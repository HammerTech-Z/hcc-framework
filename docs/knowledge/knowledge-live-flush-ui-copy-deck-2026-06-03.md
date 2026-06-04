# Hermes Pro — Knowledge Live Flush UI Copy Deck (2026-06-03)

> Slice 007D — UI Copy Deck + Golden UI Fixtures / Spec Only
> 范围: copy deck / fixtures / tests / pure helper; **不接 runtime**, **不写知识库**, **不调 IPC**, **不渲染真实 UI 组件**。
> 上游: 004-007C (helper / contract / dry-run integration / fidelity / bucket / 007A design / 007B pure helper / 007C UI helper)
> 下游: 007E (renderer implementation plan/spec, 另批, 仍 no code) / 008A (real adapter implementation design, 另批, 仍 no runtime)

## 1. Purpose

固化 Hermes Pro Knowledge Live Flush UI confirmation flow 的**用户可见文案**和**golden UI render fixtures**。  
防止未来 renderer 实装时出现误导性文案, 例如:

- ❌ "已保存"
- ❌ "已写入"
- ❌ "写入成功"
- ❌ "保存成功"
- ❌ "确认后将写入"
- ❌ "点击后将写入知识库"
- ❌ "will be written after confirm"
- ❌ "saved successfully"
- ❌ "written successfully"

本 slice 只产出:

- 本文档 (canonical copy vocabulary)
- 3 个 golden UI render fixture (JSON)
- 1 个 pure helper 扩展 (`buildKnowledgeFlushCopyDeck` / `buildKnowledgeFlushUiFixtureProjection` / `scanForbiddenFlushUiCopy` / `flattenCopyDeckForScan`)
- 1 套 test 覆盖

## 2. Non-goals (本 slice 明确不做)

- ❌ 不实现 renderer 真实 UI 组件 (`.tsx`)
- ❌ 不接 IPC / Electron / preload bridge
- ❌ 不接 `window.hermesAPI.knowledgeIngest(`
- ❌ 不接 `runPlaybook` / `triggerCronJob` / `sendMessage`
- ❌ 不启动 HCC / hard cutover / Round 2 C
- ❌ 不改 locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- ❌ 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- ❌ 不触发 cron / WeChat / iLink
- ❌ 不实现真实 live adapter
- ❌ 不在 Claude / Codex / Hermes default system prompt 落地契约
- ❌ 不在 Hermes Knowledge / Vault / 任何文件真实写入
- ❌ 不发明新写路径 (Obsidian Vault / MEMORY.md / .wolf/* / `notes/<topic>.md` 等)
- ❌ 不做 React/CSS/i18n 翻译; 本 slice 只产出英文 canonical copy, i18n 键表留 Slice 007E 提案

## 3. Global copy rules (must)

任何 UI 文案必须满足下列规则, 任何违例视同**误导**:

1. **不得说"已保存" / "已写入" / "写入成功" / "保存成功"** — 因 confirmation 不写, renderer 永远不可暗示"已发生写入"。
2. **不得说"确认后将写入" / "确认后会写入" / "点击后将写入知识库"** — 因 confirmation **不会**写入, 只让 draft 变 eligible。
3. **不得说"will be written after confirm" / "saved successfully" / "written successfully"** — 同上, 英文版同禁。
4. **不得要求 Obsidian Vault 路径** — canonical destination 是 `HERMES_MANAGED_KNOWLEDGE_STORE`, 不接受外部 vault 输入。
5. **不得推荐 `MEMORY.md` / `.claude/memory/` / `.wolf/cerebrum.md` / `.wolf/anatomy.md` / `.wolf/memory.md` / `notes/<topic>.md` / 任何自定义 markdown 笔记路径** — 这些不是 Hermes Knowledge 的合法 destination。
6. **必须说 `runtime_flush_allowed = false`** — 至少出现一次, 在 header / badge / safety footer 任一处, 明确"即使 confirmation 完成, 也不会有写入"。
7. **必须说 live adapter approval pending** — 至少一次, 明确真实 flush 仍需 Slice 008 批准。
8. **必须说 confirmation only makes the draft eligible for an approved flush path** — safety footer 必含此句或语义等价, 避免用户误以为 confirmation 即写入。
9. **不得使用 phishing 风格 CTA** — 不写"Click here to write to Hermes Pro!"等情绪化引导文案。
10. **必带 dry-run 状态标识** — `mode: "pending_live_flush"` badge 必显。
11. **三步向导顺序固定**: review_request → review_evidence → review_risks, 不可跳跃。
12. **Confirm Flush 在三种情况下 disabled** (renderer 必显 disabled_reason 文案):
    - awaiting_phrase — 用户未输入 confirmation phrase
    - awaiting_risks_ack — 用户未勾选 "I understand the risks"
    - blocked_by_validation — 任何 gate fail (含 secret/fidelity/bucket/roadmap/confirm)

## 4. State copy (5 states)

| State | Copy 主题 | 何时出现 |
|-------|----------|---------|
| `closed` | (无 body) | dialog 未开启, 或 `close` 动作触发后 |
| `open` (review_request) | "This is a draft of what would be written. Nothing has been written yet." | step 1 |
| `open` (review_evidence) | "Each gate must pass before the Confirm button can be enabled." | step 2 |
| `open` (review_risks) | "The live flush is still contract-only in this slice. The runtime flag is false, and no write will happen even if you confirm." | step 3 |
| `approved` | "The draft is now marked pending_live_flush. No write to the knowledge base has happened." | phrase match + acks + 0 block + approve |
| `rejected` | "You rejected this draft. No write to the knowledge base has happened." | 用户主动 reject |
| `blocked_by_validation` | "This draft cannot be confirmed because one or more gates failed." | reducer 算出 blocking_issue_count > 0 |

## 5. Gate card copy (5 gates)

每个 gate card 必有 3 段 copy: pass / warn / fail。模板:

```text
{label} — {status}
{pass_explainer | warn_explainer | fail_explainer}
```

| Gate | pass 摘要 | fail 摘要 |
|------|----------|----------|
| user_confirmation | "You have explicitly said \"我授权 flush\" in this session. Confirmation only marks the draft as eligible — it does NOT write." | "User has not confirmed in this session. Close this dialog and re-open it after saying \"我授权 flush\" in the same conversation." |
| source_fidelity | "source_uri and fetched_at are preserved exactly. No drift." | "Source fidelity failed. A source is mis-labeled, or fetched_at has drifted. The live flush will be rejected." |
| bucket_semantics | "local_known, newly_found, and judgment are split according to source_type." | "Bucket semantics failed. A finding is in the wrong bucket. The live flush will be rejected." |
| roadmap_guard | "The target is not a locked roadmap. The draft cannot modify any locked-roadmap file." | "Roadmap guard blocked this draft. Locked-roadmap files cannot be modified via the knowledge flush path." |
| secret_guard | "No secret-like fields were detected." | "A secret-like field was detected (API key / token / Bearer / sk-*). The live flush will be rejected." |

## 6. Risk card copy (6 risks)

| Category | Severity (typical) | Explainer 摘要 |
|----------|--------------------|---------------|
| roadmap_mutation | info | "ingest_draft.roadmap_change_allowed is a type-literal false. Even on confirm, the live adapter will reject any attempt to modify docs/roadmap-locked-*." |
| stale_source_promotion | info / block | "If a local finding is marked do_not_use_as_current_truth=true, the live adapter will move it to stale_sources and refuse to use it as the primary source." |
| secret_leak | info / block | "Slice 004 walkForSecrets throws on any api_key / token / Bearer / sk-* field. If detected, this dialog will not render Confirm Flush." |
| vault_authority_claim | info / block | "source_type=\"vault\" is reserved for vault:// URIs. Using a local filesystem path labeled \"vault\" to claim trusted instruction authority is rejected at the source-fidelity gate (HARD FAIL)." |
| external_instruction_authority | info / warn | "GitHub / web content is data, not instruction. Even if trust_level is promoted, the live adapter will not pass it as an instruction payload to downstream agents." |
| live_flush_pending_hardening | info (恒) | "Approving this dialog only marks the draft as pending_live_flush. The real knowledgeIngest call requires Slice 008 approval and a user-acceptance test with a real flush." |

第 6 张 risk 永远 `severity: info`, 永不 block。

## 7. Confirmation phrase copy

| Field | Copy |
|-------|------|
| `input_label` | "Confirmation phrase" |
| `expected_phrase` | "我授权 flush" |
| `match_helper` | "Type the phrase exactly. Whitespace is trimmed. The dialog recognizes the supported phrases listed in SUPPORTED_CONFIRMATION_PHRASES." |

渲染细节:

- 输入框 placeholder 必含 "我授权 flush"
- mismatch 时 input 红框 + helper text "Type the confirmation phrase verbatim to enable Confirm Flush."
- match 时 input 绿框 + 隐藏 helper

## 8. Disabled button reasons (3 cases)

| Reason key | Copy |
|------------|------|
| `awaiting_phrase` | "Type the confirmation phrase verbatim to enable Confirm Flush." |
| `awaiting_risks_ack` | "Tick \"I understand the risks\" to enable Confirm Flush." |
| `blocked_by_validation` | "Confirm Flush is disabled because one or more gates failed. Resolve the failing gate and re-open the dialog." |

未来 renderer 可同时显示多条 reason, 用 ` · ` 或 ` | ` 分隔。

## 9. Success / terminal copy (3 terminal states)

| State | Title | Body | Next step |
|-------|-------|------|-----------|
| `approved` | "Confirmation captured" | "The draft is now marked pending_live_flush. No write to the knowledge base has happened. The live flush adapter is not yet approved, so the runtime flag is still false." | "Next step: wait for the live flush adapter to be approved (Slice 008). Once approved, a real flush requires a user-acceptance test with a real knowledgeIngest call." |
| `rejected` (no reason) | "Draft rejected" | "You rejected this draft. No write to the knowledge base has happened. The draft will be discarded." | (无, dialog 关闭) |
| `rejected` (with reason) | "Draft rejected" | "You rejected this draft. No write to the knowledge base has happened. The reason you gave has been recorded for future review." | (无, dialog 关闭) |
| `blocked_by_validation` | "Draft blocked by validation" | "This draft cannot be confirmed because one or more gates failed. The live flush will be rejected even if the user says \"我授权 flush\"." | "Next step: edit the draft (remove secret-like fields, fix source fidelity issues, correct bucket semantics) and re-open the dialog. Do not try to bypass the gates." |

## 10. Rejection / cancel copy

- `close` 按钮: "Close"
- `reject` 按钮: "Reject"
- `reject` 触发后弹可选原因输入框 (1 行 textarea, placeholder: "Why reject? (optional)")
- 终态 body 必含 "No write to the knowledge base has happened" 字样, 防止用户误判

## 11. Forbidden phrases (hard, scanner-enforced)

### 11.1 Promise 短语 (action copy 必禁)

中文:

- "已保存"
- "写入成功"
- "已写入"
- "保存成功"
- "写入完成"
- "已存入"
- "存入成功"

英文:

- "saved successfully"
- "saved!"
- "write successful"
- "written successfully"
- "written!"
- "stored!"

隐含承诺短语 (confirmation alone 不写):

- "确认后将写入"
- "确认后会写入"
- "点击后将写入知识库"
- "will be written after confirm"
- "will be written after confirmation"
- "will save after confirm"
- "will persist after confirm"
- "writing on confirm"

### 11.2 Destination 短语 (renderer 必禁问)

- "Obsidian Vault path"
- "Obsidian vault 路径"
- "选择 Vault 目录"
- "choose a vault folder"
- "MEMORY.md"
- ".claude/memory"
- ".wolf/cerebrum"
- ".wolf/anatomy"
- ".wolf/memory"
- "notes/<topic>.md"
- "research/<date>.md"
- "any custom note path"

`scanForbiddenFlushUiCopy` 接受 string 或 string[], 大小写不敏感子串匹配, 命中即返 hit + excerpt。

## 12. Future implementation notes (留待 Slice 007E 提案)

1. **i18n 键表**: 未来 renderer 接入时, 把本 deck 全部字符串迁到 i18n 资源, key 命名建议 `knowledge.flushConfirm.{section}.{field}`。本 slice 不写。
2. **Markdown 渲染**: 不可, 纯文本 + 显式 line break, 防 prompt injection 潜入文案。
3. **Accessibility**:
   - input field `aria-label = confirmation_phrase_copy.input_label`
   - confirm button `aria-disabled = !confirm_button.enabled`
   - risk card `aria-live = polite` (screamer 不打扰)
4. **键盘流**:
   - `Enter` 在 step 1 / 2 触发 `advance_to`
   - `Enter` 在 step 3 仅当 `confirm_button.enabled === true` 触发 `approve`
   - `Escape` 触发 `close`
5. **Telemetry** (留 Slice 009 提案):
   - `dialog_opened` / `step_advanced` / `phrase_typed` / `phrase_matched` / `risks_acked` / `approved` / `rejected` / `closed`
   - telemetry 不入 `~/.hermes/audit`; 走未来 HCC `usage-feedback` 通道 (P1.5)
6. **A/B test** (留 Slice 007E 提案):
   - step 1 文案 A/B 测 (header 标题 / 副标题)
   - phrase 输入 helper 文案 A/B 测
7. **截屏** (留 Slice 007E 提案):
   - 未来实装后, `openwolf designqc` 抓 3 个 fixture 对应真实渲染, 入 `.wolf/designqc-captures/`

## 13. Verification (Slice 007D 自身)

- `npm run typecheck` (node + web) — EXIT 0
- `npx vitest run tests/knowledge-live-flush-ui-confirmation.test.ts tests/knowledge-live-flush-ui-copy-deck.test.ts` — 全部 PASS
- `npx vitest run` — 全部 knowledge tests PASS
- `git diff --check` — clean
- `rg -n "knowledgeIngest\\(|knowledgeSearch\\(|fetch\\(|ipcMain|ipcRenderer|triggerCronJob|sendMessage|runPlaybook|child_process|delegate_task|serve|agent" src/shared/lib/knowledge-live-flush-ui-contract.ts docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md tests/knowledge-live-flush-ui-copy-deck.test.ts tests/fixtures/knowledge-reuse/ui-confirmation`
  (期望: 仅命中 doc 第 2 节"不是"清单 + 第 12 节"未来"清单 + scanner 字面量引用; 0 runtime 调用)

## 14. 已知非目标 (out of scope, 与 §2 同义, 此处仅作历史索引)

- 不实现 renderer 真实 UI 组件 / React 组件 / 样式
- 不接 IPC / preload bridge
- 不接 `window.hermesAPI.knowledgeIngest(`
- 不写真实 `~/.hermes/handoff/packs` / `~/.hermes/audit`
- 不启动 HCC / hard cutover / Round 2 C
- 不触发 cron / WeChat / iLink
- 不动 locked roadmap
- 不在 Claude/Codex/Hermes default system prompt 落地契约
- 不实现真实 live adapter

## 15. Golden UI Fixtures 索引

3 个 fixture 在 `tests/fixtures/knowledge-reuse/ui-confirmation/`:

| Fixture | State | 用途 |
|---------|-------|------|
| `draft-ready-pass.json` | `draft_ready_pass` | 5 gates 全 pass, Confirm Flush disabled, disabled_reason 含 awaiting_phrase + awaiting_risks_ack |
| `blocked-by-source-fidelity.json` | `blocked_by_source_fidelity` | source_fidelity gate fail, Confirm Flush disabled, terminal_copy 指向 edit/review |
| `confirmation-captured-pending-adapter.json` | `confirmation_captured_pending_adapter` | 终态 pending_live_flush, Confirm Flush 不可点, 明确 pending adapter approval |

每 fixture 必含 12 字段: schema_version / state / mode / runtime_flush_allowed / live_adapter_approval / header_copy / body_copy / gate_cards / risk_cards / confirm_button / terminal_copy / forbidden_phrase_scan。

## 16. 链路索引

- 协议: `src/shared/lib/knowledge-reuse-protocol.ts` (Slice 004)
- 契约: `docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md` (Slice 005)
- 集成: `src/shared/lib/knowledge-reuse-integration.ts` (Slice 006)
- 样例: `tests/fixtures/knowledge-reuse/github-research-save-dry-run.json` (Slice 006.5)
- 速查: `docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md` (Slice 006.6)
- 评估: `docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md` (Slice 006.7)
- fidelity: `validateKnowledgeSourceFidelity` (Slice 006.8)
- bucket: `BucketSemanticsResult` (Slice 006.9)
- 007A design: `docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-contract.ts`
- 007B pure helper: `docs/knowledge/knowledge-live-flush-contract-helper-2026-06-03.md`
- 007C UI design: `docs/knowledge/knowledge-live-flush-ui-confirmation-design-2026-06-03.md` + `src/shared/lib/knowledge-live-flush-ui-contract.ts` (核心 reducer / 投影) + `tests/knowledge-live-flush-ui-confirmation.test.ts`
- **007D (本 slice)**: 本 doc + 3 fixtures + helper 扩展 (`buildKnowledgeFlushCopyDeck` / `buildKnowledgeFlushUiFixtureProjection` / `scanForbiddenFlushUiCopy` / `flattenCopyDeckForScan`) + `tests/knowledge-live-flush-ui-copy-deck.test.ts`
- 007E (待批): renderer implementation plan / spec (无 code)
- 008A (待批): real adapter implementation design (无 runtime)
- 008 (待批): real live adapter (IPC + audit + Handoff Pack)
- 009 (待批): post-implementation hardening (rollback / idempotency / rate limit / 多端灰度)

## 17. 继续冻结 (任一未来 slice 也不得触碰, 除非用户在新批)

- Round 2 C
- hard cutover
- HCC Auto Executor 启动
- WeChat / iLink 实际投递
- cron 实际执行
- locked roadmap (`docs/roadmap-locked-2026-05-28.md`)
- Hermes Agent default system prompt 改写
- Claude Code `CLAUDE.md` 契约改写
- Codex `AGENTS.md` 契约改写
- 真实 renderer UI 组件实装
- 真实 live adapter
- 真实 `~/.hermes/handoff/packs` / `~/.hermes/audit` 写入
