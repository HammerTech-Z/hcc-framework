# BaiLongma 01 — Scope and Role

> Status: Draft
> Date: 2026-05-28
> Purpose: Define what BaiLongma is before ACUI, visual design, or implementation.

## 1. One-Sentence Definition

BaiLongma 是 Hermes Pro 的 TICK-aware 任务驾驶舱与认知编排层，解决独立创作者、研究者和自改进 AI 使用者在多模块工具链中难以把意图、执行、知识沉淀和复盘串成闭环的问题。

换句话说：BaiLongma 不替代现有模块，而是把 Chat、AgentMonitor、Knowledge、Vault、Understand、Memory、MCP 等能力组织成一个"可启动、可观察、可解释、可沉淀"的任务工作流。

## 2. Relationship Matrix

| Module | Relationship | Explanation |
|--------|--------------|-------------|
| AgentMonitor | 补充 | AgentMonitor 负责展示运行状态、Gateway 状态、cron 历史、事件和知识飞轮信息；BaiLongma 使用这些状态解释"任务现在进行到哪里、卡在哪里、下一步该做什么"。 |
| Knowledge | 补充 | Knowledge 负责知识搜索、入库、GBrain stats、Horizon read-only 展示；BaiLongma 负责在任务流中决定何时查询知识、何时沉淀新知识、如何把结果反馈给用户。 |
| Vault | 补充 | Vault 是文件化知识存储和预览层；BaiLongma 把 Vault 当作长期证据库和任务产物库，用于展示"本次任务产生了什么、复用了什么"。 |
| Understand | 补充 | Understand 负责对输入内容做结构化理解并保存到 Vault；BaiLongma 可以调用 Understand 作为任务前置分析步骤，但不替代它的单点能力。 |
| Memory | 补充 | Memory 负责用户偏好、长期记忆和 profile 信息；BaiLongma 读取 Memory 以个性化任务计划，并在任务结束时建议写入新的稳定记忆。 |
| MCP | 正交 | MCP 是外部工具连接层；BaiLongma 不管理 MCP 协议本身，只在任务需要外部工具时选择或提示使用合适的 MCP 能力。 |

## 3. User Journeys

### Journey 1: Creator Turns Research Into a Reusable Knowledge Asset

用户是谁：
独立创作者或 AI 漫剧/视频策划者。

想做什么：
把一个选题从资料搜集、理解、沉淀，到后续可复用的知识条目完整跑通。

没有 BaiLongma 怎么做：
用户需要在 Chat 中提出需求，再手动切到 Knowledge 搜索，必要时用 Understand 分析资料，再去 Vault 查保存结果，最后自己判断 Memory 是否需要更新。流程分散，任务状态和产物关系不清楚。

有了 BaiLongma 怎么做：
用户在 BaiLongma 里输入选题目标。BaiLongma 生成任务步骤：查询 Knowledge、调用 Understand、保存到 Vault、展示产物、建议是否写入 Memory。用户在一个界面看到当前步骤、调用了哪些模块、产出了哪些文件。

关键差异：
从"多个页面手动串联"变成"一个任务驾驶舱串起研究闭环"。

### Journey 2: Maintainer Diagnoses Why Automation Failed

用户是谁：
Hermes Pro 项目维护者。

想做什么：
快速判断 cron / WeChat / DeepSeek 等自动化任务为什么失败，并形成可执行修复项。

没有 BaiLongma 怎么做：
用户需要看 AgentMonitor、cron jobs、日志文件、Knowledge 或状态报告，再人工判断是调度器问题、API key 问题、还是 WeChat 限流问题。

有了 BaiLongma 怎么做：
用户选择"诊断自动化失败"。BaiLongma 读取 AgentMonitor 和 cron 状态，归纳失败类型，区分调度失败、模型/API 失败、delivery 失败，并输出修复顺序。

关键差异：
从"看仪表盘找线索"变成"按根因聚合并给出下一步"。

### Journey 3: Power User Runs a Self-Improvement Loop

用户是谁：
长期使用 Hermes Pro 做个人知识管理和 Agent 自改进的 power user。

想做什么：
把一次问题、执行、反馈、知识沉淀和后续改进建议串成闭环。

没有 BaiLongma 怎么做：
用户在 Chat 中交互，执行结果散落在 session、Vault、Memory、Knowledge、cron output 中。复盘时需要自己拼接上下文，判断哪些内容该进 Memory，哪些该进 Vault，哪些该变成下一轮任务。

