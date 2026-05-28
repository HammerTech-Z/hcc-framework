# BaiLongma 02 — ACUI Protocol

> Status: Draft
> Date: 2026-05-28
> Precedes: 01-scope-and-role.md
> Purpose: Define the Agent-Computer/User Interface protocol for BaiLongma.

## 1. Purpose

ACUI (Agent-Computer/User Interface) is the protocol through which BaiLongma expresses tasks, steps, components, states, artifacts, and errors to both the user and the underlying Hermes Pro modules.

ACUI is not a rendering layer. It defines message contracts — what BaiLongma says, in what format, at what point in a task lifecycle — so that:

- The React UI can render a consistent task cockpit.
- The BaiLongma adapter can call existing Hermes Pro capabilities (via IPC) without owning those capabilities.
- Error states are expressed uniformly.

## 2. Non-Goals

ACUI does not:

- Replace Electron IPC. IPC remains the underlying transport between renderer and main process. ACUI messages travel over IPC but do not redefine it.
- Replace MCP. MCP is the external tool connection layer. BaiLongma may select MCP tools but does not manage MCP protocol.
- Replace React state management. Individual screens manage their own React state. ACUI is a data format contract, not a state management library.
- Directly specify visual styles. CSS, layout, animation, and color are UI layer decisions. ACUI only describes the semantic content being displayed.
- Define a new IPC domain. Layer 2 does not introduce `bailongma:*` IPC handles. This question is deferred to Layer 3 or POC.

## 3. Relationship With Existing IPC

Current state: Hermes Pro exposes approximately 114 IPC handle channels across main/index.ts, covering:

| Domain | Example Handles |
|--------|----------------|
| Installation | `check-install`, `verify-install`, `start-install` |
| Configuration | `get-config`, `set-config`, `get-env`, `set-env` |
| Chat / Gateway | `send-message`, `start-gateway`, `gateway-status` |
| Memory | `read-memory`, `add-memory-entry`, `write-user-profile` |
| Sessions | `list-sessions`, `get-session-messages`, `search-sessions` |
| Cron Jobs | `list-cron-jobs`, `create-cron-job`, `pause-cron-job` |
| Knowledge | `knowledgeSearch` (HTTP direct), `knowledgeIngest` (HTTP direct) |
| Vault | `list-vault-files`, `read-vault-file`, `get-vault-stats` |
| AgentMonitor | `get-gateway-state`, `get-events`, `get-cron-job-history` |
| Models / MCP | `list-models`, `list-mcp-servers`, `test-mcp-server` |
| Understand | `understand-anything`, `list-understanding-history` |

These IPC handles continue as the stable capability interface. The BaiLongma adapter is a new layer above them — it decides *when* and *how* to call these capabilities, but does not replace them.

Layer 2 commitment: **No new IPC handles are introduced by ACUI.** The adapter calls existing handles. Layer 3 or POC may evaluate whether a `bailongma:*` IPC domain is needed for BaiLongma-specific state (task registry, focus stack, artifact storage). This decision is out of scope for Layer 2.

## 4. Core Concepts

### Task

A unit of work initiated by the user or by a cron trigger. A task has a goal, a lifecycle, and produces artifacts.

```
Task {
  id: string          // stable identifier
  goal: string        // natural language goal
  focus_id: string    // current focus frame
  state: TaskState
  created_at: number  // unix ms
  updated_at: number
}
```

### Step

A discrete action within a task. A step calls a specific Hermes Pro capability.

```
Step {
  id: string
  task_id: string
  label: string
  module: string      // which Hermes Pro module is called (e.g. "Knowledge", "Understand")
  command: string     // which ACUI command (e.g. "ui_show", "ui_update")
  state: StepState
  started_at?: number
  completed_at?: number
  error?: Error
}
```

### Focus

An attention frame within a task. Supports nested sub-tasks (see Layer 1 Section 6.1 "焦点栈"). A task has one active focus at a time.

