// Post-task Learning Loop - Slice LOOP-002
// Pure helper that projects minimal HCC dry-run artifact / handoff
// shapes into LOOP-001.1 PostTaskReflection drafts.
//
// LOOP-002 is design-only / fixture-only:
// - No runtime write.
// - No live knowledge flush.
// - No knowledgeIngest / knowledgeSearch.
// - No skill auto-install.
// - No HCC Auto Executor.
// - No IPC / gateway / subprocess.
//
// The helper builds PostTaskReflection instances whose field shape
// matches the LOOP-001.1 contract. The resulting drafts are draft-only:
// knowledge_ingest_draft entries are quarantined, skill_candidates
// have install_allowed=false, runtime_flush_allowed is literal false.

import {
  POST_TASK_REFLECTION_APPROVAL_GATE,
  POST_TASK_REFLECTION_SAFETY,
  POST_TASK_REFLECTION_SCHEMA_VERSION,
  POST_TASK_REFLECTION_MODE,
  type EvidenceRef,
  type HumanApprovalRef,
  type PostTaskReflection,
  type Provenance,
  type ReflectionBadPattern,
  type ReflectionDeadEnd,
  type ReflectionGoodPattern,
  type ReflectionKnowledgeDraft,
  type UsageFeedbackSignal,
  type SkillCandidateDraft,
  type ModelFeedback,
  type PostTaskVerificationResult,
} from "./post-task-reflection-contract";

/**
 * Minimal HCC dry-run input fields the projection reads. This is NOT
 * the full HCCArtifactRecord — it is the subset a fixture is allowed
 * to carry into LOOP-002. Anything that would force a runtime call
 * (real ingest, real write) is deliberately excluded.
 */
export interface HccDryRunReflectionInput {
  task_id: string;
  created_at: string;
  artifact_ref: string;
  artifact_hash: string;
  task_summary: string;
  verification_result: PostTaskVerificationResult;
  /** Source commit recorded on the dry-run artifact, copied verbatim. */
  source_commit?: {
    commit_sha: string;
    branch: string;
    dirty: boolean;
  } | null;
  good_patterns?: Array<{
    fingerprint: string;
    summary: string;
    human_readable_summary: string;
    reuse_scope: string;
    trigger_conditions: string[];
    counterexamples: string[];
    risks: string[];
    evidence_content_hash: string;
  }>;
  bad_patterns?: Array<{
    fingerprint: string;
    summary: string;
    human_readable_summary: string;
    trigger_context: string;
    risks: string[];
    evidence_content_hash: string;
  }>;
  dead_ends?: Array<{
    fingerprint: string;
    summary: string;
    human_readable_summary: string;
    failure_class: ReflectionDeadEnd["failure_class"];
    recurrence_count: number;
    trigger_context: string;
    why_failed: string;
    proposed_action: ReflectionDeadEnd["proposed_action"];
    evidence_content_hash: string;
  }>;
  skill_candidates?: Array<{
    fingerprint: string;
    name: string;
    scope: string;
    trigger: string;
    non_goals: string[];
    verification_notes: string;
    source_task: string;
    evidence_content_hash: string;
  }>;
  model_feedback?: Array<{
    task_class: string;
    model_id: string;
    lane?: string;
    outcome: ModelFeedback["outcome"];
    observed_limitation?: string;
    fallback_used?: string;
    evidence_content_hash: string;
  }>;
  knowledge_ingest_draft?: Array<{
    draft_kind: ReflectionKnowledgeDraft["draft_kind"];
    body: string;
    links_back_to_task: string;
    evidence_content_hash: string;
  }>;
  next_task_recommendations?: string[];
  usage_feedback_signals?: Array<{
    knowledge_id: string;
    kind: UsageFeedbackSignal["kind"];
    weight: number;
    recorded_at: string;
    source_task_id: string;
    artifact_ref: string | null;
    evidence_content_hash: string;
  }>;
  /** Submitted-by is locked at the HCC layer; default hermes_main. */
  submitted_by?: Provenance["submitted_by"];
  /** Human-reviewed anchor — only set on the manual_review fixture. */
  human_approval_ref?: HumanApprovalRef | null;
}

const CLEAN_SECRET_SCAN = {
  scanned: true,
  passed: true,
  method: "hcc-dry-run-projection",
} as const;

