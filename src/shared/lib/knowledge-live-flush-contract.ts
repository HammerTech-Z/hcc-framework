// Hermes Pro — Live Flush Adapter Contract (Slice 007A + 007B, design only)
// Pure schema/types/validators. No I/O, no network, no IPC, no runtime ingest,
// no gateway, no cron, no WeChat/iLink, no HCC, no handoff/audit write.

import type {
  KnowledgeIngestDraft,
  KnowledgeFinding,
  KnowledgeSourceType,
} from "./knowledge-reuse-protocol";
import type { TrustLevel } from "./typed-links";

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** The only target_store allowed for live flush. */
export const HERMES_MANAGED_KNOWLEDGE_STORE =
  "hermes_managed_knowledge_store" as const;

export type HermesManagedKnowledgeStore = typeof HERMES_MANAGED_KNOWLEDGE_STORE;

/** The single confirmation phrase recognized as trusted_user explicit consent. */
export const REQUIRED_CONFIRMATION_PHRASE = "我授权 flush" as const;

export const SUPPORTED_CONFIRMATION_PHRASES: ReadonlyArray<string> = [
  REQUIRED_CONFIRMATION_PHRASE,
  "I authorize flush",
  "yes, flush now",
  "confirmed, flush",
];

export const LIVE_FLUSH_REQUEST_SCHEMA_VERSION = "1.0.0" as const;

export const FRONTMATTER_SCHEMA_VERSION = "1.0.0" as const;

export const REQUIRED_FRONTMATTER_FIELDS: ReadonlyArray<string> = [
  "title",
  "summary",
  "source_type",
  "source_uri",
  "fetched_at",
  "indexed_at",
  "trust_level",
  "safe_to_use_as_instruction",
  "retrieval_keywords",
  "local_findings",
  "web_findings",
  "stale_sources",
  "provenance",
  "created_by",
  "created_from_draft_id",
  "user_confirmed_at",
];

export const VALID_TRUST_LEVELS: ReadonlyArray<TrustLevel> = [
  "trusted_verified",
  "trusted_external",
  "semi_trusted_local",
  "untrusted_external",
  "unknown",
];

export const CREATED_BY_LITERAL = "Hermes Pro Knowledge Reuse Adapter" as const;

export const NEXT_REQUIRED_APPROVAL_LITERAL =
  "live_adapter_implementation_slice" as const;

// -----------------------------------------------------------------
// User confirmation
// -----------------------------------------------------------------

export interface LiveFlushUserConfirmation {
  confirmed_in_session: true;
  confirmed_at: string;            // ISO 8601
  confirmation_phrase: string;     // must be in SUPPORTED_CONFIRMATION_PHRASES
}

// -----------------------------------------------------------------
// FlushRequest
// -----------------------------------------------------------------

export interface LiveFlushRequest {
  schema_version: typeof LIVE_FLUSH_REQUEST_SCHEMA_VERSION;
  mode: "pending_live_flush";
  created_at: string;
  draft_id: string;                // ULID / UUID
  user_confirmation: LiveFlushUserConfirmation;
  ingest_draft: KnowledgeIngestDraft;
  source_fidelity_result: {
    ok: boolean;
    issues: ReadonlyArray<{
      field: string;
      message: string;
      severity: "soft_fail" | "hard_fail";
    }>;
  };
  bucket_semantics_result: {
    ok: boolean;
    issues?: ReadonlyArray<{ field: string; message: string }>;
  };
  roadmap_guard_result: { allowed: true; reason: string };
  target_store: HermesManagedKnowledgeStore;
  runtime_adapter_required: true;
  runtime_flush_allowed: false;     // hard-locked in Slice 007A
  dry_run_artifact_ref: string;
  next_required_approval: typeof NEXT_REQUIRED_APPROVAL_LITERAL;
}

// -----------------------------------------------------------------
// Metadata / frontmatter
// -----------------------------------------------------------------

