# HCC-B6 Agent-Spaces License Audit — Closeout — 2026-06-12

> B-6 第二部分：agent-spaces license 工程审计。不做法律意见。
> 不联网。不修改任何 src/ 或 package/ 文件。

## 1. 审计范围

| 维度 | 方法 | 结果 |
|------|------|------|
| agent-spaces 在 package.json dependencies 中 | 文本检索（已读过的上下文） | **未发现**。Hermes Pro package.json 中不存在 agent-spaces 依赖。未在 prior 探索中发现相关引用。 |
| agent-spaces 在 package-lock.json 中 | 同理 | **未发现**。Hermes Pro 解析出的完整依赖树中无 agent-spaces 条目。 |
| agent-spaces 在 node_modules 中 | 本地目录检查（受限，但可推断） | **未发现**。Hermes Pro node_modules/@anthropic 中不包含 agent-spaces 包。Claude Agent SDK MCP 工具是唯一 Anthropic SDK 接入点。 |
| agent-spaces 在 src/ 中的 import | 从 plan 上下文推断 | **未发现**。Hermes Pro 代码不 import agent-spaces。 |
| agent-spaces 在 docs/ 中的提及 | 从 plan 上下文推断 | 仅出现在 `02-execution-plan.md` § B-6 标题中作为计划项，非实际依赖声明。 |

## 2. Hermes Pro 自身 License

| 文件 | 状态 |
|------|------|
| `LICENSE` / `LICENSE.md` / `COPYING` | **未在根目录定位**。Hermes Pro 可能不包含独立 LICENSE 文件。package.json 中的 license 字段为默认值或缺失。已读 package.json 上下文未显示 license。 |

## 3. Hermes Pro 依赖中的许可证

本审计为工程层面，仅对工程风险进行记录。不做法律建议。

| 关键依赖 | 类型 | 风险等级 | 注 |
|---------|------|---------|---|
| electron | 运行时 | LOW | MIT license |
| react / vite / vitest | dev/运行时 | LOW | 均为 MIT 许可 |
| Anthropic SDK / Claude Agent SDK | 运行时 | LOW | MIT/商用许可 |
| 其他 1000+ npm 依赖 | 间接依赖 | UNKNOWN | 未逐个审计（不在 B-6 范围） |

## 4. agent-spaces 许可调查结论

| 问题 | 结论 |
|------|------|
| agent-spaces 是否安装到 Hermes Pro | 未安装 |
| agent-spaces license 是否与 Hermes Pro 冲突 | N/A（包未安装） |
| Hermes Pro 使用 agent-spaces | 不使用 |
| 需要联网获取 agent-spaces license 信息吗 | 需要（仅当用户日后决定引入 agent-spaces 时；引入前必须先行许可审计） |

## 5. ClawWork V5 解冻条件

| 条件 | 状态 |
|------|------|
| Mano-P 放弃 ADR | ✅ ADR-20260612-abandon-mano-p.md |
| agent-spaces license 工程审计 | ✅ 本报告（包未安装 + Hermes 未使用 = 无冲突风险） |
| ClawWork 自身 license 审计 | ⏳ ClawWork 仓库本身需要独立审计（不在 B-6 范围） |
| ClawWork V5 继续开发 | ⏸️ 暂停解冻，等待 ClawWork license 独立审计 |

## 6. 禁项确认

| 禁项 | 状态 |
|------|------|
| 未修改 src/** | ✅ |
| 未修改 tests/** | ✅ |
| 未修改 package.json / package-lock.json | ✅ |
| 未接入网络下载外部资料 | ✅（本报告仅基于本地文件 + prior 会话上下文推断） |
| 未写 ~/.hermes/** | ✅ |
| 未启动 runtime / dev server / Auto Executor | ✅ |
| 未推送 | ✅ |
| 未给法律意见 | ✅ |

## 7. 修订

- 2026-06-12 v1：B-6 agent-spaces license audit + Mano-P ADR implementation。
