// Post-task Learning Loop - Slice LOOP-009
// Knowledge Quarantine / Promotion Adapter — design-only tests.
//
// The adapter is pure projection. It never writes to the knowledge
// store, never calls knowledgeIngest / knowledgeSearch, never writes
// to audit, never writes to Next Task Context, never mutates live
// ranking, never persists, never writes config, never starts a
// model, never opens IPC, never triggers the HCC Auto Executor.
// `isQuarantinePromotionApplyEligible` is hard-wired to false in
// LOOP-009 — even a `promotion_candidate` decision is not applied.
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
  QUARANTINE_PROMOTION_ADAPTER_DESIGN,
  QUARANTINE_PROMOTION_PROPOSED_STATES,
  assertQuarantinePromotionDecisionNoRuntime,
  buildQuarantinePromotionDecisionId,
  collapseQuarantinePromotionDecisions,
  decidePromotionForBundle,
  decidePromotionForKnowledgeIngestDraft,
  isQuarantinePromotionApplyEligible,
  type QuarantinePromotionDecision,
} from "../src/shared/lib/post-task-reflection-quarantine-promotion-design";

import {
  POST_TASK_REFLECTION_APPROVAL_GATE,
  type HumanApprovalRef,
} from "../src/shared/lib/post-task-reflection-contract";

import type { KnowledgeIngestBridgeDraft } from "../src/shared/lib/post-task-reflection-knowledge-ingest-bridge-design";

