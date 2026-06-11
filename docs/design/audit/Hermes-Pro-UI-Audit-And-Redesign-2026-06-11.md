# Hermes Pro UI 审计报告 + UI 优化方案

生成时间：2026-06-11
审计方：Claude 网页版（独立审计）
输入材料：
- `Hermes-Pro-UI-BaiLongma-macOS-Audit-Pack-2026-06-11.md`（审计包，796 行）
- `Hermes-Pro-UI-Claude-Web-Additional-Info-2026-06-11.md`（补充包，含 Chat.tsx / main.css / Layout.tsx / preload / IPC handler 源码摘录）
- GitHub API + raw LICENSE 文件实时核实（2026-06-11 执行）

审计边界声明：本次审计基于两份摘要包中的源码摘录与测试描述，未获得完整源文件。凡结论依赖完整源码的，均标 `UNVERIFIED` 并给出本地验证命令。本报告不修改仓库、不建议任何 runtime 启用、不解除任何冻结项。

---

# 第一部分：事实审计

## 1. 审计结论

**NEED_FIX**

理由：未发现 P0 级运行时安全违规（在已提供证据范围内），但存在 1 个流程级 P1（文档漂移会误导后续代理）、1 个安全测试 P1（字符串匹配可被绕过）、1 个设计-实现矛盾 P1（字体声称与实际不符），以及多个 P2。不构成 BLOCKED，因为所有问题都有小型修复 slice 路径且不依赖未批准能力。

不判 PASS 的核心依据：`UI-GROUND-TRUTH-2026-06-04.md` 与本地代码的漂移在你们自己的流程规则下属于已确立的高风险模式（历史教训：HANDOFF.md "6 themes ready" 实际只有 2 个）。这次是反方向漂移——文档说没做，代码已做——同样会导致重复实现或误判审批状态。

## 2. 发现的问题列表（按 P0/P1/P2/P3）

### P0：无

在已提供证据范围内，未发现：UI 暗示 HCC Auto Executor 已启动、Productionization 已批准、hard cutover 已完成、L6 live flush 已启用；未发现 Mission / Knowledge Control / HCC Cockpit 的隐藏写路径。相反证据充分：boundary contract 五个全局 invariant 均为禁止态、三个只读页面的 allowed API 清单与禁止 API 清单均有对应测试、Mission 页面明文 `L6 live knowledge flush remains unapproved`、voice placeholder 已确认 `disabled` + inert。

但注意：以上"无 P0"结论受 P1-2（测试绕过风险）限定——静态字符串测试通过 ≠ 运行时无写路径。结论准确表述为：**在静态证据层面无 P0，运行时层面 UNVERIFIED。**

---

### [P1-1] UI Ground Truth 文档漂移：文档说 redesign 未开始，本地已落地 Layout/Mission/KnowledgeControl/tokens/测试

- **证据**：`docs/design/UI-GROUND-TRUTH-2026-06-04.md` 写"UI redesign 实现：未开始""不可做：renderer 实装"；但本地 HEAD `3f01b31` 已包含 `Layout.tsx`（412 行 shell）、`layout-routes.tsx`（21 路由表）、`Mission.tsx`、`KnowledgeControl.tsx`、`--hp-*` token 层、7 个 UI 边界测试。
- **风险**：后续 Codex / Claude Code 读到 ground truth 会认为 renderer 禁改或未开始，可能（a）重复实现产生冲突分支，（b）误以为现有 renderer 改动未经批准而回滚，（c）审批链断裂——无法从文档判断当前实现是哪个 slice 批准的产物。这正是你们流程规则"先审实际代码再执行 sync/align 任务"要防的事故类型。
- **是否 AI 幻觉**：不是。是确认的文档漂移（双方材料一致承认）。
- **最小修复**：`UI-DOC-SYNC-001`（见第二部分 H 节）。只改文档，不碰 renderer/IPC/runtime。这应是下一个执行的 slice，优先级高于任何视觉优化。

### [P1-2] 只读边界测试是源码字符串匹配，helper/wrapper 一层包装即可绕过

- **证据**：审计包第 6.2 节自述"当前静态测试只匹配 `window.hermesAPI.<api>` 形式"；补充包第 10 节再次确认。即：`const api = window.hermesAPI; const run = api["run" + "Playbook"]` 或任何 helper 模块转发都不会被现有测试捕获。
- **风险**：这是"soul 声称的硬约束 vs 实际机械强制"缺口的 UI 版本——与你们已确认的两个 P0（`human_reviewed` 自证、扫描旁路）同构。只读页面的安全声明（boundary badge、ADR 引用）建立在一个可绕过的测试上，声明强度被高估。当前无证据表明已被绕过，所以判 P1 而非 P0。
- **是否 AI 幻觉**：不是。两份材料主动披露。
- **最小修复**：`UI-SAFETY-001`：(1) 测试改为对只读 screen 的 import graph 做静态分析——只读组件及其传递依赖中不得 import 任何含禁止 API 的模块（用 TS compiler API 或 `madge` 级别的依赖遍历，而不是正则）；(2) 增加 preload 层面的运行时断言（开发模式）：在只读 route 激活期间，对禁止 channel 的 `ipcRenderer.invoke` 记录并 fail test。(3) 在 `screen-boundary-contract.ts` 中为每个 read_only view 增加 `enforcement: "static-string" | "import-graph" | "runtime-assert"` 字段，让合约诚实声明自己的强制等级——这与 soul 五大不变量中"声称即强制"原则对齐。

### [P1-3] 字体声称与实现矛盾：spec 说 system font，body 实际 Google Sans 优先

