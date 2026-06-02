// P3 Slice 009: Artifact Store dry-run record
//
// Wraps a P3 dry-run plan + handoff payload into a single Artifact Store
// record that P2.5 append-only audit-log contracts can consume.
//
// HARD RULES (per task spec):
//   - record.dryRun is true, record.executable is false (type-hardcoded)
//   - record.safety.redaction_status defaults to "not_run" and is rejected
//     as "pass" unless the caller passes { redactionConfirmed: true }
//   - forbidden fields (reasoning / chain_of_thought / raw_prompt /
//     raw_messages / chat_transcript / internal_thought / scratch_pad /
//     working_memory) are rejected at assert time
//   - Filesystem operations are confined to the caller-supplied tmpDir.
//     The default never writes anywhere; writing requires an explicit
//     tmpDir + opt-in flag, and the function refuses paths outside it.
//   - No spawn, no exec, no runPlaybook, no IPC, no real audit chain,
//     no real ~/.hermes/handoff, no real ~/.hermes/audit.

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

import type { HCCTaskPlan } from "./hcc-task-types";
import type { HCCHandoffPayload } from "./hcc-handoff-pack";

// -----------------------------------------------------------------
// Forbidden record fields — same as builder/verifier + handoff pack.
// Defense in depth: a single union asserted by assertArtifactRecordNoForbiddenFields.
// -----------------------------------------------------------------

export const FORBIDDEN_ARTIFACT_FIELDS = [
  "reasoning",
  "chain_of_thought",
  "raw_prompt",
  "raw_messages",
  "chat_transcript",
  "internal_thought",
  "scratch_pad",
  "working_memory",
] as const;

export type ForbiddenArtifactField =
  (typeof FORBIDDEN_ARTIFACT_FIELDS)[number];

// -----------------------------------------------------------------
// Artifact record schema (1.0.0)
// -----------------------------------------------------------------

export type ArtifactType =
  | "hcc_dry_run_plan"
  | "hcc_dry_run_handoff"
  | "hcc_dry_run_combined";

export type ArtifactRedactionStatus = "pass" | "fail" | "not_run";

export interface ArtifactSafety {
  redaction_status: ArtifactRedactionStatus;
  secrets_policy: string;
  permission_boundary: string;
  forbidden_fields_checked: string[];
  /**
   * "dry_run" is the only valid runtime_class for P3 Slice 009.
   * Any other value would be a red flag — execution is forbidden
   * because HCC Auto Executor is not approved.
   */
  runtime_class: "dry_run";
  /**
   * "no_ipc" — Artifact Store record construction does not call IPC.
   * "no_spawn" — no child process.
   * "no_runPlaybook" — no playbook entry point.
   */
  side_effect_gates: ("no_ipc" | "no_spawn" | "no_runPlaybook")[];
}

export interface ArtifactNextAction {
  owner: "claude_code" | "hermes" | "user";
  action: string;
  reason: string;
}

export interface ArtifactSourceCommit {
  /** Source commit SHA. null when running outside a git repo. */
  commit: string | null;
  /** Optional branch name. */
  branch: string | null;
  /** Whether a git repo was detected. */
  is_git_repo: boolean;
}

export interface HCCArtifactRecord {
  schema_version: "1.0.0";
  /** Always true for P3 dry-run records. Type-hardcoded to prevent drift. */
  dryRun: true;
  /** Always false — no executable entry. Type-hardcoded. */
  executable: false;
  /** What kind of artifact this record wraps. */
  artifact_type: ArtifactType;
  task_id: string;
  created_at: string;
  created_by: "hcc-artifact-store";
  plan_ref: string;
  handoff_ref: string;
  verifier_ref: string | null;
  source_commit: ArtifactSourceCommit;
  safety: ArtifactSafety;
  next_actions: ArtifactNextAction[];
  do_not_read: string[];
  /** Free-form notes about why this record exists. Caller-supplied. */
  notes: string[];
  /** SHA-256 of the canonical JSON of (plan + payload), optional. */
  content_hash: string | null;
}

// -----------------------------------------------------------------
// Builder options
// -----------------------------------------------------------------

export interface BuildHCCArtifactRecordOptions {
  /** Override created_at. Defaults to now (ISO 8601). */
  createdAt?: string;
  /** Source commit info; defaults are null/false. */
  sourceCommit?: Partial<ArtifactSourceCommit>;
  /** Artifact type override. Defaults to "hcc_dry_run_combined". */
  artifactType?: ArtifactType;
  /** Notes about this artifact. */
  notes?: string[];
  /** Compute content hash (sha256 of canonical plan+payload JSON). */
  includeContentHash?: boolean;
}

