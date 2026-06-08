// Post-task Learning Loop - Slice LOOP-006
// Pure design descriptor for the Knowledge Ingest Bridge. The bridge
// projects every promotable item on a PostTaskReflection into a
// uniform knowledge_ingest_draft. The draft layer is draft-only:
//   - no runtime flush
//   - no live knowledgeIngest call
//   - no live knowledgeSearch call
//   - no audit write
//   - no live ranking mutation
//   - no skill install
//   - no model runtime startup
//   - no config write
//
// Hard boundary: no fs, no IPC, no knowledgeIngest / knowledgeSearch,
// no live flush, no audit write, no live retrieval ranking mutation,
// no skill install, no HCC Auto Executor, no hermes config / handoff /
// audit mutation, no docs/roadmap-locked-2026-05-28.md mutation.

import type {
  EvidenceRef,
  HumanApprovalRef,
  PostTaskReflection,
  ReflectionGoodPattern,
  ReflectionBadPattern,
  ReflectionDeadEnd,
  ModelFeedback,
  UsageFeedbackSignal,
  ReflectionKnowledgeDraftKind,
} from "./post-task-reflection-contract";

import { POST_TASK_REFLECTION_APPROVAL_GATE } from "./post-task-reflection-contract";

import {
  projectGoodPatternToSkillCandidateDraft,
  type SkillCandidateDesignDraft,
} from "./post-task-reflection-skill-candidate-design";

import {
  projectModelFeedbackToLocalLLMWikiDraft,
  type LocalLLMWikiDraft as LocalLLMWikiDesignDraft,
} from "./post-task-reflection-local-llm-wiki-design";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const KNOWLEDGE_INGEST_BRIDGE_DESIGN = {
  bridge_status: "draft_only" as const,
  runtime_flush_allowed: false as const,
  knowledge_ingest_call_allowed: false as const,
  knowledge_search_call_allowed: false as const,
  persistence_allowed: false as const,
  audit_write_allowed: false as const,
  config_write_allowed: false as const,
  live_ranking_mutation_allowed: false as const,
  skill_install_allowed: false as const,
  model_runtime_start_allowed: false as const,
  human_approval_ref_required_for_unquarantine: true as const,
  approval_gate_required: true as const,
  quarantine_default: true as const,
  schema_version: "1.0.0" as const,
} as const;

// -----------------------------------------------------------------
// Source / target taxonomy
// -----------------------------------------------------------------

export type KnowledgeIngestSourceKind =
  | "good_pattern"
  | "bad_pattern"
  | "dead_end"
  | "model_feedback"
  | "skill_candidate"
  | "local_llm_wiki"
  | "usage_feedback";

export type KnowledgeIngestTargetBucket =
  | "pattern"
  | "anti_pattern"
  | "dead_end"
  | "model_wiki"
  | "skill_candidate"
  | "usage_feedback"
  | "judgement";

const SOURCE_TO_BUCKET: Record<
  KnowledgeIngestSourceKind,
  KnowledgeIngestTargetBucket
> = {
  good_pattern: "pattern",
  bad_pattern: "anti_pattern",
  dead_end: "dead_end",
  model_feedback: "model_wiki",
  skill_candidate: "skill_candidate",
  local_llm_wiki: "model_wiki",
  usage_feedback: "usage_feedback",
};

const SOURCE_TO_KIND: Record<
  KnowledgeIngestSourceKind,
  ReflectionKnowledgeDraftKind
> = {
  good_pattern: "fact",
  bad_pattern: "anti_pattern",
  dead_end: "anti_pattern",
  model_feedback: "judgement",
  skill_candidate: "skill_seed",
  local_llm_wiki: "judgement",
  usage_feedback: "judgement",
};

// -----------------------------------------------------------------
// Bridge draft shape
// -----------------------------------------------------------------

export interface KnowledgeIngestBridgeDraft {
  schema_version: "1.0.0";
  draft_id: string;
  fingerprint: string;
  source_kind: KnowledgeIngestSourceKind;
  source_fingerprint: string;
  target_bucket: KnowledgeIngestTargetBucket;
  draft_kind: ReflectionKnowledgeDraftKind;
  title: string;
  body: string;
  source_task: string;
  source_ref: string;
  evidence: EvidenceRef[];
  provenance: PostTaskReflection["provenance"];
  human_approval_ref: HumanApprovalRef | null;
  /**
   * Quarantine is literal true unless the source is human-reviewed
   * AND carries a HumanApprovalRef. The contract layer will refuse
   * to flip it to false without that anchor present.
   */
  quarantine: boolean;
  /**
   * The contract's ApprovalGate is closed by default. The bridge
   * carries the same gate verbatim onto every draft.
   */
  approval_gate: typeof POST_TASK_REFLECTION_APPROVAL_GATE;
  /**
   * The draft is the new entry that would go into
   * knowledge_ingest_draft[] if the future adapter promotes it.
   */
  draft_kind_ref: ReflectionKnowledgeDraftKind;
  dry_run_only: true;
  runtime_flush_allowed: false;
  knowledge_ingest_call_allowed: false;
  knowledge_search_call_allowed: false;
  persistence_allowed: false;
  audit_write_allowed: false;
  config_write_allowed: false;
  live_ranking_mutation_allowed: false;
  skill_install_allowed: false;
  model_runtime_start_allowed: false;
}

