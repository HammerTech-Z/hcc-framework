// Hermes Pro — Knowledge Runtime Injection Surface B Dry-run Implementation (Slice 008F, no runtime)
// Pure functions only. No I/O, no network, no IPC, no runtime ingest,
// no Agent subprocess, no real handoff write, no audit write, no
// prompt builder mutation, no default system prompt mutation, no
// gateway, no cron, no WeChat / iLink.
//
// This helper implements the Surface B (task prompt preamble) stage
// of the Runtime Injection chain. It composes the dry-run preamble
// from 008C with the caller's base task prompt and returns a string.
// It does NOT call any real dispatcher, Agent, or prompt builder.

import { createHash } from "crypto";

import {
  buildKnowledgeAgentContractSnippet,
  shouldAttachKnowledgeContract,
  type KnowledgeContractTargetAgent,
} from "./knowledge-agent-contract-snippet";

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Schema version. */
export const KNOWLEDGE_SURFACE_B_SCHEMA_VERSION = "1.0.0" as const;

/** Slice identifier. */
export const SURFACE_B_SLICE = "008F" as const;

/** Mode literal. */
export const SURFACE_B_MODE = "surface_b_dry_run_implementation" as const;

/** Feature flag name. */
export const KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG =
  "KNOWLEDGE_CONTRACT_INJECTION_ENABLED" as const;

/** Surface name (Surface B from 008A § 7). */
export const SURFACE_B_NAME = "task_prompt_preamble" as const;

/** Default max characters for the preamble portion. */
export const DEFAULT_SURFACE_B_MAX_CHARS = 2048 as const;

// Hard-coded safety literals — must be `false` in this slice.
export const RUNTIME_FLUSH_ALLOWED_LITERAL = false as const;
export const RUNTIME_DISPATCH_ALLOWED_LITERAL = false as const;
export const REAL_HANDOFF_WRITE_ALLOWED_LITERAL = false as const;
export const LIVE_ADAPTER_ALLOWED_LITERAL = false as const;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface KnowledgeSurfaceBInput {
  featureFlagEnabled: boolean;
  targetAgent: KnowledgeContractTargetAgent;
  taskKind?: string;
  userRequest?: string;
  handoffContext?: {
    hasIngestDraft?: boolean;
    hasFlushPending?: boolean;
    hasLocalKnownAndNewlyFound?: boolean;
  };
  baseTaskPrompt: string;
  maxChars?: number;
  hermesOverride?: boolean;
  overridePreambleText?: string;
  nowIso?: string;
}

export interface KnowledgeSurfaceBTriggerFlags {
  save_keyword: boolean;
  research_keyword: boolean;
  research_task_kind: boolean;
  has_ingest_draft: boolean;
  has_flush_pending: boolean;
  has_local_known_and_newly_found: boolean;
}

export interface KnowledgeSurfaceBOutput {
  schema_version: typeof KNOWLEDGE_SURFACE_B_SCHEMA_VERSION;
  slice: typeof SURFACE_B_SLICE;
  mode: typeof SURFACE_B_MODE;
  feature_flag_name: typeof KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG;
  feature_flag_enabled: boolean;
  feature_flag_default_state: false;
  surface: typeof SURFACE_B_NAME;
  target_agent: KnowledgeContractTargetAgent;
  preamble_attached: boolean;
  skip_reason: string | null;
  fallback_to_l4: boolean;
  trigger_flags: KnowledgeSurfaceBTriggerFlags;
  base_task_prompt_preserved: true;
  final_task_prompt: string;
  preamble_text: string | null;
  preamble_hash: string;
  truncated: boolean;
  max_chars: number;
  runtime_flush_allowed: false;
  runtime_dispatch_allowed: false;
  real_handoff_write_allowed: false;
  live_adapter_allowed: false;
  hermes_reserved_marker: boolean;
  created_at: string;
}

// -----------------------------------------------------------------
// Trigger derivation (mirror 008C, duplicated so 008F is self-contained)
// -----------------------------------------------------------------

