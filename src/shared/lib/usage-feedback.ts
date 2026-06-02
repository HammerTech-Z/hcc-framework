// GBrain Usage Feedback Ledger — append-only event log (P1.5)
// No persistence of Knowledge/Vault schema. No effect on typed links inference.

export type Outcome = "PASS" | "FAIL" | "rolled_back";

export interface UsageEvent {
  task_id: string;
  /** ISO 8601 — when this event was recorded */
  recorded_at: string;
  /** Pipeline run artifact ref for traceability */
  artifact_ref: string | null;
  retrieved: string[];   // knowledge_id — retrieved during retrieval phase
  used: string[];        // knowledge_id — actually used in task
  outcome: Outcome;
  helped: string[];      // knowledge_id — confirmed helpful
  misled: string[];     // knowledge_id — caused wrong direction / dead_end
}

// -----------------------------------------------------------------
// Append-only ledger (in-memory for MVP; swap for file I/O in P2)
// -----------------------------------------------------------------

const _ledger: UsageEvent[] = [];

/** Record a usage event. Never call this more than once per task_id. */
export function recordUsageEvent(event: UsageEvent): void {
  _ledger.push({ ...event });
}

/** Returns all events for a given task_id (should only be one). */
export function getEventsForTask(taskId: string): UsageEvent[] {
  return _ledger.filter((e) => e.task_id === taskId);
}

/** Returns all recorded events. */
export function getAllEvents(): UsageEvent[] {
  return [..._ledger];
}

/** Clear all events (only for testing). */
export function _clearLedger(): void {
  _ledger.length = 0;
}

// -----------------------------------------------------------------
// dead_ends → misled mapping helper
// -----------------------------------------------------------------

/**
 * Converts a list of dead_end strings (e.g. from Handoff Pack) to a
 * `misled` array suitable for use in a UsageEvent.
 *
 * Rule: every dead_end is treated as a knowledge_id that caused
 * the task to go the wrong direction.
 */
export function deadEndsToMisled(
  deadEnds: string[],
  knowledgeIdMap?: Record<string, string>
): string[] {
  if (!deadEnds.length) return [];
  if (!knowledgeIdMap) {
    // If no map, treat each dead_end string AS a knowledge_id
    return [...deadEnds];
  }
  // Map each dead_end to its knowledge_id (fallback: keep original)
  return deadEnds.map((de) => knowledgeIdMap[de] ?? de);
}

// -----------------------------------------------------------------
// Minimal sample event builders (for testing)
// -----------------------------------------------------------------

export function buildPassEvent(opts: {
  taskId: string;
  artifactRef?: string;
  retrieved: string[];
  used: string[];
  helped: string[];
}): UsageEvent {
  return {
    task_id: opts.taskId,
    recorded_at: new Date().toISOString(),
    artifact_ref: opts.artifactRef ?? null,
    retrieved: opts.retrieved,
    used: opts.used,
    outcome: "PASS",
    helped: opts.helped,
    misled: [],
  };
}

export function buildFailEvent(opts: {
  taskId: string;
  artifactRef?: string;
  retrieved: string[];
  used: string[];
  misled: string[];
  rolledBack?: boolean;
}): UsageEvent {
  return {
    task_id: opts.taskId,
    recorded_at: new Date().toISOString(),
    artifact_ref: opts.artifactRef ?? null,
    retrieved: opts.retrieved,
    used: opts.used,
    outcome: opts.rolledBack ? "rolled_back" : "FAIL",
    helped: [],
    misled: opts.misled,
  };
}