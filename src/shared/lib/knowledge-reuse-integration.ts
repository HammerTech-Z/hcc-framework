// Hermes Pro — Knowledge Reuse Integration (Slice 006, dry-run only)
// Pure functions only. No file I/O, no network, no IPC, no runtime ingest,
// no gateway, no cron, no WeChat/iLink, no HCC, no handoff/audit write.

import {
  buildKnowledgeIngestDraft,
  buildKnowledgeReusePlan,
  type KnowledgeIngestDraft,
  type KnowledgeReusePlan,
  type KnowledgeReuseTaskKind,
  type KnowledgeFinding,
  type KnowledgeSourceType,
} from "./knowledge-reuse-protocol";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type KnowledgeReuseIntent =
  | "research_only"
  | "save_to_knowledge"
  | "compare_alternatives"
  | "unknown";

export type KnowledgeSourceBucket = "local_known" | "newly_found";

export interface IntentClassificationInput {
  /** Free-text user request, e.g. "compare repo A vs B" or "save this to the knowledge base" */
  request: string;
}

export interface IntentClassification {
  intent: KnowledgeReuseIntent;
  /** Matched regex or heuristic, for human review */
  matched_rule: string | null;
  /** Confidence in [0, 1] */
  confidence: number;
}

export interface KnowledgeReuseDryRunInput {
  task_kind: KnowledgeReuseTaskKind;
  query: string;
  request_text: string;
  /** Did the agent perform local lookup before requesting the dry-run? */
  local_lookup_done: boolean;
  local_lookup_skip_reason?: string;
  /** Pre-classified local-known findings */
  local_known?: KnowledgeFinding[];
  /** Pre-classified newly-found findings (web/github) */
  newly_found?: KnowledgeFinding[];
  /** Agent judgment string (kept separate from findings) */
  judgment?: string;
  /** Optional pre-formed ingest draft (e.g. from a prior slice) */
  ingest_draft?: KnowledgeIngestDraft;
  /** If true, the user said "save to knowledge" and we want a draft. */
  save_to_knowledge: boolean;
  /** User-confirmed trusted_user authorization. Even when true, this slice
   *  still does NOT flush; it only marks the draft as user_authorized_flush. */
  trusted_user_confirmed?: boolean;
  now_iso?: string;
}

export type ForbiddenRuntimeAction =
  | "knowledgeIngest"
  | "gateway"
  | "ipc"
  | "cron"
  | "handoff_write"
  | "audit_write"
  | "hcc_executor";

export const FORBIDDEN_RUNTIME_ACTIONS: ReadonlyArray<ForbiddenRuntimeAction> = [
  "knowledgeIngest",
  "gateway",
  "ipc",
  "cron",
  "handoff_write",
  "audit_write",
  "hcc_executor",
];

export interface HermesKnowledgeReuseDryRunPayload {
  schema_version: "1.0.0";
  created_at: string;
  mode: "dry_run";
  runtime_flush_allowed: false;
  query: string;
  intent: KnowledgeReuseIntent;
  intent_confidence: number;
  plan: KnowledgeReusePlan;
  local_known: KnowledgeFinding[];
  newly_found: KnowledgeFinding[];
  judgment: string;
  ingest_draft: KnowledgeIngestDraft | null;
  flush_pending: boolean;
  required_user_confirmation: true;
  forbidden_runtime_actions: ReadonlyArray<ForbiddenRuntimeAction>;
  next_action_for_user: string;
}

// -----------------------------------------------------------------
// classifyKnowledgeReuseIntent
// -----------------------------------------------------------------

const INTENT_RULES: ReadonlyArray<{
  intent: KnowledgeReuseIntent;
  pattern: RegExp;
  rule: string;
}> = [
  {
    intent: "save_to_knowledge",
    pattern:
      /(保存|沉淀|写入|存档|存到|入库|记到|记录|add to knowledge|save to knowledge|persist|store|ingest)/i,
    rule: "explicit-save-keyword",
  },
  {
    intent: "compare_alternatives",
    pattern:
      /(对比|比较|横向|vs\.?|versus|alternative|alternatives|选型|选哪个|应该选|which is better|compare)/i,
    rule: "compare-keyword",
  },
  {
    intent: "research_only",
    pattern:
      /(调研|研究|了解|解释|说明|介绍一下|告诉我|search|research|investigate|what is|how does)/i,
    rule: "research-keyword",
  },
];