- **证据**：设计 spec 声称 Typography 为 `-apple-system, BlinkMacSystemFont, SF Pro Text`；但 `main.css` 中 `--font-sans` 第一项是 `"Google Sans"`（@font-face 本地加载），且 `body` 使用 `var(--font-sans)`。`--hp-font-ui` 虽是 system-first，但未挂到 body。
- **风险**：(a) 整个 app 的"macOS 原生感"在最底层被否决——字体是 macOS 质感的第一要素，token 名称像 macOS 但渲染出来不是；(b) 这正是你提示词里点名要查的"token 名称像 macOS 但实际不是"的实例；(c) 附带 license 问题：Google Sans 不是开放授权字体（Google Sans 仅授权 Google 自家产品；开放的是 Product Sans 的替代品 Open Sans / Google Sans Text 的情况也有限制），在一个以盈利为北极星的产品里 bundle 它有授权风险，需要本地核实字体文件来源。`UNVERIFIED`：字体文件具体来源与授权条款需本地确认。
- **是否 AI 幻觉**：spec 的 Typography 描述属于"过度声称"（描述的是目标态不是现状），不是幻觉。
- **最小修复**：`UI-MACOS-001a`：将 `body` 字体切到 `var(--hp-font-ui)`，Google Sans 降级为可选主题或直接移除 @font-face；同时确认不 bundle SF Pro 字体文件（Apple 字体授权只允许在 Apple 平台以 system font 方式使用，`-apple-system` 引用没问题，打包 .otf 有问题）。这是一行级改动但全局视觉变化，必须先经用户批准（见 I 节）。

---

### [P2-1] ClawPanel 引用存在双仓库歧义，其中一个是 CC BY-NC-SA（非商用条款）

- **证据**（GitHub API + raw LICENSE 实查，2026-06-11）：
  - `qingchencloud/clawpanel`（2830★，Tauri v2 桌面面板）：LICENSE 实读为 **AGPL-3.0** ✅ 与 spec 标注一致
  - `zhaoxinyi02/ClawPanel`（852★，Go 单二进制面板）：LICENSE 实读为 **CC BY-NC-SA 4.0** —— 含 NonCommercial 条款
- **风险**：spec 只写"ClawPanel AGPL-3.0"，未 pin 仓库 URL。如果团队实际参考的是 zhaoxinyi02 版本，CC BY-NC-SA 的非商用条款与 Hermes Pro 的盈利北极星直接冲突——连"借鉴是否构成演绎作品"都会变成商用争议点，比 AGPL 更麻烦。两个项目信息架构不同（Tauri 桌面 vs Go web 面板），借鉴的 pattern 也不同。
- **是否 AI 幻觉**：不是幻觉（项目真实），是**引用精度不足**。
- **最小修复**：并入 `UI-DOC-SYNC-001`：在 design spec 的 Reference Stack 中为每个引用 pin 具体仓库 URL + 核实日期 + 实测 license。ClawPanel 两个仓库都只能 pattern 参考、零代码复制；CC BY-NC-SA 那个建议在文档中明确标注"非商用条款，仅观察信息架构，不做任何接近复制的演绎"。

### [P2-2] BaiLongma "license unknown" 已过时：最可能的公开仓库是 MIT

- **证据**：GitHub 搜索 `bailongma` 命中 `xiaoyuanda666-ship-it/BaiLongma`（338★），LICENSE 实读为 **MIT**（Copyright (c) 2026）。该仓库无 description，无法从 API 元数据 100% 确认就是你们分析过的那个 TICK 心跳/ACUI 协议项目。另有 `taosdata/Bailongma`（TDengine 数据传输器，AGPL-3.0）是同名无关项目，注意不要混淆。
- **风险**：低。"license unknown → 只做概念参考"是保守正确的姿态，不会出事；但文档声称已过时，且如果确认是 MIT，未来想借鉴更多内容时决策依据是错的。
- **是否 AI 幻觉**：不是。引用真实，license 信息过时。
- **最小修复**：并入 `UI-DOC-SYNC-001`：本地确认当初分析的 BaiLongma 仓库 URL 是否为 `xiaoyuanda666-ship-it/BaiLongma`；若是，更新为"MIT（2026-06-11 核实）"，并保持"当前仍按视觉/概念参考"的决策不变（理由从 license 不明改为：未做代码质量审计 + productionization 未批准）。

### [P2-3] Chat 审批栏依赖正则 `APPROVAL_RE` 探测危险提示，存在漏报面

- **证据**：`APPROVAL_RE = /⚠️.*dangerous|requires? (your )?approval|\/approve.*\/deny|do you want (me )?to (proceed|continue|run|execute)/i`，命中后渲染 `onApprove`/`onDeny`，点击发送 `sendMessage("/approve")`。
- **风险**：(a) 漏报：agent 用中文输出危险提示（"是否继续执行？"）、换 emoji、或换措辞时正则不命中，审批栏不出现，用户可能用普通文本回复"好的"——这个"好的"是否被 backend 当作批准取决于 backend 解析，UI 层失去了把关；(b) 误报：正常对话里出现 "do you want me to continue" 也会弹审批栏，稀释审批的严肃性；(c) 审批语义建立在自然语言模式匹配上，而你们 soul 不变量明确反对把安全语义放在非结构化通道里（知识即攻击向量原则的近亲）。
- **是否 AI 幻觉**：不是，源码摘录直接证实。
- **最小修复**：`UI-CHAT-001` 内：短期——正则增加中文模式（`需要.*(确认|审批)|是否(继续|执行)|危险操作` 等）并把审批栏出现事件记入本地 log 便于校准；长期（设计层，先不实现）——审批请求应是 backend 发出的结构化消息类型（ACUI `event` 语义正好覆盖），UI 按消息类型渲染审批栏，正则只作 fallback。长期方案涉及消息协议，需单独审批。

### [P2-4] KnowledgeControl 使用 `readVaultFile` 展示原文，无 redaction 证据

- **证据**：KnowledgeControl allowed API 含 `readVaultFile`；测试验证"model layer does not hide forbidden terms"（这条测试的方向是防隐藏，不是防泄露）；两份材料均未出现任何 redaction/脱敏 UI 实现证据。
- **风险**：vault 内容若含密钥、token、个人信息，会被原样渲染在一个被 badge 标为"只读 · 安全"的页面里。"只读"对用户传达的是"这里安全"，但只读≠无害——展示本身就是泄露面（截图、屏幕共享、旁观）。与你们已确认的 P0"secret/instruction 扫描在非 reflection 输入上有旁路"同源：vault 读取路径正是一个非 reflection 输入。
- **是否 AI 幻觉**：不是。是测试覆盖盲区（审计包第 14 节自己列了这个问题）。
- **最小修复**：`UI-KNOWLEDGE-001`：(1) inspector 渲染 vault 内容前过一层本地脱敏（正则匹配常见 secret 形态：AKIA/sk-/ghp_/私钥头/连续高熵串），默认折叠为 `●●●● 已遮蔽，点击显示`，点击显示需二次确认；(2) 增加测试：构造含假 secret 的 fixture vault 文件，断言渲染输出不含明文；(3) trust/provenance 字段缺失时显示"来源未验证"而不是留空。

