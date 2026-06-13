// HCC Auto Executor — Arm slice.
//
// Transitions the bootstrap-installed host from `constructed` to `armed`.
// Does NOT call `host.start()`. Does NOT call `host.runMockAction()`.
// Does NOT register any IPC channel. Does NOT start any timer.
//
// This module is intentionally a *helper*, not a hook. `src/main/index.ts`
// does NOT import this module. The trigger surface (CLI flag, settings UI,
// explicit user gesture, etc.) is held for a future slice
// (`HCC-AUTO-EXECUTOR-START-001`).
//
// Per the threat model:
//   - S3 — control file path is pinned; the arm token is HMAC over the
//     GO record sha under the same secret that mints per-write tokens
//   - E3 — `armed: true` token is server-side HMAC, not derivable from
//     the working tree
//   - T1 — audit chain must remain intact across the arm transition
//
// The arm helper:
//   - requires the host to be already installed (via installAutoExecutorHost)
//   - requires a valid ArmToken (verified by the boundary inside host.arm)
//   - returns true on success, false on refusal
//   - is idempotent: re-arming an already-armed host returns true
//   - never starts the host

import {
  getInstalledAutoExecutorHost,
  getBootstrapPostureReport,
  type BootstrapPostureReport,
} from "./auto-executor-bootstrap";
import type { ArmToken } from "../shared/lib/auto-executor";

// -----------------------------------------------------------------
// Module-scoped arm record
// -----------------------------------------------------------------

interface ArmAttemptRecord {
  attempted_at: string;
  succeeded: boolean;
  refused_reason: string | null;
  go_record_sha: string | null;
}

let armRecord: ArmAttemptRecord | null = null;

/**
 * Reset the arm slice's module-scoped state. Tests only.
 */
export function __resetAutoExecutorArmForTests(): void {
  armRecord = null;
}

export interface ArmPostureReport {
  /** Whether the arm helper has been called at least once. */
  arm_attempted: boolean;
  /** Whether the most recent attempt succeeded (true only after a valid token). */
  arm_succeeded: boolean;
  /** Whether the boundary state is now `armed` or `running`. */
  state_is_armed_or_running: boolean;
  /** The exact boundary state, mirrored from the bootstrap posture. */
  boundary_state: BootstrapPostureReport["state"];
  /** Literal-false: starting the host is held for the next slice. */
  started: false;
  /** Literal-false: no action has been invoked yet. */
  any_action_invoked: false;
  /** Literal: subprocess count is always 0. */
  subprocess_count: 0;
  /** Literal: max subprocess count is always 0. */
  max_subprocess_count: 0;
  /** The most recent arm attempt, if any. */
  most_recent_attempt: ArmAttemptRecord | null;
}

/**
 * Arm the installed host with the given token.
 *
 * Returns:
 *   - `true` if the host was armed (or was already armed)
 *   - `false` if no host is installed, the host is in `aborted` /
 *     `disarmed` state, or the token verification failed
 *
 * Side effects:
 *   - calls host.arm(token) which may transition the boundary state to `armed`
 *   - records the attempt in module-scoped state (visible via
 *     `getArmPostureReport()`)
 *
 * NEVER calls host.start(). NEVER calls host.runMockAction().
 */
export function armInstalledHost(token: ArmToken): boolean {
  const host = getInstalledAutoExecutorHost();
  const record: ArmAttemptRecord = {
    attempted_at: new Date().toISOString(),
    succeeded: false,
    refused_reason: null,
    go_record_sha: token.goRecordSha,
  };
  if (host === null) {
    record.refused_reason = "host_not_installed";
    armRecord = record;
    return false;
  }
  const stateBefore = host.state();
  if (stateBefore === "aborted" || stateBefore === "disarmed") {
    record.refused_reason = `host_in_terminal_state_${stateBefore}`;
    armRecord = record;
    return false;
  }
  // host.arm() returns true if the token is valid AND state is `constructed`.
  // If state is already `armed` or `running`, host.arm() returns true (idempotent).
  // If state is `constructed` and the token is invalid, host.arm() returns false.
  const ok = host.arm(token);
  if (!ok) {
    record.refused_reason = "token_verification_failed";
    armRecord = record;
    return false;
  }
  record.succeeded = true;
  armRecord = record;
  return true;
}

/**
 * Read the arm posture. Mirrors the bootstrap posture for the boundary
 * state, and adds arm-attempt fields.
 *
 * The `started: false` / `any_action_invoked: false` /
 * `subprocess_count: 0` / `max_subprocess_count: 0` fields are
 * literal-false / literal-0 in this source file. A future slice that
 * wants to flip any of them must rewrite this file — which is itself
 * an audit signal.
 */
export function getArmPostureReport(): ArmPostureReport | null {
  const bootstrap = getBootstrapPostureReport();
  if (bootstrap === null) return null;
  const host = getInstalledAutoExecutorHost();
  if (host === null) return null;
  const state = host.state();
  return {
    arm_attempted: armRecord !== null,
    arm_succeeded: armRecord?.succeeded ?? false,
    state_is_armed_or_running: state === "armed" || state === "running",
    boundary_state: state,
    started: false,
    any_action_invoked: false,
    subprocess_count: 0,
    max_subprocess_count: 0,
    most_recent_attempt: armRecord,
  };
}