export function classifyKnowledgeReuseIntent(
  input: IntentClassificationInput
): IntentClassification {
  const text = input.request.trim();
  if (!text) {
    return { intent: "unknown", matched_rule: null, confidence: 0 };
  }
  for (const r of INTENT_RULES) {
    if (r.pattern.test(text)) {
      // If "save" appears, save_to_knowledge wins over compare.
      if (r.intent === "save_to_knowledge") {
        return { intent: r.intent, matched_rule: r.rule, confidence: 0.95 };
      }
      return { intent: r.intent, matched_rule: r.rule, confidence: 0.8 };
    }
  }
  return { intent: "unknown", matched_rule: null, confidence: 0.2 };
}

// -----------------------------------------------------------------
// buildFlushPendingNotice
// -----------------------------------------------------------------

export interface FlushPendingNoticeInput {
  draft: KnowledgeIngestDraft;
  /** True if the runtime ingest is unavailable in the current slice */
  runtime_ingest_unavailable: boolean;
}

export interface FlushPendingNotice {
  flush_pending: true;
  reason: string;
  user_must_confirm_to_flush: true;
  ingest_draft: KnowledgeIngestDraft;
}

export function buildFlushPendingNotice(
  input: FlushPendingNoticeInput
): FlushPendingNotice {
  const reason = input.runtime_ingest_unavailable
    ? "Slice 006 is dry-run only; runtime knowledgeIngest IPC is not invoked. " +
      "The draft is ready for human review. To flush, the user must explicitly say " +
      "\"我授权 flush\" in the same conversation, AND Slice 007 must be approved."
    : "User said save-to-knowledge; runtime flush is gated by trusted_user " +
      "explicit confirmation in the same conversation.";
  return {
    flush_pending: true,
    reason,
    user_must_confirm_to_flush: true,
    ingest_draft: input.draft,
  };
}

// -----------------------------------------------------------------
// buildHermesKnowledgeReuseDryRun
// -----------------------------------------------------------------

function defaultLocalKnown(): KnowledgeFinding[] {
  return [];
}

function defaultNewlyFound(): KnowledgeFinding[] {
  return [];
}

function bucketForFinding(f: KnowledgeFinding): KnowledgeSourceBucket {
  switch (f.source_type) {
    case "web":
    case "github":
      return "newly_found";
    case "local_plan":
    case "knowledge_search":
    case "vault":
    case "gbrain_typed_link":
    case "user_supplied":
      return "local_known";
    default:
      return "local_known";
  }
}

function splitFindings(
  findings: ReadonlyArray<KnowledgeFinding>
): { local_known: KnowledgeFinding[]; newly_found: KnowledgeFinding[] } {
  const local_known: KnowledgeFinding[] = [];
  const newly_found: KnowledgeFinding[] = [];
  for (const f of findings) {
    const bucket = bucketForFinding(f);
    if (bucket === "newly_found") {
      newly_found.push(f);
    } else {
      local_known.push(f);
    }
  }
  return { local_known, newly_found };
}

function normalizeWebGithubTrust(
  findings: KnowledgeFinding[]
): KnowledgeFinding[] {
  return findings.map((f) => {
    if (f.source_type !== "web" && f.source_type !== "github") return f;
    // Only untrusted_external and trusted_external are valid trust levels for
    // web/github findings. trusted_verified / semi_trusted_local / unknown
    // do not apply to external sources — force them to untrusted_external.
    if (f.trust_level === "untrusted_external" || f.trust_level === "trusted_external") {
      return f;
    }
    return { ...f, trust_level: "untrusted_external" };
  });
}

function deriveNextActionForUser(input: {
  intent: KnowledgeReuseIntent;
  has_draft: boolean;
  user_authorized_flush: boolean;
}): string {
  if (input.intent === "save_to_knowledge") {
    if (input.has_draft && input.user_authorized_flush) {
      return "draft is marked user_authorized_flush=true; awaiting Slice 007 " +
        "approval before any real knowledgeIngest call";
    }
    if (input.has_draft) {
      return "draft is ready; user must explicitly say \"我授权 flush\" in the " +
        "same conversation to enable flush (still blocked at Slice 006 dry-run gate)";
    }
    return "no draft yet; caller should call buildKnowledgeIngestDraft";
  }
  if (input.intent === "compare_alternatives") {
    return "compare-alternatives request; no ingest draft unless user says " +
      "save-to-knowledge; current answer should split local-known / newly-found";
  }
  if (input.intent === "research_only") {
    return "research-only request; no ingest draft; current answer should " +
      "split local-known / newly-found and label Agent judgment separately";
  }
  return "intent unclear; ask the user to clarify";
}

