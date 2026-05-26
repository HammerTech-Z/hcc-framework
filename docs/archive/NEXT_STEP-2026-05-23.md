# Hermes Pro — NEXT STEP

> 所有智能工具的统一入口。开工先读本文件。
> 本文件基于 `ls/cat/git log` 验证过的本地事实，不依赖记忆。

---

## 🔴 一句话当前状态

**计划已重构为 V1-V5 版本线架构（2026-05-24）。当前 V1 "基础可用"阶段。**
**计划文档: `~/.hermes/docs/Hermes-迭代计划-v2.md`**

| V1 任务 | 状态 |
|---------|------|
| K1.5 嵌入修复（GBrain ZeroEntropy） | ⏳ 待执行 |
| hermes-pro 启动修复（electron-vite） | ✅ 已完成 |
| Understand-Anything 安装 + 分析 | ⏳ 待执行 |
| llm-checker 安装 + 基线 | ⏳ 待执行 |
| P4 PlaybookRunner 真实化（HCC） | ⏳ 待执行 |

---

## ✅ 已验证完成（本地实物确认）

### 代码状态
| 项目 | 状态 | 验证方式 | 位置 |
|------|------|---------|------|
| hermes-pro 编译 | ✅ `npm run build` 通过 | 本地运行 | `~/hermes-pro/` |
| 单元测试 | ✅ 266/266 通过 | `npm test` | `~/hermes-pro/` |
| 分支 | ✅ `custom-development`（有 `hermes-pro-work` worktree） | `git branch` + `git worktree list` | `~/hermes-pro/` |

### 已完成（V0 阶段）
| Phase | 状态 | 关键证据 |
|-------|------|---------|
| Phase 1 (P1-0~P1-6) | ✅ 完成 | 6 个 HP+*.skill |
| V2-R3 UI 整合 | ✅ 完成 | 三屏组件（EmployeeLibrary/PlaybookRunner/AgentMonitor） |
| H3-1 代码复盘看板 | ✅ 完成 | AgentMonitor IPC handler |
| H3-2 delegate_tool 拆分 | ✅ 完成 | 1008 行 |
| K-edu 双教材 | ✅ 完成 | MS教程+hello-agents 入库 |
| K1-K4 五阶段 | ✅ 完成 | 知识飞轮 cron + hook + 反推方向 |
| Phase 0a CodeGraph | ✅ 完成 | 177文件/1222节点 MCP |
| Phase 1a Horizon | ✅ 完成 | HCC 评分90%通过 |
| H3-3 cron 知识飞轮 | ✅ 完成 | launchctl 已注册 |
| H3-4 API 版本化 | ✅ 完成 | gateway/routes/server.py |
| Bug 修复批 | ✅ 完成 | 10 项 P0+P1 修复（SSE 流关闭、sendMessage history、abort 竞态等） |

### 基础设施
| 项 | 状态 | 路径 |
|----|------|------|
| Knowledge hook | ✅ 文件存在、handler 已验证 | `~/.hermes/hooks/knowledge-inject/` |
| HP+ Skills | ✅ 6 个 active | `~/.hermes/skills/active/HP+*.skill/` |
| llm-wiki skill | ✅ 已安装 | `~/.claude/skills/llm-wiki.md` |
| vault/wiki 结构 | ✅ 已建立 | `~/.hermes/vault/wiki/`（含 7 个子目录 + index.md + log.md）|
| 物理锁 (uchg) | ✅ 生效中 | `ls -lO src/main/*.ts` |

---

## 🔍 待确认项（文档声明但未验证）

| 项 | 文档声明 | 本地验证结果 |
|----|---------|------------|
| K0 T6 验证 | 需 `curl gateway` 验证 hook 真触发 | ⚠️ 文档未更新，需重新确认 |
| Handoff 时间戳 T7 | 需更新 | `~/.hermes/HANDOFF.md` 最后时间 2026-05-17 |
| 知识库文档路径 | `~/.hermes/docs/` | ❌ 目录不存在 |

---

## 📋 下一步选项

### 主线:K1.5 知识库闭环 + 三库语义关联(当前)

