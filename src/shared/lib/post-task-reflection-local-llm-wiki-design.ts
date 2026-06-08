// Post-task Learning Loop - Slice LOOP-005
// Pure design descriptor for the Local LLM Wiki Connector. The wiki
// is a planned input/output of the learning loop. It tracks which
// model the system considered, what lane it served, what it was
// good / bad at, and how it fell back. Nothing here starts a model,
// calls an API, or writes a real config.
//
// Hard boundary: no fs, no IPC, no model runtime startup, no API
// call, no model download, no config write, no persistence, no live
// model-strategy mutation, no hermes config / handoff / audit
// mutation, no docs/roadmap-locked-2026-05-28.md mutation.

import type {
  HumanApprovalRef,
  ModelFeedback,
  PostTaskReflection,
  EvidenceRef,
  ReflectionKnowledgeDraft,
} from "./post-task-reflection-contract";

// -----------------------------------------------------------------
// Design descriptor
// -----------------------------------------------------------------

export const LOCAL_LLM_WIKI_CONNECTOR_DESIGN = {
  connector_status: "design_only" as const,
  model_runtime_start_allowed: false as const,
  api_call_allowed: false as const,
  model_download_allowed: false as const,
  config_write_allowed: false as const,
  persistence_allowed: false as const,
  ranking_mutation_allowed: false as const,
  model_strategy_mutation_allowed: false as const,
  secret_required: false as const,
  smoke_test_execution_allowed: false as const,
  human_approval_ref_required_for_activation: true as const,
  schema_version: "1.0.0" as const,
  /**
   * Planned lane model candidates. The wiki DESCRIBES these; the
   * connector never auto-installs / auto-activates any of them.
   * Each candidate remains "needs_benchmark" / "needs_smoke" until
   * a future, separately-approved slice gates the activation.
   */
  lane_model_candidates: {
    daily: "minimax:latest-large",
    daily_fallback: "gemma4:12b-multimodal-candidate",
    lightweight: "minimax:latest-large",
    complex_code: "gpt:latest-large",
    task_fallback: "deepseek:latest-large",
    expert: "claude:latest-large",
  } as const,
  /**
   * Historical / current note (NOT a config write). Reflects the
   * pre-LOOP-005 actual state of the runtime lane:
   *   - 日常 lane currently uses minimax2.7
   *   - 兜底 lane currently uses deepseekV4pro
   * These notes exist so the wiki can describe the current state
   * without pretending the lane candidates are live. The wiki does
   * NOT mutate the lane — the connector writes nothing.
   */
  historical_current_state: {
    daily_lane: "minimax2.7",
    fallback_lane: "deepseekV4pro",
    local_runtime_status: "needs_benchmark",
  } as const,
} as const;

// -----------------------------------------------------------------
// Lane classification
// -----------------------------------------------------------------

export type LocalLLMLane =
  | "daily"
  | "daily_fallback"
  | "lightweight"
  | "complex_code"
  | "task_fallback"
  | "expert"
  | "unknown";

export type LocalLLMProviderKind = "local" | "api" | "hybrid" | "unknown";
export type LocalLLMRuntimeBackend =
  | "none"
  | "llama.cpp"
  | "vllm"
  | "sglang"
  | "api"
  | "unknown";
export type LocalLLMSmokeStatus = "not_run" | "pass" | "fail" | "unknown";

export const LOCAL_LLM_LANES: readonly LocalLLMLane[] = [
  "daily",
  "daily_fallback",
  "lightweight",
  "complex_code",
  "task_fallback",
  "expert",
  "unknown",
] as const;

/**
 * Classify a ModelFeedback entry into a planned lane. Pure
 * string / task_class matching — no I/O, no model runtime, no
 * config lookup.
 *
 * The mapping is intentionally coarse: the wiki surfaces lane
 * candidacy, not lane assignment. Real lane routing lives in a
 * future, separately-approved slice.
 */
