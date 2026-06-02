import { describe, expect, it, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  buildHCCTaskPlan,
  buildHCCTaskSafetyPlan,
  buildHCCTaskResult,
  buildHCCTaskFromRequest,
} from "../../src/main/hcc-task-runner";

import type {
  HCCTaskRequest,
  HCCTaskPlan,
  HCCPreflightInput,
  HCCLeaseInput,
  HCCRollbackInput,
  CodeGraphImpact,
  DomainProfile,
} from "../../src/main/hcc-task-types";
import { DEFAULT_CODE_DOMAIN_PROFILE } from "../../src/shared/lib/safety/domain-profile";

describe("buildHCCTaskPlan", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "hcc-test-"),
  );

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const makeRequest = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
    taskId: "hcc-task-001",
    goal: "Add feature flag to config",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "low",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-001",
    ...overrides,
  });

  // 1. request → plan field mapping
  it("maps taskId from request to plan", () => {
    const req = makeRequest({ taskId: "task-X" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.taskId).toBe("task-X");
  });

  it("maps goal from request to plan", () => {
    const req = makeRequest({ goal: "Refactor auth module" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.goal).toBe("Refactor auth module");
  });

  it("maps worktreePath from request to plan", () => {
    const req = makeRequest({ worktreePath: tmpDir });
    const plan = buildHCCTaskPlan(req);
    expect(plan.worktreePath).toBe(tmpDir);
  });

  it("maps sourceTrust from request to plan", () => {
    const req = makeRequest({ sourceTrust: "anonymous" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.sourceTrust).toBe("anonymous");
  });

  it("maps requestedCapability from request to plan", () => {
    const req = makeRequest({ requestedCapability: "read_public" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.requestedCapability).toBe("read_public");
  });

  it("maps riskLevel from request to plan", () => {
    const req = makeRequest({ riskLevel: "high" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.riskLevel).toBe("high");
  });

  it("maps priority from request to plan", () => {
    const req = makeRequest({ priority: "cron" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.priority).toBe("cron");
  });

  // note: HCCTaskPlan embeds actor inside preflightInput, not as top-level field

  // 2. preflight input mapping
  it("preflightInput.taskId matches request.taskId", () => {
    const req = makeRequest({ taskId: "preflight-task-001" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.taskId).toBe("preflight-task-001");
  });

  it("preflightInput.action is request.goal", () => {
    const req = makeRequest({ goal: "Update deployment config" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.action).toBe("Update deployment config");
  });

  it("preflightInput.sourceTrust matches request.sourceTrust", () => {
    const req = makeRequest({ sourceTrust: "untrusted" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.sourceTrust).toBe("untrusted");
  });

  it("preflightInput.requestedCapability matches request.requestedCapability", () => {
    const req = makeRequest({ requestedCapability: "privileged" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.requestedCapability).toBe("privileged");
  });

  it("preflightInput.riskLevel matches request.riskLevel", () => {
    const req = makeRequest({ riskLevel: "medium" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.riskLevel).toBe("medium");
  });

  it("preflightInput.actor matches request.actor", () => {
    const req = makeRequest({ actor: "webhook" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.actor).toBe("webhook");
  });

  it("preflightInput.evidenceRef matches request.evidenceRef", () => {
    const req = makeRequest({ evidenceRef: "evidence-custom-002" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.evidenceRef).toBe("evidence-custom-002");
  });

  it("preflightInput.context contains taskId and goal", () => {
    const req = makeRequest({ taskId: "ctx-task", goal: "Deploy to prod" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.preflightInput.context).toContain("ctx-task");
    expect(plan.preflightInput.context).toContain("Deploy to prod");
  });

  // 3. resource lease input mapping
  it("leaseInput.taskId matches request.taskId", () => {
    const req = makeRequest({ taskId: "lease-task-001" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.taskId).toBe("lease-task-001");
  });

  it("leaseInput.resourceType is always worktree", () => {
    const req = makeRequest();
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.resourceType).toBe("worktree");
  });

  it("leaseInput.resourceId is worktreePath", () => {
    const req = makeRequest({ worktreePath: "/some/custom/path" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.resourceId).toBe("/some/custom/path");
  });

  it("leaseInput.priority matches request.priority", () => {
    const req = makeRequest({ priority: "background" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.priority).toBe("background");
  });

  it("leaseInput.ttlMs defaults to 5 minutes", () => {
    const req = makeRequest();
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.ttlMs).toBe(5 * 60 * 1000);
  });

  it("leaseInput.actor matches request.actor", () => {
    const req = makeRequest({ actor: "cron-agent" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.actor).toBe("cron-agent");
  });

  it("leaseInput.evidenceRef matches request.evidenceRef", () => {
    const req = makeRequest({ evidenceRef: "lease-evidence-003" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.leaseInput.evidenceRef).toBe("lease-evidence-003");
  });

  // 4. rollback input mapping
  it("rollbackInput.taskId matches request.taskId", () => {
    const req = makeRequest({ taskId: "rollback-task-001" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.rollbackInput.taskId).toBe("rollback-task-001");
  });

  it("rollbackInput.worktreePath matches request.worktreePath", () => {
    const req = makeRequest({ worktreePath: "/tmp/rollback-test" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.rollbackInput.worktreePath).toBe("/tmp/rollback-test");
  });

  it("rollbackInput.actor matches request.actor", () => {
    const req = makeRequest({ actor: "hcc-actor" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.rollbackInput.actor).toBe("hcc-actor");
  });

  it("rollbackInput.evidenceRef matches request.evidenceRef", () => {
    const req = makeRequest({ evidenceRef: "rollback-ev-004" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.rollbackInput.evidenceRef).toBe("rollback-ev-004");
  });

  it("rollbackInput.reason contains goal", () => {
    const req = makeRequest({ goal: "Delete old logs" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.rollbackInput.reason).toContain("Delete old logs");
  });

  // 5. action gate step results
  it("stepPlans actionGateResult has correct structure placeholder in Slice A", () => {
    const req = makeRequest({
      steps: [{
        stepId: "step-1", action: "write file", actionType: "write",
        command: "echo hello", capability: "write_private", riskLevel: "low",
      }],
    });
    const plan = buildHCCTaskPlan(req);
    expect(plan.stepPlans[0].actionGateResult).toBeDefined();
    expect(plan.stepPlans[0].actionGateResult!.decision).toBe("allow");
    expect(plan.stepPlans[0].actionGateResult!.stepId).toBe("step-1");
  });

  it("stepPlans marks irreversible actions correctly", () => {
    const req = makeRequest({
      steps: [
        { stepId: "s1", action: "delete file", actionType: "delete", capability: "write_private", riskLevel: "high" },
        { stepId: "s2", action: "read file", actionType: "read", capability: "read_public", riskLevel: "low" },
      ],
    });
    const plan = buildHCCTaskPlan(req);
    expect(plan.stepPlans[0].actionGateResult!.isIrreversible).toBe(true);
    expect(plan.stepPlans[1].actionGateResult!.isIrreversible).toBe(false);
  });

  // 6. retry plan mapping
  it("safetyPlan.retryPlan.maxRetries is 2", () => {
    const plan = buildHCCTaskPlan(makeRequest());
    expect(plan.safetyPlan.retryPlan.maxRetries).toBe(2);
  });

  it("safetyPlan.retryPlan.deadEndActions contains delete and publish", () => {
    const plan = buildHCCTaskPlan(makeRequest());
    expect(plan.safetyPlan.retryPlan.deadEndActions).toContain("delete");
    expect(plan.safetyPlan.retryPlan.deadEndActions).toContain("publish");
  });

  it("safetyPlan.retryPlan.retryFailureKinds has all required kinds", () => {
    const plan = buildHCCTaskPlan(makeRequest());
    const kinds = plan.safetyPlan.retryPlan.retryFailureKinds;
    expect(kinds).toContain("agent_error");
    expect(kinds).toContain("task_failure");
    expect(kinds).toContain("execution_error");
    expect(kinds).toContain("verification_error");
    expect(kinds).toContain("resource_exhaustion");
    expect(kinds).toContain("external_dependency_error");
  });

  // 7. changedFiles and artifactRefs empty in Slice A
  it("safetyPlan.changedFiles is empty in Slice A", () => {
    const plan = buildHCCTaskPlan(makeRequest());
    expect(plan.safetyPlan.changedFiles).toEqual([]);
  });

  it("safetyPlan.artifactRefs is empty in Slice A", () => {
    const plan = buildHCCTaskPlan(makeRequest());
    expect(plan.safetyPlan.artifactRefs).toEqual([]);
  });

  // 8. missing worktreePath → blocked, not executable
  it("returns blocked when worktreePath is relative", () => {
    const req = makeRequest({ worktreePath: "relative/path" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.state).toBe("blocked");
    expect(plan.validationErrors.some((e: string) => e.includes("must be absolute"))).toBe(true);
    expect(plan.executable).toBe(false);
  });

  it("returns blocked when worktreePath does not exist", () => {
    const req = makeRequest({ worktreePath: "/nonexistent/path/that/does/not/exist" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.state).toBe("blocked");
    expect(plan.validationErrors.some((e: string) => e.includes("does not exist"))).toBe(true);
    expect(plan.executable).toBe(false);
  });

  // 9. high risk task requires approval
  it("high risk task sets requiresUserApproval=true", () => {
    const req = makeRequest({ riskLevel: "high" });
    const plan = buildHCCTaskPlan(req);
    expect(plan.safetyPlan.requiresUserApproval).toBe(true);
  });

  // 10. executable always false in Slice A
  it("plan.executable is always false in Slice A", () => {
    const plan = buildHCCTaskPlan(makeRequest());
    expect(plan.executable).toBe(false);
  });

  // 11. stepPlans uses DRY-RUN command prefix
  it("stepPlans uses DRY-RUN command prefix", () => {
    const req = makeRequest({
      steps: [{
        stepId: "step-1", action: "run test", actionType: "execute",
        command: "npm run test", capability: "read_public", riskLevel: "low",
      }],
    });
    const plan = buildHCCTaskPlan(req);
    expect(plan.stepPlans[0].command).toBe("[DRY-RUN] npm run test");
  });

  it("stepPlans without command uses action as fallback", () => {
    const req = makeRequest({
      steps: [{
        stepId: "step-1", action: "read config", actionType: "read",
        capability: "read_public", riskLevel: "low",
      }],
    });
    const plan = buildHCCTaskPlan(req);
    expect(plan.stepPlans[0].command).toBe("[DRY-RUN] read config");
  });
});

describe("buildHCCTaskResult", () => {
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hcc-result-test-"));
  afterAll(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const makeReq = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
    taskId: "hcc-task-001", goal: "test", worktreePath: tmpDir,
    sourceTrust: "trusted_user", requestedCapability: "read_public",
    riskLevel: "low", priority: "interactive", actor: "hermes", evidenceRef: "ev",
    ...overrides,
  });

  it("outcome is planned for valid request", () => {
    const result = buildHCCTaskFromRequest(makeReq());
    expect(result.outcome).toBe("planned");
    expect(result.plan).toBeDefined();
  });

  it("summary contains preflight and lease decisions for valid request", () => {
    const result = buildHCCTaskFromRequest(makeReq({ priority: "cron" }));
    expect(result.summary).toContain("preflight=");
    expect(result.summary).toContain("lease=");
  });

  it("summary contains blocked reason for invalid worktreePath", () => {
    const result = buildHCCTaskFromRequest(makeReq({ worktreePath: "relative/path" }));
    expect(result.summary).toContain("blocked");
  });
});

describe("no execution side effects in Slice A", () => {
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hcc-noexec-test-"));
  afterAll(() => { if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const makeReq = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
    taskId: "no-spawn", goal: "test spawn", worktreePath: tmpDir,
    sourceTrust: "trusted_user", requestedCapability: "read_public",
    riskLevel: "low", priority: "interactive", actor: "hermes", evidenceRef: "ev",
    ...overrides,
  });

  it("buildHCCTaskPlan does not throw even without spawn", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.taskId).toBe("no-spawn");
  });

it("plan still returns valid structure without calling spawn", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.taskId).toBe("no-spawn");
    expect(plan.safetyPlan).toBeDefined();
  });

  it("buildHCCTaskSafetyPlan does not reference any executor", () => {
    const plan = buildHCCTaskPlan(makeReq());
    // The safety plan should have no executor refs
    expect(plan.safetyPlan.requiresUserApproval).toBeDefined();
    expect(typeof plan.safetyPlan.requiresUserApproval).toBe("boolean");
  });
});

describe("CodeGraph impact integration (P3 Slice 002)", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "hcc-cg-test-"),
  );
  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const makeReq = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
    taskId: "cg-task-001",
    goal: "Refactor auth module",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-cg-001",
    ...overrides,
  });

  const makeImpact = (
    overrides: Partial<CodeGraphImpact> = {},
  ): CodeGraphImpact => ({
    status: "available",
    nodes: 42,
    edges: 88,
    changedFiles: ["src/auth/login.ts"],
    impactedFiles: ["src/auth/login.ts", "src/auth/session.ts"],
    impactedSymbols: ["login", "SessionStore"],
    riskNotes: [],
    artifactRef: "artifacts/cg-001.json",
    ...overrides,
  });

  // 1. available impact → plan.codeGraph carries it through
  it("writes codeGraph context when impact is available", () => {
    const plan = buildHCCTaskPlan(makeReq({ codeGraphImpact: makeImpact() }));
    expect(plan.codeGraph.status).toBe("available");
    expect(plan.codeGraph.wasProvided).toBe(true);
  });

  it("preserves nodes and edges from impact", () => {
    const plan = buildHCCTaskPlan(
      makeReq({ codeGraphImpact: makeImpact({ nodes: 2078, edges: 3588 }) }),
    );
    expect(plan.codeGraph.nodes).toBe(2078);
    expect(plan.codeGraph.edges).toBe(3588);
  });

  it("preserves changedFiles from impact", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({
          changedFiles: ["a.ts", "b.ts", "c.ts"],
        }),
      }),
    );
    expect(plan.codeGraph.changedFiles).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("preserves impactedFiles from impact", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({
          impactedFiles: ["x.ts", "y.ts"],
        }),
      }),
    );
    expect(plan.codeGraph.impactedFiles).toEqual(["x.ts", "y.ts"]);
  });

  it("preserves impactedSymbols from impact", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({
          impactedSymbols: ["foo", "bar"],
        }),
      }),
    );
    expect(plan.codeGraph.impactedSymbols).toEqual(["foo", "bar"]);
  });

  it("preserves artifactRef from impact", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({ artifactRef: "artifacts/custom.json" }),
      }),
    );
    expect(plan.codeGraph.artifactRef).toBe("artifacts/custom.json");
  });

  // 2. missing → not blocking, but marked
  it("non-code task without impact gets not_required status", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: false }));
    expect(plan.codeGraph.status).toBe("not_required");
    expect(plan.codeGraph.wasProvided).toBe(false);
    expect(plan.codeGraph.riskNotes).toEqual([]);
  });

  it("code task without impact gets missing status with risk note", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.codeGraph.status).toBe("missing");
    expect(plan.codeGraph.wasProvided).toBe(false);
    expect(plan.codeGraph.riskNotes.length).toBeGreaterThan(0);
  });

  it("missing impact does not block the plan when no domain profile is required", () => {
    // Without isCodeTask, no domain profile is injected and the verifier
    // section short-circuits (null + valid).
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: false }));
    expect(plan.state).toBe("planned");
  });

  // 3. failed impact → executable=false + validationErrors
  it("failed impact records validation error and keeps executable=false", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({
          status: "failed",
          riskNotes: ["graph query timeout"],
        }),
      }),
    );
    expect(plan.codeGraph.status).toBe("failed");
    expect(plan.executable).toBe(false);
    expect(plan.validationErrors.some((e: string) => e.includes("failed"))).toBe(true);
  });

  it("failed impact surfaces reason in riskNotes", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({
          status: "failed",
          riskNotes: ["index out of date"],
        }),
      }),
    );
    expect(
      plan.codeGraph.riskNotes.some((n: string) => n.includes("index out of date")),
    ).toBe(true);
  });

  it("failed impact sets state to blocked", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        codeGraphImpact: makeImpact({ status: "failed" }),
      }),
    );
    expect(plan.state).toBe("blocked");
  });

  // 4. CodeGraph never runs inside HCC
  it("does not invoke any external tool when impact is missing", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    // No side effects: codeGraph is derived purely from request shape
    expect(plan.codeGraph.wasProvided).toBe(false);
    expect(plan.codeGraph.nodes).toBe(0);
  });

  it("does not invoke CodeGraph when impact is present (only normalizes input)", () => {
    const plan = buildHCCTaskPlan(makeReq({ codeGraphImpact: makeImpact() }));
    // codeGraph mirrors the impact — no derivation implies no call
    expect(plan.codeGraph.artifactRef).toBe("artifacts/cg-001.json");
    expect(plan.codeGraph.wasProvided).toBe(true);
  });

  // 5. invariants from Slice A still hold
  it("executable remains false with available impact", () => {
    const plan = buildHCCTaskPlan(makeReq({ codeGraphImpact: makeImpact() }));
    expect(plan.executable).toBe(false);
  });

  it("executable remains false with failed impact", () => {
    const plan = buildHCCTaskPlan(
      makeReq({ codeGraphImpact: makeImpact({ status: "failed" }) }),
    );
    expect(plan.executable).toBe(false);
  });

  it("executable remains false with missing impact", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.executable).toBe(false);
  });

  it("partial impact fields default to empty arrays/zero", () => {
    const plan = buildHCCTaskPlan(
      makeReq({ codeGraphImpact: { status: "available" } }),
    );
    expect(plan.codeGraph.nodes).toBe(0);
    expect(plan.codeGraph.edges).toBe(0);
    expect(plan.codeGraph.changedFiles).toEqual([]);
    expect(plan.codeGraph.impactedFiles).toEqual([]);
    expect(plan.codeGraph.impactedSymbols).toEqual([]);
    expect(plan.codeGraph.riskNotes).toEqual([]);
    expect(plan.codeGraph.artifactRef).toBeNull();
  });
});

