# Preflight — UI-CN-001a (Chinese Localization: Badge Component + State Vocabulary)

> Status: **EXECUTED 2026-06-11**. Bilingual badge + state vocabulary complete.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` F, G, H, I-2
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §8

---

## 1. Objective

Introduce bilingual boundary badges and a unified state-vocabulary component. This is part (a) of `UI-CN-001`: create the component foundation and wire it into Layout.tsx topbar. Part (b) covers per-screen fixed-sentence localization (separate preflight).

**Target**: Users see Chinese semantic labels at first glance; English anchor strings remain in hover/tooltip for test stability.

---

## 2. Bilingual Badge Vocabulary

Per audit §F table (2026-06-11):

| Boundary kind | Primary display | Hover / tooltip (preserves test anchors) |
|---|---|---|
| `read_only` | 只读 · Read-only | 风险分级 P3 · 无写入接口 · 无新增 IPC · Read-only · No writes · Productionization NOT APPROVED |
| `mixed` | 读写混合 · Mixed | 含发送/中止/配置写入 · 风险分级 P1 |
| `read_write_runtime` | 可执行 · Runtime | 本页可触发运行时动作，操作前将要求确认 |
| `config-write` | 配置写入 · Config | 修改将影响凭据/模型默认值 |

**State vocabulary** (unified across all screens, per audit §F table):

| Semantic | Chinese | Color token |
|---|---|---|
| Healthy/OK | 正常 | `--hp-state-ok` |
| Running (external agent) | 执行中（外部） | `--hp-accent` |
| Awaiting approval | 待审批 | `--hp-state-warn` |
| Blocked | 阻塞 | `--hp-state-warn` |
| Failed | 失败 | `--hp-state-danger` |
| Frozen | 冻结 | `--hp-state-frozen` |
| Stale (knowledge) | 已过期 | `--hp-state-warn` |
| Idle | 空闲 | `--hp-state-idle` |

---

## 3. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/components/StatusBadge/StatusBadge.tsx` | **NEW** — pure presentational component, zero IPC, zero runtime | LOW |
| `src/renderer/src/screens/Layout/Layout.tsx` | Replace inline topbar badge text with `<StatusBadge kind={...} />` | MEDIUM — topbar rendering path |
| `src/renderer/src/assets/main.css` | Add `--hp-state-*` token definitions (if not already present) | LOW |

**Not touched**: `src/preload/`, `src/main/`, `src/shared/lib/`, `package.json`, IPC handlers, route table.

---

## 4. Expected Diff (draft)

### 4.1 StatusBadge component (new file)

```tsx
// src/renderer/src/components/StatusBadge/StatusBadge.tsx
import type { ScreenBoundaryKind } from '@shared/lib/screen-boundary-contract';

const BADGE_LABELS: Record<ScreenBoundaryKind, { primary: string; tooltip: string }> = {
  read_only:          { primary: '只读 · Read-only',   tooltip: '风险分级 P3 · 无写入接口 · 无新增 IPC · Read-only · No writes · Productionization NOT APPROVED' },
  mixed:              { primary: '读写混合 · Mixed',     tooltip: '含发送/中止/配置写入 · 风险分级 P1' },
  read_write_runtime: { primary: '可执行 · Runtime',     tooltip: '本页可触发运行时动作，操作前将要求确认' },
  read_write_config:  { primary: '配置写入 · Config',    tooltip: '修改将影响凭据/模型默认值' },
  external_action:    { primary: '外部动作 · External',   tooltip: '本页可触发外部进程/网络调用' },
};

export function StatusBadge({ kind }: { kind: ScreenBoundaryKind }) {
  const label = BADGE_LABELS[kind];
  return (
    <span className="hp-status-badge" title={label.tooltip}>
      {label.primary}
    </span>
  );
}
```

### 4.2 Layout.tsx badge wiring (schematic)

```tsx
// Before: <span className="topbar-badge">{boundaryBadgeText}</span>
// After:
<StatusBadge kind={currentViewBoundaryKind} />
```

### 4.3 CSS tokens (if not already present)

```css
--hp-state-ok:      #30d158;
--hp-state-warn:    #ff9f0a;
--hp-state-danger:  #ff453a;
--hp-state-frozen:  #64d2ff;
--hp-state-idle:    rgba(235,235,245,0.3);
```

---

## 5. Test Commands

```bash
# Baseline (MUST remain green)
npx vitest run tests/screen-boundary-contract.test.ts tests/layout-route-table.test.ts

# Badge-specific: verify English anchor strings survive in title attribute
# Test: readFileSync StatusBadge.tsx → grep for canonical English literals in tooltip entries
# Test: mount StatusBadge(read_only) → assert title attribute contains "Read-only · No writes · Productionization NOT APPROVED"
```

**Test preservation strategy**: English anchor strings move from visible text to `title` attribute. Test assertions change from `expect(visibleText).toContain("Read-only")` to `expect(element.getAttribute("title")).toContain("Read-only")`. String literals unchanged; only assertion target (visible → tooltip) shifts. This strategy was approved by user in prior session.

---

## 6. Rollback

```bash
# Delete new component, revert Layout.tsx badge rendering
rm -rf src/renderer/src/components/StatusBadge/
git checkout -- src/renderer/src/screens/Layout/Layout.tsx src/renderer/src/assets/main.css
```

---

## 7. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Structured approval protocol (ACUI event) | NOT in scope |
| Light mode polish | NOT in scope |
| Runtime activation / IPC / new config writes | NONE added |
| Test anchor string literals changed | NONE — only display location shifts |
| Package dependency changes | NONE |

---

## 8. Approval Gate

- [ ] User confirms bilingual format: `中文 · English` (per audit §F)
- [ ] User confirms state vocabulary table (8 entries) as definitive
- [ ] User confirms test strategy: move English anchors to `title` attribute
- [ ] Execute after `UI-DOC-SYNC-001` (done) and `UI-MACOS-001a` (font baseline)
