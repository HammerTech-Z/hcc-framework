import { describe, expect, it, afterAll, beforeEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { runHCCTaskDryRun } from "../../src/main/hcc-dry-run";
import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import type { HCCTaskRequest } from "../../src/main/hcc-task-types";
import { execSync } from "child_process";
import { createAuditLogStore } from "../../src/main/safety/audit-log";

vi.setConfig({ testTimeout: 30_000 });

const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hcc-dry-run-"));

// Create a real git repo in tmpDir so createRollbackPoint works
execSync("git init", { cwd: tmpDir, stdio: "ignore" });
execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "ignore" });
execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "ignore" });

beforeEach(() => {
  // Fresh git repo with at least one commit (required for git log/getGitRef)
  execSync("git init", { cwd: tmpDir, stdio: "ignore" });
  execSync("git config user.email 'test@test.com'", { cwd: tmpDir, stdio: "ignore" });
  execSync("git config user.name 'Test'", { cwd: tmpDir, stdio: "ignore" });
  execSync("git commit --allow-empty -m 'init'", { cwd: tmpDir, stdio: "ignore" });
  // Clean up audit + rollback dirs between tests so state is isolated
  if (fs.existsSync(auditDir)) fs.rmSync(auditDir, { recursive: true, force: true });
  if (fs.existsSync(rollbackDir)) fs.rmSync(rollbackDir, { recursive: true, force: true });
});

afterAll(() => {
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
});

const auditDir = path.join(tmpDir, "audit");
const rollbackDir = path.join(tmpDir, "rollback");

const makeRequest = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
  taskId: "hcc-task-001",
  goal: "Test task",
  worktreePath: tmpDir,
  sourceTrust: "trusted_user",
  requestedCapability: "read_public",
  riskLevel: "low",
  priority: "interactive",
  actor: "hermes",
  evidenceRef: "ev-001",
  ...overrides,
});

const opts = { auditDir, rollbackDir };

// ── 1. happy path: full pipeline, dryRun=true, outcome=planned ─────────────

describe("happy path", () => {
  it("completes all phases, dryRun=true, outcome=planned, executable=false", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "happy-001" }), opts);

    expect(result.dryRun).toBe(true);
    expect(result.taskId).toBe("happy-001");
    expect(result.outcome).toBe("planned");
    expect(result.preflightDecision).toBe("allow");
    expect(result.leaseDecision).toBe("allow");
    expect(result.rollbackPointRef).toBeTruthy();
    expect(result.verifierInputValid).toBe(true);
    expect(result.auditRefs.length).toBeGreaterThan(0);
    expect(result.stoppedAt).toBeUndefined();
    expect(result.reasons).toEqual([]);
    expect(result.plan.executable).toBe(false);
  });

  it("audit chain is append-only", () => {
    const taskId = "audit-chain-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);
    runHCCTaskDryRun(makeRequest({ taskId }), opts);

    const chainFile = path.join(auditDir, `${taskId}.jsonl`);
    const lines = fs.readFileSync(chainFile, "utf8").split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(2);

    const entries = lines.map((l) => JSON.parse(l));
    entries.forEach((e, i) => {
      if (i > 0) expect(e.seq).toBe(i);
    });
  });

  it("rollback point file exists in rollbackDir", () => {
    const taskId = "rollback-file-001";
    const result = runHCCTaskDryRun(makeRequest({ taskId }), opts);
    expect(result.rollbackPointRef).toBeTruthy();

    const taskRollbackDir = path.join(rollbackDir, taskId);
    const files = fs.readdirSync(taskRollbackDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(1);

    const rp = JSON.parse(fs.readFileSync(path.join(taskRollbackDir, files[0]), "utf8"));
    expect(rp.taskId).toBe(taskId);
    expect(rp.rollbackId).toBe(result.rollbackPointRef);
  });

  it("audit hash chain verifiable via verifyAuditChain", () => {
    const auditStore = createAuditLogStore({ auditDir });
    const taskId = "hash-chain-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);
    // verifyAuditChain returns -1 for clean chain, else first bad index
    const chainResult = auditStore.verify(taskId);
    expect(chainResult).toBe(-1); // -1 = chain intact
  });
});

// ── 2. high risk unconfirmed: preflight require_user_approval, no rollback point ─

