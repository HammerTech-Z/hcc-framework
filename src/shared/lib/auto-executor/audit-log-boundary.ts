/**
 * §4.5 — Audit logging (composer)
 *
 * The boundary does not own audit storage. It owns the *contract* every
 * audit append must satisfy, and it delegates persistence to an injected
 * `AuditAppender`. The default appender is the existing
 * `src/main/safety/audit-log.ts#appendAuditEntry`, but tests and the
 * boundary's own dry-run mode can substitute a memory appender.
 *
 * Immutability guarantee: the boundary refuses to start a new action if
 * the previous chain for the task fails verification. This is the
 * "boundary refuses action if chain breaks" property from §4.5.
 *
 * The module does NOT spawn anything. It is the audit-side of the
 * boundary; persistence and verification are injected.
 */

import type {
  AuditActor,
  AuditContext,
  AuditDecision,
  AuditEntry,
  AuditEvent,
} from "../safety/types";

// -----------------------------------------------------------------
// Contract
// -----------------------------------------------------------------

export interface AuditAppender {
  /**
   * Append a new audit entry. Returns the hydrated entry (with seq,
   * prev_hash, entry_hash, ts filled in by the appender).
   */
  append(input: {
    task_id: string;
    actor: AuditActor;
    event: AuditEvent;
    decision: AuditDecision;
    context: AuditContext;
    evidence_ref: string;
  }): AuditEntry;
  /**
   * Verify the chain for a task. Returns true if every entry's hash
   * matches the previous entry's entry_hash, false otherwise. Empty
   * chain returns true.
   */
  verify(task_id: string): boolean;
  /** Optional reader for tests and admin tools. */
  read?(task_id: string): AuditEntry[];
}

// -----------------------------------------------------------------
// In-memory appender (for tests and dry-run)
// -----------------------------------------------------------------

export function createMemoryAuditAppender(): AuditAppender & {
  __chains: Map<string, AuditEntry[]>;
} {
  const chains = new Map<string, AuditEntry[]>();

  return {
    __chains: chains,
    append(input): AuditEntry {
      const existing = chains.get(input.task_id) ?? [];
      const seq = existing.length;
      const prev_hash = seq === 0 ? "0".repeat(64) : existing[seq - 1].entry_hash;
      // Standalone entry_hash — uses a simple sha-like hex so chains can
      // be tested for ordering. The real appender uses audit-hash.ts for
      // cryptographic strength. This composer only requires that the
      // chain is internally consistent.
      const ts = new Date().toISOString();
      const entry_hash = simpleHash(
        `${seq}|${prev_hash}|${ts}|${input.task_id}|${input.event}|${input.decision}|${input.evidence_ref}`,
      );
      const entry: AuditEntry = {
        seq,
        prev_hash,
        entry_hash,
        ts,
        task_id: input.task_id,
        actor: input.actor,
        event: input.event,
        decision: input.decision,
        context: input.context,
        evidence_ref: input.evidence_ref,
      };
      existing.push(entry);
      chains.set(input.task_id, existing);
      return entry;
    },
    verify(task_id): boolean {
      const existing = chains.get(task_id) ?? [];
      let prev = "0".repeat(64);
      for (const e of existing) {
        if (e.prev_hash !== prev) return false;
        const expected = simpleHash(
          `${e.seq}|${e.prev_hash}|${e.ts}|${e.task_id}|${e.event}|${e.decision}|${e.evidence_ref}`,
        );
        if (e.entry_hash !== expected) return false;
        prev = e.entry_hash;
      }
      return true;
    },
    read(task_id): AuditEntry[] {
      return chains.get(task_id) ?? [];
    },
  };
}

// -----------------------------------------------------------------
// Tamper-detection appender (wraps another appender; reserved for
// future host that wants to surface tamper events)
// -----------------------------------------------------------------

export function createTamperDetector(
  inner: AuditAppender,
  _delegate: (event: "delete_attempted" | "overwrite_attempted", task_id: string) => void,
): AuditAppender {
  return {
    append: inner.append.bind(inner),
    verify: inner.verify.bind(inner),
    read: inner.read?.bind(inner),
  };
}

// -----------------------------------------------------------------
// Boundary hook
// -----------------------------------------------------------------

export interface AuditBoundary {
  appender: AuditAppender;
  /**
   * Assert the chain for the task is intact before allowing a new
   * action. Returns true if intact (or no chain exists), false otherwise.
   */
  assertChainIntact(task_id: string): boolean;
}

export function createAuditBoundary(appender: AuditAppender): AuditBoundary {
  return {
    appender,
    assertChainIntact(task_id): boolean {
      return appender.verify(task_id);
    },
  };
}

// -----------------------------------------------------------------
// Internal: simple deterministic hash for in-memory chains
// -----------------------------------------------------------------

function simpleHash(s: string): string {
  // FNV-1a 32-bit, hex-padded to 64 chars to mirror sha-256 length.
  // NOT cryptographic. Only used to make the in-memory chain testable
  // for ordering and tamper detection. The real appender is responsible
  // for cryptographic strength.
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").repeat(8);
}
