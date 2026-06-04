// Hermes Pro — Knowledge Reuse Protocol (read-only / protocol layer)
// Pure functions only. No file I/O, no network, no IPC, no knowledgeIngest runtime call.

import type { TrustLevel, Provenance } from "./typed-links";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type KnowledgeReuseTaskKind =
  | "github_research"
  | "tool_comparison"
  | "technical_selection"
  | "project_research"
  | "general_research";

export type KnowledgeSourceType =
  | "local_plan"
  | "knowledge_search"
  | "vault"
  | "gbrain_typed_link"
  | "web"
  | "github"
  | "user_supplied";

export type KnowledgeStepId =
  | "local_plan"
  | "knowledge_search"
  | "vault_gbrain"
  | "web_github"
  | "answer"
  | "optional_ingest_draft";

export interface KnowledgeReusePlanInput {
  task_kind: KnowledgeReuseTaskKind;
  /** Free-text query or topic for retrieval-keyword generation */
  query: string;
  /** Caller must declare if local lookup was already done (true) or skipped (false) */
  local_lookup_done: boolean;
  /** If local_lookup_done is false, agent must provide a reason */
  local_lookup_skip_reason?: string;
  /** Optional override for created_at; defaults to now (ISO 8601) */
  now_iso?: string;
}

export interface KnowledgeReusePlanStep {
  id: KnowledgeStepId;
  label: string;
  required: boolean;
  /** True when this step must be explained to the user before proceeding */
  must_declare: boolean;
}

export interface KnowledgeReusePlan {
  task_kind: KnowledgeReuseTaskKind;
  query: string;
  created_at: string;
  local_lookup_done: boolean;
  local_lookup_skip_reason: string | null;
  steps: KnowledgeReusePlanStep[];
}

// -----------------------------------------------------------------
// KnowledgeIngestDraft
// -----------------------------------------------------------------

export interface KnowledgeFinding {
  source_type: KnowledgeSourceType;
  /** Raw citation or location (vault:// path, URL, file path) */
  source_uri: string;
  /** Short statement of the finding (no inference, just fact) */
  finding: string;
  /** ISO 8601 timestamp when source was retrieved, or null if unknown */
  fetched_at: string | null;
  trust_level: TrustLevel;
  /**
   * If true, this finding is stale / archive and must NOT be used as
   * current truth. Surfaced separately in frontmatter `stale_sources` and
   * stripped from `local_findings` / `web_findings` by downstream helpers
   * (e.g. Slice 006.8 / 006.9 / 007B). Optional for backward compatibility
   * with pre-006.8 callers; treated as false when absent.
   */
  do_not_use_as_current_truth?: boolean;
}

export interface KnowledgeSourceRef {
  source_type: KnowledgeSourceType;
  source_uri: string;
  trust_level: TrustLevel;
  fetched_at: string | null;
}

export interface KnowledgeIngestDraftInput {
  title: string;
  summary: string;
  local_findings: KnowledgeFinding[];
  web_findings: KnowledgeFinding[];
  /** Optional human-readable comparison result (e.g. "A is X, B is Y, choose A because…") */
  comparison?: string;
  /** Optional decision statement (Agent judgment, kept separate from local/web facts) */
  decision?: string;
  /** Retrieval keywords for next lookup; should be normalised */
  retrieval_keywords: string[];
  /** If true, trusted_user has explicitly authorized this draft to be auto-flushed */
  trusted_user_confirmed?: boolean;
  now_iso?: string;
}

export interface KnowledgeIngestDraft {
  title: string;
  summary: string;
  sources: KnowledgeSourceRef[];
  local_findings: KnowledgeFinding[];
  web_findings: KnowledgeFinding[];
  comparison: string;
  decision: string;
  provenance: Provenance;
  trust_level: TrustLevel;
  retrieval_keywords: string[];
  created_at: string;
  /** Always false unless trusted_user_confirmed === true at draft time */
  safe_to_use_as_instruction: boolean;
  /** Hard-locked: this draft must never be auto-flushed into a roadmap mutation */
  roadmap_change_allowed: false;
  /** Indicates the user has authorized the actual knowledgeIngest call to run */
  user_authorized_flush: boolean;
}