```
阶段 0 清场(8 项任务,1.0 天):
  T0.1 三套 skills 系统归档
  T0.2 OpenWolf 迁移 vault + Codex 冻结只读
  T0.3 启动 Ollama + 拉嵌入模型
  T0.4 DeerFlow 决策落地(需用户决策)
  T0.5 hermes-desktop-dev detached HEAD 处理(需用户决策)
  T0.6 暗物质归类文档
  T0.7 Karpathy Guidelines 安装 + 灵魂 v5.1 生效
  T0.8 react-doctor 安装 + hermes-pro 基线

阶段 1 建立 GBrain 中枢(7 项任务,3.5 天):
  T1 GBrain 双嵌入模式
  T2 三库摄入 + 摄入时去重
  T3 时间衰减打分
  T4 跨库语义检索冒烟测试(关键)
  T5 接入 H3-3 cron
  T6 接入 K0 Gateway Hook
  T7 季度知识审计命令

执行手册:`~/.hermes/docs/K1.5-execution-tasks.md`
```

### 下一主线:P4 第一张考卷(HCC 流程试点首跑)

K1.5 闭环后即启动 P4,P4 用 HCC 流程执行。

**P4 候选任务(待用户定)**:
1. AgentMonitor 增强(扩展 React 屏幕)
2. EmployeeLibrary 知识展示(对接 K1.5 GBrain)
3. StatsCard 量化 Hermes 健康度

**HCC 流程概要**:
```
Hermes 翻译需求 → 用户确认 → bellard+karpathy 双审 →
[2 轮内通过] → Codex 执行 → Claude Code 双审+测试 →
[3 轮内通过] → 给用户
```

**完整设计** `~/.hermes/docs/trial/HCC流程-试点设计.md`

**P4 启动前置(灵魂第十条)**:
- K1.5 嵌入修复完成且真正闭环
- Codex 本机可用(`~/.codex/` 配置完整)
- react-doctor 基线已建立
- 用户拍板 P4 具体任务

### 后续轨道(K1.5 完成后)

| 轨道 | 内容 | 依赖 |
|------|------|------|
| K2/K3/K4 | 五阶段映射 / 反推学习方向 / 使用闭环验证 | K1.5 完成 |
| P4 | 第一张考卷(AgentMonitor 增强)| K1.5 完成 |
| T 线 | 双 AI 协作流水线试点 | P4 完成 |
| 融合 Phase 0a/0b | CodeGraph + MCP Servers | P4 完成 |
| 融合 Phase 1/2/3 | Horizon/BaiLongma/CLI-Anything/GBrain 深化/Ruflo loop-workers/OpenHuman 等 | 顺序铁律 |

---

### 当前建议顺序（基于迭代计划六次修订）

1. **应用所有 PATCH** — 按本目录 `K1.5-配套补丁包.md` + `迭代计划-K1.5补丁.md` 顺序应用
2. **K1.5 阶段 0** — 按 `~/.hermes/docs/K1.5-execution-tasks.md` 跑清场任务
3. **K1.5 阶段 1** — 阶段 0 全 ✅ 后跑 GBrain 中枢建立
4. **K1.5 冒烟测试** — T4 三项全过 = K1.5 验收通过
5. **更新 HANDOFF.md** — 追加 K1.5 完成条目
6. **P4 启动** — K 线真正闭环后，启动第一张考卷

---

## 📚 关联文档

| 文档 | 路径 | 说明 |
|------|------|------|
| **交接日志** | `~/.hermes/HANDOFF.md` | 历史状态与阻塞记录 |
| **迭代计划** | `~/.hermes/docs/Hermes-迭代计划.md` | 完整迭代计划（723行，含K/P/融合/T轨道详细规格）|
| **执行手册 v1.2** | 同上目录 | `Hermes-V3-完整执行手册-v1.2.md`（BaiLongma UI 规格）|
| **融合规划** | 同上目录 | `Hermes-融合规划总纲.md`（已归档，历史参考）|
| **SOP** | `~/.hermes/DAILY-SOP.md` | 开工自检流程 |
| **项目架构** | `~/Desktop/知识/Hermes 代码任务/files/system-architecture-v4.md` | 技术架构参考 |
| **K1.5 执行手册** | `~/.hermes/docs/K1.5-execution-tasks.md` | Claude Code 直接读这个文件按命令执行 |
| **HCC 流程试点设计** | `~/.hermes/docs/trial/HCC流程-试点设计.md` | P4 试点必读,7+1 阶段完整流程定义 |

---

## ⚙️ 技术细节速查

```
项目:     hermes-desktop (hermes-pro)
编译:     electron-vite build → electron-builder
运行:     npm run dev (dev), npm start (preview)
测试:     vitest run (266 tests)
依赖:     Electron 39, React 19, Tailwind 4, better-sqlite3
端口:     8642 (API server), 8643 (gateway health)
连接:     local / remote / ssh（SSH 隧道 localhost:18642）
```

---
*更新: 2026-05-23 K1.5 + HCC 流程试点设计完成后生成*