### [P2-5] Layout.tsx 不是纯 shell：含 `downloadUpdate`/`installUpdate`/`abortChat`/`getSessionMessages`

- **证据**：补充包第 4 节明文列出。
- **风险**：低-中。这些是历史功能不是新增，但 (a) `installUpdate` 是高权限动作（替换应用二进制），放在 shell 层意味着任何 route 激活时都可触达；(b) boundary contract 是按 21 个 view 建模的，shell 自身的动作没有进合约——shell 成了合约外的灰色 surface；(c) `tests/layout-route-table.test.ts` 断言"Layout.tsx contains no new fetch/ipcRenderer"，"no new"措辞默许了存量，存量却没有被任何文档声明。
- **是否 AI 幻觉**：不是。
- **最小修复**：并入 `UI-DOC-SYNC-001` + `UI-SAFETY-001`：(1) 在 `screen-boundary-contract.ts` 增加一个 `shell` 伪 view 条目，把 Layout 自身的 4 个 API 显式登记为 shell-level surface（update: runtime-write；abort/getSession: chat-runtime）；(2) `installUpdate` 触发前必须有确认弹层（如果还没有——`UNVERIFIED`，需本地确认现状）。

### [P2-6] sidebar collapsed 实现 64px，spec 写 56px，差异未记录

- **证据**：spec "collapsed icon rail 约 56px"；`main.css` `.layout-sidebar-collapsed .sidebar { width: 64px; }`。
- **风险**：低。64px 本身可能是更好的可点击尺寸（44pt 触达目标 + 边距），不是 bug；问题是差异无任何文档说明，属于微型漂移——这类未记录差异积累起来就是下一个 ground truth 事故。
- **是否 AI 幻觉**：不是。
- **最小修复**：并入 `UI-DOC-SYNC-001`：spec 改为"collapsed 64px（实现值，2026-06 决议）"或改回 56px，二选一并写一句理由。

### [P2-7] "vibrancy" 命名过度声称：是 CSS backdrop-filter 模拟，非 NSVisualEffectView

- **证据**：`--hp-bg-vibrancy` / `--hp-blur-vibrancy` 命名 + 补充包第 3.4 节自认。CSS blur 只能模糊 app 内部内容，无法透出桌面/其他窗口——真 vibrancy 的核心特征缺失。
- **风险**：低。视觉上 dark 主题下差异不大；风险在术语：文档和 token 命名会让后续代理以为原生 vibrancy 已实现，在此基础上做错误决策（例如"既然有 vibrancy 就不用处理 light 模式对比度"）。
- **是否 AI 幻觉**：不是，是命名级过度声称。
- **最小修复**：并入 `UI-MACOS-001`：token 改名 `--hp-bg-translucent` / `--hp-blur-frosted`（或保留旧名加 alias 过渡），文档统一措辞"CSS 模拟磨砂，非原生 vibrancy"。原生方案留给 `UI-MACOS-NATIVE-001`（未来，单独审批）。

---

### [P3-1] BaiLongma.tsx 死代码悬置

- **证据**：`layout-routes.tsx` 中 `bailongma` route 已渲染 `<Mission legacySource="bailongma" />`；`BaiLongma.tsx` 自身 cockpit 实现仍在仓库。是否还被其他地方 import：`UNVERIFIED`。
- **风险**：认知噪音 + 字符串测试可能仍扫描它产生虚假安全感/虚假告警。
- **最小修复**：本地跑 `grep -rn "from.*BaiLongma/BaiLongma" src/` 确认引用；零引用则移到 `src/renderer/src/screens/_archive/` 并在文件头注释"历史参考，非 route surface，见 ADR-20260529"。不建议直接删除（它是 cockpit 语言的设计参考）。

### [P3-2] boundary badge 的 P1/P2/P3 + 英文术语对普通用户不可解

- **证据**：badge 形如 `read-only · P3`、`mixed · P1`、`runtime-write`。P 序数对用户是噪音（且和你们任务优先级 P0-P2 体系撞了语义——任务里 P0 最严重，badge 里 P3 反而是最安全的只读页，同一字母序数两套含义）。
- **风险**：低（badge 存在总比没有好），但违背"审批/确认心智"的中文用户目标。
- **最小修复**：`UI-CN-001`：用户层显示中文语义词（见第二部分 F 节），工程 P 序数移入 badge 的 hover title / inspector 详情，不在一级界面消失但也不打头阵。

### [P3-3] Chat reference panel 是局部 aside，与全局 shell-inspector 双轨并存

- **证据**：Chat 有 `chat-reference-panel`（Local Knowledge / Web Sources / Agent Judgment），shell 另有 `BoundaryInspectorPanel`。两个右侧面板，两套开关。
- **风险**：低。交互不一致，`⌥⌘I` 在 Chat 页打开的是边界面板而非用户更需要的引用面板。
- **最小修复**：设计层并入 inspector tab 化方案（第二部分 D 节），实现放 `UI-CHAT-001`，需先批准（改 Layout 行为）。

### [P3-4] HccCockpit 独立页仍是 panel-dense POC 风格

- **证据**：审计包第 13 节自认；主 route 已 alias 到 Mission，所以仅影响直接访问该组件的场景。
- **最小修复**：与 P3-1 同思路：确认是否还有入口；有则保留并加"POC 历史界面"水印，没有则归档。不值得花精力 restyle 一个 alias 掉的页面。

### 验证为正常的项（非问题，记录以示已查）

- voice placeholder：`disabled` + `title="Voice entry is not enabled"` + aria-label，确认 inert ✅
- Knowledge IPC 迁移：preload 三个 channel 均为 `ipcRenderer.invoke`，main 层 handler + gateway adapter 路径与 contract 注释一致，`knowledge-ipc-closeout-audit.test.ts` 断言 preload 无 raw `/knowledge` URL ✅（注意：迁移属实，但"main 层仍经 gateway 访问知识服务"——契约注释如实，无过度声称）。`UNVERIFIED` 残留点：仅核对了摘录，handler 完整文件未读。
- Mission / HCC / KnowledgeControl 的 allowed/forbidden API 清单与对应测试互相印证，文案 `Productionization NOT APPROVED` / `Execution controls are intentionally absent` 与 ADR 一致 ✅
- Chat 标为 `mixed · P1` 合理：sendMessage/abort/setConfig/setModelConfig 确实是写/运行时路径，合约没有美化它 ✅