export function buildHermesKnowledgeReuseDryRun(
  input: KnowledgeReuseDryRunInput
): HermesKnowledgeReuseDryRunPayload {
  // 1. Classify intent.
  const intent = classifyKnowledgeReuseIntent({ request: input.request_text });

  // 2. Build canonical plan.
  const plan = buildKnowledgeReusePlan({
    task_kind: input.task_kind,
    query: input.query,
    local_lookup_done: input.local_lookup_done,
    local_lookup_skip_reason: input.local_lookup_skip_reason,
    now_iso: input.now_iso,
  });

  // 3. Split / normalize findings.
  const providedLocal = input.local_known ?? defaultLocalKnown();
  const providedNew = input.newly_found ?? defaultNewlyFound();

  // Auto-derive: if caller mixed them, split by source_type.
  const provided: KnowledgeFinding[] = [...providedLocal, ...providedNew];
  const { local_known, newly_found } = splitFindings(provided);

  const normalizedNew = normalizeWebGithubTrust(newly_found);

  // 4. Build ingest_draft if save_to_knowledge OR intent is save_to_knowledge.
  let ingest_draft: KnowledgeIngestDraft | null = input.ingest_draft ?? null;
  if (!ingest_draft && (input.save_to_knowledge || intent.intent === "save_to_knowledge")) {
    ingest_draft = buildKnowledgeIngestDraft({
      title: input.query,
      summary: input.judgment?.trim() || input.query,
      local_findings: local_known,
      web_findings: normalizedNew,
      decision: input.judgment?.trim() || "",
      retrieval_keywords: deriveRetrievalKeywords(input.query),
      trusted_user_confirmed: input.trusted_user_confirmed === true,
      now_iso: input.now_iso,
    });
  }

  // 5. flush_pending is true iff there is a draft to flush.
  const flush_pending = ingest_draft !== null;

  // 6. next_action_for_user
  const next_action_for_user = deriveNextActionForUser({
    intent: intent.intent,
    has_draft: ingest_draft !== null,
    user_authorized_flush: ingest_draft?.user_authorized_flush === true,
  });

  return {
    schema_version: "1.0.0",
    created_at: input.now_iso ?? new Date().toISOString(),
    mode: "dry_run",
    runtime_flush_allowed: false,
    query: input.query,
    intent: intent.intent,
    intent_confidence: intent.confidence,
    plan,
    local_known,
    newly_found: normalizedNew,
    judgment: (input.judgment ?? "").trim(),
    ingest_draft,
    flush_pending,
    required_user_confirmation: true,
    forbidden_runtime_actions: FORBIDDEN_RUNTIME_ACTIONS,
    next_action_for_user,
  };
}

function deriveRetrievalKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,;|]+/g)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

// -----------------------------------------------------------------
// assertNoRuntimeKnowledgeFlush
// -----------------------------------------------------------------

export interface AssertNoRuntimeInput {
  payload: HermesKnowledgeReuseDryRunPayload;
  /** Optional: caller's claim that they are about to call knowledgeIngest */
  claiming_runtime_flush?: boolean;
}

export interface AssertNoRuntimeResult {
  runtime_flush_attempted: boolean;
  blocked: boolean;
  reason: string;
}

/**
 * Defence-in-depth: reject any attempt to flip runtime_flush_allowed to true,
 * or to claim a real flush happened. Pure function. Throws on violation.
 */
export function assertNoRuntimeKnowledgeFlush(
  input: AssertNoRuntimeInput
): AssertNoRuntimeResult {
  if (input.payload.runtime_flush_allowed !== false) {
    throw new Error(
      `runtime flush blocked: payload.runtime_flush_allowed must be false, ` +
        `got ${String(input.payload.runtime_flush_allowed)}`
    );
  }
  if (input.payload.mode !== "dry_run") {
    throw new Error(
      `runtime flush blocked: payload.mode must be "dry_run", got "${input.payload.mode}"`
    );
  }
  if (input.claiming_runtime_flush === true) {
    throw new Error(
      `runtime flush blocked: caller claimed claiming_runtime_flush=true; ` +
        `Slice 006 is dry-run only. Real knowledgeIngest requires Slice 007 approval.`
    );
  }
  return {
    runtime_flush_attempted: false,
    blocked: true,
    reason:
      "Slice 006 dry-run only; payload.runtime_flush_allowed=false, " +
      "payload.mode=\"dry_run\", caller did not claim a real flush",
  };
}

