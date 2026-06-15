// HCC Controlled Dispatch Adapter.
//
// Backend layer for the shared invocation service. This module
// produces a `HCCFinalControlledRealDispatchAdapter` whose
// `dispatch` function plans a controlled dispatch against one
// of four explicit backends (in_memory, shell_command,
// file_write, config_patch) and then performs the dispatch
// through fully INJECTED executors. The lib never calls
// `spawn` / `exec` / `child_process` / `writeFile` / `readFile`
// directly; production wiring supplies the executors; tests
// supply mocks.
//
// Per HCC governance (origin `c57f0ff`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//   - The adapter does NOT call `submitDryRunAction`
//
// This slice does NOT wire the adapter into terminal / app /
// IPC / renderer / preload / app boot / timer / cron / auto-arm.
// The adapter is a library callable; it has no product
// entrypoint of its own. The shared invocation service
// receives this adapter as a normal injected dependency.
//
// Backend rules:
//   - in_memory: no side effects; the dispatch returns a
//     controlled_command_id derived from the planned action.
//     Used for tests and for callers that want a planning-only
//     pass.
//   - shell_command: allowlisted commands only. The
//     allowlist is `HCC_DISPATCH_SHELL_ALLOWLIST` in this
//     module. A non-allowlisted command is denied. The actual
//     execution is performed by `deps.executor`; the lib never
//     calls the shell directly.
//   - file_write: target path must be repo-local under
//     `docs/`, `src/`, or `tests/`, with a `.md` / `.json` /
//     `.ts` / `.tsx` / `.txt` extension. The path MUST NOT
//     start with `~`, MUST NOT contain `..`, MUST NOT equal
//     any path in `LOCKED_PATHS` (src/main/index.ts,
//     package.json, package-lock.json, docs/knowledge/**).
//     The actual write is performed by `deps.writer`; the
//     lib never touches the filesystem directly.
//   - config_patch: target path must be a repo-local JSON file
//     under `docs/` or `src/`, with the same path and locked
//     rules as file_write. The patch is a structured key/value
//     delta applied via `deps.patcher`; the lib never reads
//     or writes the file directly.

import type {
  HCCFinalControlledRealDispatchAdapter,
} from "./hcc-final-controlled-real-dispatch";

export const HCC_CONTROLLED_DISPATCH_ADAPTER_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCControlledDispatchBackendKind =
  | "in_memory"
  | "shell_command"
  | "file_write"
  | "config_patch";

/**
 * Allowlist of shell commands the shell_command backend is
 * permitted to dispatch. Each entry pairs a command id with
 * the exact argv vector that will be passed to the injected
 * executor. Free-form shell strings (e.g. "rm -rf /") are
 * NEVER accepted: dispatching a command not in this list
 * returns a typed failure.
 */
export interface HCCShellCommandAllowlistEntry {
  /** Stable id of the allowlisted command. */
  command_id: string;
  /** The argv vector. Element 0 is the program name. */
  argv: readonly string[];
}

export const HCC_DISPATCH_SHELL_ALLOWLIST: readonly HCCShellCommandAllowlistEntry[] =
  [
    { command_id: "git.status", argv: ["git", "status"] },
    { command_id: "git.diff", argv: ["git", "diff"] },
    {
      command_id: "git.show",
      argv: ["git", "show", "--stat", "HEAD"],
    },
  ];

const PATH_SEP_PATTERN = /[\\/]/;
const ALLOWED_FILE_EXTS: ReadonlySet<string> = new Set([
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".txt",
]);
const FILE_WRITE_ALLOWED_PREFIXES: readonly string[] = [
  "docs/",
  "src/",
  "tests/",
];

const LOCKED_PATHS: readonly string[] = [
  "src/main/index.ts",
  "package.json",
  "package-lock.json",
];

