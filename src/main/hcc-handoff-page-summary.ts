// P3 Code Task 005 — Handoff Page Summary Draft
//
// Pure display-model projection: HCCArtifactRecordSummary
// (from src/main/hcc-artifact-store.ts) → HCCHandoffPageSummary.
//
// This module is deliberately a thin, pure adapter. It does NOT:
//   - read or write files
//   - call any IPC, spawn, exec, runPlaybook
//   - touch real ~/.hermes/handoff/packs or ~/.hermes/audit
//   - touch UI code
//
// It exists so a future Handoff page / report page can render an
// artifact without re-deriving the display logic, and without ever
// holding a raw HCCArtifactRecord (and therefore raw notes /
// do_not_read text) in renderer memory.

import type {
  HCCArtifactRecordSummary,
  ArtifactType,
  ArtifactRedactionStatus,
} from "./hcc-artifact-store";

// -----------------------------------------------------------------
// Page-summary schema (1.0.0)
// -----------------------------------------------------------------

export type HCCHandoffPageStatus = "ready" | "blocked" | "invalid";

export interface HCCHandoffPageSummary {
  schema_version: "1.0.0";
  task_id: string;
  status: HCCHandoffPageStatus;
  /** Always true. Type-hardcoded. */
  dryRun: true;
  /** Always false. Type-hardcoded. */
  executable: false;
  /** Always "dry_run". Type-hardcoded. */
  runtime_class: "dry_run";
  artifact_type: ArtifactType;
  redaction_status: ArtifactRedactionStatus;
  has_content_hash: boolean;
  source_commit: {
    commit: string | null;
    branch: string | null;
    is_git_repo: boolean;
  };
  refs: {
    plan_ref: string;
    handoff_ref: string;
    verifier_ref: string | null;
  };
  safety_flags: {
    no_ipc: boolean;
    no_spawn: boolean;
    no_runPlaybook: boolean;
    has_archive_guard: boolean;
    has_handoff_packs_guard: boolean;
    has_audit_guard: boolean;
  };
  next_action_owners: Array<"claude_code" | "hermes" | "user">;
  counts: {
    notes: number;
    do_not_read: number;
    forbidden_fields_checked: number;
  };
  /** Localized error reasons; never contains raw record content. */
  errors: string[];
}

// -----------------------------------------------------------------
// buildHCCHandoffPageSummary — pure
// -----------------------------------------------------------------

const REQUIRED_OWNERS: ReadonlyArray<"claude_code" | "hermes" | "user"> = [
  "claude_code",
  "hermes",
  "user",
];

export function buildHCCHandoffPageSummary(
  summary: HCCArtifactRecordSummary,
): HCCHandoffPageSummary {
  // Decide status first, so we can stitch the human-readable reason
  // into the errors array without double-walking.
  const errors: string[] = [...summary.errors];

  // 1) missing-owner detection (caller-side contract: each next_action
  //    must include claude_code / hermes / user).
  const owners = new Set(summary.next_action_owners);
  const missingOwners = REQUIRED_OWNERS.filter((o) => !owners.has(o));
  if (missingOwners.length > 0) {
    errors.push(
      `next_action_owners missing required: ${missingOwners.join(", ")}`,
    );
  }

  let status: HCCHandoffPageStatus;
  if (!summary.valid) {
    status = "invalid";
  } else if (missingOwners.length > 0) {
    // valid record but contractual next-action coverage is incomplete:
    // downstream page must surface this as a "blocked" state.
    status = "blocked";
  } else {
    status = "ready";
  }

  return {
    schema_version: "1.0.0",
    task_id: summary.task_id,
    status,
    dryRun: true,
    executable: false,
    runtime_class: "dry_run",
    artifact_type: summary.artifact_type,
    redaction_status: summary.redaction_status,
    has_content_hash: summary.has_content_hash,
    source_commit: summary.source_commit,
    refs: {
      plan_ref: summary.plan_ref,
      handoff_ref: summary.handoff_ref,
      verifier_ref: summary.verifier_ref,
    },
    safety_flags: {
      // The page summary is itself dry-run by contract, so all three
      // "no_*" gates are always true here. We surface them as
      // explicit boolean flags so the page can render check-marks
      // without having to reason about the contract.
      no_ipc: true,
      no_spawn: true,
      no_runPlaybook: true,
      // The underlying do_not_read_markers from the artifact summary
      // are forwarded unchanged. A future page can render these as
      // ✅ / ⚠️ based on whether each guard is present.
      has_archive_guard: summary.do_not_read_markers.archive_lock,
      has_handoff_packs_guard: summary.do_not_read_markers.handoff_packs,
      has_audit_guard: summary.do_not_read_markers.audit,
    },
    next_action_owners: summary.next_action_owners,
    counts: {
      notes: summary.notes_count,
      do_not_read: summary.do_not_read_count,
      forbidden_fields_checked: summary.forbidden_fields_checked_count,
    },
    errors,
  };
}

