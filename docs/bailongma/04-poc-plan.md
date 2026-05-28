# BaiLongma 04 — POC Plan

> Status: Draft
> Date: 2026-05-28
> Precedes: 03-visual-and-integration.md
> Purpose: Define the minimum viable proof-of-concept for BaiLongma.

## 1. Purpose

This document defines the scope, goals, and approach for a BaiLongma proof-of-concept. The POC validates the Layer 2 ACUI protocol and Layer 3 integration plan against real Hermes Pro APIs before committing to a full implementation.

The POC is a **validation instrument**, not a product preview. It may be discarded after validation.

## 2. POC Goal

Validate that the cron failure diagnosis workflow (Layer 1 Journey 2) can be expressed through the ACUI protocol using existing Hermes Pro APIs only.

**Specific validation questions**:

1. Can ACUI component commands (`ui_show`, `ui_update`) drive a task cockpit UI from real Hermes Pro state?
2. Does the existing `listCronJobs`, `getCronJobHistory`, `getGatewayState`, `getEvents` API surface provide sufficient diagnostic data?
3. Can the Layer 3 visual model (3-column cockpit) be rendered in React without new IPC handles?
4. Does the Focus Stack concept add value over a flat step list for this scenario?

**Out of scope for POC**: Writing back to cron jobs, Memory writes, Vault writes, automated fix execution.

## 3. User Story

As a Hermes Pro maintainer, I want to open BaiLongma, select a failed cron job, and receive an immediate error classification with suggested actions — without manually switching between AgentMonitor, Schedules, and chat.

**Acceptance criteria**:
- [ ] BaiLongma screen accessible from sidebar
- [ ] Failed cron jobs listed with error type
- [ ] Selecting a job triggers context gathering (via existing IPC)
- [ ] Diagnosis card renders with error classification
- [ ] Suggested action buttons visible
- [ ] Step list shows states (gathering, diagnosing, completed)
- [ ] No new IPC handles introduced

## 4. Technical Scope

### 4.1 Files Created

| File | Purpose |
|------|---------|
| `src/renderer/src/screens/BaiLongma/BaiLongma.tsx` | Main screen component |
| `src/renderer/src/screens/BaiLongma/types.ts` | ACUI type definitions (from Layer 2) |
| `src/renderer/src/components/BaiLongma/TaskHeader.tsx` | Task header component |
| `src/renderer/src/components/BaiLongma/StepList.tsx` | Step list component |
| `src/renderer/src/components/BaiLongma/FocusStack.tsx` | Focus stack panel |
| `src/renderer/src/components/BaiLongma/BrainPanel.tsx` | Brain UI panel |
| `src/renderer/src/components/BaiLongma/DiagnosisCard.tsx` | Diagnosis output component |
| `src/renderer/src/components/BaiLongma/ACUIEventLog.tsx` | Event log drawer |
| `src/renderer/src/hooks/useACUI.ts` | ACUI state management hook |

### 4.2 Files Modified

| File | Change |
|------|--------|
| `src/renderer/src/screens/Layout/Layout.tsx` | Add `bailongma` view; add to NAV_ITEMS; conditional render pane |
| `src/renderer/src/assets/main.css` | Add `bailongma-*` CSS classes |
| `src/shared/i18n/locales/zh-CN/constants.ts` | Add bailongma navigation label |
| `src/shared/i18n/locales/en/constants.ts` | Add bailongma navigation label |

### 4.3 Files NOT Modified

| File | Reason |
|------|--------|
| `src/main/index.ts` | No new IPC handles |
| `src/preload/index.ts` | No new IPC handles |
| `src/shared/types.ts` | ACUI types stay in local `types.ts` |

### 4.4 APIs Used (Read-Only)

```typescript
// Cron jobs
await hermesAPI.listCronJobs(includeDisabled=true)
  .then(jobs => jobs.filter(j => j.state === "error"))

// Cron history
await hermesAPI.getCronJobHistory(limit=5)

// Gateway state
await hermesAPI.getGatewayState()

// Events
await hermesAPI.getEvents(limit=30)
```

## 5. Implementation Steps

### Step 1: Scaffold

- Create `screens/BaiLongma/` directory
- Create `components/BaiLongma/` directory
- Add `bailongma` to Layout.tsx View type and NAV_ITEMS
- Add `bailongma-*` CSS classes to main.css (use existing CSS variable system)
- Add i18n keys

### Step 2: ACUI Types

Copy ACUI types from Layer 2 into local `types.ts`:

