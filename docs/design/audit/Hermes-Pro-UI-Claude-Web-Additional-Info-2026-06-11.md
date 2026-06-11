# Hermes Pro UI 审计补充信息包

生成时间：2026-06-11  
用途：回答 Claude 网页版对 `Hermes-Pro-UI-BaiLongma-macOS-Audit-Pack-2026-06-11.md` 提出的 5 个信息缺口，并补充本地源码证据。  
仓库路径：`/Users/midoudou/hermes-pro`

---

## 0. 给 Claude 网页版的直接答复

你提出的 5 个问题，建议按以下答案继续审计：

1. **源码访问范围：选 A。**  
   请做真实代码级审计。除了上一个审计包，我会补充关键源码/测试。若源码没有完整上传，你可以把缺失项标为 `UNVERIFIED`，但不要仅凭摘要下最终结论。

2. **外部参考项目名单来源：来自 Hermes Pro 本仓库设计文档，不是用户临时追加，也不是审计包凭空生成。**  
   这些名字出现在 `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` 的 Reference Stack / Research-backed Design Requirements 中，包括 Apple HIG、BaiLongma、ClawPanel、Obsidian、darwin-ui、openclaw-nerve、turbovault、claude-obsidian。  
   仍然请你按“可验证引用 / 证据不足 / 可能 AI 幻觉引用”分类核实。ClawPanel 标注 AGPL-3.0，只能借鉴 pattern，不能复制代码；BaiLongma license unknown，只能视觉/概念参考。

3. **中文化策略：建议采用“中文为主 + 关键安全术语保留英文/双语 badge”。**  
   产品面向中文用户，主文案、状态解释、审批/危险动作提示应中文优先；但 `Read-only`、`No writes`、`Productionization NOT APPROVED`、`P0/P1/P2/P3`、`IPC`、`HCC`、`Gateway` 这类工程/安全术语可保留英文或双语，因为它们是现有流程和测试中的稳定锚点。  
   建议输出两层文案：
   - 用户可读：`只读模式 · 不会写入 · 未批准生产化`
   - 工程锚点：`Read-only · No writes · Productionization NOT APPROVED`

4. **vibrancy 实现层：本轮优化默认只允许 renderer CSS 层优化。**  
   可以把 Electron 原生 vibrancy / NSVisualEffectView 作为“未来可选 slice”，但它涉及 main process / BrowserWindow 配置，属于单独审批范围，不应混入当前 UI 设计优化或只读审计结论。

5. **slice 编号体系：建议接续现有建议编号，不新开大系列。**  
   继续使用审计包里的：
   - `UI-DOC-SYNC-001`
   - `UI-SAFETY-001`
   - `UI-MACOS-001`
   - `UI-KNOWLEDGE-001`
   如需新增 Chat，可用 `UI-CHAT-001`；如需中文化，可用 `UI-CN-001`。每个 slice 必须小、可审计、可测试。

---

## 1. 建议上传给 Claude 网页版的源码文件

如果 Claude 网页版支持上传多个文件，请优先上传这些：

### 必传

- `src/renderer/src/screens/Chat/Chat.tsx`
- `src/renderer/src/assets/main.css`
- `src/renderer/src/screens/Layout/Layout.tsx`
- `src/renderer/src/screens/Layout/layout-routes.tsx`
- `src/shared/lib/screen-boundary-contract.ts`
- `src/preload/index.ts`
- `src/main/knowledge-ipc-handlers.ts`
- `src/main/knowledge-ipc-gateway-adapter.ts`

### UI 边界测试

- `tests/mission-control-readonly.test.ts`
- `tests/hcc-cockpit-readonly.test.ts`
- `tests/knowledge-control-readonly.test.ts`
- `tests/layout-route-table.test.ts`
- `tests/layout-boundary-badge.test.ts`
- `tests/ui-polish-a11y.test.ts`
- `tests/knowledge-ipc-closeout-audit.test.ts`

### 重点页面

- `src/renderer/src/screens/Mission/Mission.tsx`
- `src/renderer/src/screens/HccCockpit/HccCockpit.tsx`
- `src/renderer/src/screens/BaiLongma/BaiLongma.tsx`
- `src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx`
- `src/renderer/src/screens/KnowledgeControl/knowledge-control-model.ts`

---

## 2. Chat.tsx 本地证据摘要

文件：`src/renderer/src/screens/Chat/Chat.tsx`  
长度：1267 行。

### 2.1 Chat 已有 BaiLongma-inspired / command palette 相关实现

Chat imports:

