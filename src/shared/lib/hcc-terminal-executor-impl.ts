// HCC Terminal Executor Implementations.
//
// Production executor implementations for the terminal Hermes
// plan invoker wiring slice. Provides the three
// `HCCControlledDispatchExecutorDeps` hooks used by the
// controlled dispatch adapter:
//
//   - shell_executor: strict allowlist-gated argv runner
//   - writer:        repo-local path-gated file writer
//   - patcher:       locked-path-gated structured JSON patcher
//
// Critical isolation rules:
//   - This module is the ONLY surface in the HCC terminal
//     stack that may call `child_process` or perform filesystem
//     writes. The allowlist + path gates are the sole
//     authorization.
//   - The module is a pure factory: `buildTerminalExecutors()`
//     returns a fresh executor triple. The factory never wires
//     itself to app boot, IPC, scheduler, cron, timer, or
//     auto-arm. Wiring is the responsibility of a future slice.
//   - `shell_executor` accepts ONLY structured argv from
//     `HCC_DISPATCH_SHELL_ALLOWLIST` (re-exported from
//     `hcc-controlled-dispatch-adapter`). Free-form shell
//     strings are NEVER accepted.
//   - `writer` / `patcher` accept ONLY repo-local paths under
//     the configured `repoRoot`. Traversal, absolute paths
//     outside the repo, `~/.hermes` paths, and the locked
//     paths list are all rejected BEFORE any I/O.
//   - The `spawn_runner` is fully injectable. Production
//     wiring must pass a real spawn; tests inject a mock.
//     The module never imports `child_process` directly;
//     production wiring does, behind a `injectNodeChildProcess`
//     boundary that the static source guard documents.
//
// Per HCC governance:
//   - NO background timer / cron / setInterval / setTimeout.
//   - NO direct spawn / exec / child_process (production
//     wiring injects the runner; this module never imports).
//   - NO submitDryRunAction.
//   - NO bootstrap / arm / start / host imports.
//   - NO writes to ~/.hermes/**.
//   - NO automatic start on app launch.
//   - NO ipcMain / BrowserWindow / contextBridge.
//   - NO runtime go_no_go: "GO" / night_run_ready: true /
//     unattended_ready: true.

import { writeFile, readFile } from "node:fs/promises";
import { resolve as pathResolve, sep } from "node:path";
import type { HCCControlledDispatchExecutorDeps } from "./hcc-controlled-dispatch-adapter";
import { HCC_DISPATCH_SHELL_ALLOWLIST } from "./hcc-controlled-dispatch-adapter";

export const HCC_TERMINAL_EXECUTOR_IMPL_SCHEMA_VERSION = "1.0.0" as const;

const ALLOWED_FILE_EXTS: ReadonlySet<string> = new Set([
  ".md",
  ".json",
  ".ts",
  ".tsx",
  ".txt",
]);
const FILE_WRITE_ALLOWED_PREFIXES: readonly string[] = [
  "docs/",
  "src/",
  "tests/",
];
const LOCKED_PATHS: readonly string[] = [
  "src/main/index.ts",
  "package.json",
  "package-lock.json",
  "docs/knowledge/vault-health-report-2026-06-12.md",
  ".claude/settings.json",
  ".wolf/memory.md",
];

// ---------------------------------------------------------------------------
// Allowlist reasoning (re-exported for tests / docs)
// ---------------------------------------------------------------------------

/**
 * The 3 commands the shell executor will ever run. Anything
 * outside this list throws before the spawn runner is called.
 * Production wiring must NOT add to this list without a
 * separate HCC governance decision.
 */
export const HCC_TERMINAL_SHELL_ALLOWLIST_READONLY = Object.freeze(
  HCC_DISPATCH_SHELL_ALLOWLIST.map((e) => Object.freeze({ ...e })),
);

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ShellSpawnRunner {
  /**
   * Run an argv. MUST throw on rejection. The lib NEVER
   * calls `child_process` directly; the runner is the only
   * shell surface.
   *
   * The `code === 0` requirement for a successful dispatch
   * is enforced by the executor impl. The runner MAY also
   * report `timed_out: true` or a non-null `signal`; both
   * cause the executor to throw a typed EXECUTOR_REJECTED
   * error so the dispatch can never produce
   * FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE under those
   * conditions. The minimum required field is `code`; the
   * others are optional for backward compatibility with
   * simple test runners.
   */
  (
    argv: readonly string[],
  ): Promise<{
    stdout: string;
    stderr: string;
    code: number;
    timed_out?: boolean;
    signal?: NodeJS.Signals | null;
  }>;
}

export interface FileSystemRunner {
  /**
   * Write content to an absolute path. MUST throw on
   * rejection. Production wiring maps to `fs/promises.writeFile`;
   * tests inject a mock.
   */
  writeFile: (path: string, content: string) => Promise<void>;
  /**
   * Read content from an absolute path. Production wiring
   * maps to `fs/promises.readFile`; tests inject a mock.
   */
  readFile: (path: string) => Promise<string>;
}

