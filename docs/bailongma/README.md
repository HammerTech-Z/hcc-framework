# BaiLongma Design Documents

Design documents for the BaiLongma task cockpit and cognitive orchestration layer.

## Documents

| Doc | Status | Content |
|-----|--------|---------|
| [01-scope-and-role.md](./01-scope-and-role.md) | Draft | Definition, user journeys, relationship matrix, non-goals, Layer 1 decision, reference project boundaries |
| [02-acui-protocol.md](./02-acui-protocol.md) | Draft | ACUI protocol: concepts, envelope, component commands, task lifecycle, error model, examples |
| [03-visual-and-integration.md](./03-visual-and-integration.md) | Draft | Product placement, visual model, ACUI→React mapping, minimum POC, integration boundaries, wireframe |

## Layer Roadmap

| Layer | Focus | Status |
|-------|--------|--------|
| Layer 1 | Scope and Role | Draft |
| Layer 2 | ACUI Protocol | Draft |
| Layer 3 | Visual and Integration | Draft |
| Layer 4 | POC Implementation | Completed |

## Current Status (2026-05-28)

| Phase | Status |
|-------|--------|
| Design loop | Completed |
| POC-1 (static skeleton) | Completed |
| POC-2 (readonly cron data) | Completed |
| Manual QA | Pending |

### Completed Features

- BaiLongma top-level screen: `src/renderer/src/screens/BaiLongma/BaiLongma.tsx`
- Layout integration: `bailongma` view in NAV_ITEMS with Monitor icon
- i18n labels: `navigation.bailongma` in en/zh-CN
- POC badge: "Read-only POC · No new IPC · No writes · Real cron data"
- Real cron data via `window.hermesAPI.listCronJobs(true, profile)`
- Error classification: rate_limited / permission_required / connection_failed / unknown
- Stats display: total / ok / error counts
- ACUI Event Log generated from real data

### Hard Boundaries Maintained

- ✅ No new IPC handles introduced
- ✅ No modifications to src/main
- ✅ No modifications to src/preload
- ✅ No new database tables
- ✅ No writes to cron jobs
- ✅ No writes to Memory / Vault / Knowledge
- ✅ No WeChat send operations
- ✅ No model inference calls
- ✅ No background TICK service
- ✅ No Memory SQLite migration

### Pending Manual QA

- [ ] Start Hermes Pro app
- [ ] Open BaiLongma screen from sidebar
- [ ] Verify no layout overflow in real window
- [ ] Verify Schedules / AgentMonitor still open correctly
- [ ] Verify cron data displays (readonly, no write actions)

## Key Design Decisions

- BaiLongma is a **supplement** to existing modules, not a replacement.
- ACUI is a **message contract format**, not a rendering layer.
- Layer 2 does **not introduce new IPC handles**.
- POC uses existing Hermes Pro APIs only — no new database tables, no new IPC domain.
- Memory SQLite migration (TD-PERSIST-002) is **not** a prerequisite for BaiLongma.
- TICK background service is a **Layer 4+** concern, not a POC requirement.

## Reference Project

[BaiLongma (数字意识框架 v2.1.179)](https://github.com/xiaoyuanda666-ship-it/BaiLongma)

Design principles borrowed (not implementation promises):
- TICK-driven thinking (continuous operation awareness)
- Focus stack (multi-frame attention tracking)
- L1/L2 dual-layer thinking (fast vs deep processing)
- Context collector (pre-execution adequacy check)
- ACUI component system (ui_show / ui_update / ui_hide)

Explicitly not borrowed:
- Social platform distribution
- Voice system
- Automatic resource scanning
- Tool marketplace
- LLM Provider activation page
