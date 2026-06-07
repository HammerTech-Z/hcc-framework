// Post-task Learning Loop - Slice LOOP-001
// Pure shared contract for post-task reflection records. This module
// contains no runtime wiring, persistence, IPC, knowledge ingest, skill
// install, model startup, audit write, or config write.

export const POST_TASK_REFLECTION_SCHEMA_VERSION = "1.0.0" as const;
export const POST_TASK_REFLECTION_MODE =
  "post_task_reflection_contract_only" as const;
export const POST_TASK_APPROVAL_GATE_VERSION = "1.0.0" as const;

export type TrustLevel =
  | "unverified"
  | "ai_inferred"
  | "single_run"
  | "reproduced"
  | "human_confirmed";

export type ReflectionAgent = "hermes" | "claude_code" | "codex" | "human";

export type PostTaskVerificationResult =
  | "pass"
  | "fail"
  | "partial"
  | "rolled_back"
  | "unverified"
  | "manual_review";

export type EvidenceKind =
  | "artifact"
  | "log"
  | "test_output"
  | "diff"
  | "command";

export type ReflectionKnowledgeDraftKind =
  | "fact"
  | "judgement"
  | "recommendation"
  | "anti_pattern"
  | "skill_seed";

export type ReflectionFailureClass =
  | "transient"
  | "environmental"
  | "logic"
  | "design"
  | "unknown";

export type DeadEndProposedAction =
  | "warn_only"
  | "ranking_penalty_candidate"
  | "none";

export type SkillApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "archived";

export type ModelFeedbackOutcome = "success" | "partial" | "fail";
export type UsageFeedbackKind = "helped" | "misled" | "unused";

export interface SafetyFlags {
  knowledge_flush_allowed: false;
  skill_install_allowed: false;
  config_write_allowed: false;
  hcc_execute_allowed: false;
  model_runtime_start_allowed: false;
}

export interface SecretScanResult {
  scanned: boolean;
  passed: boolean;
  method: string;
}

export interface EvidenceRef {
  kind: EvidenceKind;
  ref: string;
  content_hash: string;
  excerpt?: string;
}

export interface Provenance {
  generated_by: ReflectionAgent;
  generation_model?: string;
  dual_reviewed: boolean;
  human_reviewed: boolean;
  trust_level: TrustLevel;
}

export interface ReflectionGoodPattern {
  fingerprint: string;
  summary: string;
  human_readable_summary: string;
  reuse_scope: string;
  trigger_conditions: string[];
  counterexamples: string[];
  risks: string[];
  evidence: EvidenceRef[];
  provenance: Provenance;
}

export interface ReflectionBadPattern {
  fingerprint: string;
  summary: string;
  human_readable_summary: string;
  trigger_context: string;
  risks: string[];
  evidence: EvidenceRef[];
  provenance: Provenance;
}

export interface ReflectionDeadEnd {
  fingerprint: string;
  summary: string;
  human_readable_summary: string;
  failure_class: ReflectionFailureClass;
  recurrence_count: number;
  trigger_context: string;
  why_failed: string;
  evidence: EvidenceRef[];
  provenance: Provenance;
  proposed_action: DeadEndProposedAction;
}

export interface ModelFeedback {
  task_class: string;
  model_id: string;
  lane?: string;
  outcome: ModelFeedbackOutcome;
  observed_limitation?: string;
  fallback_used?: string;
  evidence: EvidenceRef[];
  provenance: Provenance;
  secret_scan: SecretScanResult;
}

export interface SkillCandidateDraft {
  fingerprint: string;
  name: string;
  scope: string;
  trigger: string;
  non_goals: string[];
  verification_notes: string;
  approval_status: SkillApprovalStatus;
  source_task: string;
  evidence: EvidenceRef[];
  provenance: Provenance;
  install_allowed: false;
}

export interface ReflectionKnowledgeDraft {
  draft_kind: ReflectionKnowledgeDraftKind;
  body: string;
  links_back_to_task: string;
  evidence: EvidenceRef[];
  provenance: Provenance;
  secret_scan: SecretScanResult;
  quarantine: boolean;
  runtime_flush_allowed: false;
}

export interface UsageFeedbackSignal {
  knowledge_id: string;
  kind: UsageFeedbackKind;
  weight: number;
  recorded_at: string;
  source_task_id: string;
  artifact_ref: string | null;
  evidence: EvidenceRef[];
}

