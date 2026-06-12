/**
 * §4.8 — `~/.hermes` write policy
 *
 * Pure function module. No I/O at import time. The boundary check that
 * every filesystem write intended for `~/.hermes/**` must pass through
 * before the host runtime performs the write.
 *
 * Rules:
 *   1. Writes under `~/.hermes/` are REFUSED unless a per-write token
 *      is presented. The token is single-use: once consumed, the same
 *      token cannot be reused.
 *   2. The token is tied to a specific resolved absolute path. A token
 *      for `/A` cannot be used to write `/B` even under `~/.hermes/`.
 *   3. The `~/.hermes` root itself is resolved at construction time
 *      and used as the basis for "is this path under hermes home?".
 *      Symlinks are resolved via realpath.
 *   4. Writes outside `~/.hermes/` are NOT refused by this module —
 *      they are not its concern. The boundary composer's
 *      worktree-guard + apply-path policy covers the rest.
 *
 * The module does NOT perform the write. It produces a verdict the
 * caller (host runtime) acts on.
 */

import { realpathSync, existsSync } from "node:fs";
import { resolve, sep } from "node:path";
import { homedir } from "node:os";
import { randomBytes, createHmac } from "node:crypto";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface HermesWriteGuardConfig {
  /**
   * The hermes home root. Defaults to `<homedir()>/.hermes`. The check
   * is "is the resolved path under this root?".
   */
  hermesHome?: string;
  /**
   * Server-side secret used to mint/verify per-write tokens. Injected
   * at construction time. In production this is the same secret that
   * mints the `armed: true` token on the GO record.
   */
  tokenSecret: string;
  /**
   * Optional override for the boundary's notion of `now`. Used by
   * tests to assert expiry.
   */
  now?: () => number;
}

export interface PerWriteToken {
  /** Token id. */
  id: string;
  /** Token secret HMAC. The caller passes the whole token; the boundary
   * verifies the HMAC against `id || resolvedPath || issuedAt || ttlMs`. */
  mac: string;
  /** Resolved absolute path the token authorizes a write to. */
  resolvedPath: string;
  /** ISO 8601 issue time. */
  issuedAt: string;
  /** TTL in ms. Token expires at issuedAt + ttlMs. */
  ttlMs: number;
}

export type WriteVerdict =
  | { ok: true }
  | { ok: false; reason: WriteRefusalReason; detail: string };

export type WriteRefusalReason =
  | "outsideHermesHome"
  | "noToken"
  | "tokenReused"
  | "tokenPathMismatch"
  | "tokenExpired"
  | "tokenInvalidMac"
  | "pathNotAbsolute";

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