// -----------------------------------------------------------------
// KnowledgeSourceClassification
// -----------------------------------------------------------------

export interface ClassifyKnowledgeSourceInput {
  source_type: KnowledgeSourceType;
  source_uri: string;
  /** Optional ISO 8601 timestamp; null/undefined = unknown */
  fetched_at?: string | null;
}

export interface KnowledgeSourceClassification {
  source_type: KnowledgeSourceType;
  source_uri: string;
  trust_level: TrustLevel;
  /** True if this source is an outdated-plan directory that must NOT be used as current truth */
  do_not_use_as_current_truth: boolean;
  /** Short justification string for the classification */
  reason: string;
  bucket: "local" | "external";
}

// -----------------------------------------------------------------
// Roadmap-mutation guard
// -----------------------------------------------------------------

export interface AssertRoadmapInput {
  /** Path or id of the target roadmap artefact */
  target: string;
  /** True if the target is in the locked-roadmap registry */
  is_locked_roadmap: boolean;
  /** Mutation type the caller is about to apply */
  mutation: "edit" | "append" | "delete" | "rename" | "merge";
  /** KnowledgeIngestDraft attempting to flush, if any */
  ingest_draft?: KnowledgeIngestDraft;
}

export interface AssertRoadmapResult {
  allowed: boolean;
  reason: string;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Outdated plan directories that must not be treated as current truth. */
export const STALE_PLAN_PATTERNS: ReadonlyArray<string> = [
  "archive/",
  "docs/archive/",
  "Desktop知识/归档/",
  "iteration-plan-v2-updated.md",
  "v2-status.md",
  "v3-status.md",
  "upstream-cherry-pick-results.md",
];

/** Step order for any research-class task. */
export const RESEARCH_STEP_ORDER: ReadonlyArray<KnowledgeStepId> = [
  "local_plan",
  "knowledge_search",
  "vault_gbrain",
  "web_github",
  "answer",
  "optional_ingest_draft",
];

const SECRET_LIKE_KEYS: ReadonlyArray<string> = [
  "password",
  "api_key",
  "apikey",
  "api-key",
  "token",
  "secret",
  "bearer",
  "authorization",
  "auth",
  "private_key",
  "private-key",
  "client_secret",
  "client-secret",
  "access_key",
  "access-key",
  "session_id",
  "session-id",
];

// -----------------------------------------------------------------
// buildKnowledgeReusePlan
// -----------------------------------------------------------------

const STEP_LABELS: Readonly<Record<KnowledgeStepId, string>> = {
  local_plan: "查本地计划 (CONTEXT.md / NEXT_STEP.md / LOCK.md / docs/roadmap-locked-*)",
  knowledge_search:
    "查 Hermes knowledgeSearch 预加载结果 (in-memory local pre-baked hits)",
  vault_gbrain: "查 Vault 文件 + GBrain typed links (provenance + trust_level)",
  web_github: "查 Web / GitHub (URL, fetched_at, trust_level=untrusted_external by default)",
  answer: "答用户: 拆分 本地已知 vs 新检索 vs Agent 判断",
  optional_ingest_draft:
    "若用户要求沉淀, 生成 KnowledgeIngestDraft (需 trusted_user 确认后才可真实 flush)",
};

/**
 * Build a deterministic, read-only research plan for a single research-class task.
 * Pure function. Does not read files, does not call IPC.
 */
export function buildKnowledgeReusePlan(
  input: KnowledgeReusePlanInput
): KnowledgeReusePlan {
  const createdAt = input.now_iso ?? new Date().toISOString();
  const skipReason = !input.local_lookup_done
    ? (input.local_lookup_skip_reason ?? "").trim() || "未说明跳过本地查询的原因"
    : null;

  const steps: KnowledgeReusePlanStep[] = RESEARCH_STEP_ORDER.map((id) => {
    const isOptional = id === "optional_ingest_draft";
    return {
      id,
      label: STEP_LABELS[id],
      required: !isOptional,
      // must_declare: every step's result must be declared in the final answer
      must_declare: true,
    };
  });

  return {
    task_kind: input.task_kind,
    query: input.query,
    created_at: createdAt,
    local_lookup_done: input.local_lookup_done,
    local_lookup_skip_reason: skipReason,
    steps,
  };
}

// -----------------------------------------------------------------
// classifyKnowledgeSource
// -----------------------------------------------------------------

/**
 * Classify a knowledge source: bucket (local/external), trust_level, and whether
 * it is an outdated plan path that must not be used as current truth.
 * Pure function. Does not read files.
 */
export function classifyKnowledgeSource(
  input: ClassifyKnowledgeSourceInput
): KnowledgeSourceClassification {
  const uri = input.source_uri;
  const lower = uri.toLowerCase();

  const isStale = STALE_PLAN_PATTERNS.some((p) => lower.includes(p.toLowerCase()));

  let bucket: "local" | "external";
  let trust: TrustLevel;
  let reason: string;

  switch (input.source_type) {
    case "local_plan": {
      bucket = "local";
      trust = isStale ? "untrusted_external" : "trusted_verified";
      reason = isStale
        ? "本地计划路径命中 STALE_PLAN_PATTERNS, 不得作为当前事实源"
        : "本地计划文档, 默认 trusted_verified";
      break;
    }
    case "knowledge_search": {
      bucket = "local";
      trust = "trusted_verified";
      reason = "Hermes knowledgeSearch 预加载结果, in-memory local pre-baked";
      break;
    }
    case "vault": {
      bucket = "local";
      trust = "semi_trusted_local";
      reason = "Vault 文件, semi_trusted_local";
      break;
    }
    case "gbrain_typed_link": {
      bucket = "local";
      trust = "semi_trusted_local";
      reason = "GBrain typed link, 复用 typed-links.ts 的 trust_level 映射";
      break;
    }
    case "user_supplied": {
      bucket = "local";
      trust = "trusted_verified";
      reason = "用户直接提供, 信任由用户承担";
      break;
    }
    case "web": {
      bucket = "external";
      trust = "untrusted_external";
      reason = "Web 来源, 默认 untrusted_external; 需 human-in-loop 确认";
      break;
    }
    case "github": {
      bucket = "external";
      trust = "untrusted_external";
      reason = "GitHub 来源, 默认 untrusted_external; 需 human-in-loop 确认";
      break;
    }
    default: {
      bucket = "external";
      trust = "unknown";
      reason = "未知 source_type, 信任度 unknown";
    }
  }

  return {
    source_type: input.source_type,
    source_uri: uri,
    trust_level: trust,
    do_not_use_as_current_truth: isStale,
    reason,
    bucket,
  };
}

// -----------------------------------------------------------------
// buildKnowledgeIngestDraft
// -----------------------------------------------------------------

function isSecretKey(k: string): boolean {
  const lk = k.toLowerCase();
  return SECRET_LIKE_KEYS.some((s) => lk === s || lk.includes(s));
}

/**
 * Build a draft payload ready for human review. NEVER calls knowledgeIngest runtime.
 * Pure function. Does not write files.
 *
 * - safe_to_use_as_instruction is false unless trusted_user_confirmed === true.
 * - roadmap_change_allowed is hard-locked to false.
 * - Any object field whose name looks like a secret will cause a throw (defence in depth).
 */
export function buildKnowledgeIngestDraft(
  input: KnowledgeIngestDraftInput
): KnowledgeIngestDraft {
  // Secret guard: walk all string-valued fields and reject obvious secret-like keys.
  walkForSecrets(input, "");

  const allFindings = [...input.local_findings, ...input.web_findings];
  const sources: KnowledgeSourceRef[] = allFindings.map((f) => ({
    source_type: f.source_type,
    source_uri: f.source_uri,
    trust_level: f.trust_level,
    fetched_at: f.fetched_at ?? null,
  }));

  // Pick the highest trust level among findings; fall back to "unknown".
  const trustRanking: Readonly<Record<TrustLevel, number>> = {
    trusted_verified: 5,
    trusted_external: 4,
    semi_trusted_local: 3,
    untrusted_external: 2,
    unknown: 1,
  };
  const trust_level: TrustLevel = allFindings.length
    ? allFindings
        .map((f) => f.trust_level)
        .reduce((best, cur) =>
          trustRanking[cur] > trustRanking[best] ? cur : best
        )
    : "unknown";

  const createdAt = input.now_iso ?? new Date().toISOString();
  const userAuthorizedFlush = input.trusted_user_confirmed === true;

  // Pick provenance source: prefer first local finding, then first web, else unknown.
  const firstLocal = input.local_findings[0];
  const firstWeb = input.web_findings[0];
  const provenanceSource = firstLocal ?? firstWeb;
  const provenance: Provenance = provenanceSource
    ? {
        source_type:
          provenanceSource.source_type === "vault"
            ? "vault"
            : provenanceSource.source_type === "github" ||
                provenanceSource.source_type === "web"
              ? "url"
              : provenanceSource.source_type === "user_supplied"
                ? "user_input"
                : "unknown",
        source_uri: provenanceSource.source_uri,
        fetched_at: provenanceSource.fetched_at ?? null,
        indexed_at: createdAt,
        trust_level: provenanceSource.trust_level,
        // External content is never safe_to_use_as_instruction unless user confirmed.
        safe_to_use_as_instruction: false,
      }
    : {
        source_type: "unknown",
        source_uri: "",
        fetched_at: null,
        indexed_at: createdAt,
        trust_level: "unknown",
        safe_to_use_as_instruction: false,
      };

  return {
    title: input.title.trim(),
    summary: input.summary.trim(),
    sources,
    local_findings: input.local_findings.slice(),
    web_findings: input.web_findings.slice(),
    comparison: (input.comparison ?? "").trim(),
    decision: (input.decision ?? "").trim(),
    provenance,
    trust_level,
    retrieval_keywords: normalizeKeywords(input.retrieval_keywords),
    created_at: createdAt,
    safe_to_use_as_instruction: userAuthorizedFlush,
    roadmap_change_allowed: false,
    user_authorized_flush: userAuthorizedFlush,
  };
}

function normalizeKeywords(kws: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of kws) {
    const k = raw.toLowerCase().trim();
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function walkForSecrets(value: unknown, keyPath: string): void {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkForSecrets(value[i], `${keyPath}[${i}]`);
    }
    return;
  }
  if (typeof value === "object") {
    for (const k of Object.keys(value as Record<string, unknown>)) {
      if (isSecretKey(k)) {
        throw new Error(
          `secret-like key forbidden in KnowledgeIngestDraft: "${k}" at ${keyPath || "<root>"}`
        );
      }
      walkForSecrets(
        (value as Record<string, unknown>)[k],
        keyPath ? `${keyPath}.${k}` : k
      );
    }
    return;
  }
  if (typeof value === "string") {
    // Also reject obvious bearer/token-shaped strings (defence in depth).
    if (/(Bearer\s+[A-Za-z0-9._\-]{16,})/.test(value)) {
      throw new Error(`Bearer-shaped string forbidden at ${keyPath || "<root>"}`);
    }
    if (/(sk-[A-Za-z0-9]{16,})/.test(value)) {
      throw new Error(`sk- shaped key forbidden at ${keyPath || "<root>"}`);
    }
  }
}

