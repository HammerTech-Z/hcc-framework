// Post-task Learning Loop - Slice LOOP-001
// Contract tests for provenance, evidence hashes, quarantine, secret
// scan, ApprovalGate, and no-runtime safety flags.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

import {
  assertPostTaskReflectionNoRuntime,
  buildPostTaskReflection,
  buildPostTaskReflectionFixtures,
  extractDeadEndDrafts,
  extractKnowledgeIngestDrafts,
  extractModelFeedback,
  extractSkillCandidateDrafts,
  extractUsageFeedbackSignals,
  POST_TASK_REFLECTION_APPROVAL_GATE,
  POST_TASK_REFLECTION_MODE,
  POST_TASK_REFLECTION_SAFETY,
  POST_TASK_REFLECTION_SCHEMA_VERSION,
  type EvidenceRef,
  type PostTaskReflection,
  type Provenance,
  type ReflectionGoodPattern,
  type ReflectionKnowledgeDraft,
} from "../src/shared/lib/post-task-reflection-contract";

const ROOT = join(__dirname, "..");
const contractSrc = readFileSync(
  join(ROOT, "src/shared/lib/post-task-reflection-contract.ts"),
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

const provenance: Provenance = {
  generated_by: "hermes",
  generation_model: "test-fixture",
  dual_reviewed: false,
  human_reviewed: false,
  trust_level: "single_run",
};

const evidence: EvidenceRef = {
  kind: "artifact",
  ref: "hcc://test/artifact",
  content_hash: "sha256-test-artifact",
  excerpt: "redacted",
};

function goodPattern(
  overrides: Partial<ReflectionGoodPattern> = {},
): ReflectionGoodPattern {
  return {
    fingerprint: "good-test-pattern",
    summary: "summary",
    human_readable_summary: "plain summary",
    reuse_scope: "unit tests",
    trigger_conditions: ["test condition"],
    counterexamples: ["not for live writes"],
    risks: ["can overfit a fixture"],
    evidence: [evidence],
    provenance,
    ...overrides,
  };
}

function knowledgeDraft(
  overrides: Partial<ReflectionKnowledgeDraft> = {},
): ReflectionKnowledgeDraft {
  return {
    draft_kind: "fact",
    body: "Draft-only reflection fact.",
    links_back_to_task: "task-1",
    evidence: [evidence],
    provenance,
    secret_scan: {
      scanned: true,
      passed: true,
      method: "unit-test",
    },
    quarantine: true,
    runtime_flush_allowed: false,
    ...overrides,
  };
}

function baseReflection(): PostTaskReflection {
  return buildPostTaskReflection({
    task_id: "task-1",
    created_at: "2026-06-07T00:00:00.000Z",
    artifact_ref: "hcc://test/artifact",
    artifact_hash: "sha256-test-artifact",
    task_summary: "summary",
    verification_result: "pass",
    good_patterns: [goodPattern()],
    knowledge_ingest_draft: [knowledgeDraft()],
    provenance,
  });
}

describe("Post-task Learning Loop LOOP-001 reflection contract", () => {
  it("declares contract mode and schema version", () => {
    expect(POST_TASK_REFLECTION_MODE).toBe("post_task_reflection_contract_only");
    expect(POST_TASK_REFLECTION_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("uses granular safety flags instead of a single runtime_write_allowed flag", () => {
    expect(POST_TASK_REFLECTION_SAFETY).toEqual({
      knowledge_flush_allowed: false,
      skill_install_allowed: false,
      config_write_allowed: false,
      hcc_execute_allowed: false,
      model_runtime_start_allowed: false,
    });
    expect(baseReflection()).not.toHaveProperty("runtime_write_allowed");
  });

  it("keeps the ApprovalGate closed by default", () => {
    expect(POST_TASK_REFLECTION_APPROVAL_GATE).toEqual({
      gate_version: "1.0.0",
      status: "closed",
      approved: false,
      explicit_user_approval_required: true,
      allowed_action: "none",
      safety: POST_TASK_REFLECTION_SAFETY,
    });
    expect(baseReflection().approval_gate.approved).toBe(false);
  });

  it("buildPostTaskReflection requires task_id and task_summary", () => {
    expect(() =>
      buildPostTaskReflection({
        task_id: "",
        task_summary: "x",
        artifact_ref: null,
        verification_result: "pass",
        provenance,
      }),
    ).toThrow(/task_id is required/);

    expect(() =>
      buildPostTaskReflection({
        task_id: "task-1",
        task_summary: "",
        artifact_ref: null,
        verification_result: "pass",
        provenance,
      }),
    ).toThrow(/task_summary is required/);
  });

  it("requires provenance and trust_level at the reflection level", () => {
    const r = baseReflection() as unknown as Record<string, unknown>;
    delete r.provenance;
    expect(() => assertPostTaskReflectionNoRuntime(r)).toThrow(
      /reflection\.provenance is required/,
    );

    const missingTrust = baseReflection() as unknown as {
      provenance: Partial<Provenance>;
    };
    delete missingTrust.provenance.trust_level;
    expect(() => assertPostTaskReflectionNoRuntime(missingTrust)).toThrow(
      /trust_level is required/,
    );
  });

  it("requires evidence content_hash on every nested evidence ref", () => {
    const r = baseReflection() as unknown as {
      good_patterns: Array<{ evidence: Array<Partial<EvidenceRef>> }>;
    };
    delete r.good_patterns[0]!.evidence[0]!.content_hash;
    expect(() => assertPostTaskReflectionNoRuntime(r)).toThrow(
      /content_hash is required/,
    );
  });

  it("rejects any forged safety flag set to true after deserialization", () => {
    const r = baseReflection() as unknown as {
      safety: Record<string, unknown>;
    };
    r.safety.knowledge_flush_allowed = true;
    expect(() => assertPostTaskReflectionNoRuntime(r)).toThrow(
      /knowledge_flush_allowed must be false/,
    );
  });

  it("rejects any forged ApprovalGate approval after deserialization", () => {
    const r = baseReflection() as unknown as {
      approval_gate: Record<string, unknown>;
    };
    r.approval_gate.approved = true;
    expect(() => assertPostTaskReflectionNoRuntime(r)).toThrow(
      /approval_gate\.approved must be false/,
    );
  });

  it("keeps knowledge drafts quarantined unless human reviewed", () => {
    const r = baseReflection();
    expect(r.knowledge_ingest_draft[0]!.quarantine).toBe(true);

    const forged = baseReflection() as unknown as {
      knowledge_ingest_draft: Array<{ quarantine: boolean }>;
    };
    forged.knowledge_ingest_draft[0]!.quarantine = false;
    expect(() => assertPostTaskReflectionNoRuntime(forged)).toThrow(
      /quarantine=false requires human_reviewed=true/,
    );
  });

  it("allows quarantine=false only for human-reviewed knowledge drafts", () => {
    const r = buildPostTaskReflection({
      task_id: "task-human-reviewed",
      task_summary: "summary",
      artifact_ref: null,
      verification_result: "manual_review",
      provenance: {
        ...provenance,
        generated_by: "human",
        dual_reviewed: true,
        human_reviewed: true,
        trust_level: "human_confirmed",
      },
      knowledge_ingest_draft: [
        knowledgeDraft({
          quarantine: false,
          provenance: {
            ...provenance,
            generated_by: "human",
            dual_reviewed: true,
            human_reviewed: true,
            trust_level: "human_confirmed",
          },
        }),
      ],
    });
    expect(r.knowledge_ingest_draft[0]!.quarantine).toBe(false);
  });

  it("rejects knowledge drafts with secret scan not passed", () => {
    expect(() =>
      buildPostTaskReflection({
        task_id: "task-secret-scan-fail",
        task_summary: "summary",
        artifact_ref: null,
        verification_result: "pass",
        provenance,
        knowledge_ingest_draft: [
          knowledgeDraft({
            secret_scan: {
              scanned: true,
              passed: false,
              method: "unit-test",
            },
          }),
        ],
      }),
    ).toThrow(/secret_scan\.passed must be true/);
  });

  it("rejects model feedback with secret scan not passed", () => {
    const r = baseReflection() as unknown as {
      model_feedback: Array<Record<string, unknown>>;
    };
    r.model_feedback = [
      {
        task_class: "coding",
        model_id: "model-a",
        outcome: "fail",
        evidence: [evidence],
        provenance,
        secret_scan: {
          scanned: true,
          passed: false,
          method: "unit-test",
        },
      },
    ];
    expect(() => assertPostTaskReflectionNoRuntime(r)).toThrow(
      /model_feedback\[0\]\.secret_scan\.passed must be true/,
    );
  });

  it("rejects secret-like text in model feedback and knowledge drafts", () => {
    expect(() =>
      buildPostTaskReflection({
        task_id: "task-secret-body",
        task_summary: "summary",
        artifact_ref: null,
        verification_result: "pass",
        provenance,
        knowledge_ingest_draft: [
          knowledgeDraft({
            body: "token=abc should never be stored",
          }),
        ],
      }),
    ).toThrow(/contains secret-like material/);

    const r = baseReflection() as unknown as {
      model_feedback: Array<Record<string, unknown>>;
    };
    r.model_feedback = [
      {
        task_class: "coding",
        model_id: "model-a",
        outcome: "fail",
        observed_limitation: "api_key=abc leaked",
        evidence: [evidence],
        provenance,
        secret_scan: {
          scanned: true,
          passed: true,
          method: "unit-test",
        },
      },
    ];
    expect(() => assertPostTaskReflectionNoRuntime(r)).toThrow(
      /contains secret-like material/,
    );
  });

  it("PASS fixture has reusable skill candidates but install remains forbidden", () => {
    const fx = buildPostTaskReflectionFixtures();
    expect(fx.pass.verification_result).toBe("pass");
    expect(fx.pass.skill_candidates.length).toBeGreaterThan(0);
    for (const draft of fx.pass.skill_candidates) {
      expect(draft.install_allowed).toBe(false);
      expect(draft.provenance.trust_level).toBeTruthy();
      expect(draft.evidence[0]!.content_hash).toBeTruthy();
    }
  });

  it("FAIL fixture classifies bad patterns and dead ends", () => {
    const fx = buildPostTaskReflectionFixtures();
    expect(fx.fail.verification_result).toBe("fail");
    expect(fx.fail.bad_patterns.length).toBeGreaterThan(0);
    expect(fx.fail.dead_ends[0]!.failure_class).toBe("environmental");
    expect(fx.fail.dead_ends[0]!.recurrence_count).toBe(1);
    expect(fx.fail.dead_ends[0]!.proposed_action).toBe("warn_only");
  });

  it("manual_review fixture may include human-reviewed non-quarantined draft but still no live flush", () => {
    const fx = buildPostTaskReflectionFixtures();
    expect(fx.manualReview.verification_result).toBe("manual_review");
    expect(fx.manualReview.knowledge_ingest_draft[0]!.quarantine).toBe(false);
    expect(fx.manualReview.knowledge_ingest_draft[0]!.runtime_flush_allowed).toBe(
      false,
    );
    expect(fx.manualReview.provenance.human_reviewed).toBe(true);
  });

  it("projection helpers return clones and preserve no-runtime flags", () => {
    const fx = buildPostTaskReflectionFixtures();
    const skills = extractSkillCandidateDrafts(fx.pass);
    const deadEnds = extractDeadEndDrafts(fx.fail);
    const feedback = extractModelFeedback(fx.fail);
    const drafts = extractKnowledgeIngestDrafts(fx.pass);
    const signals = extractUsageFeedbackSignals(fx.pass);

    expect(skills[0]!.install_allowed).toBe(false);
    expect(deadEnds[0]!.evidence[0]!.content_hash).toBe("sha256-fail-001");
    expect(feedback[0]!.secret_scan.passed).toBe(true);
    expect(drafts[0]!.runtime_flush_allowed).toBe(false);
    expect(signals[0]!.kind).toBe("helped");

    skills[0]!.non_goals.push("mutated");
    expect(fx.pass.skill_candidates[0]!.non_goals).not.toContain("mutated");
  });

  it("buildPostTaskReflection is deterministic and clones input arrays", () => {
    const input = {
      task_id: "task-det",
      task_summary: "summary",
      artifact_ref: null,
      artifact_hash: null,
      verification_result: "pass" as const,
      good_patterns: [goodPattern()],
      reused_knowledge: ["k1"],
      provenance,
    };
    const a = buildPostTaskReflection(input);
    const b = buildPostTaskReflection(input);
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.good_patterns).not.toBe(b.good_patterns);

    a.good_patterns[0]!.trigger_conditions.push("mutated");
    expect(input.good_patterns[0]!.trigger_conditions).not.toContain("mutated");
  });

  it("all fixtures pass the runtime guard", () => {
    const fx = buildPostTaskReflectionFixtures();
    const all: PostTaskReflection[] = [fx.pass, fx.fail, fx.manualReview];
    for (const r of all) {
      expect(() => assertPostTaskReflectionNoRuntime(r)).not.toThrow();
      expect(r.mode).toBe("post_task_reflection_contract_only");
      expect(r.schema_version).toBe("1.0.0");
      expect(r.safety.knowledge_flush_allowed).toBe(false);
    }
  });

  it("source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      expect(contractSrc.includes(pattern)).toBe(false);
    }
  });
});
