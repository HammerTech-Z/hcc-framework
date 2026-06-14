// HCC Audit Actual-Write Contract.
//
// Repo-local audit artifact write support for HCC real-execution
// readiness. This slice WRITES TO DISK, but ONLY to the repo-local
// `docs/audit/hcc/**` tree. It NEVER writes to `~/.hermes/**`. It
// NEVER executes commands, NEVER spawns, NEVER imports
// bootstrap / arm / start / host, NEVER calls `submitDryRunAction`.
//
// Per HCC governance (origin `d351580`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start
//
// The contract has two functions:
//   1. `planAuditActualWrite(input)` — pure. Returns a write plan
//      (NO-GO or a structured plan describing the write). No I/O.
//   2. `executeAuditActualWrite(plan, deps)` — performs the I/O via
//      an injected writer dependency. The default `node:fs` writer
//      is wired by the consumer; tests inject a mock. The function
//      does NOT spawn, does NOT call `writeFile` directly when
//      `deps` is omitted — the I/O is always performed through the
//      injected writer so tests can intercept every write.

import { HCC_AUDIT_ALLOWED_PREFIX } from "./hcc-audit-artifact-persistence";

export const HCC_AUDIT_ACTUAL_WRITE_SCHEMA_VERSION = "1.0.0" as const;

const ALLOWED_PREFIX: string = HCC_AUDIT_ALLOWED_PREFIX;
const ALLOWED_EXTS: ReadonlySet<string> = new Set([".md", ".json"]);

/**
 * Pluggable writer dependency. The default consumer wires
 * `node:fs/promises.writeFile`; tests MUST inject a mock so no real
 * I/O happens during unit tests.
 */
export interface HCCAuditWriteDeps {
  writeFile: (path: string, content: string) => Promise<void> | void;
  mkdir: (dir: string, opts: { recursive: boolean }) => Promise<void> | void;
}

export type HCCAuditActualWriteVerdict =
  | "AUDIT-ACTUAL-WRITE-CANDIDATE"
  | "AUDIT-ACTUAL-WRITTEN"
  | "NO-GO";

export interface HCCAuditPayload {
  /** MUST be false at payload level. */
  would_execute: false;
  /** MUST be false at payload level. */
  real_execution_ready: false;
  /** MUST be false at payload level. */
  unattended_ready: false;
  /** MUST be false at payload level. */
  any_command_executed: false;
  /** MUST be empty. */
  executed_commands: readonly [];
  /** MUST be "NO-GO" at payload level. */
  go_no_go: "NO-GO";
  /** Free-form body the caller wants persisted. */
  body: string;
}

export interface HCCAuditActualWriteInput {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  runner_verdict: "CONTROLLED-REAL-RUNNER-CANDIDATE";
  dry_run_artifact_hash: string;
  planned_action_id: string;
  planned_action_kind:
    | "shell_command"
    | "file_write"
    | "config_patch";
  whitelist_action_id: string;
  /**
   * The repo-local target path for the audit artifact. MUST be
   * under `docs/audit/hcc/**` and end in `.md` or `.json`.
   */
  target_path: string;
  /** The audit payload. Field shape is enforced (see HCCAuditPayload). */
  audit_payload: HCCAuditPayload;
}

/**
 * Result of `planAuditActualWrite`. Pure projection.
 */
export interface HCCAuditActualWritePlan {
  schema_version: "1.0.0";
  verdict: HCCAuditActualWriteVerdict;
  reason: string;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  planned_action_id: string;
  planned_action_kind:
    | "shell_command"
    | "file_write"
    | "config_patch"
    | "";
  whitelist_action_id: string;
  target_path: string;
  /** Resolved full path. Populated only when verdict is CANDIDATE. */
  resolved_path: string;
  /** Allowed prefix used for the under-prefix check. */
  allowed_prefix: string;
  /** Execution fields. ALWAYS literal-false on plan. */
  would_execute: false;
  executed_commands: readonly [];
  subprocess_count: 0;
  auto_executor_started: false;
  any_command_executed: false;
  real_execution_ready: false;
  unattended_ready: false;
  night_run_ready: false;
  go_no_go: "NO-GO";
  /** Whether the write was actually performed. */
  written: boolean;
}

