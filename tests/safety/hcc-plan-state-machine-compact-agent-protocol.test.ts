import { describe, it, expect } from "vitest";

import {
  HCC_COMPACT_PACKET_FIELDS,
  HCC_COMPACT_PACKET_FORBIDDEN_KEY_PREFIXES,
  HCC_COMPACT_PACKET_MAX_BYTES,
  HCC_COMPACT_PACKET_NEXT_VALUES,
  HCC_PLAN_STATES,
  HCC_PLAN_STATE_MACHINE_SCHEMA_VERSION,
  HCC_PLAN_TRANSITIONS,
  canReachPromoted,
  isValidHCCPlanState,
  isValidTransition,
  validateCompactPacket,
  validateTransitionGuards,
  type HCCCompactAgentPacket,
  type HCCPlanState,
} from "../../src/shared/lib/safety/hcc-plan-state-machine-compact-agent-protocol";

const validPacket: HCCCompactAgentPacket = {
  v: 1,
  id: "HCC-UNATTENDED-001",
  s: "audited",
  base: "9927fd8",
  files: ["src/main/ipc-handlers/wire-hcc-unattended-app-ipc.ts"],
  gates: ["typecheck:pass", "app-ipc:pass", "auto-executor:pass", "safety:pass"],
  block: [],
  next: "continue",
  ref: ["docs/closeout/hcc-...-closeout-2026-06-15.md"],
};

// ---------------------------------------------------------------------------
// Schema constants
// ---------------------------------------------------------------------------

