# Hermes Pro — 项目上下文

> 更新：2026-05-26 | 由：Claude Code
> 当前版本：v1.5-final（V2 迭代已完成）

## 📌 入口

**开工前请先读 [NEXT_STEP.md](./NEXT_STEP.md)** — 包含已验证的本地状态和下一步行动建议。
本文件仅记录历史上下文和团队约定。

## 一句话

Hermes Agent 桌面端 — 自改进 AI 助手（Electron + React + TypeScript）

## 版本线

| 版本 | 口号 | 状态 | 说明 |
|------|------|------|------|
| V1.0 | 基础可用 | ✅ tag hermes-pro-1.0 | 启动修复 + PlaybookRunner + U-A/llm-checker |
| V1.5 | 修复阶段 | ✅ tag v1.5-final, 10 commits | IPC 审计 + any 清理 + execSync→spawn + i18n |
| V2 | 效率提升 | ✅ 4/5 完成 | Theme/AgentMonitor/MCP/Memory |
| V3 | 知识赋能 | ⏳ 待启动 | GBrain 增强 + 知识可视化 + Horizon |
| V4 | 生态融合 | ⏳ 待启动 | CLI-Anything + Mano-P + Ruflo |
| V5 | 变现检验 | ⏳ 待启动 | AI 视频 + 语音 Dograh |

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

## V2 完成情况

| 任务 | 状态 | 关键产出 |
|------|------|---------|
| Theme 选择器 | ✅ 已有完整实现 | ThemeProvider (React Context) + Settings 3 按钮 + localStorage |
| AgentMonitor 增强 | ✅ 3 commits | CSS 类化 + i18n 4 语言 + 实时执行面板 |
| MCP 管理 UI | ✅ 5 commits | IPC 4 通道 + Settings CRUD + i18n + 测试连接 |
| Memory 编辑器 | ✅ 已有完整实现 | CRUD + i18n + 容量指示 + 7 providers |
| BaiLongma 落地 | ⏸️ 移出 V2 | 代码零实现，需设计定义后重新排期 |

## 项目根目录文件说明

| 文件 | 用途 |
|------|------|
| `NEXT_STEP.md` | 下一步行动指南（开工先读） |
| `V1.5-COMPLETION.md` | V1.5 修复阶段完成报告 |
| `CLAUDE.md` | Claude Code 指令和行为准则 |
| `LOCK.md` | 物理锁说明 |
| `STUBS.md` | 存根组件记录 |
| `docs/v2-status.md` | V2 各任务实际状态 |
| `docs/confidence-design.md` | confidence 设计规范 |
| `docs/css-audit-2026-05-26.md` | CSS 类审计报告 |
| `docs/v2-issues.md` | V2 已知问题（如存在） |
| `P2-UI-DESIGN.md` | P2 UI 设计稿 |
