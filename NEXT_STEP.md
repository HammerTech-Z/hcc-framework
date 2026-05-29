# Hermes Pro — 下一步行动指南

> 最后更新：2026-05-29（BaiLongma POC-2 QA PASS + P0/P1 完成 + P2 进行中）
> 当前状态：V1/V2 完成，V3 UI 完成，V4 BaiLongma POC-2 ✅+QA PASS，下一步 P2 V6 知识自动化任务排序；Productionization NOT APPROVED

## 当前真实状态

| 版本 | 状态 | 说明 |
|------|------|------|
| V1 | ✅ 完成 | 基础可用 |
| V1.5 | ✅ 完成 | 修复阶段 |
| V2 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory；BaiLongma 已移出到 V4 |
| V3 | ✅ UI完成 | Knowledge/Vault/Recharts/GBrain/Horizon；自动化 backlog 迁移到 V6 |
| V4 | ✅ POC-2+QA PASS | BaiLongma Layer 1-3 + POC-1 + POC-2 + typecheck通过 + Manual QA PASS；Productionization NOT APPROVED |
| V5-V7 | ⏳ 未启动 | 锁定版路线图后续版本 |

### V4 BaiLongma 当前进度

| 任务 | 状态 |
|------|------|
| Layer 1-3 设计文档 | ✅ 完成 |
| README + POC Plan | ✅ 完成 |
| POC-1 静态只读 screen | ✅ 完成 |
| POC-2 真实 cron 只读数据 | ✅ 完成 |
| npm run typecheck | ✅ 通过 |
| Manual QA | ✅ PASS（2026-05-29）|
| Productionization | ❌ NOT APPROVED（用户选择3d：暂不批准，只读增强方向）|

---

## 下一步优先级

| 优先级 | 任务 | 说明 |
|--------|------|------|
| ~~**P0**~~ | ~~BaiLongma Manual QA~~ ✅ 已完成 | POC-2 只读数据验证，cron 失败诊断 screen 手动测试 |
| ~~**P1**~~ | ~~路线图锁定确认~~ ✅ 已完成 | 确认 docs/roadmap-locked-2026-05-28.md 是唯一计划入口 |
| **P2** | V6 知识自动化任务排序（进行中）| 评估 V6-2 Horizon cron / V6-4 MCP 配齐 / V6-6 CodeGraph 的优先级 |
| **P3** | V7 生态工具前置条件排查 | CLI-Anything Python TLS / iLink rate limit / **Mano-P 硬件不匹配（16GB < 32GB）；UI-TARS Desktop 作为候选试点评估** |
| **P4** | Cron 根因修复 | DeepSeek 401 ✅ RESOLVED；WeChat/iLink rate limit ⚠️ REMAINING（delivery 层，单独处理） |

> **Productionization NOT APPROVED** — P0/P1 已完成，P2 V6 知识自动化任务排序进行中

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [docs/roadmap-locked-2026-05-28.md](./docs/roadmap-locked-2026-05-28.md) | 锁定版路线图（唯一计划入口） |
| [docs/v6-knowledge-automation-plan.md](./docs/v6-knowledge-automation-plan.md) | V6 知识自动化计划 |
| [docs/v7-ecosystem-integration-plan.md](./docs/v7-ecosystem-integration-plan.md) | V7 生态工具计划 |
| [docs/deprecation-candidates-2026-05-28.md](./docs/deprecation-candidates-2026-05-28.md) | 废弃/过时候选清单 |
| [docs/v2-status.md](./docs/v2-status.md) | V2 各任务实际状态 |
| [docs/v3-status.md](./docs/v3-status.md) | V3 各任务实际状态 |
| [docs/bailongma/README.md](./docs/bailongma/README.md) | BaiLongma 设计索引 |

---

## 路线图锁定规则

- **知识库内容不自动改变路线图**。vault/归档内容只能进入候选池，需用户明确批准。
- **禁止 Agent 自行改路线图**。任何路线图变更必须新建 ADR + 用户确认。
- **已完成的版本不得回滚**。除非用户明确说"解锁路线图"。
- **发现计划 bug 时，Agent 可以报告 Roadmap Bug Report，由用户决定是否修改；不得自行改路线图**。

---

*本文档最后更新：2026-05-29（HCC v2 主流程更新 + code_dev fallback 规则）*

## HCC v2 代码任务入口（2026-05-29）

以后代码任务默认流程：
Hermes 需求翻译/调度 -> 用户确认 -> 双视角审计划 -> Claude Code 隔离 worktree 执行 -> Codex 双审+测试 -> 用户交付

仅当 HCC v2 修复 3 次仍无法执行或无法通过测试时，降级到旧 code_dev：
Hermes -> Karpathy planner -> Claude Code executor -> Bellard reviewer -> deliver/escalate -> reflect
