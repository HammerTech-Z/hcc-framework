// Post-task Learning Loop - Slice LOOP-009
// Pure design descriptor for the Knowledge Quarantine / Promotion
// Adapter. The adapter decides whether a knowledge_ingest_draft
// stays quarantined, becomes a promotion candidate, or is
// rejected. The adapter is pure projection only:
//
//   - no live flush
//   - no knowledgeIngest / knowledgeSearch call
//   - no audit / persistence / config write
//   - no Next Task Context write
//   - no live ranking mutation
//   - no skill install
//   - no HCC Auto Executor change
//   - no human_approval anchor verification
//   - isQuarantinePromotionApplyEligible is hard-wired to false in
//     LOOP-009 — even a `promotion_candidate` decision is a
//     candidate for a future live-apply adapter, not a live write.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live flush, no audit write, no Next Task Context mutation, no
// live retrieval ranking mutation, no persistence, no config write,
// no skill install, no HCC Auto Executor, no hermes config /
// handoff / audit mutation, no docs/roadmap-locked-2026-05-28.md
// mutation.

import {
  type EvidenceRef,
  type HumanApprovalRef,
} from "./post-task-reflection-contract";

import type { KnowledgeIngestBridgeDraft } from "./post-task-reflection-knowledge-ingest-bridge-design";

import type { ReflectionEvaluatorVerdict } from "./post-task-reflection-evaluator-design";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const QUARANTINE_PROMOTION_ADAPTER_DESIGN = {
  adapter_status: "design_only" as const,
  live_flush_allowed: false as const,
  knowledge_ingest_call_allowed: false as const,
  knowledge_search_call_allowed: false as const,
  audit_write_allowed: false as const,
  persistence_allowed: false as const,
  next_task_context_write_allowed: false as const,
  live_ranking_mutation_allowed: false as const,
  config_write_allowed: false as const,
  approval_anchor_verification_allowed: false as const,
  human_approval_ref_required: true as const,
  evaluator_verdict_required: true as const,
  schema_version: "1.0.0" as const,
} as const;

// -----------------------------------------------------------------
// Proposed state taxonomy
// -----------------------------------------------------------------

/**
 * `remain_quarantined` ⇢ the draft stays in quarantine (agent
 * submitted, missing human approval, or evaluator returned a
 * non-candidate verdict).
 * `promotion_candidate` ⇢ the draft MAY be promoted by a future
 * live-apply adapter; in LOOP-009 the apply path is closed.
 * `reject` ⇢ the draft fails the hard guards (missing evidence,
 * failed scans, or an explicit reject verdict).
 */
export type QuarantinePromotionProposedState =
  | "remain_quarantined"
  | "promotion_candidate"
  | "reject";

export const QUARANTINE_PROMOTION_PROPOSED_STATES: readonly QuarantinePromotionProposedState[] = [
  "remain_quarantined",
  "promotion_candidate",
  "reject",
] as const;

// -----------------------------------------------------------------
// Decision shape
// -----------------------------------------------------------------

export interface QuarantinePromotionDecision {
  schema_version: "1.0.0";
  decision_id: string;
  source_kind: "knowledge_ingest_draft";
  source_task: string;
  source_ref: string;
  draft_fingerprint: string;
  evaluator_verdict_id: string;
  current_quarantine: boolean;
  proposed_state: QuarantinePromotionProposedState;
  reason: string;
  evidence: EvidenceRef[];
  human_approval_ref: HumanApprovalRef | null;
  evaluator_trust_band: ReflectionEvaluatorVerdict["trust_band"];
  evaluator_trust_score: number;
  dry_run_only: true;
  live_flush_allowed: false;
  knowledge_ingest_call_allowed: false;
  knowledge_search_call_allowed: false;
  audit_write_allowed: false;
  persistence_allowed: false;
  next_task_context_write_allowed: false;
  live_ranking_mutation_allowed: false;
  config_write_allowed: false;
}

// -----------------------------------------------------------------
// Decision id
// -----------------------------------------------------------------

/**
 * Stable decision id derived from
 *   source_task + draft_fingerprint.
 * Identical inputs MUST produce identical ids. Distinct inputs
 * MUST produce distinct ids.
 */
export function buildQuarantinePromotionDecisionId(input: {
  source_task: string;
  draft_fingerprint: string;
}): string {
  return `quarantine-promotion-decision:${input.source_task}|${input.draft_fingerprint}`;
}

// -----------------------------------------------------------------
// Per-draft decision
// -----------------------------------------------------------------

export interface DecidePromotionForDraftInput {
  draft: KnowledgeIngestBridgeDraft;
  verdict: ReflectionEvaluatorVerdict;
}

/**
 * Pure per-draft decision. The decision is a projection of the
 * draft's quarantine + human-approval state combined with the
 * evaluator verdict. The future live-apply adapter is gated on
 * `isQuarantinePromotionApplyEligible` (hard-wired to false in
 * LOOP-009).
 */
