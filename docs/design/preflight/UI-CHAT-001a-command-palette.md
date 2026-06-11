# Preflight — UI-CHAT-001a (Slash Menu → Command Palette)

> Status: **EXECUTED 2026-06-11**. Chat-internal command palette overlay deployed.
> Audit ref: `docs/design/audit/Hermes-Pro-UI-Audit-And-Redesign-2026-06-11.md` D.3, H, I-3
> Parent spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` §6.1.1
>
> **Execution note (2026-06-11):** Chat-internal command palette implemented as a 520px fixed overlay at 20vh with backdrop-filter blur; no global cross-page command dispatcher. Four-category grouping (session/approval/tools/system) with bilingual 中文·English labels. Fuzzy filter matches name, description, and descriptionCn. Keyboard navigation (↑↓/Enter/Esc, click-outside dismiss). Zero IPC, zero package/main/preload changes. Typecheck + screen-boundary-contract (23 tests) + full vitest (142 files / 3934 tests) all PASS. Lock-verify: 45 PASS / 1 FAIL — the single failure is Chat.tsx uchg not restored, requires user manual `chflags uchg ~/hermes-pro/src/renderer/src/screens/Chat/Chat.tsx ~/hermes-pro/src/renderer/src/screens/Chat/`.

---

## 1. Objective

Upgrade the Chat slash menu from a basic dropdown into a command-palette-style overlay. This is sub-slice (a) of `UI-CHAT-001`. Parts (b) and (c) cover approval bar hardening and inspector tab-ification respectively (separate preflights).

**Target**:
- Centered, frosted-background overlay (~520px wide)
- Fuzzy-filter matching on slash commands
- Category grouping with subtle section headers
- Keyboard navigation (↑↓ select, ⏎ execute, Esc dismiss)
- Chinese descriptions alongside English command names

**Non-goal**: global cross-page command dispatch (that would require a separate approval per audit §J). This is Chat-internal only.

---

## 2. Affected Files

| File | Change | Risk |
|------|--------|------|
| `src/renderer/src/screens/Chat/Chat.tsx` | Replace slash menu rendering logic; add fuzzy-filter + category grouping | MEDIUM |
| `src/renderer/src/assets/main.css` | Add `.hp-command-palette` styles (centered overlay, frosted bg, animation) | LOW |

**Not touched**: IPC handlers, route table, preload, main process, package.json.

---

## 3. Expected Diff (schematic)

### 3.1 CSS additions

```css
.hp-command-palette {
  position: fixed; inset: 0; z-index: 100;
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 20vh;
  background: rgba(0,0,0,0.3);
  backdrop-filter: blur(10px);
}
.hp-command-palette-box {
  width: 520px; max-height: 420px; overflow-y: auto;
  background: var(--hp-material-elevated);
  border-radius: var(--hp-radius-lg);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.hp-command-palette-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 16px;
}
.hp-command-palette-item[data-selected] {
  background: var(--hp-accent);
  color: #fff;
}
```

### 3.2 Chat.tsx logic changes

```
Before: <SlashMenuDropdown items={commands} />  (positioned under input)

After:
  on "/" prefix → setCommandPaletteOpen(true)
  on Esc / click-outside → dismiss
  on ↑↓ → move selection index
  on ⏎ → execute selected command, dismiss
  render: <CommandPaletteOverlay items={filteredCommands} selectedIndex={...} />
```

**Fuzzy filter**: `command.name + command.description` against user input after `/`. Case-insensitive, substring match with typo tolerance for 1-char deviation.

**Categories** (grouped with subtle section headers):
- 会话 (Session): new-chat, switch-session, search-sessions
- 审批 (Approval): approve, deny
- 工具 (Tools): list-tools, toggle-tool
- 系统 (System): settings, status

---

## 4. Test Commands

```bash
# Baseline
npx vitest run tests/screen-boundary-contract.test.ts

# Chat-specific (if any slash-menu tests exist — grep first)
# No existing tests known to assert old dropdown DOM structure

# Visual QA
# Type "/" in Chat composer → verify palette appears centered with blur backdrop
# Type partial command name → verify fuzzy filter
# Arrow keys → verify navigation
# Esc → verify dismiss
```

---

## 5. Rollback

```bash
git checkout -- src/renderer/src/screens/Chat/Chat.tsx src/renderer/src/assets/main.css
```

---

## 6. Forbidden Items Check

Per audit §J (2026-06-11):

| Item | Status |
|------|--------|
| Global cross-page command dispatch | NOT in scope — Chat-internal only |
| Native window compositing | NOT in scope |
| Message history reversal UI | NOT in scope |
| Knowledge write/drag/live-injection UI | NOT in scope |
| Structured approval protocol (ACUI event) | NOT in scope |
| New IPC channels | ZERO added |
| Package dependency changes | NONE |

---

## 7. Approval Gate

- [ ] User confirms palette dimensions (~520px wide, 20vh from top)
- [ ] User confirms category grouping vs flat list
- [ ] User confirms no cross-page actions (only Chat-scoped commands)
- [ ] Execute after `UI-CN-001a` (Chinese descriptions in command palette)
