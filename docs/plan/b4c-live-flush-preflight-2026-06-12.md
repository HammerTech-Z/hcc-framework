# B-4C Live Flush — Preflight / Approval Plan

> HCC Phase B 车道一 | B-4C preflight | 2026-06-12
> 执行人：Claude Code
> 基座：`62b9bef`（B-4B 提交后，working tree 仅 `.claude/settings.json` 修改）
> 状态：**待用户批准。本文件不实现 Live Flush、不启用 Live Flush。**

## 1. 目标

把 B-4B in-memory writer 输出的 `quarantine_decision = "promotion_candidate"` 路径，转成可审计、可回滚的 live flush 候选路径。**Live Flush 仍需用户逐次人工批准，不自动 apply**。

B-4C 的本质：

- B-4A：writer 契约（contract_only）
- B-4B：writer 实现（in-memory，dry_run_only）
- **B-4C：live flush 适配器（adapter layer，不动 writer，不动 evaluator）**

## 2. 红线文案（copy-deck）

> ⚠️ **LIVE FLUSH — 用户必读**
>
> Live Flush 仍需**逐次人工批准**。
> Auto Executor 常驻、Phase B 车道二、Live Ranking mutation **均未授权**。
> Live Flush 仅对 `quarantine_decision = "promotion_candidate"` 触发。
> 任何 `quarantine=false` 的反射在 `human_approval_ref.verified = false` 状态下**绝不**进入 flush 路径。
> Flush 范围限定：vault 已有入口 + 已存在 knowledge 桶。
> **Live Flush 每次执行前必须回显这条文案。**

## 3. 允许 / 禁止文件清单

### 3.1 允许

| 类别 | 路径 | 备注 |
|---|---|---|
| 新增 | `src/main/safety/live-flush-adapter.ts` | 唯一 flush 入口；含 `LiveFlushAdapter` 类（未导出）+ `getLiveFlushAdapter()` 工厂 |
| 新增 | `src/shared/lib/post-task-reflection-flush-gate.ts` | pure contract：flush gate descriptor + approval gate 守卫 |
| 新增 | `tests/safety/live-flush-adapter.test.ts` | 唯一性 + flush gate 矩阵 + B-4A/B-4B 集成 |
| 新增 | `tests/fixtures/learning-loop/ll014-b4c-flush-gate-quarantine.json` | quarantine fixture 标记 B-4C 自身亦须 quarantine |
| 新增 | `docs/closeout/b4c-flush-gate-closeout-2026-06-12.md` | B-4C 收口报告（实施后） |

B-4C preflight 仅批准上述 5 个新增文件。**不修改任何 B-4A / B-4B 既有 contract / writer**。

### 3.2 禁止

| 类别 | 路径 / 行为 |
|---|---|
| 锁定路径 | `src/main/**` 现存文件（含 `index.ts` / `hcc-*` / `hermes.ts`） |
| B-4A 既有 | `src/shared/lib/post-task-reflection-writer-contract.ts`（不修改既有 contract） |
| B-4B 既有 | `src/main/safety/post-task-reflection-writer.ts`（不修改既有 writer） |
| 渲染 | `src/renderer/**` / `src/preload/**` |
| 包管理 | `package.json` / `package-lock.json` |
| Hermes 状态 | `~/.hermes/**` 任何写入 |
| 启动 | runtime / dev server / HCC Auto Executor / `serve` / `run` / `agent` / `delegate` / `gateway` / cron daemon |
| Knowledge | 真实 `knowledgeIngest` / `knowledgeSearch` 调用（仅契约层声明接口） |
| Audit | 真实 audit log 写入 |
| Config | 真实 config 写入 |
| Live Ranking | 真实 retrieval ranking 变更 |
| 公开声明 | "Live Flush 已启用" / "B-4C 完成" / "Auto Executor 启动" / "车道二开放" |
| 远程 | `git push` |

## 4. 预期 diff 草案

### 4.1 `src/main/safety/live-flush-adapter.ts` 草案

