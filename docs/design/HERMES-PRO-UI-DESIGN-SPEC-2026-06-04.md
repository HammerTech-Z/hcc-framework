# Hermes Pro UI Design Spec — Mac Intelligence Console

> Status: SPEC ONLY. No renderer implementation is approved by this document.
> Scope: Hermes Pro visual direction, information architecture, and phased UI redesign plan.
> Ground truth: `docs/design/UI-GROUND-TRUTH-2026-06-04.md`.
> Research run: 2026-06-04 → `~/.hermes/pipeline-runs/HCC-20260604-UI-DESIGN-SPEC-REFERENCE-RESEARCH/01-report.md`.
> License boundaries: ClawPanel AGPL-3.0 → design pattern reference only, zero code copy. BaiLongma license unknown → visual/conceptual reference only, no code copy.

## 0. One-Line Direction

Hermes Pro should feel like a native macOS intelligence console: quiet, precise, dark-first, fast to scan, and futuristic without looking like a game HUD.

The product should not feel like a generic SaaS dashboard. It should feel like a local Apple-quality control surface for chat, knowledge, agents, runs, and safety state.

## 1. Reference Stack

| Reference | What To Borrow | What Not To Borrow |
|---|---|---|
| Apple macOS / HIG | low chrome, sidebar discipline, inspector pattern, restrained motion, system typography, vibrancy, split view, source list | marketing hero layouts, oversized decorative cards |
| BaiLongma | futuristic chat energy, cockpit status language, mission-progress framing, real-time thought stream display concept | dense wall-of-panels as default, voice runtime, social distribution runtime |
| ClawPanel | multi-engine agent console, AI assistant + memory + tools + service status architecture | AGPL code, direct visual clone, busy admin-panel feel |
| Hermes Kanban | durable task states, profile lanes, blocked/retry/run-history model | enabling dispatcher/runtime actions from UI by default |
| Obsidian | filesystem-first knowledge, wikilinks, graph/board mental model | turning Hermes Pro into a note editor clone |
| darwin-ui | glass-morphism component shapes, Badge variant model, Sidebar skeleton | glass as default for every card (use only for sidebar/inspector) |
| openclaw-nerve | session list as secondary nav, inline usage display, column-per-status kanban layout | voice runtime, subagent spawning UI |
| turbovault | frontmatter schema for knowledge cards, health check concept, typed link graph | Rust/MCP runtime integration |
| claude-obsidian | source taxonomy, provenance tagging, knowledge card shape | Obsidian dependency, Claude Code file hooks |
| awesome-design-md | DESIGN.md format for token spec (post-approval) | individual site visual tokens |

Design principle: borrow product ideas and layout patterns, not source code.
License policy: AGPL projects (ClawPanel) → patterns only, zero code copy.



## 2. Current UI Diagnosis

Current Hermes Pro is useful but not premium enough:

- Sidebar is a flat list of 18 routes, with no grouping, collapse mode, or global safety state.
- Chat has strong functionality but looks like a standard chat surface rather than the main AI cockpit.
- BaiLongma is the strongest "future cockpit" reference but is isolated as a screen.
- Knowledge is powerful but reads as a debugging tab set, not a knowledge-control system.
- CSS is centralized and large; reusable design components are not explicit enough.
- Token baseline: `--bg-primary: #212121` (flat admin gray, not graphite); accent `#003f7a` (navy) workable but not system indigo; Google Sans loaded locally rather than system-native SF Pro; no vibrancy/backdrop-filter tokens.

Target: keep the existing functional surface, then re-skin and reorganize it into a calm, native-feeling intelligence workspace.

### 2.1 Per-surface gap detail

**Layout.tsx** — 18 flat nav items, no groups, no collapse. Sidebar always visible; no icon-only mode. No inspector pane. No global safety-state badge.
**Chat.tsx** — Strong functional chat (slash menu, model picker, streaming) but no right inspector. References not surfaced. Voice entry absent. Slash menu styled as basic dropdown, not command palette. No focus-mode toggle.
**BaiLongma.tsx** — Functional 3-column cockpit, purely read-only, but card density very high. CSS classes `bailongma-*` prefix visually disconnected from the planned app shell. Typography and spacing not aligned with new design system.
**Knowledge.tsx** — 6 debug tabs (search / ingest / vault / gbrain / horizon / links). No provenance, no trust level, no stale detection, no lifecycle columns, no source type display. Ingest tab exposes live write path (boundary concern for future slices).
**main.css** — Token layer incomplete: no vibrancy tokens, no inspector surface, no command-palette token. Font stack prioritizes Google Sans over `-apple-system`.

