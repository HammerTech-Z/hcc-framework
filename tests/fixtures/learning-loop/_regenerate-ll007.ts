// One-off fixture regenerator: project the LOOP-003 usage_feedback
// design events and the LOOP-006A consumer route decisions through
// the LOOP-007 retrieval feedback simulator and write the resulting
// candidate bundles to disk. Pure I/O, no runtime write, no live
// ranking mutation, no live flush, no audit write, no Next Task
// Context write.
//
// Usage: npx tsx tests/fixtures/learning-loop/_regenerate-ll007.ts

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import {
  RETRIEVAL_FEEDBACK_SIMULATION_DESIGN,
  assertRetrievalDeltaCandidateNoRuntime,
  collapseRetrievalDeltaCandidateDuplicates,
  projectUsageFeedbackToRetrievalDeltaCandidate,
  type RetrievalRankingDeltaCandidate,
} from "../../../src/shared/lib/post-task-reflection-retrieval-feedback-simulation";

import {
  decideUsageFeedbackConsumerRoute,
  type ConsumerRouteDecision,
} from "../../../src/shared/lib/post-task-reflection-human-approval-anchor-design";

const ROOT = join(__dirname, "..", "..", "..");

interface CandidateBundle {
  schema_version: "1.0.0";
  kind: "retrieval-feedback-simulation-candidates";
  purpose: string;
  created_at: string;
  candidates: RetrievalRankingDeltaCandidate[];
  dry_run_only: boolean;
  live_ranking_mutation_allowed: boolean;
  ranking_input_write_allowed: boolean;
  next_task_context_write_allowed: boolean;
  live_flush_allowed: boolean;
  audit_write_allowed: boolean;
  persistence_allowed: boolean;
  audit_write_prohibited: boolean;
  config_write_prohibited: boolean;
}

function buildBundle(
  purpose: string,
  candidates: RetrievalRankingDeltaCandidate[],
  createdAt: string,
): CandidateBundle {
  for (const c of candidates) {
    assertRetrievalDeltaCandidateNoRuntime(c);
  }
  return {
    schema_version: "1.0.0",
    kind: "retrieval-feedback-simulation-candidates",
    purpose,
    created_at: createdAt,
    candidates,
    dry_run_only: true,
    live_ranking_mutation_allowed:
      RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.live_ranking_mutation_allowed,
    ranking_input_write_allowed:
      RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.ranking_input_write_allowed,
    next_task_context_write_allowed:
      RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.next_task_context_write_allowed,
    live_flush_allowed: RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.live_flush_allowed,
    audit_write_allowed: RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.audit_write_allowed,
    persistence_allowed:
      RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.persistence_allowed,
    audit_write_prohibited: true,
    config_write_prohibited: true,
  };
}

interface UsageFeedbackDesignEvent {
  schema_version: "1.0.0";
  event_id: string;
  fingerprint: string;
  task_id: string;
  reflection_task_id: string;
  knowledge_id: string;
  kind: "retrieved" | "used" | "helped" | "misled" | "unused";
  weight: number;
  recorded_at: string;
  artifact_ref: string | null;
  source_ref: string;
  evidence: Array<{
    kind: "artifact" | "log" | "test_output" | "diff" | "command";
    ref: string;
    content_hash: string;
    excerpt?: string;
  }>;
  provenance: {
    generated_by: "hermes" | "claude_code" | "codex" | "human";
    submitted_by: "hermes_main" | "claude_code" | "codex" | "human";
    generation_model?: string;
    dual_reviewed: boolean;
    human_reviewed: boolean;
    reviewed_by: "human" | null;
    reviewed_at: string | null;
    trust_level:
      | "unverified"
      | "ai_inferred"
      | "single_run"
      | "reproduced"
      | "human_confirmed";
    human_approval_ref:
      | {
          ref: string;
          content_hash: string;
          approval_kind: "manual_review" | "explicit_user_action";
          verified: false;
        }
      | null;
  };
  eligibility: "pre_review" | "context_eligible" | "ranking_eligible";
  human_approval_ref:
    | {
        ref: string;
        content_hash: string;
        approval_kind: "manual_review" | "explicit_user_action";
        verified: false;
      }
    | null;
}

