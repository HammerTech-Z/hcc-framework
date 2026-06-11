# Hermes Pro UI / BaiLongma / macOS 审计包

生成时间：2026-06-11  
用途：给 Claude 网页版审计 Hermes Pro 当前 UI 设计与实现状态，重点核对 BaiLongma 参考、macOS 原生感、只读/危险动作边界、文档与本地代码是否一致。  
仓库路径：`/Users/midoudou/hermes-pro`

---

## 0. 给 Claude 网页版的审计提示词

请你作为独立审计方，审计下面这份 Hermes Pro UI 设计与本地实现摘要。重点判断：

1. Hermes Pro 当前 UI 方向是否真正符合“macOS intelligence console”：低 chrome、三栏 shell、可折叠 sidebar、右侧 inspector、system font、vibrancy、克制动效，而不是普通 SaaS dashboard 或游戏 HUD。
2. BaiLongma / HCC Cockpit / Mission Control 的关系是否清晰：BaiLongma 是视觉和 cockpit 语言参考，HCC Cockpit 是只读 POC，Mission Control 是当前统一入口；不要误判为 BaiLongma productionization 已批准。
3. 当前本地代码与旧设计文档是否存在事实漂移：早期文档说 UI redesign 未开始，但本地代码已经有 UI slices 落地，请指出哪些表述需要更新。
4. 只读边界是否可信：Mission / HCC Cockpit / Knowledge Control 是否只调用允许的 read APIs，是否避免 runPlaybook、triggerCronJob、knowledgeIngest、sendMessage、startGateway 等写入/运行时动作。
5. macOS 设计是否有未落地或落地不充分之处：sidebar collapse、inspector、keyboard shortcut、semantic tokens、响应式、focus-visible、系统字体、图标按钮等。
6. 请找出可能的 bug、AI 幻觉、过度声称、设计与实现不一致、测试覆盖盲区，并给出最小修复建议。  

请不要只给审美意见；请按“事实问题 / 风险等级 / 证据 / 建议修复 slice”输出。

---

## 1. 当前本地快照

本审计包基于本地仓库当前代码快照，而不是只基于旧文档。

- 本地 `HEAD`：`3f01b31564206d05e485394d5bc607cfc39587f6`
- `origin/hermes-pro-main`：`c9492be4afd59cfc2651568d2c4ca19ee10fd321`
- 观察：本地 HEAD 比 origin 更新，至少包含 UI/GOV 之后的本地提交；本文件不处理 git 状态，只提取 UI 相关事实。
- 近期本地 log 片段：
  - `3f01b31 docs(soul): record user approval for v5.5.1 subset`
  - `cb9ceb3 docs(soul): commit P0 plan and draft precheck`
  - `3112107 docs(LOCK): document truthful physical lock mechanism`
  - `e7db08b feat(safety): HERMES-GOV-006 HCC task handoff, progress, and danger policy`
  - `c9492be feat(safety): add B1 runtime readiness matrix`

注意：用户当前只要求提取 UI 审计文档；本文件没有修改仓库代码、没有 commit、没有 push。

---

## 2. 关键资料来源

### 设计与 ground truth

- `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md`
- `docs/design/UI-GROUND-TRUTH-2026-06-04.md`
- `docs/design/UI-SLICE-0-CONTRACT-AUDIT-2026-06-05.md`

### BaiLongma / HCC

- `docs/bailongma/02-acui-protocol.md`
- `docs/adr/ADR-20260529-bailongma-poc2-qa-pass-productionization-not-approved.md`
- `docs/adr/ADR-20260530-hcc-cockpit-readonly-poc.md`
- `src/renderer/src/screens/BaiLongma/BaiLongma.tsx`
- `src/renderer/src/screens/HccCockpit/HccCockpit.tsx`
- `src/renderer/src/screens/Mission/Mission.tsx`

### UI shell / Knowledge / boundary

- `src/renderer/src/screens/Layout/Layout.tsx`
- `src/renderer/src/screens/Layout/layout-routes.tsx`
- `src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx`
- `src/shared/lib/screen-boundary-contract.ts`
- `src/renderer/src/assets/main.css`

### 测试证据

