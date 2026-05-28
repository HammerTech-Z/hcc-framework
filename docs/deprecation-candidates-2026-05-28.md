# 废弃/过时/误导候选清单（2026-05-28）

> 版本：v1.0
> 创建日期：2026-05-28
> 用途：列出需要用户判断的废弃/过时文档
> **不删除，只列候选**

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
| **建议动作** | 改为"V3 UI 完成，自动化迁移 V6" |

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
| **建议动作** | 保留作为历史参考，或移入 ~/.hermes/docs/archive/ |

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
| **命中行** | 全文多处 |
| **为什么误导** | HANDOFF.md 记录了多个历史状态，但未同步到当前锁定路线图 |
| **建议动作** | 保留作为历史记录，但 Agent 应优先读取 NEXT_STEP.md / CONTEXT.md |

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
| **为什么冲突** | 2026-05-27 调查：Python 3.14 TLS 阻塞 cli-hub 安装，CLI-Anything 未集成 |
| **建议动作** | 更新为"CLI-Anything 受 Python TLS 阻塞，未集成" |

### E-2: Ruflo loop-workers 已接入（过时声明）

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | "Ruflo loop-workers 已验证活跃" |
| **为什么冲突** | 2026-05-27 调查：本地零痕迹，无 Hermes cron/launchd/MCP 接入 |
| **建议动作** | 更新为"Ruflo loop-workers 本地零痕迹，Hermes cron 问题在业务层" |

### E-3: Mano-P 硬件满足（过时声明）

| 项目 | 内容 |
|------|------|
| **文件** | `~/.hermes/HANDOFF.md` |
| **命中行** | "Mano-P 硬件满足" |
| **为什么冲突** | 2026-05-27 调查：需 M4+ 32GB，当前 MacBook Air M5 16GB 不满足 |
| **建议动作** | 更新为"Mano-P 暂缓，需 M4+ 32GB 硬件" |

---

## 废弃/过时/误导候选统计

| 分类 | 数量 | 文件 |
|------|------|------|
| A. 过时状态声明 | 2 | v3-status.md, ~/.hermes/HANDOFF.md |
| B. 被取代的旧计划 | 2 | iteration-plan-v2-updated.md（旧版）, Hermes-迭代计划-v2.md |
| C. 代码事实冲突 | 2 | NEXT_STEP-2026-05-23.md, v2-status.md（部分） |
| D. 误导归档文档 | 3 | ~/.hermes/HANDOFF.md, archive/CONTEXT-2026-05-21.md, archive/NEXT_STEP-2026-05-23.md |
| E. 工具/配置冲突 | 3 | ~/.hermes/HANDOFF.md（多处） |

**总计**：12 个候选项（含 1 个 False positive）

---

## 执行原则

- **不建议删除文件**。归档文件只加 deprecated header 或改写过时句子。
- **C-3（docs/bailongma/05-poc-implementation-review.md）暂不处理**，需复核是否实际存在冲突后再决定动作。
- **~/.hermes/HANDOFF.md 暂不处理**，保留在候选清单中，等用户确认后再处理。

---

## 决策建议（2026-05-28 已更新）

| 优先级 | 文件 | 建议动作 | 实际状态 |
|--------|------|---------|---------|
| P0 | `docs/v3-status.md` | ✅ 改写"V4 明天启动"为重基线状态 | **已完成** |
| P0 | `docs/v2-status.md` | ✅ 改写"代码零实现"为历史判断 + 当前状态 | **已完成** |
| P0 | `docs/archive/NEXT_STEP-2026-05-23.md` | ✅ 加 deprecated header + CodeGraph 验证备注 | **已完成** |
| P0 | `docs/archive/CONTEXT-2026-05-21.md` | ✅ 加 deprecated header | **已完成** |
| P0 | `docs/archive/iteration-plan-v2-updated-2026-05-28.md` | ✅ 加 archived header | **已完成** |
| P1 | `~/.hermes/HANDOFF.md` | 待用户确认后更新 CLI-Anything/Ruflo/Mano-P 状态 | **待处理** |
| P1 | `docs/bailongma/05-poc-implementation-review.md` | 暂不处理，需先复核是否存在冲突 | **暂不处理** |
| P3 | 其他归档文档 | 保留作为历史参考，Agent 优先读根目录文件 | **无需动作** |

---

*本文档是废弃/过时/误导候选清单，不直接删除文件。所有决策需用户确认。*