export interface ApprovalGate {
  gate_version: typeof POST_TASK_APPROVAL_GATE_VERSION;
  status: "closed";
  approved: false;
  explicit_user_approval_required: true;
  allowed_action: "none";
  safety: SafetyFlags;
}

export interface PostTaskReflection {
  schema_version: typeof POST_TASK_REFLECTION_SCHEMA_VERSION;
  mode: typeof POST_TASK_REFLECTION_MODE;
  task_id: string;
  created_at: string;
  artifact_ref: string | null;
  artifact_hash: string | null;
  task_summary: string;
  reused_knowledge: string[];
  produced_artifacts: string[];
  verification_result: PostTaskVerificationResult;
  good_patterns: ReflectionGoodPattern[];
  bad_patterns: ReflectionBadPattern[];
  dead_ends: ReflectionDeadEnd[];
  skill_candidates: SkillCandidateDraft[];
  model_feedback: ModelFeedback[];
  knowledge_ingest_draft: ReflectionKnowledgeDraft[];
  next_task_recommendations: string[];
  usage_feedback_signals: UsageFeedbackSignal[];
  provenance: Provenance;
  safety: SafetyFlags;
  approval_gate: ApprovalGate;
}

export interface PostTaskReflectionInput {
  task_id: string;
  created_at?: string;
  artifact_ref: string | null;
  artifact_hash?: string | null;
  task_summary: string;
  reused_knowledge?: string[];
  produced_artifacts?: string[];
  verification_result: PostTaskVerificationResult;
  good_patterns?: ReflectionGoodPattern[];
  bad_patterns?: ReflectionBadPattern[];
  dead_ends?: ReflectionDeadEnd[];
  skill_candidates?: SkillCandidateDraft[];
  model_feedback?: ModelFeedback[];
  knowledge_ingest_draft?: ReflectionKnowledgeDraft[];
  next_task_recommendations?: string[];
  usage_feedback_signals?: UsageFeedbackSignal[];
  provenance: Provenance;
}

export const POST_TASK_REFLECTION_SAFETY: SafetyFlags = {
  knowledge_flush_allowed: false,
  skill_install_allowed: false,
  config_write_allowed: false,
  hcc_execute_allowed: false,
  model_runtime_start_allowed: false,
} as const;

export const POST_TASK_REFLECTION_APPROVAL_GATE: ApprovalGate = {
  gate_version: POST_TASK_APPROVAL_GATE_VERSION,
  status: "closed",
  approved: false,
  explicit_user_approval_required: true,
  allowed_action: "none",
  safety: POST_TASK_REFLECTION_SAFETY,
} as const;

const SECRET_SUBSTRINGS = [
  "api_key=",
  "apikey=",
  "bearer ",
  "sk-",
  "token=",
  "password=",
  "secret=",
] as const;

function asArray<T>(value: T[] | undefined): T[] {
  return value ? [...value] : [];
}

function cloneEvidence(evidence: EvidenceRef[]): EvidenceRef[] {
  return evidence.map((entry) => ({ ...entry }));
}

function cloneProvenance(provenance: Provenance): Provenance {
  return { ...provenance };
}

function cloneSecretScan(secretScan: SecretScanResult): SecretScanResult {
  return { ...secretScan };
}

function cloneSafety(): SafetyFlags {
  return { ...POST_TASK_REFLECTION_SAFETY };
}

function cloneApprovalGate(): ApprovalGate {
  return {
    ...POST_TASK_REFLECTION_APPROVAL_GATE,
    safety: cloneSafety(),
  };
}

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function hasObjectShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, message: string): asserts value is string {
  assertCondition(typeof value === "string" && value.length > 0, message);
}

function assertFalse(value: unknown, message: string): asserts value is false {
  assertCondition(value === false, message);
}

function assertSafetyFlags(value: unknown): asserts value is SafetyFlags {
  assertCondition(hasObjectShape(value), "safety flags must be an object");
  assertFalse(
    value.knowledge_flush_allowed,
    "knowledge_flush_allowed must be false",
  );
  assertFalse(value.skill_install_allowed, "skill_install_allowed must be false");
  assertFalse(value.config_write_allowed, "config_write_allowed must be false");
  assertFalse(value.hcc_execute_allowed, "hcc_execute_allowed must be false");
  assertFalse(
    value.model_runtime_start_allowed,
    "model_runtime_start_allowed must be false",
  );
}