export interface BuildTerminalExecutorsOptions {
  repoRoot: string;
  /**
   * Optional shell runner. When omitted, `shell_executor` is
   * disabled and throws on any call. The slice that introduces
   * real subprocess execution must inject this explicitly.
   * Default: `null` (no real shell).
   */
  shellRunner?: ShellSpawnRunner | null;
  /**
   * Optional filesystem runner. When omitted, defaults to
   * `node:fs/promises.{writeFile, readFile}` (production).
   * Tests inject a mock.
   */
  fs?: FileSystemRunner | null;
  /**
   * Optional audit timestamp source. Defaults to
   * `() => new Date().toISOString()`. Tests inject a fixed clock.
   */
  now?: () => string;
}

export interface HCCExecutorDepsWithIds {
  executors: HCCControlledDispatchExecutorDeps;
}

// ---------------------------------------------------------------------------
// Path gate (shared by writer + patcher)
// ---------------------------------------------------------------------------

function normalizePath(p: string): string {
  // Strip trailing separator; split by both posix + win32 separators.
  const parts = p.split(/[\\/]+/).filter((seg) => seg.length > 0 && seg !== ".");
  // Reject any parent-traversal segment. We treat both ".." and
  // absolute-path components as hostile.
  for (const seg of parts) {
    if (seg === "..") {
      return "__TRAVERSAL__";
    }
  }
  return parts.join(sep);
}

function isRepoLocalPath(raw: string, repoRoot: string): {
  ok: boolean;
  reason?: string;
  absolute?: string;
} {
  if (raw.length === 0) {
    return { ok: false, reason: "path is empty" };
  }
  if (raw.startsWith("~")) {
    return { ok: false, reason: "path starts with ~" };
  }
  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    return { ok: false, reason: "path is windows-absolute" };
  }
  if (raw.startsWith("/") || raw.startsWith(sep)) {
    // Absolute path: only accept if it is inside repoRoot.
    const abs = pathResolve(raw);
    if (!abs.startsWith(pathResolve(repoRoot) + sep) && abs !== pathResolve(repoRoot)) {
      return { ok: false, reason: "absolute path outside repo" };
    }
    return { ok: true, absolute: abs };
  }
  // Relative: must normalize cleanly (no traversal) and start
  // with an allowed prefix.
  const norm = normalizePath(raw);
  if (norm === "__TRAVERSAL__") {
    return { ok: false, reason: "path contains .." };
  }
  if (!FILE_WRITE_ALLOWED_PREFIXES.some((prefix) => norm.startsWith(prefix))) {
    return { ok: false, reason: `relative path must start with one of: ${FILE_WRITE_ALLOWED_PREFIXES.join(", ")}` };
  }
  return { ok: true, absolute: pathResolve(repoRoot, norm) };
}

function hasAllowedExtension(p: string): boolean {
  const lastDot = p.lastIndexOf(".");
  if (lastDot < 0) return false;
  return ALLOWED_FILE_EXTS.has(p.slice(lastDot).toLowerCase());
}

