// Post-task Learning Loop - Slice LOOP-007
// Pure design descriptor for the Retrieval Feedback Simulation. This
// slice is dry-run only. It computes retrieval ranking delta
// candidates from usage_feedback signals and the LOOP-006A consumer
// route decisions, but it MUST NOT write to live retrieval ranking,
// MUST NOT live flush to the knowledge store, MUST NOT write to
// audit, MUST NOT write to Next Task Context, and MUST NOT call
// knowledgeIngest / knowledgeSearch.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live ranking mutation, no live flush, no audit write, no Next
// Task Context mutation, no skill install, no HCC Auto Executor, no
// hermes config / handoff / audit mutation, no
// docs/roadmap-locked-2026-05-28.md mutation.

import {
  POST_TASK_REFLECTION_APPROVAL_GATE,
  type EvidenceRef,
  type HumanApprovalRef,
  type UsageFeedbackSignal,
} from "./post-task-reflection-contract";

import type {
  ConsumerRoute,
  ConsumerRouteDecision,
} from "./post-task-reflection-human-approval-anchor-design";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const RETRIEVAL_FEEDBACK_SIMULATION_DESIGN = {
  simulation_status: "dry_run_only" as const,
  live_ranking_mutation_allowed: false as const,
  ranking_input_write_allowed: false as const,
  next_task_context_write_allowed: false as const,
  knowledge_ingest_call_allowed: false as const,
  knowledge_search_call_allowed: false as const,
  live_flush_allowed: false as const,
  audit_write_allowed: false as const,
  persistence_allowed: false as const,
  config_write_allowed: false as const,
  consumer_route_required: true as const,
  human_approval_ref_required_for_ranking_candidate: true as const,
  schema_version: "1.0.0" as const,
} as const;

// -----------------------------------------------------------------
// Taxonomy
// -----------------------------------------------------------------

/**
 * `helped` ⇢ a positive signal that, if approved and non-quarantined,
 * could surface as a future ranking boost candidate.
 * `misled` ⇢ a negative signal that could surface as a future ranking
 * penalty candidate.
 * `none` ⇢ no signal can be turned into a delta; the candidate is a
 * zero-delta placeholder so the consumer pipeline still records the
 * event without proposing any change.
 */
export type RetrievalSignalKind = "helped" | "misled" | "none";

export type RetrievalDeltaDirection = "boost" | "penalize" | "none";

export type RetrievalDeltaRoute = ConsumerRoute;

// -----------------------------------------------------------------
// Proposed-delta matrix
// -----------------------------------------------------------------

/**
 * Maximum absolute boost. Pure documentation — the simulator never
 * promotes a delta to live ranking, so this cap is informational and
 * the resulting value is only written into the dry-run candidate
 * envelope, never into the live retrieval config.
 */
export const MAX_ABSOLUTE_DELTA: Readonly<{ boost: number; penalize: number }> = {
  boost: 1,
  penalize: 1,
} as const;

// -----------------------------------------------------------------
// Candidate shape
// -----------------------------------------------------------------

export interface RetrievalRankingDeltaCandidate {
  schema_version: "1.0.0";
  candidate_id: string;
  source_task: string;
  source_ref: string;
  knowledge_id: string;
  draft_fingerprint: string;
  signal_kind: RetrievalSignalKind;
  route: RetrievalDeltaRoute;
  proposed_delta: number;
  proposed_direction: RetrievalDeltaDirection;
  reason: string;
  evidence: EvidenceRef[];
  human_approval_ref: HumanApprovalRef | null;
  dry_run_only: true;
  live_ranking_mutation_allowed: false;
  ranking_input_write_allowed: false;
  next_task_context_write_allowed: false;
  live_flush_allowed: false;
  audit_write_allowed: false;
  persistence_allowed: false;
}

// -----------------------------------------------------------------
// Helper: candidate id
// -----------------------------------------------------------------

