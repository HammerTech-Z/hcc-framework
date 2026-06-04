// Hermes Pro — Knowledge Task Dispatch Prompt Builder (Slice 008J, no runtime)
// Pure functions only. No I/O, no network, no IPC, no runtime ingest,
// no Agent subprocess, no real handoff write, no audit write, no
// prompt builder mutation in existing chain, no default system
// prompt mutation, no gateway, no cron, no WeChat / iLink.
//
// This is the main-side entry point recommended by 008I: a NEW pure
// file that wraps 008F Surface B helper. It returns a composed
// prompt string for the existing dispatch chain to consume. It does
// NOT call any real dispatcher, Agent, or prompt builder in place.

import {
  buildTaskPromptWithKnowledgeContractSurfaceB as buildSurfaceBPrompt,
  assertKnowledgeSurfaceBNoRuntime,
  type KnowledgeSurfaceBOutput,
} from "../shared/lib/knowledge-runtime-injection-surface-b";

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export const TASK_DISPATCH_BUILDER_SCHEMA_VERSION = "1.0.0" as const;

export const TASK_DISPATCH_BUILDER_SLICE = "008J" as const;

export const TASK_DISPATCH_BUILDER_MODE = "task_dispatch_prompt_builder" as const;

export const KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG =
  "KNOWLEDGE_CONTRACT_INJECTION_ENABLED" as const;

export const TASK_DISPATCH_SURFACE = "task_prompt_preamble" as const;

export const DEFAULT_TASK_DISPATCH_MAX_CHARS = 2048 as const;

// Hard-coded safety literals — must be `false` in this slice.
export const RUNTIME_FLUSH_ALLOWED_LITERAL = false as const;
export const RUNTIME_DISPATCH_ALLOWED_LITERAL = false as const;
export const REAL_HANDOFF_WRITE_ALLOWED_LITERAL = false as const;
export const LIVE_ADAPTER_ALLOWED_LITERAL = false as const;

export const TASK_DISPATCH_NO_L6 = true as const;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface TaskDispatchPromptInput {
  featureFlagEnabled: boolean;
  targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes";
  baseTaskPrompt: string;
  taskKind?: string;
  userRequest?: string;
  handoffContext?: {
    hasIngestDraft?: boolean;
    hasFlushPending?: boolean;
    hasLocalKnownAndNewlyFound?: boolean;
  };
  maxChars?: number;
  hermesOverride?: boolean;
}

export interface TaskDispatchTriggerFlags {
  save_keyword: boolean;
  research_keyword: boolean;
  research_task_kind: boolean;
  has_ingest_draft: boolean;
  has_flush_pending: boolean;
  has_local_known_and_newly_found: boolean;
}

export interface TaskDispatchPromptOutput {
  schema_version: typeof TASK_DISPATCH_BUILDER_SCHEMA_VERSION;
  slice: typeof TASK_DISPATCH_BUILDER_SLICE;
  mode: typeof TASK_DISPATCH_BUILDER_MODE;
  feature_flag_name: typeof KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG;
  feature_flag_enabled: boolean;
  feature_flag_default_state: false;
  surface: typeof TASK_DISPATCH_SURFACE;
  target_agent: "claude_code" | "codex" | "hermes_pro" | "hermes";
  knowledge_contract_attached: boolean;
  skip_reason: string | null;
  fallback_to_l4: boolean;
  trigger_flags: TaskDispatchTriggerFlags;
  base_task_prompt_preserved: true;
  final_task_prompt: string;
  preamble_text: string | null;
  truncated: boolean;
  max_chars: number;
  runtime_flush_allowed: false;
  runtime_dispatch_allowed: false;
  real_handoff_write_allowed: false;
  live_adapter_allowed: false;
  no_l6: typeof TASK_DISPATCH_NO_L6;
  hermes_reserved_marker: boolean;
  created_at: string;
}

// -----------------------------------------------------------------
// shouldApplyKnowledgeContractToDispatchPrompt
// -----------------------------------------------------------------