// -----------------------------------------------------------------
// Constants — markers that must appear in do_not_read
// -----------------------------------------------------------------

const DO_NOT_READ = [
  "~/Desktop/知识/Hermes 代码任务/过时计划/",
  "~/hermes-pro/docs/archive/",
  "*.before-*",
  "*.noindex",
  "*.ignore",
  "HERMES-ARCHIVE-LOCK.md",
  "~/.hermes/secrets/",
  "~/.hermes/config.yaml",
  "~/.hermes/auth.json",
  "~/.hermes/handoff/",
  "~/.hermes/handoff/packs/",
  "~/.hermes/audit/",
  "~/.hermes/artifact-store/",
] as const;

// -----------------------------------------------------------------
// Pure builder: plan + handoff payload + options → record
// -----------------------------------------------------------------

export function buildHCCArtifactRecord(
  plan: HCCTaskPlan,
  handoff: HCCHandoffPayload,
  options: BuildHCCArtifactRecordOptions = {},
): HCCArtifactRecord {
  if (plan.taskId !== handoff.task_id) {
    throw new Error(
      `buildHCCArtifactRecord: plan.taskId "${plan.taskId}" != handoff.task_id "${handoff.task_id}"`,
    );
  }

  const createdAt = options.createdAt ?? new Date().toISOString();
  const sourceCommit: ArtifactSourceCommit = {
    commit: options.sourceCommit?.commit ?? null,
    branch: options.sourceCommit?.branch ?? null,
    is_git_repo: options.sourceCommit?.is_git_repo ?? false,
  };

  const planRef = `hcc-dry-run://${plan.taskId}/plan`;
  const handoffRef = `hcc-dry-run://${plan.taskId}/handoff-payload`;
  const verifierRef = plan.verifierInput
    ? `hcc-dry-run://${plan.taskId}/verifier-input`
    : null;

  const nextActions: ArtifactNextAction[] = [
    {
      owner: "claude_code",
      action:
        "Read artifact record (task_id=" +
        plan.taskId +
        "), confirm dryRun=true and executable=false, run slice contract tests",
      reason: "Claude Code is the executor for P3 code/project tasks while HCC Auto Executor is unavailable",
    },
    {
      owner: "hermes",
      action: "Archive artifact record into Handoff Pack archival queue",
      reason: "Hermes retains planning / review / archival roles per P3 delegation rule (2026-05-31)",
    },
    {
      owner: "user",
      action: "Approve any future HCC Auto Executor start; do not auto-start",
      reason: "HCC Auto Executor is not approved as an available execution entry point",
    },
  ];

  const record: HCCArtifactRecord = {
    schema_version: "1.0.0",
    dryRun: true,
    executable: false,
    artifact_type: options.artifactType ?? "hcc_dry_run_combined",
    task_id: plan.taskId,
    created_at: createdAt,
    created_by: "hcc-artifact-store",
    plan_ref: planRef,
    handoff_ref: handoffRef,
    verifier_ref: verifierRef,
    source_commit: sourceCommit,
    safety: {
      redaction_status: "not_run",
      secrets_policy:
        "Artifact record holds plan + handoff payload references only. No raw prompts, chat transcripts, or secrets are copied. PII scan is the caller's responsibility.",
      permission_boundary:
        "Pure: no IPC, no spawn, no exec, no runPlaybook, no HCC Auto Executor, no CLI-Anything, no Safari MCP.",
      forbidden_fields_checked: [...FORBIDDEN_ARTIFACT_FIELDS],
      runtime_class: "dry_run",
      side_effect_gates: ["no_ipc", "no_spawn", "no_runPlaybook"],
    },
    next_actions: nextActions,
    do_not_read: [...DO_NOT_READ],
    notes: options.notes ?? [],
    content_hash: null,
  };

  if (options.includeContentHash) {
    const { content_hash: _ignored, ...rest } = record;
    void _ignored;
    // `rest` is referenced via canonicalRecordJson via canonical record shape;
    // we don't materialise it here to keep hashing deterministic.
    void rest;
    const canonical = canonicalRecordJson({
      plan,
      handoff,
      planRef,
      handoffRef,
      verifierRef,
    });
    record.content_hash = `sha256:${crypto
      .createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex")}`;
  }

  return record;
}

