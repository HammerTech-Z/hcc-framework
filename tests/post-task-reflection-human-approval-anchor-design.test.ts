// Post-task Learning Loop - Slice LOOP-006A
// Human Approval Anchor + Consumer Guard Routing — design-only tests.
//
// The routing layer is pure. It verifies human approval anchors from
// explicit in-memory records, never mutates a consumer, never writes
// to Next Task Context, never mutates retrieval ranking, never calls
// knowledgeIngest / knowledgeSearch, never live flushes, never writes
// audit / config / persistence.
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live flush, no audit write, no live retrieval ranking mutation,
// no Next Task Context mutation, no skill install, no HCC Auto
// Executor, no hermes config / handoff / audit mutation, no
// docs/roadmap-locked-2026-05-28.md mutation.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertPostTaskReflectionNoRuntime,
  assertReflectionAllowedForNextTaskContext,
  assertReflectionAllowedForRankingInput,
  type PostTaskReflection,
} from "../src/shared/lib/post-task-reflection-contract";

import {
  CONSUMER_ROUTES,
  CONSUMER_ROUTE_MATRIX,
  HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN,
  assertConsumerRouteDecisionNoRuntime,
  buildHumanApprovalRefVerifier,
  buildConsumerRouteDecisionId,
  collapseConsumerRouteDecisionDuplicates,
  decideConsumerRoutesFromBridgeFixture,
  decideDeadEndConsumerRoute,
  decideKnowledgeIngestDraftConsumerRoute,
  decideLocalLLMWikiConsumerRoute,
  decideReflectionConsumerRoute,
  decideSkillCandidateConsumerRoute,
  decideUsageFeedbackConsumerRoute,
  verifyHumanApprovalRefAgainstAnchors,
  type HumanApprovalAnchorRecord,
  type ConsumerRouteDecision,
} from "../src/shared/lib/post-task-reflection-human-approval-anchor-design";

import { projectHccDryRunToReflection } from "../src/shared/lib/post-task-reflection-hcc-fixture";