## 3. Product Shape

Hermes Pro has three primary modes:

1. Chat
   The default home. A BaiLongma-inspired conversation surface with model state, references, tool progress, and safety context.

2. Mission Control
   The operational cockpit. Agent, Knowledge, Cron, Pipeline, Gateway, HCC dry-run, and frozen-state overview.

3. Knowledge Control
   The local knowledge operating system. Search, vault, provenance, trust, stale detection, typed links, and ingest review.

Everything else should hang off these three modes instead of competing as equal top-level destinations.

## 3.1 Apple / macOS Interaction Model (research-backed)

Adopted HIG patterns:

- **Sidebar (source list)** — 220-260px expanded, 56px icon rail collapsed. Disclosure triangles for groups. Selection uses `controlAccentColor` (system indigo). Group separators between buckets.
- **Inspector pane** — Right-side, contextual, collapsible. Width 240-280px. Never replaces the main content area. Toggle: `⌥⌘I`.
- **Toolbar / titlebar** — Unified. Traffic lights + title + contextual actions. No large hero chrome.
- **Split view** — Three independent panes (navigator | content | inspector), each resizable.
- **Vibrancy** — Translucent surfaces for sidebar + inspector: `backdrop-filter: blur(20px) saturate(180%)` layered over content background. macOS Tahoe 26 (2025) "liquid glass" trend reinforces translucency.
- **Typography** — System SF Pro Text 13px body, SF Pro Display for 15-16px app chrome, SF Mono for code/IDs/numbers. Letter spacing: 0 for body; `-0.3px` for medium labels.
- **Motion** — 150-200ms ease-in-out for transitions. Sidebar collapse: width + opacity. Inspector open: translate + opacity. No spring unless simulating physical objects. No decorative gradient animation.
- **Color** — Semantic role names: `label`, `secondaryLabel`, `tertiaryLabel`, `quaternaryLabel`. Layered graphite (`#1e1e1e` to `#2d2d2d`) instead of flat black. System indigo accent. `systemBlue`, `systemRed`, `systemGreen`, `systemOrange` for status.
- **Keyboard-first** — Every action has a shortcut. `⌘1`–`⌘9` for nav. `⌘N` for new chat. `⌘\` for sidebar collapse. `⌥⌘I` for inspector.
- **Window behavior** — Multi-window native feel. Cmd+W to close. Cmd+M to minimize. Traffic lights integrated.

What Hermes Pro adopts from this:
1. Sidebar collapse to 56px icon rail (`⌘\`).
2. Inspector pane width 260px slide-in.
3. `backdrop-filter` vibrancy on sidebar + inspector.
4. SF Pro system font stack; SF Mono for token counts, IDs, model names.
5. Semantic color tokens matching macOS role names.
6. Keyboard shortcuts for every primary action.

What Hermes Pro does NOT adopt:
- Mission Control / Exposé (overkill for single-window console).
- Tab bars (single workspace is intentional).
- Multi-window primary navigation (out of scope for v1 redesign).

## 4. App Shell

### Layout

Use a macOS-native three-zone shell:

- Left: collapsible navigation rail.
- Center: main workspace.
- Right: optional inspector pane.

Default desktop shape:

```text
┌──────────────────────────────────────────────────────────────┐
│ traffic lights / command title / global status / quick search │
├───────┬───────────────────────────────────────┬──────────────┤
│ rail  │ main workspace                         │ inspector    │
│       │ Chat / Mission / Knowledge             │ context      │
└───────┴───────────────────────────────────────┴──────────────┘
```

### Sidebar

The sidebar must be hideable. It should have two states:

- Collapsed: 56 px icon rail.
- Expanded: 220-240 px grouped navigation.

Navigation groups:

| Group | Items |
|---|---|
| Work | Chat, Sessions, Mission Control |
| Knowledge | Knowledge Control, Memory, Soul |
| Agents | Agents, BaiLongma, HCC Cockpit, Monitor |
| System | Models, Providers, Tools, Schedules, Gateway, Settings |

The current 18-item flat list should not survive the redesign.

### Top Bar

Top bar is not marketing chrome. It should carry operational context:

- current mode title
- active profile/model
- Hermes soft-switch state
- read-only / frozen state badge
- command/search entry
- compact update indicator

No large header hero, no decorative gradients.

### Inspector

The inspector is contextual and collapsible:

- Chat: references, local/web split, tool progress, token/cost summary.
- Mission Control: selected run/task/event details.
- Knowledge Control: selected knowledge item provenance/trust/stale state.

Inspector is the main way to avoid stuffing every page with cards.

## 5. Visual System

### Tone

Keywords:

- minimal
- local
- precise
- glass-light, not glassy
- futuristic, not neon
- Apple-like, not SaaS-like

### Theme

Dark-first, light optional.

Dark palette should move away from flat `#212121` admin gray into a more refined graphite system:

| Token | Direction |
|---|---|
| background | graphite black with slight blue/cool bias |
| surface | layered graphite, subtle border-only depth |
| accent | electric blue or system indigo, used sparingly |
| success | restrained green |
| warning | amber |
| danger | system red |
| text | SF-style high/secondary/tertiary contrast |

Avoid purple-blue gradient dominance, beige, brown/orange, and one-note blue.

### Typography

Use system-first typography:

- UI: `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, fallback sans.
- Numeric / code / IDs: `SF Mono`, `ui-monospace`, fallback mono.

Type scale:

| Role | Size |
|---|---:|
| app title | 15-16 px |
| section title | 13-14 px |
| body | 13-14 px |
| metadata | 11-12 px |
| dense IDs | 11 px mono |

No viewport-scaled font sizes. Letter spacing should remain 0 except tiny uppercase metadata labels.

### Shape

Baseline radius: 8 px.

Allowed:

- 6 px for compact list rows / chips.
- 8 px for panels and controls.
- 10 px for chat composer / inspector containers.

Avoid excessive 14-20 px rounded cards except for intentional chat bubbles or modals.

### Motion

Motion should be short and macOS-like:

- 120-180 ms transitions.
- sidebar collapse: width + opacity.
- inspector open: translate/opacity.
- no bouncy animation.
- no decorative orb/bokeh/gradient animation.

### 5.1 Visual Tokens v0 (research-backed additive layer)

Additive to existing `main.css` tokens. Existing tokens (--bg-primary, --accent, etc.) remain untouched in this spec; new tokens are layered as `--hp-*` prefix to avoid conflicts.

| Token | Dark value | Light value | Purpose |
|---|---|---|---|
| `--hp-bg-base` | `#1c1c1e` | `#fbfbfd` | base canvas (system group background) |
| `--hp-bg-surface` | `#2c2c2e` | `#ffffff` | panels, cards |
| `--hp-bg-surface-2` | `#3a3a3c` | `#f2f2f7` | hover, selected |
| `--hp-bg-elevated` | `#48484a` | `#ffffff` | popovers, modals |
| `--hp-bg-vibrancy` | `rgba(28,28,30,0.72)` | `rgba(251,251,253,0.72)` | sidebar / inspector backdrop |
| `--hp-label` | `#ffffff` | `#000000` | primary text |
| `--hp-label-secondary` | `rgba(235,235,245,0.6)` | `rgba(60,60,67,0.6)` | secondary text |
| `--hp-label-tertiary` | `rgba(235,235,245,0.3)` | `rgba(60,60,67,0.3)` | metadata |
| `--hp-label-quaternary` | `rgba(235,235,245,0.18)` | `rgba(60,60,67,0.18)` | disabled, dividers |
| `--hp-accent` | `#0a84ff` | `#007aff` | system blue / indigo |
| `--hp-success` | `#30d158` | `#34c759` | verified, ok |
| `--hp-warning` | `#ff9f0a` | `#ff9500` | candidate, stale candidate |
| `--hp-danger` | `#ff453a` | `#ff3b30` | stale, redacted, error |
| `--hp-divider` | `rgba(84,84,88,0.65)` | `rgba(60,60,67,0.29)` | separator lines |
| `--hp-blur-vibrancy` | `blur(20px) saturate(180%)` | `blur(20px) saturate(180%)` | backdrop-filter |
| `--hp-radius-sm` | `6px` | `6px` | chips, list rows |
| `--hp-radius-md` | `8px` | `8px` | panels, controls (default) |
| `--hp-radius-lg` | `10px` | `10px` | composer, inspector containers |
| `--hp-motion-fast` | `120ms ease-in-out` | same | hovers, toggles |
| `--hp-motion-base` | `160ms ease-in-out` | same | sidebar, inspector |
| `--hp-motion-slow` | `200ms ease-in-out` | same | modal, sheet |

