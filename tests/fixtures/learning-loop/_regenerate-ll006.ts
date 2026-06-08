// One-off fixture regenerator: run the bridge projection over the
// LOOP-002 dry-run fixtures and write the bridge drafts to disk as
// LOOP-006 fixtures. Pure I/O, no runtime, no ingest.
//
// Usage: npx tsx tests/fixtures/learning-loop/_regenerate-ll006.ts

import { writeFileSync } from "fs";
import { join } from "path";

import {
  assertKnowledgeIngestBridgeDraftNoRuntime,
  projectReflectionToKnowledgeIngestDrafts,
  type KnowledgeIngestBridgeDraft,
} from "../../../src/shared/lib/post-task-reflection-knowledge-ingest-bridge-design";
import { projectHccDryRunToReflection } from "../../../src/shared/lib/post-task-reflection-hcc-fixture";
import { readFileSync } from "fs";

const ROOT = join(__dirname, "..", "..", "..");

interface Bundle {
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

function buildBundle(
  purpose: string,
  drafts: KnowledgeIngestBridgeDraft[],
): Bundle {
  return {
    drafts,
    dry_run_only: true,
    runtime_flush_allowed: false,
    knowledge_ingest_call_allowed: false,
    knowledge_search_call_allowed: false,
    persistence_allowed: false,
    audit_write_allowed: false,
    config_write_allowed: false,
    live_ranking_mutation_allowed: false,
    skill_install_allowed: false,
    model_runtime_start_allowed: false,
  };
}

const sources: Array<{
  dryRun: string;
  output: string;
  purpose: string;
  createdAt: string;
}> = [
  {
    dryRun: "ll002-hcc-pass-dry-run.json",
    output: "ll006-knowledge-ingest-pass-draft.json",
    purpose:
      "LOOP-006 PASS bridge drafts derived from ll002-hcc-pass-dry-run.json. design-only / draft-only. All drafts quarantine=true (agent-submitted). All runtime / ingest / search / persistence / audit / config / ranking / skill-install / model-runtime flags false. Includes pattern (good_pattern) + skill_candidate + model_wiki (model_feedback + local_llm_wiki) + usage_feedback drafts.",
    createdAt: "2026-06-07T17:00:00.000Z",
  },
  {
    dryRun: "ll002-hcc-fail-dry-run.json",
    output: "ll006-knowledge-ingest-fail-draft.json",
    purpose:
      "LOOP-006 FAIL bridge drafts derived from ll002-hcc-fail-dry-run.json. design-only / draft-only. All drafts quarantine=true. Includes anti_pattern (bad_pattern) + dead_end + model_wiki (model_feedback + local_llm_wiki) + usage_feedback drafts.",
    createdAt: "2026-06-07T17:01:00.000Z",
  },
  {
    dryRun: "ll002-hcc-manual-review-dry-run.json",
    output: "ll006-knowledge-ingest-manual-review-draft.json",
    purpose:
      "LOOP-006 manual_review bridge drafts derived from ll002-hcc-manual-review-dry-run.json. design-only / draft-only. Drafts derived from a human-reviewed source carry human_approval_ref (verified=false) and may flip quarantine=false. The ApprovalGate stays closed; runtime_flush_allowed stays false. No live write, no live ingest, no live search, no audit write, no live ranking mutation, no skill install, no model runtime.",
    createdAt: "2026-06-07T17:02:00.000Z",
  },
];

for (const src of sources) {
  const dryRunPath = join(ROOT, "tests/fixtures/learning-loop", src.dryRun);
  const outPath = join(ROOT, "tests/fixtures/learning-loop", src.output);
  const reflection = projectHccDryRunToReflection(
    JSON.parse(readFileSync(dryRunPath, "utf-8")),
  );
  const drafts = projectReflectionToKnowledgeIngestDrafts({ reflection });
  for (const d of drafts) {
    assertKnowledgeIngestBridgeDraftNoRuntime(d);
  }
  const bundle = {
    schema_version: "1.0.0",
    kind: "knowledge-ingest-bridge-draft",
    purpose: src.purpose,
    created_at: src.createdAt,
    ...buildBundle(src.purpose, drafts),
  };
  writeFileSync(outPath, JSON.stringify(bundle, null, 2) + "\n");
  // eslint-disable-next-line no-console
  console.log(`wrote ${outPath} (${drafts.length} drafts)`);
}
