# Preflight — UI-MACOS-001a (Body Font Switch)

> Status: **AWAITING APPROVAL**. No implementation has started.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` P1-3, H, I-1
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §5 Typography

---

## 1. Objective

Fix P1-3: body font stack currently resolves to Google Sans (`--font-sans` first item) instead of system-native SF Pro / PingFang. This is a one-line CSS change that alters global visual perception. Google Sans is not an openly-licensed font (Google restricts it to Google products); bundling it in a for-profit product carries license risk (UNVERIFIED — font file origin must be confirmed locally before removal).

**Target**: body renders with `-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif`.

**Non-goal**: removing `GoogleSans-*.ttf` font files from the repo (separate slice).

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/assets/main.css` | Rewrite `--font-sans` token value; optionally redirect `body` to `var(--hp-font-ui)` | LOW — CSS only, no logic |

**Not touched** (confirmed): `src/preload/`, `src/main/`, `src/shared/lib/`, `package.json`, any `.tsx`/`.ts` renderer source, any test file.

---

## 3. Expected Diff (draft)

### Option A — change `--font-sans` at token definition (preferred)

```diff
- --font-sans: "Google Sans", -apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif;
+ --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, "Google Sans", sans-serif;
```

- Pushes Google Sans to fallback chain tail.
- No selector change needed — `body { font-family: var(--font-sans); }` unchanged.
- Chinese font stack explicitly included for Windows/fallback environments.

### Option B — redirect `body` to `--hp-font-ui`

```diff
  body {
-   font-family: var(--font-sans);
+   font-family: var(--hp-font-ui);
  }
```

- Shorter diff but breaks the semantic chain (`--font-sans` is the "intended UI font" token).
- `--hp-font-ui` already correctly set to system-first.

**Recommendation**: Option A. One token rewrite, no selector change, least blast radius.

---

## 4. Test Commands

```bash
# Pre-flight (baseline must be green)
npx vitest run tests/screen-boundary-contract.test.ts tests/knowledge-control-readonly.test.ts tests/mission-control-readonly.test.ts

# Post-change (visual QA — no automated font rendering tests exist)
# 1. Run `openwolf designqc` to capture before/after screenshots
# 2. Compare body text rendering across Chat / Mission / KnowledgeControl
# 3. Verify Chinese characters render as PingFang SC (macOS) / Microsoft YaHei (Windows)

# No test assertions touch font-family strings — no test breakage expected
```

**Pre-existing test preservation**: All 9 UI-boundary tests (111 cases) must remain green. Zero test assertions modified.

---

## 5. Rollback

```bash
git checkout -- src/renderer/src/assets/main.css
```

- Single file, single hunk. Font assets untouched.
- Revert restores Google Sans immediately on next renderer reload.

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11), the following are **excluded** from this slice:

| Item | Status |
|------|--------|
| Native window compositing material (macOS API) | NOT in scope |
| Unified window chrome overlay | NOT in scope |
| Global command dispatcher | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Light mode polish | NOT in scope |
| Runtime activation / IPC / new config writes | NONE added |
| Test assertion changes | NONE |
| Package dependency changes | NONE |

---

## 7. Approval Gate

- [ ] User confirms **Option A** (modify `--font-sans`) vs Option B (redirect body to `--hp-font-ui`)
- [ ] User confirms Google Sans @font-face block handling: keep in chain as fallback only (default), or comment out
- [ ] Google Sans `.ttf` file origin verified locally; removal deferred to future slice
- [ ] Execute after `UI-DOC-SYNC-001` is complete (already done)
- [ ] Execute before any Mission/Chat/Knowledge restyle (字体是视觉基底)