export function decidePromotionForKnowledgeIngestDraft(
  input: DecidePromotionForDraftInput,
): QuarantinePromotionDecision {
  const { draft, verdict } = input;
  const { proposedState, reason } = classifyPromotionState(draft, verdict);
  return buildDecision({
    sourceTask: draft.source_task,
    sourceRef: draft.source_ref,
    draftFingerprint: draft.fingerprint,
    evaluatorVerdictId: verdict.verdict_id,
    currentQuarantine: draft.quarantine,
    proposedState,
    reason,
    evidence: draft.evidence,
    humanApprovalRef: draft.human_approval_ref,
    evaluatorTrustBand: verdict.trust_band,
    evaluatorTrustScore: verdict.trust_score,
  });
}

function classifyPromotionState(
  draft: KnowledgeIngestBridgeDraft,
  verdict: ReflectionEvaluatorVerdict,
): { proposedState: QuarantinePromotionProposedState; reason: string } {
  // Hard guards dominate:
  if (draft.evidence.length < 1) {
    return {
      proposedState: "reject",
      reason: "draft.evidence empty ⇒ reject",
    };
  }
  if (draft.approval_gate.status !== "closed" || draft.approval_gate.approved !== false) {
    return {
      proposedState: "reject",
      reason: "draft.approval_gate must stay closed / approved=false ⇒ reject",
    };
  }
  if (verdict.trust_band === "reject") {
    return {
      proposedState: "reject",
      reason: "evaluator verdict trust_band=reject ⇒ reject",
    };
  }
  // agent-submitted / quarantined / missing human_approval_ref ⇒
  // remain_quarantined (NOT a promotion candidate).
  if (draft.quarantine) {
    return {
      proposedState: "remain_quarantined",
      reason: "draft.quarantine=true ⇒ remain_quarantined",
    };
  }
  if (draft.human_approval_ref === null) {
    return {
      proposedState: "remain_quarantined",
      reason:
        "draft.quarantine=false but human_approval_ref=null ⇒ remain_quarantined (consumer-anchor layer must verify before promotion)",
    };
  }
  if (draft.human_approval_ref.verified !== false) {
    return {
      proposedState: "reject",
      reason:
        "draft.human_approval_ref.verified must be false in the contract layer ⇒ reject",
    };
  }
  // The high-trust band is necessary but not sufficient: the
  // evaluator must have returned `human_reviewed_candidate`.
  if (
    verdict.trust_band !== "human_reviewed_candidate" ||
    verdict.human_approval_ref === null
  ) {
    return {
      proposedState: "remain_quarantined",
      reason: `evaluator verdict trust_band=${verdict.trust_band} ⇒ remain_quarantined`,
    };
  }
  return {
    proposedState: "promotion_candidate",
    reason:
      "evaluator verdict trust_band=human_reviewed_candidate + human_approval_ref present + draft.quarantine=false ⇒ promotion_candidate (apply path closed in LOOP-009)",
  };
}

function buildDecision(input: {
  sourceTask: string;
  sourceRef: string;
  draftFingerprint: string;
  evaluatorVerdictId: string;
  currentQuarantine: boolean;
  proposedState: QuarantinePromotionProposedState;
  reason: string;
  evidence: EvidenceRef[];
  humanApprovalRef: HumanApprovalRef | null;
  evaluatorTrustBand: ReflectionEvaluatorVerdict["trust_band"];
  evaluatorTrustScore: number;
}): QuarantinePromotionDecision {
  return {
    schema_version: "1.0.0",
    decision_id: buildQuarantinePromotionDecisionId({
      source_task: input.sourceTask,
      draft_fingerprint: input.draftFingerprint,
    }),
    source_kind: "knowledge_ingest_draft",
    source_task: input.sourceTask,
    source_ref: input.sourceRef,
    draft_fingerprint: input.draftFingerprint,
    evaluator_verdict_id: input.evaluatorVerdictId,
    current_quarantine: input.currentQuarantine,
    proposed_state: input.proposedState,
    reason: input.reason,
    evidence: input.evidence.map((e) => ({ ...e })),
    human_approval_ref: input.humanApprovalRef,
    evaluator_trust_band: input.evaluatorTrustBand,
    evaluator_trust_score: input.evaluatorTrustScore,
    dry_run_only: true,
    live_flush_allowed: false,
    knowledge_ingest_call_allowed: false,
    knowledge_search_call_allowed: false,
    audit_write_allowed: false,
    persistence_allowed: false,
    next_task_context_write_allowed: false,
    live_ranking_mutation_allowed: false,
    config_write_allowed: false,
  };
}

// -----------------------------------------------------------------
// Batch decision
// -----------------------------------------------------------------

export interface DecidePromotionForBundleInput {
  drafts: KnowledgeIngestBridgeDraft[];
  verdicts: ReflectionEvaluatorVerdict[];
}

