import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import type { AuditEntry } from "@shared/lib/safety/types";
import { computeEntryHash } from "../../src/main/safety/audit-hash";
import { createAuditLogStore } from "../../src/main/safety/audit-log";

const TASK_ID = "audit-log-test-001";

describe("audit-log persistence", () => {
  // Use a real temp directory, not ~/.hermes/audit/
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-audit-test-"));
  const store = createAuditLogStore({ auditDir: tmpDir });
  const filePath = path.join(tmpDir, `${TASK_ID}.jsonl`);

  beforeAll(() => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  afterAll(() => {
    // Clean up entire temp directory
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("append first entry: seq=0, prev_hash=64 zeros", () => {
    const entry = store.append({
      task_id: TASK_ID,
      actor: "hermes",
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
      evidence_ref: "test-evid-001",
    });

    expect(entry.seq).toBe(0);
    expect(entry.prev_hash).toBe("0".repeat(64));
    expect(entry.entry_hash).toHaveLength(64);
    expect(entry.task_id).toBe(TASK_ID);
    expect(entry.actor).toBe("hermes");
    expect(entry.event).toBe("preflight");
    expect(entry.decision).toBe("allow");
  });

  it("append second entry: seq=1, prev_hash equals first entry_hash", () => {
    const chain = store.read(TASK_ID);
    expect(chain.length).toBe(1);
    const firstHash = chain[0].entry_hash;

    const entry2 = store.append({
      task_id: TASK_ID,
      actor: "system",
      event: "action_gate",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "run_command",
        allowed_capability_set: ["run_command"],
        matched_rule: "trust_ceiling",
        allowlist_hit: null,
        path_check: "not_applicable",
      },
      evidence_ref: "test-evid-002",
    });

    expect(entry2.seq).toBe(1);
    expect(entry2.prev_hash).toBe(firstHash);
    expect(entry2.entry_hash).toHaveLength(64);
  });

  it("readAuditChain returns entries in order", () => {
    const chain = store.read(TASK_ID);
    expect(chain.length).toBe(2);
    expect(chain[0].seq).toBe(0);
    expect(chain[1].seq).toBe(1);
    expect(chain[0].prev_hash).toBe("0".repeat(64));
    expect(chain[1].prev_hash).toBe(chain[0].entry_hash);
  });

  it("verifyAuditChain returns -1 for clean chain", () => {
    expect(store.verify(TASK_ID)).toBe(-1);
  });

  it("detects tampered entry (prev_hash link break)", () => {
    // Read current chain
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: AuditEntry[] = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEntry);

    // Tamper entry 0's decision (causes entry 1's prev_hash to no longer match)
    parsed[0].decision = "deny";
    parsed[0].entry_hash = computeEntryHash({
      seq: parsed[0].seq,
      prev_hash: parsed[0].prev_hash,
      ts: parsed[0].ts,
      task_id: parsed[0].task_id,
      event: parsed[0].event,
      decision: parsed[0].decision,
      context: parsed[0].context,
      evidence_ref: parsed[0].evidence_ref,
    });

    fs.writeFileSync(filePath, parsed.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    try {
      expect(store.verify(TASK_ID)).toBe(1);
    } finally {
      // Restore clean state
      const cleanRaw = fs.readFileSync(filePath, "utf8");
      const cleanParsed: AuditEntry[] = cleanRaw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEntry);
      cleanParsed[0].decision = "allow";
      cleanParsed[0].entry_hash = computeEntryHash({
        seq: cleanParsed[0].seq,
        prev_hash: cleanParsed[0].prev_hash,
        ts: cleanParsed[0].ts,
        task_id: cleanParsed[0].task_id,
        event: cleanParsed[0].event,
        decision: cleanParsed[0].decision,
        context: cleanParsed[0].context,
        evidence_ref: cleanParsed[0].evidence_ref,
      });
      fs.writeFileSync(filePath, cleanParsed.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    }
  });

  it("verifyAuditChain fails on broken prev_hash link", () => {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: AuditEntry[] = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEntry);

    // Corrupt prev_hash of entry 1
    parsed[1].prev_hash = "deadbeef".padEnd(64, "0");
    parsed[1].entry_hash = computeEntryHash({
      seq: parsed[1].seq,
      prev_hash: parsed[1].prev_hash,
      ts: parsed[1].ts,
      task_id: parsed[1].task_id,
      event: parsed[1].event,
      decision: parsed[1].decision,
      context: parsed[1].context,
      evidence_ref: parsed[1].evidence_ref,
    });

    fs.writeFileSync(filePath, parsed.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    try {
      expect(store.verify(TASK_ID)).toBe(1);
    } finally {
      // Restore clean state
      const cleanRaw = fs.readFileSync(filePath, "utf8");
      const cleanParsed: AuditEntry[] = cleanRaw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as AuditEntry);
      cleanParsed[1].prev_hash = cleanParsed[0].entry_hash;
      cleanParsed[1].entry_hash = computeEntryHash({
        seq: cleanParsed[1].seq,
        prev_hash: cleanParsed[1].prev_hash,
        ts: cleanParsed[1].ts,
        task_id: cleanParsed[1].task_id,
        event: cleanParsed[1].event,
        decision: cleanParsed[1].decision,
        context: cleanParsed[1].context,
        evidence_ref: cleanParsed[1].evidence_ref,
      });
      fs.writeFileSync(filePath, cleanParsed.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
    }
  });

  it("non-existent task returns empty chain", () => {
    expect(store.read("non-existent-task-xyz")).toEqual([]);
  });

  it("verifyAuditChain on non-existent task returns -1", () => {
    expect(store.verify("non-existent-task-xyz")).toBe(-1);
  });

  it("uses temp directory, not ~/.hermes/audit/", () => {
    // Verify the file was written to temp, not to the real audit dir
    const realAuditPath = path.join(require("os").homedir(), ".hermes", "audit", `${TASK_ID}.jsonl`);
    expect(fs.existsSync(realAuditPath)).toBe(false);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});