// HCC Auto Executor — Start slice.
//
// Transitions the armed host from `armed` to `running`.
// Does NOT call `host.runMockAction()`. Does NOT spawn any subprocess.
// Does NOT register any IPC channel. Does NOT start any timer.
//
// This module is a *helper*, not a hook. `src/main/index.ts` does NOT
// import this module. The trigger surface is held for a future slice
// (`HCC-AUTO-EXECUTOR-DRY-RUN-ACTION-001`).
//
// Per the threat model:
//   - D1 — runaway execution loop is gated by host.start() being a
//     single-shot transition; the host does not self-iterate
//   - E1 — subprocess elevation is gated by safeExec allowlist = empty
//   - T3 — worktree guard re-asserts pinned state on every assertReady()
//     call inside the boundary; start() does not bypass this
//
// The start helper:
//   - requires the host to be already installed AND armed
//   - refuses if state is anything other than `armed`
//   - returns true on the single successful transition `armed` → `running`
//   - is one-shot: calling start again from `running` returns false
//   - never invokes an action
//   - never spawns a subprocess

import {
  getInstalledAutoExecutorHost,
  getBootstrapPostureReport,
} from "./auto-executor-bootstrap";

// -----------------------------------------------------------------
// Module-scoped start record
// -----------------------------------------------------------------

interface StartAttemptRecord {
  attempted_at: string;
  succeeded: boolean;
  refused_reason: string | null;
}

let startRecord: StartAttemptRecord | null = null;

/** Reset the start slice's module-scoped state. Tests only. */
export function __resetAutoExecutorStartForTests(): void {
  startRecord = null;
}

export interface StartPostureReport {
  /** Whether the start helper has been called at least once. */
  start_attempted: boolean;
  /** Whether the most recent attempt succeeded. */
  start_succeeded: boolean;
  /** Whether the boundary state is now `running`. */
  is_running: boolean;
  /** The exact boundary state. */
  boundary_state: string;
  /** Literal-false: no action has been invoked. */
  any_action_invoked: false;
  /** Literal: subprocess count is always 0. */
  subprocess_count: 0;
  /** Literal: max subprocess count is always 0. */
  max_subprocess_count: 0;
  /** The most recent start attempt, if any. */
  most_recent_attempt: StartAttemptRecord | null;
}

/**
 * Start the installed host. Only succeeds when the host is in `armed`
 * or `running` state.
 *
 * Returns:
 *   - `true` if the host transitioned to `running`
 *   - `false` if no host is installed, the host is in `constructed` /
 *     `aborted` / `disarmed` / `running` state (start is one-shot)
 *
 * Side effects:
 *   - calls host.start() which may transition the boundary state to `running`
 *   - records the attempt in module-scoped state
 *
 * NEVER calls host.runMockAction(). NEVER spawns a subprocess.
 */
export function startInstalledHost(): boolean {
  const host = getInstalledAutoExecutorHost();
  const record: StartAttemptRecord = {
    attempted_at: new Date().toISOString(),
    succeeded: false,
    refused_reason: null,
  };
  if (host === null) {
    record.refused_reason = "host_not_installed";
    startRecord = record;
    return false;
  }
  const stateBefore = host.state();
  if (stateBefore !== "armed") {
    record.refused_reason = `cannot_start_from_state_${stateBefore}`;
    startRecord = record;
    return false;
  }
  // host.start() returns true only from state `armed`.
  // State `running` is refused at the gate above; start is one-shot.
  const ok = host.start();
  if (!ok) {
    record.refused_reason = "start_refused_by_host";
    startRecord = record;
    return false;
  }
  record.succeeded = true;
  startRecord = record;
  return true;
}

/**
 * Read the start posture. Mirrors the boundary state from the bootstrap
 * posture.
 *
 * The `any_action_invoked: false` / `subprocess_count: 0` /
 * `max_subprocess_count: 0` fields are literal-false / literal-0 in
 * this source file. A future slice that wants to flip them must rewrite
 * this file — audit signal.
 */
export function getStartPostureReport(): StartPostureReport | null {
  const bootstrap = getBootstrapPostureReport();
  if (bootstrap === null) return null;
  const host = getInstalledAutoExecutorHost();
  if (host === null) return null;
  const state = host.state();
  return {
    start_attempted: startRecord !== null,
    start_succeeded: startRecord?.succeeded ?? false,
    is_running: state === "running",
    boundary_state: state,
    any_action_invoked: false,
    subprocess_count: 0,
    max_subprocess_count: 0,
    most_recent_attempt: startRecord,
  };
}