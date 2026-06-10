# AGENT-BRIDGE — Codex ⇄ Claude Code File-Bridge

> Slices: **AGENT-BRIDGE-002** (skeleton + task-packet validator) + **AGENT-BRIDGE-002A** (hardened allowlist) + **AGENT-BRIDGE-002B** (cleanup) + **AGENT-BRIDGE-003** (Claude invocation runner) + **AGENT-BRIDGE-003A** (bridge-root sandboxing) + **AGENT-BRIDGE-004** (deterministic local audit runner) + **AGENT-BRIDGE-012** (read-only Claude tool mode) + **AGENT-BRIDGE-013** (controlled write-files-only mode) + **AGENT-BRIDGE-014** (timeout partial-change reporting).
> Design doc: `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md`.

## What this slice family is

- Skeleton + dry-run validator (002/002A/002B).
- `run-claude-task.mjs` with `--execute` parses a task packet, validates its shape, and invokes Claude in non-interactive print mode. Tools are **disabled by default** for `design-only` and default `read-only`.
- `--read-only-tools` (012) is an opt-in mode for `mode=read-only` packets only. It allows Claude to inspect the repo with Read/Grep/Glob while preserving the strict JSON result contract. Bash is disabled.
- `mode=write-files-only` (013) allows Claude to edit only explicit `allowed_files` with Read/Grep/Glob/Edit/MultiEdit/Write. Bash, Task, web tools, commit, push, amend, rebase, squash, live apply, and HCC Auto Executor remain disabled.
- If `write-files-only` times out or hits a spawn error after partial edits, the runner still snapshots the repo after the failed process and records partial changed files in `.result.raw.txt`, the lifecycle log, and `latest.json`; the run remains failed.
- It does **not** invoke Codex. It does **not** write to `.agent-bridge/tasks/`. It does **not** commit, push, or approve Claude's own work.

## What this slice family is NOT

- It is **not** an auto-approval runner. `write-files-only` stops at local edits plus structured result; Codex/audit must inspect the actual local diff before the user decides whether to commit or push.
- It is **not** a Codex invocation runner. (AGENT-BRIDGE-004 adds a deterministic *local* audit runner that re-verifies the Claude result against local repo reality; it does **not** invoke Codex.)
- It is **not** a daemon. It is invoked manually per task.
- It is **not** HCC Auto Executor. It does not enable live apply.
- It does **not** authorize LOOP-010.A.

## Files

| File | Purpose |
|---|---|
| `run-claude-task.mjs` | CLI: parse flags, read task packet, validate, dry-run summary OR invoke Claude. |
| `audit-claude-result.mjs` | CLI: deterministic local audit of a Claude result report against local repo reality. |
| `generate-authorization-report.mjs` | CLI: reads task/result/audit JSON and produces a user-facing authorization report. |
| `publish-task-packet.mjs` | CLI: creates standardized AGENT-BRIDGE task JSON packets under `.agent-bridge/tasks/pending/`. |
| repo-root `.gitignore` (one line) | `.agent-bridge/` — runtime state is never committed. |
| `docs/agent-bridge/codex-claude-file-bridge-2026-06-08.md` | Design doc. |

## CLI flags

```
--task <path>          Path to task packet JSON
--repo <path>          Path to repo root
--dry-run              Validate only; do not execute
  --execute              Invoke Claude (design-only / read-only / write-files-only)
--read-only-tools      Opt-in read-only Claude tools for mode=read-only only
--bridge-root <path>   Optional; default = <repo>/.agent-bridge
--claude-bin <path>     Optional; default = claude
--timeout-ms <number>  Optional; default = 300000
--help, -h             Print this message
```

Rules:

