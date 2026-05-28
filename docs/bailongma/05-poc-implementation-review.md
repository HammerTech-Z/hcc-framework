# BaiLongma 05 — POC Implementation Review

> Status: For Decision
> Date: 2026-05-28
> Precedes: 04-poc-plan.md
> Purpose: Decision on whether to approve the cron failure diagnosis read-only POC.

## 1. Review Decision

**建议批准 cron 失败诊断只读 POC，但仅限只读验证，不进入运行时内核实现。**

**Decision gate**: This document must be approved before any implementation begins.

## 2. Approved Scope

The POC is limited to:

- New BaiLongma top-level screen (minimal UI skeleton)
- Read-only cron failure diagnosis display
- Use existing IPC / preload API / renderer state only
- ACUI mock events to demonstrate task step progression
- Suggested action buttons (no-op in POC — links or disabled buttons only)
- No write operations of any kind

**What the POC validates**:
- Does ACUI component command flow drive a readable task cockpit?
- Does the existing `listCronJobs`, `getCronJobHistory`, `getGatewayState`, `getEvents` surface provide diagnostic value?
- Can a 3-column layout coexist with existing Hermes Pro screens?

## 3. Hard Boundaries

The following are **non-negotiable**. Violation of any boundary terminates the POC immediately.

**明确禁止列表：**

- 不新增 IPC
- 不新增数据库表
- 不启动后台 TICK service
- 不迁移 Memory SQLite
- 不做自动资源扫描
- 不调用外部网络
- 不修改 cron jobs
- 不写入 Memory
- 不写入 Vault
- 不写入 Knowledge
- 不处理 WeChat 发送
- 不接入模型调用

**Rationale table:**

| Boundary | Rationale |
|----------|-----------|
| No new IPC handles | Layer 2 contract. ACUI adapter pattern only. |
| No new database tables | POC is read-only. No persistence. |
| No background TICK service | Layer 4+ concern. Not a POC requirement. |
| No Memory SQLite migration | TD-PERSIST-002 proceeds independently. |
| No automatic resource scanning | BaiLongma respects user-authorization model. |
| No external network calls | POC reads Hermes Pro state only. |
| No cron job writes | POC does not modify, pause, resume, or delete cron jobs. |
| No Memory/Vault/Knowledge writes | POC is read-only display. |
| No WeChat / platform delivery | POC does not send messages. |
| No model inference calls | No LLM calls, no AI generation. |

## 4. Existing Data Sources

POC reads from these existing APIs only:

| Source | API | Access |
|--------|-----|--------|
| Cron jobs | `hermesAPI.listCronJobs(includeDisabled=true)` | Read job list, filter by `state === "error"` |
| Cron history | `hermesAPI.getCronJobHistory(limit=5)` | Read recent run timestamps and error previews |
| Gateway state | `hermesAPI.getGatewayState()` | Read platform states |
| Events timeline | `hermesAPI.getEvents(limit=30)` | Read recent system events |
| Schedules state | Local renderer state | Read from Schedules screen if sharing context |

No new IPC handles. No direct database access. No file I/O beyond what existing APIs expose.

## 5. Implementation Sketch

High-level file-level sketch only. No code written in this document.

### Files Created

| File | Purpose |
|------|---------|
| `src/renderer/src/screens/BaiLongma/BaiLongma.tsx` | Main screen, composes panels |
| `src/renderer/src/screens/BaiLongma/types.ts` | ACUI types (copy from Layer 2) |
| `src/renderer/src/screens/BaiLongma/useACUI.ts` | ACUI state management (useState-based) |
| `src/renderer/src/screens/BaiLongma/DiagnosisPanel.tsx` | Diagnosis card component |
| `src/renderer/src/screens/BaiLongma/ACUITimeline.tsx` | Event log timeline |

### Files Modified

| File | Change |
|------|--------|
| `src/renderer/src/screens/Layout/Layout.tsx` | Add `bailongma` to View type and NAV_ITEMS; add conditional render pane |
| `src/renderer/src/assets/main.css` | Add `bailongma-*` CSS classes (using existing variable system) |
| `src/shared/i18n/locales/zh-CN/constants.ts` | Add `navigation.bailongma` label |
| `src/shared/i18n/locales/en/constants.ts` | Add `navigation.bailongma` label |

### Files NOT Modified

| File | Reason |
|------|--------|
| `src/main/index.ts` | Hard boundary |
| `src/preload/index.ts` | Hard boundary |
| `src/preload/index.d.ts` | Hard boundary |
| `src/shared/types.ts` | ACUI types live in local `types.ts` |

## 6. ACUI Mock Event Flow

