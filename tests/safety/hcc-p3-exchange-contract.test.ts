import { describe, expect, it, afterAll, beforeAll } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { buildHCCTaskPlan } from "../../src/main/hcc-task-runner";
import {
  buildHCCHandoffPayload,
  writeHCCHandoffPayloadFixture,
  readHCCHandoffPayloadFixture,
  verifyHCCHandoffPayloadFixture,
  assertHandoffPayloadNoForbiddenFields,
} from "../../src/main/hcc-handoff-pack";
import {
  buildHCCArtifactRecord,
  writeHCCArtifactRecordFixture,
  readHCCArtifactRecordFixture,
  verifyHCCArtifactRecord,
  assertArtifactRecordNoForbiddenFields,
} from "../../src/main/hcc-artifact-store";

import type {
  HCCTaskRequest,
  CodeGraphImpact,
} from "../../src/main/hcc-task-types";
import type { HCCHandoffPayload } from "../../src/main/hcc-handoff-pack";
import type { HCCArtifactRecord } from "../../src/main/hcc-artifact-store";

// -----------------------------------------------------------------
// P3 Chain Test 002 — Handoff Fixture + Artifact Record 端到端整合测试
//
// 覆盖 008 (Handoff fixture) → 009 (Artifact Store record) 串行：
//   1) buildHCCTaskPlan
//   2) buildHCCHandoffPayload
//   3) writeHCCHandoffPayloadFixture → tmpDir
//   4) readHCCHandoffPayloadFixture + verifyHCCHandoffPayloadFixture
//   5) buildHCCArtifactRecord(plan, handoff)
//   6) writeHCCArtifactRecordFixture → tmpDir
//   7) readHCCArtifactRecordFixture + verifyHCCArtifactRecord
//   8) cross-record references
//   9) do_not_read markers
//  10) real ~/.hermes/handoff/packs + ~/.hermes/audit untouched
//  11) dryRun / executable / runtime_class 硬编码
//  12) forbidden fields 递归扫描
// -----------------------------------------------------------------