// -----------------------------------------------------------------
// Fingerprint
// -----------------------------------------------------------------

export function buildKnowledgeIngestBridgeFingerprint(input: {
  source_task: string;
  source_kind: KnowledgeIngestSourceKind;
  source_fingerprint: string;
}): string {
  return `ki-bridge-draft:${input.source_task}|${input.source_kind}|${input.source_fingerprint}`;
}

// -----------------------------------------------------------------
// Per-source projection
// -----------------------------------------------------------------

function isHumanApproved(reflection: PostTaskReflection): boolean {
  return (
    reflection.provenance.human_reviewed === true &&
    reflection.provenance.human_approval_ref !== null
  );
}

function baseDraft(
  reflection: PostTaskReflection,
  sourceKind: KnowledgeIngestSourceKind,
  sourceFingerprint: string,
  title: string,
  body: string,
  evidence: EvidenceRef[],
  targetBucketOverride?: KnowledgeIngestTargetBucket,
): KnowledgeIngestBridgeDraft {
  const target_bucket =
    targetBucketOverride ?? SOURCE_TO_BUCKET[sourceKind];
  return {
    schema_version: "1.0.0",
    draft_id: `ki-bridge-draft-${reflection.task_id}-${sourceKind}-${sourceFingerprint}`,
    fingerprint: buildKnowledgeIngestBridgeFingerprint({
      source_task: reflection.task_id,
      source_kind: sourceKind,
      source_fingerprint: sourceFingerprint,
    }),
    source_kind: sourceKind,
    source_fingerprint: sourceFingerprint,
    target_bucket,
    draft_kind: SOURCE_TO_KIND[sourceKind],
    title,
    body,
    source_task: reflection.task_id,
    source_ref: reflection.artifact_ref ?? reflection.task_id,
    evidence: evidence.length > 0 ? evidence : synthesizeEvidence(reflection, sourceKind, sourceFingerprint),
    provenance: { ...reflection.provenance },
    human_approval_ref: isHumanApproved(reflection)
      ? reflection.provenance.human_approval_ref
      : null,
    quarantine: !isHumanApproved(reflection),
    approval_gate: { ...POST_TASK_REFLECTION_APPROVAL_GATE },
    draft_kind_ref: SOURCE_TO_KIND[sourceKind],
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

function synthesizeEvidence(
  reflection: PostTaskReflection,
  sourceKind: KnowledgeIngestSourceKind,
  sourceFingerprint: string,
): EvidenceRef[] {
  return [
    {
      kind: "artifact",
      ref: `${reflection.artifact_ref ?? reflection.task_id}/ki-bridge/${sourceKind}-${sourceFingerprint}`,
      content_hash: `sha256-${reflection.task_id}-ki-bridge-${sourceKind}-${sourceFingerprint}`,
      excerpt: "redacted dry-run excerpt",
    },
  ];
}

export function projectGoodPatternToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  goodPattern: ReflectionGoodPattern,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "good_pattern",
    goodPattern.fingerprint,
    `Good pattern: ${goodPattern.summary}`,
    goodPattern.human_readable_summary,
    goodPattern.evidence,
  );
}

export function projectBadPatternToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  badPattern: ReflectionBadPattern,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "bad_pattern",
    badPattern.fingerprint,
    `Anti-pattern: ${badPattern.summary}`,
    `${badPattern.human_readable_summary}\nTrigger: ${badPattern.trigger_context}`,
    badPattern.evidence,
  );
}

export function projectDeadEndToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  deadEnd: ReflectionDeadEnd,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "dead_end",
    deadEnd.fingerprint,
    `Dead-end (${deadEnd.failure_class}): ${deadEnd.summary}`,
    `${deadEnd.human_readable_summary}\nWhy failed: ${deadEnd.why_failed}\nProposed action: ${deadEnd.proposed_action}`,
    deadEnd.evidence,
  );
}

