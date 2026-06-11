// B-4A Live Reflection Writer — Contract / Descriptor
//
// Pure contract layer. Defines the writer design descriptor, single-writer
// invariant, quarantine decision matrix, and projection chain from task
// artifact → PostTaskReflection → B-3 evaluator → quarantine decision.
//
// Zero runtime, zero I/O, zero live flush. All safety flags hard-wired false.
// writer_allowed = false (B-4B flips this after B-4A approval).
//
// Single writer rule: ONLY hermes_main may write canonical PostTaskReflection
// records. claude_code / codex / human are rejected at the contract layer.

import type { PostTaskReflection, PostTaskReflectionInput } from "./post-task-reflection-contract";
import { buildPostTaskReflection } from "./post-task-reflection-contract";
import { evaluateReflectionReadOnly } from "./post-task-reflection-evaluator-runner";
import type { ReflectionEvaluatorVerdict } from "./post-task-reflection-evaluator-design";

// ── design descriptor ────────────────────────────────────────────────────────

export const WRITER_CONTRACT_DESIGN = {
  writer_status: "contract_only",
  writer_allowed: false,
  live_flush_allowed: false,
  knowledge_ingest_allowed: false,
  knowledge_search_allowed: false,
  audit_write_allowed: false,
  persistence_allowed: false,
  next_task_context_write_allowed: false,
  live_ranking_mutation_allowed: false,
  config_write_allowed: false,
  single_writer_required: true,
  writer_owner: "hermes_main",
  b3_evaluator_required: true,
  quarantine_default: true,
  human_approval_ref_required: true,
  schema_version: "1.0.0",
} as const;

// ── quarantine decision ──────────────────────────────────────────────────────

export type QuarantineDecision =
  | "remain_quarantined"
  | "promotion_candidate"
  | "reject";

// ── writer output ────────────────────────────────────────────────────────────

export interface WriterContractOutput {
  readonly schema_version: "1.0.0";
  readonly output_id: string;
  readonly reflection: PostTaskReflection;
  readonly verdict: ReflectionEvaluatorVerdict;
  readonly quarantine_decision: QuarantineDecision;
  readonly quarantine_reason: string;

  // B-4A safety flags — all hard-wired false
  readonly writer_allowed: false;
  readonly live_flush_allowed: false;
  readonly knowledge_ingest_allowed: false;
  readonly knowledge_search_allowed: false;
  readonly audit_write_allowed: false;
  readonly persistence_allowed: false;
  readonly next_task_context_write_allowed: false;
  readonly live_ranking_mutation_allowed: false;
  readonly config_write_allowed: false;
  readonly dry_run_only: true;
}

// ── output id ────────────────────────────────────────────────────────────────

export function buildWriterOutputId(input: { task_id: string }): string {
  return `writer-output:${input.task_id}`;
}

// ── single-writer guard ──────────────────────────────────────────────────────

const ALLOWED_SUBMITTERS = new Set(["hermes_main"]);

export function assertSingleWriterHermesMain(input: {
  submitted_by: string;
}): void {
  if (!ALLOWED_SUBMITTERS.has(input.submitted_by)) {
    throw new Error(
      `writer_contract: single-writer violation — submitted_by "${input.submitted_by}" is not allowed. ` +
      `Only "hermes_main" may write canonical PostTaskReflection records.`,
    );
  }
}

// ── evidence presence helper ─────────────────────────────────────────────────

export function hasReflectionContent(reflection: PostTaskReflection): boolean {
  return (
    reflection.good_patterns.length > 0 ||
    reflection.bad_patterns.length > 0 ||
    reflection.dead_ends.length > 0 ||
    reflection.skill_candidates.length > 0 ||
    reflection.model_feedback.length > 0 ||
    reflection.knowledge_ingest_draft.length > 0 ||
    reflection.usage_feedback_signals.length > 0 ||
    reflection.next_task_recommendations.length > 0
  );
}

// ── quarantine decider ───────────────────────────────────────────────────────

export interface DecideQuarantineInput {
  submitted_by: string;
  verification_result: string;
  human_reviewed: boolean;
  human_approval_ref_present: boolean;
  verdict_trust_band: string;
  has_content: boolean;
}

