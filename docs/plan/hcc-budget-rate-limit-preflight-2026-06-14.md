# HCC-BUDGET-RATE-LIMIT-001 — Implementation Preflight

- Task: `HCC-BUDGET-RATE-LIMIT-001`
- Date: 2026-06-14
- Branch: `hcc-budget-rate-limit-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `99ce2de hcc: add rollback rehearsal contract`
- Scope: **budget / rate limit contract only**. No real execution. No `~/.hermes/**` write.

## 1. Canonical repo baseline

| Fact | Value |
|---|---|
| `HEAD` (worktree) | `99ce2de` (= `origin/hermes-pro-main`) |
| `origin` | `99ce2de` |
| HCC dry-run loop | closed (`9c514f7`) |
| HCC real action whitelist | landed (`ec1e8fe`) |
| HCC rollback rehearsal | landed (`99ce2de`) |
| real / unattended / `~/.hermes/**` write | NOT APPROVED / NO-GO |

## 2. Working tree

| Path | Status |
|---|---|
| `src/shared/lib/hcc-budget-rate-limit.ts` | A |
| `tests/auto-executor/hcc-budget-rate-limit.test.ts` | A |
| `docs/plan/hcc-budget-rate-limit-preflight-2026-06-14.md` | A |
| `docs/closeout/hcc-budget-rate-limit-001-closeout-2026-06-14.md` | A |
| `docs/plan/hcc-budget-rate-limit-go-no-go-2026-06-14.md` | A |

Not staged: `src/main/index.ts`, `package.json`, `~/.hermes/**`, vault-health telemetry.

## 3. Verification

| Gate | Result |
|---|---|
| typecheck:node | EXIT 0 |
| vitest budget-rate-limit | 24/24 PASS |
| vitest auto-executor | 11 files / 259 tests PASS |
| vitest safety | 36 files / 988 tests PASS |
| git diff --check | clean |
| locked files diff | empty |
| invariants | 6 hits, unchanged |
| forbidden substrings | doc comments only |

## 4. What this slice adds

`src/shared/lib/hcc-budget-rate-limit.ts` (~230 lines, pure):

- 6 hard caps: `max_task_count` (5), `max_wall_clock_ms` (30 min), `max_subprocess_count` (0), `max_token_budget` (500k), `max_output_bytes` (5M), `max_failure_count` (1)
- 3 gates: unattended_ready deny, hard stop on any cap exceeded, soft stop at >= 80%
- 4 verdicts: `within_budget`, `soft_stop_required`, `hard_stop_required`, `deny_unattended`
- Posture: literal-false `real_execution_ready`, `unattended_ready`, `night_run_ready`

## 5. Decision

| Question | Verdict |
|---|---|
| Contract sufficient? | **YES** |
| Commit? | **YES** |
| Push? | **held** |
| Real / unattended / night-run? | **NO-GO** |

## 6. Next prompt

> 1. **`GO COMMIT`** — commit 5 files.
> 2. **`GO PUSH`** — push to `origin`.
> 3. **No GO** — stop here.