```typescript
// Live Flush Adapter — B-4C
// In-memory only. No fs / no IPC / no knowledgeIngest / no audit write.
// All flush operations require user approval; default is dry-run.
//
// Singleton invariant: getLiveFlushAdapter() returns the same instance.
// Class is not exported; no second flush owner can be created.

import type { WriterContractOutput } from "../../shared/lib/post-task-reflection-writer-contract";
import {
  assertFlushGateContractNoRuntime,
  buildFlushGateDescriptor,
  type LiveFlushApproval,
} from "../../shared/lib/post-task-reflection-flush-gate";

class LiveFlushAdapter {
  readonly adapter_status: "design_only" = "design_only";
  readonly live_flush_allowed: false = false;
  readonly knowledge_ingest_call_allowed: false = false;
  readonly audit_write_allowed: false = false;
  readonly persistence_allowed: false = false;
  readonly auto_apply_eligible: false = false;

  /**
   * Build a LiveFlushApproval request for a promotion_candidate.
   * Does NOT perform any flush. Caller must:
   *   1. Display copy-deck red-line text to user
   *   2. Get explicit human approval
   *   3. Call applyFlush(approval) with the user-signed approval
   */
  buildFlushRequest(output: WriterContractOutput): LiveFlushApproval {
    // gate: must be promotion_candidate
    if (output.quarantine_decision !== "promotion_candidate") {
      throw new Error("live_flush_adapter: not a promotion_candidate");
    }
    // gate: human_approval_ref.verified must be false (contract-layer invariant)
    if (output.reflection.provenance.human_approval_ref?.verified === true) {
      throw new Error("live_flush_adapter: human_approval_ref.verified must be false");
    }
    // gate: must run through B-4A runtime guard
    assertFlushGateContractNoRuntime(output);
    return {
      output,
      descriptor: buildFlushGateDescriptor(),
      status: "pending_user_approval",
      created_at: new Date().toISOString(),
    };
  }
}

let _instance: LiveFlushAdapter | null = null;
export function getLiveFlushAdapter(): LiveFlushAdapter {
  if (_instance === null) _instance = new LiveFlushAdapter();
  return _instance;
}
export function __resetLiveFlushAdapterForTest(): void { _instance = null; }
```

### 4.2 `src/shared/lib/post-task-reflection-flush-gate.ts` 草案

```typescript
// Pure contract: flush gate descriptor + approval gate guard.
// Zero I/O. All runtime flags hard-wired false.

export const FLUSH_GATE_DESIGN = {
  gate_status: "contract_only",
  live_flush_allowed: false,
  knowledge_ingest_call_allowed: false,
  audit_write_allowed: false,
  persistence_allowed: false,
  auto_apply_eligible: false,
  user_approval_required: true,
  copy_deck_redline_required: true,
  per_request_approval: true,
  schema_version: "1.0.0",
} as const;

export interface LiveFlushApproval {
  output: WriterContractOutput;
  descriptor: typeof FLUSH_GATE_DESIGN;
  status: "pending_user_approval";
  created_at: string;
}

export function buildFlushGateDescriptor() { return FLUSH_GATE_DESIGN; }

export function assertFlushGateContractNoRuntime(output: WriterContractOutput): void {
  if (output.live_flush_allowed !== false) throw new Error("live_flush_allowed must be false");
  if (output.dry_run_only !== true) throw new Error("dry_run_only must be true");
  // ... all 9 runtime flags
}
```

### 4.3 测试计划

| 测试 | 覆盖 | 期望 |
|---|---|---|
| Singleton | 两次 `getLiveFlushAdapter()` | 同实例 |
| buildFlushRequest 接受 promotion_candidate | B-4B 输出 | `status: pending_user_approval` |
| buildFlushRequest 拒绝 non-promotion | remain_quarantined / reject | 拋錯 |
| buildFlushRequest 拒绝 verified=true | tampered human_approval_ref | 拋錯 |
| 唯一性 | 源碼無 `export class LiveFlushAdapter` | 通過 |
| 靜態 | 源碼零 fs/child_process/ipcMain | 通過 |
| 旗標 | 9 個 runtime/apply 旗標皆 false | 通過 |
| Quarantine fixture | ll014-*.json | `proposed_state: remain_quarantined` |