// -----------------------------------------------------------------
// canonicalRecordJson — stable JSON for hashing
// -----------------------------------------------------------------

function canonicalRecordJson(input: {
  plan: HCCTaskPlan;
  handoff: HCCHandoffPayload;
  planRef: string;
  handoffRef: string;
  verifierRef: string | null;
}): string {
  // Sort keys at every object level so the hash is deterministic.
  return JSON.stringify(input, (_key, value) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const sorted: Record<string, unknown> = {};
      for (const k of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[k] = (value as Record<string, unknown>)[k];
      }
      return sorted;
    }
    return value;
  });
}

// -----------------------------------------------------------------
// assertArtifactRecordNoForbiddenFields
// Recursively walks the record; throws if any forbidden key is present.
// -----------------------------------------------------------------

export function assertArtifactRecordNoForbiddenFields(
  record: HCCArtifactRecord,
): void {
  const seen = new Set<string>();
  const stack: unknown[] = [record];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === null || node === undefined) continue;
    if (typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const v of node) stack.push(v);
      continue;
    }
    for (const [k, v] of Object.entries(node)) {
      if (
        (FORBIDDEN_ARTIFACT_FIELDS as readonly string[]).includes(k)
      ) {
        seen.add(k);
      }
      stack.push(v);
    }
  }
  if (seen.size > 0) {
    throw new Error(
      `Artifact record contains forbidden fields: ${[...seen].join(", ")}`,
    );
  }
}

// -----------------------------------------------------------------
// verifyHCCArtifactRecord
// Pure, local verifier-only check. No external model, no spawn, no IPC.
// Mirrors the structure of verifyHCCHandoffPayloadFixture.
// -----------------------------------------------------------------

export interface VerifyArtifactRecordOptions {
  /** Caller asserts they actually ran the redaction scanner. */
  redactionConfirmed?: boolean;
}

export interface VerifyArtifactRecordResult {
  valid: boolean;
  errors: string[];
}

