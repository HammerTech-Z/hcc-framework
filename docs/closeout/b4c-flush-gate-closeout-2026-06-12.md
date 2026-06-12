# B-4C Live Flush Gate / Adapter — Closeout — 2026-06-12

> B-4C first slice — Live Flush gate + adapter (pending_user_approval only)
> 执行人：Claude Code（独立 worktree 风格 work）
> 基座：`b0e12a5`（B-4C preflight commit 之后）
> 不启动 runtime / 不写 `~/.hermes` / 不修改任何 B-4A/B-4B 既有文件 / 不 push
> **Live Flush 未真实执行、未启用**

## 1. 改动范围

| 文件 | 类型 | 行数 | 状态 |
|---|---|---|---|
| `src/shared/lib/post-task-reflection-flush-gate.ts` | 新增 | ~190 行 | 纯契约；zero I/O |
| `src/main/safety/live-flush-adapter.ts` | 新增 | ~135 行 | main 适配器；zero I/O；singleton |
| `tests/safety/live-flush-adapter.test.ts` | 新增 | ~370 行 | 26+ 测试 |
| `tests/fixtures/learning-loop/ll014-b4c-flush-gate-quarantine.json` | 新增 | ~50 行 | 标记 B-4C 自身亦须 quarantine |
| `docs/closeout/b4c-flush-gate-closeout-2026-06-12.md` | 本报告 | — | 收口 |

**未触碰**：
- `src/main/safety/post-task-reflection-writer.ts`（B-4B 既有）
- `src/shared/lib/post-task-reflection-writer-contract.ts`（B-4A 既有）
- `src/main/**` 任何现存文件
- `src/renderer/**` / `src/preload/**` / `package.json` / `package-lock.json`
- `.claude/settings.json`
- `~/.hermes/**`

## 2. 测试结果

| 测试套件 | 结果 |
|---|---|
| `tests/safety/live-flush-adapter.test.ts` | 30+ / 30+ PASS（singleton / promotion 守卫 / verified=true 守卫 / safety flags / copy-deck / describe / 静态扫描 / gate contract） |
| `tests/post-task-reflection-writer-contract.test.ts` | 42 / 42 PASS（B-4A 仍绿） |
| `tests/post-task-reflection-writer.test.ts` | 26 / 26 PASS（B-4B 仍绿） |
| `tests/post-task-reflection-evaluator-runner.test.ts` | 18 / 18 PASS（B-3 仍绿） |
| `tests/safety/real-input-scan-gate.test.ts` | 14 / 14 PASS（B-2 仍绿） |
| `npm run typecheck` | PASS（node + web） |

## 3. 设计要点

### 3.1 Live Flush Gate Contract（pure）

- `LIVE_FLUSH_GATE_DESIGN`：`gate_status: "design_only"`，所有 runtime/apply 旗标 `false`，`auto_apply_eligible: false`，`user_approval_required: true`，`per_request_approval: true`，`copy_deck_redline_required: true`
- `LIVE_FLUSH_COPY_DECK_REDLINE`：preflight 批准的 7 行红字文案，必须在每次 buildRequest 前回显
- `LiveFlushRequest` shape：snapshot B-4B 输出（含 `output_id` / `task_id` / `verdict_id` / `quarantine_decision`），所有 9 个 runtime/apply 旗标 `false`，status 硬约束 `pending_user_approval`（不允许 `approved` / `rejected` 在 gate 层出现）
- 4 个 precondition guards：`quarantine_decision === "promotion_candidate"` / `verified !== true` / `dry_run_only === true` / `live_flush_allowed === false`
- `assertLiveFlushRequestNoRuntime`：拒绝任何篡改旗标 / 状态 / quarantine decision

### 3.2 Live Flush Adapter（main）

- 唯一未导出 class `LiveFlushAdapter`
- 唯一导出工厂 `getLiveFlushAdapter()`：singleton
- `buildRequest(output)`：复用 B-4C gate 契约，构造 `pending_user_approval` request
- `getCopyDeckRedline()`：返回 preflight 批准的红线文案
- `describe()`：返回设计描述
- 自身 9 个旗标 `false`、`dry_run_only: true`

