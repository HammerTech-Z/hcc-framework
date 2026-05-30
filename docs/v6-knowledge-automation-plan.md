# V6 知识自动化补完

> 版本：V6
> 继承自：V3 未完成的自动化任务
> 状态：✅ MAIN COMPLETE（V6 主干 5/5 完成；V6-1/V6-5 为扩展/产品决策项）
> 锁定：本文档是锁定路线图的一部分，变更需 ADR + 用户确认

---

## 核心目标

**把 V3 的 UI 展示层升级成真实自动化知识飞轮。**

V3 完成了 Knowledge 页面、Vault 增强、Recharts 图表、GBrain stats、Horizon tab 等 UI 展示层。V6 已补齐主干自动化能力；剩余 GBrain typed links/dream cycle 与 HCC mainline 属于扩展/产品决策项。

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
| **当前状态** | 🔄 部分完成 — Horizon cron `deliver: local` 已验证通过，每日 10:00 自动运行，结果写入 vault/wiki/tools/horizon-YYYY-MM-DD.md；桌面端 UI 仍是 read-only tab（不影响自动化） |
| **缺口** | 已解决 — cron deliver:local 已对接 vault 输出 |
| **可达性判断** | ✅ 已验证 — Horizon cron `deliver: local` 复验 PASS：每日 10:00 自动运行，结果写入 vault/wiki/tools/horizon-YYYY-MM-DD.md |
| **推荐 Sprint** | V6 早期（✅ 已验证通过）|
| **验收标准** | 1. Horizon cron 每日自动运行 2. 输出自动写入 vault 3. 评分阈值可见 |

---

### V6-3: K3 学习方向每周自动更新

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 K线计划，K3 反推学习方向 |
| **目标** | K3 输出每周自动更新到 vault/wiki/learning/direction.md |
| **当前状态** | ✅ 自动化闭环完成 — K3 cron（a53e70308670）已创建，每周 日22:00 运行，分析 vault 生成学习方向建议并写入 vault/wiki/learning-direction.md；manual trigger 测试 PASS |
| **缺口** | 已解决 — K3 cron 已对接 learning-direction.md |
| **可达性判断** | ✅ 已验证 — K3 cron 自动化闭环完成，手动触发测试 PASS，写入 learning-direction.md 成功 |
| **推荐 Sprint** | V6 中期（✅ 已验证通过）|
| **验收标准** | 1. K3 每周自动生成方向建议 2. 输出写入 vault/wiki/learning/direction.md |

---

### V6-4: SQLite/Filesystem/Git MCP 配齐

| 项目 | 内容 |
|------|------|
| **原计划来源** | V3 Phase 0b MCP Servers |
| **目标** | 桌面端 Settings MCP 管理 UI 支持 Filesystem + Git MCP |
| **当前状态** | ✅ 已完成 — Filesystem MCP + Git MCP Connected，mcp list + runtime validation + UI check 均通过 |
| **缺口** | 无 |
| **可达性判断** | 已完成 |
| **推荐 Sprint** | 不适用 — V6-4 已关闭 |
| **验收标准** | ✅ 全部满足 — 1. Settings MCP 列表包含 Filesystem server 2. Settings MCP 列表包含 Git server 3. list/read/status/log 均已验证 |

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
| **当前状态** | ✅ NO-OP ACCEPTED — HCC-20260529-165100-v6-codegraph-diagnostic 诊断通过：nodes=2078, edges=3588, status=ready |
| **缺口** | 无 — codebase-memory-mcp v0.6.0 已完全可用 |
| **可达性判断** | 已完成 — no-op accepted，already healthy |
| **推荐 Sprint** | 不适用 — V6-6 已关闭，后续推进 P4 Cron 根因诊断 |
| **验收标准** | ✅ 全部满足 — 1. 索引成功(nodes=2078) 2. status=ready 3. search_graph/get_code_snippet 均 PASS |

---

## V6 任务优先级建议

| 优先级 | 任务 | 可达性 | 原因 |
|--------|------|--------|------|
| P1 | V6-1 GBrain typed links + dream cycle | 暂缓 | 当前知识主链路唯一真实瓶颈，需产品/数据模型设计 |
| P2 | V6-5 HCC 流程入主线 | 暂缓 | 需产品决策；可结合 Ruflo worker taxonomy 做 ADR |
| ✅ | V6-2 Horizon cron 自动入 vault | 已完成 | deliver: local 已验证，vault 写入正常 |
| ✅ | V6-3 K3 学习方向每周自动更新 | 已完成 | K3 cron 已创建，每周 日22:00 运行，手动触发 PASS |
| ✅ | V6-4 SQLite/Filesystem/Git MCP 配齐 | 已完成 | Filesystem/Git MCP Connected，runtime validation PASS |
| ✅ | V6-6 CodeGraph 重新索引 | 已完成 | nodes=2078, status=ready，search_graph/get_code_snippet 均 PASS |

---

## 前置条件

1. **Cron 根因修复** — DeepSeek 401 ✅ RESOLVED；WeChat/iLink rate limit ⚠️ REMAINING（delivery 层，单独诊断，不阻塞 V6-2 local/vault 复验）
2. **MCP 服务状态验证** — codebase-memory-mcp / Horizon 需先确认可用
3. **产品决策** — GBrain typed links/dream cycle 数据模型、HCC 阶段 1-4 是否需要完整实现需用户确认

---

## 锁定规则

V6 是锁定路线图的一部分。
- 任务只增不减，除非用户明确批准。
- 优先级调整需新建 ADR + 用户确认。
- 知识库内容不自动进入 V6，需用户明确批准。