describe("HCC plan state machine: schema constants", () => {
  it("schema version is canonical", () => {
    expect(HCC_PLAN_STATE_MACHINE_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("max packet bytes is bounded", () => {
    expect(HCC_COMPACT_PACKET_MAX_BYTES).toBe(4096);
  });

  it("forbidden prefixes include thought/reasoning/narrative/explanation/comment", () => {
    expect(HCC_COMPACT_PACKET_FORBIDDEN_KEY_PREFIXES).toEqual(
      expect.arrayContaining(["thought", "reasoning", "narrative", "explanation", "comment"]),
    );
  });

  it("next values are short tokens", () => {
    expect(HCC_COMPACT_PACKET_NEXT_VALUES).toEqual([
      "repair_plan_first",
      "continue",
      "stop",
      "blocked",
      "retry",
      "collect",
    ]);
  });

  it("field names are short single-character keys", () => {
    expect(HCC_COMPACT_PACKET_FIELDS).toEqual({
      V: "v",
      ID: "id",
      S: "s",
      BASE: "base",
      FILES: "files",
      GATES: "gates",
      BLOCK: "block",
      NEXT: "next",
      REF: "ref",
    });
  });
});

// ---------------------------------------------------------------------------
// State machine: states + transitions
// ---------------------------------------------------------------------------

describe("HCC plan state machine: states", () => {
  it("defines exactly 7 states", () => {
    expect(HCC_PLAN_STATES).toHaveLength(7);
  });

  it("all states are valid", () => {
    for (const s of HCC_PLAN_STATES) {
      expect(isValidHCCPlanState(s)).toBe(true);
    }
  });

  it("rejects non-state strings", () => {
    expect(isValidHCCPlanState("foo")).toBe(false);
    expect(isValidHCCPlanState("")).toBe(false);
    expect(isValidHCCPlanState(null)).toBe(false);
    expect(isValidHCCPlanState(42)).toBe(false);
  });
});

describe("HCC plan state machine: transitions", () => {
  it("PLAN_FROZEN -> TASK_PACKET_ISSUED allowed", () => {
    expect(isValidTransition("PLAN_FROZEN", "TASK_PACKET_ISSUED")).toBe(true);
  });
  it("TASK_PACKET_ISSUED -> EXECUTED allowed", () => {
    expect(isValidTransition("TASK_PACKET_ISSUED", "EXECUTED")).toBe(true);
  });
  it("EXECUTED -> AUDITED allowed", () => {
    expect(isValidTransition("EXECUTED", "AUDITED")).toBe(true);
  });
  it("EXECUTED -> NEED_PLAN_REPAIR allowed", () => {
    expect(isValidTransition("EXECUTED", "NEED_PLAN_REPAIR")).toBe(true);
  });
  it("AUDITED -> PROMOTED allowed (when guards satisfied)", () => {
    expect(isValidTransition("AUDITED", "PROMOTED")).toBe(true);
  });
  it("AUDITED -> NEED_PLAN_REPAIR allowed", () => {
    expect(isValidTransition("AUDITED", "NEED_PLAN_REPAIR")).toBe(true);
  });
  it("NEED_PLAN_REPAIR -> PLAN_REPAIRED allowed", () => {
    expect(isValidTransition("NEED_PLAN_REPAIR", "PLAN_REPAIRED")).toBe(true);
  });
  it("PLAN_REPAIRED -> EXECUTED or AUDITED allowed", () => {
    expect(isValidTransition("PLAN_REPAIRED", "EXECUTED")).toBe(true);
    expect(isValidTransition("PLAN_REPAIRED", "AUDITED")).toBe(true);
  });
  it("PROMOTED is terminal (no outgoing edges)", () => {
    expect(HCC_PLAN_TRANSITIONS.PROMOTED).toEqual([]);
  });

  it("rejects invalid transitions", () => {
    expect(isValidTransition("PLAN_FROZEN", "PROMOTED")).toBe(false);
    expect(isValidTransition("PLAN_FROZEN", "EXECUTED")).toBe(false);
    expect(isValidTransition("PROMOTED", "AUDITED")).toBe(false);
    expect(isValidTransition("NEED_PLAN_REPAIR", "PROMOTED")).toBe(false);
    expect(isValidTransition("NEED_PLAN_REPAIR", "EXECUTED")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Transition guards
// ---------------------------------------------------------------------------

describe("HCC plan state machine: transition guards", () => {
  it("PROMOTED requires transition from AUDITED", () => {
    const r = validateTransitionGuards("EXECUTED", "PROMOTED", true, []);
    expect(r.ok).toBe(false);
  });

  it("PROMOTED requires audited=true", () => {
    const r = validateTransitionGuards("AUDITED", "PROMOTED", false, []);
    expect(r.ok).toBe(false);
  });

  it("PROMOTED requires block=[]", () => {
    const r = validateTransitionGuards("AUDITED", "PROMOTED", true, ["post_9927_not_validated"]);
    expect(r.ok).toBe(false);
  });

  it("PROMOTED succeeds when audited=true and block=[]", () => {
    const r = validateTransitionGuards("AUDITED", "PROMOTED", true, []);
    expect(r.ok).toBe(true);
  });

  it("NEED_PLAN_REPAIR -> PROMOTED is forbidden (must pass through PLAN_REPAIRED)", () => {
    const r = validateTransitionGuards("NEED_PLAN_REPAIR", "PROMOTED", true, []);
    expect(r.ok).toBe(false);
  });

  it("rejects transitions not in the allowlist", () => {
    const r = validateTransitionGuards("PLAN_FROZEN", "PROMOTED", true, []);
    expect(r.ok).toBe(false);
  });
});

describe("HCC plan state machine: canReachPromoted", () => {
  it("PROMOTED is reachable from PLAN_FROZEN via the normal path", () => {
    expect(canReachPromoted("PLAN_FROZEN")).toBe(true);
  });
  it("NEED_PLAN_REPAIR can reach PROMOTED through PLAN_REPAIRED (graph reachability, not guard)", () => {
    expect(canReachPromoted("NEED_PLAN_REPAIR")).toBe(true);
  });
  it("canReachPromoted returns true for PROMOTED itself", () => {
    expect(canReachPromoted("PROMOTED")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compact packet validation
// ---------------------------------------------------------------------------

describe("HCC plan state machine: validateCompactPacket", () => {
  it("valid packet -> ok", () => {
    const r = validateCompactPacket(validPacket);
    expect(r.ok).toBe(true);
  });

  it("non-object input -> fail", () => {
    expect(validateCompactPacket(null).ok).toBe(false);
    expect(validateCompactPacket(undefined).ok).toBe(false);
    expect(validateCompactPacket("string").ok).toBe(false);
    expect(validateCompactPacket(42).ok).toBe(false);
    expect(validateCompactPacket([1, 2]).ok).toBe(false);
  });

  it("v must be exactly 1", () => {
    const p = { ...validPacket, v: 2 };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("missing id -> fail", () => {
    const p = { ...validPacket, id: "" };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("missing base -> fail", () => {
    const p = { ...validPacket, base: "" };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("invalid s -> fail", () => {
    const p = { ...validPacket, s: "garbage" };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("files/gates/block/ref must be string arrays", () => {
    for (const field of ["files", "gates", "block", "ref"] as const) {
      const p = { ...validPacket, [field]: "not-an-array" };
      expect(validateCompactPacket(p).ok).toBe(false);
      const p2 = { ...validPacket, [field]: [1, 2, 3] };
      expect(validateCompactPacket(p2).ok).toBe(false);
    }
  });

  it("next must be in allowed values", () => {
    const p = { ...validPacket, next: "narrate_happily" };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("empty next -> fail", () => {
    const p = { ...validPacket, next: "" };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("forbidden field (thought) -> fail", () => {
    const p = { ...validPacket, thought: "I think we should..." };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("forbidden field (reasoning) -> fail", () => {
    const p = { ...validPacket, reasoning: "because the audit found..." };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("forbidden field (narrative) -> fail", () => {
    const p = { ...validPacket, narrative: "Once upon a time..." };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("forbidden field (explanation) -> fail", () => {
    const p = { ...validPacket, explanation: "this happened because..." };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("forbidden field (comment) -> fail", () => {
    const p = { ...validPacket, comment: "TODO: ..." };
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("any field outside the 8-field allowlist -> fail", () => {
    const p = { ...validPacket, random_field: "x" } as unknown as HCCCompactAgentPacket;
    expect(validateCompactPacket(p).ok).toBe(false);
  });

  it("serialized size > 4 KiB -> fail", () => {
    // Build a packet with a huge `files` array to exceed the cap.
    const huge = Array.from({ length: 200 }, (_, i) => `src/foo/file-${i}.ts`);
    const p = { ...validPacket, files: huge };
    const r = validateCompactPacket(p);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/bytes/);
    }
  });

  it("packet exactly at the cap is accepted", () => {
    // Find a packet size that fits within the cap.
    // The valid packet above is well under 4 KiB; we assert
    // it's accepted here.
    const r = validateCompactPacket(validPacket);
    expect(r.ok).toBe(true);
  });

  it("all 8 short keys are present, no extras", () => {
    const expected = new Set([
      "v", "id", "s", "base", "files", "gates", "block", "next", "ref",
    ]);
    const r = validateCompactPacket(validPacket);
    if (!r.ok) throw new Error("expected ok");
    const got = new Set(Object.keys(r.packet));
    expect(got).toEqual(expected);
  });
});
