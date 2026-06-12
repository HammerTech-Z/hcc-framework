import { describe, expect, it } from "vitest";
import {
  assertPinnedStateMatches,
  type PinnedState,
  type LiveState,
} from "../../src/shared/lib/auto-executor/worktree-guard";
import {
  createKillSwitch,
  watchControlFile,
} from "../../src/shared/lib/auto-executor/kill-switch";
import {
  createActionRecord,
  revertAction,
} from "../../src/shared/lib/auto-executor/rollback";

// -----------------------------------------------------------------
// worktree-guard
// -----------------------------------------------------------------

const basePinned: PinnedState = {
  expectedRepoRoot: "/Users/midoudou/hermes-pro",
  expectedBranch: "hermes-pro-main",
  expectedHead: "24b8d108b5ea146ba5745ea3128564bfc10c1b21",
  expectedCwd: "/Users/midoudou/hermes-pro",
};

const matchingLive: LiveState = {
  repoRoot: "/Users/midoudou/hermes-pro",
  branch: "hermes-pro-main",
  head: "24b8d108b5ea146ba5745ea3128564bfc10c1b21",
  cwd: "/Users/midoudou/hermes-pro",
  dirtyPaths: [],
};

describe("§4.2 worktree-guard", () => {
  it("proceeds on exact match (clean tree)", () => {
    const r = assertPinnedStateMatches(basePinned, matchingLive);
    expect(r.ok).toBe(true);
  });

  it("refuses on branch mismatch", () => {
    const r = assertPinnedStateMatches(basePinned, {
      ...matchingLive,
      branch: "feature-branch",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("branchMismatch");
  });

  it("refuses on HEAD sha mismatch", () => {
    const r = assertPinnedStateMatches(basePinned, {
      ...matchingLive,
      head: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("headMismatch");
  });

  it("refuses on cwd mismatch", () => {
    const r = assertPinnedStateMatches(basePinned, {
      ...matchingLive,
      cwd: "/tmp/somewhere-else",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cwdMismatch");
  });

  it("refuses on repoRoot mismatch", () => {
    const r = assertPinnedStateMatches(basePinned, {
      ...matchingLive,
      repoRoot: "/Users/midoudou/other-repo",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("repoRootMismatch");
  });

  it("refuses on non-excluded dirty path", () => {
    const r = assertPinnedStateMatches(basePinned, {
      ...matchingLive,
      dirtyPaths: ["src/main/index.ts"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("nonExcludedDirty");
  });

  it("proceeds when dirty path is policy-excluded", () => {
    const r = assertPinnedStateMatches(
      { ...basePinned, policyExcludedDirtyPaths: [".claude/settings.json"] },
      { ...matchingLive, dirtyPaths: [".claude/settings.json"] },
    );
    expect(r.ok).toBe(true);
  });

  it("proceeds when dirty path is in toleratedDirtyPaths", () => {
    const r = assertPinnedStateMatches(
      { ...basePinned, toleratedDirtyPaths: ["docs/knowledge/vault-health-report-2026-06-12.md"] },
      { ...matchingLive, dirtyPaths: ["docs/knowledge/vault-health-report-2026-06-12.md"] },
    );
    expect(r.ok).toBe(true);
  });

  it("refuses on malformed sha (non-hex)", () => {
    const r = assertPinnedStateMatches(basePinned, {
      ...matchingLive,
      head: "NOT-HEX",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("headMismatch");
  });
});

// -----------------------------------------------------------------
// kill-switch
// -----------------------------------------------------------------

describe("§4.3 kill-switch", () => {
  it("is not killed on construction", () => {
    const ks = createKillSwitch();
    expect(ks.isKilled()).toBe(false);
    expect(ks.killReason()).toBe(null);
  });

  it("triggers on kill() and is idempotent", () => {
    const ks = createKillSwitch();
    ks.kill("manual");
    expect(ks.isKilled()).toBe(true);
    expect(ks.killReason()).toBe("manual");
    ks.kill("second call");
    expect(ks.killReason()).toBe("manual");
  });

  it("aborts the signal", () => {
    const ks = createKillSwitch();
    expect(ks.signal.aborted).toBe(false);
    ks.kill("abort");
    expect(ks.signal.aborted).toBe(true);
  });

  it("dry-run mode does not actually abort", () => {
    const ks = createKillSwitch({ dryRun: true });
    ks.kill("dry");
    expect(ks.signal.aborted).toBe(false);
    expect(ks.isKilled()).toBe(false);
    expect(ks.killReason()).toBe("dry");
  });

  it("control-file check returns false when no path is pinned", () => {
    const ks = createKillSwitch();
    expect(ks.shouldKillFromControlFile()).toBe(false);
  });

  it("control-file check returns false when file does not exist", () => {
    const ks = createKillSwitch({
      controlFilePath: "/tmp/this-file-definitely-does-not-exist-12345",
    });
    expect(ks.shouldKillFromControlFile()).toBe(false);
  });

  it("watchControlFile throws on non-positive interval", () => {
    const ks = createKillSwitch();
    expect(() => watchControlFile(ks, 0)).toThrow();
    expect(() => watchControlFile(ks, -100)).toThrow();
  });
});

// -----------------------------------------------------------------
// rollback
// -----------------------------------------------------------------

describe("§4.4 rollback (composer)", () => {
  it("creates a record with a wrapped revert function", () => {
    let called = 0;
    const rec = createActionRecord({
      type: "test",
      preState: { data: { x: 1 }, capturedAt: "2026-06-13T00:00:00.000Z" },
      postState: { data: { x: 2 }, capturedAt: "2026-06-13T00:00:01.000Z" },
      rawRevert: async (pre) => {
        called += 1;
        expect(pre.data.x).toBe(1);
      },
      id: "rec-1",
    });
    expect(rec.id).toBe("rec-1");
    expect(rec.reverted).toBe(false);
    expect(typeof rec.revertFn).toBe("function");
    // We do not call revertFn yet — just confirm the shape.
    expect(called).toBe(0);
  });

  it("revertAction runs revertFn once and is idempotent", async () => {
    let called = 0;
    const rec = createActionRecord({
      type: "test",
      preState: { data: {}, capturedAt: "2026-06-13T00:00:00.000Z" },
      postState: { data: {}, capturedAt: "2026-06-13T00:00:01.000Z" },
      rawRevert: async () => {
        called += 1;
      },
      id: "rec-2",
    });
    const ranFirst = await revertAction(rec);
    const ranSecond = await revertAction(rec);
    expect(ranFirst).toBe(true);
    expect(ranSecond).toBe(false);
    expect(called).toBe(1);
    expect(rec.reverted).toBe(true);
  });

  it("revertFn is idempotent when called twice sequentially", async () => {
    let called = 0;
    const rec = createActionRecord({
      type: "test",
      preState: { data: {}, capturedAt: "2026-06-13T00:00:00.000Z" },
      postState: { data: {}, capturedAt: "2026-06-13T00:00:01.000Z" },
      rawRevert: async () => {
        called += 1;
      },
      id: "rec-3",
    });
    // Sequential double-call: the contract per §4.4 is "second call is a no-op".
    // Concurrent collapse is NOT guaranteed by this implementation.
    await rec.revertFn();
    await rec.revertFn();
    expect(called).toBe(1);
    expect(rec.reverted).toBe(true);
  });
});
