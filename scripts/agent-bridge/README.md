# AGENT-BRIDGE — Codex ⇄ Claude Code File-Bridge

> Slices: **AGENT-BRIDGE-002** (skeleton + task-packet validator) + **AGENT-BRIDGE-002A** (hardened allowlist) + **AGENT-BRIDGE-002B** (cleanup) + **AGENT-BRIDGE-003** (Claude invocation runner).
> Design doc: `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md`.

## What this slice family is

- Skeleton + dry-run validator (002/002A/002B).
- `run-claude-task.mjs` with `--execute` (003) parses a task packet, validates its shape, and (in `mode=design-only` or `mode=read-only`) invokes Claude in non-interactive print mode with **tools disabled**.
- It does **not** invoke Codex. It does **not** write to `.agent-bridge/tasks/`. It does **not** modify repo files.

## What this slice family is NOT

- It is **not** a runner for write-mode tasks. `--execute` rejects `mode=write-files-only` and any other mode that would require file edits.
- It is **not** a Codex audit runner.
- It is **not** a daemon. It is invoked manually per task.
- It is **not** HCC Auto Executor. It does not enable live apply.
- It does **not** authorize LOOP-010.A.

## Files

| File | Purpose |
|---|---|
| `run-claude-task.mjs` | CLI: parse flags, read task packet, validate, dry-run summary OR invoke Claude. |
| repo-root `.gitignore` (one line) | `.agent-bridge/` — runtime state is never committed. |
| `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md` | Design doc. |

## CLI flags

```
--task <path>          Path to task packet JSON
--repo <path>          Path to repo root
--dry-run              Validate only; do not execute
--execute              Invoke Claude (design-only / read-only tasks only)
--bridge-root <path>   Optional; default = <repo>/.agent-bridge
--claude-bin <path>     Optional; default = claude
--timeout-ms <number>  Optional; default = 300000
--help, -h             Print this message
```

Rules:

- Exactly one of `--dry-run` or `--execute` must be provided.
- `--dry-run` and `--execute` together exit 2.
- Omitting both exits 2.

## Usage (AGENT-BRIDGE-003)

### Dry-run

```sh
node scripts/agent-bridge/run-claude-task.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-sample-task.json \
  --dry-run
```

### Execute (design-only / read-only)

```sh
node scripts/agent-bridge/run-claude-task.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-003-smoke-task.json \
  --execute \
  --timeout-ms 300000
```

- `--execute` is **only** supported for `mode=design-only` or `mode=read-only`.
- Other modes (including `mode=write-files-only`) exit 2 with a clear message.
- Claude is invoked in non-interactive print mode (`claude -p`) with tools disabled (`--tools ""`).
- Output goes to `.agent-bridge/results/<task_id>.result.md`.
- Lifecycle log goes to `.agent-bridge/logs/<task_id>.log`.
- The script **never** writes to `.agent-bridge/tasks/`.

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
8. `task_id` (AGENT-BRIDGE-003) MUST match `[A-Za-z0-9._-]+`; path separators are rejected.

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

## Claude invocation (AGENT-BRIDGE-003)

- Non-interactive print mode: `claude -p "<prompt>" --output-format text --tools "" --permission-mode default`.
- Tools are **disabled** (`--tools ""`). Claude will not call any tool, will not edit any file, will not run any shell command.
- The prompt is built from the task packet (`task_id`, `mode`, `objective`, `allowed_files`, `forbidden_files`, `forbidden_actions`, `required_verification`, `report_schema`) and ends with a hard instruction: "Do not call tools. Do not edit files. Return a concise execution report only."
- Stdout is written to `.agent-bridge/results/<task_id>.result.md`.
- A JSON lifecycle log is written to `.agent-bridge/logs/<task_id>.log` with: `task_id`, `started_at`, `finished_at`, `claude_exit_code`, `result_path`, `mode`, `would_modify_files=false`, `tools_disabled=true`.
- If Claude exits non-zero, the log includes a stderr summary, and the script exits non-zero.
- The script does **not** retry. It does **not** bypass permissions. It does **not** use `--dangerously-skip-permissions`.

## Bridge-root sandboxing (AGENT-BRIDGE-003A)

`.agent-bridge/` is **expected to be created by `--execute`** (or any explicit `--bridge-root` invocation). It is **ignored runtime state** via the repo-root `.gitignore`, **not** absent.

`--bridge-root` is constrained to the repo-local `.agent-bridge/` directory only:

- **Default** (no `--bridge-root` flag): the bridge writes to `<repo>/.agent-bridge/results/` and `<repo>/.agent-bridge/logs/`.
- **Allowed**: `<repo>/.agent-bridge` and any sub-path such as `<repo>/.agent-bridge/custom`.
- **Rejected** (exit 2 with `error: --bridge-root must resolve inside <repo>/.agent-bridge`):
  - `--bridge-root /tmp/...` (any external path)
  - `--bridge-root ~/.hermes/...` (any user-home path)
  - `--bridge-root <repo>/scripts/agent-bridge` (a tracked source dir)
  - `--bridge-root <repo>/docs`, `<repo>/src`, `<repo>/tests` (any tracked source dir)
  - any other path that does not resolve inside `<repo>/.agent-bridge`.

The bridge **never** writes to `~/.hermes/*`, repo tracked source dirs, or any path outside `.agent-bridge/`.

### Verification expectation

After a successful `--execute`, the verification expectation is:

- `git status --short -uall` does **not** show `.agent-bridge/` (because `.gitignore` ignores it).
- `find .agent-bridge -maxdepth 3 -type f` MAY show `results/<task_id>.result.md` and `logs/<task_id>.log` — that is the expected runtime state.
- `git check-ignore -v .agent-bridge/results/<task_id>.result.md` shows the `.gitignore:51:.agent-bridge/` rule matched.

The verification expectation is **not** `test ! -d .agent-bridge` (that would be wrong — the directory is created by `--execute`).

## Out of scope (AGENT-BRIDGE-003)

- **No Codex audit runner yet.** Phase 3 (Codex audit) is a separate future slice with a separate user authorization.
- **No commit / push / live apply automation.** User authorization remains required for every commit / push / abort.
- **No write-files-only execution.** Tasks that require file edits are rejected by the validator (exit 2).
- **No live apply / HCC Auto Executor / model runtime.**
- **No `--dangerously-skip-permissions`.**

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
| 2 | Claude Runner | **AGENT-BRIDGE-003** (this slice) — design-only / read-only; tools disabled; no audit; no commit |
| 3 | Claude Runner + Codex Audit Runner | Future slice, separate user authorization |
| 4 | Authorization Dashboard / one-click approval | Future slice, separate user authorization |

## Future-slice notes (not in scope for AGENT-BRIDGE-003)

- A future slice may add real Codex audit invocation, gated on a separate user authorization slice.
- A future slice may add write-files-only execution (with explicit user authorization per write), gated on a separate user authorization slice.
- A future slice may add a local web UI, gated on a separate user authorization slice.
- None of these are part of AGENT-BRIDGE-003.