export interface HermesKnowledgeFrontmatter {
  title: string;
  summary: string;
  source_type: string;
  source_uri: string;
  fetched_at: string;
  indexed_at: string;
  trust_level: TrustLevel;
  safe_to_use_as_instruction: boolean;
  retrieval_keywords: string[];
  local_findings: ReadonlyArray<unknown>;
  web_findings: ReadonlyArray<unknown>;
  stale_sources: ReadonlyArray<unknown>;
  provenance: {
    source_type: string;
    source_uri: string;
    fetched_at: string;
    indexed_at: string;
    trust_level: TrustLevel;
    safe_to_use_as_instruction: boolean;
  };
  created_by: typeof CREATED_BY_LITERAL;
  created_from_draft_id: string;
  user_confirmed_at: string;
}

// -----------------------------------------------------------------
// Validation result
// -----------------------------------------------------------------

export type LiveFlushValidationSeverity = "block" | "warn";

export interface LiveFlushValidationIssue {
  code: string;
  message: string;
  severity: LiveFlushValidationSeverity;
}

export interface LiveFlushValidationResult {
  ok: boolean;
  issues: LiveFlushValidationIssue[];
  /** Convenience: a request is eligible for live flush iff blocking issues = 0. */
  eligible_for_live_flush: boolean;
}

// -----------------------------------------------------------------
// Validators (pure)
// -----------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isIso8601(s: string): boolean {
  // Light check: matches YYYY-MM-DD prefix. Real ISO parsing is the
  // responsibility of the future live adapter; the contract just needs
  // a non-empty, date-shaped string.
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

/**
 * Validate a LiveFlushRequest. Pure function. Throws nothing; returns
 * a structured result. Does NOT call any runtime, IPC, or knowledgeIngest.
 */
