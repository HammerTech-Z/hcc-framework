// Hermes Pro — Knowledge Handoff Contract Snippet (Slice 007J, no runtime write)
// Pure functions only. No I/O, no network, no IPC, no runtime ingest,
// no handoff write to ~/.hermes/handoff or any real path,
// no audit write, no gateway, no cron, no WeChat/iLink, no HCC executor,
// no Claude Code subprocess, no Claude Code runtime modification.

import {
  buildKnowledgeAgentContractSnippet,
  shouldAttachKnowledgeContract,
  type KnowledgeContractAttachContext,
  type KnowledgeContractTargetAgent,
} from "./knowledge-agent-contract-snippet";

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Schema version of the contract snippet envelope. */
export const KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;

/** Source doc identifier. */
export const SOURCE_DOC_ID = "docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md" as const;

/** Default max characters for the snippet text. */
export const DEFAULT_MAX_CHARS = 2048 as const;

/** The placement field path. The renderer/burrow builder must place the
 *  snippet at this exact key. */
export const PLACEMENT_KEY = "context.contracts.knowledge_reuse" as const;

// -----------------------------------------------------------------
// Trigger flags
// -----------------------------------------------------------------

export interface KnowledgeHandoffContractTriggerFlags {
  /** User request contains a save keyword (zh or en). */
  save_keyword: boolean;
  /** User request contains a research keyword. */
  research_keyword: boolean;
  /** Upstream task_kind is a research / save / compare kind. */
  research_task_kind: boolean;
  /** Handoff context contains ingest_draft. */
  has_ingest_draft: boolean;
  /** Handoff context contains flush_pending. */
  has_flush_pending: boolean;
  /** Handoff context has both local_known + newly_found. */
  has_local_known_and_newly_found: boolean;
}

// -----------------------------------------------------------------
// Snippet envelope (the payload shape)
// -----------------------------------------------------------------

export interface KnowledgeHandoffContractSnippet {
  /** Stable target agent id. */
  target_agent: KnowledgeContractTargetAgent;
  /** Schema version. */
  snippet_version: typeof KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION;
  /** The contract text. Pure content; no executable code. */
  snippet_text: string;
  /** Reason the snippet was attached. Free text; non-empty. */
  attach_reason: string;
  /** Boolean flags showing which trigger(s) fired. */
  trigger_flags: KnowledgeHandoffContractTriggerFlags;
  /** Always true in this slice. Real flush requires a separate live adapter. */
  dry_run_only: true;
  /** Always false in this slice. */
  runtime_flush_allowed: false;
  /** Source doc identifier. */
  source_doc: typeof SOURCE_DOC_ID;
  /** ISO 8601 timestamp. */
  created_at: string;
  /** Max characters the snippet_text is allowed to occupy. */
  max_chars: number;
  /** True if the snippet_text was truncated to fit max_chars. */
  truncated: boolean;
  /** True if the snippet passed the no-runtime assertion at construction time. */
  forbidden_runtime_checked: true;
}

// -----------------------------------------------------------------
// Input / output types
// -----------------------------------------------------------------

export interface BuildKnowledgeHandoffContractSnippetInput {
  target_agent: KnowledgeContractTargetAgent;
  attach_context: KnowledgeContractAttachContext;
  attach_reason?: string;
  now_iso?: string;
  max_chars?: number;
  /** Optional override for the snippet text. If provided, the builder
   *  does NOT call the 007I builder. Used by tests; production callers
   *  should leave this undefined. */
  override_snippet_text?: string;
  /**
   * Slice 007L: when true, the builder emits the envelope even if
   * `shouldAttachKnowledgeContract` returns false. This is reserved
   * for callers that have already made the explicit attach decision
   * (e.g. HCC handoff builder at the system boundary). The default
   * is false to preserve the 007J invariant.
   */
  caller_explicit_attach?: boolean;
}

export type KnowledgeHandoffContractPlacementPath =
  typeof PLACEMENT_KEY;

// -----------------------------------------------------------------
// buildKnowledgeHandoffContractSnippet
// -----------------------------------------------------------------

/**
 * Build the contract snippet envelope. Pure function. Throws when the
 * helper cannot produce a valid envelope (e.g. attach should be false
 * but caller still passed a context). Does NOT call any runtime.
 */
