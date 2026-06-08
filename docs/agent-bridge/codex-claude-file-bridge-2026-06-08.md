# Codex ⇄ Claude Code File-Bridge (Design-Only)

> **Status**: design-only. **Not** a runner implementation.
> **Date**: 2026-06-08
> **Scope**: early-stage transport replacement. Replaces user copy/paste between Codex and Claude Code. **Preserves** user authorization as the final gate.
> **Out of scope**: live apply, HCC Auto Executor, LOOP-010.A, automatic commit / push.

---

## 1. Problem Statement

### 1.1 Current manual loop

The current Codex ⇄ Claude Code collaboration is a copy/paste loop:

1. **Codex** drafts a task prompt (in chat / file / harness).
2. **User** copies the prompt and pastes it into Claude Code.
3. **Claude Code** executes the prompt against the local workspace.
4. **User** copies Claude Code's result back into Codex.
5. **Codex** audits the result against local reality (git status, test runs, file existence, mtime, etc.).

### 1.2 Pain points

- Manual copy/paste is lossy (formatting, length, truncation, encoding).
- No single canonical record of "what was asked vs what was answered".
- The user is the de-facto transport + a passive auditor.
- Every transport step is a chance for the original prompt to drift.

### 1.3 Goal

Replace the copy/paste **transport** with a local file-bridge so that:

- Codex writes a task packet to a file the user (and Claude Code) can read.
- Claude Code writes a result packet to a file the user (and Codex) can read.
- Codex writes an audit verdict to a file the user reads.
- A final user-facing authorization report aggregates the three.

**Preserve**: the user is the only actor that issues `commit`, `push`, `live apply`, `HCC Auto Executor`, `model runtime`, or any `~/.hermes/*` write.

---

## 2. Roles

| Role | Responsibility | Authority |
|---|---|---|
| **Codex** | Task publisher + independent local auditor | Writes `tasks/`, `audits/`, `authorizations/` packets. **Cannot** execute the task. |
| **Claude Code** | Executor (only) | Reads `tasks/pending/*.json`, writes `results/<task_id>.json`. **Cannot** commit / push / live apply by default. |
| **User** | Final authorization gate | Reads the authorization report. Issues commit / push / abort phrases. **Only actor** that may amend history or touch `~/.hermes/*`. |

### 2.1 Hard rule: user authorization is never automated

The bridge **MUST NOT** automate:

- `git commit`
- `git push`
- `git commit --amend`
- `git rebase`
- `git reset --hard`
- any `~/.hermes/config.yaml` write
- any `~/.hermes/handoff/packs/**` write
- any `~/.hermes/audit/**` write (unless the task explicitly expects it)
- any `docs/roadmap-locked-2026-05-28.md` mutation
- any live apply / knowledge flush / knowledgeIngest call / knowledgeSearch call
- any HCC Auto Executor startup
- any local model runtime startup
- any `human_approval_ref.verified === true` flip

The user must issue an explicit, plain-text authorization phrase. The bridge logs the phrase to `authorizations/<task_id>.log` but does not execute it.

---

## 3. Directory Proposal

```
.agent-bridge/
  tasks/
    pending/      # Codex drops <task_id>.json here; user moves to running/ when starting
    running/      # Active tasks; Claude Code reads from here
    done/         # Completed tasks; archive
  results/        # Claude Code writes <task_id>.json here
  audits/         # Codex writes <task_id>.json here
  authorizations/ # Final user-facing reports + logged user phrases
  logs/           # Bridge lifecycle events (read/write timestamps, no PII)
  state.json      # Latest known state per task_id (pending | running | done | audited | authorized | aborted)
```

### 3.1 Directory semantics

| Directory | Writer | Reader | Lifecycle |
|---|---|---|---|
| `tasks/pending/` | Codex | User, Claude Code | Created at task publish. Moved to `running/` by user. |
| `tasks/running/` | User (mv) | Claude Code | Active execution window. |
| `tasks/done/` | User (mv) | Codex (archival) | Execution finished. Awaiting audit. |
| `results/` | Claude Code | Codex, User | Per-task result packet. |
| `audits/` | Codex | User | Per-task audit verdict. |
| `authorizations/` | Codex (report) + User (phrase log) | User only | Final user-facing report + plain-text phrases. |
| `logs/` | Bridge (when implemented) | User | Lifecycle log (timestamps only). |
| `state.json` | Bridge (when implemented) | User | Latest per-task state. |

### 3.2 File naming