function assertProvenance(value: unknown, path: string): asserts value is Provenance {
  assertCondition(hasObjectShape(value), `${path}.provenance is required`);
  assertString(value.generated_by, `${path}.provenance.generated_by is required`);
  assertCondition(
    ["hermes", "claude_code", "codex", "human"].includes(value.generated_by),
    `${path}.provenance.generated_by is invalid`,
  );
  assertCondition(
    typeof value.dual_reviewed === "boolean",
    `${path}.provenance.dual_reviewed is required`,
  );
  assertCondition(
    typeof value.human_reviewed === "boolean",
    `${path}.provenance.human_reviewed is required`,
  );
  assertString(value.trust_level, `${path}.provenance.trust_level is required`);
  assertCondition(
    [
      "unverified",
      "ai_inferred",
      "single_run",
      "reproduced",
      "human_confirmed",
    ].includes(value.trust_level),
    `${path}.provenance.trust_level is invalid`,
  );
}

function assertSecretScan(
  value: unknown,
  path: string,
): asserts value is SecretScanResult {
  assertCondition(hasObjectShape(value), `${path}.secret_scan is required`);
  assertCondition(
    value.scanned === true,
    `${path}.secret_scan.scanned must be true`,
  );
  assertCondition(
    value.passed === true,
    `${path}.secret_scan.passed must be true`,
  );
  assertString(value.method, `${path}.secret_scan.method is required`);
}

function assertEvidenceArray(value: unknown, path: string): asserts value is EvidenceRef[] {
  assertCondition(Array.isArray(value), `${path}.evidence must be an array`);
  for (const [index, entry] of value.entries()) {
    const entryPath = `${path}.evidence[${index}]`;
    assertCondition(hasObjectShape(entry), `${entryPath} must be an object`);
    assertString(entry.kind, `${entryPath}.kind is required`);
    assertString(entry.ref, `${entryPath}.ref is required`);
    assertString(entry.content_hash, `${entryPath}.content_hash is required`);
  }
}

function assertNoSecretText(value: unknown, path: string): void {
  if (typeof value !== "string") {
    return;
  }
  const lower = value.toLowerCase();
  for (const needle of SECRET_SUBSTRINGS) {
    assertCondition(
      !lower.includes(needle),
      `${path} contains secret-like material`,
    );
  }
}

function assertKnowledgeDraft(
  draft: unknown,
  index: number,
): asserts draft is ReflectionKnowledgeDraft {
  const path = `knowledge_ingest_draft[${index}]`;
  assertCondition(hasObjectShape(draft), `${path} must be an object`);
  assertString(draft.draft_kind, `${path}.draft_kind is required`);
  assertString(draft.body, `${path}.body is required`);
  assertString(draft.links_back_to_task, `${path}.links_back_to_task is required`);
  assertEvidenceArray(draft.evidence, path);
  assertProvenance(draft.provenance, path);
  assertSecretScan(draft.secret_scan, path);
  assertFalse(draft.runtime_flush_allowed, `${path}.runtime_flush_allowed must be false`);
  assertCondition(
    typeof draft.quarantine === "boolean",
    `${path}.quarantine is required`,
  );
  assertCondition(
    draft.quarantine === true || draft.provenance.human_reviewed === true,
    `${path}.quarantine=false requires human_reviewed=true`,
  );
  assertNoSecretText(draft.body, `${path}.body`);
}

function cloneGoodPattern(pattern: ReflectionGoodPattern): ReflectionGoodPattern {
  return {
    ...pattern,
    trigger_conditions: [...pattern.trigger_conditions],
    counterexamples: [...pattern.counterexamples],
    risks: [...pattern.risks],
    evidence: cloneEvidence(pattern.evidence),
    provenance: cloneProvenance(pattern.provenance),
  };
}

function cloneBadPattern(pattern: ReflectionBadPattern): ReflectionBadPattern {
  return {
    ...pattern,
    risks: [...pattern.risks],
    evidence: cloneEvidence(pattern.evidence),
    provenance: cloneProvenance(pattern.provenance),
  };
}

function cloneDeadEnd(deadEnd: ReflectionDeadEnd): ReflectionDeadEnd {
  return {
    ...deadEnd,
    evidence: cloneEvidence(deadEnd.evidence),
    provenance: cloneProvenance(deadEnd.provenance),
  };
}

