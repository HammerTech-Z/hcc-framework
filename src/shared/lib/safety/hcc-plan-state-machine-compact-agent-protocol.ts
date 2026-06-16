// HCC Plan State Machine + Compact Agent Protocol.
//
// Pure contract slice: types, constants, validators for the
// HCC plan state machine and the compact agent packet format.
// No runtime. No IPC. No daemon. No timer/cron. No auto
// executor startup. No app boot wiring. No ~/.hermes write.
//
// Per HCC governance:
//   - Pure TypeScript only; no side effects on import.
//   - The state machine is the single source of truth for
//     allowed transitions.
//   - The compact packet is the only format a downstream
//     agent (terminal Hermes, Hermes Pro app, Codex /
//     Claude Code) is permitted to emit on a state boundary.
//   - Packets must contain FACTS ONLY. Reasoning, narrative,
//     or "thought" fields are rejected at validation time.
//   - Packets are size-bounded so an agent cannot smuggle
//     large free-form text into a downstream state machine.

export const HCC_PLAN_STATE_MACHINE_SCHEMA_VERSION = "1.0.0" as const;

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type HCCPlanState =
  | "PLAN_FROZEN"
  | "TASK_PACKET_ISSUED"
  | "EXECUTED"
  | "AUDITED"
  | "NEED_PLAN_REPAIR"
  | "PLAN_REPAIRED"
  | "PROMOTED";

export const HCC_PLAN_STATES: readonly HCCPlanState[] = Object.freeze([
  "PLAN_FROZEN",
  "TASK_PACKET_ISSUED",
  "EXECUTED",
  "AUDITED",
  "NEED_PLAN_REPAIR",
  "PLAN_REPAIRED",
  "PROMOTED",
]);

/**
 * Allowed forward transitions. Each state maps to the set of
 * states it may transition into. The state machine is
 * explicit; any transition not in this map is rejected.
 */
export const HCC_PLAN_TRANSITIONS: Readonly<
  Record<HCCPlanState, readonly HCCPlanState[]>
> = Object.freeze({
  PLAN_FROZEN: Object.freeze<HCCPlanState[]>(["TASK_PACKET_ISSUED"]),
  TASK_PACKET_ISSUED: Object.freeze<HCCPlanState[]>(["EXECUTED"]),
  EXECUTED: Object.freeze<HCCPlanState[]>(["AUDITED", "NEED_PLAN_REPAIR"]),
  AUDITED: Object.freeze<HCCPlanState[]>(["PROMOTED", "NEED_PLAN_REPAIR"]),
  NEED_PLAN_REPAIR: Object.freeze<HCCPlanState[]>(["PLAN_REPAIRED"]),
  PLAN_REPAIRED: Object.freeze<HCCPlanState[]>(["EXECUTED", "AUDITED"]),
  PROMOTED: Object.freeze<HCCPlanState[]>([]),
});

/**
 * Compact set of states a packet may mark itself as. The
 * "status" field on a packet must be one of these. We keep it
 * intentionally small so a downstream agent cannot invent
 * ad-hoc state names.
 */
export type HCCPlanPacketStatus =
  | "frozen"
  | "issued"
  | "executed"
  | "audited"
  | "need_fix"
  | "repaired"
  | "promoted";

// ---------------------------------------------------------------------------
// Compact agent packet
// ---------------------------------------------------------------------------

/**
 * Maximum size, in bytes, of a serialized compact packet.
 * Anything larger is rejected at validation time. The bound
 * is deliberate: a downstream state machine must not accept
 * large free-form text under any field.
 */
export const HCC_COMPACT_PACKET_MAX_BYTES = 4096;

/**
 * Reserved short field names. The compact packet uses these
 * short keys to keep size bounded. A downstream agent may not
 * add fields outside this allowlist.
 */