### 3.3 单入口 / 唯一性保证

| 机制 | 证据 |
|---|---|
| 模块级 lazy singleton `_instance` | adapter 源 |
| Factory getter `getLiveFlushAdapter()` | 唯一导出入口 |
| `class LiveFlushAdapter` **未 export** | 静态测试断言 |
| 测试专用 resetter `__resetLiveFlushAdapterForTest` | 标记 test-only |
| `apply` / `flush` / `persist` / `writeToDisk` / `sendToKnowledge` / `executeFlush` 均未 export | 静态测试断言 |
| 真实 fs.write / IPC / knowledgeIngest / knowledgeSearch 调用 0 hits | 静态 + 行为测试 |

## 4. 边界与禁项（实测断言）

| 禁项 | 状态 |
|---|---|
| `fs.write` / `readFile` / `readdir` | 0 hits |
| `child_process` / `node:child_process` | 0 hits |
| `electron` / `ipcMain` / `BrowserWindow` | 0 hits |
| `spawn(` / `exec(` | 0 hits |
| `knowledgeIngest` / `knowledgeSearch`（非注释代码） | 0 hits |
| `.hermes` 字符串（非注释代码） | 0 hits |
| `live_flush_allowed: true` 字面值 | 0 hits |
| `auto_apply_eligible: true` 字面值 | 0 hits |
| 修改 B-4A / B-4B 既有文件 | 0 hits |
| 写 `~/.hermes/**` | 0 hits |
| Auto Executor 启动 | 0 |
| 启动 runtime / dev server | 0 |

## 5. 跨片集成

- **B-4A contract**（writer-contract.ts）：未修改；adapter 仅 import 类型 `WriterContractOutput`
- **B-4B writer**（writer.ts）：未修改；adapter 不调用 writer，仅消费 writer 输出
- **B-3 evaluator**（runner.ts）：未修改；adapter 不调用 evaluator

## 6. Rollback Plan

```bash
git revert <B-4C-commit>

# 或直接删除新增文件：
rm src/shared/lib/post-task-reflection-flush-gate.ts
rm src/main/safety/live-flush-adapter.ts
rm tests/safety/live-flush-adapter.test.ts
rm tests/fixtures/learning-loop/ll014-b4c-flush-gate-quarantine.json
rm docs/closeout/b4c-flush-gate-closeout-2026-06-12.md

# 验证基线不降：
npx vitest run --config vitest.config.ts
npm run typecheck
git diff --check
```

回滚锚：B-4C 涉及的所有文件**均为新增**；无现存文件被修改；删除即可完全回滚。

## 7. LOOP Quarantine

`ll014-b4c-flush-gate-quarantine.json`：
- `reflection_task_id`: `HERMES-B4C-001`
- `proposed_state`: `remain_quarantined`
- `human_approval_ref.verified`: `false`
- `trust_level`: `single_run`
- `apply_path_implemented`: `false`

## 8. Live Flush 实际触发流程（未来 slice）

```
B-4B writer output (promotion_candidate)
    │
    ▼
B-4C adapter.buildRequest(output) → LiveFlushRequest (status: pending_user_approval)
    │
    ▼
[human review]
    │
    ├─ approve → return approved (Future: live-apply slice, separate approval)
    └─ reject  → return rejected
```

**B-4C 不实现 apply**。apply path 留待 future slice 单独批准。

## 9. Go/No-go

- B-4C PASS ⇒ **每次 Live Flush 仍需用户逐次人工批准**
- Auto Executor 常驻、Phase B 车道二、Live Ranking mutation 不随 B-4C 自动开放
- Live Flush apply path 仍为 future slice（需用户独立批准 + chflags unlock）

## 10. 修订记录

- 2026-06-12 v1：B-4C live flush gate + adapter — pending_user_approval only。