- Tasks: `tasks/<stage>/<task_id>.json`
- Results: `results/<task_id>.json`
- Audits: `audits/<task_id>.json`
- Authorizations: `authorizations/<task_id>.md` (human-readable) + `authorizations/<task_id>.log` (phrases)
- `state.json`: top-level, single file.

### 3.3 The bridge directory itself

The bridge lives under the repo root at `.agent-bridge/`.

- `.agent-bridge/` is intended to remain untracked.
- **Dot-prefix alone does not make Git ignore it.** A future runner implementation slice MUST add an explicit `.gitignore` rule (e.g. `.agent-bridge/`) **OR** place bridge state outside the repo (e.g. `~/.hermes/agent-bridge/`). The decision is left to a future implementation slice.
- This design-only slice does **not** modify `.gitignore`. Any change to `.gitignore` requires an independent user authorization.
- The bridge is **not** part of the repo's source tree. It is a transport surface, not a runtime feature.

The directory is **created on first use** by Codex (write to `tasks/pending/`). It is **never deleted** by Claude Code or the bridge.

---

## 4. Task Packet Schema

Codex writes `tasks/pending/<task_id>.json` with the following machine-readable shape:

```json
{
  "schema_version": "1.0.0",
  "task_id": "string (e.g. LOOP-010.A-ADMISSION-001)",
  "mode": "design-only | read-only | write-files-only",
  "created_at": "ISO 8601",
  "executor": "claude_code",
  "objective": "1-3 sentence description of what to produce",
  "allowed_files": [
    "path/relative/to/repo/root/that/may/be/written"
  ],
  "forbidden_files": [
    "src/main/safety/*",
    "docs/roadmap-locked-2026-05-28.md",
    "~/.hermes/config.yaml",
    "~/.hermes/handoff/packs/**",
    "~/.hermes/audit/**"
  ],
  "allowed_commands": [
    "git status",
    "git diff --name-only",
    "git diff --check",
    "rg <pattern> <path>",
    "find <path> -newer <marker>",
    "stat -f '%m %N' <path>",
    "npx vitest run <file>",
    "npm run typecheck"
  ],
  "forbidden_actions": [
    "git commit",
    "git push",
    "git commit --amend",
    "git rebase",
    "git reset --hard",
    "touch ~/.hermes/*",
    "knowledgeIngest",
    "knowledgeSearch",
    "live apply",
    "model runtime startup",
    "HCC Auto Executor"
  ],
  "required_verification": [
    "git diff --name-only returns only allowed_files",
    "git diff --check is empty",
    "git diff -- docs/roadmap-locked-2026-05-28.md is empty",
    "stat -f '%m %N' on 3 ~/.hermes baseline paths unchanged",
    "typecheck / vitest results (if applicable)"
  ],
  "report_schema": {
    "claimed_changes": "string",
    "files_modified": ["string"],
    "commands_run": ["string"],
    "raw_outputs_summary": "string",
    "verification_results": ["string"],
    "not_done": "string",
    "known_unknowns": "string",
    "final_verdict": "complete | partial | failed"
  },
  "expected_authorization_type": "commit-only | push-only | commit-and-push | none | abort-only"
}
```

### 4.1 Schema invariants

- `allowed_files` is a strict allowlist. Anything outside is **automatic FAIL** (§8).
- `forbidden_files` is a hard blocklist. Even if listed in `allowed_files`, the intersection is **automatic FAIL**.
- `forbidden_actions` includes every action the bridge refuses to execute.
- `required_verification` is what Codex will check in the audit (§6).
- `expected_authorization_type` declares what user phrase is required to advance the task.

---

## 5. Claude Result Schema

Claude Code writes `results/<task_id>.json` after executing the task. The shape is **not** trusted until Codex audits it (§6).

```json
{
  "schema_version": "1.0.0",
  "task_id": "string",
  "executor": "claude_code",
  "started_at": "ISO 8601",
  "finished_at": "ISO 8601",
  "claimed_changes": "1-3 sentence description of what was changed",
  "files_modified": [
    {"path": "string", "sha256": "string"}
  ],
  "commands_run": [
    {"command": "string", "exit_code": 0, "duration_ms": 0}
  ],
  "raw_outputs_summary": "string (max 8 KB; truncated summaries OK; full outputs NOT included by default)",
  "verification_results": [
    {"check": "string", "passed": true, "evidence": "string"}
  ],
  "not_done": "string (what the executor chose not to do, and why)",
  "known_unknowns": [
    "string (things the executor could not verify)"
  ],
  "final_verdict": "complete | partial | failed"
}
```

### 5.1 Hard rules for the result

