// Hermes Pro — Knowledge Runtime Injection Pure Simulation Helper (Slice 008C, no runtime)
// Pure functions only. No I/O, no network, no IPC, no runtime ingest,
// no dispatch prompt mutation, no prompt builder mutation, no real
// handoff write, no audit log write, no agent subprocess, no cron /
// WeChat / iLink, no global default system prompt modification.
//
// This helper SIMULATES the future Surface B (task prompt preamble)
// injection under the KNOWLEDGE_CONTRACT_INJECTION_ENABLED feature
// flag. It does NOT modify any real dispatch path, system prompt, or
// handoff writer. The returned object is a dry-run artifact suitable
// for inspection in tests and future harness chains; it must never be
// piped into a real prompt builder without an explicit future slice
// approval.

import { createHash } from "crypto";

import {
  buildKnowledgeAgentContractSnippet,
  shouldAttachKnowledgeContract,
  type KnowledgeContractTargetAgent,
} from "./knowledge-agent-contract-snippet";

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Schema version of the simulation artifact. */
export const KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION =
  "1.0.0" as const;

/** Default max characters for the simulated preamble snippet. */
export const DEFAULT_SIMULATION_MAX_CHARS = 2048 as const;

/** Feature flag name controlling the future Surface B injection. */
export const KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG =
  "KNOWLEDGE_CONTRACT_INJECTION_ENABLED" as const;

/** The recommended injection surface (Slice 008A § 7). */
export const RECOMMENDED_INJECTION_SURFACE = "task_prompt_preamble" as const;

/** Mode literal of this helper. */
export const SIMULATION_MODE = "runtime_injection_simulation" as const;

/** All four supported target agents. */
export const SIMULATION_SUPPORTED_TARGET_AGENTS: ReadonlyArray<KnowledgeContractTargetAgent> =
  ["claude_code", "codex", "hermes_pro", "hermes"];

// Hard-coded safety literals — must be `false` in this slice.
export const RUNTIME_FLUSH_ALLOWED_LITERAL = false as const;
export const RUNTIME_DISPATCH_ALLOWED_LITERAL = false as const;
export const REAL_HANDOFF_WRITE_ALLOWED_LITERAL = false as const;
export const LIVE_ADAPTER_ALLOWED_LITERAL = false as const;

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface KnowledgeRuntimeInjectionSimulationInput {
  /** Whether the future Surface B feature flag is enabled. */
  featureFlagEnabled: boolean;
  /** The agent that would receive the (simulated) preamble. */
  targetAgent: KnowledgeContractTargetAgent;
  /** Optional upstream task_kind. */
  taskKind?: string;
  /** Free-text user request; passed to shouldAttachKnowledgeContract. */
  userRequest?: string;
  /** Optional handoff context flags from upstream (007I / 007J). */
  handoffContext?: {
    hasIngestDraft?: boolean;
    hasFlushPending?: boolean;
    hasLocalKnownAndNewlyFound?: boolean;
  };
  /** Optional base task prompt; preserved verbatim when present. */
  baseTaskPrompt?: string;
  /** Max characters; defaults to 2048. */
  maxChars?: number;
  /** Optional explicit override of the reserved hermes self-call guard. */
  hermesOverride?: boolean;
  /** Optional override for the snippet source (test seam). */
  overrideSnippetText?: string;
  /** Optional fixed timestamp (test seam). */
  nowIso?: string;
}

export interface KnowledgeRuntimeInjectionTriggerFlags {
  save_keyword: boolean;
  research_keyword: boolean;
  research_task_kind: boolean;
  has_ingest_draft: boolean;
  has_flush_pending: boolean;
  has_local_known_and_newly_found: boolean;
}

export interface KnowledgeRuntimeInjectionSafetyGateResult {
  pass: boolean;
  reason: string;
}

export interface KnowledgeRuntimeInjectionSimulation {
  schema_version: typeof KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION;
  mode: typeof SIMULATION_MODE;
  feature_flag: {
    name: typeof KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG;
    enabled: boolean;
    default_state: false;
  };
  target_agent: KnowledgeContractTargetAgent;
  surface: typeof RECOMMENDED_INJECTION_SURFACE;
  snippet_attached: boolean;
  skip_reason: string | null;
  fallback_to_l4: boolean;
  trigger_flags: KnowledgeRuntimeInjectionTriggerFlags;
  safety_gate_result: KnowledgeRuntimeInjectionSafetyGateResult;
  simulated_preamble: string | null;
  simulated_dispatch_prompt: string;
  snippet_hash_or_content_hash: string;
  max_chars: number;
  truncated: boolean;
  runtime_flush_allowed: false;
  runtime_dispatch_allowed: false;
  real_handoff_write_allowed: false;
  live_adapter_allowed: false;
  hermes_reserved_marker: boolean;
  created_at: string;
  source_doc: string;
}