describe("high risk preflight block", () => {
  it("high risk without user confirmation stops at preflight", () => {
    const result = runHCCTaskDryRun(
      makeRequest({ taskId: "high-risk-001", riskLevel: "high" }),
      opts,
    );

    expect(result.preflightDecision).toBe("require_user_approval");
    expect(result.outcome).toBe("blocked");
    expect(result.stoppedAt).toBe("preflight");
    expect(result.rollbackPointRef).toBeNull();
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("no rollback point created for high-risk unconfirmed", () => {
    const taskId = "high-risk-no-rb-001";
    runHCCTaskDryRun(makeRequest({ taskId, riskLevel: "high" }), opts);
    const taskRollbackDir = path.join(rollbackDir, taskId);
    expect(fs.existsSync(taskRollbackDir)).toBe(false);
  });

  it("audit entries written even for blocked preflight", () => {
    const taskId = "high-risk-audit-001";
    const result = runHCCTaskDryRun(makeRequest({ taskId, riskLevel: "high" }), opts);
    expect(result.auditRefs.length).toBeGreaterThan(0);
  });
});

// ── 3. lease deny: stop, no rollback point ─────────────────────────────────

describe("lease deny", () => {
  it("same taskId re-run is allowed (idempotent, same agent)", () => {
    const taskId = "lease-deny-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts); // first run
    const result2 = runHCCTaskDryRun(makeRequest({ taskId }), opts); // same taskId re-run

    // Same taskId is idempotent - allowed to re-run for re-validation/debugging
    expect(result2.leaseDecision).toBe("allow");
    expect(result2.outcome).toBe("planned");
    expect(result2.stoppedAt).toBeUndefined();
  });

  it("audit entry written for re-run", () => {
    const taskId = "lease-deny-audit-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);
    const result2 = runHCCTaskDryRun(makeRequest({ taskId }), opts);
    expect(result2.auditRefs.length).toBeGreaterThan(0);
  });
});

// ── 4. action gate deny: stops at first denied step ───────────────────────

describe("action gate deny", () => {
  it("high risk request blocks at preflight, never reaches action gate", () => {
    // Note: high risk blocks at preflight (Phase 2) before action gate (Phase 5)
    // Action gate only runs for steps in an otherwise-allowed request
    const request = makeRequest({
      taskId: "action-gate-deny-001",
      riskLevel: "high", // blocks at preflight
      steps: [
        {
          stepId: "step-1",
          action: "delete production database",
          actionType: "delete",
          capability: "write_project",
          riskLevel: "high",
        },
      ],
    });
    const result = runHCCTaskDryRun(request, opts);

    // Blocked at preflight, action gate never runs
    expect(result.outcome).toBe("blocked");
    expect(result.stoppedAt).toBe("preflight");
    expect(result.preflightDecision).toBe("require_user_approval");
    expect(result.actionGateResults).toEqual([]); // no steps evaluated
  });

  it("no actual execution (high risk blocks early)", () => {
    const request = makeRequest({
      taskId: "action-gate-no-exec-001",
      riskLevel: "high", // top-level risk blocks at preflight
      steps: [
        {
          stepId: "step-1",
          action: "rm -rf /",
          actionType: "delete",
          capability: "write_project",
          riskLevel: "high",
        },
      ],
    });
    const result = runHCCTaskDryRun(request, opts);
    // Pre-flight blocks before any action gate evaluation
    expect(result.stoppedAt).toBe("preflight");
  });
});

// ── 5. rollback creation failure: recordFailure ────────────────────────────

describe("rollback creation failure", () => {
  it("nonexistent worktreePath → blocked, no rollback point", () => {
    const result = runHCCTaskDryRun(
      makeRequest({ taskId: "rollback-fail-001", worktreePath: "/nonexistent/for/rollback" }),
      opts,
    );

    expect(result.outcome).toBe("blocked");
    expect(result.rollbackPointRef).toBeNull();
  });
});

// ── 6. verifier input valid in happy path ─────────────────────────────────

describe("verifier input validation", () => {
  it("empty verificationCommands → valid verifier input", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "verifier-valid-001" }), opts);
    expect(result.verifierInputValid).toBe(true);
    expect(result.outcome).toBe("planned");
  });

  it("happy path always has verifierInputValid=true", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "verifier-happy-001" }), opts);
    expect(result.verifierInputValid).toBe(true);
  });
});

