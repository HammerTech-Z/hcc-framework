// Post-task Learning Loop - Slice LOOP-003
// Pure design descriptor for the future Usage Feedback Persistent
// Adapter. No implementation, no runtime write, no live retrieval
// ranking mutation.
//
// LOOP-003 deliverables:
//   1. The design descriptor that the future adapter MUST satisfy.
//   2. A pure event-shape projection that the future adapter will
//      accept (idempotency / evidence / source_ref / dry_run_only).
//   3. A pure fingerprint helper for stable idempotency keys.
//   4. Pure eligibility classifier (PRE-REVIEW / CONTEXT / RANKING)
//      that downstream consumer guards can route on without writing.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no skill install, no HCC Auto Executor, no hermes config / handoff / audit mutation.

import type {
  HumanApprovalRef,
  PostTaskReflection,
  UsageFeedbackSignal,
} from "./post-task-reflection-contract";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const USAGE_FEEDBACK_ADAPTER_DESIGN = {
  adapter_status: "design_only" as const,
  persistence_allowed: false as const,
  ranking_mutation_allowed: false as const,
  append_only_required: true as const,
  idempotency_required: true as const,
  source_ref_required: true as const,
  evidence_required: true as const,
  human_approval_ref_required_for_context_or_ranking: true as const,
  consumer_guard_required: true as const,
  schema_version: "1.0.0" as const,
  // Hard boundary: any future live implementation MUST also forbid
  // hermes config / handoff / audit writes, skill install, HCC Auto
  // Executor change, live knowledge flush, knowledgeIngest /
  // knowledgeSearch (enforced at the policy / ADR layer, not in code).
} as const;

// -----------------------------------------------------------------
// Event shape (design only — never persisted by this slice)
// -----------------------------------------------------------------

export type UsageFeedbackEventKind =
  | "retrieved"
  | "used"
  | "helped"
  | "misled"
  | "unused";

export type UsageFeedbackEligibility =
  | "pre_review" // produced from a quarantined / non-human-reviewed
  //            reflection. NOT eligible for context or ranking.
  | "context_eligible" // human-reviewed + human_approval_ref present;
  //                  the future adapter MAY surface it to next-task
  //                  context (ranking_mutation_allowed stays false).
  | "ranking_eligible"; // human-reviewed + human_approval_ref present
  //                  AND the reflection's knowledge_ingest_draft is
  //                  all non-quarantined; the future adapter MAY use
  //                  it in retrieval ranking simulations
  //                  (ranking_mutation_allowed stays false at the
  //                  live-config level).

export interface UsageFeedbackEventDesign {
  schema_version: "1.0.0";
  event_id: string;
  fingerprint: string;
  task_id: string;
  /** task_id of the parent PostTaskReflection (may equal task_id for
   * legacy usage events). */
  reflection_task_id: string;
  knowledge_id: string;
  kind: UsageFeedbackEventKind;
  weight: number;
  recorded_at: string;
  artifact_ref: string | null;
  source_ref: string;
  evidence: UsageFeedbackSignal["evidence"];
  provenance: UsageFeedbackSignal["knowledge_id"] extends string
    ? PostTaskReflection["provenance"]
    : never;
  dry_run_only: true;
  persistence_allowed: false;
  ranking_mutation_allowed: false;
  eligibility: UsageFeedbackEligibility;
  /** When eligibility is context_eligible / ranking_eligible the
   * HumanApprovalRef that authorized routing is recorded verbatim.
   * The contract layer still hard-asserts verified=false. */
  human_approval_ref: HumanApprovalRef | null;
}

// -----------------------------------------------------------------
// Fingerprint helper
// -----------------------------------------------------------------

/**
 * Stable idempotency key derived from
 *   task_id + knowledge_id + kind + artifact_ref.
 *
 * Two events with the same fingerprint MUST collapse in the future
 * adapter. This is a pure string helper — no I/O, no lookup table.
 */
export function buildUsageFeedbackFingerprint(input: {
  task_id: string;
  knowledge_id: string;
  kind: UsageFeedbackEventKind;
  artifact_ref: string | null;
}): string {
  const parts = [
    input.task_id,
    input.knowledge_id,
    input.kind,
    input.artifact_ref ?? "<null>",
  ];
  return `usage-feedback:${parts.join("|")}`;
}