// -----------------------------------------------------------------
// assertKnowledgeDoesNotModifyRoadmap
// -----------------------------------------------------------------

/**
 * Guard: reject any attempt to mutate a locked roadmap via a knowledge ingest.
 * Pure function. Throws when the operation is not allowed.
 */
export function assertKnowledgeDoesNotModifyRoadmap(
  input: AssertRoadmapInput
): AssertRoadmapResult {
  if (input.is_locked_roadmap) {
    throw new Error(
      `roadmap mutation blocked: target "${input.target}" is in the locked-roadmap registry; ` +
        `mutation "${input.mutation}" requires ADR + user confirmation.`
    );
  }
  if (input.ingest_draft) {
    if (input.ingest_draft.roadmap_change_allowed !== false) {
      throw new Error(
        `roadmap mutation blocked: ingest_draft.roadmap_change_allowed must be false, ` +
          `got ${String(input.ingest_draft.roadmap_change_allowed)}`
      );
    }
    if (input.ingest_draft.user_authorized_flush !== true) {
      throw new Error(
        `roadmap mutation blocked: ingest_draft.user_authorized_flush must be true; ` +
          `the actual knowledgeIngest call requires explicit trusted_user confirmation.`
      );
    }
  }
  return {
    allowed: true,
    reason: "non-locked target with safe ingest draft",
  };
}