function cloneSkillCandidate(draft: SkillCandidateDraft): SkillCandidateDraft {
  return {
    ...draft,
    non_goals: [...draft.non_goals],
    evidence: cloneEvidence(draft.evidence),
    provenance: cloneProvenance(draft.provenance),
    install_allowed: false,
  };
}

function cloneModelFeedback(feedback: ModelFeedback): ModelFeedback {
  return {
    ...feedback,
    evidence: cloneEvidence(feedback.evidence),
    provenance: cloneProvenance(feedback.provenance),
    secret_scan: cloneSecretScan(feedback.secret_scan),
  };
}

function cloneKnowledgeDraft(
  draft: ReflectionKnowledgeDraft,
): ReflectionKnowledgeDraft {
  return {
    ...draft,
    evidence: cloneEvidence(draft.evidence),
    provenance: cloneProvenance(draft.provenance),
    secret_scan: cloneSecretScan(draft.secret_scan),
    quarantine: draft.quarantine,
    runtime_flush_allowed: false,
  };
}

function cloneUsageFeedbackSignal(
  signal: UsageFeedbackSignal,
): UsageFeedbackSignal {
  return {
    ...signal,
    evidence: cloneEvidence(signal.evidence),
  };
}

export function buildPostTaskReflection(
  input: PostTaskReflectionInput,
): PostTaskReflection {
  if (!input.task_id) {
    throw new Error("buildPostTaskReflection: task_id is required");
  }
  if (!input.task_summary) {
    throw new Error("buildPostTaskReflection: task_summary is required");
  }

  const reflection: PostTaskReflection = {
    schema_version: POST_TASK_REFLECTION_SCHEMA_VERSION,
    mode: POST_TASK_REFLECTION_MODE,
    task_id: input.task_id,
    created_at: input.created_at ?? new Date(0).toISOString(),
    artifact_ref: input.artifact_ref,
    artifact_hash: input.artifact_hash ?? null,
    task_summary: input.task_summary,
    reused_knowledge: asArray(input.reused_knowledge),
    produced_artifacts: asArray(input.produced_artifacts),
    verification_result: input.verification_result,
    good_patterns: asArray(input.good_patterns).map(cloneGoodPattern),
    bad_patterns: asArray(input.bad_patterns).map(cloneBadPattern),
    dead_ends: asArray(input.dead_ends).map(cloneDeadEnd),
    skill_candidates: asArray(input.skill_candidates).map(cloneSkillCandidate),
    model_feedback: asArray(input.model_feedback).map(cloneModelFeedback),
    knowledge_ingest_draft: asArray(input.knowledge_ingest_draft).map(
      cloneKnowledgeDraft,
    ),
    next_task_recommendations: asArray(input.next_task_recommendations),
    usage_feedback_signals: asArray(input.usage_feedback_signals).map(
      cloneUsageFeedbackSignal,
    ),
    provenance: cloneProvenance(input.provenance),
    safety: cloneSafety(),
    approval_gate: cloneApprovalGate(),
  };

  assertPostTaskReflectionNoRuntime(reflection);
  return reflection;
}

export function extractSkillCandidateDrafts(
  reflection: PostTaskReflection,
): SkillCandidateDraft[] {
  assertPostTaskReflectionNoRuntime(reflection);
  return reflection.skill_candidates.map(cloneSkillCandidate);
}

export function extractDeadEndDrafts(
  reflection: PostTaskReflection,
): ReflectionDeadEnd[] {
  assertPostTaskReflectionNoRuntime(reflection);
  return reflection.dead_ends.map(cloneDeadEnd);
}

export function extractModelFeedback(
  reflection: PostTaskReflection,
): ModelFeedback[] {
  assertPostTaskReflectionNoRuntime(reflection);
  return reflection.model_feedback.map(cloneModelFeedback);
}

export function extractKnowledgeIngestDrafts(
  reflection: PostTaskReflection,
): ReflectionKnowledgeDraft[] {
  assertPostTaskReflectionNoRuntime(reflection);
  return reflection.knowledge_ingest_draft.map(cloneKnowledgeDraft);
}

export function extractUsageFeedbackSignals(
  reflection: PostTaskReflection,
): UsageFeedbackSignal[] {
  assertPostTaskReflectionNoRuntime(reflection);
  return reflection.usage_feedback_signals.map(cloneUsageFeedbackSignal);
}

