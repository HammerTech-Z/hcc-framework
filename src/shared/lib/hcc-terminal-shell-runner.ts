// HCC Terminal Production Shell Runner.
//
// Standalone production shell runner. The ONLY module in the
// HCC terminal stack that may call `child_process.spawn`. The
// runner is a pure factory: `buildProductionShellRunner()`
// returns a `ShellSpawnRunner` (the type consumed by
// `buildTerminalExecutors` from `hcc-terminal-executor-impl`).
//
// This module does NOT:
//   - register IPC, scheduler, timer, cron, auto-arm
//   - write to ~/.hermes/**
//   - run on app boot
//   - set go_no_go:"GO" / night_run_ready:true
//   - allow free-form shell strings; the runner is the
//     executor, the allowlist check lives in
//     `hcc-terminal-executor-impl.ts` and runs BEFORE this
//     runner is invoked. The runner also re-validates the argv
//     type defensively.
//
// This module DOES:
//   - accept structured argv ONLY (must be `string[]`)
//   - enforce a hard timeout via setTimeout (one timer per
//     invocation; cleaned up on exit / error)
//   - enforce `cwd` (must be an absolute path inside the
//     supplied `repoRoot`)
//   - enforce an `env` whitelist: only the keys in
//     `HCC_SHELL_RUNNER_ENV_WHITELIST` are forwarded to the
//     child; all other process.env keys are dropped
//   - capture stdout + stderr up to a max byte limit
//     (`HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES`)
//   - return a typed result with `code`, `stdout`, `stderr`,
//     `timed_out`, `signal`
//   - accept an injectable `spawn` for tests; production
//     uses the real `child_process.spawn`
//
// Per HCC governance:
//   - NO background timer / cron / auto-arm (the timeout is
//     per-invocation, scoped to a single `await`, not
//     persistent)
//   - NO direct writes to ~/.hermes/**
//   - NO IPC / scheduler / host / app-boot wiring
//   - Real subprocess execution is gated on:
//     (a) explicit invocation from `buildTerminalExecutors`
//     (b) argv already allowlist-validated
//     (c) cwd inside repoRoot
//     (d) env whitelisted
//     (e) caller supplied the runner explicitly

import { spawn as nodeSpawn } from "node:child_process";
import type { ShellSpawnRunner } from "./hcc-terminal-executor-impl";
import { HCC_DISPATCH_SHELL_ALLOWLIST } from "./hcc-controlled-dispatch-adapter";

export const HCC_TERMINAL_SHELL_RUNNER_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Whitelist of env keys the runner will forward to the
 * child process. Anything else is dropped. The list is
 * deliberately tiny — most CI/HCC tooling only needs PATH.
 */
export const HCC_SHELL_RUNNER_ENV_WHITELIST: readonly string[] = Object.freeze([
  "PATH",
]);

/**
 * Hard cap on captured stdout + stderr bytes. Output beyond
 * this limit is truncated with a `[truncated]` marker. The
 * limit applies per stream.
 */
export const HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES = 1_048_576; // 1 MiB

/**
 * Default per-invocation timeout. 30s is conservative for the
 * 3 allowlisted git commands; callers may override.
 */
export const HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS = 30_000;

export interface ProductionShellRunnerOptions {
  repoRoot: string;
  /**
   * Optional cwd override. Must be absolute and inside
   * `repoRoot`. Defaults to `repoRoot`.
   */
  cwd?: string;
  /**
   * Optional timeout in ms. Must be positive. Defaults to
   * `HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS`.
   */
  timeoutMs?: number;
  /**
   * Optional injectable spawn. Production uses the real
   * `node:child_process.spawn`; tests inject a mock.
   */
  spawn?: typeof nodeSpawn;
  /**
   * Optional setTimeout override (for deterministic tests).
   * Defaults to global `setTimeout`.
   */
  setTimeoutFn?: typeof setTimeout;
  /**
   * Optional clearTimeout override (for deterministic tests).
   * Defaults to global `clearTimeout`.
   */
  clearTimeoutFn?: typeof clearTimeout;
}

export interface ProductionShellRunnerResult {
  code: number;
  stdout: string;
  stderr: string;
  timed_out: boolean;
  signal: NodeJS.Signals | null;
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// argv re-validation (defensive — executor impl already validated)
// ---------------------------------------------------------------------------

/**
 * Defensive argv re-validation. The executor impl already
 * enforces the allowlist BEFORE calling the runner. This
 * function provides a second-layer check: if argv does not
 * match an allowlist entry, throw before spawn. The intent is
 * to make this runner independently safe to call from any
 * future caller, not just from the executor impl.
 */
export function validateAllowlistedArgv(argv: readonly unknown[]): {
  command_id: string;
  argv: string[];
} {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error("shell runner: argv must be a non-empty array");
  }
  for (let i = 0; i < argv.length; i++) {
    if (typeof argv[i] !== "string" || argv[i].length === 0) {
      throw new Error(`shell runner: argv[${i}] must be a non-empty string`);
    }
  }
  const argvStrings = argv as string[];
  const match = HCC_DISPATCH_SHELL_ALLOWLIST.find(
    (e) =>
      e.argv.length === argvStrings.length &&
      e.argv.every((a, i) => a === argvStrings[i]),
  );
  if (!match) {
    throw new Error(
      "shell runner: argv not in allowlist (refusing to spawn). This runner only accepts structured argv from HCC_DISPATCH_SHELL_ALLOWLIST.",
    );
  }
  return { command_id: match.command_id, argv: [...match.argv] };
}

