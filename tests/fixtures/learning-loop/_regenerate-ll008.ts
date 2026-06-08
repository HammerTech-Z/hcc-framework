// One-off fixture regenerator: project the ll002 / ll006a / ll007
// learning-loop fixtures through the LOOP-008 reflection evaluator
// and write the resulting verdict bundles to disk. Pure I/O, no
// runtime write, no live flush, no audit write, no Next Task
// Context write, no live ranking mutation.
//
// Usage: npx tsx tests/fixtures/learning-loop/_regenerate-ll008.ts

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import {
  REFLECTION_EVALUATOR_DESIGN,
  assertReflectionEvaluatorVerdictNoRuntime,
  collapseReflectionEvaluatorVerdicts,
  evaluateConsumerRouteDecision,
  evaluateKnowledgeIngestDraftBundle,
  evaluatePostTaskReflection,
  evaluateRetrievalDeltaCandidates,
  type ReflectionEvaluatorVerdict,
} from "../../../src/shared/lib/post-task-reflection-evaluator-design";

import { projectHccDryRunToReflection } from "../../../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..", "..", "..");

interface VerdictBundle {
  schema_version: "1.0.0";
  kind: "reflection-evaluator-verdict";
  purpose: string;
  created_at: string;
  verdicts: ReflectionEvaluatorVerdict[];
  dry_run_only: boolean;
  live_flush_allowed: boolean;
  knowledge_ingest_call_allowed: boolean;
  knowledge_search_call_allowed: boolean;
  audit_write_allowed: boolean;
  persistence_allowed: boolean;
  next_task_context_write_allowed: boolean;
  live_ranking_mutation_allowed: boolean;
  config_write_allowed: boolean;
}

function buildBundle(
  purpose: string,
  verdicts: ReflectionEvaluatorVerdict[],
  createdAt: string,
): VerdictBundle {
  for (const v of verdicts) {
    assertReflectionEvaluatorVerdictNoRuntime(v);
  }
  return {
    schema_version: "1.0.0",
    kind: "reflection-evaluator-verdict",
    purpose,
    created_at: createdAt,
    verdicts,
    dry_run_only: REFLECTION_EVALUATOR_DESIGN.evaluator_status === "pure_projection",
    live_flush_allowed: REFLECTION_EVALUATOR_DESIGN.live_flush_allowed,
    knowledge_ingest_call_allowed:
      REFLECTION_EVALUATOR_DESIGN.knowledge_ingest_call_allowed,
    knowledge_search_call_allowed:
      REFLECTION_EVALUATOR_DESIGN.knowledge_search_call_allowed,
    audit_write_allowed: REFLECTION_EVALUATOR_DESIGN.audit_write_allowed,
    persistence_allowed: REFLECTION_EVALUATOR_DESIGN.persistence_allowed,
    next_task_context_write_allowed:
      REFLECTION_EVALUATOR_DESIGN.next_task_context_write_allowed,
    live_ranking_mutation_allowed:
      REFLECTION_EVALUATOR_DESIGN.live_ranking_mutation_allowed,
    config_write_allowed: REFLECTION_EVALUATOR_DESIGN.config_write_allowed,
  };
}

interface BridgeDraft {
  schema_version: "1.0.0";
  draft_id: string;
  fingerprint: string;
  source_kind:
    | "good_pattern"
    | "bad_pattern"
    | "dead_end"
    | "model_feedback"
    | "skill_candidate"
    | "local_llm_wiki"
    | "usage_feedback";
  source_fingerprint: string;
  target_bucket: string;
  draft_kind: string;
  title: string;
  body: string;
  source_task: string;
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
  human_approval_ref:
    | {
        ref: string;
        content_hash: string;
        approval_kind: "manual_review" | "explicit_user_action";
        verified: false;
      }
    | null;
  quarantine: boolean;
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
  draft_kind_ref: string;
  dry_run_only: true;
  runtime_flush_allowed: false;
  knowledge_ingest_call_allowed: false;
  knowledge_search_call_allowed: false;
  persistence_allowed: false;
  audit_write_allowed: false;
  config_write_allowed: false;
  live_ranking_mutation_allowed: false;
  skill_install_allowed: false;
  model_runtime_start_allowed: false;
}

