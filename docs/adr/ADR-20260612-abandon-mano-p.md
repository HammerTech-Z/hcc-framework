# ADR-20260612 — Abandon Mano-P

> Architecture Decision Record。Status: Accepted。
> Date: 2026-06-12。
> Scope: Hermes Pro V7 extension — Mano-P browser automation agent。

## Status

**Accepted**（正式放弃，不再推进）。

## Context

Mano-P 是 Hermes Pro V7 计划中的第三个候选方向（V7 = Safari MCP + browser-use + Mano-P + UI-TARS/OpenAdapt）。原始目标是将 Mano-P（browser automation agent）集成到 Hermes Pro，作为代码任务的浏览器执行能力。相关条目：

- `docs/plan/02-execution-plan.md` § Phase B B-6：Mano-P 正式放弃 ADR + agent-spaces license 审计
- `docs/roadmap-locked-2026-05-28.md`：Mano-P 列在待定项目清单中
- CONTEXT.md：Mano-P 声明为 "已放入待定项目，不是当前计划、不是候选试点"

## Decision

正式放弃 Mano-P 作为 Hermes Pro 的集成方向。

### 放弃原因

1. **browser-use / V7 整体方向已被推迟**。V7 plan 中 browser-use 标记为 DEFER，Mano-P 与 browser-use 属同一执行链。
2. **硬件/云端验证条件不满足**。Mano-P 需要稳定的浏览器执行环境（headful / headless with sandbox），当前 Hermes Pro 本机环境未满足此要求。
3. **用户未授权 Mano-P 继续推进**。CONTEXT.md + NEXT_STEP.md 中多轮均写 "Mano-P 待定，不是当前计划"。
4. **ClawWork 的 V5 应独立解冻**。plan 中标记 "ClawWork 挂 V5 解冻"，不应因 Mano-P 放弃而继续阻塞。
5. **UI-TARS / OpenAdapt 也同样待定**。V7 的主干部分（Safari MCP MVP）已 PASS；browser-use 和 Mano-P 均已推迟。以 Mano-P 的推迟为整体 V7 推迟收口。

### 影响范围

| 影响 | 处置 |
|------|------|
| V7 执行计划 | 不对 Mano-P 做任何实现变更 |
| ClawWork V5 | 独立解冻（licensing 待审计），不因 Mano-P 放弃而阻滞 |
| 路线图 | locked roadmap 中 Mano-P 标记为 Abandoned |
| daily_stock_analysis（ClawWork 上游） | 保留为独立项目，Hermes 不承担 Mano-P 集成 |
| 现有 Mano-P 相关文档 | 不删除，保留为历史记录 |

### 替代路径

1. **Safari MCP**：V7 中已完成的浏览器自动化入口（MVP PASS）。
2. **Claude Code 浏览器能力**：未来如需浏览器执行，优先使用 Claude Code 己身 browser tool（如 built-in Playwright 或 headless browser skill）。
3. **外部 browser agent**：保留为候选池，任何重新引入 Mano-P 需新 ADR + 用户单独授权。

### 回滚条件

- 用户重新明确授权 Mano-P 作为集成方向。
- Hermes Pro 取得稳定的 headless/headful browser 执行环境。
- 新的 ADR 被用户批准。

## Consequences

- Mano-P 不再占用 Hermes Pro 开发资源。
- V7 状态从 PARTIAL_COMPLETE 变为 COMPLETE（Mano-P / browser-use / UI-TARS / OpenAdapt 均推迟或待定；Safari MCP MVP 已完成）。
- ClawWork V5 解冻（条件：agent-spaces license 工程审计单独完成）。
- 本 ADR 不修改任何 src/ 或 tests/ 代码。

## Sources

- `docs/plan/02-execution-plan.md` § Phase B B-6
- `docs/roadmap-locked-2026-05-28.md` § Mano-P
- CONTEXT.md 待定项目清单
- NEXT_STEP.md V7 MANO_PENDING
