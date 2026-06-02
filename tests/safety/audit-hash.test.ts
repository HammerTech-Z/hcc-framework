import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  computeEntryHash,
  verifyHashChain,
} from "../../src/main/safety/audit-hash";
import type { AuditEntry, AuditHashInput } from "@shared/lib/safety/types";

// -----------------------------------------------------------------
// canonicalJson
// -----------------------------------------------------------------
describe("canonicalJson", () => {
  it("stable key order", () => {
    const a = { z: 1, a: 2, m: 3 };
    const b = { a: 2, m: 3, z: 1 };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });

  it("serialises null as null", () => {
    expect(canonicalJson({ x: null })).toBe('{"x":null}');
  });

  it("serialises nested objects", () => {
    const obj = { outer: { inner: 42 }, arr: [1, 2] };
    const result = JSON.parse(canonicalJson(obj));
    expect(result).toEqual(obj);
  });
});

// -----------------------------------------------------------------
// SHA-256 Hash Chain
// -----------------------------------------------------------------
describe("computeEntryHash", () => {
  it("produces a 64-char hex string", () => {
    const input: AuditHashInput = {
      seq: 1,
      prev_hash: "0000000000000000000000000000000000000000000000000000000000000000",
      ts: "2026-05-30T10:00:00.000Z",
      task_id: "t1",
      event: "preflight",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "read_public",
        allowed_capability_set: ["read_public"],
        matched_rule: "trust_ceiling",
        allowlist_hit: null,
        path_check: "not_applicable",
      },
      evidence_ref: "test",
    };
    const hash = computeEntryHash(input);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("canonical order does not affect hash", () => {
    const a: AuditHashInput = {
      seq: 1,
      prev_hash: "abc",
      ts: "2026-05-30T10:00:00.000Z",
      task_id: "t1",
      event: "preflight",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "read_public",
        allowed_capability_set: ["read_public"],
        matched_rule: "r1",
        allowlist_hit: null,
        path_check: "not_applicable",
      },
      evidence_ref: "e1",
    };
    const b: AuditHashInput = { ...a, context: { ...a.context } };
    expect(computeEntryHash(a)).toBe(computeEntryHash(b));
  });
});

// -----------------------------------------------------------------
// verifyHashChain
// -----------------------------------------------------------------
function makeEntry(overrides: Partial<AuditEntry> & { seq: number; prev_hash: string }): AuditEntry {
  const base: AuditEntry = {
    seq: 0,
    prev_hash: "0000000000000000000000000000000000000000000000000000000000000000",
    entry_hash: "",
    ts: "2026-05-30T10:00:00.000Z",
    task_id: "t1",
    actor: "hermes",
    event: "preflight",
    decision: "allow",
    context: {
      trust_level: "trusted_user",
      requested_capability: "read_public",
      allowed_capability_set: ["read_public"],
      matched_rule: "test",
      allowlist_hit: null,
      path_check: "not_applicable",
    },
    evidence_ref: "test",
    ...overrides,
  };
  base.entry_hash = computeEntryHash({
    seq: base.seq,
    prev_hash: base.prev_hash,
    ts: base.ts,
    task_id: base.task_id,
    event: base.event,
    decision: base.decision,
    context: base.context,
    evidence_ref: base.evidence_ref,
  });
  return base;
}

describe("verifyHashChain", () => {
  it("passes a clean chain of 3 entries", () => {
    const e0 = makeEntry({ seq: 0, prev_hash: "0".repeat(64) });
    const e1 = makeEntry({ seq: 1, prev_hash: e0.entry_hash, event: "action_gate" });
    const e2 = makeEntry({ seq: 2, prev_hash: e1.entry_hash, event: "state_transition" });
    expect(verifyHashChain([e0, e1, e2])).toBe(-1);
  });

  it("detects a tampered entry hash", () => {
    const e0 = makeEntry({ seq: 0, prev_hash: "0".repeat(64) });
    const e1 = makeEntry({ seq: 1, prev_hash: e0.entry_hash, event: "action_gate" });
    const e2 = makeEntry({ seq: 2, prev_hash: e1.entry_hash, event: "state_transition" });
    // Tamper e1 after e2 was created
    e1.decision = "deny";
    e1.entry_hash = computeEntryHash({
      seq: e1.seq, prev_hash: e1.prev_hash, ts: e1.ts,
      task_id: e1.task_id, event: e1.event, decision: e1.decision,
      context: e1.context, evidence_ref: e1.evidence_ref,
    });
    // Chain breaks at e2: e2.prev_hash != e1.entry_hash
    expect(verifyHashChain([e0, e1, e2])).toBe(2);
  });

  it("detects a broken prev_hash link", () => {
    const e0 = makeEntry({ seq: 0, prev_hash: "0".repeat(64) });
    const e1 = makeEntry({ seq: 1, prev_hash: "bad".padEnd(64, "0"), event: "action_gate" });
    expect(verifyHashChain([e0, e1])).toBe(1);
  });

  it("detects early tampering", () => {
    const e0 = makeEntry({ seq: 0, prev_hash: "0".repeat(64) });
    const e1 = makeEntry({ seq: 1, prev_hash: e0.entry_hash, event: "action_gate" });
    e0.decision = "deny";
    e0.entry_hash = computeEntryHash({
      seq: e0.seq, prev_hash: e0.prev_hash, ts: e0.ts,
      task_id: e0.task_id, event: e0.event, decision: e0.decision,
      context: e0.context, evidence_ref: e0.evidence_ref,
    });
    // e1.prev_hash still points to old hash
    expect(verifyHashChain([e0, e1])).toBe(1);
  });

  it("empty chain returns -1 (clean)", () => {
    expect(verifyHashChain([])).toBe(-1);
  });
});
