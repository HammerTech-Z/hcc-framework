import { describe, expect, it, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createAuditLogStore } from "../../src/main/safety/audit-log";
import { createResourceLeaseManager } from "../../src/main/safety/resource-lease";

describe("createResourceLeaseManager", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "hermes-rl-test-"),
  );
  const store = createAuditLogStore({ auditDir: tmpDir });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // -----------------------------------------------------------------
  // 1. Same worktree, first acquire → allow, lease granted
  // -----------------------------------------------------------------
  it("grants lease on first acquire for a resourceId", () => {
    const mgr = createResourceLeaseManager();
    const result = mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-001",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.lease).not.toBeNull();
    expect(result.lease!.taskId).toBe("task-a");
    expect(result.lease!.resourceType).toBe("worktree");
    expect(result.lease!.resourceId).toBe("/projects/hermes");
    expect(result.lease!.priority).toBe("interactive");
    expect(result.lease!.expiresAt).toBeGreaterThan(Date.now());
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 2. Same worktree, second acquire (same priority) → deny
  // -----------------------------------------------------------------
  it("denies second acquire when same resourceId already held at same priority", () => {
    const mgr = createResourceLeaseManager();
    // First acquire
    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-002a",
      auditDir: tmpDir,
    });

    // Second acquire, same priority
    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-002b",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.lease).toBeNull();
    expect(result.reasons[0]).toContain("task-a");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 3. Same worktree, lower-priority acquire → deny
  // -----------------------------------------------------------------
  it("denies cron acquire when interactive lease already held", () => {
    const mgr = createResourceLeaseManager();
    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-003a",
      auditDir: tmpDir,
    });

    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "cron",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-003b",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.lease).toBeNull();
    expect(result.reasons[0]).toContain("interactive");
    expect(result.chainClean).toBe(-1);
  });

  it("denies background acquire when cron lease already held", () => {
    const mgr = createResourceLeaseManager();
    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "cron",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-003c",
      auditDir: tmpDir,
    });

    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "worktree",
      resourceId: "/projects/hermes",
      priority: "background",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-003d",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons[0]).toContain("cron");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 4. Different resourceId — parallel leases allowed
  // -----------------------------------------------------------------
  it("allows parallel leases on different resourceIds", () => {
    const mgr = createResourceLeaseManager();

    const r1 = mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/alice",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-004a",
      auditDir: tmpDir,
    });

    const r2 = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "worktree",
      resourceId: "/projects/bob",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-004b",
      auditDir: tmpDir,
    });

    expect(r1.decision).toBe("allow");
    expect(r2.decision).toBe("allow");
    expect(r1.lease!.resourceId).toBe("/projects/alice");
    expect(r2.lease!.resourceId).toBe("/projects/bob");
    expect(mgr.getActiveLeases()).toHaveLength(2);
  });

  // -----------------------------------------------------------------
  // 5. Interactive preempts cron
  // -----------------------------------------------------------------
  it("allows interactive to preempt a cron lease", () => {
    const mgr = createResourceLeaseManager();

    // task-a holds cron lease
    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "gateway",
      resourceId: "gw-01",
      priority: "cron",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-005a",
      auditDir: tmpDir,
    });

    // task-b takes it with interactive
    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "gateway",
      resourceId: "gw-01",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-005b",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.lease!.taskId).toBe("task-b");
    expect(result.reasons[0]).toContain("preempts");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 6. cron cannot preempt interactive
  // -----------------------------------------------------------------
  it("denies cron from preempting an interactive lease", () => {
    const mgr = createResourceLeaseManager();

    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "gateway",
      resourceId: "gw-02",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-006a",
      auditDir: tmpDir,
    });

    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "gateway",
      resourceId: "gw-02",
      priority: "cron",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-006b",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons[0]).toContain("interactive");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 7. Expired lease can be taken over
  // -----------------------------------------------------------------
  it("allows new acquire after existing lease expires", async () => {
    const mgr = createResourceLeaseManager();

    // Acquire with 10ms TTL
    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/expires",
      priority: "interactive",
      ttlMs: 10,
      actor: "hermes",
      evidenceRef: "rl-evid-007a",
      auditDir: tmpDir,
    });

    // Wait for expiry
    await new Promise((r) => setTimeout(r, 20));

    // Should succeed
    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "worktree",
      resourceId: "/projects/expires",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-007b",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.lease!.taskId).toBe("task-b");
    expect(mgr.getActiveLeases()).toHaveLength(1);
  });

  // -----------------------------------------------------------------
  // 8. Release: correct task → allow, lease removed
  // -----------------------------------------------------------------
  it("releases lease when called by the holding task", () => {
    const mgr = createResourceLeaseManager();

    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/release-test",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-008a",
      auditDir: tmpDir,
    });

    const releaseResult = mgr.releaseLease({
      taskId: "task-a",
      resourceId: "/projects/release-test",
      actor: "hermes",
      evidenceRef: "rl-evid-008b",
      auditDir: tmpDir,
    });

    expect(releaseResult.decision).toBe("allow");
    expect(releaseResult.released).toBe(true);
    expect(mgr.getActiveLeases()).toHaveLength(0);
    expect(releaseResult.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 9. Release: wrong task → deny
  // -----------------------------------------------------------------
  it("denies release from a task that does not hold the lease", () => {
    const mgr = createResourceLeaseManager();

    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/release-test-2",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-009a",
      auditDir: tmpDir,
    });

    const result = mgr.releaseLease({
      taskId: "task-b",
      resourceId: "/projects/release-test-2",
      actor: "hermes",
      evidenceRef: "rl-evid-009b",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.released).toBe(false);
    expect(result.reasons[0]).toContain("task-a");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 10. Release then re-acquire
  // -----------------------------------------------------------------
  it("allows re-acquire after release", () => {
    const mgr = createResourceLeaseManager();

    mgr.acquireLease({
      taskId: "task-a",
      resourceType: "worktree",
      resourceId: "/projects/reacquire",
      priority: "background",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-010a",
      auditDir: tmpDir,
    });

    mgr.releaseLease({
      taskId: "task-a",
      resourceId: "/projects/reacquire",
      actor: "hermes",
      evidenceRef: "rl-evid-010b",
      auditDir: tmpDir,
    });

    const result = mgr.acquireLease({
      taskId: "task-b",
      resourceType: "worktree",
      resourceId: "/projects/reacquire",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-010c",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.lease!.taskId).toBe("task-b");
    expect(mgr.getActiveLeases()).toHaveLength(1);
  });

  // -----------------------------------------------------------------
  // 11. Audit entries written for each operation
  // -----------------------------------------------------------------
  it("writes resource_lease audit entries for acquire, deny, and release", () => {
    const mgr = createResourceLeaseManager();

    // Allow
    mgr.acquireLease({
      taskId: "task-audit-1",
      resourceType: "browser",
      resourceId: "browser-safari",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-011a",
      auditDir: tmpDir,
    });

    // Deny (same resource)
    mgr.acquireLease({
      taskId: "task-audit-2",
      resourceType: "browser",
      resourceId: "browser-safari",
      priority: "background",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-evid-011b",
      auditDir: tmpDir,
    });

    // Release
    mgr.releaseLease({
      taskId: "task-audit-1",
      resourceId: "browser-safari",
      actor: "hermes",
      evidenceRef: "rl-evid-011c",
      auditDir: tmpDir,
    });

    const entriesTask1 = store.read("task-audit-1");
    const entriesTask2 = store.read("task-audit-2");
    const allowEntry = entriesTask1.find(
      (e) => e.evidence_ref === "rl-evid-011a",
    );
    const denyEntry = entriesTask2.find(
      (e) => e.evidence_ref === "rl-evid-011b",
    );
    const releaseEntry = entriesTask1.find(
      (e) => e.evidence_ref === "rl-evid-011c",
    );

    expect(allowEntry).toBeDefined();
    expect(allowEntry!.decision).toBe("allow");
    expect(allowEntry!.context.resource_type).toBe("browser");
    expect(allowEntry!.context.priority).toBe("interactive");
    expect(allowEntry!.context.existing_lease).toBeNull();

    expect(denyEntry).toBeDefined();
    expect(denyEntry!.decision).toBe("deny");
    expect(denyEntry!.context.existing_lease).not.toBeNull();

    expect(releaseEntry).toBeDefined();
    expect(releaseEntry!.decision).toBe("allow");
    // existing_lease shows the released lease (not null, since we just released it)
    expect(releaseEntry!.context.existing_lease).not.toBeNull();
  });

  // -----------------------------------------------------------------
  // 12. Hash chain verifiable after all operations
  // -----------------------------------------------------------------
  it("hash chain is clean after multiple lease operations", () => {
    const mgr = createResourceLeaseManager();

    mgr.acquireLease({
      taskId: "task-chain",
      resourceType: "local_llm",
      resourceId: "llm-01",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-chain-001",
      auditDir: tmpDir,
    });

    mgr.acquireLease({
      taskId: "task-chain",
      resourceType: "local_llm",
      resourceId: "llm-02",
      priority: "interactive",
      ttlMs: 60_000,
      actor: "hermes",
      evidenceRef: "rl-chain-002",
      auditDir: tmpDir,
    });

    mgr.releaseLease({
      taskId: "task-chain",
      resourceId: "llm-01",
      actor: "hermes",
      evidenceRef: "rl-chain-003",
      auditDir: tmpDir,
    });

    expect(store.verify("task-chain")).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 13. getActiveLeases only returns non-expired leases
  // -----------------------------------------------------------------
  it("getActiveLeases excludes expired leases", async () => {
    const mgr = createResourceLeaseManager();

    mgr.acquireLease({
      taskId: "task-active",
      resourceType: "worktree",
      resourceId: "/projects/active-lease",
      priority: "interactive",
      ttlMs: 10,
      actor: "hermes",
      evidenceRef: "rl-evid-013a",
      auditDir: tmpDir,
    });

    mgr.acquireLease({
      taskId: "task-perm",
      resourceType: "worktree",
      resourceId: "/projects/perm-lease",
      priority: "interactive",
      ttlMs: 999_999_999,
      actor: "hermes",
      evidenceRef: "rl-evid-013b",
      auditDir: tmpDir,
    });

    // Wait for expiry of the first one
    await new Promise((r) => setTimeout(r, 20));

    const active = mgr.getActiveLeases();

    expect(active).toHaveLength(1);
    expect(active[0].resourceId).toBe("/projects/perm-lease");
  });

  // -----------------------------------------------------------------
  // 14. All four resource types supported
  // -----------------------------------------------------------------
  it("supports worktree, local_llm, gateway, and browser resource types", () => {
    const mgr = createResourceLeaseManager();
    const types = ["worktree", "local_llm", "gateway", "browser"] as const;

    for (const rt of types) {
      const result = mgr.acquireLease({
        taskId: `task-${rt}`,
        resourceType: rt,
        resourceId: `${rt}-test-id`,
        priority: "interactive",
        ttlMs: 60_000,
        actor: "hermes",
        evidenceRef: `rl-evid-type-${rt}`,
        auditDir: tmpDir,
      });

      expect(result.decision).toBe("allow");
      expect(result.lease!.resourceType).toBe(rt);
    }

    expect(mgr.getActiveLeases()).toHaveLength(4);
  });
});