# HCC-GO 签收 / 授权清单 — 2026-06-11

> Phase A 收口文档。不启动 runtime，不启动 Auto Executor，不改代码。
> 基座：`a3f6dd6`（A-6 merge to main）
> 批准状态：**待用户签字**

## 1. HCC-GO 四条件最终状态

| # | 条件 | 状态 | 证据 |
|---|---|---|---|
|1 | B1 九闸 `blocked` 清零 | ✅ 已达成 | A-5 `docs/governance/b1-go-evaluation-2026-06.md`（commit `2382bcc`，merge `a7be913`） |
|2 | `requires_user_authorization` 项全部由用户显式批 | ⏳ **待用户签收本文件** | 见 §2 清单 |
|3 | dry-run 010 PASS | ✅ 已达成 | A-4 `tests/safety/hcc-dry-run-010-fixture.test.ts` 15/15（commit `14d1a3c`，merge `bbad4b9`） |
|4 | A-6 首个真实任务交付 + 复盘入 LOOP 候选 | ✅ 已达成 | A-6 `src/shared/lib/registry/capability-registry.ts` + test 16/16 + quarantine fixture `ll010-a6-first-task-quarantine.json`（commit `3ed8fcb`，merge `a3f6dd6`） |

**HCC-GO 四条件：3/4 technical ✅ + 1/4 待用户签收本文件。**

## 2. 用户授权清单

### 2.1 允许（用户签收后生效）

| 授权项 | 范围 | 约束 |
|---|---|---|
| Phase B 车道一 B-1 | 能力/领域注册表空壳 | **已被 A-6 消耗**（`src/shared/lib/registry/capability-registry.ts`），不再重做。若需扩注册表字段，开新 slice 单独批。 |
| Phase B 车道一 B-2 | 真实输入路径 scan gate（vault 导入 / 本地文件——仅已存在入口）+ H-6 信任阶梯断言补齐 | 每个 slice 仍需用户单独 GO。不改锁定路径（`src/main/` / `src/renderer/` / `src/screens/` / `package.json`）。微信/飞书/外链 gate 不建（入口不存在）。 |
| Phase B 车道一 B-3 | Reflection Evaluator 活化（LOOP-008 → runtime read-only） | **需单独批**（plan 标记 `是`）。零写；forbidden-runtime scan 0 hits。 |
| Phase B 车道一 B-4 | Live Reflection Writer（Hermes main 唯一）→ Live Flush | **需单独批**（plan 标记 `是，各一次`）。writer 唯一性测试；flush 走 copy-deck 红线文案。 |
| Phase B 车道一每 slice | 单个 slice 发车前用户 GO | 每 slice 独立 Preflight → 用户 GO → worktree 执行 → closeout → 用户验收 |

### 2.2 不允许（即使签收本文件后仍禁止）

| 禁止项 | 原因 | 解除条件 |
|---|---|---|
| **Auto Executor 常驻启动** | 独立授权（plan A-5 §1.6：`hcc_auto_executor` = `requires_user_authorization`；常驻 ≠ HCC-GO） | 用户另开独立批 |
| **Phase B 车道二 B-5 / B-6** | plan 裁决：车道二在 HCC-STABLE 达成后开放 | HCC-STABLE = 连续 5 任务零违规 + 全链 artifact + 1 次回滚演练 + 零自确认 |
| **写 ~/.hermes/** | 红线（P0-1 LOCK.md §4；lock-verify PASS=46 FAIL=0） | 永不自动解除；每次写入需用户显式解锁 + 批 |
| **启动 runtime / dev server** | 红线（Phase A 全链无 runtime 操作） | 某个 slice 单独获批后 |
| **git push** | 红线（Phase A 全链未 push） | 用户另批 |
| **改锁定路径** | `src/main/` / `src/renderer/` / `src/screens/` / `package.json` 均 uchg（lock-verify PASS=46 FAIL=0） | 用户手动 `lock-enforce.sh --unlock` |

## 3. HCC-GO 定义

- **HCC-GO**：允许进入 Phase B 车道一（知识库）的"每任务人工发车模式"。
  - Hermes 调度 → 用户确认 → 双视角审计划 → Claude Code worktree 执行 → Codex 双审 → 交付 → 反思候选入 quarantine。
  - 每个 slice 独立走此链。用户在每个 slice 发车前仍需显式 GO。
- **HCC-GO ≠ Auto Executor 常驻**。常驻自动执行仍是独立批，不因 HCC-GO 而自动授权。
- **HCC-GO ≠ 放开所有任务域**。车道二（UI / 外部项目）在 HCC-STABLE 达成前不开放。
- **HCC-STABLE 定义**（来自 plan v3.2）：连续 5 任务零违规 + 全链 artifact 齐 + 1 次回滚演练 + 零自确认（AI 不自盖 `human_confirmed`）。

## 4. Phase B 下一步推荐

### 4.1 B-1 状态

`consumed by A-6`。A-6 产出的 `CapabilityRegistry` + `DomainRegistry` 空壳已在 main（`src/shared/lib/registry/capability-registry.ts`）。B-2 scan gate 可直接引用为 capability 证据查找表。

### 4.2 B-2 候选（推荐下一 slice）

- **任务**：真实输入路径 scan gate（vault 导入 / 本地文件——仅已存在入口）+ H-6 信任阶梯断言补齐
- **范围**：`src/shared/lib/safety/`（新建 scan gate）+ `tests/safety/`（新建 test + H-6 trust level 5 级全覆盖）
- **不改**：`src/main/` / `src/renderer/` / `src/screens/` / `package.json`（均在锁内）
- **不建**：微信 / 飞书 / 外链 gate（入口不存在）
- **预计**：2 files / ~200 行 / 12-15 tests
- **前置**：用户签收本文件（HCC-GO 条件二）→ GO B-2 slice

### 4.3 流程

B-2 只做 Preflight（不直接实施）——等用户签收本文件 + 单独 GO B-2 后，再进 worktree 执行。

## 5. 边界

| 检查 | 本文件 |
|---|---|
| `src/**` 修改 | 无（纯文档） |
| `~/.hermes/**` 写入 | 无 |
| runtime / dev server / Auto Executor | 未启动 |
| `package.json` / `package-lock.json` / `.gitignore` | 未改 |
| 锁定路径 | 未碰 |
| 脏文件 | 未碰 |
| `git push` | 未执行 |
| commit | 未执行（等用户签收 + GO commit） |

## 6. 签收

> **批准状态：待用户签字**
>
> 签字即确认：
> - 已审阅 HCC-GO 四条件状态
> - 批准 Phase B 车道一 B-1~B-4 逐项发车（每 slice 仍需单独 GO）
> - 确认 Auto Executor 常驻 ≠ HCC-GO，不随本签收自动启动
> - 确认车道二 B-5/B-6 在 HCC-STABLE 达成前不开放
> - 确认不允许项清单仍然生效

签字后：__________________  日期：__________________

---

> 关联文档：
> - [A-5 B1 九闸评估](b1-go-evaluation-2026-06.md)
> - [A-4 dry-run010 closeout](../closeout/dry-run-010-2026-06-11-report.md)
> - [A-6 first task closeout](../closeout/a6-first-task-closeout-2026-06-11.md)
> - [02-execution-plan §Phase B](../plan/02-execution-plan.md)
> - [LOCK.md](../../LOCK.md)
