// P2.5 Audit Hash — Node-only (SHA-256 crypto)
// Lives in main/ so it can use Node.js crypto without polluting shared/

import { createHash } from 'crypto';
import type { AuditEntry, AuditHashInput } from '@shared/lib/safety/types';

// -----------------------------------------------------------------
// canonicalJson — stable key-ordered JSON serialisation
// -----------------------------------------------------------------

/** Compute canonical JSON for hash input (stable key ordering). */
export function canonicalJson(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts = keys.map((k) => {
    const v = obj[k];
    if (v === null || v === undefined) return `"${k}":null`;
    if (typeof v === 'object') return `"${k}":${JSON.stringify(v)}`;
    return `"${k}":${JSON.stringify(v)}`;
  });
  return `{${parts.join(',')}}`;
}

// -----------------------------------------------------------------
// Hash computation
// -----------------------------------------------------------------

/**
 * Compute entry_hash = sha256(canonical_json({ seq, prev_hash, ts, task_id,
 * event, decision, context, evidence_ref }))
 * Note: actor is intentionally excluded (per p2-5 spec).
 */
export function computeEntryHash(input: AuditHashInput): string {
  const { seq, prev_hash, ts, task_id, event, decision, context, evidence_ref } = input;
  const canonical = canonicalJson({
    seq,
    prev_hash,
    ts,
    task_id,
    event,
    decision,
    context,
    evidence_ref,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// -----------------------------------------------------------------
// Hash chain verification
// -----------------------------------------------------------------

/**
 * Verify the hash chain of an audit log array.
 * Returns index of first invalid entry, or -1 if clean.
 */
export function verifyHashChain(entries: AuditEntry[]): number {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const expected = computeEntryHash({
      seq: entry.seq,
      prev_hash: entry.prev_hash,
      ts: entry.ts,
      task_id: entry.task_id,
      event: entry.event,
      decision: entry.decision,
      context: entry.context,
      evidence_ref: entry.evidence_ref,
    });
    if (expected !== entry.entry_hash) return i;
    if (i > 0 && entries[i].prev_hash !== entries[i - 1].entry_hash) return i;
  }
  return -1;
}
