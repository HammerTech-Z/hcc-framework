// P2.5 Audit Log — append-only JSONL persistence
// Each task_id gets its own file: {auditDir}/{task_id}.jsonl
//
// Usage (default — uses ~/.hermes/audit/):
//   import { appendAuditEntry, readAuditChain, verifyAuditChain } from './audit-log';
//
// Usage (custom dir, e.g. for tests):
//   import { createAuditLogStore } from './audit-log';
//   const { append, read, verify } = createAuditLogStore({ auditDir: '/tmp/test-audit' });

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { AuditEntry, AuditHashInput } from "@shared/lib/safety/types";
import { computeEntryHash, verifyHashChain } from "./audit-hash";

const DEFAULT_AUDIT_DIR = path.join(os.homedir(), ".hermes", "audit");
export { DEFAULT_AUDIT_DIR };

// -----------------------------------------------------------------
// Ensure audit directory exists
// -----------------------------------------------------------------

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

// -----------------------------------------------------------------
// File path for a task
// -----------------------------------------------------------------

function taskFilePath(dir: string, taskId: string): string {
  return path.join(dir, `${taskId}.jsonl`);
}

// -----------------------------------------------------------------
// Append an audit entry
// -----------------------------------------------------------------

/**
 * Append a new audit entry to the task's JSONL file.
 * Computes the hash chain automatically:
 *   - First entry: seq=0, prev_hash=64 zeros
 *   - Subsequent entries: seq++, prev_hash = last entry_hash
 * Returns the fully hydrated AuditEntry.
 */
export function appendAuditEntry(
  dir: string,
  input: Omit<AuditHashInput, "seq" | "prev_hash" | "ts"> & {
    actor: AuditEntry["actor"];
    evidence_ref: string;
  }
): AuditEntry {
  ensureDir(dir);
  const filePath = taskFilePath(dir, input.task_id);

  // Read current chain to get seq and prev_hash
  let seq = 0;
  let prev_hash = "0".repeat(64);

  if (fs.existsSync(filePath)) {
    const raw = fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean);
    if (raw.length > 0) {
      const last = JSON.parse(raw[raw.length - 1]) as AuditEntry;
      seq = last.seq + 1;
      prev_hash = last.entry_hash;
    }
  }

  const now = new Date().toISOString();

  const hashInput: AuditHashInput = {
    seq,
    prev_hash,
    ts: now,
    task_id: input.task_id,
    event: input.event,
    decision: input.decision,
    context: input.context,
    evidence_ref: input.evidence_ref,
  };

  const entryHash = computeEntryHash(hashInput);

  const entry: AuditEntry = {
    seq,
    prev_hash,
    entry_hash: entryHash,
    ts: now,
    task_id: input.task_id,
    actor: input.actor,
    event: input.event,
    decision: input.decision,
    context: input.context,
    evidence_ref: input.evidence_ref,
  };

  fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

// -----------------------------------------------------------------
// Read audit chain for a task
// -----------------------------------------------------------------

/**
 * Read all audit entries for a task, in order.
 * Returns empty array if no entries exist.
 */
export function readAuditChain(dir: string, taskId: string): AuditEntry[] {
  const filePath = taskFilePath(dir, taskId);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.split("\n").filter(Boolean).map((line) => JSON.parse(line) as AuditEntry);
}

// -----------------------------------------------------------------
// Verify audit chain integrity
// -----------------------------------------------------------------

/**
 * Verify the hash chain of a task's audit log.
 * Returns same semantics as verifyHashChain: -1 = clean, else = first bad index.
 */
export function verifyAuditChain(dir: string, taskId: string): number {
  const entries = readAuditChain(dir, taskId);
  return verifyHashChain(entries);
}

// -----------------------------------------------------------------
// Factory — creates a store bound to a specific audit directory
// -----------------------------------------------------------------

export interface AuditLogStore {
  append: (
    input: Omit<AuditHashInput, "seq" | "prev_hash" | "ts"> & {
      actor: AuditEntry["actor"];
      evidence_ref: string;
    }
  ) => AuditEntry;
  read: (taskId: string) => AuditEntry[];
  verify: (taskId: string) => number;
}

export function createAuditLogStore({ auditDir = DEFAULT_AUDIT_DIR } = {}): AuditLogStore {
  return {
    append: (input) => appendAuditEntry(auditDir, input),
    read: (taskId) => readAuditChain(auditDir, taskId),
    verify: (taskId) => verifyAuditChain(auditDir, taskId),
  };
}

// -----------------------------------------------------------------
// Default store (uses ~/.hermes/audit/)
// -----------------------------------------------------------------

const _default = createAuditLogStore();

/** Convenience: append using default audit dir (~/.hermes/audit/) */
export function defaultAppendAuditEntry(
  input: Omit<AuditHashInput, "seq" | "prev_hash" | "ts"> & {
    actor: AuditEntry["actor"];
    evidence_ref: string;
  }
): AuditEntry {
  return _default.append(input);
}

/** Convenience: read using default audit dir */
export function defaultReadAuditChain(taskId: string): AuditEntry[] {
  return _default.read(taskId);
}

/** Convenience: verify using default audit dir */
export function defaultVerifyAuditChain(taskId: string): number {
  return _default.verify(taskId);
}