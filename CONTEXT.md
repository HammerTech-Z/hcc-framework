# Hermes Pro — 项目上下文

> 更新: 2026-05-21 | 由: Claude Code

## 📌 入口

**开工前请先读 [NEXT_STEP.md](./NEXT_STEP.md)** — 包含已验证的本地状态和下一步行动建议。
本文件仅记录历史上下文和团队约定。

## 一句话

Hermes Agent 桌面端 — 自改进 AI 助手 (Electron + React + Vite + Tailwind)

## 当前状态

- ✅ 工作正常: 聊天、会话、档案(Profiles)、模型、提供商、技能、人格、记忆、工具、计划任务、网关、设置、工作区(Office)
- ✅ 已修复: 团队/监控/工作流三视图 — IPC 数据读取 + CSS 变量风格(主题自适应)
- ✅ 导航栏已可上下滚动 (overflow-y: auto)
- ❌ AgentMonitor 的健康检查端口 8643 需确保 hermes 服务运行

## 活跃任务

- [ ] 团队/监控/工作流的功能可进一步完善 (详情、操作按钮等)
- [ ] 工作流的「运行」按钮目前只是 setTimeout 占位，需对接 hermes 真实执行

## 最近变化 (本轮会话)

- 创建 CONTEXT.md — 统一的项目上下文系统，跨 Claude Code/Hermes Agent/Claude Web 共享
- CLAUDE.md 添加「Universal Project Context」规则：会话开始读 CONTEXT.md，结束更新
- EmployeeLibrary 从硬编码改为 IPC 读取 `~/.hermes/employees.json`
- PlaybookRunner 从硬编码改为 IPC 读取 `~/.hermes/playbooks/`
- AgentMonitor 从 placeholder 恢复完整实现 (IPC 读员工 + 8643 健康检查轮询)
- 三个视图改用 CSS 变量风格 (--bg-secondary, --border, --text-secondary 等)
- i18n 修正: playbooks → 工作流, 所有语言补上 monitor 键
- 删除 src/components/ 下的重复文件
- sidebar-nav 加上 overflow-y: auto 支持滚动

## 下一步

1. 三个视图按需增加交互功能 (编辑员工、执行工作流等)
2. 运行 Playbook 时对接 hermes 真实后端
3. 各会话结束后自动更新 CONTEXT.md

## 关键决策

- 前端组件样式统一使用 CSS 变量 (var(--xxx))，不用 Tailwind 类名，保证深色/浅色主题自适应
- 数据通过 Electron IPC 从本地文件/后端读取，而非硬编码
- 组件路径在 src/renderer/src/components/ 下，src/components/ 不用于 renderer 组件

## 重要参考

- 主入口: src/main/index.ts
- IPC 桥接: src/preload/index.ts
- 渲染层: src/renderer/src/
- 样式系统: src/renderer/src/assets/main.css (CSS 变量主题)
- Layout 导航: src/renderer/src/screens/Layout/Layout.tsx
- 团队数据: ~/.hermes/employees.json
- 工作流: ~/.hermes/playbooks/
- 服务端口: 8643 (健康检查)
- 构建: `npm run build` → `electron-vite build`
- 运行: `./node_modules/.bin/electron out/main/index.js --no-sandbox`