The POC demonstrates ACUI command flow through a mock event sequence. All events are generated client-side from Hermes Pro API responses.

### Phase 1: User selects failed cron job

```
User clicks job in list
  → emit({ type: "task.created", task_id: "poc-1", focus_id: "f-1", payload: { goal: "diagnose" }})
  → emit({ type: "ui_show", component: "TaskHeader", id: "hdr-1", props: { goal: "diagnose" }})
  → emit({ type: "step.state_change", step_id: "s-1", state: "running" })
  → emit({ type: "ui_update", id: "steps-1", props: { steps: [...] }})
```

### Phase 2: Context gathering

```
  → emit({ type: "context.gathered", payload: { items: [...] }})
  → emit({ type: "step.state_change", step_id: "s-1", state: "completed" })
  → emit({ type: "step.state_change", step_id: "s-2", state: "running" })
```

### Phase 3: Diagnosis

```
  → emit({ type: "step.state_change", step_id: "s-2", state: "completed" })
  → emit({ type: "step.state_change", step_id: "s-3", state: "running" })
  → emit({ type: "artifact.created", artifact: { id: "a-1", type: "diagnosis", summary: "rate_limited" }})
  → emit({ type: "ui_show", component: "DiagnosisCard", id: "diag-1", props: { error: "rate_limited", suggestion: "..." }})
  → emit({ type: "ui_artifact", artifact: { ... }})
  → emit({ type: "step.state_change", step_id: "s-3", state: "completed" })
  → emit({ type: "task.state_change", state: "completed" })
```

All steps use `ui_show` / `ui_update` / `ui_artifact` from Layer 2. The mock flow validates that the ACUI command vocabulary is sufficient for this scenario.

## 7. Acceptance Criteria

POC is accepted when all criteria are met:

| # | Criterion | Validation |
|---|-----------|-----------|
| 1 | Page opens without crash | Manual: click BaiLongma nav item |
| 2 | Cron failure summary renders | Manual: see list of error-state jobs with last_error |
| 3 | Error classification works | Manual: DeepSeek 401 → `permission_required`; rate_limited → `rate_limited`; connection → `ipc_failure` |
| 4 | ACUI event timeline visible | Manual: see event log drawer with timestamped entries |
| 5 | Zero write operations | Code review: no `setCronJob`, `writeMemory`, `knowledgeIngest`, or equivalent calls |
| 6 | Typecheck passes | `npm run typecheck` exits 0 |
| 7 | Existing tests pass | `npm run test` exits 0 |
| 8 | Schedules screen still opens | Manual: nav to Schedules, verify CRUD still works |
| 9 | AgentMonitor screen still opens | Manual: nav to AgentMonitor, verify status still renders |
| 10 | No new IPC | `git diff src/main/index.ts src/preload/index.ts` shows no changes |

## 8. Rejection Conditions

POC should not proceed, or should be stopped if any of the following is identified:

| Condition | Action |
|-----------|--------|
| Requires new IPC handle to complete | Reject POC — Layer 2 contract violated |
| Requires write to cron jobs | Reject — read-only scope violated |
| Requires LLM / model inference | Reject — no model calls in POC scope |
| Requires Memory SQLite | Reject — TD-PERSIST-002 is independent |
| Requires background TICK loop | Reject — TICK is Layer 4+ |
| Requires external network calls | Reject — POC reads Hermes Pro state only |
| Implementation exceeds 800 lines of new code | Pause and reassess scope |

## 9. Test Plan

### Automated

```bash
npm run typecheck
npm run test
```

### Manual

| Check | Method |
|-------|--------|
| BaiLongma page opens | Navigate to BaiLongma via sidebar |
| Cron failures listed | Compare with Schedules screen job list |
| Diagnosis renders | Select a failed job, observe DiagnosisCard |
| Schedules still works | Create, pause, resume a job |
| AgentMonitor still works | Navigate to AgentMonitor, verify gateway status |
| No write operations | Code review: search for `removeCronJob`, `setCronJob`, `addMemoryEntry`, `knowledgeIngest` |

## 10. Final Recommendation

**批准只读 POC；禁止扩大为运行时内核实现。**

The cron failure diagnosis POC is a contained validation instrument. Its value is in proving that ACUI command flow is expressible through existing APIs — not in delivering production functionality. If the POC reveals that ACUI is insufficient, the design documents are updated. If the POC reveals that existing APIs are insufficient, the `bailongma:*` IPC domain question is re-evaluated. Neither outcome requires a runtime core.

Memory SQLite migration and TICK background service remain **not prerequisites**. They proceed on their own timelines per iteration-plan-v2-updated.md.
