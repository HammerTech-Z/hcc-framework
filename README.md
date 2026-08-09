# HCC Decision + Contract Framework

> **🚫 NO-GO: This framework does NOT execute, schedule, or auto-run anything.**
>
> All runtime execution, unattended execution, and writes to `~/.hermes/**` are
> explicitly locked at the type level by the canonical authority
> [`docs/decision/hammer-agent-stage1-authority-decision-2026-07-17.md`](docs/decision/hammer-agent-stage1-authority-decision-2026-07-17.md)
> §4 (user-confirmed 2026-07-18).
>
> **Reading this repo will not enable unattended execution.** That requires
> a new ADR, a human-gate confirmation, and a replacement decision record.

## What this is

A standalone snapshot of the **HCC (Hermes Control Contract)** decision and
contract framework as extracted from
[`hermes-pro`](https://github.com/a272731059-dev/hermes-pro).

It contains:

- **50 commits** of contract code (HCC lineage, 2026-05 → 2026-08)
- **Pure-TypeScript contracts** for dry-run decisions, authorization
  evaluation, rollback rehearsal, audit-actual-write, budget rate limits,
  plan state machines, and more
- **User-explicit trigger chains** for terminal / IPC / local invocation
- **Comprehensive test suites** covering each contract in isolation
- **Decision records and closeouts** documenting the NO-GO gates

## What this is NOT

- ❌ Not a runtime. No scheduler. No cron. No self-arming.
- ❌ Not a way to "turn on" autonomous agents.
- ❌ Not an executable. `clone → run` does **nothing** on its own.
- � Not a way to bypass the Stage-1 authority decision. That decision lives
  in the Hermes vault; copying the contracts out does not change authority.

## What you can do with it

1. **Read the contracts** — every TypeScript file in `src/shared/lib/hcc-*`
   is a self-documenting decision protocol with literal `false` / `"NO-GO"`
   type-level guards.
2. **Run the test suite** — `pnpm i && pnpm test` (or `npm`) exercises the
   full dry-run / fixture / contract surface against pre-canned inputs.
3. **Inspect decision artifacts** — the closeout records in
   `docs/closeout/hcc-*-closeout-*.md` document each slice's GO/NO-GO
   verdict.
4. **Audit the chain** — follow the commit graph from
   `f8f7e78 hcc: add hermes plan dry-run harness` forward; every subsequent
   commit explicitly preserves the NO-GO invariant.

## Repository layout

```text
.
├── README.md                                  ← this file
├── NOTICE.md                                  ← attribution + lineage
├── LICENSE                                    ← MIT (inherited from hermes-pro)
├── package.json                               ← minimal, only test deps
├── tsconfig.json                              ← strict TypeScript
├── vitest.config.ts                           ← test runner config
├── src/
│   ├── shared/lib/
│   │   ├── hcc-*.ts                           ← 40+ contract files
│   │   ├── safety/
│   │   │   ├── hcc-plan-state-machine-compact-agent-protocol.ts
│   │   │   └── hcc-task-handoff-policy.ts
│   │   ├── auto-executor/                     ← guarded helper files
│   │   ├── echobird-pattern-taxonomy.ts
│   │   └── post-task-reflection-hcc-fixture.ts
│   ├── cli/
│   │   ├── hcc-terminal-plan-invoker.ts
│   │   └── hcc-unattended-terminal.ts
│   └── main/
│       ├── hcc-*.ts                           ← task runner / artifact store
│       ├── auto-executor-*.ts                 ← host / dry-run action / arm / start
│       └── ipc-handlers/hcc-*.ts              ← unattended app IPC
├── tests/                                     ← contract test files
└── docs/
    ├── decision/
    │   ├── hammer-agent-stage1-authority-decision-2026-07-17.md   ← ⚖ CANONICAL
    │   ├── hummer-agent-versioned-rollout-final-approval-2026-07-29.md
    │   └── hummer-agent-versioned-rollout-plan-2026-07-29.md
    ├── plan/                                  ← preflight/go-no-go plans
    ├── closeout/                              ← per-slice closeout records
    └── adr/
        └── ADR-20260530-hcc-cockpit-readonly-poc.md
```

## Running the test suite

```bash
pnpm install       # or npm install
pnpm test          # or npm test
```

Tests are pure unit tests — no network, no subprocesses, no `~/.hermes/**`
writes, no real execution. Every test runs against pre-canned fixtures.

## Lineage

This repo is a **code-only extraction** (no runtime configuration, no user
data, no secrets) of the HCC framework as it existed in
[`a272731059-dev/hermes-pro`](https://github.com/a272731059-dev/hermes-pro)
at commit `1427626` (2026-08-09).

Upstream lineage:

```text
hermes-pro (HammerTech-Z fork)         ← source
  └─ a272731059-dev/hermes-pro         ← staging fork
       └─ hcc-framework (this repo)    ← extraction
            ↑ does NOT inherit runtime authority
```

The canonical authority decision
([§4](docs/decision/hammer-agent-stage1-authority-decision-2026-07-17.md))
remains in the source repo. This extraction exists solely to make the
contract surface auditable in isolation.

## License

MIT — see [LICENSE](LICENSE).

Attribution and derivative-work notice — see [NOTICE.md](NOTICE.md).

---

> ⚠ **Reminder for downstream users**: Cloning this repository does **not**
> enable unattended execution of any kind. The `night_run_ready` literal type
> remains `false`; the `go_no_go` literal type remains `"NO-GO"`. Any change
> to those literals requires the canonical authority decision to be replaced
> through the formal change process — see §4 of the decision record.