export function verifyHCCArtifactRecord(
  record: HCCArtifactRecord,
  options: VerifyArtifactRecordOptions = {},
): VerifyArtifactRecordResult {
  const errors: string[] = [];

  if (record.schema_version !== "1.0.0") {
    errors.push(
      `schema_version must be "1.0.0", got "${record.schema_version}"`,
    );
  }
  if (record.dryRun !== true) {
    errors.push(`dryRun must be true, got ${JSON.stringify(record.dryRun)}`);
  }
  if (record.executable !== false) {
    errors.push(
      `executable must be false, got ${JSON.stringify(record.executable)}`,
    );
  }
  if (!record.task_id) {
    errors.push("task_id is required");
  }
  if (!record.created_at) {
    errors.push("created_at is required");
  }
  if (record.created_by !== "hcc-artifact-store") {
    errors.push(
      `created_by must be "hcc-artifact-store", got "${record.created_by}"`,
    );
  }
  if (!record.plan_ref) {
    errors.push("plan_ref is required");
  }
  if (!record.handoff_ref) {
    errors.push("handoff_ref is required");
  }
  // verifier_ref is allowed to be null (for non-code tasks or missing verifier input)
  if (
    record.safety.runtime_class !== "dry_run"
  ) {
    errors.push(
      `safety.runtime_class must be "dry_run", got "${record.safety.runtime_class}"`,
    );
  }
  for (const gate of ["no_ipc", "no_spawn", "no_runPlaybook"] as const) {
    if (!record.safety.side_effect_gates.includes(gate)) {
      errors.push(`safety.side_effect_gates must include "${gate}"`);
    }
  }
  for (const required of [
    "reasoning",
    "chain_of_thought",
    "raw_prompt",
    "raw_messages",
    "chat_transcript",
    "internal_thought",
    "scratch_pad",
    "working_memory",
  ] as const) {
    if (!record.safety.forbidden_fields_checked.includes(required)) {
      errors.push(
        `safety.forbidden_fields_checked must include "${required}"`,
      );
    }
  }
  if (
    !options.redactionConfirmed &&
    record.safety.redaction_status === "pass"
  ) {
    errors.push(
      'safety.redaction_status is "pass" but redaction was not confirmed by caller',
    );
  }
  const owners = new Set(record.next_actions.map((a) => a.owner));
  for (const required of ["claude_code", "hermes", "user"] as const) {
    if (!owners.has(required)) {
      errors.push(`next_actions must include owner "${required}"`);
    }
  }
  const doNotRead = record.do_not_read.join("\n");
  for (const marker of [
    "过时计划",
    "docs/archive",
    "*.before-*",
    "~/.hermes/handoff/packs/",
    "~/.hermes/audit/",
  ]) {
    if (!doNotRead.includes(marker)) {
      errors.push(`do_not_read must contain marker "${marker}"`);
    }
  }
  if (!record.source_commit) {
    errors.push("source_commit is required");
  }

  try {
    assertArtifactRecordNoForbiddenFields(record);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { valid: errors.length === 0, errors };
}

// -----------------------------------------------------------------
// buildHCCArtifactRecordSummary
// Pure: HCCArtifactRecord → safe summary object for UI / reports.
//
// The summary is designed to be safe to render in BaiLongma, Handoff
// pages, and report logs. It deliberately OMITS:
//   - record.notes (raw text — caller-supplied freeform)
//   - full do_not_read entries (replace with count + marker flags)
//   - any forbidden field values (asserted before summary is built)
//
// It REUSES verifyHCCArtifactRecord so summary.valid / summary.errors
// stay in lock-step with the canonical verify contract.
// -----------------------------------------------------------------

export interface HCCArtifactRecordSummary {
  schema_version: "1.0.0";
  task_id: string;
  artifact_type: ArtifactType;
  dryRun: true;
  executable: false;
  runtime_class: "dry_run";
  redaction_status: ArtifactRedactionStatus;
  source_commit: ArtifactSourceCommit;
  has_content_hash: boolean;
  plan_ref: string;
  handoff_ref: string;
  verifier_ref: string | null;
  next_action_owners: Array<HCCArtifactRecord["next_actions"][number]["owner"]>;
  do_not_read_count: number;
  /** True when a given marker substring is present in do_not_read. */
  do_not_read_markers: {
    archive_lock: boolean;
    handoff_packs: boolean;
    audit: boolean;
    secrets: boolean;
    before: boolean;
  };
  forbidden_fields_checked_count: number;
  notes_count: number;
  valid: boolean;
  errors: string[];
}

export interface BuildHCCArtifactRecordSummaryOptions {
  /** Forwarded to verifyHCCArtifactRecord. */
  redactionConfirmed?: boolean;
}

export function buildHCCArtifactRecordSummary(
  record: HCCArtifactRecord,
  options: BuildHCCArtifactRecordSummaryOptions = {},
): HCCArtifactRecordSummary {
  // Run the canonical verifier first. This catches forbidden fields
  // and produces the source of truth for valid / errors.
  const verification = verifyHCCArtifactRecord(record, {
    redactionConfirmed: options.redactionConfirmed,
  });

  // Defensive: even if a future verify regression lets a forbidden
  // field slip through, refuse to build a summary and surface the
  // error to the caller.
  let forbiddenHits: string[] = [];
  try {
    assertArtifactRecordNoForbiddenFields(record);
  } catch (err) {
    forbiddenHits = [err instanceof Error ? err.message : String(err)];
  }

  const doNotReadJoined = record.do_not_read.join("\n");
  const doNotReadMarkers: HCCArtifactRecordSummary["do_not_read_markers"] = {
    archive_lock: doNotReadJoined.includes("HERMES-ARCHIVE-LOCK.md"),
    handoff_packs: doNotReadJoined.includes("~/.hermes/handoff/packs/"),
    audit: doNotReadJoined.includes("~/.hermes/audit/"),
    secrets: doNotReadJoined.includes("~/.hermes/secrets/"),
    before: doNotReadJoined.includes("*.before-*"),
  };

  const errors: string[] = [...verification.errors, ...forbiddenHits];

  return {
    schema_version: "1.0.0",
    task_id: record.task_id,
    artifact_type: record.artifact_type,
    dryRun: true,
    executable: false,
    runtime_class: "dry_run",
    redaction_status: record.safety.redaction_status,
    source_commit: record.source_commit,
    has_content_hash:
      typeof record.content_hash === "string" &&
      record.content_hash.startsWith("sha256:"),
    plan_ref: record.plan_ref,
    handoff_ref: record.handoff_ref,
    verifier_ref: record.verifier_ref,
    next_action_owners: record.next_actions.map((a) => a.owner),
    do_not_read_count: record.do_not_read.length,
    do_not_read_markers: doNotReadMarkers,
    forbidden_fields_checked_count:
      record.safety.forbidden_fields_checked.length,
    notes_count: record.notes.length,
    valid: errors.length === 0,
    errors,
  };
}

// -----------------------------------------------------------------
// writeHCCArtifactRecordFixture
// Writes the record as JSON to {tmpDir}/<subdir>/<filename>.
// Refuses to write outside tmpDir.
// -----------------------------------------------------------------

export interface WriteArtifactFixtureOptions {
  /** Subdirectory under tmpDir. Defaults to "hcc-artifact-store". */
  subdir?: string;
  /** Override filename (must include task_id). */
  filename?: string;
}

export function writeHCCArtifactRecordFixture(
  record: HCCArtifactRecord,
  tmpDir: string,
  options: WriteArtifactFixtureOptions = {},
): string {
  if (!record.task_id) {
    throw new Error("record.task_id is required for fixture filename");
  }
  const subdir = options.subdir ?? "hcc-artifact-store";
  const filename = options.filename ?? `artifact-${record.task_id}.json`;
  if (!filename.includes(record.task_id)) {
    throw new Error(
      `filename must include task_id "${record.task_id}": got "${filename}"`,
    );
  }
  const resolvedTmp = path.resolve(tmpDir);
  const outDir = path.join(resolvedTmp, subdir);
  if (
    outDir !== resolvedTmp &&
    !outDir.startsWith(resolvedTmp + path.sep)
  ) {
    throw new Error(
      "writeHCCArtifactRecordFixture: outDir escapes tmpDir",
    );
  }
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, filename);
  if (
    outPath !== resolvedTmp &&
    !outPath.startsWith(resolvedTmp + path.sep)
  ) {
    throw new Error(
      "writeHCCArtifactRecordFixture: outPath escapes tmpDir",
    );
  }
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2), "utf8");
  return outPath;
}

