# Hermes Pro — 项目上下文

> 更新：2026-05-28 | 版本：v9.0（锁定版路线图）
> 由：Claude Code

## 入口

**开工前请先读 [NEXT_STEP.md](./NEXT_STEP.md)** — 包含已验证的本地状态和下一步行动建议。
**唯一计划入口**：[docs/roadmap-locked-2026-05-28.md](./docs/roadmap-locked-2026-05-28.md)

## 一句话

Hermes Agent 桌面端 — 自改进 AI 助手（Electron + React + TypeScript）

## 版本线（锁定版 V1-V7）

| 版本 | 口号 | 状态 | 说明 |
|------|------|------|------|
| V1 | 基础可用 | ✅ 完成 | tag hermes-pro-1.0 |
| V1.5 | 修复阶段 | ✅ 完成 | tag v1.5-final，10 commits |
| V2 | 效率提升 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory 完成；BaiLongma 已移出到 V4 |
| V3 | 知识赋能 | ✅ UI完成，自动化 backlog 待补 | Knowledge/Vault/Recharts/GBrain/Horizon；自动化迁移到 V6 |
| V4 | BaiLongma认知编排 | 🔄 POC-2完成，Manual QA待执行 | Layer 1-3 + POC-1 + POC-2 + typecheck通过 |
| V5 | 变现检验 | ⏳ 未启动 | AI视频 + 语音 Dograh |
| V6 | 知识自动化补完 | ⏳ 待启动 | 承接V3未完成的自动化任务 |
| V7 | 生态工具融合 | ⏳ 待启动 | 承接原V4未完成的生态融合任务 |

### V3/V4 偏离已被重基线吸收

- **V3**：UI 集成完成，但自动化未闭环。未完成项已迁移到 V6。
- **V4**：原计划（CLI-Anything/Ruflo/Mano-P）未能实施，已迁移到 V7。BaiLongma 作为 V4 新主线完成设计闭环和 POC-2。

## 技术栈

```
框架:     Electron 40.x + electron-vite 5.x + React + TypeScript
样式:     CSS 类体系 + CSS 变量主题（2 套：dark/light）
状态:     React Context + hooks
i18n:     i18next，4 语言（en/zh-CN/es/pt-BR）
后端存储:  SQLite (state.db) + 文件系统 (config.yaml / MEMORY.md)
数据库:   Postgres 17 + pgvector（Hermes agent 端）
本地 LLM: Ollama + llama3.2 + nomic-embed-text
测试:     vitest + better-sqlite3（需 electron-rebuild）
构建:     electron-vite build → electron-builder
端口:     8642 (API server), 8643 (gateway health)
连接模式: local / remote / SSH（隧道 localhost:18642）
```

## IPC channels

约 114 个 `ipcMain.handle()` 注册，三端对齐（main/preload/preload.d.ts）。
按功能域分组：

- **安装/更新**: check-install, start-install, verify-install, get-hermes-version, run-hermes-doctor, run-hermes-update
- **配置**: get/set-locale, get/set-env, get/set-config, get-hermes-home, get/set-model-config
- **连接**: is-remote-mode, get-connection-config, set-connection-config, set-ssh-config, test-remote-connection, start/stop-ssh-tunnel
- **聊天**: send-message, abort-chat
- **Gateway**: start/stop-gateway, gateway-status, get-gateway-state, check-gateway-health
- **会话**: list-sessions, get-session-messages, search-sessions, sync-session-cache, list-cached-sessions, update-session-title
- **Memory**: read-memory, add/update/remove-memory-entry, write-user-profile, discover-memory-providers
- **Soul**: read/write/reset-soul
- **MCP**: list-mcp-servers, add/remove/toggle-mcp-server, test-mcp-server
- **Playbook**: list-playbooks, run-playbook
- **Understand**: understand-anything, list/read-understanding-history
- **llm-checker**: run-llm-checker
- **Skills**: list-installed/bundled-skills, get-skill-content, install/uninstall-skill
- **AgentMonitor**: get-gateway-state, list-vault-files, get-cron-job-history, get-events, check-gateway-health
- **其他**: open-external, read-logs, get-credential-pool, list-models, add/remove/update-model, claw3d-*

## 项目根目录文件说明

| 文件 | 用途 |
|------|------|
| `NEXT_STEP.md` | 下一步行动指南（开工先读） |
| `docs/roadmap-locked-2026-05-28.md` | 锁定版路线图（唯一计划入口） |
| `docs/v6-knowledge-automation-plan.md` | V6 知识自动化计划 |
| `docs/v7-ecosystem-integration-plan.md` | V7 生态工具计划 |
| `docs/v2-status.md` | V2 各任务实际状态 |
| `docs/v3-status.md` | V3 各任务实际状态 |
| `docs/bailongma/README.md` | BaiLongma 设计索引 |
| `V1.5-COMPLETION.md` | V1.5 修复阶段完成报告 |
| `CLAUDE.md` | Claude Code 指令和行为准则 |
| `LOCK.md` | 物理锁说明 |
| `STUBS.md` | 存根组件记录 |

## 路线图锁定规则

- **唯一计划入口**：docs/roadmap-locked-2026-05-28.md
- **知识库内容不自动改变路线图**
- **禁止 Agent 自行改路线图**
- **发现计划 bug 时，只能报告，不能自行修改**
- **解锁条件**：用户明确说"解锁路线图"后，方可修改

---

*本文档最后更新：2026-05-28（锁定版路线图重基线）*