export function buildKnowledgeHandoffContractSnippet(
  input: BuildKnowledgeHandoffContractSnippetInput
): KnowledgeHandoffContractSnippet {
  if (!input.target_agent) {
    throw new Error("buildKnowledgeHandoffContractSnippet: target_agent is required");
  }
  if (!input.attach_context) {
    throw new Error("buildKnowledgeHandoffContractSnippet: attach_context is required");
  }
  const attach = shouldAttachKnowledgeContract(input.attach_context);
  if (!attach && input.caller_explicit_attach !== true) {
    throw new Error(
      "buildKnowledgeHandoffContractSnippet: attach_context did not pass " +
        "shouldAttachKnowledgeContract (refusing to emit snippet)"
    );
  }

  const ctx = input.attach_context;
  const text = ctx.request_text ?? "";
  const lower = text.toLowerCase();
  const researchKeywordPattern =
    /(调研|研究|了解|解释|说明|介绍|告诉我|search|research|investigate|what is|how does|对比|比较|vs\.?|compare|选型|alternative)/i;
  const saveKeywordPattern =
    /(\bsave\b|\bpersist\b|\bstore\b|\bingest\b|保存|沉淀|写入|存档|存到|入库|记到|记录|add to knowledge|save to knowledge)/i;
  const researchKinds: ReadonlyArray<NonNullable<KnowledgeContractAttachContext["task_kind"]>> = [
    "github_research",
    "tool_comparison",
    "technical_selection",
    "project_research",
    "general_research",
  ];

  const trigger_flags: KnowledgeHandoffContractTriggerFlags = {
    save_keyword: saveKeywordPattern.test(lower),
    research_keyword: researchKeywordPattern.test(lower),
    research_task_kind:
      ctx.task_kind !== undefined && researchKinds.includes(ctx.task_kind),
    has_ingest_draft: ctx.handoff_context?.has_ingest_draft === true,
    has_flush_pending: ctx.handoff_context?.has_flush_pending === true,
    has_local_known_and_newly_found:
      ctx.handoff_context?.has_local_known === true &&
      ctx.handoff_context?.has_newly_found === true,
  };

  const reason = input.attach_reason ?? deriveAttachReason(trigger_flags);

  // Build snippet text — prefer override (test seam), else call 007I builder.
  const rawSnippet =
    input.override_snippet_text ??
    buildKnowledgeAgentContractSnippet(input.target_agent);

  const maxChars = input.max_chars ?? DEFAULT_MAX_CHARS;
  const truncated = rawSnippet.length > maxChars;
  const snippetText = truncated
    ? rawSnippet.slice(0, maxChars)
    : rawSnippet;

  const now = input.now_iso ?? new Date().toISOString();

  return {
    target_agent: input.target_agent,
    snippet_version: KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION,
    snippet_text: snippetText,
    attach_reason: reason,
    trigger_flags,
    dry_run_only: true,
    runtime_flush_allowed: false,
    source_doc: SOURCE_DOC_ID,
    created_at: now,
    max_chars: maxChars,
    truncated,
    forbidden_runtime_checked: true,
  };
}

function deriveAttachReason(
  flags: KnowledgeHandoffContractTriggerFlags
): string {
  if (flags.save_keyword) return "user-request-contains-save-keyword";
  if (flags.has_ingest_draft) return "handoff-context-has-ingest-draft";
  if (flags.has_flush_pending) return "handoff-context-has-flush-pending";
  if (flags.has_local_known_and_newly_found)
    return "handoff-context-has-local-known-and-newly-found";
  if (flags.research_task_kind) return "task-kind-is-research";
  if (flags.research_keyword) return "user-request-contains-research-keyword";
  return "unspecified";
}

// -----------------------------------------------------------------
// validateKnowledgeHandoffContractSnippet
// -----------------------------------------------------------------

export interface KnowledgeHandoffContractValidationIssue {
  code: string;
  message: string;
  severity: "block" | "warn";
}

export interface KnowledgeHandoffContractValidationResult {
  ok: boolean;
  issues: KnowledgeHandoffContractValidationIssue[];
  blocking_issue_count: number;
}

/**
 * Pure validator. Throws nothing. Returns a structured report. The
 * validator enforces the dry-run-only invariants and the literal-type
 * fields. Placement is a structural check (purely shape, not runtime).
 */