export function validateLiveFlushRequest(
  req: unknown
): LiveFlushValidationResult {
  const issues: LiveFlushValidationIssue[] = [];

  if (!req || typeof req !== "object") {
    issues.push({
      code: "not_object",
      message: "LiveFlushRequest must be a non-null object",
      severity: "block",
    });
    return { ok: false, issues, eligible_for_live_flush: false };
  }
  const r = req as Partial<LiveFlushRequest> & Record<string, unknown>;

  if (r.schema_version !== LIVE_FLUSH_REQUEST_SCHEMA_VERSION) {
    issues.push({
      code: "schema_version",
      message: `schema_version must be "${LIVE_FLUSH_REQUEST_SCHEMA_VERSION}"`,
      severity: "block",
    });
  }
  if (r.mode !== "pending_live_flush") {
    issues.push({
      code: "mode",
      message: 'mode must be "pending_live_flush" in Slice 007A',
      severity: "block",
    });
  }
  if (r.runtime_flush_allowed !== false) {
    issues.push({
      code: "runtime_flush_allowed",
      message:
        "runtime_flush_allowed must be false in Slice 007A; " +
        "real flush requires a separate live adapter implementation slice",
      severity: "block",
    });
  }
  if (r.runtime_adapter_required !== true) {
    issues.push({
      code: "runtime_adapter_required",
      message: "runtime_adapter_required must be true",
      severity: "block",
    });
  }
  if (r.target_store !== HERMES_MANAGED_KNOWLEDGE_STORE) {
    issues.push({
      code: "target_store",
      message: `target_store must be "${HERMES_MANAGED_KNOWLEDGE_STORE}"`,
      severity: "block",
    });
  }
  if (r.next_required_approval !== NEXT_REQUIRED_APPROVAL_LITERAL) {
    issues.push({
      code: "next_required_approval",
      message: `next_required_approval must be "${NEXT_REQUIRED_APPROVAL_LITERAL}"`,
      severity: "block",
    });
  }
  if (!isNonEmptyString(r.created_at) || !isIso8601(r.created_at)) {
    issues.push({
      code: "created_at",
      message: "created_at must be a non-empty ISO 8601 string",
      severity: "block",
    });
  }
  if (!isNonEmptyString(r.draft_id)) {
    issues.push({
      code: "draft_id",
      message: "draft_id must be a non-empty string",
      severity: "block",
    });
  }
  if (!isNonEmptyString(r.dry_run_artifact_ref)) {
    issues.push({
      code: "dry_run_artifact_ref",
      message: "dry_run_artifact_ref must be a non-empty string",
      severity: "block",
    });
  }

  // User confirmation
  if (!r.user_confirmation || typeof r.user_confirmation !== "object") {
    issues.push({
      code: "user_confirmation",
      message: "user_confirmation must be present",
      severity: "block",
    });
  } else {
    const uc = r.user_confirmation as Partial<LiveFlushUserConfirmation>;
    if (uc.confirmed_in_session !== true) {
      issues.push({
        code: "user_confirmation.session",
        message: "user_confirmation.confirmed_in_session must be true",
        severity: "block",
      });
    }
    if (!isNonEmptyString(uc.confirmation_phrase)) {
      issues.push({
        code: "user_confirmation.phrase",
        message: "user_confirmation.confirmation_phrase must be a non-empty string",
        severity: "block",
      });
    } else if (!SUPPORTED_CONFIRMATION_PHRASES.includes(uc.confirmation_phrase)) {
      issues.push({
        code: "user_confirmation.phrase.unknown",
        message:
          `confirmation_phrase "${uc.confirmation_phrase}" is not in the supported list; ` +
          `must be one of: ${SUPPORTED_CONFIRMATION_PHRASES.join(", ")}`,
        severity: "block",
      });
    }
    if (!isNonEmptyString(uc.confirmed_at) || !isIso8601(uc.confirmed_at)) {
      issues.push({
        code: "user_confirmation.confirmed_at",
        message: "user_confirmation.confirmed_at must be a non-empty ISO 8601 string",
        severity: "block",
      });
    }
  }

  // Ingest draft invariants
  const draft = r.ingest_draft as Partial<KnowledgeIngestDraft> | undefined;
  if (!draft) {
    issues.push({
      code: "ingest_draft",
      message: "ingest_draft must be present",
      severity: "block",
    });
  } else {
    if (draft.roadmap_change_allowed !== false) {
      issues.push({
        code: "ingest_draft.roadmap_change_allowed",
        message:
          "ingest_draft.roadmap_change_allowed must be false; " +
          "type literal prevents it, runtime still throws defensively",
        severity: "block",
      });
    }
    if (draft.user_authorized_flush !== true) {
      issues.push({
        code: "ingest_draft.user_authorized_flush",
        message: "ingest_draft.user_authorized_flush must be true for live flush",
        severity: "block",
      });
    }
    if (draft.safe_to_use_as_instruction !== true) {
      issues.push({
        code: "ingest_draft.safe_to_use_as_instruction",
        message:
          "ingest_draft.safe_to_use_as_instruction must be true " +
          "(only after trusted_user explicit confirmation)",
        severity: "block",
      });
    }
  }

  // Source fidelity + bucket semantics + roadmap guard
  const fidelity = r.source_fidelity_result as
    | { ok: boolean; issues: ReadonlyArray<{ severity: string }> }
    | undefined;
  if (!fidelity) {
    issues.push({
      code: "source_fidelity_result",
      message: "source_fidelity_result must be present",
      severity: "block",
    });
  } else if (fidelity.ok === false) {
    const hasHard = (fidelity.issues ?? []).some(
      (i) => i.severity === "hard_fail"
    );
    issues.push({
      code: "source_fidelity_result.hard_fail",
      message: hasHard
        ? "source_fidelity_result contains hard_fail; live flush must be rejected"
        : "source_fidelity_result.ok is false; live flush must be rejected",
      severity: "block",
    });
  }

  const bucket = r.bucket_semantics_result as { ok: boolean } | undefined;
  if (!bucket) {
    issues.push({
      code: "bucket_semantics_result",
      message: "bucket_semantics_result must be present",
      severity: "block",
    });
  } else if (bucket.ok === false) {
    issues.push({
      code: "bucket_semantics_result.failed",
      message: "bucket_semantics_result.ok is false; live flush must be rejected",
      severity: "block",
    });
  }

  const guard = r.roadmap_guard_result as { allowed: boolean } | undefined;
  if (!guard) {
    issues.push({
      code: "roadmap_guard_result",
      message: "roadmap_guard_result must be present",
      severity: "block",
    });
  } else if (guard.allowed !== true) {
    issues.push({
      code: "roadmap_guard_result.not_allowed",
      message: "roadmap_guard_result.allowed must be true",
      severity: "block",
    });
  }

  const blocking = issues.filter((i) => i.severity === "block").length;
  return {
    ok: blocking === 0,
    issues,
    eligible_for_live_flush: blocking === 0,
  };
}

