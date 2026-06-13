# HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001 — Host Wiring Preflight

- Task: `HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001`
- Date: 2026-06-13
- Branch: `hermes-pro-main`
- Predecessor (closed): `HCC-AUTO-EXECUTOR-AUTH-IMPL-001` — committed at `466e42b` (on `origin`)
- Scope: **docs-only preflight for wiring the boundary into a host runtime**. No host code, no startup, no surface open.

---

## 1. Current baseline (verified locally 2026-06-13)

| Fact | Value |
|---|---|
| `git rev-parse HEAD` | `f57da75f150705c314278361b7cc7228d7d0c3e6` |
| `git rev-parse origin/hermes-pro-main` | `f57da75f150705c314278361b7cc7228d7d0c3e6` |
| HEAD == origin | **true** |
| Audit preflight (on origin) | `a6503ac2fdd0406d972e6b072886df1b6bed234f` |
| Audit closeout (on origin) | `041cf3a12e8608a576133c0e111d6aae81d6803e` |
| Implementation preflight (on origin) | `be7053fd5e7ec538aaed8d8fec60e9c31546bc0d` |
| Implementation (on origin) | `466e42bb0d0105f20693d211c8d42c8415afceb7` |
| Implementation buglog (on origin) | `d0062abad3ee87a6670816c8cfebdb00326f0430` |
| Latest vault snapshot (on origin) | `f57da75f150705c314278361b7cc7228d7d0c3e6` |
| Boundary library | exists at `src/shared/lib/auto-executor/**` (10 files) |
| Default OFF | true (no file in `src/main/**` imports the boundary) |
| Host imports it | **none** |
| Targeted vitest (boundary) | **3 files, 57 tests, PASS** |
| Full vitest | **157 files, 4223 tests, PASS** |
| `npm run typecheck` (node + web) | PASS |
| `lock-verify.sh` | `PASS=46 FAIL=0` |
| `git diff --check` | clean |

## 2. Working tree at preflight time (named explicitly — no false clean-state claim)

| Path | Status | Reason | Action this commit |
|---|---|---|---|
| `.claude/settings.json` | `M` | Local Cozempic harness config | **excluded by policy** — not staged, not restored, not modified |
| `docs/knowledge/vault-health-report-2026-06-12.md` | `M` | Generated telemetry drift (re-snapshot on disk after `f57da75`) | **excluded from this preflight commit** — same shape as drift already captured at `f57da75`; will be handled in a separate vault-snapshot commit if and when user GO is issued |

Two files dirty. Neither is part of this preflight. Neither is staged by this commit.

## 3. Verification (gates re-run at preflight time)

| Gate | Result |
|---|---|
| `git status --short -uall` | `M .claude/settings.json` + `M docs/knowledge/vault-health-report-2026-06-12.md` (see §2) |
| `git rev-parse HEAD` | `f57da75f150705c314278361b7cc7228d7d0c3e6` |
| `git rev-parse origin/hermes-pro-main` | `f57da75f150705c314278361b7cc7228d7d0c3e6` |
| `npm run typecheck` (node + web) | PASS |
| `npx vitest run tests/auto-executor/` | 3 files, 57 tests, PASS |
| `npx vitest run --config vitest.config.ts` | 157 files, 4223 tests, PASS |
| `git diff --check` | clean |
| `bash ~/hermes-pro-work/scripts/lock-verify.sh` | `PASS=46 FAIL=0` |

---

## 4. Host wiring contract (the core of this preflight)

### 4.1 Where the host may live

**Permitted locations** (any one):
- `src/main/auto-executor-host.ts` — a new main-process module dedicated to the host.
- `src/main/safety/auto-executor-host.ts` — a sibling of the existing `safety/` modules, consistent with how `audit-log`, `rollback-strategy`, etc. are organized today.

**Forbidden locations**:
- `src/main/index.ts` — the main-process bootstrap. The host must **not** be imported here. Bootstrapping the host is a separate explicit GO.
- `src/preload/**` — the host must not be reachable from the renderer. The boundary library is `@shared/lib/auto-executor`; the host is `@main/safety` or `@main/auto-executor-host`. Both are main-process-only.
- `src/renderer/**` — the renderer must never import the boundary or the host. The renderer is a view; the boundary is a side-effect gate. They must not meet.

