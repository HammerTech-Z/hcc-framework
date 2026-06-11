// A-2 HumanApprovalRef 人闸门接线 — 测试（red → green）
//
// 覆盖：
// 1. actor 非 human throw
// 2. verified=true throw
// 3. 7 reject paths: no anchor / revoked / task mismatch / artifact mismatch / gate mismatch / newer-than-reflection / expired
// 4. matching human anchor → verified=true
// 5. audit 写入 tmpDir（不写 ~/.hermes），符合现有 AuditEntry schema
// 6. 静态断言 adapter 不引用 DEFAULT_AUDIT_DIR / defaultAppendAuditEntry

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import type {
  HumanApprovalRef,
  HumanApprovalConsumerGate,
} from "../../src/shared/lib/post-task-reflection-contract";
import type {
  HumanApprovalAnchorRecord,
} from "../../src/shared/lib/post-task-reflection-human-approval-anchor-design";

import { confirmHumanApproval } from "../../src/main/safety/human-approval-gate";

// vitest 在不同环境下 __dirname 不可靠；用绝对路径锚定 adapter 文件
const ADAPTER_PATH = "/Users/midoudou/hermes-pro-a2-human-approval-gate/src/main/safety/human-approval-gate.ts";

// ── fixtures ────────────────────────────────────────────────────────────────

const TEST_GATE: HumanApprovalConsumerGate = "user_authorization";

const REF: HumanApprovalRef = {
  ref: "anchor://user/2026-06-11/test-1",
  content_hash: "sha256-deadbeef-test-1",
  verified: false,
};

const REFLECTION_TASK_ID = "HERMES-A2-test-001";
const ARTIFACT_REF = "artifact://test/result-1";
const CREATED_AT = "2026-06-11T10:00:00.000Z";

const ANCHOR_APPROVED_AT = "2026-06-11T09:00:00.000Z"; // < CREATED_AT

function matchingAnchor(overrides: Partial<HumanApprovalAnchorRecord> = {}): HumanApprovalAnchorRecord {
  return {
    anchor_ref: "anchor-1",
    human_approval_ref: REF,
    reflection_task_id: REFLECTION_TASK_ID,
    artifact_ref: ARTIFACT_REF,
    approved_at: ANCHOR_APPROVED_AT,
    expires_at: null,
    allowed_gates: [TEST_GATE],
    revoked: false,
    ...overrides,
  };
}

