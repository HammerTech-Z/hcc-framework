# 外部 Agent 项目能力萃取审计

> 版本：v1.0
> 日期：2026-05-30
> 目标：从 GitHub 外部项目中萃取可复用架构，补 Hermes Pro 短板
> 规则：不安装、不启动、不接入外部服务；不复制 GPL/AGPL 代码；只做架构借鉴

---

## 一、项目总览

| 项目 | Stars | 语言 | 许可证 | 定位 | 对 Hermes 的核心补强 |
|------|-------|------|--------|------|-------------------|
| **Ruflo** | 56.5K | TypeScript | MIT | Multi-agent orchestration for Claude Code | Worker taxonomy、workflow template、trajectory learning |
| **OpenHuman** | 29.6K | Rust | 专属+闭源服务 | Personal AI super intelligence | Memory Tree、TokenJuice、Obsidian vault、auto-fetch |
| **MiroFish** | 63.2K | Python | 专属 | Multi-agent simulation + prediction | GraphRAG、multi-agent simulation、report generation |
| **OpenClaw** | 375K | TypeScript | MIT | Personal AI assistant（多渠道）| Gateway/channel/sandbox/pairing/allowlist 安全模型 |
| **Dograh** | 3.8K | Python | BSD 2-Clause | Voice agent workflow builder | Drag-drop workflow、STT/TTS/LLM 可插拔设计 |
| **Mano-P** | 2.2K | Python | Apache 2.0 | GUI-VLA for edge devices | Visual E2E testing、Mano-AFK 自动应用构建 |

---

## 二、项目详细分析

### 2.1 Ruflo（56.5K ⭐）

**证据**：`https://github.com/ruvnet/ruflo`

**核心模块**：
- `ruflo-swarm`：多 Agent 协同
- `ruflo-loop-workers`：定时任务调度
- `ruflo-workflows`：可复用多步骤模板
- `ruflo-federation`：跨机器安全通信
- `ruflo-rag-memory` / `ruflo-ruvector`：向量检索 + Graph RAG
- `ruflo-intelligence`：从历史成功中学习
- `ruflo-graph-intelligence`：PageRank + 子图推理

**最值得借鉴的能力**：
1. **Worker taxonomy**：Agent 分工明确（planner/executor/reviewer）
2. **Trajectory learning**：从成功/失败中自动学习模式
3. **Hook system**：对 Claude Code 无侵入性增强
4. **Plugin 架构**：98 agents、60+ commands、30 skills，插件化扩展

**对 Hermes 的补强点**：
- HCC v2 的 stage_5 执行器可以借鉴 worker taxonomy（executor/reviewer 分离）
- Hermes Memory 当前缺"从任务历史中学习模式"的能力
- Ruflo 的 loop-workers ≠ 替换 Hermes cron，而是提供 worker 抽象

**风险**：
- 许可证：MIT ✅ 可接受
- 硬件：无特殊要求 ✅
- API key：依赖 Claude Code plugin ⚠️
- 维护成本：Plugin 数量庞大（33 plugins），跟进负担高
- 集成复杂度：hook system 侵入 Claude Code，可能与 Hermes 冲突

**建议归属**：**ADR 候选**
- 借鉴 worker taxonomy 设计 HCC stage_5 executor 角色分离
- 借鉴 trajectory learning 补 Memory action ledger
- **不替换 Hermes cron**（Ruflo loop-workers 无法解决 Hermes 业务层问题）

---

### 2.2 OpenHuman（29.6K ⭐）

**证据**：`https://github.com/tinyhumansai/openhuman`

**核心模块**：
- `Memory Tree`：层级摘要树，SQLite 本地存储
- `Obsidian Wiki`：Markdown vault 兼容
- `TokenJuice`：token 压缩层（HTML→Markdown、URL缩短、去重）
- `auto-fetch`：118+ 第三方集成，每 20 分钟自动拉取
- `Voice`：STT + ElevenLabs TTS + mascot lip-sync
- `Model routing`：智能路由到 reasoning/fast/vision 模型
- `Composio connector`：OAuth 一键接入