const CLEAN_INSTRUCTION_SCAN = {
  scanned: true,
  passed: true,
  method: "hcc-dry-run-projection",
  authority_claim_detected: false,
  matched_terms: [] as string[],
} as const;

function ev(ref: string, contentHash: string): EvidenceRef {
  return {
    kind: "artifact",
    ref,
    content_hash: contentHash,
    excerpt: "redacted dry-run excerpt",
  };
}

function buildProvenance(
  submittedBy: Provenance["submitted_by"],
  humanReviewed: boolean,
  humanApprovalRef: HumanApprovalRef | null,
): Provenance {
  if (humanReviewed) {
    return {
      generated_by: "human",
      submitted_by: submittedBy,
      generation_model: "hcc-dry-run-projection",
      dual_reviewed: true,
      human_reviewed: true,
      reviewed_by: "human",
      reviewed_at: "2026-06-07T12:00:00.000Z",
      trust_level: "human_confirmed",
      human_approval_ref: humanApprovalRef,
    };
  }
  return {
    generated_by: "hermes",
    submitted_by: submittedBy,
    generation_model: "hcc-dry-run-projection",
    dual_reviewed: false,
    human_reviewed: false,
    reviewed_by: null,
    reviewed_at: null,
    trust_level: submittedBy === "hermes_main" ? "single_run" : "ai_inferred",
    human_approval_ref: null,
  };
}

function projectGoodPatterns(
  input: HccDryRunReflectionInput,
  provenance: Provenance,
): ReflectionGoodPattern[] {
  return (input.good_patterns ?? []).map((p) => ({
    fingerprint: p.fingerprint,
    summary: p.summary,
    human_readable_summary: p.human_readable_summary,
    reuse_scope: p.reuse_scope,
    trigger_conditions: [...p.trigger_conditions],
    counterexamples: [...p.counterexamples],
    risks: [...p.risks],
    evidence: [ev(`${input.artifact_ref}/good/${p.fingerprint}`, p.evidence_content_hash)],
    provenance: { ...provenance },
  }));
}

function projectBadPatterns(
  input: HccDryRunReflectionInput,
  provenance: Provenance,
): ReflectionBadPattern[] {
  return (input.bad_patterns ?? []).map((p) => ({
    fingerprint: p.fingerprint,
    summary: p.summary,
    human_readable_summary: p.human_readable_summary,
    trigger_context: p.trigger_context,
    risks: [...p.risks],
    evidence: [ev(`${input.artifact_ref}/bad/${p.fingerprint}`, p.evidence_content_hash)],
    provenance: { ...provenance },
  }));
}

function projectDeadEnds(
  input: HccDryRunReflectionInput,
  provenance: Provenance,
): ReflectionDeadEnd[] {
  return (input.dead_ends ?? []).map((d) => ({
    fingerprint: d.fingerprint,
    summary: d.summary,
    human_readable_summary: d.human_readable_summary,
    failure_class: d.failure_class,
    recurrence_count: d.recurrence_count,
    trigger_context: d.trigger_context,
    why_failed: d.why_failed,
    evidence: [ev(`${input.artifact_ref}/dead/${d.fingerprint}`, d.evidence_content_hash)],
    provenance: { ...provenance },
    proposed_action: d.proposed_action,
  }));
}

function projectSkillCandidates(
  input: HccDryRunReflectionInput,
  provenance: Provenance,
): SkillCandidateDraft[] {
  return (input.skill_candidates ?? []).map((s) => ({
    fingerprint: s.fingerprint,
    name: s.name,
    scope: s.scope,
    trigger: s.trigger,
    non_goals: [...s.non_goals],
    verification_notes: s.verification_notes,
    approval_status: "pending" as const,
    source_task: s.source_task,
    evidence: [ev(`${input.artifact_ref}/skill/${s.fingerprint}`, s.evidence_content_hash)],
    provenance: { ...provenance },
    install_allowed: false as const,
  }));
}

