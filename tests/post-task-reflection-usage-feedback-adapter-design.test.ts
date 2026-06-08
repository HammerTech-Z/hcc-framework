// Post-task Learning Loop - Slice LOOP-003
// Usage Feedback Persistent Adapter — design-only tests.
//
// The future persistent adapter is not implemented here. These tests
// only validate the design descriptor, the event-shape projection,
// the idempotency fingerprint, and the safety gates.
//
// Hard boundary: no runtime write, no live retrieval ranking mutation,
// no knowledgeIngest / knowledgeSearch, no skill install, no HCC Auto
// Executor, no IPC / gateway / subprocess, no ~/.hermes/* mutation.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertPostTaskReflectionNoRuntime,
  type PostTaskReflection,
  type UsageFeedbackSignal,
} from "../src/shared/lib/post-task-reflection-contract";

import {
  USAGE_FEEDBACK_ADAPTER_DESIGN,
  buildUsageFeedbackFingerprint,
  collapseUsageFeedbackDuplicates,
  isNonMutatingContextEligible,
  projectUsageFeedbackEvent,
  type UsageFeedbackEventDesign,
} from "../src/shared/lib/post-task-reflection-usage-feedback-design";

import { projectHccDryRunToReflection } from "../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(
    ROOT,
    "src/shared/lib/post-task-reflection-usage-feedback-design.ts",
  ),
  "utf-8",
);

const FORBIDDEN_RUNTIME_PATTERNS = [
  "knowledgeIngest(",
  "window.hermesAPI",
  "ipcRenderer",
  "ipcMain",
  "fetch(",
  "writeFile",
  "appendFile",
  "setModelConfig(",
  "setEnv(",
  "startGateway(",
  "runPlaybook(",
  "triggerCronJob(",
  "~/.hermes",
  "handoff/packs",
  ".hermes/audit",
];

function loadFixture(name: string): UsageFeedbackEventDesign {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as UsageFeedbackEventDesign;
}

function loadDryRun(name: string): PostTaskReflection {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  );
  return projectHccDryRunToReflection(json);
}