```typescript
interface ACUIMessage {
  version: "1.0";
  task_id: string;
  focus_id: string;
  type: MessageType;
  timestamp: number;
  payload: unknown;
}

interface Task {
  id: string;
  goal: string;
  state: TaskState;
  created_at: number;
}

interface Step {
  id: string;
  task_id: string;
  label: string;
  state: StepState;
}
```

### Step 3: useACUI Hook

Implement React state management for ACUI:

```typescript
interface ACUIState {
  task: Task | null;
  steps: Step[];
  components: Record<string, unknown>;
  focusStack: Focus[];
  activeFocusId: string | null;
  artifacts: Artifact[];
  eventLog: ACUIMessage[];
}
```

Hook exposes:
- `emit(message: ACUIMessage)` — processes a command
- `createTask(goal: string)` — initializes a task
- `startDiagnosis(cronJobId: string)` — begins diagnosis workflow

### Step 4: BaiLongma Adapter (Local)

Implement a local adapter module within the screen component. No new IPC — calls `hermesAPI.*` directly.

```typescript
async function gatherCronContext(jobId: string) {
  const [jobs, history, gw, events] = await Promise.all([
    hermesAPI.listCronJobs(true),
    hermesAPI.getCronJobHistory(5),
    hermesAPI.getGatewayState(),
    hermesAPI.getEvents(30),
  ]);

  const job = jobs.find(j => j.id === jobId);
  const recentFails = history.filter(h => h.jobId === jobId && h.failed);

  return { job, recentFails, gw, events };
}

function classifyError(job: CronJob, recentFails: CronRun[]): ACUIError {
  if (job.last_error?.includes("rate limited")) {
    return { code: "rate_limited", message: "...", recoverable: true };
  }
  if (job.last_error?.includes("401")) {
    return { code: "permission_required", message: "...", recoverable: true };
  }
  return { code: "ipc_failure", message: "...", recoverable: false };
}
```

### Step 5: UI Components

Render ACUI state via components:

```
<FocusStack focuses={acui.focusStack} active={acui.activeFocusId} />
<TaskHeader task={acui.task} />
<StepList steps={acui.steps} />
<BrainPanel artifacts={acui.artifacts} errors={acui.errors} />
<ACUIEventLog events={acui.eventLog} />
```

### Step 6: Diagnosis Flow

1. User selects failed job from list
2. `createTask("diagnose")` — task created → gathering_context
3. `gatherCronContext()` — context gathered → planning
4. `classifyError()` — diagnosis produced → running
5. `ui_show("DiagnosisCard", props)` — diagnosis rendered
6. Task state → completed

## 6. Visual Checkpoints

### Checkpoint 1: Empty State

```
┌─────────────────────────────────────────────────────────────────┐
│ [BaiLongma]                                                  │
├─────────────┬─────────────────────────────────┬───────────────┤
│ Focus Stack │  Task Canvas                    │  Brain UI     │
│             │                                 │               │
│  (empty)    │  Select a failed cron job      │  (empty)      │
│             │  to begin diagnosis.           │               │
│             │                                 │               │
└─────────────┴─────────────────────────────────┴───────────────┘
```

### Checkpoint 2: Gathering Context

```
┌─────────────────────────────────────────────────────────────────┐
│ [BaiLongma]  [● gathering_context]                            │
├─────────────┬─────────────────────────────────┬───────────────┤
│ ● f-001   │  Steps                           │ Context ─── │
│             │  [1] gather context    ●        │   loading...│
│             │  [2] diagnose error    ○     │               │
│             │  [3] suggest action    ○        │ Events ─── │
│             │                                 │  (empty)    │
│             │                                 │               │
└─────────────┴─────────────────────────────────┴───────────────┘
```

### Checkpoint 3: Diagnosis Complete

```
┌─────────────────────────────────────────────────────────────────┐
│ [BaiLongma]  [✓ completed]                                     │
├─────────────┬─────────────────────────────────┬───────────────┤
│ ● f-001   │  Diagnosis Card                   │ Artifacts ─── │
│             │  ┌──────────────────────────┐  │ diagnosis:   │
│             │  │ ● Error: rate_limited    │  │ wechat-0528  │
│             │  │   WeChat delivery hit     │  │               │
│             │  │   iLink daily limit.     │  │ Errors ───   │
│             │  │                            │  │ ✓ resolved   │
│             │  │ Suggestion:               │  │               │
│             │  │ • Reduce push frequency │  │               │
│             │  │ • Check iLink quota       │  │               │
│             │  └──────────────────────────┘  │               │
│             │                                 │               │
│             │  [Open Schedules]  [Dismiss]   │               │
└─────────────┴─────────────────────────────────┴───────────────┘
```

