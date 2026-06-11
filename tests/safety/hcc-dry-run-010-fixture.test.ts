// A-4 dry-run010 — A-1 HCCTaskHandoffPlan + A-2 confirmHumanApproval 的首个消费者
//
// 范围（独立 worktree `a4-dry-run-010-20260611`）：
// - 仅 fixtures/ + 1 test 文件 + 1 closeout 报告
// - 不改 src/main / src/renderer / src/screens / package.json
// - 不启动 Auto Executor（静态断言禁 spawn/exec/runPlaybook 符号）
// - artifact 仅写 tmpDir；audit log 仅写 tmpDir；零 ~/.hermes/** 写入
//
// 测试覆盖：
// 1. plan.json 通过 validateHCCTaskHandoffPlan（schema_version + in_progress + append_only baseline）
// 2. handoff.json dry_run=true + executable=false + runtime_class=dry_run
// 3. progress-round-1.json 包含 4 段（changed_this_round / last_successful_command / current_blocker / next_plan）
// 4. artifact.json 含 source_commits + forbidden_fields_absent
// 5. 危险矩阵：assertNoDangerPolicyAutoApproval().passed === true
// 6. Auto Executor NOT started：test 源码不含 spawn/exec/runPlaybook 符号
// 7. A-2 actor=human 通过；actor=ai throw
// 8. audit 写入 tmpDir，不写 ~/.hermes/audit/

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  validateHCCTaskHandoffPlan,
  validateHCCProgressRecord,
  assertNoDangerPolicyAutoApproval,
  type HCCTaskHandoffPlan,
  type HCCProgressRecord,
} from "../../src/shared/lib/safety/hcc-task-handoff-policy";

import {
  confirmHumanApproval,
  type HumanApprovalGateOptions,
  type HumanApprovalGateConfirmInput,
} from "../../src/main/safety/human-approval-gate";

import type { HumanApprovalAnchorRecord } from "../../src/shared/lib/post-task-reflection-human-approval-anchor-design";

// 用 import.meta.url 解析当前文件目录，避免 hardcoded worktree absolute path
const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const HERE_DIR = path.dirname(TEST_FILE_PATH);
const FIXTURES_DIR = path.join(HERE_DIR, "__fixtures__", "dry-run-010");

function loadFixture<T>(name: string): T {
  const p = path.join(FIXTURES_DIR, name);
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
}

// ── fixtures ────────────────────────────────────────────────────────────────

const PLAN: HCCTaskHandoffPlan = loadFixture<HCCTaskHandoffPlan>("plan.json");
const PROGRESS_R1: HCCProgressRecord = loadFixture<HCCProgressRecord>("progress-round-1.json");

// 人类 anchor — fixture 中按 task_id="DRY-RUN-010" 匹配
const REFLECTION_TASK_ID = "DRY-RUN-010";
const ARTIFACT_REF = "tests/safety/__fixtures__/dry-run-010/artifact.json";
const CREATED_AT = "2026-06-11T17:00:00.000Z";
const APPROVED_AT = "2026-06-11T16:30:00.000Z"; // < CREATED_AT

const HUMAN_REF = {
  ref: "anchor://user/2026-06-11/dry-run-010-1",
  content_hash: "sha256-dry-run-010-anchor-1",
  verified: false as const,
};

const MATCHING_ANCHOR: HumanApprovalAnchorRecord = {
  anchor_ref: "anchor-dry-run-010",
  human_approval_ref: HUMAN_REF,
  reflection_task_id: REFLECTION_TASK_ID,
  artifact_ref: ARTIFACT_REF,
  approved_at: APPROVED_AT,
  expires_at: null,
  allowed_gates: ["next_task_context"],
  revoked: false,
};

function baseHumanInput(): HumanApprovalGateConfirmInput {
  return {
    human_approval_ref: HUMAN_REF,
    gate: "next_task_context",
    reflection_task_id: REFLECTION_TASK_ID,
    artifact_ref: ARTIFACT_REF,
    created_at: CREATED_AT,
    actor: "human" as const,
  };
}

// ── tests ───────────────────────────────────────────────────────────────────

