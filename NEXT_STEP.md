# Hermes Pro — 下一步行动指南

> 最后更新：2026-05-26
> 当前状态：v1.5-final（V2 迭代已完成）

## 当前状态

V1.0 → V1.5 → V2 已全部完成。详见：
- V1.5 完成报告：[V1.5-COMPLETION.md](./V1.5-COMPLETION.md)
- V2 状态追踪：[docs/v2-status.md](./docs/v2-status.md)
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

⚠️ V2 的经验：快照描述与实际代码多次不符。启动 V3 前必须先做现状调查。

### 已知的 V3 前置问题

1. **桌面端无 GBrain 查询接口** — V2.2 调查确认，GBrain 状态仅在 Hermes agent 端
2. **pipeline-runs 无自动清理** — V1 限制 #4
3. **Understand-Anything 仍为 heuristic 模式** — V1 限制 #5
4. **HCC 阶段 1-4 未在代码中定义**
5. **BaiLongma** — 需要设计定义后再排期（范围/ACUI 协议/视觉方案/集成方案）

## 待决事项

- [ ] V3 各任务现状调查（启动前）
- [ ] GBrain 桌面端接口方案
- [ ] BaiLongma 设计文档
- [ ] HANDOFF.md 历史内容归档清理
