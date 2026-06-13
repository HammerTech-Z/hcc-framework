import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  installAutoExecutorHost,
  __resetAutoExecutorBootstrapForTests,
} from "../../src/main/auto-executor-bootstrap";
import {
  armInstalledHost,
  getArmPostureReport,
  __resetAutoExecutorArmForTests,
} from "../../src/main/auto-executor-arm";
import { mintArmToken } from "../../src/shared/lib/auto-executor";

const HEAD_SHA = "7564030464e784ee33755a7fc2bb9b892d4783bc";
const TOKEN_SECRET = "arm-test-token-secret-not-real-do-not-use";

function makeBootstrapConfig() {
  return {
    pinnedState: {
      expectedRepoRoot: "/tmp/wt-hcc-arm",
      expectedBranch: "hcc-auto-executor-arm-001",
      expectedHead: HEAD_SHA,
      expectedCwd: "/tmp/wt-hcc-arm",
    },
    tokenSecret: TOKEN_SECRET,
    goRecordSha: HEAD_SHA,
    mode: "dry_run" as const,
  };
}

describe("arm slice: token verification", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
  });

  it("arm returns false when no host is installed", () => {
    const ok = armInstalledHost({ goRecordSha: HEAD_SHA, mac: "00".repeat(32) });
    expect(ok).toBe(false);
  });

  it("arm with invalid token refuses — state stays constructed", () => {
    installAutoExecutorHost(makeBootstrapConfig());
    const ok = armInstalledHost({ goRecordSha: HEAD_SHA, mac: "00".repeat(32) });
    expect(ok).toBe(false);
    const report = getArmPostureReport();
    expect(report).not.toBeNull();
    expect(report!.boundary_state).toBe("constructed");
    expect(report!.arm_succeeded).toBe(false);
  });

  it("arm with valid token succeeds — state becomes armed", () => {
    installAutoExecutorHost(makeBootstrapConfig());
    const token = mintArmToken(HEAD_SHA, TOKEN_SECRET);
    const ok = armInstalledHost(token);
    expect(ok).toBe(true);
    const report = getArmPostureReport();
    expect(report!.boundary_state).toBe("armed");
    expect(report!.state_is_armed_or_running).toBe(true);
    expect(report!.arm_succeeded).toBe(true);
  });

  it("arm with wrong secret refuses", () => {
    installAutoExecutorHost(makeBootstrapConfig());
    const token = mintArmToken(HEAD_SHA, "wrong-secret");
    const ok = armInstalledHost(token);
    expect(ok).toBe(false);
    const report = getArmPostureReport();
    expect(report!.boundary_state).toBe("constructed");
  });

  it("re-arm is idempotent (already armed → still armed, returns true)", () => {
    installAutoExecutorHost(makeBootstrapConfig());
    const token = mintArmToken(HEAD_SHA, TOKEN_SECRET);
    expect(armInstalledHost(token)).toBe(true);
    expect(armInstalledHost(token)).toBe(true);
    const report = getArmPostureReport();
    expect(report!.boundary_state).toBe("armed");
  });
});

describe("arm slice: posture invariants (literal-false / literal-0)", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    installAutoExecutorHost(makeBootstrapConfig());
  });

  it("posture: started=false (held for HCC-AUTO-EXECUTOR-START-001)", () => {
    armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
    const r = getArmPostureReport();
    expect(r!.started).toBe(false);
  });

  it("posture: any_action_invoked=false (no runMockAction call possible from arm)", () => {
    armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
    const r = getArmPostureReport();
    expect(r!.any_action_invoked).toBe(false);
  });

  it("posture: subprocess_count=0 and max_subprocess_count=0 (literal)", () => {
    armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
    const r = getArmPostureReport();
    expect(r!.subprocess_count).toBe(0);
    expect(r!.max_subprocess_count).toBe(0);
  });

  it("posture: most_recent_attempt records attempted_at and go_record_sha", () => {
    armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
    const r = getArmPostureReport();
    expect(r!.most_recent_attempt).not.toBeNull();
    expect(r!.most_recent_attempt!.go_record_sha).toBe(HEAD_SHA);
    expect(r!.most_recent_attempt!.succeeded).toBe(true);
    expect(r!.most_recent_attempt!.refused_reason).toBeNull();
    expect(r!.most_recent_attempt!.attempted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("posture: refused attempt records refused_reason", () => {
    armInstalledHost({ goRecordSha: HEAD_SHA, mac: "00".repeat(32) });
    const r = getArmPostureReport();
    expect(r!.most_recent_attempt!.succeeded).toBe(false);
    expect(r!.most_recent_attempt!.refused_reason).toBe("token_verification_failed");
  });
});

describe("arm slice: src/main/auto-executor-arm.ts static guard", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const armPath = resolve(REPO_ROOT, "src/main/auto-executor-arm.ts");
  const source = readFileSync(armPath, "utf8");

  it("does NOT call host.start() — starting is held for HCC-AUTO-EXECUTOR-START-001", () => {
    // Strip comments and string literals before checking — the doc
    // comments mention "host.start()" but the code never invokes it.
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "");
    expect(stripped).not.toMatch(/\bhost\.start\s*\(/);
  });

  it("does NOT call runMockAction()", () => {
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "");
    expect(stripped).not.toMatch(/\brunMockAction\s*\(/);
  });

  it("does NOT register any IPC channel", () => {
    expect(source).not.toMatch(/ipcMain\.(?:handle|on)\s*\(/);
  });

  it("does NOT start any cron / timer / interval", () => {
    expect(source).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });
});

describe("arm slice: src/main/index.ts static guard (no auto-arm on app boot)", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const indexTsPath = resolve(REPO_ROOT, "src/main/index.ts");
  const source = readFileSync(indexTsPath, "utf8");

  it("src/main/index.ts does NOT import auto-executor-arm", () => {
    expect(source).not.toMatch(/from\s*["']\.\/auto-executor-arm["']/);
  });

  it("src/main/index.ts does NOT call armInstalledHost()", () => {
    expect(source).not.toMatch(/armInstalledHost\s*\(/);
  });
});