/**
 * Validate the metadata / frontmatter that the future live adapter would
 * emit when writing a knowledge entry. Pure function. Throws nothing.
 */
export function validateHermesKnowledgeFrontmatter(
  fm: unknown
): LiveFlushValidationResult {
  const issues: LiveFlushValidationIssue[] = [];

  if (!fm || typeof fm !== "object") {
    issues.push({
      code: "frontmatter.not_object",
      message: "frontmatter must be a non-null object",
      severity: "block",
    });
    return { ok: false, issues, eligible_for_live_flush: false };
  }
  const f = fm as Record<string, unknown>;

  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!(field in f)) {
      issues.push({
        code: `frontmatter.missing.${field}`,
        message: `frontmatter is missing required field "${field}"`,
        severity: "block",
      });
    }
  }
  if (f.created_by !== CREATED_BY_LITERAL) {
    issues.push({
      code: "frontmatter.created_by",
      message: `frontmatter.created_by must be the literal "${CREATED_BY_LITERAL}"`,
      severity: "block",
    });
  }
  if (
    typeof f.trust_level === "string" &&
    !VALID_TRUST_LEVELS.includes(f.trust_level as TrustLevel)
  ) {
    issues.push({
      code: "frontmatter.trust_level",
      message: `frontmatter.trust_level must be one of: ${VALID_TRUST_LEVELS.join(", ")}`,
      severity: "block",
    });
  }
  if (!isNonEmptyString(f.fetched_at as string) || !isIso8601(f.fetched_at as string)) {
    issues.push({
      code: "frontmatter.fetched_at",
      message: "frontmatter.fetched_at must be a non-empty ISO 8601 string",
      severity: "block",
    });
  }
  if (!isNonEmptyString(f.indexed_at as string) || !isIso8601(f.indexed_at as string)) {
    issues.push({
      code: "frontmatter.indexed_at",
      message: "frontmatter.indexed_at must be a non-empty ISO 8601 string",
      severity: "block",
    });
  }
  if (!isNonEmptyString(f.user_confirmed_at as string) || !isIso8601(f.user_confirmed_at as string)) {
    issues.push({
      code: "frontmatter.user_confirmed_at",
      message: "frontmatter.user_confirmed_at must be a non-empty ISO 8601 string",
      severity: "block",
    });
  }

  const blocking = issues.filter((i) => i.severity === "block").length;
  return {
    ok: blocking === 0,
    issues,
    eligible_for_live_flush: false, // frontmatter alone is never eligible
  };
}

// -----------------------------------------------------------------
// Slice 007B — Live Flush Pure Contract Helper Expansion
// 4 new pure builders / classifiers / guards. No I/O, no network, no IPC.
// -----------------------------------------------------------------

// -----------------------------------------------------------------
// buildPendingLiveFlushRequest
// -----------------------------------------------------------------

export interface BuildPendingLiveFlushRequestInput {
  ingest_draft: KnowledgeIngestDraft;
  draft_id: string;
  dry_run_artifact_ref: string;
  /** ISO 8601; defaults to now */
  now_iso?: string;
  /** User confirmation metadata (from the same conversation) */
  user_confirmation: LiveFlushUserConfirmation;
  /** Result from validateKnowledgeSourceFidelity (Slice 006.8) */
  source_fidelity_result: {
    ok: boolean;
    issues: ReadonlyArray<{
      field: string;
      message: string;
      severity: "soft_fail" | "hard_fail";
    }>;
  };
  /** Result from bucket semantics check (Slice 006.9) */
  bucket_semantics_result: {
    ok: boolean;
    issues?: ReadonlyArray<{ field: string; message: string }>;
  };
  /** Result from assertKnowledgeDoesNotModifyRoadmap (Slice 004) */
  roadmap_guard_result: { allowed: true; reason: string };
  /** Optional override for next_required_approval */
  next_required_approval?: string;
}

function isValidIso8601(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(s);
}

