import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildProductionShellRunner,
  projectWhitelistedEnv,
  validateAllowlistedArgv,
  HCC_TERMINAL_SHELL_RUNNER_SCHEMA_VERSION,
  HCC_SHELL_RUNNER_ENV_WHITELIST,
  HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS,
  HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES,
} from "../../src/shared/lib/hcc-terminal-shell-runner";

const REPO_ROOT = resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Mock child process
// ---------------------------------------------------------------------------

type MockChild = {
  on: (event: string, listener: (...args: unknown[]) => void) => unknown;
  stdout: Readable;
  stderr: Readable;
  kill: (sig?: NodeJS.Signals) => boolean;
};

function makeMockChild(opts: {
  exitCode?: number;
  signal?: NodeJS.Signals | null;
  stdout?: string;
  stderr?: string;
  emitError?: Error;
  emitCloseAfter?: number;
} = {}): MockChild {
  const emitter = new EventEmitter();
  const stdout = new Readable({ read() {} });
  const stderr = new Readable({ read() {} });
  stdout.setEncoding("utf-8");
  stderr.setEncoding("utf-8");
  const child = Object.assign(emitter, {
    stdout,
    stderr,
    pid: 12345,
    kill: vi.fn(() => true),
  }) as unknown as MockChild;

  setTimeout(() => {
    if (opts.emitError) {
      emitter.emit("error", opts.emitError);
      return;
    }
    if (opts.stdout) stdout.push(opts.stdout);
    if (opts.stderr) stderr.push(opts.stderr);
    stdout.push(null);
    stderr.push(null);
    emitter.emit("close", opts.exitCode ?? 0, opts.signal ?? null);
  }, opts.emitCloseAfter ?? 0);

  return child;
}

type MockSpawn = ReturnType<typeof import("node:child_process")["spawn"]> & {
  mock: { calls: unknown[][] };
};

function makeSpawnMock(impl: (argv: string[], opts: unknown) => unknown): MockSpawn {
  const fn = vi.fn((...args: unknown[]) => impl(args[0] as string[], args[1]));
  return fn as unknown as MockSpawn;
}

// ---------------------------------------------------------------------------
// validateAllowlistedArgv
// ---------------------------------------------------------------------------

describe("HCC shell runner: validateAllowlistedArgv", () => {
  it("rejects free-form shell strings", () => {
    expect(() => validateAllowlistedArgv(["echo hi; rm -rf /"])).toThrow();
  });

  it("rejects non-allowlisted argv", () => {
    expect(() => validateAllowlistedArgv(["rm", "-rf", "/"])).toThrow(/not in allowlist/);
  });

  it("rejects empty argv", () => {
    expect(() => validateAllowlistedArgv([])).toThrow(/non-empty/);
  });

  it("rejects non-string argv elements", () => {
    expect(() => validateAllowlistedArgv(["git", null as unknown as string])).toThrow();
  });

  it("accepts all 3 allowlist entries", () => {
    expect(validateAllowlistedArgv(["git", "status"]).command_id).toBe("git.status");
    expect(validateAllowlistedArgv(["git", "diff"]).command_id).toBe("git.diff");
    expect(validateAllowlistedArgv(["git", "show", "--stat", "HEAD"]).command_id).toBe("git.show");
  });
});

// ---------------------------------------------------------------------------
// projectWhitelistedEnv
// ---------------------------------------------------------------------------