/**
 * Stable candidate id derived from
 *   source_task + knowledge_id + signal_kind + route.
 * Identical inputs MUST produce identical ids. Distinct inputs MUST
 * produce distinct ids.
 */
export function buildRetrievalDeltaCandidateId(input: {
  source_task: string;
  knowledge_id: string;
  signal_kind: RetrievalSignalKind;
  route: RetrievalDeltaRoute;
}): string {
  return `retrieval-delta-candidate:${input.source_task}|${input.knowledge_id}|${input.signal_kind}|${input.route}`;
}

// -----------------------------------------------------------------
// Classifier
// -----------------------------------------------------------------

/**
 * Pure classifier. Returns the RetrievalSignalKind that a
 * UsageFeedbackSignal should be projected into. The classifier never
 * reads anything mutable on disk; it only inspects the signal's
 * literal `kind` field.
 */
export function classifyRetrievalDeltaFromUsageSignal(
  signal: UsageFeedbackSignal,
): RetrievalSignalKind {
  if (signal.kind === "helped") return "helped";
  if (signal.kind === "misled") return "misled";
  return "none";
}

// -----------------------------------------------------------------
// Per-event projection
// -----------------------------------------------------------------

export interface ProjectRetrievalDeltaCandidateInput {
  event: {
    source_task: string;
    source_ref: string;
    knowledge_id: string;
    signal_kind: RetrievalSignalKind;
    weight: number;
    evidence: EvidenceRef[];
    human_approval_ref: HumanApprovalRef | null;
  };
  routeDecision: ConsumerRouteDecision;
}

/**
 * Pure projection of one (usage_event, route_decision) pair into a
 * RetrievalRankingDeltaCandidate.
 *
 * Rules:
 * - route=reject_pre_review ⇒ proposed_delta=0, proposed_direction="none".
 * - route=context_dry_run_candidate ⇒ proposed_delta=0, proposed_direction="none"
 *   (the signal may be surfaced to next-task context but is NOT a
 *   ranking candidate).
 * - route=ranking_dry_run_candidate AND signal_kind=helped AND
 *   human_approval_ref present ⇒ proposed_delta = +weight (capped at
 *   MAX_ABSOLUTE_DELTA.boost), proposed_direction="boost".
 * - route=ranking_dry_run_candidate AND signal_kind=misled AND
 *   human_approval_ref present ⇒ proposed_delta = -weight (capped at
 *   -MAX_ABSOLUTE_DELTA.penalize), proposed_direction="penalize".
 * - route=ranking_dry_run_candidate AND signal_kind=none ⇒
 *   proposed_delta=0, proposed_direction="none".
 * - route=ranking_dry_run_candidate AND human_approval_ref missing
 *   ⇒ proposed_delta=0, proposed_direction="none" (defensive: the
 *   LOOP-006A decision helper would already have routed this to
 *   reject_pre_review, but the simulator is responsible for the
 *   final say).
 */
