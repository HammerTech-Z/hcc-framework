# V3 知识赋能 — 状态追踪

> 创建日期：2026-05-26
> 主题：知识赋能

## 任务列表

| 优先级 | 任务 | 类型 | 状态 |
|--------|------|------|------|
| 1 | Knowledge 页面重修（CSS + i18n） | 桌面端独立 | ✅ 2 commits: CSS 类化 + i18n 4 语言 |
| 2 | Vault 增强（文件读取 + 统计） | 桌面端独立 | ✅ 2 commits: IPC + Vault tab (文件浏览/预览/统计) |
| 3 | recharts 引入 + AgentMonitor 图表升级 | 桌面端独立 | ✅ recharts 3.x + Session Trends BarChart + 主题感知 useChartColors hook |
| 4 | Understand → Vault 打通 | 桌面端独立 | ✅ 递归 Vault 可见 + 保存状态提示 + frontmatter |
| 5 | GBrain 统计面板 | Gateway + 桌面端 | ✅ Gateway `/knowledge/stats` + Knowledge GBrain tab |
| 6 | Horizon 集成面板 | 桌面端独立 | ✅ Knowledge Horizon tab（只读展示） |

## V3 前置调查结论（2026-05-26）

- Gateway 已有 `/knowledge/search` + `/knowledge/ingest` + `/knowledge/stats`
- 桌面端不直连 Postgres，所有知识操作走 Gateway HTTP
- Knowledge.tsx 209 行，全部 inline style，无 i18n namespace
- 项目无图表库依赖，AgentMonitor 柱状图是纯 div 手绘
- Horizon 是独立 MCP server（`~/Horizon-src/`），桌面端零引用
- pipeline-runs 仅 1 条记录，数据量不支持有意义的可视化

## 记录历史

- 2026-05-26：初版创建
- 2026-05-26：标记 V3.4 Understand → Vault 打通完成
- 2026-05-26：标记 V3.5 GBrain 统计面板完成
