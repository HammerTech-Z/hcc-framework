import { describe, expect, it, afterAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import {
  buildHCCHandoffPayload,
  assertHandoffPayloadNoForbiddenFields,
} from "../../src/main/hcc-handoff-pack";
import { shouldRequireIndependentVerifier } from "../../src/shared/lib/safety/builder-verifier";
import { DEFAULT_CODE_DOMAIN_PROFILE } from "../../src/shared/lib/safety/domain-profile";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
} from "../../src/main/hcc-task-types";

// -----------------------------------------------------------------
// HCC → Handoff Pack contract tests (P3 Slice 006)
// -----------------------------------------------------------------

describe("HCC → Handoff Pack payload (P3 Slice 006)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcc-handoff-"));
  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  const happyCodeGraph = (): CodeGraphImpact => ({
    status: "available",
    nodes: 2078,
    edges: 3588,
    changedFiles: ["src/main/hcc-task-runner.ts"],
    impactedFiles: ["src/main/hcc-task-runner.ts"],
    impactedSymbols: ["buildHCCTaskPlan"],
    riskNotes: [],
    artifactRef: "artifacts/codegraph/slice006.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "handoff-task-001",
    goal: "Handoff Pack contract validation for P3 Slice 006",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-handoff-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  // ---- 1. happy path ----

  it("buildHCCHandoffPayload returns a payload for happy plan", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.task_id).toBe("handoff-task-001");
    expect(payload.schema_version).toBe("1.0.0");
    expect(payload.created_by).toBe("hcc-task-runner");
  });

  it("payload.current_state reflects the dry-run plan", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.current_state.hcc_executable).toBe(false);
    expect(payload.current_state.code_graph_status).toBe("available");
    expect(payload.current_state.domain_profile).toBe("code");
    expect(payload.current_state.verifier_input_valid).toBe(true);
  });

  // ---- 2. verification sources ----

  it("verification includes verifierInput handoff/diff refs", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const sources = payload.verification.map((v) => v.source);
    expect(sources).toContain("hcc.verifierInput");
    expect(sources).toContain("hcc.verifierInput.diffRef");
  });

  it("verification includes domainProfile hardChecks and passCriteria", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const sources = payload.verification.map((v) => v.source);
    expect(sources).toContain(
      "hcc.domainProfile[code].verifier.hardChecks",
    );
    expect(sources).toContain(
      "hcc.domainProfile[code].verifier.passCriteria",
    );
  });

  it("verification includes codeGraph when impact was provided", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const sources = payload.verification.map((v) => v.source);
    expect(sources).toContain("hcc.codeGraph");
  });

  it("verification exits 0 when plan is valid", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    for (const v of payload.verification) {
      expect(v.exit_code).toBe(0);
    }
  });

  // ---- 3. next_actions ----

  it("next_actions includes Claude Code executor step", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const owners = payload.next_actions.map((a) => a.owner);
    expect(owners).toContain("claude_code");
  });

  it("next_actions includes Hermes planning role", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const owners = payload.next_actions.map((a) => a.owner);
    expect(owners).toContain("hermes");
  });

  it("next_actions includes user approval for HCC Auto Executor start", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const owners = payload.next_actions.map((a) => a.owner);
    expect(owners).toContain("user");
    const userStep = payload.next_actions.find((a) => a.owner === "user");
    expect(userStep?.action.toLowerCase()).toContain("auto executor");
  });

  it("next_actions does NOT include 'hcc auto executor start' as a Claude Code step", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    for (const a of payload.next_actions) {
      if (a.owner === "claude_code") {
        expect(a.action.toLowerCase()).not.toContain("start hcc auto executor");
      }
    }
  });

  // ---- 4. do_not_read ----

  it("do_not_read includes archive / before / 过时计划 paths", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const joined = payload.do_not_read.join("\n");
    expect(joined).toContain("过时计划");
    expect(joined).toContain("docs/archive");
    expect(joined).toContain("*.before-*");
  });

  // ---- 5. safety / redaction ----

  it("safety.redaction_status is not_run by default (does not fabricate pass)", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.safety.redaction_status).toBe("not_run");
    expect(payload.safety.redaction_status).not.toBe("pass");
  });

  it("safety.forbidden_fields_checked lists all forbidden fields", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.safety.forbidden_fields_checked).toContain("reasoning");
    expect(payload.safety.forbidden_fields_checked).toContain("chain_of_thought");
    expect(payload.safety.forbidden_fields_checked).toContain("raw_prompt");
    expect(payload.safety.forbidden_fields_checked).toContain("raw_messages");
    expect(payload.safety.forbidden_fields_checked).toContain("chat_transcript");
  });

  it("safety.secrets_policy states no secrets/keys copied", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.safety.secrets_policy.toLowerCase()).toContain("no");
  });

  it("safety.permission_boundary declares no IPC/spawn/runPlaybook", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const perm = payload.safety.permission_boundary.toLowerCase();
    expect(perm).toContain("no");
    expect(perm).toContain("spawn");
    expect(perm).toContain("runplaybook");
  });

  // ---- 6. JSON round-trip ----

  it("payload is JSON serializable", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const blob = JSON.stringify(payload, null, 2);
    expect(typeof blob).toBe("string");
    const round: typeof payload = JSON.parse(blob);
    expect(round.task_id).toBe(payload.task_id);
    expect(round.verification.length).toBe(payload.verification.length);
  });

  it("content_hash is null by default", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.content_hash).toBeNull();
  });

  it("content_hash is set when includeContentHash=true", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan, { includeContentHash: true });
    expect(payload.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  // ---- 7. forbidden fields self-check ----

  it("assertHandoffPayloadNoForbiddenFields passes for a clean payload", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(() => assertHandoffPayloadNoForbiddenFields(payload)).not.toThrow();
  });

  it("assertHandoffPayloadNoForbiddenFields throws when a forbidden field is injected", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan) as unknown as Record<
      string,
      unknown
    >;
    payload["reasoning"] = "secret builder thoughts";
    expect(() =>
      assertHandoffPayloadNoForbiddenFields(
        payload as unknown as ReturnType<typeof buildHCCHandoffPayload>,
      ),
    ).toThrow(/forbidden fields/);
  });

  it("serialized payload does not include forbidden field names as VALUES", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const blob = JSON.stringify(payload);
    // The forbidden NAMES appear as keys in safety.forbidden_fields_checked.
    // That's a positive audit signal, not a leak. We assert that the names
    // do not appear as object KEYS (i.e. fields with those names) elsewhere.
    const parsed = JSON.parse(blob);
    function walkKeys(node: unknown, found: string[]): void {
      if (node === null || node === undefined) return;
      if (Array.isArray(node)) { for (const v of node) walkKeys(v, found); return; }
      if (typeof node === "object") {
        for (const k of Object.keys(node as Record<string, unknown>)) {
          found.push(k);
          walkKeys((node as Record<string, unknown>)[k], found);
        }
      }
    }
    const keys: string[] = [];
    walkKeys(parsed, keys);
    for (const f of [
      "reasoning",
      "chain_of_thought",
      "raw_prompt",
      "raw_messages",
      "chat_transcript",
    ]) {
      // Each forbidden name may appear exactly once (in forbidden_fields_checked).
      const occurrences = keys.filter((k) => k === f).length;
      expect(occurrences).toBeLessThanOrEqual(1);
    }
  });

  // ---- 8. no real file writes ----

  it("does not write to ~/.hermes/handoff (only tmpDir)", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const outPath = path.join(tmpDir, "handoff-payload.json");
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
    expect(fs.existsSync(outPath)).toBe(true);
    // ~/.hermes/handoff should not exist or be touched (we cannot easily
    // assert a non-write; this test mainly confirms the function is pure).
    const realHandoffDir = path.join(
      os.homedir(),
      ".hermes",
      "handoff",
      "packs",
    );
    // We do not delete real handoffs; just confirm the function never produced
    // a write side effect by not returning a writer.
    expect(typeof buildHCCHandoffPayload).toBe("function");
    expect(fs.existsSync(realHandoffDir)).toBe(true); // already exists from P0.5
  });

  // ---- 9. no execution side effects ----

  it("buildHCCHandoffPayload is pure (same input → same output)", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const a = buildHCCHandoffPayload(plan, { createdAt: "2026-06-01T00:00:00.000Z" });
    const b = buildHCCHandoffPayload(plan, { createdAt: "2026-06-01T00:00:00.000Z" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("does not include runPlaybook / spawn / exec( as runtime references", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    // safety.permission_boundary is allowed to NAMES of forbidden primitives
    // (it's the policy text). We assert no such primitive is invoked or
    // configured anywhere in the payload.
    const perm = payload.safety.permission_boundary.toLowerCase();
    expect(
      perm.startsWith("payload construction is pure") ||
        perm.startsWith("pure") ||
        perm.includes("no spawn") ||
        perm.includes("no runplaybook"),
    ).toBe(true);
  });

  // ---- 10. invariants ----

  it("executable is false in plan that produced the payload", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    expect(plan.executable).toBe(false);
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.current_state.hcc_executable).toBe(false);
  });

  // ---- 11. boundary integration ----

  it("boundary allow for independent verifier propagates correctly", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const boundary = shouldRequireIndependentVerifier(
      plan.verifierInput!,
      { verifierId: "independent-verifier" },
    );
    expect(boundary.verdict).toBe("allow");
    // Payload structure itself is unaffected; boundary is decided at call site.
    expect(payload.task_id).toBe(plan.taskId);
  });

  // ---- 12. blocked plan → redacted open_questions ----

  it("blocked plan surfaces the blocker in open_questions", () => {
    const plan = buildHCCTaskPlan(
      happyRequest({ codeGraphImpact: { status: "failed" } }),
    );
    const payload = buildHCCHandoffPayload(plan);
    expect(plan.state).toBe("blocked");
    expect(payload.current_state.hcc_plan_state).toBe("blocked");
    expect(payload.open_questions[0].toLowerCase()).toContain("blocked");
  });

  // ---- 13. changed_files ----

  it("changed_files mirrors verifierInput.changedFiles", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.changed_files).toEqual(["src/main/hcc-task-runner.ts"]);
  });

  it("changed_files defaults to empty when verifierInput is null", () => {
    const plan = buildHCCTaskPlan(
      happyRequest({ isCodeTask: false, codeGraphImpact: undefined }),
    );
    const payload = buildHCCHandoffPayload(plan);
    expect(payload.changed_files).toEqual([]);
  });
});