```ts
import {
  Trash2 as Trash,
  Send,
  Square as Stop,
  Plus,
  ChevronDown,
  Search,
  Clock,
  Mail,
  Code,
  ChartLine,
  Bell,
  Slash,
  Zap,
  Mic,
  PanelRight,
  Maximize2,
  Minimize2,
  Database,
  Globe2,
  ShieldCheck,
  X,
} from "lucide-react";
```

Slash commands include:

- `/new`
- `/clear`
- `/btw`
- `/approve`
- `/deny`
- `/status`
- `/reset`
- `/compact`
- `/undo`
- `/retry`
- `/fast`
- `/compress`
- `/usage`
- `/debug`
- `/web`
- `/image`
- `/browse`
- `/code`
- `/file`
- `/shell`
- `/help`
- `/tools`
- `/skills`
- `/model`
- `/memory`
- `/persona`
- `/version`

注意：有些 slash commands 是发给 backend 的 agent/tool commands，不代表 UI 自己执行 shell/file 操作。Claude 审计时应区分“命令文本进入 agent runtime”和“renderer 直接执行危险动作”。

### 2.2 Approval bar

源码中有：

```ts
const APPROVAL_RE =
  /⚠️.*dangerous|requires? (your )?approval|\/approve.*\/deny|do you want (me )?to (proceed|continue|run|execute)/i;
```

并有 `onApprove` / `onDeny`，调用：

- `sendMessage("/approve", ...)`
- `sendMessage("/deny", ...)`

审计点：这属于 chat runtime path，不是只读页面。UI 文案应清楚说明审批动作会进入 agent conversation/runtime。

### 2.3 Chat references panel

Chat 有右侧 reference panel：

```tsx
{referencesOpen && (
  <aside className="chat-reference-panel">
    ...
    Local Knowledge ... standby ... No live flush
    Web Sources ... manual ... Verify on request
    Agent Judgment ... running/idle ... Read-only UI state
  </aside>
)}
```

这说明 Chat 右侧 inspector/reference 概念已部分落地，但不是全局 `shell-inspector` 的 tab 化内容，也不是完整 Local Knowledge/Web Sources/Agent Judgment/Tool Progress 四 tab。

### 2.4 Voice placeholder 是 inert

Chat composer 中：

```tsx
<button
  type="button"
  className="chat-voice-btn"
  disabled
  title="Voice entry is not enabled"
  aria-label="Voice entry placeholder"
>
  <Mic size={15} />
</button>
```

结论：voice placeholder 当前是 disabled/inert。

### 2.5 Composer / command palette

Chat composer 片段：

```tsx
<div className="chat-composer-shell">
  <div className="chat-composer-meta">
    <span>Chat Home</span>
    <span>{displayModel}</span>
    <span>{fastMode ? "fast" : "standard"}</span>
  </div>
  <div className="chat-input-wrapper">
    <textarea ... />
    ...
  </div>
</div>
```

Slash menu 片段：

```tsx
{slashMenuOpen && filteredSlashCommands.length > 0 && (
  <div className="slash-menu" ref={slashMenuRef}>
    <div className="slash-menu-header">
      <Slash size={12} />
      Command Palette
    </div>
    ...
  </div>
)}
```

审计点：设计上有 command palette，但要看 CSS 才能判断是否真的“macOS command palette / frosted / centered / keyboard-first”，还是普通 dropdown。

### 2.6 Chat 中存在写/运行时 API

Chat 会调用：

- `setModelConfig`
- `setConfig`
- `sendMessage`
- `abortChat`

因此 Chat 不是 read-only surface；它是 `mixed · P1` 合理。

---

## 3. main.css 本地证据摘要

文件：`src/renderer/src/assets/main.css`  
长度：8775 行。

### 3.1 Token 层

已有 additive `--hp-*` tokens：

```css
--hp-bg-base: #1c1c1e;
--hp-bg-surface: #2c2c2e;
--hp-bg-surface-2: #3a3a3c;
--hp-bg-elevated: #48484a;
--hp-bg-vibrancy: rgba(28, 28, 30, 0.72);
--hp-label: #ffffff;
--hp-label-secondary: rgba(235, 235, 245, 0.6);
--hp-label-tertiary: rgba(235, 235, 245, 0.3);
--hp-label-quaternary: rgba(235, 235, 245, 0.18);
--hp-accent: #0a84ff;
--hp-success: #30d158;
--hp-warning: #ff9f0a;
--hp-danger: #ff453a;
--hp-divider: rgba(84, 84, 88, 0.65);
--hp-blur-vibrancy: blur(20px) saturate(180%);
```

Light theme 也有对应 `--hp-*`。

### 3.2 字体现实

CSS 仍加载 Google Sans：

```css
@font-face {
  font-family: "Google Sans";
  src: url("./fonts/GoogleSans-Regular.ttf") format("truetype");
}
```