import type { ReflectionEvaluatorVerdict } from "../src/shared/lib/post-task-reflection-evaluator-design";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(
    ROOT,
    "src/shared/lib/post-task-reflection-quarantine-promotion-design.ts",
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

function loadFixture(name: string): DecisionBundle {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as DecisionBundle;
}

function loadBridgeDrafts(name: string): KnowledgeIngestBridgeDraft[] {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as { drafts: KnowledgeIngestBridgeDraft[] };
  return json.drafts;
}

function loadEvaluatorVerdicts(name: string): ReflectionEvaluatorVerdict[] {
  const json = JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as { verdicts: ReflectionEvaluatorVerdict[] };
  return json.verdicts;
}

const SAMPLE_HUMAN_APPROVAL: HumanApprovalRef = {
  ref: "anchor://ll009/test",
  content_hash: "sha256-anchor-ll009-001",
  approval_kind: "manual_review",
  verified: false,
};

function buildVerdict(
  sourceFingerprint: string,
  sourceTask: string,
  trustBand: ReflectionEvaluatorVerdict["trust_band"],
  trustScore: number,
  humanApprovalRef: HumanApprovalRef | null,
): ReflectionEvaluatorVerdict {
  return {
    schema_version: "1.0.0",
    verdict_id: `reflection-evaluator-verdict:knowledge_ingest_draft|${sourceTask}|${sourceFingerprint}|${trustBand}`,
    source_kind: "knowledge_ingest_draft",
    source_task: sourceTask,
    source_ref: sourceTask,
    source_fingerprint: sourceFingerprint,
    trust_score: trustScore,
    trust_band: trustBand,
    reasons: ["synthesized test verdict"],
    downgrades: [],
    evidence: [
      {
        kind: "artifact",
        ref: `synthesized://${sourceFingerprint}`,
        content_hash: "sha256-ll009-test-001",
      },
    ],
    human_approval_ref: humanApprovalRef,
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

function buildDraft(
  sourceTask: string,
  fingerprint: string,
  quarantine: boolean,
  humanApprovalRef: HumanApprovalRef | null,
  evidenceCount: number = 1,
): KnowledgeIngestBridgeDraft {
  return {
    schema_version: "1.0.0",
    draft_id: `ki-bridge-draft-${sourceTask}-${fingerprint}`,
    fingerprint,
    source_kind: "good_pattern",
    source_fingerprint: fingerprint,
    target_bucket: "pattern",
    draft_kind: "fact",
    title: "test title",
    body: "test body",
    source_task: sourceTask,
    source_ref: sourceTask,
    evidence: Array.from({ length: evidenceCount }, (_, i) => ({
      kind: "artifact",
      ref: `${sourceTask}/evidence/${fingerprint}/${i}`,
      content_hash: `sha256-${fingerprint}-${i}`,
    })),
    provenance: {
      generated_by: "hermes",
      submitted_by: "hermes_main",
      dual_reviewed: false,
      human_reviewed: humanApprovalRef !== null,
      reviewed_by: humanApprovalRef !== null ? "human" : null,
      reviewed_at: humanApprovalRef !== null ? "2026-06-07T00:00:00.000Z" : null,
      trust_level: humanApprovalRef !== null ? "human_confirmed" : "single_run",
      human_approval_ref: humanApprovalRef,
    },
    human_approval_ref: humanApprovalRef,
    quarantine,
    approval_gate: { ...POST_TASK_REFLECTION_APPROVAL_GATE },
    draft_kind_ref: "fact",
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

describe("Post-task Learning Loop LOOP-009 quarantine promotion adapter design", () => {
  it("design descriptor reports design_only and forbids every form of write", () => {
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.adapter_status).toBe(
      "design_only",
    );
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.live_flush_allowed).toBe(false);
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.knowledge_ingest_call_allowed).toBe(
      false,
    );
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.knowledge_search_call_allowed).toBe(
      false,
    );
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.audit_write_allowed).toBe(false);
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.persistence_allowed).toBe(false);
    expect(
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.next_task_context_write_allowed,
    ).toBe(false);
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.live_ranking_mutation_allowed).toBe(
      false,
    );
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.config_write_allowed).toBe(false);
    expect(
      QUARANTINE_PROMOTION_ADAPTER_DESIGN.approval_anchor_verification_allowed,
    ).toBe(false);
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.human_approval_ref_required).toBe(
      true,
    );
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.evaluator_verdict_required).toBe(
      true,
    );
    expect(QUARANTINE_PROMOTION_ADAPTER_DESIGN.schema_version).toBe("1.0.0");
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("QUARANTINE_PROMOTION_PROPOSED_STATES contains exactly the three planned states", () => {
    expect(QUARANTINE_PROMOTION_PROPOSED_STATES.length).toBe(3);
    expect(new Set(QUARANTINE_PROMOTION_PROPOSED_STATES)).toEqual(
      new Set([
        "remain_quarantined",
        "promotion_candidate",
        "reject",
      ]),
    );
  });

  it("buildQuarantinePromotionDecisionId is stable and distinct on any input change", () => {
    const base = { source_task: "t-1", draft_fingerprint: "fp-1" };
    const id1 = buildQuarantinePromotionDecisionId(base);
    const id2 = buildQuarantinePromotionDecisionId(base);
    expect(id1).toBe(id2);
    expect(
      buildQuarantinePromotionDecisionId({ ...base, source_task: "t-2" }),
    ).not.toBe(id1);
    expect(
      buildQuarantinePromotionDecisionId({ ...base, draft_fingerprint: "fp-2" }),
    ).not.toBe(id1);
  });

  it("collapseQuarantinePromotionDecisions keeps first, drops rest", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const a: QuarantinePromotionDecision = { ...base };
    const b: QuarantinePromotionDecision = { ...a };
    const c: QuarantinePromotionDecision = { ...a };
    const { kept, dropped } = collapseQuarantinePromotionDecisions([a, b, c]);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
  });

  it("PASS bridge bundle: every decision remain_quarantined, never promotion_candidate, never apply eligible", () => {
    const drafts = loadBridgeDrafts("ll006-knowledge-ingest-pass-draft.json");
    const verdicts = loadEvaluatorVerdicts(
      "ll008-evaluator-pass-candidate.json",
    );
    const decisions = decidePromotionForBundle({ drafts, verdicts });
    expect(decisions.length).toBe(drafts.length);
    for (const d of decisions) {
      expect(d.proposed_state).toBe("remain_quarantined");
      expect(d.human_approval_ref).toBeNull();
      expect(d.dry_run_only).toBe(true);
      expect(d.live_flush_allowed).toBe(false);
      expect(d.knowledge_ingest_call_allowed).toBe(false);
      expect(d.knowledge_search_call_allowed).toBe(false);
      expect(d.audit_write_allowed).toBe(false);
      expect(d.next_task_context_write_allowed).toBe(false);
      expect(d.live_ranking_mutation_allowed).toBe(false);
      expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
    }
  });

  it("FAIL bridge bundle: every decision remain_quarantined, never apply eligible", () => {
    const drafts = loadBridgeDrafts("ll006-knowledge-ingest-fail-draft.json");
    const verdicts = loadEvaluatorVerdicts(
      "ll008-evaluator-fail-candidate.json",
    );
    const decisions = decidePromotionForBundle({ drafts, verdicts });
    expect(decisions.length).toBe(drafts.length);
    for (const d of decisions) {
      expect(d.proposed_state).toBe("remain_quarantined");
      expect(d.human_approval_ref).toBeNull();
      expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
    }
  });

  it("manual_review bridge bundle: every decision promotion_candidate, but apply eligible false", () => {
    const drafts = loadBridgeDrafts(
      "ll006-knowledge-ingest-manual-review-draft.json",
    );
    const verdicts = loadEvaluatorVerdicts(
      "ll008-evaluator-manual-review-candidate.json",
    );
    const decisions = decidePromotionForBundle({ drafts, verdicts });
    expect(decisions.length).toBe(drafts.length);
    for (const d of decisions) {
      expect(d.proposed_state).toBe("promotion_candidate");
      expect(d.human_approval_ref).not.toBeNull();
      expect(d.human_approval_ref!.verified).toBe(false);
      expect(d.dry_run_only).toBe(true);
      expect(d.live_flush_allowed).toBe(false);
      expect(d.knowledge_ingest_call_allowed).toBe(false);
      expect(d.knowledge_search_call_allowed).toBe(false);
      expect(d.audit_write_allowed).toBe(false);
      expect(d.next_task_context_write_allowed).toBe(false);
      expect(d.live_ranking_mutation_allowed).toBe(false);
      expect(d.config_write_allowed).toBe(false);
      expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
    }
  });

  it("missing evaluator verdict ⇒ remain_quarantined (no promotion)", () => {
    const draft = buildDraft("t-1", "fp-1", false, SAMPLE_HUMAN_APPROVAL);
    const decisions = decidePromotionForBundle({ drafts: [draft], verdicts: [] });
    expect(decisions.length).toBe(1);
    expect(decisions[0]!.proposed_state).toBe("remain_quarantined");
    expect(decisions[0]!.reason).toMatch(/no matching evaluator verdict/);
    expect(isQuarantinePromotionApplyEligible(decisions[0]!)).toBe(false);
  });

  it("evaluator trust_band=reject ⇒ reject (hard guard)", () => {
    const draft = buildDraft("t-1", "fp-1", false, SAMPLE_HUMAN_APPROVAL);
    const verdict = buildVerdict(
      "fp-1",
      "t-1",
      "reject",
      0,
      SAMPLE_HUMAN_APPROVAL,
    );
    const decision = decidePromotionForKnowledgeIngestDraft({ draft, verdict });
    expect(decision.proposed_state).toBe("reject");
    expect(decision.reason).toMatch(/evaluator verdict trust_band=reject/);
    expect(isQuarantinePromotionApplyEligible(decision)).toBe(false);
  });

  it("draft.quarantine=true ⇒ remain_quarantined", () => {
    const draft = buildDraft("t-1", "fp-1", true, SAMPLE_HUMAN_APPROVAL);
    const verdict = buildVerdict(
      "fp-1",
      "t-1",
      "human_reviewed_candidate",
      1,
      SAMPLE_HUMAN_APPROVAL,
    );
    const decision = decidePromotionForKnowledgeIngestDraft({ draft, verdict });
    expect(decision.proposed_state).toBe("remain_quarantined");
    expect(decision.reason).toMatch(/draft.quarantine=true/);
    expect(isQuarantinePromotionApplyEligible(decision)).toBe(false);
  });

  it("draft.quarantine=false but human_approval_ref=null ⇒ remain_quarantined", () => {
    const draft = buildDraft("t-1", "fp-1", false, null);
    const verdict = buildVerdict(
      "fp-1",
      "t-1",
      "human_reviewed_candidate",
      1,
      SAMPLE_HUMAN_APPROVAL,
    );
    const decision = decidePromotionForKnowledgeIngestDraft({ draft, verdict });
    expect(decision.proposed_state).toBe("remain_quarantined");
    expect(decision.reason).toMatch(/human_approval_ref=null/);
    expect(isQuarantinePromotionApplyEligible(decision)).toBe(false);
  });

  it("evaluator trust_band=quarantine ⇒ remain_quarantined", () => {
    const draft = buildDraft("t-1", "fp-1", false, SAMPLE_HUMAN_APPROVAL);
    const verdict = buildVerdict("fp-1", "t-1", "quarantine", 0.65, null);
    const decision = decidePromotionForKnowledgeIngestDraft({ draft, verdict });
    expect(decision.proposed_state).toBe("remain_quarantined");
    expect(decision.reason).toMatch(/evaluator verdict trust_band=quarantine/);
    expect(isQuarantinePromotionApplyEligible(decision)).toBe(false);
  });

  it("evaluator trust_band=candidate but quarantine=false ⇒ remain_quarantined (NOT promotion_candidate)", () => {
    const draft = buildDraft("t-1", "fp-1", false, SAMPLE_HUMAN_APPROVAL);
    const verdict = buildVerdict(
      "fp-1",
      "t-1",
      "candidate",
      0.5,
      SAMPLE_HUMAN_APPROVAL,
    );
    const decision = decidePromotionForKnowledgeIngestDraft({ draft, verdict });
    expect(decision.proposed_state).toBe("remain_quarantined");
    expect(isQuarantinePromotionApplyEligible(decision)).toBe(false);
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects verified=true human_approval_ref", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      human_approval_ref: {
        ref: "anchor://ll009/verified-true",
        content_hash: "sha256-anchor-ll009-verified-true",
        approval_kind: "manual_review",
        verified: true as unknown as false,
      },
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /verified must be false in the contract layer/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects live_flush_allowed=true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      live_flush_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /live_flush_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects knowledge_ingest_call_allowed=true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      knowledge_ingest_call_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /knowledge_ingest_call_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects knowledge_search_call_allowed=true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      knowledge_search_call_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /knowledge_search_call_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects audit_write_allowed=true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      audit_write_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /audit_write_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects next_task_context_write_allowed=true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      next_task_context_write_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /next_task_context_write_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects live_ranking_mutation_allowed=true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      live_ranking_mutation_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /live_ranking_mutation_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects persistence / config_write flipped true", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t1: QuarantinePromotionDecision = {
      ...base,
      persistence_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t1)).toThrow(
      /persistence_allowed must be false/,
    );
    const t2: QuarantinePromotionDecision = {
      ...base,
      config_write_allowed: true as unknown as false,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t2)).toThrow(
      /config_write_allowed must be false/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects dry_run_only=false", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      dry_run_only: false as unknown as true,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /dry_run_only must be true/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects empty evidence", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = { ...base, evidence: [] };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /evidence must be non-empty/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects invalid proposed_state", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      proposed_state: "promote_now" as unknown as "remain_quarantined",
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /proposed_state is invalid/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects promotion_candidate without human_approval_ref", () => {
    const base = loadFixture(
      "ll009-promotion-manual-review-candidate.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      human_approval_ref: null,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /promotion_candidate requires human_approval_ref/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects invalid evaluator_trust_band", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      evaluator_trust_band: "high" as unknown as "quarantine",
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t)).toThrow(
      /evaluator_trust_band is invalid/,
    );
  });

  it("assertQuarantinePromotionDecisionNoRuntime rejects evaluator_trust_score outside [0, 1]", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t1: QuarantinePromotionDecision = {
      ...base,
      evaluator_trust_score: 1.5,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t1)).toThrow(
      /evaluator_trust_score must be in \[0, 1\]/,
    );
    const t2: QuarantinePromotionDecision = {
      ...base,
      evaluator_trust_score: -0.1,
    };
    expect(() => assertQuarantinePromotionDecisionNoRuntime(t2)).toThrow(
      /evaluator_trust_score must be in \[0, 1\]/,
    );
  });

  it("isQuarantinePromotionApplyEligible returns false for the manual_review promotion_candidate", () => {
    const base = loadFixture(
      "ll009-promotion-manual-review-candidate.json",
    ).decisions[0]!;
    expect(base.proposed_state).toBe("promotion_candidate");
    expect(isQuarantinePromotionApplyEligible(base)).toBe(false);
  });

  it("isQuarantinePromotionApplyEligible returns false for tampered decisions with every flag intentionally satisfied", () => {
    const base = loadFixture(
      "ll009-promotion-manual-review-candidate.json",
    ).decisions[0]!;
    // tampered: every live flag false, dry_run_only true,
    // human_approval_ref present (verified=false). The helper
    // MUST still inspect each field and return false in LOOP-009.
    const t: QuarantinePromotionDecision = {
      ...base,
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
      proposed_state: "promotion_candidate",
    };
    expect(isQuarantinePromotionApplyEligible(t)).toBe(false);
  });

  it("isQuarantinePromotionApplyEligible rejects proposed_state=remain_quarantined", () => {
    const base = loadFixture(
      "ll009-promotion-pass-rejected.json",
    ).decisions[0]!;
    const t: QuarantinePromotionDecision = {
      ...base,
      proposed_state: "remain_quarantined",
    };
    expect(isQuarantinePromotionApplyEligible(t)).toBe(false);
  });

  it("PASS / FAIL / manual_review decision bundles all declare every safety flag false", () => {
    for (const name of [
      "ll009-promotion-pass-rejected.json",
      "ll009-promotion-fail-rejected.json",
      "ll009-promotion-manual-review-candidate.json",
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
      expect(fx.approval_anchor_verification_allowed).toBe(false);
      expect(fx.human_approval_ref_required).toBe(true);
      expect(fx.evaluator_verdict_required).toBe(true);
      for (const d of fx.decisions) {
        expect(d.dry_run_only).toBe(true);
        expect(d.live_flush_allowed).toBe(false);
        expect(d.knowledge_ingest_call_allowed).toBe(false);
        expect(d.knowledge_search_call_allowed).toBe(false);
        expect(d.audit_write_allowed).toBe(false);
        expect(d.persistence_allowed).toBe(false);
        expect(d.next_task_context_write_allowed).toBe(false);
        expect(d.live_ranking_mutation_allowed).toBe(false);
        expect(d.config_write_allowed).toBe(false);
        expect(d.evidence.length).toBeGreaterThan(0);
        expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
        expect(() => assertQuarantinePromotionDecisionNoRuntime(d)).not.toThrow();
      }
    }
  });

  it("PASS rejected fixture: every decision remain_quarantined", () => {
    const fx = loadFixture("ll009-promotion-pass-rejected.json");
    expect(fx.decisions.length).toBeGreaterThan(0);
    for (const d of fx.decisions) {
      expect(d.proposed_state).toBe("remain_quarantined");
      expect(d.human_approval_ref).toBeNull();
      expect(d.evaluator_trust_band).toBe("quarantine");
      expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
    }
  });

  it("FAIL rejected fixture: every decision remain_quarantined", () => {
    const fx = loadFixture("ll009-promotion-fail-rejected.json");
    expect(fx.decisions.length).toBeGreaterThan(0);
    for (const d of fx.decisions) {
      expect(d.proposed_state).toBe("remain_quarantined");
      expect(d.human_approval_ref).toBeNull();
      expect(d.evaluator_trust_band).toBe("quarantine");
      expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
    }
  });

  it("manual_review candidate fixture: every decision promotion_candidate + verified=false + apply eligible false", () => {
    const fx = loadFixture(
      "ll009-promotion-manual-review-candidate.json",
    );
    expect(fx.decisions.length).toBeGreaterThan(0);
    for (const d of fx.decisions) {
      expect(d.proposed_state).toBe("promotion_candidate");
      expect(d.human_approval_ref).not.toBeNull();
      expect(d.human_approval_ref!.verified).toBe(false);
      expect(d.evaluator_trust_band).toBe("human_reviewed_candidate");
      expect(isQuarantinePromotionApplyEligible(d)).toBe(false);
    }
  });

  it("JSON round-trip preserves the design-only invariant", () => {
    for (const name of [
      "ll009-promotion-pass-rejected.json",
      "ll009-promotion-fail-rejected.json",
      "ll009-promotion-manual-review-candidate.json",
    ]) {
      const fx = loadFixture(name);
      const rehydrated = JSON.parse(JSON.stringify(fx)) as DecisionBundle;
      expect(rehydrated.dry_run_only).toBe(true);
      expect(rehydrated.live_flush_allowed).toBe(false);
      expect(rehydrated.knowledge_ingest_call_allowed).toBe(false);
      expect(rehydrated.knowledge_search_call_allowed).toBe(false);
      expect(rehydrated.audit_write_allowed).toBe(false);
      expect(rehydrated.persistence_allowed).toBe(false);
      expect(rehydrated.next_task_context_write_allowed).toBe(false);
      expect(rehydrated.live_ranking_mutation_allowed).toBe(false);
      expect(rehydrated.config_write_allowed).toBe(false);
      expect(rehydrated.approval_anchor_verification_allowed).toBe(false);
      expect(rehydrated.human_approval_ref_required).toBe(true);
      expect(rehydrated.evaluator_verdict_required).toBe(true);
      for (const d of rehydrated.decisions) {
        expect(d.dry_run_only).toBe(true);
        expect(d.live_flush_allowed).toBe(false);
        expect(d.knowledge_ingest_call_allowed).toBe(false);
        expect(d.knowledge_search_call_allowed).toBe(false);
        expect(d.audit_write_allowed).toBe(false);
        expect(d.persistence_allowed).toBe(false);
        expect(d.next_task_context_write_allowed).toBe(false);
        expect(d.live_ranking_mutation_allowed).toBe(false);
        expect(d.config_write_allowed).toBe(false);
        expect(d.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});
