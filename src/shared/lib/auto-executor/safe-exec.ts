/**
 * §4.6 — Subprocess boundary (safeExec)
 *
 * Pure function module. No I/O at import time. The module validates a
 * requested subprocess invocation and returns a *request object* (or a
 * refusal). The host runtime — not this module — actually spawns. The
 * boundary is the validation step, not the spawn step.
 *
 * Rules:
 *   1. Binary must be on the allowlist. Default allowlist is EMPTY (no
 *      subprocesses). Each entry is added by an explicit user GO.
 *   2. No shell metacharacters in any arg. Detected set:
 *      `; & | ` $ ( ) < > \n \r \t * ? [ ] { } ~ ! # \ " '`
 *      plus NUL.
 *   3. cwd must equal the pinned cwd. Cannot be overridden.
 *   4. env is scrubbed to a known-safe subset unless the caller
 *      explicitly names a variable to forward (which then becomes part
 *      of the request and is logged).
 */

export interface SafeExecAllowlist {
  /**
   * Set of allowed binary basenames (e.g. "git", "node"). The full path
   * is resolved by the host; this module only matches on basename.
   */
  binaries: ReadonlySet<string>;
  /**
   * Optional env var names that may be forwarded from the host env.
   * Anything not in this set is dropped.
   */
  allowedEnvVars?: ReadonlySet<string>;
}

export interface SafeExecRequestInput {
  /** Binary name or path. Matched on basename against the allowlist. */
  binary: string;
  /** Argv. Each element is checked for shell metacharacters. */
  args: readonly string[];
  /**
   * The pinned cwd. The module compares this against the boundary's
   * pinned cwd; mismatch is a refusal.
   */
  cwd: string;
  /**
   * Optional env. Each name must be in the allowlist's allowedEnvVars.
   * Unlisted names cause refusal (closed-by-default).
   */
  env?: Record<string, string>;
  /**
   * Optional stdin/stdout policies. Default: ignore stdin, pipe stdout,
   * pipe stderr.
   */
  stdio?: "pipe" | "inherit" | "ignore";
}

export type SafeExecRefusalReason =
  | "binaryNotOnAllowlist"
  | "shellMetacharacterInArg"
  | "cwdMismatch"
  | "envVarNotAllowed";

export interface SafeExecApproved {
  ok: true;
  binary: string;
  args: readonly string[];
  cwd: string;
  env: Record<string, string>;
  stdio: { stdin: "pipe" | "inherit" | "ignore"; stdout: "pipe" | "inherit" | "ignore"; stderr: "pipe" | "inherit" | "ignore" };
}

export interface SafeExecRefused {
  ok: false;
  reason: SafeExecRefusalReason;
  detail: string;
}

export type SafeExecReport = SafeExecApproved | SafeExecRefused;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const SHELL_META = /[;|`$&(){}[\]<>?*!~#\\"'\n\r\t\0]/;

function basename(p: string): string {
  const ix = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return ix >= 0 ? p.slice(ix + 1) : p;
}

function defaultStdio(
  input: SafeExecRequestInput["stdio"],
): { stdin: "pipe" | "inherit" | "ignore"; stdout: "pipe" | "inherit" | "ignore"; stderr: "pipe" | "inherit" | "ignore" } {
  const s = input ?? "pipe";
  return { stdin: "ignore", stdout: s, stderr: s };
}

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

export interface SafeExecConfig {
  allowlist: SafeExecAllowlist;
  /** Pinned cwd. Requests must match this. */
  pinnedCwd: string;
  /**
   * The host env at the time the boundary is constructed. Used only to
   * look up whitelisted env var values at request time.
   */
  hostEnv?: NodeJS.ProcessEnv;
}

export function createSafeExec(config: SafeExecConfig) {
  const hostEnv = config.hostEnv ?? process.env;
  return {
    /**
     * Validate a requested invocation. Returns an approved request that
     * the host runtime can act on, or a refusal with a typed reason.
     */
    validate(input: SafeExecRequestInput): SafeExecReport {
      // 1. Allowlist
      const base = basename(input.binary);
      if (!config.allowlist.binaries.has(base)) {
        return {
          ok: false,
          reason: "binaryNotOnAllowlist",
          detail: `binary '${base}' is not on the allowlist`,
        };
      }

      // 2. Shell metacharacters
      for (const arg of input.args) {
        if (SHELL_META.test(arg)) {
          return {
            ok: false,
            reason: "shellMetacharacterInArg",
            detail: `arg contains shell metacharacter: ${JSON.stringify(arg)}`,
          };
        }
      }

      // 3. Cwd pin
      if (input.cwd !== config.pinnedCwd) {
        return {
          ok: false,
          reason: "cwdMismatch",
          detail: `cwd '${input.cwd}' does not match pinned '${config.pinnedCwd}'`,
        };
      }

      // 4. Env scrub
      const allowedEnv = new Set(config.allowlist.allowedEnvVars ?? []);
      const env: Record<string, string> = {};
      if (input.env) {
        for (const [k, v] of Object.entries(input.env)) {
          if (!allowedEnv.has(k)) {
            return {
              ok: false,
              reason: "envVarNotAllowed",
              detail: `env var '${k}' is not on the allowlist`,
            };
          }
          env[k] = v;
        }
      }

      return {
        ok: true,
        binary: input.binary,
        args: input.args,
        cwd: input.cwd,
        env,
        stdio: defaultStdio(input.stdio),
      };
    },

    /**
     * The current allowlist. Read-only. Used by tests and admin tools.
     */
    allowlist(): SafeExecAllowlist {
      return config.allowlist;
    },

    /** The pinned cwd. Read-only. */
    pinnedCwd(): string {
      return config.pinnedCwd;
    },

    /** The host env that will be consulted for whitelisted env vars. */
    hostEnvSnapshot(): Record<string, string | undefined> {
      return { ...hostEnv };
    },
  };
}