function isLockedPath(absolute: string, repoRoot: string): boolean {
  // Compare against locked paths after resolving to absolute.
  // We use forward-slash form for portable matching.
  const rel = absolute.startsWith(pathResolve(repoRoot) + sep)
    ? absolute.slice(pathResolve(repoRoot).length + 1)
    : absolute;
  for (const locked of LOCKED_PATHS) {
    if (rel === locked) return true;
    if (rel.endsWith(sep + locked)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Build factory
// ---------------------------------------------------------------------------

/**
 * Build a fresh executor triple. The returned object conforms
 * to `HCCControlledDispatchExecutorDeps` and is suitable for
 * injection into the controlled dispatch adapter factory.
 *
 * The factory is the only path to these executors. It does
 * NOT:
 *   - import child_process directly
 *   - write to `~/.hermes`
 *   - set go_no_go / night_run_ready / unattended_ready
 *   - register IPC, scheduler, timer, cron, auto-arm, host
 *
 * The factory DOES:
 *   - validate argv against the allowlist BEFORE calling the
 *     injected `shellRunner` (if any)
 *   - validate paths against the repo gate + locked list
 *     BEFORE calling the injected `fs` runner
 *   - throw on every violation (the dispatch adapter's
 *     `controlledDispatch` catches throws and surfaces them as
 *     `EXECUTOR_REJECTED`)
 */
export function buildTerminalExecutors(
  options: BuildTerminalExecutorsOptions,
): HCCControlledDispatchExecutorDeps {
  const now = options.now ?? (() => new Date().toISOString());
  const repoRoot = pathResolve(options.repoRoot);
  const shellRunner = options.shellRunner ?? null;
  const fs: FileSystemRunner = options.fs ?? {
    writeFile: async (p, c) => {
      await writeFile(p, c, "utf-8");
    },
    readFile: async (p) => {
      return readFile(p, "utf-8");
    },
  };

  // shell_executor: allowlist + structured argv only.
  const shell_executor: HCCControlledDispatchExecutorDeps["shell_executor"] = async (
    command_id,
    argv,
  ) => {
    if (shellRunner === null) {
      throw new Error(
        "shell_executor disabled: no spawn runner injected. The terminal executor impl refuses to spawn by default; production wiring must inject a runner via buildTerminalExecutors({ shellRunner }).",
      );
    }
    if (!Array.isArray(argv) || argv.length === 0) {
      throw new Error("shell_executor: argv must be a non-empty array");
    }
    for (let i = 0; i < argv.length; i++) {
      if (typeof argv[i] !== "string" || argv[i].length === 0) {
        throw new Error(`shell_executor: argv[${i}] must be a non-empty string`);
      }
    }
    // Allowlist check: the argv must match a known entry
    // EXACTLY. No partial matches, no glob, no shell parsing.
    const match = HCC_DISPATCH_SHELL_ALLOWLIST.find(
      (e) =>
        e.argv.length === argv.length &&
        e.argv.every((a, i) => a === argv[i]),
    );
    if (!match) {
      throw new Error(
        `shell_executor: argv not in allowlist (no command_id="<unknown>"). Rejecting before spawn.`,
      );
    }
    if (match.command_id !== command_id) {
      throw new Error(
        `shell_executor: command_id "${command_id}" does not match the allowlist entry "${match.command_id}". Rejecting before spawn.`,
      );
    }
    // argv is the allowlist's argv (identity-matched), so the
    // runner gets exactly what the allowlist prescribes.
    const result = await shellRunner(match.argv);
    // Post-runner result semantics: a non-zero exit code,
    // a non-null signal, or a timed-out child MUST NOT
    // produce a successful dispatch. Throwing here
    // propagates as EXECUTOR_REJECTED through the dispatch
    // adapter, so the final dispatch can never reach
    // FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE for a
    // failed child. Only `code === 0 && !timed_out && signal
    // === null` produces a successful dispatch.
    if (result.timed_out === true) {
      throw new Error(
        `shell_executor: shell timed out (command_id="${match.command_id}"). Rejecting.`,
      );
    }
    if (result.signal !== null && result.signal !== undefined) {
      throw new Error(
        `shell_executor: shell terminated by signal ${result.signal} (command_id="${match.command_id}"). Rejecting.`,
      );
    }
    if (result.code !== 0) {
      throw new Error(
        `shell_executor: shell exited with non-zero code ${result.code} (command_id="${match.command_id}"). Rejecting.`,
      );
    }
    return { command_id: match.command_id };
  };

  // writer: repo-local path + allowed extension + non-locked.
  const writer: HCCControlledDispatchExecutorDeps["writer"] = async (
    target_path,
    content,
  ) => {
    if (typeof content !== "string") {
      throw new Error("writer: content must be a string");
    }
    const gate = isRepoLocalPath(target_path, repoRoot);
    if (!gate.ok || gate.absolute === undefined) {
      throw new Error(`writer: ${gate.reason ?? "path not repo-local"}`);
    }
    if (!hasAllowedExtension(gate.absolute)) {
      throw new Error(
        "writer: target_path must end in .md, .json, .ts, .tsx, or .txt",
      );
    }
    if (isLockedPath(gate.absolute, repoRoot)) {
      throw new Error(
        `writer: target_path is in a locked scope: ${target_path}`,
      );
    }
    await fs.writeFile(gate.absolute, content);
    return { controlled_command_id: `file-write:${now()}:${gate.absolute}` };
  };

  // patcher: same path gate, plus structured patch validation.
  const patcher: HCCControlledDispatchExecutorDeps["patcher"] = async (
    target_path,
    patch,
  ) => {
    const gate = isRepoLocalPath(target_path, repoRoot);
    if (!gate.ok || gate.absolute === undefined) {
      throw new Error(`patcher: ${gate.reason ?? "path not repo-local"}`);
    }
    if (!hasAllowedExtension(gate.absolute)) {
      throw new Error(
        "patcher: target_path must end in .md, .json, .ts, .tsx, or .txt",
      );
    }
    if (isLockedPath(gate.absolute, repoRoot)) {
      throw new Error(
        `patcher: target_path is in a locked scope: ${target_path}`,
      );
    }
    if (!Array.isArray(patch) || patch.length === 0) {
      throw new Error("patcher: patch must be a non-empty array");
    }
    for (let i = 0; i < patch.length; i++) {
      const entry = patch[i];
      if (entry === null || typeof entry !== "object") {
        throw new Error(`patcher: patch[${i}] must be an object { key, value }`);
      }
      const e = entry as { key?: unknown; value?: unknown };
      if (typeof e.key !== "string" || e.key.length === 0) {
        throw new Error(`patcher: patch[${i}].key must be a non-empty string`);
      }
    }
    // Read current content, apply shallow merge, write back.
    let current: Record<string, unknown> = {};
    try {
      const raw = await fs.readFile(gate.absolute);
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        current = parsed as Record<string, unknown>;
      }
    } catch {
      // File does not exist or is not valid JSON; start fresh.
      current = {};
    }
    for (const entry of patch) {
      const e = entry as { key: string; value: unknown };
      current[e.key] = e.value;
    }
    await fs.writeFile(gate.absolute, JSON.stringify(current, null, 2));
    return { controlled_command_id: `config-patch:${now()}:${gate.absolute}` };
  };

  return { shell_executor, writer, patcher };
}