export function projectUsageFeedbackToRetrievalDeltaCandidate(
  input: ProjectRetrievalDeltaCandidateInput,
): RetrievalRankingDeltaCandidate {
  const { event, routeDecision } = input;
  const candidateId = buildRetrievalDeltaCandidateId({
    source_task: event.source_task,
    knowledge_id: event.knowledge_id,
    signal_kind: event.signal_kind,
    route: routeDecision.route,
  });

  if (routeDecision.route === "reject_pre_review") {
    return buildCandidate({
      candidateId,
      sourceTask: event.source_task,
      sourceRef: event.source_ref,
      knowledgeId: event.knowledge_id,
      signalKind: event.signal_kind,
      route: routeDecision.route,
      proposedDelta: 0,
      proposedDirection: "none",
      reason:
        "route=reject_pre_review ⇒ ranking delta stays at zero (pre-review signal must not become a ranking candidate)",
      evidence: event.evidence,
      humanApprovalRef: event.human_approval_ref,
    });
  }

  if (routeDecision.route === "context_dry_run_candidate") {
    return buildCandidate({
      candidateId,
      sourceTask: event.source_task,
      sourceRef: event.source_ref,
      knowledgeId: event.knowledge_id,
      signalKind: event.signal_kind,
      route: routeDecision.route,
      proposedDelta: 0,
      proposedDirection: "none",
      reason:
        "route=context_dry_run_candidate ⇒ context surface only; ranking delta stays at zero in LOOP-007",
      evidence: event.evidence,
      humanApprovalRef: event.human_approval_ref,
    });
  }

  // route === "ranking_dry_run_candidate"
  if (event.human_approval_ref === null) {
    return buildCandidate({
      candidateId,
      sourceTask: event.source_task,
      sourceRef: event.source_ref,
      knowledgeId: event.knowledge_id,
      signalKind: event.signal_kind,
      route: routeDecision.route,
      proposedDelta: 0,
      proposedDirection: "none",
      reason:
        "route=ranking_dry_run_candidate but human_approval_ref=null ⇒ proposed delta stays at zero (no human anchor)",
      evidence: event.evidence,
      humanApprovalRef: event.human_approval_ref,
    });
  }

  if (event.signal_kind === "helped") {
    const weight = Math.max(0, Math.min(event.weight, MAX_ABSOLUTE_DELTA.boost));
    return buildCandidate({
      candidateId,
      sourceTask: event.source_task,
      sourceRef: event.source_ref,
      knowledgeId: event.knowledge_id,
      signalKind: event.signal_kind,
      route: routeDecision.route,
      proposedDelta: weight,
      proposedDirection: "boost",
      reason:
        "helped signal on a ranking_dry_run_candidate with human_approval_ref present ⇒ dry-run boost candidate",
      evidence: event.evidence,
      humanApprovalRef: event.human_approval_ref,
    });
  }

  if (event.signal_kind === "misled") {
    const weight = Math.max(
      -MAX_ABSOLUTE_DELTA.penalize,
      -Math.max(0, Math.min(event.weight, MAX_ABSOLUTE_DELTA.penalize)),
    );
    return buildCandidate({
      candidateId,
      sourceTask: event.source_task,
      sourceRef: event.source_ref,
      knowledgeId: event.knowledge_id,
      signalKind: event.signal_kind,
      route: routeDecision.route,
      proposedDelta: weight,
      proposedDirection: "penalize",
      reason:
        "misled signal on a ranking_dry_run_candidate with human_approval_ref present ⇒ dry-run penalize candidate",
      evidence: event.evidence,
      humanApprovalRef: event.human_approval_ref,
    });
  }

  return buildCandidate({
    candidateId,
    sourceTask: event.source_task,
    sourceRef: event.source_ref,
    knowledgeId: event.knowledge_id,
    signalKind: event.signal_kind,
    route: routeDecision.route,
    proposedDelta: 0,
    proposedDirection: "none",
    reason:
      "ranking_dry_run_candidate but signal_kind=none ⇒ proposed delta stays at zero",
    evidence: event.evidence,
    humanApprovalRef: event.human_approval_ref,
  });
}

function buildCandidate(input: {
  candidateId: string;
  sourceTask: string;
  sourceRef: string;
  knowledgeId: string;
  signalKind: RetrievalSignalKind;
  route: RetrievalDeltaRoute;
  proposedDelta: number;
  proposedDirection: RetrievalDeltaDirection;
  reason: string;
  evidence: EvidenceRef[];
  humanApprovalRef: HumanApprovalRef | null;
}): RetrievalRankingDeltaCandidate {
  return {
    schema_version: "1.0.0",
    candidate_id: input.candidateId,
    source_task: input.sourceTask,
    source_ref: input.sourceRef,
    knowledge_id: input.knowledgeId,
    draft_fingerprint: input.candidateId,
    signal_kind: input.signalKind,
    route: input.route,
    proposed_delta: input.proposedDelta,
    proposed_direction: input.proposedDirection,
    reason: input.reason,
    evidence: input.evidence.map((e) => ({ ...e })),
    human_approval_ref: input.humanApprovalRef,
    dry_run_only: true,
    live_ranking_mutation_allowed: false,
    ranking_input_write_allowed: false,
    next_task_context_write_allowed: false,
    live_flush_allowed: false,
    audit_write_allowed: false,
    persistence_allowed: false,
  };
}