export function assertApprovalGateClosed(gate: unknown): asserts gate is ApprovalGate {
  assertCondition(hasObjectShape(gate), "approval_gate must be an object");
  assertCondition(gate.status === "closed", "approval_gate.status must be closed");
  assertFalse(gate.approved, "approval_gate.approved must be false");
  assertCondition(
    gate.explicit_user_approval_required === true,
    "approval_gate.explicit_user_approval_required must be true",
  );
  assertCondition(
    gate.allowed_action === "none",
    "approval_gate.allowed_action must be none",
  );
  assertSafetyFlags(gate.safety);
}

export function assertPostTaskReflectionNoRuntime(
  value: unknown,
): asserts value is PostTaskReflection {
  assertCondition(hasObjectShape(value), "reflection must be an object");
  assertCondition(
    value.schema_version === POST_TASK_REFLECTION_SCHEMA_VERSION,
    "schema_version is invalid",
  );
  assertCondition(value.mode === POST_TASK_REFLECTION_MODE, "mode is invalid");
  assertString(value.task_id, "task_id is required");
  assertString(value.created_at, "created_at is required");
  assertString(value.task_summary, "task_summary is required");
  assertProvenance(value.provenance, "reflection");
  assertSafetyFlags(value.safety);
  assertApprovalGateClosed(value.approval_gate);

  assertCondition(
    Array.isArray(value.knowledge_ingest_draft),
    "knowledge_ingest_draft must be an array",
  );
  value.knowledge_ingest_draft.forEach(assertKnowledgeDraft);

  assertCondition(
    Array.isArray(value.skill_candidates),
    "skill_candidates must be an array",
  );
  for (const [index, draft] of value.skill_candidates.entries()) {
    const path = `skill_candidates[${index}]`;
    assertCondition(hasObjectShape(draft), `${path} must be an object`);
    assertFalse(draft.install_allowed, `${path}.install_allowed must be false`);
    assertProvenance(draft.provenance, path);
    assertEvidenceArray(draft.evidence, path);
  }

  assertCondition(
    Array.isArray(value.model_feedback),
    "model_feedback must be an array",
  );
  for (const [index, feedback] of value.model_feedback.entries()) {
    const path = `model_feedback[${index}]`;
    assertCondition(hasObjectShape(feedback), `${path} must be an object`);
    assertString(feedback.task_class, `${path}.task_class is required`);
    assertString(feedback.model_id, `${path}.model_id is required`);
    assertProvenance(feedback.provenance, path);
    assertEvidenceArray(feedback.evidence, path);
    assertSecretScan(feedback.secret_scan, path);
    assertNoSecretText(feedback.observed_limitation, `${path}.observed_limitation`);
    assertNoSecretText(feedback.fallback_used, `${path}.fallback_used`);
  }

  assertCondition(Array.isArray(value.good_patterns), "good_patterns must be an array");
  for (const [index, pattern] of value.good_patterns.entries()) {
    const path = `good_patterns[${index}]`;
    assertCondition(hasObjectShape(pattern), `${path} must be an object`);
    assertString(pattern.fingerprint, `${path}.fingerprint is required`);
    assertProvenance(pattern.provenance, path);
    assertEvidenceArray(pattern.evidence, path);
  }

  assertCondition(Array.isArray(value.bad_patterns), "bad_patterns must be an array");
  for (const [index, pattern] of value.bad_patterns.entries()) {
    const path = `bad_patterns[${index}]`;
    assertCondition(hasObjectShape(pattern), `${path} must be an object`);
    assertString(pattern.fingerprint, `${path}.fingerprint is required`);
    assertProvenance(pattern.provenance, path);
    assertEvidenceArray(pattern.evidence, path);
  }

  assertCondition(Array.isArray(value.dead_ends), "dead_ends must be an array");
  for (const [index, deadEnd] of value.dead_ends.entries()) {
    const path = `dead_ends[${index}]`;
    assertCondition(hasObjectShape(deadEnd), `${path} must be an object`);
    assertString(deadEnd.fingerprint, `${path}.fingerprint is required`);
    assertCondition(
      typeof deadEnd.recurrence_count === "number",
      `${path}.recurrence_count is required`,
    );
    assertProvenance(deadEnd.provenance, path);
    assertEvidenceArray(deadEnd.evidence, path);
  }
}

