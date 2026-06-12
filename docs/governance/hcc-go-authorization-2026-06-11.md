# HCC-GO 签收 / 授权清单 — 2026-06-11

> Phase A 收口文档。不启动 runtime，不启动 Auto Executor，不改代码。
> 基座：`a3f6dd6`（A-6 merge to main）
> 批准状态：**已签收 — Phase B 全链完成（2026-06-12 状态同步：B-1~B-6 8/8 complete）**

## 1. HCC-GO 四条件最终状态

| # | 条件 | 状态 | 证据 |
|---|---|---|---|
|1 | B1 九闸 `blocked` 清零 | ✅ 已达成 | A-5 `docs/governance/b1-go-evaluation-2026-06.md`（commit `2382bcc`，merge `a7be913`） |
|2 | `requires_user_authorization` 项全部由用户显式批 | ✅ 已达成 | 用户已签收本文件（2026-06-11）；B-2 / B-3 已执行并 closeout |
|3 | dry-run 010 PASS | ✅ 已达成 | A-4 `tests/safety/hcc-dry-run-010-fixture.test.ts` 15/15（commit `14d1a3c`，merge `bbad4b9`） |
|4 | A-6 首个真实任务交付 + 复盘入 LOOP 候选 | ✅ 已达成 | A-6 `src/shared/lib/registry/capability-registry.ts` + test 16/16 + quarantine fixture `ll010-a6-first-task-quarantine.json`（commit `3ed8fcb`，merge `a3f6dd6`） |