- `files_modified` MUST be **the actual diff**; padding or omitting paths is a **fail**.
- `commands_run` MUST list every shell command that was executed; hiding any is a **fail**.
- `raw_outputs_summary` MUST be honest about truncation; if the raw output exceeds 8 KB, the executor must say so explicitly.
- `verification_results` MUST include the `required_verification` items from the task packet (§4); skipping any is a **fail**.
- `not_done` MUST NOT be empty unless `final_verdict=complete` AND nothing was intentionally skipped.
- `known_unknowns` is the only place the executor may say "I don't know" — but each unknown is auditable.

---

## 6. Codex Audit Schema

Codex writes `audits/<task_id>.json` after re-running every required verification locally. The audit does **not** trust Claude Code's result; it re-verifies from scratch.

```json
{
  "schema_version": "1.0.0",
  "task_id": "string",
  "auditor": "codex",
  "audited_at": "ISO 8601",
  "verified_correct": [
    {"check": "string", "evidence": "string"}
  ],
  "mismatches": [
    {
      "claude_claim": "string",
      "local_reality": "string",
      "severity": "low | medium | high"
    }
  ],
  "ai_hallucinations_or_overclaims": [
    "string (each is a separate item; no batched summaries)"
  ],
  "bugs": [
    {"file": "string", "line": 0, "description": "string"}
  ],
  "local_reality_snapshot": {
    "git_status": "string",
    "git_diff_name_only": ["string"],
    "git_diff_check": "string",
    "roadmap_diff": "string",
    "hermes_baseline_mtime": {
      "config_yaml": 0,
      "handoff_packs": 0,
      "audit": 0
    }
  },
  "final_decision": "ACCEPT | NEED_FIX | NO_GO | READY_FOR_USER_AUTHORIZATION"
}
```

### 6.1 Final-decision semantics

| Decision | Meaning | Next step |
|---|---|---|
| `ACCEPT` | All required checks pass. No mismatches. No hallucinations. No bugs. No forbidden actions. | Authorize `commit` (no `push` unless `expected_authorization_type=commit-and-push`). |
| `NEED_FIX` | One or more mismatches / bugs / hallucinations detected, but the task is salvageable with targeted fixes. | Codex writes a fix request to `tasks/pending/<task_id>-fix1.json`. Re-run. |
| `NO_GO` | Forbidden action performed, immutable audit mutated, or a hallucination that cannot be reversed by edits. | User must `abort task`. No commit. |
| `READY_FOR_USER_AUTHORIZATION` | All technical checks pass, but the user must explicitly authorize the next step (commit / push / etc.). | Bridge writes `authorizations/<task_id>.md` for the user to read. |

### 6.2 Audit invariants

- The audit **MUST** re-run every `required_verification` from the task packet. Trusting Claude Code's self-report is a **fail**.
- `local_reality_snapshot` MUST be from this session's commands, not from prior sessions.
- `mismatches.severity=high` ⇒ `final_decision` MUST be `NO_GO` or `NEED_FIX` (never `ACCEPT`).
- `ai_hallucinations_or_overclaims` non-empty ⇒ `final_decision` MUST be `NEED_FIX` or `NO_GO`.

---

## 7. Authorization Report Schema

The bridge writes `authorizations/<task_id>.md` for the user. This is the only file the user must read.

```markdown
# Authorization Report — <task_id>

## 1. Task
- task_id: <task_id>
- mode: <mode>
- objective: <objective>

## 2. Executor Result
- final_verdict: <complete | partial | failed>
- files_modified: <list>
- commands_run: <list>
- claimed_changes: <text>

## 3. Codex Audit Result
- final_decision: <ACCEPT | NEED_FIX | NO_GO | READY_FOR_USER_AUTHORIZATION>
- verified_correct: <list>
- mismatches: <list>
- ai_hallucinations_or_overclaims: <list>
- bugs: <list>

## 4. Diff Scope
- git diff --name-only: <list>
- git diff --stat: <stat>
- any file outside allowed_files: <yes / no>

## 5. Tests
- typecheck: <PASS / FAIL / NOT RUN>
- vitest: <PASS / FAIL / NOT RUN>
- test count: <N>

## 6. Forbidden-File Status
- src/main/safety/*: <unchanged / changed>
- docs/roadmap-locked-2026-05-28.md: <unchanged / changed>
- ~/.hermes/config.yaml: <mtime unchanged / changed>
- ~/.hermes/handoff/packs: <mtime unchanged / changed>
- ~/.hermes/audit: <mtime unchanged / changed>

## 7. Risk Level
- low | medium | high

## 8. Recommended Action
- authorize commit | fix and re-run | abort

## 9. Exact Authorization Phrase Required
Reply with ONE of:
- `yes commit <TASK-ID>`
- `yes push <COMMIT-HASH>`
- `yes commit and push <TASK-ID>`
- `no, request fix`
- `abort task`
```

