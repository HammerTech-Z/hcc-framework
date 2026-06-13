import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
// UI-ARCHIVE-001: source moved to _archive (historical reference, not active route).
const bailongmaSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/_archive/BaiLongma/BaiLongma.tsx"),
  "utf-8",
);

describe("BaiLongma status sync", () => {
  it("shows the current P2/P2.5/P3 status from NEXT_STEP", () => {
    expect(bailongmaSrc).toContain("BaiLongma 主驾驶舱升级 — PASS");
    expect(bailongmaSrc).toContain("安全基座 — PASS");
    expect(bailongmaSrc).toContain(
      "dry-run 001-006 + 008 + 009 + harness 8 artifact — PASS / real execution paused",
    );
  });

  it("does not show stale stage labels from the old P2 cockpit state", () => {
    expect(bailongmaSrc).not.toContain("BaiLongma 主驾驶舱升级 — 进行中");
    expect(bailongmaSrc).not.toContain("安全基座 — 待定");
    expect(bailongmaSrc).not.toContain("后续阶段 — 待定");
    expect(bailongmaSrc).not.toContain("dry-run baseline + harness — PASS / real execution paused");
  });

  it("keeps production and execution boundaries visible", () => {
    expect(bailongmaSrc).toContain("P3 真实执行入口仍需用户单独批准");
    expect(bailongmaSrc).toContain("BaiLongma Productionization 仍未批准");
  });

  it("reflects P3.5 Hermes Agent soft switch active + hard cutover not approved", () => {
    expect(bailongmaSrc).toContain("Hermes Agent soft switch ACTIVE");
    expect(bailongmaSrc).toContain("hard cutover 未批准");
    expect(bailongmaSrc).toContain("P3.5 soft switch 观察期内仅 read-only");
  });

  it("reflects P7 WeChat/iLink low-priority local delivery remediation", () => {
    expect(bailongmaSrc).toContain("P7");
    expect(bailongmaSrc).toContain("WeChat/iLink 低优先级 4 job deliver=local");
    expect(bailongmaSrc).toContain("WeChat/iLink — 低优先级 4 个 cron job 已切 deliver=local");
  });

  it("marks BaiLongma Productionization as NOT APPROVED in stage + risks", () => {
    expect(bailongmaSrc).toContain("BaiLongma Productionization — NOT APPROVED");
    expect(bailongmaSrc).toContain("BaiLongma Productionization — NOT APPROVED（仅允许只读增强）");
  });

  it("marks HCC Auto Executor as paused in risks + next actions", () => {
    expect(bailongmaSrc).toContain("HCC Auto Executor — paused");
    expect(bailongmaSrc).toContain("HCC Auto Executor paused");
  });

  it("forbids stale P2-only cockpit badge", () => {
    expect(bailongmaSrc).not.toContain("P2 主驾驶舱");
  });

  it("forbids stale WeChat/iLink 仍需 C/F 投递策略决策 next-action line", () => {
    expect(bailongmaSrc).not.toContain("WeChat/iLink 仍需 C/F 投递策略决策");
  });

  it("forbids execution-triggering terms in source (read-only invariant)", () => {
    // Invariant: source must not actually CALL any of these (read-only cockpit).
    // References inside risk-text reminders like "不调用 runPlaybook" are allowed.
    const invocations = [
      "runPlaybook(",
      "triggerCronJob(",
      "sendMessage(",
      "config.set",
      "config edit",
      "config.set(",
    ];
    for (const forbidden of invocations) {
      expect(bailongmaSrc).not.toContain(forbidden);
    }
    // Hard "approval state" forbidden phrases (must never appear as available/approved):
    for (const forbidden of [
      "HCC Auto Executor 已可用",
      "Productionization 已批准",
      "hard cutover 已完成",
    ]) {
      expect(bailongmaSrc).not.toContain(forbidden);
    }
    // Positive: source explicitly references each forbidden term in a forbid context.
    expect(bailongmaSrc).toContain("不调用 runPlaybook");
  });
});
