// Post-task Learning Loop - Slice LOOP-007
// Retrieval Feedback Simulation — design-only tests.
//
// The simulator is dry-run only. It never writes to live retrieval
// ranking, never live flushes, never writes audit, never writes to
// Next Task Context, never calls knowledgeIngest / knowledgeSearch.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live ranking mutation, no live flush, no audit write, no Next
// Task Context mutation, no skill install, no HCC Auto Executor, no
// hermes config / handoff / audit mutation, no
// docs/roadmap-locked-2026-05-28.md mutation.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  RETRIEVAL_FEEDBACK_SIMULATION_DESIGN,
  assertRetrievalDeltaCandidateNoRuntime,
  buildRetrievalDeltaCandidateId,
  classifyRetrievalDeltaFromUsageSignal,
  collapseRetrievalDeltaCandidateDuplicates,
  isRetrievalDeltaApplyEligible,
  projectUsageFeedbackToRetrievalDeltaCandidate,
  type RetrievalRankingDeltaCandidate,
} from "../src/shared/lib/post-task-reflection-retrieval-feedback-simulation";

import { POST_TASK_REFLECTION_APPROVAL_GATE } from "../src/shared/lib/post-task-reflection-contract";

import type { HumanApprovalRef, UsageFeedbackSignal } from "../src/shared/lib/post-task-reflection-contract";