export function projectModelFeedbackToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  feedback: ModelFeedback,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "model_feedback",
    `${feedback.task_class}-${feedback.model_id}`,
    `Model feedback (${feedback.task_class} / ${feedback.model_id} / ${feedback.outcome})`,
    `Outcome: ${feedback.outcome}\nObserved: ${feedback.observed_limitation ?? "(none)"}\nFallback: ${feedback.fallback_used ?? "(none)"}`,
    feedback.evidence,
  );
}

export function projectSkillCandidateToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  skillCandidate: SkillCandidateDesignDraft,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "skill_candidate",
    skillCandidate.fingerprint,
    `Skill candidate: ${skillCandidate.name}`,
    `Scope: ${skillCandidate.scope}\nTrigger: ${skillCandidate.trigger}\nVerification: ${skillCandidate.verification_notes}`,
    skillCandidate.evidence,
  );
}

export function projectLocalLLMWikiToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  wikiDraft: LocalLLMWikiDesignDraft,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "local_llm_wiki",
    wikiDraft.fingerprint,
    `Model wiki (${wikiDraft.lane}): ${wikiDraft.model_ref}`,
    `Suitability: ${wikiDraft.task_suitability}\nFailure modes: ${wikiDraft.failure_modes.join("; ") || "(none)"}\nFallback decisions: ${wikiDraft.fallback_decisions.join("; ") || "(none)"}\nBenchmark notes: ${wikiDraft.benchmark_notes}`,
    wikiDraft.evidence,
  );
}

export function projectUsageFeedbackToKnowledgeIngestDraft(
  reflection: PostTaskReflection,
  signal: UsageFeedbackSignal,
): KnowledgeIngestBridgeDraft {
  return baseDraft(
    reflection,
    "usage_feedback",
    `${signal.knowledge_id}-${signal.kind}-${signal.recorded_at}`,
    `Usage feedback: ${signal.kind} on ${signal.knowledge_id}`,
    `Weight: ${signal.weight}\nSource task: ${signal.source_task_id}\nArtifact: ${signal.artifact_ref ?? "(none)"}`,
    signal.evidence,
  );
}

// -----------------------------------------------------------------
// Batch projection over a reflection
// -----------------------------------------------------------------

export interface ReflectionProjectionInput {
  reflection: PostTaskReflection;
  skillCandidates?: SkillCandidateDesignDraft[];
  localLlmWikiDrafts?: LocalLLMWikiDesignDraft[];
}

/**
 * Default convenience: project every source kind reachable from a
 * PostTaskReflection without requiring the caller to wire up the
 * LOOP-004 / LOOP-005 helpers. The caller can pass pre-computed
 * skill_candidate / local_llm_wiki drafts to avoid re-deriving them.
 */
export function projectReflectionToKnowledgeIngestDrafts(
  input: ReflectionProjectionInput,
): KnowledgeIngestBridgeDraft[] {
  const { reflection } = input;
  const skillCandidates =
    input.skillCandidates ??
    reflection.good_patterns.map((p) =>
      projectGoodPatternToSkillCandidateDraft(reflection, p),
    );
  const localLlmWikiDrafts =
    input.localLlmWikiDrafts ??
    reflection.model_feedback.map((m) =>
      projectModelFeedbackToLocalLLMWikiDraft(reflection, m),
    );

  const out: KnowledgeIngestBridgeDraft[] = [];
  for (const gp of reflection.good_patterns) {
    out.push(projectGoodPatternToKnowledgeIngestDraft(reflection, gp));
  }
  for (const bp of reflection.bad_patterns) {
    out.push(projectBadPatternToKnowledgeIngestDraft(reflection, bp));
  }
  for (const de of reflection.dead_ends) {
    out.push(projectDeadEndToKnowledgeIngestDraft(reflection, de));
  }
  for (const fb of reflection.model_feedback) {
    out.push(projectModelFeedbackToKnowledgeIngestDraft(reflection, fb));
  }
  for (const sc of skillCandidates) {
    out.push(projectSkillCandidateToKnowledgeIngestDraft(reflection, sc));
  }
  for (const wiki of localLlmWikiDrafts) {
    out.push(projectLocalLLMWikiToKnowledgeIngestDraft(reflection, wiki));
  }
  for (const u of reflection.usage_feedback_signals) {
    out.push(projectUsageFeedbackToKnowledgeIngestDraft(reflection, u));
  }
  return out;
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

export function collapseKnowledgeIngestDraftDuplicates<
  T extends { fingerprint: string },
>(drafts: T[]): { kept: T[]; dropped: T[] } {
  const seen = new Set<string>();
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const d of drafts) {
    if (seen.has(d.fingerprint)) {
      dropped.push(d);
    } else {
      seen.add(d.fingerprint);
      kept.push(d);
    }
  }
  return { kept, dropped };
}

