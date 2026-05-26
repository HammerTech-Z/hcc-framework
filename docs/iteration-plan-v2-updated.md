# Hermes 迭代计划 V2 — 更新副本

> 本文件是 `~/.hermes/docs/Hermes-迭代计划-v2.md` 的更新副本
> 原始版本日期：2026-05-24 | 本副本更新：2026-05-26
> 更新原因：原始计划中的 V1/V2 任务状态已与代码事实严重偏离

---

## 版本总览

| 版本 | 口号 | 状态 | 说明 |
|------|------|------|------|
| **V1** | 基础可用 | ✅ 已完成 | tag hermes-pro-1.0 |
| **V1.5** | 修复阶段 | ✅ 已完成 | tag v1.5-final，10 commits |
| **V2** | 效率提升 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory 完成，BaiLongma 移出 |
| **V3** | 知识赋能 | ⏳ 待启动 | GBrain 增强 + 知识可视化 + Horizon |
| **V4** | 生态融合 | ⏳ 待启动 | CLI-Anything + Mano-P + Ruflo |
| **V5** | 变现检验 | ⏳ 待启动 | AI 视频 + 语音 Dograh |

---

## V1 — 基础可用（✅ 已完成）

以下为原始计划中的 V1 任务及其真实状态：

| 任务 | 原始状态 | 实际状态 | 完成日期 |
|------|---------|---------|---------|
| K1.5 嵌入修复（GBrain） | ⏳ 待执行 | ✅ 已完成 | 2026-05-25 |
| hermes-pro 启动修复 | ⏳ 待执行 | ✅ 已完成 | 2026-05-25 |
| Understand-Anything | ⏳ 待执行 | ✅ 已完成 | V1 阶段 |
| llm-checker | ⏳ 待执行 | ✅ 已完成 | V1 阶段 |
| P4 PlaybookRunner 真实化 | ⏳ 待执行 | ✅ 已完成 | V1 阶段 |

### V1.5 修复阶段（额外增加, 2026-05-26）

| 任务 | 状态 | 说明 |
|------|------|------|
| IPC 三端一致性 | ✅ fix(ipc) | 修复 4 处签名不匹配 |
| TypeScript any 泄漏 | ✅ refactor(types) | 清除 any 泄漏，创建 shared/types |
| PlaybookRunner 阻塞 | ✅ refactor(playbook) | execSync → spawn + 流式输出 |
| Understand UI i18n | ✅ fix(i18n) | 硬编码字符串迁移 |
| es/pt-BR 语言包 | ✅ feat(i18n) | 补齐 understand.ts |
| CSS 类审计 | ✅ docs(css) | 12 个未用类 |
| vitest + better-sqlite3 | ✅ fix(test) | 添加 rebuild 脚本 |
| reasoning 字段注入 | ✅ feat(understand) | heuristic + LLM 双模式 |

---

## V2 — 效率提升（✅ 4/5 完成）

| 任务 | 原始状态 | 实际状态 | 说明 |
|------|---------|---------|------|
| Theme 选择器 | 待开发 | ✅ 已有完整实现 | 2 套主题 + system + ThemeProvider + Settings UI |
| AgentMonitor 增强 | 待启动 | ✅ 3 commits | CSS 类化 + i18n 4 语言 + 实时执行面板 |
| MCP 管理 UI | 待启动 | ✅ 5 commits | 4 IPC + Settings CRUD + i18n + 测试连接 |
| Memory 编辑器 | 待启动 | ✅ 已有完整实现 | CRUD + i18n + 容量指示 + 7 providers |
| BaiLongma 落地 | 待启动 | ⏸️ 移出 V2 | 代码零实现，需设计定义后重新排期 |

详见 [docs/v2-status.md](./docs/v2-status.md)

---

## V3 — 知识赋能（⏳ 待启动）

原始计划保留。⚠️ 启动前必须做现状调查（V2 的经验）。

已知的 V3 前置问题（2026-05-26 调查）：
1. 桌面端无 GBrain 查询接口
2. pipeline-runs 无自动清理
3. Understand-Anything 仍为 heuristic 模式
4. HCC 阶段 1-4 未在代码中定义
5. BaiLongma 需要设计定义后再排期

---

## V4 — 生态融合（⏳ 待启动）

原始计划保留。⚠️ 启动前需做现状调查。

---

## V5 — 变现检验（⏳ 待启动）

原始计划保留。⚠️ 启动前需做现状调查。

---

*本文件是 ~/.hermes/docs/Hermes-迭代计划-v2.md 的更新副本（2026-05-26）。*
*原始文件保留以提供历史参考。*