**最值得借鉴的能力**：
1. **Memory Tree**：层级摘要 + SQLite 本地存储，本地优先
2. **TokenJuice**：所有 tool call 输出先压缩再送 LLM，减少 80% token
3. **auto-fetch**：无需轮询，Agent 自动从已连接服务拉取最新上下文
4. **Obsidian vault 兼容**：Markdown 文件可直接在 Obsidian 打开
5. **Voice-first**：STT/TTS 内置，语音入口开箱即用

**对 Hermes 的补强点**：
- Hermes Vault 当前缺自动压缩（TokenJuice 思路）
- Hermes Memory 当前缺层级摘要树（Memory Tree 思路）
- Hermes 当前无 auto-fetch 机制（依赖轮询或手动触发）
- Hermes Voice 入口缺失（当前只有 WeChat text）

**风险**：
- 许可证：**专属 + 闭源服务混合** ⚠️ **无法直接复制代码**
  - OpenHuman 桌面端使用 Tauri/CEF，源码部分公开但核心服务闭源
  - Memory Tree / TokenJuice / auto-fetch 架构可借鉴，代码不能复制
- 硬件：Rust 二进制，资源消耗未知
- API key：默认使用 OpenHuman 闭源后端 ⚠️ 数据隐私风险
- 数据隐私：auto-fetch 数据经过 OpenHuman 服务器代理

**建议归属**：**架构借鉴，不复制代码**
- TokenJuice 压缩层 → Hermes IPC handler 输出压缩（可本地实现）
- Memory Tree 层级摘要 → Hermes GBrain typed links 替代方案设计
- **不复制 GPL 代码**：OpenHuman 部分组件可能是 GPL，架构借鉴而非代码复制

---

### 2.3 MiroFish（63.2K ⭐）

**证据**：`https://github.com/666ghj/MiroFish`

**核心模块**：
- `Graph Building`：Seed extraction + GraphRAG 构建
- `Environment Setup`：Entity relationship extraction + Persona generation
- `Simulation`：双平台并行模拟
- `ReportAgent`：仿真后深度交互报告生成
- 红楼梦/武大舆论/金融预测等 Demo

**最值得借鉴的能力**：
1. **Multi-agent simulation**：数千个独立人格 Agent 在数字世界演化
2. **GraphRAG**：图结构知识检索增强
3. **Report generation**：仿真结果自动生成结构化报告
4. **Seed injection**：从现实世界提取种子信息构建数字孪生

**对 Hermes 的补强点**：
- HCC v2 当前缺"执行前风险推演"：MiroFish simulation 可用于 HCC plan risk simulator
- Hermes 当前无 GraphRAG：codebase-knowledge 检索可借鉴图结构
- Hermes 报告生成能力弱：ReportAgent 思路可用于 Knowledge page 自动化报告

**风险**：
- 许可证：**专属** ⚠️ 不可直接复制代码
- 目标场景：预测/仿真，与 Hermes 任务执行差异大
- 硬件：多 Agent 并行模拟资源消耗大（Python）
- API key：需评估是否依赖外部模型

**建议归属**：**暂缓借鉴**
- GraphRAG + simulation 思路对 Hermes 当前阶段太超前
- 等 Hermes 主链路稳定后，考虑用于 HCC plan risk simulator

---

### 2.4 OpenClaw（375K ⭐）

**证据**：`https://github.com/openclaw/openclaw`

**核心模块**：
- `Gateway`：控制平面 + daemon 长期运行
- `Channels`：20+ 消息渠道接入
- `Canvas`：交互式可视化 UI
- `Skills`：可复用技能系统
- `Sandbox`：隔离执行环境
- `Pairing`：设备配对机制
- `Allowlist`：权限边界控制

**最值得借鉴的能力**：
1. **Gateway daemon 模式**：长期稳定运行，用户无感知
2. **Channel abstraction**：20+ 渠道统一抽象，Hermes 可借鉴 WeChat/飞书统一接口
3. **Sandbox + allowlist**：安全执行隔离，权限边界清晰
4. **Pairing**：设备绑定/认证机制
5. **Canvas**：交互式可视化界面（Hermes 无）

**对 Hermes 的补强点**：
- Hermes Gateway 当前无 sandbox/allowlist 安全模型
- Hermes Channel 当前只有 WeChat/iLink，扩展性不足
- Hermes 当前缺 Canvas 交互式 UI