// -----------------------------------------------------------------
// Batch projection from a fixture pair (usage_feedback + route decision)
// -----------------------------------------------------------------

export interface RetrievalSimulationBundle {
  events: Array<{
    schema_version: "1.0.0";
    source_task: string;
    source_ref: string;
    knowledge_id: string;
    signal_kind: UsageFeedbackSignal["kind"];
    weight: number;
    evidence: EvidenceRef[];
    human_approval_ref: HumanApprovalRef | null;
  }>;
  decisions: ConsumerRouteDecision[];
}

export function projectRetrievalSimulationFromFixtures(
  bundle: RetrievalSimulationBundle,
): RetrievalRankingDeltaCandidate[] {
  const out: RetrievalRankingDeltaCandidate[] = [];
  for (const e of bundle.events) {
    const decision =
      bundle.decisions.find(
        (d) =>
          d.source_task === e.source_task &&
          d.source_fingerprint.includes(e.knowledge_id),
      ) ??
      // Fallback: reject_pre_review for any event without a matching
      // consumer route decision. This guarantees the simulator never
      // proposes a delta without a routing verdict.
      fallbackRejectDecision(e);
    out.push(
      projectUsageFeedbackToRetrievalDeltaCandidate({
        event: {
          source_task: e.source_task,
          source_ref: e.source_ref,
          knowledge_id: e.knowledge_id,
          signal_kind: classifyRetrievalDeltaFromUsageSignal({
            knowledge_id: e.knowledge_id,
            kind: e.signal_kind,
            weight: e.weight,
            recorded_at: "",
            source_task_id: e.source_task,
            artifact_ref: e.source_ref,
            evidence: e.evidence,
          }),
          weight: e.weight,
          evidence: e.evidence,
          human_approval_ref: e.human_approval_ref,
        },
        routeDecision: decision,
      }),
    );
  }
  return out;
}