- `tests/mission-control-readonly.test.ts`
- `tests/hcc-cockpit-readonly.test.ts`
- `tests/knowledge-control-readonly.test.ts`
- `tests/layout-route-table.test.ts`
- `tests/layout-boundary-badge.test.ts`
- `tests/ui-polish-a11y.test.ts`
- `tests/bailongma-status-sync.test.ts`

---

## 3. 总体 UI 方向

设计 spec 的一句话方向：

> Hermes Pro should feel like a native macOS intelligence console: quiet, precise, dark-first, fast to scan, and futuristic without looking like a game HUD.

中文概括：

- 不是通用 SaaS dashboard。
- 不是营销页。
- 不是炫技 HUD。
- 应该像本地 Apple 质量的 AI 控制台：Chat、Knowledge、Agents、Runs、Safety 状态在一个安静、精准、可扫读的桌面 app 里。

三个主模式：

1. **Chat**：默认首页，BaiLongma-inspired 对话面。
2. **Mission Control**：运营 cockpit，整合 Agent、Knowledge、Cron、Pipeline、Gateway、HCC dry-run、冻结项。
3. **Knowledge Control**：本地知识操作系统，展示 provenance、trust、stale、redaction、prompt-use policy。

---

## 4. macOS / Apple HIG 相关设计要求

设计 spec 明确采用这些 macOS 交互模式：

- **三栏结构**：left navigator / main workspace / right inspector。
- **Sidebar source list**：
  - expanded 约 `220-260px`
  - collapsed icon rail 约 `56px`
  - 分组：Work / Knowledge / Agents / System
  - 快捷键：`⌘\`
- **Inspector pane**：
  - 右侧上下文面板
  - 约 `240-280px`
  - 快捷键：`⌥⌘I`
  - 不替代 main content
- **Unified topbar/titlebar 思路**：
  - 当前 mode title
  - active profile/model
  - soft-switch/read-only/frozen badge
  - compact update indicator
- **Vibrancy / liquid glass 方向**：
  - sidebar / inspector 使用 `backdrop-filter: blur(20px) saturate(180%)`
  - 只用于 shell/inspector，不把所有 card 都做玻璃
- **Typography**：
  - UI：`-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`
  - code/IDs/numbers：`SF Mono`
  - 不使用 viewport-scaled font
- **Motion**：
  - 120-200ms
  - sidebar collapse: width + opacity
  - inspector: width/opacity
  - 无弹跳、无装饰性渐变动画
- **色彩**：
  - layered graphite，不用纯黑/纯 admin gray
  - system blue/indigo accent
  - success/warning/danger 对应 macOS system colors

### 当前 CSS 落地证据

`src/renderer/src/assets/main.css` 已包含 `--hp-*` additive token 层：

- dark base：`--hp-bg-base: #1c1c1e`
- surfaces：`#2c2c2e`, `#3a3a3c`, `#48484a`
- vibrancy：`--hp-bg-vibrancy: rgba(28, 28, 30, 0.72)`
- accent：`--hp-accent: #0a84ff`
- status：`--hp-success`, `--hp-warning`, `--hp-danger`
- radii：`6px / 8px / 10px`
- motion：`120ms / 160ms / 200ms`
- fonts：`--hp-font-ui`, `--hp-font-mono`, `--hp-font-display`

CSS 还显示：

- `.sidebar` 使用 `background: var(--hp-bg-vibrancy)` 和 `backdrop-filter: var(--hp-blur-vibrancy)`
- `.layout-sidebar-collapsed .sidebar` 存在
- `.shell-inspector` 使用 vibrancy、width/opacity transition
- `.layout-inspector-open .shell-inspector` 存在
- focus-visible selectors 覆盖 sidebar、inspector、preference nav

审计点：请核对 CSS 是否真的整体读起来像 macOS，而不是只有 token 名称像；尤其检查卡片密度、border、radius、contrast、responsive 行为。

---

## 5. BaiLongma 设计来源与边界

### 5.1 BaiLongma 在 Hermes Pro 中的角色

BaiLongma 是 Hermes Pro 中最强的“future cockpit”参考，但不是当前已批准的生产自动执行系统。

设计 spec 明确：

- 借鉴 BaiLongma：
  - futuristic chat/cockpit energy
  - mission progress framing
  - real-time thought stream / event stream concept
  - phase/risk/next-action language