// -----------------------------------------------------------------
// aggregateHCCHandoffPageSummaries — pure aggregator
// Reduces N HCCHandoffPageSummary into a single dashboard / report
// rollup. Does NOT touch the raw records, the file system, or any
// execution primitive.
//
// Aggregate invariants:
//   - dry_run_only is true (the aggregator is itself a dry-run tool)
//   - executable_count is always 0 (no execution from this surface)
//   - task_ids preserves input order
//   - safety all_* flags reduce with AND (every input must satisfy)
//   - if any input violates the dry-run literal types, the violation
//     is captured as an error string (no throw)
// -----------------------------------------------------------------

export interface HCCHandoffPageSummaryAggregate {
  schema_version: "1.0.0";
  total: number;
  ready: number;
  blocked: number;
  invalid: number;
  /** Always true. Type-hardcoded. */
  dry_run_only: true;
  /** Always 0. Type-hardcoded literal — no execution from this surface. */
  executable_count: 0;
  /** Preserves input order. */
  task_ids: string[];
  next_action_owner_counts: {
    claude_code: number;
    hermes: number;
    user: number;
  };
  safety: {
    all_no_ipc: boolean;
    all_no_spawn: boolean;
    all_no_runPlaybook: boolean;
    all_have_archive_guard: boolean;
    all_have_handoff_packs_guard: boolean;
    all_have_audit_guard: boolean;
  };
  /** Aggregator-level errors (literal-type violations etc.). */
  errors: string[];
}

export function aggregateHCCHandoffPageSummaries(
  summaries: HCCHandoffPageSummary[],
): HCCHandoffPageSummaryAggregate {
  const errors: string[] = [];

  let ready = 0;
  let blocked = 0;
  let invalid = 0;
  const taskIds: string[] = [];
  const ownerCounts = { claude_code: 0, hermes: 0, user: 0 };

  let allNoIpc = true;
  let allNoSpawn = true;
  let allNoRunPlaybook = true;
  let allHaveArchive = true;
  let allHaveHandoffPacks = true;
  let allHaveAudit = true;

  for (let i = 0; i < summaries.length; i++) {
    const s = summaries[i];

    // Literal-type contract checks. These should never fire under
    // normal use, but a defensive layer catches regressions in a
    // future caller that hand-builds a page summary.
    if (s.dryRun !== true) {
      errors.push(`summary[${i}].dryRun must be true, got ${JSON.stringify(s.dryRun)}`);
    }
    if (s.executable !== false) {
      errors.push(
        `summary[${i}].executable must be false, got ${JSON.stringify(s.executable)}`,
      );
    }
    if (s.runtime_class !== "dry_run") {
      errors.push(
        `summary[${i}].runtime_class must be "dry_run", got ${JSON.stringify(s.runtime_class)}`,
      );
    }

    // Status counts.
    if (s.status === "ready") ready += 1;
    else if (s.status === "blocked") blocked += 1;
    else if (s.status === "invalid") invalid += 1;

    // Task ids (preserve input order).
    taskIds.push(s.task_id);

    // Next-action owner counts (an owner present in N summaries
    // contributes N to its count; a single summary listing all three
    // owners contributes 1 to each).
    for (const owner of s.next_action_owners) {
      if (
        owner === "claude_code" ||
        owner === "hermes" ||
        owner === "user"
      ) {
        ownerCounts[owner] += 1;
      }
    }

    // Safety reduction: AND across all summaries. A single false flips
    // the aggregate flag to false.
    allNoIpc = allNoIpc && s.safety_flags.no_ipc;
    allNoSpawn = allNoSpawn && s.safety_flags.no_spawn;
    allNoRunPlaybook = allNoRunPlaybook && s.safety_flags.no_runPlaybook;
    allHaveArchive = allHaveArchive && s.safety_flags.has_archive_guard;
    allHaveHandoffPacks =
      allHaveHandoffPacks && s.safety_flags.has_handoff_packs_guard;
    allHaveAudit = allHaveAudit && s.safety_flags.has_audit_guard;
  }

  // Empty input collapses ANDs to true (vacuously). That is the
  // canonical "no violations observed" reading of a zero-length
  // collection, and it matches the existing safety convention in
  // slice 005.
  if (summaries.length === 0) {
    allNoIpc = true;
    allNoSpawn = true;
    allNoRunPlaybook = true;
    allHaveArchive = true;
    allHaveHandoffPacks = true;
    allHaveAudit = true;
  }

  return {
    schema_version: "1.0.0",
    total: summaries.length,
    ready,
    blocked,
    invalid,
    dry_run_only: true,
    executable_count: 0,
    task_ids: taskIds,
    next_action_owner_counts: ownerCounts,
    safety: {
      all_no_ipc: allNoIpc,
      all_no_spawn: allNoSpawn,
      all_no_runPlaybook: allNoRunPlaybook,
      all_have_archive_guard: allHaveArchive,
      all_have_handoff_packs_guard: allHaveHandoffPacks,
      all_have_audit_guard: allHaveAudit,
    },
    errors,
  };
}
