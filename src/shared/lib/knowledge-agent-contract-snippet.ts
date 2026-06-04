// Hermes Pro — Knowledge Agent Contract Snippet (Slice 007I, no runtime)
// Pure functions only. No I/O, no network, no IPC, no runtime ingest,
// no Claude Code subprocess, no handoff payload mutation, no ~/.hermes/handoff
// write, no audit log write, no cron / WeChat / iLink.

import type { KnowledgeReuseTaskKind } from "./knowledge-reuse-protocol";

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** The single canonical destination for all knowledge writes. */
export const CANONICAL_KNOWLEDGE_STORE_NAME =
  "Hermes Pro internal knowledge store" as const;

/** Runtime flush flag — always false in this slice. */
export const RUNTIME_FLUSH_ALLOWED_LITERAL = "false" as const;

// -----------------------------------------------------------------
// Contract snippet
// -----------------------------------------------------------------

/**
 * The contract snippet, returned as a single multi-line string. Designed
 * to be dropped into a Claude Code / Codex / Hermes Pro task prompt
 * verbatim. Pure function; does NOT call any helper, IPC, or runtime.
 *
 * The snippet contains:
 * - 1 sentence about the canonical store
 * - 5 "do not" lines (vault path / MEMORY.md / .wolf / arbitrary note paths / claim-saved)
 * - 6 "do" lines (output shape / source fidelity / bucket semantics / etc.)
 * - 1 closing reminder about runtime_flush_allowed=false
 */
export function buildKnowledgeAgentContractSnippet(
  target_agent: KnowledgeContractTargetAgent
): string {
  const lines: string[] = [];
  lines.push(
    `# Hermes Knowledge Reuse Contract (for ${target_agent}, slice 007I)`
  );
  lines.push("");
  lines.push(
    "1. The canonical knowledge store is the Hermes Pro internal knowledge store. " +
      "It is managed by Hermes Pro. Do not ask the user for an Obsidian Vault path."
  );
  lines.push(
    "2. Do not write to MEMORY.md, .claude/memory/MEMORY.md, .wolf/cerebrum.md, " +
      ".wolf/anatomy.md, .wolf/memory.md, or any other custom note path " +
      "(notes/<topic>.md, research/<date>.md, etc.). Do not invent new write paths."
  );
  lines.push(
    "3. Do not use any of the deceptive-phrase patterns listed in the " +
      "forbidden-copy fixture. Until runtime flush is approved, " +
      "no write has happened."
  );
  lines.push(
    "4. Output the answer in 4 sections: " +
      "(a) local_known (vault:// / knowledge:// / docs/...), " +
      "(b) newly_found (https://..., trust_level=untrusted_external), " +
      "(c) judgment (your analysis, kept separate from findings), " +
      "(d) ingest_draft (only if the user said 'save to knowledge')."
  );
  lines.push(
    "5. Preserve source_uri and fetched_at exactly as input. " +
      "Do not rewrite, truncate, or drift them. " +
      "source_type='vault' is reserved for vault:// URIs only."
  );
  lines.push(
    "6. Bucket semantics: local_plan / vault / knowledge_search / gbrain_typed_link " +
      "go to local_known. github / web go to newly_found. " +
      "Stale / archive / *.before-* / v*-status.md / docs/archive/* / " +
      "Desktop知识/归档/ go to historical_only (do_not_use_as_current_truth=true). " +
      "Do not place stale findings in newly_found."
  );
  lines.push(
    "7. Confirmation only makes the draft eligible for an approved flush path. " +
      "runtime_flush_allowed = false. " +
      "Real flush requires a separate live adapter implementation slice to be approved."
  );
  lines.push(
    "8. Do not start serve / run / agent / delegate / playbook / gateway / cron / handoff_write / " +
      "audit_write / hcc_executor. Do not call knowledgeIngest, knowledgeSearch, " +
      "fetch, axios, XMLHttpRequest, runPlaybook, triggerCronJob, sendMessage."
  );
  return lines.join("\n");
}

/**
 * Supported target agents. Listed in the type so the snippet can be tuned
 * per agent. Today the snippet is identical across agents; this field
 * exists for future divergence.
 */
