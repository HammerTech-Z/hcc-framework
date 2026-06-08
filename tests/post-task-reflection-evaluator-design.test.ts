// Post-task Learning Loop - Slice LOOP-008
// Reflection Evaluator — design-only tests.
//
// The evaluator is pure projection. It never writes to the knowledge
// store, never calls knowledgeIngest / knowledgeSearch, never writes
// to audit, never writes to Next Task Context, never mutates live
// ranking, never persists, never writes config, never starts a
// model, never opens IPC, never triggers the HCC Auto Executor.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live flush, no audit write, no Next Task Context mutation, no
// live retrieval ranking mutation, no persistence, no config write,
// no skill install, no HCC Auto Executor, no hermes config /
// handoff / audit mutation, no docs/roadmap-locked-2026-05-28.md
// mutation.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  REFLECTION_EVALUATOR_DESIGN,
  REFLECTION_TRUST_SCORE_MAX,
  REFLECTION_TRUST_SCORE_MIN,
  REFLECTION_TRUST_THRESHOLDS,
  assertReflectionEvaluatorVerdictNoRuntime,
  buildReflectionEvaluatorVerdictId,
  collapseReflectionEvaluatorVerdicts,
  evaluateConsumerRouteDecision,
  evaluateKnowledgeIngestDraft,
  evaluateKnowledgeIngestDraftBundle,
  evaluatePostTaskReflection,
  evaluateRetrievalDeltaCandidate,
  evaluateRetrievalDeltaCandidates,
  isReflectionEvaluatorPromotionEligible,
  scoreReflectionTrust,
  type ReflectionEvaluatorVerdict,
} from "../src/shared/lib/post-task-reflection-evaluator-design";

import {
  POST_TASK_REFLECTION_APPROVAL_GATE,
  type HumanApprovalRef,
  type PostTaskReflection,
} from "../src/shared/lib/post-task-reflection-contract";

import type { ConsumerRouteDecision } from "../src/shared/lib/post-task-reflection-human-approval-anchor-design";

import type { KnowledgeIngestBridgeDraft } from "../src/shared/lib/post-task-reflection-knowledge-ingest-bridge-design";

import type { RetrievalRankingDeltaCandidate } from "../src/shared/lib/post-task-reflection-retrieval-feedback-simulation";

import { projectHccDryRunToReflection } from "../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(ROOT, "src/shared/lib/post-task-reflection-evaluator-design.ts"),
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

function loadFixture(name: string): VerdictBundle {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as VerdictBundle;
}

function loadPostTaskReflection(name: string): PostTaskReflection {
  // The reflection fixtures are HCC dry-run JSON; project them
  // through the LOOP-002 helper so the contract layer accepts the
  // shape.
  const json = JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf-8"));
  return projectHccDryRunToReflection(json);
}

function loadBridgeDrafts(name: string): KnowledgeIngestBridgeDraft[] {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as { drafts: KnowledgeIngestBridgeDraft[] };
  return json.drafts;
}

function loadRouteDecisions(name: string): ConsumerRouteDecision[] {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as { decisions: ConsumerRouteDecision[] };
  return json.decisions;
}

function loadRetrievalCandidates(
  name: string,
): RetrievalRankingDeltaCandidate[] {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as { candidates: RetrievalRankingDeltaCandidate[] };
  return json.candidates;
}

const SAMPLE_HUMAN_APPROVAL: HumanApprovalRef = {
  ref: "anchor://ll008/test",
  content_hash: "sha256-anchor-ll008-001",
  approval_kind: "manual_review",
  verified: false,
};

