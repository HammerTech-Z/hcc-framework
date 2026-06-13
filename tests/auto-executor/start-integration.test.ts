import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  installAutoExecutorHost,
  __resetAutoExecutorBootstrapForTests,
} from "../../src/main/auto-executor-bootstrap";
import {
  armInstalledHost,
  __resetAutoExecutorArmForTests,
} from "../../src/main/auto-executor-arm";
import {
  startInstalledHost,
  getStartPostureReport,
  __resetAutoExecutorStartForTests,
} from "../../src/main/auto-executor-start";
import { mintArmToken } from "../../src/shared/lib/auto-executor";

const HEAD_SHA = "cdf8278f2b181400ad67cb043a8bab76b31dea5d";
const TOKEN_SECRET = "start-test-secret-not-real-do-not-use";

function setup() {
  installAutoExecutorHost({
    pinnedState: {
      expectedRepoRoot: "/tmp/wt-hcc-start",
      expectedBranch: "hcc-auto-executor-start-001",
      expectedHead: HEAD_SHA,
      expectedCwd: "/tmp/wt-hcc-start",
    },
    tokenSecret: TOKEN_SECRET,
    goRecordSha: HEAD_SHA,
    mode: "dry_run",
  });
}

function arm() {
  armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
}

describe("start slice: transition flow", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
  });

  it("start from constructed refuses — host not armed", () => {
    setup();
    expect(startInstalledHost()).toBe(false);
    const r = getStartPostureReport();
    expect(r!.boundary_state).toBe("constructed");
    expect(r!.is_running).toBe(false);
    expect(r!.most_recent_attempt!.refused_reason).toContain("cannot_start_from_state");
  });

  it("start from armed succeeds — constructed → armed → running", () => {
    setup();
    arm();
    expect(startInstalledHost()).toBe(true);
    const r = getStartPostureReport();
    expect(r!.boundary_state).toBe("running");
    expect(r!.is_running).toBe(true);
    expect(r!.start_succeeded).toBe(true);
  });

  it("start is one-shot — re-start from running returns false (not idempotent)", () => {
    setup();
    arm();
    expect(startInstalledHost()).toBe(true);
    expect(startInstalledHost()).toBe(false);
    const r = getStartPostureReport();
    expect(r!.boundary_state).toBe("running");
  });

  it("start from aborted refuses", () => {
    setup();
    // aborted = host.abort() without arm first — but abort goes
    // constructed→aborted. Verify start refuses from aborted.
    const host = installAutoExecutorHost({
      pinnedState: {
        expectedRepoRoot: "/tmp/wt-hcc-start-b",
        expectedBranch: "hcc-auto-executor-start-001",
        expectedHead: HEAD_SHA,
        expectedCwd: "/tmp/wt-hcc-start-b",
      },
      tokenSecret: TOKEN_SECRET,
      goRecordSha: HEAD_SHA,
      mode: "dry_run",
    });
    // Need a re-install since beforeEach resets
    host.abort("test");
    // direct abort on constructed host via boundary
    const ok = startInstalledHost();
    // The host's bootstrap handle is frozen but the bootstrap was reset —
    // install again via setup():
    __resetAutoExecutorBootstrapForTests();
    expect(ok).toBe(false);
  });
});

describe("start slice: posture invariants (literal-false / literal-0)", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    setup();
    arm();
    startInstalledHost();
  });

  it("posture: any_action_invoked=false (no runMockAction call possible from start)", () => {
    const r = getStartPostureReport();
    expect(r!.any_action_invoked).toBe(false);
  });

  it("posture: subprocess_count=0 and max_subprocess_count=0 (literal)", () => {
    const r = getStartPostureReport();
    expect(r!.subprocess_count).toBe(0);
    expect(r!.max_subprocess_count).toBe(0);
  });

  it("posture: is_running=true, start_succeeded=true", () => {
    const r = getStartPostureReport();
    expect(r!.is_running).toBe(true);
    expect(r!.start_succeeded).toBe(true);
    expect(r!.boundary_state).toBe("running");
  });

  it("posture: most_recent_attempt records attempted_at and success", () => {
    const r = getStartPostureReport();
    expect(r!.most_recent_attempt).not.toBeNull();
    expect(r!.most_recent_attempt!.succeeded).toBe(true);
    expect(r!.most_recent_attempt!.refused_reason).toBeNull();
    expect(r!.most_recent_attempt!.attempted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("posture: refused attempt records refused_reason", () => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    setup();
    // arm not called → start should refuse
    startInstalledHost();
    const r = getStartPostureReport();
    expect(r!.most_recent_attempt!.succeeded).toBe(false);
    expect(r!.most_recent_attempt!.refused_reason).toContain("cannot_start_from_state");
  });
});

describe("start slice: src/main/auto-executor-start.ts static guard", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const startPath = resolve(REPO_ROOT, "src/main/auto-executor-start.ts");
  const source = readFileSync(startPath, "utf8");

  it("does NOT call runMockAction() — action invocation is held for next slice", () => {
    const stripped = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/(['"`])(?:\\.|(?!\1).)*\1/g, "");
    expect(stripped).not.toMatch(/\brunMockAction\s*\(/);
  });

  it("does NOT call any spawn / exec / child_process", () => {
    expect(source).not.toMatch(/\bspawn\s*\(/);
    expect(source).not.toMatch(/child_process/);
  });

  it("does NOT register any IPC channel", () => {
    expect(source).not.toMatch(/ipcMain\.(?:handle|on)\s*\(/);
  });

  it("does NOT start any cron / timer / interval", () => {
    expect(source).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });
});

describe("start slice: no auto-start on app boot", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const indexSource = readFileSync(resolve(REPO_ROOT, "src/main/index.ts"), "utf8");

  it("src/main/index.ts does NOT import auto-executor-start", () => {
    expect(indexSource).not.toMatch(/from\s*["']\.\/auto-executor-start["']/);
  });

  it("src/main/index.ts does NOT call startInstalledHost()", () => {
    expect(indexSource).not.toMatch(/startInstalledHost\s*\(/);
  });
});