**风险**：
- 许可证：MIT ✅
- 规模：375K stars，Node.js 全家桶，迁移成本高
- 渠道数量：20+ 渠道维护负担重
- 与 Hermes 定位部分重叠：OpenClaw 是全功能个人助手，Hermes 是桌面端 + MCP

**建议归属**：**架构借鉴为主**
- Gateway sandbox/allowlist → Hermes IPC 权限边界设计参考
- Channel abstraction → Hermes channel 扩展性设计参考
- **不迁移主体**：OpenClaw 370K stars 全功能 vs Hermes 轻量路线

---

### 2.5 Dograh（3.8K ⭐）

**证据**：`https://github.com/dograh-hq/dograh`

**核心模块**：
- `Workflow builder`：拖拽式语音 Agent 构建
- `STT/TTS`：可插拔语音转写/合成
- `LLM`：可插拔大模型
- `QA node`：质量保证节点
- `Voice pipeline`：端到端语音处理

**最值得借鉴的能力**：
1. **Drag-drop workflow**：非技术用户也能构建语音 Agent
2. **QA node**：语音质量自动检测
3. **STT/TTS/LLM 可插拔**：不锁定供应商
4. **BSD 2-Clause**：完全开源，可商用

**对 Hermes 的补强点**：
- Hermes Voice 入口缺失：Dograh STT/TTS 设计可作为 Hermes 语音入口参考
- Hermse 当前无 QA 机制：QA node 思路可用于 HCC 质量门禁
- workflow builder → Hermes HCC 任务编排 UI 化

**风险**：
- 许可证：BSD 2-Clause ✅ 完全开源可商用
- 规模：3.8K stars，还不成熟
- 与 Vapi/Retell 竞争：Voice agent 已有成熟商业竞品
- Hermes 当前无语音需求：V5 暂缓时语音需求非 P0

**建议归属**：**候选池**
- Voice入口：Dograh STT/TTS 可插拔设计 → 等 V5 语音需求激活后评估
- QA node → HCC 质量门禁可借鉴

---

### 2.6 Mano-P（2.2K ⭐）

**证据**：`https://github.com/Mininglamp-AI/Mano-P`

**核心模块**：
- `Mano-CUA Skills`：GUI 操作技能
- `Mano-AFK`：自动化应用构建（PRD→code→deploy→test→fix）
- `Cider SDK`：W8A8 激活量化，Apple Silicon 加速
- `Edge inference`：M4 Mac mini/MacBook 本地运行

**最值得借鉴的能力**：
1. **Visual E2E testing**：VLA 模型做 GUI 自动化测试
2. **Mano-AFK**：自然语言 → 完整应用，含自动化测试修复循环
3. **"think-act-verify" loop**：执行→验证→修复的闭环推理
4. **Edge optimization**：Apple Silicon INT8 量化推理

**对 Hermes 的补强点**：
- Hermes 当前无 GUI 自动化测试：Mano-P visual E2E testing 可用于 Hermes UI 回归测试
- Hermes HCC 缺 verify 阶段：think-act-verify → HCC stage_6 双审+测试可借鉴
- Hermes 无本地 VLA 能力：Mano-P 接口预留 → 等硬件升级后评估

**风险**：
- 许可证：Apache 2.0 ✅ 可商用
- 硬件要求：**M4+ 32GB RAM** ⚠️ 当前 M5 16GB 不满足
- 模型规模：72B 参数，本地运行需高端硬件
- 与 Hermes 集成成本：VLA 模型推理延迟不确定

**建议归属**：**接口预留，暂缓实施**
- Visual E2E testing → Hermes UI 自动化测试备选方案
- think-act-verify → HCC stage_6 质量门禁参考
- **硬件不足时只做接口预留**，不强行集成

---

## 三、映射 Hermes 当前短板

