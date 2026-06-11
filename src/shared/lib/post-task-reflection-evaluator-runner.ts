// B-3 Reflection Evaluator Runner — read-only pure runner
//
// Wraps evaluatePostTaskReflection + NoRuntime guard + promotion eligibility
// check behind a minimal read-only API. Caller passes reflection data;
// runner never reads fs, fixtures, ~/.hermes, or any external source.
//
// All *_allowed flags remain literally false (hard boundary).
// isReflectionEvaluatorPromotionEligible remains hard-wired false.
// assertReflectionEvaluatorVerdictNoRuntime guards every verdict.
//
// Pure data + helpers. No I/O, no IPC, no runtime mutation, no daemon,
// no cron, no weixin, no channel runtime, no live apply, no HCC Auto
// Executor, no ~/.hermes writes, no ~/.hermes/vault reads, no fs ops.

import {
  evaluatePostTaskReflection,
  assertReflectionEvaluatorVerdictNoRuntime,
  isReflectionEvaluatorPromotionEligible,
  type EvaluatePostTaskReflectionInput,
  type ReflectionEvaluatorVerdict,
} from "./post-task-reflection-evaluator-design";

// ── runner API ──────────────────────────────────────────────────────────────

/**
 * Evaluate a single post-task reflection through the evaluator + NoRuntime
 * guard. Returns the verdict with all safety flags asserted.
 * Promotion eligibility is always hard-wired false per LOOP-008.
 */
export function evaluateReflectionReadOnly(
  input: EvaluatePostTaskReflectionInput,
): ReflectionEvaluatorVerdict {
  const verdict = evaluatePostTaskReflection(input);
  assertReflectionEvaluatorVerdictNoRuntime(verdict);
  // invariant: hard-wired false
  if (isReflectionEvaluatorPromotionEligible(verdict)) {
    throw new Error(
      "evaluator_runner: invariant violation — isReflectionEvaluatorPromotionEligible returned true",
    );
  }
  return verdict;
}

/**
 * Batch-evaluate a list of reflections. Preserves input order.
 * Every verdict passes the same NoRuntime + promotion guard.
 */
export function evaluateReflectionBatchReadOnly(
  inputs: readonly EvaluatePostTaskReflectionInput[],
): ReflectionEvaluatorVerdict[] {
  return inputs.map((input) => evaluateReflectionReadOnly(input));
}

// ── summary helper ──────────────────────────────────────────────────────────

export interface ReflectionRunnerSummary {
  readonly total: number;
  readonly bands: Record<string, number>;
  readonly all_dry_run_only: boolean;
  readonly all_flags_false: boolean;
  readonly all_promotion_eligible_false: boolean;
}

/**
 * Build a high-level summary from a batch of verdicts.  Pure — no mutation
 * of inputs, no I/O.
 */
export function summarizeReflectionRunnerBatch(
  results: readonly ReflectionEvaluatorVerdict[],
): ReflectionRunnerSummary {
  const bands: Record<string, number> = {};
  let anyFlagFlipped = false;
  let anyPromotionEligible = false;
  let anyNonDryRun = false;

  for (const v of results) {
    bands[v.trust_band] = (bands[v.trust_band] ?? 0) + 1;
    if (
      v.live_flush_allowed !== false ||
      v.knowledge_ingest_call_allowed !== false ||
      v.knowledge_search_call_allowed !== false ||
      v.audit_write_allowed !== false ||
      v.persistence_allowed !== false ||
      v.next_task_context_write_allowed !== false ||
      v.live_ranking_mutation_allowed !== false ||
      v.config_write_allowed !== false
    ) {
      anyFlagFlipped = true;
    }
    if (isReflectionEvaluatorPromotionEligible(v) !== false) {
      anyPromotionEligible = true;
    }
    if (v.dry_run_only !== true) {
      anyNonDryRun = true;
    }
  }

  return {
    total: results.length,
    bands,
    all_dry_run_only: !anyNonDryRun,
    all_flags_false: !anyFlagFlipped,
    all_promotion_eligible_false: !anyPromotionEligible,
  };
}
