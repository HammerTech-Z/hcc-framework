# Hermes Pro — 下一步行动指南

> 最后更新：2026-05-26
> 当前状态：V3 进行中（V3.5 已完成，待提交）

## 当前状态

V1.0 → V1.5 → V2 已全部完成，V3.1 → V3.5 已完成。详见：
- V1.5 完成报告：[V1.5-COMPLETION.md](./V1.5-COMPLETION.md)
- V2 状态追踪：[docs/v2-status.md](./docs/v2-status.md)
- V3 状态追踪：[docs/v3-status.md](./docs/v3-status.md)
- Confidence 设计：[docs/confidence-design.md](./docs/confidence-design.md)
- CSS 审计：[docs/css-audit-2026-05-26.md](./docs/css-audit-2026-05-26.md)
- 归档文档：[docs/archive/README.md](./docs/archive/README.md)

### V2 完成总结

| 任务 | 状态 | 说明 |
|------|------|------|
| Theme 选择器 | ✅ 已有完整实现 | 2 套主题 + system 跟随 |
| AgentMonitor 增强 | ✅ 3 commits | CSS 类化 + i18n + 实时执行面板 |
| MCP 管理 UI | ✅ 5 commits | 4 IPC + Settings CRUD + i18n |
| Memory 编辑器 | ✅ 已有完整实现 | CRUD + i18n + 7 providers |
| BaiLongma 落地 | ⏸️ 移出 V2 | 代码零实现，待设计定义后重新排期 |

## 下一步：V3（知识赋能）

V3 计划任务：**GBrain 增强 + 知识可视化 + Horizon**

V3 当前进度：

| 任务 | 状态 |
|------|------|
| V3.1 Knowledge 页面重修 | ✅ 完成 |
| V3.2 Vault 增强 | ✅ 完成 |
| V3.3 Recharts 图表升级 | ✅ 完成 |
| V3.4 Understand → Vault 打通 | ✅ 完成，待提交 |
| V3.5 GBrain 统计面板 | ✅ 完成，待提交 |
| V3.6 Horizon 集成面板 | ⏳ 待确认 |

### 已知的 V3 前置问题

1. **GBrain stats 已接入桌面端** — Gateway `/knowledge/stats` + Knowledge GBrain tab
2. **pipeline-runs 无自动清理** — V1 限制 #4
3. **Understand-Anything 已接 vault，但 LLM 仍依赖本地 `ollama run llama3.2` 可用性**
4. **HCC 阶段 1-4 未在代码中定义**
5. **BaiLongma** — 需要设计定义后再排期（范围/ACUI 协议/视觉方案/集成方案）

## 待决事项

- [ ] 提交 V3.4/V3.5 当前工作区改动
- [ ] Horizon 集成面板现状调查
- [ ] BaiLongma 设计文档
- [ ] HANDOFF.md 历史内容归档清理