## 7. Definition of Done

The POC is complete when:

| # | Criterion | Validation |
|---|-----------|-----------|
| 1 | BaiLongma accessible from sidebar | Manual: click BaiLongma nav item, screen renders |
| 2 | Failed jobs listed | Manual: see list of error-state cron jobs |
| 3 | Diagnosis renders | Manual: select job, see DiagnosisCard with classification |
| 4 | Step states update | Manual: observe step list progressing from ○ → ● → ✓ |
| 5 | No new IPC | Code review: `git diff` shows no changes to main/index.ts or preload/index.ts |
| 6 | Typecheck passes | `npm run typecheck` exits 0 |

## 8. Success Metrics

| Metric | Target |
|--------|--------|
| New TypeScript files | ≤ 9 |
| Lines of new code | ≤ 800 |
| New CSS classes | ≤ 30 |
| New IPC handles | 0 |
| New npm dependencies | 0 |
| Time to implement | ≤ 1 sprint |

## 9. Decision Points

After POC, the following decisions are made:

| Decision | Options |
|----------|---------|
| Continue to Layer 4? | Yes → proceed with full implementation; No → archive POC |
| New IPC domain needed? | Yes → add `bailongma:*` handles; No → keep adapter pattern |
| Focus Stack useful? | Yes → persist to state; No → simplify to flat list |
| ACUI component registry pattern | Component map → proceed; Too rigid → evaluate alternatives |
| Separate route / icon? | Yes → invest in icon + nav UX; No → reuse existing pattern |

Memory SQLite migration (TD-PERSIST-002) and TICK background service remain **not** prerequisites. They proceed on their own timelines.

## 10. Implementation Status (2026-05-28)

### POC Phases Completed

| Phase | Description | Status |
|-------|-------------|--------|
| POC-1 | Static readonly UI skeleton | Completed |
| POC-2 | Real cron data via `listCronJobs(true, profile)` | Completed |
| npm typecheck | `npm run typecheck` passes | Passed |
| Git push | Pushed to `origin/hermes-pro-main` | Done |

### Actual Implementation (vs Plan)

| Item | Plan | Actual |
|------|------|--------|
| BaiLongma.tsx | Created | ✅ Created (280 lines) |
| Bailongma/index.tsx | Not planned | ✅ Created (export) |
| Layout.tsx | Add bailongma view | ✅ Added |
| main.css | Add bailongma-* classes | ✅ Added (~170 new lines) |
| i18n | Add bailongma labels | ✅ Added (en/zh-CN) |
| Components | Separate components planned | Simplified: all in BaiLongma.tsx |
| useACUI hook | Planned | Simplified: local state only |
| types.ts | Planned | Inlined in BaiLongma.tsx |

### Hard Boundaries Verified

| Boundary | Maintained |
|----------|-----------|
| No new IPC handles | ✅ |
| No src/main changes | ✅ |
| No src/preload changes | ✅ |
| No new database tables | ✅ |
| No writes to cron jobs | ✅ |
| No writes to Memory/Vault/Knowledge | ✅ |
| No WeChat send | ✅ |
| No model inference | ✅ |
| No TICK service | ✅ |
| No Memory SQLite migration | ✅ |

### Manual QA Pending

- [ ] Start Hermes Pro app and open BaiLongma
- [ ] Verify 3-column cockpit renders without overflow
- [ ] Verify Schedules screen still opens
- [ ] Verify AgentMonitor screen still opens
- [ ] Verify cron data displays (total/ok/errors)
- [ ] Verify error classification works (rate_limited/permission/connection/unknown)

### Productionization

**NOT APPROVED** — BaiLongma POC remains a validation instrument per Section 2. Productionization requires:
1. Successful manual QA
2. Layer 4 decision (continue or archive)
3. New IPC domain decision (if needed)
4. ACUI registry pattern evaluation

## 11. Rollback Plan

If POC reveals fundamental flaws:

- Delete `screens/BaiLongma/` and `components/BaiLongma/` directories
- Revert Layout.tsx changes (remove `bailongma` from View type and NAV_ITEMS)
- Revert CSS and i18n changes
- No data migration needed (POC is read-only)

POC code is not expected to survive as production code. It is a learning instrument.