## 3. 参考项目真实性核实表（2026-06-11 GitHub 实查）

| 引用 | 判定 | 最可能仓库 | License（实测） | 备注 |
|---|---|---|---|---|
| Apple HIG | 真实（官方文档） | — | 设计指南 | 遵循即可；勿打包 SF 字体文件 |
| BaiLongma | 真实仓库，**身份待本地确认** | `xiaoyuanda666-ship-it/BaiLongma`（338★） | MIT（实读 LICENSE） | spec"license unknown"已过时；另有 taosdata/Bailongma（TDengine，AGPL）为同名无关项目 |
| ClawPanel | 真实，**双仓库歧义** | `qingchencloud/clawpanel`（2830★）/ `zhaoxinyi02/ClawPanel`（852★） | AGPL-3.0 / CC BY-NC-SA 4.0 | spec 的"AGPL-3.0"匹配前者；必须 pin URL |
| Hermes Kanban | 双重含义 | `GumbyEnder/hermes-kanban`（251★）+ 仓库内部 "Hermes Kanban dispatcher" | 外部仓库无 LICENSE | 无 license = 默认版权保留，零代码复制；文档需区分内外两个概念 |
| Obsidian | 真实（商业产品） | 闭源 | 专有 | 只能借鉴交互概念（vault/graph/命令面板心智） |
| darwin-ui | 真实 | `surajmandalcell/darwin-ui`（51★，"MacOS'esk react component library"） | MIT | 可借鉴；star 少，代码质量未审，按参考不按依赖 |
| openclaw-nerve | 真实 | `daggerhashimoto/openclaw-nerve`（834★，OpenClaw 实时 cockpit） | MIT | 可借鉴 pattern 与代码（MIT），但建议仍只取 pattern |
| turbovault | 真实 | `Epistates/turbovault`（131★，Obsidian vault MCP SDK） | MIT | 与 Knowledge Control"本地知识 OS"方向相关 |
| claude-obsidian | 真实 | `AgriciDaniel/claude-obsidian`(6535★) | MIT | 知识组织心智参考 |
| awesome-design-md | 真实 | `VoltAgent/awesome-design-md`（89k★） | MIT | DESIGN.md 集合，可直接使用 |

**幻觉判定总结：10/10 引用真实存在，本次未发现 AI 幻觉引用。** 缺陷集中在引用精度（未 pin URL、license 信息过时/未区分同名仓库），统一由 `UI-DOC-SYNC-001` 修复。

## 4. 借鉴边界（哪些只能借模式，为什么）

**只能借鉴模式/信息架构/交互概念，禁止代码复制或接近复制的演绎：**

1. `qingchencloud/clawpanel` — AGPL-3.0。任何代码复用会把 AGPL 传染给 Hermes Pro（网络服务也触发 AGPL 的源码提供义务），与闭源盈利产品不兼容。
2. `zhaoxinyi02/ClawPanel` — CC BY-NC-SA 4.0。NonCommercial 条款与盈利北极星直接冲突，ShareAlike 还会传染；CC 协议本身不适于代码（无专利授权）。两个 ClawPanel 中这个的法律风险更高。
3. `GumbyEnder/hermes-kanban` — 无 LICENSE 文件。法律默认：版权保留，无任何复制授权。只能观察。
4. Obsidian — 闭源商业软件，无代码可看；借鉴其 vault 心智、命令面板交互、graph 视图概念均无问题（交互概念不受版权保护）。
5. BaiLongma — 实测 MIT 但身份未本地确认 + 未做代码质量/安全审计 + productionization 未批准。维持"视觉/概念参考"决策，理由更新为后两条。
6. Apple HIG / SF 字体 — 设计模式自由遵循；SF Pro 字体文件不得打包进 app（Apple 字体许可仅限 Apple 平台系统字体方式使用），CSS 引用 `-apple-system` 合法。

**MIT 项目（darwin-ui / openclaw-nerve / turbovault / claude-obsidian / awesome-design-md）法律上可复制代码（保留版权声明即可），但建议仍按 pattern 参考**：未审计的第三方 UI 代码直接进入一个有严格 IPC 边界合约的 app，引入的审计负担大于复用收益——这与"做减法"一致。

---

# 第二部分：UI 优化方案

前提约束（已与用户确认）：仅 renderer CSS / 文案 / 组件层；不新增 IPC；不启用任何 runtime；不实现原生 vibrancy；中文为主 + 英文安全锚点双语；slice 接续现有编号；每个 slice 先出 preflight 等批准。

## A. 当前 UI 最大的 10 个问题

1. **body 字体是 Google Sans，macOS 原生感在最底层被否决**（P1-3）。所有 token、圆角、动效都救不回一个非系统字体的 app。
2. **Mission 是面板墙**：hero + stat grid + mission-grid panels + lower 四宫格，全部同权重铺开。信息密度高但层级为零，违背"quiet, fast to scan"，更像运维 dashboard 不像 cockpit。
3. **Inspector 没有上下文价值**：只装边界说明。一个常驻 280px 的面板只回答"这页安全吗"一个问题，性价比极低，用户开一次就再也不开。
4. **边界表达全靠文字 badge**：只读/混合/运行时写三种风险等级共用同一套视觉材质，靠读英文小字区分。安全边界应该是看一眼就感知的材质差异，不是阅读理解。
5. **审批心智缺位**：审批栏靠正则探测（P2-3），危险动作（Playbooks runPlaybook、Schedules trigger）的确认流没有统一形态，每页各自为政。
6. **中英文错位**：面向中文用户的产品，一级界面全英文（`Read-only · No new IPC · Productionization NOT APPROVED`），把工程锚点直接当用户文案用。
7. **状态语言碎片化**：gateway 健康、cron 历史、pipeline run、knowledge stale、agent 状态各有各的表达（dot / badge / 文字 / 图标），没有一套统一的状态视觉词汇。
8. **双右栏并存**：Chat 的 reference panel 和 shell 的 boundary inspector 是两个独立右侧面板、两套开关逻辑（P3-3）。
9. **历史组件噪音**：BaiLongma.tsx / HccCockpit.tsx 两个被 alias 掉的 cockpit 实现仍在主源码树（P3-1/P3-4），对人和对扫描工具都是噪音。
10. **"未来感"尚未建立**：当前的科技感来自深色 + 蓝色 accent，这是 2020 年代任何 SaaS 的默认值。还没有属于 Hermes 的、可识别的视觉签名。

