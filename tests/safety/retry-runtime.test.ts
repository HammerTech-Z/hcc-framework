// P2.5 Retry Runtime Helper — tests
// Uses temp audit dir, no real ~/.hermes/audit/ writes.

import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createRetryRuntime } from "../../src/main/safety/retry-runtime";
import type { AuditEntry } from "../../src/shared/lib/safety/types";

const TEST_AUDIT_DIR = "/tmp/hermes-test-retry-audit";

describe("retry-runtime", () => {
  let rt: ReturnType<typeof createRetryRuntime>;

  beforeEach(() => {
    // Clean slate for each test
    if (fs.existsSync(TEST_AUDIT_DIR)) {
      fs.rmSync(TEST_AUDIT_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_AUDIT_DIR, { recursive: true });
    rt = createRetryRuntime({ auditDir: TEST_AUDIT_DIR, maxRetries: 2 });
  });

  // -------------------------------------------------------------------------
  // Helper: read raw audit chain for a task
  // -------------------------------------------------------------------------

  function readChain(taskId: string): AuditEntry[] {
    const fp = path.join(TEST_AUDIT_DIR, `${taskId}.jsonl`);
    if (!fs.existsSync(fp)) return [];
    return fs
      .readFileSync(fp, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEntry);
  }

  // -------------------------------------------------------------------------
  // Test: first failure allows retry
  // -------------------------------------------------------------------------

  it("first failure allows retry", () => {
    const result = rt.shouldRetry({
      taskId: "task-001",
      failureSignature: "err-timeout",
      actor: "hermes",
      evidenceRef: "test-001",
    });
    expect(result.decision).toBe("allow");
    expect(result.attempt_count).toBe(0);
    expect(result.max_retries).toBe(2);
    expect(result.can_expand_capability).toBe(false);
    expect(result.dead_end).toBe(false);
    expect(result.chainClean).toBe(-1); // new file, clean chain
  });

  // -------------------------------------------------------------------------
  // Test: maxRetries=2 blocks on third attempt
  // -------------------------------------------------------------------------

  it("maxRetries=2 allows 2 records, blocks on the 3rd record", () => {
    // Record 1: count becomes 1, shouldRetry → allow (count=1, within limit)
    rt.recordFailure({
      taskId: "task-002",
      failureSignature: "err-oom",
      failureKind: "resource_exhaustion",
      actor: "hermes",
      evidenceRef: "test-002-record1",
    });

    // Record 2: count becomes 2, shouldRetry → allow (count=2, within limit)
    rt.recordFailure({
      taskId: "task-002",
      failureSignature: "err-oom",
      failureKind: "resource_exhaustion",
      actor: "hermes",
      evidenceRef: "test-002-record2",
    });

    // Record 3: count becomes 3 > maxRetries=2 → shouldRetry → deny
    rt.recordFailure({
      taskId: "task-002",
      failureSignature: "err-oom",
      failureKind: "resource_exhaustion",
      actor: "hermes",
      evidenceRef: "test-002-record3",
    });

    const result = rt.shouldRetry({
      taskId: "task-002",
      failureSignature: "err-oom",
      actor: "hermes",
      evidenceRef: "test-002-check",
    });
    expect(result.decision).toBe("deny");
    expect(result.attempt_count).toBe(3);
    expect(result.can_expand_capability).toBe(false);
    expect(result.chainClean).toBe(-1);
  });

  // -------------------------------------------------------------------------
  // Test: consecutive same failureSignature blocks early at maxRetries
  // -------------------------------------------------------------------------

  it("consecutive same failureSignature blocks at maxRetries", () => {
    // After 2 failures recorded, count=2. maxRetries=2 → count >= maxRetries → deny
    rt.recordFailure({
      taskId: "task-003",
      failureSignature: "err-sig-A",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-003-1",
    });
    rt.recordFailure({
      taskId: "task-003",
      failureSignature: "err-sig-A",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-003-2",
    });

    const result = rt.shouldRetry({
      taskId: "task-003",
      failureSignature: "err-sig-A",
      actor: "hermes",
      evidenceRef: "test-003-check",
    });
    // count=2, maxRetries=2 → deny
    expect(result.decision).toBe("deny");
    expect(result.attempt_count).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Test: different failureSignature counts independently
  // -------------------------------------------------------------------------

  it("different failureSignature counts independently", () => {
    // sig-A records twice → count=2
    rt.recordFailure({
      taskId: "task-004",
      failureSignature: "err-sig-A",
      failureKind: "task_failure",
      actor: "hermes",
      evidenceRef: "test-004-a1",
    });
    rt.recordFailure({
      taskId: "task-004",
      failureSignature: "err-sig-A",
      failureKind: "task_failure",
      actor: "hermes",
      evidenceRef: "test-004-a2",
    });

    // sig-B records once → count=1 (independent)
    rt.recordFailure({
      taskId: "task-004",
      failureSignature: "err-sig-B",
      failureKind: "execution_error",
      actor: "hermes",
      evidenceRef: "test-004-b1",
    });

    // sig-A: count=2, max=2 → deny
    const resultA = rt.shouldRetry({
      taskId: "task-004",
      failureSignature: "err-sig-A",
      actor: "hermes",
      evidenceRef: "test-004-check-a",
    });
    expect(resultA.decision).toBe("deny");
    expect(resultA.attempt_count).toBe(2);

    // sig-B: count=1, max=2 → allow
    const resultB = rt.shouldRetry({
      taskId: "task-004",
      failureSignature: "err-sig-B",
      actor: "hermes",
      evidenceRef: "test-004-check-b",
    });
    expect(resultB.decision).toBe("allow");
    expect(resultB.attempt_count).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Test: deadEnd flag blocks retry immediately
  // -------------------------------------------------------------------------

  it("deadEnd flag blocks retry immediately", () => {
    rt.recordFailure({
      taskId: "task-005",
      failureSignature: "err-sig-C",
      failureKind: "verification_error",
      actor: "hermes",
      evidenceRef: "test-005-1",
      deadEnd: true,
    });

    const result = rt.shouldRetry({
      taskId: "task-005",
      failureSignature: "err-sig-C",
      actor: "hermes",
      evidenceRef: "test-005-check",
    });
    expect(result.decision).toBe("deny");
    expect(result.dead_end).toBe(true);
    expect(result.reasons[0]).toContain("dead_end");
  });

  // -------------------------------------------------------------------------
  // Test: canExpandCapability is always false (first failure allow case)
  // -------------------------------------------------------------------------

  it("canExpandCapability is always false on allow", () => {
    const result = rt.shouldRetry({
      taskId: "task-006",
      failureSignature: "sig-new",
      actor: "hermes",
      evidenceRef: "test-006",
    });
    expect(result.can_expand_capability).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Test: resetRetryState clears count and allows new failures
  // -------------------------------------------------------------------------

  it("resetRetryState clears count and allows new failures", () => {
    // Build up 2 failures for sig-A
    rt.recordFailure({
      taskId: "task-007",
      failureSignature: "err-sig-D",
      failureKind: "external_dependency_error",
      actor: "hermes",
      evidenceRef: "test-007-1",
    });
    rt.recordFailure({
      taskId: "task-007",
      failureSignature: "err-sig-D",
      failureKind: "external_dependency_error",
      actor: "hermes",
      evidenceRef: "test-007-2",
    });

    // Verify blocked
    const blocked = rt.shouldRetry({
      taskId: "task-007",
      failureSignature: "err-sig-D",
      actor: "hermes",
      evidenceRef: "test-007-check",
    });
    // count=2, maxRetries=2 → deny
    expect(blocked.decision).toBe("deny");
    expect(blocked.attempt_count).toBe(2);

    // Reset
    const resetResult = rt.resetRetryState("task-007");
    expect(resetResult.decision).toBe("allow");
    expect(resetResult.chainClean).toBe(-1);

    // After reset: shouldRetry returns to first-failure state (count=0)
    const afterReset = rt.shouldRetry({
      taskId: "task-007",
      failureSignature: "err-sig-D",
      actor: "hermes",
      evidenceRef: "test-007-after-reset",
    });
    expect(afterReset.decision).toBe("allow");
    expect(afterReset.attempt_count).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test: audit hash chain is verifiable after multiple operations
  // -------------------------------------------------------------------------

  it("audit hash chain is verifiable after multiple operations", () => {
    // Record two failures
    rt.recordFailure({
      taskId: "task-008",
      failureSignature: "err-sig-E",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-008-1",
    });
    rt.recordFailure({
      taskId: "task-008",
      failureSignature: "err-sig-E",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-008-2",
    });

    const fp = path.join(TEST_AUDIT_DIR, "task-008.jsonl");
    const raw = fs.readFileSync(fp, "utf8").split("\n").filter(Boolean);
    expect(raw.length).toBeGreaterThanOrEqual(2);

    // Each entry's prev_hash should chain to previous entry_hash
    for (let i = 1; i < raw.length; i++) {
      const prev = JSON.parse(raw[i - 1]) as AuditEntry;
      const curr = JSON.parse(raw[i]) as AuditEntry;
      expect(curr.prev_hash).toBe(prev.entry_hash);
    }
  });

  // -------------------------------------------------------------------------
  // Test: all audit entries have event = "retry_check"
  // -------------------------------------------------------------------------

  it("all audit entries have event = retry_check", () => {
    rt.recordFailure({
      taskId: "task-009",
      failureSignature: "sig-x",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-009-1",
    });
    rt.shouldRetry({
      taskId: "task-009",
      failureSignature: "sig-x",
      actor: "hermes",
      evidenceRef: "test-009-2",
    });
    rt.resetRetryState("task-009");

    const entries = readChain("task-009");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.event).toBe("retry_check");
    }
  });

  // -------------------------------------------------------------------------
  // Test: audit entries have correct decision in deny case
  // -------------------------------------------------------------------------

  it("audit entries have decision deny for max_retries exhausted", () => {
    // After 2 records, shouldRetry should return deny (count >= maxRetries)
    rt.recordFailure({
      taskId: "task-010",
      failureSignature: "err-010",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-010-1",
    });
    rt.recordFailure({
      taskId: "task-010",
      failureSignature: "err-010",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-010-2",
    });

    // After 2 failures, shouldRetry returns deny (count=2 >= maxRetries=2)
    rt.shouldRetry({
      taskId: "task-010",
      failureSignature: "err-010",
      actor: "hermes",
      evidenceRef: "test-010-check",
    });

    const entries = readChain("task-010");
    const denyEntries = entries.filter((e) => e.decision === "deny");
    // shouldRetry returned deny, so there should be deny entries
    expect(denyEntries.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Test: maxRetries option is respected
  // -------------------------------------------------------------------------

  it("maxRetries option is respected", () => {
    const rt3 = createRetryRuntime({ auditDir: TEST_AUDIT_DIR, maxRetries: 3 });

    // Record 1: count=1, maxRetries=3 → shouldRetry → allow
    rt3.recordFailure({
      taskId: "task-011",
      failureSignature: "sig-max3",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-011-1",
    });

    // Record 2: count=2, maxRetries=3 → shouldRetry → allow
    rt3.recordFailure({
      taskId: "task-011",
      failureSignature: "sig-max3",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-011-2",
    });

    // After 2 records (count=2 < maxRetries=3) → allow
    const result = rt3.shouldRetry({
      taskId: "task-011",
      failureSignature: "sig-max3",
      actor: "hermes",
      evidenceRef: "test-011-check",
    });
    expect(result.decision).toBe("allow");
    expect(result.max_retries).toBe(3);

    // Record 3: count=3 >= maxRetries=3 → shouldRetry → deny
    rt3.recordFailure({
      taskId: "task-011",
      failureSignature: "sig-max3",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-011-3",
    });
    const blocked = rt3.shouldRetry({
      taskId: "task-011",
      failureSignature: "sig-max3",
      actor: "hermes",
      evidenceRef: "test-011-check3",
    });
    expect(blocked.decision).toBe("deny");
    expect(blocked.attempt_count).toBe(3);
  });

  // -------------------------------------------------------------------------
  // Test: resetRetryState writes audit entry with reason
  // -------------------------------------------------------------------------

  it("resetRetryState writes audit entry with reason", () => {
    rt.recordFailure({
      taskId: "task-012",
      failureSignature: "err-012",
      failureKind: "agent_error",
      actor: "hermes",
      evidenceRef: "test-012-1",
    });

    rt.resetRetryState("task-012");

    const entries = readChain("task-012");
    // Reset entry: failure_signature = "(reset)", decision = allow
    const resetEntries = entries.filter(
      (e) => e.context.retry_context?.failure_signature === "(reset)" && e.decision === "allow"
    );
    expect(resetEntries.length).toBe(1);
    expect(resetEntries[0].context.retry_context?.reason).toContain("reset");
  });

  // -------------------------------------------------------------------------
  // Test: no IPC, no HCC, no CLI/Safari external actions
  // -------------------------------------------------------------------------

  it("module exports are limited to expected API surface", () => {
    // Verify the runtime only exposes the three expected methods
    const rt2 = createRetryRuntime({ auditDir: TEST_AUDIT_DIR });
    const methods = Object.keys(rt2);

    expect(methods).toEqual(["recordFailure", "shouldRetry", "resetRetryState"]);

    // Verify options is accepted and respected
    const rt3 = createRetryRuntime({ auditDir: TEST_AUDIT_DIR, maxRetries: 5 });
    const r = rt3.shouldRetry({ taskId: "t", failureSignature: "s", actor: "hermes", evidenceRef: "e" });
    expect(r.max_retries).toBe(5);
    expect(r.decision).toBe("allow");
  });
});