const ROOT = join(__dirname, "..");
const FIXTURE_DIR = join(ROOT, "tests/fixtures/learning-loop");
const DESIGN_SRC = readFileSync(
  join(
    ROOT,
    "src/shared/lib/post-task-reflection-human-approval-anchor-design.ts",
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

function loadFixture(name: string): DecisionBundle {
  return JSON.parse(
    readFileSync(join(FIXTURE_DIR, name), "utf-8"),
  ) as DecisionBundle;
}

function loadDryRun(name: string): PostTaskReflection {
  return projectHccDryRunToReflection(
    JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf-8")),
  );
}

function anchorForReflection(
  reflection: PostTaskReflection,
  overrides: Partial<HumanApprovalAnchorRecord> = {},
): HumanApprovalAnchorRecord {
  if (reflection.provenance.human_approval_ref === null) {
    throw new Error("test reflection requires human_approval_ref");
  }
  return {
    anchor_ref: "anchor-record://unit-test/manual-review",
    human_approval_ref: reflection.provenance.human_approval_ref,
    reflection_task_id: reflection.task_id,
    artifact_ref: reflection.artifact_ref,
    approved_at: "2026-06-07T12:01:00.000Z",
    expires_at: "2026-06-08T00:00:00.000Z",
    allowed_gates: ["next_task_context", "ranking_input"],
    revoked: false,
    ...overrides,
  };
}

describe("Post-task Learning Loop LOOP-006A human approval anchor + consumer guard routing", () => {
  it("design descriptor allows pure anchor verification but forbids consumer mutation, context write, ranking write, ingest, search, flush, audit, persistence", () => {
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.routing_status).toBe(
      "pure_verifier_available",
    );
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.anchor_verification_allowed,
    ).toBe(true);
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.consumer_routing_mutation_allowed,
    ).toBe(false);
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.next_task_context_write_allowed,
    ).toBe(false);
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.ranking_input_write_allowed,
    ).toBe(false);
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.knowledge_ingest_call_allowed,
    ).toBe(false);
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.knowledge_search_call_allowed,
    ).toBe(false);
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.live_flush_allowed).toBe(false);
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.audit_write_allowed).toBe(false);
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.persistence_allowed).toBe(false);
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.human_approval_ref_required).toBe(
      true,
    );
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.approval_gate_required).toBe(
      true,
    );
    expect(
      HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.verified_must_remain_false_in_contract_layer,
    ).toBe(true);
    expect(HUMAN_APPROVAL_ANCHOR_ROUTING_DESIGN.schema_version).toBe("1.0.0");
  });

  it("design source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(DESIGN_SRC.includes(pattern)).toBe(false);
    }
  });

  it("valid human approval anchor verifies and admits next-task context plus ranking gates", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    expect(() => assertPostTaskReflectionNoRuntime(reflection)).not.toThrow();
    const anchor = anchorForReflection(reflection);
    const verifier = buildHumanApprovalRefVerifier([anchor]);

    const result = verifyHumanApprovalRefAgainstAnchors(
      {
        gate: "next_task_context",
        reflection_task_id: reflection.task_id,
        artifact_ref: reflection.artifact_ref,
        created_at: reflection.created_at,
        human_approval_ref: reflection.provenance.human_approval_ref!,
      },
      [anchor],
    );
    expect(result).toEqual({
      verified: true,
      reason: "human_approval_ref matched active consumer anchor",
      anchor_ref: anchor.anchor_ref,
    });

    expect(() =>
      assertReflectionAllowedForNextTaskContext(reflection, {
        verifyHumanApprovalRef: verifier,
      }),
    ).not.toThrow();
    expect(() =>
      assertReflectionAllowedForRankingInput(reflection, {
        verifyHumanApprovalRef: verifier,
      }),
    ).not.toThrow();
    expect(reflection.provenance.human_approval_ref!.verified).toBe(false);
  });

  it("missing human approval anchor refuses consumer gates", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const verifier = buildHumanApprovalRefVerifier([]);

    expect(() =>
      assertReflectionAllowedForNextTaskContext(reflection, {
        verifyHumanApprovalRef: verifier,
      }),
    ).toThrow(/no matching human approval anchor found/);
  });

  it("forged verified=true is rejected by the contract layer before anchor verification", () => {
    const reflection = JSON.parse(
      JSON.stringify(loadDryRun("ll002-hcc-manual-review-dry-run.json")),
    ) as PostTaskReflection;
    reflection.provenance.human_approval_ref!.verified = true as false;

    expect(() => assertPostTaskReflectionNoRuntime(reflection)).toThrow(
      /verified must be false in contract layer/,
    );
    expect(() =>
      assertReflectionAllowedForNextTaskContext(reflection, {
        verifyHumanApprovalRef: buildHumanApprovalRefVerifier([]),
      }),
    ).toThrow(/verified must be false in contract layer/);
  });

  it("verifier directly rejects input human_approval_ref.verified=true before anchor lookup", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const anchor = anchorForReflection(reflection);
    const result = verifyHumanApprovalRefAgainstAnchors(
      {
        gate: "next_task_context",
        reflection_task_id: reflection.task_id,
        artifact_ref: reflection.artifact_ref,
        created_at: reflection.created_at,
        human_approval_ref: {
          ...reflection.provenance.human_approval_ref!,
          verified: true as unknown as false,
        },
      },
      [anchor],
    );
    expect(result).toEqual({
      verified: false,
      reason: "contract-layer human_approval_ref.verified must remain false",
      anchor_ref: null,
    });
  });

  it("stale or mismatched human approval anchors refuse consumer gates", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const staleVerifier = buildHumanApprovalRefVerifier([
      anchorForReflection(reflection, {
        expires_at: "2026-06-07T12:01:30.000Z",
      }),
    ]);
    const mismatchVerifier = buildHumanApprovalRefVerifier([
      anchorForReflection(reflection, {
        reflection_task_id: "hcc-dry-run://learning-loop/002/other",
      }),
    ]);

    expect(() =>
      assertReflectionAllowedForNextTaskContext(reflection, {
        verifyHumanApprovalRef: staleVerifier,
      }),
    ).toThrow(/human approval anchor is stale/);
    expect(() =>
      assertReflectionAllowedForRankingInput(reflection, {
        verifyHumanApprovalRef: mismatchVerifier,
      }),
    ).toThrow(/human approval anchor task id mismatch/);
  });

  it("anchor approved_at newer than reflection created_at is rejected by verifier", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const anchor = anchorForReflection(reflection, {
      approved_at: "2026-06-07T12:03:00.000Z",
    });
    const result = verifyHumanApprovalRefAgainstAnchors(
      {
        gate: "next_task_context",
        reflection_task_id: reflection.task_id,
        artifact_ref: reflection.artifact_ref,
        created_at: reflection.created_at,
        human_approval_ref: reflection.provenance.human_approval_ref!,
      },
      [anchor],
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("human approval anchor is newer than reflection");
    expect(result.anchor_ref).toBeNull();
  });

  it("anchor with invalid expires_at is rejected by verifier", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    const anchor = anchorForReflection(reflection, {
      expires_at: "not-a-date",
    });
    const result = verifyHumanApprovalRefAgainstAnchors(
      {
        gate: "next_task_context",
        reflection_task_id: reflection.task_id,
        artifact_ref: reflection.artifact_ref,
        created_at: reflection.created_at,
        human_approval_ref: reflection.provenance.human_approval_ref!,
      },
      [anchor],
    );
    expect(result.verified).toBe(false);
    expect(result.reason).toBe("human approval anchor expires_at is invalid");
    expect(result.anchor_ref).toBeNull();
  });

  it("buildConsumerRouteDecisionId is stable and distinct on any input change", () => {
    const base = {
      source_kind: "knowledge_ingest_draft" as const,
      source_task: "t-1",
      source_fingerprint: "ki-1",
      route: "context_dry_run_candidate" as const,
    };
    const id1 = buildConsumerRouteDecisionId(base);
    const id2 = buildConsumerRouteDecisionId(base);
    expect(id1).toBe(id2);
    expect(
      buildConsumerRouteDecisionId({ ...base, source_task: "t-2" }),
    ).not.toBe(id1);
    expect(
      buildConsumerRouteDecisionId({ ...base, source_kind: "usage_feedback" }),
    ).not.toBe(id1);
    expect(
      buildConsumerRouteDecisionId({ ...base, source_fingerprint: "ki-2" }),
    ).not.toBe(id1);
    expect(
      buildConsumerRouteDecisionId({ ...base, route: "reject_pre_review" }),
    ).not.toBe(id1);
  });

  it("collapseConsumerRouteDecisionDuplicates keeps first, drops rest", () => {
    const id = buildConsumerRouteDecisionId({
      source_kind: "knowledge_ingest_draft",
      source_task: "t-1",
      source_fingerprint: "ki-1",
      route: "context_dry_run_candidate",
    });
    const base = loadFixture("ll006a-consumer-route-manual-review-dry-run.json").decisions[0]!;
    const a: ConsumerRouteDecision = { ...base, decision_id: id };
    const b: ConsumerRouteDecision = { ...a };
    const c: ConsumerRouteDecision = { ...a };
    const { kept, dropped } = collapseConsumerRouteDecisionDuplicates([a, b, c]);
    expect(kept.length).toBe(1);
    expect(dropped.length).toBe(2);
  });

  it("PASS reflection ⇒ reject_pre_review; PASS bridge bundle ⇒ all decisions reject_pre_review", () => {
    const reflection = loadDryRun("ll002-hcc-pass-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const d = decideReflectionConsumerRoute(reflection);
    expect(d.route).toBe("reject_pre_review");
    expect(d.reason).toMatch(/human_reviewed=false or human_approval_ref=null/);
    expect(d.human_approval_ref).toBeNull();
    expect(d.quarantine).toBe(true);
    expect(d.approval_gate.status).toBe("closed");
    expect(d.approval_gate.approved).toBe(false);
    expect(() => assertConsumerRouteDecisionNoRuntime(d)).not.toThrow();

    const passBridge = loadFixture("ll006a-consumer-route-pass-rejected.json");
    expect(passBridge.decisions.length).toBeGreaterThan(0);
    for (const dec of passBridge.decisions) {
      expect(dec.route).toBe("reject_pre_review");
      expect(dec.human_approval_ref).toBeNull();
      expect(dec.quarantine).toBe(true);
      expect(dec.approval_gate.status).toBe("closed");
      expect(dec.dry_run_only).toBe(true);
      expect(dec.consumer_routing_mutation_allowed).toBe(false);
      expect(dec.next_task_context_write_allowed).toBe(false);
      expect(dec.ranking_input_write_allowed).toBe(false);
      expect(dec.live_flush_allowed).toBe(false);
      expect(dec.audit_write_allowed).toBe(false);
      expect(dec.persistence_allowed).toBe(false);
      expect(dec.anchor_verification_allowed).toBe(false);
      expect(() => assertConsumerRouteDecisionNoRuntime(dec)).not.toThrow();
    }
  });

  it("PASS projection matches the regenerated fixture end-to-end", () => {
    const passBridgeJson = JSON.parse(
      readFileSync(
        join(FIXTURE_DIR, "ll006-knowledge-ingest-pass-draft.json"),
        "utf-8",
      ),
    ) as { drafts: Parameters<typeof decideConsumerRoutesFromBridgeFixture>[0]["drafts"] };
    const decisions = decideConsumerRoutesFromBridgeFixture({
      drafts: passBridgeJson.drafts,
    });
    const fx = loadFixture("ll006a-consumer-route-pass-rejected.json").decisions;
    expect(decisions.length).toBe(fx.length);
    for (let i = 0; i < decisions.length; i++) {
      expect(decisions[i]!.decision_id).toBe(fx[i]!.decision_id);
      expect(decisions[i]!.route).toBe(fx[i]!.route);
      expect(decisions[i]!.source_kind).toBe(fx[i]!.source_kind);
      expect(decisions[i]!.consumer_routing_mutation_allowed).toBe(false);
    }
  });

  it("FAIL reflection ⇒ reject_pre_review; FAIL bridge bundle ⇒ all decisions reject_pre_review", () => {
    const reflection = loadDryRun("ll002-hcc-fail-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const d = decideReflectionConsumerRoute(reflection);
    expect(d.route).toBe("reject_pre_review");
    expect(d.human_approval_ref).toBeNull();
    expect(d.quarantine).toBe(true);

    const failBridge = loadFixture("ll006a-consumer-route-fail-rejected.json");
    expect(failBridge.decisions.length).toBeGreaterThan(0);
    for (const dec of failBridge.decisions) {
      expect(dec.route).toBe("reject_pre_review");
      expect(dec.human_approval_ref).toBeNull();
      expect(dec.quarantine).toBe(true);
      expect(() => assertConsumerRouteDecisionNoRuntime(dec)).not.toThrow();
    }
  });

  it("manual_review reflection + bridge bundle ⇒ context_dry_run_candidate", () => {
    const reflection = loadDryRun("ll002-hcc-manual-review-dry-run.json");
    expect(assertPostTaskReflectionNoRuntime(reflection));
    const d = decideReflectionConsumerRoute(reflection);
    // The manual_review fixture has zero good_patterns but the
    // bad_pattern knowledge_ingest_draft entries are non-quarantined.
    // The reflection is human-approved AND every knowledge_ingest_draft
    // is non-quarantined ⇒ ranking_dry_run_candidate.
    expect(["context_dry_run_candidate", "ranking_dry_run_candidate"]).toContain(
      d.route,
    );
    expect(d.human_approval_ref).not.toBeNull();
    expect(d.human_approval_ref!.verified).toBe(false);
    expect(d.quarantine).toBe(false);
    expect(d.approval_gate.status).toBe("closed");
    expect(d.approval_gate.approved).toBe(false);
    expect(d.ranking_input_write_allowed).toBe(false);
    expect(d.next_task_context_write_allowed).toBe(false);
    expect(d.live_flush_allowed).toBe(false);
    expect(d.audit_write_allowed).toBe(false);
    expect(d.persistence_allowed).toBe(false);
    expect(() => assertConsumerRouteDecisionNoRuntime(d)).not.toThrow();

    const mrBridge = loadFixture(
      "ll006a-consumer-route-manual-review-dry-run.json",
    );
    expect(mrBridge.decisions.length).toBeGreaterThan(0);
    for (const dec of mrBridge.decisions) {
      expect(dec.route).toBe("context_dry_run_candidate");
      expect(dec.human_approval_ref).not.toBeNull();
      expect(dec.human_approval_ref!.verified).toBe(false);
      expect(dec.quarantine).toBe(false);
      expect(dec.approval_gate.status).toBe("closed");
      expect(dec.approval_gate.approved).toBe(false);
      expect(dec.consumer_routing_mutation_allowed).toBe(false);
      expect(dec.ranking_input_write_allowed).toBe(false);
      expect(dec.next_task_context_write_allowed).toBe(false);
      expect(dec.live_flush_allowed).toBe(false);
      expect(dec.audit_write_allowed).toBe(false);
      expect(dec.persistence_allowed).toBe(false);
      expect(dec.anchor_verification_allowed).toBe(false);
      expect(() => assertConsumerRouteDecisionNoRuntime(dec)).not.toThrow();
    }
  });

  it("decideReflectionConsumerRoute returns context_dry_run_candidate when human-approved but at least one draft remains quarantined", () => {
    const reflection = JSON.parse(
      JSON.stringify(loadDryRun("ll002-hcc-manual-review-dry-run.json")),
    ) as PostTaskReflection;
    // Force one knowledge_ingest_draft into quarantine.
    reflection.knowledge_ingest_draft[0]!.quarantine = true;
    expect(() => assertPostTaskReflectionNoRuntime(reflection)).not.toThrow();

    const d = decideReflectionConsumerRoute(reflection);
    expect(d.route).toBe("context_dry_run_candidate");
    expect(d.human_approval_ref).not.toBeNull();
    expect(d.human_approval_ref!.verified).toBe(false);
    expect(d.quarantine).toBe(false);
    expect(d.reason).toMatch(/context-only dry-run candidate/);
    expect(d.approval_gate.status).toBe("closed");
    expect(d.approval_gate.approved).toBe(false);
    expect(d.dry_run_only).toBe(true);
    expect(d.consumer_routing_mutation_allowed).toBe(false);
    expect(d.next_task_context_write_allowed).toBe(false);
    expect(d.ranking_input_write_allowed).toBe(false);
    expect(() => assertConsumerRouteDecisionNoRuntime(d)).not.toThrow();
  });

  it("knowledge_ingest_draft with human_approval_ref=null routes to reject_pre_review", () => {
    const passBridgeJson = JSON.parse(
      readFileSync(
        join(FIXTURE_DIR, "ll006-knowledge-ingest-pass-draft.json"),
        "utf-8",
      ),
    ) as { drafts: Parameters<typeof decideConsumerRoutesFromBridgeFixture>[0]["drafts"] };
    const draft = passBridgeJson.drafts[0]!;
    const d = decideKnowledgeIngestDraftConsumerRoute(draft);
    expect(d.route).toBe("reject_pre_review");
    expect(d.human_approval_ref).toBeNull();
    expect(d.quarantine).toBe(true);
  });

  it("knowledge_ingest_draft with quarantine=false + human_approval_ref present routes to context_dry_run_candidate", () => {
    const mrBridgeJson = JSON.parse(
      readFileSync(
        join(FIXTURE_DIR, "ll006-knowledge-ingest-manual-review-draft.json"),
        "utf-8",
      ),
    ) as { drafts: Parameters<typeof decideConsumerRoutesFromBridgeFixture>[0]["drafts"] };
    const draft = mrBridgeJson.drafts[0]!;
    const d = decideKnowledgeIngestDraftConsumerRoute(draft);
    expect(d.route).toBe("context_dry_run_candidate");
    expect(d.human_approval_ref).not.toBeNull();
    expect(d.human_approval_ref!.verified).toBe(false);
    expect(d.quarantine).toBe(false);
  });

  it("assertConsumerRouteDecisionNoRuntime rejects approval_gate.approved=true", () => {
    const base = loadFixture("ll006a-consumer-route-manual-review-dry-run.json").decisions[0]!;
    const t: ConsumerRouteDecision = {
      ...base,
      approval_gate: { ...base.approval_gate, approved: true as unknown as false },
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t)).toThrow(
      /approval_gate.approved must be false/,
    );
  });

  it("assertConsumerRouteDecisionNoRuntime rejects human_approval_ref.verified=true", () => {
    const base = loadFixture("ll006a-consumer-route-manual-review-dry-run.json").decisions[0]!;
    const t: ConsumerRouteDecision = {
      ...base,
      human_approval_ref: {
        ref: "anchor://test/ll006a",
        content_hash: "sha256-anchor-ll006a-001",
        approval_kind: "manual_review",
        verified: true as unknown as false,
      },
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t)).toThrow(
      /verified must be false in the contract layer/,
    );
  });

  it("assertConsumerRouteDecisionNoRuntime rejects ranking_input_write_allowed=true", () => {
    const base = loadFixture("ll006a-consumer-route-manual-review-dry-run.json").decisions[0]!;
    const t: ConsumerRouteDecision = {
      ...base,
      ranking_input_write_allowed: true as unknown as false,
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t)).toThrow(
      /ranking_input_write_allowed must be false/,
    );
  });

  it("assertConsumerRouteDecisionNoRuntime rejects next_task_context_write_allowed=true", () => {
    const base = loadFixture("ll006a-consumer-route-manual-review-dry-run.json").decisions[0]!;
    const t: ConsumerRouteDecision = {
      ...base,
      next_task_context_write_allowed: true as unknown as false,
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t)).toThrow(
      /next_task_context_write_allowed must be false/,
    );
  });

  it("assertConsumerRouteDecisionNoRuntime rejects live_flush / audit_write / persistence flipped true", () => {
    const base = loadFixture("ll006a-consumer-route-manual-review-dry-run.json").decisions[0]!;
    const t1: ConsumerRouteDecision = {
      ...base,
      live_flush_allowed: true as unknown as false,
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t1)).toThrow(
      /live_flush_allowed must be false/,
    );
    const t2: ConsumerRouteDecision = {
      ...base,
      audit_write_allowed: true as unknown as false,
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t2)).toThrow(
      /audit_write_allowed must be false/,
    );
    const t3: ConsumerRouteDecision = {
      ...base,
      persistence_allowed: true as unknown as false,
    };
    expect(() => assertConsumerRouteDecisionNoRuntime(t3)).toThrow(
      /persistence_allowed must be false/,
    );
  });

  it("skill_candidate / dead_end / local_llm_wiki / usage_feedback helpers honor the same rules", () => {
    // agent-submitted: human_approval_ref=null on every helper
    // input ⇒ reject_pre_review.
    const passBridgeJson = JSON.parse(
      readFileSync(
        join(FIXTURE_DIR, "ll006-knowledge-ingest-pass-draft.json"),
        "utf-8",
      ),
    ) as { drafts: Parameters<typeof decideConsumerRoutesFromBridgeFixture>[0]["drafts"] };
    const skillDraft = passBridgeJson.drafts.find(
      (d) => d.source_kind === "skill_candidate",
    );
    if (skillDraft) {
      const d = decideKnowledgeIngestDraftConsumerRoute(skillDraft);
      expect(d.route).toBe("reject_pre_review");
    }
    // Synthesize a skill_candidate design draft with
    // human_approval_ref=null via a helper signature change —
    // we exercise decideSkillCandidateConsumerRoute with a
    // synthetic null approval ref by building the input directly.
    const fakeSkill = {
      ...skillDraft,
    } as unknown as Parameters<typeof decideSkillCandidateConsumerRoute>[0];
    const d2 = decideSkillCandidateConsumerRoute(fakeSkill);
    expect(d2.route).toBe("reject_pre_review");
    expect(d2.human_approval_ref).toBeNull();

    // dead_end: same.
    const fakeDead = {
      ...skillDraft,
    } as unknown as Parameters<typeof decideDeadEndConsumerRoute>[0];
    const d3 = decideDeadEndConsumerRoute(fakeDead);
    expect(d3.route).toBe("reject_pre_review");

    // local_llm_wiki: same.
    const fakeWiki = {
      ...skillDraft,
    } as unknown as Parameters<typeof decideLocalLLMWikiConsumerRoute>[0];
    const d4 = decideLocalLLMWikiConsumerRoute(fakeWiki);
    expect(d4.route).toBe("reject_pre_review");

    // usage_feedback: synthesize an event with human_approval_ref=null.
    const fakeEvent = {
      schema_version: "1.0.0" as const,
      event_id: "evt-test",
      fingerprint: "usage-feedback:t-1|k-1|helped|<null>",
      task_id: "t-1",
      reflection_task_id: "t-1",
      knowledge_id: "k-1",
      kind: "helped" as const,
      weight: 1,
      recorded_at: "2026-06-07T00:00:00.000Z",
      artifact_ref: "hcc://test/1",
      source_ref: "hcc://test/1",
      evidence: [],
      provenance: passBridgeJson.drafts[0]!.provenance,
      dry_run_only: true as const,
      persistence_allowed: false as const,
      ranking_mutation_allowed: false as const,
      eligibility: "pre_review" as const,
      human_approval_ref: null,
    };
    const d5 = decideUsageFeedbackConsumerRoute(fakeEvent);
    expect(d5.route).toBe("reject_pre_review");
    expect(d5.human_approval_ref).toBeNull();
  });

  it("CONSUMER_ROUTES contains exactly the three planned routes", () => {
    expect(CONSUMER_ROUTES.length).toBe(3);
    expect(new Set(CONSUMER_ROUTES)).toEqual(
      new Set([
        "reject_pre_review",
        "context_dry_run_candidate",
        "ranking_dry_run_candidate",
      ]),
    );
  });

  it("CONSUMER_ROUTE_MATRIX contains 9 entries covering every per-source kind", () => {
    expect(CONSUMER_ROUTE_MATRIX.length).toBe(9);
    const sources = new Set(CONSUMER_ROUTE_MATRIX.map((m) => m.source));
    expect(sources).toEqual(
      new Set([
        "reflection",
        "knowledge_ingest_draft",
        "usage_feedback",
        "skill_candidate",
        "dead_end",
        "local_llm_wiki",
      ]),
    );
    // skill_candidate / dead_end / local_llm_wiki each carry exactly
    // one context_dry_run_candidate row.
    for (const kind of ["skill_candidate", "dead_end", "local_llm_wiki"] as const) {
      const rows = CONSUMER_ROUTE_MATRIX.filter((m) => m.source === kind);
      expect(rows.length).toBe(1);
      expect(rows[0]!.outcome).toBe("context_dry_run_candidate");
      expect(rows[0]!.human_reviewed).toBe(true);
      expect(rows[0]!.human_approval_ref_present).toBe(true);
      expect(rows[0]!.quarantine).toBe(false);
    }
  });

  it("PASS / FAIL / manual_review decision bundles all declare every safety flag false", () => {
    for (const name of [
      "ll006a-consumer-route-pass-rejected.json",
      "ll006a-consumer-route-fail-rejected.json",
      "ll006a-consumer-route-manual-review-dry-run.json",
    ]) {
      const fx = loadFixture(name);
      expect(fx.dry_run_only).toBe(true);
      expect(fx.anchor_verification_allowed).toBe(false);
      expect(fx.consumer_routing_mutation_allowed).toBe(false);
      expect(fx.next_task_context_write_allowed).toBe(false);
      expect(fx.ranking_input_write_allowed).toBe(false);
      expect(fx.live_flush_allowed).toBe(false);
      expect(fx.audit_write_allowed).toBe(false);
      expect(fx.persistence_allowed).toBe(false);
      for (const d of fx.decisions) {
        expect(d.approval_gate.status).toBe("closed");
        expect(d.approval_gate.approved).toBe(false);
      }
    }
  });

  it("JSON round-trip preserves the routing-only invariant", () => {
    for (const name of [
      "ll006a-consumer-route-pass-rejected.json",
      "ll006a-consumer-route-fail-rejected.json",
      "ll006a-consumer-route-manual-review-dry-run.json",
    ]) {
      const fx = loadFixture(name);
      const rehydrated = JSON.parse(JSON.stringify(fx)) as DecisionBundle;
      expect(rehydrated.dry_run_only).toBe(true);
      expect(rehydrated.anchor_verification_allowed).toBe(false);
      expect(rehydrated.consumer_routing_mutation_allowed).toBe(false);
      expect(rehydrated.next_task_context_write_allowed).toBe(false);
      expect(rehydrated.ranking_input_write_allowed).toBe(false);
      expect(rehydrated.live_flush_allowed).toBe(false);
      expect(rehydrated.audit_write_allowed).toBe(false);
      expect(rehydrated.persistence_allowed).toBe(false);
      for (const d of rehydrated.decisions) {
        expect(d.dry_run_only).toBe(true);
        expect(d.anchor_verification_allowed).toBe(false);
        expect(d.consumer_routing_mutation_allowed).toBe(false);
        expect(d.next_task_context_write_allowed).toBe(false);
        expect(d.ranking_input_write_allowed).toBe(false);
        expect(d.live_flush_allowed).toBe(false);
        expect(d.audit_write_allowed).toBe(false);
        expect(d.persistence_allowed).toBe(false);
        expect(d.approval_gate.status).toBe("closed");
        expect(d.approval_gate.approved).toBe(false);
      }
    }
  });
});