export function classifyModelLane(input: {
  task_class: string;
  model_id: string;
  lane?: string;
  observed_limitation?: string;
  outcome: ModelFeedback["outcome"];
}): LocalLLMLane {
  const lc = input.task_class.toLowerCase();
  const hadLimitation =
    input.outcome === "fail" ||
    input.outcome === "partial" ||
    (input.observed_limitation ?? "").trim().length > 0;
  if (hadLimitation) {
    if (/config|env|setup|install/.test(lc)) return "daily_fallback";
    if (/cross-?service|design|architecture|boundary/.test(lc)) {
      return "daily_fallback";
    }
    if (/code|refactor|build|test/.test(lc)) return "task_fallback";
    return "task_fallback";
  }
  if (/cross-?service|design|architecture|boundary/.test(lc)) {
    return "expert";
  }
  if (/refactor|code|build|test/.test(lc)) return "complex_code";
  if (/config|env|setup|install/.test(lc)) return "daily_fallback";
  if (/light|small|trivial/.test(lc)) return "lightweight";
  if (/expert|hard|deep/.test(lc)) return "expert";
  if (input.lane && input.lane.length > 0) {
    if (/fallback/.test(input.lane)) return "task_fallback";
    if (/primary|main/.test(input.lane)) return "daily";
  }
  return "unknown";
}

// -----------------------------------------------------------------
// Draft shape
// -----------------------------------------------------------------

export interface LocalLLMWikiDraft {
  schema_version: "1.0.0";
  draft_id: string;
  fingerprint: string;
  model_ref: string;
  model_family: string;
  model_alias: string;
  provider_kind: LocalLLMProviderKind;
  lane: LocalLLMLane;
  capability_tags: string[];
  multimodal_support: {
    text: boolean;
    vision: boolean;
    code: boolean;
    audio?: boolean;
  };
  runtime_backend: LocalLLMRuntimeBackend;
  endpoint_ref: null;
  benchmark_notes: string;
  task_suitability: string;
  failure_modes: string[];
  fallback_decisions: string[];
  smoke_status: LocalLLMSmokeStatus;
  source_model_feedback: ModelFeedback;
  evidence: EvidenceRef[];
  provenance: PostTaskReflection["provenance"];
  source_task: string;
  source_ref: string;
  dry_run_only: true;
  model_runtime_start_allowed: false;
  api_call_allowed: false;
  model_download_allowed: false;
  config_write_allowed: false;
  persistence_allowed: false;
  ranking_mutation_allowed: false;
  model_strategy_mutation_allowed: false;
  human_approval_ref: HumanApprovalRef | null;
}

// -----------------------------------------------------------------
// Fingerprint
// -----------------------------------------------------------------

export function buildLocalLLMWikiFingerprint(input: {
  source_task: string;
  model_id: string;
  task_class: string;
  outcome: ModelFeedback["outcome"];
}): string {
  return `local-llm-wiki-draft:${input.source_task}|${input.model_id}|${input.task_class}|${input.outcome}`;
}

// -----------------------------------------------------------------
// Projection (single ModelFeedback -> draft)
// -----------------------------------------------------------------

function isHumanApproved(reflection: PostTaskReflection): boolean {
  return (
    reflection.provenance.human_reviewed === true &&
    reflection.provenance.human_approval_ref !== null
  );
}

function deriveModelFamily(modelId: string): string {
  const m = modelId.toLowerCase();
  if (m.startsWith("local-")) return "local";
  if (/minimax/.test(m)) return "minimax";
  if (/deepseek/.test(m)) return "deepseek";
  if (/claude/.test(m)) return "claude";
  if (/gpt|openai/.test(m)) return "openai";
  if (/gemma/.test(m)) return "gemma";
  return "unknown";
}

function deriveProviderKind(modelId: string): LocalLLMProviderKind {
  const family = deriveModelFamily(modelId);
  if (family === "local") return "local";
  if (family === "unknown") return "unknown";
  return "api";
}

function deriveRuntimeBackend(
  _modelId: string,
  providerKind: LocalLLMProviderKind,
): LocalLLMRuntimeBackend {
  if (providerKind === "local") return "llama.cpp";
  if (providerKind === "api") return "api";
  return "unknown";
}

function deriveCapabilities(
  modelFamily: string,
  lane: LocalLLMLane,
): LocalLLMWikiDraft["multimodal_support"] {
  const text = true;
  const code = lane === "complex_code" || lane === "expert" || lane === "task_fallback" || modelFamily === "claude" || modelFamily === "deepseek" || modelFamily === "openai";
  const vision = modelFamily === "gemma" || modelFamily === "claude" || modelFamily === "openai";
  return { text, code, vision };
}

