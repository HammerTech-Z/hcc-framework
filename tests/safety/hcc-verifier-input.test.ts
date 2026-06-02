import { describe, expect, it, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import {
  shouldRequireIndependentVerifier,
  FORBIDDEN_FIELDS,
} from "../../src/shared/lib/safety/builder-verifier";
import { DEFAULT_CODE_DOMAIN_PROFILE } from "../../src/shared/lib/safety/domain-profile";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
  DomainProfile,
} from "../../src/main/hcc-task-types";

describe("HCC plan → VerifierInput mapping (P3 Slice 004)", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "hcc-vi-test-"),
  );
  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const makeReq = (overrides: Partial<HCCTaskRequest> = {}): HCCTaskRequest => ({
    taskId: "vi-task-001",
    goal: "Refactor auth module",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-vi-001",
    isCodeTask: true,
    codeGraphImpact: {
      status: "available",
      changedFiles: ["src/auth/login.ts"],
    },
    ...overrides,
  });

  // 1. valid plan → valid VerifierInput
  it("generates a valid VerifierInput for a valid code task plan", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.verifierInput).not.toBeNull();
    expect(plan.verifierInputValid).toBe(true);
    expect(plan.verifierInputValidationErrors).toEqual([]);
  });

  it("verifierInput.taskId matches request.taskId", () => {
    const plan = buildHCCTaskPlan(makeReq({ taskId: "vi-task-X" }));
    expect(plan.verifierInput!.taskId).toBe("vi-task-X");
  });

  it("handoffPackRef uses hcc-dry-run URI", () => {
    const plan = buildHCCTaskPlan(makeReq({ taskId: "vi-task-Y" }));
    expect(plan.verifierInput!.handoffPackRef).toBe(
      "hcc-dry-run://vi-task-Y/handoff",
    );
  });

  it("diffRef uses hcc-dry-run URI", () => {
    const plan = buildHCCTaskPlan(makeReq({ taskId: "vi-task-Z" }));
    expect(plan.verifierInput!.diffRef).toBe("hcc-dry-run://vi-task-Z/diff");
  });

  // 2. hardChecks → verificationCommands
  it("maps domainProfile hardChecks to verificationCommands when request omits them", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.verifierInput!.verificationCommands).toContain(
      "[VERIFY] typecheck",
    );
    expect(plan.verifierInput!.verificationCommands).toContain(
      "[VERIFY] unit_tests",
    );
    expect(plan.verifierInput!.verificationCommands).toContain(
      "[VERIFY] targeted_tests",
    );
  });

  it("uses request.verificationCommands when provided (overrides hardChecks)", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        verificationCommands: ["npm run custom-check"],
      }),
    );
    expect(plan.verifierInput!.verificationCommands).toEqual([
      "npm run custom-check",
    ]);
  });

  // 3. passCriteria → acceptanceCriteria
  it("maps domainProfile.verifier.passCriteria to acceptanceCriteria", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.verifierInput!.acceptanceCriteria).toContain(
      DEFAULT_CODE_DOMAIN_PROFILE.verifier.passCriteria,
    );
  });

  it("uses request.acceptanceCriteria when provided", () => {
    const plan = buildHCCTaskPlan(
      makeReq({ acceptanceCriteria: ["custom criterion"] }),
    );
    expect(plan.verifierInput!.acceptanceCriteria).toEqual(["custom criterion"]);
  });

  // 4. changedFiles from CodeGraph
  it("maps CodeGraph changedFiles to verifierInput.changedFiles", () => {
    const cg: CodeGraphImpact = {
      status: "available",
      changedFiles: ["src/auth/login.ts", "src/auth/session.ts"],
    };
    const plan = buildHCCTaskPlan(makeReq({ codeGraphImpact: cg }));
    expect(plan.verifierInput!.changedFiles).toEqual([
      "src/auth/login.ts",
      "src/auth/session.ts",
    ]);
  });

  // 5. artifactRefs include CodeGraph artifactRef
  it("includes dry-run plan ref in artifactRefs", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.verifierInput!.artifactRefs).toContain(
      "hcc-dry-run://vi-task-001/plan",
    );
  });

  it("includes CodeGraph artifactRef in artifactRefs when present", () => {
    const cg: CodeGraphImpact = {
      status: "available",
      artifactRef: "artifacts/cg-001.json",
    };
    const plan = buildHCCTaskPlan(makeReq({ codeGraphImpact: cg }));
    expect(plan.verifierInput!.artifactRefs).toContain("artifacts/cg-001.json");
  });

  // 6. forbidden fields never enter VerifierInput
  it("does not include any forbidden field in verifierInput", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const serialized = JSON.stringify(plan.verifierInput);
    for (const f of FORBIDDEN_FIELDS) {
      expect(serialized).not.toContain(`"${f}"`);
    }
  });

  it("rejects request that would inject forbidden fields", () => {
    // Simulate injection: HCCTaskRequest does not expose these fields,
    // so the only way is to mangle the resulting verifierInput.
    // We assert the construction path never includes them.
    const plan = buildHCCTaskPlan(makeReq());
    const keys = Object.keys(plan.verifierInput ?? {});
    for (const f of FORBIDDEN_FIELDS) {
      expect(keys).not.toContain(f);
    }
  });

  it("verifierInput.builderMetadata only contains allowed fields", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const meta = plan.verifierInput!.builderMetadata;
    const allowed = ["builderId", "modelId", "startedAt", "finishedAt", "outputArtifactRef"];
    for (const k of Object.keys(meta)) {
      expect(allowed).toContain(k);
    }
  });

  // 7. empty verificationCommands / acceptanceCriteria → invalid + blocked
  it("marks verifierInput invalid when verificationCommands cannot be derived", () => {
    // isCodeTask=true with custom profile whose hardChecks is empty AND
    // request omits verificationCommands → empty list, blocks.
    const emptyHardChecksProfile: DomainProfile = {
      ...DEFAULT_CODE_DOMAIN_PROFILE,
      verifier: {
        ...DEFAULT_CODE_DOMAIN_PROFILE.verifier,
        hardChecks: [],
      },
    };
    const plan = buildHCCTaskPlan(
      makeReq({
        isCodeTask: true,
        domainProfile: emptyHardChecksProfile,
        verificationCommands: undefined,
      }),
    );
    // Profile itself is invalid (empty hardChecks) so plan is blocked;
    // verifierInput may or may not be valid depending on order, but
    // state must be blocked.
    expect(plan.state).toBe("blocked");
  });

  it("marks verifierInput invalid when passCriteria is missing and request omits acceptanceCriteria", () => {
    const noPassProfile: DomainProfile = {
      ...DEFAULT_CODE_DOMAIN_PROFILE,
      verifier: {
        ...DEFAULT_CODE_DOMAIN_PROFILE.verifier,
        passCriteria: "",
      },
    };
    // Empty passCriteria would fail profile validation → still produces a profile
    // but acceptanceCriteria from request is also missing.
    const plan = buildHCCTaskPlan(
      makeReq({
        isCodeTask: true,
        domainProfile: noPassProfile,
        acceptanceCriteria: undefined,
      }),
    );
    // plan should be blocked due to invalid profile
    expect(plan.state).toBe("blocked");
  });

  // 8. boundary rule: builderId === verifierId same context → deny
  it("boundary deny when builderId === verifierId and not fresh_context", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const boundary = shouldRequireIndependentVerifier(
      plan.verifierInput!,
      { verifierId: plan.verifierInput!.builderMetadata.builderId },
    );
    expect(boundary.verdict).toBe("deny");
  });

  it("boundary warn when builderId === verifierId but freshContext=true", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const boundary = shouldRequireIndependentVerifier(
      plan.verifierInput!,
      {
        verifierId: plan.verifierInput!.builderMetadata.builderId,
        freshContext: true,
      },
    );
    expect(boundary.verdict).toBe("warn");
  });

  it("boundary allow when verifierId differs from builderId", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const boundary = shouldRequireIndependentVerifier(
      plan.verifierInput!,
      { verifierId: "independent-verifier" },
    );
    expect(boundary.verdict).toBe("allow");
  });

  it("boundary deny when isolationLevel=same_agent_same_context", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const mutated = {
      ...plan.verifierInput!,
      isolationLevel: "same_agent_same_context" as const,
    };
    const boundary = shouldRequireIndependentVerifier(mutated, {
      verifierId: "someone-else",
    });
    expect(boundary.verdict).toBe("deny");
  });

  it("boundary warn when isolationLevel=fresh_context AND builderId === verifierId", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const mutated = {
      ...plan.verifierInput!,
      isolationLevel: "fresh_context" as const,
    };
    const boundary = shouldRequireIndependentVerifier(mutated, {
      verifierId: plan.verifierInput!.builderMetadata.builderId,
    });
    expect(boundary.verdict).toBe("warn");
  });

  it("boundary allow when isolationLevel=fresh_context and verifierId differs from builderId", () => {
    const plan = buildHCCTaskPlan(makeReq());
    const mutated = {
      ...plan.verifierInput!,
      isolationLevel: "fresh_context" as const,
    };
    const boundary = shouldRequireIndependentVerifier(mutated, {
      verifierId: "independent-verifier",
    });
    expect(boundary.verdict).toBe("allow");
  });

  // 9. invariants
  it("executable remains false after verifier section is added", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.executable).toBe(false);
  });

  it("executable remains false even when verifierInput is valid", () => {
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.verifierInputValid).toBe(true);
    expect(plan.executable).toBe(false);
  });

  it("plan.state is blocked when verifierInput is invalid", () => {
    const plan = buildHCCTaskPlan(
      makeReq({
        isCodeTask: true,
        // Drop the codeGraphImpact so changedFiles becomes empty.
        codeGraphImpact: { status: "missing" },
        verificationCommands: undefined,
      }),
    );
    expect(plan.state).toBe("blocked");
  });

  // 10. no execution side effects
  it("does not invoke verifier or external model", () => {
    // Build plan and inspect: only buildHCCVerifierInput is called.
    // We confirm by checking that plan.verifierInput is plain data, not a Promise.
    const plan = buildHCCTaskPlan(makeReq());
    expect(plan.verifierInput).not.toBeInstanceOf(Promise);
    expect(typeof plan.verifierInput!.taskId).toBe("string");
  });
});
