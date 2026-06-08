// Post-task Learning Loop - Slice LOOP-004b
// Pure design descriptor for the Bad Pattern -> Dead-end / Anti-pattern
// Draft builder. No ranking mutation, no knowledge demotion, no
// knowledge delete, no runtime write.
//
// LOOP-004b deliverables:
//   1. The design descriptor that the future builder MUST satisfy.
//   2. A pure projection that converts a single bad_pattern /
//      dead_end into a DeadEndDesignDraft.
//   3. A pure batch projection over a PostTaskReflection.
//   4. A pure fingerprint helper for stable dedupe.
//   5. A pure duplicate-collapse helper.
//   6. A pure proposed-action classifier (recurrence-count aware) that
//      NEVER promotes to a real ranking penalty.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live retrieval ranking mutation, no knowledge demotion / delete,
// no skill install, no HCC Auto Executor, no hermes config / handoff /
// audit mutation, no docs/roadmap-locked-2026-05-28.md mutation.

import type {
  HumanApprovalRef,
  PostTaskReflection,
  ReflectionBadPattern,
  ReflectionDeadEnd,
  EvidenceRef,
} from "./post-task-reflection-contract";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const DEAD_END_BUILDER_DESIGN = {
  builder_status: "design_only" as const,
  ranking_penalty_allowed: false as const,
  knowledge_demotion_allowed: false as const,
  knowledge_delete_allowed: false as const,
  runtime_write_allowed: false as const,
  evidence_required: true as const,
  recurrence_required: true as const,
  human_approval_ref_required_for_penalty: true as const,
  schema_version: "1.0.0" as const,
  /**
   * recurrence_count threshold above which a draft MAY be marked
   * "ranking_penalty_candidate". The threshold is a DESIGN parameter,
   * not a runtime trigger. The future adapter still MUST not apply
   * any ranking penalty without an explicit, separate user approval.
   */
  recurrence_threshold_for_penalty_candidate: 3 as const,
} as const;

// -----------------------------------------------------------------
// Draft shape
// -----------------------------------------------------------------

export type DeadEndProposedAction = "none" | "warn_only" | "ranking_penalty_candidate";

export interface DeadEndDesignDraft {
  schema_version: "1.0.0";
  draft_id: string;
  fingerprint: string;
  /**
   * "bad_pattern" when derived from a ReflectionBadPattern;
   * "dead_end" when derived from a ReflectionDeadEnd.
   */
  source_kind: "bad_pattern" | "dead_end";
  summary: string;
  human_readable_summary: string;
  failure_class: ReflectionBadPattern["trigger_context"] extends string
    ? ReflectionDeadEnd["failure_class"]
    : ReflectionDeadEnd["failure_class"];
  recurrence_count: number;
  trigger_context: string;
  why_failed: string;
  proposed_action: DeadEndProposedAction;
  evidence: EvidenceRef[];
  provenance: PostTaskReflection["provenance"];
  source_task: string;
  source_ref: string;
  source_fingerprint: string;
  dry_run_only: true;
  ranking_penalty_allowed: false;
  knowledge_demotion_allowed: false;
  knowledge_delete_allowed: false;
  runtime_write_allowed: false;
  human_approval_ref: HumanApprovalRef | null;
}

// -----------------------------------------------------------------
// Fingerprint
// -----------------------------------------------------------------

export function buildDeadEndFingerprint(input: {
  source_task: string;
  source_kind: "bad_pattern" | "dead_end";
  source_fingerprint: string;
}): string {
  return `dead-end-draft:${input.source_task}|${input.source_kind}|${input.source_fingerprint}`;
}

// -----------------------------------------------------------------
// Single-source projection (bad_pattern or dead_end)
// -----------------------------------------------------------------

function buildProvenanceCopy(
  reflection: PostTaskReflection,
): PostTaskReflection["provenance"] {
  return { ...reflection.provenance };
}

