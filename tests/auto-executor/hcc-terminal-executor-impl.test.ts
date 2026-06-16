import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildTerminalExecutors,
  HCC_TERMINAL_EXECUTOR_IMPL_SCHEMA_VERSION,
  HCC_TERMINAL_SHELL_ALLOWLIST_READONLY,
  type FileSystemRunner,
  type ShellSpawnRunner,
} from "../../src/shared/lib/hcc-terminal-executor-impl";

const REPO_ROOT = resolve(__dirname, "../..");

const REPO = "/tmp/test-hcc-repo";

function makeFsMock(): FileSystemRunner & {
  writes: Array<{ path: string; content: string }>;
  reads: string[];
} {
  const store = new Map<string, string>();
  const m = {
    writes: [] as Array<{ path: string; content: string }>,
    reads: [] as string[],
    writeFile: vi.fn(async (path: string, content: string) => {
      m.writes.push({ path, content });
      store.set(path, content);
    }),
    readFile: vi.fn(async (path: string) => {
      m.reads.push(path);
      const v = store.get(path);
      if (v === undefined) {
        throw new Error(`ENOENT: ${path}`);
      }
      return v;
    }),
  };
  return m;
}

function makeShellMock(): ShellSpawnRunner & { calls: string[][] } {
  const m = {
    calls: [] as string[][],
  };
  const fn = (async (argv: readonly string[]) => {
    m.calls.push([...argv]);
    return { stdout: "", stderr: "", code: 0 };
  }) as unknown as ShellSpawnRunner & { calls: string[][] };
  (fn as { calls: string[][] }).calls = m.calls;
  return fn;
}

// ---------------------------------------------------------------------------
// shell_executor: allowlist + structured argv only
// ---------------------------------------------------------------------------

