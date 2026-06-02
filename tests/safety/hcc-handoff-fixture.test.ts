import { describe, expect, it, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import {
  buildHCCHandoffPayload,
  writeHCCHandoffPayloadFixture,
  readHCCHandoffPayloadFixture,
  verifyHCCHandoffPayloadFixture,
} from "../../src/main/hcc-handoff-pack";
import { shouldRequireIndependentVerifier } from "../../src/shared/lib/safety/builder-verifier";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
  HCCHandoffPayload,
} from "../../src/main/hcc-task-types";

// -----------------------------------------------------------------
// HCC Handoff payload fixture + local verifier-only check (P3 Slice 008)
// -----------------------------------------------------------------

describe("Handoff payload fixture + local verifier-only check (P3 Slice 008)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcc-fixture-"));
  // Real ~/.hermes/handoff dir must NOT be touched. We probe its mtime
  // before and after the test to assert no change.
  const realHandoffDir = path.join(os.homedir(), ".hermes", "handoff", "packs");
  const realHandoffExists = fs.existsSync(realHandoffDir);
  const realHandoffMtimeBefore = realHandoffExists
    ? fs.statSync(realHandoffDir).mtimeMs
    : 0;

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (realHandoffExists) {
      const mtimeAfter = fs.statSync(realHandoffDir).mtimeMs;
      expect(mtimeAfter).toBe(realHandoffMtimeBefore);
    }
  });

  const happyCodeGraph = (): CodeGraphImpact => ({
    status: "available",
    nodes: 2078,
    edges: 3588,
    changedFiles: ["src/main/hcc-task-runner.ts"],
    artifactRef: "artifacts/codegraph/slice008.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "fixture-task-001",
    goal: "Handoff payload fixture round-trip for P3 Slice 008",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-fixture-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  // ---- 1. happy path write/read/verify ----

  it("writes fixture under tmpDir with task_id in filename", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const outPath = writeHCCHandoffPayloadFixture(payload, tmpDir);
    expect(outPath).toContain("fixture-task-001");
    expect(outPath.startsWith(path.resolve(tmpDir))).toBe(true);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it("written fixture is pretty JSON and contains all required top-level keys", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const outPath = writeHCCHandoffPayloadFixture(payload, tmpDir);
    const blob = fs.readFileSync(outPath, "utf8");
    // pretty format: contains newlines
    expect(blob.split("\n").length).toBeGreaterThan(1);
    const parsed = JSON.parse(blob) as HCCHandoffPayload;
    expect(parsed.task_id).toBe("fixture-task-001");
    expect(parsed.schema_version).toBe("1.0.0");
    expect(parsed.current_state.hcc_executable).toBe(false);
    expect(parsed.artifact_ref).toBeTruthy();
  });

  it("readHCCHandoffPayloadFixture round-trips the payload", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    const round = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${payload.task_id}.json`,
    );
    expect(round.task_id).toBe(payload.task_id);
    expect(round.verification.length).toBe(payload.verification.length);
    expect(round.next_actions.length).toBe(payload.next_actions.length);
  });

  it("verifyHCCHandoffPayloadFixture passes for a clean fixture", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    const round = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${payload.task_id}.json`,
    );
    const result = verifyHCCHandoffPayloadFixture(round);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // ---- 2. redaction_status ----

  it("verifyHCCHandoffPayloadFixture rejects status=pass without redactionConfirmed", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    // Mutate the in-memory payload to claim pass without scanning.
    const tampered: HCCHandoffPayload = {
      ...payload,
      safety: { ...payload.safety, redaction_status: "pass" },
    };
    const result = verifyHCCHandoffPayloadFixture(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e: string) => e.includes("redaction")),
    ).toBe(true);
  });

  it("verifyHCCHandoffPayloadFixture allows status=pass when redactionConfirmed=true", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const confirmed: HCCHandoffPayload = {
      ...payload,
      safety: { ...payload.safety, redaction_status: "pass" },
    };
    const result = verifyHCCHandoffPayloadFixture(confirmed, {
      redactionConfirmed: true,
    });
    expect(result.valid).toBe(true);
  });

  it("default redaction_status is not_run (not fabricated pass)", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.safety.redaction_status).toBe("not_run");
  });

  // ---- 3. forbidden field injection ----

  it("verifyHCCHandoffPayloadFixture rejects payload with injected forbidden field", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const tampered = {
      ...payload,
      // Inject forbidden field at top level
      reasoning: "secret builder thoughts",
    } as unknown as HCCHandoffPayload;
    const result = verifyHCCHandoffPayloadFixture(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e: string) => e.toLowerCase().includes("forbidden")),
    ).toBe(true);
  });

  it("forbidden field nested in next_actions is detected", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const tampered = JSON.parse(JSON.stringify(payload)) as HCCHandoffPayload;
    (tampered.next_actions[0] as unknown as Record<string, unknown>)["chain_of_thought"] =
      "leaked reasoning";
    const result = verifyHCCHandoffPayloadFixture(tampered);
    expect(result.valid).toBe(false);
  });

  // ---- 4. next_actions and do_not_read completeness ----

  it("verifyHCCHandoffPayloadFixture requires claude_code/hermes/user in next_actions", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const tampered: HCCHandoffPayload = {
      ...payload,
      next_actions: payload.next_actions.filter(
        (a) => a.owner !== "user",
      ),
    };
    const result = verifyHCCHandoffPayloadFixture(tampered);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e: string) => e.includes("user")),
    ).toBe(true);
  });

  it("verifyHCCHandoffPayloadFixture requires archive / before / 过时计划 markers in do_not_read", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const tampered: HCCHandoffPayload = {
      ...payload,
      do_not_read: payload.do_not_read.filter(
        (p) => !p.includes("过时计划"),
      ),
    };
    const result = verifyHCCHandoffPayloadFixture(tampered);
    expect(result.valid).toBe(false);
  });

  // ---- 5. JSON round-trip ----

  it("JSON round-trip preserves all required fields", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const blob = JSON.stringify(payload);
    const round = JSON.parse(blob) as HCCHandoffPayload;
    const result = verifyHCCHandoffPayloadFixture(round);
    expect(result.valid).toBe(true);
  });

  // ---- 6. tmpDir isolation ----

  it("writeHCCHandoffPayloadFixture rejects path that escapes tmpDir", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    // subdir that would attempt path traversal
    expect(() =>
      writeHCCHandoffPayloadFixture(payload, tmpDir, {
        subdir: "../escape",
      }),
    ).toThrow(/escapes tmpDir/);
  });

  it("filename without task_id is rejected", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(() =>
      writeHCCHandoffPayloadFixture(payload, tmpDir, {
        filename: "wrong-name.json",
      }),
    ).toThrow(/must include task_id/);
  });

  it("only tmpDir subdirectory is created, no real handoff writes", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    // Probe: anything created must live under tmpDir.
    const probe = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          out.push(...probe(p));
        } else {
          out.push(p);
        }
      }
      return out;
    };
    const all = probe(tmpDir);
    expect(all.length).toBeGreaterThan(0);
    for (const f of all) {
      expect(f.startsWith(path.resolve(tmpDir))).toBe(true);
    }
  });

  // ---- 7. Builder/Verifier boundary against fixture ----

  it("boundary allow for independent verifier on fixture's verifierInput", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    const round = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${payload.task_id}.json`,
    );
    // The fixture carries plan.verifierInput fields but the VerifierInput
    // object itself is not on the payload. We re-derive it from the plan.
    const boundary = shouldRequireIndependentVerifier(
      plan.verifierInput!,
      { verifierId: "independent-verifier" },
    );
    expect(boundary.verdict).toBe("allow");
    // Fixture verification section must mention verifierInput sources.
    const sources = round.verification.map((v) => v.source);
    expect(sources).toContain("hcc.verifierInput");
  });

  it("boundary deny for same_agent_same_context", () => {
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

  it("boundary warn for fresh_context with builderId === verifierId", () => {
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

  // ---- 8. no side effects / no execution primitives ----

  it("serialized fixture does not reference runPlaybook / spawn / exec(", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    const round = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${payload.task_id}.json`,
    );
    const blob = JSON.stringify(round);
    // These substrings may appear inside permission_boundary as policy text;
    // we check no positive invocation marker is present.
    expect(blob).not.toContain("runPlaybook(");
    expect(blob).not.toContain("spawn(");
    expect(blob).not.toContain("exec(");
    expect(blob).not.toContain("ipcMain");
  });

  it("verifyHCCHandoffPayloadFixture does not throw on valid input (no side effects)", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    const round = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${payload.task_id}.json`,
    );
    expect(() => verifyHCCHandoffPayloadFixture(round)).not.toThrow();
  });
});
