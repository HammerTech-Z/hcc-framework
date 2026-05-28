# Hermes Pro — 锁定版路线图兼容索引（2026-05-28）

> 版本：Locked Roadmap Index v1.0
> 更新日期：2026-05-28
> **本文件不是唯一计划入口；唯一计划入口是 [roadmap-locked-2026-05-28.md](./roadmap-locked-2026-05-28.md)。本文件仅为旧引用兼容和阅读索引。**
> 替换：原 iteration-plan-v2-updated.md（已归档为 archive/iteration-plan-v2-updated-2026-05-28.md）
> 锁定规则：禁止 Agent 自行修改；变更需新建 ADR + 用户确认

---

## 路线图锁定声明

本文档是锁定路线图的兼容副本/索引；唯一计划入口是 [roadmap-locked-2026-05-28.md](./roadmap-locked-2026-05-28.md)。

- **知识库内容不自动改变路线图**。vault/Desktop知识/归档文档只能进入候选池，需用户明确批准才能进入锁定主线。
- **禁止 Agent 自行修改路线图**。任何路线图变更必须新建 ADR，并等待用户确认。
- **已完成的版本不得回滚**。除非用户明确说"解锁路线图"。
- **Roadmap Bug Report 通道**：Agent 发现路线图错误时，只能报告给用户，不能自行修改。

---

## 版本总览（V1-V7）

| 版本 | 口号 | 状态 | 说明 |
|------|------|------|------|
| **V1** | 基础可用 | ✅ 完成 | tag hermes-pro-1.0 |
| **V1.5** | 修复阶段 | ✅ 完成 | tag v1.5-final，10 commits |
| **V2** | 效率提升 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory 完成，BaiLongma 移出 |
| **V3** | 知识赋能 | ✅ UI完成 | Knowledge/Vault/Recharts/Understand→Vault/GBrain stats/Horizon tab；自动化 backlog 待补 |
| **V4** | BaiLongma认知编排 | 🔄 POC-2完成 | Layer 1-3 + POC-1 + POC-2 + typecheck通过；Manual QA待执行 |
| **V5** | 变现检验 | ⏳ 未启动 | AI视频 + 语音 Dograh |
| **V6** | 知识自动化补完 | ⏳ 待启动 | 承接V3未完成的自动化任务 |
| **V7** | 生态工具融合 | ⏳ 待启动 | 承接原V4未完成的生态融合任务 |

---

## V1 — 基础可用（✅ 完成）

| 任务 | 状态 | 说明 |
|------|------|------|
| K1.5 嵌入修复（GBrain ZeroEntropy 1280d） | ✅ 完成 | GBrain 恢复主线 |
| hermes-pro 启动修复（electron-vite 兼容） | ✅ 完成 | 启动修复完成 |
| Understand-Anything 安装 | ✅ 完成 | Understand 集成 |
| llm-checker 安装 | ✅ 完成 | llm-checker 集成 |
| P4 PlaybookRunner 真实化（HCC 流程） | ✅ 完成 | PlaybookRunner 重写，HCC 阶段 5-7 支持 |

### V1.5 修复阶段（额外增加）

| 任务 | 状态 | 说明 |
|------|------|------|
| IPC 三端一致性 | ✅ 完成 | 修复 4 处签名不匹配 |
| TypeScript any 泄漏 | ✅ 完成 | 清除 any 泄漏，创建 shared/types |
| PlaybookRunner 阻塞 | ✅ 完成 | execSync → spawn + 流式输出 |
| Understand UI i18n | ✅ 完成 | 硬编码字符串迁移 |
| es/pt-BR 语言包 | ✅ 完成 | 补齐 understand.ts |
| CSS 类审计 | ✅ 完成 | 12 个候选类审计 |
| vitest + better-sqlite3 | ✅ 完成 | 添加 rebuild 脚本 |
| reasoning 字段注入 | ✅ 完成 | heuristic + LLM 双模式 |

---

## V2 — 效率提升（✅ 4/5 完成）

