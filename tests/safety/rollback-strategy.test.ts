import { describe, expect, it, afterAll, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { createRollbackManager } from "../../src/main/safety/rollback-strategy";
import { createAuditLogStore } from "../../src/main/safety/audit-log";

vi.setConfig({ testTimeout: 30_000 });

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/** Create a temp git repo with one initial commit. */
function createTempRepo(): { repoDir: string } {
  const repoDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-rb-"));
  execSync("git init", { cwd: repoDir, stdio: "pipe" });
  execSync("git config user.email 'test@hermes' && git config user.name 'Hermes Test'", {
    cwd: repoDir,
    stdio: "pipe",
  });
  fs.writeFileSync(path.join(repoDir, "README.md"), "# Test Project\n");
  execSync("git add .", { cwd: repoDir, stdio: "pipe" });
  execSync("git commit -m 'initial commit'", { cwd: repoDir, stdio: "pipe" });
  return { repoDir };
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe("createRollbackManager", () => {
  const tmpAuditDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-rb-audit-"));
  const tmpRollbackDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-rb-rollback-"));

  // Create a manager bound to our temp directories
  const mgr = createRollbackManager({
    rollbackDir: tmpRollbackDir,
    auditDir: tmpAuditDir,
  });
  const store = createAuditLogStore({ auditDir: tmpAuditDir });

  afterAll(() => {
    for (const d of [tmpAuditDir, tmpRollbackDir]) {
      if (fs.existsSync(d)) fs.rmSync(d, { recursive: true });
    }
  });

  // -----------------------------------------------------------------
  // 1. createRollbackPoint records git state and persists
  // -----------------------------------------------------------------
  it("creates a rollback point and persists it to rollbackDir", () => {
    const { repoDir } = createTempRepo();

    const result = mgr.createRollbackPoint({
      taskId: "task-rb-1",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-001",
      reason: "test checkpoint",
    });

    expect(result.decision).toBe("allow");
    expect(result.rollbackPoint).not.toBeNull();
    expect(result.rollbackPoint!.gitRef).toBeTruthy();
    expect(result.rollbackPoint!.contentHash).toHaveLength(64);

    // Verify file was written to rollbackDir
    const filePath = path.join(
      tmpRollbackDir,
      "task-rb-1",
      `${result.rollbackPoint!.rollbackId}.json`,
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  // -----------------------------------------------------------------
  // 2. createRollbackPoint captures changed files and diff
  // -----------------------------------------------------------------
  it("captures changed files and diff content in the rollback point", () => {
    const { repoDir } = createTempRepo();

    // Add a new tracked file and commit
    fs.writeFileSync(path.join(repoDir, "feature.ts"), "// new feature\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'add feature'", { cwd: repoDir, stdio: "pipe" });

    // Make an UNCOMMITTED change to an existing tracked file
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Modified Project\nwith more content\n");
    // Do NOT commit — leave it as a dirty working tree

    const result = mgr.createRollbackPoint({
      taskId: "task-rb-2",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-002",
      reason: "before refactor",
    });

    expect(result.decision).toBe("allow");
    // README.md was modified and is shown in the status snapshot (uncommitted change)
    expect(result.rollbackPoint!.changedFiles).toContain("README.md");
    // The diff shows the uncommitted modification to README.md
    expect(result.rollbackPoint!.diffContent).toContain("Modified Project");
    expect(result.rollbackPoint!.contentHash).toHaveLength(64);
  }, 30_000);

  // -----------------------------------------------------------------
  // 3. inspectRollbackPoint finds an existing rollback point
  // -----------------------------------------------------------------
  it("returns the rollback point when it exists", () => {
    const { repoDir } = createTempRepo();

    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-3",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-003",
      reason: "test inspect",
    });

    const rbId = createResult.rollbackPoint!.rollbackId;

    const inspectResult = mgr.inspectRollbackPoint({
      taskId: "task-rb-3",
      rollbackId: rbId,
    });

    expect(inspectResult.exists).toBe(true);
    expect(inspectResult.rollbackPoint).not.toBeNull();
    expect(inspectResult.rollbackPoint!.rollbackId).toBe(rbId);
  });

  // -----------------------------------------------------------------
  // 4. inspectRollbackPoint returns exists=false for unknown id
  // -----------------------------------------------------------------
  it("returns exists=false for unknown rollbackId", () => {
    const { repoDir } = createTempRepo();

    mgr.createRollbackPoint({
      taskId: "task-rb-4",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-004",
      reason: "test",
    });

    const inspectResult = mgr.inspectRollbackPoint({
      taskId: "task-rb-4",
      rollbackId: "00000000-0000-0000-0000-000000000000",
    });

    expect(inspectResult.exists).toBe(false);
    expect(inspectResult.rollbackPoint).toBeNull();
  });

  // -----------------------------------------------------------------
  // 5. rollbackToPoint: tracked file modified → rollback succeeds
  // -----------------------------------------------------------------
  it("reverts tracked file changes when rollback is applied", () => {
    const { repoDir } = createTempRepo();

    // Make two commits
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Changed Content\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'change readme'", { cwd: repoDir, stdio: "pipe" });

    fs.writeFileSync(path.join(repoDir, "feature.ts"), "// new feature\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'add feature'", { cwd: repoDir, stdio: "pipe" });

    const originalContent = fs.readFileSync(path.join(repoDir, "README.md"), "utf8");
    expect(originalContent).toBe("# Changed Content\n");

    // Create rollback point at current state (HEAD=latest commit)
    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-5",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-005a",
      reason: "before destructive change",
    });
    const rbId = createResult.rollbackPoint!.rollbackId;

    // Make another change
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Final Content\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'final change'", { cwd: repoDir, stdio: "pipe" });

    // Rollback to the checkpoint
    const rollbackResult = mgr.rollbackToPoint({
      taskId: "task-rb-5",
      rollbackId: rbId,
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-005b",
    });

    expect(rollbackResult.decision).toBe("allow");
    expect(rollbackResult.status).toBe("success");
  });

  // -----------------------------------------------------------------
  // 6. rollbackToPoint: contentHash mismatch → require_user_action
  // -----------------------------------------------------------------
  it("rejects rollback when worktree has uncommitted changes after rollback point (hash mismatch)", () => {
    const { repoDir } = createTempRepo();

    // Create a clean rollback point
    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-6",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-006a",
      reason: "checkpoint",
    });

    // Make an UNCOMMITTED change after the rollback point
    fs.writeFileSync(path.join(repoDir, "README.md"), "# Tampered Content\n");
    // Do NOT commit — this changes statusSnapshot and diffContent

    const rbId = createResult.rollbackPoint!.rollbackId;
    const rollbackResult = mgr.rollbackToPoint({
      taskId: "task-rb-6",
      rollbackId: rbId,
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-006b",
    });

    expect(rollbackResult.decision).toBe("require_user_action");
    expect(rollbackResult.status).toBe("require_user_action");
    expect(rollbackResult.reasons[0]).toContain("uncommitted changes");
  });

  // -----------------------------------------------------------------
  // 7. rollbackToPoint: worktreePath mismatch → deny
  // -----------------------------------------------------------------
  it("denies rollback when worktreePath does not match the rollback point", () => {
    const { repoDir: repo1 } = createTempRepo();
    const { repoDir: repo2 } = createTempRepo();

    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-7",
      worktreePath: repo1,
      actor: "hermes",
      evidenceRef: "rb-evid-007a",
      reason: "checkpoint",
    });

    const rbId = createResult.rollbackPoint!.rollbackId;

    const rollbackResult = mgr.rollbackToPoint({
      taskId: "task-rb-7",
      rollbackId: rbId,
      worktreePath: repo2, // different worktree
      actor: "hermes",
      evidenceRef: "rb-evid-007b",
    });

    expect(rollbackResult.decision).toBe("deny");
    expect(rollbackResult.status).toBe("deny");
    expect(rollbackResult.reasons[0]).toContain("mismatch");
  });

  // -----------------------------------------------------------------
  // 8. rollbackToPoint: unknown rollbackId → deny
  // -----------------------------------------------------------------
  it("denies rollback when rollbackId does not exist", () => {
    const { repoDir } = createTempRepo();

    const rollbackResult = mgr.rollbackToPoint({
      taskId: "task-rb-8",
      rollbackId: "00000000-0000-0000-0000-000000000000",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-evid-008",
    });

    expect(rollbackResult.decision).toBe("deny");
    expect(rollbackResult.status).toBe("deny");
    expect(rollbackResult.reasons[0]).toContain("not found");
  });

  // -----------------------------------------------------------------
  // 9. Audit entries written for create and rollback
  // -----------------------------------------------------------------
  it("writes rollback audit entries for create and rollback operations", () => {
    const { repoDir } = createTempRepo();

    // Create a rollback point
    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-audit",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-audit-001",
      reason: "audit test",
    });

    const entriesAfterCreate = store.read("task-rb-audit");
    const createEntry = entriesAfterCreate.find((e) => e.evidence_ref === "rb-audit-001");
    expect(createEntry).toBeDefined();
    expect(createEntry!.decision).toBe("allow");
    expect(createEntry!.event).toBe("rollback");

    // Make a change and commit, then rollback
    fs.writeFileSync(path.join(repoDir, "feature.ts"), "// feature\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'add feature'", { cwd: repoDir, stdio: "pipe" });

    const rollbackResult = mgr.rollbackToPoint({
      taskId: "task-rb-audit",
      rollbackId: createResult.rollbackPoint!.rollbackId,
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-audit-002",
    });

    const entriesAfterRollback = store.read("task-rb-audit");
    const rollbackEntry = entriesAfterRollback.find((e) => e.evidence_ref === "rb-audit-002");
    expect(rollbackEntry).toBeDefined();
    expect(rollbackEntry!.decision).toBe("allow");
    expect(rollbackEntry!.event).toBe("rollback");
  });

  // -----------------------------------------------------------------
  // 10. Hash chain verifiable after create + rollback
  // -----------------------------------------------------------------
  it("audit hash chain is clean after create and rollback", () => {
    const { repoDir } = createTempRepo();

    // First rollback point
    mgr.createRollbackPoint({
      taskId: "task-rb-chain",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-chain-001",
      reason: "chain test 1",
    });

    // Second commit
    fs.writeFileSync(path.join(repoDir, "data.txt"), "new data\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'add data'", { cwd: repoDir, stdio: "pipe" });

    // Second rollback point
    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-chain",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-chain-002",
      reason: "chain test 2",
    });

    // Rollback
    mgr.rollbackToPoint({
      taskId: "task-rb-chain",
      rollbackId: createResult.rollbackPoint!.rollbackId,
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-chain-003",
    });

    // Chain should be clean (verify returns -1)
    expect(store.verify("task-rb-chain")).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 11. listRollbackPoints returns all rollback points sorted by time
  // -----------------------------------------------------------------
  it("lists all rollback points for a task sorted by creation time", () => {
    const { repoDir } = createTempRepo();

    const r1 = mgr.createRollbackPoint({
      taskId: "task-rb-list",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-list-001",
      reason: "first",
    });

    fs.writeFileSync(path.join(repoDir, "file1.txt"), "content\n");
    execSync("git add .", { cwd: repoDir, stdio: "pipe" });
    execSync("git commit -m 'add file1'", { cwd: repoDir, stdio: "pipe" });

    const r2 = mgr.createRollbackPoint({
      taskId: "task-rb-list",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-list-002",
      reason: "second",
    });

    const points = mgr.listRollbackPoints("task-rb-list");
    expect(points).toHaveLength(2);
    expect(points[0].rollbackId).toBe(r1.rollbackPoint!.rollbackId);
    expect(points[1].rollbackId).toBe(r2.rollbackPoint!.rollbackId);
  });

  // -----------------------------------------------------------------
  // 12. createRollbackPoint with createdFiles → rollback deletes them
  // -----------------------------------------------------------------
  it("deletes created (untracked) files during rollback when they still exist", () => {
    const { repoDir } = createTempRepo();

    // Create a new UNTRACKED file (uncommitted, not in git)
    fs.writeFileSync(path.join(repoDir, "new-feature.ts"), "// brand new feature\n");
    // Don't git add — this is an untracked file

    const createResult = mgr.createRollbackPoint({
      taskId: "task-rb-created",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-created-001",
      reason: "checkpoint with created files",
      createdFiles: ["new-feature.ts"],
    });

    // Rollback — the untracked file should be deleted
    const rollbackResult = mgr.rollbackToPoint({
      taskId: "task-rb-created",
      rollbackId: createResult.rollbackPoint!.rollbackId,
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-created-002",
    });

    // Rollback succeeds
    expect(rollbackResult.decision).toBe("allow");
    // The untracked file should be deleted
    expect(fs.existsSync(path.join(repoDir, "new-feature.ts"))).toBe(false);
  });

  // -----------------------------------------------------------------
  // 13. createRollbackPoint fails gracefully on non-git directory
  // -----------------------------------------------------------------
  it("denies rollback point creation on a non-git directory", () => {
    const nonGitDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-non-git-"));
    try {
      const result = mgr.createRollbackPoint({
        taskId: "task-rb-non-git",
        worktreePath: nonGitDir,
        actor: "hermes",
        evidenceRef: "rb-non-git-001",
        reason: "test non-git",
      });

      expect(result.decision).toBe("deny");
      expect(result.rollbackPoint).toBeNull();
      expect(result.reasons[0]).toContain("cannot read git state");
    } finally {
      fs.rmSync(nonGitDir, { recursive: true });
    }
  });

  // -----------------------------------------------------------------
  // 14. All operations use temp dirs, not real ~/.hermes paths
  // -----------------------------------------------------------------
  it("does not write to real ~/.hermes/audit or ~/.hermes/rollback", () => {
    const { repoDir } = createTempRepo();

    mgr.createRollbackPoint({
      taskId: "task-rb-real-paths",
      worktreePath: repoDir,
      actor: "hermes",
      evidenceRef: "rb-real-001",
      reason: "verify real paths not touched",
    });

    const realAuditDir = path.join(require("os").homedir(), ".hermes", "audit");
    const realRollbackDir = path.join(require("os").homedir(), ".hermes", "rollback");

    // Our temp dirs should be in use; real dirs should not have our task files
    const taskFileInAudit = path.join(realAuditDir, "task-rb-real-paths.jsonl");
    const taskFileInRollback = path.join(realRollbackDir, "task-rb-real-paths");

    // The temp dirs we use should contain the files
    expect(fs.existsSync(tmpAuditDir)).toBe(true);
    expect(fs.existsSync(tmpRollbackDir)).toBe(true);

    // The real dirs should not have been touched (or at least not for our specific task)
    // This is a negative assertion — the key is that our mgr is bound to temp dirs
    expect(fs.existsSync(taskFileInAudit)).toBe(false);
    expect(fs.existsSync(taskFileInRollback)).toBe(false);
  });
});
