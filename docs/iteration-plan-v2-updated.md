# Hermes 迭代计划 V2 — 更新副本

> 本文件是 `~/.hermes/docs/Hermes-迭代计划-v2.md` 的更新副本
> 原始版本日期：2026-05-24 | 本副本更新：2026-05-27
> 更新原因：原始计划中的 V1/V2 任务状态已与代码事实严重偏离

---

## 2026-05-27 当前事实快照

### Git 状态

- 当前分支：`integrate/upstream-2026-05-27`
- `rescue/eff2566-v3-complete` 已存在，指向 `eff2566`
- detached HEAD 风险已解除
- 当前工作区干净
- `integrate/upstream-2026-05-27` 相对 `main` 多 41 commits
- 本地 `main` 标记为落后 `origin/main` 319 commits
- ⚠️ 后续不要直接回旧 `main` 开工，应先决策是否把 `integrate/upstream-2026-05-27` 作为 Hermes Pro 产品主线

### Cron / WeChat 状态

- `~/.hermes/cron/jobs.json` 当前 8 个 jobs
- 状态分布：3 ok、5 error
- error 根因：
  - DeepSeek API key 401（认证失效，需更换 key）
  - Weixin delivery 持续 `rate limited`（iLink 限流）
- 行动项：
  1. **DeepSeek key 修复**：更换有效 API key 或调整调用策略
  2. **Weixin/iLink 限流策略修复**：评估 iLink rate limit 原因，调整推送频率或队列策略

## 版本总览

| 版本 | 口号 | 状态 | 说明 |
|------|------|------|------|
| **V1** | 基础可用 | ✅ 已完成 | tag hermes-pro-1.0 |
| **V1.5** | 修复阶段 | ✅ 已完成 | tag v1.5-final，10 commits |
| **V2** | 效率提升 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory 完成，BaiLongma 移出 |
| **V3** | 知识赋能 | ✅ 已完成（6/6） | Knowledge/Vault/Recharts/Understand→Vault/GBrain/Horizon |
| **V4** | 生态融合 | 🔍 调查已推进，待决策 | CLI-Anything / Ruflo / Mano-P 已有调查结论；下一步是 BaiLongma 定义或 V3.5 巩固决策 |
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
| CSS 类审计 | ✅ docs(css) | 12 个候选类；其中动态类名需保留或人工确认 |
| vitest + better-sqlite3 | ✅ fix(test) | 添加 rebuild 脚本 |
| reasoning 字段注入 | ✅ feat(understand) | heuristic + LLM 双模式 |

---

## V2 — 效率提升（✅ 4/5 完成）

| 任务 | 原始状态 | 实际状态 | 说明 |
|------|---------|---------|------|
| Theme 选择器 | 待开发 | ✅ 已有完整实现 | 2 套主题 + system + ThemeProvider + Settings UI |
| AgentMonitor 增强 | 待启动 | ✅ 3 commits | CSS 类化 + i18n 4 语言 + 实时执行面板 |
| MCP 管理 UI | 待启动 | ✅ 5 commits | 4 IPC + Settings CRUD + i18n + 测试连接 |
| Memory 编辑器 | 待启动 | ✅ 功能已实现 | CRUD + i18n + 容量指示 + 7 providers。底层仍以 `MEMORY.md` 为主，SQLite 迁移是后续技术债 |
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

## V4 — 生态融合（🔍 调查已推进，待决策）

### 调查结论

| 项目 | 源码/安装 | Hermes 集成 | 结论 |
|------|-----------|-------------|------|
| CLI-Anything | ✅ 官方入口 + 本地路径已验证 | ❌ Safari harness 受本机 Python/TLS 问题阻塞 | 不写成已集成 |
| Ruflo loop-workers | ✅ 官方项目 + 子模块真实 | ❌ 本地未接入 Hermes cron/launchd/MCP | 不替代当前 cron |
| Mano-P | ✅ 受硬件前置限制 | — | 暂缓 |
| BaiLongma | ❌ 代码零实现 | ❌ ACUI 无正式定义 | 先写范围与角色定义；写不出则 V4 降级为 V3.5 工程巩固 |

### 下一步决策点

1. BaiLongma 范围与角色定义能否产出？
   - 能 → V4 继续，聚焦 BaiLongma 实现
   - 不能 → V4 降级为 V3.5 工程巩固

## 当前优先级（2026-05-27）

1. **Git 主线决策** — 是否以 `integrate/upstream-2026-05-27` 作为 Hermes Pro 产品主线
2. **Cron 根因修复** — DeepSeek key 401 + Weixin/iLink rate limited
3. **V4 定义决策** — BaiLongma 能定义则 V4 继续，否则降级 V3.5
4. **技术债清扫** — V1.5 遗留 + SQLite 迁移待定

---

## V5 — 变现检验（⏳ 待启动）

原始计划保留。⚠️ 启动前需做现状调查。

---

*本文件是 ~/.hermes/docs/Hermes-迭代计划-v2.md 的更新副本（2026-05-27）。*
*原始文件保留以提供历史参考。*