function fallbackRejectDecision(event: {
  source_task: string;
  source_ref: string;
  knowledge_id: string;
}): ConsumerRouteDecision {
  return {
    schema_version: "1.0.0",
    decision_id: `consumer-route-decision:usage_feedback|${event.source_task}|usage-feedback:${event.source_task}|${event.knowledge_id}|reject_pre_review`,
    source_kind: "usage_feedback",
    source_ref: event.source_ref,
    source_task: event.source_task,
    source_fingerprint: `usage-feedback:${event.source_task}|${event.knowledge_id}`,
    route: "reject_pre_review",
    reason: "no matching consumer route decision in fixture bundle",
    human_approval_ref: null,
    approval_gate: { ...POST_TASK_REFLECTION_APPROVAL_GATE },
    quarantine: true,
    dry_run_only: true,
    anchor_verification_allowed: false,
    consumer_routing_mutation_allowed: false,
    next_task_context_write_allowed: false,
    ranking_input_write_allowed: false,
    live_flush_allowed: false,
    audit_write_allowed: false,
    persistence_allowed: false,
  };
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

/**
 * Pure duplicate collapse. Keeps the first occurrence per candidate_id,
 * drops later ones. The future adapter that consumes a retrieval
 * delta candidate bundle MUST collapse before any (forbidden) write.
 */
export function collapseRetrievalDeltaCandidateDuplicates(
  candidates: RetrievalRankingDeltaCandidate[],
): { kept: RetrievalRankingDeltaCandidate[]; dropped: RetrievalRankingDeltaCandidate[] } {
  const seen = new Set<string>();
  const kept: RetrievalRankingDeltaCandidate[] = [];
  const dropped: RetrievalRankingDeltaCandidate[] = [];
  for (const c of candidates) {
    if (seen.has(c.candidate_id)) {
      dropped.push(c);
    } else {
      seen.add(c.candidate_id);
      kept.push(c);
    }
  }
  return { kept, dropped };
}

// -----------------------------------------------------------------
// Runtime guard
// -----------------------------------------------------------------

const FOREVER_FALSE_FLAGS = [
  "live_ranking_mutation_allowed",
  "ranking_input_write_allowed",
  "next_task_context_write_allowed",
  "live_flush_allowed",
  "audit_write_allowed",
  "persistence_allowed",
] as const;

export function assertRetrievalDeltaCandidateNoRuntime(
  c: RetrievalRankingDeltaCandidate,
): void {
  if (c.schema_version !== "1.0.0") {
    throw new Error("retrieval_delta_candidate schema_version is invalid");
  }
  if (c.dry_run_only !== true) {
    throw new Error("retrieval_delta_candidate.dry_run_only must be true");
  }
  for (const flag of FOREVER_FALSE_FLAGS) {
    if (c[flag] !== false) {
      throw new Error(`retrieval_delta_candidate.${flag} must be false`);
    }
  }
  if (c.human_approval_ref !== null && c.human_approval_ref.verified !== false) {
    throw new Error(
      "retrieval_delta_candidate.human_approval_ref.verified must be false in the contract layer",
    );
  }
  if (c.evidence.length < 1) {
    throw new Error("retrieval_delta_candidate.evidence must be non-empty");
  }
  if (c.proposed_delta === 0 && c.proposed_direction !== "none") {
    throw new Error(
      "retrieval_delta_candidate.proposed_delta=0 requires proposed_direction='none'",
    );
  }
  if (c.proposed_direction === "boost" && c.proposed_delta <= 0) {
    throw new Error(
      "retrieval_delta_candidate.proposed_direction=boost requires proposed_delta>0",
    );
  }
  if (c.proposed_direction === "penalize" && c.proposed_delta >= 0) {
    throw new Error(
      "retrieval_delta_candidate.proposed_direction=penalize requires proposed_delta<0",
    );
  }
  if (c.proposed_direction === "none" && c.proposed_delta !== 0) {
    throw new Error(
      "retrieval_delta_candidate.proposed_direction=none requires proposed_delta=0",
    );
  }
  if (
    c.route !== "reject_pre_review" &&
    c.route !== "context_dry_run_candidate" &&
    c.route !== "ranking_dry_run_candidate"
  ) {
    throw new Error("retrieval_delta_candidate.route is invalid");
  }
}

// -----------------------------------------------------------------
// Apply eligibility
// -----------------------------------------------------------------

/**
 * Returns true iff the candidate is eligible to be APPLIED to live
 * retrieval ranking. In LOOP-007 this is a hard contract: the
 * simulator is dry-run only, so this helper MUST always return false.
 * The signature is shaped so that a future live-ranking adapter (when
 * — and only when — the live write is approved by a separate slice)
 * can short-circuit on the same fields.
 */
export function isRetrievalDeltaApplyEligible(
  c: RetrievalRankingDeltaCandidate,
): boolean {
  // LOOP-007 hard guarantee: never apply. The check below is the
  // explicit, exhaustive form — the live flags MUST all be false
  // before any future slice may flip the result.
  if (c.live_ranking_mutation_allowed !== false) return false;
  if (c.ranking_input_write_allowed !== false) return false;
  if (c.next_task_context_write_allowed !== false) return false;
  if (c.live_flush_allowed !== false) return false;
  if (c.audit_write_allowed !== false) return false;
  if (c.persistence_allowed !== false) return false;
  if (c.dry_run_only !== true) return false;
  if (c.human_approval_ref === null) return false;
  if (c.human_approval_ref.verified !== false) return false;
  // In LOOP-007 the simulator is dry-run only. The apply path is
  // unconditionally closed.
  return false;
}