全局 font stack：

```css
--font-sans:
  "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  sans-serif;
```

同时新增 hp font：

```css
--hp-font-ui:
  -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui,
  sans-serif;
```

审计点：虽然 `--hp-font-ui` 是 system-first，但 `body` 仍使用 `var(--font-sans)`，即 Google Sans 优先。Claude 应判断这是否削弱 macOS 原生感。

### 3.3 Sidebar / Inspector CSS

sidebar：

```css
.sidebar {
  width: 236px;
  background: var(--hp-bg-vibrancy, var(--bg-secondary));
  backdrop-filter: var(--hp-blur-vibrancy, none);
  border-right: 1px solid var(--hp-divider, var(--border));
}

.layout-sidebar-collapsed .sidebar {
  width: 64px;
}
```

注意：设计 spec 说 collapsed 目标约 56px；当前实现是 64px。不是一定 bug，但属于实现差异。

inspector：

```css
.shell-inspector {
  width: 0;
  opacity: 0;
  background: var(--hp-bg-vibrancy, var(--bg-secondary));
  backdrop-filter: var(--hp-blur-vibrancy, none);
}

.layout-inspector-open .shell-inspector {
  width: 280px;
  opacity: 1;
  border-left: 1px solid var(--hp-divider, var(--border));
}
```

### 3.4 视觉审计提示

当前是 CSS `backdrop-filter` 模拟，不是 Electron 原生 vibrancy。请不要把它描述成 NSVisualEffectView/native vibrancy 已实现。

---

## 4. Layout / Shell 本地证据摘要

文件：`src/renderer/src/screens/Layout/Layout.tsx`  
长度：412 行。

已实现：

- `sidebarCollapsed`
- `inspectorOpen`
- grouped nav：Work / Knowledge / Agents / System
- shortcut：
  - `⌘\` toggle sidebar
  - `⌥⌘I` toggle inspector
- dynamic boundary badge：
  - `buildBoundaryBadgeDescriptor`
  - `buildBoundaryBadgeTitle`
  - `getScreenBoundaryContract`
- status strip：
  - boundary badge
  - `KEEP v0.15.1`
  - `profile: ...`
  - inspector toggle

重要注意：

- Layout 仍有 auto-update actions：
  - `downloadUpdate`
  - `installUpdate`
- Layout 仍有 chat/session actions：
  - `abortChat`
  - `getSessionMessages`
- 这些不是新增 UI redesign runtime，但 Claude 审计时不要把 Layout 误判为完全 read-only。

---

## 5. Knowledge IPC 迁移本地证据

### 5.1 preload/index.ts

文件：`src/preload/index.ts`

知识相关方法当前是 IPC invoke：

```ts
knowledgeSearch: (query: string, limit = 10) =>
  ipcRenderer.invoke("knowledge-search", { query, limit }),

knowledgeIngest: (title: string, content: string) =>
  ipcRenderer.invoke("knowledge-ingest", { title, content }),

getGbrainStats: () =>
  ipcRenderer.invoke("knowledge-stats", {}),