export const HCC_COMPACT_PACKET_FIELDS = Object.freeze({
  V: "v",
  ID: "id",
  S: "s",
  BASE: "base",
  FILES: "files",
  GATES: "gates",
  BLOCK: "block",
  NEXT: "next",
  REF: "ref",
} as const);

/**
 * Forbidden field names. ANY key starting with a forbidden
 * prefix is rejected. This blocks agents from smuggling
 * "thought", "reasoning", "narrative", or "explanation"
 * fields into the packet.
 */
export const HCC_COMPACT_PACKET_FORBIDDEN_KEY_PREFIXES: readonly string[] =
  Object.freeze(["thought", "reasoning", "narrative", "explanation", "comment"]);

/**
 * Allowed values for the `next` field. Short tokens, each
 * indicates the only next legitimate step from the current
 * packet. Anything else is rejected.
 */
export const HCC_COMPACT_PACKET_NEXT_VALUES: readonly string[] = Object.freeze([
  "repair_plan_first",
  "continue",
  "stop",
  "blocked",
  "retry",
  "collect",
]);

export interface HCCCompactAgentPacket {
  /** Protocol version. Must be 1. */
  v: 1;
  /** Stable task / slice / state id. */
  id: string;
  /** Packet status (short token). */
  s: HCCPlanPacketStatus;
  /** Base commit hash the work was performed against. */
  base: string;
  /** File paths touched (or relevant). */
  files: readonly string[];
  /** Gate result tokens, e.g. "typecheck:pass". */
  gates: readonly string[];
  /** Active blocker tokens. Empty array allowed. */
  block: readonly string[];
  /** Next-step token. */
  next: string;
  /** Reference doc / commit paths. */
  ref: readonly string[];
}

