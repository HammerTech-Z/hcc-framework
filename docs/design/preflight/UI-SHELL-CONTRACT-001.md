# Preflight — UI-SHELL-CONTRACT-001 (Shell Pseudo-View Contract Entry)

> Status: **AWAITING APPROVAL**. No implementation has started.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` P2-5, H, I-6
> Parent file: `src/shared/lib/screen-boundary-contract.ts`

---

## 1. Objective

Register the 4 Layout.tsx shell-level APIs (`downloadUpdate`, `installUpdate`, `abortChat`, `getSessionMessages`) as an explicit `shell` pseudo-view entry in the `CONTRACTS` array. Currently they exist only in a file-header comment (added by `UI-DOC-SYNC-001`).

This is a contract field change per audit I-6 ("改 contract 等于改宪法附件，建议走与 soul 变更同级的审批").

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/shared/lib/screen-boundary-contract.ts` | `ScreenViewId` union +`"shell"`; `CONTRACTS` +1 entry; `VIEW_COUNT` 21→22 | HIGH — contract mutation |
| `tests/screen-boundary-contract.test.ts` | Update view_count assertion (21→22); add shell entry tests | MEDIUM |
| Any code/test that hardcodes `VIEW_COUNT === 21` | grep and sync | MEDIUM |

**Not touched**: renderer source, IPC handlers, preload, main process, package.json, route table.

---

## 3. Expected Diff (draft)

### 3.1 ScreenViewId union

```diff
  export type ScreenViewId =
    | "chat"
    | ...
-   | "settings";
+   | "settings"
+   | "shell";
```

### 3.2 VIEW_COUNT

```diff
- export const SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT = 21 as const;
+ export const SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT = 22 as const;
```

### 3.3 New contract entry

```ts
contract({
  view: "shell",
  sidebar_group: "Work",       // pseudo-group — hidden in nav, not in sidebar
  display_label: "Shell",
  component_surface: "Layout",
  boundary_kind: "mixed",
  risk_level: "P1",            // installUpdate is high-privilege (replaces app binary)
  api_methods: [
    read("getSessionMessages"),
    write("abortChat"),
    api("downloadUpdate", "ipc_bridge", true),  // external-action (auto-update)
    api("installUpdate",  "ipc_bridge", true),  // external-action (high risk)
  ],
  write_surfaces: ["app_update_install", "chat_runtime_abort"],
  direct_gateway_methods: [],
  migrated_ipc_methods: [],
  remote_mode_restricted: false,
  model_strategy_relevant: false,
  notes: [
    "Shell-level pseudo-view — not rendered as a nav route. Registered 2026-06 per audit P2-5.",
    "Always reachable while any 21-view route is active.",
    "installUpdate confirm dialog existence: UNVERIFIED — UI-SAFETY-001 must verify.",
    "4 shell APIs were previously documented only in file-header comment (UI-DOC-SYNC-001).",
  ],
}),
```

### 3.4 Enforcement field (if combined with UI-SAFETY-001)

If `UI-SAFETY-001` is approved, the shell entry also gets `enforcement: "static-string"` (shell APIs are inherently reachable — import-graph analysis meaningless for a pseudo-view).

---

## 4. Test Commands

```bash
# Pre-change grep: find all VIEW_COUNT / 21 / view_count references
grep -rn "VIEW_COUNT\|21.*view\|view.*count.*21\|view_count\|viewCount" tests/ src/ --include="*.ts*"

# Update all 21→22 references

# Run contract tests
npx vitest run tests/screen-boundary-contract.test.ts tests/layout-route-table.test.ts
```

**Critical**: `CANONICAL_LAYOUT_ORDER` in tests must include `"shell"` in correct position (last, after `"settings"`).

---

## 5. Rollback

```bash
git checkout -- src/shared/lib/screen-boundary-contract.ts
git checkout -- tests/screen-boundary-contract.test.ts
# Revert any other files that had 21→22 changes
```

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Runtime behavior changes | NONE — contract is pure data |
| IPC handler changes | NONE |
| Renderer source changes | NONE |
| Native window compositing | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Package dependency changes | NONE |

---

## 7. Approval Gate

- [ ] User confirms shell entry as described (per audit I-6: contract changes need soul-level approval)
- [ ] User confirms `sidebar_group: "Work"` for shell (pseudo-group, not visible in nav)
- [ ] User confirms `risk_level: "P1"` (installUpdate is high-privilege)
- [ ] User confirms: should `enforcement` field be added in this slice or in `UI-SAFETY-001`? (recommend: this slice only adds shell entry; enforcement field deferred to SAFETY-001)
- [ ] Execute before `UI-SAFETY-001` (SAFETY-001 enforcement field builds on this)