### 4.2 What the host may import

| Permitted | Why |
|---|---|
| `createAutoExecutorBoundary` from `@shared/lib/auto-executor` | The boundary composer is the host's primary dependency. |
| `mintArmToken` from `@shared/lib/auto-executor` | The host mints the arm token if it is the issuer; in v1 the host may receive the token from the GO record instead. |
| `createMemoryAuditAppender` from `@shared/lib/auto-executor` | The host supplies the in-memory appender for tests and dry-run. |
| `createActionRecord`, `revertAction` from `@shared/lib/auto-executor` | The host wires rollback records for the actions it queues. |
| `appendAuditEntry` from `@main/safety/audit-log` | The host supplies a real appender that persists to `~/.hermes/audit/` (only when a `~/.hermes` write is separately approved per the §4.8 hermes-write-guard). |
| Node built-ins (`node:fs`, `node:child_process`, `node:crypto`, `node:os`) | Host-level orchestration. Use of `node:child_process` must go through `boundary.safeExec.validate(...)` first. |

### 4.3 What the host must NOT import

| Forbidden | Why |
|---|---|
| Anything from `src/main/index.ts` at module-load time | Bootstrapping the host from the main process entry is the activation step; that is the **separate GO**, not the wiring step. |
| `createHermesWriteGuard` from `@shared/lib/auto-executor` (as a default-on constructor) | The guard must be explicitly constructed and configured per-host, with a `tokenSecret` that is the same secret the GO record uses to mint per-write tokens. Constructing it with a default secret is forbidden. |
| `createSecretAccessor` with a non-empty `allowlist` | The accessor is closed-by-default. The host must enumerate the specific secrets it needs; an empty allowlist is the only safe starting state. |
| `safeExec` allowlist entries other than the empty set | The default `safeExec` allowlist is empty (no subprocesses). Each entry is a separate GO. |
| `react`, `react-dom`, anything in `src/renderer/**` | The host is main-process; the boundary is main-process; they do not cross to the renderer. |
| The audit-log file at `~/.hermes/audit/*.jsonl` directly | All audit writes go through the boundary's appender. Bypassing the appender breaks the hash chain and the chain-verification property. |

### 4.4 Bootstrap activation — explicitly NOT part of this preflight

Wiring the host into `src/main/index.ts` (or any main-process bootstrap path) is **not** in scope. The host, once written, sits unused. Activation is a separate explicit GO whose gate pass must:
- Re-run §5 gates on the host's working copy.
- Demonstrate the arm → start → mock-action → abort lifecycle in a test.
- End with a separate explicit GO request for any surface opening.

---

## 5. Lifecycle test contract (what the host's tests must prove)

The host's test file (e.g. `tests/auto-executor/host-lifecycle.test.ts`) must demonstrate, in order:

1. **Construction without state change.** Constructing the host does not mutate global state, does not start polling, does not open any file handle. Verified by snapshotting `process.env`, `fs` open file count, and active timers before/after construction; all unchanged.
2. **Arming with an invalid token refuses.** `host.arm({ goRecordSha: "...", mac: "00..." })` returns `false`. Boundary state remains `constructed`. `assertReady` returns `{ok: false, reason: ...}` with a non-actionable detail.
3. **Arming with a valid token flips state to `armed`.** `host.arm(mintArmToken(sha, secret))` returns `true`. State becomes `armed`.
4. **assertReady proceeds only when the live state matches the pinned state.** Pass: same `repoRoot/branch/head/cwd`, no dirty paths. Fail cases (one test each): branch mismatch, head mismatch, cwd mismatch, repoRoot mismatch, non-excluded dirty path.
5. **`start()` flips state to `running` only when armed.** Pass: `start()` returns `true` and state becomes `running`. Fail: calling `start()` from `constructed` returns `false`.
6. **Action is a mock / no-op.** The host's action function is replaced with a `vi.fn()` or a no-op stub for the lifecycle test. The real `safeExec.validate()` is invoked with a known request, and the result is asserted to be `{ok: true}` (or `{ok: false}` for negative cases), but **the boundary does not itself spawn the subprocess**. Spawning is the host's job and is mocked in the test.
7. **`abort()` is observable.** After `host.abort("test")`, the kill switch's `signal.aborted` is `true`, `isKilled()` returns `true`, and `assertReady` returns `{ok: false}` with detail mentioning the kill reason. State becomes `aborted`.
8. **`disarm()` while running is a no-op.** `disarm()` returns without changing state when state is `running`. State must remain `running` until `abort()`.

