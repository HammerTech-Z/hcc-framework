# Preflight — UI-MACOS-001b (Mission Three-Section Restructure)

> Status: **EXECUTED 2026-06-11**. Mission 3-section restructure complete.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` C.2, D.2, H, I-4
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §6.2

---

## 1. Objective

Restructure Mission page from a flat panel wall into a three-section answer-layout, per audit §C.2 and §D.2:

1. **Health Summary Row** — one-line, four numbers answering "how is the system?"
2. **Focus Area** — ongoing task stage track (5-node HCC phases) + blockers + next action hint
3. **Collapsible Details** — events / cron / pipeline / artifacts, default collapsed

This is a visual reorganization inside `Mission.tsx` only. No props signature change, no new IPC, no execution controls (not even disabled ones).

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/Mission/Mission.tsx` | Internal layout restructure: Hero+StatGrid+Panels → HealthRow+FocusArea+CollapsibleDetails | MEDIUM — user's daily status page |
| `src/renderer/src/screens/Mission/Mission.css` (if separate; else CSS block in main.css) | Grid/flex for three-section layout | LOW |

**Not touched**: `Mission` props (`{ profile?, legacySource? }`), `layout-routes.tsx`, IPC channels (8 read-only APIs unchanged), bailongma/hccCockpit legacy alias.

---

## 3. Expected Diff (schematic)

```
Before (panel wall):
  <Hero />
  <StatGrid />
  <MissionGridPanels />
  <LowerQuadGrid />

After (three-section):
  <section className="mission-health-row">
    {/* 网关正常 · 2 任务进行中 · 1 待审批 · 3 冻结 */}
    <HealthIndicator ... />
  </section>

  <section className="mission-focus">
    {/* 阶段轨道: 发现→方案→修复→验证→交付 (5 HCC nodes) */}
    <StageTrack runs={activeRuns} />
    {/* 阻塞项列表 */}
    <BlockerSummary items={blockers} />
    {/* 下一步: 引导去对应页面, 不含执行按钮 */}
    <NextActionHint ... />
  </section>

  <section className="mission-details">
    {/* 全部 default collapsed */}
    <CollapsibleSection title="事件日志" defaultCollapsed><EventsView /></CollapsibleSection>
    <CollapsibleSection title="定时任务" defaultCollapsed><CronSummary /></CollapsibleSection>
    <CollapsibleSection title="流水线" defaultCollapsed><PipelineList /></CollapsibleSection>
    <CollapsibleSection title="产物" defaultCollapsed><ArtifactList /></CollapsibleSection>
  </section>
```

**Key invariants**:
- Zero execution buttons (not even disabled — audit D.2 principle: "disabled button implies future possibility, honest approach is absence")
- Top fixed-sentence: `仅状态展示 · 不会自动执行 · Read-only` (per audit §G)
- Stage track: 5 HCC phase nodes (发现→方案→修复→验证→交付). Completed=solid, current=accent outline+label, future=hollow. 160ms opacity transition on state change, zero animation otherwise.
- Each active task card: 4 lines max (name / phase / blocker-or-risk / next-action). Click expands into inspector context tab (after `UI-CHAT-001` inspector tab-ification).

---

## 4. Test Commands

```bash
# Baseline (MUST remain green)
npx vitest run tests/mission-control-readonly.test.ts tests/screen-boundary-contract.test.ts tests/layout-route-table.test.ts

# New assertions needed:
# 1. "Mission.tsx contains no execution controls (including disabled buttons)"
# 2. "Mission.tsx IPC api_methods match contract (8 read-only, 0 write)"
# 3. "bailongma + hccCockpit legacySource routes still render Mission component"
# 4. "CollapsibleDetails sections default to collapsed"

# Visual QA
# openwolf designqc --routes /#/mission
```

---

## 5. Rollback

```bash
git checkout -- src/renderer/src/screens/Mission/Mission.tsx
# CSS rollback if separate file was touched
```

Single-component change. Route table unchanged. IPC contract unchanged.

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Real-time focus-stack event stream (ACUI runtime) | NOT in scope — uses existing read-only API data |
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Light mode polish | NOT in scope |
| Execution controls (any, including disabled) | ZERO added |
| New IPC channels | ZERO added |
| Test assertion changes (existing) | NONE broken |

---

## 7. Data Source Note

HealthSummaryRow numbers are synthesized client-side from existing read-only API data already available to Mission (gateway state, events, cron jobs, pipeline runs). No aggregation endpoint needed — pure component-local computation.

"待审批" count: derived from events stream (pattern-matched for approval-state entries). If no reliable source exists in current API, display "—" rather than fabricating.

---

## 8. Approval Gate

- [ ] User confirms three-section layout (Health Row → Focus → Collapsible)
- [ ] User confirms HCC 5-phase labels: 发现/方案/修复/验证/交付
- [ ] User confirms details sections default collapsed (all)
- [ ] User confirms static mock screenshot review before code (I-4: "重排前应过一版静态 mock")
- [ ] Execute after `UI-MACOS-001a` (font fixes Mission rendering) and `UI-CN-001a` (badge component available)
