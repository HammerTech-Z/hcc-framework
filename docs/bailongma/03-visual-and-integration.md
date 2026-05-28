# BaiLongma 03 — Visual and Integration

> Status: Draft
> Date: 2026-05-28
> Precedes: 02-acui-protocol.md
> Purpose: Define visual layout, product placement, and integration points for BaiLongma. Layer 3 defines scope only — no implementation.

## 1. Purpose

Layer 3 maps the ACUI protocol (Layer 2) to a visual information architecture and integration surface. It answers:

- Where does BaiLongma live in the Hermes Pro product?
- What does its UI layout look like?
- How do ACUI component commands map to React rendering?
- What is the minimum viable POC scenario?
- What data sources does POC read from?

Layer 3 does not write code, does not add IPC handles, and does not commit to a production implementation timeline.

## 2. Product Placement

### Recommendation: New Independent Top-Level Screen

BaiLongma should be a new top-level screen accessible from the sidebar navigation.

**Integration point**: `src/renderer/src/screens/Layout/Layout.tsx`

```typescript
// Layout.tsx currently has 16 views in the View type:
type View = "chat" | "sessions" | "agents" | "office" | "models"
  | "providers" | "skills" | "soul" | "memory" | "tools"
  | "schedules" | "gateway" | "monitor" | "playbooks" | "understand" | "settings";

// BaiLongma would add a 17th view:
//   | "bailongma"
```

**Recommended icon**: A navigation-appropriate Lucide icon (e.g., `Compass`, `Target`, `Workflow`) — exact choice is a Layer 3 POC decision.

### Why Not Embedded in Existing Screens

| Placement | Reason to Reject |
|-----------|------------------|
| Knowledge | Knowledge is a search/ingest/knowledge-base screen. BaiLongma is task orchestration. The user mental model is different. |
| AgentMonitor | AgentMonitor shows system status, platform states, and cron history. BaiLongma is about user-initiated task flows, not system monitoring. |
| Settings | Settings is for configuration. BaiLongma is an active workspace. |
| Chat | Chat is a messaging interface. BaiLongma is a cockpit with persistent task state. |

**Rationale**: Independent placement preserves module boundaries established in Layer 1 Section 2. Users understand each screen's role. Mixing BaiLongma into existing screens creates UI crowding and conceptual confusion.

## 3. Navigation / React Integration

If a POC proceeds, the following files would be affected. Layer 3 documentation does not modify them.

| File | Change |
|------|--------|
| `src/renderer/src/screens/Layout/Layout.tsx` | Add `bailongma` to `View` type; add to `NAV_ITEMS`; add conditional render pane |
| `src/renderer/src/screens/BaiLongma/BaiLongma.tsx` | New screen component (POC creates this) |
| `src/shared/i18n/locales/` | Add `bailongma` namespace for t() keys |
| `src/renderer/src/assets/main.css` | Add `bailongma-` prefixed CSS classes |

**Constraints**:
- Layout.tsx uses a lazy-mount pattern (`visitedViews` Set) to avoid mounting hidden screens. BaiLongma should follow this pattern.
- CSS class naming: `bailongma-*` prefix to avoid collision with existing `knowledge-*`, `monitor-*`, `schedules-*` classes.

## 4. Visual Model