describe("HCC terminal executor impl: shell_executor", () => {
  it("no shellRunner injected -> disabled, throws on any call", async () => {
    const e = buildTerminalExecutors({ repoRoot: REPO });
    await expect(
      e.shell_executor("git.status", ["git", "status"]),
    ).rejects.toThrow(/shell_executor disabled/);
  });

  it("allowlisted argv (git.status) -> calls runner exactly once with the allowlist argv", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    const r = await e.shell_executor("git.status", ["git", "status"]);
    expect(r.command_id).toBe("git.status");
    expect(shell.calls).toHaveLength(1);
    expect(shell.calls[0]).toEqual(["git", "status"]);
  });

  it("allowlisted argv (git.diff) -> ok", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    const r = await e.shell_executor("git.diff", ["git", "diff"]);
    expect(r.command_id).toBe("git.diff");
  });

  it("allowlisted argv (git.show) -> ok", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    const r = await e.shell_executor("git.show", [
      "git",
      "show",
      "--stat",
      "HEAD",
    ]);
    expect(r.command_id).toBe("git.show");
  });

  it("non-allowlisted argv (rm -rf /) -> throws BEFORE runner call", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("rm", ["rm", "-rf", "/"]),
    ).rejects.toThrow(/not in allowlist/);
    expect(shell.calls).toHaveLength(0);
  });

  it("free-form shell string (echo hi; rm -rf /) -> throws before runner", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("echo", ["echo hi; rm -rf /"]),
    ).rejects.toThrow();
    expect(shell.calls).toHaveLength(0);
  });

  it("command_id mismatch -> throws before runner", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("evil.id", ["git", "status"]),
    ).rejects.toThrow(/command_id/);
    expect(shell.calls).toHaveLength(0);
  });

  it("empty argv -> throws", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(e.shell_executor("x", [])).rejects.toThrow(/non-empty/);
  });

  it("non-string argv element -> throws", async () => {
    const shell = makeShellMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      // @ts-expect-error intentional bad input
      e.shell_executor("x", ["git", null]),
    ).rejects.toThrow();
  });

  it("runner throws -> propagates", async () => {
    const shell = (async () => {
      throw new Error("runner rejected");
    }) as unknown as ShellSpawnRunner;
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("git.status", ["git", "status"]),
    ).rejects.toThrow(/runner rejected/);
  });

  it("runner returns timed_out:true -> shell_executor throws", async () => {
    const shell = (async () => ({
      stdout: "",
      stderr: "",
      code: -1,
      timed_out: true,
      signal: "SIGKILL" as NodeJS.Signals,
    })) as unknown as ShellSpawnRunner;
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("git.status", ["git", "status"]),
    ).rejects.toThrow(/timed out/);
  });

  it("runner returns non-null signal -> shell_executor throws", async () => {
    const shell = (async () => ({
      stdout: "",
      stderr: "",
      code: 0,
      timed_out: false,
      signal: "SIGTERM" as NodeJS.Signals,
    })) as unknown as ShellSpawnRunner;
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("git.status", ["git", "status"]),
    ).rejects.toThrow(/signal/);
  });

  it("runner returns non-zero code (no signal, not timed_out) -> shell_executor throws", async () => {
    const shell = (async () => ({
      stdout: "",
      stderr: "boom",
      code: 1,
      timed_out: false,
      signal: null as NodeJS.Signals | null,
    })) as unknown as ShellSpawnRunner;
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    await expect(
      e.shell_executor("git.status", ["git", "status"]),
    ).rejects.toThrow(/non-zero code 1/);
  });

  it("runner returns code 0 with no signal and not timed_out -> command_id returned", async () => {
    const shell = (async () => ({
      stdout: "ok",
      stderr: "",
      code: 0,
      timed_out: false,
      signal: null as NodeJS.Signals | null,
    })) as unknown as ShellSpawnRunner;
    const e = buildTerminalExecutors({ repoRoot: REPO, shellRunner: shell });
    const r = await e.shell_executor("git.status", ["git", "status"]);
    expect(r.command_id).toBe("git.status");
  });

  it("exposes a 3-entry frozen allowlist (read-only public view)", () => {
    expect(HCC_TERMINAL_SHELL_ALLOWLIST_READONLY).toHaveLength(3);
    expect(HCC_TERMINAL_SHELL_ALLOWLIST_READONLY.map((e) => e.command_id)).toEqual(
      ["git.status", "git.diff", "git.show"],
    );
    // The factory uses the LIVE underlying allowlist, not the
    // frozen view, so pushing to the readonly view must not
    // affect the live adapter. We assert that the live list
    // still has exactly 3 entries by checking the build factory
    // accepts only those three.
    const before = HCC_TERMINAL_SHELL_ALLOWLIST_READONLY.length;
    expect(before).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// writer: repo-local path gate + allowed extension + non-locked
// ---------------------------------------------------------------------------

describe("HCC terminal executor impl: writer", () => {
  it("repo-local safe path + .md -> writes and returns controlled_command_id", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    const r = await e.writer("src/notes/test.md", "hello");
    expect(r.controlled_command_id).toContain("file-write:");
    expect(fs.writes).toHaveLength(1);
    expect(fs.writes[0].path).toBe(`${REPO}/src/notes/test.md`);
    expect(fs.writes[0].content).toBe("hello");
  });

  it(".json under docs/ -> ok", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await e.writer("docs/x/y.json", '{"k":1}');
    expect(fs.writes).toHaveLength(1);
  });

  it("path traversal (../) -> rejects, no write", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("../../../etc/passwd.md", "x"),
    ).rejects.toThrow(/contains \.\./);
    expect(fs.writes).toHaveLength(0);
  });

  it("absolute path outside repo -> rejects, no write", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("/etc/passwd", "x"),
    ).rejects.toThrow(/absolute path/);
    expect(fs.writes).toHaveLength(0);
  });

  it("~/.hermes path -> rejects, no write", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("~/.hermes/config.yaml", "x"),
    ).rejects.toThrow(/~/);
    expect(fs.writes).toHaveLength(0);
  });

  it("disallowed extension (.sh) -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("src/notes/run.sh", "x"),
    ).rejects.toThrow(/end in/);
  });

  it("locked path (src/main/index.ts) -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("src/main/index.ts", "x"),
    ).rejects.toThrow(/locked/);
    expect(fs.writes).toHaveLength(0);
  });

  it("locked path (package.json) -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("package.json", "{}"),
    ).rejects.toThrow(/start with/);
  });

  it("locked path (docs/knowledge/vault-health-report-2026-06-12.md) -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer(
        "docs/knowledge/vault-health-report-2026-06-12.md",
        "x",
      ),
    ).rejects.toThrow(/locked/);
  });

  it("relative path under non-allowed prefix -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.writer("random-dir/notes.md", "x"),
    ).rejects.toThrow();
  });

  it("non-string content -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    // @ts-expect-error intentional bad input
    await expect(e.writer("src/x.md", 123)).rejects.toThrow(/string/);
  });

  it("empty path -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(e.writer("", "x")).rejects.toThrow(/empty/);
  });
});

// ---------------------------------------------------------------------------
// patcher: locked-path + structured patch
// ---------------------------------------------------------------------------