// -----------------------------------------------------------------
// Trigger derivation
// -----------------------------------------------------------------

function deriveTriggerFlags(
  input: KnowledgeRuntimeInjectionSimulationInput
): KnowledgeRuntimeInjectionTriggerFlags {
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
// shouldSimulateKnowledgeContractInjection
// -----------------------------------------------------------------

/**
 * Pure boolean: should the simulated injection (Surface B preamble)
 * be attached for this input? Mirrors 008B § 5 attach_when / skip_when
 * semantics, with the addition of the explicit hermes reserved guard
 * (008B § 5: hermes self-call skips unless explicit override flag).
 *
 * Returns true only when ALL of the following hold:
 *   - featureFlagEnabled is true
 *   - targetAgent is one of {claude_code, codex, hermes_pro, hermes}
 *   - targetAgent !== 'hermes' OR hermesOverride === true
 *   - shouldAttachKnowledgeContract returns true (the upstream
 *     007I/007J trigger decision)
 *
 * Pure function. No I/O, no IPC, no fetch.
 */
export function shouldSimulateKnowledgeContractInjection(
  input: KnowledgeRuntimeInjectionSimulationInput
): boolean {
  if (input.featureFlagEnabled !== true) return false;
  if (
    !SIMULATION_SUPPORTED_TARGET_AGENTS.includes(input.targetAgent)
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
// buildSimulatedTaskPromptPreamble
// -----------------------------------------------------------------

/**
 * Build the simulated Surface B preamble string. Pure data. Returns
 * null when no preamble should be attached. The string is the contract
 * snippet (from 007I) wrapped with the simulation envelope header; it
 * is the value that a future dispatcher WOULD prepend to the task
 * prompt — but this helper does NOT call any real dispatcher.
 *
 * max_chars truncation is enforced. The hermes reserved marker is
 * returned for hermes (when override is set) so the simulation still
 * surfaces a deterministic inert preamble.
 */
export function buildSimulatedTaskPromptPreamble(
  input: KnowledgeRuntimeInjectionSimulationInput
): {
  preamble: string | null;
  truncated: boolean;
  hash: string;
} {
  if (!shouldSimulateKnowledgeContractInjection(input)) {
    return { preamble: null, truncated: false, hash: "" };
  }
  const maxChars = input.maxChars ?? DEFAULT_SIMULATION_MAX_CHARS;
  const isHermes = input.targetAgent === "hermes";
  const body =
    input.overrideSnippetText ??
    (isHermes
      ? "[reserved — no default attach for hermes self-call]"
      : buildKnowledgeAgentContractSnippet(input.targetAgent));
  const truncated = body.length > maxChars;
  const preambleText = truncated ? body.slice(0, maxChars) : body;
  const wrapped = [
    `# Hermes Knowledge Reuse Contract — simulated Surface B preamble`,
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
// assertKnowledgeRuntimeInjectionSimulationNoRuntime
// -----------------------------------------------------------------

/** Forged runtime flags that the simulation artifact must never expose
 *  as truthy. Defense-in-depth: even if a caller passes a malformed
 *  input, the simulation output is forced to `false`. */
const FORGED_RUNTIME_FLAG_KEYS: ReadonlyArray<string> = [
  "runtime_flush_allowed",
  "runtime_dispatch_allowed",
  "real_handoff_write_allowed",
  "live_adapter_allowed",
];

/**
 * Pure guard. Throws when a payload exposes a forged truthy runtime
 * flag or contains a forbidden runtime call expression in the
 * simulated preamble / dispatch prompt. Used by tests and integration
 * boundaries.
 */
export function assertKnowledgeRuntimeInjectionSimulationNoRuntime(
  payload: KnowledgeRuntimeInjectionSimulation
): void {
  for (const key of FORGED_RUNTIME_FLAG_KEYS) {
    if (
      (payload as unknown as Record<string, unknown>)[key] !== false
    ) {
      throw new Error(
        `assertKnowledgeRuntimeInjectionSimulationNoRuntime: payload.${key} must be literal false`
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
    (payload.simulated_preamble ?? "") + "\n" + payload.simulated_dispatch_prompt;
  for (const token of forbiddenCallTokens) {
    if (haystack.includes(token)) {
      throw new Error(
        `assertKnowledgeRuntimeInjectionSimulationNoRuntime: simulated output contains forbidden call expression "${token}"`
      );
    }
  }
}

// -----------------------------------------------------------------
// buildKnowledgeRuntimeInjectionSimulation
// -----------------------------------------------------------------

/**
 * Build the full simulation artifact for a given input. Pure function.
 * No I/O, no IPC, no fetch, no real dispatch.
 *
 * The artifact records:
 *   - feature_flag (name + enabled + default_state)
 *   - target_agent
 *   - surface (always "task_prompt_preamble" in Phase 1)
 *   - trigger_flags (6 booleans, mirroring 007J)
 *   - snippet_attached
 *   - skip_reason / fallback_to_l4
 *   - safety_gate_result
 *   - simulated_preamble / simulated_dispatch_prompt (in-memory only)
 *   - snippet_hash_or_content_hash
 *   - max_chars / truncated
 *   - four hard-coded `false` safety flags
 *
 * Production default: flag disabled → snippet_attached=false,
 * fallback_to_l4=true, simulated_preamble=null, simulated_dispatch_prompt
 * is just the (optional) base task prompt.
 */
export function buildKnowledgeRuntimeInjectionSimulation(
  input: KnowledgeRuntimeInjectionSimulationInput
): KnowledgeRuntimeInjectionSimulation {
  const maxChars = input.maxChars ?? DEFAULT_SIMULATION_MAX_CHARS;
  const triggerFlags = deriveTriggerFlags(input);
  const attach = shouldSimulateKnowledgeContractInjection(input);
  const hermesReserved = input.targetAgent === "hermes";

  let skipReason: string | null = null;
  if (!input.featureFlagEnabled) {
    skipReason = "flag_disabled";
  } else if (hermesReserved && input.hermesOverride !== true) {
    skipReason = "hermes_self_call_reserved";
  } else if (!attach) {
    skipReason = "no_trigger_fired";
  }

  const { preamble, truncated, hash } = buildSimulatedTaskPromptPreamble(input);

  const basePrompt = input.baseTaskPrompt ?? "";
  const dispatchPrompt =
    preamble !== null ? `${preamble}\n\n${basePrompt}` : basePrompt;

  const safetyGateResult: KnowledgeRuntimeInjectionSafetyGateResult =
    attach && preamble !== null
      ? { pass: true, reason: "all_gates_pass" }
      : {
          pass: false,
          reason: skipReason ?? "no_preamble_built",
        };

  const snippet_attached = preamble !== null;
  const fallback_to_l4 = !snippet_attached;

  return {
    schema_version: KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION,
    mode: SIMULATION_MODE,
    feature_flag: {
      name: KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
      enabled: input.featureFlagEnabled === true,
      default_state: false,
    },
    target_agent: input.targetAgent,
    surface: RECOMMENDED_INJECTION_SURFACE,
    snippet_attached,
    skip_reason: skipReason,
    fallback_to_l4,
    trigger_flags: triggerFlags,
    safety_gate_result: safetyGateResult,
    simulated_preamble: preamble,
    simulated_dispatch_prompt: dispatchPrompt,
    snippet_hash_or_content_hash: hash,
    max_chars: maxChars,
    truncated,
    runtime_flush_allowed: RUNTIME_FLUSH_ALLOWED_LITERAL,
    runtime_dispatch_allowed: RUNTIME_DISPATCH_ALLOWED_LITERAL,
    real_handoff_write_allowed: REAL_HANDOFF_WRITE_ALLOWED_LITERAL,
    live_adapter_allowed: LIVE_ADAPTER_ALLOWED_LITERAL,
    hermes_reserved_marker: hermesReserved && input.hermesOverride !== true,
    created_at: input.nowIso ?? new Date().toISOString(),
    source_doc:
      "docs/knowledge/knowledge-runtime-injection-simulation-helper-2026-06-04.md",
  };
}
