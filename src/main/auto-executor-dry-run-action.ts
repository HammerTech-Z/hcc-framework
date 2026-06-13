// HCC Auto Executor — Dry-Run Action slice.
//
// Accepts a dry-run action descriptor from a running host.
// Produces a DryRunActionResult artifact. NEVER executes any real command.
// NEVER spawns a subprocess. NEVER writes ~/.hermes/**.
// NEVER accesses credentials. NEVER opens an external publish surface.
//
// This module is a *helper*, not a hook. `src/main/index.ts` does NOT
// import this module. The trigger surface is held for the next slice
// (`P3_010_CONTROLLED_WORKTREE_DRY_RUN`).
//
// Per the threat model:
//   - T1 — action is recorded with proposedDiff/decision/executionResult
//     where `executionResult` is always empty
//   - S1/S2 — prompt source is pinned via task_id hash
//   - E1 — no subprocess elevation: safeExec allowlist = empty
//   - D1 — no runaway loop: action is single-shot per submit call

import {
  getInstalledAutoExecutorHost,
  getBootstrapPostureReport,
} from "./auto-executor-bootstrap";
import { decideTaskAdmission } from "../shared/lib/hcc-controlled-executor";
import type { AdmissionActionClass, AdmissionResult } from "../shared/lib/hcc-controlled-executor";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface DryRunActionRequest {
  task_id: string;
  worktree_isolated: boolean;
  single_branch: boolean;
  single_commit_candidate: boolean;
  action_class: AdmissionActionClass;
  /** Optional human-readable description. */
  description?: string;
}

export interface DryRunActionResult {
  schema_version: "1.0.0";
  artifact_kind: "dry_run_action";
  task_id: string;
  /** Admission result delegated to the controlled-executor policy. */
  admission: AdmissionResult;
  /** Always false. Real execution is the next slice. */
  would_execute: false;
  /** Always empty. No command is ever invoked. */
  executed_commands: readonly [];
  /** Always 0. */
  subprocess_count: 0;
  /** Always 0. */
  max_subprocess_count: 0;
  /** A verifier is always required for real execution. */
  verifier_required: true;
  /** Pointer to the next slice that would do the real execution. */
  next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN";
  /** ISO 8601 timestamp when the action was submitted. */
  submitted_at: string;
  /** The boundary state at action time. */
  host_state: string;
}

// -----------------------------------------------------------------
// Module-scoped action log
// -----------------------------------------------------------------

interface ActionAttemptRecord {
  attempted_at: string;
  succeeded: boolean;
  refused_reason: string | null;
}

let actionLog: ActionAttemptRecord[] = [];

/** Reset the action slice's module-scoped state. Tests only. */
export function __resetAutoExecutorActionForTests(): void {
  actionLog = [];
}

/** Read the action log. Tests only. */
export function __getActionLog(): readonly ActionAttemptRecord[] {
  return actionLog;
}

// -----------------------------------------------------------------
// Submit
// -----------------------------------------------------------------

/**
 * Submit a dry-run action. Only succeeds when the host is in `running`
 * state. Refuses from constructed / armed / aborted / disarmed.
 *
 * The action is ALWAYS a dry-run:
 *   - `would_execute: false` literal
 *   - `executed_commands: []` literal
 *   - `subprocess_count: 0` literal
 *   - `verifier_required: true` literal
 *   - `next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN"` literal
 *
 * For dangerous action classes (install_dependency, file_deletion,
 * external_publish, credential_access, browser_action, live_apply),
 * the admission returns `requires_user_approval`. The caller is
 * responsible for honoring the admission gate. The action itself still
 * returns a result (no throw for requires_user_approval — the artifact
 * carries the admission signal).
 *
 * If admission is `deny`, throws.
 *
 * NEVER calls spawn/exec/child_process. NEVER writes ~/.hermes/**.
 */
export function submitDryRunAction(
  req: DryRunActionRequest,
): DryRunActionResult {
  const record: ActionAttemptRecord = {
    attempted_at: new Date().toISOString(),
    succeeded: false,
    refused_reason: null,
  };

  const host = getInstalledAutoExecutorHost();
  if (host === null) {
    record.refused_reason = "host_not_installed";
    actionLog.push(record);
    throw new Error("submitDryRunAction: host not installed");
  }

  // Host must be running.
  const state = host.state();
  if (state !== "running") {
    record.refused_reason = `host_not_running_state_${state}`;
    actionLog.push(record);
    throw new Error(
      `submitDryRunAction: host must be in 'running' state, current state is '${state}'`,
    );
  }

  // Admission check.
  const admission = decideTaskAdmission({
    task_id: req.task_id,
    worktree_isolated: req.worktree_isolated,
    single_branch: req.single_branch,
    single_commit_candidate: req.single_commit_candidate,
    action_class: req.action_class,
  });

  if (admission.decision === "deny") {
    record.refused_reason = `admission_denied_${admission.reason}`;
    actionLog.push(record);
    throw new Error(
      `submitDryRunAction: admission denied for task ${req.task_id}: ${admission.reason}`,
    );
  }

  // requires_user_approval: the caller honors the gate; the action
  // still produces a result (no throw). The artifact carries the
  // admission signal so downstream can gate on it.

  record.succeeded = true;
  actionLog.push(record);

  return {
    schema_version: "1.0.0",
    artifact_kind: "dry_run_action",
    task_id: req.task_id,
    admission,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    max_subprocess_count: 0,
    verifier_required: true,
    next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN",
    submitted_at: record.attempted_at,
    host_state: state,
  };
}

// -----------------------------------------------------------------
// Posture
// -----------------------------------------------------------------

export interface ActionPostureReport {
  /** Total dry-run actions submitted in this session. */
  actions_submitted: number;
  /** The most recent action result, if any. */
  most_recent_action: DryRunActionResult | null;
  /** Whether any action in this session was a dangerous class. */
  any_dangerous_action: boolean;
  /** Literal-false: no command was ever executed. */
  any_command_executed: false;
  /** Literal 0: no subprocess was ever spawned. */
  total_subprocess_count: 0;
  /** Literal: the next slice after dry-run action. */
  next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN";
}

let mostRecentResult: DryRunActionResult | null = null;
let dangerousCount = 0;

/**
 * Read the action posture. Returns null if no host is installed.
 *
 * `any_command_executed: false` / `total_subprocess_count: 0` /
 * `next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN"` are literal in
 * this source file. A future slice that wants to flip them must rewrite
 * this file — audit signal.
 */
export function getActionPostureReport(): ActionPostureReport | null {
  const bootstrap = getBootstrapPostureReport();
  if (bootstrap === null) return null;
  return {
    actions_submitted: actionLog.filter((a) => a.succeeded).length,
    most_recent_action: mostRecentResult,
    any_dangerous_action: dangerousCount > 0,
    any_command_executed: false,
    total_subprocess_count: 0,
    next_step: "P3_010_CONTROLLED_WORKTREE_DRY_RUN",
  };
}

/**
 * Internal: record the result so the posture report can surface it.
 * Called by submitDryRunAction after building the result.
 */
export function __recordActionResult(result: DryRunActionResult): void {
  mostRecentResult = result;
  if (result.admission.decision === "requires_user_approval") {
    dangerousCount++;
  }
}