function defaultNextRequiredApproval(): typeof NEXT_REQUIRED_APPROVAL_LITERAL {
  return NEXT_REQUIRED_APPROVAL_LITERAL;
}

/**
 * Build a `pending_live_flush` request payload from a `KnowledgeIngestDraft`
 * and the four pre-validated gate results. Pure function. Throws when an
 * invariant is violated (caller is expected to have already validated).
 */
export function buildPendingLiveFlushRequest(
  input: BuildPendingLiveFlushRequestInput
): LiveFlushRequest {
  if (!input.ingest_draft) {
    throw new Error("buildPendingLiveFlushRequest: ingest_draft is required");
  }
  if (input.ingest_draft.roadmap_change_allowed !== false) {
    throw new Error(
      "buildPendingLiveFlushRequest: ingest_draft.roadmap_change_allowed must be false"
    );
  }
  if (input.ingest_draft.user_authorized_flush !== true) {
    throw new Error(
      "buildPendingLiveFlushRequest: ingest_draft.user_authorized_flush must be true"
    );
  }
  if (input.ingest_draft.safe_to_use_as_instruction !== true) {
    throw new Error(
      "buildPendingLiveFlushRequest: ingest_draft.safe_to_use_as_instruction must be true"
    );
  }
  if (!input.draft_id || input.draft_id.trim() === "") {
    throw new Error("buildPendingLiveFlushRequest: draft_id is required");
  }
  if (!input.dry_run_artifact_ref || input.dry_run_artifact_ref.trim() === "") {
    throw new Error(
      "buildPendingLiveFlushRequest: dry_run_artifact_ref is required"
    );
  }
  if (!input.user_confirmation) {
    throw new Error(
      "buildPendingLiveFlushRequest: user_confirmation is required"
    );
  }
  if (!input.source_fidelity_result || !input.bucket_semantics_result) {
    throw new Error(
      "buildPendingLiveFlushRequest: source_fidelity_result and bucket_semantics_result are required"
    );
  }
  if (input.roadmap_guard_result.allowed !== true) {
    throw new Error(
      "buildPendingLiveFlushRequest: roadmap_guard_result.allowed must be true"
    );
  }
  const createdAt = input.now_iso ?? new Date().toISOString();
  if (!isValidIso8601(createdAt)) {
    throw new Error(
      "buildPendingLiveFlushRequest: created_at must be ISO 8601"
    );
  }
  return {
    schema_version: LIVE_FLUSH_REQUEST_SCHEMA_VERSION,
    mode: "pending_live_flush",
    created_at: createdAt,
    draft_id: input.draft_id,
    user_confirmation: input.user_confirmation,
    ingest_draft: input.ingest_draft,
    source_fidelity_result: input.source_fidelity_result,
    bucket_semantics_result: input.bucket_semantics_result,
    roadmap_guard_result: input.roadmap_guard_result,
    target_store: HERMES_MANAGED_KNOWLEDGE_STORE,
    runtime_adapter_required: true,
    runtime_flush_allowed: false,
    dry_run_artifact_ref: input.dry_run_artifact_ref,
    next_required_approval: (input.next_required_approval ??
      defaultNextRequiredApproval()) as typeof NEXT_REQUIRED_APPROVAL_LITERAL,
  };
}

// -----------------------------------------------------------------
// buildHermesKnowledgeFrontmatter
// -----------------------------------------------------------------

export interface BuildHermesKnowledgeFrontmatterInput {
  ingest_draft: KnowledgeIngestDraft;
  draft_id: string;
  /** Source findings used to derive frontmatter; preserves exact source_uri / fetched_at */
  source_findings: ReadonlyArray<KnowledgeFinding>;
  /** ISO 8601 for user_confirmed_at (from the same conversation) */
  user_confirmed_at: string;
  /** ISO 8601 for indexed_at; defaults to now */
  now_iso?: string;
}

/**
 * Build the frontmatter payload that a future live adapter would emit
 * when writing a knowledge entry. Preserves source_uri and fetched_at
 * exactly from the first non-stale source finding (or first finding
 * if none are non-stale). Stale findings are surfaced in `stale_sources`
 * and never used as the primary frontmatter source.
 *
 * Pure function. Throws on invariant violation.
 */