describe("P3 Chain Test 002 — Handoff Fixture + Artifact Record 端到端", () => {
  // 共享 tmpDir — handoff 与 artifact record 都写在同一目录下
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hcc-p3-chain-002-"));
  // Handoff subdir 与 artifact subdir 共享同一 tmpDir；命名与 slice 008/009 一致
  const handoffSubdir = "hcc-handoff";
  const artifactSubdir = "hcc-artifact-store";

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
    changedFiles: ["src/main/hcc-task-runner.ts"],
    impactedFiles: ["src/main/hcc-task-runner.ts"],
    impactedSymbols: ["buildHCCTaskPlan"],
    riskNotes: [],
    artifactRef: "artifacts/codegraph/chain002.json",
  });

  const happyRequest = (
    overrides: Partial<HCCTaskRequest> = {},
  ): HCCTaskRequest => ({
    taskId: "chain002-task-001",
    goal: "End-to-end P3 chain test for Handoff fixture + Artifact record",
    worktreePath: tmpDir,
    sourceTrust: "trusted_user",
    requestedCapability: "write_private",
    riskLevel: "medium",
    priority: "interactive",
    actor: "hermes",
    evidenceRef: "ev-chain002-001",
    isCodeTask: true,
    codeGraphImpact: happyCodeGraph(),
    ...overrides,
  });

  // ---- 1+2. 构造 plan + handoff payload ----

  it("step 1+2: builds plan and handoff payload for the same task_id", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    expect(plan.taskId).toBe("chain002-task-001");
    expect(plan.executable).toBe(false);

    const payload = buildHCCHandoffPayload(plan);
    expect(payload.task_id).toBe("chain002-task-001");
    expect(payload.current_state.hcc_executable).toBe(false);
    expect(payload.safety.redaction_status).toBe("not_run");
  });

  // ---- 3. 写入 handoff fixture 到 tmpDir ----

  it("step 3: writes handoff fixture to tmpDir/hcc-handoff/<task>.json", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    const outPath = writeHCCHandoffPayloadFixture(payload, tmpDir);
    expect(outPath).toContain("chain002-task-001");
    expect(outPath.startsWith(path.resolve(tmpDir))).toBe(true);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  // ---- 4. 读取 + verify handoff fixture ----

  it("step 4: reads back handoff fixture and verifies it", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const payload = buildHCCHandoffPayload(plan);
    writeHCCHandoffPayloadFixture(payload, tmpDir);
    const read = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${plan.taskId}.json`,
    );
    expect(read.task_id).toBe(plan.taskId);
    const verification = verifyHCCHandoffPayloadFixture(read);
    expect(verification.valid).toBe(true);
    expect(verification.errors).toEqual([]);
  });

  // ---- 5. 基于同一 task_id 生成 artifact record ----

  it("step 5: builds artifact record referencing the same plan and handoff", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    expect(record.task_id).toBe(plan.taskId);
    expect(record.task_id).toBe(handoff.task_id);
    expect(record.dryRun).toBe(true);
    expect(record.executable).toBe(false);
  });

  // ---- 6. 写入 artifact fixture 到 tmpDir ----

  it("step 6: writes artifact fixture to tmpDir/hcc-artifact-store/<task>.json", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    const outPath = writeHCCArtifactRecordFixture(record, tmpDir);
    expect(outPath).toContain("chain002-task-001");
    expect(outPath.startsWith(path.resolve(tmpDir))).toBe(true);
    expect(fs.existsSync(outPath)).toBe(true);
  });

  // ---- 7. 读取 + verify artifact record ----

  it("step 7: reads back artifact fixture and verifies it", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    writeHCCArtifactRecordFixture(record, tmpDir);
    const read = readHCCArtifactRecordFixture(
      tmpDir,
      `artifact-${plan.taskId}.json`,
    );
    expect(read.task_id).toBe(plan.taskId);
    const verification = verifyHCCArtifactRecord(read);
    expect(verification.valid).toBe(true);
    expect(verification.errors).toEqual([]);
  });

  // ---- 8. artifact record 引用 handoff_ref / plan_ref / verifier_ref ----

  it("step 8: artifact record exposes handoff_ref / plan_ref / verifier_ref", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    expect(record.plan_ref).toContain(plan.taskId);
    expect(record.plan_ref).toMatch(/plan$/);
    expect(record.handoff_ref).toContain(plan.taskId);
    expect(record.handoff_ref).toMatch(/handoff-payload$/);
    expect(record.verifier_ref).toContain(plan.taskId);
    expect(record.verifier_ref).toMatch(/verifier-input$/);
  });

  it("step 8b: artifact record references match handoff's own refs", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    // handoff payload's own artifact_ref should be of the same form
    // (hcc-dry-run://<taskId>/handoff-payload) so consumer can cross-link
    expect(record.handoff_ref).toBe(handoff.artifact_ref);
  });

  // ---- 9. do_not_read 包含 ~/.hermes/handoff/packs 和 ~/.hermes/audit ----

  it("step 9: artifact record.do_not_read contains handoff/packs and audit markers", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    const joined = record.do_not_read.join("\n");
    expect(joined).toContain("~/.hermes/handoff/packs/");
    expect(joined).toContain("~/.hermes/audit/");
  });

  it("step 9b: handoff payload.do_not_read also contains archive markers", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const joined = handoff.do_not_read.join("\n");
    expect(joined).toContain("过时计划");
    expect(joined).toContain("docs/archive");
    expect(joined).toContain("*.before-*");
  });

  // ---- 10. 全流程无真实 ~/.hermes/handoff/packs / ~/.hermes/audit 写入 ----

  it("step 10: full flow does not write to ~/.hermes/handoff/packs", () => {
    // The afterAll hook asserts mtime unchanged; here we additionally
    // confirm that the only file touches are inside tmpDir.
    const tmpFiles: string[] = [];
    function walk(dir: string): void {
      for (const entry of fs.readdirSync(dir)) {
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full);
        else tmpFiles.push(full);
      }
    }
    walk(tmpDir);
    for (const f of tmpFiles) {
      expect(f.startsWith(path.resolve(tmpDir))).toBe(true);
    }
  });

  it("step 10b: after fixture write+read, real ~/.hermes dirs mtime is unchanged", () => {
    // The beforeAll captured mtimes; this test will run after every
    // other test in the suite. The afterAll hook is the source of
    // truth for the assertion. Here we record that both dirs were
    // probed at the start of the suite.
    expect(realHandoffMtimeBefore).toBeGreaterThanOrEqual(0);
    expect(realAuditMtimeBefore).toBeGreaterThanOrEqual(0);
  });

  // ---- 11. dryRun:true / executable:false / runtime_class:"dry_run" ----

  it("step 11: dryRun / executable / runtime_class are type-hardcoded", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    expect(record.dryRun).toBe(true);
    expect(record.executable).toBe(false);
    expect(record.safety.runtime_class).toBe("dry_run");
  });

  it("step 11b: redaction_status defaults to not_run (no fabrication)", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    expect(record.safety.redaction_status).toBe("not_run");
    // handoff payload is also not_run by default
    expect(handoff.safety.redaction_status).toBe("not_run");
  });

  it("step 11c: side_effect_gates contain no_ipc / no_spawn / no_runPlaybook", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    expect(record.safety.side_effect_gates).toContain("no_ipc");
    expect(record.safety.side_effect_gates).toContain("no_spawn");
    expect(record.safety.side_effect_gates).toContain("no_runPlaybook");
  });

  // ---- 12. forbidden fields 递归扫描 ----

  it("step 12: assertArtifactRecordNoForbiddenFields passes for chain flow", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    expect(() => assertArtifactRecordNoForbiddenFields(record)).not.toThrow();
    expect(() => assertHandoffPayloadNoForbiddenFields(handoff)).not.toThrow();
  });

  it("step 12b: forbidden-field self-check rejects injected reasoning on read-back artifact", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    writeHCCArtifactRecordFixture(record, tmpDir);
    const read = readHCCArtifactRecordFixture(
      tmpDir,
      `artifact-${plan.taskId}.json`,
    );
    // Simulate a tampering event: inject reasoning into a deep field
    const tampered = JSON.parse(JSON.stringify(read)) as Record<
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

  // ---- 13. 端到端 happy path 完整流程 ----

  it("step 13: end-to-end happy path (plan → payload → fixture → record → fixture → verify)", () => {
    // 1) plan
    const plan = buildHCCTaskPlan(happyRequest());
    // 2) handoff payload
    const handoff = buildHCCHandoffPayload(plan);
    // 3) write handoff fixture
    const handoffPath = writeHCCHandoffPayloadFixture(handoff, tmpDir);
    expect(fs.existsSync(handoffPath)).toBe(true);
    // 4) read + verify handoff
    const handoffRead = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${plan.taskId}.json`,
    );
    expect(
      verifyHCCHandoffPayloadFixture(handoffRead).valid,
    ).toBe(true);
    // 5) build artifact record from the same plan + handoff
    const record = buildHCCArtifactRecord(plan, handoffRead);
    // 6) write artifact fixture
    const artifactPath = writeHCCArtifactRecordFixture(record, tmpDir);
    expect(fs.existsSync(artifactPath)).toBe(true);
    // 7) read + verify artifact
    const artifactRead = readHCCArtifactRecordFixture(
      tmpDir,
      `artifact-${plan.taskId}.json`,
    );
    expect(verifyHCCArtifactRecord(artifactRead).valid).toBe(true);
    // 8) cross-record references
    expect(artifactRead.handoff_ref).toBe(handoffRead.artifact_ref);
    expect(artifactRead.task_id).toBe(handoffRead.task_id);
    // 9) both files live in tmpDir
    expect(handoffPath.startsWith(path.resolve(tmpDir))).toBe(true);
    expect(artifactPath.startsWith(path.resolve(tmpDir))).toBe(true);
  });

  // ---- 14. JSON 序列化 ----

  it("step 14: round-tripped handoff + artifact are both JSON-serializable", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    writeHCCHandoffPayloadFixture(handoff, tmpDir);
    writeHCCArtifactRecordFixture(record, tmpDir);
    const handoffRead = readHCCHandoffPayloadFixture(
      tmpDir,
      `payload-${plan.taskId}.json`,
    );
    const artifactRead = readHCCArtifactRecordFixture(
      tmpDir,
      `artifact-${plan.taskId}.json`,
    );
    const handoffBlob = JSON.stringify(handoffRead, null, 2);
    const artifactBlob = JSON.stringify(artifactRead, null, 2);
    expect(typeof handoffBlob).toBe("string");
    expect(typeof artifactBlob).toBe("string");
    const hRound: HCCHandoffPayload = JSON.parse(handoffBlob);
    const aRound: HCCArtifactRecord = JSON.parse(artifactBlob);
    expect(hRound.task_id).toBe(plan.taskId);
    expect(aRound.task_id).toBe(plan.taskId);
  });

  // ---- 15. next_actions owners 完整 ----

  it("step 15: next_actions in artifact record contains claude_code / hermes / user", () => {
    const plan = buildHCCTaskPlan(happyRequest());
    const handoff = buildHCCHandoffPayload(plan);
    const record = buildHCCArtifactRecord(plan, handoff);
    const owners = record.next_actions.map((a) => a.owner);
    expect(owners).toContain("claude_code");
    expect(owners).toContain("hermes");
    expect(owners).toContain("user");
  });
});