## B. 推荐的新 UI 设计原则

以乔布斯式判断为基准，结合本产品的安全治理特性：

1. **一屏一问题**。每个页面只回答一个核心问题：Chat 回答"我们在做什么"，Mission 回答"系统现在怎么样、卡在哪、下一步是什么"，Knowledge Control 回答"AI 知道什么、可信吗"。回答不了核心问题的元素降级或移除。
2. **边界即材质**。只读区用磨砂/降饱和材质，写入区用实底材质，危险动作用唯一允许出现的暖色。用户不读字也知道"这页动不了"。安全等级是物理感受，不是标签。
3. **诚实优先于美观**。UI 不得让未批准能力看起来已就绪：disabled 按钮必须解释为什么 disabled（"未批准生产化"），而不是灰着等人误以为是 bug。冻结项显示冻结原因和解冻条件。
4. **默认安静，危险才发声**。正常态零动画零脉冲零发光。颜色、动效、声音是为异常和危险保留的预算——平时不花，关键时刻才有信号价值。
5. **进度用阶段，不用百分比**。任务状态沿用 HCC 五阶段语言（发现/方案/修复/验证/交付），这是 BaiLongma 留下的最有价值的 cockpit 语言。百分比对 agent 任务是谎言，阶段不是。
6. **未来感 = 精确，不是特效**。科技感来自：等宽数字、严格的 4px 网格、毫秒级状态时间戳、单色图标、唯一 accent 色。禁止：渐变发光、玻璃卡片堆叠、装饰性粒子、扫描线。参考的是仪器，不是游戏。
7. **键盘优先，鼠标可达**。已有 `⌘\` `⌥⌘I` 是对的方向；补全 `⌘K` 全局命令面板（设计先行，实现需批准）、`⌘1-4` 切组。中文用户高频路径（看状态→拆任务→审批→继续）每步都要有键盘路径。
8. **中文叙述，英文锚点**。用户读中文，测试和工程读英文锚点，两层并存互不牺牲（详见 F/G 节）。

## C. 新的信息架构

不动 21 路由 / 4 分组（被测试锁定，改动需走 slice），调整的是呈现层级：

```
┌─ Topbar ──────────────────────────────────────────────┐
│ 当前页名 · 边界材质徽章 · profile · 更新指示 · ⌥⌘I    │
├──────────┬─────────────────────────────┬──────────────┤
│ Sidebar  │  Main Workspace             │  Inspector   │
│          │                             │  (tab 化)    │
│ 工作     │  Chat（默认页）             │ ┌──────────┐ │
│  对话    │  Mission（状态总览）        │ │ 上下文   │ │
│  会话    │  Knowledge Control          │ │ 引用     │ │
│  任务流  │  ...                        │ │ 边界     │ │
│ 知识     │                             │ └──────────┘ │
│ 代理     │                             │              │
│ 系统     │                             │              │
└──────────┴─────────────────────────────┴──────────────┘
```

关键调整：

1. **Inspector tab 化**（这是让 inspector 值回 280px 的唯一办法）：
   - 「上下文」tab：当前页的活体信息——Chat 页显示当前会话的模型/token 用量/工具调用进度；Mission 页显示选中 run 的详情；Knowledge Control 显示选中知识卡的 provenance 全文。
   - 「引用」tab：吸收 Chat 现有 reference panel（Local Knowledge / Web Sources / Agent Judgment），消除双右栏。
   - 「边界」tab：现有 BoundaryInspectorPanel 原样保留，降为第三 tab——它的内容没错，错的是独占。
2. **Mission 重排为"答题式"三段**（替代面板墙）：
   - 第一段·一行健康摘要：`网关正常 · 2 个任务进行中 · 1 项待审批 · 3 项冻结`——四个数字回答"现在怎么样"。
   - 第二段·焦点区：进行中任务的阶段轨道（五阶段）+ 阻塞项 + 下一步动作（只读展示，动作引导去对应页面）。这里是 BaiLongma 焦点栈语言的落点。
   - 第三段·可折叠细节：events / cron / pipeline / artifacts 收进可展开 section，默认折叠，要看才展开。
3. **System 组的 6 页（models/providers/tools/schedules/gateway/settings）统一为偏好窗格形态**：左列分类 + 右侧表单，对齐 macOS System Settings 心智。这组页面是配置不是监控，不该长得和 cockpit 一样。

## D. 每个核心页面的改版建议

### D1. App Shell

- Sidebar：分组标题用中文（工作/知识/代理/系统），collapsed 态保留 64px（接受现状，更新 spec），collapsed 时 hover 必须出 tooltip（中文页名）。当前激活项用 4px 左缘 accent 条 + 微提亮，不用整块填充。
- Topbar：信息层级重排为 `页名（最大）> 边界徽章 > profile > 版本/更新（最小）`。`KEEP v0.15.1` 这种工程串移入 hover/关于页，topbar 不是 git log。
- 边界徽章升级为材质徽章：只读=磨砂灰蓝、混合=实底石墨、运行时写=实底+橙色左缘、配置写=实底+蓝色左缘。徽章文字见 F 节双语方案。
- vibrancy（CSS 模拟）使用边界维持现状：仅 sidebar/topbar/inspector，内容区永不磨砂。token 改名去除"vibrancy"过度声称（P2-7）。

### D2. Mission Control

按 C 节三段式重排。补充细则：

- 阶段轨道是页面唯一允许的"未来感"重点元素：水平五节点（发现→方案→修复→验证→交付），完成节点实心、当前节点 accent 描边 + 标签、未来节点空心。无动画，状态变化时仅 160ms 透明度过渡。
- 每个进行中任务卡只显示四行：任务名 / 当前阶段 / 阻塞或风险（无则不显示该行）/ 下一步。点击展开进 inspector「上下文」tab，不在卡内堆详情。
- "自动执行已开启"误解的防御：焦点区顶部固定一行降饱和说明文字 `仅状态展示 · 不会自动执行 · Read-only`，且任何任务卡上不出现"运行中"这种暗示 UI 在驱动执行的词——用"代理执行中（外部）"。执行控制按钮一个都不放，连 disabled 的都不放（disabled 按钮暗示"将来这里能点"，而 productionization 未批准，诚实的做法是不存在）。
- 冻结项（LOOP-006/007 等）显示为锁形图标 + `冻结中 · 解冻条件：P0 双修复`，把解冻条件写出来，这是对"诚实优先"原则的执行。

### D3. Chat

- Composer 维持现有结构（meta 行 + textarea + 工具行），meta 行中文化：`对话主页 · {model} · 标准模式`。voice 按钮保持 inert，title 改中文 `语音输入未启用`。
- Slash menu → 命令面板形态：上浮居中（非贴 input 的 dropdown）、磨砂背景、命令分组（会话/审批/工具/系统）、每条命令中文说明 + 英文命令名、键盘上下选 + 回车执行。`UNVERIFIED` 当前 CSS 形态，实现归 `UI-CHAT-001`。
- 审批栏强化（对应 P2-3）：命中审批语境时，审批栏用全宽橙色左缘条 + 中文标题 `代理请求审批` + 原文摘录 + 两个按钮 `批准（发送 /approve）` / `拒绝（发送 /deny）`——按钮文案明示动作本质是发消息进 runtime，不伪装成本地开关。正则补中文模式。
- 右栏：reference panel 内容迁入全局 inspector「引用」tab（见 C1），Chat 页内不再自带 aside。
- 中文输入习惯：textarea 默认 `Enter 发送 / Shift+Enter 换行` 需在 placeholder 注明（中文长文本用户最常见的误发场景）；发送后 5 秒内显示 `撤回` （若 backend 支持 abort 早期消息——`UNVERIFIED`，不支持则不做，不伪造撤回）。

### D4. Knowledge Control

目标：从"调试页"变成"本地知识操作系统"，同时绝不暗示可写。

- 看板列首行加列语义中文标签：收件箱/候选/已验证/已链接/过期/归档（对应 inbox→archived 六态），卡片不可拖（维持无 DnD），鼠标悬停显示 `只读看板 · 状态由系统判定`。
- 知识卡四要素固定顺序：标题 / 来源徽章（vault 路径或 ingest 来源）/ 信任态（已验证 ✓ 绿 · 未验证 ○ 灰 · 过期 ⚠ 黄）/ 是否允许进 prompt（`可用于回答` / `禁止用于回答` 实底小标）。`allow_prompt_use` 是用户最该一眼看到的字段，因为它直接决定 AI 会不会引用这条知识。
- 脱敏（对应 P2-4）：inspector 渲染 vault 原文前过本地 secret 探测，命中段落折叠为遮蔽块，点击显示需确认。
- 防"可写"误解：页面任何位置不出现 ingest/上传/新建入口；顶部说明 `录入请前往「知识」页（保留显式写入路径）`，把写入路径指出去而不是藏起来——用户找不到写入口会以为是 bug，明示去处才是克制而非阉割。

### D5. System 组（Settings/Providers/Models/Tools/Schedules/Gateway）

- 统一偏好窗格模板：左分类列 + 右表单区，表单用 macOS 式行布局（标签左、控件右、说明文字小号灰色在下）。
- 危险/写入动作行（删除 provider、trigger cron、stop gateway）右侧控件统一带橙色左缘 + 点击后确认弹层（中文确认语见 G 节）。Schedules 的 trigger 是当前全 app 最危险的一键动作之一，必须有确认 + 显示该 cron 上次运行结果。

## E. 视觉 token 建议

基于现有 `--hp-*` 层做增量（additive，不破坏旧 token），renderer CSS only：

```css
/* 字体（P1-3 修复核心）*/
--hp-font-ui: -apple-system, BlinkMacSystemFont, "PingFang SC",
              "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif;
