import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  installAutoExecutorHost,
  getInstalledAutoExecutorHost,
  __resetAutoExecutorBootstrapForTests,
} from "../../src/main/auto-executor-bootstrap";
import {
  armInstalledHost,
  __resetAutoExecutorArmForTests,
} from "../../src/main/auto-executor-arm";
import {
  startInstalledHost,
  __resetAutoExecutorStartForTests,
} from "../../src/main/auto-executor-start";
import {
  submitDryRunAction,
  getActionPostureReport,
  __resetAutoExecutorActionForTests,
  __recordActionResult,
  type DryRunActionRequest,
} from "../../src/main/auto-executor-dry-run-action";
import { mintArmToken } from "../../src/shared/lib/auto-executor";

const HEAD_SHA = "0c086cb8ef22a2430d4b13400f0c0504b1f6c139";
const TOKEN_SECRET = "action-test-secret-not-real";

function setupFullRunning() {
  const config = {
    pinnedState: {
      expectedRepoRoot: "/tmp/wt-hcc-action",
      expectedBranch: "hcc-auto-executor-action-001",
      expectedHead: HEAD_SHA,
      expectedCwd: "/tmp/wt-hcc-action",
    },
    tokenSecret: TOKEN_SECRET,
    goRecordSha: HEAD_SHA,
    mode: "dry_run" as const,
  };
  installAutoExecutorHost(config);
  armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
  startInstalledHost();
}

function makeReq(overrides: Partial<DryRunActionRequest> = {}): DryRunActionRequest {
  return {
    task_id: "T-001",
    worktree_isolated: true,
    single_branch: true,
    single_commit_candidate: true,
    action_class: "isolated_worktree_write",
    ...overrides,
  };
}

describe("action slice: state gating", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    __resetAutoExecutorActionForTests();
  });

  it("action refused when host not installed", () => {
    expect(() => submitDryRunAction(makeReq())).toThrow(/not installed/);
  });

  it("action refused from constructed", () => {
    installAutoExecutorHost({
      pinnedState: {
        expectedRepoRoot: "/tmp/wt-hcc-action-c",
        expectedBranch: "hcc-auto-executor-action-001",
        expectedHead: HEAD_SHA,
        expectedCwd: "/tmp/wt-hcc-action-c",
      },
      tokenSecret: TOKEN_SECRET,
      goRecordSha: HEAD_SHA,
      mode: "dry_run",
    });
    expect(() => submitDryRunAction(makeReq())).toThrow(/must be in.*running/);
  });

  it("action refused from armed", () => {
    installAutoExecutorHost({
      pinnedState: {
        expectedRepoRoot: "/tmp/wt-hcc-action-a",
        expectedBranch: "hcc-auto-executor-action-001",
        expectedHead: HEAD_SHA,
        expectedCwd: "/tmp/wt-hcc-action-a",
      },
      tokenSecret: TOKEN_SECRET,
      goRecordSha: HEAD_SHA,
      mode: "dry_run",
    });
    armInstalledHost(mintArmToken(HEAD_SHA, TOKEN_SECRET));
    expect(() => submitDryRunAction(makeReq())).toThrow(/must be in.*running/);
  });

  it("action refused from aborted", () => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    installAutoExecutorHost({
      pinnedState: {
        expectedRepoRoot: "/tmp/wt-hcc-action-ab",
        expectedBranch: "hcc-auto-executor-action-001",
        expectedHead: HEAD_SHA,
        expectedCwd: "/tmp/wt-hcc-action-ab",
      },
      tokenSecret: TOKEN_SECRET,
      goRecordSha: HEAD_SHA,
      mode: "dry_run",
    });
    // Direct abort via the host boundary (bypass arm).
    const host = getInstalledAutoExecutorHost()!;
    host.abort("test-abort");
    expect(host.state()).toBe("aborted");
    expect(() => submitDryRunAction(makeReq())).toThrow(/must be in.*running/);
  });

  it("action accepted from running", () => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    __resetAutoExecutorActionForTests();
    setupFullRunning();
    const r = submitDryRunAction(makeReq());
    expect(r.would_execute).toBe(false);
    expect(r.host_state).toBe("running");
  });
});