- 不借鉴或不启用：
  - dense wall-of-panels as default
  - voice runtime
  - social distribution runtime
  - production execution

`ADR-20260529-bailongma-poc2-qa-pass-productionization-not-approved.md` 明确：

- BaiLongma POC-2 Manual QA PASS。
- Productionization NOT APPROVED。
- 当前只允许 read-only 增强。
- 禁止：
  - write IPC
  - Memory/Vault/Knowledge 写入
  - WeChat/model/chat 调用
  - 新增 write IPC
  - 完整 productionization

### 5.2 ACUI Protocol

`docs/bailongma/02-acui-protocol.md` 定义 ACUI：

- ACUI 是 Agent-Computer/User Interface 协议。
- 它不是渲染层，不规定 CSS/动画/颜色。
- 它定义 task、step、focus、context、artifact、event、error 的消息契约。
- 目标：
  - React UI 能稳定渲染 task cockpit。
  - BaiLongma adapter 可调用 Hermes Pro 现有能力。
  - error states 统一表达。
- Layer 2 明确：不引入新的 `bailongma:*` IPC。

核心语义：

- `Task`：goal、focus、state、timestamps。
- `Step`：module、command、state、error。
- `Focus`：焦点栈，支持 nested sub-task。
- `Context`：来自 Knowledge/Memory/Vault 等模块的上下文。
- `Artifact`：step 输出。
- `Event`：`task.created`, `step.started`, `artifact.created`, `error` 等。
- `ACUIMessage`：统一 envelope，JSON 序列化。

审计点：ACUI 文档是协议/语义层，不应被误解成“已经有 production runtime”。当前 UI 里 HCC Cockpit 生成的是 ACUI synthesis/event display，不是自动执行。

---

## 6. HCC Cockpit 当前状态

`ADR-20260530-hcc-cockpit-readonly-poc.md` 明确：

- HCC Cockpit read-only POC 已完成并 QA pass。
- Productionization NOT APPROVED。
- 三栏布局：
  - 左侧 Focus Stack
  - 中间 Task Canvas
  - 右侧 Brain UI
  - 底部 ACUI Event Log
- Stage Rail：
  - discovery / diagnose = 发现
  - plan = 方案
  - execute = 修复
  - verify = 验证
  - deliver = 交付

### 6.1 HccCockpit 实际只读 API

`src/renderer/src/screens/HccCockpit/HccCockpit.tsx` 中 `load()` 只调用：

- `listPipelineRuns(30)`
- `listPlaybooks()`
- `getCronJobHistory(30)`
- `getEvents(40)`
- `getGatewayState()`
- `checkGatewayHealth()`

代码中可见只读 badge：

- `HCC 自动执行驾驶舱 · Read-only POC · No new IPC · No writes · No model/tool execution`

可见 disabled 控件：

- `Run playbook disabled`
- `Auto fix disabled`
- `Deliver disabled`

可见 guardrail：

- `First phase cockpit only: no cron mutation, no Memory/Vault/Knowledge writes, no WeChat send, no dangerous model action.`

### 6.2 HCC Cockpit 测试边界

`tests/hcc-cockpit-readonly.test.ts` 验证：

- 只调用上述 allowed read APIs。
- 不引用这些 mutation/runtime APIs：
  - `runPlaybook`
  - `createCronJob`
  - `pauseCronJob`
  - `resumeCronJob`
  - `triggerCronJob`
  - `readVaultFile`
  - `addMemoryEntry`
  - `updateMemoryEntry`
  - `removeMemoryEntry`
  - `writeSoul`
  - `sendMessage`
  - `runLlmChecker`
  - `understandAnything`
  - `startSshTunnel`
  - `stopSshTunnel`
  - `addMcpServer`
  - `removeMcpServer`
  - `toggleMcpServer`
  - `testMcpServer`
- 执行按钮保持 disabled。

审计点：HccCockpit 源文件中是否存在其他间接 runtime 行为？当前静态测试只匹配 `window.hermesAPI.<api>` 形式，可能无法覆盖未来 helper 包装调用，需要关注。

---

## 7. Mission Control 当前状态

当前本地代码显示：BaiLongma/HCC 的 UI 方向已经被统一到 `Mission` screen。

### 7.1 Mission 实现目标

`src/renderer/src/screens/Mission/Mission.tsx`：