export function createHermesWriteGuard(config: HermesWriteGuardConfig) {
  // Resolve the hermes home at construction time so that the prefix
  // check is consistent with safeRealpath() (which also resolves
  // symlinks). On macOS, /var is a symlink to /private/var; without
  // this normalization a path under the tempdir would not match the
  // pin.
  const hermesHome = safeRealpathStatic(
    resolve(config.hermesHome ?? resolve(homedir(), ".hermes")),
  );
  const now = config.now ?? Date.now;

  /**
   * Is the path under hermes home? (After realpath resolution.)
   */
  const isUnderHermesHome = (resolved: string): boolean => {
    return resolved === hermesHome || resolved.startsWith(hermesHome + sep);
  };

  /**
   * Resolve a path to its absolute realpath form. If the file does not
   * exist, resolve the longest existing prefix and append the rest.
   */
  const safeRealpath = (p: string): string => {
    if (!existsSync(p)) {
      // Walk up until we find something that exists, then re-append.
      const stack: string[] = [];
      let cur = p;
      while (!existsSync(cur)) {
        const ix = Math.max(cur.lastIndexOf("/"), cur.lastIndexOf("\\"));
        if (ix < 0) return resolve(p);
        stack.unshift(cur.slice(ix + 1));
        cur = cur.slice(0, ix);
        if (cur === "") return resolve(p);
      }
      const base = realpathSync(cur);
      return resolve(base, ...stack);
    }
    return realpathSync(p);
  };

  /** Static realpath helper, used at construction time before the
   * closure is built. Mirrors safeRealpath's "find longest existing
   * prefix" behavior. */
  function safeRealpathStatic(p: string): string {
    if (existsSync(p)) return realpathSync(p);
    const stack: string[] = [];
    let cur = p;
    while (!existsSync(cur)) {
      const ix = Math.max(cur.lastIndexOf("/"), cur.lastIndexOf("\\"));
      if (ix < 0) return resolve(p);
      stack.unshift(cur.slice(ix + 1));
      cur = cur.slice(0, ix);
      if (cur === "") return resolve(p);
    }
    const base = realpathSync(cur);
    return resolve(base, ...stack);
  }

  /**
   * Mint a per-write token for a specific path. The path is realpath'd
   * (consistent with safeRealpath used in checkWrite) before being
   * stored in the token. This ensures a token minted by one guard is
   * verifiable by another guard constructed against the same
   * hermesHome, regardless of whether their realpath'd roots match
   * bit-for-bit.
   */
  const mintToken = (path: string, ttlMs: number = 60_000): PerWriteToken => {
    const resolvedPath = safeRealpath(path);
    const id = randomBytes(16).toString("hex");
    const issuedAt = new Date(now()).toISOString();
    const mac = createHmac("sha256", config.tokenSecret)
      .update(`${id}|${resolvedPath}|${issuedAt}|${ttlMs}`)
      .digest("hex");
    return { id, mac, resolvedPath, issuedAt, ttlMs };
  };

  /**
   * Verify a token. Checks MAC, path match, expiry. Marks the token
   * as consumed (single-use). Subsequent calls with the same token
   * id are refused.
   */
  const consumed = new Set<string>();

  const verifyToken = (token: PerWriteToken): WriteVerdict => {
    if (consumed.has(token.id)) {
      return { ok: false, reason: "tokenReused", detail: `token ${token.id} already consumed` };
    }
    const expectedMac = createHmac("sha256", config.tokenSecret)
      .update(`${token.id}|${token.resolvedPath}|${token.issuedAt}|${token.ttlMs}`)
      .digest("hex");
    if (expectedMac !== token.mac) {
      return { ok: false, reason: "tokenInvalidMac", detail: `token ${token.id} MAC mismatch` };
    }
    const issuedAtMs = Date.parse(token.issuedAt);
    if (!Number.isFinite(issuedAtMs)) {
      return { ok: false, reason: "tokenInvalidMac", detail: `token ${token.id} issuedAt unparseable` };
    }
    if (now() > issuedAtMs + token.ttlMs) {
      return { ok: false, reason: "tokenExpired", detail: `token ${token.id} expired` };
    }
    consumed.add(token.id);
    return { ok: true };
  };

  return {
    hermesHome(): string {
      return hermesHome;
    },

    /**
     * Check that a write to `path` is allowed. If the path is under
     * hermes home, a token is required. Outside hermes home, the
     * module does not refuse — it returns `{ok: true}` and the caller's
     * broader policy (worktree-guard, etc.) applies.
     */
    checkWrite(input: { path: string; token?: PerWriteToken }): WriteVerdict {
      if (!input.path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(input.path)) {
        return { ok: false, reason: "pathNotAbsolute", detail: `path '${input.path}' is not absolute` };
      }
      const resolved = safeRealpath(input.path);
      if (!isUnderHermesHome(resolved)) {
        return { ok: true };
      }
      if (!input.token) {
        return { ok: false, reason: "noToken", detail: `write under '${hermesHome}' requires a per-write token` };
      }
      if (input.token.resolvedPath !== resolved) {
        return {
          ok: false,
          reason: "tokenPathMismatch",
          detail: `token was minted for '${input.token.resolvedPath}', write targets '${resolved}'`,
        };
      }
      return verifyToken(input.token);
    },

    /** Mint a per-write token. Public so the host can issue them on demand. */
    mintToken,

    /** For tests: number of tokens consumed so far. */
    consumedCount(): number {
      return consumed.size;
    },
  };
}