The lifecycle test runs against a `vi.fn()`-mocked audit appender and a `createMemoryAuditAppender()` instance; it must not touch `~/.hermes/audit/`. The appender mock asserts that `append()` was called the expected number of times for each phase (arm, start, action, abort).

### 5.1 Empirical gates the host implementation must pass

Mandatory gates, all run from the host's intended working copy:

1. `git status --short -uall` — must show only policy-excluded dirt.
2. `git rev-parse HEAD` — must match the sha recorded in the host's GO record.
3. `git log --oneline -10` — must show the expected chain (audit preflight → closeout → impl preflight → impl → buglog → exec preflight).
4. `git diff --check` — no whitespace / conflict markers.
5. `bash ~/hermes-pro-work/scripts/lock-verify.sh` — `PASS=46 FAIL=0`.
6. `npm run typecheck` (node + web) — exit 0.
7. `npx vitest run tests/auto-executor/` — 3+1 host tests, all pass.
8. `npx vitest run --config vitest.config.ts` — 157+ files, all pass (no regression).
9. `~/.hermes/**` write audit — must be empty (or contain only paths covered by a separate `~/.hermes` write GO).

A GO is **invalid** if any gate is skipped or its result predates the current HEAD.

---

## 6. Execution redlines (hard, hold for host impl + activation GOs)

This preflight **does not**:

- Spawn any real subprocess.
- Open the apply path.
- Open Live Ranking mutation.
- Open Live Flush auto-apply.
- Write to `~/.hermes/**` (the host's test must use `createMemoryAuditAppender`; persistence is a separate `~/.hermes` write GO).
- Import the boundary from `src/main/index.ts` or any other main-process bootstrap.
- Modify `src/**` outside the host's designated file(s) (e.g. `src/main/auto-executor-host.ts`).
- Modify `tests/**` outside the host's designated test file(s).
- Modify `package.json` / `package-lock.json`.

If any of the above change as a side effect, that is a redline violation. Stop and report.

---

## 7. Decision

| Question | Verdict |
|---|---|
| Is the **host wiring scope** sufficient? | **YES** — §4 contract + §5 lifecycle test contract cover the minimum surface. |
| May the host preflight be **committed and pushed**? | **YES** — it is a docs-only artifact. |
| May the **host implementation** proceed? | **NO** — requires a separate `GO HCC-AUTO-EXECUTOR-EXEC-IMPL-001` with §5 gates re-run on the host's working copy. |
| Is **execution / startup** of Auto Executor authorized? | **NO** — closed. |
| Is any **write surface** opened by this preflight? | **NO** — apply path, Live Ranking mutation, Live Flush auto-apply, `~/.hermes/**` writes, `src/**` / `tests/**` / `package*.json` modifications all remain closed. |

## 8. Still NOT authorized (explicit redline list)

| Surface | State |
|---|---|
| Apply path | **closed** |
| Auto Executor runtime | **not started** |
| Live Ranking mutation | **closed** |
| Live Flush auto-apply | **closed** |
| `~/.hermes/**` writes | **off** (no per-write approval given) |
| `git push` of any execution-enabling change | **held** (this preflight is docs-only and may be pushed under a separate user GO) |
| `src/**` / `tests/**` / `package*.json` modification | **held** (no GO for host impl) |
| Bootstrap activation (importing host from `src/main/index.ts`) | **held** (no GO) |

Any drift from this table is a redline violation. Stop and report.

---

## 9. Bellard-perspective

- **One doc, one decision.** This preflight scopes the host wiring surface; it does not authorize the host, the bootstrap, the execution, the persistence, or the push. The decision recorded is "scope sufficient; preflight may be committed and pushed; host impl requires separate GO." No second decision smuggled in.
- **No executable surface touched.** Source, tests, deps, settings — untouched. Only `docs/plan/...` is new. The boundary library at `466e42b` is unchanged.
- **Dirty telemetry not mixed in.** Vault drift named in §2, classified, explicitly excluded. Will not ride this commit. Intent separation preserved across the full chain: audit preflight → closeout → impl preflight → impl → buglog → exec preflight.
- **Each precondition got the minimum, not the maximum.** §4 contract is the smallest wiring spec that lets the lifecycle test in §5 pass. It is not a full engine spec. That is correct for a preflight.
- **Exact commit landed or not.** `git rev-parse` used at every step. Staged set re-verified via `git diff --cached --name-only` before commit.
- **Boring is correct.** A preflight that says "scope the host, no host code, no startup" is the only useful preflight right now. Anything more is over-design.

## 10. Karpathy-perspective

- **No false clean-state claim.** §2 names both dirty files. The preflight does not say "tree clean." A reader cannot misread this as a clean-tree preflight.
- **Boundary library ≠ host wiring.** This preflight scopes the host, but the boundary is already in the tree at `466e42b` and sits idle. Two different statements: the boundary exists, and nothing imports it. The host preflight is the *scope* of the import, not the *fact* of the import.
- **Host implementation must pass its own gates.** §5 lists 9 gates the host impl GO must re-run. None is assumed satisfied by this preflight. None is assumed satisfied by any prior session, including the implementation at `466e42b`.
- **Unknowns named explicitly.** §4.3 lists what the host must NOT import; each entry has a "why" line. §6 lists the redlines. A "permitted by default" claim without a reason would be a lie.
- **No READY declaration.** The verdict (§7) is "scope sufficient; preflight may be committed and pushed; host impl requires separate GO." The word READY does not appear in this document and should not appear in the host impl doc unless the §5 gates are first run and recorded.
- **Audit/design/implementation/execution chain preserved.** Closeout `041cf3a` recorded the audit. Impl preflight `be7053f` scoped the implementation. Implementation `466e42b` materialized the boundary. This preflight scopes the host. None of these is the host, the bootstrap, or the execution. Each link is a real artifact; each is a checkable step.

---

## 11. Next prompt (host implementation GO only, not host implementation itself)

> Execution preflight `HCC-AUTO-EXECUTOR-EXEC-PREFLIGHT-001` committed. Auto Executor **execution** is still NOT authorized. Auto Executor **host implementation** is unblocked as a separate step.
>
> Issue one of:
>
> 1. **`GO push exec preflight`** — push the preflight commit to `origin/hermes-pro-main`. Note: the vault drift on disk (`M docs/knowledge/vault-health-report-2026-06-12.md`) is uncommitted and will block the push until you decide what to do with it (commit separately / discard / leave dirty — each requires its own GO).
> 2. **`GO HCC-AUTO-EXECUTOR-EXEC-IMPL-001`** — begin the host implementation. Must (a) re-run §5 gates on the host's working copy, (b) implement the host per §4 contract, (c) implement the §5 lifecycle tests, (d) end with a separate explicit GO request for bootstrap activation. No bootstrap import, no surface open, no push of execution-enabling code.
> 3. **No GO** — stop here. Preflight stays local, vault drift stays dirty, no further work.
>
> The preflight itself is **not** pushed by this commit. Push requires a separate user GO.

---

## Appendix — preflight commit metadata (filled at commit time)

- Commit id: _filled by executor_
- Files staged: `docs/plan/hcc-auto-executor-exec-preflight-2026-06-13.md` (this file)
- Files NOT staged: `.claude/settings.json` (policy-excluded), `docs/knowledge/vault-health-report-2026-06-12.md` (telemetry drift, deferred)
- Push: **not performed** — held for separate user GO
