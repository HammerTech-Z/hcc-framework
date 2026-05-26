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
| **V3** | 知识赋能 | ✅ 已完成（6/6） | Knowledge/Vault/Recharts/Understand→Vault/GBrain/Horizon |
| **V4** | 生态融合 | ⏳ 明天启动调查 | CLI-Anything + Mano-P + Ruflo |
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

## V3 — 知识赋能（✅ 已完成，6/6）

V3 已在 2026-05-26 全部完成并提交。实际落地范围：

| 任务 | 状态 |
|------|------|
| Knowledge 页面重修 | ✅ 完成 |
| Vault 增强 | ✅ 完成 |
| Recharts 图表升级 | ✅ 完成 |
| Understand → Vault 打通 | ✅ 完成 |
| GBrain 统计面板 | ✅ 完成 |
| Horizon 集成面板 | ✅ 完成 |

保留的后续事项：
1. pipeline-runs 无自动清理，后续按技术债处理。
2. HCC 阶段 1-4 未在代码中定义，进入流程治理时再补。
3. BaiLongma 需要设计定义后再排期，不混入 V4。

---

## V4 — 生态融合（⏳ 明天启动调查）

今天不启动实现。V4 明天先做现状调查，不直接写 UI、不新增依赖。

调查对象：CLI-Anything / Mano-P / Ruflo loop-workers。

调查范围：
1. 本地是否存在源码或安装目录。
2. 是否已接入 Hermes / MCP / cron / launchd。
3. 是否能启动或已有运行记录。
4. Hermes Pro 桌面端的最小集成点。
5. 风险、前置条件、推荐优先级。

---

## V5 — 变现检验（⏳ 待启动）

原始计划保留。⚠️ 启动前需做现状调查。

---

*本文件是 ~/.hermes/docs/Hermes-迭代计划-v2.md 的更新副本（2026-05-26）。*
*原始文件保留以提供历史参考。*
