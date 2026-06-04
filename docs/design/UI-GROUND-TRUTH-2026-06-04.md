# Hermes Pro — UI Ground Truth（2026-06-04）

> 状态：UI redesign **未开始实现**；本文为事实汇总，**不是** UI 实现任务派发单。
> 最高约束：`~/.hermes/HERMES-SOUL.md` v5.3；锁定路线图 `docs/roadmap-locked-2026-05-28.md`。
> 关联入口：`CONTEXT.md` / `NEXT_STEP.md` / `docs/current-fusion-plan-2026-05-30.md` / `docs/p3-dry-run-baseline-2026-06-01.md` / `docs/iteration-plan-v2-updated.md`。
> 关联脚本：`scripts/build-summary.mjs`（用于 Claude Web 审核的 summary 生成器）。

---

## 0. 当前 UI 阶段

| 维度 | 状态 |
|------|------|
| UI redesign 实现 | ❌ **未开始** |
| 可做：DESIGN.md / UI style spec / 组件 token | ✅ 可开始 |
| 不可做：组件库替换 / 路由重构 / 主题切换 | ❌ 需先完成下面 §3 的前置 |

进入 UI 实现前必须先补齐 §3 的 6 项前置。

---

## 1. 设计方向（仅 spec 阶段，不实现）

- **风格基调**：macOS 简约 + 科技感（clean / low chrome / monospace 关键区 / 留白偏大）。
- **Chat 参考**：复刻 BaiLongma 当前对话 UI（已经是 Hermes 内主对话视图）。
- **左侧导航**：可隐藏（collapse/expand），与 BaiLongma 现有 pattern 保持一致。
- **Knowledge Control**：需要补一个独立的知识库管控页（inbox / 索引 / trust / provenance / redaction 控制台），不允许直接散在 Knowledge 检索屏内。
- **Component 复用**：优先用现有 BaiLongma / Knowledge 屏幕的 component；新增必须先在 §3 前置里登记 IPC/数据契约。

---

## 2. 当前 UI 模块状态

| 模块 | 现状 | 备注 |
|------|------|------|
| BaiLongma Cockpit | `src/renderer/src/screens/BaiLongma/BaiLongma.tsx` | read-only 升级，Final Polish 已 PASS；无新 IPC、无 HCC/CLI/Safari MCP 外部动作；`tests/bailongma-status-sync.test.ts` 10/10 |
| Knowledge Screen | `src/renderer/src/screens/Knowledge/Knowledge.tsx` | 检索屏，固定查询 0 超时；过时计划目录已硬排除 |
| 主导航 / 左侧栏 | 已有，但暴露面待确认 | UI redesign 第一阶段先 enumerate |
| Knowledge Control 管控页 | ❌ 缺失 | 必须新建；不允许塞进 Knowledge 检索屏 |
| V1-V7 完成度矩阵 | 见 §5 | |

---

## 3. UI 实现前置（必填，缺一不可）

1. **BaiLongma cockpit 当前组件 / IPC 契约与允许展示范围**：列出每个 panel 的数据源、是否走 IPC、是否允许 read-only 写扩展、是否允许触发 action。
2. **Knowledge 页当前状态**：列出所有现有 UI surface（search / bucket / trust badge / provenance drawer 等），标注哪些是 mock / 哪些是 live 接入（live 端明确不得启用 `knowledgeIngest` / `knowledgeSearch` 写入侧）。
3. **Hermes soft switch candidate v0.15.1 观察状态**：`hermes` 默认入口当前指向 `~/.hermes/hermes-agent-upgrade-candidate/.venv/bin/hermes`；观察期 ACTIVE 1-2 天（2026-06-02 起）；UI 实现不得依赖 candidate runtime 行为。
4. **P7 local delivery 当前状态**：4 个低优先级 cron job 已切 `deliver=local`（`db41a513ebfd` / `21129f505fb4` / `28f0bff3083d` / `skill-cleanup-weekly`）；UI 实现不得触发新投递 / 重发 / 重试。
5. **V1-V7 完成度矩阵**：见 §5。
6. **设计方向 spec**：见 §1（macOS 简约 + 科技感 / Chat 复刻 / 左导航可隐藏 / Knowledge Control 新页）。

> 这 6 项补齐前，UI 实现（包括 DESIGN.md 落地之外的任何 src/renderer 改动）必须先经用户显式批。

---

## 4. 硬冻结（与 KRC summary §6 对齐）

- **HCC Auto Executor**：paused；未批准、未启动、未接线。
- **P3 real execution**：paused。
- **Productionization**：NOT APPROVED。
- **hard cutover**：unapproved。
- **Round 2 C**：frozen。
- **L6 live knowledge flush**：not enabled。
- **no handoff / audit writes**：本任务不写真实 `~/.hermes/handoff/packs` 与 `~/.hermes/audit`。
- **locked roadmap**：不变；任何路线图变更需新 ADR + 用户确认。

---

## 5. V1-V7 完成度矩阵

| 版本 | 状态 | 备注 |
|------|------|------|
| V1 | ✅ 完成 | 基础可用 |
| V1.5 | ✅ 完成 | 修复阶段 |
| V2 | ✅ 4/5 完成 | Theme / AgentMonitor / MCP / Memory；BaiLongma 移出 |
| V3 | ✅ UI 完成 | Knowledge / Vault / Recharts / GBrain stats / Horizon tab |
| V4 | ✅ POC-2 + QA PASS + Read-only Cockpit Final Polish | BaiLongma 只读 POC + Final Polish；Productionization NOT APPROVED |
| V5 | ⏸️ MVP_PARTIAL | C1/C2/C3 ✅；C4/C5 暂缓（生图/视频外部 API 不可控 + 成本不可控）|
| V6 | ✅ MAIN COMPLETE | 主干 5/5 完成；V6-1/V6-5 为扩展/决策项 |
| V7 | ✅ PARTIAL_COMPLETE | Safari MCP MVP PASS；browser-use DEFER；Mano-P 待定；UI-TARS / OpenAdapt 需用户授权 |

---

## 6. UI 实现工作流（仅 spec 通过后）

1. 完成 §3 的 6 项前置 → 用户批准。
2. 在 `docs/design/DESIGN.md` 落地（不是当前任务）。
3. 每个新组件先在 `src/renderer/src/screens/<new>/<New>.tsx` 起骨架，不直接替换现有 screen。
4. 任何 IPC 改动必须先在 `src/preload/index.ts`（待定路径）登记，并跑 `tests/safety` 全量。
5. 任何新外部动作（CLI-Anything / Safari MCP / HCC / handoff 写入）必须经 Action Gate，不允许在 UI 层直接调用。

> 现阶段不允许做的事：替换 component library / 改路由 / 改主题色 / 直接操作 `~/.hermes/handoff` 或 `~/.hermes/audit`。

---

## 7. 关联文档

- `CONTEXT.md` — 当前上下文入口
- `NEXT_STEP.md` — 下一步行动指南
- `docs/current-fusion-plan-2026-05-30.md` — 融合执行参考
- `docs/p3-dry-run-baseline-2026-06-01.md` — P3 dry-run 基线
- `docs/iteration-plan-v2-updated.md` — 兼容索引
- `docs/roadmap-locked-2026-05-28.md` — 锁定路线图（**不变**）

> 本文不替代 locked roadmap；任何 UI 计划变更仍需新 ADR + 用户确认。