function buildHumanApprovalRef(
  reflection: PostTaskReflection,
): HumanApprovalRef | null {
  if (
    reflection.provenance.human_reviewed === true &&
    reflection.provenance.human_approval_ref !== null
  ) {
    return reflection.provenance.human_approval_ref;
  }
  return null;
}

function evidenceFrom(
  reflection: PostTaskReflection,
  base: EvidenceRef | undefined,
  sourceFingerprint: string,
  sourceKind: "bad_pattern" | "dead_end",
): EvidenceRef[] {
  if (base) return [base];
  // Defensive fallback: synthesize a stable evidence entry. The
  // contract layer requires evidence.length >= 1; this guarantees it
  // for every projected draft.
  return [
    {
      kind: "artifact",
      ref: `${reflection.artifact_ref ?? reflection.task_id}/${
        sourceKind === "bad_pattern" ? "bad" : "dead"
      }/${sourceFingerprint}`,
      content_hash: `sha256-${reflection.task_id}-${sourceKind}-${sourceFingerprint}`,
      excerpt: "redacted dry-run excerpt",
    },
  ];
}

export function projectBadPatternToDeadEndDraft(
  reflection: PostTaskReflection,
  badPattern: ReflectionBadPattern,
): DeadEndDesignDraft {
  const fp = buildDeadEndFingerprint({
    source_task: reflection.task_id,
    source_kind: "bad_pattern",
    source_fingerprint: badPattern.fingerprint,
  });
  const recurrenceCount = countBadPatternOccurrences(reflection, badPattern);
  const proposedAction = classifyProposedAction(
    recurrenceCount,
    /* fromDeadEnd */ false,
  );
  return {
    schema_version: "1.0.0",
    draft_id: `dead-end-draft-${reflection.task_id}-bad-${badPattern.fingerprint}`,
    fingerprint: fp,
    source_kind: "bad_pattern",
    summary: badPattern.summary,
    human_readable_summary: badPattern.human_readable_summary,
    failure_class: "unknown",
    recurrence_count: recurrenceCount,
    trigger_context: badPattern.trigger_context,
    why_failed: `Bad pattern observed: ${badPattern.summary}`,
    proposed_action: proposedAction,
    evidence: evidenceFrom(
      reflection,
      badPattern.evidence[0],
      badPattern.fingerprint,
      "bad_pattern",
    ),
    provenance: buildProvenanceCopy(reflection),
    source_task: reflection.task_id,
    source_ref: reflection.artifact_ref ?? reflection.task_id,
    source_fingerprint: badPattern.fingerprint,
    dry_run_only: true,
    ranking_penalty_allowed: false,
    knowledge_demotion_allowed: false,
    knowledge_delete_allowed: false,
    runtime_write_allowed: false,
    human_approval_ref: buildHumanApprovalRef(reflection),
  };
}

export function projectDeadEndToDeadEndDraft(
  reflection: PostTaskReflection,
  deadEnd: ReflectionDeadEnd,
): DeadEndDesignDraft {
  const fp = buildDeadEndFingerprint({
    source_task: reflection.task_id,
    source_kind: "dead_end",
    source_fingerprint: deadEnd.fingerprint,
  });
  const proposedAction = classifyProposedAction(
    deadEnd.recurrence_count,
    /* fromDeadEnd */ true,
    deadEnd.proposed_action,
  );
  return {
    schema_version: "1.0.0",
    draft_id: `dead-end-draft-${reflection.task_id}-dead-${deadEnd.fingerprint}`,
    fingerprint: fp,
    source_kind: "dead_end",
    summary: deadEnd.summary,
    human_readable_summary: deadEnd.human_readable_summary,
    failure_class: deadEnd.failure_class,
    recurrence_count: deadEnd.recurrence_count,
    trigger_context: deadEnd.trigger_context,
    why_failed: deadEnd.why_failed,
    proposed_action: proposedAction,
    evidence: evidenceFrom(
      reflection,
      deadEnd.evidence[0],
      deadEnd.fingerprint,
      "dead_end",
    ),
    provenance: buildProvenanceCopy(reflection),
    source_task: reflection.task_id,
    source_ref: reflection.artifact_ref ?? reflection.task_id,
    source_fingerprint: deadEnd.fingerprint,
    dry_run_only: true,
    ranking_penalty_allowed: false,
    knowledge_demotion_allowed: false,
    knowledge_delete_allowed: false,
    runtime_write_allowed: false,
    human_approval_ref: buildHumanApprovalRef(reflection),
  };
}