- Exactly one of `--dry-run` or `--execute` must be provided.
- `--dry-run` and `--execute` together exit 2.
- Omitting both exits 2.
- `--read-only-tools` with any packet mode other than `read-only` exits 2.

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
- `mode=write-files-only` is accepted only with non-empty `allowed_files` and empty `allowed_commands`.
- By default, Claude is invoked in non-interactive print mode (`claude -p`) with tools disabled (`--tools ""`).
- With `--read-only-tools`, Claude is invoked with repo read/search tools only. The runner passes `--bare`, `--output-format json`, `--json-schema`, `--tools Read,Grep,Glob`, `--allowedTools Read,Grep,Glob`, and explicitly denies Bash/edit/write/network/task tools. The runner injects a small local git context into the prompt instead of allowing Claude to run git.
- With `mode=write-files-only`, Claude is invoked with `--bare`, `--output-format json`, `--json-schema`, `--tools Read,Grep,Glob,Edit,MultiEdit,Write`, `--allowedTools Read,Grep,Glob,Edit,MultiEdit,Write`, and `--disallowedTools Bash,NotebookEdit,WebFetch,WebSearch,Task`. Bash is not exposed, so tests and git commands are performed by Codex after the run.
- Output goes to `.agent-bridge/results/<task_id>.result.json` on strict schema success or `.agent-bridge/results/<task_id>.result.raw.txt` on failure.
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
- The prompt instructs Claude to return a single JSON object conforming to the AGENT-BRIDGE-005 strict result schema (see below). No markdown, no code fences, no commentary.
- If stdout is valid JSON with all 12 required fields, it is written to `.agent-bridge/results/<task_id>.result.json`.
- If stdout is not valid JSON, not a JSON object, or missing required fields, the raw stdout is written to `.agent-bridge/results/<task_id>.result.raw.txt`, the lifecycle log records the failure, and the runner exits non-zero.
- A JSON lifecycle log is written to `.agent-bridge/logs/<task_id>.log` with: `task_id`, `started_at`, `finished_at`, `claude_exit_code`, `result_path`, `mode`, `would_modify_files=false`, `tools_disabled=true`.
- If Claude exits non-zero, the log includes a stderr summary, and the script exits non-zero.
- The script does **not** retry. It does **not** bypass permissions. It does **not** use `--dangerously-skip-permissions`.

## Read-only Claude tool mode (AGENT-BRIDGE-012)

`--read-only-tools` is intentionally narrow:

- It is accepted only when the task packet has `mode: "read-only"`.
- Default behavior remains unchanged: without the flag, the runner still passes `--tools ""`.
- With the flag, Claude argv is:
  `claude --bare -p "<prompt>" --output-format json --json-schema "<12-field schema>" --tools Read,Grep,Glob --allowedTools "Read,Grep,Glob" --disallowedTools "Bash,Edit,MultiEdit,Write,NotebookEdit,WebFetch,WebSearch,Task" --permission-mode default`
- `allowed_commands` must be empty in `--read-only-tools` mode. The runner no longer exposes Bash; command execution is not delegated to Claude.
- `required_verification` is descriptive only and does not grant command access.
- The runner injects local git context collected with its own read-only `git` calls: `rev-parse HEAD`, `rev-parse origin/hermes-pro-main`, ahead/behind counts, `git status --short -uall`, and recent `git log --oneline --decorate --max-count=12`.
- The prompt states that tools are available only for repo-local read-only inspection, Bash is disabled, `allowed_commands` / `required_verification` do not grant command access, and the final response must satisfy the provided JSON schema.
- The lifecycle log records `tools_disabled=false`, `read_only_tools=true`, and `claude_argv_summary`, where the prompt body is replaced by `<prompt omitted>`.
- Strict local result validation is unchanged. In read-only tools mode, Claude's JSON envelope is accepted in this order: `structured_output` object first; otherwise Claude Code 2.1.141's `result` string fallback only when it is a raw JSON object string. The extracted object is locally revalidated against the AGENT-BRIDGE 12-field contract. No markdown repair, prose trimming, or code-fence extraction is performed.
- Claude Code 2.1.141 may return schema-constrained data as a JSON string in `envelope.result` rather than `envelope.structured_output`; the runner accepts only that strict JSON-object fallback when `is_error` is not `true`.
- The mode still does not implement live apply, LOOP-010.A, HCC Auto Executor, commit, push, amend, rebase, squash, or writes outside the task allowlist plus ignored `.agent-bridge/` runner artifacts.
- P0 before rerunning AGENT-BRIDGE-011 on the real repo: verify with real Claude that Read/Grep/Glob cannot read `~/.hermes/*`, `~/.ssh/*`, `.env*`, absolute paths, `~` paths, or `..` paths. Deterministic auditing of actual tool-use events remains a follow-up if future slices reintroduce command execution.