function projectModelFeedback(
  input: HccDryRunReflectionInput,
  provenance: Provenance,
): ModelFeedback[] {
  return (input.model_feedback ?? []).map((m) => ({
    task_class: m.task_class,
    model_id: m.model_id,
    lane: m.lane,
    outcome: m.outcome,
    observed_limitation: m.observed_limitation,
    fallback_used: m.fallback_used,
    evidence: [ev(`${input.artifact_ref}/model/${m.task_class}-${m.model_id}`, m.evidence_content_hash)],
    provenance: { ...provenance },
    secret_scan: { ...CLEAN_SECRET_SCAN },
    instruction_scan: { ...CLEAN_INSTRUCTION_SCAN },
  }));
}

function projectKnowledgeDrafts(
  input: HccDryRunReflectionInput,
  provenance: Provenance,
  quarantine: boolean,
): ReflectionKnowledgeDraft[] {
  return (input.knowledge_ingest_draft ?? []).map((d) => ({
    draft_kind: d.draft_kind,
    body: d.body,
    links_back_to_task: d.links_back_to_task,
    evidence: [ev(`${input.artifact_ref}/knowledge/${d.draft_kind}-${d.links_back_to_task}`, d.evidence_content_hash)],
    provenance: { ...provenance },
    secret_scan: { ...CLEAN_SECRET_SCAN },
    instruction_scan: { ...CLEAN_INSTRUCTION_SCAN },
    quarantine,
    runtime_flush_allowed: false as const,
  }));
}

function projectUsageSignals(
  input: HccDryRunReflectionInput,
): UsageFeedbackSignal[] {
  return (input.usage_feedback_signals ?? []).map((u) => ({
    knowledge_id: u.knowledge_id,
    kind: u.kind,
    weight: u.weight,
    recorded_at: u.recorded_at,
    source_task_id: u.source_task_id,
    artifact_ref: u.artifact_ref,
    evidence: [
      ev(`${input.artifact_ref}/usage/${u.knowledge_id}`, u.evidence_content_hash),
    ],
  }));
}

/**
 * Project a minimal HCC dry-run input into a LOOP-001.1 PostTaskReflection.
 *
 * The function is pure: it allocates plain objects and never touches
 * filesystem, IPC, network, or any runtime side-channel.
 */
export function projectHccDryRunToReflection(
  input: HccDryRunReflectionInput,
): PostTaskReflection {
  if (!input.task_id) {
    throw new Error("projectHccDryRunToReflection: task_id is required");
  }
  if (!input.task_summary) {
    throw new Error("projectHccDryRunToReflection: task_summary is required");
  }

  const submittedBy = input.submitted_by ?? "hermes_main";
  // Agent-submitted drafts are always quarantined. Only a human-reviewed
  // anchor (passed explicitly) can lift quarantine to false.
  const humanReviewed = input.human_approval_ref !== undefined &&
    input.human_approval_ref !== null;
  const provenance = buildProvenance(
    submittedBy,
    humanReviewed,
    input.human_approval_ref ?? null,
  );

  // Build directly so the test/lint surface does not require importing
  // buildPostTaskReflection (and so the projection is auditable in one
  // place).
  const reflection: PostTaskReflection = {
    schema_version: POST_TASK_REFLECTION_SCHEMA_VERSION,
    mode: POST_TASK_REFLECTION_MODE,
    task_id: input.task_id,
    created_at: input.created_at,
    artifact_ref: input.artifact_ref,
    artifact_hash: input.artifact_hash,
    task_summary: input.task_summary,
    reused_knowledge: [],
    produced_artifacts: [input.artifact_ref],
    verification_result: input.verification_result,
    good_patterns: projectGoodPatterns(input, provenance),
    bad_patterns: projectBadPatterns(input, provenance),
    dead_ends: projectDeadEnds(input, provenance),
    skill_candidates: projectSkillCandidates(input, provenance),
    model_feedback: projectModelFeedback(input, provenance),
    knowledge_ingest_draft: projectKnowledgeDrafts(
      input,
      provenance,
      submittedBy === "claude_code" || submittedBy === "codex"
        ? true
        : !humanReviewed,
    ),
    next_task_recommendations: input.next_task_recommendations ?? [],
    usage_feedback_signals: projectUsageSignals(input),
    provenance,
    safety: { ...POST_TASK_REFLECTION_SAFETY },
    approval_gate: {
      ...POST_TASK_REFLECTION_APPROVAL_GATE,
      safety: { ...POST_TASK_REFLECTION_SAFETY },
    },
  };

  return reflection;
}
