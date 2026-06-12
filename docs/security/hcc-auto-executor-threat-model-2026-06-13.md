# Auto Executor — Threat Model (STRIDE)

- Task: `HCC-AUTO-EXECUTOR-AUTH-IMPL-001` (precondition §4.1)
- Date: 2026-06-13
- Status: **design artifact, not a security certification**
- Scope: Auto Executor authorization boundary (`src/shared/lib/auto-executor/`)
- Out of scope: user authentication to Hermes Pro (handled elsewhere), network transport (handled by IPC), LLM output sanitization (separate concern)

---

## STRIDE table

Each row = `threat | surface | control | status`. `status` is `controlled` (mapped to an existing module or to a control described in `docs/plan/hcc-auto-executor-auth-impl-preflight-2026-06-13.md`) or `accepted` (residual risk the user has agreed to carry, with sign-off line below).

### Spoofing

| # | Threat | Surface | Control | Status |
|---|---|---|---|---|
| S1 | Prompt source spoofed as user | Prompt ingress | Per-action user confirmation (audit-log actor field) + prompt-hash in audit entry | controlled |
| S2 | Audit entry actor field forged | `audit-log.ts` | `AuditActor` shape is type-bound at write site; runtime append is the only path | controlled |
| S3 | Actor claims to be the kill switch control file | `kill-switch.ts` | Control file path is pinned at boundary construction time, not per-action | controlled |

### Tampering

| # | Threat | Surface | Control | Status |
|---|---|---|---|---|
| T1 | Audit log entries deleted / overwritten | `~/.hermes/audit/*.jsonl` | Append-only JSONL + hash chain (`audit-hash.ts`); boundary refuses action if chain breaks | controlled |
| T2 | Pre-action state snapshot mutated between capture and rollback | `rollback.ts` | Snapshot stored outside executor's writable surface; `revertFn` is generated per-action-class and tested for idempotency | controlled |
| T3 | Working tree modified between guard assertion and action | `worktree-guard.ts` | Guard re-asserts sha + branch + cwd + dirty-set immediately before action; refuses on any change | controlled |
| T4 | `safeExec` argv injection | `safe-exec.ts` | Reject any arg containing shell metacharacters; no shell invocation; allowlist at binary name | controlled |
| T5 | Secret value written to log | `audit-log.ts` | `redaction-scanner` filter applied to all log lines before append; secretAccessor returns redacted form for logging | controlled |

### Repudiation

| # | Threat | Surface | Control | Status |
|---|---|---|---|---|
| R1 | User denies taking an action after the fact | `audit-log.ts` | Every action logged with `actor`, `sourcePromptHash`, `proposedDiff`, `decision`, `executionResult`; entries are hash-chained | controlled |
| R2 | Executor denies running an action | `action-gate` (existing) | Decision recorded with `decision: "deny"` and `reason` field; immutable once written | controlled |

### Information Disclosure

| # | Threat | Surface | Control | Status |
|---|---|---|---|---|
| I1 | Secret leaked via env var | `safe-exec.ts` | Subprocess env scrubbed to known-safe subset at request construction time; secretAccessor only returns values to approved call sites | controlled |
| I2 | Secret leaked via log line | `redaction-scanner.ts` | All log writes pass through redaction filter | controlled |
| I3 | Crash dump contains secret | (host-runtime concern) | Crash dump handler applies redaction-scanner; boundary exposes `redact(text)` helper for the host to call | controlled |
| I4 | Path disclosure via error message | boundary modules | Error messages are typed (`HermesWriteRefusedError`, `WorktreeMismatchError`, etc.); no internal path leaks in user-facing strings | controlled |

### Denial of Service

| # | Threat | Surface | Control | Status |
|---|---|---|---|---|
| D1 | Runaway execution loop | boundary composer | Per-action rate cap (configurable, default 60 actions/min); monotonic budget per GO record; kill switch breaks the loop | controlled |
| D2 | Audit log disk fill | `audit-log.ts` | Log rotation policy (90d local, retention defined by host); boundary refuses to start a new GO if log dir > configured cap | accepted (residual: disk fill from rogue actor is host-OS concern; user sign-off below) |
| D3 | Stale kill switch control file | `kill-switch.ts` | Control file mtime checked; ignored if older than `staleAfterMs` (default 24h) | controlled |
| D4 | Retry storm on transient failure | (host-runtime concern) | `retry-runtime.ts` (existing) handles bounded retries with backoff; boundary surfaces it but does not implement | controlled |

### Elevation of Privilege

| # | Threat | Surface | Control | Status |
|---|---|---|---|---|
| E1 | Subprocess runs as elevated user | `safe-exec.ts` | Default `uid`/`gid` = process; no `setuid`/`setgid` flags accepted; allowlist excludes any binary with known setuid bit | controlled |
| E2 | Boundary module imported by renderer | `auto-executor/index.ts` | Module is in `@shared/lib/auto-executor/`; vitest config + tsconfig.node.json include the shared lib but renderer (`tsconfig.web.json`) does not import it; CI scan can assert no renderer import | controlled |
| E3 | `armed: true` token forged | boundary composer | Token is a server-side HMAC over the GO record sha; not derivable from the working tree | controlled |
| E4 | Direct `~/.hermes/**` write bypassing guard | `hermes-write-guard.ts` | Guard is the only allowed write path; other code paths that would write `~/.hermes/**` must call `assertHermesWriteAllowed` first; lint/test scan asserts no direct fs.writeFile on `~/.hermes/**` | controlled (CI scan recommended) |

---

## Residual risks (accepted, with user sign-off required before any execution GO)

1. **D2 — audit log disk fill.** The boundary cannot prevent a malicious actor with execution rights from filling the disk. Host-OS quotas / `du` watchdogs are the appropriate control. The boundary refuses to start a new GO if the log dir exceeds a configured cap (default 10GB) — that is the boundary's contribution.
2. **T3 race window.** Between guard assertion and action commit, the working tree can change. The window is microseconds; the impact is a single action operating on a slightly-stale tree. The rollback strategy captures pre-state and reverts on discrepancy detection. The residual is "rollback may be necessary mid-flight" — acceptable for v1, with the kill switch as the hard stop.
3. **Prompt injection from LLM output.** The boundary treats LLM output as untrusted text. Any LLM-proposed action still requires per-action user confirmation. This is enforced by the GO record requiring `armed: true` token per action class, not per action — so the residual is "a sequence of allowed actions could collectively be harmful." Acceptable for v1 with rate cap and kill switch.

---

## What this threat model is NOT

- It is **not** a penetration test. No actual exploit was attempted.
- It is **not** a security certification. It is a STRIDE mapping of known threats to controls that exist or are scoped in the preflight.
- It is **not** authorization for execution. The verdict in `docs/plan/hcc-auto-executor-auth-impl-preflight-2026-06-13.md` §6 still holds: implementation requires a separate execution GO with §5 gates re-run on the implementation working copy.

---

## User sign-off line (to be filled when an execution GO is issued)

- Date: ____________
- Sign-off: ____________
- Scope of sign-off: ____________
- Residual risks acknowledged (numbered list): ____________
