# HCC-AUTO-EXECUTOR-BOOTSTRAP-001 — Implementation Preflight

- Task: `HCC-AUTO-EXECUTOR-BOOTSTRAP-001`
- Date: 2026-06-13
- Branch: `hcc-auto-executor-bootstrap-001` (worktree off `origin/hermes-pro-main`)
- Predecessor: `HCC-AUTO-EXECUTOR-EXEC-IMPL-001` (committed at `faf062a` on `origin`)
- Scope: **bootstrap helper + `src/main/index.ts` minimal edit + bootstrap tests**. Idle / disabled / no-start mode. No arm. No start. No action invocation.

---

## 1. Canonical repo baseline (verified locally 2026-06-13)

| Fact | Value |
|---|---|
| Worktree | `/Users/midoudou/hermes-pro-work/.claude/worktrees/hcc-auto-executor-bootstrap-001` |
| Branch | `hcc-auto-executor-bootstrap-001` (tracks `origin/hermes-pro-main`) |
| `git rev-parse HEAD` | `faf062ad76b25ee4d5253f89cea3fc30f6ec0d51` |
| `git rev-parse origin/hermes-pro-main` | `faf062ad76b25ee4d5253f89cea3fc30f6ec0d51` |
| HEAD == origin | **true** |
| Impl preflight (on origin) | commit `faf062a` (= base) |
| Host module | `src/main/auto-executor-host.ts` (existed at base) |
| Boundary library | `src/shared/lib/auto-executor/**` (10 files, idle) |
| New module | `src/main/auto-executor-bootstrap.ts` (~120 lines, pure helper) |
| Edited file | `src/main/index.ts` (1 import + 1 install call, both inside `app.whenReady`) |
| New test | `tests/auto-executor/bootstrap-integration.test.ts` (~130 lines, 15 tests) |
| Targeted vitest (`tests/auto-executor/`) | **5 files, 93 tests PASS** |
| Full vitest (`tests/safety`) | **36 files, 988 tests PASS** (no regression) |
| `npm run typecheck:node` | EXIT 0 |
| `git diff --check` | clean |
| `night_run_ready` literal | `false` (type-hard-wired, unchanged) |
| `go_no_go` literal | `"NO-GO"` (unchanged) |

## 2. Working tree at preflight time (named explicitly)

| Path | Status | Reason |
|---|---|---|
| `src/main/auto-executor-bootstrap.ts` | A | new bootstrap helper |
| `src/main/index.ts` | M | 1 import + 1 `installAutoExecutorHost()` call (no arm, no start, no runMockAction) |
| `tests/auto-executor/bootstrap-integration.test.ts` | A | new bootstrap vitest |
| `docs/plan/hcc-auto-executor-bootstrap-preflight-2026-06-13.md` | A | this preflight |
| `docs/closeout/hcc-auto-executor-bootstrap-001-closeout-2026-06-13.md` | A | closeout companion |
| `docs/plan/hcc-auto-executor-bootstrap-go-no-go-2026-06-13.md` | A | BOOTSTRAP GO/NO-GO report |

Files **NOT** staged by this commit:
- `package.json` / `package-lock.json` — untouched
- `src/shared/lib/auto-executor/**` — untouched (boundary library)
- `src/renderer/**` / `src/preload/**` / `src/screens/**` — untouched
- `~/.hermes/**` — not touched at all
- `docs/knowledge/vault-health-report-2026-06-12.md` — policy-excluded telemetry drift, not part of this slice

## 3. Verification (gates re-run at preflight time)

| Gate | Result |
|---|---|
| `git rev-parse HEAD` | `faf062ad76b25ee4d5253f89cea3fc30f6ec0d51` |
| `git rev-parse origin/hermes-pro-main` | `faf062ad76b25ee4d5253f89cea3fc30f6ec0d51` |
| `npm run typecheck:node` | EXIT 0 |
| `npx vitest run tests/auto-executor/` | 5 files, 93 tests PASS |
| `npx vitest run tests/safety` | 36 files, 988 tests PASS (no regression) |
| `git diff --check` | clean |
| `rg "night_run_ready: false\|go_no_go: \"NO-GO\"\|requires_user_approval\|Auto Executor" src tests docs` | hits in this slice + contracts (unchanged) |
| `rg "arm\(\|start\(\|runMockAction\(\|auto-executor-host" src/main/auto-executor-bootstrap.ts tests/auto-executor/bootstrap-integration.test.ts` | all matches are comments / negative tests, no actual call |

## 4. Bootstrap contract (the core of this preflight)

### 4.1 What the bootstrap does

`installAutoExecutorHost()` constructs **one** host via `createAutoExecutorHost(config)` and stores it in a module-scoped frozen handle. The function is **idempotent**: a second call returns the existing handle without constructing a second host.

### 4.2 What the bootstrap does NOT do

| Forbidden | Why | Enforcement |
|---|---|---|
| `host.arm(token)` | arming is held for a separate explicit GO | not called; pinned by test "does NOT call host.arm()" |
| `host.start()` | starting is held for a separate explicit GO | not called; pinned by test "does NOT call host.start()" |
| `host.runMockAction(req)` | action invocation is held for a separate GO | not called; pinned by test "does NOT call runMockAction()" |
| register any IPC channel for the host | the host is main-process-only; IPC would expose it to renderer | pinned by test "does NOT register any IPC channel for auto-executor-host" |
| start any cron / timer / interval for the host | cron/timer would make the host self-arming | pinned by test "does NOT start any cron/timer/interval for auto-executor" |

### 4.3 `src/main/index.ts` edit (minimal)