describe("Post-task Learning Loop LOOP-008 reflection evaluator design", () => {
  it("design descriptor reports pure_projection and forbids every form of write", () => {
    expect(REFLECTION_EVALUATOR_DESIGN.evaluator_status).toBe("pure_projection");
    expect(REFLECTION_EVALUATOR_DESIGN.live_flush_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.knowledge_ingest_call_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.knowledge_search_call_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.audit_write_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.persistence_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.next_task_context_write_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.live_ranking_mutation_allowed).toBe(false);
    expect(REFLECTION_EVALUATOR_DESIGN.config_write_allowed).toBe(false);
    expect(
      REFLECTION_EVALUATOR_DESIGN.human_approval_ref_required_for_high_trust,
    ).toBe(true);
    expect(REFLECTION_EVALUATOR_DESIGN.evidence_required).toBe(true);
    expect(REFLECTION_EVALUATOR_DESIGN.schema_version).toBe("1.0.0");
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("buildReflectionEvaluatorVerdictId is stable and distinct on any input change", () => {
    const base = {
      source_kind: "post_task_reflection" as const,
      source_task: "t-1",
      source_fingerprint: "fp-1",
    };
    const id1 = buildReflectionEvaluatorVerdictId(base);
    const id2 = buildReflectionEvaluatorVerdictId(base);
    expect(id1).toBe(id2);
    expect(
      buildReflectionEvaluatorVerdictId({ ...base, source_task: "t-2" }),
    ).not.toBe(id1);
    expect(
      buildReflectionEvaluatorVerdictId({ ...base, source_kind: "knowledge_ingest_draft" }),
    ).not.toBe(id1);
    expect(
      buildReflectionEvaluatorVerdictId({ ...base, source_fingerprint: "fp-2" }),
    ).not.toBe(id1);
  });

  it("scoreReflectionTrust clamps to [0, 1] and reports the right reason set", () => {
    const full = scoreReflectionTrust({
      hasEvidence: true,
      secretScanPassed: true,
      instructionScanPassed: true,
      humanReviewed: true,
      humanApprovalRefPresent: true,
      quarantine: false,
      approvalGateClosed: true,
      applyEligibleInSource: false,
    });
    expect(full.trust_score).toBe(1);
    expect(full.reasons).toContain("evidence present");
    expect(full.reasons).toContain("human reviewed");
    expect(full.reasons).toContain("human_approval_ref present");
    expect(full.reasons).toContain("quarantine=false");

    const empty = scoreReflectionTrust({
      hasEvidence: false,
      secretScanPassed: false,
      instructionScanPassed: false,
      humanReviewed: false,
      humanApprovalRefPresent: false,
      quarantine: true,
      approvalGateClosed: false,
      applyEligibleInSource: false,
    });
    expect(empty.trust_score).toBe(0);
    expect(empty.reasons).toContain("evidence missing");

    const penalty = scoreReflectionTrust({
      hasEvidence: true,
      secretScanPassed: true,
      instructionScanPassed: true,
      humanReviewed: true,
      humanApprovalRefPresent: true,
      quarantine: false,
      approvalGateClosed: true,
      applyEligibleInSource: true,
    });
    // Full-positive raw sum is 1.15 (0.2+0.2+0.2+0.2+0.2+0.1+0.05).
    // The apply_eligible penalty subtracts 0.5, so the clamped
    // score is 0.65 — the penalty MUST lower the score below the
    // full-positive 1.0.
    expect(penalty.trust_score).toBeLessThan(1);
    expect(penalty.trust_score).toBeGreaterThan(0);
    expect(penalty.reasons).toContain("apply_eligible_in_source=true penalty applied");
  });

  it("REFLECTION_TRUST_SCORE_MIN / MAX and REFLECTION_TRUST_THRESHOLDS are stable", () => {
    expect(REFLECTION_TRUST_SCORE_MIN).toBe(0);
    expect(REFLECTION_TRUST_SCORE_MAX).toBe(1);
    expect(REFLECTION_TRUST_THRESHOLDS.reject).toBe(0);
    expect(REFLECTION_TRUST_THRESHOLDS.quarantine).toBe(0.4);
    expect(REFLECTION_TRUST_THRESHOLDS.human_reviewed).toBe(0.85);
  });

  it("collapseReflectionEvaluatorVerdicts keeps first, drops rest", () => {
    const id = buildReflectionEvaluatorVerdictId({
      source_kind: "post_task_reflection",
      source_task: "t-1",
      source_fingerprint: "fp-1",
    });
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const a: ReflectionEvaluatorVerdict = { ...base, verdict_id: id };
    const b: ReflectionEvaluatorVerdict = { ...a };
    const { kept, dropped } = collapseReflectionEvaluatorVerdicts([a, b]);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(1);
  });

  it("PASS reflection: at least one verdict is quarantine, never human_reviewed_candidate, never promotion eligible", () => {
    const reflection = loadPostTaskReflection("ll002-hcc-pass-dry-run.json");
    const v = evaluatePostTaskReflection({ reflection });
    expect(v.source_kind).toBe("post_task_reflection");
    expect(v.trust_band).toBe("quarantine");
    expect(v.human_approval_ref).toBeNull();
    expect(v.live_flush_allowed).toBe(false);
    expect(v.knowledge_ingest_call_allowed).toBe(false);
    expect(v.audit_write_allowed).toBe(false);
    expect(v.next_task_context_write_allowed).toBe(false);
    expect(v.live_ranking_mutation_allowed).toBe(false);
    expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
  });

  it("FAIL reflection: at least one downgrade reason referencing fail / dead_end", () => {
    const reflection = loadPostTaskReflection("ll002-hcc-fail-dry-run.json");
    const v = evaluatePostTaskReflection({ reflection });
    expect(v.source_kind).toBe("post_task_reflection");
    expect(v.trust_band).toBe("quarantine");
    expect(v.human_approval_ref).toBeNull();
    expect(v.live_flush_allowed).toBe(false);
    expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
  });

  it("manual_review reflection: human_reviewed_candidate band, but promotion eligible false", () => {
    const reflection = loadPostTaskReflection("ll002-hcc-manual-review-dry-run.json");
    const v = evaluatePostTaskReflection({ reflection });
    expect(v.trust_band).toBe("human_reviewed_candidate");
    expect(v.human_approval_ref).not.toBeNull();
    expect(v.human_approval_ref!.verified).toBe(false);
    expect(v.live_flush_allowed).toBe(false);
    expect(v.knowledge_ingest_call_allowed).toBe(false);
    expect(v.audit_write_allowed).toBe(false);
    expect(v.persistence_allowed).toBe(false);
    expect(v.next_task_context_write_allowed).toBe(false);
    expect(v.live_ranking_mutation_allowed).toBe(false);
    expect(v.config_write_allowed).toBe(false);
    expect(v.dry_run_only).toBe(true);
    expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
  });

  it("PASS bridge bundle: every draft verdict is quarantine, never human_reviewed_candidate", () => {
    const drafts = loadBridgeDrafts("ll006-knowledge-ingest-pass-draft.json");
    const verdicts = evaluateKnowledgeIngestDraftBundle({ drafts });
    expect(verdicts.length).toBe(drafts.length);
    for (const v of verdicts) {
      expect(v.trust_band).toBe("quarantine");
      expect(v.human_approval_ref).toBeNull();
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("manual_review bridge bundle: every draft verdict is human_reviewed_candidate", () => {
    const drafts = loadBridgeDrafts(
      "ll006-knowledge-ingest-manual-review-draft.json",
    );
    const verdicts = evaluateKnowledgeIngestDraftBundle({ drafts });
    expect(verdicts.length).toBe(drafts.length);
    for (const v of verdicts) {
      expect(v.trust_band).toBe("human_reviewed_candidate");
      expect(v.human_approval_ref).not.toBeNull();
      expect(v.human_approval_ref!.verified).toBe(false);
      expect(v.live_flush_allowed).toBe(false);
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("PASS consumer route decisions: every verdict is quarantine, never human_reviewed_candidate", () => {
    const decisions = loadRouteDecisions("ll006a-consumer-route-pass-rejected.json");
    const verdicts = decisions.map(evaluateConsumerRouteDecision);
    for (const v of verdicts) {
      expect(v.trust_band).toBe("quarantine");
      expect(v.human_approval_ref).toBeNull();
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("manual_review consumer route decisions: every verdict is human_reviewed_candidate", () => {
    const decisions = loadRouteDecisions(
      "ll006a-consumer-route-manual-review-dry-run.json",
    );
    const verdicts = decisions.map(evaluateConsumerRouteDecision);
    for (const v of verdicts) {
      expect(v.trust_band).toBe("human_reviewed_candidate");
      expect(v.human_approval_ref).not.toBeNull();
      expect(v.human_approval_ref!.verified).toBe(false);
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("PASS retrieval candidates: every verdict is quarantine, never human_reviewed_candidate", () => {
    const candidates = loadRetrievalCandidates(
      "ll007-retrieval-simulation-pass-rejected.json",
    );
    const verdicts = evaluateRetrievalDeltaCandidates(candidates);
    for (const v of verdicts) {
      expect(v.trust_band).toBe("quarantine");
      expect(v.human_approval_ref).toBeNull();
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("manual_review retrieval candidates: verdict is human_reviewed_candidate", () => {
    const candidates = loadRetrievalCandidates(
      "ll007-retrieval-simulation-manual-review-dry-run.json",
    );
    const verdicts = evaluateRetrievalDeltaCandidates(candidates);
    expect(verdicts.length).toBe(candidates.length);
    for (const v of verdicts) {
      expect(v.trust_band).toBe("human_reviewed_candidate");
      expect(v.human_approval_ref).not.toBeNull();
      expect(v.human_approval_ref!.verified).toBe(false);
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("evaluateKnowledgeIngestDraft: empty evidence ⇒ throw", () => {
    const base = loadBridgeDrafts("ll006-knowledge-ingest-pass-draft.json")[0]!;
    const t: KnowledgeIngestBridgeDraft = { ...base, evidence: [] };
    expect(() => evaluateKnowledgeIngestDraft(t)).toThrow(
      /evidence array must be non-empty/,
    );
  });

  it("evaluateKnowledgeIngestDraft: evidence[0] missing sha256- ⇒ throw", () => {
    const base = loadBridgeDrafts("ll006-knowledge-ingest-pass-draft.json")[0]!;
    const t: KnowledgeIngestBridgeDraft = {
      ...base,
      evidence: [
        {
          kind: "artifact",
          ref: "hcc://ll008/bad-hash",
          content_hash: "md5-not-allowed",
        },
      ],
    };
    expect(() => evaluateKnowledgeIngestDraft(t)).toThrow(
      /evidence\[0\].content_hash must start with sha256-/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects verified=true human_approval_ref", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      human_approval_ref: {
        ref: "anchor://ll008/verified-true",
        content_hash: "sha256-anchor-ll008-verified-true",
        approval_kind: "manual_review",
        verified: true as unknown as false,
      },
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /verified must be false in the contract layer/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects live_flush_allowed=true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      live_flush_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /live_flush_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects knowledge_ingest_call_allowed=true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      knowledge_ingest_call_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /knowledge_ingest_call_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects knowledge_search_call_allowed=true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      knowledge_search_call_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /knowledge_search_call_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects audit_write_allowed=true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      audit_write_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /audit_write_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects next_task_context_write_allowed=true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      next_task_context_write_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /next_task_context_write_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects live_ranking_mutation_allowed=true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      live_ranking_mutation_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /live_ranking_mutation_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects persistence / config_write flipped true", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t1: ReflectionEvaluatorVerdict = {
      ...base,
      persistence_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t1)).toThrow(
      /persistence_allowed must be false/,
    );
    const t2: ReflectionEvaluatorVerdict = {
      ...base,
      config_write_allowed: true as unknown as false,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t2)).toThrow(
      /config_write_allowed must be false/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects dry_run_only=false", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      dry_run_only: false as unknown as true,
    };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /dry_run_only must be true/,
    );
  });

  it("assertReflectionEvaluatorVerdictNoRuntime rejects empty evidence array", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = { ...base, evidence: [] };
    expect(() => assertReflectionEvaluatorVerdictNoRuntime(t)).toThrow(
      /evidence must be non-empty/,
    );
  });

  it("isReflectionEvaluatorPromotionEligible returns false for the manual_review verdict", () => {
    const reflection = loadPostTaskReflection("ll002-hcc-manual-review-dry-run.json");
    const v = evaluatePostTaskReflection({ reflection });
    expect(v.trust_band).toBe("human_reviewed_candidate");
    expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
  });

  it("isReflectionEvaluatorPromotionEligible returns false even with every flag intentionally satisfied via a tampered candidate", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      // tampered: pretend every live flag was flipped. The helper
      // MUST still inspect each one and return false.
      live_flush_allowed: false,
      knowledge_ingest_call_allowed: false,
      knowledge_search_call_allowed: false,
      audit_write_allowed: false,
      persistence_allowed: false,
      next_task_context_write_allowed: false,
      live_ranking_mutation_allowed: false,
      config_write_allowed: false,
      dry_run_only: true,
      human_approval_ref: SAMPLE_HUMAN_APPROVAL,
    };
    expect(isReflectionEvaluatorPromotionEligible(t)).toBe(false);
  });

  it("isReflectionEvaluatorPromotionEligible rejects tampered live flags", () => {
    const base = loadFixture(
      "ll008-evaluator-pass-candidate.json",
    ).verdicts[0]!;
    const t: ReflectionEvaluatorVerdict = {
      ...base,
      live_flush_allowed: true as unknown as false,
    };
    expect(isReflectionEvaluatorPromotionEligible(t)).toBe(false);
    const t2: ReflectionEvaluatorVerdict = {
      ...base,
      live_ranking_mutation_allowed: true as unknown as false,
    };
    expect(isReflectionEvaluatorPromotionEligible(t2)).toBe(false);
  });

  it("PASS / FAIL / manual_review verdict bundles all declare every safety flag false", () => {
    for (const name of [
      "ll008-evaluator-pass-candidate.json",
      "ll008-evaluator-fail-candidate.json",
      "ll008-evaluator-manual-review-candidate.json",
    ]) {
      const fx = loadFixture(name);
      expect(fx.dry_run_only).toBe(true);
      expect(fx.live_flush_allowed).toBe(false);
      expect(fx.knowledge_ingest_call_allowed).toBe(false);
      expect(fx.knowledge_search_call_allowed).toBe(false);
      expect(fx.audit_write_allowed).toBe(false);
      expect(fx.persistence_allowed).toBe(false);
      expect(fx.next_task_context_write_allowed).toBe(false);
      expect(fx.live_ranking_mutation_allowed).toBe(false);
      expect(fx.config_write_allowed).toBe(false);
      for (const v of fx.verdicts) {
        expect(v.dry_run_only).toBe(true);
        expect(v.live_flush_allowed).toBe(false);
        expect(v.knowledge_ingest_call_allowed).toBe(false);
        expect(v.knowledge_search_call_allowed).toBe(false);
        expect(v.audit_write_allowed).toBe(false);
        expect(v.persistence_allowed).toBe(false);
        expect(v.next_task_context_write_allowed).toBe(false);
        expect(v.live_ranking_mutation_allowed).toBe(false);
        expect(v.config_write_allowed).toBe(false);
        expect(v.evidence.length).toBeGreaterThan(0);
        expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
        expect(() => assertReflectionEvaluatorVerdictNoRuntime(v)).not.toThrow();
      }
    }
  });

  it("PASS bundle: every verdict is quarantine, no human_reviewed_candidate", () => {
    const fx = loadFixture("ll008-evaluator-pass-candidate.json");
    expect(fx.verdicts.length).toBeGreaterThan(0);
    for (const v of fx.verdicts) {
      expect(v.trust_band).toBe("quarantine");
      expect(v.human_approval_ref).toBeNull();
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("FAIL bundle: every verdict is quarantine, no human_reviewed_candidate", () => {
    const fx = loadFixture("ll008-evaluator-fail-candidate.json");
    expect(fx.verdicts.length).toBeGreaterThan(0);
    for (const v of fx.verdicts) {
      expect(v.trust_band).toBe("quarantine");
      expect(v.human_approval_ref).toBeNull();
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("manual_review bundle: every verdict is human_reviewed_candidate; verified stays false", () => {
    const fx = loadFixture("ll008-evaluator-manual-review-candidate.json");
    expect(fx.verdicts.length).toBeGreaterThan(0);
    for (const v of fx.verdicts) {
      expect(v.trust_band).toBe("human_reviewed_candidate");
      expect(v.human_approval_ref).not.toBeNull();
      expect(v.human_approval_ref!.verified).toBe(false);
      expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
    }
  });

  it("evaluateRetrievalDeltaCandidate on a boosted candidate still yields no promotion eligibility", () => {
    const base = loadRetrievalCandidates(
      "ll007-retrieval-simulation-manual-review-dry-run.json",
    )[0]!;
    const v = evaluateRetrievalDeltaCandidate(base);
    expect(v.trust_band).toBe("human_reviewed_candidate");
    expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
  });

  it("JSON round-trip preserves the pure-projection invariant", () => {
    for (const name of [
      "ll008-evaluator-pass-candidate.json",
      "ll008-evaluator-fail-candidate.json",
      "ll008-evaluator-manual-review-candidate.json",
    ]) {
      const fx = loadFixture(name);
      const rehydrated = JSON.parse(JSON.stringify(fx)) as VerdictBundle;
      expect(rehydrated.dry_run_only).toBe(true);
      expect(rehydrated.live_flush_allowed).toBe(false);
      expect(rehydrated.knowledge_ingest_call_allowed).toBe(false);
      expect(rehydrated.knowledge_search_call_allowed).toBe(false);
      expect(rehydrated.audit_write_allowed).toBe(false);
      expect(rehydrated.persistence_allowed).toBe(false);
      expect(rehydrated.next_task_context_write_allowed).toBe(false);
      expect(rehydrated.live_ranking_mutation_allowed).toBe(false);
      expect(rehydrated.config_write_allowed).toBe(false);
      for (const v of rehydrated.verdicts) {
        expect(v.dry_run_only).toBe(true);
        expect(v.live_flush_allowed).toBe(false);
        expect(v.knowledge_ingest_call_allowed).toBe(false);
        expect(v.knowledge_search_call_allowed).toBe(false);
        expect(v.audit_write_allowed).toBe(false);
        expect(v.persistence_allowed).toBe(false);
        expect(v.next_task_context_write_allowed).toBe(false);
        expect(v.live_ranking_mutation_allowed).toBe(false);
        expect(v.config_write_allowed).toBe(false);
        expect(v.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});