有了 BaiLongma 怎么做：
用户启动一个"自改进任务"。BaiLongma 展示目标、执行步骤、使用的知识、产生的结果、建议沉淀的位置，并在结束时生成复盘摘要和下一轮建议。

关键差异：
从"对话结束即散落"变成"任务结束即沉淀、可复盘、可继续"。

## 4. Non-Goals

BaiLongma 在 Layer 1 阶段不定义为：

- 新的知识库，Knowledge/Vault 仍是知识存储与检索边界。
- 新的 Memory 系统，Memory 仍负责长期偏好和 profile。
- 新的 MCP 协议，MCP 仍是工具连接层。
- 新的 AgentMonitor，AgentMonitor 仍负责状态观测。
- 纯视觉主题或玻璃拟态面板，视觉方案必须服从任务驾驶舱的角色定义。
- 启动时全盘资源扫描，BaiLongma 只做用户授权的上下文采集。桌面端用户信任模型不允许静默扫描 SSH/Git/桌面资源。

## 5. Layer 1 Decision

BaiLongma 可以进入 Layer 2 ACUI 协议定义。

原因：
当前定义已经能回答"它是什么、解决谁的问题、和现有模块是什么关系"。下一步可以设计 ACUI，重点定义 BaiLongma 如何表达任务、步骤、模块调用、状态、产物和错误。

进入 Layer 2 不代表进入实现；Layer 2 只定义 ACUI 协议、运行边界和与现有模块的交互契约。

## 6. 参考机制边界

参考项目: [BaiLongma (数字意识框架 v2.1.179)](https://github.com/xiaoyuanda666-ship-it/BaiLongma)

### 6.1 借鉴的设计原则（不是实现承诺）

以下机制作为 BaiLongma 在 Hermes Pro 中的设计参考，但 V4 Layer 1 不承诺具体实现方案或排期。

**TICK 驱动思维**
BaiLongma 的设计应预留持续运行能力（不只是 request-response），但 V4 不承诺实现 Electron 后台 TICK service。与现有 cron scheduler / Gateway 事件流 / Chat SSE 的关系需在 Layer 2 中明确。

**焦点栈**
多帧注意力跟踪是任务驾驶舱的核心机制候选。原项目通过 push/pop/compress 实现话题切换跟踪和长期记忆沉淀。Layer 2 需要回答它和现有 session / Memory 的关系。

**L1/L2 双层思考**
快速响应（简单问答直接回）vs 深度处理（复杂任务走完整编排流程）的分层调度。Layer 2 需要定义触发条件和路由规则。

**上下文采集器**
任务执行前的充分性检查循环（原项目最多 3 轮）。Layer 2 需要定义它调用 Knowledge / Vault / Memory 的协议。

**ACUI 组件系统**
原项目的 ui_show / ui_update / ui_hide 是已验证的交互模式。Layer 2 的 ACUI 协议设计直接参考，适配为 Hermes Pro 的 React + IPC 架构。

### 6.2 明确不借鉴

| 机制 | 理由 |
|------|------|
| 社交平台分发（微信/Discord/飞书） | Hermes Pro 已有 16 渠道，架构不同 |
| 语音系统（Whisper + TTS） | V5 Dograh 范围，不进 V4 |
| 自动资源感知（SSH/Git/桌面扫描） | 桌面端用户信任模型不允许静默扫描。BaiLongma 只做用户授权的上下文采集 |
| 工具市场（JavaScript sandbox） | 用 MCP 替代，不重复造轮子 |
| LLM Provider 激活页 | Hermes Pro 已有 Settings + model-strategy |

### 6.3 待 Layer 2 回答的问题（不在 Layer 1 决策）

- TICK 和 cron scheduler 谁负责周期任务？
- TICK 和 Gateway 事件流怎么隔离？
- 空闲思考是否增加 API 成本？用户怎么控制？
- 焦点栈和现有 session / Memory 是什么关系？
- Memory SQLite 迁移是否为 BaiLongma 前置？（当前判断：不是。Memory 迁移按 tech-debt 独立排期，不绑定 BaiLongma 时间线。）

### 6.4 定义演进记录

| 版本 | 一句话定义 |
|------|-----------|
| 初稿 | BaiLongma 是 Hermes Pro 的跨模块任务驾驶舱与解释层 |
| 修订（参考原项目后） | BaiLongma 是 Hermes Pro 的 TICK-aware 任务驾驶舱与认知编排层 |
| 差异 | 增加"TICK-aware"和"认知编排"，从静态编排升级为预留持续运行能力的设计方向，但不在 V4 Layer 1 承诺实现 |