/**
 * Pure boolean: should the dispatch prompt receive a knowledge
 * contract preamble for this input? Mirrors 008F surface B semantics.
 * No I/O, no IPC, no fetch.
 */
export function shouldApplyKnowledgeContractToDispatchPrompt(
  input: TaskDispatchPromptInput
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
  // Inline 008F's shouldApply (we don't import it directly here to
  // keep the dependency surface narrow; identical logic).
  const text = (input.userRequest ?? "").toLowerCase();
  const savePattern =
    /(\bsave\b|\bpersist\b|\bstore\b|\bingest\b|保存|沉淀|写入|存档|存到|入库|记到|记录|add to knowledge|save to knowledge)/i;
  const researchPattern =
    /(调研|研究|了解|解释|说明|介绍|告诉我|search|research|investigate|what is|how does|对比|比较|vs\.?|compare|选型|alternative)/i;
  const researchKinds = new Set<string>([
    "github_research",
    "tool_comparison",
    "technical_selection",
    "project_research",
    "general_research",
  ]);
  if (savePattern.test(text)) return true;
  if (researchPattern.test(text)) return true;
  if (input.taskKind !== undefined && researchKinds.has(input.taskKind)) {
    return true;
  }
  const hc = input.handoffContext;
  if (hc) {
    if (hc.hasIngestDraft === true) return true;
    if (hc.hasFlushPending === true) return true;
    if (hc.hasLocalKnownAndNewlyFound === true) return true;
  }
  return false;
}

// -----------------------------------------------------------------
// buildTaskDispatchPrompt
// -----------------------------------------------------------------

/**
 * Build the composed dispatch prompt for the existing dispatch
 * chain to consume. Pure function. Internally delegates to 008F
 * `buildTaskPromptWithKnowledgeContractSurfaceB` (the canonical
 * Surface B helper). The returned object includes the final
 * composed prompt string and the Surface B metadata for downstream
 * dry-run artifacts / chain tests.
 *
 * baseTaskPrompt is preserved verbatim. When preamble is attached,
 * the format is `${preamble}\n\n${baseTaskPrompt}`. When skipped,
 * final_task_prompt equals baseTaskPrompt byte-for-byte.
 *
 * No I/O, no IPC, no real dispatch, no Agent subprocess, no prompt
 * builder mutation in place.
 */