export type KnowledgeContractTargetAgent =
  | "claude_code"
  | "codex"
  | "hermes_pro"
  | "hermes";

export const SUPPORTED_TARGET_AGENTS: ReadonlyArray<KnowledgeContractTargetAgent> =
  ["claude_code", "codex", "hermes_pro", "hermes"];

// -----------------------------------------------------------------
// shouldAttachKnowledgeContract
// -----------------------------------------------------------------

/**
 * A small, pure context object used to decide whether the contract
 * snippet should be attached to a given prompt. Pure data; no I/O.
 */
export interface KnowledgeContractAttachContext {
  /**
   * The free-text user request. Examples:
   *   "compare A vs B"
   *   "save this to the knowledge base"
   *   "research GitHub repo X and write to knowledge"
   *   "fix the bug in src/foo.ts"
   */
  request_text: string;
  /**
   * Optional task_kind from the upstream plan (Slice 004).
   */
  task_kind?: KnowledgeReuseTaskKind;
  /**
   * Optional handoff payload hint. When true, the caller is in a handoff
   * flow (e.g. Hermes handing off to Claude Code).
   */
  handoff_context?: {
    has_ingest_draft?: boolean;
    has_flush_pending?: boolean;
    has_local_known?: boolean;
    has_newly_found?: boolean;
    owner?: "claude_code" | "hermes" | "user";
  };
}

/**
 * Pure boolean: should the contract snippet be attached to this prompt?
 *
 * The contract is attached when ANY of the following is true:
 * - The user said "save / persist / 沉淀 / 存入 / 写进 / ingest" the
 *   research output into a knowledge base.
 * - The user asked for GitHub / web / repo / local docs research and the
 *   research output is expected to be saved.
 * - The task_kind is one of the four "research / save / compare" kinds
 *   (github_research, tool_comparison, technical_selection,
 *   project_research, general_research).
 * - The handoff context contains an ingest_draft or flush_pending
 *   (i.e. a knowledge save is in flight).
 *
 * The contract is NOT attached when:
 * - The task is ordinary code-only work (refactor / bug fix / test
 *   addition) AND the user has not asked to save anything to the
 *   knowledge base.
 *
 * Pure function. Does not call knowledgeSearch, knowledgeIngest, fetch,
 * or any IPC. Operates only on the structured input.
 */
export function shouldAttachKnowledgeContract(
  context: KnowledgeContractAttachContext
): boolean {
  const text = (context.request_text ?? "").toLowerCase();

  // 1. Explicit save keyword (zh + en)
  const saveKeywordPattern =
    /(保存|沉淀|写入|存档|存到|入库|记到|记录|add to knowledge|save to knowledge|persist|store|ingest)/i;
  if (saveKeywordPattern.test(text)) {
    return true;
  }

  // 2. Research keyword + implicit save (e.g. "research X and write to KB")
  const researchKeywordPattern =
    /(调研|研究|了解|解释|说明|介绍|告诉我|search|research|investigate|what is|how does|对比|比较|vs\.?|compare|选型|alternative)/i;
  if (researchKeywordPattern.test(text)) {
    // If the user said "research" but did NOT say "save", the contract
    // is still attached because Hermes' default research handoff expects
    // the 4-section answer shape even when no save is requested.
    return true;
  }

  // 3. task_kind is a research / save / compare kind
  const researchKinds: ReadonlyArray<KnowledgeReuseTaskKind> = [
    "github_research",
    "tool_comparison",
    "technical_selection",
    "project_research",
    "general_research",
  ];
  if (context.task_kind && researchKinds.includes(context.task_kind)) {
    return true;
  }

  // 4. Handoff context carries ingest_draft or flush_pending
  const hc = context.handoff_context;
  if (hc) {
    if (hc.has_ingest_draft === true) return true;
    if (hc.has_flush_pending === true) return true;
    if (hc.has_local_known === true && hc.has_newly_found === true) return true;
  }

  // Otherwise: ordinary code task, no save intent, no research — no contract
  return false;
}

// -----------------------------------------------------------------
// assertKnowledgeContractNoRuntime
// -----------------------------------------------------------------