| 任务 | 状态 | 说明 |
|------|------|------|
| Theme 选择器 | ✅ 已有完整实现 | 2 套主题（dark/light）+ system 跟随 |
| AgentMonitor 增强 | ✅ 3 commits | CSS 类化 + i18n 4 语言 + 实时执行面板 |
| MCP 管理 UI | ✅ 5 commits | 4 IPC + Settings CRUD + i18n + 测试连接 |
| Memory 编辑器 | ✅ 已有完整实现 | CRUD + i18n + 容量指示 + 7 providers |
| BaiLongma 落地 | ⏸️ 移出 V2 | 设计闭环和 POC-2 在 V4 完成，不再是 V2 缺口 |

详见 [v2-status.md](./v2-status.md)。

---

## V3 — 知识赋能（✅ UI完成，自动化 backlog 待补）

V3 UI 集成已完成，但自动化飞轮未闭环。

### V3 UI 已完成项

| 任务 | 状态 | 提交 |
|------|------|------|
| Knowledge 页面重修 | ✅ 完成 | CSS 类化 + i18n |
| Vault 增强（文件读取 + 统计） | ✅ 完成 | IPC + Vault tab |
| recharts 图表升级 | ✅ 完成 | Session Trends BarChart |
| Understand → Vault 打通 | ✅ 完成 | 保存状态 UI + i18n |
| GBrain 统计面板 | ✅ 完成 | `/knowledge/stats` + GBrain tab |
| Horizon 集成面板（只读） | ✅ 完成 | Horizon tab（read-only） |

### V3 自动化未完成项 → 迁移到 V6

| 任务 | 状态 | 原因 |
|------|------|------|
| GBrain typed links + dream cycle | ❌ 未实现 | 需额外设计定义 |
| Horizon cron 自动入 vault + 评分阈值 | ❌ 未实现 | 桌面端只有 read-only tab |
| K3 学习方向每周自动更新 | ❌ 未实现 | cron 存在但 K3 任务未完成自动化闭环 |
| SQLite/Filesystem/Git MCP 配齐 | ⏳ 部分完成 | MCP UI 已有，但 Filesystem/Git 未配齐 |
| HCC 流程入主线 | ❌ 未完成 | 阶段 1-4 未在代码中定义 |
| CodeGraph / codebase-memory-mcp 重新索引 | ❌ 未验证 | 存档文档称 177文件/1222节点，实际 nodes/edges=0 |

详见 [v6-knowledge-automation-plan.md](./v6-knowledge-automation-plan.md)。

---

## V4 — BaiLongma 认知编排

### BaiLongma 设计闭环

BaiLongma 是 Hermes Pro 的 TICK-aware 任务驾驶舱与认知编排层。

| 文件 | 内容 |
|------|------|
| [bailongma/01-scope-and-role.md](./bailongma/01-scope-and-role.md) | Layer 1 范围与角色 |
| [bailongma/02-acui-protocol.md](./bailongma/02-acui-protocol.md) | Layer 2 ACUI 协议 |
| [bailongma/03-visual-and-integration.md](./bailongma/03-visual-and-integration.md) | Layer 3 视觉与集成 |
| [bailongma/04-poc-plan.md](./bailongma/04-poc-plan.md) | POC 计划 |
| [bailongma/05-poc-implementation-review.md](./bailongma/05-poc-implementation-review.md) | POC 实现评审 |
| [bailongma/README.md](./bailongma/README.md) | 设计索引 |

### POC 实现状态

| POC | 描述 | 状态 |
|-----|------|------|
| POC-1 | 静态只读 screen | ✅ 完成 |
| POC-2 | 真实 cron 只读数据 | ✅ 完成：`window.hermesAPI.listCronJobs(true, profile)` |
| Manual QA | 只读数据验证 | ⏳ 待执行 |
| Productionization | Layer 4 完整实现 | ❌ NOT APPROVED |

### V4 下一步：Manual QA

> **Productionization NOT APPROVED**
> 当前下一步是 Manual QA，不是生产化。

---

## V5 — 变现检验（⏳ 未启动）

| 任务 | 状态 | 说明 |
|------|------|------|
| AI 漫剧流水线 | ⏳ 未启动 | 分镜/提示词流水线 |
| 小说分析 + 编剧辅助 | ⏳ 未启动 | 内容分析工具 |
| Dograh 语音 Agent | ⏳ 未启动 | 语音交互 |
| 视频软件操作验证 | ⏳ 未启动 | 视频生成流水线 |

