# V6 知识自动化补完

> 版本：V6
> 继承自：V3 未完成的自动化任务
> 状态：待启动
> 锁定：本文档是锁定路线图的一部分，变更需 ADR + 用户确认

---

## 核心目标

**把 V3 的 UI 展示层升级成真实自动化知识飞轮。**

V3 完成了 Knowledge 页面、Vault 增强、Recharts 图表、GBrain stats、Horizon tab 等 UI 展示层，但自动化飞轮未闭环。本阶段承接 V3 的自动化缺口，让知识系统真正运转起来。

---

## 任务列表

### V6-1: GBrain typed links + dream cycle

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 知识赋能原计划 |
| **目标** | GBrain 支持类型化链接 + dream cycle（梦境循环）语义分析 |
| **当前状态** | ❌ 未实现 |
| **缺口** | GBrain 只有基本统计面板，无 typed links 图谱、无 dream cycle 算法 |
| **可达性判断** | 需要额外设计定义，暂缓 |
| **推荐 Sprint** | V6 后期，需先完成其他前置任务 |
| **验收标准** | 1. GBrain 界面显示类型化链接图谱 2. dream cycle 语义分析结果可见 |

---

### V6-2: Horizon cron 自动入 vault + 评分阈值

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 知识赋能，Phase 1a Horizon |
| **目标** | Horizon 新闻雷达自动抓取→vault，每日评分阈值自动归档 |
| **当前状态** | ❌ 桌面端只有 read-only tab，无自动化写入 |
| **缺口** | Horizon MCP 已 clone（~/Horizon-src/），但 cron 未完整对接 vault |
| **可达性判断** | 历史记录显示曾验证 Horizon MCP 可运行，但 V6 开工前需复验 Horizon MCP、API key 和 cron 写入路径 |
| **推荐 Sprint** | V6 早期（需先复验） |
| **验收标准** | 1. Horizon cron 每日自动运行 2. 输出自动写入 vault 3. 评分阈值可见 |

---

### V6-3: K3 学习方向每周自动更新

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 K线计划，K3 反推学习方向 |
| **目标** | K3 输出每周自动更新到 vault/wiki/learning/direction.md |
| **当前状态** | ❌ K3 输出存在，但未形成自动化闭环 |
| **缺口** | learning-direction.md 存在但 cron 未完整对接 |
| **可达性判断** | 需要先修复 cron 根因，现在可做 |
| **推荐 Sprint** | V6 中期 |
| **验收标准** | 1. K3 每周自动生成方向建议 2. 输出写入 vault/wiki/learning/direction.md |

---

### V6-4: SQLite/Filesystem/Git MCP 配齐

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 Phase 0b MCP Servers |
| **目标** | 桌面端 Settings MCP 管理 UI 支持 Filesystem + Git MCP |
| **当前状态** | ⏳ MCP 管理 UI 已有，但 Filesystem/Git MCP 未配齐 |
| **缺口** | MCP 列表无 Filesystem/Git server |
| **可达性判断** | 现在可做 |
| **推荐 Sprint** | V6 早期 |
| **验收标准** | 1. Settings MCP 列表包含 Filesystem server 2. Settings MCP 列表包含 Git server |

---

### V6-5: HCC 流程入主线

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 P4 PlaybookRunner，HCC 流程 |
| **目标** | HCC 阶段 1-7 全部在代码中定义，PlaybookRunner 完整支持 |
| **当前状态** | ❌ 阶段 1-4 未在代码中定义 |
| **缺口** | HCC 阶段 1-4（需求翻译/用户确认/双视角审核/审核循环）需 Hermes/Claude Code 协同 |
| **可达性判断** | 需产品决策，暂缓 |
| **推荐 Sprint** | V6 后期，需先完成其他前置任务 |
| **验收标准** | 1. HCC 全部 7 个阶段在代码中定义 2. PlaybookRunner 支持完整 HCC 流程 |

---

### V6-6: CodeGraph / codebase-memory-mcp 重新索引与验证

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 Phase 0a CodeGraph |
| **目标** | codebase-memory-mcp 索引完整，当前 nodes/edges > 0 |
| **当前状态** | ❌ 存档文档称 177文件/1222节点，实际 nodes/edges=0 |
| **缺口** | Codex 索引未验证，codebase-memory-mcp 状态未知 |
| **可达性判断** | 现在可做，需先验证 MCP 服务状态 |
| **推荐 Sprint** | V6 早期 |
| **验收标准** | 1. codebase-memory-mcp 索引成功 2. nodes > 0 且 edges > 0 3. 搜索可用 |

---

## V6 任务优先级建议

| 优先级 | 任务 | 可达性 | 原因 |
|--------|------|--------|------|
| P1 | V6-2 Horizon cron 自动入 vault | 需复验 | Horizon MCP 需复验可用性、API key 和 cron 写入路径 |
| P2 | V6-6 CodeGraph 重新索引 | 需复验 | 需先验证 MCP 状态 |
| P3 | V6-4 SQLite/Filesystem/Git MCP 配齐 | 现在可做 | MCP UI 已有，只需配 server |
| P4 | V6-3 K3 学习方向每周自动更新 | 需要前置 | 需先修复 cron 根因 |
| P5 | V6-1 GBrain typed links + dream cycle | 暂缓 | 需额外设计定义 |
| P6 | V6-5 HCC 流程入主线 | 暂缓 | 需产品决策 |

---

## 前置条件

1. **Cron 根因修复** — DeepSeek key 401 + WeChat/iLink rate limited 需先解决
2. **MCP 服务状态验证** — codebase-memory-mcp / Horizon 需先确认可用
3. **产品决策** — HCC 阶段 1-4 是否需要完整实现需用户确认

---

## 锁定规则

V6 是锁定路线图的一部分。
- 任务只增不减，除非用户明确批准。
- 优先级调整需新建 ADR + 用户确认。
- 知识库内容不自动进入 V6，需用户明确批准。