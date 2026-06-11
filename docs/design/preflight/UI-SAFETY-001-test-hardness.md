# Preflight — UI-SAFETY-001 (Read-Only Test Hardness Upgrade)

> Status: **EXECUTED 2026-06-11**. Import-graph hardening complete.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` P1-2, H, I-6
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §8

---

## 1. Objective

Fix P1-2: read-only boundary tests currently use string matching (`expect(src).not.toContain("ipcRenderer")`), which is trivially bypassed by helper/wrapper indirection. Upgrade to import-graph static analysis.

Also adds `enforcement` field to `ScreenBoundaryContract` so each view honestly declares its enforcement level.

Also verifies `installUpdate` confirm dialog status (currently UNVERIFIED).

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/shared/lib/screen-boundary-contract.ts` | Add `enforcement` field to `ScreenBoundaryContract` interface; populate for all 21 views + shell entry | HIGH — contract field changes per audit I-6 |
| `tests/_helpers/import-graph.ts` | **NEW** — TS compiler API helper to traverse import graph of a given entry module | LOW |
| `tests/screen-boundary-contract.test.ts` | Add import-graph assertions alongside existing string-based ones | MEDIUM |
| `tests/mission-control-readonly.test.ts` | Add import-graph assertion for Mission module | LOW |
| `tests/knowledge-control-readonly.test.ts` | Add import-graph assertion for KnowledgeControl module | LOW |

**Not touched**: renderer source, IPC handlers, preload, main process, package.json.

---

## 3. Expected Diff (draft)

### 3.1 `enforcement` field (contract type change)

```ts
export type EnforcementLevel = "static-string" | "import-graph" | "runtime-assert";

export interface ScreenBoundaryContract {
  // ... existing fields ...
  enforcement: EnforcementLevel;  // NEW — per audit P1-2 / I-6
}
```

**Default assignment**: all 21 existing views get `enforcement: "static-string"` (current state). Read-only views (mission, knowledgeControl, bailongma, hccCockpit, monitor) are upgraded to `"import-graph"` in this slice. `"runtime-assert"` is a future goal (requires preload-level guard, separate slice).

### 3.2 Import-graph test helper (new, schematic)

```ts
// tests/_helpers/import-graph.ts
// Uses tsc --showConfig + programmatic TS API to traverse imports.
// For a given entry module, returns the set of all transitively imported module specifiers.
// Read-only view tests then assert: no transitive import resolves to a module
// that contains forbidden API calls (ipcRenderer.invoke, fetch(, window.hermesAPI.*).
```

### 3.3 Test assertion pattern

```ts
// Before (P1-2 vulnerable):
expect(readFileSync("Mission.tsx", "utf8")).not.toContain("runPlaybook(");

// After (import-graph hardened):
const imports = getTransitiveImports("src/renderer/src/screens/Mission/Mission.tsx");
for (const mod of imports) {
  const src = readFileSync(mod, "utf8");
  // Must not contain ANY forbidden API call form
  expect(src).not.toMatch(/\b(ipcRenderer\.invoke|window\.hermesAPI\.\w+\(|fetch\()/);
}

// Keep existing string-based assertions as belt (import-graph is suspenders)
```

---

## 4. Test Commands

```bash
# Baseline (MUST remain green)
npx vitest run tests/screen-boundary-contract.test.ts tests/mission-control-readonly.test.ts tests/knowledge-control-readonly.test.ts tests/layout-route-table.test.ts

# New negative-fixture tests:
# 1. Create a dummy wrapper module that re-exports forbidden APIs
# 2. Create a dummy read-only component that imports the wrapper
# 3. Assert import-graph test catches the transitive forbidden import
# (Existing string-based test would miss this)

# installUpdate confirm check
grep -rn "installUpdate" src/renderer/src/ -A 10
# Look for dialog.showMessageBox / confirm / modal before the call
```

---

## 5. Rollback

```bash
git checkout -- src/shared/lib/screen-boundary-contract.ts
git checkout -- tests/screen-boundary-contract.test.ts tests/mission-control-readonly.test.ts tests/knowledge-control-readonly.test.ts
rm tests/_helpers/import-graph.ts
```

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Runtime enforcement (preload guard) | NOT in scope — static analysis only |
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| New IPC channels | ZERO added |
| Package dependency changes | NONE — TS compiler API is part of typescript (already a devDependency) |

---

## 7. Approval Gate

- [ ] User confirms `enforcement` field addition to contract (per audit I-6: contract changes need approval)
- [ ] User confirms enforcement level assignment: read_only views → `"import-graph"`, others → `"static-string"`
- [ ] User confirms negative-fixture test approach
- [ ] Execute after `UI-SHELL-CONTRACT-001` (shell entry should also get enforcement field)