⚠️ 启动前需做现状调查。

---

## V6 — 知识自动化补完（⏳ 待启动）

承接 V3 未完成的自动化任务。

详见 [v6-knowledge-automation-plan.md](./v6-knowledge-automation-plan.md)。

| 任务 | 状态 | 可达性 |
|------|------|--------|
| V6-1 GBrain typed links + dream cycle | ❌ 未实现 | 暂缓，需设计定义 |
| V6-2 Horizon cron 自动入 vault | ❌ 未实现 | 现在可做 |
| V6-3 K3 学习方向每周自动更新 | ❌ 未实现 | 需要前置修复 cron |
| V6-4 SQLite/Filesystem/Git MCP 配齐 | ⏳ 部分完成 | 现在可做 |
| V6-5 HCC 流程入主线 | ❌ 未完成 | 暂缓，需产品决策 |
| V6-6 CodeGraph 重新索引 | ❌ 未验证 | 现在可做，需先验证 MCP |

---

## V7 — 生态工具融合（⏳ 待启动）

承接原 V4 未完成的生态融合任务。

详见 [v7-ecosystem-integration-plan.md](./v7-ecosystem-integration-plan.md)。

| 任务 | 状态 | 阻塞原因 |
|------|------|---------|
| V7-1 CLI-Anything | ❌ 未集成 | Python 3.14 TLS 阻塞 |
| V7-2 Ruflo loop-workers | ❌ 未接入 | Hermes cron 问题在业务层 |
| V7-3 Mano-P | ⏸️ 候选暂缓 | 当前 M5 16GB 不满足 Mano-P 本地部署内存要求；UI-TARS Desktop 进入候选试点，不入主线 |
| V7-4 OpenHuman Memory Tree | ❏ 未启动 | 需设计定义 |
| V7-5 每日知识摘要 | ❌ 未实现 | iLink rate limit 阻塞 |

**注意**：V7 全部任务当前都是"暂缓"，这是正常状态，不代表放弃。

---

## 路线图变更规则

1. **不允许 Agent 自行改路线图**。发现需变更时，必须新建 ADR 说明原因和建议。
2. **不允许知识库内容自动改路线图**。vault/归档内容只能进入候选池。
3. **任何路线图变更必须新建 ADR**，并等待用户确认后才能修改本文档。
4. **已锁定版本不降级**。已完成的任务标记为完成，不得回滚。
5. **解锁条件**：用户明确说"解锁路线图"后，方可修改本文档。

---

## 当前唯一下一步

> **P0：BaiLongma Manual QA**
> - POC-2 只读数据验证，cron 失败诊断 screen 手动测试
> - Productionization NOT APPROVED

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [roadmap-locked-2026-05-28.md](./roadmap-locked-2026-05-28.md) | 锁定版路线图完整架构图 |
| [v6-knowledge-automation-plan.md](./v6-knowledge-automation-plan.md) | V6 知识自动化计划 |
| [v7-ecosystem-integration-plan.md](./v7-ecosystem-integration-plan.md) | V7 生态工具计划 |
| [deprecation-candidates-2026-05-28.md](./deprecation-candidates-2026-05-28.md) | 废弃/过时候选清单 |
| [NEXT_STEP.md](../NEXT_STEP.md) | 下一步行动指南 |
| [CONTEXT.md](../CONTEXT.md) | 项目上下文 |
| [v2-status.md](./v2-status.md) | V2 各任务实际状态 |
| [v3-status.md](./v3-status.md) | V3 各任务实际状态 |
| [bailongma/README.md](./bailongma/README.md) | BaiLongma 设计索引 |
| [archive/iteration-plan-v2-updated-2026-05-28.md](./archive/iteration-plan-v2-updated-2026-05-28.md) | 本文件旧版本归档 |

---

*本文档是锁定版路线图兼容索引（2026-05-28 重基线）。唯一计划入口为 roadmap-locked-2026-05-28.md；任何修改必须通过 ADR + 用户确认。*