- 展示 read-only cockpit：
  - gateway
  - vault
  - pipeline runs
  - events
  - cron jobs
  - playbooks
  - cron history
  - health
- 使用 lucide icons：
  - `Activity`, `AlertTriangle`, `Archive`, `CheckCircle2`, `Clock3`, `Database`, `FileStack`, `Gauge`, `GitBranch`, `Lock`, `ShieldCheck`, `Timer`
- 页面结构：
  - hero/title + boundary badge
  - stat grid
  - mission-grid panels
  - lower grid: artifacts / cron snapshot / event timeline / source contract

可见文本：

- `Read-only · No new IPC · No writes · Productionization NOT APPROVED`
- `L6 live knowledge flush remains unapproved.`
- `Execution controls are intentionally absent.`
- guardrails:
  - read-only cockpit
  - no new IPC
  - no writes
  - no runtime action
  - HCC Auto Executor paused
  - P3 real execution requires approval
  - hard cutover not approved

### 7.2 Mission 只读 API

Mission 只调用：

- `getGatewayState`
- `listVaultFiles`
- `listPipelineRuns(30)`
- `getEvents(40)`
- `listCronJobs(true, profile)`
- `listPlaybooks`
- `getCronJobHistory(30)`
- `checkGatewayHealth`

### 7.3 Mission aliases

`src/renderer/src/screens/Layout/layout-routes.tsx`：

- `mission` renders `<Mission profile={...} />`
- `bailongma` renders `<Mission profile={...} legacySource="bailongma" />`
- `hccCockpit` renders `<Mission profile={...} legacySource="hcc" />`

这意味着当前本地代码中 BaiLongma / HCC Cockpit 在主 route table 已经成为 Mission 的 legacy aliases，而不是三个完全独立 cockpit 入口。

### 7.4 Mission 测试边界

`tests/mission-control-readonly.test.ts` 验证：

- Mission only calls approved read APIs。
- 不引用：
  - `runPlaybook`
  - `triggerCronJob`
  - `createCronJob`
  - `pauseCronJob`
  - `resumeCronJob`
  - `startGateway`
  - `stopGateway`
  - `knowledgeIngest`
  - `readVaultFile`
  - `addMemoryEntry`
  - `updateMemoryEntry`
  - `removeMemoryEntry`
  - `writeSoul`
  - `sendMessage`
  - `setConfig`
  - `setEnv`
  - `openExternal`
- 保持 visible boundary labels。
- 保持 BaiLongma / HCC Cockpit as one-release aliases。

审计点：旧文档 `UI-GROUND-TRUTH` 仍说 UI redesign 未开始，而当前 Mission/Layout/KnowledgeControl 已经落地。需要 Claude 判断是否应更新 ground truth，避免后续代理被旧状态误导。

---

## 8. Layout / App Shell 当前状态

`src/renderer/src/screens/Layout/Layout.tsx` 当前已经具备 app shell 方向：

- grouped sidebar：
  - Work
  - Knowledge
  - Agents
  - System
