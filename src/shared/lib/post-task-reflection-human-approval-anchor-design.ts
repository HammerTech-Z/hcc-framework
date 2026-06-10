// Post-task Learning Loop - Slice LOOP-006A
// Pure design descriptor for the Human Approval Anchor + Consumer
// Guard Routing. This slice UN-freezes the LOOP-007 retrieval
// feedback simulation pre-condition and provides a pure consumer-layer
// human approval verifier. It describes which reflection /
// knowledge_ingest_draft / usage_feedback / skill_candidate /
// dead_end / local_llm_wiki draft may, in the future, enter Next
// Task Context or retrieval ranking simulation. The slice never
// writes to Next Task Context, never mutates retrieval ranking, never
// calls knowledgeIngest / knowledgeSearch, never live flushes, never
// writes audit / config / persistence.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live flush, no audit write, no live retrieval ranking mutation,
// no Next Task Context mutation, no skill install, no HCC Auto
// Executor, no hermes config / handoff / audit mutation, no
// docs/roadmap-locked-2026-05-28.md mutation.

import {
  POST_TASK_REFLECTION_APPROVAL_GATE,
  type HumanApprovalConsumerGate,
  type HumanApprovalRef,
  type HumanApprovalRefVerifier,
  type HumanApprovalVerificationResult,
  type PostTaskReflection,
} from "./post-task-reflection-contract";

import type { KnowledgeIngestBridgeDraft } from "./post-task-reflection-knowledge-ingest-bridge-design";

import type { UsageFeedbackEventDesign } from "./post-task-reflection-usage-feedback-design";

import type { SkillCandidateDesignDraft } from "./post-task-reflection-skill-candidate-design";

import type { DeadEndDesignDraft } from "./post-task-reflection-dead-end-design";

import type { LocalLLMWikiDraft } from "./post-task-reflection-local-llm-wiki-design";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN = {
  routing_status: "pure_verifier_available" as const,
  anchor_verification_allowed: true as const,
  consumer_routing_mutation_allowed: false as const,
  next_task_context_write_allowed: false as const,
  ranking_input_write_allowed: false as const,
  knowledge_ingest_call_allowed: false as const,
  knowledge_search_call_allowed: false as const,
  live_flush_allowed: false as const,
  audit_write_allowed: false as const,
  persistence_allowed: false as const,
  human_approval_ref_required: true as const,
  approval_gate_required: true as const,
  verified_must_remain_false_in_contract_layer: true as const,
  schema_version: "1.0.0" as const,
  /**
   * The human approval anchor layer is the ONLY layer allowed to
   * flip `verified` to true in the future. Even then, a future
   * verified-flip MUST be a downstream / consumer-layer action;
   * the contract layer is fixed to `verified=false`.
   */
  anchor_verification_owner: "consumer_or_anchor_layer" as const,
} as const;

// -----------------------------------------------------------------
// Source / route taxonomy
// -----------------------------------------------------------------

export type ConsumerRouteSourceKind =
  | "reflection"
  | "knowledge_ingest_draft"
  | "usage_feedback"
  | "skill_candidate"
  | "dead_end"
  | "local_llm_wiki";

export type ConsumerRoute =
  | "reject_pre_review"
  | "context_dry_run_candidate"
  | "ranking_dry_run_candidate";

export const CONSUMER_ROUTES: readonly ConsumerRoute[] = [
  "reject_pre_review",
  "context_dry_run_candidate",
  "ranking_dry_run_candidate",
] as const;

// -----------------------------------------------------------------
// Decision shape
// -----------------------------------------------------------------

export interface ConsumerRouteDecision {
  schema_version: "1.0.0";
  decision_id: string;
  source_kind: ConsumerRouteSourceKind;
  source_ref: string;
  source_task: string;
  source_fingerprint: string;
  route: ConsumerRoute;
  reason: string;
  human_approval_ref: HumanApprovalRef | null;
  approval_gate: typeof POST_TASK_REFLECTION_APPROVAL_GATE;
  quarantine: boolean;
  dry_run_only: true;
  anchor_verification_allowed: false;
  consumer_routing_mutation_allowed: false;
  next_task_context_write_allowed: false;
  ranking_input_write_allowed: false;
  live_flush_allowed: false;
  audit_write_allowed: false;
  persistence_allowed: false;
}