// -----------------------------------------------------------------
// Slice 006.8 — Source fidelity + provenance semantics
// Pure validation helpers. No I/O, no network, no IPC.
// -----------------------------------------------------------------

export const VAULT_URI_PREFIX = "vault://";

/**
 * Classify a source URI into a "provenance-style" source_type based on its
 * prefix. Pure function. Returns "vault" only when the URI starts with
 * "vault://"; returns "unknown" otherwise (caller can use the more specific
 * KnowledgeSourceType from knowledge-reuse-protocol.ts when available).
 */
export function classifyProvenanceSourceUri(
  source_uri: string
): "vault" | "unknown" {
  if (typeof source_uri !== "string") return "unknown";
  if (source_uri.startsWith(VAULT_URI_PREFIX)) return "vault";
  return "unknown";
}

export interface KnowledgeSourceFidelityIssue {
  field: "source_uri" | "fetched_at" | "source_type";
  message: string;
  severity: "soft_fail" | "hard_fail";
}

export interface KnowledgeSourceFidelityReport {
  ok: boolean;
  issues: KnowledgeSourceFidelityIssue[];
  mismatched_source_types: number;
  drifted_fetched_at: number;
  rewritten_source_uris: number;
}

/**
 * Validate that an output set of KnowledgeFinding records preserves
 * source_uri and fetched_at exactly from the input set, and that
 * source_type is consistent with the URI prefix (in particular, vault
 * source_type is reserved for vault://... URIs).
 *
 * Pure function. No I/O. Throws on hard_fail (vault-label on non-vault URI
 * used to claim trusted vault instruction authority).
 */
export function validateKnowledgeSourceFidelity(
  inputSources: ReadonlyArray<{
    source_type: KnowledgeSourceType;
    source_uri: string;
    fetched_at: string | null;
  }>,
  outputSources: ReadonlyArray<{
    source_type: KnowledgeSourceType;
    source_uri: string;
    fetched_at: string | null;
  }>,
  opts: { allow_hard_fail?: boolean } = {}
): KnowledgeSourceFidelityReport {
  const issues: KnowledgeSourceFidelityIssue[] = [];
  const inputByUri = new Map<string, typeof inputSources[number]>();
  for (const s of inputSources) {
    if (!inputByUri.has(s.source_uri)) {
      inputByUri.set(s.source_uri, s);
    }
  }

  let mismatched_source_types = 0;
  let drifted_fetched_at = 0;
  let rewritten_source_uris = 0;

  for (const out of outputSources) {
    const inp = inputByUri.get(out.source_uri);
    if (!inp) {
      // Output URI not present in input — possible rewrite.
      issues.push({
        field: "source_uri",
        message: `output source_uri "${out.source_uri}" not found in input set (possible rewrite)`,
        severity: "soft_fail",
      });
      rewritten_source_uris++;
      continue;
    }
    if (inp.source_type !== out.source_type) {
      mismatched_source_types++;
      // Vault label on non-vault URI is a soft fail by default, hard fail
      // if the caller sets allow_hard_fail (i.e. the caller is using it to
      // claim trusted vault instruction authority).
      const severity: "soft_fail" | "hard_fail" =
        out.source_type === "vault" && opts.allow_hard_fail
          ? "hard_fail"
          : "soft_fail";
      issues.push({
        field: "source_type",
        message:
          `source_type drift: input="${inp.source_type}" output="${out.source_type}" ` +
          `for source_uri="${out.source_uri}"`,
        severity,
      });
    }
    if (inp.fetched_at !== out.fetched_at) {
      drifted_fetched_at++;
      issues.push({
        field: "fetched_at",
        message:
          `fetched_at drift: input="${String(inp.fetched_at)}" output="${String(out.fetched_at)}" ` +
          `for source_uri="${out.source_uri}"`,
        severity: "soft_fail",
      });
    }
  }

  const hasHardFail = issues.some((i) => i.severity === "hard_fail");
  if (hasHardFail) {
    throw new Error(
      `source fidelity hard_fail: ${issues
        .filter((i) => i.severity === "hard_fail")
        .map((i) => i.message)
        .join("; ")}`
    );
  }
  return {
    ok: issues.length === 0,
    issues,
    mismatched_source_types,
    drifted_fetched_at,
    rewritten_source_uris,
  };
}