Font stack (additive):

| Token | Value |
|---|---|
| `--hp-font-ui` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif` |
| `--hp-font-mono` | `"SF Mono", "JetBrains Mono", ui-monospace, monospace` |
| `--hp-font-display` | `-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif` |

Existing Google Sans load can remain as fallback only; `--hp-font-ui` takes precedence in the new shell.

**Naming convention open question (carried to §15.4)**: shadow vs additive — current proposal is additive `--hp-*` prefix.

## 6. Core Screens

### 6.1 Chat

Chat is the home screen.

Required direction:

- BaiLongma-inspired, futuristic conversation surface.
- Bottom composer as the visual anchor.
- Voice entry placeholder may exist but must be inert unless later approved.
- Left sidebar can be hidden for focus mode.
- Right inspector shows references and execution context.

Chat message layout:

- user messages can remain bubble-like.
- agent messages should be more document-native, less bulky bubble, especially for long Markdown/code.
- code blocks should feel like macOS developer panels: compact header, copy action, monospaced body.

Composer:

- single primary input surface.
- model/profile indicator is integrated, not a separate clutter bar.
- send/stop are icon buttons.
- slash menu remains, but should look like a command palette.

Inspector tabs:

- Local Knowledge
- Web Sources
- Agent Judgment
- Tool Progress

This directly answers the knowledge-reuse workflow: before answering, Hermes can surface whether local knowledge exists, what is stale, and whether web verification is needed.

#### 6.1.1 Chat Experience — Detailed Model (research-backed)

BaiLongma-inspired conversation surface. Key patterns:

**Composer (bottom, visual anchor):**
- Single primary textarea, 13-14px, SF Pro Text.
- Integrated model/profile indicator (no separate clutter bar above). Inline pill: model name + provider + base url if custom. Click opens picker as popover.
- Send / stop as icon buttons (right edge).
- `/btw` quick-ask button appears when `hermesSessionId` exists and input is non-empty.
- Voice entry: mic icon, right of send, **must be inert** (visually present, no runtime). Tooltip: "Voice coming soon" (TBD by Open Question §15.2).
- Slash menu: opens on `/` prefix, styled as a command palette (centered, ~520px wide, frosted background, fuzzy filter, ↑↓ navigate, ⏎ select, esc dismiss). Categories grouped with subtle section headers.

**Message layout:**
- User messages: rounded bubble (8px radius), agent-bubble-style background, max 70% width.
- Agent messages: document-native (no heavy bubble), full width, monospace for code blocks. Code blocks: macOS developer panel feel — compact header (language label + copy icon), monospaced body, `var(--code-bg)` surface.
- Approval bar: appears when APPROVAL_RE matches last agent message. Two buttons: Approve / Deny. Compact row, right-aligned.

**Right inspector (collapsible, default closed for first-time users, default open for power users):**

| Tab | Content | Source |
|---|---|---|
| Local Knowledge | matched vault files with trust badges | `knowledgeSearch` (read-only) |
| Web Sources | URLs / web result snippets (when used) | `chat chunk` payload |
| Agent Judgment | reasoning summary, tool decisions, focus frame | `chat chunk` payload |
| Tool Progress | live tool calls (file read, search, memory recall) | `onChatToolProgress` IPC |

**Model / profile / status strip** (under composer, compact single row, ~24px high):
- Model + provider + base url (if custom)
- Profile (if not default)
- Hermes soft-switch state (candidate v0.15.1 indicator)
- Read-only / frozen badge if applicable
- Token count + cost (right-aligned, mono font, secondary label color)
- Fast mode toggle (existing) stays as icon button

**Focus mode:**
- `⌘\` (or narrow window): hide left sidebar.
- `⌥⌘I`: toggle right inspector.
- `Esc` in empty composer: exit focus mode (show sidebar).

**Keyboard shortcuts:**
- `⌘N` — new chat (existing).
- `⌘K` — open sessions (existing).
- `⌘\` — toggle sidebar.
- `⌥⌘I` — toggle inspector.
- `⌘/` — focus composer.
- `↑↓` in slash menu — navigate (existing).
- `Esc` — dismiss slash menu (existing).
- `Enter` (without Shift) — send (existing).
- `Shift+Enter` — newline (existing).

**No-goals in Chat:**
- No live write path to vault from composer.
- No voice capture (inert placeholder only).
- No persistent voice indicator / VU meter / waveform animation.
- No drag-drop file upload (out of v1 redesign scope; add to Open Questions).

### 6.2 Mission Control

Mission Control replaces the idea of many isolated admin pages.

It should summarize:

- Hermes Agent state
- Gateway state
- Knowledge state
- Cron/local delivery state
- HCC dry-run state
- Pipeline runs
- P3.5 KEEP v0.15.1 state
- frozen blockers

Use dense status rows and event streams, not decorative metric cards everywhere.

Recommended layout:

```text
Top: global health strip
Left: active systems
Center: timeline / recent runs
Right: safety and frozen items inspector
Bottom: recent events
```

Borrow from ClawPanel:

- multi-engine overview
- built-in assistant as operator
- memory/profile/tool visibility

Do not borrow:

- direct runtime controls as default actions
- busy service-dashboard clutter

### 6.3 Knowledge Control

Knowledge Control is a new page, separate from the existing Knowledge search screen.

It should answer:

- What knowledge do I have?
- Where did it come from?
- Can I trust it?
- Is it stale?
- Is it linked to related notes/tasks?
- Can it be safely injected into future answers?

Primary board:

| Column | Meaning |
|---|---|
| Inbox | captured but unreviewed |
| Candidate | extracted / compared, needs verification |
| Verified | trusted local reference |
| Linked | connected via typed links / wikilinks |
| Stale | needs refresh or web re-check |
| Archived | retained but not active |

Each knowledge card should show:

- title
- source type: GitHub / web / local note / agent report
- trust level
- provenance count
- last verified date
- stale marker
- redaction status

Right inspector:

- full provenance
- linked notes
- related tasks
- local vs web answer policy
- allowed prompt-use state

This borrows from Obsidian and Kanban, but remains a control surface, not a freeform note editor.

#### 6.3.1 Knowledge Control — Detailed Model (research-backed)

Card schema (frontmatter-driven, derived from turbovault/claude-obsidian):

| Field | Type | Source |
|---|---|---|
| `id` | string (vault path) | file path |
| `title` | string | frontmatter or filename |
| `kind` | enum | wiki / skills / failure-lessons / raw / horizon_summary / understand_result / vault_file |
| `source_type` | enum | github / web / local_note / agent_report / conversation |
| `source_url` | string? | frontmatter |
| `captured_at` | ISO date | file mtime or frontmatter |
| `verified_at` | ISO date? | frontmatter (optional) |
| `trust_level` | enum | unverified / candidate / verified / authoritative |
| `redaction_status` | enum | clean / partial / redacted |
| `stale` | bool | derived (no `verified_at` AND `captured_at` > 30d) |
| `provenance_count` | int | derived (number of source refs) |
| `linked_notes` | id[] | wikilink graph |
| `linked_tasks` | id[] | derived from comment/task references |
| `allow_prompt_use` | enum | yes / prefer_local / ask_first / no |
| `local_preferred` | bool | derived from allow_prompt_use |

Lifecycle columns (kanban-inspired from Hermes Kanban + openclaw-nerve):

| Column | Enter when | Exit when |
|---|---|---|
| Inbox | captured but unreviewed (no `trust_level`) | user marks as Candidate or Archived |
| Candidate | `trust_level = candidate` | user promotes to Verified (sets `trust_level = verified` + `verified_at`) |
| Verified | `trust_level = verified` with `verified_at` within window | becomes Linked (typed link added) or Stale (window exceeded) |
| Linked | has at least one typed link to another verified note | user unlinks or marks Stale |
| Stale | `verified_at` older than 30d, OR `stale = true` | user re-verifies (sets new `verified_at`) or Archives |
| Archived | user explicitly archives | hidden from default view; remains in vault |

Inspector (right pane) for a selected card:

- **Provenance**: full chain (source URL, capture method, mtime, frontmatter, hash if available)
- **Linked notes**: typed links (`elaborates` / `supersedes` / `depends_on` / `repeats`) with confidence scores
- **Related tasks**: kanban task IDs that reference this card
- **Answer policy**: `allow_prompt_use` + `local_preferred` summary in plain language
- **Audit trail**: when promoted, who/what set `trust_level` and `verified_at` (read-only display; no live write)

Board interactions (read-only for v1 redesign):
- Drag-drop between columns: allowed only for explicit promote/archive actions routed through existing `knowledgeSearch` / `readVaultFile` / `listVaultFiles` IPC (no new write IPC).
- Card click: opens inspector.
- Filter chips: by `source_type`, by `kind`, by `trust_level`, by `stale`.
- Search: reuses existing `knowledgeSearch` IPC (read-only).
- NO live write path to vault from this surface. Ingest remains in the existing Knowledge.tsx ingest tab.

Badge vocabulary:

| TrustBadge | Color | When |
|---|---|---|
| verified | system green | `trust_level = verified` AND not stale |
| authoritative | system indigo | `trust_level = authoritative` |
| candidate | system orange | `trust_level = candidate` |
| unverified | label/quaternary | no `trust_level` |
| stale | system red | `stale = true` |

Stale detection rules (deterministic, no LLM):
- No `verified_at` set → stale candidate (prompts user to verify)
- `verified_at` older than 30 days → stale
- `source_type = web` with `captured_at` older than 7 days → stale candidate (web content rots faster)
- User can override: setting `verified_at` to today clears the stale flag

### 6.4 BaiLongma

BaiLongma should become the visual reference for futuristic cockpit language.

Keep:

- read-only safety boundary
- phase/risk/next-action language
- event/runs/status density

Improve:

- reduce card density
- use inspector instead of too many panels
- align colors and typography with the new shell

Productionization remains NOT APPROVED.

### 6.5 Settings / Tools / Models

These should become quieter macOS preference panes:

- left subnav
- right form/detail area
- compact sections
- native toggle/segmented control styling
- no dashboard-style cards

## 7. Component Foundation

Do not start by redesigning every screen.

Add a small explicit design-system layer first:

| Component | Purpose |
|---|---|
| AppShell | rail + topbar + workspace + inspector |
| SidebarGroup | grouped nav |
| StatusBadge | frozen/read-only/active/pass/fail |
| Panel | restrained bordered surface |
| SectionHeader | title + small actions |
| MetricRow | compact label/value row |
| EventRow | time + type + description |
| SourceChip | local/web/agent/source marker |
| TrustBadge | verified/candidate/stale/redacted |
| EmptyState | quiet, no marketing copy |
| LoadingState | compact spinner/text |
| CommandButton | icon-first command button |

Keep cards only for repeated items, drawers, and true framed tools. Do not put cards inside cards.

## 8. Safety UX

Safety should be visible but not noisy.

Global badges:

- Read-only
- Dry-run
- Frozen
- KEEP v0.15.1
- Productionization NOT APPROVED

Rules:

- No UI text may imply HCC Auto Executor is active.
- No UI may imply hard cutover is complete.
- No UI may imply L6 live knowledge flush is enabled.
- No UI may trigger handoff/audit writes from design-only work.
- Any future action button must declare read/write/runtime class.

For now, dangerous controls should either be absent or visibly disabled with concise reason text.

## 9. Implementation Slices

Implementation must happen only after user approval.

### Slice 0 — Contract Audit

No visual changes.

- enumerate current screens
- enumerate IPC/data sources
- confirm read/write/runtime boundaries
- update UI ground truth if needed

### Slice 1 — Design Tokens + Components

Add token block and reusable components only.

- colors
- spacing
- type scale
- radius
- status badges
- panel primitives

No screen restyle yet.

### Slice 2 — App Shell

Implement:

- collapsible icon rail
- grouped sidebar
- top status bar
- inspector container

Keep existing routes.

### Slice 3 — Chat Home

Redesign Chat around:

- BaiLongma-inspired composer
- command palette slash menu
- reference inspector
- focused mode

### Slice 4 — Mission Control

Unify BaiLongma/HCC/monitor facts into one read-only cockpit surface.

No productionization.
No new runtime actions.

### Slice 5 — Knowledge Control Board

Add new route:

- board columns
- source/trust/stale/provenance cards
- read-only inspector

Existing Knowledge search remains available.

### Slice 6 — Preference Panes

Quietly restyle Settings / Models / Providers / Tools.

### Slice 7 — Polish

Accessibility, responsive rules, keyboard shortcuts, snapshot tests, and final visual pass.

## 10. Non-Goals

See §14 (Implementation Guardrails) for the full hard-boundary table. This design does not approve any of those items.

In one line: this spec is **read-only + design-only** — no runtime writes, no P3 execution, no productionization, no AGPL/BaiLongma code copy, no roadmap mutation.

## 11. Acceptance Criteria

### 11.1 Spec-level (this document)

1. User has approved this design direction in writing.
2. UI ground truth (`docs/design/UI-GROUND-TRUTH-2026-06-04.md`) is still current (no unaddressed V1-V7 change).
3. All §14 guardrails (G-01..G-15) are re-checked at every slice kickoff.
4. Section numbering is sequential 0-15; all cross-references resolve.
5. License boundary (ClawPanel AGPL, BaiLongma unknown) is restated at top of file.

### 11.2 Per-slice gates (applies to any implementation slice)

| Slice | Gate |
|---|---|
| Slice 0 — Contract Audit | Enumerates every IPC the touched screen uses; flags any new write IPC. No visual changes. |
| Slice 1 — Tokens | No existing token renamed or removed. Additive `--hp-*` only. typecheck + visual smoke. |
| Slice 2 — App Shell | Sidebar collapse via `⌘\`. Inspector via `⌥⌘I`. Existing routes preserved. typecheck green. |
| Slice 3 — Chat | Voice entry inert. Slash menu as command palette. Right inspector read-only. Existing `/btw`, fast mode, abort, approval flow preserved. |
| Slice 4 — Mission Control | Read-only cockpit. No new runtime actions. BaiLongma screen either renamed or aliased. Productionization NOT APPROVED label still visible. |
| Slice 5 — Knowledge Control | New route. Read-only via existing `knowledgeSearch` / `readVaultFile` / `listVaultFiles`. NO new write IPC. No drag-drop writes. Ingest remains in Knowledge.tsx. |
| Slice 6 — Preference Panes | macOS preference-pane layout. No card-on-card layout. Native toggle/segmented styling. |
| Slice 7 — Polish | A11y pass, keyboard-only walkthrough, snapshot tests, no decorative motion added. |

### 11.3 Cross-cutting

- `typecheck` and relevant tests remain green.
- No locked roadmap, handoff, or audit state is modified.
- No new IPC write handles without Slice 0 enumeration + ADR + user approval.

## 12. Final Design Sentence

Hermes Pro should look like a Mac app that quietly knows everything happening in your local AI system: chat in the center, knowledge and safety in the inspector, and mission state always one glance away.

## 13. Research-backed Design Requirements

Derived from the 2026-06-04 reference research run. Each requirement traces to a source.

| # | Requirement | Source |
|---|---|---|
| R-01 | Sidebar must collapse to 56px icon rail via keyboard shortcut | Apple HIG sidebar pattern |
| R-02 | Inspector pane width 240-280px, slide animation 160ms | Apple HIG inspector pattern |
| R-03 | Sidebar and inspector use `backdrop-filter` vibrancy (`blur(20px) saturate(180%)`) | Apple HIG vibrancy + macOS Tahoe 26 "liquid glass" |
| R-04 | System font stack: `-apple-system, "SF Pro Text"`; mono: `"SF Mono"` | Apple HIG typography |
| R-05 | No pure-black background; layered graphite `#1c1c1e` to `#3a3a3c` | Apple HIG macOS color |
| R-06 | Sidebar grouped into 4 buckets: Work / Knowledge / Agents / System | Apple HIG source list pattern; macOS-react source list reference |
| R-07 | Chat home has right inspector with 4 tabs: Local Knowledge / Web Sources / Agent Judgment / Tool Progress | BaiLongma Brain UI thought stream + ClawPanel inspector pattern |
| R-08 | Slash menu styled as command palette (centered, ~520px, frosted) | darwin-ui CommandMenu pattern + awesome-design-md patterns |
| R-09 | Knowledge Control board: 6 lifecycle columns (Inbox / Candidate / Verified / Linked / Stale / Archived) | openclaw-nerve column layout + Hermes Kanban lifecycle + claude-obsidian knowledge taxonomy |
| R-10 | Knowledge card schema uses frontmatter fields (source_type, trust_level, verified_at, stale, redaction_status) | turbovault frontmatter schema |
| R-11 | Stale detection: deterministic rules (no LLM); 30d for general, 7d for web sources | turbovault health check concept |
| R-12 | TrustBadge color vocabulary: verified=green, authoritative=indigo, candidate=orange, unverified=label, stale=red | darwin-ui Badge 13-variant model |
| R-13 | No voice runtime in composer; mic icon as inert placeholder with tooltip | hard boundary (no voice runtime) |
| R-14 | Voice entry, file drop, persistent indicator: all INERT placeholders only | hard boundary (UI scope) |
| R-15 | No code copy from ClawPanel (AGPL-3.0); design pattern reference only | ClawPanel license AGPL-3.0 |
| R-16 | No new IPC write handles in Knowledge Control board; all board interactions are read-only via existing IPC | ground truth §3; UI implementation gate |
| R-17 | Keyboard shortcuts on every primary action (sidebar `⌘\`, inspector `⌥⌘I`, focus composer `⌘/`) | Apple HIG keyboard-first |
| R-18 | Mission Control unifies BaiLongma + HCC + monitor facts into single read-only cockpit | ClawPanel multi-engine overview |
| R-19 | Existing Knowledge.tsx remains as search sub-page; Knowledge Control is a separate route | ground truth §3 explicit |
| R-20 | No live write path to vault from Knowledge Control; ingest stays in Knowledge.tsx ingest tab | ground truth §3; safety boundary |

## 14. Implementation Guardrails (hard boundaries, non-negotiable)

This spec does NOT approve:

| # | Boundary | Reason |
|---|---|---|
| G-01 | HCC Auto Executor | paused; not approved, not started, not wired |
| G-02 | P3 real execution | paused |
| G-03 | Productionization | NOT APPROVED |
| G-04 | hard cutover | unapproved |
| G-05 | Round 2 C | frozen |
| G-06 | L6 live knowledge flush | not enabled |
| G-07 | direct runtime writes from UI | not approved |
| G-08 | AGPL code copy from ClawPanel | license risk (AGPL-3.0) |
| G-09 | UI-TARS / browser-use / automation controls | out of scope for v1 redesign |
| G-10 | Live `knowledgeIngest` / `knowledgeSearch` write side | ground truth §3 explicit; UI must not enable |
| G-11 | Hermes Kanban dispatcher trigger from UI | not approved; UI is read-only |
| G-12 | New IPC handles in v1 redesign | slice 0 must enumerate existing IPC before any new handle is added |
| G-13 | Dev server start, `git commit`, `git push`, cron trigger, WeChat/iLink send | out of scope for spec-only work |
| G-14 | Writing to `~/.hermes/handoff/packs` or `~/.hermes/audit` | ground truth §4 explicit |
| G-15 | Modifying `docs/roadmap-locked-2026-05-28.md` | locked; ADR + user confirmation required |

Any UI implementation slice that touches one of these must surface a STOP marker and request explicit user approval before continuing.

## 15. Open Questions (carried forward)

Locked defaults (no longer open, can be revisited post-Slice 1):

- **Q4 Token naming** — LOCKED: additive `--hp-*` prefix. Existing tokens untouched. Override-shadow is rejected (too risky for a shell-only first slice).
- **Q9 BaiLongma CSS classes** — LOCKED: rename `bailongma-*` to `mission-*` in Slice 4 for visual unity. Existing Final Polish tests must still pass.

Still open (resolve before Slice 1 begins unless noted):

1. **Knowledge Control ingest boundary** — Should the existing `knowledgeIngest` tab in Knowledge.tsx be disabled, or kept as the only live write path? Default: keep as-is, do not duplicate.
2. **Voice entry placeholder styling** — Inert mic icon — tooltip "Voice coming soon" or fully invisible? Default: visible with tooltip.
3. **BaiLongma vs Mission Control merge** — Default: rename to "Mission Control" once Slice 4 ships; alias redirect for one release.
5. **Font stack adoption** — Adopt `-apple-system` as primary or keep Google Sans? Default: adopt system, keep Google Sans as fallback.
6. **File drop in composer** — Out of v1 or in? Default: out (requires new IPC for file attach).
7. **Inspector default state** — Open or closed for first-time users? Default: closed, with `⌥⌘I` discoverable via tooltip.
8. **Knowledge Control drag-drop write behavior** — Allowed via existing read-only IPC, or hidden behind explicit button? Default: hidden button, no drag-drop writes in v1.
10. **Settings / Models / Providers preference pane** — Restyle to macOS preference-pane layout, or keep current card layout? Default: preference-pane layout, slice 6.

These questions should be resolved before the first implementation slice (Slice 1) begins.
