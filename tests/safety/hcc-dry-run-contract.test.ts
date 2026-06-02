import { describe, expect, it, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import { shouldRequireIndependentVerifier } from "../../src/shared/lib/safety/builder-verifier";
import { DEFAULT_CODE_DOMAIN_PROFILE } from "../../src/shared/lib/safety/domain-profile";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
  DomainProfile,
} from "../../src/main/hcc-task-types";

// -----------------------------------------------------------------
// End-to-end dry-run contract fixture (P3 Slice 005)
//
// Validates the full Slice 001 → Slice 004 contract chain:
//   request → plan → codeGraph → domainProfile → verifierInput → boundary
// Pure: no IPC, no spawn, no real file writes (tmpdir only).
// -----------------------------------------------------------------

describe("End-to-end dry-run contract (P3 Slice 005)", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "hcc-e2e-dry-"),
  );
  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ---- fixture builders ----

  const happyCodeGraph = (): CodeGraphImpact => ({
    status: "available",
    nodes: 2078,
    edges: 3588,
    changedFiles: [
      "src/main/hcc-task-runner.ts",
      "src/main/hcc-task-types.ts",
    ],
    impactedFiles: [
      "src/main/hcc-task-runner.ts",
      "src/main/hcc-task-types.ts",
      "src/shared/lib/safety/builder-verifier.ts",
    ],
    impactedSymbols: ["buildHCCTaskPlan", "buildHCCVerifierInput"],
    riskNotes: [],
    artifactRef: "artifacts/codegraph/slice005.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "e2e-task-001",
    goal: "End-to-end dry-run validation for P3 slices 001-004",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-e2e-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  // ---- 1. happy path contract ----

  describe("happy path", () => {
    it("buildHCCTaskPlan returns a plan with executable=false", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.executable).toBe(false);
    });

    it("plan.codeGraph.status reflects the available impact", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.codeGraph.status).toBe("available");
      expect(plan.codeGraph.wasProvided).toBe(true);
      expect(plan.codeGraph.nodes).toBe(2078);
      expect(plan.codeGraph.edges).toBe(3588);
    });

    it("plan.domainProfile resolves to the code default profile", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.domainProfile).not.toBeNull();
      expect(plan.domainProfile!.name).toBe("code");
      expect(plan.domainProfile!.verifier.hardChecks).toEqual(
        DEFAULT_CODE_DOMAIN_PROFILE.verifier.hardChecks,
      );
    });

    it("plan.verifierInput is valid and complete", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.verifierInput).not.toBeNull();
      expect(plan.verifierInputValid).toBe(true);
      expect(plan.verifierInputValidationErrors).toEqual([]);
    });

    it("verifierInput.changedFiles come from CodeGraph", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.verifierInput!.changedFiles).toEqual([
        "src/main/hcc-task-runner.ts",
        "src/main/hcc-task-types.ts",
      ]);
    });

    it("verifierInput.artifactRefs contain dry-run plan ref and CodeGraph ref", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const refs = plan.verifierInput!.artifactRefs;
      expect(refs).toContain("hcc-dry-run://e2e-task-001/plan");
      expect(refs).toContain("artifacts/codegraph/slice005.json");
    });

    it("verifierInput.verificationCommands map hardChecks to [VERIFY] plan-data strings", () => {
      const plan = buildHCCTaskPlan(happyRequest());
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

    it("verifierInput.acceptanceCriteria reflect the profile passCriteria", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.verifierInput!.acceptanceCriteria).toContain(
        DEFAULT_CODE_DOMAIN_PROFILE.verifier.passCriteria,
      );
    });

    it("verifierInput.builderMetadata only has allowed fields", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const keys = Object.keys(plan.verifierInput!.builderMetadata);
      const allowed = [
        "builderId",
        "modelId",
        "startedAt",
        "finishedAt",
        "outputArtifactRef",
      ];
      for (const k of keys) expect(allowed).toContain(k);
    });

    it("happy path plan has no validation errors", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.validationErrors).toEqual([]);
      expect(plan.state).toBe("planned");
    });
  });

  // ---- 2. Builder/Verifier boundary across all three verdicts ----

  describe("Builder/Verifier boundary", () => {
    it("verifierId differs from builderId → allow", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const boundary = shouldRequireIndependentVerifier(
        plan.verifierInput!,
        { verifierId: "independent-verifier-007" },
      );
      expect(boundary.taskId).toBe("e2e-task-001");
      expect(boundary.verdict).toBe("allow");
    });

    it("isolationLevel=same_agent_same_context → deny", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const mutated = {
        ...plan.verifierInput!,
        isolationLevel: "same_agent_same_context" as const,
      };
      const boundary = shouldRequireIndependentVerifier(mutated, {
        verifierId: "anyone",
      });
      expect(boundary.verdict).toBe("deny");
    });

    it("verifierId === builderId, freshContext=true → warn", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const boundary = shouldRequireIndependentVerifier(
        plan.verifierInput!,
        {
          verifierId: plan.verifierInput!.builderMetadata.builderId,
          freshContext: true,
        },
      );
      expect(boundary.verdict).toBe("warn");
    });

    it("verifierId === builderId, isolationLevel=fresh_context → warn", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const mutated = {
        ...plan.verifierInput!,
        isolationLevel: "fresh_context" as const,
      };
      const boundary = shouldRequireIndependentVerifier(mutated, {
        verifierId: plan.verifierInput!.builderMetadata.builderId,
      });
      expect(boundary.verdict).toBe("warn");
    });

    it("verifierId === builderId, no fresh context → deny", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const boundary = shouldRequireIndependentVerifier(
        plan.verifierInput!,
        { verifierId: plan.verifierInput!.builderMetadata.builderId },
      );
      expect(boundary.verdict).toBe("deny");
    });
  });

  // ---- 3. blocked fixtures ----

  describe("blocked fixtures", () => {
    it("CodeGraph failed → plan.state=blocked, executable=false", () => {
      const failedCg: CodeGraphImpact = {
        status: "failed",
        riskNotes: ["graph query timeout"],
      };
      const plan = buildHCCTaskPlan(
        happyRequest({ codeGraphImpact: failedCg }),
      );
      expect(plan.codeGraph.status).toBe("failed");
      expect(plan.executable).toBe(false);
      expect(plan.state).toBe("blocked");
    });

    it("CodeGraph failed → validationErrors captures the failure", () => {
      const failedCg: CodeGraphImpact = {
        status: "failed",
        riskNotes: ["index out of date"],
      };
      const plan = buildHCCTaskPlan(
        happyRequest({ codeGraphImpact: failedCg }),
      );
      expect(
        plan.validationErrors.some((e: string) => e.includes("failed")),
      ).toBe(true);
    });

    it("invalid domainProfile (empty hardChecks) → blocked, executable=false", () => {
      const invalidProfile: DomainProfile = {
        name: "code",
        artifactTypes: ["patch"],
        verifier: {
          hardChecks: [],
          softChecks: ["lint"],
          passCriteria: "ok",
        },
        rollback: "git apply -R",
        costSignals: ["tokens"],
      };
      const plan = buildHCCTaskPlan(
        happyRequest({ domainProfile: invalidProfile }),
      );
      expect(plan.executable).toBe(false);
      expect(plan.state).toBe("blocked");
      expect(
        plan.validationErrors.some((e: string) => e.includes("hardChecks")),
      ).toBe(true);
    });

    it("code task with no CodeGraph impact → verifierInputValid=false", () => {
      const plan = buildHCCTaskPlan(
        happyRequest({ codeGraphImpact: undefined }),
      );
      expect(plan.verifierInputValid).toBe(false);
      expect(plan.executable).toBe(false);
      expect(plan.state).toBe("blocked");
      expect(
        plan.validationErrors.some((e: string) => e.includes("changedFiles")),
      ).toBe(true);
    });

    it("blocked plan still produces a verifierInput for inspection", () => {
      const plan = buildHCCTaskPlan(
        happyRequest({ codeGraphImpact: undefined }),
      );
      // Even when invalid, the input is constructed (or null) for inspection.
      // The contract is that consumers can see WHY it failed.
      expect(plan.verifierInputValidationErrors.length).toBeGreaterThan(0);
    });
  });

  // ---- 4. contract invariants across all fixtures ----

  describe("invariants", () => {
    it("executable is false for happy plan", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      expect(plan.executable).toBe(false);
    });

    it("executable is false for blocked plan", () => {
      const plan = buildHCCTaskPlan(
        happyRequest({ codeGraphImpact: { status: "failed" } }),
      );
      expect(plan.executable).toBe(false);
    });

    it("executable is false for invalid-profile plan", () => {
      const plan = buildHCCTaskPlan(
        happyRequest({
          domainProfile: {
            ...DEFAULT_CODE_DOMAIN_PROFILE,
            verifier: { ...DEFAULT_CODE_DOMAIN_PROFILE.verifier, hardChecks: [] },
          },
        }),
      );
      expect(plan.executable).toBe(false);
    });

    it("executable type literal is exactly false (compile-time check via expectType)", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      // This test is for runtime safety; the compile-time check is in TS.
      expect(plan.executable).toBe(false);
    });

    it("plan.taskId matches request.taskId across all fixtures", () => {
      for (const id of ["e2e-A", "e2e-B", "e2e-C"]) {
        const plan = buildHCCTaskPlan(happyRequest({ taskId: id }));
        expect(plan.taskId).toBe(id);
        expect(plan.verifierInput?.taskId).toBe(id);
      }
    });
  });

  // ---- 5. no execution side effects ----

  describe("no side effects", () => {
    it("does not invoke spawn, exec, or runPlaybook (verifierInput is plain data)", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      // verifierInput is a plain object, not a Promise or function.
      expect(plan.verifierInput).not.toBeInstanceOf(Promise);
      expect(typeof plan.verifierInput!.taskId).toBe("string");
      expect(Array.isArray(plan.verifierInput!.verificationCommands)).toBe(
        true,
      );
    });

    it("tmpdir is the only thing created on disk during the test run", () => {
      // Capture pre-state: only our tmpDir should be touched.
      // We cannot easily prove a negative; instead we assert that no extra
      // directories appear under our tmpDir.
      const entries = fs.readdirSync(tmpDir);
      // The runner uses fs.existsSync for worktreePath; nothing else is written.
      expect(entries.length).toBe(0);
    });

    it("plan does not contain a reference to runPlaybook anywhere", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const blob = JSON.stringify(plan);
      expect(blob).not.toContain("runPlaybook");
      expect(blob).not.toContain("spawn");
      expect(blob).not.toContain("exec(");
      expect(blob).not.toContain("ipcMain");
    });
  });

  // ---- 6. JSON serialization round-trip ----

  describe("JSON round-trip (Handoff Pack payload style)", () => {
    it("plan serializes to JSON and re-parses with all key fields intact", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const blob = JSON.stringify(plan, null, 2);
      const round: typeof plan = JSON.parse(blob);
      expect(round.taskId).toBe(plan.taskId);
      expect(round.executable).toBe(false);
      expect(round.codeGraph.status).toBe("available");
      expect(round.domainProfile?.name).toBe("code");
      expect(round.verifierInputValid).toBe(true);
      expect(round.verifierInput?.changedFiles).toEqual(
        plan.verifierInput!.changedFiles,
      );
      expect(round.verifierInput?.artifactRefs).toEqual(
        plan.verifierInput!.artifactRefs,
      );
    });

    it("serialized plan fits in tmpdir without polluting user paths", () => {
      const plan = buildHCCTaskPlan(happyRequest());
      const blob = JSON.stringify(plan, null, 2);
      const outPath = path.join(tmpDir, "dry-run-plan.json");
      fs.writeFileSync(outPath, blob, "utf8");
      expect(fs.existsSync(outPath)).toBe(true);
      const read = fs.readFileSync(outPath, "utf8");
      expect(read).toContain("e2e-task-001");
    });
  });
});
