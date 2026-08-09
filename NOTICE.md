# NOTICE — HCC Decision + Contract Framework

## Source

This repository is a derivative work extracted from:

- **Source repo:** [`a272731059-dev/hermes-pro`](https://github.com/a272731059-dev/hermes-pro)
- **Source commit:** `1427626efca618b8ab9e10418dc1425998f58683` (2026-08-09)
- **Upstream chain:**
  - `a272731059-dev/hermes-pro` ← staging fork of
  - `HammerTech-Z/hermes-pro` ← source fork of
  - `fathah/hermes-desktop` ← upstream (https://github.com/fathah/hermes-desktop)

## Original authorship

The HCC framework was designed and implemented by the Hammer Agent / Hermes
Pro team during May–August 2026. Individual commits in this repo retain
their original authorship; consult `git log` for per-commit attribution.

The upstream hermes-desktop project credits:

```
Hermes Agent Desktop — self-improving AI assistant
Built by: fathah
Homepage:  https://github.com/fathah/hermes-desktop
```

## Scope of extraction

This extraction contains **only the HCC decision and contract framework**
plus related decision records, closeout documents, and preflight / go-no-go
plans. The following are **intentionally excluded**:

- Hermes Desktop Electron application code (renderer, main IPC)
- User authentication and account management
- Knowledge vault and persistent state stores
- Provider integrations (OpenRouter, Anthropic, etc.)
- Runtime configuration files (`~/.hermes/**`)
- User data, telemetry, or secrets

## Why an extraction, not a fork

The canonical authority decision
([§4](docs/decision/hammer-agent-stage1-authority-decision-2026-07-17.md))
remains in the source repository. This extraction exists to make the HCC
contract surface auditable in isolation, **without inheriting the runtime
authority** that the source repo carries via its connection to a live
Hermes installation.

**Cloning this repository does not enable any runtime capability.**
All `night_run_ready`, `go_no_go`, and similar guards remain literal-false
at the TypeScript level.

## License compatibility

- Upstream hermes-desktop: MIT (see upstream `LICENSE`)
- HCC contracts in this extraction: MIT (inherited)

If you fork this repo, you must preserve:

1. The `LICENSE` file (MIT terms)
2. This `NOTICE.md` file (attribution chain)
3. The pointer in `README.md` to the canonical authority decision

## Trademarks

"Hammer Agent" and "HCC" are project-internal names. "Hermes" and "Hermes
Agent" are project names from the upstream ecosystem. This extraction makes
no claim to those marks beyond descriptive reference.