function deriveTriggerFlags(input: KnowledgeSurfaceBInput): KnowledgeSurfaceBTriggerFlags {
  const text = (input.userRequest ?? "").toLowerCase();
  const saveKeywordPattern =
    /(\bsave\b|\bpersist\b|\bstore\b|\bingest\b|保存|沉淀|写入|存档|存到|入库|记到|记录|add to knowledge|save to knowledge)/i;
  const researchKeywordPattern =
    /(调研|研究|了解|解释|说明|介绍|告诉我|search|research|investigate|what is|how does|对比|比较|vs\.?|compare|选型|alternative)/i;
  const researchKinds = new Set<string>([
    "github_research",
    "tool_comparison",
    "technical_selection",
    "project_research",
    "general_research",
  ]);
  return {
    save_keyword: saveKeywordPattern.test(text),
    research_keyword: researchKeywordPattern.test(text),
    research_task_kind:
      input.taskKind !== undefined && researchKinds.has(input.taskKind),
    has_ingest_draft: input.handoffContext?.hasIngestDraft === true,
    has_flush_pending: input.handoffContext?.hasFlushPending === true,
    has_local_known_and_newly_found:
      input.handoffContext?.hasLocalKnownAndNewlyFound === true,
  };
}

// -----------------------------------------------------------------
// shouldApplyKnowledgeContractSurfaceB
// -----------------------------------------------------------------

/**
 * Pure boolean: should Surface B preamble be applied for this input?
 * Mirrors 008C semantics: flag on, target allowed, trigger fired,
 * hermes-reserved guard (unless hermesOverride=true).
 */
export function shouldApplyKnowledgeContractSurfaceB(
  input: KnowledgeSurfaceBInput
): boolean {
  if (input.featureFlagEnabled !== true) return false;
  if (
    input.targetAgent !== "claude_code" &&
    input.targetAgent !== "codex" &&
    input.targetAgent !== "hermes_pro" &&
    input.targetAgent !== "hermes"
  ) {
    return false;
  }
  if (input.targetAgent === "hermes" && input.hermesOverride !== true) {
    return false;
  }
  return shouldAttachKnowledgeContract({
    request_text: input.userRequest ?? "",
    task_kind: input.taskKind as never,
    handoff_context: {
      has_ingest_draft: input.handoffContext?.hasIngestDraft,
      has_flush_pending: input.handoffContext?.hasFlushPending,
      has_local_known: input.handoffContext?.hasLocalKnownAndNewlyFound,
      has_newly_found: input.handoffContext?.hasLocalKnownAndNewlyFound,
    },
  });
}

// -----------------------------------------------------------------
// buildKnowledgeContractSurfaceBPreamble
// -----------------------------------------------------------------

/**
 * Build the Surface B preamble string. Returns null when not applied.
 * Source: buildKnowledgeAgentContractSnippet (007I) — never inline literal.
 * For hermes with override, returns the reserved marker text.
 */
export function buildKnowledgeContractSurfaceBPreamble(
  input: KnowledgeSurfaceBInput
): {
  preamble: string | null;
  truncated: boolean;
  hash: string;
} {
  if (!shouldApplyKnowledgeContractSurfaceB(input)) {
    return { preamble: null, truncated: false, hash: "" };
  }
  const maxChars = input.maxChars ?? DEFAULT_SURFACE_B_MAX_CHARS;
  const isHermes = input.targetAgent === "hermes";
  const body =
    input.overridePreambleText ??
    (isHermes
      ? "[reserved — no default attach for hermes self-call]"
      : buildKnowledgeAgentContractSnippet(input.targetAgent));
  const truncated = body.length > maxChars;
  const preambleText = truncated ? body.slice(0, maxChars) : body;
  const wrapped = [
    `# Hermes Knowledge Reuse Contract — Surface B dry-run preamble`,
    `# target_agent: ${input.targetAgent}`,
    `# feature_flag: ${KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG}=${String(
      input.featureFlagEnabled
    )}`,
    `# runtime_flush_allowed: false | dry_run_only: true`,
    ``,
    preambleText,
  ].join("\n");
  const hash = createHash("sha256").update(wrapped).digest("hex");
  return { preamble: wrapped, truncated, hash };
}

// -----------------------------------------------------------------
// assertKnowledgeSurfaceBNoRuntime
// -----------------------------------------------------------------

/** Forged runtime flags that the Surface B output must never expose
 *  as truthy. Defense-in-depth. */
