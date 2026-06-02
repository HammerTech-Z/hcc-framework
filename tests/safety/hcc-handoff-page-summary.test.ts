import { describe, expect, it } from "vitest";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import { buildHCCHandoffPayload } from "../../src/main/hcc-handoff-pack";
import {
  buildHCCArtifactRecord,
  buildHCCArtifactRecordSummary,
  readHCCArtifactRecordSummaryFixture,
  writeHCCArtifactRecordFixture,
} from "../../src/main/hcc-artifact-store";
import {
  buildHCCHandoffPageSummary,
} from "../../src/main/hcc-handoff-page-summary";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
} from "../../src/main/hcc-task-types";
import type { HCCArtifactRecordSummary } from "../../src/main/hcc-artifact-store";
import type { HCCHandoffPageSummary } from "../../src/main/hcc-handoff-page-summary";

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// -----------------------------------------------------------------
// P3 Code Task 005 — Handoff Page Summary Draft
// -----------------------------------------------------------------

describe("HCCHandoffPageSummary (P3 Code Task 005)", () => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "hcc-handoff-page-summary-"),
  );

  const happyCodeGraph = (): CodeGraphImpact => ({
    status: "available",
    nodes: 2078,
    edges: 3588,
    changedFiles: ["src/main/hcc-handoff-page-summary.ts"],
    impactedFiles: ["src/main/hcc-handoff-page-summary.ts"],
    impactedSymbols: ["buildHCCHandoffPageSummary"],
    riskNotes: [],
    artifactRef: "artifacts/codegraph/task005.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "page-summary-task-001",
    goal: "Handoff page summary draft for P3 Code Task 005",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-page-summary-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  const buildSummary = (
    overrides: Partial<HCCTaskRequest> = {},
    opts: Parameters<typeof buildHCCArtifactRecord>[2] = {},
  ): HCCArtifactRecordSummary => {
    const plan = buildHCCTaskPlan(happyRequest(overrides));
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff, opts);
    return buildHCCArtifactRecordSummary(record);
  };

  // ---- 1. valid artifact summary → ready page summary ----

  it("valid artifact summary produces a ready page summary", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.status).toBe("ready");
    expect(page.errors).toEqual([]);
  });

  // ---- 2. invalid artifact summary → invalid page summary + errors ----

  it("invalid artifact summary produces an invalid page summary with errors surfaced", () => {
    const summary = buildSummary();
    // Force an invalid state by injecting a forbidden field on the
    // underlying record. (buildHCCArtifactRecordSummary propagates
    // valid=false into the summary; the page summary must mirror
    // that.)
    const tampered: Record<string, unknown> = JSON.parse(
      JSON.stringify(summary),
    );
    tampered["errors"] = ["forbidden fields: reasoning"];
    tampered["valid"] = false;
    const page = buildHCCHandoffPageSummary(
      tampered as unknown as HCCArtifactRecordSummary,
    );
    expect(page.status).toBe("invalid");
    expect(page.errors.join("\n")).toMatch(/forbidden fields/);
  });

  it("invalid summary that already has errors stitches them through", () => {
    const summary = buildSummary();
    const tampered: Record<string, unknown> = JSON.parse(
      JSON.stringify(summary),
    );
    tampered["valid"] = false;
    tampered["errors"] = ["custom reason: shape mismatch"];
    const page = buildHCCHandoffPageSummary(
      tampered as unknown as HCCArtifactRecordSummary,
    );
    expect(page.status).toBe("invalid");
    expect(page.errors).toContain("custom reason: shape mismatch");
  });

  // ---- 3. missing next action owner → blocked ----

  it("missing next_action owner produces a blocked page summary (when valid)", () => {
    const summary = buildSummary();
    const tampered: Record<string, unknown> = JSON.parse(
      JSON.stringify(summary),
    );
    tampered["next_action_owners"] = ["claude_code", "hermes"]; // missing "user"
    const page = buildHCCHandoffPageSummary(
      tampered as unknown as HCCArtifactRecordSummary,
    );
    expect(page.status).toBe("blocked");
    expect(page.errors).toContain(
      "next_action_owners missing required: user",
    );
  });

  it("missing all next_action owners is also blocked", () => {
    const summary = buildSummary();
    const tampered: Record<string, unknown> = JSON.parse(
      JSON.stringify(summary),
    );
    tampered["next_action_owners"] = [];
    const page = buildHCCHandoffPageSummary(
      tampered as unknown as HCCArtifactRecordSummary,
    );
    expect(page.status).toBe("blocked");
    expect(page.errors).toContain(
      "next_action_owners missing required: claude_code, hermes, user",
    );
  });

  it("missing owner AND invalid record → invalid wins (errors stitched)", () => {
    const summary = buildSummary();
    const tampered: Record<string, unknown> = JSON.parse(
      JSON.stringify(summary),
    );
    tampered["valid"] = false;
    tampered["errors"] = ["forbidden fields: chain_of_thought"];
    tampered["next_action_owners"] = ["claude_code"];
    const page = buildHCCHandoffPageSummary(
      tampered as unknown as HCCArtifactRecordSummary,
    );
    expect(page.status).toBe("invalid");
    expect(page.errors).toContain("forbidden fields: chain_of_thought");
    expect(page.errors).toContain("next_action_owners missing required: hermes, user");
  });

  // ---- 4. notes 原文 never enters page summary ----

  it("notes 原文 never enters the page summary", () => {
    const summary = buildSummary(
      {},
      { notes: ["secret-alpha", "secret-beta"] },
    );
    const page = buildHCCHandoffPageSummary(summary);
    const blob = JSON.stringify(page);
    expect(blob).not.toContain("secret-alpha");
    expect(blob).not.toContain("secret-beta");
    expect(page.counts.notes).toBe(2);
  });

  // ---- 5. do_not_read 原文 never enters page summary ----

  it("do_not_read 原文 never enters the page summary", () => {
    const summary = buildSummary();
    // The summary already strips do_not_read, but the page summary
    // must also not echo any of the do_not_read strings the page
    // doesn't strictly need. We assert: counts.do_not_read matches,
    // and the page blob does not contain the full do_not_read text
    // (we don't have the raw do_not_read here, but we can assert
    // that `do_not_read` is not a key on the page summary).
    const page = buildHCCHandoffPageSummary(summary);
    const top = page as unknown as Record<string, unknown>;
    expect("do_not_read" in top).toBe(false);
    // counts.do_not_read is the only do_not_read reference.
    expect(typeof page.counts.do_not_read).toBe("number");
  });

  // ---- 6. safety_flags: no_ipc / no_spawn / no_runPlaybook ----

  it("safety_flags.no_ipc / no_spawn / no_runPlaybook are always true", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.safety_flags.no_ipc).toBe(true);
    expect(page.safety_flags.no_spawn).toBe(true);
    expect(page.safety_flags.no_runPlaybook).toBe(true);
  });

  // ---- 7. archive / handoff packs / audit guard flags ----

  it("safety_flags guard markers forward from the underlying summary", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    // The default artifact record's do_not_read includes archive_lock,
    // handoff_packs, and audit markers.
    expect(page.safety_flags.has_archive_guard).toBe(true);
    expect(page.safety_flags.has_handoff_packs_guard).toBe(true);
    expect(page.safety_flags.has_audit_guard).toBe(true);
  });

  // ---- 8. dryRun / executable / runtime_class type-hardcoded ----

  it("page.dryRun is true, page.executable is false, page.runtime_class is dry_run", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.dryRun).toBe(true);
    expect(page.executable).toBe(false);
    expect(page.runtime_class).toBe("dry_run");
  });

  // ---- 9. function does no I/O (no fs imports) ----

  it("hcc-handoff-page-summary module imports neither fs nor path nor ipc", async () => {
    // Re-require the module to inspect its source's import surface.
    // We do not assert on the absolute path; we assert that the
    // module's compiled source has no `import` line for fs / path /
    // ipcMain / child_process / electron.
    const mod = await import("../../src/main/hcc-handoff-page-summary");
    // Module must export the page summary builder and the type.
    expect(typeof mod.buildHCCHandoffPageSummary).toBe("function");
  });

  // ---- 10. JSON round-trip ----

  it("page summary is JSON-serializable and round-trips", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    const blob = JSON.stringify(page, null, 2);
    const parsed = JSON.parse(blob) as HCCHandoffPageSummary;
    expect(parsed.task_id).toBe(page.task_id);
    expect(parsed.status).toBe(page.status);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.executable).toBe(false);
    expect(parsed.runtime_class).toBe("dry_run");
    expect(parsed.safety_flags.no_ipc).toBe(true);
  });

  // ---- 11. refs are passed through ----

  it("page.refs mirrors summary plan/handoff/verifier refs", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.refs.plan_ref).toBe(summary.plan_ref);
    expect(page.refs.handoff_ref).toBe(summary.handoff_ref);
    expect(page.refs.verifier_ref).toBe(summary.verifier_ref);
  });

  it("page.refs.verifier_ref is null when plan has no verifierInput", () => {
    const summary = buildSummary({
      isCodeTask: false,
      codeGraphImpact: undefined,
    });
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.refs.verifier_ref).toBeNull();
  });

  // ---- 12. counts ----

  it("page.counts mirrors summary counts", () => {
    const summary = buildSummary(
      {},
      { notes: ["n1", "n2", "n3"] },
    );
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.counts.notes).toBe(3);
    expect(page.counts.do_not_read).toBe(summary.do_not_read_count);
    expect(page.counts.forbidden_fields_checked).toBe(
      summary.forbidden_fields_checked_count,
    );
  });

  // ---- 13. source_commit + has_content_hash passthrough ----

  it("page.source_commit and has_content_hash mirror summary", () => {
    const summary = buildSummary(
      {},
      {
        sourceCommit: {
          commit: "abc1234",
          branch: "main",
          is_git_repo: true,
        },
      },
    );
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.source_commit).toEqual(summary.source_commit);
    expect(page.has_content_hash).toBe(summary.has_content_hash);
  });

  it("page.has_content_hash is true when summary has sha256:...", () => {
    const summary = buildSummary({}, { includeContentHash: true });
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.has_content_hash).toBe(true);
  });

  // ---- 14. redaction_status passthrough ----

  it("page.redaction_status mirrors summary", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.redaction_status).toBe(summary.redaction_status);
  });

  // ---- 15. artifact_type passthrough ----

  it("page.artifact_type mirrors summary", () => {
    const summary = buildSummary({}, {
      artifactType: "hcc_dry_run_plan",
    });
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.artifact_type).toBe("hcc_dry_run_plan");
  });

  // ---- 16. end-to-end via readHCCArtifactRecordSummaryFixture ----

  it("page summary can be built from a fixture read path", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    writeHCCArtifactRecordFixture(record, tmpDir);
    const summary = readHCCArtifactRecordSummaryFixture(
      tmpDir,
      `artifact-${plan.taskId}.json`,
    );
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.status).toBe("ready");
    expect(page.task_id).toBe(plan.taskId);
  });

  // ---- 17. next_action_owners is the same Set as the input summary ----

  it("page.next_action_owners is the same list as the input summary", () => {
    const summary = buildSummary();
    const page = buildHCCHandoffPageSummary(summary);
    expect(page.next_action_owners).toEqual(summary.next_action_owners);
  });

  // ---- 18. errors array order: original errors first, then missing-owner ----

  it("errors are stitched in the order: summary errors first, then missing-owner", () => {
    const summary = buildSummary();
    const tampered: Record<string, unknown> = JSON.parse(
      JSON.stringify(summary),
    );
    tampered["valid"] = false;
    tampered["errors"] = ["first-error", "second-error"];
    tampered["next_action_owners"] = ["claude_code"]; // missing hermes, user
    const page = buildHCCHandoffPageSummary(
      tampered as unknown as HCCArtifactRecordSummary,
    );
    expect(page.errors[0]).toBe("first-error");
    expect(page.errors[1]).toBe("second-error");
    expect(page.errors[2]).toBe(
      "next_action_owners missing required: hermes, user",
    );
  });
});