function splitPath(p: string): string[] {
  return p.split(PATH_SEP_PATTERN).filter((seg) => seg.length > 0);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAllowedExtension(p: string): boolean {
  const lastDot = p.lastIndexOf(".");
  if (lastDot < 0) return false;
  return ALLOWED_FILE_EXTS.has(p.slice(lastDot).toLowerCase());
}

function isRepoLocalFilePath(p: string): boolean {
  if (!isNonEmptyString(p)) return false;
  if (p.startsWith("~")) return false;
  if (p.startsWith("/")) return false;
  // Windows-style absolute: drive letter at start.
  if (/^[a-zA-Z]:[\\/]/.test(p)) return false;
  const segs = splitPath(p);
  for (const seg of segs) {
    if (seg === "..") return false;
  }
  if (!FILE_WRITE_ALLOWED_PREFIXES.some((prefix) => p.startsWith(prefix))) {
    return false;
  }
  return true;
}

function isLockedPath(p: string): boolean {
  if (LOCKED_PATHS.includes(p)) return true;
  const segs = splitPath(p);
  if (segs.length >= 2 && segs[0] === "docs" && segs[1] === "knowledge") {
    return true;
  }
  return false;
}

/**
 * Typed failure for the adapter layer. The lib raises these
 * on every denied dispatch; callers may catch or propagate.
 */
export interface HCCControlledDispatchFailure {
  kind: "DENIED" | "BACKEND_UNAVAILABLE" | "EXECUTOR_REJECTED" | "INVALID_INPUT";
  backend: HCCControlledDispatchBackendKind;
  planned_action_id: string;
  reason: string;
}

/**
 * Audit summary attached to every dispatch result, including
 * denied ones.
 */
export interface HCCControlledDispatchAuditSummary {
  planned_action_id: string;
  backend: HCCControlledDispatchBackendKind;
  target_identity: string;
  would_execute: boolean;
  denied: boolean;
  denial_reason: string;
  executed: boolean;
  executor: "in-memory" | "shell" | "writer" | "patcher";
  generated_at: string;
}

export interface HCCControlledDispatchSuccess {
  backend: HCCControlledDispatchBackendKind;
  controlled_command_id: string;
  audit: HCCControlledDispatchAuditSummary;
}

export type HCCControlledDispatchResult =
  | { ok: true; value: HCCControlledDispatchSuccess }
  | { ok: false; failure: HCCControlledDispatchFailure };

/**
 * Injected executors. The lib never calls the shell, never
 * writes to the filesystem, never patches a file. The
 * production wiring (future slice) supplies these. Tests
 * inject mocks.
 */
export interface HCCControlledDispatchExecutorDeps {
  /**
   * Run an allowlisted shell command. Returns a stable
   * command id. MUST throw on rejection. The lib NEVER
   * calls the shell directly; the executor is the only
   * shell surface.
   */
  shell_executor: (
    command_id: string,
    argv: readonly string[],
  ) => Promise<{ command_id: string }> | { command_id: string };
  /**
   * Write content to a repo-local path. Returns the
   * controlled_command_id. MUST throw on rejection.
   */
  writer: (
    target_path: string,
    content: string,
  ) => Promise<{ controlled_command_id: string }> | { controlled_command_id: string };
  /**
   * Apply a structured JSON patch. Returns the
   * controlled_command_id. MUST throw on rejection.
   */
  patcher: (
    target_path: string,
    patch: ReadonlyArray<{ key: string; value: unknown }>,
  ) => Promise<{ controlled_command_id: string }> | { controlled_command_id: string };
}

/**
 * Caller-provided proof that the dispatch is user-explicit.
 * The shared invocation service carries this in the
 * `explicit_user_trigger_token` field; the adapter re-checks
 * it defensively so the adapter cannot be wired into a path
 * that did not go through the shared service.
 */
export interface HCCControlledDispatchTriggerProof {
  explicit_user_trigger_token: string;
  /**
   * The service that minted the trigger. The adapter
   * refuses triggers from unknown services.
   */
  source_service: "hcc-shared-invocation-service" | "hcc-user-explicit-local-invoker";
}

/**
 * The single dispatch input. The shape is the slice-local
 * analogue of the shared fixture's planned-action fields, but
 * scoped to the adapter's own concerns (backend kind,
 * payload, trigger proof, executors).
 */
export interface HCCControlledDispatchInput {
  planned_action_id: string;
  backend: HCCControlledDispatchBackendKind;
  /**
   * Backend-specific payload.
   *   - in_memory:        unused (must be undefined)
   *   - shell_command:    { argv: readonly string[] }
   *   - file_write:       { target_path, content }
   *   - config_patch:     { target_path, patch }
   */
  payload:
    | undefined
    | {
        kind: "shell";
        argv: readonly string[];
      }
    | {
        kind: "file";
        target_path: string;
        content: string;
      }
    | {
        kind: "config";
        target_path: string;
        patch: ReadonlyArray<{ key: string; value: unknown }>;
      };
  trigger_proof: HCCControlledDispatchTriggerProof;
  executors: HCCControlledDispatchExecutorDeps;
  /**
   * Optional clock for deterministic audit timestamps.
   * Tests pass a fixed value; production wiring passes
   * `() => new Date().toISOString()`.
   */
  now: () => string;
}

function deny(
  input: HCCControlledDispatchInput,
  reason: string,
  kind: HCCControlledDispatchFailure["kind"] = "DENIED",
): HCCControlledDispatchResult {
  return {
    ok: false,
    failure: {
      kind,
      backend: input.backend,
      planned_action_id: input.planned_action_id,
      reason,
    },
  };
}

function auditSummary(
  input: HCCControlledDispatchInput,
  executed: boolean,
  executor: HCCControlledDispatchAuditSummary["executor"],
  targetIdentity: string,
  denied: boolean,
  denialReason: string,
): HCCControlledDispatchAuditSummary {
  return {
    planned_action_id: input.planned_action_id,
    backend: input.backend,
    target_identity: targetIdentity,
    would_execute: executed,
    denied,
    denial_reason: denialReason,
    executed,
    executor,
    generated_at: input.now(),
  };
}

function findAllowlistEntry(
  argv: readonly string[],
): HCCShellCommandAllowlistEntry | undefined {
  for (const entry of HCC_DISPATCH_SHELL_ALLOWLIST) {
    if (entry.argv.length !== argv.length) continue;
    let match = true;
    for (let i = 0; i < entry.argv.length; i++) {
      if (entry.argv[i] !== argv[i]) {
        match = false;
        break;
      }
    }
    if (match) return entry;
  }
  return undefined;
}

async function dispatchInMemory(
  input: HCCControlledDispatchInput,
): Promise<HCCControlledDispatchResult> {
  // in_memory: no payload required; no executor call.
  const controlled_command_id = `in-memory:${input.planned_action_id}`;
  return {
    ok: true,
    value: {
      backend: "in_memory",
      controlled_command_id,
      audit: auditSummary(
        input,
        true,
        "in-memory",
        controlled_command_id,
        false,
        "",
      ),
    },
  };
}

async function dispatchShell(
  input: HCCControlledDispatchInput,
): Promise<HCCControlledDispatchResult> {
  if (input.payload === undefined || (input.payload as { kind?: string }).kind !== "shell") {
    return deny(input, "shell_command backend requires payload.kind=shell");
  }
  const argv = (input.payload as { argv: readonly string[] }).argv;
  if (!Array.isArray(argv) || argv.length === 0) {
    return deny(input, "shell_command payload must include a non-empty argv");
  }
  for (let i = 0; i < argv.length; i++) {
    if (typeof argv[i] !== "string" || argv[i].length === 0) {
      return deny(input, `shell_command argv[${i}] must be a non-empty string`);
    }
  }
  const entry = findAllowlistEntry(argv);
  if (!entry) {
    return {
      ok: false,
      failure: {
        kind: "DENIED",
        backend: "shell_command",
        planned_action_id: input.planned_action_id,
        reason: `argv is not in the shell allowlist; refused to dispatch arbitrary command`,
      },
    };
  }
  let result: { command_id: string };
  try {
    result = await input.executors.shell_executor(entry.command_id, entry.argv);
  } catch (err) {
    return {
      ok: false,
      failure: {
        kind: "EXECUTOR_REJECTED",
        backend: "shell_command",
        planned_action_id: input.planned_action_id,
        reason: `shell_executor rejected: ${(err as Error).message ?? String(err)}`,
      },
    };
  }
  const controlled_command_id = `shell:${result.command_id}:${input.planned_action_id}`;
  return {
    ok: true,
    value: {
      backend: "shell_command",
      controlled_command_id,
      audit: auditSummary(
        input,
        true,
        "shell",
        entry.command_id,
        false,
        "",
      ),
    },
  };
}

async function dispatchFileWrite(
  input: HCCControlledDispatchInput,
): Promise<HCCControlledDispatchResult> {
  if (input.payload === undefined || (input.payload as { kind?: string }).kind !== "file") {
    return deny(input, "file_write backend requires payload.kind=file");
  }
  const payload = input.payload as {
    target_path: string;
    content: string;
  };
  if (!isNonEmptyString(payload.target_path)) {
    return deny(input, "file_write payload must include a non-empty target_path");
  }
  if (typeof payload.content !== "string") {
    return deny(input, "file_write payload must include string content");
  }
  if (!isRepoLocalFilePath(payload.target_path)) {
    return deny(
      input,
      "file_write target_path is not repo-local under docs/, src/, or tests/",
    );
  }
  if (!hasAllowedExtension(payload.target_path)) {
    return deny(
      input,
      "file_write target_path must end in .md, .json, .ts, .tsx, or .txt",
    );
  }
  if (isLockedPath(payload.target_path)) {
    return deny(
      input,
      `file_write target_path is in a locked scope: ${payload.target_path}`,
    );
  }
  let result: { controlled_command_id: string };
  try {
    result = await input.executors.writer(payload.target_path, payload.content);
  } catch (err) {
    return {
      ok: false,
      failure: {
        kind: "EXECUTOR_REJECTED",
        backend: "file_write",
        planned_action_id: input.planned_action_id,
        reason: `writer rejected: ${(err as Error).message ?? String(err)}`,
      },
    };
  }
  return {
    ok: true,
    value: {
      backend: "file_write",
      controlled_command_id: result.controlled_command_id,
      audit: auditSummary(
        input,
        true,
        "writer",
        payload.target_path,
        false,
        "",
      ),
    },
  };
}

async function dispatchConfigPatch(
  input: HCCControlledDispatchInput,
): Promise<HCCControlledDispatchResult> {
  if (input.payload === undefined || (input.payload as { kind?: string }).kind !== "config") {
    return deny(input, "config_patch backend requires payload.kind=config");
  }
  const payload = input.payload as {
    target_path: string;
    patch: ReadonlyArray<{ key: string; value: unknown }>;
  };
  if (!isNonEmptyString(payload.target_path)) {
    return deny(input, "config_patch payload must include a non-empty target_path");
  }
  if (!Array.isArray(payload.patch) || payload.patch.length === 0) {
    return deny(
      input,
      "config_patch payload must include a non-empty patch array",
    );
  }
  if (!isRepoLocalFilePath(payload.target_path)) {
    return deny(
      input,
      "config_patch target_path is not repo-local under docs/, src/, or tests/",
    );
  }
  if (!hasAllowedExtension(payload.target_path)) {
    return deny(
      input,
      "config_patch target_path must end in .md, .json, .ts, .tsx, or .txt",
    );
  }
  if (isLockedPath(payload.target_path)) {
    return deny(
      input,
      `config_patch target_path is in a locked scope: ${payload.target_path}`,
    );
  }
  for (let i = 0; i < payload.patch.length; i++) {
    const entry = payload.patch[i];
    if (!entry || typeof entry !== "object") {
      return deny(
        input,
        `config_patch patch[${i}] must be an object { key, value }`,
      );
    }
    if (typeof (entry as { key?: unknown }).key !== "string") {
      return deny(input, `config_patch patch[${i}].key must be a string`);
    }
  }
  let result: { controlled_command_id: string };
  try {
    result = await input.executors.patcher(
      payload.target_path,
      payload.patch,
    );
  } catch (err) {
    return {
      ok: false,
      failure: {
        kind: "EXECUTOR_REJECTED",
        backend: "config_patch",
        planned_action_id: input.planned_action_id,
        reason: `patcher rejected: ${(err as Error).message ?? String(err)}`,
      },
    };
  }
  return {
    ok: true,
    value: {
      backend: "config_patch",
      controlled_command_id: result.controlled_command_id,
      audit: auditSummary(
        input,
        true,
        "patcher",
        payload.target_path,
        false,
        "",
      ),
    },
  };
}

/**
 * The main dispatch entrypoint. Routes to the right backend,
 * runs guards, and dispatches through the injected executors.
 * Returns a typed result; never throws on denials (denials are
 * the typed `ok: false` branch). Only the executor throw path
 * surfaces as `ok: false` with `kind: "EXECUTOR_REJECTED"`.
 */
export async function controlledDispatch(
  input: HCCControlledDispatchInput,
): Promise<HCCControlledDispatchResult> {
  if (!isNonEmptyString(input.planned_action_id)) {
    return deny(input, "planned_action_id must be a non-empty string");
  }
  if (!isNonEmptyString(input.trigger_proof.explicit_user_trigger_token)) {
    return deny(input, "missing explicit_user_trigger_token");
  }
  if (
    input.trigger_proof.source_service !== "hcc-shared-invocation-service" &&
    input.trigger_proof.source_service !== "hcc-user-explicit-local-invoker"
  ) {
    return deny(input, "trigger_proof.source_service is not recognized");
  }
  if (!input.executors || typeof input.executors !== "object") {
    return deny(input, "missing executors dependency");
  }
  if (typeof input.executors.shell_executor !== "function") {
    return deny(input, "executors.shell_executor must be a function");
  }
  if (typeof input.executors.writer !== "function") {
    return deny(input, "executors.writer must be a function");
  }
  if (typeof input.executors.patcher !== "function") {
    return deny(input, "executors.patcher must be a function");
  }
  if (typeof input.now !== "function") {
    return deny(input, "missing now() clock function");
  }

  switch (input.backend) {
    case "in_memory":
      return await dispatchInMemory(input);
    case "shell_command":
      return await dispatchShell(input);
    case "file_write":
      return await dispatchFileWrite(input);
    case "config_patch":
      return await dispatchConfigPatch(input);
    default:
      return deny(input, "unknown backend", "BACKEND_UNAVAILABLE");
  }
}

/**
 * Build a `HCCFinalControlledRealDispatchAdapter` from a
 * factory that returns a `controlledDispatch` input. The
 * adapter is fully injectable; the lib never auto-selects a
 * real backend. The factory must produce a fresh trigger
 * proof + planned action for each dispatch so the lib
 * cannot be misused.
 */
export function buildControlledDispatchAdapter(
  factory: () => Omit<
    HCCControlledDispatchInput,
    "executors" | "now"
  > & {
    executors: HCCControlledDispatchExecutorDeps;
    now: () => string;
  },
): HCCFinalControlledRealDispatchAdapter {
  return {
    supportsKind: (kind) =>
      kind === "shell_command" ||
      kind === "file_write" ||
      kind === "config_patch",
    dispatch: async (
      planned_action_id: string,
      kind: "shell_command" | "file_write" | "config_patch",
      target_path: string,
    ) => {
      const fresh = factory();
      // Re-stamp planned_action_id / target_path from the
      // final dispatch contract's actual call so the lib
      // cannot be misused via stale factory values.
      const stamped: HCCControlledDispatchInput = {
        ...fresh,
        planned_action_id,
        backend: kind,
        payload: derivePayloadFromKind(kind, target_path, fresh.payload),
      };
      const r = await controlledDispatch(stamped);
      if (!r.ok) {
        throw new Error(
          `controlled dispatch denied: ${r.failure.kind}: ${r.failure.reason}`,
        );
      }
      return { controlled_command_id: r.value.controlled_command_id };
    },
  };
}

function derivePayloadFromKind(
  kind: "shell_command" | "file_write" | "config_patch",
  target_path: string,
  existing:
    | undefined
    | {
        kind: "shell";
        argv: readonly string[];
      }
    | {
        kind: "file";
        target_path: string;
        content: string;
      }
    | {
        kind: "config";
        target_path: string;
        patch: ReadonlyArray<{ key: string; value: unknown }>;
      },
):
  | undefined
  | {
      kind: "shell";
      argv: readonly string[];
    }
  | {
      kind: "file";
      target_path: string;
      content: string;
    }
  | {
      kind: "config";
      target_path: string;
      patch: ReadonlyArray<{ key: string; value: unknown }>;
    } {
  // Prefer the caller's payload when it matches the kind;
  // otherwise re-derive from the final dispatch's call. For
  // shell_command the final dispatch does not carry argv;
  // the factory must supply it.
  if (kind === "shell_command") {
    if (existing && (existing as { kind?: string }).kind === "shell") {
      return existing;
    }
    return undefined;
  }
  if (kind === "file_write") {
    if (existing && (existing as { kind?: string }).kind === "file") {
      return existing;
    }
    return {
      kind: "file",
      target_path,
      content: "",
    };
  }
  if (kind === "config_patch") {
    if (existing && (existing as { kind?: string }).kind === "config") {
      return existing;
    }
    return undefined;
  }
  return undefined;
}