```
Focus {
  id: string
  task_id: string
  parent_id?: string  // for nested focuses
  label: string
  depth: number       // 0 = root focus
  created_at: number
}
```

### Context

The collection of information gathered before or during a step. Context is assembled from Hermes Pro modules and presented to the model for decision-making.

```
Context {
  focus_id: string
  gathered_from: string[]  // module names used
  items: ContextItem[]
}

ContextItem {
  source: string    // e.g. "Knowledge", "Memory", "Vault"
  type: string      // e.g. "search_result", "memory_entry", "file"
  content: unknown  // structured content
}
```

### Component

A UI element rendered by the React layer based on ACUI messages. Components are not defined by ACUI — ACUI only names and payloads them.

### Artifact

A persistent output from a step. Artifacts are stored in Vault or referenced in Memory.

```
Artifact {
  id: string
  task_id: string
  step_id: string
  type: string        // e.g. "summary", "file", "memory_suggestion"
  uri?: string       // path to Vault file, if applicable
  summary: string    // short human-readable summary
  metadata: Record<string, unknown>
}
```

### Event

A timestamped signal emitted by BaiLongma during task execution. Events flow from BaiLongma to the UI.

```
Event {
  task_id: string
  focus_id: string
  type: EventType
  timestamp: number
  payload: unknown
}
```

Event types: `task.created`, `task.state_changed`, `step.started`, `step.completed`, `step.failed`, `focus.pushed`, `focus.popped`, `focus.compressed`, `artifact.created`, `error`.

### Error

A structured error within a step or task. See Section 8 for the error type taxonomy.

## 5. Protocol Envelope

Every ACUI message carries a common envelope:

```typescript
interface ACUIMessage {
  version: "1.0";
  task_id: string;
  focus_id: string;
  type: MessageType;
  timestamp: number;  // unix ms
  payload: unknown;
}

type MessageType =
  | "component.command"   // ui_show, ui_update, ui_hide, ui_focus, ui_artifact
  | "task.state_change"
  | "step.state_change"
  | "event"
  | "error"
  | "context.gathered"
  | "focus.push"
  | "focus.pop"
  | "focus.compress";
```

The envelope is serialized as JSON. In the Electron context, ACUI messages travel via IPC (`ipcRenderer.invoke` for request/response) and `webContents.send` for push events. The specific IPC channel names are a Layer 3 / POC concern — Layer 2 only defines the envelope format.

## 6. Component Commands

Component commands are the primary mechanism by which BaiLongma drives the UI. Each command names a component, declares what to show, and carries constraints.

### 6.1 ui_show

Instruct the UI to render a new component.

```
{
  command: "ui_show",
  component: string,          // e.g. "TaskHeader", "StepList", "ContextPanel"
  id: string,                 // stable component instance id
  props: Record<string, unknown>,  // component-specific data
  constraints?: {
    position?: "header" | "sidebar" | "main" | "overlay",
    removable?: boolean,
    priority?: number,         // for ordering
  }
}
```

**Constraint**: `id` must be stable across re-renders. The UI maps `id` to a React component key.

### 6.2 ui_update

Instruct the UI to update an existing component by id.

```
{
  command: "ui_update",
  id: string,
  props: Record<string, unknown>,
  constraints?: {
    animate?: boolean,
  }
}
```

**Constraint**: `id` must already be rendered (via `ui_show`). Updates to non-existent ids are ignored.

### 6.3 ui_hide

Instruct the UI to remove a component.

```
{
  command: "ui_hide",
  id: string,
  reason?: string
}
```

**Constraint**: Does not error if id does not exist.

### 6.4 ui_focus

Instruct the UI to bring a focus frame into the active viewport.

```
{
  command: "ui_focus",
  focus_id: string,
  highlight?: string[]   // step ids to highlight
}
```