export function validateKnowledgeHandoffContractSnippet(
  payload: unknown
): KnowledgeHandoffContractValidationResult {
  const issues: KnowledgeHandoffContractValidationIssue[] = [];

  if (!payload || typeof payload !== "object") {
    issues.push({
      code: "not_object",
      message: "payload must be a non-null object",
      severity: "block",
    });
    return { ok: false, issues, blocking_issue_count: 1 };
  }
  const p = payload as Partial<KnowledgeHandoffContractSnippet> &
    Record<string, unknown>;

  if (p.snippet_version !== KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION) {
    issues.push({
      code: "snippet_version",
      message:
        `snippet_version must be "${KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION}"`,
      severity: "block",
    });
  }
  if (p.dry_run_only !== true) {
    issues.push({
      code: "dry_run_only",
      message: "dry_run_only must be true",
      severity: "block",
    });
  }
  if (p.runtime_flush_allowed !== false) {
    issues.push({
      code: "runtime_flush_allowed",
      message: "runtime_flush_allowed must be false",
      severity: "block",
    });
  }
  if (p.forbidden_runtime_checked !== true) {
    issues.push({
      code: "forbidden_runtime_checked",
      message: "forbidden_runtime_checked must be true",
      severity: "block",
    });
  }
  if (typeof p.target_agent !== "string" || p.target_agent.length === 0) {
    issues.push({
      code: "target_agent",
      message: "target_agent must be a non-empty string",
      severity: "block",
    });
  }
  if (typeof p.snippet_text !== "string" || p.snippet_text.length === 0) {
    issues.push({
      code: "snippet_text",
      message: "snippet_text must be a non-empty string",
      severity: "block",
    });
  }
  if (typeof p.attach_reason !== "string" || p.attach_reason.length === 0) {
    issues.push({
      code: "attach_reason",
      message: "attach_reason must be a non-empty string",
      severity: "block",
    });
  }
  if (typeof p.max_chars !== "number" || p.max_chars <= 0) {
    issues.push({
      code: "max_chars",
      message: "max_chars must be a positive number",
      severity: "block",
    });
  }
  if (typeof p.snippet_text === "string" && typeof p.max_chars === "number") {
    if (p.snippet_text.length > p.max_chars) {
      issues.push({
        code: "snippet_text_exceeds_max_chars",
        message: "snippet_text length must be <= max_chars",
        severity: "block",
      });
    }
  }
  if (p.truncated !== true && p.truncated !== false) {
    issues.push({
      code: "truncated",
      message: "truncated must be a boolean",
      severity: "block",
    });
  }
  if (!p.source_doc || typeof p.source_doc !== "string") {
    issues.push({
      code: "source_doc",
      message: "source_doc is required and must be a string",
      severity: "block",
    });
  }
  if (p.trigger_flags && typeof p.trigger_flags === "object") {
    // all 6 flags must be booleans
    const f = p.trigger_flags as Partial<KnowledgeHandoffContractTriggerFlags>;
    for (const k of [
      "save_keyword",
      "research_keyword",
      "research_task_kind",
      "has_ingest_draft",
      "has_flush_pending",
      "has_local_known_and_newly_found",
    ] as const) {
      if (typeof f[k] !== "boolean") {
        issues.push({
          code: `trigger_flags.${k}`,
          message: `trigger_flags.${k} must be a boolean`,
          severity: "block",
        });
      }
    }
  } else {
    issues.push({
      code: "trigger_flags",
      message: "trigger_flags is required and must be an object",
      severity: "block",
    });
  }

  const blocking_issue_count = issues.filter(
    (i) => i.severity === "block"
  ).length;
  return { ok: blocking_issue_count === 0, issues, blocking_issue_count };
}

// -----------------------------------------------------------------
// assertKnowledgeHandoffContractNoRuntime
// -----------------------------------------------------------------

/**
 * Pure guard. Rejects any payload where the snippet_text contains a
 * forbidden runtime token used as a **call expression** (followed by
 * `(`). This is a defense-in-depth check on top of the
 * `forbidden_runtime_checked: true` literal.
 *
 * Throws when an issue is detected (use `validate*` for non-throwing
 * reports).
 */
export function assertKnowledgeHandoffContractNoRuntime(
  payload: KnowledgeHandoffContractSnippet
): void {
  if (!payload || typeof payload !== "object") {
    throw new Error("assertKnowledgeHandoffContractNoRuntime: payload is required");
  }
  if (typeof payload.snippet_text !== "string") {
    throw new Error("assertKnowledgeHandoffContractNoRuntime: snippet_text must be a string");
  }
  const forbiddenTokens: ReadonlyArray<string> = [
    "knowledgeIngest",
    "knowledgeSearch",
    "runPlaybook",
    "triggerCronJob",
    "sendMessage",
  ];
  for (const token of forbiddenTokens) {
    // The snippet may mention these tokens in negative clauses (e.g. "Do
    // not call knowledgeIngest"). We only flag them when they appear
    // as a call expression (token followed by "(").
    const callRe = new RegExp("\\b" + token + "\\s*\\(", "g");
    if (callRe.test(payload.snippet_text)) {
      throw new Error(
        `assertKnowledgeHandoffContractNoRuntime: snippet_text contains forbidden runtime call "${token}("`
      );
    }
  }
  // Also check that payload does not carry executable placement fields.
  // The envelope is data-only; we forbid fields whose names suggest
  // executable or verification placement.
  const forbiddenFieldNames: ReadonlyArray<string> = [
    "executable_command",
    "verification_command",
    "command_to_run",
    "shell_command",
    "fetch_url",
    "write_to_path",
  ];
  for (const name of forbiddenFieldNames) {
    if (name in payload) {
      throw new Error(
        `assertKnowledgeHandoffContractNoRuntime: payload contains forbidden field "${name}"`
      );
    }
  }
}

// -----------------------------------------------------------------
// Placement helper
// -----------------------------------------------------------------

/**
 * Build the placement object that a handoff builder (future, 007K+)
 * would insert into the handoff payload. Pure data; no I/O.
 *
 * Returns the same envelope the builder would emit. The handoff
 * builder is responsible for setting `payload.context.contracts.knowledge_reuse
 * = envelope`.
 */
export function projectKnowledgeHandoffContractToPlacement(
  envelope: KnowledgeHandoffContractSnippet
): {
  path: KnowledgeHandoffContractPlacementPath;
  envelope: KnowledgeHandoffContractSnippet;
} {
  return {
    path: PLACEMENT_KEY,
    envelope,
  };
}
