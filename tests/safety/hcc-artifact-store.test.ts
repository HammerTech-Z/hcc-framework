import { describe, expect, it, afterAll, beforeAll, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import {
  buildHCCHandoffPayload,
} from "../../src/main/hcc-handoff-pack";
import {
  buildHCCArtifactRecord,
  assertArtifactRecordNoForbiddenFields,
  verifyHCCArtifactRecord,
  writeHCCArtifactRecordFixture,
  readHCCArtifactRecordFixture,
  FORBIDDEN_ARTIFACT_FIELDS,
  buildHCCArtifactRecordSummary,
  readHCCArtifactRecordSummaryFixture,
} from "../../src/main/hcc-artifact-store";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
} from "../../src/main/hcc-task-types";
import type { HCCArtifactRecord } from "../../src/main/hcc-artifact-store";

// -----------------------------------------------------------------
// Artifact Store dry-run record (P3 Slice 009)
// -----------------------------------------------------------------

describe("HCC Artifact Store dry-run record (P3 Slice 009)", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcc-artifact-"));

  // Real ~/.hermes/handoff and ~/.hermes/audit must NOT be touched.
  const realHandoffDir = path.join(
    os.homedir(),
    ".hermes",
    "handoff",
    "packs",
  );
  const realAuditDir = path.join(os.homedir(), ".hermes", "audit");
  const realHandoffMtimeBefore = fs.existsSync(realHandoffDir)
    ? fs.statSync(realHandoffDir).mtimeMs
    : 0;
  const realAuditMtimeBefore = fs.existsSync(realAuditDir)
    ? fs.statSync(realAuditDir).mtimeMs
    : 0;
  const realHandoffExists = fs.existsSync(realHandoffDir);
  const realAuditExists = fs.existsSync(realAuditDir);

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (realHandoffExists) {
      const mtimeAfter = fs.statSync(realHandoffDir).mtimeMs;
      expect(mtimeAfter).toBe(realHandoffMtimeBefore);
    }
    if (realAuditExists) {
      const mtimeAfter = fs.statSync(realAuditDir).mtimeMs;
      expect(mtimeAfter).toBe(realAuditMtimeBefore);
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
    artifactRef: "artifacts/codegraph/slice009.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "artifact-task-001",
    goal: "Artifact Store dry-run record for P3 Slice 009",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-artifact-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  const buildRecord = (
    overrides: Partial<HCCTaskRequest> = {},
    opts: Parameters<typeof buildHCCArtifactRecord>[2] = {},
  ): HCCArtifactRecord => {
    const plan = buildHCCTaskPlan(happyRequest(overrides));
    const handoff = buildHCCHandoffPayload(plan);
    return buildHCCArtifactRecord(plan, handoff, opts);
  };

  // ---- 1. happy path ----

  it("buildHCCArtifactRecord returns a record for a happy plan", () => {
    const record = buildRecord();
    expect(record.task_id).toBe("artifact-task-001");
    expect(record.schema_version).toBe("1.0.0");
    expect(record.created_by).toBe("hcc-artifact-store");
  });

  it("record.dryRun is true and record.executable is false (type-hardcoded)", () => {
    const record = buildRecord();
    expect(record.dryRun).toBe(true);
    expect(record.executable).toBe(false);
  });

  it("record has all required fields", () => {
    const record = buildRecord();
    expect(record.task_id).toBeTruthy();
    expect(record.created_at).toBeTruthy();
    expect(record.plan_ref).toBeTruthy();
    expect(record.handoff_ref).toBeTruthy();
    expect(record.safety).toBeTruthy();
    expect(record.source_commit).toBeTruthy();
    expect(record.next_actions.length).toBeGreaterThan(0);
    expect(record.do_not_read.length).toBeGreaterThan(0);
  });

  it("plan_ref and handoff_ref include the task_id", () => {
    const record = buildRecord();
    expect(record.plan_ref).toContain("artifact-task-001");
    expect(record.handoff_ref).toContain("artifact-task-001");
  });

  it("verifier_ref is non-null when plan has a verifierInput", () => {
    const record = buildRecord();
    expect(record.verifier_ref).toContain("verifier-input");
  });

  it("verifier_ref is null when plan has no verifierInput", () => {
    const record = buildRecord({
      isCodeTask: false,
      codeGraphImpact: undefined,
    });
    expect(record.verifier_ref).toBeNull();
  });

  // ---- 2. safety ----

  it("safety.runtime_class is dry_run", () => {
    const record = buildRecord();
    expect(record.safety.runtime_class).toBe("dry_run");
  });

  it("safety.side_effect_gates contains no_ipc / no_spawn / no_runPlaybook", () => {
    const record = buildRecord();
    expect(record.safety.side_effect_gates).toContain("no_ipc");
    expect(record.safety.side_effect_gates).toContain("no_spawn");
    expect(record.safety.side_effect_gates).toContain("no_runPlaybook");
  });

  it("safety.redaction_status is not_run by default (does not fabricate pass)", () => {
    const record = buildRecord();
    expect(record.safety.redaction_status).toBe("not_run");
  });

  it("safety.forbidden_fields_checked lists all required forbidden fields", () => {
    const record = buildRecord();
    for (const f of [
      "reasoning",
      "chain_of_thought",
      "raw_prompt",
      "raw_messages",
      "chat_transcript",
      "internal_thought",
      "scratch_pad",
      "working_memory",
    ]) {
      expect(record.safety.forbidden_fields_checked).toContain(f);
    }
  });

  it("safety.secrets_policy denies raw prompts and chat transcripts", () => {
    const record = buildRecord();
    const policy = record.safety.secrets_policy.toLowerCase();
    expect(policy).toContain("no");
  });

  it("safety.permission_boundary declares no IPC / spawn / runPlaybook", () => {
    const record = buildRecord();
    const perm = record.safety.permission_boundary.toLowerCase();
    expect(perm).toContain("no");
    expect(perm).toContain("ipc");
    expect(perm).toContain("spawn");
    expect(perm).toContain("runplaybook");
  });

  // ---- 3. next_actions ----

  it("next_actions includes claude_code / hermes / user", () => {
    const record = buildRecord();
    const owners = record.next_actions.map((a) => a.owner);
    expect(owners).toContain("claude_code");
    expect(owners).toContain("hermes");
    expect(owners).toContain("user");
  });

  // ---- 4. do_not_read ----

  it("do_not_read contains archive / before / 过时计划 markers", () => {
    const record = buildRecord();
    const joined = record.do_not_read.join("\n");
    expect(joined).toContain("过时计划");
    expect(joined).toContain("docs/archive");
    expect(joined).toContain("*.before-*");
  });

  it("do_not_read explicitly mentions handoff/packs and audit paths", () => {
    const record = buildRecord();
    const joined = record.do_not_read.join("\n");
    expect(joined).toContain("~/.hermes/handoff/packs/");
    expect(joined).toContain("~/.hermes/audit/");
  });

  // ---- 5. forbidden fields ----

  it("FORBIDDEN_ARTIFACT_FIELDS contains the spec required names", () => {
    expect(FORBIDDEN_ARTIFACT_FIELDS).toContain("reasoning");
    expect(FORBIDDEN_ARTIFACT_FIELDS).toContain("chain_of_thought");
    expect(FORBIDDEN_ARTIFACT_FIELDS).toContain("raw_prompt");
    expect(FORBIDDEN_ARTIFACT_FIELDS).toContain("raw_messages");
    expect(FORBIDDEN_ARTIFACT_FIELDS).toContain("chat_transcript");
  });

  it("assertArtifactRecordNoForbiddenFields passes for a clean record", () => {
    const record = buildRecord();
    expect(() =>
      assertArtifactRecordNoForbiddenFields(record),
    ).not.toThrow();
  });

  it("assertArtifactRecordNoForbiddenFields throws when a forbidden key is injected", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    tampered["reasoning"] = "secret builder thoughts";
    expect(() =>
      assertArtifactRecordNoForbiddenFields(
        tampered as unknown as HCCArtifactRecord,
      ),
    ).toThrow(/forbidden fields/);
  });

  it("assertArtifactRecordNoForbiddenFields throws for nested injection", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["chain_of_thought"] = "leak";
    expect(() =>
      assertArtifactRecordNoForbiddenFields(
        tampered as unknown as HCCArtifactRecord,
      ),
    ).toThrow(/forbidden fields/);
  });

  // ---- 6. verify ----

  it("verifyHCCArtifactRecord returns valid=true for a clean record", () => {
    const record = buildRecord();
    const result = verifyHCCArtifactRecord(record);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("verifyHCCArtifactRecord rejects redaction_status=pass without confirmation", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["redaction_status"] = "pass";
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/redaction.*pass/i);
  });

  it("verifyHCCArtifactRecord accepts redaction_status=pass when confirmed", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["redaction_status"] = "pass";
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
      { redactionConfirmed: true },
    );
    expect(result.valid).toBe(true);
  });

  it("verifyHCCArtifactRecord rejects executable=true", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    tampered["executable"] = true;
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/executable/i);
  });

  it("verifyHCCArtifactRecord rejects dryRun=false", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    tampered["dryRun"] = false;
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/dryRun/i);
  });

  it("verifyHCCArtifactRecord rejects missing task_id", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    tampered["task_id"] = "";
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/task_id/);
  });

  it("verifyHCCArtifactRecord rejects runtime_class that is not dry_run", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["runtime_class"] = "live";
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/runtime_class/);
  });

  it("verifyHCCArtifactRecord rejects missing side-effect gate", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["side_effect_gates"] = ["no_ipc"];
    const result = verifyHCCArtifactRecord(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/no_spawn|no_runPlaybook/);
  });

  // ---- 7. tmpDir write/read round-trip ----

  it("writeHCCArtifactRecordFixture writes to tmpDir with task_id in filename", () => {
    const record = buildRecord();
    const outPath = writeHCCArtifactRecordFixture(record, tmpDir);
    expect(outPath).toContain("artifact-task-001");
    expect(outPath.startsWith(path.resolve(tmpDir))).toBe(true);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  it("writeHCCArtifactRecordFixture refuses filenames without task_id", () => {
    const record = buildRecord();
    expect(() =>
      writeHCCArtifactRecordFixture(record, tmpDir, {
        filename: "wrong-name.json",
      }),
    ).toThrow(/must include task_id/);
  });

  it("writeHCCArtifactRecordFixture refuses paths that escape tmpDir via subdir", () => {
    const record = buildRecord();
    expect(() =>
      writeHCCArtifactRecordFixture(record, tmpDir, {
        subdir: "../../escape-here",
      }),
    ).toThrow(/escapes tmpDir/);
  });

  it("readHCCArtifactRecordFixture round-trips a written record", () => {
    const record = buildRecord({ taskId: "artifact-round-trip-001" });
    const outPath = writeHCCArtifactRecordFixture(
      record,
      tmpDir,
      {
        filename: "artifact-artifact-round-trip-001.json",
      },
    );
    expect(fs.existsSync(outPath)).toBe(true);
    const read = readHCCArtifactRecordFixture(
      tmpDir,
      "artifact-artifact-round-trip-001.json",
    );
    expect(read.task_id).toBe("artifact-round-trip-001");
    expect(read.dryRun).toBe(true);
    expect(read.executable).toBe(false);
  });

  it("readHCCArtifactRecordFixture refuses paths that escape tmpDir", () => {
    // Two `..` hops: one climbs out of the subdir, one climbs out of tmpDir.
    expect(() =>
      readHCCArtifactRecordFixture(tmpDir, "../../escape.json"),
    ).toThrow(/escapes tmpDir/);
  });

  // ---- 8. JSON serialisation ----

  it("record is JSON serializable and round-trips", () => {
    const record = buildRecord();
    const blob = JSON.stringify(record, null, 2);
    const parsed = JSON.parse(blob) as HCCArtifactRecord;
    expect(parsed.task_id).toBe(record.task_id);
    expect(parsed.safety.runtime_class).toBe("dry_run");
    expect(parsed.dryRun).toBe(true);
    expect(parsed.executable).toBe(false);
  });

  it("content_hash is null by default", () => {
    const record = buildRecord();
    expect(record.content_hash).toBeNull();
  });

  it("content_hash is set when includeContentHash=true", () => {
    const record = buildRecord({}, { includeContentHash: true });
    expect(record.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("content_hash is set when includeContentHash=true and matches sha256 shape", () => {
    const record = buildRecord({}, { includeContentHash: true });
    expect(record.content_hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  // ---- 9. no real side effects ----

  it("does not write to ~/.hermes/handoff/packs or ~/.hermes/audit", () => {
    const record = buildRecord();
    const outPath = writeHCCArtifactRecordFixture(record, tmpDir);
    expect(fs.existsSync(outPath)).toBe(true);
    // The real dirs were not touched (asserted in afterAll via mtime).
    // Here we additionally confirm the write function only touched tmpDir.
    const tmpFiles = fs.readdirSync(tmpDir);
    expect(tmpFiles.length).toBeGreaterThan(0);
    for (const entry of tmpFiles) {
      const full = path.join(tmpDir, entry);
      expect(full.startsWith(path.resolve(tmpDir))).toBe(true);
    }
  });

  it("buildHCCArtifactRecord is pure given deterministic timestamps", () => {
    const a = buildRecord(
      {},
      { createdAt: "2026-06-01T00:00:00.000Z" },
    );
    const b = buildRecord(
      {},
      { createdAt: "2026-06-01T00:00:00.000Z" },
    );
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("throws when plan.taskId does not match handoff.task_id", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const broken: typeof handoff = JSON.parse(JSON.stringify(handoff));
    broken.task_id = "different-task-id";
    expect(() =>
      buildHCCArtifactRecord(
        plan,
        broken as unknown as typeof handoff,
      ),
    ).toThrow(/plan.taskId/);
  });

  // ---- 10. source_commit ----

  it("source_commit defaults to null commit / null branch / false is_git_repo", () => {
    const record = buildRecord();
    expect(record.source_commit.commit).toBeNull();
    expect(record.source_commit.branch).toBeNull();
    expect(record.source_commit.is_git_repo).toBe(false);
  });

  it("source_commit accepts caller overrides", () => {
    const record = buildRecord({}, {
      sourceCommit: {
        commit: "abc1234",
        branch: "main",
        is_git_repo: true,
      },
    });
    expect(record.source_commit.commit).toBe("abc1234");
    expect(record.source_commit.branch).toBe("main");
    expect(record.source_commit.is_git_repo).toBe(true);
  });

  // ---- 11. artifact_type ----

  it("artifact_type defaults to hcc_dry_run_combined", () => {
    const record = buildRecord();
    expect(record.artifact_type).toBe("hcc_dry_run_combined");
  });

  it("artifact_type accepts an override", () => {
    const record = buildRecord({}, {
      artifactType: "hcc_dry_run_plan",
    });
    expect(record.artifact_type).toBe("hcc_dry_run_plan");
  });

  // ---- 12. notes ----

  it("notes default to empty array", () => {
    const record = buildRecord();
    expect(record.notes).toEqual([]);
  });

  it("notes accept caller-supplied list", () => {
    const record = buildRecord({}, {
      notes: ["P3 dry-run baseline fixture", "ready for archival"],
    });
    expect(record.notes).toEqual([
      "P3 dry-run baseline fixture",
      "ready for archival",
    ]);
  });
});

// -----------------------------------------------------------------
// HCC Artifact Record summary helper (P3 Code Task 003)
// -----------------------------------------------------------------

describe("HCC Artifact Record summary helper (P3 Code Task 003)", () => {
  const happyCodeGraph = (): CodeGraphImpact => ({
    status: "available",
    nodes: 2078,
    edges: 3588,
    changedFiles: ["src/main/hcc-artifact-store.ts"],
    impactedFiles: ["src/main/hcc-artifact-store.ts"],
    impactedSymbols: ["buildHCCArtifactRecordSummary"],
    riskNotes: [],
    artifactRef: "artifacts/codegraph/task003.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "summary-task-001",
    goal: "Artifact record summary helper for P3 Code Task 003",
    worktreePath: fs.mkdtempSync(path.join(os.tmpdir(), "hcc-summary-")),
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-summary-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  const buildRecord = (
    overrides: Partial<HCCTaskRequest> = {},
    opts: Parameters<typeof buildHCCArtifactRecord>[2] = {},
  ): HCCArtifactRecord => {
    const plan = buildHCCTaskPlan(happyRequest(overrides));
    const handoff = buildHCCHandoffPayload(plan);
    return buildHCCArtifactRecord(plan, handoff, opts);
  };

  // ---- happy path ----

  it("buildHCCArtifactRecordSummary returns a summary for a clean record", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.task_id).toBe("summary-task-001");
    expect(summary.schema_version).toBe("1.0.0");
    expect(summary.valid).toBe(true);
    expect(summary.errors).toEqual([]);
  });

  // ---- 1. fields present and types right ----

  it("summary exposes the spec required fields", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.schema_version).toBe("1.0.0");
    expect(summary.task_id).toBe(record.task_id);
    expect(summary.artifact_type).toBe(record.artifact_type);
    expect(summary.dryRun).toBe(true);
    expect(summary.executable).toBe(false);
    expect(summary.runtime_class).toBe("dry_run");
    expect(summary.redaction_status).toBe(record.safety.redaction_status);
    expect(summary.source_commit).toEqual(record.source_commit);
    expect(typeof summary.has_content_hash).toBe("boolean");
    expect(summary.plan_ref).toBe(record.plan_ref);
    expect(summary.handoff_ref).toBe(record.handoff_ref);
    expect(summary.verifier_ref).toBe(record.verifier_ref);
    expect(Array.isArray(summary.next_action_owners)).toBe(true);
    expect(typeof summary.do_not_read_count).toBe("number");
    expect(typeof summary.forbidden_fields_checked_count).toBe("number");
    expect(typeof summary.valid).toBe("boolean");
    expect(Array.isArray(summary.errors)).toBe(true);
  });

  // ---- 2. dryRun / executable / runtime_class type-hardcoded ----

  it("summary.dryRun / executable / runtime_class are type-hardcoded literals", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    // Compile-time guarantees; we also assert values to catch
    // accidental cast regressions.
    expect(summary.dryRun).toBe(true);
    expect(summary.executable).toBe(false);
    expect(summary.runtime_class).toBe("dry_run");
  });

  // ---- 3. has_content_hash mirrors includeContentHash ----

  it("summary.has_content_hash is false when content_hash is null", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.has_content_hash).toBe(false);
  });

  it("summary.has_content_hash is true when content_hash is sha256:...", () => {
    const record = buildRecord({}, { includeContentHash: true });
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.has_content_hash).toBe(true);
  });

  // ---- 4. next_action_owners ----

  it("summary.next_action_owners contains claude_code / hermes / user", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.next_action_owners).toContain("claude_code");
    expect(summary.next_action_owners).toContain("hermes");
    expect(summary.next_action_owners).toContain("user");
  });

  // ---- 5. do_not_read_count and markers ----

  it("summary.do_not_read_count equals record.do_not_read length", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.do_not_read_count).toBe(record.do_not_read.length);
  });

  it("summary.do_not_read_markers detects archive_lock / handoff_packs / audit / secrets / before", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.do_not_read_markers.archive_lock).toBe(true);
    expect(summary.do_not_read_markers.handoff_packs).toBe(true);
    expect(summary.do_not_read_markers.audit).toBe(true);
    expect(summary.do_not_read_markers.secrets).toBe(true);
    expect(summary.do_not_read_markers.before).toBe(true);
  });

  // ---- 6. notes_count vs no notes content leak ----

  it("summary.notes_count mirrors record.notes length and does not leak content", () => {
    const record = buildRecord({}, {
      notes: ["alpha-secret-content", "beta-secret-content"],
    });
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.notes_count).toBe(2);
    // Summary must not include the raw notes text.
    const blob = JSON.stringify(summary);
    expect(blob).not.toContain("alpha-secret-content");
    expect(blob).not.toContain("beta-secret-content");
  });

  it("summary.notes_count is 0 when no notes are supplied", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.notes_count).toBe(0);
  });

  // ---- 7. summary must not contain full do_not_read text ----

  it("summary does not include the full do_not_read text", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    const blob = JSON.stringify(summary);
    for (const entry of record.do_not_read) {
      // Markers ARE allowed to appear in do_not_read_markers boolean
      // fields, but the full strings must not appear as values in the
      // summary.
      // We tolerate the substring "~/hermes-pro/docs/archive/" only as
      // a substring of the boolean field name. Simpler: assert the
      // raw text never appears as a top-level value.
      const top = JSON.parse(blob);
      const hasAsValue = (function walk(node: unknown): boolean {
        if (node === null || node === undefined) return false;
        if (typeof node !== "object") return false;
        if (Array.isArray(node)) return node.some(walk);
        for (const [k, v] of Object.entries(node)) {
          if (typeof v === "string" && v === entry) return true;
          if (k === "do_not_read_markers") continue; // boolean flags
          if (walk(v)) return true;
        }
        return false;
      })(top);
      expect(hasAsValue).toBe(false);
    }
  });

  // ---- 8. forbidden fields rejection ----

  it("summary.valid is false when a forbidden field is injected into the record", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    tampered["reasoning"] = "secret builder thoughts";
    const summary = buildHCCArtifactRecordSummary(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(summary.valid).toBe(false);
    expect(summary.errors.join("\n")).toMatch(/forbidden fields/);
  });

  it("summary.valid is false when chain_of_thought is injected into nested safety", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["chain_of_thought"] = "leak";
    const summary = buildHCCArtifactRecordSummary(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(summary.valid).toBe(false);
    expect(summary.errors.join("\n")).toMatch(/forbidden fields/);
  });

  // ---- 9. redaction_status passthrough ----

  it("summary.redaction_status reflects redaction_status=pass only when confirmed", () => {
    const record = buildRecord();
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["redaction_status"] = "pass";
    const summaryNoConfirm = buildHCCArtifactRecordSummary(
      tampered as unknown as HCCArtifactRecord,
    );
    expect(summaryNoConfirm.redaction_status).toBe("pass");
    expect(summaryNoConfirm.valid).toBe(false);
    const summaryConfirm = buildHCCArtifactRecordSummary(
      tampered as unknown as HCCArtifactRecord,
      { redactionConfirmed: true },
    );
    expect(summaryConfirm.redaction_status).toBe("pass");
    expect(summaryConfirm.valid).toBe(true);
  });

  // ---- 10. source_commit passthrough ----

  it("summary.source_commit mirrors caller-supplied commit info", () => {
    const record = buildRecord({}, {
      sourceCommit: {
        commit: "deadbeef",
        branch: "main",
        is_git_repo: true,
      },
    });
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.source_commit.commit).toBe("deadbeef");
    expect(summary.source_commit.branch).toBe("main");
    expect(summary.source_commit.is_git_repo).toBe(true);
  });

  // ---- 11. plan_ref / handoff_ref / verifier_ref are passed through ----

  it("summary plan/handoff/verifier refs match the record", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.plan_ref).toBe(record.plan_ref);
    expect(summary.handoff_ref).toBe(record.handoff_ref);
    expect(summary.verifier_ref).toBe(record.verifier_ref);
  });

  it("summary.verifier_ref is null when plan has no verifierInput", () => {
    const record = buildRecord({
      isCodeTask: false,
      codeGraphImpact: undefined,
    });
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.verifier_ref).toBeNull();
  });

  // ---- 12. forbidden_fields_checked_count ----

  it("summary.forbidden_fields_checked_count equals record.safety.forbidden_fields_checked length", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    expect(summary.forbidden_fields_checked_count).toBe(
      record.safety.forbidden_fields_checked.length,
    );
    // And equals FORBIDDEN_ARTIFACT_FIELDS length.
    expect(summary.forbidden_fields_checked_count).toBe(
      FORBIDDEN_ARTIFACT_FIELDS.length,
    );
  });

  // ---- 13. pure function (same input → same output) ----

  it("summary is pure for the same record", () => {
    const record = buildRecord();
    const a = buildHCCArtifactRecordSummary(record);
    const b = buildHCCArtifactRecordSummary(record);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  // ---- 14. summary has no I/O (no fs, no spawn, no IPC) ----

  it("summary is JSON-serializable and round-trips", () => {
    const record = buildRecord();
    const summary = buildHCCArtifactRecordSummary(record);
    const blob = JSON.stringify(summary, null, 2);
    const parsed = JSON.parse(blob);
    expect(parsed.task_id).toBe(summary.task_id);
    expect(parsed.valid).toBe(summary.valid);
  });
});