export function buildTaskDispatchPrompt(
  input: TaskDispatchPromptInput
): TaskDispatchPromptOutput {
  const maxChars = input.maxChars ?? DEFAULT_TASK_DISPATCH_MAX_CHARS;

  // Build 008F Surface B output. baseTaskPrompt is required.
  const surfaceBOutput: KnowledgeSurfaceBOutput = buildSurfaceBPrompt({
    featureFlagEnabled: input.featureFlagEnabled,
    targetAgent: input.targetAgent,
    baseTaskPrompt: input.baseTaskPrompt,
    taskKind: input.taskKind,
    userRequest: input.userRequest,
    handoffContext: input.handoffContext,
    maxChars: input.maxChars,
    hermesOverride: input.hermesOverride,
  });

  // Derive skip_reason aligned with 008F semantics.
  let skipReason: string | null = surfaceBOutput.skip_reason;
  if (skipReason === undefined) skipReason = null;

  return {
    schema_version: TASK_DISPATCH_BUILDER_SCHEMA_VERSION,
    slice: TASK_DISPATCH_BUILDER_SLICE,
    mode: TASK_DISPATCH_BUILDER_MODE,
    feature_flag_name: KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
    feature_flag_enabled: surfaceBOutput.feature_flag_enabled,
    feature_flag_default_state: false,
    surface: TASK_DISPATCH_SURFACE,
    target_agent: input.targetAgent,
    knowledge_contract_attached: surfaceBOutput.preamble_attached,
    skip_reason: skipReason,
    fallback_to_l4: surfaceBOutput.fallback_to_l4,
    trigger_flags: {
      save_keyword: surfaceBOutput.trigger_flags.save_keyword,
      research_keyword: surfaceBOutput.trigger_flags.research_keyword,
      research_task_kind: surfaceBOutput.trigger_flags.research_task_kind,
      has_ingest_draft: surfaceBOutput.trigger_flags.has_ingest_draft,
      has_flush_pending: surfaceBOutput.trigger_flags.has_flush_pending,
      has_local_known_and_newly_found:
        surfaceBOutput.trigger_flags.has_local_known_and_newly_found,
    },
    base_task_prompt_preserved: true,
    final_task_prompt: surfaceBOutput.final_task_prompt,
    preamble_text: surfaceBOutput.preamble_text,
    truncated: surfaceBOutput.truncated,
    max_chars: maxChars,
    runtime_flush_allowed: RUNTIME_FLUSH_ALLOWED_LITERAL,
    runtime_dispatch_allowed: RUNTIME_DISPATCH_ALLOWED_LITERAL,
    real_handoff_write_allowed: REAL_HANDOFF_WRITE_ALLOWED_LITERAL,
    live_adapter_allowed: LIVE_ADAPTER_ALLOWED_LITERAL,
    no_l6: TASK_DISPATCH_NO_L6,
    hermes_reserved_marker: surfaceBOutput.hermes_reserved_marker,
    created_at: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------
// assertTaskDispatchPromptBuilderNoRuntime
// -----------------------------------------------------------------

/** Forged runtime flag keys that the dispatch prompt builder output
 *  must never expose as truthy. Defense-in-depth. */
const FORGED_RUNTIME_FLAG_KEYS: ReadonlyArray<string> = [
  "runtime_flush_allowed",
  "runtime_dispatch_allowed",
  "real_handoff_write_allowed",
  "live_adapter_allowed",
];

/**
 * Pure guard. Throws when output exposes a forged truthy runtime
 * flag or contains a forbidden runtime call expression in
 * preamble_text / final_task_prompt.
 */
export function assertTaskDispatchPromptBuilderNoRuntime(
  output: TaskDispatchPromptOutput
): void {
  for (const key of FORGED_RUNTIME_FLAG_KEYS) {
    if (
      (output as unknown as Record<string, unknown>)[key] !== false
    ) {
      throw new Error(
        `assertTaskDispatchPromptBuilderNoRuntime: output.${key} must be literal false`
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
        `assertTaskDispatchPromptBuilderNoRuntime: dispatch prompt contains forbidden call expression "${token}"`
      );
    }
  }
  // Cross-validate via 008F's no-runtime guard as belt-and-suspenders.
  // Reconstruct a minimal 008F-shaped payload for the guard.
  const surfaceBForGuard: KnowledgeSurfaceBOutput = {
    schema_version: "1.0.0",
    slice: "008F",
    mode: "surface_b_dry_run_implementation",
    feature_flag_name: KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
    feature_flag_enabled: output.feature_flag_enabled,
    feature_flag_default_state: false,
    surface: TASK_DISPATCH_SURFACE,
    target_agent: output.target_agent,
    preamble_attached: output.knowledge_contract_attached,
    skip_reason: output.skip_reason,
    fallback_to_l4: output.fallback_to_l4,
    trigger_flags: {
      save_keyword: output.trigger_flags.save_keyword,
      research_keyword: output.trigger_flags.research_keyword,
      research_task_kind: output.trigger_flags.research_task_kind,
      has_ingest_draft: output.trigger_flags.has_ingest_draft,
      has_flush_pending: output.trigger_flags.has_flush_pending,
      has_local_known_and_newly_found:
        output.trigger_flags.has_local_known_and_newly_found,
    },
    base_task_prompt_preserved: true,
    final_task_prompt: output.final_task_prompt,
    preamble_text: output.preamble_text,
    preamble_hash: "",
    truncated: output.truncated,
    max_chars: output.max_chars,
    runtime_flush_allowed: false,
    runtime_dispatch_allowed: false,
    real_handoff_write_allowed: false,
    live_adapter_allowed: false,
    hermes_reserved_marker: output.hermes_reserved_marker,
    created_at: output.created_at,
  };
  assertKnowledgeSurfaceBNoRuntime(surfaceBForGuard);
}