BaiLongma's UI is organized as a three-column cockpit layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  SIDEBAR NAV                                                     │
│  ...                                                             │
│  [BaiLongma icon] BaiLongma                                     │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┬──────────────────────────────────┬────────────────┐
│  LEFT PANEL  │  CENTER: TASK CANVAS            │  RIGHT PANEL   │
│              │                                  │                │
│  Focus Stack│  ┌────────────────────────────┐  │  Brain UI      │
│  ────────── │  │  Task Header               │  │  ───────────  │
│              │  │  goal / state / timer    │  │                │
│  [f-001] ●  │  └────────────────────────────┘  │  Context      │
│  [f-002]     │                                  │  Events       │
│  [f-003]     │  ┌────────────────────────────┐  │  Artifacts    │
│              │  │  Steps                     │  │  Errors       │
│              │  │  [1] ● query Knowledge  ✓  │  │                │
│              │  │  [2] ● call Understand ◐  │  │                │
│              │  │  [3] ○ save to Vault     │  │                │
│              │  └────────────────────────────┘  │                │
│              │                                  │                │
│              │  [Continue] [Cancel]             │                │
└──────────────┴──────────────────────────────────┴────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  BOTTOM: ACUI Event Log (collapsible drawer)                   │
│  [task.created] [context.gathered] [step.started] ...         │
└─────────────────────────────────────────────────────────────────┘
```

**Panel descriptions**:

| Panel | Content |
|-------|---------|
| Left — Focus Stack | Vertical list of focus frames. Active focus is highlighted. Click to switch. |
| Center — Task Canvas | Current task header, step list with states, action buttons. |
| Right — Brain UI | Context gathered, events timeline, artifacts produced, errors. |
| Bottom drawer | ACUI event log (full raw event stream, collapsible). |

**Relationship to existing screens**:
- AgentMonitor already has a similar 3-column panel layout (summary cards + flywheel/knowledge + events). BaiLongma's layout pattern is consistent with existing Hermes Pro design.
- Knowledge has a tab bar at top. BaiLongma uses a panel layout instead, reflecting its "cockpit" role.

## 5. ACUI → React Mapping

This section maps Layer 2 component commands to their visual effects in the React layer.

### ui_show

**Visual effect**: Component appears in the designated panel position.

**State change**: Component added to a React state map (e.g., `components: Record<string, React.ReactNode>`). Triggers re-render.

**Constraints**:
- `id` becomes the React `key` prop.
- `component` name maps to a registered React component (e.g., `TaskHeader` → `<TaskHeader />`). Component registry is a POC implementation detail.
- `position` in `constraints` maps to panel slot (left/center/right/overlay).

### ui_update

**Visual effect**: Existing component re-renders with new props. No new DOM node.

**State change**: `components[id]` props are merged. Triggers re-render of that subtree only.

**Constraints**:
- `id` must refer to an existing component. Non-existent id is a no-op (no error thrown).
- `constraints.animate` signals that the UI should apply a transition (fade, slide, or highlight) — exact animation is a CSS/UX decision.

### ui_hide

**Visual effect**: Component removed from DOM.

**State change**: `id` removed from `components` map. Triggers re-render.

**Constraints**: No-op if `id` does not exist.

### ui_focus

**Visual effect**: Focus frame highlighted in the Focus Stack panel. Center canvas scrolls to the relevant step if `highlight` contains step ids.

**State change**: `activeFocusId` in React state updates.

**Constraints**: `highlight` is optional. UI may ignore it.

### ui_artifact

**Visual effect**: Artifact card appended to the Artifacts section in the Brain UI panel.

**State change**: `artifacts[]` array appends the new artifact. Triggers re-render.

**Constraints**: Artifacts are append-only in the POC. Edit/delete is out of scope.

## 6. Minimum POC Scenario

**Recommendation**: Cron Failure Diagnosis (Layer 1 Journey 2).

### Why This Scenario

| Factor | Assessment |
|--------|------------|
| Data availability | Local cron jobs status, AgentMonitor APIs, Gateway state already exist |
| IPC dependency | Uses existing handles only — `listCronJobs`, `getCronJobHistory`, `getGatewayState`, `getEvents` |
| Memory | Not required |
| TICK service | Not required |
| Knowledge / Vault | Optional, read-only |
| SQLite | Not required |
| Risk | Lowest among the three journeys |
| User value | High — users already face cron failure diagnosis manually via AgentMonitor |

### POC Scope

1. User opens BaiLongma screen.
2. User sees a list of failed cron jobs (from `listCronJobs` filtered by `state === "error"`).
3. User selects one failed job.
4. BaiLongma reads `getCronJobHistory` (last 5 runs), `getGatewayState` (platform states), `getEvents` (recent events).
5. BaiLongma synthesizes a diagnosis (error type classification) and renders a `DiagnosisCard` component.
6. Diagnosis includes a suggested action (e.g., "reduce push frequency", "check API key").

**Out of POC scope**: Automated fix execution, writing back to cron jobs, Memory writes.

## 7. Integration Boundaries

The following are explicitly **not** in Layer 3 / POC scope:

| Boundary | Reason |
|----------|--------|
| No new IPC handles | Adapter uses existing handles only. Layer 3 documents the boundary; implementation decides if `bailongma:*` domain is needed. |
| No new database tables | POC reads state only. No persistent BaiLongma state. |
| No TICK background service | POC is request-response driven by user action. TICK-aware is a Layer 4+ concern. |
| No Memory SQLite migration | TD-PERSIST-002 proceeds independently. POC may read Memory via existing handles. |
| No automatic resource scanning | BaiLongma respects Hermite Pro's user-authorization model. POC gathers context only when user initiates a task. |
| No social platform distribution | Hermes Pro already has 16 channels. BaiLongma does not manage delivery. |
| No new MCP integration | POC uses existing MCP servers via existing handles. |
| POC is read-only | POC does not write back to cron jobs, Memory, or Vault. |

## 8. Data Sources For POC

POC reads from existing Hermes Pro APIs only:

### Primary (Required)

| Source | IPC / API | Data |
|--------|-----------|------|
| Cron Jobs | `listCronJobs()` → filter by `state` | Job list with schedules, errors |
| Cron History | `getCronJobHistory(limit=5)` | Recent run timestamps, error previews |
| Gateway State | `getGatewayState()` | Platform states, agent count |
| Events Timeline | `getEvents(limit=30)` | Recent system events |

### Secondary (Optional, Read-Only)

| Source | IPC / API | Notes |
|--------|-----------|-------|
| Memory | `readMemory()` | Only if task needs user preferences |
| Knowledge | `knowledgeSearch()` | Only if diagnosis benefits from historical context |
| Vault | `listVaultFiles()` | Only if previous task artifacts are relevant |

### Not Used in POC

- `send-message` / Chat (BaiLongma handles its own task model; Chat remains separate)
- `runPlaybook` / Playbooks (POC does not run playbooks)
- MCP tool execution (POC does not trigger external tools)

## 9. Wireframe

```
┌─────────────────────────────────────────────────────────────────┐
│ [BaiLongma]              [task state badge]    [● gathering]   │
├─────────────┬─────────────────────────────────┬───────────────┤
│ Focus Stack │  Task Canvas                    │  Brain UI     │
│             │                                 │               │
│ ● f-001 ←  │  Goal: 诊断自动化失败            │ Context ────  │
│   f-002    │  ━━━━━━━━━━━━━━━━━━━━━         │ ✓ cron history │
│   f-003    │                                 │ ✓ gateway     │
│             │  Steps                         │ ✓ events       │
│ [push]     │  ┌──────────────────────────┐  │               │
│ [pop]      │  │ [1] gather context    ●  │  Events ─────  │
│             │  │ [2] diagnose error    ○  │  12:05 cron.fail│
│             │  │ [3] suggest action    ○  │  12:03 gateway │
│             │  └──────────────────────────┘  │               │
│             │                                 │ Errors ───── │
│             │  [Start Diagnosis]               │  WeChat rate  │
│             │  [Cancel]                        │  limited      │
├─────────────┴─────────────────────────────────┴───────────────┤
│ ACUI Log  ▼  [task.created] [context.gathered] [step.started]│
└───────────────────────────────────────────────────────────────┘
```

```
Diagnosis View (after selecting a failed cron job):