## AGENT-BRIDGE-005 strict Claude result JSON schema

The runner (AGENT-BRIDGE-003/005) instructs Claude to return, and the audit
runner (AGENT-BRIDGE-004/005) expects, a single JSON object with these 12
required top-level fields and exact types.

| Field | Type | Notes |
|---|---|---|
| `schema_version` | string, non-empty | e.g. `"1.0.0"` |
| `task_id` | string, non-empty | must equal task packet `task_id` |
| `final_verdict` | string, non-empty | `complete` / `partial` / `failed` |
| `claimed_changes` | string | may be empty |
| `files_modified` | string[] | every item must be a string; empty array if none |
| `commands_run` | string[] | every item must be a string; empty array if none |
| `raw_outputs_summary` | string | max 8 KB; must state truncation if truncated |
| `not_done` | string | may be empty |
| `known_unknowns` | string[] | every item must be a string; empty array if none |
| `claimed_commit` | string \| null | claimed commit hash, or `null` |
| `claimed_pushed` | boolean | `true` or `false` |
| `claimed_push_state` | object \| null | allowed sub-fields: `head` (string), `origin_head` (string), `ahead` (number), `behind` (number); `null` if not claimed |

AGENT-BRIDGE-005A adds **strict field type validation** to both the runner
and the audit runner. Every field is checked for correct type (string,
boolean, number, object, null). Type mismatches (e.g., `files_modified` is a
string instead of an array, `claimed_pushed` is a string instead of boolean,
`claimed_push_state` is an array instead of object) cause:

- Runner: exit 1, stderr/log describe specific type errors, stdout written to `.result.raw.txt`
- Audit runner: `unknowns` populated with type error descriptions, `final_decision ≥ NEED_FIX`

Runner behavior for `--execute`:

| stdout | action | exit |
|---|---|---|
| valid JSON, all 12 fields, correct types, task_id matches packet | write `.result.json` | 0 |
| valid JSON, all fields, correct types, task_id mismatch | write `.result.raw.txt`, log note | 1 |
| valid JSON, missing ≥1 field | write `.result.raw.txt`, log note | 1 |
| valid JSON, ≥1 field wrong type | write `.result.raw.txt`, log note | 1 |
| not JSON / not an object | write `.result.raw.txt`, log note | 1 |
| empty | write `.result.raw.txt`, log note | 1 |
| claude exit ≠ 0 | write `.result.raw.txt`, log note + stderr summary | 1 |

Audit runner behavior:

| result type | behavior |
|---|---|
| `.result.json` with all 12 fields, correct types | `result_format: "json"`; claims extracted; no penalty |
| `.result.json` with missing fields or wrong types | `result_format: "json"`; `unknowns` includes schema validation failure details; verdict ≥ `NEED_FIX`; invalid types are NOT coerced to empty claims |
| `.result.raw.txt` / `.md` (markdown) | `result_format: "markdown"`; `unknowns` includes "result is markdown" penalty; verdict ≥ `NEED_FIX` |

Backward compatibility:

- AGENT-BRIDGE-005D hardens the prompt with a canonical JSON example, strict
  type rules (\`known_unknowns\` must be array, \`claimed_pushed\` must be boolean,
  \`claimed_push_state\` must be object or null), and an anti-overclaim rule:
  because tools are disabled Claude must not claim it verified local git
  status, file mtimes, or working tree state. Previously observed wrong-type
  JSON (\`known_unknowns: ""\`, \`claimed_pushed: ""\`, \`claimed_push_state: ""\`)
  is now prevented by both the prompt and the strict type validator; real
  Claude smoke failure was caught safely by the 005A validator.
- Missing-field JSON is **not** written to `.result.json` (the runner writes
  the raw stdout to `.result.raw.txt` regardless of failure reason).
- The audit runner (AGENT-BRIDGE-004/005A) still accepts markdown via `.md`
  and text via `.txt` as a backward-compatible path, but imposes the
  markdown penalty so `final_decision` is always ≥ `NEED_FIX`.
- No `.result.md` is produced by the 005/005A runner; pre-005 `.result.md`
  files on disk are handled as markdown by the audit runner.

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

## Deterministic local audit runner (AGENT-BRIDGE-004)

`audit-claude-result.mjs` reads a task packet and a Claude result report, and produces a deterministic audit verdict based on local repo reality. It does **not** call Codex, **not** call Claude, **not** perform commit/push, and **not** execute commands from the task packet or the result.

### CLI flags

```
--repo <path>          Path to repo root
--task <path>          Path to task packet JSON
--result <path>        Path to Claude result JSON or .md
--dry-run              Validate and print JSON; do not write
--write-audit          Write audit under <bridge-root>/audits/
--audit-id <id>        Audit identifier (required for --write-audit)
--bridge-root <path>   Optional; default = <repo>/.agent-bridge
--help, -h             Print this message
```

Rules:

- Exactly one of `--dry-run` or `--write-audit` must be provided.
- `--bridge-root` is constrained to `<repo>/.agent-bridge` (same rule as `run-claude-task.mjs`).
- `--write-audit` writes only under `<bridge-root>/audits/`.
- The result file is treated as untrusted text/data.

### Output schema

```json
{
  "audit_id": "string",
  "generated_at": "ISO 8601",
  "task_id": "string",
  "claimed_facts": {
    "final_verdict": "string|null",
    "claimed_changes": "string|null",
    "files_modified": ["string"],
    "commands_run": ["string"],
    "raw_outputs_summary": "string|null",
    "not_done": "string|null",
    "known_unknowns": ["string"],
    "claimed_commit": "string|null",
    "claimed_pushed": false,
    "claimed_push_state": "object|null"
  },
  "local_reality_snapshot": {
    "repo_root": "string",
    "branch": "string",
    "head": "string",
    "head_short": "string",
    "origin_head_short": "string",
    "origin_head": "string",
    "ahead": 0,
    "behind": 0,
    "working_tree_status": "string",
    "working_tree_dirty": false,
    "diff_check_empty": true,
    "roadmap_diff_empty": true,
    "gitignore_diff_empty": true,
    "hermes_mtime": {"config_yaml": 0, "handoff_packs": 0, "audit": 0}
  },
  "verified_facts": ["string"],
  "verified_correct": true,
  "mismatches": ["string"],
  "ai_hallucinations_or_overclaims": ["string"],
  "bugs_or_risks": ["string"],
  "unknowns": ["string"],
  "forbidden_path_findings": ["string"],
  "final_decision": "ACCEPT | NEED_FIX | NO_GO | READY_FOR_USER_AUTHORIZATION"
}
```

`final_decision` rules (deterministic, in order):

- `forbidden_path_findings` non-empty ⇒ `NO_GO`
- `bugs_or_risks` or `mismatches` or `ai_hallucinations_or_overclaims` or `unknowns` non-empty ⇒ `NEED_FIX`
- otherwise ⇒ `READY_FOR_USER_AUTHORIZATION`

In AGENT-BRIDGE-004, `unknowns` blocks `READY_FOR_USER_AUTHORIZATION`. Examples of unknowns:

- `result.claimed_pushed=true` with no `claimed_commit` and missing or insufficient `claimed_push_state.origin_head` proof.
- `result.raw_outputs_summary` missing (cannot verify raw outputs).
- Local `~/.hermes` baseline mtime not all readable.

### Verification checks

The audit runner compares Claude claims against local reality:

- **Working tree comparison**: if dirty, `files_modified` claim must be a subset of `git status --short -uall`; if clean, must match `git show --name-only HEAD`.
- **Hard-forbidden paths**: any claim in `files_modified` matching `~/.hermes/*` or `docs/roadmap-locked-2026-05-28.md` ⇒ `forbidden_path_findings`.
- **Claimed commit hash**: must exist locally via `git cat-file -t <hash>`; if the result also claims `claimed_pushed=true`, the commit must additionally equal local HEAD, local HEAD must equal `origin/hermes-pro-main`, and `ahead=0, behind=0`.
- **Claimed pushed**: the post-push state is consistent when `claimed_commit` exists locally and equals local HEAD, and local `ahead=0, behind=0`. Otherwise the claim is mismatched (with `ahead>0` indicating unpushed local commits, `behind>0` indicating origin is ahead of local, or a non-existent / wrong commit hash). If `claimed_pushed=true` and `claimed_commit` is missing, the audit requires `claimed_push_state` to prove `head`, `origin_head`, `head === origin_head`, `ahead`, `behind`, and `ahead === 0, behind === 0`. A missing `claimed_push_state.origin_head` is **UNKNOWN** (blocks `READY_FOR_USER_AUTHORIZATION` in AGENT-BRIDGE-004) and the verdict becomes `NEED_FIX`.
- **Claimed push state**: `ahead` / `behind` / `head` fields must match local reality if provided.
- **Local hygiene**: `git diff --check` empty, `roadmap` diff empty, `.gitignore` diff empty, `~/.hermes` baseline mtime readable.
- **Raw outputs**: if `result.raw_outputs_summary` is missing ⇒ `unknowns`.
- **Not implemented in AGENT-BRIDGE-004**: actual content of `raw_outputs_summary`, semantic verification of `claimed_changes`, execution of `commands_run` (the runner does **not** run any of the commands listed in the result).

### Usage

```sh
node scripts/agent-bridge/audit-claude-result.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-004-task.json \
  --result /tmp/agent-bridge-004-result.json \
  --dry-run
```

```sh
node scripts/agent-bridge/audit-claude-result.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-004-task.json \
  --result /tmp/agent-bridge-004-result.json \
  --write-audit \
  --audit-id CODEX-004-001
```

### Verification expectation

After a successful `--execute`, the verification expectation is:

- `git status --short -uall` does **not** show `.agent-bridge/` (because `.gitignore` ignores it).
- `find .agent-bridge -maxdepth 3 -type f` MAY show `results/<task_id>.result.md` and `logs/<task_id>.log` — that is the expected runtime state.
- `git check-ignore -v .agent-bridge/results/<task_id>.result.md` shows the `.gitignore:51:.agent-bridge/` rule matched.

The verification expectation is **not** `test ! -d .agent-bridge` (that would be wrong — the directory is created by `--execute`).

## Controlled Write Flow (AGENT-BRIDGE-013)

`mode=write-files-only` restores the intended human-in-the-loop workflow:

1. Codex creates a task packet with an explicit `allowed_files` write allowlist.
2. Claude Code executes only repo-local file edits with Read/Grep/Glob/Edit/MultiEdit/Write.
3. Claude Code returns the strict 12-field structured JSON result.
4. The runner validates the JSON and independently checks the actual before/after repo delta.
5. Codex runs focused tests, `git status`, `git diff --check`, protected diffs, and `~/.hermes` mtime checks.
6. `audit-claude-result.mjs` compares Claude claims to local reality.
7. Codex reports the result to the user and asks before commit/push.

Write-mode runner rules:

- `allowed_files` is required and must be non-empty.
- `allowed_commands` must be empty because Bash is not exposed.
- Claude argv uses `--tools Read,Grep,Glob,Edit,MultiEdit,Write` and `--allowedTools Read,Grep,Glob,Edit,MultiEdit,Write`.
- Claude argv uses `--disallowedTools Bash,NotebookEdit,WebFetch,WebSearch,Task`.
- `claimed_commit` must be `null`, `claimed_pushed` must be `false`, and `claimed_push_state` must be `null`.
- The runner snapshots repo files, HEAD/origin/ahead/behind, and `~/.hermes` mtimes before and after Claude.
- `.result.json` is written only if changed files are exactly represented by `files_modified` and every actual changed file is inside `allowed_files`.
- A forbidden write, missing claimed file, extra claimed file, commit/push claim, HEAD/origin change, or `~/.hermes` mtime change writes `.result.raw.txt` and exits 1.
- The runner adds `_agent_bridge.changed_files` to successful `.result.json`; the audit runner uses that runner-collected fact to catch mismatched file claims.
- On `spawnSync` errors, including `ETIMEDOUT`, the runner still performs the write-mode after snapshot and records `partial_changed_files` plus `partial_post_run_validation` in the lifecycle log and latest pointer. Partial allowed writes are reported as changed files, partial forbidden writes are reported with validation errors, and the process still exits 1 with `.result.raw.txt`.

Current residual risk:

- The runner validates repo-local file deltas and the explicit `~/.hermes`
  mtime sentinels. It does not provide a general filesystem monitor for every
  possible path outside the repo. `write-files-only` prompts forbid absolute,
  `~`, `..`, secret, and external paths, and Claude is invoked without Bash, but
  arbitrary external writes by the Claude process are outside the runner's
  current observable delta model. Treat external-path containment as an
  unsupported risk until a future sandbox/FS monitor slice addresses it.

## Out of scope (current bridge)

- **No Codex invocation runner / no LLM semantic audit invocation.** Phase 3 (Codex audit) is a separate future slice with a separate user authorization.
- **No commit / push / live apply automation.** User authorization remains required for every commit / push / abort.
- **No live apply / HCC Auto Executor / model runtime.**
- **No `--dangerously-skip-permissions`.**

## Not implemented in AGENT-BRIDGE-004

- **No Codex invocation.** The audit runner is local-only; it compares Claude result claims against `git`, `git status`, `stat`, etc. — it does **not** call Codex.
- **No semantic verification of `claimed_changes` text.** The runner treats the result as untrusted data; it checks structured fields (`files_modified`, `claimed_commit`, `claimed_pushed`, etc.) but does not interpret free-text claims.
- **No execution of `commands_run` claims.** The runner does **not** run any shell command listed in the Claude result; it only verifies local reality.
- **No audit of `raw_outputs_summary` content.** The runner checks the field's presence but does not parse or re-verify its contents.
- **No cross-task memory.** Every audit is independent; the runner does not consult prior audit verdicts.
- **No commit / push automation.** The audit produces a verdict; the user runs any follow-up actions manually.

## Authorization report generator (AGENT-BRIDGE-007)

`generate-authorization-report.mjs` reads a task packet, result JSON, and
audit JSON, and produces a user-facing markdown authorization report.

- It is **not** a dashboard. It is **not** an executor.
- It **does not** commit, push, amend, rebase, or squash.
- It **does not** call Claude or Codex.
- It **does not** authorize anything by itself — the user remains the final gate.

### CLI flags

```
--repo <path>             Path to repo root
--task <path>             Path to task packet JSON
--result <path>           Path to Claude result JSON
--audit <path>            Path to audit JSON
--authorization-id <id>   Report identifier (required for --write-report)
--dry-run                 Print report to stdout; do not write
--write-report            Write under <bridge-root>/authorizations/
--bridge-root <path>      Optional; default = <repo>/.agent-bridge
--help, -h                Print this message
```

### Output

`--dry-run`: prints markdown to stdout. `--write-report`: writes
`.agent-bridge/authorizations/<authorization-id>.authorization.md`
(ignored via `.gitignore:51:.agent-bridge/`).

### Report sections

1. Task (task_id, mode, objective)
2. Executor Result (final_verdict, claimed_changes, files_modified, commands_run)
3. Audit Result (audit_id, final_decision, verified_correct, mismatches, hallucinations, bugs, unknowns, forbidden_path_findings)
4. Local Reality Summary (branch, HEAD, origin, ahead/behind, working tree)
5. Recommendation:
   - `READY_FOR_USER_AUTHORIZATION` if audit says so
   - `DO NOT AUTHORIZE; REQUEST FIX` for NEED_FIX
   - `NO-GO` for NO_GO
6. User Authorization Required:
   - `yes, authorize this result`
   - `no, request fix`
   - `abort task`

### Input consistency checks

Before generating the report, the generator validates:
- `task.task_id === result.task_id`
- `task.task_id === audit.task_id`
- `audit.claimed_facts` exists and is an object
- `audit.claimed_facts.result_task_id` is a non-null string AND equals `task.task_id` (mandatory; missing result_task_id is a consistency error)
- `audit.final_decision` exists
- `audit.verified_correct` is boolean
- `--authorization-id` matches `^[A-Za-z0-9._-]+$` (rejects `/`, `\`, `..`, spaces, absolute paths)

Any inconsistency → `AUTHORIZATION REPORT INVALID: INPUTS DO NOT MATCH` heading.
The report **must not** say `READY FOR USER AUTHORIZATION` when inconsistency errors exist.
Invalid consistency report inputs cannot produce a READY recommendation.

If any check fails, the report heading becomes
`AUTHORIZATION REPORT INVALID: INPUTS DO NOT MATCH` and `--write-report`
exits nonzero.

### Example

```sh
node scripts/agent-bridge/generate-authorization-report.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-006-task.json \
  --result .agent-bridge/results/AGENT-BRIDGE-006-E2E-SMOKE.result.json \
  --audit .agent-bridge/audits/AGENT-BRIDGE-006-E2E-SMOKE.audit.json \
  --dry-run

node scripts/agent-bridge/generate-authorization-report.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task /tmp/agent-bridge-006-task.json \
  --result .agent-bridge/results/AGENT-BRIDGE-006-E2E-SMOKE.result.json \
  --audit .agent-bridge/audits/AGENT-BRIDGE-006-E2E-SMOKE.audit.json \
  --write-report --authorization-id AGENT-BRIDGE-006-E2E-SMOKE
```

## Hard boundaries (every slice, including future ones)

- The bridge **must not** commit on the user's behalf.
- The bridge **must not** push on the user's behalf.
- The bridge **must not** rewrite git history.
- The bridge **must not** write to `~/.hermes/*` on the user's behalf.
- The bridge **must not** write to `docs/roadmap-locked-2026-05-28.md`.
- The bridge **must not** call `knowledgeIngest`, `knowledgeSearch`, live apply, HCC Auto Executor, or any local model runtime.
- The user must always issue an explicit plain-text authorization phrase for commit / push / abort.

## AGENT-BRIDGE-008 real Claude smoke (closeout)

The full pipeline was exercised with the real `claude` CLI on 2026-06-09.
**Run 1 failed safely** (wrong JSON types rejected by the 005A validator).
**005D prompt hardening** added a canonical JSON example and anti-overclaim
rules. **Run 2 passed** — `.result.json`, audit `READY_FOR_USER_AUTHORIZATION`,
authorization report `READY FOR USER AUTHORIZATION`. The auto-mode classifier
blocks bridge-driven real Claude invocation, so the smoke was run manually.
Full details: `docs/agent-bridge/agent-bridge-real-claude-smoke-2026-06-09.md`.

## Artifact resolution (AGENT-BRIDGE-009)

Each `--execute` run writes:
- A lifecycle log to `.agent-bridge/logs/<task_id>.log` (overwritten per run)
- A **latest pointer** to `.agent-bridge/results/<task_id>.latest.json`

The latest pointer schema:
```json
{
  "task_id": "string",
  "run_id": "<task_id>-<epoch_ms>",
  "status": "success" | "failed",
  "result_path": "<path to .result.json or .result.raw.txt>",
  "log_path": "<path to .log>",
  "created_at": "ISO 8601",
  "claude_exit_code": 0 | number | null,
  "partial_changed_files": ["path"] | null,
  "partial_post_run_validation": {"ok": "boolean", "partial": true, "errors": ["string"], "changedFiles": ["path"]} | null
}
```

**Consumers (humans and scripts) should read `latest.json` to find the
canonical result for the latest run.** `result_path` and `log_path` always
point to existing files. The audit runner and authorization generator still
require explicit `--result` / `--audit` paths — they do not automatically
discover artifacts from `latest.json`.

On a successful `.result.json` write, the runner archives any pre-existing
`.result.raw.txt` for the same task_id. The archive filename uses the
**previous failed run's `run_id`** (read from the previous log) rather than
the current successful `run_id`, preserving provenance to the source failed
run. If the previous log is missing or unreadable, the fallback name is
`unknown-previous-run-<current_run_id>.result.raw.txt`.

On a spawn error (e.g., Claude binary not found), `.result.raw.txt` is
written with a short error note, so `latest.json.result_path` always
points to an existing file.

For `write-files-only` spawn errors/timeouts, `latest.json` also includes
`partial_changed_files` and `partial_post_run_validation`. Those fields are
`null` when no partial write-mode validation was applicable.

Run grouping:
- `.agent-bridge/results/<task_id>.result.json` — canonical success artifact
- `.agent-bridge/results/<task_id>.result.raw.txt` — last failure artifact (absent if last run succeeded)
- `.agent-bridge/logs/<task_id>.log` — always overwritten; latest run wins
- `.agent-bridge/archive/<task_id>/` — historical stale artifacts

## Task packet publisher (AGENT-BRIDGE-010)

`publish-task-packet.mjs` creates standardized AGENT-BRIDGE task JSON packets
under ignored `.agent-bridge/tasks/pending/`. This lets Codex/user create
Claude tasks without hand-copying prompts.

- It does **not** execute Claude or Codex.
- It does **not** commit, push, or write outside `.agent-bridge/tasks/pending/`.
- Hard forbidden actions (`git commit`, `git push`, `git commit --amend`, `git rebase`, `git reset --hard`, `squash`, `live apply`, `HCC Auto Executor`) are always included automatically.
- Hard forbidden files (`~/.hermes/*`, `docs/roadmap-locked-2026-05-28.md`) are merged with user-supplied forbidden files.
- `write-files-only` mode requires at least one `--allowed-file` and rejects `--allowed-command`.
- The write-mode smoke suite includes a documented unsupported-risk case for
  repo-external writes: the runner can detect repo-local forbidden changes but
  cannot currently prove absence of arbitrary writes outside the repo beyond
  the explicit `~/.hermes` mtime sentinels.
- The smoke suite covers timeout partial-change handling for both an allowed
  file write and a forbidden file write; both runs must fail while reporting
  the partial changed file through `.result.raw.txt`, lifecycle log, and
  `latest.json`.
- Existing task files are not overwritten; use a different `--task-id` or remove the old file first.

### CLI flags

| Flag | Required | Description |
|---|---|---|
| `--repo <path>` | yes | repo root (absolute) |
| `--task-id <id>` | yes | `[A-Za-z0-9._-]+` |
| `--mode <mode>` | yes | `design-only`, `read-only`, or `write-files-only` |
| `--objective <text>` | yes | 1-3 sentence description |
| `--allowed-file <path>` | no | repeatable |
| `--forbidden-file <path>` | no | repeatable |
| `--allowed-command <cmd>` | no | repeatable |
| `--required-verification <v>` | no | repeatable |
| `--expected-authorization-type <type>` | no | default: `none` |
| `--dry-run` | one of | print JSON to stdout |
| `--write-task` | one of | write `.agent-bridge/tasks/pending/<id>.task.json` |
| `--bridge-root <path>` | no | default `<repo>/.agent-bridge` |

### Usage

```sh
# Dry-run
node scripts/agent-bridge/publish-task-packet.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task-id MY-TASK-001 \
  --mode read-only \
  --objective "Audit the latest commit for correctness." \
  --dry-run

# Write task, then run the runner against it
node scripts/agent-bridge/publish-task-packet.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task-id MY-TASK-001 \
  --mode read-only \
  --objective "Audit the latest commit." \
  --write-task

node scripts/agent-bridge/run-claude-task.mjs \
  --repo /Users/midoudou/hermes-pro \
  --task .agent-bridge/tasks/pending/MY-TASK-001.task.json \
  --execute
```

## Phase roadmap (per design doc)

| Phase | What it adds | Status |
|---|---|---|
| 1 | File bridge only (manual Codex / Claude / user) | Done in AGENT-BRIDGE-001 (design doc) |
| 2 | Claude Runner | **AGENT-BRIDGE-003** (this slice) — design-only / read-only; tools disabled; no audit; no commit |
| 3 | Claude Runner + Codex Audit Runner | Future slice, separate user authorization |
| 4 | Authorization Dashboard / one-click approval | Future slice, separate user authorization |

## Future-slice notes

- A future slice may add real Codex audit invocation, gated on a separate user authorization slice.
- A future slice may add a local web UI, gated on a separate user authorization slice.
- None of these are part of AGENT-BRIDGE-013.