/**
 * Result of `executeAuditActualWrite`. Wraps the plan plus the
 * final verdict (CANDIDATE if not yet written, WRITTEN after I/O).
 */
export interface HCCAuditActualWriteResult extends HCCAuditActualWritePlan {
  verdict: HCCAuditActualWriteVerdict;
}

const PATH_SEP_PATTERN = /[\\/]/;

function splitPath(p: string): string[] {
  return p.split(PATH_SEP_PATTERN).filter((seg) => seg.length > 0);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAllowedExtension(p: string): boolean {
  const lastDot = p.lastIndexOf(".");
  if (lastDot < 0) return false;
  const ext = p.slice(lastDot).toLowerCase();
  return ALLOWED_EXTS.has(ext);
}

function isUnderAllowedPrefix(p: string): boolean {
  const segs = splitPath(p);
  // Reject any traversal segment.
  for (const seg of segs) {
    if (seg === "..") return false;
  }
  const prefixSegs = splitPath(ALLOWED_PREFIX);
  if (segs.length < prefixSegs.length + 1) return false;
  for (let i = 0; i < prefixSegs.length; i++) {
    if (segs[i] !== prefixSegs[i]) return false;
  }
  return true;
}

/**
 * Pure planner. No I/O. Validates every field of the input and
 * either returns a CANDIDATE plan or a NO-GO reason.
 */
export function planAuditActualWrite(
  input: HCCAuditActualWriteInput,
): HCCAuditActualWritePlan {
  if (!isNonEmptyString(input.task_id)) {
    return noGoPlan(input, "missing task_id");
  }
  if (!isNonEmptyString(input.source_plan_ref)) {
    return noGoPlan(input, "missing source_plan_ref");
  }
  if (!isNonEmptyString(input.requested_by_user)) {
    return noGoPlan(input, "missing requested_by_user");
  }
  if (!isNonEmptyString(input.authorization_id)) {
    return noGoPlan(input, "missing authorization_id");
  }
  if (input.runner_verdict !== "CONTROLLED-REAL-RUNNER-CANDIDATE") {
    return noGoPlan(
      input,
      `runner_verdict must be CONTROLLED-REAL-RUNNER-CANDIDATE; got "${String(
        input.runner_verdict,
      )}"`,
    );
  }
  if (!isNonEmptyString(input.dry_run_artifact_hash)) {
    return noGoPlan(input, "missing dry_run_artifact_hash");
  }
  if (!isNonEmptyString(input.planned_action_id)) {
    return noGoPlan(input, "missing planned_action_id");
  }
  if (!isNonEmptyString(input.whitelist_action_id)) {
    return noGoPlan(input, "missing whitelist_action_id");
  }
  if (!isNonEmptyString(input.target_path)) {
    return noGoPlan(input, "missing target_path");
  }
  if (input.target_path.startsWith("~")) {
    return noGoPlan(input, "target_path under ~/.hermes/** is forbidden");
  }
  if (!hasAllowedExtension(input.target_path)) {
    return noGoPlan(
      input,
      "target_path must end in .md or .json",
    );
  }
  if (!isUnderAllowedPrefix(input.target_path)) {
    return noGoPlan(
      input,
      `target_path must be under ${ALLOWED_PREFIX}/**`,
    );
  }
  if (!isPayloadShapedCorrectly(input.audit_payload)) {
    return noGoPlan(
      input,
      "audit_payload violates literal-false shape (would_execute/real_execution_ready/unattended_ready/any_command_executed must be false, executed_commands must be empty, go_no_go must be NO-GO)",
    );
  }

  return candidatePlan(input);
}

function isPayloadShapedCorrectly(p: HCCAuditPayload): boolean {
  return (
    p !== null &&
    typeof p === "object" &&
    p.would_execute === false &&
    p.real_execution_ready === false &&
    p.unattended_ready === false &&
    p.any_command_executed === false &&
    Array.isArray(p.executed_commands) &&
    p.executed_commands.length === 0 &&
    p.go_no_go === "NO-GO" &&
    typeof p.body === "string"
  );
}

function candidatePlan(
  input: HCCAuditActualWriteInput,
): HCCAuditActualWritePlan {
  return {
    schema_version: "1.0.0",
    verdict: "AUDIT-ACTUAL-WRITE-CANDIDATE",
    reason:
      "input valid; plan is ready to write to repo-local docs/audit/hcc/** (write not yet performed)",
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization_id,
    planned_action_id: input.planned_action_id,
    planned_action_kind: input.planned_action_kind,
    whitelist_action_id: input.whitelist_action_id,
    target_path: input.target_path,
    resolved_path: input.target_path,
    allowed_prefix: ALLOWED_PREFIX,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    written: false,
  };
}

function noGoPlan(
  input: HCCAuditActualWriteInput,
  reason: string,
): HCCAuditActualWritePlan {
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: input.task_id ?? "",
    source_plan_ref: input.source_plan_ref ?? "",
    requested_by_user: input.requested_by_user ?? "",
    authorization_id: input.authorization_id ?? "",
    planned_action_id: input.planned_action_id ?? "",
    planned_action_kind: (input.planned_action_kind as
      | "shell_command"
      | "file_write"
      | "config_patch"
      | "") ?? "",
    whitelist_action_id: input.whitelist_action_id ?? "",
    target_path: input.target_path ?? "",
    resolved_path: "",
    allowed_prefix: ALLOWED_PREFIX,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    written: false,
  };
}