describe("A-4 dry-run010 — fixture contract (A-1 + A-2 first consumer)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dry-run-010-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // 1. plan fixture validates against A-1 contract
  it("plan.json validates against HCCTaskHandoffPlan (schema_version, single in_progress, append-only baseline)", () => {
    const result = validateHCCTaskHandoffPlan(PLAN);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(PLAN.schema_version).toBe("1.0.0");
    expect(PLAN.in_progress.status).toBe("in_progress");
    expect(PLAN.completed_baseline.every((b) => b.verified === true)).toBe(true);
    expect(PLAN.completed_baseline.every((b) => b.append_only === true)).toBe(true);
    // 单 in_progress：plan.in_progress 是 object（非 array）
    expect(Array.isArray(PLAN.in_progress)).toBe(false);
  });

  // 2. handoff fixture carries dry_run=true + executable=false
  it("handoff.json declares dry_run=true, executable=false, runtime_class=dry_run", () => {
    const handoff = loadFixture<Record<string, unknown>>("handoff.json");
    expect(handoff.executable).toBe(false);
    expect(handoff.dry_run).toBe(true);
    expect(handoff.runtime_class).toBe("dry_run");
    // forbidden_actions 显式列出 spawn / exec / runPlaybook
    expect(Array.isArray(handoff.forbidden_actions)).toBe(true);
    expect(handoff.forbidden_actions as string[]).toEqual(
      expect.arrayContaining(["spawn", "exec", "runPlaybook"]),
    );
  });

  // 3. progress round-1 has all 4 required sections
  it("progress-round-1.json contains 4 required sections + non-empty next_plan", () => {
    const result = validateHCCProgressRecord(PROGRESS_R1);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(PROGRESS_R1.schema_version).toBe("1.0.0");
    expect(PROGRESS_R1.changed_this_round.length).toBeGreaterThanOrEqual(1);
    expect(PROGRESS_R1.next_plan.length).toBeGreaterThan(0);
    expect(PROGRESS_R1.current_blocker).toBeNull();
    expect(PROGRESS_R1.last_successful_command).not.toBeNull();
    expect(PROGRESS_R1.last_successful_command?.trust_level).toBe("single_run");
  });

  // 4. artifact fixture contains source_commits + forbidden_fields_absent
  it("artifact.json carries source_commits + forbidden_fields_absent + dry_run=true", () => {
    const artifact = loadFixture<Record<string, unknown>>("artifact.json");
    expect(artifact.dry_run).toBe(true);
    expect(artifact.executable).toBe(false);
    expect(artifact.runtime_class).toBe("dry_run");
    expect(Array.isArray(artifact.source_commits)).toBe(true);
    expect((artifact.source_commits as string[]).length).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(artifact.forbidden_fields_absent)).toBe(true);
    expect(artifact.forbidden_fields_absent as string[]).toEqual(
      expect.arrayContaining(["reasoning", "chain_of_thought"]),
    );
  });

  // 5. danger matrix rejects AI self-approval paths
  it("danger matrix has no AI self-approval path (assertNoDangerPolicyAutoApproval.passed)", () => {
    const result = assertNoDangerPolicyAutoApproval();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // 6. Auto Executor NOT started — static check on test file
  it("Auto Executor NOT started: this test file contains no spawn/exec/runPlaybook symbols", async () => {
    const src = await fs.promises.readFile(TEST_FILE_PATH, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\brunPlaybook\s*\(/);
    expect(src).not.toMatch(/ipcMain\.handle\s*\(\s*['"]hcc/);
    expect(src).not.toMatch(/BrowserWindow\.create/);
  });

  // 7. A-2 actor=human 通过 (matching anchor)
  describe("A-2 confirmHumanApproval adapter", () => {
    it("actor=human with matching anchor → verified=true", () => {
      const opts: HumanApprovalGateOptions = {
        anchors: [MATCHING_ANCHOR],
        auditDir: tmpDir,
      };
      const result = confirmHumanApproval(baseHumanInput(), opts);
      expect(result.verified).toBe(true);
      expect(result.reason).toMatch(/human_approval_ref matched/);
    });

    it("actor=ai rejected (throw)", () => {
      const opts: HumanApprovalGateOptions = {
        anchors: [MATCHING_ANCHOR],
        auditDir: tmpDir,
      };
      const aiInput: HumanApprovalGateConfirmInput = {
        ...baseHumanInput(),
        actor: "ai" as unknown as "human",
      };
      expect(() => confirmHumanApproval(aiInput, opts)).toThrow(/only actor='human'/);
    });

    it("verified=true on human_approval_ref rejected (throw)", () => {
      const opts: HumanApprovalGateOptions = {
        anchors: [MATCHING_ANCHOR],
        auditDir: tmpDir,
      };
      const forgedInput: HumanApprovalGateConfirmInput = {
        ...baseHumanInput(),
        human_approval_ref: {
          ...HUMAN_REF,
          verified: true as unknown as false,
        },
      };
      expect(() => confirmHumanApproval(forgedInput, opts)).toThrow(/verified must remain false/);
    });

    it("missing anchor → verified=false (no throw)", () => {
      const opts: HumanApprovalGateOptions = { anchors: [], auditDir: tmpDir };
      const result = confirmHumanApproval(baseHumanInput(), opts);
      expect(result.verified).toBe(false);
    });

    it("rejected anchor (no matching allowed_gates) → verified=false", () => {
      const wrongGateAnchor: HumanApprovalAnchorRecord = {
        ...MATCHING_ANCHOR,
        allowed_gates: ["ranking_input"],
      };
      const opts: HumanApprovalGateOptions = {
        anchors: [wrongGateAnchor],
        auditDir: tmpDir,
      };
      const result = confirmHumanApproval(baseHumanInput(), opts);
      expect(result.verified).toBe(false);
    });

    it("revoked anchor → verified=false", () => {
      const revokedAnchor: HumanApprovalAnchorRecord = {
        ...MATCHING_ANCHOR,
        revoked: true,
      };
      const opts: HumanApprovalGateOptions = {
        anchors: [revokedAnchor],
        auditDir: tmpDir,
      };
      const result = confirmHumanApproval(baseHumanInput(), opts);
      expect(result.verified).toBe(false);
    });
  });

  // 8. audit 写 tmpDir, 不写 ~/.hermes/audit
  describe("audit persistence boundary", () => {
    it("writes JSONL to auditDir (NOT ~/.hermes/audit), AuditEntry schema compliant", () => {
      const opts: HumanApprovalGateOptions = {
        anchors: [MATCHING_ANCHOR],
        auditDir: tmpDir,
      };
      confirmHumanApproval(baseHumanInput(), opts);
      const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".jsonl"));
      expect(files.length).toBe(1);
      expect(files[0]).toBe(`${REFLECTION_TASK_ID}.jsonl`);
      const content = fs.readFileSync(path.join(tmpDir, files[0]!), "utf-8").trim();
      const lines = content.split("\n");
      const entry = JSON.parse(lines[0]!);
      // AuditEntry baseline
      expect(entry).toHaveProperty("task_id", REFLECTION_TASK_ID);
      expect(entry).toHaveProperty("actor", "user");
      expect(entry).toHaveProperty("event");
      expect(entry).toHaveProperty("decision", "allow");
      expect(entry).toHaveProperty("context");
      expect(entry.context).toHaveProperty("trust_level", "trusted_user");
      expect(entry.context).toHaveProperty("matched_rule");
      expect(entry.context.matched_rule).toMatch(/human_approval_gate/);
    });

    it("does NOT write to ~/.hermes/audit (safeMtime unchanged)", () => {
      const homeAudit = path.join(os.homedir(), ".hermes", "audit");
      const mtimeBefore = safeMtime(homeAudit);
      const opts: HumanApprovalGateOptions = {
        anchors: [MATCHING_ANCHOR],
        auditDir: tmpDir,
      };
      confirmHumanApproval(baseHumanInput(), opts);
      const mtimeAfter = safeMtime(homeAudit);
      expect(mtimeAfter).toBe(mtimeBefore);
    });

    it("refuses restricted-path-segment auditDir (no literal .hermes in code)", async () => {
      // adapter 通过 split('/') 后 includes('.hermes') 判禁 — 不允许路径段含 .hermes
      const opts: HumanApprovalGateOptions = {
        anchors: [MATCHING_ANCHOR],
        auditDir: path.join(os.tmpdir(), ".hermes", "nested-test"),
      };
      expect(() => confirmHumanApproval(baseHumanInput(), opts)).toThrow(/restricted/i);
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