import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  installAutoExecutorHost,
  getInstalledAutoExecutorHost,
  getBootstrapPostureReport,
  bootstrapAbort,
  __resetAutoExecutorBootstrapForTests,
} from "../../src/main/auto-executor-bootstrap";

const HEAD_SHA = "faf062ad76b25ee4d5253f89cea3fc30f6ec0d51";
const REPO_ROOT = resolve(__dirname, "../..");

describe("bootstrap: install + posture", () => {
  beforeEach(() => {
    __resetAutoExecutorBootstrapForTests();
  });

  it("installAutoExecutorHost() returns a constructed host", () => {
    const host = installAutoExecutorHost();
    expect(host.state()).toBe("constructed");
  });

  it("getInstalledAutoExecutorHost() returns the same handle after install", () => {
    const a = installAutoExecutorHost();
    const b = getInstalledAutoExecutorHost();
    expect(b).not.toBeNull();
    expect(b).toBe(a);
  });

  it("install is idempotent — second call returns same handle, no second host", () => {
    const a = installAutoExecutorHost();
    const b = installAutoExecutorHost();
    expect(a).toBe(b);
  });

  it("posture report shows armed=false, started=false, any_action_invoked=false", () => {
    installAutoExecutorHost();
    const r = getBootstrapPostureReport();
    expect(r).not.toBeNull();
    expect(r!.armed).toBe(false);
    expect(r!.started).toBe(false);
    expect(r!.any_action_invoked).toBe(false);
  });

  it("posture report shows subprocess_count=0 and max_subprocess_count=0", () => {
    installAutoExecutorHost();
    const r = getBootstrapPostureReport();
    expect(r!.subprocess_count).toBe(0);
    expect(r!.max_subprocess_count).toBe(0);
  });

  it("posture report shows state='constructed' and alive=true", () => {
    installAutoExecutorHost();
    const r = getBootstrapPostureReport();
    expect(r!.state).toBe("constructed");
    expect(r!.alive).toBe(true);
  });

  it("bootstrapAbort() trips kill switch and updates posture", () => {
    installAutoExecutorHost();
    const ok = bootstrapAbort("bootstrap-test-kill");
    expect(ok).toBe(true);
    const r = getBootstrapPostureReport();
    expect(r!.alive).toBe(false);
  });

  it("bootstrapAbort() returns false when no host installed yet", () => {
    // beforeEach reset
    expect(bootstrapAbort("nope")).toBe(false);
  });
});

describe("bootstrap: src/main/index.ts static guard", () => {
  const indexTsPath = resolve(REPO_ROOT, "src/main/index.ts");
  const source = readFileSync(indexTsPath, "utf8");

  it("imports installAutoExecutorHost from auto-executor-bootstrap", () => {
    expect(source).toMatch(/import\s*\{\s*installAutoExecutorHost\s*\}\s*from\s*["']\.\/auto-executor-bootstrap["']/);
  });

  it("calls installAutoExecutorHost() exactly once", () => {
    const matches = source.match(/installAutoExecutorHost\s*\(\s*\)/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("does NOT call host.arm() — arming is held for a separate GO", () => {
    expect(source).not.toMatch(/\.arm\s*\(/);
  });

  it("does NOT call host.start() — starting is held for a separate GO", () => {
    expect(source).not.toMatch(/\.start\s*\(\s*\)/);
  });

  it("does NOT call runMockAction()", () => {
    expect(source).not.toMatch(/runMockAction\s*\(/);
  });

  it("does NOT register any IPC channel for auto-executor-host", () => {
    expect(source).not.toMatch(/ipcMain\.handle\s*\(\s*["'][^"']*auto[-_]?executor/i);
    expect(source).not.toMatch(/ipcMain\.handle\s*\(\s*["'][^"']*hcc[-_]?auto/i);
  });

  it("does NOT start any cron/timer/interval for auto-executor", () => {
    // No new setInterval/setImmediate/setTimeout referencing auto-executor-host
    expect(source).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\([^)]*auto[-_]?executor/i);
  });
});