function deriveBenchmarkNotes(
  modelFamily: string,
  lane: LocalLLMLane,
): string {
  return `needs_benchmark — ${modelFamily} on lane=${lane}: not yet smoke-tested; do not promote to live lane in LOOP-005`;
}

function deriveSmokeStatus(): LocalLLMSmokeStatus {
  return "not_run";
}

function deriveFailureModes(
  feedback: ModelFeedback,
): string[] {
  const out: string[] = [];
  if (feedback.observed_limitation && feedback.observed_limitation.length > 0) {
    out.push(feedback.observed_limitation);
  }
  if (feedback.outcome === "fail") {
    out.push("Outcome reported as fail");
  }
  if (feedback.outcome === "partial") {
    out.push("Outcome reported as partial");
  }
  return out;
}

function deriveFallbackDecisions(
  feedback: ModelFeedback,
): string[] {
  if (feedback.fallback_used && feedback.fallback_used.length > 0) {
    return [feedback.fallback_used];
  }
  return [];
}

function deriveTaskSuitability(
  feedback: ModelFeedback,
  lane: LocalLLMLane,
): string {
  return `${feedback.task_class} on lane=${lane}: outcome=${feedback.outcome}, suitability=needs_review (LOOP-005 design-only, not promoted)`;
}

export function projectModelFeedbackToLocalLLMWikiDraft(
  reflection: PostTaskReflection,
  feedback: ModelFeedback,
): LocalLLMWikiDraft {
  const modelFamily = deriveModelFamily(feedback.model_id);
  const providerKind = deriveProviderKind(feedback.model_id);
  const lane = classifyModelLane({
    task_class: feedback.task_class,
    model_id: feedback.model_id,
    lane: feedback.lane,
    observed_limitation: feedback.observed_limitation,
    outcome: feedback.outcome,
  });
  const evidenceHash =
    feedback.evidence[0]?.content_hash ??
    `sha256-${reflection.task_id}-${feedback.task_class}-${feedback.model_id}`;
  const evidence: EvidenceRef[] = [
    {
      kind: "artifact",
      ref: `${reflection.artifact_ref ?? reflection.task_id}/wiki/${feedback.task_class}-${feedback.model_id}`,
      content_hash: evidenceHash,
      excerpt: "redacted dry-run excerpt",
    },
  ];
  return {
    schema_version: "1.0.0",
    draft_id: `wiki-draft-${reflection.task_id}-${feedback.task_class}-${feedback.model_id}`,
    fingerprint: buildLocalLLMWikiFingerprint({
      source_task: reflection.task_id,
      model_id: feedback.model_id,
      task_class: feedback.task_class,
      outcome: feedback.outcome,
    }),
    model_ref: feedback.model_id,
    model_family: modelFamily,
    model_alias: feedback.model_id,
    provider_kind: providerKind,
    lane,
    capability_tags: [
      `lane:${lane}`,
      `family:${modelFamily}`,
      `outcome:${feedback.outcome}`,
    ],
    multimodal_support: deriveCapabilities(modelFamily, lane),
    runtime_backend: deriveRuntimeBackend(feedback.model_id, providerKind),
    endpoint_ref: null,
    benchmark_notes: deriveBenchmarkNotes(modelFamily, lane),
    task_suitability: deriveTaskSuitability(feedback, lane),
    failure_modes: deriveFailureModes(feedback),
    fallback_decisions: deriveFallbackDecisions(feedback),
    smoke_status: deriveSmokeStatus(),
    source_model_feedback: { ...feedback },
    evidence,
    provenance: { ...reflection.provenance },
    source_task: reflection.task_id,
    source_ref: reflection.artifact_ref ?? reflection.task_id,
    dry_run_only: true,
    model_runtime_start_allowed: false,
    api_call_allowed: false,
    model_download_allowed: false,
    config_write_allowed: false,
    persistence_allowed: false,
    ranking_mutation_allowed: false,
    model_strategy_mutation_allowed: false,
    human_approval_ref: isHumanApproved(reflection)
      ? reflection.provenance.human_approval_ref
      : null,
  };
}

// -----------------------------------------------------------------
// Batch projection
// -----------------------------------------------------------------

