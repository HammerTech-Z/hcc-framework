// B-4B Live Reflection Writer — Hermes main implementation
//
// In-memory writer. Single instance per process. Reuses B-4A contract layer:
//   - projectTaskToWriterOutput
//   - assertWriterContractOutputNoRuntime
//   - assertSingleWriterHermesMain
//
// Zero persistence, zero IPC, zero fs, zero knowledgeIngest / knowledgeSearch.
// All runtime/apply flags remain hard-wired false. dry_run_only=true.
//
// Singleton invariant: getReflectionWriter() returns the same instance for
// the lifetime of the process. The class constructor is NOT exported —
// only the factory getter. Any attempt to create a second writer owner
// must fail by design (no exported class).
//
// B-4C Live Flush: NOT implemented. NOT authorized. Do not add any code
// that writes to disk, knowledge store, audit log, config, or runtime.

import type { PostTaskReflectionInput } from "../../shared/lib/post-task-reflection-contract";
import {
  projectTaskToWriterOutput,
  assertWriterContractOutputNoRuntime,
  assertSingleWriterHermesMain,
  type WriterContractOutput,
} from "../../shared/lib/post-task-reflection-writer-contract";

/**
 * Internal class — not exported. The factory getter is the only way to
 * obtain a writer instance, enforcing the single-writer invariant.
 */
class LiveReflectionWriter {
  readonly owner: "hermes_main" = "hermes_main";
  readonly schema_version: "1.0.0" = "1.0.0";
  readonly writer_allowed: false = false;
  readonly live_flush_allowed: false = false;
  readonly knowledge_ingest_allowed: false = false;
  readonly knowledge_search_allowed: false = false;
  readonly audit_write_allowed: false = false;
  readonly persistence_allowed: false = false;
  readonly next_task_context_write_allowed: false = false;
  readonly live_ranking_mutation_allowed: false = false;
  readonly config_write_allowed: false = false;
  readonly dry_run_only: true = true;

  /**
   * Write a PostTaskReflection in memory only. Reuses B-4A contract.
   * Returns a WriterContractOutput with all runtime/apply flags false.
   */
  writeReflection(input: PostTaskReflectionInput): WriterContractOutput {
    // B-4A single-writer guard: this check is redundant here because the
    // owner is hard-wired to hermes_main, but kept as a defensive assertion
    // to document the invariant.
    assertSingleWriterHermesMain({ submitted_by: this.owner });

    // B-4A projection chain: build reflection + B-3 evaluator + quarantine.
    const output = projectTaskToWriterOutput(input);

    // B-4A runtime guard: reject any tampered output. This must always pass
    // because the projection produces hard-wired false flags, but the
    // assertion is the contract-level guarantee.
    assertWriterContractOutputNoRuntime(output);

    return output;
  }

  /**
   * Returns the design descriptor. B-4A mirror.
   */
  describe(): {
    owner: "hermes_main";
    schema_version: "1.0.0";
    writer_status: "contract_only";
    writer_allowed: false;
    live_flush_allowed: false;
    knowledge_ingest_allowed: false;
    knowledge_search_allowed: false;
    audit_write_allowed: false;
    persistence_allowed: false;
    next_task_context_write_allowed: false;
    live_ranking_mutation_allowed: false;
    config_write_allowed: false;
    dry_run_only: true;
    single_writer_required: true;
    b3_evaluator_required: true;
    quarantine_default: true;
  } {
    return {
      owner: this.owner,
      schema_version: this.schema_version,
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
      dry_run_only: true,
      single_writer_required: true,
      b3_evaluator_required: true,
      quarantine_default: true,
    };
  }
}

// Module-level singleton. Lazy-initialized on first call.
let _instance: LiveReflectionWriter | null = null;

/**
 * Factory getter for the Live Reflection Writer.
 *
 * Singleton invariant: repeated calls return the same instance for the
 * lifetime of the process. The class is not exported, so there is no
 * way to create a second writer owner from outside this module.
 *
 * B-4C Live Flush is NOT implemented. Do not add any persistence,
 * IPC, or fs call to this writer.
 */
export function getReflectionWriter(): LiveReflectionWriter {
  if (_instance === null) {
    _instance = new LiveReflectionWriter();
  }
  return _instance;
}

/**
 * Test-only: reset the singleton. Must only be called from test files.
 * Used by uniqueness tests to verify the singleton invariant holds
 * across calls. Production code must never call this.
 */
export function __resetReflectionWriterForTest(): void {
  _instance = null;
}