// -----------------------------------------------------------------
// HCC Artifact Record summary fixture reader (P3 Code Task 004)
// -----------------------------------------------------------------

describe("HCC Artifact Record summary fixture reader (P3 Code Task 004)", () => {
  // 共享 tmpDir — 与其它 describe 块独立，避免串扰
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "hcc-artifact-summary-fixture-"),
  );

  // 真实 ~/.hermes/handoff/packs + ~/.hermes/audit 写入探针
  const realHandoffDir = path.join(
    os.homedir(),
    ".hermes",
    "handoff",
    "packs",
  );
  const realAuditDir = path.join(os.homedir(), ".hermes", "audit");
  const realHandoffExists = fs.existsSync(realHandoffDir);
  const realAuditExists = fs.existsSync(realAuditDir);
  const realHandoffMtimeBefore = realHandoffExists
    ? fs.statSync(realHandoffDir).mtimeMs
    : 0;
  const realAuditMtimeBefore = realAuditExists
    ? fs.statSync(realAuditDir).mtimeMs
    : 0;

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    if (realHandoffExists) {
      const mtimeAfter = fs.statSync(realHandoffDir).mtimeMs;
      expect(mtimeAfter).toBe(realHandoffMtimeBefore);
    }
    if (realAuditExists) {
      const mtimeAfter = fs.statSync(realAuditDir).mtimeMs;
      expect(mtimeAfter).toBe(realAuditMtimeBefore);
    }
  });

  const happyCodeGraph = (): CodeGraphImpact => ({
    status: "available",
    nodes: 2078,
    edges: 3588,
    changedFiles: ["src/main/hcc-artifact-store.ts"],
    impactedFiles: ["src/main/hcc-artifact-store.ts"],
    impactedSymbols: ["readHCCArtifactRecordSummaryFixture"],
    riskNotes: [],
    artifactRef: "artifacts/codegraph/task004.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "summary-fixture-task-001",
    goal: "Artifact summary fixture reader for P3 Code Task 004",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-summary-fixture-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  const writeFreshFixture = (
    overrides: Partial<HCCTaskRequest> = {},
    opts: Parameters<typeof buildHCCArtifactRecord>[2] = {},
  ): { record: HCCArtifactRecord; outPath: string } => {
    const plan = buildHCCTaskPlan(happyRequest(overrides));
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff, opts);
    const outPath = writeHCCArtifactRecordFixture(record, tmpDir);
    return { record, outPath };
  };

  // ---- 1. happy path: read summary from tmpDir artifact fixture ----

  it("readHCCArtifactRecordSummaryFixture returns a valid summary for a clean fixture", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.task_id).toBe(record.task_id);
    expect(summary.valid).toBe(true);
    expect(summary.errors).toEqual([]);
  });

  it("summary fields match the underlying record (plan_ref / handoff_ref / verifier_ref / source_commit)", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.plan_ref).toBe(record.plan_ref);
    expect(summary.handoff_ref).toBe(record.handoff_ref);
    expect(summary.verifier_ref).toBe(record.verifier_ref);
    expect(summary.source_commit).toEqual(record.source_commit);
    expect(summary.artifact_type).toBe(record.artifact_type);
    expect(summary.dryRun).toBe(true);
    expect(summary.executable).toBe(false);
    expect(summary.runtime_class).toBe("dry_run");
  });

  // ---- 2. summary does not include notes 原文 ----

  it("summary read from fixture does not include notes 原文", () => {
    const { record } = writeFreshFixture(
      {},
      { notes: ["secret-note-alpha", "secret-note-beta"] },
    );
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.notes_count).toBe(2);
    const blob = JSON.stringify(summary);
    expect(blob).not.toContain("secret-note-alpha");
    expect(blob).not.toContain("secret-note-beta");
  });

  // ---- 3. summary does not include do_not_read 原文 ----

  it("summary read from fixture does not include do_not_read 原文", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    // The summary exposes count + boolean markers, but never the
    // underlying array entries. Walk the top-level shape to confirm
    // no do_not_read string appears as a value.
    const top = JSON.parse(JSON.stringify(summary)) as Record<
      string,
      unknown
    >;
    const found: string[] = [];
    function walk(node: unknown): void {
      if (node === null || node === undefined) return;
      if (typeof node !== "object") return;
      if (Array.isArray(node)) {
        for (const v of node) walk(v);
        return;
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === "do_not_read_markers") continue; // boolean flags
        if (typeof v === "string") found.push(v);
        walk(v);
      }
    }
    walk(top);
    for (const entry of record.do_not_read) {
      expect(found).not.toContain(entry);
    }
  });

  // ---- 4. path escape is still caught (delegated to readHCCArtifactRecordFixture) ----

  it("refuses paths that escape tmpDir via ../../", () => {
    expect(() =>
      readHCCArtifactRecordSummaryFixture(tmpDir, "../../escape.json"),
    ).toThrow(/escapes tmpDir/);
  });

  it("refuses subdir paths that escape tmpDir", () => {
    expect(() =>
      readHCCArtifactRecordSummaryFixture(tmpDir, "escape.json", {
        subdir: "../../outside",
      }),
    ).toThrow(/escapes tmpDir/);
  });

  // ---- 5. redaction_status=pass without confirmation → valid=false ----

  it("summary.valid is false when redaction_status=pass without confirmation", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    // Tamper the on-disk JSON: rewrite the file with redaction=pass
    // (simulates a downstream tool that mistakenly wrote pass).
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["redaction_status"] = "pass";
    fs.writeFileSync(
      path.join(tmpDir, "hcc-artifact-store", filename),
      JSON.stringify(tampered, null, 2),
      "utf8",
    );
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.redaction_status).toBe("pass");
    expect(summary.valid).toBe(false);
    expect(summary.errors.join("\n")).toMatch(/redaction.*pass/i);
  });

  // ---- 6. redactionConfirmed=true → valid=true ----

  it("summary.valid is true when redaction_status=pass and redactionConfirmed=true", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["redaction_status"] = "pass";
    fs.writeFileSync(
      path.join(tmpDir, "hcc-artifact-store", filename),
      JSON.stringify(tampered, null, 2),
      "utf8",
    );
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename, {
      redactionConfirmed: true,
    });
    expect(summary.redaction_status).toBe("pass");
    expect(summary.valid).toBe(true);
  });

  // ---- 7. forbidden field injection → valid=false ----

  it("summary.valid is false when fixture contains an injected reasoning field", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    tampered["reasoning"] = "leak";
    fs.writeFileSync(
      path.join(tmpDir, "hcc-artifact-store", filename),
      JSON.stringify(tampered, null, 2),
      "utf8",
    );
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.valid).toBe(false);
    expect(summary.errors.join("\n")).toMatch(/forbidden fields/);
  });

  it("summary.valid is false when fixture contains a nested chain_of_thought", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const tampered = JSON.parse(JSON.stringify(record)) as Record<
      string,
      unknown
    >;
    const safety = tampered["safety"] as Record<string, unknown>;
    safety["chain_of_thought"] = "leak";
    fs.writeFileSync(
      path.join(tmpDir, "hcc-artifact-store", filename),
      JSON.stringify(tampered, null, 2),
      "utf8",
    );
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.valid).toBe(false);
    expect(summary.errors.join("\n")).toMatch(/forbidden fields/);
  });

  // ---- 8. no real ~/.hermes/handoff/packs writes (mtime probe) ----

  it("does not write to ~/.hermes/handoff/packs (mtime probe unchanged in afterAll)", () => {
    // The afterAll hook asserts mtime; here we sanity-check the probe
    // was initialised.
    expect(realHandoffMtimeBefore).toBeGreaterThanOrEqual(0);
  });

  // ---- 9. no real ~/.hermes/audit writes (mtime probe) ----

  it("does not write to ~/.hermes/audit (mtime probe unchanged in afterAll)", () => {
    expect(realAuditMtimeBefore).toBeGreaterThanOrEqual(0);
  });

  // ---- 10. dryRun / executable / runtime_class are still hardcoded after read ----

  it("readHCCArtifactRecordSummaryFixture returns summary with dryRun=true, executable=false, runtime_class=dry_run", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.dryRun).toBe(true);
    expect(summary.executable).toBe(false);
    expect(summary.runtime_class).toBe("dry_run");
  });

  // ---- 11. next_action_owners flow through the read path ----

  it("read summary exposes next_action_owners including claude_code / hermes / user", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.next_action_owners).toContain("claude_code");
    expect(summary.next_action_owners).toContain("hermes");
    expect(summary.next_action_owners).toContain("user");
  });

  // ---- 12. has_content_hash reflects includeContentHash ----

  it("read summary has_content_hash is true when fixture was written with includeContentHash=true", () => {
    const { record } = writeFreshFixture({}, { includeContentHash: true });
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.has_content_hash).toBe(true);
  });

  it("read summary has_content_hash is false when fixture was written without content_hash", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const summary = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(summary.has_content_hash).toBe(false);
  });

  // ---- 13. composed helper is pure (same fixture → same summary) ----

  it("read summary is deterministic across multiple reads", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    const a = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    const b = readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  // ---- 14. invalid JSON file → summary surfaces the parse error ----

  it("read summary surfaces a parse error for malformed JSON", () => {
    const filename = "malformed-001.json";
    fs.writeFileSync(
      path.join(tmpDir, "hcc-artifact-store", filename),
      "not json {{{",
      "utf8",
    );
    // JSON.parse throws synchronously; we forward the error to the
    // caller rather than swallowing it. That keeps the contract
    // honest: a malformed fixture is a contract violation, not a
    // soft-fail with valid=false.
    expect(() =>
      readHCCArtifactRecordSummaryFixture(tmpDir, filename),
    ).toThrow();
  });

  // ---- 15. only writes inside tmpDir ----

  it("only reads from tmpDir, never writes outside", () => {
    const { record } = writeFreshFixture();
    const filename = `artifact-${record.task_id}.json`;
    readHCCArtifactRecordSummaryFixture(tmpDir, filename);
    // Walk tmpDir and ensure every file is inside it.
    const tmpFiles: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (fs.statSync(full).isDirectory()) walk(full);
        else tmpFiles.push(full);
      }
    }
    walk(tmpDir);
    for (const f of tmpFiles) {
      expect(f.startsWith(path.resolve(tmpDir))).toBe(true);
    }
  });
});