// -----------------------------------------------------------------
// Pure runtime guard
// -----------------------------------------------------------------

const FORBIDDEN_TOKENS = [
  "api_key=",
  "apikey=",
  "bearer ",
  "sk-",
  "token=",
  "password=",
  "secret=",
] as const;

const INSTRUCTION_TOKENS = [
  "ignore previous",
  "system prompt",
  "developer message",
  "you must",
  "treat this as instruction",
  "run this command",
  "执行以下命令",
  "运行以下命令",
  "系统提示",
  "开发者消息",
] as const;

function assertNoSecret(value: string, prefix: string): void {
  const lower = value.toLowerCase();
  for (const t of FORBIDDEN_TOKENS) {
    if (lower.includes(t)) {
      throw new Error(`${prefix} contains secret-like material`);
    }
  }
}

function assertNoInstructionAuthority(value: string, prefix: string): void {
  const lower = value.toLowerCase();
  for (const t of INSTRUCTION_TOKENS) {
    if (lower.includes(t)) {
      throw new Error(`${prefix} contains instruction-authority material`);
    }
  }
}

export function assertKnowledgeIngestBridgeDraftNoRuntime(
  d: KnowledgeIngestBridgeDraft,
): void {
  if (d.schema_version !== "1.0.0") {
    throw new Error("ki_bridge_draft schema_version is invalid");
  }
  if (d.dry_run_only !== true) {
    throw new Error("ki_bridge_draft.dry_run_only must be true");
  }
  for (const flag of [
    "runtime_flush_allowed",
    "knowledge_ingest_call_allowed",
    "knowledge_search_call_allowed",
    "persistence_allowed",
    "audit_write_allowed",
    "config_write_allowed",
    "live_ranking_mutation_allowed",
    "skill_install_allowed",
    "model_runtime_start_allowed",
  ] as const) {
    if (d[flag] !== false) {
      throw new Error(`ki_bridge_draft.${flag} must be false`);
    }
  }
  if (d.approval_gate.status !== "closed") {
    throw new Error("ki_bridge_draft.approval_gate.status must be closed");
  }
  if (d.approval_gate.approved !== false) {
    throw new Error("ki_bridge_draft.approval_gate.approved must be false");
  }
  if (d.evidence.length < 1) {
    throw new Error("ki_bridge_draft.evidence must be non-empty");
  }
  if (!/^sha256-/.test(d.evidence[0]!.content_hash)) {
    throw new Error("ki_bridge_draft.evidence[0].content_hash must start with sha256-");
  }
  // Quarantine = false ⇒ human_approval_ref MUST be present.
  if (!d.quarantine && d.human_approval_ref === null) {
    throw new Error("ki_bridge_draft.quarantine=false requires human_approval_ref");
  }
  if (d.human_approval_ref !== null && d.human_approval_ref.verified !== false) {
    throw new Error("ki_bridge_draft.human_approval_ref.verified must be false");
  }
  for (const s of [d.title, d.body]) {
    assertNoSecret(s, "ki_bridge_draft");
    assertNoInstructionAuthority(s, "ki_bridge_draft");
  }
}

// -----------------------------------------------------------------
// Consumer eligibility (mirrors LOOP-001.1 contract guards)
// -----------------------------------------------------------------

/**
 * Mirrors the LOOP-001.1 `assertReflectionAllowedForNextTaskContext`
 * rule at the draft level. A future consumer that ingests a
 * knowledge_ingest_draft into Next Task Context or ranking input
 * MUST gate on this helper, not on its own judgement. The current
 * LOOP-006 slice has no consumer approved, so this helper is
 * exposed for downstream gating only.
 */
export function isKnowledgeIngestDraftConsumerEligible(
  d: KnowledgeIngestBridgeDraft,
): boolean {
  if (d.runtime_flush_allowed !== false) return false;
  if (d.persistence_allowed !== false) return false;
  if (d.audit_write_allowed !== false) return false;
  if (d.live_ranking_mutation_allowed !== false) return false;
  if (d.knowledge_ingest_call_allowed !== false) return false;
  if (d.knowledge_search_call_allowed !== false) return false;
  if (d.skill_install_allowed !== false) return false;
  if (d.model_runtime_start_allowed !== false) return false;
  if (d.config_write_allowed !== false) return false;
  if (d.dry_run_only !== true) return false;
  if (d.approval_gate.approved !== false) return false;
  if (d.quarantine) return false;
  return d.human_approval_ref !== null;
}