export interface PostTaskReflectionFixtures {
  pass: PostTaskReflection;
  fail: PostTaskReflection;
  manualReview: PostTaskReflection;
}

const GENERATED_BY_HERMES: Provenance = {
  generated_by: "hermes",
  generation_model: "contract-fixture",
  dual_reviewed: false,
  human_reviewed: false,
  trust_level: "single_run",
};

const HUMAN_CONFIRMED: Provenance = {
  generated_by: "human",
  generation_model: "manual-review",
  dual_reviewed: true,
  human_reviewed: true,
  trust_level: "human_confirmed",
};

const CLEAN_SECRET_SCAN: SecretScanResult = {
  scanned: true,
  passed: true,
  method: "fixture-static-scan",
};

function evidence(ref: string, content_hash: string): EvidenceRef {
  return {
    kind: "artifact",
    ref,
    content_hash,
    excerpt: "redacted fixture excerpt",
  };
}

export function buildPostTaskReflectionFixtures(): PostTaskReflectionFixtures {
  const passEvidence = [evidence("hcc://fixture/pass-001", "sha256-pass-001")];
  const failEvidence = [evidence("hcc://fixture/fail-001", "sha256-fail-001")];
  const reviewEvidence = [
    evidence("hcc://fixture/manual-review-001", "sha256-review-001"),
  ];

  const pass = buildPostTaskReflection({
    task_id: "fixture-pass-001",
    created_at: "2026-06-07T00:00:00.000Z",
    artifact_ref: "hcc://fixture/pass-001",
    artifact_hash: "sha256-pass-001",
    task_summary:
      "Fixture PASS task: refactored a small slice and verifier passed first try.",
    reused_knowledge: ["kb-design-token-001"],
    produced_artifacts: ["src/foo.ts"],
    verification_result: "pass",
    provenance: GENERATED_BY_HERMES,
    good_patterns: [
      {
        fingerprint: "good-verifier-first-refactor",
        summary: "Capture verifier inputs before refactor.",
        human_readable_summary:
          "Read the verifier shape before editing, then keep the change narrow.",
        reuse_scope: "small refactor slices",
        trigger_conditions: ["non-trivial refactor", "existing tests available"],
        counterexamples: ["greenfield prototype"],
        risks: ["Can slow down tiny edits if applied blindly."],
        evidence: passEvidence,
        provenance: GENERATED_BY_HERMES,
      },
    ],
    skill_candidates: [
      {
        fingerprint: "skill-verifier-first-refactor",
        name: "verifier-first-refactor",
        scope: "small refactor slices",
        trigger: "before touching non-trivial code",
        non_goals: ["greenfield", "large rewrites"],
        verification_notes:
          "Re-run existing verifier fixtures; no new dependencies.",
        approval_status: "pending",
        source_task: "fixture-pass-001",
        evidence: passEvidence,
        provenance: GENERATED_BY_HERMES,
        install_allowed: false,
      },
    ],
    knowledge_ingest_draft: [
      {
        draft_kind: "skill_seed",
        body: "Verifier-first refactor pattern: capture verifier inputs before editing.",
        links_back_to_task: "fixture-pass-001",
        evidence: passEvidence,
        provenance: GENERATED_BY_HERMES,
        secret_scan: CLEAN_SECRET_SCAN,
        quarantine: true,
        runtime_flush_allowed: false,
      },
    ],
    usage_feedback_signals: [
      {
        knowledge_id: "kb-design-token-001",
        kind: "helped",
        weight: 1,
        recorded_at: "2026-06-07T00:00:00.000Z",
        source_task_id: "fixture-pass-001",
        artifact_ref: "hcc://fixture/pass-001",
        evidence: passEvidence,
      },
    ],
    next_task_recommendations: ["Apply verifier-first to next refactor slice"],
  });

  const fail = buildPostTaskReflection({
    task_id: "fixture-fail-001",
    created_at: "2026-06-07T00:00:01.000Z",
    artifact_ref: "hcc://fixture/fail-001",
    artifact_hash: "sha256-fail-001",
    task_summary:
      "Fixture FAIL task: assumption about config layout was wrong; verifier failed.",
    reused_knowledge: ["kb-config-001"],
    produced_artifacts: ["src/bar.ts"],
    verification_result: "fail",
    provenance: GENERATED_BY_HERMES,
    bad_patterns: [
      {
        fingerprint: "bad-assumed-config-path",
        summary: "Assumed config path without reading.",
        human_readable_summary:
          "Do not trust remembered config paths before reading the workspace.",
        trigger_context: "config lookup before implementation",
        risks: ["A stale local path can make the plan look valid but fail."],
        evidence: failEvidence,
        provenance: GENERATED_BY_HERMES,
      },
    ],
    dead_ends: [
      {
        fingerprint: "dead-hardcoded-config-path",
        summary: "Hardcoded config path failed.",
        human_readable_summary:
          "The path was an environmental assumption, not verified evidence.",
        failure_class: "environmental",
        recurrence_count: 1,
        trigger_context: "tried to read a config file via a hardcoded path",
        why_failed: "The config file lives at a different path on this profile.",
        evidence: failEvidence,
        provenance: GENERATED_BY_HERMES,
        proposed_action: "warn_only",
      },
    ],
    model_feedback: [
      {
        task_class: "config-discovery",
        model_id: "local-e4b-fallback",
        lane: "fallback",
        outcome: "partial",
        observed_limitation: "Missed the need to read the current profile path.",
        fallback_used: "tool-read-before-plan",
        evidence: failEvidence,
        provenance: GENERATED_BY_HERMES,
        secret_scan: CLEAN_SECRET_SCAN,
      },
    ],
    knowledge_ingest_draft: [
      {
        draft_kind: "anti_pattern",
        body: "Do not promote remembered config paths without fresh evidence.",
        links_back_to_task: "fixture-fail-001",
        evidence: failEvidence,
        provenance: GENERATED_BY_HERMES,
        secret_scan: CLEAN_SECRET_SCAN,
        quarantine: true,
        runtime_flush_allowed: false,
      },
    ],
    usage_feedback_signals: [
      {
        knowledge_id: "kb-config-001",
        kind: "misled",
        weight: 1,
        recorded_at: "2026-06-07T00:00:01.000Z",
        source_task_id: "fixture-fail-001",
        artifact_ref: "hcc://fixture/fail-001",
        evidence: failEvidence,
      },
    ],
    next_task_recommendations: [
      "Always read the config path with a tool before reading the file",
    ],
  });

  const manualReview = buildPostTaskReflection({
    task_id: "fixture-manual-review-001",
    created_at: "2026-06-07T00:00:02.000Z",
    artifact_ref: "hcc://fixture/manual-review-001",
    artifact_hash: "sha256-review-001",
    task_summary:
      "Fixture manual_review task: human sign-off required before any further action.",
    reused_knowledge: [],
    produced_artifacts: ["docs/proposal.md"],
    verification_result: "manual_review",
    provenance: HUMAN_CONFIRMED,
    bad_patterns: [
      {
        fingerprint: "bad-ambiguous-service-scope",
        summary: "Ambiguous scope across services.",
        human_readable_summary:
          "Do not ship across service boundaries without a boundary contract.",
        trigger_context: "cross-service refactor planning",
        risks: ["Reviewers cannot validate ownership or rollback boundaries."],
        evidence: reviewEvidence,
        provenance: HUMAN_CONFIRMED,
      },
    ],
    dead_ends: [
      {
        fingerprint: "dead-cross-service-without-contract",
        summary: "Cross-service work paused without boundary contract.",
        human_readable_summary:
          "The slice needs an explicit boundary before implementation.",
        failure_class: "design",
        recurrence_count: 1,
        trigger_context: "tried to ship across services in one change",
        why_failed: "No boundary contract was in place.",
        evidence: reviewEvidence,
        provenance: HUMAN_CONFIRMED,
        proposed_action: "warn_only",
      },
    ],
    knowledge_ingest_draft: [
      {
        draft_kind: "judgement",
        body: "Cross-service changes require an explicit boundary contract first.",
        links_back_to_task: "fixture-manual-review-001",
        evidence: reviewEvidence,
        provenance: HUMAN_CONFIRMED,
        secret_scan: CLEAN_SECRET_SCAN,
        quarantine: false,
        runtime_flush_allowed: false,
      },
    ],
    next_task_recommendations: [
      "Define boundary contract before any further cross-service work",
    ],
  });

  return { pass, fail, manualReview };
}
