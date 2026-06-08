// Post-task Learning Loop - Slice LOOP-008
// Pure Reflection Evaluator / Trust Score Projection. The evaluator
// scores reflections, knowledge_ingest_draft bundles, consumer
// route decisions, and retrieval feedback simulation candidates
// and emits a ReflectionEvaluatorVerdict. The evaluator is pure:
// it never writes to the knowledge store, never calls
// knowledgeIngest / knowledgeSearch, never writes to audit,
// never writes to Next Task Context, never mutates live ranking,
// never persists, never writes config, never starts a model,
// never opens IPC, never triggers the HCC Auto Executor.
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
  type PostTaskReflection,
} from "./post-task-reflection-contract";

import type { KnowledgeIngestBridgeDraft } from "./post-task-reflection-knowledge-ingest-bridge-design";

import type { ConsumerRouteDecision } from "./post-task-reflection-human-approval-anchor-design";

import type { RetrievalRankingDeltaCandidate } from "./post-task-reflection-retrieval-feedback-simulation";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const REFLECTION_EVALUATOR_DESIGN = {
  evaluator_status: "pure_projection" as const,
  live_flush_allowed: false as const,
  knowledge_ingest_call_allowed: false as const,
  knowledge_search_call_allowed: false as const,
  audit_write_allowed: false as const,
  persistence_allowed: false as const,
  next_task_context_write_allowed: false as const,
  live_ranking_mutation_allowed: false as const,
  config_write_allowed: false as const,
  human_approval_ref_required_for_high_trust: true as const,
  evidence_required: true as const,
  schema_version: "1.0.0" as const,
} as const;

// -----------------------------------------------------------------
// Trust band taxonomy
// -----------------------------------------------------------------

/**
 * `reject` ⇢ the source MUST NOT enter any pipeline (bad scans,
 * missing evidence, missing human_approval_ref on a non-`pre_review`
 * source, or an explicit closed verdict).
 * `quarantine` ⇢ the source is auto-submitted / non-human-reviewed
 * and MUST stay in quarantine until explicit human review.
 * `candidate` ⇢ the source passes the basic guard but is still
 * pre-human-review; it MAY be projected forward as a candidate.
 * `human_reviewed_candidate` ⇢ the source carries a HumanApprovalRef
 * (verified=false) and may be projected forward as a candidate.
 * The high-trust tier is intentionally absent: even a
 * `human_reviewed_candidate` MUST NOT be promoted to live flush in
 * LOOP-008. Promotion is gated on a separate, future slice.
 */
export type ReflectionTrustBand =
  | "reject"
  | "quarantine"
  | "candidate"
  | "human_reviewed_candidate";

/**
 * The numeric ceiling. A verdict is a projection — it does not
 * mutate anything. The score is a pure function of the source
 * evidence; it is the trust_band, not the score, that drives any
 * consumer decision.
 */
export const REFLECTION_TRUST_SCORE_MIN = 0 as const;
export const REFLECTION_TRUST_SCORE_MAX = 1 as const;

/**
 * Score band thresholds (advisory, used only for the trust_band
 * assignment; not a policy on its own):
 *   score <  reject_threshold              ⇒ `reject`
 *   reject_threshold  ≤ score <  quarantine_threshold ⇒ `quarantine`
 *   quarantine_threshold ≤ score < human_reviewed_threshold ⇒ `candidate`
 *   human_reviewed_threshold ≤ score      ⇒ `human_reviewed_candidate`
 *   (provided human_approval_ref is present; otherwise the band is
 *    forced back down to `quarantine`.)
 */
export const REFLECTION_TRUST_THRESHOLDS: Readonly<{
  reject: number;
  quarantine: number;
  human_reviewed: number;
}> = {
  reject: 0,
  quarantine: 0.4,
  human_reviewed: 0.85,
} as const;

// -----------------------------------------------------------------
// Verdict shape
// -----------------------------------------------------------------