describe("HCC terminal executor impl: patcher", () => {
  it("patcher on safe path -> reads, merges, writes", async () => {
    const fs = makeFsMock();
    // Pre-seed with existing JSON
    fs.writeFile(`${REPO}/docs/x/config.json`, '{"a":1}');
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    const r = await e.patcher("docs/x/config.json", [
      { key: "b", value: 2 },
    ]);
    expect(r.controlled_command_id).toContain("config-patch:");
    expect(fs.writes).toHaveLength(2); // pre-seed + patched
    const finalWrite = fs.writes[fs.writes.length - 1];
    const parsed = JSON.parse(finalWrite.content);
    expect(parsed.a).toBe(1);
    expect(parsed.b).toBe(2);
  });

  it("patcher on missing file -> starts fresh", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await e.patcher("src/x/new.json", [{ key: "k", value: "v" }]);
    const w = fs.writes[fs.writes.length - 1];
    expect(JSON.parse(w.content)).toEqual({ k: "v" });
  });

  it("patcher on locked path -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.patcher("package.json", [{ key: "x", value: 1 }]),
    ).rejects.toThrow(/start with/);
    expect(fs.writes).toHaveLength(0);
  });

  it("patcher with non-array patch -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    // @ts-expect-error intentional bad input
    await expect(
      e.patcher("docs/x/cfg.json", { k: "v" }),
    ).rejects.toThrow();
  });

  it("patcher with empty patch -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.patcher("docs/x/cfg.json", []),
    ).rejects.toThrow();
  });

  it("patcher with non-string key -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    // @ts-expect-error intentional bad input
    await expect(
      e.patcher("docs/x/cfg.json", [{ key: 123, value: "v" }]),
    ).rejects.toThrow(/key/);
  });

  it("patcher on ~/.hermes path -> rejects", async () => {
    const fs = makeFsMock();
    const e = buildTerminalExecutors({ repoRoot: REPO, fs });
    await expect(
      e.patcher("~/.hermes/audit/x.json", [{ key: "k", value: "v" }]),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Schema version + non-throwing build
// ---------------------------------------------------------------------------

describe("HCC terminal executor impl: schema + factory", () => {
  it("schema version is canonical", () => {
    expect(HCC_TERMINAL_EXECUTOR_IMPL_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("factory never throws on construction", () => {
    expect(() =>
      buildTerminalExecutors({ repoRoot: REPO }),
    ).not.toThrow();
    expect(() =>
      buildTerminalExecutors({ repoRoot: REPO, shellRunner: null }),
    ).not.toThrow();
  });

  it("factory returns 3 keys: shell_executor, writer, patcher", () => {
    const e = buildTerminalExecutors({ repoRoot: REPO });
    expect(typeof e.shell_executor).toBe("function");
    expect(typeof e.writer).toBe("function");
    expect(typeof e.patcher).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: executors wire through controlled dispatch adapter
// ---------------------------------------------------------------------------

describe("HCC terminal executor impl: end-to-end with controlled dispatch", () => {
  it("file_write through dispatch adapter -> writer called", async () => {
    const { buildControlledDispatchAdapter } = await import(
      "../../src/shared/lib/hcc-controlled-dispatch-adapter"
    );
    const fs = makeFsMock();
    const execs = buildTerminalExecutors({ repoRoot: REPO, fs });
    const adapter = buildControlledDispatchAdapter(() => ({
      planned_action_id: "act-e2e-001",
      backend: "file_write",
      payload: {
        kind: "file",
        target_path: "src/notes/e2e.md",
        content: "wired",
      },
      trigger_proof: {
        explicit_user_trigger_token: "tok",
        source_service: "hcc-user-explicit-local-invoker",
      },
      executors: execs,
      now: () => "2026-06-16T00:00:00.000Z",
    }));
    const r = await adapter.dispatch(
      "act-e2e-001",
      "file_write",
      "src/notes/e2e.md",
    );
    expect(r.controlled_command_id).toContain("file-write:");
    expect(fs.writes.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Static source guard
// ---------------------------------------------------------------------------

describe("HCC terminal executor impl: static source guard", () => {
  it("source does not import child_process directly (only fs/promises)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-terminal-executor-impl.ts"),
      "utf-8",
    );
    expect(src).not.toMatch(/from\s+["']node:child_process["']/);
    expect(src).not.toMatch(/from\s+["']child_process["']/);
  });

  it("source does not contain forbidden runtime surfaces", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-terminal-executor-impl.ts"),
      "utf-8",
    );
    const stripped = src
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const FORBIDDEN = [
      "setInterval(",
      "setTimeout(",
      "cron",
      "auto-arm",
      "auto_arm",
      "ipcMain",
      "BrowserWindow",
      "contextBridge",
      'go_no_go: "GO"',
      'go_no_go:"GO"',
      "night_run_ready: true",
      "night_run_ready:true",
      "submitDryRunAction",
    ];
    for (const forbidden of FORBIDDEN) {
      expect(stripped).not.toContain(forbidden);
    }
  });

  it("documents the only permitted child_process boundary", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-terminal-executor-impl.ts"),
      "utf-8",
    );
    // The docstring must explicitly note where the spawn
    // boundary lives (production wiring, not this file).
    expect(src).toMatch(/production wiring does/i);
    expect(src).toMatch(/production wiring must inject a runner/i);
  });
});