export type HCCCompactPacketValidationResult =
  | { ok: true; packet: HCCCompactAgentPacket }
  | { ok: false; reason: string };

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function isStringArray(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function isValidHCCPlanState(v: unknown): v is HCCPlanState {
  return typeof v === "string" &&
    (HCC_PLAN_STATES as readonly string[]).includes(v);
}

export function isValidTransition(
  from: HCCPlanState,
  to: HCCPlanState,
): boolean {
  const allowed = HCC_PLAN_TRANSITIONS[from];
  return (allowed as readonly string[]).includes(to);
}

export function canReachPromoted(
  from: HCCPlanState,
  visited: readonly HCCPlanState[] = [],
): boolean {
  if (from === "PROMOTED") return true;
  if (visited.includes(from)) return false;
  const next = HCC_PLAN_TRANSITIONS[from];
  return next.some((n) => canReachPromoted(n, [...visited, from]));
}

/**
 * Validate a compact packet. Returns `{ ok: true, packet }`
 * with a normalized packet, or `{ ok: false, reason }` with a
 * single human-readable reason. The validator enforces:
 *   - v === 1
 *   - id / base non-empty
 *   - s in allowed set
 *   - files / gates / block / ref are string arrays
 *   - next is a non-empty string in the allowed set
 *   - no field outside the allowlist
 *   - no key starting with a forbidden prefix
 *   - serialized size <= HCC_COMPACT_PACKET_MAX_BYTES
 *
 * The validator never throws.
 */
export function validateCompactPacket(
  input: unknown,
): HCCCompactPacketValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, reason: "packet must be a JSON object" };
  }
  const obj = input as Record<string, unknown>;

  // v === 1 (exact)
  if (obj.v !== 1) {
    return { ok: false, reason: "field \"v\" must be exactly 1" };
  }
  // id non-empty string
  if (!isNonEmptyString(obj.id)) {
    return { ok: false, reason: "field \"id\" must be a non-empty string" };
  }
  // base non-empty string
  if (!isNonEmptyString(obj.base)) {
    return { ok: false, reason: "field \"base\" must be a non-empty string" };
  }
  // s in allowed set
  const allowedStatuses: readonly string[] = [
    "frozen",
    "issued",
    "executed",
    "audited",
    "need_fix",
    "repaired",
    "promoted",
  ];
  if (typeof obj.s !== "string" || !allowedStatuses.includes(obj.s)) {
    return { ok: false, reason: `field "s" must be one of ${allowedStatuses.join(",")}` };
  }
  // files / gates / block / ref string arrays
  for (const field of ["files", "gates", "block", "ref"] as const) {
    if (!isStringArray(obj[field])) {
      return { ok: false, reason: `field "${field}" must be an array of strings` };
    }
  }
  // next non-empty + in allowed set
  if (typeof obj.next !== "string" || !isNonEmptyString(obj.next)) {
    return { ok: false, reason: "field \"next\" must be a non-empty string" };
  }
  if (!(HCC_COMPACT_PACKET_NEXT_VALUES as readonly string[]).includes(obj.next)) {
    return {
      ok: false,
      reason: `field "next" must be one of ${HCC_COMPACT_PACKET_NEXT_VALUES.join(",")}`,
    };
  }
  // Allowlist: only the 8 short fields are permitted.
  const allowedKeys = new Set<string>(Object.values(HCC_COMPACT_PACKET_FIELDS));
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        reason: `field "${key}" is not in the allowlist (only ${[...allowedKeys].join(",")} allowed)`,
      };
    }
  }
  // Forbidden prefix scan (defense in depth; allowlist should
  // already block any new key, but a future field could share
  // a prefix with a forbidden token by accident).
  for (const key of Object.keys(obj)) {
    const lower = key.toLowerCase();
    for (const prefix of HCC_COMPACT_PACKET_FORBIDDEN_KEY_PREFIXES) {
      if (lower.startsWith(prefix)) {
        return {
          ok: false,
          reason: `field "${key}" starts with forbidden prefix "${prefix}" (narrative fields are not allowed)`,
        };
      }
    }
  }
  // Size check.
  let serialized: string;
  try {
    serialized = JSON.stringify(obj);
  } catch (err) {
    return { ok: false, reason: `packet not JSON-serializable: ${(err as Error).message}` };
  }
  if (Buffer.byteLength(serialized, "utf-8") > HCC_COMPACT_PACKET_MAX_BYTES) {
    return {
      ok: false,
      reason: `packet exceeds ${HCC_COMPACT_PACKET_MAX_BYTES} bytes`,
    };
  }
  return {
    ok: true,
    packet: obj as unknown as HCCCompactAgentPacket,
  };
}

/**
 * Validate a state transition with two extra guards:
 *   - cannot transition to PROMOTED unless `audited` is true
 *     AND `block` is empty
 *   - cannot transition from NEED_PLAN_REPAIR directly to
 *     PROMOTED (must pass through PLAN_REPAIRED first)
 *
 * Returns `{ ok: true }` if the transition is permitted, or
 * `{ ok: false, reason }` otherwise.
 */
export function validateTransitionGuards(
  from: HCCPlanState,
  to: HCCPlanState,
  audited: boolean,
  blockers: readonly string[],
): { ok: true } | { ok: false; reason: string } {
  if (!isValidTransition(from, to)) {
    return { ok: false, reason: `transition ${from} -> ${to} is not in the allowlist` };
  }
  if (to === "PROMOTED") {
    if (from !== "AUDITED") {
      return { ok: false, reason: "PROMOTED requires transition from AUDITED" };
    }
    if (!audited) {
      return { ok: false, reason: "PROMOTED requires audited=true" };
    }
    if (blockers.length > 0) {
      return { ok: false, reason: "PROMOTED requires block=[] (no unresolved blockers)" };
    }
  }
  if (from === "NEED_PLAN_REPAIR" && to === "PROMOTED") {
    return { ok: false, reason: "NEED_PLAN_REPAIR -> PROMOTED is forbidden (must pass through PLAN_REPAIRED)" };
  }
  return { ok: true };
}