export function decidePromotionForBundle(
  input: DecidePromotionForBundleInput,
): QuarantinePromotionDecision[] {
  return input.drafts.map((draft) => {
    const verdict = input.verdicts.find(
      (v) => v.source_fingerprint === draft.fingerprint,
    );
    if (!verdict) {
      // No matching verdict ⇒ remain_quarantined. This mirrors the
      // LOOP-006A fallback rule: an unevaluated draft cannot be
      // promoted.
      return buildDecision({
        sourceTask: draft.source_task,
        sourceRef: draft.source_ref,
        draftFingerprint: draft.fingerprint,
        evaluatorVerdictId: `missing-verdict:${draft.fingerprint}`,
        currentQuarantine: draft.quarantine,
        proposedState: "remain_quarantined",
        reason: "no matching evaluator verdict in bundle ⇒ remain_quarantined",
        evidence: draft.evidence,
        humanApprovalRef: draft.human_approval_ref,
        evaluatorTrustBand: "quarantine",
        evaluatorTrustScore: 0,
      });
    }
    return decidePromotionForKnowledgeIngestDraft({ draft, verdict });
  });
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

export function collapseQuarantinePromotionDecisions(
  decisions: QuarantinePromotionDecision[],
): {
  kept: QuarantinePromotionDecision[];
  dropped: QuarantinePromotionDecision[];
} {
  const seen = new Set<string>();
  const kept: QuarantinePromotionDecision[] = [];
  const dropped: QuarantinePromotionDecision[] = [];
  for (const d of decisions) {
    if (seen.has(d.decision_id)) {
      dropped.push(d);
    } else {
      seen.add(d.decision_id);
      kept.push(d);
    }
  }
  return { kept, dropped };
}

// -----------------------------------------------------------------
// Runtime guard
// -----------------------------------------------------------------

const FOREVER_FALSE_FLAGS = [
  "live_flush_allowed",
  "knowledge_ingest_call_allowed",
  "knowledge_search_call_allowed",
  "audit_write_allowed",
  "persistence_allowed",
  "next_task_context_write_allowed",
  "live_ranking_mutation_allowed",
  "config_write_allowed",
] as const;

export function assertQuarantinePromotionDecisionNoRuntime(
  d: QuarantinePromotionDecision,
): void {
  if (d.schema_version !== "1.0.0") {
    throw new Error(
      "quarantine_promotion_decision schema_version is invalid",
    );
  }
  if (d.dry_run_only !== true) {
    throw new Error(
      "quarantine_promotion_decision.dry_run_only must be true",
    );
  }
  for (const flag of FOREVER_FALSE_FLAGS) {
    if (d[flag] !== false) {
      throw new Error(
        `quarantine_promotion_decision.${flag} must be false`,
      );
    }
  }
  if (!QUARANTINE_PROMOTION_PROPOSED_STATES.includes(d.proposed_state)) {
    throw new Error(
      "quarantine_promotion_decision.proposed_state is invalid",
    );
  }
  if (d.evidence.length < 1) {
    throw new Error(
      "quarantine_promotion_decision.evidence must be non-empty",
    );
  }
  if (
    d.human_approval_ref !== null &&
    d.human_approval_ref.verified !== false
  ) {
    throw new Error(
      "quarantine_promotion_decision.human_approval_ref.verified must be false in the contract layer",
    );
  }
  if (
    d.evaluator_trust_band !== "reject" &&
    d.evaluator_trust_band !== "quarantine" &&
    d.evaluator_trust_band !== "candidate" &&
    d.evaluator_trust_band !== "human_reviewed_candidate"
  ) {
    throw new Error(
      "quarantine_promotion_decision.evaluator_trust_band is invalid",
    );
  }
  if (d.evaluator_trust_score < 0 || d.evaluator_trust_score > 1) {
    throw new Error(
      "quarantine_promotion_decision.evaluator_trust_score must be in [0, 1]",
    );
  }
  if (
    d.proposed_state === "promotion_candidate" &&
    d.human_approval_ref === null
  ) {
    throw new Error(
      "quarantine_promotion_decision: promotion_candidate requires human_approval_ref",
    );
  }
}

// -----------------------------------------------------------------
// Apply eligibility
// -----------------------------------------------------------------

/**
 * Returns true iff the decision is eligible to be APPLIED — i.e.
 * promoted into the live knowledge store. In LOOP-009 the adapter
 * is design-only, so this helper is hard-wired to `false`. The
 * signature is shaped so a future live-apply adapter (only after a
 * separate slice flips the live-write flags) can short-circuit on
 * the same fields.
 */
export function isQuarantinePromotionApplyEligible(
  d: QuarantinePromotionDecision,
): boolean {
  if (d.live_flush_allowed !== false) return false;
  if (d.knowledge_ingest_call_allowed !== false) return false;
  if (d.knowledge_search_call_allowed !== false) return false;
  if (d.audit_write_allowed !== false) return false;
  if (d.persistence_allowed !== false) return false;
  if (d.next_task_context_write_allowed !== false) return false;
  if (d.live_ranking_mutation_allowed !== false) return false;
  if (d.config_write_allowed !== false) return false;
  if (d.dry_run_only !== true) return false;
  if (d.human_approval_ref === null) return false;
  if (d.human_approval_ref.verified !== false) return false;
  if (d.proposed_state !== "promotion_candidate") return false;
  // LOOP-009 hard guarantee: the apply path is unconditionally
  // closed. Even a fully-screened `promotion_candidate` decision
  // does NOT promote to live knowledge in this slice.
  return false;
}