/* 中文字体显式进栈：macOS 上 -apple-system 已含苹方，
   但显式声明保证 Windows/兜底环境中文渲染不掉到衬线 */
--hp-font-mono: "SF Mono", ui-monospace, "JetBrains Mono", Menlo, monospace;
body { font-family: var(--hp-font-ui); }   /* 替换 var(--font-sans) */

/* 数字等宽（仪器感的关键，成本一行）*/
.hp-numeric { font-variant-numeric: tabular-nums; }

/* 材质三层（边界即材质）*/
--hp-material-readonly: rgba(28, 28, 30, 0.72);   /* 磨砂，原 vibrancy 值 */
--hp-material-solid:    #2c2c2e;                  /* 实底，写入区 */
--hp-material-elevated: #3a3a3c;                  /* 弹层/菜单 */

/* 命名修正（P2-7）：保留旧名 alias 一个版本周期 */
--hp-bg-translucent: var(--hp-material-readonly);
--hp-blur-frosted: blur(20px) saturate(180%);

/* 状态语义（统一全 app 状态视觉词汇，对应问题 7）*/
--hp-state-ok:      #30d158;
--hp-state-warn:    #ff9f0a;
--hp-state-danger:  #ff453a;
--hp-state-frozen:  #64d2ff;   /* 冻结/只读专用冷色，与 danger 区分 */
--hp-state-idle:    rgba(235,235,245,0.3);

/* 危险/写入左缘条 */
--hp-edge-runtime:  3px solid var(--hp-state-warn);
--hp-edge-config:   3px solid var(--hp-accent);

