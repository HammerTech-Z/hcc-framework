/**
 * §4.3 — Kill switch
 *
 * Pure function module. No I/O at import time. No IPC. No main process.
 *
 * Two complementary kill channels:
 *   1. In-process AbortController — the executor creates one, threads the
 *      `signal` into its action loop, and respects `signal.aborted` at every
 *      awaitable step. Stop SLO target: 5s.
 *   2. Control file — the host (or a peer) writes the control file. The
 *      executor polls on a tick (configurable, default 250ms) and triggers
 *      the same AbortController.
 *
 * Idempotent: calling kill() twice is a no-op. Stale control files (mtime
 * older than `staleAfterMs`) are ignored.
 *
 * The module does NOT spawn or signal any external process. It returns a
 * KillSwitch handle that the caller wires into its loop.
 */

import { statSync } from "node:fs";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface KillSwitchConfig {
  /**
   * Path to the control file. When this file exists and is not stale,
   * the kill signal fires. Pinned at construction time.
   */
  controlFilePath?: string;
  /** Files older than this are considered stale. Default 24h. */
  staleAfterMs?: number;
  /**
   * If true, the kill switch is in dry-run mode: it logs the trigger event
   * but does not actually abort. Default false. Used by tests.
   */
  dryRun?: boolean;
}

export interface KillSwitch {
  /** The AbortSignal the executor must thread through its action loop. */
  signal: AbortSignal;
  /**
   * Manually trigger the kill (e.g. from a SIGTERM handler in the host).
   * Idempotent.
   */
  kill: (reason: string) => void;
  /**
   * Check the control file. Returns true if the kill should fire.
   * Pure read of the file's mtime; safe to call on a tick.
   */
  shouldKillFromControlFile: () => boolean;
  /** True after kill() has been called (or control file triggered it). */
  isKilled: () => boolean;
  /** The reason kill was triggered, or null if not killed. */
  killReason: () => string | null;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function isStale(
  controlFilePath: string,
  staleAfterMs: number,
  now: number,
): { stale: boolean; exists: boolean } {
  try {
    const s = statSync(controlFilePath);
    const age = now - s.mtimeMs;
    return { stale: age > staleAfterMs, exists: true };
  } catch {
    return { stale: false, exists: false };
  }
}

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

export function createKillSwitch(config: KillSwitchConfig = {}): KillSwitch {
  const staleAfterMs = config.staleAfterMs ?? 24 * 60 * 60 * 1000;
  const dryRun = config.dryRun ?? false;
  const controlFilePath = config.controlFilePath;

  const controller = new AbortController();
  let reason: string | null = null;

  const fire = (why: string): void => {
    if (controller.signal.aborted) return;
    reason = why;
    if (!dryRun) {
      controller.abort();
    }
  };

  return {
    signal: controller.signal,
    kill: (why: string): void => {
      fire(why);
    },
    shouldKillFromControlFile: (): boolean => {
      if (!controlFilePath) return false;
      const { exists, stale } = isStale(controlFilePath, staleAfterMs, Date.now());
      if (!exists) return false;
      if (stale) return false;
      return true;
    },
    isKilled: (): boolean => controller.signal.aborted,
    killReason: (): string | null => reason,
  };
}

/**
 * Convenience: poll-based kill watcher. The host invokes this on a tick
 * (e.g. setInterval(250ms)) and the function will trigger the kill switch
 * if the control file is present and fresh. Returns a function the host
 * can call to stop the watcher.
 */
export function watchControlFile(
  ks: KillSwitch,
  intervalMs: number = 250,
): () => void {
  if (intervalMs <= 0) {
    throw new Error("intervalMs must be positive");
  }
  const handle = setInterval(() => {
    if (ks.isKilled()) return;
    if (ks.shouldKillFromControlFile()) {
      ks.kill("control file present");
    }
  }, intervalMs);
  return () => clearInterval(handle);
}