This corresponds to the "焦点栈" concept from Layer 1. The UI decides how to represent focus frames visually (tabs, breadcrumbs, a stack widget).

### 6.5 ui_artifact

Instruct the UI to display a task artifact.

```
{
  command: "ui_artifact",
  artifact: Artifact,
  preview?: {
    label: string,
    content: string,
  }
}
```

The UI decides how to render artifacts (card, file icon, inline preview).

## 7. Task Lifecycle

```
created → gathering_context → planning → running → waiting_for_user → completed
                                                              ↘ failed
                                                              ↘ cancelled
```

| State | Meaning |
|-------|---------|
| `created` | Task initialized, no context gathered yet |
| `gathering_context` | Context collector running (Knowledge, Vault, Memory) |
| `planning` | Model deciding step sequence based on context |
| `running` | Steps executing |
| `waiting_for_user` | Task blocked on user input or confirmation |
| `completed` | All steps done, artifacts produced |
| `failed` | A step error was not recoverable |
| `cancelled` | User or system cancelled the task |

State transitions are emitted as `task.state_changed` events via the envelope.

Transitions into `waiting_for_user` must include `payload.reason` (string) so the UI can render an appropriate prompt.

## 8. Error Model

Errors are scoped to a step and carry a type code:

```typescript
interface ACUIError {
  code: ErrorCode;
  message: string;
  step_id?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

type ErrorCode =
  | "insufficient_context"    // context gathering returned < threshold results
  | "tool_unavailable"        // MCP or IPC tool not available
  | "ipc_failure"              // IPC call returned error
  | "user_cancelled"           // user interrupted the step or task
  | "model_error"              // LLM call failed (timeout, 500, etc.)
  | "permission_required"      // credential missing or expired
  | "rate_limited";            // platform rate limit hit (WeChat, etc.)
```

**Constraint**: `recoverable = false` errors trigger a `task.state_changed` to `failed`. `recoverable = true` errors leave the task in `running` with the step in a `failed` sub-state.

Error codes are not exhaustive. Layer 3 may add more codes as POC reveals additional failure modes.

## 9. Examples

### Example 1: Research Topic Task

**User input**: "研究 AI Agent 自改进的最近进展"

**Request** (BaiLongma → adapter → IPC):
```
invoke: knowledgeSearch("AI Agent self-improvement recent advances", limit=10)
invoke: readMemory(profile?)
```

**Context gathered**:
```json
{
  "type": "context.gathered",
  "task_id": "t-001",
  "focus_id": "f-001",
  "payload": {
    "items": [
      { "source": "Knowledge", "type": "search_result", "content": { "score": 0.92, "preview": "..." } },
      { "source": "Memory", "type": "memory_entry", "content": { "text": "user interested in LLM agents" } }
    ]
  }
}
```

**Component commands emitted**:
```json
{ "command": "ui_show", "component": "TaskHeader", "id": "h-001", "props": { "title": "研究选题" } }
{ "command": "ui_show", "component": "ContextPanel", "id": "ctx-001", "props": { "items": [...] } }
{ "command": "ui_show", "component": "StepList", "id": "steps-001", "props": { "steps": [{ "label": "查询 Knowledge", "state": "completed" }, { "label": "调用 Understand", "state": "running" }] } }
```

**Artifact produced**:
```json
{
  "command": "ui_artifact",
  "artifact": { "id": "a-001", "task_id": "t-001", "step_id": "s-002", "type": "summary", "uri": "~/.hermes/vault/research-2026-05-28.md", "summary": "AI Agent 自改进研究摘要" }
}
```

---

### Example 2: Cron Failure Diagnosis

**Trigger**: User selects a failed cron job from Schedules.

**Context gathering**:
```
invoke: listCronJobs() → find job.id = "wechat-daily"
invoke: getCronJobHistory(limit=5) → get recent runs
invoke: getGatewayState() → check platform states
invoke: readMemory("cron patterns")? → optional
```