/* 网格与圆角：维持 6/8/10px 圆角与 120/160/200ms 动效，不加新档位 */
/* 间距统一 4px 基数：4/8/12/16/24/32，清理任意值 padding（UI-MACOS-001 内做）*/
```

克制清单（明确不做）：卡片渐变、box-shadow 发光、骨架屏闪烁动画（用静态占位）、hover 缩放、任何 `animation: infinite`。允许的未来感集中投资在：阶段轨道、等宽数字时间戳、命令面板。

## F. 中文文案建议

边界徽章（双语锚点格式 `中文 · English`）：

| 现状 | 建议一级显示 | hover/inspector 补充 |
|---|---|---|
| `read-only · P3` | `只读 · Read-only` | `风险分级 P3 · 无写入接口 · 无新增 IPC` |
| `mixed · P1` | `读写混合 · Mixed` | `含发送/中止/配置写入 · 风险分级 P1` |
| `read_write_runtime` | `可执行 · Runtime` | `本页可触发运行时动作，操作前将要求确认` |
| `config-write` | `配置写入 · Config` | `修改将影响凭据/模型默认值` |

状态词统一表（全 app 唯一来源，对应问题 7）：

| 语义 | 中文 | 颜色 token |
|---|---|---|
| 正常/健康 | 正常 | `--hp-state-ok` |
| 进行中（外部代理） | 执行中（外部） | `--hp-accent` |
| 等待审批 | 待审批 | `--hp-state-warn` |
| 阻塞 | 阻塞 | `--hp-state-warn` |
| 失败 | 失败 | `--hp-state-danger` |
| 冻结 | 冻结 | `--hp-state-frozen` |
| 过期（知识） | 已过期 | `--hp-state-warn` |
| 空闲 | 空闲 | `--hp-state-idle` |

五阶段（沿用 HCC 既定译法，不另起炉灶）：发现 → 方案 → 修复 → 验证 → 交付。

## G. 安全边界文案建议

双层结构（用户可读中文 + 工程英文锚点），英文锚点逐字保留以保护测试：

```
只读模式 · 不会写入 · 未批准生产化
Read-only · No writes · Productionization NOT APPROVED
```

危险动作确认弹层模板（统一全 app）：

```
标题：确认执行「{动作名}」？
正文：{影响范围一句话}。此操作{可/不可}撤销。
辅助：上次执行：{时间 · 结果}（如适用）
按钮：[取消]（默认聚焦） [确认执行]（橙色）
```

四个高频场景实例：

- 删除文件：`删除文件需要人工确认。此操作不可撤销。`
- 安装依赖：`安装依赖会改变运行环境，需审批后执行。`
- 批量修改：`将修改 {n} 个文件。批量修改风险较高，请先确认影响范围。`
- cron 手动触发：`将立即运行「{job}」。上次运行：{时间 · 结果}。`

只读页防误解固定句（Mission/KnowledgeControl/HCC 顶部）：

```
本页仅展示状态，不会自动执行任何操作。
Status display only · No automatic execution
```

审批栏（Chat）：

```
⚠ 代理请求审批
{代理原文摘录}
[批准（发送 /approve）]  [拒绝（发送 /deny）]
说明：按钮将以消息形式发送给代理，不是本地开关。
```

## H. 分阶段 implementation slices

接续既有编号。顺序即优先级；每个 slice：不新增 IPC、不启用 runtime、不改 package/roadmap、先出 preflight 等用户批准、配套测试。

| Slice | 范围 | 改动面 | 测试 | 预估规模 |
|---|---|---|---|---|
| **UI-DOC-SYNC-001**（先行，P1） | 更新 ground truth 为"slices 已部分落地"；登记 Mission/BaiLongma/HCC alias 关系；Reference Stack pin 仓库 URL + 实测 license（含 ClawPanel 双仓库、BaiLongma MIT）；记录 64px 决议；登记 Layout shell 4 个存量 API 进 boundary contract 注释 | 仅文档 + contract 注释 | 无新测试；现有测试不得变红 | 小 |
| **UI-SAFETY-001**（P1） | 只读测试从字符串匹配升级为 import-graph 静态分析；contract 增加 `enforcement` 字段；installUpdate 确认弹层现状核查 | tests + contract 类型 | 新测试本身 + 故意注入 wrapper 调用的负例 fixture | 中 |
| **UI-MACOS-001a**（P1，需批准） | body 字体切 system-first；移除/降级 Google Sans；vibrancy token 改名 + alias | main.css | 截图对比（手动 QA）+ token 存在性测试 | 小 |
| **UI-MACOS-001b** | Mission 三段式重排 + 阶段轨道 + 折叠细节；间距归 4px 网格 | Mission.tsx + CSS | mission readonly 测试维持绿 + 新增"无执行控件（含 disabled）"断言 | 中 |
| **UI-CN-001**（需批准） | 双语徽章、状态词统一表、确认弹层模板组件、只读页固定句 | Layout/badge/各页文案 + 新确认组件 | badge 测试更新英文锚点断言（锚点字符串不变，仅位置/层级变） | 中 |
| **UI-KNOWLEDGE-001** | secret 脱敏遮蔽块 + 假 secret fixture 测试；trust/provenance/allow_prompt_use 卡片四要素；列中文标签 | KnowledgeControl + model | 新增"渲染输出不含 fixture 明文 secret"测试 | 中 |
| **UI-CHAT-001** | 命令面板形态升级；审批栏强化 + 中文正则；reference panel 迁入 inspector「引用」tab；inspector tab 化 | Chat.tsx + Layout.tsx + CSS | chat 现有测试 + 审批正则中文用例 | 大（建议再拆 a/b） |
| UI-ARCHIVE-001（P3） | BaiLongma.tsx / HccCockpit.tsx 引用核查 → 归档至 `_archive/` | 文件移动 + route 测试确认 | grep 零引用 + route 测试绿 | 小 |
| UI-MACOS-NATIVE-001（未来，单独审批） | 原生 vibrancy / titleBarOverlay 评估 | main process —— **本轮禁止** | — | — |

依赖关系：DOC-SYNC-001 必须最先（否则后续 slice 的审批都建立在过期 ground truth 上）；SAFETY-001 先于一切视觉 slice（先把围栏修实再装修）；CHAT-001 依赖 CN-001 的确认组件。

## I. 哪些改动必须先让用户批准

1. **body 字体切换**（UI-MACOS-001a）——全局视觉变化，所有页面观感同时改变，且涉及移除 Google Sans 资产。
2. **任何触碰测试锚点字符串的改动**（UI-CN-001 的徽章层级调整）——英文锚点是流程稳定器，移动位置需逐条确认测试断言同步方案。
3. **Inspector tab 化 / Chat reference panel 迁移**（UI-CHAT-001）——改 Layout.tsx 行为和 `⌥⌘I` 语义，shell 是全局面。
4. **Mission 信息架构重排**（UI-MACOS-001b）——这是你日常看的主状态页，重排前应过一版静态 mock。
5. **BaiLongma.tsx / HccCockpit.tsx 归档**——虽是死代码处理，但它们是设计参考资产，移动需你点头。
6. **screen-boundary-contract.ts 任何字段增加**（enforcement 字段、shell 条目）——contract 是安全事实源，改它等于改宪法附件，建议走与 soul 变更同级的审批。
7. **审批正则修改**（中文模式）——审批栏是安全交互，改探测逻辑前后都要有用例对照。

## J. 哪些内容只适合设计，不应该现在实现

1. **原生 vibrancy / NSVisualEffectView / titleBarOverlay** —— main process 改动，UI-MACOS-NATIVE-001 未来单独审批。
2. **`⌘K` 全局命令面板**（跨页搜索 + 动作调度）—— 动作调度会成为新的 runtime 入口面，与"不新增执行面"冲突；本轮只做 Chat 内 slash 面板的形态升级。
3. **结构化审批消息协议**（审批作为 ACUI event 类型而非正则探测）—— 正确的长期方向，但涉及消息协议/backend 配合，超出 renderer 范围；先在 ACUI 文档里把 `approval.requested` 事件语义设计出来，实现等协议层 slice。
4. **Chat inspector 完整四 tab**（Local Knowledge / Web Sources / Agent Judgment / Tool Progress 各自实时数据）—— Tool Progress 需要新的事件订阅通道，可能触及 IPC；本轮只迁移现有三块静态内容。
5. **消息撤回** —— backend 能力未确认（UNVERIFIED），UI 不得伪造不存在的撤销语义。
6. **Knowledge Control 任何写入/拖拽/live flush UI** —— L6 冻结中，连"预览未来功能"的灰态 UI 都不做（灰态即暗示）。
7. **BaiLongma 焦点栈的实时驱动版**（真实 task/step/focus 事件流渲染）—— 依赖 ACUI runtime，productionization 未批准；本轮 Mission 焦点区用现有只读 API 数据合成展示。
8. **light 模式深度适配** —— dark-first 是既定方向，light 模式维持可用即可，深度打磨延后。

---

## 附：本地验证命令清单（交给 Codex / Claude Code 执行的 UNVERIFIED 项）

```bash
# P3-1 BaiLongma.tsx 引用核查
grep -rn "BaiLongma/BaiLongma" src/ --include="*.ts*"