┌─────────────────────────────────────────────────────────────────┐
│ [BaiLongma]           [● completed]                            │
├─────────────┬─────────────────────────────────┬───────────────┤
│ Focus Stack │  Task Canvas                    │  Brain UI     │
│             │                                 │               │
│ ● f-001 ←  │  Diagnosis: wechat-daily         │ Context ──── │
│             │  ━━━━━━━━━━━━━━━━━━━━━━        │ ✓ 5 cron runs │
│             │                                 │ ✓ platform:   │
│             │  Diagnosis Card                  │   weixin: err  │
│             │  ┌──────────────────────────┐  │               │
│             │  │ ● Error: rate_limited    │  │ Artifacts ─── │
│             │  │   WeChat delivery hit    │  │ diagnosis:    │
│             │  │   iLink daily limit.     │  │ wechat-0528   │
│             │  │                          │  │               │
│             │  │ Suggestion:              │  │               │
│             │  │ • Reduce push frequency  │  │               │
│             │  │ • Check iLink quota      │  │               │
│             │  └──────────────────────────┘  │               │
│             │                                 │               │
│             │  [Open Schedules]  [Dismiss]   │               │
└─────────────┴─────────────────────────────────┴───────────────┘
```

## 10. Open Questions For POC

These questions are out of scope for Layer 3 documentation and require POC implementation experience to answer.

| # | Question | Layer 3 Position |
|---|----------|------------------|
| 1 | Does POC need a `bailongma:*` IPC domain? | Layer 2 deferred this. POC measures adapter complexity. If existing handles suffice, no new domain. If BaiLongma-specific state (task registry, focus stack) needs a home, evaluate after POC. |
| 2 | Does cron diagnosis read job files directly or via existing IPC? | AgentMonitor reads `getCronJobHistory` and `getGatewayState`. If those provide sufficient diagnostic data, no file I/O needed. If file-level logs are needed, evaluate whether to add a new IPC handle or extend an existing one. |
| 3 | Are ACUI events persisted? | POC does not persist. If users need to replay past task runs, Layer 3/4 evaluates whether Vault + session history provide sufficient replay, or whether a separate event store is needed. |
| 4 | Is the focus stack in-memory or persisted? | POC may implement focus stack as React state only. Persistence (for cross-session resume) is a future Layer 3/4 decision. SQLite via existing `state.db` is one option, but not a POC requirement. |
| 5 | Does BaiLongma need its own sidebar icon and route id? | POC may reuse an existing icon (e.g., `Monitor`) to validate user flow before committing to a dedicated icon. A final icon is a cosmetic Layer 3 decision. |
| 6 | How is the React component registry defined? | `ui_show(component: "TaskHeader")` requires a mapping from string name to React component. POC must decide whether to use a simple object map, a registry pattern, or something else. This is an implementation detail not specified in Layer 2. |

Memory SQLite migration (TD-PERSIST-002) and TICK background service are **not** prerequisites for the POC. They proceed on their own timelines.

## Status

Draft — pending review of visual model against existing Hermes Pro design patterns.
