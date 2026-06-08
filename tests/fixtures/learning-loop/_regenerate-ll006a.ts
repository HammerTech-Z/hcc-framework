// One-off fixture regenerator: project LOOP-006 bridge fixtures
// through the LOOP-006A consumer routing helper and write the
// decision bundles to disk. Pure I/O, no runtime.
//
// Usage: npx tsx tests/fixtures/learning-loop/_regenerate-ll006a.ts

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { decideConsumerRoutesFromBridgeFixture, type ConsumerRouteDecision, } from "../../../src/shared/lib/post-task-reflection-human-approval-anchor-design";
import { assertConsumerRouteDecisionNoRuntime } from "../../../src/shared/lib/post-task-reflection-human-approval-anchor-design";

const ROOT = join(__dirname, "..", "..", "..");

interface DecisionBundle {
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

function buildBundle(
  purpose: string,
  decisions: ConsumerRouteDecision[],
  createdAt: string,
): DecisionBundle {
  for (const d of decisions) {
    assertConsumerRouteDecisionNoRuntime(d);
  }
  return {
    schema_version: "1.0.0",
    kind: "consumer-route-decision",
    purpose,
    created_at: createdAt,
    decisions,
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

const sources: Array<{
  bridge: string;
  output: string;
  purpose: string;
  createdAt: string;
}> = [
  {
    bridge: "ll006-knowledge-ingest-pass-draft.json",
    output: "ll006a-consumer-route-pass-rejected.json",
    purpose:
      "LOOP-006A PASS consumer route decisions derived from ll006 PASS bridge bundle. agent-submitted + quarantine=true ⇒ every decision MUST route to reject_pre_review. All runtime / routing / context-write / ranking-write / flush / audit / persistence flags false.",
    createdAt: "2026-06-07T18:00:00.000Z",
  },
  {
    bridge: "ll006-knowledge-ingest-fail-draft.json",
    output: "ll006a-consumer-route-fail-rejected.json",
    purpose:
      "LOOP-006A FAIL consumer route decisions derived from ll006 FAIL bridge bundle. agent-submitted + quarantine=true ⇒ every decision MUST route to reject_pre_review. All runtime / routing / context-write / ranking-write / flush / audit / persistence flags false.",
    createdAt: "2026-06-07T18:01:00.000Z",
  },
  {
    bridge: "ll006-knowledge-ingest-manual-review-draft.json",
    output: "ll006a-consumer-route-manual-review-dry-run.json",
    purpose:
      "LOOP-006A manual_review consumer route decisions derived from ll006 manual_review bridge bundle. human_approval_ref present + verified=false + quarantine=false ⇒ context_dry_run_candidate. ApprovalGate stays closed. All runtime flags false. ranking mutation remains forbidden.",
    createdAt: "2026-06-07T18:02:00.000Z",
  },
];

for (const src of sources) {
  const bridgePath = join(ROOT, "tests/fixtures/learning-loop", src.bridge);
  const outPath = join(ROOT, "tests/fixtures/learning-loop", src.output);
  const bridge = JSON.parse(readFileSync(bridgePath, "utf-8")) as {
    drafts: Parameters<typeof decideConsumerRoutesFromBridgeFixture>[0]["drafts"];
  };
  const decisions = decideConsumerRoutesFromBridgeFixture({
    drafts: bridge.drafts,
  });
  const bundle = buildBundle(src.purpose, decisions, src.createdAt);
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(
    `wrote ${outPath} (${decisions.length} decisions, ${new Set(
      decisions.map((d) => d.route),
    ).size} unique routes)`,
  );
}