export interface HumanApprovalAnchorRecord {
  anchor_ref: string;
  human_approval_ref: HumanApprovalRef;
  reflection_task_id: string;
  artifact_ref: string | null;
  approved_at: string;
  expires_at: string | null;
  allowed_gates: readonly HumanApprovalConsumerGate[];
  revoked: boolean;
}

// -----------------------------------------------------------------
// Decision id
// -----------------------------------------------------------------

export function buildConsumerRouteDecisionId(input: {
  source_kind: ConsumerRouteSourceKind;
  source_task: string;
  source_fingerprint: string;
  route: ConsumerRoute;
}): string {
  return `consumer-route-decision:${input.source_kind}|${input.source_task}|${input.source_fingerprint}|${input.route}`;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function gateClosed(): typeof POST_TASK_REFLECTION_APPROVAL_GATE {
  return { ...POST_TASK_REFLECTION_APPROVAL_GATE };
}

function isHumanApproved(
  humanReviewed: boolean,
  approvalRef: HumanApprovalRef | null,
): boolean {
  return humanReviewed === true && approvalRef !== null;
}

function sameHumanApprovalRef(
  left: HumanApprovalRef,
  right: HumanApprovalRef,
): boolean {
  return (
    left.ref === right.ref &&
    left.content_hash === right.content_hash &&
    left.approval_kind === right.approval_kind &&
    left.verified === false &&
    right.verified === false
  );
}

function isIsoInstant(value: string): boolean {
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}

function rejectVerification(reason: string): HumanApprovalVerificationResult {
  return {
    verified: false,
    reason,
    anchor_ref: null,
  };
}

function acceptVerification(
  anchor: HumanApprovalAnchorRecord,
): HumanApprovalVerificationResult {
  return {
    verified: true,
    reason: "human_approval_ref matched active consumer anchor",
    anchor_ref: anchor.anchor_ref,
  };
}

export function verifyHumanApprovalRefAgainstAnchors(
  input: Parameters<HumanApprovalRefVerifier>[0],
  anchors: readonly HumanApprovalAnchorRecord[],
): HumanApprovalVerificationResult {
  if (input.human_approval_ref.verified !== false) {
    return rejectVerification(
      "contract-layer human_approval_ref.verified must remain false",
    );
  }
  if (!isIsoInstant(input.created_at)) {
    return rejectVerification("reflection created_at is not an ISO instant");
  }
  const reflectionCreatedAtMs = Date.parse(input.created_at);
  const match = anchors.find((anchor) =>
    sameHumanApprovalRef(anchor.human_approval_ref, input.human_approval_ref),
  );
  if (!match) {
    return rejectVerification("no matching human approval anchor found");
  }
  if (match.revoked) {
    return rejectVerification("matching human approval anchor is revoked");
  }
  if (match.reflection_task_id !== input.reflection_task_id) {
    return rejectVerification("human approval anchor task id mismatch");
  }
  if (match.artifact_ref !== input.artifact_ref) {
    return rejectVerification("human approval anchor artifact ref mismatch");
  }
  if (!match.allowed_gates.includes(input.gate)) {
    return rejectVerification("human approval anchor does not authorize gate");
  }
  if (!isIsoInstant(match.approved_at)) {
    return rejectVerification("human approval anchor approved_at is invalid");
  }
  if (Date.parse(match.approved_at) > reflectionCreatedAtMs) {
    return rejectVerification("human approval anchor is newer than reflection");
  }
  if (match.expires_at !== null) {
    if (!isIsoInstant(match.expires_at)) {
      return rejectVerification("human approval anchor expires_at is invalid");
    }
    if (Date.parse(match.expires_at) <= reflectionCreatedAtMs) {
      return rejectVerification("human approval anchor is stale");
    }
  }
  return acceptVerification(match);
}

export function buildHumanApprovalRefVerifier(
  anchors: readonly HumanApprovalAnchorRecord[],
): HumanApprovalRefVerifier {
  return (input) => verifyHumanApprovalRefAgainstAnchors(input, anchors);
}

function buildDecision(
  sourceKind: ConsumerRouteSourceKind,
  sourceRef: string,
  sourceTask: string,
  sourceFingerprint: string,
  route: ConsumerRoute,
  reason: string,
  humanApprovalRef: HumanApprovalRef | null,
  quarantine: boolean,
): ConsumerRouteDecision {
  return {
    schema_version: "1.0.0",
    decision_id: buildConsumerRouteDecisionId({
      source_kind: sourceKind,
      source_task: sourceTask,
      source_fingerprint: sourceFingerprint,
      route,
    }),
    source_kind: sourceKind,
    source_ref: sourceRef,
    source_task: sourceTask,
    source_fingerprint: sourceFingerprint,
    route,
    reason,
    human_approval_ref: humanApprovalRef,
    approval_gate: gateClosed(),
    quarantine,
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
// Reflection-level decision
// -----------------------------------------------------------------

export function decideReflectionConsumerRoute(
  reflection: PostTaskReflection,
): ConsumerRouteDecision {
  const prov = reflection.provenance;
  const humanApproved = isHumanApproved(
    prov.human_reviewed,
    prov.human_approval_ref,
  );
  const allDraftsNonQuarantined = reflection.knowledge_ingest_draft.every(
    (d) => d.quarantine === false,
  );

  if (!humanApproved) {
    return buildDecision(
      "reflection",
      reflection.artifact_ref ?? reflection.task_id,
      reflection.task_id,
      reflection.task_id,
      "reject_pre_review",
      "reflection.provenance.human_reviewed=false or human_approval_ref=null",
      null,
      true,
    );
  }

  if (allDraftsNonQuarantined) {
    return buildDecision(
      "reflection",
      reflection.artifact_ref ?? reflection.task_id,
      reflection.task_id,
      reflection.task_id,
      "ranking_dry_run_candidate",
      "reflection is human-approved AND every knowledge_ingest_draft is non-quarantined ⇒ eligible for future ranking dry-run",
      prov.human_approval_ref,
      false,
    );
  }

  return buildDecision(
    "reflection",
    reflection.artifact_ref ?? reflection.task_id,
    reflection.task_id,
    reflection.task_id,
    "context_dry_run_candidate",
    "reflection is human-approved but at least one knowledge_ingest_draft remains quarantined ⇒ context-only dry-run candidate",
    prov.human_approval_ref,
    false,
  );
}

// -----------------------------------------------------------------
// Knowledge ingest draft decision
// -----------------------------------------------------------------

export function decideKnowledgeIngestDraftConsumerRoute(
  draft: KnowledgeIngestBridgeDraft,
): ConsumerRouteDecision {
  if (draft.human_approval_ref === null || draft.quarantine) {
    return buildDecision(
      "knowledge_ingest_draft",
      draft.source_ref,
      draft.source_task,
      draft.fingerprint,
      "reject_pre_review",
      "draft.human_approval_ref=null or draft.quarantine=true",
      null,
      true,
    );
  }
  return buildDecision(
    "knowledge_ingest_draft",
    draft.source_ref,
    draft.source_task,
    draft.fingerprint,
    "context_dry_run_candidate",
    "draft is human-approved and non-quarantined ⇒ context dry-run candidate; ranking must not be promoted in this slice",
    draft.human_approval_ref,
    false,
  );
}

// -----------------------------------------------------------------
// Usage feedback decision
// -----------------------------------------------------------------

export function decideUsageFeedbackConsumerRoute(
  event: UsageFeedbackEventDesign,
): ConsumerRouteDecision {
  if (
    event.human_approval_ref === null ||
    event.eligibility === "pre_review"
  ) {
    return buildDecision(
      "usage_feedback",
      event.artifact_ref ?? event.source_ref,
      event.task_id,
      event.fingerprint,
      "reject_pre_review",
      "event.human_approval_ref=null or event.eligibility=pre_review",
      null,
      true,
    );
  }
  // Only ranking_eligible events may surface to ranking dry-run.
  if (event.eligibility === "ranking_eligible") {
    return buildDecision(
      "usage_feedback",
      event.artifact_ref ?? event.source_ref,
      event.task_id,
      event.fingerprint,
      "ranking_dry_run_candidate",
      "event.eligibility=ranking_eligible AND human_approval_ref present ⇒ future ranking dry-run candidate",
      event.human_approval_ref,
      false,
    );
  }
  return buildDecision(
    "usage_feedback",
    event.artifact_ref ?? event.source_ref,
    event.task_id,
    event.fingerprint,
    "context_dry_run_candidate",
    "event.eligibility=context_eligible AND human_approval_ref present ⇒ context dry-run candidate",
    event.human_approval_ref,
    false,
  );
}

// -----------------------------------------------------------------
// Skill candidate decision
// -----------------------------------------------------------------

export function decideSkillCandidateConsumerRoute(
  skill: SkillCandidateDesignDraft,
): ConsumerRouteDecision {
  if (skill.human_approval_ref === null) {
    return buildDecision(
      "skill_candidate",
      skill.source_ref,
      skill.source_task,
      skill.fingerprint,
      "reject_pre_review",
      "skill_candidate.human_approval_ref=null",
      null,
      true,
    );
  }
  return buildDecision(
    "skill_candidate",
    skill.source_ref,
    skill.source_task,
    skill.fingerprint,
    "context_dry_run_candidate",
    "skill_candidate is human-approved ⇒ context dry-run candidate (install remains forbidden in LOOP-006A)",
    skill.human_approval_ref,
    false,
  );
}

// -----------------------------------------------------------------
// Dead-end decision
// -----------------------------------------------------------------

export function decideDeadEndConsumerRoute(
  deadEnd: DeadEndDesignDraft,
): ConsumerRouteDecision {
  if (deadEnd.human_approval_ref === null) {
    return buildDecision(
      "dead_end",
      deadEnd.source_ref,
      deadEnd.source_task,
      deadEnd.fingerprint,
      "reject_pre_review",
      "dead_end.human_approval_ref=null",
      null,
      true,
    );
  }
  return buildDecision(
    "dead_end",
    deadEnd.source_ref,
    deadEnd.source_task,
    deadEnd.fingerprint,
    "context_dry_run_candidate",
    "dead_end is human-approved ⇒ context dry-run candidate (ranking penalty remains forbidden in LOOP-006A)",
    deadEnd.human_approval_ref,
    false,
  );
}

// -----------------------------------------------------------------
// Local LLM wiki decision
// -----------------------------------------------------------------

export function decideLocalLLMWikiConsumerRoute(
  wiki: LocalLLMWikiDraft,
): ConsumerRouteDecision {
  if (wiki.human_approval_ref === null) {
    return buildDecision(
      "local_llm_wiki",
      wiki.source_ref,
      wiki.source_task,
      wiki.fingerprint,
      "reject_pre_review",
      "local_llm_wiki.human_approval_ref=null",
      null,
      true,
    );
  }
  return buildDecision(
    "local_llm_wiki",
    wiki.source_ref,
    wiki.source_task,
    wiki.fingerprint,
    "context_dry_run_candidate",
    "local_llm_wiki is human-approved ⇒ context dry-run candidate (model activation remains forbidden in LOOP-006A)",
    wiki.human_approval_ref,
    false,
  );
}

// -----------------------------------------------------------------
// Bridge-fixture convenience
// -----------------------------------------------------------------

export interface BridgeFixtureBundle {
  drafts: KnowledgeIngestBridgeDraft[];
}

/**
 * Convenience: project a bridge fixture (the same shape written by
 * `_regenerate-ll006.ts`) into a uniform ConsumerRouteDecision list.
 * No I/O; pure helper.
 */
export function decideConsumerRoutesFromBridgeFixture(
  bundle: BridgeFixtureBundle,
): ConsumerRouteDecision[] {
  return bundle.drafts.map((d) =>
    decideKnowledgeIngestDraftConsumerRoute(d),
  );
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

export function collapseConsumerRouteDecisionDuplicates<
  T extends { decision_id: string },
>(decisions: T[]): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
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

export function assertConsumerRouteDecisionNoRuntime(
  d: ConsumerRouteDecision,
): void {
  if (d.schema_version !== "1.0.0") {
    throw new Error("consumer_route_decision schema_version is invalid");
  }
  if (d.dry_run_only !== true) {
    throw new Error("consumer_route_decision.dry_run_only must be true");
  }
  if (d.approval_gate.status !== "closed") {
    throw new Error("consumer_route_decision.approval_gate.status must be closed");
  }
  if (d.approval_gate.approved !== false) {
    throw new Error("consumer_route_decision.approval_gate.approved must be false");
  }
  for (const flag of [
    "anchor_verification_allowed",
    "consumer_routing_mutation_allowed",
    "next_task_context_write_allowed",
    "ranking_input_write_allowed",
    "live_flush_allowed",
    "audit_write_allowed",
    "persistence_allowed",
  ] as const) {
    if (d[flag] !== false) {
      throw new Error(`consumer_route_decision.${flag} must be false`);
    }
  }
  if (d.human_approval_ref !== null && d.human_approval_ref.verified !== false) {
    throw new Error(
      "consumer_route_decision.human_approval_ref.verified must be false in the contract layer",
    );
  }
  if (!CONSUMER_ROUTES.includes(d.route)) {
    throw new Error("consumer_route_decision.route is invalid");
  }
  if (typeof d.reason !== "string" || d.reason.length === 0) {
    throw new Error("consumer_route_decision.reason is required");
  }
}

// -----------------------------------------------------------------
// Anchor-side matrix (mirrors LOOP-001.1 consumer guards)
// -----------------------------------------------------------------

/**
 * Routing matrix used by tests and by future consumers. Pure
 * documentation of the rules — no I/O, no real routing.
 */
export const CONSUMER_ROUTE_MATRIX: ReadonlyArray<{
  source: ConsumerRouteSourceKind | "reflection_combined";
  human_reviewed: boolean;
  human_approval_ref_present: boolean;
  quarantine: boolean;
  outcome: ConsumerRoute;
}> = [
  // reflection
  {
    source: "reflection",
    human_reviewed: false,
    human_approval_ref_present: false,
    quarantine: true,
    outcome: "reject_pre_review",
  },
  {
    source: "reflection",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: true,
    outcome: "context_dry_run_candidate",
  },
  {
    source: "reflection",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: false,
    outcome: "ranking_dry_run_candidate",
  },
  // knowledge_ingest_draft
  {
    source: "knowledge_ingest_draft",
    human_reviewed: true,
    human_approval_ref_present: false,
    quarantine: true,
    outcome: "reject_pre_review",
  },
  {
    source: "knowledge_ingest_draft",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: false,
    outcome: "context_dry_run_candidate",
  },
  // usage_feedback
  {
    source: "usage_feedback",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: false,
    outcome: "ranking_dry_run_candidate",
  },
  // skill_candidate
  {
    source: "skill_candidate",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: false,
    outcome: "context_dry_run_candidate",
  },
  // dead_end
  {
    source: "dead_end",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: false,
    outcome: "context_dry_run_candidate",
  },
  // local_llm_wiki
  {
    source: "local_llm_wiki",
    human_reviewed: true,
    human_approval_ref_present: true,
    quarantine: false,
    outcome: "context_dry_run_candidate",
  },
];