export function decideQuarantineForReflection(
  input: DecideQuarantineInput,
): { decision: QuarantineDecision; reason: string } {
  // hard reject: no content
  if (!input.has_content) {
    return { decision: "reject", reason: "reflection has no content (no patterns / no signals)" };
  }

  // hard reject: agent-submitted
  if (input.submitted_by !== "hermes_main") {
    return {
      decision: "reject",
      reason: `submitted_by "${input.submitted_by}" is not hermes_main — single-writer violation`,
    };
  }

  // promotion candidate
  if (
    input.human_reviewed &&
    input.human_approval_ref_present &&
    input.verdict_trust_band === "human_reviewed_candidate"
  ) {
    return {
      decision: "promotion_candidate",
      reason: "human-reviewed, approval ref present, evaluator trust_band=human_reviewed_candidate — apply path remains closed",
    };
  }

  // fail + not human-reviewed → remain quarantined
  if (input.verification_result === "fail" && !input.human_reviewed) {
    return {
      decision: "remain_quarantined",
      reason: "verification_result=fail and not human-reviewed",
    };
  }

  // pass + not human-reviewed → remain quarantined (default)
  if (input.verification_result === "pass") {
    return {
      decision: "remain_quarantined",
      reason: "pass but not human-reviewed — remains quarantined by default",
    };
  }

  // default
  return {
    decision: "remain_quarantined",
    reason: "default quarantine — no promotion path matched",
  };
}

// ── projection helper ────────────────────────────────────────────────────────

export function projectTaskToWriterOutput(
  input: PostTaskReflectionInput,
): WriterContractOutput {
  // step 1: build reflection
  const reflection = buildPostTaskReflection(input);

  // step 1.5: guard single-writer
  assertSingleWriterHermesMain({ submitted_by: reflection.provenance.submitted_by });

  // step 2: evaluate (read-only)
  const verdict = evaluateReflectionReadOnly({ reflection });

  // step 3: quarantine decision
  const { decision, reason } = decideQuarantineForReflection({
    submitted_by: reflection.provenance.submitted_by,
    verification_result: reflection.verification_result,
    human_reviewed: reflection.provenance.human_reviewed,
    human_approval_ref_present: reflection.provenance.human_approval_ref !== null,
    verdict_trust_band: verdict.trust_band,
    has_content: hasReflectionContent(reflection),
  });

  return {
    schema_version: "1.0.0",
    output_id: buildWriterOutputId({ task_id: input.task_id }),
    reflection,
    verdict,
    quarantine_decision: decision,
    quarantine_reason: reason,
    writer_allowed: false,
    live_flush_allowed: false,
    knowledge_ingest_allowed: false,
    knowledge_search_allowed: false,
    audit_write_allowed: false,
    persistence_allowed: false,
    next_task_context_write_allowed: false,
    live_ranking_mutation_allowed: false,
    config_write_allowed: false,
    dry_run_only: true,
  };
}

// ── runtime guard ────────────────────────────────────────────────────────────

export function assertWriterContractOutputNoRuntime(
  output: WriterContractOutput,
): void {
  const failures: string[] = [];

  if (output.writer_allowed !== false) {
    failures.push("writer_allowed must be false");
  }
  if (output.live_flush_allowed !== false) {
    failures.push("live_flush_allowed must be false");
  }
  if (output.knowledge_ingest_allowed !== false) {
    failures.push("knowledge_ingest_allowed must be false");
  }
  if (output.knowledge_search_allowed !== false) {
    failures.push("knowledge_search_allowed must be false");
  }
  if (output.audit_write_allowed !== false) {
    failures.push("audit_write_allowed must be false");
  }
  if (output.persistence_allowed !== false) {
    failures.push("persistence_allowed must be false");
  }
  if (output.next_task_context_write_allowed !== false) {
    failures.push("next_task_context_write_allowed must be false");
  }
  if (output.live_ranking_mutation_allowed !== false) {
    failures.push("live_ranking_mutation_allowed must be false");
  }
  if (output.config_write_allowed !== false) {
    failures.push("config_write_allowed must be false");
  }
  if (output.dry_run_only !== true) {
    failures.push("dry_run_only must be true");
  }

  if (output.reflection.provenance.human_approval_ref?.verified) {
    failures.push("human_approval_ref.verified must be false or undefined");
  }

  if (output.reflection.approval_gate.approved !== false) {
    failures.push("approval_gate.approved must be false");
  }

  if (failures.length > 0) {
    throw new Error(
      `writer_contract: runtime guard failed — ${failures.join("; ")}`,
    );
  }
}