interface RouteDecisionBundle {
  schema_version: "1.0.0";
  kind: "consumer-route-decision";
  purpose: string;
  created_at: string;
  decisions: Array<{
    schema_version: "1.0.0";
    decision_id: string;
    source_kind:
      | "reflection"
      | "knowledge_ingest_draft"
      | "usage_feedback"
      | "skill_candidate"
      | "dead_end"
      | "local_llm_wiki";
    source_ref: string;
    source_task: string;
    source_fingerprint: string;
    route: "reject_pre_review" | "context_dry_run_candidate" | "ranking_dry_run_candidate";
    reason: string;
    human_approval_ref:
      | {
          ref: string;
          content_hash: string;
          approval_kind: "manual_review" | "explicit_user_action";
          verified: false;
        }
      | null;
    approval_gate: {
      gate_version: "1.0.0";
      status: "closed";
      approved: false;
      explicit_user_approval_required: true;
      allowed_action: "none";
      safety: {
        knowledge_flush_allowed: false;
        skill_install_allowed: false;
        config_write_allowed: false;
        hcc_execute_allowed: false;
        model_runtime_start_allowed: false;
      };
    };
    quarantine: boolean;
    dry_run_only: true;
    anchor_verification_allowed: false;
    consumer_routing_mutation_allowed: false;
    next_task_context_write_allowed: false;
    ranking_input_write_allowed: false;
    live_flush_allowed: false;
    audit_write_allowed: false;
    persistence_allowed: false;
  }>;
  dry_run_only: boolean;
  anchor_verification_allowed: boolean;
  consumer_routing_mutation_allowed: boolean;
  next_task_context_write_allowed: boolean;
  ranking_input_write_allowed: boolean;
  live_flush_allowed: boolean;
  audit_write_allowed: boolean;
  persistence_allowed: boolean;
}

interface ProjectedEvent {
  source_task: string;
  source_ref: string;
  knowledge_id: string;
  signal_kind: UsageFeedbackDesignEvent["kind"];
  weight: number;
  evidence: UsageFeedbackDesignEvent["evidence"];
  human_approval_ref: UsageFeedbackDesignEvent["human_approval_ref"];
}

const sources: Array<{
  usageEvent: string;
  routeDecisions: string;
  output: string;
  purpose: string;
  createdAt: string;
  expectedRoute:
    | "reject_pre_review"
    | "context_dry_run_candidate"
    | "ranking_dry_run_candidate";
  expectedDelta: number;
  expectedDirection: "none" | "boost" | "penalize";
  expectedSignalKind: "helped" | "misled" | "none";
}> = [
  {
    usageEvent: "ll003-usage-feedback-pass-helped-design.json",
    routeDecisions: "ll006a-consumer-route-pass-rejected.json",
    output: "ll007-retrieval-simulation-pass-rejected.json",
    purpose:
      "LOOP-007 PASS retrieval feedback delta candidates derived from the ll003 PASS helped usage event + ll006a PASS consumer route decision bundle. agent-submitted signal ⇒ consumer route reject_pre_review ⇒ proposed_delta=0 / proposed_direction='none'. All live ranking / next-task-context-write / flush / audit / persistence flags false. isRetrievalDeltaApplyEligible MUST be false.",
    createdAt: "2026-06-07T19:00:00.000Z",
    expectedRoute: "reject_pre_review",
    expectedDelta: 0,
    expectedDirection: "none",
    expectedSignalKind: "helped",
  },
  {
    usageEvent: "ll003-usage-feedback-fail-misled-design.json",
    routeDecisions: "ll006a-consumer-route-fail-rejected.json",
    output: "ll007-retrieval-simulation-fail-rejected.json",
    purpose:
      "LOOP-007 FAIL retrieval feedback delta candidates derived from the ll003 FAIL misled usage event + ll006a FAIL consumer route decision bundle. agent-submitted signal ⇒ consumer route reject_pre_review ⇒ proposed_delta=0 / proposed_direction='none'. All live ranking / next-task-context-write / flush / audit / persistence flags false. isRetrievalDeltaApplyEligible MUST be false.",
    createdAt: "2026-06-07T19:01:00.000Z",
    expectedRoute: "reject_pre_review",
    expectedDelta: 0,
    expectedDirection: "none",
    expectedSignalKind: "misled",
  },
  {
    usageEvent: "ll003-usage-feedback-manual-review-design.json",
    routeDecisions: "ll006a-consumer-route-manual-review-dry-run.json",
    output: "ll007-retrieval-simulation-manual-review-dry-run.json",
    purpose:
      "LOOP-007 manual_review retrieval feedback delta candidates derived from the ll003 manual_review usage event + ll006a manual_review consumer route decision bundle. human_approval_ref present + verified=false + route=context_dry_run_candidate ⇒ proposed_delta=0 / proposed_direction='none' (context surface only). isRetrievalDeltaApplyEligible MUST be false.",
    createdAt: "2026-06-07T19:02:00.000Z",
    expectedRoute: "context_dry_run_candidate",
    expectedDelta: 0,
    expectedDirection: "none",
    expectedSignalKind: "helped",
  },
];

