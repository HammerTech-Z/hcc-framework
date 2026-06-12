/**
 * §4.2 — Wrong repo / worktree guard
 *
 * Pure function module. No I/O at import time. No IPC. No main process.
 *
 * Pin the expected {repoRoot, branch, head, cwd} at boundary construction,
 * then assert on every action that the live state still matches. Refuse on
 * any mismatch. This is the first thing an action passes through.
 *
 * The module does NOT spawn anything. It produces a GuardReport that the
 * caller (a future executor bootstrap, not this module) uses to decide
 * whether to proceed.
 */

import { realpathSync } from "node:fs";
import { resolve } from "node:path";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface PinnedState {
  /** Absolute, realpath-resolved path to the repo root. */
  expectedRepoRoot: string;
  /** Branch name, e.g. "hermes-pro-main". */
  expectedBranch: string;
  /** Full 40-char commit sha. */
  expectedHead: string;
  /** Absolute, realpath-resolved cwd. */
  expectedCwd: string;
  /**
   * Working-tree dirty paths that are policy-excluded (e.g. .claude/settings.json).
   * Any non-excluded dirty path causes refusal.
   */
  policyExcludedDirtyPaths?: string[];
  /**
   * Additional dirty paths the caller considers acceptable at action time.
   * Empty by default — the executor must work on a clean tree.
   */
  toleratedDirtyPaths?: string[];
}

export interface LiveState {
  repoRoot: string;
  branch: string;
  head: string;
  cwd: string;
  /** Output of `git status --porcelain` or equivalent. Empty = clean. */
  dirtyPaths: string[];
}

export type GuardRefusalReason =
  | "repoRootMismatch"
  | "branchMismatch"
  | "headMismatch"
  | "cwdMismatch"
  | "nonExcludedDirty";

export interface GuardOk {
  ok: true;
}

export interface GuardRefused {
  ok: false;
  reason: GuardRefusalReason;
  detail: string;
}

export type GuardReport = GuardOk | GuardRefused;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function safeRealpath(p: string): string {
  try {
    return realpathSync(resolve(p));
  } catch {
    return resolve(p);
  }
}

/** SHA-1 / SHA-256 hex string, 7+ chars. Case-insensitive compare. */
function isShaLike(s: string): boolean {
  return /^[0-9a-f]{7,64}$/i.test(s);
}

function normalizeSha(s: string): string {
  return s.trim().toLowerCase();
}

function normalizePath(p: string): string {
  return safeRealpath(p);
}

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

/**
 * Assert that the live working-tree state matches the pinned state.
 * Refuses on any mismatch. The returned GuardReport is the only signal —
 * the module does not throw, so the caller decides how to escalate.
 */
export function assertPinnedStateMatches(
  pinned: PinnedState,
  live: LiveState,
): GuardReport {
  // Repo root
  if (normalizePath(live.repoRoot) !== normalizePath(pinned.expectedRepoRoot)) {
    return {
      ok: false,
      reason: "repoRootMismatch",
      detail: `expected ${pinned.expectedRepoRoot}, got ${live.repoRoot}`,
    };
  }

  // Branch
  if (live.branch !== pinned.expectedBranch) {
    return {
      ok: false,
      reason: "branchMismatch",
      detail: `expected ${pinned.expectedBranch}, got ${live.branch}`,
    };
  }

  // Head
  if (!isShaLike(live.head) || !isShaLike(pinned.expectedHead)) {
    return {
      ok: false,
      reason: "headMismatch",
      detail: "head sha malformed",
    };
  }
  if (normalizeSha(live.head) !== normalizeSha(pinned.expectedHead)) {
    return {
      ok: false,
      reason: "headMismatch",
      detail: `expected ${pinned.expectedHead}, got ${live.head}`,
    };
  }

  // Cwd
  if (normalizePath(live.cwd) !== normalizePath(pinned.expectedCwd)) {
    return {
      ok: false,
      reason: "cwdMismatch",
      detail: `expected ${pinned.expectedCwd}, got ${live.cwd}`,
    };
  }

  // Dirty paths: only tolerated or policy-excluded are acceptable.
  const allowed = new Set([
    ...(pinned.policyExcludedDirtyPaths ?? []).map(normalizePath),
    ...(pinned.toleratedDirtyPaths ?? []).map(normalizePath),
  ]);
  for (const dirty of live.dirtyPaths) {
    if (!allowed.has(normalizePath(dirty))) {
      return {
        ok: false,
        reason: "nonExcludedDirty",
        detail: `uncommitted change at ${dirty}`,
      };
    }
  }

  return { ok: true };
}