function baseInput() {
  return {
    human_approval_ref: REF,
    gate: TEST_GATE,
    reflection_task_id: REFLECTION_TASK_ID,
    artifact_ref: ARTIFACT_REF,
    created_at: CREATED_AT,
    actor: "human" as const,
  };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe("A-2 HumanApprovalGate", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hag-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 1. AI/programmatic path
  it("rejects actor !== 'human'", () => {
    expect(() =>
      confirmHumanApproval(
        { ...baseInput(), actor: "ai" as unknown as "human" },
        { anchors: [matchingAnchor()], auditDir: tmpDir },
      ),
    ).toThrow(/only actor='human'/);
  });

  // 2. verified=true
  it("rejects human_approval_ref.verified !== false", () => {
    expect(() =>
      confirmHumanApproval(
        {
          ...baseInput(),
          human_approval_ref: {
            ...REF,
            verified: true as unknown as false,
          },
        },
        { anchors: [matchingAnchor()], auditDir: tmpDir },
      ),
    ).toThrow(/verified must remain false/);
  });

  // 3. 7 reject paths
  describe("rejects when anchor mismatches", () => {
    it.each<[string, HumanApprovalAnchorRecord | null]>([
      ["no matching anchor", null],
      ["anchor revoked", matchingAnchor({ revoked: true })],
      ["task id mismatch", matchingAnchor({ reflection_task_id: "OTHER" })],
      [
        "artifact ref mismatch",
        matchingAnchor({ artifact_ref: "artifact://other" }),
      ],
      [
        "gate not allowed",
        matchingAnchor({ allowed_gates: ["retrieval_feedback_simulation"] }),
      ],
      [
        "anchor newer than reflection",
        matchingAnchor({ approved_at: "2026-06-11T11:00:00.000Z" }),
      ],
      [
        "anchor expired",
        matchingAnchor({ expires_at: "2026-01-01T00:00:00.000Z" }),
      ],
    ])("rejects: %s", (_label, anchor) => {
      const result = confirmHumanApproval(baseInput(), {
        anchors: anchor ? [anchor] : [],
        auditDir: tmpDir,
      });
      expect(result.verified).toBe(false);
      expect(result.verified).not.toBe(true);
    });
  });

  // 4. matching human anchor → verified=true
  it("accepts matching human anchor → verified=true", () => {
    const result = confirmHumanApproval(baseInput(), {
      anchors: [matchingAnchor()],
      auditDir: tmpDir,
    });
    expect(result.verified).toBe(true);
    expect(result.reason).toMatch(/human_approval_ref matched/);
  });

  // 5. audit 写入 tmpDir, AuditEntry schema 合规
  describe("audit log writes", () => {
    it("writes JSONL to auditDir (NOT ~/.hermes) with AuditEntry schema", () => {
      confirmHumanApproval(baseInput(), {
        anchors: [matchingAnchor()],
        auditDir: tmpDir,
      });
      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".jsonl"));
      expect(files.length).toBe(1);
      expect(files[0]).toBe(`${REFLECTION_TASK_ID}.jsonl`);
      const content = fs.readFileSync(path.join(tmpDir, files[0]!), "utf-8").trim();
      const lines = content.split("\n");
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const entry = JSON.parse(lines[0]!);
      // AuditEntry baseline
      expect(entry).toHaveProperty("seq");
      expect(entry).toHaveProperty("prev_hash");
      expect(entry).toHaveProperty("entry_hash");
      expect(entry).toHaveProperty("ts");
      expect(entry).toHaveProperty("task_id");
      expect(entry.task_id).toBe(REFLECTION_TASK_ID);
      expect(entry).toHaveProperty("actor");
      expect(entry.actor).toBe("user"); // AuditActor union
      expect(entry).toHaveProperty("event");
      expect(entry).toHaveProperty("decision");
      expect(entry.decision).toBe("allow"); // verified=true → allow
      expect(entry).toHaveProperty("context");
      // 关键: 顶层不应有 verified_result 字段
      expect(entry).not.toHaveProperty("verified_result");
      // context baseline 字段全在
      expect(entry.context).toHaveProperty("trust_level", "trusted_user");
      expect(entry.context).toHaveProperty("requested_capability", "credential_access");
      expect(entry.context).toHaveProperty("allowed_capability_set");
      expect(entry.context.allowed_capability_set).toContain("credential_access");
      expect(entry.context).toHaveProperty("matched_rule");
      expect(entry.context.matched_rule).toMatch(/actor=human/);
      expect(entry.context).toHaveProperty("allowlist_hit", REF.ref);
      expect(entry.context).toHaveProperty("path_check", "not_applicable");
      expect(entry.context).toHaveProperty("risk_level", "high");
      // resource_type 字段承载人批事件元数据
      expect(entry.context).toHaveProperty("resource_type", "gateway");
      expect(entry.context).toHaveProperty("resource_id", `human-approval:${REF.ref}`);
    });

    it("writes decision=deny when verifier rejects", () => {
      confirmHumanApproval(baseInput(), {
        anchors: [matchingAnchor({ revoked: true })],
        auditDir: tmpDir,
      });
      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".jsonl"));
      expect(files[0]).toBe(`${REFLECTION_TASK_ID}.jsonl`);
      const content = fs.readFileSync(path.join(tmpDir, files[0]!), "utf-8").trim();
      const entry = JSON.parse(content.split("\n")[0]!);
      expect(entry.decision).toBe("deny");
    });

    it("does NOT write to ~/.hermes", () => {
      const homeHermesAudit = path.join(os.homedir(), ".hermes", "audit");
      const homeHermesAuditMtimeBefore = safeMtime(homeHermesAudit);
      confirmHumanApproval(baseInput(), {
        anchors: [matchingAnchor()],
        auditDir: tmpDir,
      });
      const homeHermesAuditMtimeAfter = safeMtime(homeHermesAudit);
      expect(homeHermesAuditMtimeAfter).toBe(homeHermesAuditMtimeBefore);
      expect(fs.existsSync(path.join(tmpDir, `${REFLECTION_TASK_ID}.jsonl`))).toBe(true);
    });
  });

  // 5b. auditDir 校验
  describe("auditDir validation", () => {
    it("rejects empty auditDir", () => {
      expect(() =>
        confirmHumanApproval(baseInput(), {
          anchors: [matchingAnchor()],
          auditDir: "",
        }),
      ).toThrow(/auditDir/);
    });

    it("rejects auditDir containing .hermes segment", () => {
      const hermesPaths = [
        "/Users/x/.hermes/audit-x",
        "/tmp/.hermes/nested",
        "/var/root/.hermes",
      ];
      for (const p of hermesPaths) {
        expect(() =>
          confirmHumanApproval(baseInput(), {
            anchors: [matchingAnchor()],
            auditDir: p,
          }),
        ).toThrow(/~?\/?\.hermes|\.hermes/);
      }
    });
  });

  // 6. 静态断言
  describe("static: adapter does not touch default audit store", () => {
    it("does not import DEFAULT_AUDIT_DIR or defaultAppendAuditEntry", async () => {
      const adapterSrc = await fs.promises.readFile(ADAPTER_PATH, "utf-8");
      expect(adapterSrc).not.toMatch(/DEFAULT_AUDIT_DIR/);
      expect(adapterSrc).not.toMatch(/defaultAppendAuditEntry/);
      expect(adapterSrc).not.toMatch(/set-anchor/);
      expect(adapterSrc).not.toMatch(/set-verified/);
    });

    it("uses restricted path segment check (segments.includes(...)) instead of literal", async () => {
      const adapterSrc = await fs.promises.readFile(ADAPTER_PATH, "utf-8");
      // 验证存在路径段检测逻辑（symbols / constants 形式）
      expect(adapterSrc).toMatch(/segments\.includes|RESTRICTED_PATH_SEGMENTS/);
      // 验证审计落库只用 createAuditLogStore 显式传 auditDir
      expect(adapterSrc).toMatch(/createAuditLogStore\(\s*\{\s*auditDir/);
    });
  });
});

function safeMtime(p: string): number | null {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return null;
  }
}