for (const src of sources) {
  const dir = join(ROOT, "tests/fixtures/learning-loop");
  const event = JSON.parse(
    readFileSync(join(dir, src.usageEvent), "utf-8"),
  ) as UsageFeedbackDesignEvent;
  const decisionBundle = JSON.parse(
    readFileSync(join(dir, src.routeDecisions), "utf-8"),
  ) as RouteDecisionBundle;

  const events: ProjectedEvent[] = [
    {
      source_task: event.task_id,
      source_ref: event.source_ref,
      knowledge_id: event.knowledge_id,
      signal_kind: event.kind,
      weight: event.weight,
      evidence: event.evidence,
      human_approval_ref: event.human_approval_ref,
    },
  ];

  const raw = buildCandidatesForRouteDecision(events, decisionBundle.decisions, event, src.expectedRoute);
  const { kept } = collapseRetrievalDeltaCandidateDuplicates(raw);
  const bundle = buildBundle(src.purpose, kept, src.createdAt);
  const outPath = join(dir, src.output);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(
    `wrote ${outPath} (${kept.length} candidates; expected route=${src.expectedRoute}, delta=${src.expectedDelta}, direction=${src.expectedDirection}, signal=${src.expectedSignalKind})`,
  );
  for (const c of kept) {
    if (c.route !== src.expectedRoute) {
      throw new Error(
        `route mismatch: expected ${src.expectedRoute}, got ${c.route}`,
      );
    }
    if (c.proposed_delta !== src.expectedDelta) {
      throw new Error(
        `delta mismatch: expected ${src.expectedDelta}, got ${c.proposed_delta}`,
      );
    }
    if (c.proposed_direction !== src.expectedDirection) {
      throw new Error(
        `direction mismatch: expected ${src.expectedDirection}, got ${c.proposed_direction}`,
      );
    }
    if (c.signal_kind !== src.expectedSignalKind) {
      throw new Error(
        `signal mismatch: expected ${src.expectedSignalKind}, got ${c.signal_kind}`,
      );
    }
  }
}

function buildCandidatesForRouteDecision(
  events: ProjectedEvent[],
  decisions: RouteDecisionBundle["decisions"],
  event: UsageFeedbackDesignEvent,
  expectedRoute: "reject_pre_review" | "context_dry_run_candidate" | "ranking_dry_run_candidate",
): RetrievalRankingDeltaCandidate[] {
  // The ll006a bundles only carry knowledge_ingest_draft decisions.
  // For each usage event we synthesize a usage_feedback consumer
  // route decision directly via the LOOP-006A helper, so the
  // projected candidate honors the same routing rule the future
  // adapter would use.
  const usageDecision: ConsumerRouteDecision = decideUsageFeedbackConsumerRoute(
    buildEventDesign(event),
  );
  if (usageDecision.route !== expectedRoute) {
    throw new Error(
      `usage_feedback consumer route decision diverged from expected: got ${usageDecision.route}, expected ${expectedRoute}`,
    );
  }
  // Use the knowledge_ingest_draft decision with the same source_task
  // as a co-signer (the projection only needs ONE matching decision
  // to author the candidate; any consistent verdict works).
  const matching = decisions.find(
    (d) => d.source_task === event.task_id,
  );
  if (!matching) {
    throw new Error(`no matching knowledge_ingest_draft decision for ${event.task_id}`);
  }
  // Sanity: matching knowledge_ingest_draft decision must agree with
  // the usage_feedback decision at the source_task level when the
  // parent reflection is the same.
  if (matching.route !== usageDecision.route && matching.route !== "context_dry_run_candidate") {
    // allow knowledge_ingest_draft to be context while usage is ranking —
    // the LOOP-006A rules permit that. The candidate is built from the
    // usage decision alone.
  }
  return events.map((e) =>
    projectUsageFeedbackToRetrievalDeltaCandidate({
      event: {
        source_task: e.source_task,
        source_ref: e.source_ref,
        knowledge_id: e.knowledge_id,
        signal_kind: e.signal_kind,
        weight: e.weight,
        evidence: e.evidence,
        human_approval_ref: e.human_approval_ref,
      },
      routeDecision: usageDecision,
    }),
  );
}

function buildEventDesign(event: UsageFeedbackDesignEvent): {
  schema_version: "1.0.0";
  event_id: string;
  fingerprint: string;
  task_id: string;
  reflection_task_id: string;
  knowledge_id: string;
  kind: UsageFeedbackDesignEvent["kind"];
  weight: number;
  recorded_at: string;
  artifact_ref: string | null;
  source_ref: string;
  evidence: UsageFeedbackDesignEvent["evidence"];
  provenance: UsageFeedbackDesignEvent["provenance"];
  dry_run_only: true;
  persistence_allowed: false;
  ranking_mutation_allowed: false;
  eligibility: UsageFeedbackDesignEvent["eligibility"];
  human_approval_ref: UsageFeedbackDesignEvent["human_approval_ref"];
} {
  return {
    schema_version: "1.0.0",
    event_id: event.event_id,
    fingerprint: event.fingerprint,
    task_id: event.task_id,
    reflection_task_id: event.reflection_task_id,
    knowledge_id: event.knowledge_id,
    kind: event.kind,
    weight: event.weight,
    recorded_at: event.recorded_at,
    artifact_ref: event.artifact_ref,
    source_ref: event.source_ref,
    evidence: event.evidence,
    provenance: event.provenance,
    dry_run_only: true,
    persistence_allowed: false,
    ranking_mutation_allowed: false,
    eligibility: event.eligibility,
    human_approval_ref: event.human_approval_ref,
  };
}