**HCC-GO 四条件：4/4 ✅。Phase B 车道一已启动，"每任务人工发车模式"。**

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
| **Phase B 车道二 B-5 / B-6** | plan 裁决：车道二在 HCC-STABLE 达成后开放。HCC-STABLE 已于 2026-06-12 用户签收达標。B-5 (`a5ab9f9`) 与 B-6 (`637775c`) 已完成。车道二全部完成，但不代表自动执行开放。每个后续任务仍需用户单独 GO | HCC-STABLE = 连续 5 任务零违规 + 全链 artifact + 1 次回滚演练 + 零自确认 |
| **写 ~/.hermes/** | 红线（P0-1 LOCK.md §4；lock-verify PASS=46 FAIL=0） | 永不自动解除；每次写入需用户显式解锁 + 批 |
| **启动 runtime / dev server** | 红线（Phase A 全链无 runtime 操作） | 某个 slice 单独获批后 |
| **git push** | 红线（Phase A 全链未 push） | 用户另批 |
| **改锁定路径** | `src/main/` / `src/renderer/` / `src/screens/` / `package.json` 均 uchg（lock-verify PASS=46 FAIL=0） | 用户手动 `lock-enforce.sh --unlock` |

## 3. HCC-GO 定义

- **HCC-GO**：允许进入 Phase B 车道一（知识库）的"每任务人工发车模式"。
  - Hermes 调度 → 用户确认 → 双视角审计划 → Claude Code worktree 执行 → Codex 双审 → 交付 → 反思候选入 quarantine。
  - 每个 slice 独立走此链。用户在每个 slice 发车前仍需显式 GO。
- **HCC-GO ≠ Auto Executor 常驻**。常驻自动执行仍是独立批，不因 HCC-GO 而自动授权。
- **HCC-GO ≠ 放开所有任务域**。车道二（UI / 外部项目）在 HCC-STABLE 达成前不开放。**HCC-STABLE 已于 2026-06-12 用户签收达標；车道二 B-5/B-6 已完成；后续任务仍需用户单独 GO，不自动执行。**
- **HCC-STABLE 定义**（来自 plan v3.2）：连续 5 任务零违规 + 全链 artifact 齐 + 1 次回滚演练 + 零自确认（AI 不自盖 `human_confirmed`）。**达標证据见 `docs/plan/hcc-stable-adjudication-preflight-2026-06-12.md`。**

## 4. Phase B 下一步推荐

### 4.1 B-1 状态

`consumed by A-6`。A-6 产出的 `CapabilityRegistry` + `DomainRegistry` 空壳已在 main（`src/shared/lib/registry/capability-registry.ts`）。B-2 scan gate 可直接引用为 capability 证据查找表。

### 4.2 B-2 状态

✅ **已完成**（2026-06-11）。closeout：`docs/closeout/b2-scan-gate-closeout-2026-06-11.md`。
- `src/shared/lib/safety/real-input-scan-gate.ts`（~150 行）
- `tests/safety/real-input-scan-gate.test.ts`（14/14）
- H-6 信任阶梯断言补齐（`tests/safety/external-input-scan-coverage.test.ts` 25/25）
- LOOP quarantine fixture：`ll011-b2-scan-gate-quarantine.json`

### 4.3 B-3 状态

✅ **已完成**（2026-06-11）。closeout：`docs/closeout/b3-evaluator-closeout-2026-06-11.md`。
- `src/shared/lib/post-task-reflection-evaluator-runner.ts`（~100 行）
- `tests/post-task-reflection-evaluator-runner.test.ts`（18/18）
- 生产代码零 I/O；`isReflectionEvaluatorPromotionEligible` hard-wired `false`
- LOOP quarantine fixture：`ll012-b3-evaluator-quarantine.json`

### 4.4 B-4 状态（2026-06-12 状态同步）

B-4 拆为三个子阶段，逐段用户批：

| 子阶段 | 内容 | 状态（2026-06-12） | closeout / preflight |
|---|---|---|---|
| **B-4A** | Live Reflection Writer preflight / contract | ✅ **已完成** | `docs/plan/b4a-live-reflection-writer-preflight-2026-06-12.md` + contract commit `6a33f6c` |
| **B-4B** | Writer 实现（Hermes main 唯一 writer + 唯一性测试） | ✅ **已完成** | commit `62b9bef`（2 files, +502） |
| **B-4C** | Live Flush approval gate（pending_user_approval only） | ✅ **approval gate 已完成** | preflight `b0e12a5` + impl commit `a15971f` |

- **B-4C apply path 仍未实现**（future slice，separate approval）
- **Live Flush 未真实执行、未启用**
- **不改**：`src/main/` / `src/renderer/` / `src/screens/` / `package.json`（均在锁内；新增文件需用户手动 `chflags uchg` 补锁）
- **不开放**：Auto Executor 常驻、Live Ranking mutation、apply path、Live Flush auto-apply

### 4.5 流程

B-4A/B-4B/B-4C 全部完成（commit stack 6a33f6c → 62b9bef → b0e12a5 → a15971f）。B-4 主干串行链「Writer 契约 → Writer 实现 → Approval Gate」已落库。**apply path 仍需 future slice 单独批准**。每次 Live Flush 触发仍需用户逐次人工 `approve` 回显 copy-deck 红线文案。

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

> **批准状态：已签收（2026-06-11）**
>
> 用户已签字确认：
> - 已审阅 HCC-GO 四条件状态
> - 批准 Phase B 车道一 B-1~B-4 逐项发车（每 slice 仍需单独 GO）
> - 确认 Auto Executor 常驻 ≠ HCC-GO，不随本签收自动启动
> - 确认车道二 B-5/B-6 已完成（HCC-STABLE 已达標，B-5 `a5ab9f9` + B-6 `637775c`）；仍不自动执行，每个后续任务仍需单独 GO
> - 确认不允许项清单仍然生效
>
> B-1 已被 A-6 消耗。B-2 ✅ 已完成。B-3 ✅ 已完成。**B-4 全部完成（2026-06-12）**：B-4A ✅ contract、B-4B ✅ writer 实现、B-4C ✅ approval gate。**B-4C apply path 仍未实现**（future slice，separate approval）；Live Flush 未真实执行、未启用。

---

> 关联文档：
> - [A-5 B1 九闸评估](b1-go-evaluation-2026-06.md)
> - [A-4 dry-run010 closeout](../closeout/dry-run-010-2026-06-11-report.md)
> - [A-6 first task closeout](../closeout/a6-first-task-closeout-2026-06-11.md)
> - [B-2 scan gate closeout](../closeout/b2-scan-gate-closeout-2026-06-11.md)
> - [B-3 evaluator closeout](../closeout/b3-evaluator-closeout-2026-06-11.md)
> - [B-4A writer preflight](../plan/b4a-live-reflection-writer-preflight-2026-06-12.md)
> - [B-4C flush gate closeout](../closeout/b4c-flush-gate-closeout-2026-06-12.md)
> - [HCC Phase B 车道一 B-4 closeout 同步](../closeout/hcc-phase-b-lane-one-b4-closeout-2026-06-12.md)
> - [02-execution-plan §Phase B](../plan/02-execution-plan.md)
> - [LOCK.md](../../LOCK.md)

## 7. 修订记录

- 2026-06-12：HCC-STATUS-SYNC-001 — 状态同步。签收状态 "待用户签字" → "已签收"；HCC-GO 四条件 3/4 → 4/4；B-2 "推荐下一 slice" → ✅ 已完成（closeout 指针）；新增 B-3 ✅ 已完成；B-4 拆为 B-4A/B-4B/B-4C；流程段改为 B-4A preflight；签收段移除空白签名行、补 B-2/B-3 closeout 指针。
- 2026-06-12：HCC-B4-CLOSEOUT-SYNC — B-4 三段全部完成状态同步。§4.4 标题改「下一步」→「状态」；子阶段表加状态列与 closeout 指针；流程段更新为「B-4 主干串行链已落库」；§6 签收段 B-4 描述改为「全部完成」；新增 B-4A preflight / B-4C closeout 链接。B-4C apply path 仍未实现，Live Flush 未启用。
- 2026-06-12：HCC-STABLE adjudication status sync — 用户签收 HCC-STABLE 达標（最低门槛解读）。车道二禁止列表改为可进入逐任务 preflight；不自动执行；每个任务仍需单独 GO。apply path / Auto Executor / Live Ranking mutation / Live Flush auto-apply 均未开放。后续 HCC-PHASE-B-LANE-TWO-CLOSEOUT-SYNC 已将 B-5/B-6 同步为完成。
- 2026-06-11 v1：初版（待用户签字）
