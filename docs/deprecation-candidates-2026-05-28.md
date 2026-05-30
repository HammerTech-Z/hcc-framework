# 废弃/过时/误导候选清单（2026-05-28）

> 版本：v1.1
> 创建日期：2026-05-28
> 更新日期：2026-05-30
> 用途：列出需要用户判断的废弃/过时文档
> 当前状态：2026-05-30 已完成主要计划入口同步与桌面过时计划整理

---

## 分类说明

| 分类 | 说明 |
|------|------|
| A | 过时状态声明 |
| B | 被锁定路线图取代的旧计划 |
| C | 与当前代码事实冲突的文档 |
| D | 会误导 Agent 的归档文档 |
| E | 本地工具/配置状态冲突 |

---

## A. 过时状态声明

### A-1: V4 明天启动

| 项目 | 内容 |
|------|------|
| **文件** | `docs/v3-status.md` |
| **命中行** | 最后一行："V4 明天启动" |
| **为什么过时** | 2026-05-27 实际做了 CLI-Anything/Ruflo/Mano-P 现状调查，未启动 V4 实现 |
| **建议动作** | 删除或改为"V4 现状调查中" |

### A-2: V3 已全部完成

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | "V3 已全部完成：6/6" |
| **为什么过时** | V3 UI 集成完成，但自动化 backlog 未完成（迁移到 V6） |
| **建议动作** | 已在 2026-05-30 HANDOFF 顶部追加当前状态；历史段保留为时间线 |

---

## B. 被锁定路线图取代的旧计划

### B-1: 原 iteration-plan-v2-updated.md

| 项目 | 内容 |
|------|------|
| **文件** | `docs/iteration-plan-v2-updated.md`（旧版） |
| **命中行** | V4 只有 BaiLongma，无 V6/V7 |
| **为什么被取代** | 新版 iteration-plan-v2-updated.md 已覆盖 V1-V7，旧版只到 V5 |
| **建议动作** | 已归档为 `docs/archive/iteration-plan-v2-updated-2026-05-28.md`，可保留作为历史参考 |

