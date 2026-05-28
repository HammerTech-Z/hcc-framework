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
| Layer 4 | POC Implementation | Not started |

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