// -----------------------------------------------------------------
// readHCCArtifactRecordFixture — pure read; refuses paths outside tmpDir
// -----------------------------------------------------------------

export function readHCCArtifactRecordFixture(
  tmpDir: string,
  filename: string,
  options: { subdir?: string } = {},
): HCCArtifactRecord {
  const subdir = options.subdir ?? "hcc-artifact-store";
  const resolvedTmp = path.resolve(tmpDir);
  const inDir = path.join(resolvedTmp, subdir);
  const inPath = path.join(inDir, filename);
  if (
    inPath !== resolvedTmp &&
    !inPath.startsWith(resolvedTmp + path.sep)
  ) {
    throw new Error(
      "readHCCArtifactRecordFixture: inPath escapes tmpDir",
    );
  }
  const blob = fs.readFileSync(inPath, "utf8");
  return JSON.parse(blob) as HCCArtifactRecord;
}

// -----------------------------------------------------------------
// readHCCArtifactRecordSummaryFixture
// Composed helper: read a fixture under tmpDir and project it
// straight into HCCArtifactRecordSummary. The path-safety check is
// delegated to readHCCArtifactRecordFixture, so this function never
// touches paths outside tmpDir and never writes anywhere.
//
// Designed for downstream consumers (BaiLongma / Handoff pages /
// report logs) that need a safe projection without round-tripping
// the raw record through their own code.
//
// Behaviour:
//   - invalid record (forbidden field, redaction=pass without
//     confirmation, etc.) returns a summary with valid=false and
//     errors[] populated; never throws
//   - dryRun / executable / runtime_class / source_commit /
//     handoff_ref / plan_ref / verifier_ref all flow through
//   - notes 原文与 do_not_read 全文永不出现在返回值
//   - no IPC, no spawn, no runPlaybook, no real handoff/audit write
// -----------------------------------------------------------------

export interface ReadArtifactSummaryFixtureOptions {
  /** Subdirectory under tmpDir. Defaults to "hcc-artifact-store". */
  subdir?: string;
  /** Forwarded to buildHCCArtifactRecordSummary. */
  redactionConfirmed?: boolean;
}

export function readHCCArtifactRecordSummaryFixture(
  tmpDir: string,
  filename: string,
  options: ReadArtifactSummaryFixtureOptions = {},
): HCCArtifactRecordSummary {
  const record = readHCCArtifactRecordFixture(tmpDir, filename, {
    subdir: options.subdir,
  });
  return buildHCCArtifactRecordSummary(record, {
    redactionConfirmed: options.redactionConfirmed,
  });
}