```diff
 import { createKnowledgeIpcStartup } from "./knowledge-ipc-startup";
+import { installAutoExecutorHost } from "./auto-executor-bootstrap";
 ...
   buildMenu();
   setupIPC();
   createWindow();
   setupUpdater();
+  // HCC Auto Executor bootstrap — idle / disabled / no-start.
+  // Constructs the host in `constructed` state only. Does NOT arm,
+  // start, or invoke any action. Held for a separate explicit GO to
+  // transition out of `constructed`.
+  installAutoExecutorHost();
```

Two-line edit. No new IPC handler. No new cron job. No new electron-app-lifecycle hook.

### 4.4 Posture report

`getBootstrapPostureReport()` returns a frozen literal-false report:

```ts
{
  installed: true,
  state: "constructed",
  alive: true,
  subprocess_count: 0,        // literal
  max_subprocess_count: 0,    // literal
  armed: false,               // literal
  started: false,             // literal
  any_action_invoked: false,  // literal
  installed_at: <iso>,
}
```

A future slice that wants to flip any of these `false` literals must rewrite this file's source — which is itself an audit signal.

## 5. Predecessor linkage

| Predecessor | Status | Linkage |
|---|---|---|
| `HCC-AUTO-EXECUTOR-EXEC-IMPL-001` | ✅ landed (`faf062a`) | materializes host library |
| `HCC-CONTROLLED-EXECUTOR-READINESS-001` | ✅ landed (`39e9745`) | `decideTaskAdmission` + `night_run_ready` literal `false` |
| Boundary library at `466e42b` | ✅ idle | host imports it; bootstrap does not modify it |

This slice wires the host into `src/main/index.ts` in idle mode. It does not modify the host, the boundary library, or the contract layer.

## 6. Decision

| Question | Verdict |
|---|---|
| Is the **bootstrap scope** sufficient? | **YES** — 4-line index.ts edit + 1 helper + 15 tests cover the minimum |
| May the bootstrap be **committed**? | **YES** — host is library; bootstrap is construct-only |
| May the bootstrap be **pushed**? | **held** — push requires separate user GO |
| Is **arming / starting** authorized? | **NO** — separate explicit GO required |
| Is **night-run auto-execution** authorized? | **NO** — `night_run_ready` literal `false`; report says `NO-GO` |

## 7. Still NOT authorized (explicit redline list)

| Surface | State |
|---|---|
| Apply path | **closed** |
| Auto Executor runtime | **NOT started** (idle / constructed state only) |
| Live Ranking mutation | **closed** |
| Live Flush auto-apply | **closed** |
| `~/.hermes/**` writes | **off** |
| `git push` of execution-enabling change | **held** |
| `host.arm()` call | **NOT made** (pinned by static guard test) |
| `host.start()` call | **NOT made** (pinned by static guard test) |
| `host.runMockAction()` call | **NOT made** (pinned by static guard test) |
| New IPC channel for auto-executor | **NOT added** (pinned by static guard test) |
| Night-run auto-execution | **NO-GO** (literal `false`) |

Any drift from this table is a redline violation. Stop and report.

---

## 8. Bellard-perspective

- **Two-line index.ts edit, one helper, one test.** The whole bootstrap slices down to the smallest change that proves "the host exists in the main process." No new IPC, no new lifecycle hook, no new state.
- **No new dependency, no runtime, no daemon.** `package.json` untouched. The host is a library; constructing it has no observable effect at runtime until someone calls `arm()` + `start()`.
- **Each `false` is a literal in source.** `armed: false`, `started: false`, `any_action_invoked: false`, `subprocess_count: 0`, `max_subprocess_count: 0`. The static guard tests pin each of these.
- **Default OFF is enforced at the bootstrap layer.** `installAutoExecutorHost()` is the only entry point the host has into the main process. It does not register IPC, does not start timers, does not modify the working tree.
- **Boring is correct.** A bootstrap that says "construct once, never arm, never start" is the most useful bootstrap possible right now.

## 9. Karpathy-perspective

- **No false clean-state claim.** §2 names the staged files. §3 records gate results without overstating.
- **Bootstrap ≠ runtime.** The host is constructed; it is not running. State stays `constructed`. The user cannot transition out of `constructed` without a future explicit GO.
- **Lifecycle tests are pinned by static guard.** The bootstrap integration test reads `src/main/index.ts` source and asserts (a) the import is present, (b) `installAutoExecutorHost()` is called exactly once, (c) `arm(`, `start(`, `runMockAction(`, and `ipcMain.handle.*auto-executor` are absent.
- **Tail-risks named.** §7 names every surface that is closed. Drift from any entry is a redline violation.
- **Unknowns named.** `night_run_ready` literal `false`; `go_no_go` literal `"NO-GO"`. Arming and starting are held for separate explicit GO.
- **Audit evidence vs deployment reliability.** This preflight proves the bootstrap exists and the tests pass. It does **not** prove Auto Executor is safe, ready, or will work. Two different statements.

---

## 10. Next prompt (commit + push + next slice)

> Implementation `HCC-AUTO-EXECUTOR-BOOTSTRAP-001` complete in isolated worktree `hcc-auto-executor-bootstrap-001`. Bootstrap is **idle / disabled / no-start**; arm and start are not called. `night_run_ready` literal `false`; report says `NO-GO`.
>
> Issue one of:
>
> 1. **`GO commit`** — commit the 6 files (`src/main/auto-executor-bootstrap.ts` + `tests/auto-executor/bootstrap-integration.test.ts` + 3 docs + edited `src/main/index.ts`) onto `hcc-auto-executor-bootstrap-001`. Push held.
> 2. **`GO push`** — push the commit to `origin/hermes-pro-main`. Requires commit GO first.
> 3. **`GO HCC-AUTO-EXECUTOR-ARM-001`** — begin arming (NOT part of this slice; held for a future GO).
> 4. **No GO** — stop here. Files stay local; nothing is committed or pushed.