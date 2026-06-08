# AGENT-BRIDGE — Codex ⇄ Claude Code File-Bridge

> Slice: **AGENT-BRIDGE-002** (skeleton + task-packet validator).
> Status: design-only, dry-run only, no runtime execution.
> Design doc: `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md`.

## What this slice is

- Skeleton only.
- The script `run-claude-task.mjs` parses a task packet and validates its shape.
- It does **not** invoke Claude. It does **not** invoke Codex. It does **not** write to `.agent-bridge/`. It does **not** modify repo files.

## What this slice is NOT

- It is **not** a runner. Claude invocation lands in a future slice.
- It is **not** a daemon. It is invoked manually per task.
- It is **not** HCC Auto Executor. It does not enable live apply.
- It does **not** authorize LOOP-010.A.

## Files

| File | Purpose |
|---|---|
| `run-claude-task.mjs` | CLI: parse flags, read task packet, validate, print dry-run summary. |
| repo-root `.gitignore` (one line) | `.agent-bridge/` — runtime state is never committed. |
| `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md` | Design doc. |

## Usage (AGENT-BRIDGE-002)

```sh
node scripts/agent-bridge/run-claude-task.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-sample-task.json \
  --dry-run
```

- `--dry-run` is **required** in this slice.
- Omitting `--dry-run` exits non-zero with: `Execution mode is not implemented in AGENT-BRIDGE-002.`
- `--task` and `--repo` are required.

## Validation rules (AGENT-BRIDGE-002)

The validator enforces the following invariants on a task packet:

1. The packet MUST contain every required field:
   `schema_version`, `task_id`, `mode`, `objective`, `allowed_files`, `forbidden_files`, `allowed_commands`, `forbidden_actions`, `required_verification`, `report_schema`, `expected_authorization_type`.
2. `allowed_files` and `forbidden_files` MUST be arrays of strings.
3. Reject path traversal: any path containing `..` is rejected.
4. Reject absolute paths except:
   - `~/.hermes/config.yaml`
   - `~/.hermes/handoff/packs`
   - `~/.hermes/audit`
   - `docs/roadmap-locked-2026-05-28.md`
5. `forbidden_actions` MUST include at minimum:
   `git commit`, `git push`, `git commit --amend`, `git rebase`, `git reset --hard`, `live apply`, `HCC Auto Executor`.
6. `report_schema` MUST be an object.
7. `expected_authorization_type` MUST be a non-empty string.

## Hardened allowlist rules (AGENT-BRIDGE-002A)

- `allowed_files` is a **strict write allowlist** — anything outside it cannot be written.
- **Hard-forbidden paths are rejected even if the task tries to include them in `allowed_files`:**
  - `~/.hermes/config.yaml`
  - `~/.hermes/handoff/packs`
  - `~/.hermes/audit`
  - any path starting with `~/.hermes/`
  - `docs/roadmap-locked-2026-05-28.md`
- If `allowed_files` contains any hard-forbidden path, the validator throws:
  `validate: allowed_files contains hard-forbidden path: <path>`
- `forbidden_files` MAY contain hard-forbidden paths (as declarations of intent). Path traversal and absolute-path rules still apply to `forbidden_files`.
- **`allowed_files` and `forbidden_files` must not overlap.** If the same path string appears in both lists, the validator throws:
  `validate: allowed_files overlaps forbidden_files: <path>`
- `~/.hermes/*` and `docs/roadmap-locked-2026-05-28.md` are **never** allowed as `allowed_files`, regardless of what a future task packet declares.

## Hard boundaries (every slice, including future ones)

- The bridge **must not** commit on the user's behalf.
- The bridge **must not** push on the user's behalf.
- The bridge **must not** rewrite git history.
- The bridge **must not** write to `~/.hermes/*` on the user's behalf.
- The bridge **must not** write to `docs/roadmap-locked-2026-05-28.md`.
- The bridge **must not** call `knowledgeIngest`, `knowledgeSearch`, live apply, HCC Auto Executor, or any local model runtime.
- The user must always issue an explicit plain-text authorization phrase for commit / push / abort.

## Phase roadmap (per design doc)

| Phase | What it adds | Status |
|---|---|---|
| 1 | File bridge only (manual Codex / Claude / user) | Done in AGENT-BRIDGE-001 (design doc) |
| 2 | Claude Runner | **AGENT-BRIDGE-002 is this slice** (skeleton + validator only) |
| 3 | Claude Runner + Codex Audit Runner | Future slice, separate user authorization |
| 4 | Authorization Dashboard / one-click approval | Future slice, separate user authorization |

## Future-slice notes (not in scope for AGENT-BRIDGE-002)

- A future slice may add real Claude invocation, gated on a separate user authorization slice.
- A future slice may add real Codex audit invocation, gated on a separate user authorization slice.
- A future slice may add a local web UI, gated on a separate user authorization slice.
- None of these are part of AGENT-BRIDGE-002.
