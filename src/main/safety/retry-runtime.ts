// P2.5 Retry Runtime Helper — pure main helper
// No IPC, no HCC, no CLI, no executor.
// Manages task-level retry state: failure signatures, attempt counts,
// early termination on repeated failures, and audit logging.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { AuditActor, AuditContext, RetryContext } from "@shared/lib/safety/types";
import { computeEntryHash, verifyHashChain } from "./audit-hash";
import type { AuditEntry } from "@shared/lib/safety/types";

// -----------------------------------------------------------------
// Types (local copies to avoid circular deps on FailureKind)
// -----------------------------------------------------------------

export type FailureKind =
  | "agent_error"
  | "task_failure"
  | "execution_error"
  | "verification_error"
  | "resource_exhaustion"
  | "external_dependency_error";

export interface RecordFailureInput {
  taskId: string;
  failureSignature: string;
  failureKind: FailureKind;
  actor: AuditActor;
  evidenceRef: string;
  deadEnd?: boolean;
  currentAttempt?: number;
}

export interface ShouldRetryInput {
  taskId: string;
  failureSignature: string;
  actor: AuditActor;
  evidenceRef: string;
}

export interface ShouldRetryResult {
  decision: "allow" | "deny";
  reasons: string[];
  attempt_count: number;
  max_retries: number;
  can_expand_capability: false;
  dead_end: boolean;
  chainClean: number;
}

export interface ResetResult {
  decision: "allow";
  reasons: string[];
  chainClean: number;
}

// -----------------------------------------------------------------
// Options
// -----------------------------------------------------------------