### B-2: ~/.hermes/docs/Hermes-迭代计划-v2.md

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/docs/Hermes-迭代计划-v2.md` |
| **命中行** | 全部内容 |
| **为什么被取代** | Hermes Pro 锁定路线图（V1-V7）已替代此文件 |
| **建议动作** | 已改为兼容索引，明确唯一计划入口是 `~/hermes-pro/docs/roadmap-locked-2026-05-28.md` |

---

## C. 与当前代码事实冲突的文档

### C-1: CodeGraph 177文件/1222节点

| 项目 | 内容 |
|------|------|
| **文件** | `docs/archive/NEXT_STEP-2026-05-23.md` |
| **命中行** | "Phase 0a CodeGraph | ✅ 完成 | 177文件/1222节点 MCP" |
| **为什么冲突** | 存档文档称 177 文件/1222 节点，但 2026-05-28 检索显示 nodes/edges=0 |
| **建议动作** | 更新文档或标记为"需重新验证" |

### C-2: BaiLongma 代码零实现

| 项目 | 内容 |
|------|------|
| **文件** | `docs/v2-status.md` / `docs/iteration-plan-v2-updated.md`（旧版） |
| **命中行** | "代码零实现" |
| **为什么冲突** | BaiLongma 已在 V4 完成设计闭环和 POC-2（Layer 1-3 + README + POC Plan + POC-1 + POC-2） |
| **建议动作** | 删除"代码零实现"描述，改为"BaiLongma 已从 V2 移出，在 V4 完成" |

### C-3: POC 待实现评审

| 项目 | 内容 |
|------|------|
| **文件** | `docs/bailongma/05-poc-implementation-review.md` |
| **候选状态** | False positive / 暂不处理 |
| **复核结论** | 2026-05-28 复核：未在 `docs/bailongma/05-poc-implementation-review.md` 中发现"POC-2 待实现评审"冲突关键词。该文件实际描述 POC-2 已实现状态。 |
| **建议动作** | 无需动作。标记为 False positive，从已确认冲突列表移除。 |

---

## D. 会误导 Agent 的归档文档

### D-1: HANDOFF.md 中的旧状态

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | 历史段多处 |
| **为什么误导** | HANDOFF.md 记录了多个历史状态 |
| **建议动作** | 已在 2026-05-30 顶部追加当前计划同步摘要；历史段保留为时间线，Agent 应优先读取顶部最新段 + NEXT_STEP.md |

### D-2: archive/CONTEXT-2026-05-21.md

| 项目 | 内容 |
|------|------|
| **文件** | `docs/archive/CONTEXT-2026-05-21.md` |
| **命中行** | 全部内容 |
| **为什么误导** | 旧版本 CONTEXT，版本线只有 V1-V5，无 BaiLongma 无 V6/V7 |
| **建议动作** | 保留作为历史参考，但 Agent 应优先读取根目录 CONTEXT.md |

### D-3: archive/NEXT_STEP-2026-05-23.md

| 项目 | 内容 |
|------|------|
| **文件** | `docs/archive/NEXT_STEP-2026-05-23.md` |
| **命中行** | 全部内容 |
| **为什么误导** | 旧版本 NEXT_STEP，计划中 V4 是 CLI-Anything/Ruflo/Mano-P，不是 BaiLongma |
| **建议动作** | 保留作为历史参考，但 Agent 应优先读取根目录 NEXT_STEP.md |

---

## E. 本地工具/配置状态冲突

### E-1: CLI-Anything 已集成（过时声明）

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | "CLI-Anything 已验证可用" |
| **为什么冲突** | 后续状态已演进：V7-1 Safari MCP MVP PASS；CLI-Anything 不再作为阻塞项 |
| **建议动作** | 已在 V7 文档更新为 Safari MCP MVP PASS；旧 HANDOFF 历史段保留 |

### E-2: Ruflo loop-workers 已接入（过时声明）

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | "Ruflo loop-workers 已验证活跃" |
| **为什么冲突** | 2026-05-27 调查：本地零痕迹，无 Hermes cron/launchd/MCP 接入 |
| **建议动作** | 已在 V7 文档更新为"不替换 cron，仅借鉴 worker taxonomy"；旧 HANDOFF 历史段保留 |

### E-3: Mano-P 硬件满足（过时声明）

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | "Mano-P 硬件满足" |
| **为什么冲突** | 2026-05-27 调查：需 M4+ 32GB，当前 MacBook Air M5 16GB 不满足 |
| **建议动作** | 已在 V7 文档和 NEXT_STEP 更新为候选暂缓；旧 HANDOFF 历史段保留 |

---

## 废弃/过时/误导候选统计

| 分类 | 数量 | 文件 |
|------|------|------|
| A. 过时状态声明 | 已处理 | v3-status.md 已处理；HANDOFF 顶部已追加当前段 |
| B. 被取代的旧计划 | 已处理 | iteration-plan-v2-updated.md 与 Hermes-迭代计划-v2.md 已改为兼容索引 |
| C. 代码事实冲突 | 已处理/历史保留 | 当前入口已同步，archive 保留历史 |
| D. 误导归档文档 | 已处理/历史保留 | 当前入口优先级已写入 SOP/MEMORY/HANDOFF |
| E. 工具/配置冲突 | 已处理/历史保留 | V7/NEXT_STEP 已更新，HANDOFF 历史段不重写 |

**当前结论**：主要误导入口已收口；历史归档文件不删除，统一保留在 archive 或桌面过时计划目录。

---

## 执行原则

- **不删除历史证据**。归档文件保留，当前入口明确指向 locked roadmap / NEXT_STEP。
- **C-3（docs/bailongma/05-poc-implementation-review.md）保持 false positive**，无需动作。
- **~/.hermes/HANDOFF.md 历史段不重写**，只在顶部追加最新事实，避免破坏时间线。

---

## 决策建议（2026-05-28 已更新）

| 优先级 | 文件 | 建议动作 | 实际状态 |
|--------|------|---------|---------|
| P0 | `docs/v3-status.md` | ✅ 改写"V4 明天启动"为重基线状态 | **已完成** |
| P0 | `docs/v2-status.md` | ✅ 改写"代码零实现"为历史判断 + 当前状态 | **已完成** |
| P0 | `docs/archive/NEXT_STEP-2026-05-23.md` | ✅ 加 deprecated header + CodeGraph 验证备注 | **已完成** |
| P0 | `docs/archive/CONTEXT-2026-05-21.md` | ✅ 加 deprecated header | **已完成** |
| P0 | `docs/archive/iteration-plan-v2-updated-2026-05-28.md` | ✅ 加 archived header | **已完成** |
| P1 | `~/.hermes/HANDOFF.md` | 顶部追加 2026-05-30 当前事实；历史段保留 | **已完成** |
| P1 | `docs/bailongma/05-poc-implementation-review.md` | 暂不处理，需先复核是否存在冲突 | **暂不处理** |
| P3 | 其他归档文档 | 保留作为历史参考，Agent 优先读根目录文件 | **无需动作** |
| P0 | `~/.hermes/docs/*` 旧任务包 | 移到桌面过时计划 | **已完成（2026-05-30）** |

---

*本文档是废弃/过时/误导候选清单，不直接删除文件。所有决策需用户确认。*
