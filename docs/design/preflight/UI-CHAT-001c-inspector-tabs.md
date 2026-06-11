# Preflight — UI-CHAT-001c (Inspector Tab-ification + Reference Panel Migration)

> Status: **AWAITING APPROVAL**. No implementation has started.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` C.1, D.3, H, I-3
> Parent preflight: `docs/design/preflight/UI-CHAT-001a-command-palette.md`, `docs/design/preflight/UI-CHAT-001b-approval-bar.md`
> Scope note: this was originally listed as part of `UI-CHAT-001` (audit H table), split into 001a (command palette), 001b (approval bar), and 001c (this doc — inspector tab-ification).

---

## 1. Objective

Upgrade the right-side inspector from a single-purpose boundary panel into a three-tab panel that earns its 280px width. Also eliminates the dual-right-panel problem (Chat reference panel + shell boundary inspector) by migrating Chat's reference panel content into inspector tabs.

**Three tabs** (per audit §C.1):

| Tab | Content | Source |
|---|---|---|
| 上下文 (Context) | Live page-specific info: Chat→session/model/tokens; Mission→selected run detail; KnowledgeControl→selected card provenance | Existing read-only API |
| 引用 (References) | Chat's existing Local Knowledge / Web Sources / Agent Judgment — migrated from Chat's internal aside | Existing chat chunk payload |
| 边界 (Boundary) | Existing BoundaryInspectorPanel content — preserved, demoted to third tab | Existing contract data |

**Non-goal**: Tool Progress tab (requires new event subscription, possibly new IPC — per audit §J). The three tabs above use existing static/stream data only.

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/Layout/Layout.tsx` | Replace `BoundaryInspectorPanel` with `<InspectorTabs />`; add tab state management | HIGH — shell-level behavior change per audit I-3 |
| `src/renderer/src/components/Inspector/InspectorTabs.tsx` | **NEW** — tab container with 上下文/引用/边界 | MEDIUM |
| `src/renderer/src/components/Inspector/ContextTab.tsx` | **NEW** — renders live context per current route | MEDIUM |
| `src/renderer/src/components/Inspector/ReferenceTab.tsx` | **NEW** — absorbs Chat's existing reference panel content | MEDIUM |
| `src/renderer/src/components/Inspector/BoundaryTab.tsx` | **NEW** — thin wrapper around existing BoundaryInspectorPanel data | LOW |
| `src/renderer/src/screens/Chat/Chat.tsx` | Remove internal reference panel aside; content now in Inspector ReferenceTab | MEDIUM |
| `src/renderer/src/assets/main.css` | Tab bar + panel styles | LOW |

**Not touched**: IPC handlers, preload, main process, package.json, route table.

---

## 3. Expected Diff (schematic)

### 3.1 Layout.tsx inspector area

```tsx
// Before:
<BoundaryInspectorPanel contract={currentContract} />

// After:
<InspectorTabs defaultTab="context">
  <ContextTab view={currentView} />
  <ReferenceTab sessionId={currentSessionId} />
  <BoundaryTab contract={currentContract} />
</InspectorTabs>
```

### 3.2 Chat.tsx reference panel removal

```tsx
// Before: Chat component renders <ChatReferencePanel /> as right aside
// After: Chat component renders no right aside.
//        Reference content flows through Inspector ReferenceTab via shared state/context.
```

### 3.3 Tab bar styling

```css
.hp-inspector-tabs {
  display: flex; flex-direction: column;
  width: 280px; height: 100%;
}
.hp-inspector-tab-bar {
  display: flex; border-bottom: 1px solid var(--hp-divider);
}
.hp-inspector-tab {
  padding: 8px 16px; font-size: 13px;
  color: var(--hp-label-secondary);
  border-bottom: 2px solid transparent;
}
.hp-inspector-tab[data-active] {
  color: var(--hp-label);
  border-bottom-color: var(--hp-accent);
}
```

---

## 4. Test Commands

```bash
# Baseline
npx vitest run tests/screen-boundary-contract.test.ts tests/layout-route-table.test.ts

# New assertions:
# 1. Inspector renders 3 tabs (zh labels: 上下文 / 引用 / 边界)
# 2. Default tab is "上下文" (context) per audit §C.1 recommendation
# 3. Chat page no longer renders internal reference panel aside
# 4. ⌥⌘I toggles inspector visibility (existing behavior preserved)
# 5. Inspector toggle works on all 21 routes
```

---

## 5. Rollback

```bash
rm -rf src/renderer/src/components/Inspector/
git checkout -- src/renderer/src/screens/Layout/Layout.tsx src/renderer/src/screens/Chat/Chat.tsx src/renderer/src/assets/main.css
```

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Tool Progress tab (requires new event subscription) | NOT in scope — in §J exclusion list |
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Structured approval protocol | NOT in scope |
| Light mode polish | NOT in scope |
| New IPC channels | ZERO added |
| Package dependency changes | NONE |

---

## 7. Approval Gate

- [ ] User confirms three-tab inspector design (上下文 / 引用 / 边界)
- [ ] User confirms default tab is "上下文"
- [ ] User confirms Chat reference panel is fully removed from Chat.tsx
- [ ] User confirms `⌥⌘I` behavior unchanged (toggle inspector visibility)
- [ ] Execute after `UI-CHAT-001a` and `UI-CHAT-001b` (they modify Chat.tsx; this also modifies Chat.tsx)