interface BridgeBundle {
  schema_version: "1.0.0";
  kind: "knowledge-ingest-bridge-draft";
  purpose: string;
  created_at: string;
  drafts: BridgeDraft[];
  dry_run_only: boolean;
  runtime_flush_allowed: boolean;
  knowledge_ingest_call_allowed: boolean;
  knowledge_search_call_allowed: boolean;
  persistence_allowed: boolean;
  audit_write_allowed: boolean;
  config_write_allowed: boolean;
  live_ranking_mutation_allowed: boolean;
  skill_install_allowed: boolean;
  model_runtime_start_allowed: boolean;
}

interface ConsumerRouteDecision {
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
}

interface RouteBundle {
  schema_version: "1.0.0";
  kind: "consumer-route-decision";
  purpose: string;
  created_at: string;
  decisions: ConsumerRouteDecision[];
  dry_run_only: boolean;
  anchor_verification_allowed: boolean;
  consumer_routing_mutation_allowed: boolean;
  next_task_context_write_allowed: boolean;
  ranking_input_write_allowed: boolean;
  live_flush_allowed: boolean;
  audit_write_allowed: boolean;
  persistence_allowed: boolean;
}

interface RetrievalSimulationBundle {
  schema_version: "1.0.0";
  kind: "retrieval-feedback-simulation-candidates";
  purpose: string;
  created_at: string;
  candidates: Array<{
    schema_version: "1.0.0";
    candidate_id: string;
    source_task: string;
    source_ref: string;
    knowledge_id: string;
    draft_fingerprint: string;
    signal_kind: "helped" | "misled" | "none";
    route: "reject_pre_review" | "context_dry_run_candidate" | "ranking_dry_run_candidate";
    proposed_delta: number;
    proposed_direction: "boost" | "penalize" | "none";
    reason: string;
    evidence: Array<{
      kind: "artifact" | "log" | "test_output" | "diff" | "command";
      ref: string;
      content_hash: string;
      excerpt?: string;
    }>;
    human_approval_ref:
      | {
          ref: string;
          content_hash: string;
          approval_kind: "manual_review" | "explicit_user_action";
          verified: false;
        }
      | null;
    dry_run_only: true;
    live_ranking_mutation_allowed: false;
    ranking_input_write_allowed: false;
    next_task_context_write_allowed: false;
    live_flush_allowed: false;
    audit_write_allowed: false;
    persistence_allowed: false;
  }>;
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

const sources: Array<{
  reflection: string;
  bridge: string;
  route: string;
  retrieval: string;
  output: string;
  purpose: string;
  createdAt: string;
  expectedBands: Array<"reject" | "quarantine" | "candidate" | "human_reviewed_candidate">;
  expectedAtLeastOneHumanReviewed: boolean;
}> = [
  {
    reflection: "ll002-hcc-pass-dry-run.json",
    bridge: "ll006-knowledge-ingest-pass-draft.json",
    route: "ll006a-consumer-route-pass-rejected.json",
    retrieval: "ll007-retrieval-simulation-pass-rejected.json",
    output: "ll008-evaluator-pass-candidate.json",
    purpose:
      "LOOP-008 PASS evaluator verdicts derived from ll002 PASS reflection + ll006 PASS bridge drafts + ll006a PASS consumer route decisions + ll007 PASS retrieval simulation candidates. agent-submitted ⇒ at least one reject or quarantine verdict, never human_reviewed_candidate, never promotion eligible, every safety flag false.",
    createdAt: "2026-06-07T20:00:00.000Z",
    expectedBands: ["quarantine"],
    expectedAtLeastOneHumanReviewed: false,
  },
  {
    reflection: "ll002-hcc-fail-dry-run.json",
    bridge: "ll006-knowledge-ingest-fail-draft.json",
    route: "ll006a-consumer-route-fail-rejected.json",
    retrieval: "ll007-retrieval-simulation-fail-rejected.json",
    output: "ll008-evaluator-fail-candidate.json",
    purpose:
      "LOOP-008 FAIL evaluator verdicts derived from ll002 FAIL reflection + ll006 FAIL bridge drafts + ll006a FAIL consumer route decisions + ll007 FAIL retrieval simulation candidates. agent-submitted + fail outcome + misled signal ⇒ at least one reject or quarantine verdict, fail-related downgrades recorded, never human_reviewed_candidate, never promotion eligible, every safety flag false.",
    createdAt: "2026-06-07T20:01:00.000Z",
    expectedBands: ["quarantine"],
    expectedAtLeastOneHumanReviewed: false,
  },
  {
    reflection: "ll002-hcc-manual-review-dry-run.json",
    bridge: "ll006-knowledge-ingest-manual-review-draft.json",
    route: "ll006a-consumer-route-manual-review-dry-run.json",
    retrieval: "ll007-retrieval-simulation-manual-review-dry-run.json",
    output: "ll008-evaluator-manual-review-candidate.json",
    purpose:
      "LOOP-008 manual_review evaluator verdicts derived from ll002 manual_review reflection + ll006 manual_review bridge drafts + ll006a manual_review consumer route decisions + ll007 manual_review retrieval simulation candidates. human_approval_ref present + verified=false + non-quarantined ⇒ at least one human_reviewed_candidate band, but promotion eligible MUST stay false. human_approval_ref.verified stays false. every safety flag false. no live flush.",
    createdAt: "2026-06-07T20:02:00.000Z",
    expectedBands: ["human_reviewed_candidate"],
    expectedAtLeastOneHumanReviewed: true,
  },
];

for (const src of sources) {
  const dir = join(ROOT, "tests/fixtures/learning-loop");
  const reflectionJson = JSON.parse(
    readFileSync(join(dir, src.reflection), "utf-8"),
  );
  const reflection = projectHccDryRunToReflection(reflectionJson);
  const bridge = JSON.parse(
    readFileSync(join(dir, src.bridge), "utf-8"),
  ) as BridgeBundle;
  const route = JSON.parse(
    readFileSync(join(dir, src.route), "utf-8"),
  ) as RouteBundle;
  const retrieval = JSON.parse(
    readFileSync(join(dir, src.retrieval), "utf-8"),
  ) as RetrievalSimulationBundle;

  const verdicts: ReflectionEvaluatorVerdict[] = [];
  verdicts.push(evaluatePostTaskReflection({ reflection }));
  verdicts.push(...evaluateKnowledgeIngestDraftBundle({ drafts: bridge.drafts }));
  for (const d of route.decisions) {
    verdicts.push(
      evaluateConsumerRouteDecision(
        d as unknown as Parameters<typeof evaluateConsumerRouteDecision>[0],
      ),
    );
  }
  verdicts.push(...evaluateRetrievalDeltaCandidates(retrieval.candidates));

  const { kept } = collapseReflectionEvaluatorVerdicts(verdicts);
  const bundle = buildBundle(src.purpose, kept, src.createdAt);
  const outPath = join(dir, src.output);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(
    `wrote ${outPath} (${kept.length} verdicts)`,
  );

  // Sanity asserts
  for (const v of kept) {
    if (v.live_flush_allowed !== false) {
      throw new Error(`live_flush_allowed leaked: ${v.verdict_id}`);
    }
    if (v.knowledge_ingest_call_allowed !== false) {
      throw new Error(`knowledge_ingest_call_allowed leaked: ${v.verdict_id}`);
    }
    if (v.audit_write_allowed !== false) {
      throw new Error(`audit_write_allowed leaked: ${v.verdict_id}`);
    }
    if (v.next_task_context_write_allowed !== false) {
      throw new Error(`next_task_context_write_allowed leaked: ${v.verdict_id}`);
    }
    if (v.live_ranking_mutation_allowed !== false) {
      throw new Error(`live_ranking_mutation_allowed leaked: ${v.verdict_id}`);
    }
  }
  const bands = new Set(kept.map((v) => v.trust_band));
  for (const expected of src.expectedBands) {
    if (!bands.has(expected)) {
      throw new Error(
        `expected band ${expected} missing in ${src.output}; saw ${Array.from(bands).join(",")}`,
      );
    }
  }
  if (src.expectedAtLeastOneHumanReviewed) {
    if (!kept.some((v) => v.trust_band === "human_reviewed_candidate")) {
      throw new Error(
        `expected at least one human_reviewed_candidate verdict in ${src.output}`,
      );
    }
  } else {
    if (kept.some((v) => v.trust_band === "human_reviewed_candidate")) {
      throw new Error(
        `unexpected human_reviewed_candidate verdict in ${src.output}`,
      );
    }
  }
}