/** A small set of forbidden tokens that must never appear as runtime calls. */
export const FORBIDDEN_RUNTIME_TOKENS: ReadonlyArray<string> = [
  "knowledgeIngest",
  "knowledgeSearch",
  "ipcMain",
  "ipcRenderer",
  "triggerCronJob",
  "sendMessage",
  "runPlaybook",
  "child_process",
  "delegate_task",
  "fetch(",
  "axios",
  "XMLHttpRequest",
  "serve",
  "agent",
];

export interface AssertKnowledgeContractNoRuntimeResult {
  ok: boolean;
  hits: Array<{ token: string; excerpt: string }>;
}

/**
 * Pure validator. Scans the given contract content (typically the
 * snippet string) for any forbidden runtime tokens used as **call
 * expressions** (e.g. `knowledgeIngest(` or `axios.request(`). Pure
 * function; no I/O, no IPC, no fetch.
 *
 * Note: the snippet itself MAY mention these tokens as part of the
 * "do not call" instruction. We only flag them when they appear as
 * a call site (followed by `(`) — not when they appear in a quoted
 * string or a `not` clause. This validator is a guardrail for callers
 * who may paste extra content into the snippet; it is NOT a guardrail
 * for the canonical snippet (which is hand-written and already
 * validated at test time).
 */
export function assertKnowledgeContractNoRuntime(
  content: string
): AssertKnowledgeContractNoRuntimeResult {
  const hits: Array<{ token: string; excerpt: string }> = [];
  if (typeof content !== "string") {
    return { ok: false, hits: hits };
  }
  for (const token of FORBIDDEN_RUNTIME_TOKENS) {
    // If the token already ends with "(", do NOT append an extra "(";
    // otherwise the regex would require two consecutive parens and
    // miss real call expressions like `fetch('url')`.
    const endsWithParen = token.endsWith("(");
    const callPattern = new RegExp(
      "\\b" +
        token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
        (endsWithParen ? "\\s*" : "\\s*\\("),
      "g"
    );
    let m: RegExpExecArray | null;
    while ((m = callPattern.exec(content)) !== null) {
      const start = Math.max(0, m.index - 20);
      const end = Math.min(content.length, m.index + m[0].length + 20);
      hits.push({ token, excerpt: content.slice(start, end) });
    }
  }
  return { ok: hits.length === 0, hits };
}

// -----------------------------------------------------------------
// Assertion helper for buildKnowledgeAgentContractSnippet
// -----------------------------------------------------------------

/**
 * Pure self-check: the canonical snippet is asserted to contain
 * the required positive rules and the forbidden behaviors. This is a
 * defensive guard so that future edits to the snippet cannot silently
 * drop a required rule.
 */
export function assertSnippetShape(snippet: string): {
  ok: boolean;
  missing_required: string[];
  missing_forbidden: string[];
} {
  const required = [
    "Hermes Pro internal knowledge store",
    "Do not ask the user for an Obsidian Vault path",
    "MEMORY.md",
    ".wolf/cerebrum.md",
    "Do not invent new write paths",
    "Do not use any of the deceptive-phrase",
    "local_known",
    "newly_found",
    "judgment",
    "ingest_draft",
    "source_uri",
    "fetched_at",
    "source_type='vault' is reserved for vault:// URIs",
    "Bucket semantics",
    "local_plan",
    "github",
    "web",
    "Stale",
    "Confirmation only makes the draft eligible",
    "runtime_flush_allowed = false",
  ];
  const forbidden = [
    "saved successfully",
    "已保存",
    "写入成功",
    "will be written after confirm",
    "确认后将写入",
  ];
  const missing_required: string[] = [];
  const missing_forbidden: string[] = [];
  for (const r of required) {
    if (!snippet.includes(r)) {
      missing_required.push(r);
    }
  }
  for (const f of forbidden) {
    if (snippet.includes(f)) {
      missing_forbidden.push(f);
    }
  }
  return {
    ok: missing_required.length === 0 && missing_forbidden.length === 0,
    missing_required,
    missing_forbidden,
  };
}
