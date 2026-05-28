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
| **V4** | 生态融合 | ✅ 设计闭环完成，POC 待实现评审 | BaiLongma Layer 1-3 + README + cron 诊断 POC Plan 已完成；下一步是只读 POC 实现评审 |
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

详见 [docs/v2-status.md](./docs/v2-status.md)。

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

## V4 — BaiLongma 认知编排（✅ 设计闭环完成，POC 待实现评审）

### BaiLongma 设计闭环

BaiLongma 是 Hermes Pro 的 TICK-aware 任务驾驶舱与认知编排层。Layer 1-4 设计文档已完成：

| 文件 | 内容 |
|------|------|
| [docs/bailongma/01-scope-and-role.md](./docs/bailongma/01-scope-and-role.md) | Layer 1 范围与角色、用户旅程、参考机制边界 |
| [docs/bailongma/02-acui-protocol.md](./docs/bailongma/02-acui-protocol.md) | Layer 2 ACUI 协议：概念、消息格式、组件命令、任务生命周期、错误模型 |
| [docs/bailongma/03-visual-and-integration.md](./docs/bailongma/03-visual-and-integration.md) | Layer 3 视觉与集成点：三栏布局、产品位置、ACUI→React 映射 |
| [docs/bailongma/README.md](./docs/bailongma/README.md) | 设计索引与 POC 决策 |
| [docs/bailongma/04-poc-plan.md](./docs/bailongma/04-poc-plan.md) | cron 失败诊断只读 POC 计划 |

详见 [docs/bailongma/README.md](./docs/bailongma/README.md)。

### 下一步决策点

1. **是否批准 cron 失败诊断只读 POC？**
   - 批准 → 按 04-poc-plan.md 实现评审
   - 不批准 → V4 降级为 V3.5 工程巩固
2. **POC 是否允许新建 BaiLongma screen？**
   - 允许 → 修改 Layout.tsx，新增 view
   - 不允许 → 在现有 AgentMonitor 嵌入
3. **POC 是否坚持"四不"边界？**
   - 不新增 IPC、不新增数据库、不启动后台 TICK、不迁移 Memory SQLite
4. **POC 验收通过后是否进入实现层？**
   - 是 → Layer 4 完整实现
   - 否 → 保持文档存档

### V5 候选或环境修复项（不占 V4 主线）

CLI-Anything / Ruflo / Mano-P 调查结果保留，不作为 V4 主线：

| 项目 | 结论 |
|------|------|
| CLI-Anything | Safari harness 受本机 Python/TLS 问题阻塞，不写成已集成 |
| Ruflo loop-workers | 本地未接入 Hermes cron/launchd/MCP，不替代当前 cron |
| Mano-P | 受硬件前置限制，暂缓 |

## 当前优先级（2026-05-28）

1. **BaiLongma cron 诊断 POC 实现评审** — 按 04-poc-plan.md 评审是否批准实现
2. **Cron 根因修复** — DeepSeek key 401 + Weixin/iLink rate limited
3. **Git / upstream 维护** — 继续保持 hermes-pro-main 与 origin/hermes-pro-main 同步
4. **技术债清扫** — Theme 持久化（TD-PERSIST-001）、Memory SQLite schema（TD-PERSIST-002）、测试覆盖率

---

## V5 — 变现检验（⏳ 待启动）

原始计划保留。⚠️ 启动前需做现状调查。

---

*本文件是 ~/.hermes/docs/Hermes-迭代计划-v2.md 的更新副本（2026-05-28）。*
*原始文件保留以提供历史参考。*