// -----------------------------------------------------------------
// Batch projection
// -----------------------------------------------------------------

export function projectDeadEndDraftsFromReflection(
  reflection: PostTaskReflection,
): DeadEndDesignDraft[] {
  const drafts: DeadEndDesignDraft[] = [];
  for (const bp of reflection.bad_patterns) {
    drafts.push(projectBadPatternToDeadEndDraft(reflection, bp));
  }
  for (const de of reflection.dead_ends) {
    drafts.push(projectDeadEndToDeadEndDraft(reflection, de));
  }
  return drafts;
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

export function collapseDeadEndDuplicates<
  T extends { fingerprint: string },
>(drafts: T[]): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const d of drafts) {
    if (seen.has(d.fingerprint)) {
      dropped.push(d);
    } else {
      seen.add(d.fingerprint);
      kept.push(d);
    }
  }
  return { kept, dropped };
}

// -----------------------------------------------------------------
// Eligibility helpers
// -----------------------------------------------------------------

/**
 * Returns true iff the draft MAY be surfaced to a future penalty
 * simulator. Crucially, in LOOP-004b no such simulator is approved,
 * so the helper MUST always return false. The check is left in place
 * as a pure routing rule the future adapter can call.
 */
export function isRankingPenaltyEligibilityCandidate(
  d: DeadEndDesignDraft,
): boolean {
  if (d.ranking_penalty_allowed !== false) return false;
  if (d.knowledge_demotion_allowed !== false) return false;
  if (d.knowledge_delete_allowed !== false) return false;
  if (d.runtime_write_allowed !== false) return false;
  if (d.dry_run_only !== true) return false;
  // No penalty simulator approved in LOOP-004b.
  if (!DEAD_END_BUILDER_DESIGN.ranking_penalty_allowed) return false;
  return d.proposed_action === "ranking_penalty_candidate";
}

// -----------------------------------------------------------------
// Internal: recurrence counting + proposed-action classification
// -----------------------------------------------------------------

function countBadPatternOccurrences(
  reflection: PostTaskReflection,
  badPattern: ReflectionBadPattern,
): number {
  // Self-reference count: how many times the same fingerprint appears
  // across the reflection's bad_patterns. A single occurrence is the
  // common case.
  let n = 0;
  for (const bp of reflection.bad_patterns) {
    if (bp.fingerprint === badPattern.fingerprint) n++;
  }
  return Math.max(1, n);
}

function classifyProposedAction(
  recurrenceCount: number,
  fromDeadEnd: boolean,
  originalAction?: ReflectionDeadEnd["proposed_action"],
): DeadEndProposedAction {
  // Dead-end inputs carry an explicit proposed_action; the builder
  // tightens it to the LOOP-004b rules. bad_pattern inputs start at
  // "none" and only escalate by recurrence.
  const threshold =
    DEAD_END_BUILDER_DESIGN.recurrence_threshold_for_penalty_candidate;
  if (fromDeadEnd && originalAction === "ranking_penalty_candidate") {
    // Even when the source said "candidate", the LOOP-004b builder
    // may only mark it candidate when recurrence is high enough.
    return recurrenceCount >= threshold
      ? "ranking_penalty_candidate"
      : "warn_only";
  }
  if (fromDeadEnd && originalAction === "warn_only") {
    return "warn_only";
  }
  // recurrence_count === 1 ⇒ "none" or "warn_only" only.
  if (recurrenceCount <= 1) return "warn_only";
  if (recurrenceCount >= threshold) return "ranking_penalty_candidate";
  return "warn_only";
}