describe("action slice: result invariants (literal-false / literal-0)", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    __resetAutoExecutorActionForTests();
    setupFullRunning();
  });

  it("result: would_execute=false", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.would_execute).toBe(false);
  });

  it("result: executed_commands=[]", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.executed_commands).toEqual([]);
  });

  it("result: subprocess_count=0, max_subprocess_count=0", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.subprocess_count).toBe(0);
    expect(r.max_subprocess_count).toBe(0);
  });

  it("result: artifact_kind='dry_run_action'", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.artifact_kind).toBe("dry_run_action");
  });

  it("result: verifier_required=true", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.verifier_required).toBe(true);
  });

  it("result: next_step='P3_010_CONTROLLED_WORKTREE_DRY_RUN'", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.next_step).toBe("P3_010_CONTROLLED_WORKTREE_DRY_RUN");
  });

  it("result: schema_version='1.0.0'", () => {
    const r = submitDryRunAction(makeReq());
    expect(r.schema_version).toBe("1.0.0");
  });
});

describe("action slice: admission gating", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    __resetAutoExecutorActionForTests();
    setupFullRunning();
  });

  it("deny on non-isolated worktree", () => {
    expect(() =>
      submitDryRunAction(makeReq({ worktree_isolated: false })),
    ).toThrow(/denied/);
  });

  it("requires_user_approval for dangerous classes (no throw — result carries signal)", () => {
    for (const cls of [
      "install_dependency",
      "file_deletion",
      "external_publish",
      "credential_access",
      "browser_action",
      "live_apply",
    ] as const) {
      __resetAutoExecutorActionForTests();
      const r = submitDryRunAction(makeReq({ action_class: cls }));
      expect(r.admission.decision).toBe("requires_user_approval");
      expect(r.would_execute).toBe(false);
    }
  });

  it("__recordActionResult tracks dangerous actions in posture", () => {
    const r = submitDryRunAction(makeReq({ action_class: "file_deletion" }));
    __recordActionResult(r);
    const p = getActionPostureReport();
    expect(p!.any_dangerous_action).toBe(true);
  });
});

describe("action slice: posture invariants", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
    __resetAutoExecutorArmForTests();
    __resetAutoExecutorStartForTests();
    __resetAutoExecutorActionForTests();
    setupFullRunning();
  });

  it("posture: any_command_executed=false", () => {
    submitDryRunAction(makeReq());
    const p = getActionPostureReport();
    expect(p!.any_command_executed).toBe(false);
  });

  it("posture: total_subprocess_count=0", () => {
    submitDryRunAction(makeReq());
    const p = getActionPostureReport();
    expect(p!.total_subprocess_count).toBe(0);
  });

  it("posture: next_step='P3_010_CONTROLLED_WORKTREE_DRY_RUN'", () => {
    submitDryRunAction(makeReq());
    const p = getActionPostureReport();
    expect(p!.next_step).toBe("P3_010_CONTROLLED_WORKTREE_DRY_RUN");
  });

  it("posture: actions_submitted tracks count", () => {
    submitDryRunAction(makeReq({ task_id: "T-1" }));
    submitDryRunAction(makeReq({ task_id: "T-2" }));
    const p = getActionPostureReport();
    expect(p!.actions_submitted).toBe(2);
  });
});

describe("action slice: src/main/auto-executor-dry-run-action.ts static guard", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const src = readFileSync(resolve(REPO_ROOT, "src/main/auto-executor-dry-run-action.ts"), "utf8");

  it("does NOT call spawn / exec / child_process", () => {
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bspawn\s*\(/);
    expect(stripped).not.toMatch(/child_process/);
  });

  it("does NOT register any IPC channel", () => {
    expect(src).not.toMatch(/ipcMain\.(?:handle|on)\s*\(/);
  });

  it("does NOT start any cron / timer / interval", () => {
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT write ~/.hermes", () => {
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/~\/\.hermes/);
  });
});

describe("action slice: no auto-action on app boot", () => {
  const REPO_ROOT = resolve(__dirname, "../..");
  const idx = readFileSync(resolve(REPO_ROOT, "src/main/index.ts"), "utf8");

  it("src/main/index.ts does NOT import auto-executor-dry-run-action", () => {
    expect(idx).not.toMatch(/from\s*["']\.\/auto-executor-dry-run-action["']/);
  });

  it("src/main/index.ts does NOT call submitDryRunAction", () => {
    expect(idx).not.toMatch(/submitDryRunAction\s*\(/);
  });
});