import type { ConsumerRouteDecision } from "../src/shared/lib/post-task-reflection-human-approval-anchor-design";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(
    ROOT,
    "src/shared/lib/post-task-reflection-retrieval-feedback-simulation.ts",
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

function loadFixture(name: string): CandidateBundle {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as CandidateBundle;
}

const SAMPLE_HUMAN_APPROVAL: HumanApprovalRef = {
  ref: "anchor://ll007/test",
  content_hash: "sha256-anchor-ll007-001",
  approval_kind: "manual_review",
  verified: false,
};

function sampleSignal(kind: UsageFeedbackSignal["kind"]): UsageFeedbackSignal {
  return {
    knowledge_id: "kb-test-001",
    kind,
    weight: 1,
    recorded_at: "2026-06-07T00:00:00.000Z",
    source_task_id: "hcc-dry-run://ll007/test-001",
    artifact_ref: "hcc://ll007/test-001",
    evidence: [
      {
        kind: "artifact",
        ref: "hcc://ll007/test-001/usage/kb-test-001",
        content_hash: "sha256-ll007-test-001",
      },
    ],
  };
}

function buildDecision(
  route: ConsumerRouteDecision["route"],
  reason: string,
  approvalRef: HumanApprovalRef | null = null,
  quarantine: boolean = route === "reject_pre_review",
): ConsumerRouteDecision {
  return {
    schema_version: "1.0.0",
    decision_id: `consumer-route-decision:usage_feedback|hcc-dry-run://ll007/test-001|usage-feedback:hcc-dry-run://ll007/test-001|kb-test-001|${route}`,
    source_kind: "usage_feedback",
    source_ref: "hcc://ll007/test-001",
    source_task: "hcc-dry-run://ll007/test-001",
    source_fingerprint: "usage-feedback:hcc-dry-run://ll007/test-001|kb-test-001",
    route,
    reason,
    human_approval_ref: approvalRef,
    approval_gate: { ...POST_TASK_REFLECTION_APPROVAL_GATE },
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

function projectFromEvent(
  event: {
    source_task: string;
    source_ref: string;
    knowledge_id: string;
    signal_kind: UsageFeedbackSignal["kind"];
    weight: number;
    evidence: RetrievalRankingDeltaCandidate["evidence"];
    human_approval_ref: HumanApprovalRef | null;
  },
  route: ConsumerRouteDecision["route"],
  approvalRef: HumanApprovalRef | null = null,
): RetrievalRankingDeltaCandidate {
  return projectUsageFeedbackToRetrievalDeltaCandidate({
    event: {
      source_task: event.source_task,
      source_ref: event.source_ref,
      knowledge_id: event.knowledge_id,
      signal_kind: classifyRetrievalDeltaFromUsageSignal({
        knowledge_id: event.knowledge_id,
        kind: event.signal_kind,
        weight: event.weight,
        recorded_at: "",
        source_task_id: event.source_task,
        artifact_ref: event.source_ref,
        evidence: event.evidence,
      }),
      weight: event.weight,
      evidence: event.evidence,
      human_approval_ref: event.human_approval_ref,
    },
    routeDecision: buildDecision(
      route,
      `synthesized decision: ${route}`,
      approvalRef,
      route === "reject_pre_review",
    ),
  });
}

describe("Post-task Learning Loop LOOP-007 retrieval feedback simulation", () => {
  it("design descriptor reports dry_run_only and forbids every form of live write", () => {
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.simulation_status).toBe(
      "dry_run_only",
    );
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.live_ranking_mutation_allowed).toBe(
      false,
    );
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.ranking_input_write_allowed).toBe(
      false,
    );
    expect(
      RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.next_task_context_write_allowed,
    ).toBe(false);
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.knowledge_ingest_call_allowed).toBe(
      false,
    );
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.knowledge_search_call_allowed).toBe(
      false,
    );
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.live_flush_allowed).toBe(false);
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.audit_write_allowed).toBe(false);
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.persistence_allowed).toBe(false);
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.config_write_allowed).toBe(false);
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.consumer_route_required).toBe(true);
    expect(
      RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.human_approval_ref_required_for_ranking_candidate,
    ).toBe(true);
    expect(RETRIEVAL_FEEDBACK_SIMULATION_DESIGN.schema_version).toBe("1.0.0");
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("buildRetrievalDeltaCandidateId is stable and distinct on any input change", () => {
    const base = {
      source_task: "t-1",
      knowledge_id: "k-1",
      signal_kind: "helped" as const,
      route: "ranking_dry_run_candidate" as const,
    };
    const id1 = buildRetrievalDeltaCandidateId(base);
    const id2 = buildRetrievalDeltaCandidateId(base);
    expect(id1).toBe(id2);
    expect(
      buildRetrievalDeltaCandidateId({ ...base, source_task: "t-2" }),
    ).not.toBe(id1);
    expect(
      buildRetrievalDeltaCandidateId({ ...base, knowledge_id: "k-2" }),
    ).not.toBe(id1);
    expect(
      buildRetrievalDeltaCandidateId({ ...base, signal_kind: "misled" }),
    ).not.toBe(id1);
    expect(
      buildRetrievalDeltaCandidateId({ ...base, route: "context_dry_run_candidate" }),
    ).not.toBe(id1);
  });

  it("classifyRetrievalDeltaFromUsageSignal maps helped/misled/other to signal kind", () => {
    expect(classifyRetrievalDeltaFromUsageSignal(sampleSignal("helped"))).toBe(
      "helped",
    );
    expect(classifyRetrievalDeltaFromUsageSignal(sampleSignal("misled"))).toBe(
      "misled",
    );
    expect(classifyRetrievalDeltaFromUsageSignal(sampleSignal("unused"))).toBe(
      "none",
    );
    expect(classifyRetrievalDeltaFromUsageSignal(sampleSignal("retrieved"))).toBe(
      "none",
    );
    expect(classifyRetrievalDeltaFromUsageSignal(sampleSignal("used"))).toBe(
      "none",
    );
  });

  it("collapseRetrievalDeltaCandidateDuplicates keeps first, drops rest", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const a: RetrievalRankingDeltaCandidate = { ...base };
    const b: RetrievalRankingDeltaCandidate = { ...a };
    const c: RetrievalRankingDeltaCandidate = { ...a };
    const { kept, dropped } = collapseRetrievalDeltaCandidateDuplicates([a, b, c]);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
  });

  it("reject_pre_review ⇒ proposed_delta=0 / proposed_direction='none' regardless of signal", () => {
    const helped = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/rej-001",
        source_ref: "hcc://ll007/rej-001",
        knowledge_id: "k-1",
        signal_kind: "helped",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/rej-001/usage/k-1",
            content_hash: "sha256-rej-001",
          },
        ],
        human_approval_ref: null,
      },
      "reject_pre_review",
    );
    expect(helped.route).toBe("reject_pre_review");
    expect(helped.proposed_delta).toBe(0);
    expect(helped.proposed_direction).toBe("none");
    expect(helped.signal_kind).toBe("helped");
    expect(helped.dry_run_only).toBe(true);
    expect(helped.live_ranking_mutation_allowed).toBe(false);
    expect(helped.ranking_input_write_allowed).toBe(false);
    expect(helped.next_task_context_write_allowed).toBe(false);
    expect(isRetrievalDeltaApplyEligible(helped)).toBe(false);

    const misled = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/rej-002",
        source_ref: "hcc://ll007/rej-002",
        knowledge_id: "k-2",
        signal_kind: "misled",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/rej-002/usage/k-2",
            content_hash: "sha256-rej-002",
          },
        ],
        human_approval_ref: null,
      },
      "reject_pre_review",
    );
    expect(misled.proposed_delta).toBe(0);
    expect(misled.proposed_direction).toBe("none");
    expect(misled.signal_kind).toBe("misled");
    expect(isRetrievalDeltaApplyEligible(misled)).toBe(false);
  });

  it("context_dry_run_candidate ⇒ proposed_delta=0 / proposed_direction='none'", () => {
    const c = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/ctx-001",
        source_ref: "hcc://ll007/ctx-001",
        knowledge_id: "k-3",
        signal_kind: "helped",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/ctx-001/usage/k-3",
            content_hash: "sha256-ctx-001",
          },
        ],
        human_approval_ref: SAMPLE_HUMAN_APPROVAL,
      },
      "context_dry_run_candidate",
      SAMPLE_HUMAN_APPROVAL,
    );
    expect(c.route).toBe("context_dry_run_candidate");
    expect(c.proposed_delta).toBe(0);
    expect(c.proposed_direction).toBe("none");
    expect(c.human_approval_ref).not.toBeNull();
    expect(c.human_approval_ref!.verified).toBe(false);
    expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
  });

  it("ranking_dry_run_candidate + helped + human_approval_ref ⇒ boost (positive delta)", () => {
    const c = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/rank-001",
        source_ref: "hcc://ll007/rank-001",
        knowledge_id: "k-4",
        signal_kind: "helped",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/rank-001/usage/k-4",
            content_hash: "sha256-rank-001",
          },
        ],
        human_approval_ref: SAMPLE_HUMAN_APPROVAL,
      },
      "ranking_dry_run_candidate",
      SAMPLE_HUMAN_APPROVAL,
    );
    expect(c.route).toBe("ranking_dry_run_candidate");
    expect(c.proposed_delta).toBeGreaterThan(0);
    expect(c.proposed_direction).toBe("boost");
    expect(c.signal_kind).toBe("helped");
    expect(c.dry_run_only).toBe(true);
    expect(c.live_ranking_mutation_allowed).toBe(false);
    expect(c.ranking_input_write_allowed).toBe(false);
    expect(c.next_task_context_write_allowed).toBe(false);
    expect(c.live_flush_allowed).toBe(false);
    expect(c.audit_write_allowed).toBe(false);
    expect(c.persistence_allowed).toBe(false);
    expect(c.human_approval_ref!.verified).toBe(false);
    expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
  });

  it("ranking_dry_run_candidate + misled + human_approval_ref ⇒ penalize (negative delta)", () => {
    const c = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/rank-002",
        source_ref: "hcc://ll007/rank-002",
        knowledge_id: "k-5",
        signal_kind: "misled",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/rank-002/usage/k-5",
            content_hash: "sha256-rank-002",
          },
        ],
        human_approval_ref: SAMPLE_HUMAN_APPROVAL,
      },
      "ranking_dry_run_candidate",
      SAMPLE_HUMAN_APPROVAL,
    );
    expect(c.route).toBe("ranking_dry_run_candidate");
    expect(c.proposed_delta).toBeLessThan(0);
    expect(c.proposed_direction).toBe("penalize");
    expect(c.signal_kind).toBe("misled");
    expect(c.dry_run_only).toBe(true);
    expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
  });

  it("ranking_dry_run_candidate + missing human_approval_ref ⇒ proposed_delta=0", () => {
    const c = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/rank-003",
        source_ref: "hcc://ll007/rank-003",
        knowledge_id: "k-6",
        signal_kind: "helped",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/rank-003/usage/k-6",
            content_hash: "sha256-rank-003",
          },
        ],
        human_approval_ref: null,
      },
      "ranking_dry_run_candidate",
      null,
    );
    expect(c.route).toBe("ranking_dry_run_candidate");
    expect(c.proposed_delta).toBe(0);
    expect(c.proposed_direction).toBe("none");
    expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
  });

  it("assertRetrievalDeltaCandidateNoRuntime rejects verified=true human_approval_ref", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const t: RetrievalRankingDeltaCandidate = {
      ...base,
      human_approval_ref: {
        ref: "anchor://ll007/verified-true",
        content_hash: "sha256-anchor-ll007-verified-true",
        approval_kind: "manual_review",
        verified: true as unknown as false,
      },
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t)).toThrow(
      /verified must be false in the contract layer/,
    );
  });

  it("assertRetrievalDeltaCandidateNoRuntime rejects live_ranking_mutation_allowed=true", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const t: RetrievalRankingDeltaCandidate = {
      ...base,
      live_ranking_mutation_allowed: true as unknown as false,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t)).toThrow(
      /live_ranking_mutation_allowed must be false/,
    );
  });

  it("assertRetrievalDeltaCandidateNoRuntime rejects ranking_input_write_allowed=true", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const t: RetrievalRankingDeltaCandidate = {
      ...base,
      ranking_input_write_allowed: true as unknown as false,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t)).toThrow(
      /ranking_input_write_allowed must be false/,
    );
  });

  it("assertRetrievalDeltaCandidateNoRuntime rejects next_task_context_write_allowed=true", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const t: RetrievalRankingDeltaCandidate = {
      ...base,
      next_task_context_write_allowed: true as unknown as false,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t)).toThrow(
      /next_task_context_write_allowed must be false/,
    );
  });

  it("assertRetrievalDeltaCandidateNoRuntime rejects live_flush / audit_write / persistence flipped true", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const t1: RetrievalRankingDeltaCandidate = {
      ...base,
      live_flush_allowed: true as unknown as false,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t1)).toThrow(
      /live_flush_allowed must be false/,
    );
    const t2: RetrievalRankingDeltaCandidate = {
      ...base,
      audit_write_allowed: true as unknown as false,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t2)).toThrow(
      /audit_write_allowed must be false/,
    );
    const t3: RetrievalRankingDeltaCandidate = {
      ...base,
      persistence_allowed: true as unknown as false,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t3)).toThrow(
      /persistence_allowed must be false/,
    );
  });

  it("assertRetrievalDeltaCandidateNoRuntime rejects dry_run_only=false", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    const t: RetrievalRankingDeltaCandidate = {
      ...base,
      dry_run_only: false as unknown as true,
    };
    expect(() => assertRetrievalDeltaCandidateNoRuntime(t)).toThrow(
      /dry_run_only must be true/,
    );
  });

  it("isRetrievalDeltaApplyEligible returns false for the boosted ranking dry-run candidate", () => {
    const c = projectFromEvent(
      {
        source_task: "hcc-dry-run://ll007/apply-001",
        source_ref: "hcc://ll007/apply-001",
        knowledge_id: "k-7",
        signal_kind: "helped",
        weight: 1,
        evidence: [
          {
            kind: "artifact",
            ref: "hcc://ll007/apply-001/usage/k-7",
            content_hash: "sha256-apply-001",
          },
        ],
        human_approval_ref: SAMPLE_HUMAN_APPROVAL,
      },
      "ranking_dry_run_candidate",
      SAMPLE_HUMAN_APPROVAL,
    );
    expect(c.proposed_delta).toBeGreaterThan(0);
    expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
  });

  it("isRetrievalDeltaApplyEligible rejects tampered candidates with any live flag flipped", () => {
    const base = loadFixture(
      "ll007-retrieval-simulation-pass-rejected.json",
    ).candidates[0]!;
    // Re-tampering a base candidate and re-tampering the apply path
    // — the helper inspects every live flag. We test two flips.
    const t1: RetrievalRankingDeltaCandidate = {
      ...base,
      live_ranking_mutation_allowed: true as unknown as false,
    };
    expect(isRetrievalDeltaApplyEligible(t1)).toBe(false);
    const t2: RetrievalRankingDeltaCandidate = {
      ...base,
      dry_run_only: false as unknown as true,
    };
    expect(isRetrievalDeltaApplyEligible(t2)).toBe(false);
  });

  it("PASS / FAIL / manual_review candidate bundles all declare every safety flag false", () => {
    for (const name of [
      "ll007-retrieval-simulation-pass-rejected.json",
      "ll007-retrieval-simulation-fail-rejected.json",
      "ll007-retrieval-simulation-manual-review-dry-run.json",
    ]) {
      const fx = loadFixture(name);
      expect(fx.dry_run_only).toBe(true);
      expect(fx.live_ranking_mutation_allowed).toBe(false);
      expect(fx.ranking_input_write_allowed).toBe(false);
      expect(fx.next_task_context_write_allowed).toBe(false);
      expect(fx.live_flush_allowed).toBe(false);
      expect(fx.audit_write_allowed).toBe(false);
      expect(fx.persistence_allowed).toBe(false);
      for (const c of fx.candidates) {
        expect(c.dry_run_only).toBe(true);
        expect(c.live_ranking_mutation_allowed).toBe(false);
        expect(c.ranking_input_write_allowed).toBe(false);
        expect(c.next_task_context_write_allowed).toBe(false);
        expect(c.live_flush_allowed).toBe(false);
        expect(c.audit_write_allowed).toBe(false);
        expect(c.persistence_allowed).toBe(false);
        expect(c.evidence.length).toBeGreaterThan(0);
        expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
        expect(() => assertRetrievalDeltaCandidateNoRuntime(c)).not.toThrow();
      }
    }
  });

  it("PASS rejected fixture: every candidate has proposed_delta=0 / proposed_direction='none'", () => {
    const fx = loadFixture("ll007-retrieval-simulation-pass-rejected.json");
    expect(fx.candidates.length).toBeGreaterThan(0);
    for (const c of fx.candidates) {
      expect(c.route).toBe("reject_pre_review");
      expect(c.proposed_delta).toBe(0);
      expect(c.proposed_direction).toBe("none");
      expect(c.human_approval_ref).toBeNull();
      expect(c.signal_kind).toBe("helped");
      expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
    }
  });

  it("FAIL rejected fixture: every candidate has proposed_delta=0 / proposed_direction='none'", () => {
    const fx = loadFixture("ll007-retrieval-simulation-fail-rejected.json");
    expect(fx.candidates.length).toBeGreaterThan(0);
    for (const c of fx.candidates) {
      expect(c.route).toBe("reject_pre_review");
      expect(c.proposed_delta).toBe(0);
      expect(c.proposed_direction).toBe("none");
      expect(c.human_approval_ref).toBeNull();
      expect(c.signal_kind).toBe("misled");
      expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
    }
  });

  it("manual_review fixture: candidate has proposed_delta=0 / proposed_direction='none' (context surface only)", () => {
    const fx = loadFixture(
      "ll007-retrieval-simulation-manual-review-dry-run.json",
    );
    expect(fx.candidates.length).toBeGreaterThan(0);
    for (const c of fx.candidates) {
      expect(c.route).toBe("context_dry_run_candidate");
      expect(c.proposed_delta).toBe(0);
      expect(c.proposed_direction).toBe("none");
      expect(c.human_approval_ref).not.toBeNull();
      expect(c.human_approval_ref!.verified).toBe(false);
      expect(c.dry_run_only).toBe(true);
      expect(isRetrievalDeltaApplyEligible(c)).toBe(false);
    }
  });

  it("JSON round-trip preserves the dry-run-only invariant", () => {
    for (const name of [
      "ll007-retrieval-simulation-pass-rejected.json",
      "ll007-retrieval-simulation-fail-rejected.json",
      "ll007-retrieval-simulation-manual-review-dry-run.json",
    ]) {
      const fx = loadFixture(name);
      const rehydrated = JSON.parse(JSON.stringify(fx)) as CandidateBundle;
      expect(rehydrated.dry_run_only).toBe(true);
      expect(rehydrated.live_ranking_mutation_allowed).toBe(false);
      expect(rehydrated.ranking_input_write_allowed).toBe(false);
      expect(rehydrated.next_task_context_write_allowed).toBe(false);
      expect(rehydrated.live_flush_allowed).toBe(false);
      expect(rehydrated.audit_write_allowed).toBe(false);
      expect(rehydrated.persistence_allowed).toBe(false);
      for (const c of rehydrated.candidates) {
        expect(c.dry_run_only).toBe(true);
        expect(c.live_ranking_mutation_allowed).toBe(false);
        expect(c.ranking_input_write_allowed).toBe(false);
        expect(c.next_task_context_write_allowed).toBe(false);
        expect(c.live_flush_allowed).toBe(false);
        expect(c.audit_write_allowed).toBe(false);
        expect(c.persistence_allowed).toBe(false);
        expect(c.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});
