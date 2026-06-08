import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createAuditLogStore } from "../../src/main/safety/audit-log";
import { checkActionGate } from "../../src/main/safety/action-gate";
import type { AuditEntry } from "@shared/lib/safety/types";

const TASK_ID = "action-gate-test-001";

describe("checkActionGate", () => {
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-action-gate-test-"));
  const filePath = path.join(tmpDir, `${TASK_ID}.jsonl`);

  beforeAll(() => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  // -----------------------------------------------------------------
  // 1. allow: low-risk read by trusted_user
  // -----------------------------------------------------------------

  it("returns allow for read action by trusted_user", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "read-vault-summary",
      actionType: "read",
      sourceTrust: "trusted_user",
      requestedCapability: "read_public",
      userHasConfirmed: false,
      actor: "hermes",
      context: "test: trusted_user read",
      evidenceRef: "ag-evid-001",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.isIrreversible).toBe(false);
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 2. deny: capability exceeds trust ceiling
  // -----------------------------------------------------------------

  it("returns deny when untrusted_external requests write_project", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "write-memory",
      actionType: "write",
      sourceTrust: "untrusted_external",
      requestedCapability: "write_project",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: untrusted_external write_project",
      evidenceRef: "ag-evid-002",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("not allowed"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("returns deny when archive_locked requests write", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "write-file",
      actionType: "write",
      sourceTrust: "archive_locked",
      requestedCapability: "write_artifact",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: archive_locked write",
      evidenceRef: "ag-evid-003",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 3. require_user_approval: irreversible action without user confirmation
  // -----------------------------------------------------------------

  it("returns require_user_approval for irreversible delete without confirm", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "delete-artifact",
      actionType: "delete",
      sourceTrust: "trusted_user",
      requestedCapability: "write_artifact",
      userHasConfirmed: false,
      actor: "hermes",
      context: "test: delete without confirm",
      evidenceRef: "ag-evid-004",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("require_user_approval");
    expect(result.isIrreversible).toBe(true);
    expect(result.reasons.some((r) => r.includes("irreversible"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("returns allow for irreversible delete with user confirmation", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "delete-artifact",
      actionType: "delete",
      sourceTrust: "trusted_user",
      requestedCapability: "write_artifact",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: delete with confirm",
      evidenceRef: "ag-evid-005",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.isIrreversible).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 4. deny: external / privileged actions by untrusted_external
  // -----------------------------------------------------------------

  it("denies external publish by untrusted_external", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "post-webhook",
      actionType: "publish",
      sourceTrust: "untrusted_external",
      requestedCapability: "external_publish",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: untrusted_external publish",
      evidenceRef: "ag-evid-006",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("untrusted_external"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("denies privileged execute by untrusted_external", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "run-shell",
      actionType: "execute",
      sourceTrust: "untrusted_external",
      requestedCapability: "run_command",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: untrusted_external execute",
      evidenceRef: "ag-evid-007",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 5. deny: archive_locked cannot perform destructive / privileged actions
  // -----------------------------------------------------------------

  it("denies delete by archive_locked", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "delete-file",
      actionType: "delete",
      sourceTrust: "archive_locked",
      requestedCapability: "write_artifact",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: archive_locked delete",
      evidenceRef: "ag-evid-008",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("archive_locked"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("denies execute by archive_locked", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "run-command",
      actionType: "execute",
      sourceTrust: "archive_locked",
      requestedCapability: "run_command",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: archive_locked execute",
      evidenceRef: "ag-evid-009",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 6. require_user_approval: external publish without confirm
  // -----------------------------------------------------------------

  it("returns require_user_approval for publish without confirm", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "post-webhook",
      actionType: "publish",
      sourceTrust: "trusted_user",
      requestedCapability: "external_publish",
      userHasConfirmed: false,
      actor: "hermes",
      context: "test: publish without confirm",
      evidenceRef: "ag-evid-010",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("require_user_approval");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 7. audit entry is written and hash chain is verifiable (uses tmpDir store)
  // -----------------------------------------------------------------

  it("writes an action_gate audit entry with correct fields", () => {
    const store = createAuditLogStore({ auditDir: tmpDir });
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "read-vault-summary",
      actionType: "read",
      sourceTrust: "trusted_user",
      requestedCapability: "read_public",
      userHasConfirmed: false,
      actor: "hermes",
      context: "test: audit entry action_gate",
      evidenceRef: "ag-evid-011",
      auditDir: tmpDir,  // write to tmpDir so we can read it back
    });

    const chain = store.read(TASK_ID);
    const entry = chain.find(
      (e) => e.event === "action_gate" && e.evidence_ref === "ag-evid-011",
    );

    expect(entry).toBeDefined();
    expect(entry!.seq).toBeGreaterThanOrEqual(0);
    expect(entry!.prev_hash).toHaveLength(64);
    expect(entry!.entry_hash).toHaveLength(64);
    expect(entry!.actor).toBe("hermes");
    expect(entry!.decision).toBe("allow");
    expect(entry!.context.trust_level).toBe("trusted_user");
    expect(entry!.context.requested_capability).toBe("read_public");
    expect(entry!.context.action_type).toBe("read");
    expect(entry!.context.is_irreversible).toBe(false);
    expect(result.chainClean).toBe(-1);
  });

  it("hash chain is clean after multiple action_gate calls", () => {
    const store = createAuditLogStore({ auditDir: tmpDir });

    // Append two entries to establish a chain
    store.append({
      task_id: TASK_ID,
      actor: "hermes",
      event: "action_gate",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "read_public",
        allowed_capability_set: ["read_public"],
        matched_rule: "trust_ceiling",
        allowlist_hit: null,
        path_check: "not_applicable" as const,
        risk_level: "low" as const,
        action_type: "read" as const,
        is_irreversible: false,
      },
      evidence_ref: "ag-chain-001",
    });
    store.append({
      task_id: TASK_ID,
      actor: "hermes",
      event: "action_gate",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "read_local",
        allowed_capability_set: ["read_public", "read_local"],
        matched_rule: "trust_ceiling",
        allowlist_hit: null,
        path_check: "not_applicable" as const,
        risk_level: "medium" as const,
        action_type: "read" as const,
        is_irreversible: false,
      },
      evidence_ref: "ag-chain-002",
    });

    expect(store.verify(TASK_ID)).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 8. shared/types.ts has no Node-only imports
  // -----------------------------------------------------------------

  it("shared/types.ts contains only TypeScript types (no Node.js imports)", () => {
    const projectRoot = path.join(__dirname, "..", "..");
    const typesPath = path.join(projectRoot, "src", "shared", "lib", "safety", "types.ts");
    const content = fs.readFileSync(typesPath, "utf8");

    const nodeKeywords = [
      "require(",
      "import * as fs",
      "import * as path",
      "import * as os",
      "createHash",
      "import crypto",
    ];
    nodeKeywords.forEach((kw) => {
      expect(content.includes(kw)).toBe(false);
    });
  });

  // -----------------------------------------------------------------
  // 9. actionGateCheck does NOT bypass trust ceiling
  //    (userHasConfirmed does not override capability check done first)
  // -----------------------------------------------------------------

  it("denies semi_trusted_local from credential_access even with userHasConfirmed=true", () => {
    const result = checkActionGate({
      taskId: TASK_ID,
      action: "access-key",
      actionType: "privileged",
      sourceTrust: "semi_trusted_local",
      requestedCapability: "credential_access",
      userHasConfirmed: true,  // confirmed, but capability not allowed for trust level
      actor: "hermes",
      context: "test: semi_trusted credential_access confirmed yet denied",
      evidenceRef: "ag-evid-012",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("not allowed"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });
});