## 5. 回滚方式

```bash
# 实施后回滚
git revert <B-4C-commit>

# 或直接删除新增文件
rm src/main/safety/live-flush-adapter.ts
rm src/shared/lib/post-task-reflection-flush-gate.ts
rm tests/safety/live-flush-adapter.test.ts
rm tests/fixtures/learning-loop/ll014-b4c-flush-gate-quarantine.json
rm docs/closeout/b4c-flush-gate-closeout-2026-06-12.md

# 验证基线不降
npx vitest run --config vitest.config.ts
npm run typecheck
git diff --check
bash ~/hermes-pro-work/scripts/lock-verify.sh
```

回滚锚：B-4C 涉及的所有文件**均为新增**，无现存文件被修改；删除即可完全回滚。

## 6. 禁项表（asserted by runtime guard）

| forbidden flag | value | guard |
|---|---|---|
| `live_flush_allowed` | `false` | descriptor + runtime guard |
| `knowledge_ingest_call_allowed` | `false` | descriptor + runtime guard |
| `audit_write_allowed` | `false` | descriptor + runtime guard |
| `persistence_allowed` | `false` | descriptor + runtime guard |
| `auto_apply_eligible` | `false` | descriptor + runtime guard |
| `dry_run_only` | `true` | descriptor + runtime guard |
| `human_approval_ref.verified` | `false` | runtime guard |
| `approval_gate.approved` | `false` | runtime guard |
| `quarantine_decision` | `promotion_candidate` | precondition（其他拒绝） |
| 真实 knowledgeIngest 调用 | 0 | 静态 + 行为 |
| 真实 audit write | 0 | 静态 + 行为 |
| Auto Executor 常驻 | 永不 | 设计层排除 |
| Phase B 车道二 | 永不 | 设计层排除 |
| Live Ranking mutation | 永不 | 设计层排除 |
| `git push` | 永不 | 本批规则 |

## 7. 人审 Gate

| 必须人审 | 时点 | 文案 |
|---|---|---|
| B-4C 实施 commit 批 | 实施前 | 须用户先 GO 本 preflight |
| 每次 Live Flush 实际触发 | 运行前 | 每次回显 §2 红线文案 + 用户显式输入 `approve` |
| 任何 vault 桶外写入 | 永远 | 越界 → 直接拒绝 |
| 任何 Live Ranking 写入 | 永远 | 越界 → 直接拒绝 |
| Auto Executor 启动 | 独立批 | 不随 B-4C 自动授权 |
| 车道二开放 | 独立批 | 不随 B-4C 自动授权 |

## 8. B-4C 不开放清单（强制重申）

| 禁止项 | 来源 |
|---|---|
| Auto Executor 常驻启动 | plan A-5 §1.6 + HCC-GO authorization §2.2 |
| Phase B 车道二（B-5 / B-6） | plan v3.2 + HCC-GO §2.2 |
| Live Ranking mutation | LOOP-007 冻结 + B-4 contract |
| Live Flush 自动 apply | 本 preflight §6 |
| `~/.hermes/**` 写入 | P0-1 LOCK.md + lock-verify |
| `git push` | Phase A 全链未 push |

## 9. 边界（与 B-4A/B-4B 一致）

- 锁定路径全部未碰；本批**仅新增文件**
- uchg 锁约束：实施前需用戶手動 `chflags nouchg src/main src/main/safety`（如需在 safety 內新增）
- `src/shared/lib` 不在 uchg 鎖內
- 寫入後不自動 `chflags uchg`；由用戶手動恢復

## 10. 修订

- 2026-06-12 v1：B-4C preflight — Live Flush 适配器契约、唯一性、入闸、红线文案、人审 gate、不开放清单。

## 11. Go/No-go

- **B-4C preflight PASS ⇒ 待用户 GO 实施 B-4C**。实施 commit 独立批。
- **实施 B-4C PASS ⇒ 每次 Live Flush 仍需用户逐次批准**。
- **Auto Executor / 车道二 / Live Ranking mutation 不随 B-4C 自动开放**。