```

### 5.2 main handler / adapter

`src/main/knowledge-ipc-handlers.ts` registers:

- `knowledge-search`
- `knowledge-ingest`
- `knowledge-stats`

并通过 injected gateway client dispatch。

`src/main/knowledge-ipc-gateway-adapter.ts` maps:

- `knowledge-search` -> `GET /knowledge/search`
- `knowledge-ingest` -> `POST /knowledge/ingest`
- `knowledge-stats` -> `GET /knowledge/stats`

注意：这意味着 preload direct raw gateway URL 已迁移为 IPC bridge，但 main 层仍会通过 gateway adapter 访问知识服务。这是架构迁移，不是“没有 gateway 依赖”。

### 5.3 contract / tests

`src/shared/lib/screen-boundary-contract.ts`：

- Knowledge Control：
  - `boundary_kind: "read_only"`
  - APIs：`getGbrainStats`, `getVaultStats`, `knowledgeSearch`, `listVaultFiles`, `readVaultFile`
  - `direct_gateway_methods: []`
  - `migrated_ipc_methods: ["knowledgeSearch", "getGbrainStats"]`
- Knowledge：
  - `boundary_kind: "mixed"`
  - includes `knowledgeIngest` write path
  - `direct_gateway_methods: []`
  - `migrated_ipc_methods: ["knowledgeSearch", "knowledgeIngest", "getGbrainStats"]`

`tests/knowledge-ipc-closeout-audit.test.ts` verifies:

- preload no longer contains raw `/knowledge` gateway URL
- preload uses `ipcRenderer.invoke` for all 3 knowledge channels
- Knowledge/KnowledgeControl have no active direct_gateway_methods
- Knowledge remains write-capable for `knowledgeIngest`

审计点：Claude 应确认“IPC bridge active”不等于“knowledgeIngest 安全无风险”；它仍是 write path，只是不再由 preload 直接 raw fetch。

---

## 6. 外部参考项目来源说明

Claude 之前说“审计包正文里一个都没出现”，这不准确或至少不完整：上一份审计包的第 2 节和第 14 节提到了部分来源，而完整名单确实来自本仓库设计文档：

`docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` 中 `Reference Stack` 包含：

- Apple macOS / HIG
- BaiLongma
- ClawPanel
- Hermes Kanban
- Obsidian
- darwin-ui
- openclaw-nerve
- turbovault
- claude-obsidian
- awesome-design-md

同一文档还写明：

- `ClawPanel AGPL-3.0 → design pattern reference only, zero code copy`
- `BaiLongma license unknown → visual/conceptual reference only, no code copy`

因此，请按“设计文档引用核实”处理，不要按“用户临时让你顺带调研”处理。若 GitHub 找不到某个项目或名字对应多个项目，请标为证据不足/可能 AI 幻觉引用。

---

## 7. 中文化策略建议

推荐策略：**中文为主 + 关键安全/工程术语保留英文或双语**。

原因：

- 目标用户是中文用户，任务、审批、危险动作、下一步应中文可读。
- Hermes Pro 当前流程中已有稳定英文安全锚点：
  - `Read-only`
  - `No writes`
  - `Productionization NOT APPROVED`
  - `No new IPC`
  - `P0/P1/P2/P3`
  - `HCC`
  - `Gateway`
  - `IPC`
- 如果完全中文化，可能破坏测试锚点和工程边界词。

推荐 badge 文案形态：

- `只读 · Read-only`
- `不写入 · No writes`
- `未批准生产化 · Productionization NOT APPROVED`
- `运行时写入 · Runtime-write`
- `配置写入 · Config-write`
- `需人工审批 · User approval required`

推荐危险动作中文心智：

- 删除文件：`删除文件需要人工确认`
- 安装依赖：`安装依赖会改变环境，需审批`
- 跨文件批量修改：`批量修改风险较高，请先确认影响范围`
- 自动执行：`当前只展示状态，不会自动执行`

---

## 8. Vibrancy / macOS 实现层建议

当前默认边界：**renderer CSS 层优化**。

允许建议：

- 优化 `--hp-*` tokens
- 调整 `main.css`
- 调整 sidebar/inspector/topbar/card spacing
- 调整 font stack，让 body 更 system-first
- 增加视觉/a11y tests

不要直接建议本轮实现：

- Electron `BrowserWindow` vibrancy
- NSVisualEffectView
- titleBarOverlay / traffic-light 深度改造
- main process window config 改动

这些可以作为未来 slice：

- `UI-MACOS-NATIVE-001`: evaluate native vibrancy/titlebar integration

并且必须单独审批，因为会触及 main process / desktop window 行为。

---

## 9. Slice 编号建议

沿用上一份审计包建议，避免新开混乱体系：

- `UI-DOC-SYNC-001`：同步 UI ground truth 与当前本地实现
- `UI-SAFETY-001`：加强只读/危险动作测试，不只依赖简单字符串
- `UI-MACOS-001`：renderer-only macOS polish，CSS/token/layout
- `UI-KNOWLEDGE-001`：Knowledge Control redaction/trust/provenance UI hardening
- `UI-CHAT-001`：Chat composer / command palette / reference inspector polish
- `UI-CN-001`：中文为主 + 双语安全锚点文案

每个 slice 原则：

- 小范围
- 可测试
- 不新增 IPC
- 不启用 runtime
- 不改 package
- 不改 roadmap
- 不 commit/push，先出 preflight 等用户批准

---

## 10. 仍建议 Claude 标为 UNVERIFIED 的点

如果未上传完整文件，请标为 `UNVERIFIED`：

- Chat CSS 是否真正像 macOS command palette，而非 dropdown。
- 页面实际视觉效果是否符合 macOS，需要截图或运行 app 才能确认。
- 是否存在 helper/wrapper 间接调用 runtime APIs，静态字符串测试无法完全证明。
- 所有外部参考项目在 GitHub 上的具体 license 和真实性。
- BaiLongma 公开项目来源，如果找不到，应标记为 repo-local concept 或证据不足。

---

## 11. 本文件没有做的事

- 没有修改 Hermes Pro 仓库源码。
- 没有运行测试。
- 没有运行 dev server。
- 没有 commit。
- 没有 push。
- 没有写 `~/.hermes/*`。

本文件只是给 Claude 网页版补充本地事实和审计输入。