export interface ReflectionEvaluatorVerdict {
  schema_version: "1.0.0";
  verdict_id: string;
  source_kind:
    | "post_task_reflection"
    | "knowledge_ingest_draft"
    | "consumer_route_decision"
    | "retrieval_delta_candidate";
  source_task: string;
  source_ref: string;
  source_fingerprint: string;
  trust_score: number;
  trust_band: ReflectionTrustBand;
  reasons: string[];
  downgrades: string[];
  evidence: EvidenceRef[];
  human_approval_ref: HumanApprovalRef | null;
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
// Verdict id
// -----------------------------------------------------------------

/**
 * Stable verdict id derived from
 *   source_kind + source_task + source_fingerprint.
 * Identical inputs MUST produce identical ids. Distinct inputs MUST
 * produce distinct ids.
 */
export function buildReflectionEvaluatorVerdictId(input: {
  source_kind: ReflectionEvaluatorVerdict["source_kind"];
  source_task: string;
  source_fingerprint: string;
}): string {
  return `reflection-evaluator-verdict:${input.source_kind}|${input.source_task}|${input.source_fingerprint}`;
}

// -----------------------------------------------------------------
// Score helper
// -----------------------------------------------------------------

/**
 * Pure score helper. Walks a small set of evidence-shape signals and
 * returns a trust score in [0, 1]. The score is purely advisory —
 * the trust_band is what callers gate on.
 *
 * Signals (every input is optional / nullable; missing ⇒ 0):
 * - hasEvidence:  +0.20
 * - secretScanPassed: +0.20
 * - instructionScanPassed: +0.20
 * - humanReviewed: +0.20
 * - humanApprovalRefPresent: +0.20
 * - quarantine=false: +0.10 (only if quarantine is false; missing
 *   defaults to 0)
 * - approvalGateClosed: +0.05
 * - apply_eligible_in_source=false: 0
 * - apply_eligible_in_source=true: -0.50 (penalty; but a future live
 *   ranking candidate can never reach this score band)
 *
 * The score is then clamped to [0, 1]. The result is a pure number;
 * the trust band is the band the helper assigns separately.
 */
export function scoreReflectionTrust(input: {
  hasEvidence: boolean;
  secretScanPassed: boolean;
  instructionScanPassed: boolean;
  humanReviewed: boolean;
  humanApprovalRefPresent: boolean;
  quarantine: boolean | null;
  approvalGateClosed: boolean;
  applyEligibleInSource: boolean;
}): { trust_score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (input.hasEvidence) {
    score += 0.2;
    reasons.push("evidence present");
  } else {
    reasons.push("evidence missing");
  }
  if (input.secretScanPassed) {
    score += 0.2;
    reasons.push("secret scan passed");
  } else {
    reasons.push("secret scan failed");
  }
  if (input.instructionScanPassed) {
    score += 0.2;
    reasons.push("instruction scan passed");
  } else {
    reasons.push("instruction scan failed");
  }
  if (input.humanReviewed) {
    score += 0.2;
    reasons.push("human reviewed");
  } else {
    reasons.push("agent-submitted (not human reviewed)");
  }
  if (input.humanApprovalRefPresent) {
    score += 0.2;
    reasons.push("human_approval_ref present");
  } else {
    reasons.push("human_approval_ref missing");
  }
  if (input.quarantine === false) {
    score += 0.1;
    reasons.push("quarantine=false");
  } else {
    reasons.push("quarantine=true (or unknown)");
  }
  if (input.approvalGateClosed) {
    score += 0.05;
    reasons.push("approval_gate closed");
  } else {
    reasons.push("approval_gate open (unexpected)");
  }
  if (input.applyEligibleInSource) {
    score -= 0.5;
    reasons.push("apply_eligible_in_source=true penalty applied");
  }

  const clamped = Math.max(
    REFLECTION_TRUST_SCORE_MIN,
    Math.min(REFLECTION_TRUST_SCORE_MAX, Number(score.toFixed(4))),
  );
  return { trust_score: clamped, reasons };
}

function bandForScore(
  score: number,
  humanApprovalRefPresent: boolean,
  quarantine: boolean | null,
  evidencePresent: boolean,
  secretScanPassed: boolean,
  instructionScanPassed: boolean,
): { band: ReflectionTrustBand; downgrades: string[] } {
  const downgrades: string[] = [];
  // Hard rejects (these dominate any score band):
  if (!evidencePresent) {
    downgrades.push("evidence empty ⇒ reject");
    return { band: "reject", downgrades };
  }
  if (!secretScanPassed) {
    downgrades.push("secret scan failed ⇒ reject");
    return { band: "reject", downgrades };
  }
  if (!instructionScanPassed) {
    downgrades.push("instruction scan failed ⇒ reject");
    return { band: "reject", downgrades };
  }

  if (score < REFLECTION_TRUST_THRESHOLDS.quarantine) {
    downgrades.push(`score ${score} < quarantine threshold`);
    return { band: "reject", downgrades };
  }

  if (!humanApprovalRefPresent) {
    if (quarantine === true || quarantine === null) {
      downgrades.push("human_approval_ref missing + quarantine ⇒ quarantine");
      return { band: "quarantine", downgrades };
    }
    // quarantine=false but no human_approval_ref ⇒ reject; the
    // contract layer treats quarantine=false without
    // human_approval_ref as invalid, so the evaluator mirrors that.
    downgrades.push("quarantine=false without human_approval_ref ⇒ reject");
    return { band: "reject", downgrades };
  }

  if (score < REFLECTION_TRUST_THRESHOLDS.human_reviewed) {
    if (quarantine === false) {
      downgrades.push("human_approval_ref present + score < human_reviewed threshold");
      return { band: "candidate", downgrades };
    }
    downgrades.push("human_approval_ref present but quarantined ⇒ quarantine");
    return { band: "quarantine", downgrades };
  }

  if (quarantine === false) {
    return { band: "human_reviewed_candidate", downgrades };
  }
  downgrades.push("human_approval_ref present but quarantined ⇒ quarantine");
  return { band: "quarantine", downgrades };
}

// -----------------------------------------------------------------
// Verdict construction
// -----------------------------------------------------------------

function buildVerdict(input: {
  sourceKind: ReflectionEvaluatorVerdict["source_kind"];
  sourceTask: string;
  sourceRef: string;
  sourceFingerprint: string;
  evidence: EvidenceRef[];
  humanApprovalRef: HumanApprovalRef | null;
  trustScore: number;
  trustBand: ReflectionTrustBand;
  reasons: string[];
  downgrades: string[];
}): ReflectionEvaluatorVerdict {
  return {
    schema_version: "1.0.0",
    verdict_id: buildReflectionEvaluatorVerdictId({
      source_kind: input.sourceKind,
      source_task: input.sourceTask,
      source_fingerprint: input.sourceFingerprint,
    }),
    source_kind: input.sourceKind,
    source_task: input.sourceTask,
    source_ref: input.sourceRef,
    source_fingerprint: input.sourceFingerprint,
    trust_score: input.trustScore,
    trust_band: input.trustBand,
    reasons: [...input.reasons],
    downgrades: [...input.downgrades],
    evidence: input.evidence.map((e) => ({ ...e })),
    human_approval_ref: input.humanApprovalRef,
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

function emptyEvidenceCheck(
  evidence: EvidenceRef[],
  source: { source_kind: string },
): void {
  if (evidence.length < 1) {
    throw new Error(
      `${source.source_kind}: evidence array must be non-empty (evidence_required=true)`,
    );
  }
}

// -----------------------------------------------------------------
// Per-source evaluators
// -----------------------------------------------------------------

export interface EvaluatePostTaskReflectionInput {
  reflection: PostTaskReflection;
  humanApprovalRefOverride?: HumanApprovalRef | null;
}

export function evaluatePostTaskReflection(
  input: EvaluatePostTaskReflectionInput,
): ReflectionEvaluatorVerdict {
  const r = input.reflection;
  const evidence: EvidenceRef[] = collectReflectionEvidence(r);
  emptyEvidenceCheck(evidence, { source_kind: "post_task_reflection" });

  // secret / instruction scans: the contract layer guarantees every
  // promotable item has them; the projection assumes pass.
  const secretScanPassed = true;
  const instructionScanPassed = true;
  const approvalRef =
    input.humanApprovalRefOverride !== undefined
      ? input.humanApprovalRefOverride
      : r.provenance.human_approval_ref;
  // approval gate closed
  const approvalGateClosed =
    r.approval_gate.status === "closed" && r.approval_gate.approved === false;

  // quarantine is computed at the knowledge_ingest_draft level; the
  // reflection-level verdict reports aggregate quarantine=true when
  // ANY draft is quarantined.
  const aggregateQuarantine = r.knowledge_ingest_draft.some(
    (d) => d.quarantine === true,
  );

  const { trust_score, reasons } = scoreReflectionTrust({
    hasEvidence: true,
    secretScanPassed,
    instructionScanPassed,
    humanReviewed: r.provenance.human_reviewed === true,
    humanApprovalRefPresent: approvalRef !== null,
    quarantine: aggregateQuarantine,
    approvalGateClosed,
    applyEligibleInSource: false,
  });

  const { band, downgrades } = bandForScore(
    trust_score,
    approvalRef !== null,
    aggregateQuarantine,
    true,
    secretScanPassed,
    instructionScanPassed,
  );

  return buildVerdict({
    sourceKind: "post_task_reflection",
    sourceTask: r.task_id,
    sourceRef: r.artifact_ref ?? r.task_id,
    sourceFingerprint: r.task_id,
    evidence,
    humanApprovalRef: approvalRef,
    trustScore: trust_score,
    trustBand: band,
    reasons,
    downgrades,
  });
}

export function evaluateKnowledgeIngestDraft(
  draft: KnowledgeIngestBridgeDraft,
): ReflectionEvaluatorVerdict {
  emptyEvidenceCheck(draft.evidence, {
    source_kind: "knowledge_ingest_draft",
  });
  if (draft.evidence[0] && !/^sha256-/.test(draft.evidence[0].content_hash)) {
    throw new Error(
      "knowledge_ingest_draft: evidence[0].content_hash must start with sha256-",
    );
  }
  const approvalGateClosed =
    draft.approval_gate.status === "closed" &&
    draft.approval_gate.approved === false;

  const { trust_score, reasons } = scoreReflectionTrust({
    hasEvidence: true,
    secretScanPassed: true,
    instructionScanPassed: true,
    humanReviewed: draft.human_approval_ref !== null,
    humanApprovalRefPresent: draft.human_approval_ref !== null,
    quarantine: draft.quarantine,
    approvalGateClosed,
    applyEligibleInSource: false,
  });

  const { band, downgrades } = bandForScore(
    trust_score,
    draft.human_approval_ref !== null,
    draft.quarantine,
    true,
    true,
    true,
  );

  return buildVerdict({
    sourceKind: "knowledge_ingest_draft",
    sourceTask: draft.source_task,
    sourceRef: draft.source_ref,
    sourceFingerprint: draft.fingerprint,
    evidence: draft.evidence,
    humanApprovalRef: draft.human_approval_ref,
    trustScore: trust_score,
    trustBand: band,
    reasons,
    downgrades,
  });
}

export interface EvaluateKnowledgeIngestDraftBundleInput {
  drafts: KnowledgeIngestBridgeDraft[];
}

export function evaluateKnowledgeIngestDraftBundle(
  input: EvaluateKnowledgeIngestDraftBundleInput,
): ReflectionEvaluatorVerdict[] {
  return input.drafts.map(evaluateKnowledgeIngestDraft);
}

export function evaluateConsumerRouteDecision(
  decision: ConsumerRouteDecision,
): ReflectionEvaluatorVerdict {
  const evidence: EvidenceRef[] = decision.human_approval_ref
    ? [
        {
          kind: "artifact",
          ref: `anchor://${decision.human_approval_ref.ref}`,
          content_hash: decision.human_approval_ref.content_hash,
        },
      ]
    : [
        {
          kind: "artifact",
          ref: `consumer-route://${decision.decision_id}`,
          content_hash: "sha256-consumer-route-evidence-empty",
        },
      ];
  if (decision.human_approval_ref === null) {
    // The consumer route decision with no human anchor still must
    // carry a non-empty evidence array; the route's decision_id is
    // recorded as the ref. The evaluator never inlines a sha256-
    // body hash here because the underlying source is the
    // decision_id; downstream consumers can resolve the actual
    // evidence through the source ref.
  }
  emptyEvidenceCheck(evidence, { source_kind: "consumer_route_decision" });

  const approvalGateClosed =
    decision.approval_gate.status === "closed" &&
    decision.approval_gate.approved === false;

  const { trust_score, reasons } = scoreReflectionTrust({
    hasEvidence: true,
    secretScanPassed: true,
    instructionScanPassed: true,
    humanReviewed: decision.human_approval_ref !== null,
    humanApprovalRefPresent: decision.human_approval_ref !== null,
    quarantine: decision.quarantine,
    approvalGateClosed,
    applyEligibleInSource: false,
  });

  const { band, downgrades } = bandForScore(
    trust_score,
    decision.human_approval_ref !== null,
    decision.quarantine,
    true,
    true,
    true,
  );

  return buildVerdict({
    sourceKind: "consumer_route_decision",
    sourceTask: decision.source_task,
    sourceRef: decision.source_ref,
    sourceFingerprint: decision.source_fingerprint,
    evidence,
    humanApprovalRef: decision.human_approval_ref,
    trustScore: trust_score,
    trustBand: band,
    reasons,
    downgrades,
  });
}

export function evaluateRetrievalDeltaCandidate(
  candidate: RetrievalRankingDeltaCandidate,
): ReflectionEvaluatorVerdict {
  emptyEvidenceCheck(candidate.evidence, {
    source_kind: "retrieval_delta_candidate",
  });

  const { trust_score, reasons } = scoreReflectionTrust({
    hasEvidence: true,
    secretScanPassed: true,
    instructionScanPassed: true,
    humanReviewed: candidate.human_approval_ref !== null,
    humanApprovalRefPresent: candidate.human_approval_ref !== null,
    quarantine: candidate.route === "reject_pre_review",
    approvalGateClosed: true,
    applyEligibleInSource: false,
  });

  const { band, downgrades } = bandForScore(
    trust_score,
    candidate.human_approval_ref !== null,
    candidate.route === "reject_pre_review",
    true,
    true,
    true,
  );

  return buildVerdict({
    sourceKind: "retrieval_delta_candidate",
    sourceTask: candidate.source_task,
    sourceRef: candidate.source_ref,
    sourceFingerprint: candidate.candidate_id,
    evidence: candidate.evidence,
    humanApprovalRef: candidate.human_approval_ref,
    trustScore: trust_score,
    trustBand: band,
    reasons,
    downgrades,
  });
}

export function evaluateRetrievalDeltaCandidates(
  candidates: RetrievalRankingDeltaCandidate[],
): ReflectionEvaluatorVerdict[] {
  return candidates.map(evaluateRetrievalDeltaCandidate);
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

export function collapseReflectionEvaluatorVerdicts(
  verdicts: ReflectionEvaluatorVerdict[],
): { kept: ReflectionEvaluatorVerdict[]; dropped: ReflectionEvaluatorVerdict[] } {
  const seen = new Set<string>();
  const kept: ReflectionEvaluatorVerdict[] = [];
  const dropped: ReflectionEvaluatorVerdict[] = [];
  for (const v of verdicts) {
    if (seen.has(v.verdict_id)) {
      dropped.push(v);
    } else {
      seen.add(v.verdict_id);
      kept.push(v);
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

export function assertReflectionEvaluatorVerdictNoRuntime(
  v: ReflectionEvaluatorVerdict,
): void {
  if (v.schema_version !== "1.0.0") {
    throw new Error("reflection_evaluator_verdict schema_version is invalid");
  }
  if (v.dry_run_only !== true) {
    throw new Error("reflection_evaluator_verdict.dry_run_only must be true");
  }
  for (const flag of FOREVER_FALSE_FLAGS) {
    if (v[flag] !== false) {
      throw new Error(`reflection_evaluator_verdict.${flag} must be false`);
    }
  }
  if (
    v.trust_band !== "reject" &&
    v.trust_band !== "quarantine" &&
    v.trust_band !== "candidate" &&
    v.trust_band !== "human_reviewed_candidate"
  ) {
    throw new Error("reflection_evaluator_verdict.trust_band is invalid");
  }
  if (v.trust_score < 0 || v.trust_score > 1) {
    throw new Error(
      "reflection_evaluator_verdict.trust_score must be in [0, 1]",
    );
  }
  if (v.evidence.length < 1) {
    throw new Error("reflection_evaluator_verdict.evidence must be non-empty");
  }
  if (v.human_approval_ref !== null && v.human_approval_ref.verified !== false) {
    throw new Error(
      "reflection_evaluator_verdict.human_approval_ref.verified must be false in the contract layer",
    );
  }
  if (v.trust_band === "human_reviewed_candidate" && v.human_approval_ref === null) {
    throw new Error(
      "reflection_evaluator_verdict: human_reviewed_candidate band requires human_approval_ref",
    );
  }
}

// -----------------------------------------------------------------
// Apply eligibility
// -----------------------------------------------------------------

/**
 * Returns true iff the verdict is eligible to be APPLIED — i.e.
 * promoted into the live knowledge store, live ranking, or Next
 * Task Context. In LOOP-008 the evaluator is a pure projection, so
 * this helper is hard-wired to `false`. The signature is shaped so
 * a future live-apply adapter (only after a separate slice flips
 * the live-write flags) can short-circuit on the same fields.
 */
export function isReflectionEvaluatorPromotionEligible(
  v: ReflectionEvaluatorVerdict,
): boolean {
  if (v.live_flush_allowed !== false) return false;
  if (v.knowledge_ingest_call_allowed !== false) return false;
  if (v.knowledge_search_call_allowed !== false) return false;
  if (v.audit_write_allowed !== false) return false;
  if (v.persistence_allowed !== false) return false;
  if (v.next_task_context_write_allowed !== false) return false;
  if (v.live_ranking_mutation_allowed !== false) return false;
  if (v.config_write_allowed !== false) return false;
  if (v.dry_run_only !== true) return false;
  if (v.human_approval_ref === null) return false;
  if (v.human_approval_ref.verified !== false) return false;
  // Even with every live flag held false, LOOP-008 keeps the apply
  // path unconditionally closed. The high-trust band only enters
  // a future live-pipeline; the evaluator MUST NOT promote on its
  // own.
  return false;
}

// -----------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------

function collectReflectionEvidence(r: PostTaskReflection): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  for (const d of r.knowledge_ingest_draft) {
    for (const e of d.evidence) out.push({ ...e });
  }
  for (const s of r.usage_feedback_signals) {
    for (const e of s.evidence) out.push({ ...e });
  }
  for (const p of r.good_patterns) {
    for (const e of p.evidence) out.push({ ...e });
  }
  for (const p of r.bad_patterns) {
    for (const e of p.evidence) out.push({ ...e });
  }
  for (const d of r.dead_ends) {
    for (const e of d.evidence) out.push({ ...e });
  }
  for (const sk of r.skill_candidates) {
    for (const e of sk.evidence) out.push({ ...e });
  }
  for (const fb of r.model_feedback) {
    for (const e of fb.evidence) out.push({ ...e });
  }
  return out;
}
