# ADR-20260530: V7-5 Delivery 解绑 — 从 V7 主线移出，归入独立 Delivery/Reliability 任务池

**日期**: 2026-05-30
**状态**: ADR 候选（待用户确认）
**类型**: 架构解绑决策
**影响范围**: V7 主线、每日知识摘要任务归属

---

## 背景

V7-5 "每日知识摘要自动推送" 当前状态：
- **计划位置**: docs/v7-ecosystem-integration-plan.md §V7-5 + docs/roadmap-locked-2026-05-28.md §原V4→V7映射表
- **阻塞根因**: WeChat/iLink delivery 账号（o9cq80-y）受 rate limit 阻塞
- **任务本质**: delivery 层可靠性问题，不是 Hermes 生态工具集成问题

**问题**: V7 主线当前只有 V7-1 CLI-Anything 可执行，其他任务全部暂缓。V7-5 是 delivery 层问题，不应阻塞 V7 主线的生态工具集成进度。

---

## 决策

**建议**: V7-5 从 V7 主线解绑，改为独立 delivery/reliability 任务。

| 改动 | 说明 |
|------|------|
| V7-5 从 V7 主线任务移出 | 不再作为 V7 进度阻塞项 |
| 任务本身保留 | 每日摘要功能不取消，只改变归属 |
| 新归属 | Delivery/Reliability 任务池（独立于 V7） |
| V7 优先级表更新 | V7-5 从 P5 暂缓改为"解绑归属变更" |

---

## 影响

### 正面
- V7 主线不再被 delivery 层问题阻塞
- 每日知识摘要任务有独立解决路径（不依赖 V7 生态工具进展）
- WeChat/iLink rate limit 可作为独立诊断闭环处理

### 需要确认
- 修改 v7-ecosystem-integration-plan.md 中 V7-5 状态为"解绑"
- NEXT_STEP.md 中 P3 WeChat/iLink 诊断 保持独立任务
- **不修改** docs/roadmap-locked-2026-05-28.md（需 ADR + 用户确认才能改 locked roadmap）

---

## 保留任务详情

**每日知识摘要自动推送** 任务不取消：
- ✅ 目标：每日自动生成知识摘要
- ⏳ 阻塞：WeChat/iLink rate limit（账号 o9cq80-y）
- 📋 解法：独立诊断 WeChat/iLink 账号问题，或评估其他 delivery 渠道（飞书/邮件/Telegram）

**后续闭环**：单独启动 WeChat/iLink rate limit 诊断 → 解决后恢复每日摘要推送。

---

## 执行建议

1. ✅ 创建本 ADR 候选（低风险文档）
2. ⏸️ 更新 v7-ecosystem-integration-plan.md 中 V7-5 状态（需用户确认，因为它关联 locked roadmap）
3. ⏸️ 修改 NEXT_STEP.md P3 描述（需用户确认，因为它关联 locked roadmap）
4. 🔴 **不修改** docs/roadmap-locked-2026-05-28.md（ADR + 用户确认后才能改）
5. 🔴 **不处理** WeChat/iLink rate limit（本次闭环范围外）

---

## 备注

- V7 生态工具主线任务（V7-1/2/3/4）不受本 ADR 影响
- V7-1 MVP 已完成（Safari MCP smoke test PASS）
- V7-5 任务本身仍然有效，只是归属变更

---

**等待用户确认后再执行 v7 plan 和 NEXT_STEP 的更新。**