// -----------------------------------------------------------------
// Bucket classification helpers (Slice 006.9)
// -----------------------------------------------------------------

export interface KnowledgeFindingBucketInput {
  source_type: KnowledgeSourceType;
  /** true if the finding's do_not_use_as_current_truth is set, e.g. stale/archive */
  is_historical?: boolean;
}

export interface KnowledgeBucketValidationIssue {
  field: string;
  message: string;
  severity: "soft_fail";
}

export interface KnowledgeBucketValidationReport {
  ok: boolean;
  issues: KnowledgeBucketValidationIssue[];
  misplaced_in_newly_found: number;
  misplaced_in_local_known: number;
}

/**
 * Classify a finding into a bucket based on source_type and staleness.
 *
 * - local_plan / vault / knowledge_search / gbrain_typed_link → "local_known"
 * - github / web → "newly_found"
 * - user_supplied → "local_known" (user provided it, treated as local)
 *
 * Stale findings (is_historical=true) still map to their source bucket
 * but carry the historical-only subtype — they must NOT be placed in
 * newly_found under any circumstances.
 */
export function classifyKnowledgeFindingBucket(
  input: KnowledgeFindingBucketInput
): KnowledgeSourceBucket {
  const { source_type, is_historical } = input;

  // Historical items map to local_known regardless of source_type.
  // Even if a historical item came from the web, it's archived knowledge.
  if (is_historical) {
    return "local_known";
  }

  switch (source_type) {
    case "local_plan":
    case "vault":
    case "knowledge_search":
    case "gbrain_typed_link":
    case "user_supplied":
      return "local_known";
    case "github":
    case "web":
    // Slice 006.9 bucket-semantics widening: any "synthetic" / non-local /
    // pre-existing-record source type maps to newly_found so that the
    // agent does not silently mix generated records with trusted local
    // knowledge. KnowledgeSourceType (Slice 004) does not include these
    // string literals; we cast at the case level to keep the type union
    // stable across prior slices.
    case "url" as unknown as KnowledgeSourceType:
    case "unknown" as unknown as KnowledgeSourceType:
    case "llm_generated" as unknown as KnowledgeSourceType:
      return "newly_found";
    default:
      return "newly_found";
  }
}

/**
 * Validate that a set of findings have been assigned to the correct bucket.
 *
 * Compares actual bucket placement against the expected bucket derived from
 * classifyKnowledgeFindingBucket. Reports any findings that were placed in
 * the wrong bucket.
 *
 * This is a pure validation function — it does NOT call knowledgeIngest,
 * gateway, IPC, or any runtime action.
 */
export function validateKnowledgeBucketSemantics(
  local_known: { source_type: KnowledgeSourceType; do_not_use_as_current_truth?: boolean }[],
  newly_found: { source_type: KnowledgeSourceType; do_not_use_as_current_truth?: boolean }[]
): KnowledgeBucketValidationReport {
  const issues: KnowledgeBucketValidationIssue[] = [];
  let misplaced_in_newly_found = 0;
  let misplaced_in_local_known = 0;

  for (const f of newly_found) {
    const expectedBucket = classifyKnowledgeFindingBucket({
      source_type: f.source_type,
      is_historical: f.do_not_use_as_current_truth === true,
    });
    if (expectedBucket === "local_known") {
      misplaced_in_newly_found++;
      issues.push({
        field: "bucket",
        message: `finding with source_type="${f.source_type}" and stale=${!!f.do_not_use_as_current_truth} was placed in newly_found but should be in local_known`,
        severity: "soft_fail",
      });
    }
  }

  for (const f of local_known) {
    const expectedBucket = classifyKnowledgeFindingBucket({
      source_type: f.source_type,
      is_historical: f.do_not_use_as_current_truth === true,
    });
    if (expectedBucket === "newly_found") {
      misplaced_in_local_known++;
      issues.push({
        field: "bucket",
        message: `finding with source_type="${f.source_type}" and stale=${!!f.do_not_use_as_current_truth} was placed in local_known but should be in newly_found`,
        severity: "soft_fail",
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    misplaced_in_newly_found,
    misplaced_in_local_known,
  };
}