// -----------------------------------------------------------------
// Event projection (pure)
// -----------------------------------------------------------------

export interface ProjectUsageFeedbackEventInput {
  signal: UsageFeedbackSignal;
  reflection: Pick<
    PostTaskReflection,
    "task_id" | "provenance" | "knowledge_ingest_draft"
  >;
}

/**
 * Project a UsageFeedbackSignal + its parent reflection into a
 * UsageFeedbackEventDesign. The event is always design-only:
 *   - dry_run_only = true
 *   - persistence_allowed = false
 *   - ranking_mutation_allowed = false
 *
 * Eligibility is decided by the parent's quarantine / human-review
 * state, NOT by anything mutable on disk.
 */
export function projectUsageFeedbackEvent(
  input: ProjectUsageFeedbackEventInput,
): UsageFeedbackEventDesign {
  const sig = input.signal;
  const prov = input.reflection.provenance;
  const drafts = input.reflection.knowledge_ingest_draft;
  const humanApproved =
    prov.human_reviewed === true && prov.human_approval_ref !== null;
  const allDraftsNonQuarantined = drafts.every((d) => d.quarantine === false);
  // ranking_eligible is the strictest tier. It requires the parent's
  // human approval to be of the kind "explicit_user_action" — i.e. the
  // user took a deliberate action to surface the signal. A
  // "manual_review" approval lifts the event only to context_eligible.
  const explicitUserAction =
    humanApproved && prov.human_approval_ref!.approval_kind === "explicit_user_action";
  const eligibility: UsageFeedbackEligibility = !humanApproved
    ? "pre_review"
    : explicitUserAction && allDraftsNonQuarantined
      ? "ranking_eligible"
      : "context_eligible";

  return {
    schema_version: "1.0.0",
    event_id: `evt-${sig.recorded_at}-${sig.knowledge_id}`,
    fingerprint: buildUsageFeedbackFingerprint({
      task_id: sig.source_task_id,
      knowledge_id: sig.knowledge_id,
      kind: sig.kind,
      artifact_ref: sig.artifact_ref,
    }),
    task_id: sig.source_task_id,
    reflection_task_id: input.reflection.task_id,
    knowledge_id: sig.knowledge_id,
    kind: sig.kind,
    weight: sig.weight,
    recorded_at: sig.recorded_at,
    artifact_ref: sig.artifact_ref,
    source_ref: sig.artifact_ref ?? "unknown",
    evidence: sig.evidence.map((e) => ({ ...e })),
    provenance: { ...prov },
    dry_run_only: true,
    persistence_allowed: false,
    ranking_mutation_allowed: false,
    eligibility,
    human_approval_ref: humanApproved ? prov.human_approval_ref : null,
  };
}

// -----------------------------------------------------------------
// Duplicate collapse helper (pure)
// -----------------------------------------------------------------

/**
 * Group projected events by fingerprint. The future adapter will
 * collapse duplicates by keeping the first occurrence and discarding
 * later ones. This helper returns the collapse plan.
 */
export function collapseUsageFeedbackDuplicates<
  T extends { fingerprint: string },
>(events: T[]): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const e of events) {
    if (seen.has(e.fingerprint)) {
      dropped.push(e);
    } else {
      seen.add(e.fingerprint);
      kept.push(e);
    }
  }
  return { kept, dropped };
}

// -----------------------------------------------------------------
// Eligibility rule check (pure, for downstream tests)
// -----------------------------------------------------------------

/**
 * Returns true iff the eligibility value would survive a future
 * routing check that requires context/ranking eligibility AND
 * non-mutation. The future adapter may use this to short-circuit
 * before attempting any I/O.
 */
export function isNonMutatingContextEligible(
  e: UsageFeedbackEventDesign,
): boolean {
  if (e.ranking_mutation_allowed !== false) return false;
  if (e.persistence_allowed !== false) return false;
  if (e.dry_run_only !== true) return false;
  if (e.eligibility === "pre_review") return false;
  return e.human_approval_ref !== null;
}