describe("HCC shell runner: projectWhitelistedEnv", () => {
  it("forwards only whitelisted keys", () => {
    const projected = projectWhitelistedEnv(
      { PATH: "/usr/bin", HOME: "/home/user", SECRET: "x" },
      HCC_SHELL_RUNNER_ENV_WHITELIST,
    );
    expect(projected).toEqual({ PATH: "/usr/bin" });
  });

  it("drops empty / undefined values", () => {
    const projected = projectWhitelistedEnv(
      { PATH: "", HOME: "/home/user" },
      ["PATH", "HOME"],
    );
    expect(projected).toEqual({ HOME: "/home/user" });
  });

  it("returns empty object for empty source", () => {
    expect(projectWhitelistedEnv({}, HCC_SHELL_RUNNER_ENV_WHITELIST)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildProductionShellRunner: factory + env / cwd guards
// ---------------------------------------------------------------------------

describe("HCC shell runner: buildProductionShellRunner factory", () => {
  it("factory validates cwd inside repoRoot", () => {
    expect(() =>
      buildProductionShellRunner({ repoRoot: "/a/b", cwd: "/c/d" }),
    ).toThrow(/not inside repoRoot/);
  });

  it("factory rejects non-positive timeoutMs", () => {
    expect(() =>
      buildProductionShellRunner({ repoRoot: "/a", timeoutMs: 0 }),
    ).toThrow(/timeoutMs/);
    expect(() =>
      buildProductionShellRunner({ repoRoot: "/a", timeoutMs: -1 }),
    ).toThrow(/timeoutMs/);
  });

  it("factory accepts cwd === repoRoot", () => {
    expect(() =>
      buildProductionShellRunner({ repoRoot: "/a/b", cwd: "/a/b" }),
    ).not.toThrow();
  });

  it("factory accepts cwd subdir of repoRoot", () => {
    expect(() =>
      buildProductionShellRunner({ repoRoot: "/a/b", cwd: "/a/b/sub" }),
    ).not.toThrow();
  });

  it("schema version is canonical", () => {
    expect(HCC_TERMINAL_SHELL_RUNNER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("default timeout and max bytes are sensible", () => {
    expect(HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS).toBe(30_000);
    expect(HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES).toBe(1_048_576);
  });
});

// ---------------------------------------------------------------------------
// run behavior
// ---------------------------------------------------------------------------

describe("HCC shell runner: run behavior", () => {
  it("non-allowlisted argv -> throws before spawn", async () => {
    const spawnMock = makeSpawnMock(() => makeMockChild());
    const runner = buildProductionShellRunner({
      repoRoot: "/a",
      spawn: spawnMock,
    });
    await expect(runner(["rm", "-rf", "/"])).rejects.toThrow(/not in allowlist/);
    expect(spawnMock.mock.calls).toHaveLength(0);
  });

  it("empty argv -> throws before spawn", async () => {
    const spawnMock = makeSpawnMock(() => makeMockChild());
    const runner = buildProductionShellRunner({
      repoRoot: "/a",
      spawn: spawnMock,
    });
    await expect(runner([])).rejects.toThrow(/non-empty/);
    expect(spawnMock.mock.calls).toHaveLength(0);
  });

  it("allowlisted argv -> spawn called with EXACTLY the allowlist argv", async () => {
    const spawnMock = makeSpawnMock(() => makeMockChild({ exitCode: 0 }));
    const runner = buildProductionShellRunner({
      repoRoot: "/a",
      spawn: spawnMock,
    });
    await runner(["git", "status"]);
    expect(spawnMock.mock.calls).toHaveLength(1);
    // spawn() is called with (cmd, args, opts). mock.calls[0]
    // captures the full positional arg list.
    const callArgs = spawnMock.mock.calls[0] as unknown[];
    const calledArgv0 = callArgs[0] as string;
    const calledArgvSlice = callArgs[1] as string[];
    const calledOpts = callArgs[2] as { cwd: string; env: Record<string, string>; shell: boolean };
    expect(calledArgv0).toBe("git");
    expect(calledArgvSlice).toEqual(["status"]);
    expect(calledOpts.cwd).toBe("/a");
    expect(calledOpts.shell).toBe(false);
    expect(calledOpts.env.PATH).toBeDefined();
    expect(calledOpts.env.HOME).toBeUndefined();
  });

  it("captures stdout and stderr", async () => {
    const spawnMock = makeSpawnMock(() =>
      makeMockChild({ stdout: "out-here", stderr: "err-here", exitCode: 0 }),
    );
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    const r = await runner(["git", "status"]);
    expect(r.stdout).toBe("out-here");
    expect(r.stderr).toBe("err-here");
    expect(r.code).toBe(0);
    expect(r.timed_out).toBe(false);
  });

  it("captures non-zero exit code", async () => {
    const spawnMock = makeSpawnMock(() => makeMockChild({ exitCode: 128 }));
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    const r = await runner(["git", "status"]);
    expect(r.code).toBe(128);
    expect(r.timed_out).toBe(false);
  });

  it("captures signal (SIGTERM) on close", async () => {
    const spawnMock = makeSpawnMock(() =>
      makeMockChild({ signal: "SIGTERM", exitCode: null }),
    );
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    const r = await runner(["git", "status"]);
    expect(r.signal).toBe("SIGTERM");
  });

  it("emits error event -> rejects with error", async () => {
    const spawnMock = makeSpawnMock(() =>
      makeMockChild({ emitError: new Error("spawn failed") }),
    );
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    await expect(runner(["git", "status"])).rejects.toThrow(/spawn failed/);
  });

  it("truncates stdout beyond max bytes", async () => {
    const big = "x".repeat(HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES + 1000);
    const spawnMock = makeSpawnMock(() => makeMockChild({ stdout: big, exitCode: 0 }));
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    const r = await runner(["git", "status"]);
    expect(r.stdout.endsWith("\n[truncated]")).toBe(true);
  });

  it("truncates stderr beyond max bytes", async () => {
    const big = "e".repeat(HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES + 1000);
    const spawnMock = makeSpawnMock(() => makeMockChild({ stderr: big, exitCode: 0 }));
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    const r = await runner(["git", "status"]);
    expect(r.stderr.endsWith("\n[truncated]")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

describe("HCC shell runner: timeout", () => {
  it("timeout fires -> kill(SIGKILL) and timed_out=true", async () => {
    // Child that does NOT auto-close.
    const emitter = new EventEmitter();
    const stdout = new Readable({ read() {} });
    const stderr = new Readable({ read() {} });
    stdout.setEncoding("utf-8");
    stderr.setEncoding("utf-8");
    const child = Object.assign(emitter, {
      stdout,
      stderr,
      pid: 99999,
      kill: vi.fn(() => true),
    });
    let trigger: (() => void) | null = null;
    const setTimeoutFn = vi.fn((fn: () => void) => {
      trigger = fn;
      return 1 as unknown as NodeJS.Timeout;
    }) as unknown as typeof setTimeout;
    const clearTimeoutFn = vi.fn() as unknown as typeof clearTimeout;
    const spawnMock = makeSpawnMock(() => child);
    const runner = buildProductionShellRunner({
      repoRoot: "/a",
      spawn: spawnMock,
      setTimeoutFn,
      clearTimeoutFn,
    });
    const p = runner(["git", "status"]);
    // Allow the await microtask to settle.
    await new Promise((r) => setImmediate(r));
    trigger!();
    const r = await p;
    expect(r.timed_out).toBe(true);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
});

// ---------------------------------------------------------------------------
// Spawn opts enforcement
// ---------------------------------------------------------------------------

describe("HCC shell runner: spawn opts enforcement", () => {
  it("passes cwd exactly as configured", async () => {
    const spawnMock = makeSpawnMock(() => makeMockChild());
    const runner = buildProductionShellRunner({
      repoRoot: "/a/b",
      cwd: "/a/b/sub",
      spawn: spawnMock,
    });
    await runner(["git", "status"]);
    const opts = spawnMock.mock.calls[0]?.[2] as { cwd: string };
    expect(opts.cwd).toBe("/a/b/sub");
  });

  it("sets shell=false (NEVER passes argv through a shell)", async () => {
    const spawnMock = makeSpawnMock(() => makeMockChild());
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    await runner(["git", "status"]);
    const opts = spawnMock.mock.calls[0]?.[2] as {
      shell: boolean;
      windowsHide: boolean;
      stdio: string[];
    };
    expect(opts.shell).toBe(false);
    expect(opts.windowsHide).toBe(true);
    expect(opts.stdio).toEqual(["ignore", "pipe", "pipe"]);
  });

  it("env contains only whitelisted keys", async () => {
    process.env.PATH = "/usr/bin";
    process.env.HCC_TEST_SECRET = "should-not-leak";
    const spawnMock = makeSpawnMock(() => makeMockChild());
    const runner = buildProductionShellRunner({ repoRoot: "/a", spawn: spawnMock });
    await runner(["git", "status"]);
    const opts = spawnMock.mock.calls[0]?.[2] as { env: Record<string, string> };
    expect(opts.env.PATH).toBe("/usr/bin");
    expect(Object.keys(opts.env).every((k) => HCC_SHELL_RUNNER_ENV_WHITELIST.includes(k))).toBe(true);
    delete process.env.HCC_TEST_SECRET;
  });
});

// ---------------------------------------------------------------------------
// Static source guard
// ---------------------------------------------------------------------------

describe("HCC shell runner: static source guard", () => {
  it("this module is the ONLY one importing node:child_process", () => {
    const files = [
      "src/shared/lib/hcc-terminal-executor-impl.ts",
      "src/cli/hcc-terminal-plan-invoker.ts",
      "src/shared/lib/hcc-plan-fixture-generator.ts",
      "src/shared/lib/hcc-controlled-dispatch-adapter.ts",
    ];
    for (const f of files) {
      const src = readFileSync(resolve(REPO_ROOT, f), "utf-8");
      expect(src, f).not.toMatch(/from\s+["']node:child_process["']/);
      expect(src, f).not.toMatch(/from\s+["']child_process["']/);
      expect(src, f).not.toMatch(/\bspawn\s*\(/);
    }
  });

  it("this module does not register IPC / scheduler / persistent timer / auto-arm", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-terminal-shell-runner.ts"),
      "utf-8",
    );
    const stripped = src
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/ipcMain/);
    expect(stripped).not.toMatch(/BrowserWindow/);
    expect(stripped).not.toMatch(/contextBridge/);
    expect(stripped).not.toMatch(/setInterval/);
    expect(stripped).not.toMatch(/auto-arm/i);
    expect(stripped).not.toMatch(/go_no_go:\s*"GO"/i);
    expect(stripped).not.toMatch(/night_run_ready:\s*true/i);
  });
});
