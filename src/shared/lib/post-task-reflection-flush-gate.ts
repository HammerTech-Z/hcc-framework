// B-4C Live Flush Gate — Pure Contract
//
// Flush gate descriptor + approval gate guard. Zero I/O, zero runtime,
// zero knowledgeIngest / knowledgeSearch / audit / config / live ranking.
// All runtime/apply flags hard-wired false.
//
// B-4C purpose: gate B-4B writer's `promotion_candidate` output into a
// `pending_user_approval` request. The actual flush is NOT performed by
// B-4C — the user must explicitly approve each request, and the apply
// path is not even implemented in B-4C (deliberately: B-4C is the gate,
// not the runtime).

import type { WriterContractOutput } from "./post-task-reflection-writer-contract";

// ── design descriptor ────────────────────────────────────────────────────────

export const LIVE_FLUSH_GATE_DESIGN = {
  gate_status: "design_only",
  live_flush_allowed: false,
  knowledge_ingest_call_allowed: false,
  knowledge_search_call_allowed: false,
  audit_write_allowed: false,
  persistence_allowed: false,
  config_write_allowed: false,
  live_ranking_mutation_allowed: false,
  auto_apply_eligible: false,
  dry_run_only: true,
  user_approval_required: true,
  copy_deck_redline_required: true,
  per_request_approval: true,
  approval_kind_required: "explicit_user_action",
  schema_version: "1.0.0",
} as const;

// ── copy-deck redline text (must be displayed before every request) ──────────

export const LIVE_FLUSH_COPY_DECK_REDLINE: string = [
  "⚠️ LIVE FLUSH — USER MUST READ",
  "",
  "Live Flush still requires per-request human approval.",
  "Auto Executor 常驻, Phase B 车道二, Live Ranking mutation all unapproved.",
  "Live Flush only triggers on `quarantine_decision = \"promotion_candidate\"`.",
  "Any reflection with `quarantine=false` and `human_approval_ref.verified = false` MUST NOT enter the flush path.",
  "Flush scope: vault existing entries + pre-existing knowledge buckets only.",
  "Live Flush is NOT enabled. This request is a gate, not an apply.",
].join("\n");

// ── request types ────────────────────────────────────────────────────────────

export type FlushRequestStatus =
  | "pending_user_approval"
  | "approved"
  | "rejected"
  | "expired";

export interface LiveFlushRequest {
  readonly schema_version: "1.0.0";
  readonly request_id: string;
  readonly output_id: string;
  readonly source_task: string;
  readonly status: FlushRequestStatus;
  readonly created_at: string;
  readonly copy_deck_redline: typeof LIVE_FLUSH_COPY_DECK_REDLINE;
  readonly descriptor: typeof LIVE_FLUSH_GATE_DESIGN;
  // B-4B output snapshot for audit (no apply, no persistence side-effect)
  readonly reflection_output_id: string;
  readonly reflection_task_id: string;
  readonly reflection_verdict_id: string;
  readonly reflection_quarantine_decision: "promotion_candidate";
  // safety flags — all hard-wired false
  readonly live_flush_allowed: false;
  readonly knowledge_ingest_call_allowed: false;
  readonly knowledge_search_call_allowed: false;
  readonly audit_write_allowed: false;
  readonly persistence_allowed: false;
  readonly config_write_allowed: false;
  readonly live_ranking_mutation_allowed: false;
  readonly auto_apply_eligible: false;
  readonly dry_run_only: true;
}

// ── request id builder ───────────────────────────────────────────────────────

export function buildFlushRequestId(input: { output_id: string }): string {
  return `live-flush-request:${input.output_id}`;
}

// ── build a request from a WriterContractOutput ──────────────────────────────

export function buildLiveFlushRequest(
  output: WriterContractOutput,
): LiveFlushRequest {
  // precondition 1: must be promotion_candidate
  if (output.quarantine_decision !== "promotion_candidate") {
    throw new Error(
      `live_flush_gate: not a promotion_candidate (got "${output.quarantine_decision}")`,
    );
  }

  // precondition 2: human_approval_ref.verified must be false or undefined
  if (output.reflection.provenance.human_approval_ref?.verified) {
    throw new Error(
      "live_flush_gate: human_approval_ref.verified must be false or undefined",
    );
  }

  // precondition 3: dry_run_only must be true on the output
  if (output.dry_run_only !== true) {
    throw new Error("live_flush_gate: output.dry_run_only must be true");
  }

  // precondition 4: live_flush_allowed on the output must be false (gate is the gate)
  if (output.live_flush_allowed !== false) {
    throw new Error(
      "live_flush_gate: output.live_flush_allowed must be false at this layer",
    );
  }

  return {
    schema_version: "1.0.0",
    request_id: buildFlushRequestId({ output_id: output.output_id }),
    output_id: output.output_id,
    source_task: output.reflection.task_id,
    status: "pending_user_approval",
    created_at: new Date(0).toISOString(), // deterministic for tests; caller may override
    copy_deck_redline: LIVE_FLUSH_COPY_DECK_REDLINE,
    descriptor: LIVE_FLUSH_GATE_DESIGN,
    reflection_output_id: output.output_id,
    reflection_task_id: output.reflection.task_id,
    reflection_verdict_id: output.verdict.verdict_id,
    reflection_quarantine_decision: "promotion_candidate",
    live_flush_allowed: false,
    knowledge_ingest_call_allowed: false,
    knowledge_search_call_allowed: false,
    audit_write_allowed: false,
    persistence_allowed: false,
    config_write_allowed: false,
    live_ranking_mutation_allowed: false,
    auto_apply_eligible: false,
    dry_run_only: true,
  };
}

// ── runtime guard (rejects any tampered request) ────────────────────────────

export function assertLiveFlushRequestNoRuntime(
  request: LiveFlushRequest,
): void {
  const failures: string[] = [];
  if (request.live_flush_allowed !== false) failures.push("live_flush_allowed must be false");
  if (request.knowledge_ingest_call_allowed !== false) failures.push("knowledge_ingest_call_allowed must be false");
  if (request.knowledge_search_call_allowed !== false) failures.push("knowledge_search_call_allowed must be false");
  if (request.audit_write_allowed !== false) failures.push("audit_write_allowed must be false");
  if (request.persistence_allowed !== false) failures.push("persistence_allowed must be false");
  if (request.config_write_allowed !== false) failures.push("config_write_allowed must be false");
  if (request.live_ranking_mutation_allowed !== false) failures.push("live_ranking_mutation_allowed must be false");
  if (request.auto_apply_eligible !== false) failures.push("auto_apply_eligible must be false");
  if (request.dry_run_only !== true) failures.push("dry_run_only must be true");
  if (request.status !== "pending_user_approval") {
    failures.push(
      `request status must be "pending_user_approval" at gate layer — got "${request.status}"; apply is not implemented`,
    );
  }
  if (request.reflection_quarantine_decision !== "promotion_candidate") {
    failures.push("reflection_quarantine_decision must be promotion_candidate");
  }
  if (failures.length > 0) {
    throw new Error(
      `live_flush_gate: runtime guard failed — ${failures.join("; ")}`,
    );
  }
}
