// One-off fixture regenerator: project the ll006 knowledge_ingest
// bridge drafts and the ll008 evaluator verdicts through the
// LOOP-009 quarantine/promotion adapter and write the resulting
// decision bundles to disk. Pure I/O, no runtime write, no live
// flush, no audit write, no Next Task Context write, no live
// ranking mutation.
//
// Usage: npx tsx tests/fixtures/learning-loop/_regenerate-ll009.ts

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import {
  QUARANTINE_PROMOTION_ADAPTER_DESIGN,
  assertQuarantinePromotionDecisionNoRuntime,
  collapseQuarantinePromotionDecisions,
  decidePromotionForBundle,
  type QuarantinePromotionDecision,
} from "../../../src/shared/lib/post-task-reflection-quarantine-promotion-design";

import type { KnowledgeIngestBridgeDraft } from "../../../src/shared/lib/post-task-reflection-knowledge-ingest-bridge-design";

import type { ReflectionEvaluatorVerdict } from "../../../src/shared/lib/post-task-reflection-evaluator-design";

const ROOT = join(__dirname, "..", "..", "..");

interface DecisionBundle {
  schema_version: "1.0.0";
  kind: "quarantine-promotion-decision";
  purpose: string;
  created_at: string;
  decisions: QuarantinePromotionDecision[];
  dry_run_only: boolean;
  live_flush_allowed: boolean;
  knowledge_ingest_call_allowed: boolean;
  knowledge_search_call_allowed: boolean;
  audit_write_allowed: boolean;
  persistence_allowed: boolean;
  next_task_context_write_allowed: boolean;
  live_ranking_mutation_allowed: boolean;
  config_write_allowed: boolean;
  approval_anchor_verification_allowed: boolean;
  human_approval_ref_required: boolean;
  evaluator_verdict_required: boolean;
}

function buildBundle(
  purpose: string,
  decisions: QuarantinePromotionDecision[],
  createdAt: string,
): DecisionBundle {
  for (const d of decisions) {
    assertQuarantinePromotionDecisionNoRuntime(d);
  }
  return {
    schema_version: "1.0.0",
    kind: "quarantine-promotion-decision",
    purpose,
    created_at: createdAt,
    decisions,
    dry_run_only: true,
    live_flush_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.live_flush_allowed,
    knowledge_ingest_call_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.knowledge_ingest_call_allowed,
    knowledge_search_call_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.knowledge_search_call_allowed,
    audit_write_allowed: QUARANTINE_PROMOTION_ADAPTER_DESIGN.audit_write_allowed,
    persistence_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.persistence_allowed,
    next_task_context_write_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.next_task_context_write_allowed,
    live_ranking_mutation_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.live_ranking_mutation_allowed,
    config_write_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.config_write_allowed,
    approval_anchor_verification_allowed:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.approval_anchor_verification_allowed,
    human_approval_ref_required:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.human_approval_ref_required,
    evaluator_verdict_required:
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.evaluator_verdict_required,
  };
}

interface BridgeBundle {
  schema_version: "1.0.0";
  kind: "knowledge-ingest-bridge-draft";
  purpose: string;
  created_at: string;
  drafts: KnowledgeIngestBridgeDraft[];
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

const sources: Array<{
  bridge: string;
  verdicts: string;
  output: string;
  purpose: string;
  createdAt: string;
}> = [
  {
    bridge: "ll006-knowledge-ingest-pass-draft.json",
    verdicts: "ll008-evaluator-pass-candidate.json",
    output: "ll009-promotion-pass-rejected.json",
    purpose:
      "LOOP-009 PASS promotion decisions derived from ll006 PASS bridge drafts + ll008 PASS evaluator verdicts. agent-submitted + quarantine=true ⇒ every decision MUST be remain_quarantined (or reject for missing evidence). apply eligible MUST stay false. All live-write / ranking-mutation / next-task-context / ingest / search / flush / audit / persistence flags false.",
    createdAt: "2026-06-07T21:00:00.000Z",
  },
  {
    bridge: "ll006-knowledge-ingest-fail-draft.json",
    verdicts: "ll008-evaluator-fail-candidate.json",
    output: "ll009-promotion-fail-rejected.json",
    purpose:
      "LOOP-009 FAIL promotion decisions derived from ll006 FAIL bridge drafts + ll008 FAIL evaluator verdicts. agent-submitted + quarantine=true ⇒ every decision MUST be remain_quarantined (or reject for missing evidence). apply eligible MUST stay false. All live-write / ranking-mutation / next-task-context / ingest / search / flush / audit / persistence flags false.",
    createdAt: "2026-06-07T21:01:00.000Z",
  },
  {
    bridge: "ll006-knowledge-ingest-manual-review-draft.json",
    verdicts: "ll008-evaluator-manual-review-candidate.json",
    output: "ll009-promotion-manual-review-candidate.json",
    purpose:
      "LOOP-009 manual_review promotion decisions derived from ll006 manual_review bridge drafts + ll008 manual_review evaluator verdicts. human_approval_ref present + verified=false + draft.quarantine=false + evaluator trust_band=human_reviewed_candidate ⇒ promotion_candidate. apply eligible MUST stay false. human_approval_ref.verified stays false. no live flush. no live ranking mutation. no Next Task Context write.",
    createdAt: "2026-06-07T21:02:00.000Z",
  },
];

for (const src of sources) {
  const dir = join(ROOT, "tests/fixtures/learning-loop");
  const bridge = JSON.parse(
    readFileSync(join(dir, src.bridge), "utf-8"),
  ) as BridgeBundle;
  const verdict = JSON.parse(
    readFileSync(join(dir, src.verdicts), "utf-8"),
  ) as VerdictBundle;
  const raw = decidePromotionForBundle({
    drafts: bridge.drafts,
    verdicts: verdict.verdicts,
  });
  const { kept } = collapseQuarantinePromotionDecisions(raw);
  const bundle = buildBundle(src.purpose, kept, src.createdAt);
  const outPath = join(dir, src.output);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(
    `wrote ${outPath} (${kept.length} decisions; states=${JSON.stringify(
      Array.from(new Set(kept.map((d) => d.proposed_state))),
    )})`,
  );
  for (const d of kept) {
    if (d.live_flush_allowed !== false) {
      throw new Error(`live_flush_allowed leaked: ${d.decision_id}`);
    }
    if (d.knowledge_ingest_call_allowed !== false) {
      throw new Error(
        `knowledge_ingest_call_allowed leaked: ${d.decision_id}`,
      );
    }
    if (d.audit_write_allowed !== false) {
      throw new Error(`audit_write_allowed leaked: ${d.decision_id}`);
    }
    if (d.next_task_context_write_allowed !== false) {
      throw new Error(
        `next_task_context_write_allowed leaked: ${d.decision_id}`,
      );
    }
    if (d.live_ranking_mutation_allowed !== false) {
      throw new Error(
        `live_ranking_mutation_allowed leaked: ${d.decision_id}`,
      );
    }
  }
}
