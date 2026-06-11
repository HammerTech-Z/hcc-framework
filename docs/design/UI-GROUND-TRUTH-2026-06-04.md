# Hermes Pro — UI Ground Truth（2026-06-04 / synced 2026-06-11）

> 状态：UI redesign **部分落地**（详见 §0）。Design Spec 方向已获用户批准（2026-06-05），8 个 open questions 已锁定默认值。本文为事实汇总，**不是** UI 实现任务派发单。
> 同步源：`docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md`（第一部分事实审计）。下一步 slice 入口：`UI-DOC-SYNC-001`（本文档当前承担其文档侧改动）。
> 最高约束：`~/.hermes/HERMES-SOUL.md` v5.3；锁定路线图 `docs/roadmap-locked-2026-05-28.md`。
> 关联入口：`CONTEXT.md` / `NEXT_STEP.md` / `docs/current-fusion-plan-2026-05-30.md` / `docs/p3-dry-run-baseline-2026-06-01.md` / `docs/iteration-plan-v2-updated.md`。
> 关联脚本：`scripts/build-summary.mjs`（用于 Claude Web 审核的 summary 生成器）。

---

## 0. 当前 UI 阶段（2026-06-11）

| 维度 | 状态 | 证据 |
|------|------|------|
| Slice 0 Contract Audit | ✅ 完成 | `docs/design/UI-SLICE-0-CONTRACT-AUDIT-2026-06-05.md` |
| Slice 1 tokens（`--hp-*` additive 层） | ✅ 已落地 | `src/renderer/src/assets/main.css` |
| Slice 1 screen boundary contract | ✅ 已落地 | `src/shared/lib/screen-boundary-contract.ts`（21 view） |
| Slice 2 App Shell + 21 路由表 | ✅ 已落地 | `Layout/Layout.tsx`（shell）+ `Layout/layout-routes.tsx`（LAYOUT_ROUTES，21 条） |
| Mission 组件 + bailongma/hccCockpit legacy alias | ✅ 已落地 | `screens/Mission/Mission.tsx`；route 通过 `legacySource="bailongma"\|"hcc"` 复用 |
| KnowledgeControl 只读屏 | ✅ 已落地 | `screens/KnowledgeControl/KnowledgeControl.tsx`（read_only） |
| Knowledge IPC 迁移（knowledgeSearch / knowledgeIngest / getGbrainStats） | ✅ 完成 | `tests/knowledge-ipc-closeout-audit.test.ts` 等 11 个测试 |
| 7 个 UI 边界测试 | ✅ 全绿 | `screen-boundary-contract` / `layout-route-table` / `knowledge-control-readonly` / `mission-control-readonly` / `knowledge-ipc-closeout-audit` 等 |
| UI Design Spec 方向 | ✅ 已获用户批准（2026-06-05） | `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` |
| 8 个 open questions | ✅ 已按 spec defaults 锁定 | spec §15 |
| Productionization | ❌ **NOT APPROVED**（冻结不变） | §4 / spec §14 G-03 |
| Slice 3 Chat / Slice 4 Mission 重排 / Slice 5 Knowledge board / Slice 6 Settings / Slice 7 Polish | ⏳ 未开始，**需用户逐 slice 批准** | 见 audit 2026-06-11 H 节 |

下一个文档侧 slice：`UI-DOC-SYNC-001`（本次同步即承担其改动）。下一组待批 slice：`UI-MACOS-001a`（字体）/ `UI-CN-001`（中文化）/ `UI-MACOS-001b`（Mission 重排）/ `UI-CHAT-001` / `UI-ARCHIVE-001` / `UI-SAFETY-001` / `UI-KNOWLEDGE-001`。

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
| BaiLongma Cockpit | `src/renderer/src/screens/BaiLongma/BaiLongma.tsx`（历史 cockpit 组件，仍在仓库；route `bailongma` 已 alias 到 Mission） | read-only 升级，Final Polish 已 PASS；无新 IPC、无 HCC/CLI/Safari MCP 外部动作；`tests/bailongma-status-sync.test.ts` 10/10。引用核查留待 `UI-ARCHIVE-001` |
| Knowledge Screen | `src/renderer/src/screens/Knowledge/Knowledge.tsx` | 检索屏，固定查询 0 超时；过时计划目录已硬排除；ingest 写入路径**仅** 此屏保留（spec G-10） |
| 主导航 / 左侧栏 | ✅ 已分组 4 组（Work 6 / Knowledge 5 / Agents 4 / System 6）+ collapsed 64px（实现值，见 §6.collapsed 决议） | `Layout/Layout.tsx` + `layout-routes.tsx`；分组计数 4/6/5/4/6 受 cerebrum 锁定 |
| Mission（原 BaiLongma cockpit 语言落点） | ✅ 已落地为独立组件 | `screens/Mission/Mission.tsx`；`bailongma` / `hccCockpit` route 均通过 `legacySource` prop alias 到此组件 |
| HccCockpit | `src/renderer/src/screens/HccCockpit/HccCockpit.tsx`（历史 POC 组件，仍在仓库；route `hccCockpit` 已 alias 到 Mission） | read-only POC（ADR-20260530）；ModelStrategyDryRunPanel 嵌入此组件且零 IPC。引用核查留待 `UI-ARCHIVE-001` |
| Knowledge Control 管控页 | ✅ 已落地（只读） | `screens/KnowledgeControl/KnowledgeControl.tsx`；boundary `read_only` + risk `P2`；Knowledge IPC 三通道已迁至 main-process IPC bridge |
| V1-V7 完成度矩阵 | 见 §5 | |

