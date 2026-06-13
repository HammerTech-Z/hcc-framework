import { describe, it, expect, beforeEach } from "vitest";

import {
  createAutoExecutorHost,
  type AutoExecutorHost,
  type AutoExecutorHostConfig,
  type HostHealth,
  type HostStatus,
} from "../../src/main/auto-executor-host";
import { mintArmToken } from "../../src/shared/lib/auto-executor";

const PINNED_HEAD = "39e974508e7935d7775acb8d484bb97a45564ae7";
const TOKEN_SECRET = "test-secret-not-real-do-not-use";
const GO_SHA = PINNED_HEAD;

function makeConfig(overrides: Partial<AutoExecutorHostConfig> = {}): AutoExecutorHostConfig {
  return {
    pinnedState: {
      expectedRepoRoot: "/tmp/wt-hcc-exec-impl",
      expectedBranch: "hcc-auto-executor-exec-impl-001",
      expectedHead: PINNED_HEAD,
      expectedCwd: "/tmp/wt-hcc-exec-impl",
    },
    tokenSecret: TOKEN_SECRET,
    goRecordSha: GO_SHA,
    mode: "dry_run",
    ...overrides,
  };
}

function makeLive(overrides: Partial<{
  repoRoot: string;
  branch: string;
  head: string;
  cwd: string;
  dirtyPaths: string[];
}> = {}) {
  return {
    repoRoot: "/tmp/wt-hcc-exec-impl",
    branch: "hcc-auto-executor-exec-impl-001",
    head: PINNED_HEAD,
    cwd: "/tmp/wt-hcc-exec-impl",
    dirtyPaths: [],
    ...overrides,
  };
}

describe("host lifecycle — exec-preflight §5 contract", () => {
  let host: AutoExecutorHost;

  beforeEach(() => {
    host = createAutoExecutorHost(makeConfig());
  });

  // §5.1: Construction without state change
  it("construction does not change state (initial = constructed)", () => {
    expect(host.state()).toBe("constructed");
    expect(host.health().state).toBe("constructed");
    expect(host.health().alive).toBe(true);
    expect(host.health().subprocess_count).toBe(0);
    expect(host.health().max_subprocess_count).toBe(0);
  });

  // §5.2: Arming with invalid token refuses
  it("arm with invalid token refuses and state stays constructed", () => {
    const ok = host.arm({ goRecordSha: GO_SHA, mac: "00".repeat(32) });
    expect(ok).toBe(false);
    expect(host.state()).toBe("constructed");
  });

  // §5.3: Arming with valid token flips state to armed
  it("arm with valid token flips state to armed", () => {
    const token = mintArmToken(GO_SHA, TOKEN_SECRET);
    const ok = host.arm(token);
    expect(ok).toBe(true);
    expect(host.state()).toBe("armed");
  });

  // §5.4: assertReady respects pinned state (passed through boundary)
  it("assertReady via boundary reflects state, kill switch, worktree guard", () => {
    const token = mintArmToken(GO_SHA, TOKEN_SECRET);
    host.arm(token);
    host.start();
    expect(host.state()).toBe("running");
    // The boundary exposes assertReady; we exercise it via host.boundary().
    const ready = host.boundary().assertReady(makeLive(), "T-1");
    expect(ready.ok).toBe(true);
  });

  // §5.5: start() flips state to running only when armed
  it("start() from constructed returns false", () => {
    expect(host.start()).toBe(false);
    expect(host.state()).toBe("constructed");
  });

  it("start() from armed returns true", () => {
    host.arm(mintArmToken(GO_SHA, TOKEN_SECRET));
    expect(host.start()).toBe(true);
    expect(host.state()).toBe("running");
  });

  // §5.6: action is mock / no-op
  it("runMockAction returns would_execute:false; no spawn occurs", () => {
    const r = host.runMockAction({
      task_id: "T-1",
      worktree_isolated: true,
      single_branch: true,
      single_commit_candidate: true,
      action_class: "isolated_worktree_write",
    });
    expect(r.would_execute).toBe(false);
    expect(r.subprocess_count_after).toBe(0);
    expect(r.admission.decision).toBe("allow");
  });

  // §5.7: abort() is observable
  it("abort() triggers kill switch and sets state to aborted", () => {
    host.arm(mintArmToken(GO_SHA, TOKEN_SECRET));
    host.start();
    host.abort("test-kill");
    expect(host.state()).toBe("aborted");
    expect(host.health().alive).toBe(false);
    expect(host.boundary().killSwitch.isKilled()).toBe(true);
    expect(host.boundary().killSwitch.killReason()).toBe("test-kill");
  });

  // §5.8: disarm() while running is a no-op
  it("disarm() while running is a no-op (state stays running)", () => {
    host.arm(mintArmToken(GO_SHA, TOKEN_SECRET));
    host.start();
    expect(host.state()).toBe("running");
    host.disarm();
    expect(host.state()).toBe("running");
  });
});