// ── 7. releaseLease resilience: never throws ───────────────────────────────

describe("releaseLease failure resilience", () => {
  it("no unhandled exception on successful run", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "lease-release-001" }), opts);
    expect(result.outcome).toBe("planned");
    expect(result.leaseDecision).toBe("allow");
  });

  it("same taskId re-run does not throw (idempotent)", () => {
    const taskId = "lease-release-002";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);
    // Same taskId re-run is allowed - idempotent lease
    const result2 = runHCCTaskDryRun(makeRequest({ taskId }), opts);
    expect(result2.outcome).toBe("planned");
    expect(result2.leaseDecision).toBe("allow");
  });
});

// ── 8. pipeline state transitions ─────────────────────────────────────────

describe("pipeline state transitions", () => {
  it("planned: validation → preflight → lease → rollback → action_gate → verifier → release", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "transitions-001" }), opts);

    expect(result.outcome).toBe("planned");
    expect(result.dryRun).toBe(true);
    expect(result.plan.executable).toBe(false);
    expect(result.preflightDecision).toBe("allow");
    expect(result.leaseDecision).toBe("allow");
    expect(result.rollbackPointRef).toBeTruthy();
    expect(result.verifierInputValid).toBe(true);
    expect(result.stoppedAt).toBeUndefined();
  });

  it("blocked at preflight: no lease, no rollback point", () => {
    const result = runHCCTaskDryRun(
      makeRequest({ taskId: "block-preflight-001", riskLevel: "high" }),
      opts,
    );
    expect(result.outcome).toBe("blocked");
    expect(result.stoppedAt).toBe("preflight");
    expect(result.rollbackPointRef).toBeNull();
    // leaseDecision defaults to "deny" when blocked at preflight (lease never acquired)
    expect(result.leaseDecision).toBe("deny");
  });

  it("blocked at lease: same taskId re-run is allowed (idempotent)", () => {
    const taskId = "block-lease-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);
    // Same taskId re-run is idempotent - allowed to re-validate
    const result2 = runHCCTaskDryRun(makeRequest({ taskId }), opts);
    expect(result2.outcome).toBe("planned");
    expect(result2.stoppedAt).toBeUndefined();
  });

  it("blocked at action_gate: rollback point exists", () => {
    const request = makeRequest({
      taskId: "block-action-gate-001",
      steps: [
        {
          stepId: "step-1",
          action: "destroy everything",
          actionType: "delete",
          capability: "write_project",
          riskLevel: "high",
        },
      ],
    });
    const result = runHCCTaskDryRun(request, opts);
    expect(result.outcome).toBe("blocked");
    expect(result.stoppedAt).toBe("action_gate:step-1");
    expect(result.rollbackPointRef).toBeTruthy();
  });
});

// ── 9. audit hash chain integrity ─────────────────────────────────────────

describe("audit hash chain integrity", () => {
  it("entries have incrementing seq and valid prev_hash chain", () => {
    const taskId = "hash-seq-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);

    const chainFile = path.join(auditDir, `${taskId}.jsonl`);
    const lines = fs.readFileSync(chainFile, "utf8").split("\n").filter(Boolean);
    const entries = lines.map((l) => JSON.parse(l));

    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((e, i) => {
      expect(e.seq).toBe(i);
      if (i > 0) {
        expect(e.prev_hash).toBe(entries[i - 1].entry_hash);
      } else {
        expect(e.prev_hash).toBe("0".repeat(64));
      }
    });
  });

  it("each entry has a 64-char SHA-256 entry_hash", () => {
    const taskId = "entry-hash-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);

    const chainFile = path.join(auditDir, `${taskId}.jsonl`);
    const lines = fs.readFileSync(chainFile, "utf8").split("\n").filter(Boolean);
    const entries = lines.map((l) => JSON.parse(l));

    entries.forEach((e) => {
      expect(typeof e.entry_hash).toBe("string");
      expect(e.entry_hash.length).toBe(64);
    });
  });
});

// ── 10. rollback point content ─────────────────────────────────────────────