export function buildHermesKnowledgeFrontmatter(
  input: BuildHermesKnowledgeFrontmatterInput
): HermesKnowledgeFrontmatter {
  if (!input.ingest_draft) {
    throw new Error(
      "buildHermesKnowledgeFrontmatter: ingest_draft is required"
    );
  }
  if (!input.draft_id || input.draft_id.trim() === "") {
    throw new Error(
      "buildHermesKnowledgeFrontmatter: draft_id is required"
    );
  }
  if (!isValidIso8601(input.user_confirmed_at)) {
    throw new Error(
      "buildHermesKnowledgeFrontmatter: user_confirmed_at must be ISO 8601"
    );
  }
  const indexedAt = input.now_iso ?? new Date().toISOString();
  if (!isValidIso8601(indexedAt)) {
    throw new Error(
      "buildHermesKnowledgeFrontmatter: indexed_at must be ISO 8601"
    );
  }

  // Separate stale vs non-stale findings. Stale never becomes the primary
  // frontmatter source — it goes into `stale_sources` only.
  // We also strip stale from local_findings / web_findings so that
  // `stale_sources` is the single authoritative location for archived
  // records, and the live arrays never carry a "do_not_use_as_current_truth"
  // entry that would be contradictory to the array's semantic.
  const staleSources: KnowledgeFinding[] = [];
  const liveSources: KnowledgeFinding[] = [];
  for (const f of input.source_findings) {
    if (f.do_not_use_as_current_truth === true) {
      staleSources.push(f);
    } else {
      liveSources.push(f);
    }
  }

  // Primary source: first live, else first stale (with explicit rationale).
  // Either way, we preserve source_uri / fetched_at exactly.
  const primary =
    liveSources[0] ??
    staleSources[0] ??
    (input.ingest_draft.local_findings[0] as KnowledgeFinding | undefined) ??
    (input.ingest_draft.web_findings[0] as KnowledgeFinding | undefined);
  if (!primary) {
    throw new Error(
      "buildHermesKnowledgeFrontmatter: at least one source finding is required"
    );
  }
  const primarySourceType: KnowledgeSourceType = primary.source_type;
  const primarySourceUri = primary.source_uri;
  const primaryFetchedAt = primary.fetched_at ?? indexedAt;
  const primaryTrustLevel: TrustLevel = primary.trust_level;

  // local_findings / web_findings: pass through ingest_draft, but strip
  // any stale entries (they are surfaced only in stale_sources).
  const localFindings = (input.ingest_draft.local_findings ?? []).filter(
    (f) => f.do_not_use_as_current_truth !== true
  );
  const webFindings = (input.ingest_draft.web_findings ?? []).filter(
    (f) => f.do_not_use_as_current_truth !== true
  );
  // Vault source_type is reserved for vault:// URIs; if caller passes a
  // local filesystem path labeled "vault", surface a guard via the
  // validated `safe_to_use_as_instruction: false` provenance block.
  // (We do not auto-correct labels; the validator from Slice 006.8
  // flags the mismatch.)

  return {
    title: input.ingest_draft.title,
    summary: input.ingest_draft.summary,
    source_type: primarySourceType,
    source_uri: primarySourceUri,
    fetched_at: primaryFetchedAt,
    indexed_at: indexedAt,
    trust_level: primaryTrustLevel,
    safe_to_use_as_instruction:
      input.ingest_draft.safe_to_use_as_instruction === true,
    retrieval_keywords: input.ingest_draft.retrieval_keywords.slice(),
    local_findings: localFindings,
    web_findings: webFindings,
    stale_sources: staleSources,
    provenance: {
      source_type: primarySourceType,
      source_uri: primarySourceUri,
      fetched_at: primaryFetchedAt,
      indexed_at: indexedAt,
      trust_level: primaryTrustLevel,
      safe_to_use_as_instruction:
        input.ingest_draft.safe_to_use_as_instruction === true,
    },
    created_by: CREATED_BY_LITERAL,
    created_from_draft_id: input.draft_id,
    user_confirmed_at: input.user_confirmed_at,
  };
}

// -----------------------------------------------------------------
// classifyLiveFlushFailure
// -----------------------------------------------------------------