describe("host lifecycle — health + status + lease + timeout + rollback", () => {
  let host: AutoExecutorHost;
  beforeEach(() => {
    host = createAutoExecutorHost(makeConfig({ mode: "controlled" }));
  });

  it("health() always reports subprocess_count=0 and max_subprocess_count=0", () => {
    const h: HostHealth = host.health();
    expect(h.subprocess_count).toBe(0);
    expect(h.max_subprocess_count).toBe(0);
    expect(h.mode).toBe("controlled");
    expect(h.sampled_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("status() pins go_record_sha, branch, head, cwd", () => {
    const s: HostStatus = host.status();
    expect(s.go_record_sha).toBe(GO_SHA);
    expect(s.pinned_branch).toBe("hcc-auto-executor-exec-impl-001");
    expect(s.pinned_head).toBe(PINNED_HEAD);
    expect(s.pinned_repo_root).toBe("/tmp/wt-hcc-exec-impl");
    expect(s.pinned_cwd).toBe("/tmp/wt-hcc-exec-impl");
  });

  it("lease: grant → check (valid) → expire → check (invalid)", () => {
    const granted = host.grantLease("T-lease-1");
    expect(granted.is_expired).toBe(false);
    expect(granted.task_id).toBe("T-lease-1");

    const checked = host.checkLease("T-lease-1");
    expect(checked).not.toBeNull();
    expect(checked!.is_expired).toBe(false);

    host.expireLease("T-lease-1");
    const afterExpiry = host.checkLease("T-lease-1");
    expect(afterExpiry!.is_expired).toBe(true);
  });

  it("lease: unknown task_id returns null", () => {
    expect(host.checkLease("T-unknown")).toBeNull();
  });

  it("timeout: defaults are 30min wall-clock + 60s heartbeat", () => {
    const cfg = host.getTimeoutConfig();
    expect(cfg.wall_clock_ms).toBe(30 * 60 * 1000);
    expect(cfg.heartbeat_ms).toBe(60 * 1000);
  });

  it("timeout: setTimeoutConfig replaces values", () => {
    host.setTimeoutConfig({ wall_clock_ms: 5000, heartbeat_ms: 250 });
    expect(host.getTimeoutConfig()).toEqual({
      wall_clock_ms: 5000,
      heartbeat_ms: 250,
    });
  });

  it("rollback: hook is descriptive-only and never executes", () => {
    const r = host.rollbackHook("A-1");
    expect(r.found).toBe(false);
    expect(r.action_id).toBe("A-1");
    expect(r.description).toMatch(/descriptive/i);
  });

  it("runMockAction refuses when admission denies (not isolated)", () => {
    expect(() =>
      host.runMockAction({
        task_id: "T-deny",
        worktree_isolated: false,
        single_branch: true,
        single_commit_candidate: true,
        action_class: "isolated_worktree_write",
      }),
    ).toThrow(/denied/);
  });

  it("runMockAction returns requires_user_approval for dangerous classes (no throw)", () => {
    for (const actionClass of [
      "install_dependency",
      "file_deletion",
      "external_publish",
      "credential_access",
      "browser_action",
      "live_apply",
    ] as const) {
      const r = host.runMockAction({
        task_id: `T-${actionClass}`,
        worktree_isolated: true,
        single_branch: true,
        single_commit_candidate: true,
        action_class: actionClass,
      });
      expect(r.admission.decision).toBe("requires_user_approval");
      expect(r.would_execute).toBe(false);
    }
  });
});

describe("host lifecycle — config validation", () => {
  it("rejects empty tokenSecret", () => {
    expect(() =>
      createAutoExecutorHost(makeConfig({ tokenSecret: "" })),
    ).toThrow(/tokenSecret/);
  });

  it("rejects empty goRecordSha", () => {
    expect(() =>
      createAutoExecutorHost(makeConfig({ goRecordSha: "" })),
    ).toThrow(/goRecordSha/);
  });

  it("rejects unknown host mode", () => {
    expect(() =>
      createAutoExecutorHost(makeConfig({ mode: "live_run" as never })),
    ).toThrow(/host mode/);
  });
});