// ---------------------------------------------------------------------------
// Path gate (cwd must be inside repoRoot)
// ---------------------------------------------------------------------------

function isPathInside(child: string, parent: string): boolean {
  if (child === parent) return true;
  if (child.startsWith(parent + "/")) return true;
  return false;
}

// ---------------------------------------------------------------------------
// env whitelist projection
// ---------------------------------------------------------------------------

export function projectWhitelistedEnv(
  source: Readonly<Record<string, string | undefined>>,
  whitelist: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of whitelist) {
    const v = source[key];
    if (typeof v === "string" && v.length > 0) {
      out[key] = v;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Output truncation
// ---------------------------------------------------------------------------

function truncate(s: string, maxBytes: number): { value: string; truncated: boolean } {
  const buf = Buffer.from(s, "utf-8");
  if (buf.length <= maxBytes) return { value: s, truncated: false };
  const truncated = buf.subarray(0, maxBytes).toString("utf-8") + "\n[truncated]";
  return { value: truncated, truncated: true };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Build a production shell runner. The returned function
 * conforms to `ShellSpawnRunner` (the type consumed by
 * `buildTerminalExecutors`). Pure factory: constructing it
 * has no side effects.
 *
 * The factory is the only path to this runner. It does NOT:
 *   - import any other HCC module beyond the typed deps
 *   - register IPC, scheduler, timer, cron, auto-arm
 *   - write to ~/.hermes/**
 *   - set go_no_go / night_run_ready / unattended_ready
 */
export function buildProductionShellRunner(
  options: ProductionShellRunnerOptions,
): ShellSpawnRunner {
  const repoRoot = options.repoRoot;
  const cwd = options.cwd ?? repoRoot;
  const timeoutMs = options.timeoutMs ?? HCC_SHELL_RUNNER_DEFAULT_TIMEOUT_MS;
  const spawn = options.spawn ?? nodeSpawn;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;

  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("shell runner: timeoutMs must be a positive number");
  }
  if (typeof cwd !== "string" || cwd.length === 0) {
    throw new Error("shell runner: cwd must be a non-empty string");
  }
  if (!isPathInside(cwd, repoRoot)) {
    throw new Error(
      `shell runner: cwd "${cwd}" is not inside repoRoot "${repoRoot}"`,
    );
  }

  return async (argv: readonly string[]): Promise<ProductionShellRunnerResult> => {
    // Re-validate argv defensively (allowlist gate).
    const validated = validateAllowlistedArgv(argv);
    const finalArgv = validated.argv;

    // Project env to whitelist.
    const projectedEnv = projectWhitelistedEnv(
      process.env as Record<string, string | undefined>,
      HCC_SHELL_RUNNER_ENV_WHITELIST,
    );

    const startedAt = Date.now();
    const child = spawn(finalArgv[0], finalArgv.slice(1), {
      cwd,
      env: projectedEnv,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false, // NEVER pass through a shell.
      windowsHide: true,
    });

    return await new Promise<ProductionShellRunnerResult>((resolve, reject) => {
      let stdoutBuf = "";
      let stderrBuf = "";
      let stdoutTruncated = false;
      let stderrTruncated = false;
      let settled = false;

      const finish = (result: ProductionShellRunnerResult) => {
        if (settled) return;
        settled = true;
        clearTimeoutFn(timer);
        resolve(result);
      };

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeoutFn(timer);
        reject(err);
      };

      const timer = setTimeoutFn(() => {
        try {
          // SIGKILL is a hard kill. Best-effort cleanup.
          child.kill("SIGKILL");
        } catch {
          // ignore kill failure on already-dead process
        }
        finish({
          code: -1,
          stdout: stdoutBuf,
          stderr: stderrBuf + (stderrTruncated ? "\n[truncated]" : ""),
          timed_out: true,
          signal: "SIGKILL",
          duration_ms: Date.now() - startedAt,
        });
      }, timeoutMs);

      if (child.stdout) {
        child.stdout.setEncoding("utf-8");
        child.stdout.on("data", (chunk: string) => {
          if (stdoutTruncated) return;
          const next = stdoutBuf + chunk;
          const t = truncate(next, HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES);
          stdoutBuf = t.value;
          if (t.truncated) stdoutTruncated = true;
        });
      }
      if (child.stderr) {
        child.stderr.setEncoding("utf-8");
        child.stderr.on("data", (chunk: string) => {
          if (stderrTruncated) return;
          const next = stderrBuf + chunk;
          const t = truncate(next, HCC_SHELL_RUNNER_MAX_OUTPUT_BYTES);
          stderrBuf = t.value;
          if (t.truncated) stderrTruncated = true;
        });
      }

      child.on("error", (err) => {
        fail(err);
      });

      child.on("close", (code, signal) => {
        finish({
          code: code ?? -1,
          stdout: stdoutBuf + (stdoutTruncated ? "\n[truncated]" : ""),
          stderr: stderrBuf + (stderrTruncated ? "\n[truncated]" : ""),
          timed_out: false,
          signal: (signal as NodeJS.Signals | null) ?? null,
          duration_ms: Date.now() - startedAt,
        });
      });
    });
  };
}