| 短板 | 外部项目借鉴方案 | 可行性 | 建议 |
|------|----------------|--------|------|
| **HCC worker 化不足** | Ruflo worker taxonomy | ✅ 高 | ADR 候选：HCC stage_5 executor 角色分离 |
| **Memory 缺自动整理/压缩** | OpenHuman TokenJuice + Memory Tree | ✅ 高（架构借鉴）| 本地实现，不复制代码 |
| **Memory 缺行为账本** | Ruflo trajectory learning | ✅ 高 | ADR 候选：Memory action ledger |
| **Delivery/channel 权限边界不足** | OpenClaw sandbox + allowlist | ✅ 高 | ADR 候选：Hermes IPC 权限边界 |
| **GUI 自动操作能力不足** | Mano-P visual E2E testing | ⚠️ 中（硬件不足）| 接口预留，等硬件升级 |
| **Voice 入口不足** | Dograh STT/TTS 可插拔 | ⚠️ 中（V5 暂缓）| 候选池，V5 激活后评估 |
| **执行前风险推演不足** | MiroFish multi-agent simulation | ❌ 低（架构差距大）| 暂缓 |
| **报告生成能力弱** | MiroFish ReportAgent | ❌ 低（架构差距大）| 暂缓 |

---

## 四、外部项目 → Hermes 能力补强矩阵

| 外部项目 | 代码知识检索 | 语义知识检索 | 外部信息输入 | 证据沉淀 | 任务可解释闭环 | 工具适配 | 语音入口 | 安全边界 |
|---------|------------|------------|------------|---------|--------------|---------|---------|---------|
| **Ruflo** | — | RAG memory ✅ | — | — | trajectory learning ✅ | — | — | — |
| **OpenHuman** | — | Memory Tree ✅ | auto-fetch ✅ | Obsidian vault ✅ | — | — | Voice ✅ | — |
| **MiroFish** | GraphRAG ⚠️ | — | — | — | simulation ⚠️ | — | — | — |
| **OpenClaw** | — | — | — | — | — | 20+ channels ✅ | — | sandbox/allowlist ✅ |
| **Dograh** | — | — | — | — | QA node ⚠️ | — | STT/TTS ✅ | — |
| **Mano-P** | — | — | — | — | think-act-verify ⚠️ | GUI ops ⚠️ | — | — |

---

## 五、优先级表

| 优先级 | 项目 | 借鉴内容 | 类型 | 备注 |
|--------|------|---------|------|------|
| 🔴 **立即借鉴** | OpenClaw | sandbox/allowlist 安全模型 | 架构 | 不迁移主体，只借权限边界 |
| 🔴 **立即借鉴** | OpenHuman（架构）| TokenJuice 压缩 + Memory Tree 层级摘要 | 架构 | 本地实现，不复制代码 |
| 🟡 **ADR 候选** | Ruflo | worker taxonomy + trajectory learning | 架构 | ADR + 用户确认后才能进入 V6 |
| 🟡 **ADR 候选** | OpenHuman（架构）| auto-fetch 机制 | 架构 | 等 Hermes channel 扩展后评估 |
| 🟢 **候选池** | Dograh | STT/TTS 可插拔 + QA node | 架构 | V5 语音需求激活后评估 |
| 🟢 **候选池** | Mano-P | visual E2E testing 接口预留 | 架构 | 等硬件升级到 32GB |
| ⏸️ **暂缓** | MiroFish | simulation + report generation | 架构 | 架构差距大，暂不考虑 |
| ⏸️ **暂缓** | OpenHuman（代码）| Memory Tree/TokenJuice 具体实现 | 代码 | GPL 风险，架构借鉴足够 |

---

## 六、最小执行建议

**优先实现（不修改 locked roadmap）**：

1. **OpenHuman-style memory compression + action ledger**
   - 在 Hermes Memory 中增加 TokenJuice 风格的压缩层
   - 在 Hermes Memory 中增加行为账本（action ledger），记录每次任务执行的关键决策
   - 状态：候选池，待 ADR 批准

2. **Ruflo-style worker contracts**
   - HCC stage_5 executor 与 reviewer 角色分离
   - 定义 executor/reviewer contract：输入/输出/验收标准
   - 状态：ADR 候选，需用户确认

3. **OpenClaw-style permission boundary**
   - Hermes IPC handler 增加 sandbox/allowlist 权限边界
   - 防止恶意 handler 访问未授权资源
   - 状态：ADR 候选，需用户确认

---

*本文档不修改 locked roadmap。所有建议需通过 ADR + 用户确认后才能进入 V6/V7/V5。*