/**
 * Execute the plan. Performs I/O via `deps.writeFile` / `deps.mkdir`.
 * Returns the same plan with `verdict: "AUDIT-ACTUAL-WRITTEN"` and
 * `written: true` on success. NO-GO plans short-circuit without
 * touching I/O.
 *
 * The function NEVER spawns, NEVER calls `exec`, NEVER writes
 * outside the under-prefix path. The injected writer is the only
 * I/O surface.
 */
export async function executeAuditActualWrite(
  input: HCCAuditActualWriteInput,
  deps: HCCAuditWriteDeps,
): Promise<HCCAuditActualWriteResult> {
  const plan = planAuditActualWrite(input);
  if (plan.verdict === "NO-GO") {
    return { ...plan, verdict: "NO-GO" };
  }

  const dirSegs = splitPath(input.target_path);
  const dir = dirSegs.slice(0, -1).join("/");
  if (dir.length > 0) {
    await deps.mkdir(dir, { recursive: true });
  }

  const content = renderAuditContent(input);
  await deps.writeFile(input.target_path, content);

  return {
    ...plan,
    verdict: "AUDIT-ACTUAL-WRITTEN",
    written: true,
    reason: "audit artifact written to repo-local docs/audit/hcc/**",
  };
}

function renderAuditContent(input: HCCAuditActualWriteInput): string {
  const lines: string[] = [];
  lines.push("# HCC Audit Actual Write");
  lines.push("");
  lines.push(`schema_version: ${HCC_AUDIT_ACTUAL_WRITE_SCHEMA_VERSION}`);
  lines.push(`task_id: ${input.task_id}`);
  lines.push(`source_plan_ref: ${input.source_plan_ref}`);
  lines.push(`requested_by_user: ${input.requested_by_user}`);
  lines.push(`authorization_id: ${input.authorization_id}`);
  lines.push(`runner_verdict: ${input.runner_verdict}`);
  lines.push(`dry_run_artifact_hash: ${input.dry_run_artifact_hash}`);
  lines.push(`planned_action_id: ${input.planned_action_id}`);
  lines.push(`planned_action_kind: ${input.planned_action_kind}`);
  lines.push(`whitelist_action_id: ${input.whitelist_action_id}`);
  lines.push(`would_execute: false`);
  lines.push(`real_execution_ready: false`);
  lines.push(`unattended_ready: false`);
  lines.push(`any_command_executed: false`);
  lines.push(`executed_commands: []`);
  lines.push(`go_no_go: "NO-GO"`);
  lines.push("");
  lines.push(input.audit_payload.body);
  lines.push("");
  return lines.join("\n");
}