# P1-3 字体现状确认
grep -n "font-family" src/renderer/src/assets/main.css | head -20
grep -rn "GoogleSans" src/renderer/src/assets/

# P2-5 installUpdate 是否已有确认流
grep -rn "installUpdate" src/renderer/src/ -A 5

# P2-3 审批正则全部使用点
grep -rn "APPROVAL_RE" src/renderer/src/

# Chat slash menu 当前 CSS 形态
grep -n "slash-menu" src/renderer/src/assets/main.css -A 15

# BaiLongma 参考仓库身份确认（对照当初分析记录）
# 候选：https://github.com/xiaoyuanda666-ship-it/BaiLongma (MIT, 338★)
```

## 附：审计包第 16 节要求格式的摘要

```text
审计结论：NEED_FIX

关键发现：
1. [P1] UI Ground Truth 文档漂移（文档说未开始，代码已落地）
   证据：UI-GROUND-TRUTH-2026-06-04 vs HEAD 3f01b31 实际文件清单
   风险：误导后续代理重复实现/误回滚，审批链断裂
   最小修复：UI-DOC-SYNC-001（仅文档）
2. [P1] 只读测试为字符串匹配，wrapper 可绕过
   证据：审计包 6.2 自述 + 补充包第 10 节
   风险：只读声明强度被高估，与已知 P0 缺口同构
   最小修复：UI-SAFETY-001（import-graph 分析 + enforcement 字段）
3. [P1] body 字体 Google Sans 优先，与 spec 系统字体声称矛盾
   证据：main.css --font-sans 首项 + body 引用
   风险：macOS 原生感底层失效 + 字体授权风险（UNVERIFIED）
   最小修复：UI-MACOS-001a（需批准）
4. [P2] ClawPanel 双仓库歧义（AGPL-3.0 vs CC BY-NC-SA 4.0 非商用）
5. [P2] BaiLongma license 信息过时（实测 MIT，待身份确认）
6. [P2] Chat 审批栏正则探测有中文漏报面
7. [P2] KnowledgeControl readVaultFile 无脱敏证据
8. [P2] Layout shell 含合约外存量 API（installUpdate 等）
9. [P2] collapsed 64px vs spec 56px 未记录差异
10.[P2] vibrancy 命名过度声称（CSS 模拟非原生）
11.[P3] BaiLongma.tsx 死代码 / badge P 序数不可解 / 双右栏并存 / HccCockpit POC 残留

文档漂移：
- UI-GROUND-TRUTH 必须更新（P1-1）
- UI-SLICE-0 关于 Knowledge direct gateway 的结论已过期（迁移已完成，测试印证）
- BaiLongma/HCC/Mission alias 关系应写入 ground truth 或新 ADR
- Reference Stack 需 pin URL + 实测 license

macOS 符合度：
- 已符合：分组 sidebar/折叠/快捷键、inspector 骨架、--hp-* token、
  focus-visible、route table、只读边界文案、voice inert
- 不足：body 字体非系统字体（最严重）、Mission 面板墙、inspector 单一用途、
  topbar 非 unified titlebar、CSS 模拟非原生 vibrancy、缺统一状态语言

BaiLongma/HCC/Mission 边界：
- 关系清晰且测试锁定：bailongma/hccCockpit 均为 Mission legacy alias
- Productionization NOT APPROVED 在 ADR/文案/测试三层一致，未见美化
- ACUI 是协议语义层非 runtime，材料表述准确
- 残留：两个历史组件文件建议归档（UI-ARCHIVE-001）

建议下一步 slice（顺序即优先级）：
1. UI-DOC-SYNC-001（先行）
2. UI-SAFETY-001
3. UI-MACOS-001a（需批准）→ 001b
4. UI-CN-001（需批准）
5. UI-KNOWLEDGE-001
6. UI-CHAT-001（建议拆 a/b）
7. UI-ARCHIVE-001
```