### 7.1 Authorization phrase examples

| Phrase | Effect |
|---|---|
| `yes commit LOOP-010.A-ADMISSION-001` | Bridge logs the phrase; user runs `git commit` themselves. |
| `yes push f911d7710632` | Bridge logs the phrase; user runs `git push` themselves. |
| `no, request fix` | Bridge logs the phrase; Codex writes a fix request. |
| `abort task` | Bridge logs the phrase; the task is moved to `tasks/done/aborted/`. |

**The bridge MUST NOT execute the action implied by the phrase.** It only logs the phrase to `authorizations/<task_id>.log` with timestamp.

### 7.2 What the user must do after authorization

The user (not the bridge) executes:

- `git add <files>` — the user runs this manually.
- `git commit -m "..."` — the user runs this manually.
- `git push origin <branch>` — the user runs this manually.
- `git commit --amend` / `git rebase` — the user runs these manually.

The bridge records the phrase but takes no further action.

---

## 8. Safety Boundaries

### 8.1 Default-deny actions (the bridge refuses to execute, period)

- `git commit` (any form)
- `git push` (any form, including `--force`, `--mirror`, `--tags`)
- `git commit --amend`
- `git rebase` (any form, including `--interactive`, `--onto`)
- `git reset --hard`
- `git filter-branch`
- any `git reflog` rewrite

### 8.2 Default-deny file mutations

- `~/.hermes/config.yaml` (write)
- `~/.hermes/handoff/packs/**` (any mutation)
- `~/.hermes/audit/**` (any mutation) — except when the task packet explicitly expects audit writes, in which case the writes must be re-verifiable.
- `docs/roadmap-locked-2026-05-28.md` (any mutation)

### 8.3 Default-deny runtime actions

- `live apply` (knowledge flush / knowledgeIngest / knowledgeSearch / live ranking mutation)
- `HCC Auto Executor` startup
- local model runtime startup
- `human_approval_ref.verified === true` flip
- any `existing app cron` invocation that bridges to live apply

### 8.4 Hard invariants

- **Diff outside `allowed_files` = automatic FAIL.** If Claude Code's `files_modified` includes any path not in the task packet's `allowed_files`, the audit MUST set `final_decision=NO_GO`.
- **Unknown source MUST remain UNKNOWN.** If a fact cannot be re-verified from a real command output, the audit MUST mark it `UNKNOWN` rather than guess.
- **Pasted report is untrusted until Codex local audit.** Even if Claude Code reports a `PASS`, the audit MUST re-run every `required_verification` from the task packet.
- **Lockstep with `state.json`.** The bridge (when implemented) MUST update `state.json` for every state transition; Codex MUST reject audits that reference stale `state.json` snapshots.

### 8.5 What the bridge MUST NOT do (even with user authorization)

- It MUST NOT install skills.
- It MUST NOT mutate the skill registry.
- It MUST NOT start a model runtime.
- It MUST NOT start the HCC Auto Executor.
- It MUST NOT enable LOOP-010.A.
- It MUST NOT enable live apply.
- It MUST NOT bypass the human approval anchor (`human_approval_ref.verified=false` is contractually hard-asserted).

---

## 9. Automation Phases

The bridge is rolled out in four phases. **Each phase requires an independent user authorization**; no phase is auto-promoted.

### 9.1 Phase 1: File Bridge only

- Codex writes task packets manually.
- User runs Claude Code manually, points it at the packet, and asks it to write the result to `results/<task_id>.json`.
- Codex writes the audit manually after re-running required verifications.
- Codex writes the authorization report manually.
- User reads the report, decides, runs commit/push manually.

**No automation. No scripts. No daemons.**

### 9.2 Phase 2: Claude Runner

- A runner script (e.g. `scripts/agent-bridge/run-claude.sh`) reads `tasks/running/<task_id>.json`, invokes Claude Code with the packet as input, captures stdout, and writes `results/<task_id>.json`.
- The runner is a plain shell script. It does **not** call Codex. It does **not** commit. It does **not** push.
- The runner's only automation is "invoke Claude Code + write the result file". Everything else is manual.

### 9.3 Phase 3: Claude Runner + Codex Audit Runner

- A second runner (e.g. `scripts/agent-bridge/audit-codex.sh`) reads `results/<task_id>.json` + the task packet, and invokes Codex to write `audits/<task_id>.json`.
- The audit runner MUST NOT call Claude Code. Its sole input is the result packet + the task packet.
- The audit runner's only automation is "invoke Codex + write the audit file".