describe("Post-task Learning Loop LOOP-003 usage feedback adapter design", () => {
  it("design descriptor says design_only and forbids persistence / ranking mutation", () => {
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.adapter_status).toBe("design_only");
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.persistence_allowed).toBe(false);
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.ranking_mutation_allowed).toBe(
      false,
    );
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.append_only_required).toBe(true);
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.idempotency_required).toBe(true);
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.source_ref_required).toBe(true);
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.evidence_required).toBe(true);
    expect(
      USAGE_FEEDBACK_ADAPTER_DESIGN.human_approval_ref_required_for_context_or_ranking,
    ).toBe(true);
    expect(USAGE_FEEDBACK_ADAPTER_DESIGN.consumer_guard_required).toBe(true);
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("buildUsageFeedbackFingerprint is stable for identical inputs and distinct for any change", () => {
    const base = {
      task_id: "t-1",
      knowledge_id: "k-1",
      kind: "helped" as const,
      artifact_ref: "hcc://a/1",
    };
    const fp1 = buildUsageFeedbackFingerprint(base);
    const fp2 = buildUsageFeedbackFingerprint(base);
    expect(fp1).toBe(fp2);
    expect(buildUsageFeedbackFingerprint({ ...base, kind: "misled" })).not.toBe(
      fp1,
    );
    expect(buildUsageFeedbackFingerprint({ ...base, task_id: "t-2" })).not.toBe(
      fp1,
    );
    expect(
      buildUsageFeedbackFingerprint({ ...base, knowledge_id: "k-2" }),
    ).not.toBe(fp1);
    expect(
      buildUsageFeedbackFingerprint({ ...base, artifact_ref: "hcc://a/2" }),
    ).not.toBe(fp1);
  });

  it("collapseUsageFeedbackDuplicates keeps the first occurrence and drops the rest", () => {
    const fp = buildUsageFeedbackFingerprint({
      task_id: "t-1",
      knowledge_id: "k-1",
      kind: "helped",
      artifact_ref: "hcc://a/1",
    });
    const events: UsageFeedbackEventDesign[] = [
      { ...loadFixture("ll003-usage-feedback-pass-helped-design.json"), fingerprint: fp },
      { ...loadFixture("ll003-usage-feedback-pass-helped-design.json"), fingerprint: fp },
      { ...loadFixture("ll003-usage-feedback-fail-misled-design.json"), fingerprint: fp },
    ];
    const { kept, dropped } = collapseUsageFeedbackDuplicates(events);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
    expect(kept[0]!.fingerprint).toBe(fp);
  });

  it("PASS helped event: dry_run_only, persistence/ranking disabled, pre_review, evidence present", () => {
    const fx = loadFixture("ll003-usage-feedback-pass-helped-design.json");
    expect(fx.dry_run_only).toBe(true);
    expect(fx.persistence_allowed).toBe(false);
    expect(fx.ranking_mutation_allowed).toBe(false);
    expect(fx.eligibility).toBe("pre_review");
    expect(fx.human_approval_ref).toBeNull();
    expect(fx.evidence.length).toBeGreaterThan(0);
    expect(fx.source_ref.length).toBeGreaterThan(0);
  });

  it("FAIL misled event: dry_run_only, persistence/ranking disabled, pre_review, evidence present", () => {
    const fx = loadFixture("ll003-usage-feedback-fail-misled-design.json");
    expect(fx.dry_run_only).toBe(true);
    expect(fx.persistence_allowed).toBe(false);
    expect(fx.ranking_mutation_allowed).toBe(false);
    expect(fx.eligibility).toBe("pre_review");
    expect(fx.human_approval_ref).toBeNull();
    expect(fx.evidence.length).toBeGreaterThan(0);
    expect(fx.source_ref.length).toBeGreaterThan(0);
  });

  it("manual_review event: dry_run_only, persistence/ranking disabled, context_eligible, human_approval_ref.verified=false", () => {
    const fx = loadFixture("ll003-usage-feedback-manual-review-design.json");
    expect(fx.dry_run_only).toBe(true);
    expect(fx.persistence_allowed).toBe(false);
    expect(fx.ranking_mutation_allowed).toBe(false);
    expect(fx.eligibility).toBe("context_eligible");
    expect(fx.human_approval_ref).not.toBeNull();
    expect(fx.human_approval_ref!.verified).toBe(false);
    expect(fx.evidence.length).toBeGreaterThan(0);
  });

  it("projectUsageFeedbackEvent: PASS reflection signal -> pre_review (agent-submitted)", () => {
    const reflection = loadDryRun("ll002-hcc-pass-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const sig = reflection.usage_feedback_signals[0]! as UsageFeedbackSignal;
    const event = projectUsageFeedbackEvent({
      signal: sig,
      reflection: {
        task_id: reflection.task_id,
        provenance: reflection.provenance,
        knowledge_ingest_draft: reflection.knowledge_ingest_draft,
      },
    });
    expect(event.dry_run_only).toBe(true);
    expect(event.persistence_allowed).toBe(false);
    expect(event.ranking_mutation_allowed).toBe(false);
    expect(event.eligibility).toBe("pre_review");
    expect(event.human_approval_ref).toBeNull();
    expect(isNonMutatingContextEligible(event)).toBe(false);
  });

  it("projectUsageFeedbackEvent: FAIL reflection signal -> pre_review (agent-submitted)", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const sig = reflection.usage_feedback_signals[0]! as UsageFeedbackSignal;
    const event = projectUsageFeedbackEvent({
      signal: sig,
      reflection: {
        task_id: reflection.task_id,
        provenance: reflection.provenance,
        knowledge_ingest_draft: reflection.knowledge_ingest_draft,
      },
    });
    expect(event.eligibility).toBe("pre_review");
    expect(event.human_approval_ref).toBeNull();
    expect(isNonMutatingContextEligible(event)).toBe(false);
  });

  it("projectUsageFeedbackEvent: manual_review reflection signal -> context_eligible with human_approval_ref.verified=false", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    // Build a usage signal in the same shape the future adapter would
    // carry for the manual_review case (no usage_feedback_signals on
    // that fixture; we synthesize one for projection).
    const sig: UsageFeedbackSignal = {
      knowledge_id: "kb-boundary-contract-001",
      kind: "helped",
      weight: 1,
      recorded_at: reflection.created_at,
      source_task_id: reflection.task_id,
      artifact_ref: reflection.artifact_ref,
      evidence: [
        {
          kind: "artifact",
          ref: `${reflection.artifact_ref}/usage/kb-boundary-contract-001`,
          content_hash: "sha256-ll003-review-usage-001",
        },
      ],
    };
    const event = projectUsageFeedbackEvent({
      signal: sig,
      reflection: {
        task_id: reflection.task_id,
        provenance: reflection.provenance,
        knowledge_ingest_draft: reflection.knowledge_ingest_draft,
      },
    });
    expect(event.dry_run_only).toBe(true);
    expect(event.persistence_allowed).toBe(false);
    expect(event.ranking_mutation_allowed).toBe(false);
    expect(event.eligibility).toBe("context_eligible");
    expect(event.human_approval_ref).not.toBeNull();
    expect(event.human_approval_ref!.verified).toBe(false);
    expect(isNonMutatingContextEligible(event)).toBe(true);
  });

  it("isNonMutatingContextEligible rejects any event with persistence or mutation flipped on", () => {
    const base = loadFixture("ll003-usage-feedback-manual-review-design.json");
    const tampered: UsageFeedbackEventDesign = {
      ...base,
      persistence_allowed: true,
    };
    expect(isNonMutatingContextEligible(tampered)).toBe(false);
    const tampered2: UsageFeedbackEventDesign = {
      ...base,
      ranking_mutation_allowed: true,
    };
    expect(isNonMutatingContextEligible(tampered2)).toBe(false);
    const tampered3: UsageFeedbackEventDesign = {
      ...base,
      dry_run_only: false,
    };
    expect(isNonMutatingContextEligible(tampered3)).toBe(false);
    const tampered4: UsageFeedbackEventDesign = {
      ...base,
      eligibility: "pre_review",
    };
    expect(isNonMutatingContextEligible(tampered4)).toBe(false);
  });

  it("JSON round-trip preserves the design-only invariant", () => {
    for (const name of [
      "ll003-usage-feedback-pass-helped-design.json",
      "ll003-usage-feedback-fail-misled-design.json",
      "ll003-usage-feedback-manual-review-design.json",
    ]) {
      const fx = loadFixture(name);
      const rehydrated = JSON.parse(
        JSON.stringify(fx),
      ) as UsageFeedbackEventDesign;
      expect(rehydrated.dry_run_only).toBe(true);
      expect(rehydrated.persistence_allowed).toBe(false);
      expect(rehydrated.ranking_mutation_allowed).toBe(false);
      expect(rehydrated.fingerprint).toBe(fx.fingerprint);
    }
  });

  it("design fixtures themselves declare persistence_allowed=false and ranking_mutation_allowed=false", () => {
    for (const name of [
      "ll003-usage-feedback-pass-helped-design.json",
      "ll003-usage-feedback-fail-misled-design.json",
      "ll003-usage-feedback-manual-review-design.json",
    ]) {
      const fx = loadFixture(name);
      expect(fx.persistence_allowed).toBe(false);
      expect(fx.ranking_mutation_allowed).toBe(false);
      expect(fx.dry_run_only).toBe(true);
    }
  });
});