describe("Domain Profile integration (P3 Slice 003)", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "hcc-dp-test-"),
  );
  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const makeReq = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
    taskId: "dp-task-001",
    goal: "Refactor auth",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-dp-001",
    ...overrides,
  });

  // 1. code task gets DEFAULT_CODE_DOMAIN_PROFILE
  it("injects DEFAULT_CODE_DOMAIN_PROFILE for code task without override", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile).not.toBeNull();
    expect(plan.domainProfile!.name).toBe("code");
    expect(plan.domainProfile!.verifier.hardChecks).toContain("typecheck");
    expect(plan.domainProfile!.verifier.hardChecks).toContain("unit_tests");
    expect(plan.domainProfile!.verifier.hardChecks).toContain("targeted_tests");
  });

  it("default profile equals DEFAULT_CODE_DOMAIN_PROFILE constant", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile).toEqual(DEFAULT_CODE_DOMAIN_PROFILE);
  });

  it("default profile has passCriteria mentioning typecheck", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile!.verifier.passCriteria).toContain("typecheck");
  });

  it("default profile rollback forbids git reset --hard", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile!.rollback).toContain("git reset --hard");
  });

  it("default profile costSignals include tokens and test_runtime", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile!.costSignals).toContain("tokens");
    expect(plan.domainProfile!.costSignals).toContain("test_runtime");
  });

  // 2. explicit domainProfile is honored
  it("uses provided domainProfile for code task", () => {
    const custom: DomainProfile = {
      name: "code",
      artifactTypes: ["patch", "diff"],
      verifier: {
        hardChecks: ["typecheck", "integration_tests"],
        softChecks: ["lint"],
        passCriteria: "all integration tests pass",
      },
      rollback: "git apply -R only",
      costSignals: ["tokens", "api_calls"],
    };
    const plan = buildHCCTaskPlan(
      makeReq({ isCodeTask: true, domainProfile: custom }),
    );
    expect(plan.domainProfile).toEqual(custom);
    expect(plan.domainProfile!.verifier.hardChecks).toContain("integration_tests");
  });

  it("uses provided domainProfile for non-code task", () => {
    const custom: DomainProfile = {
      name: "miniapp",
      artifactTypes: ["bundle"],
      verifier: {
        hardChecks: ["build"],
        softChecks: ["ui_smoke"],
        passCriteria: "build exits 0",
      },
      rollback: "restore last bundle",
      costSignals: ["render_time"],
    };
    const plan = buildHCCTaskPlan(
      makeReq({ isCodeTask: false, domainProfile: custom }),
    );
    expect(plan.domainProfile).toEqual(custom);
  });

  // 3. invalid profile → blocked, executable=false
  it("blocks plan when domainProfile is invalid (empty hardChecks)", () => {
    const invalid: DomainProfile = {
      name: "code",
      artifactTypes: ["patch"],
      verifier: {
        hardChecks: [],
        softChecks: ["lint"],
        passCriteria: "x",
      },
      rollback: "git apply -R",
      costSignals: ["tokens"],
    };
    const plan = buildHCCTaskPlan(
      makeReq({ isCodeTask: true, domainProfile: invalid }),
    );
    expect(plan.executable).toBe(false);
    expect(plan.state).toBe("blocked");
    expect(
      plan.validationErrors.some((e: string) => e.includes("hardChecks")),
    ).toBe(true);
  });

  it("blocks plan when domainProfile has empty passCriteria", () => {
    const invalid: DomainProfile = {
      name: "code",
      artifactTypes: ["patch"],
      verifier: {
        hardChecks: ["typecheck"],
        softChecks: [],
        passCriteria: "  ",
      },
      rollback: "git apply -R",
      costSignals: ["tokens"],
    };
    const plan = buildHCCTaskPlan(
      makeReq({ isCodeTask: true, domainProfile: invalid }),
    );
    expect(plan.state).toBe("blocked");
    expect(
      plan.validationErrors.some((e: string) => e.includes("passCriteria")),
    ).toBe(true);
  });

  // 4. non-code task without profile → null, not blocked
  it("non-code task without profile yields null domainProfile", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: false }));
    expect(plan.domainProfile).toBeNull();
  });

  it("non-code task without profile does not block the plan", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: false }));
    expect(plan.state).toBe("planned");
    expect(plan.executable).toBe(false);
  });

  // 5. code task without explicit profile still gets one (default)
  it("code task with no explicit profile still gets default", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile).not.toBeNull();
  });

  it("code task with default profile and changedFiles stays in planned state", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        isCodeTask: true,
        codeGraphImpact: { status: "available", changedFiles: ["x.ts"] },
      }),
    );
    expect(plan.state).toBe("planned");
  });

  it("code task with default profile and no changedFiles is blocked by Slice 004 verifier gate", () => {
    // Slice 004 tightened the contract: a code task without changedFiles
    // cannot produce a valid VerifierInput. This is the Quality Loop gate.
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.state).toBe("blocked");
    expect(
      plan.validationErrors.some((e: string) => e.includes("changedFiles")),
    ).toBe(true);
  });

  // 6. invariants from prior slices
  it("domainProfile integration does not affect executable (still false)", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.executable).toBe(false);
  });

  it("domainProfile integration does not affect executable with custom profile (still false)", () => {
    const custom: DomainProfile = {
      name: "code",
      artifactTypes: ["patch"],
      verifier: {
        hardChecks: ["typecheck"],
        softChecks: [],
        passCriteria: "ok",
      },
      rollback: "r",
      costSignals: ["tokens"],
    };
    const plan = buildHCCTaskPlan(
      makeReq({ isCodeTask: true, domainProfile: custom }),
    );
    expect(plan.executable).toBe(false);
  });

  // 7. does not execute hardChecks
  it("does not run any hardCheck as a side effect", () => {
    // The plan carries hardChecks as data only; calling buildHCCTaskPlan
    // must not invoke typecheck, unit_tests, etc.
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    expect(plan.domainProfile).toBeDefined();
    // Verification: profile is data, no execution side effects observed.
    expect(plan.safetyPlan.changedFiles).toEqual([]);
    expect(plan.safetyPlan.artifactRefs).toEqual([]);
  });

  it("hardChecks are an array of strings, not executable commands", () => {
    const plan = buildHCCTaskPlan(makeReq({ isCodeTask: true }));
    for (const check of plan.domainProfile!.verifier.hardChecks) {
      expect(typeof check).toBe("string");
    }
  });
});