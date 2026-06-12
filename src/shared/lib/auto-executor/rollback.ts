/**
 * §4.4 — Rollback behavior (composer)
 *
 * Pure function module. Composes the existing `RollbackPoint` shape from
 * `src/main/safety/rollback-strategy.ts` into an ActionRecord with an
 * idempotent revertFn slot.
 *
 * Idempotency: calling revertFn twice on the same ActionRecord must be a
 * no-op on the second call. The module provides a `makeRevertFn` factory
 * that returns an idempotent wrapper around the caller's revert logic.
 *
 * The module does NOT perform I/O on its own. It produces ActionRecord
 * objects that the host (a future executor) persists and uses.
 */

import { randomUUID } from "node:crypto";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface PreState {
  /** Free-form key/value snapshot of the pre-action state. */
  data: Record<string, unknown>;
  /** ISO 8601 timestamp. */
  capturedAt: string;
}

export interface PostState {
  data: Record<string, unknown>;
  capturedAt: string;
}

/**
 * The caller's revert function. It takes the pre-state and rolls the
 * system back. May be called at most once per ActionRecord.
 */
export type RawRevertFn = (pre: PreState) => Promise<void>;

export interface ActionRecord {
  id: string;
  type: string;
  preState: PreState;
  postState: PostState;
  revertFn: () => Promise<void>;
  /** ISO 8601 timestamp the record was created. */
  createdAt: string;
  /** Becomes true after revert() is called once. Revert refuses to run twice. */
  reverted: boolean;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Wrap a RawRevertFn so that calling it twice is a no-op. The wrapper
 * records `reverted = true` on the ActionRecord after the first successful
 * call, and refuses on the second.
 */
export function makeRevertFn(
  record: ActionRecord,
  raw: RawRevertFn,
): () => Promise<void> {
  return async (): Promise<void> => {
    if (record.reverted) {
      // Idempotent: second call is a no-op, not an error.
      return;
    }
    await raw(record.preState);
    record.reverted = true;
  };
}

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

export interface CreateRecordInput {
  type: string;
  preState: PreState;
  postState: PostState;
  /** Caller-provided revert function. Wrapped for idempotency. */
  rawRevert: RawRevertFn;
  /**
   * Optional id. If omitted, a UUID v4 is generated. Tests pass a fixed id
   * for determinism.
   */
  id?: string;
}

export function createActionRecord(input: CreateRecordInput): ActionRecord {
  const id = input.id ?? randomUUID();
  const record: ActionRecord = {
    id,
    type: input.type,
    preState: input.preState,
    postState: input.postState,
    revertFn: async () => {
      // placeholder, replaced below
    },
    createdAt: new Date().toISOString(),
    reverted: false,
  };
  record.revertFn = makeRevertFn(record, input.rawRevert);
  return record;
}

/**
 * Apply the revert. Idempotent: returns immediately if already reverted.
 * Returns true if the revert ran, false if it was a no-op.
 */
export async function revertAction(record: ActionRecord): Promise<boolean> {
  if (record.reverted) return false;
  await record.revertFn();
  return true;
}