### 9.4 Phase 4: Authorization Dashboard / one-click approval

- A local web UI (or TUI) lists pending authorizations from `authorizations/*.md`.
- The user clicks a button or types a phrase.
- The dashboard writes the phrase to `authorizations/<task_id>.log`.
- The dashboard **does not** execute `git commit` / `git push` / etc. The user still runs these manually.

### 9.5 Hard rule for every phase

> **This is not HCC Auto Executor. This does not enable live runtime. This does not authorize LOOP-010.A.**

No phase is allowed to:

- Skip the user's plain-text authorization.
- Run `git commit` / `git push` on the user's behalf.
- Trigger any `~/.hermes/*` write on the user's behalf.
- Trigger any live apply / HCC / model runtime / skill install on the user's behalf.

If the user wants those, they MUST issue the explicit authorization phrase AND run the action themselves (or in a future, separate slice — **not** in this design document).

---

## 10. Failure Modes

The bridge MUST handle (or refuse to handle) the following failure modes. Each is auditable.

| Failure mode | Detection | Default behavior |
|---|---|---|
| **Stale baseline** | `git status` not clean at task start | `final_decision=NO_GO`; require re-baseline. |
| **Command failed** | `commands_run[*].exit_code != 0` | Log to audit; classify as `mismatch` with severity=high. |
| **Glob scan invalid** | `rg` / `find` returns error or empty when expected non-empty | Log; mark `verification_results.passed=false`. |
| **Report claims current state from prior baseline** | Audit cross-references timestamps; `git status` doesn't match claims | `final_decision=NEED_FIX` or `NO_GO`. |
| **Forbidden file modified** | `git diff --name-only` includes a path in `forbidden_files` | `final_decision=NO_GO`. |
| **Unexpected `~/.hermes` write** | `stat -f '%m %N'` on baseline 3 paths returns newer mtime | `final_decision=NO_GO`. |
| **Tests not run** | `required_verification` includes typecheck / vitest; result omits them | `final_decision=NEED_FIX`. |
| **Claude result missing raw facts** | `files_modified` / `commands_run` / `verification_results` empty | `final_decision=NEED_FIX`. |
| **Codex audit mismatch** | `mismatches[*]` non-empty | Severity=high ⇒ `NO_GO`; else `NEED_FIX`. |
| **Stale `state.json`** | Bridge detects `state.json` snapshot != current filesystem | `final_decision=NEED_FIX`; re-baseline. |
| **Authorship spoofing** | `authorizations/<task_id>.log` shows a phrase with no matching audit | Log; refuse to advance; require user re-confirm. |

---

## 11. Acceptance Criteria

This design document is **accepted** iff:

- The file exists at exactly `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md`.
- `git status --short -uall` shows **exactly** one untracked entry:
  `?? docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md`.
  - **Note**: `git diff --name-only` does **not** show untracked files. For
    design-only untracked doc review, use `git status --short -uall`.
  - **If the file is staged later** (e.g. in a future commit slice), use
    `git diff --cached --name-only` for staged-only verification.
- `git diff --check` is empty (no whitespace / conflict errors).
- `git diff -- docs/roadmap-locked-2026-05-28.md` is empty.
- No source, runtime, test, or plan file outside the allowed path is modified.
- `~/.hermes/{config.yaml, handoff/packs, audit}` mtime is unchanged from this session's baseline.

### 11.1 Verification commands (the user can re-run)

```sh
git -C /Users/midoudou/hermes-pro status --short -uall
git -C /Users/midoudou/hermes-pro diff --check
git -C /Users/midoudou/hermes-pro diff -- docs/roadmap-locked-2026-05-28.md
stat -f '%m %N' /Users/midoudou/.hermes/config.yaml \
                   /Users/midoudou/.hermes/handoff/packs \
                   /Users/midoudou/.hermes/audit
```

### 11.2 What is **not** part of acceptance

- Implementing the bridge runner.
- Implementing Codex audit runner.
- Implementing the authorization dashboard.
- Wiring any of this to HCC / LOOP-010.A / live apply.
- Any commit, push, or file mutation outside the single allowed markdown file.

---

## 12. Sign-off

- This document is design-only. No runner code, no daemons, no automation.
- No `~/.hermes/*` write was performed during this slice.
- No commit / push was performed.
- LOOP-010.A remains NOT-GO (separate admission check; this slice does not advance it).
- The user may read this document and either approve the design, request changes, or reject.