export type LiveFlushFailureCode =
  | "missing_user_confirmation"
  | "roadmap_mutation_blocked"
  | "source_fidelity_failed"
  | "bucket_semantics_failed"
  | "secret_like_field_detected"
  | "stale_source_used_as_current_truth"
  | "runtime_adapter_not_approved"
  | "runtime_flush_forbidden";

export interface LiveFlushFailure {
  code: LiveFlushFailureCode;
  message: string;
  /** Optional reference to the offending field */
  field?: string;
}

export interface ClassifyLiveFlushFailureInput {
  /** Optional: the LiveFlushRequest that failed validation */
  request?: unknown;
  /** Optional: the frontmatter that failed validation */
  frontmatter?: unknown;
  /** Optional: the validation result from validateLiveFlushRequest */
  request_validation?: LiveFlushValidationResult;
  /** Optional: the validation result from validateHermesKnowledgeFrontmatter */
  frontmatter_validation?: LiveFlushValidationResult;
  /** Optional: a raw string error message to classify (e.g. from a downstream call) */
  raw_error_message?: string;
}

/**
 * Classify a live-flush failure into a stable `LiveFlushFailureCode` +
 * human-readable message. Pure function. Returns the most specific code
 * based on the inputs; if multiple match, the first match in this order
 * wins:
 *   runtime_flush_forbidden > runtime_adapter_not_approved >
 *   roadmap_mutation_blocked > source_fidelity_failed >
 *   bucket_semantics_failed > missing_user_confirmation >
 *   secret_like_field_detected > stale_source_used_as_current_truth
 */
export function classifyLiveFlushFailure(
  input: ClassifyLiveFlushFailureInput
): LiveFlushFailure {
  // 1. runtime_flush_forbidden: payload.runtime_flush_allowed !== false
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    if (r.runtime_flush_allowed !== false) {
      return {
        code: "runtime_flush_forbidden",
        message:
          "runtime_flush_allowed must be false in Slice 007A/007B; " +
          "real flush requires a separate live adapter implementation slice",
        field: "runtime_flush_allowed",
      };
    }
  }
  // 2. runtime_adapter_not_approved: next_required_approval is missing or
  //    points to a slice that has not been approved.
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    if (
      typeof r.next_required_approval !== "string" ||
      r.next_required_approval.trim() === ""
    ) {
      return {
        code: "runtime_adapter_not_approved",
        message:
          "next_required_approval must be a non-empty string; " +
          "the live adapter implementation slice has not been approved",
        field: "next_required_approval",
      };
    }
  }
  // 3. roadmap_mutation_blocked: ingest_draft.roadmap_change_allowed !== false
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    const draft = r.ingest_draft as Record<string, unknown> | undefined;
    if (draft && draft.roadmap_change_allowed !== false) {
      return {
        code: "roadmap_mutation_blocked",
        message:
          "ingest_draft.roadmap_change_allowed must be false; " +
          "locked roadmap is never writable via ingest",
        field: "ingest_draft.roadmap_change_allowed",
      };
    }
  }
  // 4. source_fidelity_failed: source_fidelity_result.ok === false
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    const fidelity = r.source_fidelity_result as { ok: boolean } | undefined;
    if (fidelity && fidelity.ok === false) {
      return {
        code: "source_fidelity_failed",
        message: "source_fidelity_result.ok is false",
        field: "source_fidelity_result",
      };
    }
  }
  // 5. bucket_semantics_failed: bucket_semantics_result.ok === false
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    const bucket = r.bucket_semantics_result as { ok: boolean } | undefined;
    if (bucket && bucket.ok === false) {
      return {
        code: "bucket_semantics_failed",
        message: "bucket_semantics_result.ok is false",
        field: "bucket_semantics_result",
      };
    }
  }
  // 6. missing_user_confirmation: user_confirmation absent or invalid
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    const uc = r.user_confirmation as Record<string, unknown> | undefined;
    if (!uc || uc.confirmed_in_session !== true) {
      return {
        code: "missing_user_confirmation",
        message: "user_confirmation.confirmed_in_session must be true",
        field: "user_confirmation",
      };
    }
  }
  // 7. secret_like_field_detected: from request_validation issues
  if (input.request_validation) {
    const sec = input.request_validation.issues.find((i) =>
      i.code.toLowerCase().includes("secret")
    );
    if (sec) {
      return {
        code: "secret_like_field_detected",
        message: sec.message,
        field: sec.code,
      };
    }
  }
  // 8. stale_source_used_as_current_truth: any finding in local_findings
  //    has do_not_use_as_current_truth=true.
  if (input.request && typeof input.request === "object") {
    const r = input.request as Record<string, unknown>;
    const draft = r.ingest_draft as Record<string, unknown> | undefined;
    if (draft) {
      const local = (draft.local_findings as ReadonlyArray<unknown>) ?? [];
      const staleInLocal = local.some(
        (f) =>
          f &&
          typeof f === "object" &&
          (f as Record<string, unknown>).do_not_use_as_current_truth === true
      );
      if (staleInLocal) {
        return {
          code: "stale_source_used_as_current_truth",
          message:
            "ingest_draft.local_findings contains a stale source " +
            "(do_not_use_as_current_truth=true); move to stale_sources first",
          field: "ingest_draft.local_findings",
        };
      }
    }
  }
  // Fallback
  return {
    code: "runtime_flush_forbidden",
    message:
      "could not classify failure precisely; defaulting to runtime_flush_forbidden. " +
      "raw_error_message: " + (input.raw_error_message ?? "(none)"),
  };
}