export function projectLocalLLMWikiDraftsFromReflection(
  reflection: PostTaskReflection,
): LocalLLMWikiDraft[] {
  return reflection.model_feedback.map((m) =>
    projectModelFeedbackToLocalLLMWikiDraft(reflection, m),
  );
}

// -----------------------------------------------------------------
// Duplicate collapse
// -----------------------------------------------------------------

export function collapseLocalLLMWikiDuplicates<
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
// Eligibility: model activation gating
// -----------------------------------------------------------------

/**
 * Returns true iff the draft is eligible to be promoted to a live
 * model activation. In LOOP-005 no such adapter is approved, so the
 * helper MUST always return false. The check is left in place as a
 * pure routing rule a future slice can call.
 */
export function isModelActivationEligibilityCandidate(
  d: LocalLLMWikiDraft,
): boolean {
  if (d.model_runtime_start_allowed !== false) return false;
  if (d.api_call_allowed !== false) return false;
  if (d.model_download_allowed !== false) return false;
  if (d.config_write_allowed !== false) return false;
  if (d.persistence_allowed !== false) return false;
  if (d.model_strategy_mutation_allowed !== false) return false;
  if (d.dry_run_only !== true) return false;
  // No activation adapter approved in LOOP-005.
  if (!LOCAL_LLM_WIKI_CONNECTOR_DESIGN.model_runtime_start_allowed) return false;
  if (!LOCAL_LLM_WIKI_CONNECTOR_DESIGN.api_call_allowed) return false;
  return d.human_approval_ref !== null && d.smoke_status === "pass";
}

// -----------------------------------------------------------------
// Pure runtime guard
// -----------------------------------------------------------------

/**
 * Re-validate a LocalLLMWikiDraft after deserialization. Catches any
 * tampered runtime / API / download / config / persistence /
 * model_strategy flag, any smuggled endpoint ref, and any secret-
 * or instruction-shaped text in capability_tags / benchmark_notes /
 * task_suitability / failure_modes / fallback_decisions.
 */
export function assertLocalLLMWikiDraftNoRuntime(
  d: LocalLLMWikiDraft,
): void {
  if (d.schema_version !== "1.0.0") {
    throw new Error("wiki_draft schema_version is invalid");
  }
  if (d.dry_run_only !== true) {
    throw new Error("wiki_draft.dry_run_only must be true");
  }
  if (d.endpoint_ref !== null) {
    throw new Error("wiki_draft.endpoint_ref must be null (no secret-bearing endpoint)");
  }
  for (const flag of [
    "model_runtime_start_allowed",
    "api_call_allowed",
    "model_download_allowed",
    "config_write_allowed",
    "persistence_allowed",
    "ranking_mutation_allowed",
    "model_strategy_mutation_allowed",
  ] as const) {
    if (d[flag] !== false) {
      throw new Error(`wiki_draft.${flag} must be false`);
    }
  }
  for (const s of [
    d.benchmark_notes,
    d.task_suitability,
    ...d.failure_modes,
    ...d.fallback_decisions,
    ...d.capability_tags,
  ]) {
    assertNoSecret(s, "wiki_draft");
    assertNoInstructionAuthority(s, "wiki_draft");
  }
  if (d.human_approval_ref !== null && d.human_approval_ref.verified !== false) {
    throw new Error("wiki_draft.human_approval_ref.verified must be false");
  }
  if (d.evidence.length < 1) {
    throw new Error("wiki_draft.evidence must be non-empty");
  }
  if (!LOCAL_LLM_LANES.includes(d.lane)) {
    throw new Error("wiki_draft.lane is invalid");
  }
  if (!/^sha256-/.test(d.evidence[0]!.content_hash)) {
    throw new Error("wiki_draft.evidence[0].content_hash must start with sha256-");
  }
}

// -----------------------------------------------------------------
// Minimal scan helpers (subset of LOOP-001.1; pure)
// -----------------------------------------------------------------

const SECRET_TOKENS = [
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
  for (const t of SECRET_TOKENS) {
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

// Compile-time anchor to keep ReflectionKnowledgeDraft import non-dead
// (the type is reused implicitly via the package's public surface).
export const _typeAnchor: ReflectionKnowledgeDraft | undefined = undefined;