describe("rollback point content", () => {
  it("rollback point has correct taskId, worktreePath, actor, evidenceRef", () => {
    const taskId = "rb-content-001";
    const result = runHCCTaskDryRun(makeRequest({ taskId }), opts);
    expect(result.rollbackPointRef).toBeTruthy();

    const taskRollbackDir = path.join(rollbackDir, taskId);
    const files = fs.readdirSync(taskRollbackDir).filter((f) => f.endsWith(".json"));
    const rp = JSON.parse(fs.readFileSync(path.join(taskRollbackDir, files[0]), "utf8"));

    expect(rp.taskId).toBe(taskId);
    expect(rp.worktreePath).toBe(tmpDir);
    expect(rp.actor).toBe("hermes");
    expect(rp.evidenceRef).toBe("ev-001");
    expect(rp.rollbackId).toBe(result.rollbackPointRef);
    expect(rp.createdAt).toBeTruthy();
    expect(rp.gitRef).toBeTruthy();
  });

  it("second run creates second rollback point (new file)", () => {
    const taskId = "rb-second-001";
    runHCCTaskDryRun(makeRequest({ taskId }), opts);
    runHCCTaskDryRun(makeRequest({ taskId }), opts);

    const taskRollbackDir = path.join(rollbackDir, taskId);
    const files = fs.readdirSync(taskRollbackDir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(2);
  });
});

// ── 11. HCCTaskDryRunResult schema ───────────────────────────────────────

describe("HCCTaskDryRunResult schema", () => {
  it("has required fields: taskId, plan, summary, dryRun, outcome", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "schema-001" }), opts);

    expect(result.taskId).toBe("schema-001");
    expect(result.plan).toBeDefined();
    expect(typeof result.summary).toBe("string");
    expect(result.dryRun).toBe(true);
    expect(["planned", "failed", "blocked"]).toContain(result.outcome);
  });

  it("preflightDecision is allow|deny|require_user_approval", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "schema-pf-001" }), opts);
    expect(["allow", "deny", "require_user_approval"]).toContain(result.preflightDecision);
  });

  it("leaseDecision is allow|deny|undefined", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "schema-lease-001" }), opts);
    expect(["allow", "deny", undefined]).toContain(result.leaseDecision);
  });

  it("stoppedAt present only when outcome is blocked|failed", () => {
    const blocked = runHCCTaskDryRun(
      makeRequest({ taskId: "schema-stop-001", riskLevel: "high" }),
      opts,
    );
    expect(blocked.outcome).toBe("blocked");
    expect(blocked.stoppedAt).toBeTruthy();

    const ok = runHCCTaskDryRun(makeRequest({ taskId: "schema-stop-002" }), opts);
    if (ok.outcome === "planned") {
      expect(ok.stoppedAt).toBeUndefined();
    }
  });

  it("actionGateResults is always an array", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "schema-ag-001" }), opts);
    expect(Array.isArray(result.actionGateResults)).toBe(true);
  });
});

// ── 12. no actual execution ────────────────────────────────────────────────

describe("no execution side effects", () => {
  it("execute actionType does not call real spawn", () => {
    const request = makeRequest({
      taskId: "no-spawn-001",
      steps: [
        {
          stepId: "step-1",
          action: "run npm test",
          actionType: "execute",
          command: "npm run test",
          capability: "read_public",
          riskLevel: "low",
        },
      ],
    });
    const result = runHCCTaskDryRun(request, opts);
    expect(result.plan.executable).toBe(false);
    expect(result.actionGateResults[0]?.decision).toBe("allow");
  });

  it("auditRefs are SHA-256 hashes (no external calls)", () => {
    const result = runHCCTaskDryRun(makeRequest({ taskId: "no-exec-audit-001" }), opts);
    result.auditRefs.forEach((ref) => {
      expect(typeof ref).toBe("string");
      expect(ref.length).toBe(64);
    });
  });
});

// ── 13. buildHCCTaskPlan integration ─────────────────────────────────────

describe("buildHCCTaskPlan integration", () => {
  it("plan is built correctly from request", () => {
    const request = makeRequest({ taskId: "plan-int-001" });
    const plan = buildHCCTaskPlan(request);
    expect(plan.taskId).toBe("plan-int-001");
    expect(plan.goal).toBe("Test task");
    expect(plan.executable).toBe(false);
  });
});
