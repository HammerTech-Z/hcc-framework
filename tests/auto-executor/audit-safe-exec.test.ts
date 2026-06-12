import { describe, expect, it } from "vitest";
import {
  createAuditBoundary,
  createMemoryAuditAppender,
  type AuditBoundary,
} from "../../src/shared/lib/auto-executor/audit-log-boundary";
import {
  createSafeExec,
} from "../../src/shared/lib/auto-executor/safe-exec";
import type { AuditContext } from "../../src/shared/lib/safety/types";

// -----------------------------------------------------------------
// audit-log-boundary
// -----------------------------------------------------------------

function makeContext(): AuditContext {
  return {
    trust_level: "trusted_user",
    requested_capability: "run_command",
    allowed_capability_set: ["run_command"],
    matched_rule: "test",
    allowlist_hit: null,
    path_check: "not_applicable",
    risk_level: "low",
  };
}

describe("§4.5 audit-log-boundary", () => {
  it("appends a first entry with seq=0 and zero prev_hash", () => {
    const boundary: AuditBoundary = createAuditBoundary(createMemoryAuditAppender());
    const e = boundary.appender.append({
      task_id: "task-1",
      actor: "hermes",
      event: "preflight",
      decision: "allow",
      context: makeContext(),
      evidence_ref: "ref-1",
    });
    expect(e.seq).toBe(0);
    expect(e.prev_hash).toBe("0".repeat(64));
    expect(e.entry_hash).not.toBe("0".repeat(64));
  });

  it("chains prev_hash from the previous entry_hash", () => {
    const boundary: AuditBoundary = createAuditBoundary(createMemoryAuditAppender());
    const a = boundary.appender.append({
      task_id: "task-2",
      actor: "hermes",
      event: "preflight",
      decision: "allow",
      context: makeContext(),
      evidence_ref: "r1",
    });
    const b = boundary.appender.append({
      task_id: "task-2",
      actor: "hermes",
      event: "execute",
      decision: "allow",
      context: makeContext(),
      evidence_ref: "r2",
    });
    expect(b.seq).toBe(1);
    expect(b.prev_hash).toBe(a.entry_hash);
  });

  it("verify returns true for an intact chain", () => {
    const appender = createMemoryAuditAppender();
    const boundary = createAuditBoundary(appender);
    appender.append({
      task_id: "task-3",
      actor: "hermes",
      event: "preflight",
      decision: "allow",
      context: makeContext(),
      evidence_ref: "r1",
    });
    appender.append({
      task_id: "task-3",
      actor: "hermes",
      event: "execute",
      decision: "deny",
      context: makeContext(),
      evidence_ref: "r2",
    });
    expect(boundary.assertChainIntact("task-3")).toBe(true);
  });

  it("verify returns false when a chain entry is tampered mid-stream", () => {
    const appender = createMemoryAuditAppender();
    const boundary = createAuditBoundary(appender);
    appender.append({
      task_id: "task-4",
      actor: "hermes",
      event: "preflight",
      decision: "allow",
      context: makeContext(),
      evidence_ref: "r1",
    });
    appender.append({
      task_id: "task-4",
      actor: "hermes",
      event: "execute",
      decision: "allow",
      context: makeContext(),
      evidence_ref: "r2",
    });
    // Tamper with the first entry's evidence_ref
    const entries = appender.__chains.get("task-4")!;
    entries[0].evidence_ref = "TAMPERED";
    expect(boundary.assertChainIntact("task-4")).toBe(false);
  });

  it("verify returns true for an empty / non-existent chain", () => {
    const boundary = createAuditBoundary(createMemoryAuditAppender());
    expect(boundary.assertChainIntact("never-written")).toBe(true);
  });
});

// -----------------------------------------------------------------
// safe-exec
// -----------------------------------------------------------------

const pinnedCwd = "/Users/midoudou/hermes-pro";

describe("§4.6 safe-exec", () => {
  it("refuses when binary is not on the allowlist", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set() },
      pinnedCwd,
    });
    const r = se.validate({ binary: "git", args: ["status"], cwd: pinnedCwd });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("binaryNotOnAllowlist");
  });

  it("approves when binary is on the allowlist and args are clean", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["git"]) },
      pinnedCwd,
    });
    const r = se.validate({ binary: "git", args: ["status", "--porcelain"], cwd: pinnedCwd });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.binary).toBe("git");
      expect(r.args).toEqual(["status", "--porcelain"]);
      expect(r.cwd).toBe(pinnedCwd);
      expect(r.env).toEqual({});
    }
  });

  it("matches binary by basename (full path allowed)", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["git"]) },
      pinnedCwd,
    });
    const r = se.validate({
      binary: "/usr/local/bin/git",
      args: ["rev-parse", "HEAD"],
      cwd: pinnedCwd,
    });
    expect(r.ok).toBe(true);
  });

  it("refuses when an arg contains a shell metacharacter", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["echo"]) },
      pinnedCwd,
    });
    const r = se.validate({ binary: "echo", args: ["hello; rm -rf /"], cwd: pinnedCwd });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("shellMetacharacterInArg");
  });

  it("refuses on backtick, dollar, pipe, redirect, glob, and quote chars", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["echo"]) },
      pinnedCwd,
    });
    const cases = ["`whoami`", "$HOME", "a|b", "a>b", "a<b", "*", "?", "a;b", "a&b", "(x)", "{x}", "[x]", "~", "!", "#", "\\", "\"x\"", "'x'"];
    for (const c of cases) {
      const r = se.validate({ binary: "echo", args: [c], cwd: pinnedCwd });
      expect(r.ok, `expected refusal for ${JSON.stringify(c)}`).toBe(false);
      if (!r.ok) expect(r.reason).toBe("shellMetacharacterInArg");
    }
  });

  it("refuses on newline / carriage return / tab / NUL in arg", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["echo"]) },
      pinnedCwd,
    });
    for (const c of ["\n", "\r", "\t", "\0"]) {
      const r = se.validate({ binary: "echo", args: [`a${c}b`], cwd: pinnedCwd });
      expect(r.ok, `expected refusal for ${JSON.stringify(c)}`).toBe(false);
    }
  });

  it("refuses on cwd mismatch (caller tried to escape pin)", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["git"]) },
      pinnedCwd,
    });
    const r = se.validate({ binary: "git", args: ["status"], cwd: "/tmp" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("cwdMismatch");
  });

  it("refuses env var not on allowedEnvVars", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["git"]), allowedEnvVars: new Set(["PATH"]) },
      pinnedCwd,
    });
    const r = se.validate({
      binary: "git",
      args: ["status"],
      cwd: pinnedCwd,
      env: { PATH: "/usr/bin", SECRET: "leak" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("envVarNotAllowed");
  });

  it("approves env var on allowedEnvVars", () => {
    const se = createSafeExec({
      allowlist: { binaries: new Set(["git"]), allowedEnvVars: new Set(["PATH"]) },
      pinnedCwd,
    });
    const r = se.validate({
      binary: "git",
      args: ["status"],
      cwd: pinnedCwd,
      env: { PATH: "/usr/bin" },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.env).toEqual({ PATH: "/usr/bin" });
  });

  it("read-only allowlist() and pinnedCwd()", () => {
    const allowlist = { binaries: new Set(["git"]) };
    const se = createSafeExec({ allowlist, pinnedCwd });
    expect(se.allowlist().binaries).toBe(allowlist.binaries);
    expect(se.pinnedCwd()).toBe(pinnedCwd);
  });
});