// -----------------------------------------------------------------
// assertLiveFlushStillDryRun
// -----------------------------------------------------------------

export interface AssertLiveFlushStillDryRunInput {
  payload: LiveFlushRequest | HermesKnowledgeFrontmatter;
  /** Optional: explicit claim from a caller */
  claiming_live_flush_approved?: boolean;
}

/**
 * Guard: reject any attempt to flip the live flush state out of dry-run /
 * pending. Pure function. Throws on violation.
 */
export function assertLiveFlushStillDryRun(
  input: AssertLiveFlushStillDryRunInput
): { still_dry_run: true; reason: string } {
  if (!input.payload || typeof input.payload !== "object") {
    throw new Error("assertLiveFlushStillDryRun: payload must be an object");
  }
  const p = input.payload as unknown as Record<string, unknown>;

  // LiveFlushRequest invariants
  if ("mode" in p) {
    if (p.mode !== "pending_live_flush") {
      throw new Error(
        `assertLiveFlushStillDryRun: mode must be "pending_live_flush", got "${String(p.mode)}"`
      );
    }
    if (p.runtime_flush_allowed !== false) {
      throw new Error(
        "assertLiveFlushStillDryRun: runtime_flush_allowed must be false"
      );
    }
    if (
      typeof p.next_required_approval !== "string" ||
      p.next_required_approval.trim() === ""
    ) {
      throw new Error(
        "assertLiveFlushStillDryRun: next_required_approval is required"
      );
    }
    if (p.target_store !== HERMES_MANAGED_KNOWLEDGE_STORE) {
      throw new Error(
        `assertLiveFlushStillDryRun: target_store must be "${HERMES_MANAGED_KNOWLEDGE_STORE}"`
      );
    }
  }

  // Reject any "live adapter approved" forgery
  if (input.claiming_live_flush_approved === true) {
    throw new Error(
      "assertLiveFlushStillDryRun: caller claimed claiming_live_flush_approved=true; " +
        "Slice 007A/007B is contract-only. Real live adapter requires Slice 008 approval."
    );
  }
  // Also reject if a forged field appears in the payload.
  if ("live_adapter_approved" in p && p.live_adapter_approved === true) {
    throw new Error(
      "assertLiveFlushStillDryRun: payload has live_adapter_approved=true; " +
        "this is a forbidden forgery. Real live adapter requires Slice 008 approval."
    );
  }
  if ("flushed" in p && p.flushed === true) {
    throw new Error(
      "assertLiveFlushStillDryRun: payload has flushed=true; this is a forbidden forgery"
    );
  }
  return {
    still_dry_run: true,
    reason: "Slice 007A/007B contract only; runtime_flush_allowed=false, no live adapter wired",
  };
}