---

## 3. UI 实现前置（已锁默认值；Slice 0 仍需执行）

1. **BaiLongma cockpit 当前组件 / IPC 契约与允许展示范围**：Slice 0 只读枚举每个 panel 的数据源、是否走 IPC、是否允许 read-only 展示扩展、是否允许触发 action。
2. **Knowledge 页当前状态**：Slice 0 只读枚举所有现有 UI surface（search / bucket / trust badge / provenance drawer 等），标注 mock/live；live 端明确不得启用新的 `knowledgeIngest` / `knowledgeSearch` 写入侧。
3. **Hermes soft switch candidate v0.15.1 状态**：观察期已结束，用户裁决 KEEP v0.15.1（ADR-20260604）；UI 实现不得依赖 candidate runtime 行为。
4. **P7 local delivery 当前状态**：4 个低优先级 cron job 已切 `deliver=local`（`db41a513ebfd` / `21129f505fb4` / `28f0bff3083d` / `skill-cleanup-weekly`）；UI 实现不得触发新投递 / 重发 / 重试。
5. **V1-V7 完成度矩阵**：见 §5。
6. **设计方向 spec**：已获用户批准，见 `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md`（macOS intelligence console / Chat 复刻 / 左导航可隐藏 / Knowledge Control 新页）。

> Slice 0 Contract Audit 仍需用户单独批准。Slice 0 是只读枚举：screens / IPC / read-write-runtime boundaries / current component surfaces；不做视觉改动、不新增 IPC、不改 renderer。

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

## 6. UI 实现工作流（spec 已通过；implementation 仍需分 slice 批准）

1. 用户单独批准 Slice 0 Contract Audit。
2. Slice 0 只读枚举 screens / IPC / read-write-runtime boundaries，必要时更新 ground truth。
3. 用户批准后续 implementation slice。
4. 在 `docs/design/DESIGN.md` 落地 token / style contract（不是当前任务）。
5. 每个新组件先在 `src/renderer/src/screens/<new>/<New>.tsx` 起骨架，不直接替换现有 screen。
6. 任何 IPC 改动必须先在 `src/preload/index.ts`（待定路径）登记，并跑 `tests/safety` 全量。
7. 任何新外部动作（CLI-Anything / Safari MCP / HCC / handoff 写入）必须经 Action Gate，不允许在 UI 层直接调用。

> 现阶段不允许做的事：替换 component library / 改路由 / 改主题色 / 直接操作 `~/.hermes/handoff` 或 `~/.hermes/audit`。

---

## 6.collapsed sidebar 宽度决议（2026-06-11）

Spec §3.1 描述 collapsed = 56px（Apple HIG 默认），`main.css` 实现值 = 64px。**采用 64px**（实现态），理由：64px 在 macOS HIG 触达目标（44pt）+ 周围 10pt 边距上更稳。spec 已同步更新（见 audit 2026-06-11 P2-6）。

## 6.shell-level API 登记（audit P2-5）

`Layout.tsx` 含 4 个 shell-level 存量 API（非 21-view 合约面）：`downloadUpdate` / `installUpdate` / `abortChat` / `getSessionMessages`。

- 分类：update 流（2）= external-action；`abortChat` = chat-runtime；`getSessionMessages` = read-only。
- `tests/layout-route-table.test.ts` 当前断言"Layout.tsx contains no new fetch/ipcRenderer"——存量被默许，新增禁止。
- `installUpdate` 是否已有原生确认弹层：`UNVERIFIED`，留待 `UI-SAFETY-001` 核查。
- `screen-boundary-contract.ts` 已加注释明确登记（见 `src/shared/lib/screen-boundary-contract.ts` 文件头 shell-level surface registry 块），未改运行逻辑。

---

## 7. 关联文档

- `CONTEXT.md` — 当前上下文入口
- `NEXT_STEP.md` — 下一步行动指南
- `docs/current-fusion-plan-2026-05-30.md` — 融合执行参考
- `docs/p3-dry-run-baseline-2026-06-01.md` — P3 dry-run 基线
- `docs/iteration-plan-v2-updated.md` — 兼容索引
- `docs/roadmap-locked-2026-05-28.md` — 锁定路线图（**不变**）

> 本文不替代 locked roadmap；任何 UI 计划变更仍需新 ADR + 用户确认。