const FORGED_RUNTIME_FLAG_KEYS: ReadonlyArray<string> = [
  "runtime_flush_allowed",
  "runtime_dispatch_allowed",
  "real_handoff_write_allowed",
  "live_adapter_allowed",
];

/**
 * Pure guard. Throws when output exposes a forged truthy runtime flag
 * or contains a forbidden runtime call expression in preamble /
 * final_task_prompt.
 */
export function assertKnowledgeSurfaceBNoRuntime(
  output: KnowledgeSurfaceBOutput
): void {
  for (const key of FORGED_RUNTIME_FLAG_KEYS) {
    if (
      (output as unknown as Record<string, unknown>)[key] !== false
    ) {
      throw new Error(
        `assertKnowledgeSurfaceBNoRuntime: output.${key} must be literal false`
      );
    }
  }
  const forbiddenCallTokens: ReadonlyArray<string> = [
    "knowledgeIngest(",
    "knowledgeSearch(",
    "runPlaybook(",
    "triggerCronJob(",
    "sendMessage(",
    "fetch(",
  ];
  const haystack =
    (output.preamble_text ?? "") + "\n" + output.final_task_prompt;
  for (const token of forbiddenCallTokens) {
    if (haystack.includes(token)) {
      throw new Error(
        `assertKnowledgeSurfaceBNoRuntime: surface B output contains forbidden call expression "${token}"`
      );
    }
  }
}

// -----------------------------------------------------------------
// buildTaskPromptWithKnowledgeContractSurfaceB
// -----------------------------------------------------------------

/**
 * Build the final task prompt string with Surface B preamble
 * prepended when applicable. Pure function. Returns the structured
 * output (which includes final_task_prompt, preamble_text, etc.).
 *
 * baseTaskPrompt is preserved verbatim. When preamble is attached,
 * format is: `${preamble}\n\n${baseTaskPrompt}`. When skipped,
 * final_task_prompt === baseTaskPrompt.
 */
export function buildTaskPromptWithKnowledgeContractSurfaceB(
  input: KnowledgeSurfaceBInput
): KnowledgeSurfaceBOutput {
  const maxChars = input.maxChars ?? DEFAULT_SURFACE_B_MAX_CHARS;
  const triggerFlags = deriveTriggerFlags(input);
  const apply = shouldApplyKnowledgeContractSurfaceB(input);
  const hermesReserved = input.targetAgent === "hermes";

  let skipReason: string | null = null;
  if (!input.featureFlagEnabled) {
    skipReason = "flag_disabled";
  } else if (hermesReserved && input.hermesOverride !== true) {
    skipReason = "hermes_self_call_reserved";
  } else if (!apply) {
    skipReason = "no_trigger_fired";
  }

  const { preamble, truncated, hash } =
    buildKnowledgeContractSurfaceBPreamble(input);

  const finalTaskPrompt =
    preamble !== null ? `${preamble}\n\n${input.baseTaskPrompt}` : input.baseTaskPrompt;

  return {
    schema_version: KNOWLEDGE_SURFACE_B_SCHEMA_VERSION,
    slice: SURFACE_B_SLICE,
    mode: SURFACE_B_MODE,
    feature_flag_name: KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
    feature_flag_enabled: input.featureFlagEnabled === true,
    feature_flag_default_state: false,
    surface: SURFACE_B_NAME,
    target_agent: input.targetAgent,
    preamble_attached: preamble !== null,
    skip_reason: skipReason,
    fallback_to_l4: preamble === null,
    trigger_flags: triggerFlags,
    base_task_prompt_preserved: true,
    final_task_prompt: finalTaskPrompt,
    preamble_text: preamble,
    preamble_hash: hash,
    truncated,
    max_chars: maxChars,
    runtime_flush_allowed: RUNTIME_FLUSH_ALLOWED_LITERAL,
    runtime_dispatch_allowed: RUNTIME_DISPATCH_ALLOWED_LITERAL,
    real_handoff_write_allowed: REAL_HANDOFF_WRITE_ALLOWED_LITERAL,
    live_adapter_allowed: LIVE_ADAPTER_ALLOWED_LITERAL,
    hermes_reserved_marker: hermesReserved && input.hermesOverride !== true,
    created_at: input.nowIso ?? new Date().toISOString(),
  };
}
