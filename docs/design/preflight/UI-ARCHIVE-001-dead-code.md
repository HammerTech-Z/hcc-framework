# Preflight — UI-ARCHIVE-001 (Dead Code Archive)

> Status: **AWAITING APPROVAL**. No implementation has started.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` P3-1, P3-4, H, I-5
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §9

---

## 1. Objective

Archive two historical cockpit components whose routes are already aliased to Mission:

1. `BaiLongma.tsx` — route `bailongma` renders `<Mission legacySource="bailongma" />`
2. `HccCockpit.tsx` — route `hccCockpit` renders `<Mission legacySource="hcc" />`

Both files are noise for humans (cognitive) and for string-scanning tests (false positives). They remain valuable as design reference — not deleted, moved to `_archive/`.

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/BaiLongma/BaiLongma.tsx` | `git mv` to `_archive/BaiLongma/` | LOW — zero active imports |
| `src/renderer/src/screens/HccCockpit/HccCockpit.tsx` | `git mv` to `_archive/HccCockpit/` | LOW — zero active imports |
| (optional) HccCockpit/`ModelStrategyDryRunPanel.tsx` | Stay in place — cerebrum-locked, may still be referenced | — |

**Not touched**: `layout-routes.tsx`, `Mission.tsx`, IPC contracts, route table, bailongma/hccCockpit as ScreenViewId values.

---

## 3. Pre-condition Verification

```bash
# Must return ZERO import references (excluding layout-routes.tsx which uses Mission alias)
grep -rn "from.*BaiLongma/BaiLongma" src/ --include="*.ts*" | grep -v "layout-routes"
grep -rn "from.*HccCockpit/HccCockpit" src/ --include="*.ts*" | grep -v "layout-routes"

# If any import exists → BLOCK archive, investigate first
```

Edge case: `layout-routes.tsx` imports `Mission` from `screens/Mission/Mission.tsx`, NOT from BaiLongma/HccCockpit. The routes reference the legacy components only through `legacySource` prop on Mission component. So `layout-routes.tsx` should NOT show up in either grep result.

---

## 4. Expected Diff

### 4.1 File moves

```bash
mkdir -p src/renderer/src/screens/_archive/BaiLongma
mkdir -p src/renderer/src/screens/_archive/HccCockpit
git mv src/renderer/src/screens/BaiLongma/BaiLongma.tsx src/renderer/src/screens/_archive/BaiLongma/BaiLongma.tsx
git mv src/renderer/src/screens/HccCockpit/HccCockpit.tsx src/renderer/src/screens/_archive/HccCockpit/HccCockpit.tsx
```

### 4.2 File header annotation (prepend to each archived file)

```ts
// historical reference — archived 2026-06-11 per UI-ARCHIVE-001
// route bailongma → Mission legacySource="bailongma" (layout-routes.tsx)
// route hccCockpit → Mission legacySource="hcc" (layout-routes.tsx)
// see ADR-20260529-bailongma-poc2-qa-pass-productionization-not-approved
// see ADR-20260530-hcc-cockpit-readonly-poc
// This file is NOT part of any active route surface.
// Preserved as cockpit language design reference. Do not delete.
```

---

## 5. Test Commands

```bash
# Pre-archive: grep for zero imports (see §3)

# Post-archive: route table integrity
npx vitest run tests/layout-route-table.test.ts tests/screen-boundary-contract.test.ts

# bailongma-status-sync test — may reference old BaiLongma.tsx path
# If it imports from screens/BaiLongma/BaiLongma.tsx → update import to _archive path
# or assert the test's scope is about bailongma route (which still exists)
npx vitest run tests/bailongma-status-sync.test.ts
```

**Expected**: layout-route-table and screen-boundary-contract tests remain green. bailongma-status-sync may need import path adjustment.

---

## 6. Rollback

```bash
git mv src/renderer/src/screens/_archive/BaiLongma/BaiLongma.tsx src/renderer/src/screens/BaiLongma/BaiLongma.tsx
git mv src/renderer/src/screens/_archive/HccCockpit/HccCockpit.tsx src/renderer/src/screens/HccCockpit/HccCockpit.tsx
# Remove _archive dirs if empty
```

---

## 7. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| File deletion | NONE — git mv only (preserves history) |
| Route table changes | NONE |
| IPC contract changes | NONE |
| Component behavior changes | NONE |
| Native window compositing | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Package dependency changes | NONE |

---

## 8. Approval Gate

- [ ] User confirms `grep` shows zero active imports before move
- [ ] User confirms archive directory name: `_archive` (per audit)
- [ ] User confirms `ModelStrategyDryRunPanel.tsx` stays in place
- [ ] Execute independently — no dependency on other slices