export interface RetryRuntimeOptions {
  auditDir?: string;
  maxRetries?: number;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const DEFAULT_MAX_RETRIES = 2;
const GENESIS_HASH = "0".repeat(64);

// -----------------------------------------------------------------
// Audit helpers — standalone, no dependency on audit-log factory
// -----------------------------------------------------------------

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function taskFilePath(dir: string, taskId: string): string {
  return path.join(dir, `${taskId}.jsonl`);
}

function readChain(dir: string, taskId: string): AuditEntry[] {
  const fp = taskFilePath(dir, taskId);
  if (!fs.existsSync(fp)) return [];
  return fs
    .readFileSync(fp, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AuditEntry);
}

function appendAuditEntry(
  dir: string,
  input: {
    task_id: string;
    actor: AuditActor;
    event: "retry_check";
    decision: "allow" | "deny";
    context: AuditContext;
    evidence_ref: string;
  }
): AuditEntry {
  ensureDir(dir);
  const fp = taskFilePath(dir, input.task_id);

  let seq = 0;
  let prev_hash = GENESIS_HASH;

  if (fs.existsSync(fp)) {
    const raw = fs.readFileSync(fp, "utf8").split("\n").filter(Boolean);
    if (raw.length > 0) {
      const last = JSON.parse(raw[raw.length - 1]) as AuditEntry;
      seq = last.seq + 1;
      prev_hash = last.entry_hash;
    }
  }

  const now = new Date().toISOString();

  const hashInput = {
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

  fs.appendFileSync(fp, JSON.stringify(entry) + "\n", "utf8");
  return entry;
}

function makeContext(rc: RetryContext): AuditContext {
  return {
    trust_level: "trusted_user",
    requested_capability: "read_public",
    allowed_capability_set: [],
    matched_rule: "retry_runtime",
    allowlist_hit: null,
    path_check: "not_applicable",
    risk_level: "low",
    retry_context: rc,
  };
}

// -----------------------------------------------------------------
// In-memory state
// -----------------------------------------------------------------

interface FailureRecord {
  taskId: string;
  failureSignature: string;
  count: number;
  deadEnd: boolean;
}

// -----------------------------------------------------------------
// Factory
// -----------------------------------------------------------------

export interface RetryRuntime {
  recordFailure(input: RecordFailureInput): void;
  shouldRetry(input: ShouldRetryInput): ShouldRetryResult;
  resetRetryState(taskId: string): ResetResult;
}

export function createRetryRuntime(
  options: RetryRuntimeOptions = {}
): RetryRuntime {
  const auditDir = options.auditDir ?? path.join(os.homedir(), ".hermes", "audit");
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  // In-memory state: key = "taskId::failureSignature"
  const state = new Map<string, FailureRecord>();

  function key(tid: string, sig: string): string {
    return `${tid}::${sig}`;
  }

  return {
    recordFailure(input: RecordFailureInput): void {
      const { taskId, failureSignature, failureKind, actor, evidenceRef, deadEnd = false } = input;
      const k = key(taskId, failureSignature);
      const existing = state.get(k);

      const count = existing ? existing.count + 1 : 1;

      const rec: FailureRecord = {
        taskId,
        failureSignature,
        count,
        deadEnd: deadEnd || (existing?.deadEnd ?? false),
      };
      state.set(k, rec);

      const reason = `failure recorded: kind=${failureKind}, attempt=${count}/${maxRetries}, dead_end=${rec.deadEnd}`;

      appendAuditEntry(auditDir, {
        task_id: taskId,
        actor,
        event: "retry_check",
        decision: "allow",
        context: makeContext({
          failure_signature: failureSignature,
          failure_kind: failureKind,
          attempt_count: count,
          max_retries: maxRetries,
          dead_end: rec.deadEnd,
          can_expand_capability: false,
          reason,
        }),
        evidence_ref: evidenceRef,
      });
    },

    shouldRetry(input: ShouldRetryInput): ShouldRetryResult {
      const { taskId, failureSignature, actor, evidenceRef } = input;
      const k = key(taskId, failureSignature);
      const rec = state.get(k);
      const chainEntries = readChain(auditDir, taskId);
      const chainClean = verifyHashChain(chainEntries);

      // Case 1: no record → first failure, allowed
      if (!rec) {
        const reason = `first failure for task ${taskId}, retry allowed`;
        appendAuditEntry(auditDir, {
          task_id: taskId,
          actor,
          event: "retry_check",
          decision: "allow",
          context: makeContext({
            failure_signature: failureSignature,
            failure_kind: "agent_error",
            attempt_count: 0,
            max_retries: maxRetries,
            dead_end: false,
            can_expand_capability: false,
            reason,
          }),
          evidence_ref: evidenceRef,
        });

        return {
          decision: "allow",
          reasons: [reason],
          attempt_count: 0,
          max_retries: maxRetries,
          can_expand_capability: false,
          dead_end: false,
          chainClean,
        };
      }

      // Case 2: dead_end flag → deny immediately
      if (rec.deadEnd) {
        const reason = `dead_end flag set for task ${taskId}, retry blocked`;
        appendAuditEntry(auditDir, {
          task_id: taskId,
          actor,
          event: "retry_check",
          decision: "deny",
          context: makeContext({
            failure_signature: failureSignature,
            failure_kind: "agent_error",
            attempt_count: rec.count,
            max_retries: maxRetries,
            dead_end: true,
            can_expand_capability: false,
            reason,
          }),
          evidence_ref: evidenceRef,
        });

        return {
          decision: "deny",
          reasons: [reason],
          attempt_count: rec.count,
          max_retries: maxRetries,
          can_expand_capability: false,
          dead_end: true,
          chainClean,
        };
      }

      // Case 3: count >= maxRetries → blocked (at or beyond retry budget)
      // maxRetries=2 means: up to 2 failures allowed, 3rd failure is blocked
      if (rec.count >= maxRetries) {
        const reason = `max retries (${maxRetries}) exhausted for task ${taskId}, retry blocked`;
        appendAuditEntry(auditDir, {
          task_id: taskId,
          actor,
          event: "retry_check",
          decision: "deny",
          context: makeContext({
            failure_signature: failureSignature,
            failure_kind: "agent_error",
            attempt_count: rec.count,
            max_retries: maxRetries,
            dead_end: false,
            can_expand_capability: false,
            reason,
          }),
          evidence_ref: evidenceRef,
        });

        return {
          decision: "deny",
          reasons: [reason],
          attempt_count: rec.count,
          max_retries: maxRetries,
          can_expand_capability: false,
          dead_end: false,
          chainClean,
        };
      }

      // Case 4: within retries → allowed
      const reason = `retry allowed for task ${taskId}: ${rec.count}/${maxRetries}`;
      appendAuditEntry(auditDir, {
        task_id: taskId,
        actor,
        event: "retry_check",
        decision: "allow",
        context: makeContext({
          failure_signature: failureSignature,
          failure_kind: "agent_error",
          attempt_count: rec.count,
          max_retries: maxRetries,
          dead_end: false,
          can_expand_capability: false,
          reason,
        }),
        evidence_ref: evidenceRef,
      });

      return {
        decision: "allow",
        reasons: [reason],
        attempt_count: rec.count,
        max_retries: maxRetries,
        can_expand_capability: false,
        dead_end: false,
        chainClean,
      };
    },

    resetRetryState(taskId: string): ResetResult {
      const reasons: string[] = [];
      let count = 0;

      const entries = Array.from(state.entries());
      const toDelete: string[] = [];
      for (const [k, rec] of entries) {
        if (rec.taskId === taskId) {
          count = Math.max(count, rec.count);
          toDelete.push(k);
        }
      }

      for (const k of toDelete) {
        state.delete(k);
      }

      if (count > 0) {
        reasons.push(`reset ${count} failure record(s) for task ${taskId}`);
      } else {
        reasons.push(`no retry state found for task ${taskId}`);
      }

      appendAuditEntry(auditDir, {
        task_id: taskId,
        actor: "system",
        event: "retry_check",
        decision: "allow",
        context: makeContext({
          failure_signature: "(reset)",
          failure_kind: "agent_error",
          attempt_count: 0,
          max_retries: maxRetries,
          dead_end: false,
          can_expand_capability: false,
          reason: reasons[0],
        }),
        evidence_ref: "retry-runtime:reset",
      });

      return {
        decision: "allow",
        reasons,
        chainClean: verifyHashChain(readChain(auditDir, taskId)),
      };
    },
  };
}