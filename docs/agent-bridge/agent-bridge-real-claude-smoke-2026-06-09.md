# AGENT-BRIDGE-008 Real Claude Smoke — Closeout

> Date: 2026-06-09
> HEAD at smoke: `9e752a2b12660d5c51b8d247fc6178965fac8a6d`
> Status: **PASS** (after prompt hardening)

## 1. Background

AGENT-BRIDGE-008 was the first real Claude invocation through the Agent Bridge pipeline. The auto-mode classifier blocked bridge-driven real Claude invocation, so the smoke was run manually from terminal. Two runs were performed:

| Run | Result | Root cause |
|---|---|---|
| 1 (005A prompt) | **FAIL** — schema validation rejected wrong types | `known_unknowns: ""` (string instead of array), `claimed_pushed: ""` (string instead of boolean), `claimed_push_state: ""` (string instead of object\|null) |
| 2 (005D prompt) | **PASS** — full pipeline clean | Canonical JSON example + explicit type rules + anti-overclaim rules fixed the contract |

## 2. Run 1 (FAIL — caught safely)

**Pipeline**: task packet → `run-claude-task.mjs --execute` → `.result.raw.txt`

**Runner exit**: **1** (non-zero)

**Validation error**:
```
BLOCKED: AGENT-BRIDGE-005 schema validation failed: known_unknowns must be an array; claimed_pushed must be a boolean; claimed_push_state must be an object or null
```

**What went wrong**: The 005A prompt told Claude "Return a JSON object with these fields" but allowed Claude to choose types. Claude defaulted to `""` for unknown/uninitialized fields instead of `null`, `false`, or `[]`. The 005A **validator** caught this safely — exit 1, `.result.raw.txt` written, no `.result.json`.

**No harm done**: working tree remained clean, no commits, no pushes.

## 3. What fixed it (005D)

The 005D prompt hardening added:

- **Canonical JSON example** with exact types: `[]`, `false`, `null`
- **Explicit TYPE RULES**: "known_unknowns MUST be an array", "claimed_pushed MUST be boolean", etc.
- **"Never use empty string as a substitute for null, false, or []"**
- **ANTI-OVERCLAIM RULES**: "Tools are DISABLED. You cannot run git status... Do not claim you verified local git status, file mtimes, roadmap diff, or working tree state."

These changes made the prompt unambiguous about expected types.

## 4. Run 2 (PASS)

**Pipeline execution** (manual, from terminal):

**Task packet**: `/tmp/agent-bridge-008-real-claude-task.json`
- `task_id = AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE`
- `mode = read-only`

**Step 1 — Runner**:
```sh
node scripts/agent-bridge/run-claude-task.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-008-real-claude-task.json \
  --execute --timeout-ms 300000
```
**exit 0** — `.result.json` written with correct types.

**Step 2 — Audit**:
```sh
node scripts/agent-bridge/audit-claude-result.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-008-real-claude-task.json \
  --result .agent-bridge/results/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.result.json \
  --write-audit --audit-id AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE
```
**exit 0** — `final_decision = READY_FOR_USER_AUTHORIZATION`, `verified_correct = true`.

**Step 3 — Authorization report**:
```sh
node scripts/agent-bridge/generate-authorization-report.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-008-real-claude-task.json \
  --result .agent-bridge/results/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.result.json \
  --audit .agent-bridge/audits/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.audit.json \
  --write-report --authorization-id AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE
```
**exit 0** — `recommendation = READY FOR USER AUTHORIZATION`, `inputs_consistent = true`.

## 5. Runtime artifacts

All under `.agent-bridge/` (ignored via `.gitignore:51:.agent-bridge/`):

| Path | Size | Purpose |
|---|---|---|
| `results/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.result.json` | ~350 bytes | valid structured JSON |
| `results/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.result.raw.txt` | see note | run 1 fallback (stale) |
| `logs/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.log` | ~360 bytes | lifecycle log |
| `audits/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.audit.json` | ~1850 bytes | deterministic audit |
| `authorizations/AGENT-BRIDGE-008-REAL-CLAUDE-SMOKE.authorization.md` | ~1180 bytes | user-facing report |

**Note**: The stale `.result.raw.txt` from run 1 may coexist beside the successful `.result.json` from run 2. Consumers should read the `.result.json` (or the log's `result_path` field) rather than globbing blindly.

## 6. What this does NOT authorize

- LOOP-010.A (still NOT-GO)
- Live apply / live flush / knowledgeIngest / knowledgeSearch
- Write-files-only execution
- Phase 4 authorization dashboard
- HCC Auto Executor / model runtime / skill install
- Commit / push automation

User remains the final authorization gate. No commit or push was performed during this smoke. All trace artifacts are in `.agent-bridge/` and are not tracked by git.

## 7. Known limitations

1. **Auto-mode classifier blocks real Claude invocation** through the bridge script. The runner must currently be invoked from terminal. Fixing this requires a classifier policy update (not an agent-bridge code change).
2. **Stale `.result.raw.txt` from failed runs** may sit beside later `.result.json` files. Consumers should read the latest `.result.json` or use the log's `result_path` field. The audit runner already handles this by preferring `.result.json`.
3. **Single Claude call per task**. No retry logic. If Claude produces malformed JSON, the user must manually re-invoke.

## 8. Agent-Bridge pipeline status

| Phase | Status | Verified |
|---|---|---|
| 1 — Design doc | pushed | ✅ |
| 2 — Dry-run runner + JSON contract | pushed, passed stub + real Claude | ✅ |
| 3 — Deterministic audit | pushed, passed | ✅ |
| 3.5 — Authorization report | pushed, passed | ✅ |
| 4 — Dashboard | not started | N/A |
