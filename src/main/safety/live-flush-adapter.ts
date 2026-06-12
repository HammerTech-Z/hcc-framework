// B-4C Live Flush Adapter — Hermes main implementation
//
// In-memory adapter. Single instance per process. Reuses B-4C gate contract:
//   - buildLiveFlushRequest
//   - assertLiveFlushRequestNoRuntime
//
// The adapter builds `pending_user_approval` requests from B-4B writer
// `promotion_candidate` outputs. It DOES NOT perform any flush:
//   - no fs.write
//   - no IPC
//   - no knowledgeIngest / knowledgeSearch call
//   - no audit / config / live ranking mutation
//   - no `~/.hermes/**` write
//
// Singleton invariant: getLiveFlushAdapter() returns the same instance.
// The class is not exported, so there is no way to create a second
// flush owner from outside this module.

import type { WriterContractOutput } from "../../shared/lib/post-task-reflection-writer-contract";
import {
  buildLiveFlushRequest,
  assertLiveFlushRequestNoRuntime,
  LIVE_FLUSH_COPY_DECK_REDLINE,
  type LiveFlushRequest,
} from "../../shared/lib/post-task-reflection-flush-gate";

/**
 * Internal class — not exported. The factory getter is the only way to
 * obtain an adapter instance, enforcing the single-flush-owner invariant.
 */
class LiveFlushAdapter {
  readonly adapter_status: "design_only" = "design_only";
  readonly live_flush_allowed: false = false;
  readonly knowledge_ingest_call_allowed: false = false;
  readonly knowledge_search_call_allowed: false = false;
  readonly audit_write_allowed: false = false;
  readonly persistence_allowed: false = false;
  readonly config_write_allowed: false = false;
  readonly live_ranking_mutation_allowed: false = false;
  readonly auto_apply_eligible: false = false;
  readonly dry_run_only: true = true;

  /**
   * Build a `pending_user_approval` request from a B-4B writer output.
   * Does NOT perform any flush. Caller must:
   *   1. Display `getCopyDeckRedline()` to the user.
   *   2. Get explicit human approval.
   *   3. Apply the request via a future live-apply slice (NOT in B-4C).
   */
  buildRequest(output: WriterContractOutput): LiveFlushRequest {
    const request = buildLiveFlushRequest(output);
    assertLiveFlushRequestNoRuntime(request);
    return request;
  }

  /**
   * Returns the copy-deck redline text. Must be displayed to the user
   * before every request is built. The text is the one approved in
   * the B-4C preflight.
   */
  getCopyDeckRedline(): typeof LIVE_FLUSH_COPY_DECK_REDLINE {
    return LIVE_FLUSH_COPY_DECK_REDLINE;
  }

  /**
   * Returns the design descriptor. All runtime/apply flags are false.
   */
  describe(): {
    adapter_status: "design_only";
    live_flush_allowed: false;
    knowledge_ingest_call_allowed: false;
    knowledge_search_call_allowed: false;
    audit_write_allowed: false;
    persistence_allowed: false;
    config_write_allowed: false;
    live_ranking_mutation_allowed: false;
    auto_apply_eligible: false;
    dry_run_only: true;
    per_request_approval: true;
    user_approval_required: true;
  } {
    return {
      adapter_status: this.adapter_status,
      live_flush_allowed: false,
      knowledge_ingest_call_allowed: false,
      knowledge_search_call_allowed: false,
      audit_write_allowed: false,
      persistence_allowed: false,
      config_write_allowed: false,
      live_ranking_mutation_allowed: false,
      auto_apply_eligible: false,
      dry_run_only: true,
      per_request_approval: true,
      user_approval_required: true,
    };
  }
}

// Module-level singleton. Lazy-initialized on first call.
let _instance: LiveFlushAdapter | null = null;

/**
 * Factory getter for the Live Flush Adapter.
 *
 * Singleton invariant: repeated calls return the same instance for the
 * lifetime of the process. The class is not exported, so there is no
 * way to create a second flush owner from outside this module.
 *
 * Apply path is NOT implemented in B-4C. Each request remains in
 * `pending_user_approval` state until a future slice implements the
 * live-apply adapter (separate approval).
 */
export function getLiveFlushAdapter(): LiveFlushAdapter {
  if (_instance === null) {
    _instance = new LiveFlushAdapter();
  }
  return _instance;
}

/**
 * Test-only: reset the singleton. Must only be called from test files.
 * Used by uniqueness tests to verify the singleton invariant holds
 * across calls. Production code must never call this.
 */
export function __resetLiveFlushAdapterForTest(): void {
  _instance = null;
}