- sidebar collapse state：`sidebarCollapsed`
- inspector state：`inspectorOpen`
- 快捷键：
  - `⌘\` toggles sidebar
  - `⌥⌘I` toggles inspector
- topbar：
  - Hermes Pro kicker
  - active view label
  - boundary badge
  - `KEEP v0.15.1`
  - profile badge
  - Inspector toggle
- inspector：
  - `BoundaryInspectorPanel`
  - descriptor from screen boundary contract

### 8.1 Route table

`src/renderer/src/screens/Layout/layout-routes.tsx`：

- 21 routes
- chat is the only non-lazy route
- 20 routes lazy mounted after first visit
- remote notice guards exist
- route groups align with `screen-boundary-contract`

### 8.2 Route tests

`tests/layout-route-table.test.ts` 验证：

- exactly 21 routes
- order matches UI Slice 1 contracts
- no duplicates
- sidebar group counts：
  - Work 6
  - Knowledge 5
  - Agents 4
  - System 6
- chat only non-lazy
- 11 remote restricted routes
- mission/bailongma/hccCockpit all use Mission component with distinct legacy source
- `layout-routes.tsx` contains no IPC/fetch/hermesAPI
- `Layout.tsx` contains no new fetch/ipcRenderer/ipcMain/runtime config write calls

### 8.3 Boundary badge

`tests/layout-boundary-badge.test.ts` 验证：

- 21 views all produce badge descriptor
- static `read-only shell` badge removed
- Mission / BaiLongma / HCC Cockpit / Monitor show `read-only · P3`
- Knowledge Control show `read-only · P2`
- Knowledge show `mixed · P2`
- Playbooks / Understand / Schedules show runtime-write
- Providers show config-write
- Chat show mixed

审计点：boundary badge 是良好设计，但是否足以让用户理解危险操作？是否需要更强的 action-gate UI？特别是 Playbooks / Understand / Schedules 仍是 runtime-write。

---

## 9. Knowledge Control 当前状态

设计 spec 要求 Knowledge Control 是独立页，而不是塞进旧 Knowledge screen。

当前本地已实现：

- `src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx`
- `src/renderer/src/screens/KnowledgeControl/knowledge-control-model.ts`
- components under `KnowledgeControl/components`

### 9.1 Knowledge Control 页面目标

页面文案：

- `Local Knowledge OS`
- `Read-only board for vault inventory, provenance, trust, stale state, and answer policy. Ingest remains in the existing Knowledge screen.`
- boundary：`Read-only · No ingest writes · No live flush · No board writes`

### 9.2 Knowledge Control API

只读调用：

- `listVaultFiles`
- `getVaultStats`
- `getGbrainStats`
- `readVaultFile`
- `knowledgeSearch`

不调用：

- `knowledgeIngest`
- cron/runtime APIs
- sendMessage
- config/env writes
- memory/soul writes

### 9.3 Knowledge Control 行为

- 读 vault group/file。
- 读取 frontmatter/content。
- 构造 knowledge cards。
- 搜索预览 debounce 250ms。
- filter by source/stale。
- board columns from `KNOWLEDGE_COLUMNS`。
- inspector shows selected item。
- 无 drag/drop。
- 无 board writes。

### 9.4 Knowledge Control 测试

`tests/knowledge-control-readonly.test.ts` 验证：

- only calls approved read APIs
- does not call write/runtime APIs
- no drag/drop affordances or DnD libraries
- Knowledge Control separate from existing Knowledge
- lifecycle deterministic：
  - inbox
  - candidate
  - verified
  - linked
  - stale
  - archived
- stale state deterministic, no LLM/write actions
- model layer does not hide forbidden terms

审计点：`readVaultFile` 是否应被视为 read-only 仍需确认；它不是写，但读取 vault 内容可能涉及敏感显示，应关注 redaction/trust UI 是否充分。

---

## 10. Screen Boundary Contract

`src/shared/lib/screen-boundary-contract.ts` 是 UI 安全分层的关键事实源。

全局 invariants：

- `SCREEN_BOUNDARY_CONTRACT_NEW_IPC_ALLOWED = false`
- `SCREEN_BOUNDARY_CONTRACT_RUNTIME_ACTIVATION_ALLOWED = false`
- `SCREEN_BOUNDARY_CONTRACT_CONFIG_WRITES_ALLOWED = false`
- `SCREEN_BOUNDARY_CONTRACT_HCC_AUTO_EXECUTOR_ALLOWED = false`
- `SCREEN_BOUNDARY_CONTRACT_DIRECT_GATEWAY_FIX_APPLIED = true`

合约包含 21 views：

- Work：
  - chat
  - sessions
  - office
  - mission
  - playbooks
  - understand
- Knowledge：
  - skills
  - knowledgeControl
  - knowledge
  - soul
  - memory
- Agents：
  - agents
  - bailongma
  - hccCockpit
  - monitor
- System：
  - models
  - providers
  - tools
  - schedules
  - gateway
  - settings

重要分类：

- `mission`：read_only / P3 / no write surfaces
- `knowledgeControl`：read_only / P2 / no write surfaces
- `knowledge`：mixed / P2 / `knowledgeIngest` remains explicit user write path
- `chat`：mixed / P1 / sendMessage/abort/model config
- `playbooks`：read_write_runtime / P1 / runPlaybook
- `understand`：read_write_runtime / P1 / understandAnything/runPlaybook
- `schedules`：runtime-write surface due cron operations
- `providers`：config-write / P1 due credential pool/env/model defaults

审计点：请检查 UI 是否把这些 risk labels 展示得足够清楚；尤其是 P1/P2/P3 标签对普通用户是否可理解。

---

## 11. 已知旧文档与当前本地状态的漂移

### 漂移 1：UI Ground Truth 仍说 redesign 未开始

`docs/design/UI-GROUND-TRUTH-2026-06-04.md` 中：

- UI redesign 实现：未开始
- Slice 0 Contract Audit：unblocked but still needs approval
- 不可做：renderer 实装

但本地当前代码已经出现：

- `Layout` app shell with grouped sidebar / inspector / boundary badge
- `layout-routes.tsx` 21-route table
- `Mission` unified read-only cockpit
- `KnowledgeControl` board
- `--hp-*` design tokens in CSS
- UI slice tests for route table, boundary badge, a11y, read-only boundaries

这很可能表示 ground truth 文档未同步到当前实现阶段。Claude 应重点判断：

- 哪些旧文档需要更新？
- 是否存在“文档说未开始，但代码已实现”的流程风险？
- 是否会误导后续 Codex/Claude Code 做重复实现？

### 漂移 2：BaiLongma.tsx 仍存在，但主 route alias 已指向 Mission

`src/renderer/src/screens/BaiLongma/BaiLongma.tsx` 仍存在，且有自身 cockpit 实现；但 `layout-routes.tsx` 中 `bailongma` route 现在 render Mission legacy alias。

审计点：

- 是否仍有死代码或历史组件需要保留？
- `BaiLongma.tsx` 是否还被其他地方引用？
- 如果保留，是作为历史参考还是 fallback？
- 是否应该在文档中明确“主 UI 已 alias 到 Mission，旧 BaiLongma component 不再是主 route surface”？

### 漂移 3：Knowledge IPC 状态比早期 spec 前进

早期 Slice 0 audit 提到 `knowledgeSearch` / `knowledgeIngest` 可能是 direct gateway HTTP path；当前 `screen-boundary-contract` 注释显示：

- Knowledge Control：`knowledgeSearch` and `getGbrainStats` 已 migrated IPC
- Knowledge：`knowledgeSearch`, `knowledgeIngest`, `getGbrainStats` 已 migrated IPC
- no direct gateway methods remain

审计点：请核对 preload/main 实现是否真的完成迁移，不要只信 contract 注释。

---

## 12. UI 安全边界总表

### 明确禁止被 UI redesign 误开启

- HCC Auto Executor
- P3 real execution
- BaiLongma Productionization
- hard cutover
- Round 2 C
- L6 live knowledge flush
- direct runtime writes from UI
- new IPC write handles
- live knowledgeIngest from Knowledge Control
- Hermes Kanban dispatcher trigger from UI
- cron trigger / WeChat send / handoff/audit writes from design work

### 当前只读 surfaces

- Mission
- HCC Cockpit
- BaiLongma route alias to Mission
- Knowledge Control
- Monitor（按 contract：read-only · P3）

### 当前仍有写/运行时 surfaces

- Chat：sendMessage / abort / config
- Playbooks：runPlaybook
- Understand：understandAnything / runPlaybook
- Schedules：cron CRUD / trigger
- Gateway：start/stop/config
- Providers/Models/Tools/Skills/Memory/Soul/Settings：配置、文件或外部动作

审计点：UI 设计不能把“有风险但存在的旧功能”误包装成安全 cockpit，也不能把只读页面改成 runtime surface。

---

## 13. macOS 符合度初评

### 已符合或部分符合

- grouped sidebar 已落地。
- sidebar collapse state 和 `⌘\` 已落地。
- inspector state 和 `⌥⌘I` 已落地。
- system-ish `--hp-*` token 层已落地。
- vibrancy/backdrop-filter 已用于 sidebar/topbar/inspector。
- status/boundary badge 已动态化。
- focus-visible 已覆盖主要 shell 和 preference nav。
- route table 避免 21 个手写 pane blocks。
- Mission/Knowledge Control/HCC 都强调只读边界。

### 可能未充分符合

- 仍有许多页面可能保留旧 dashboard/card 密度。
- `HccCockpit` 独立页面仍是偏 panel-dense 的 POC 风格，虽然主 route 已 alias 到 Mission。
- topbar 还不是真正 macOS unified titlebar，只是 renderer 内 topbar。
- inspector 当前主要是 boundary inspector，不一定已有 Chat/Knowledge/Mission 上下文 tabs。
- Chat 的 BaiLongma-inspired composer、command palette、right inspector 是否已经完全落地，需要进一步审 `Chat.tsx`。
- voice placeholder 是否存在且 inert，需要进一步确认。
- 当前测试偏静态字符串/源码匹配，不能替代真实视觉 QA。

---

## 14. 需要 Claude 重点审计的问题

### P0/P1 风险类

1. 是否有任何 UI surface 在文案上暗示：
   - HCC Auto Executor 已启动
   - Productionization 已批准
   - hard cutover 已完成
   - L6 live knowledge flush 已启用
2. Mission / Knowledge Control / HCC Cockpit 是否存在隐藏 runtime/write path？
3. `Layout.tsx` 的 shortcuts、boundary badges、inspector 是否可能触发副作用？
4. `KnowledgeControl` 使用 `readVaultFile` 是否可能造成敏感内容展示风险，需要 redaction/trust UI 增强？

### 文档漂移类

1. `UI-GROUND-TRUTH` 是否必须更新为“UI slices 已部分落地”？
2. `UI-SLICE-0-CONTRACT-AUDIT` 中关于 Knowledge direct gateway 的旧结论是否已过期？
3. BaiLongma/HCC/Mission 的当前关系是否应写入 ADR 或 ground truth？

### macOS 体验类

1. CSS tokens 是否真的产生 macOS 原生感，还是 token 名称正确但视觉仍旧？
2. sidebar collapsed 56px 是否专业可用？
3. inspector 是否有足够上下文价值，还是只是安全说明面板？
4. Mission Control 是否仍过度 card 化？
5. 是否需要更接近 macOS preference panes 的 Settings/Providers/Models/Tools restyle？

### 测试覆盖类

1. 当前 read-only 测试多为源码字符串匹配，能否被 wrapper/helper 绕过？
2. 是否需要 Playwright/e2e 截图审查 macOS 视觉？
3. 是否需要测试 `BaiLongma.tsx` 是否仍被 route 使用？
4. 是否需要测试 `KnowledgeControl` 不显示未 redacted secrets？

---

## 15. 建议下一步 slice

如果 Claude 审计后没有发现高风险 bug，建议下一步不是继续大改 UI，而是做一个小的事实同步 slice：

### UI-DOC-SYNC-001：同步 UI Ground Truth 与当前实现

目标：

- 更新 `docs/design/UI-GROUND-TRUTH-2026-06-04.md` 或新增当前 UI state 文档。
- 明确：
  - UI spec 方向已批准。
  - Slice 0 audit 已完成。
  - 当前本地已有 Layout shell / Mission / Knowledge Control / boundary badge / tokens。
  - BaiLongma/HCC routes 现在是 Mission legacy aliases。
  - Productionization 仍 NOT APPROVED。
  - Knowledge Control 只读；旧 Knowledge 仍保留 explicit ingest write path。
- 不改 renderer。
- 不改 IPC。
- 不改 runtime。
- 不改 package/roadmap。

若 Claude 发现真实 UI bug，再把 bug 拆成更小 implementation slice，例如：

- `UI-SAFETY-001`: strengthen read-only test against helper/wrapper call forms
- `UI-MACOS-001`: visual polish only for Mission card density/spacing
- `UI-KNOWLEDGE-001`: redaction/trust display hardening for Knowledge Control inspector

---

## 16. 审计输出格式建议

请 Claude 网页版按这个格式回复：

```text
审计结论：PASS / NEED_FIX / BLOCKED

关键发现：
1. [P0/P1/P2/P3] 标题
   证据：
   风险：
   最小修复：

文档漂移：
- ...

macOS 符合度：
- 已符合：
- 不足：

BaiLongma/HCC/Mission 边界：
- ...

建议下一步 slice：
- ...
```

---

## 17. 本文件没有做的事

- 没有修改 Hermes Pro 仓库源码。
- 没有运行 UI dev server。
- 没有运行 tests。
- 没有 commit。
- 没有 push。
- 没有写 `~/.hermes/*`。

本文件只是把本地 UI 设计与实现事实提取为 Claude 网页版审计材料。