**Diagnostic output**:
```json
{
  "type": "task.state_changed",
  "payload": {
    "task_id": "t-002",
    "state": "completed",
    "artifacts": [
      { "id": "a-002", "type": "diagnosis", "summary": "WeChat delivery rate limited — 超过 iLink 每日限额" }
    ]
  }
}
```

**Component commands**:
```json
{ "command": "ui_show", "component": "DiagnosisCard", "id": "diag-001", "props": { "type": "rate_limited", "message": "超过 iLink 每日限额", "suggestion": "降低推送频率或申请更高配额" } }
{ "command": "ui_show", "component": "ActionList", "id": "actions-001", "props": { "items": [{ "label": "调整 cron schedule", "action": "open_schedules" }, { "label": "查看 iLink 配额", "action": "open_external" }] } }
```

---

### Example 3: Self-Improvement Retrospective

**User input**: "自改进复盘：上次任务"

**Context gathering**:
```
invoke: getSessionMessages(last_session_id) → session history
invoke: listVaultFiles(recent) → artifacts from last task
invoke: readMemory("improvement_suggestions")? → prior suggestions
```

**Retrospective output**:
```json
{
  "type": "context.gathered",
  "payload": {
    "items": [
      { "source": "Sessions", "type": "conversation", "content": { "role": "assistant", "content": "..." } },
      { "source": "Vault", "type": "artifact", "content": { "summary": "研究报告" } },
      { "source": "Memory", "type": "preference", "content": { "text": "prefer concise summaries" } }
    ]
  }
}
```

**Component commands**:
```json
{ "command": "ui_show", "component": "RetrospectiveSummary", "id": "retro-001", "props": { "steps": [...], "good": [...], "improve": [...] } }
{ "command": "ui_show", "component": "MemorySuggestion", "id": "mem-suggest-001", "props": { "text": "建议写入：AI Agent 自改进方向包括 tool-use 和 memory integration", "confirm_label": "写入 Memory" } }
```

**Memory write confirmation** (user action):
```json
{ "command": "ui_update", "id": "mem-suggest-001", "props": { "state": "confirmed" } }
invoke: addMemoryEntry("AI Agent 自改进方向...", profile?)
```

## 10. Open Questions For Layer 3

These questions are intentionally out of scope for Layer 2. They require POC implementation experience to answer.

| # | Question | Why Layer 3 |
|---|----------|-------------|
| 1 | Does BaiLongma need a new IPC domain (`bailongma:*`)? | Requires measuring adapter complexity. If the adapter must track BaiLongma-specific state (task registry, focus stack) that no existing IPC handle serves, a new domain may be justified. If existing handles suffice, do not add one. |
| 2 | How do ACUI components map to React components? | Layer 2 defines the component names and props shape. The actual React component library (component names, CSS classes, state management) is a Layer 3 UI decision. |
| 3 | Does TICK-aware require a background service? | Layer 1 reserves the option. Layer 3 POC must evaluate whether Electron background processes or the existing cron scheduler (with adjusted intervals) satisfies the TICK requirement. |
| 4 | Does the focus stack persist to SQLite? | Current Memory is file-based (MEMORY.md). The focus stack is an in-memory BaiLongma concept. If it needs persistence (for resume across restarts), SQLite via the existing `state.db` may be appropriate — but this decision is independent of the Memory SQLite migration (TD-PERSIST-002) and is not a prerequisite for BaiLongma. |
| 5 | Does the ACUI event log need persistence? | If users need to inspect past task runs (for debugging or audit), ACUI events may need a storage strategy. Layer 3 POC should evaluate whether Vault + session history provide sufficient replay capability. |

Memory SQLite migration (TD-PERSIST-002) is **not** a prerequisite for BaiLongma. It proceeds on its own tech-debt timeline.

## Status

Draft — pending review against Hermes Pro codebase architecture.
