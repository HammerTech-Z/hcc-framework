import { describe, expect, it, beforeAll, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { createAuditLogStore } from "../../src/main/safety/audit-log";
import { checkPreflight } from "../../src/main/safety/preflight";
import type { AuditEntry } from "@shared/lib/safety/types";

const TASK_ID = "preflight-test-001";

describe("checkPreflight", () => {
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "hermes-preflight-test-"));
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
  // 1. riskLevel=low + capability within trust ceiling → allow
  // -----------------------------------------------------------------

  it("returns allow for low-risk read_public by trusted_user", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "read-vault-summary",
      sourceTrust: "trusted_user",
      requestedCapability: "read_public",
      riskLevel: "low",
      actor: "hermes",
      context: "test: trusted_user read_public low risk",
      evidenceRef: "test-evid-001",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.verifierRequired).toBe(false);
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 2. riskLevel=high without userHasConfirmed → require_user_approval
  // -----------------------------------------------------------------

  it("returns require_user_approval for high-risk browser_action without confirm", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "open-tab",
      sourceTrust: "trusted_user",
      requestedCapability: "browser_action",
      riskLevel: "high",
      actor: "hermes",
      context: "test: browser_action high risk without confirm",
      evidenceRef: "test-evid-002",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("require_user_approval");
    expect(result.verifierRequired).toBe(true);
    expect(result.reasons.some((r) => r.includes("high-risk"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("returns allow for medium-risk write_artifact by semi_trusted_local", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "write-local-file",
      sourceTrust: "semi_trusted_local",
      requestedCapability: "write_artifact",
      riskLevel: "medium",
      actor: "hermes",
      context: "test: write_artifact medium risk without confirm",
      evidenceRef: "test-evid-003",
      auditDir: tmpDir,
    });

    // medium-risk does not auto-require approval; follows normal allow/deny logic
    expect(result.decision).toBe("allow");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 3. riskLevel=high + userHasConfirmed=true → allow (if capability allowed)
  // -----------------------------------------------------------------

  it("returns allow for high-risk browser_action when userHasConfirmed=true", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "open-tab",
      sourceTrust: "trusted_user",
      requestedCapability: "browser_action",
      riskLevel: "high",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: browser_action high risk with user confirm",
      evidenceRef: "test-evid-004",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.verifierRequired).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("returns allow for high-risk credential_access when userHasConfirmed=true", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "access-key",
      sourceTrust: "trusted_user",
      requestedCapability: "credential_access",
      riskLevel: "high",
      userHasConfirmed: true,
      actor: "hermes",
      context: "test: credential_access high risk with user confirm",
      evidenceRef: "test-evid-005",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.verifierRequired).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 4. riskLevel=high + userHasConfirmed=true but capability not allowed → deny
  //    (userHasConfirmed does NOT bypass trust ceiling)
  // -----------------------------------------------------------------

  it("returns deny for high-risk + userHasConfirmed when capability exceeds trust ceiling", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "access-key",
      sourceTrust: "semi_trusted_local",
      requestedCapability: "credential_access",
      riskLevel: "high",
      userHasConfirmed: true,  // confirmed by user, but trust ceiling blocks it
      actor: "hermes",
      context: "test: semi_trusted credential_access confirmed yet denied",
      evidenceRef: "test-evid-006",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("not allowed"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 5. deny: capability exceeds trust ceiling (any riskLevel)
  // -----------------------------------------------------------------

  it("returns deny when untrusted_external requests write_project", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "write-memory",
      sourceTrust: "untrusted_external",
      requestedCapability: "write_project",
      riskLevel: "low",
      actor: "hermes",
      context: "test: untrusted_external write_project",
      evidenceRef: "test-evid-007",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("not allowed"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("returns deny when archive_locked requests any capability", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "any-action",
      sourceTrust: "archive_locked",
      requestedCapability: "read_public",
      riskLevel: "low",
      actor: "hermes",
      context: "test: archive_locked read_public",
      evidenceRef: "test-evid-008",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 6. untrusted_external cannot auto-escalate even low-risk
  // -----------------------------------------------------------------

  it("denies untrusted_external from running commands even if low-risk", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "run-shell-command",
      sourceTrust: "untrusted_external",
      requestedCapability: "run_command",
      riskLevel: "low",
      actor: "hermes",
      context: "test: untrusted_external run_command low risk",
      evidenceRef: "test-evid-009",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.reasons.some((r) => r.includes("not allowed"))).toBe(true);
    expect(result.chainClean).toBe(-1);
  });

  it("denies unattended_cron from writing project artifacts", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "write-artifact",
      sourceTrust: "unattended_cron",
      requestedCapability: "write_artifact",
      riskLevel: "low",
      actor: "hermes",
      context: "test: unattended_cron write_artifact",
      evidenceRef: "test-evid-010",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("deny");
    expect(result.chainClean).toBe(-1);
  });

  // -----------------------------------------------------------------
  // 7. audit entry written with risk_level and hash chain verifiable
  // -----------------------------------------------------------------

  it("writes a preflight audit entry with correct fields including risk_level", () => {
    // Use the in-test store (tmpDir) — pass auditDir so checkPreflight writes there
    const store = createAuditLogStore({ auditDir: tmpDir });
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "read-vault-summary",
      sourceTrust: "trusted_user",
      requestedCapability: "read_public",
      riskLevel: "low",
      actor: "hermes",
      context: "test: audit entry with risk_level",
      evidenceRef: "test-evid-011",
      auditDir: tmpDir,  // write to tmpDir so we can read it back
    });

    // Read from the same tmpDir store
    const chain = store.read(TASK_ID);
    const preflightEntry = chain.find(
      (e) => e.event === "preflight" && e.evidence_ref === "test-evid-011",
    );

    expect(preflightEntry).toBeDefined();
    expect(preflightEntry!.seq).toBeGreaterThanOrEqual(0);
    expect(preflightEntry!.prev_hash).toHaveLength(64);
    expect(preflightEntry!.entry_hash).toHaveLength(64);
    expect(preflightEntry!.actor).toBe("hermes");
    expect(preflightEntry!.decision).toBe("allow");
    expect(preflightEntry!.context.trust_level).toBe("trusted_user");
    expect(preflightEntry!.context.requested_capability).toBe("read_public");
    expect(preflightEntry!.context.allowed_capability_set).toContain("read_public");
    expect(preflightEntry!.context.matched_rule).toBe("trust_ceiling");
    expect(preflightEntry!.context.risk_level).toBe("low");
    expect(result.chainClean).toBe(-1);
  });

  it("hash chain is clean after multiple preflight calls", () => {
    const store = createAuditLogStore({ auditDir: tmpDir });
    // Append a few entries via the store directly so we have a chain
    store.append({
      task_id: TASK_ID,
      actor: "hermes",
      event: "preflight",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "read_public",
        allowed_capability_set: ["read_public"],
        matched_rule: "trust_ceiling",
        allowlist_hit: null,
        path_check: "not_applicable" as const,
        risk_level: "low" as const,
      },
      evidence_ref: "test-chain-001",
    });
    store.append({
      task_id: TASK_ID,
      actor: "hermes",
      event: "preflight",
      decision: "allow",
      context: {
        trust_level: "trusted_user",
        requested_capability: "read_local",
        allowed_capability_set: ["read_public", "read_local"],
        matched_rule: "trust_ceiling",
        allowlist_hit: null,
        path_check: "not_applicable" as const,
        risk_level: "medium" as const,
      },
      evidence_ref: "test-chain-002",
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
  // 9. capability-based fallback when riskLevel is absent
  //    (capabilities credential_access / external_publish / browser_action default high)
  // -----------------------------------------------------------------

  it("defaults to high risk for credential_access when riskLevel not specified", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "access-key",
      sourceTrust: "trusted_user",
      requestedCapability: "credential_access",
      // riskLevel omitted — should fall back to high based on capability
      actor: "hermes",
      context: "test: credential_access implicit high",
      evidenceRef: "test-evid-012",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("require_user_approval");
    expect(result.chainClean).toBe(-1);
  });

  it("defaults to low risk for read_local when riskLevel not specified", () => {
    const result = checkPreflight({
      taskId: TASK_ID,
      action: "read-local-file",
      sourceTrust: "trusted_user",
      requestedCapability: "read_local",
      // riskLevel omitted — should be low (not in HIGH_RISK list)
      actor: "hermes",
      context: "test: read_local implicit low",
      evidenceRef: "test-evid-013",
      auditDir: tmpDir,
    });

    expect(result.decision).toBe("allow");
    expect(result.chainClean).toBe(-1);
  });
});