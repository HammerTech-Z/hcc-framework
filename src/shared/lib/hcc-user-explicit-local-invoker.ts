// HCC User-Explicit Local Invoker.
//
// Local invocation surface for the final controlled real
// dispatch. The invoker is the only callable path that
// `evaluateFinalControlledRealDispatch` flows through from
// outside the lib, and it is USER-EXPLICIT by construction:
//
//   - The invoker is driven by an explicit user-supplied
//     `InvocationFixture`. The fixture is the only way the
//     invoker produces input for the final dispatch. There is
//     no other entrypoint, no default fixture, no fallback.
//   - The invoker refuses to call the final dispatch unless
//     the fixture carries an `explicit_user_trigger_token`. The
//     token is a caller-supplied string. Tests inject a known
//     value; production callers must obtain the token from a
//     real user-explicit path (e.g. a click handler) before
//     passing it in.
//   - The dispatch_adapter is fully injected. The invoker
//     never calls `spawn` / `exec` / `child_process` directly.
//
// The invoker never modifies the user-explicit boundary that the
// final dispatch contract enforces: success still keeps
// `unattended_ready: false`, `night_run_ready: false`, and
// `go_no_go: "NO-GO"`. The flip of `real_execution_ready: true`
// and `would_execute: true` is permitted because the final
// dispatch already gates it on its own 4-verdict AND-combination;
// the invoker's job is to assert the user-explicit trigger and
// the dispatch_adapter, then delegate.

import {
  evaluateFinalControlledRealDispatch,
  type HCCFinalControlledRealDispatchInput,
  type HCCFinalControlledRealDispatchResult,
} from "./hcc-final-controlled-real-dispatch";

export const HCC_USER_EXPLICIT_LOCAL_INVOKER_SCHEMA_VERSION =
  "1.0.0" as const;

/**
 * The user-explicit trigger token. The invoker refuses any
 * fixture that does not carry this token. The token itself is
 * an opaque string; the invoker only checks presence.
 */
export type HCCUserExplicitTriggerToken = string;

/**
 * Caller-supplied input fixture. The invoker projects this
 * into a `HCCFinalControlledRealDispatchInput` after checking
 * the trigger token and the dispatch_adapter. The fixture
 * itself is treated as untrusted until the trigger is verified.
 */
export interface HCCUserExplicitInvocationFixture {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  dry_run_artifact_hash: string;
  planned_action_id: string;
  planned_action_kind: "shell_command" | "file_write" | "config_patch";
  whitelist_action_id: string;
  target_path: string;
  /**
   * User-explicit trigger token. MUST be present and non-empty.
   * The invoker refuses the fixture if this is missing.
   */
  explicit_user_trigger_token: HCCUserExplicitTriggerToken;
  /**
   * Injected dispatch adapter. The invoker does NOT perform
   * any I/O itself; the adapter is the only surface that may
   * actually dispatch the planned action.
   */
  dispatch_adapter: HCCFinalControlledRealDispatchInput["dispatch_adapter"];
  /**
   * The full pre-validated input fields the invoker threads
   * through to the final dispatch contract. The fixture
   * carries these so the caller is forced to gather them
   * before invoking. The invoker does not re-validate them
   * (the final dispatch contract is the single source of
   * truth for those checks).
   */
  authorization_result: HCCFinalControlledRealDispatchInput["authorization_result"];
  runner_result: HCCFinalControlledRealDispatchInput["runner_result"];
  audit_result: HCCFinalControlledRealDispatchInput["audit_result"];
  rollback_plan: HCCFinalControlledRealDispatchInput["rollback_plan"];
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Synchronous guard. Returns `null` if the fixture is OK;
 * otherwise returns a human-readable reason string. The
 * dispatch contract is the single source of truth for the
 * 4 prior verdicts / identity agreement; this guard only
 * covers the invoker-local concerns:
 *   - explicit_user_trigger_token is non-empty
 *   - dispatch_adapter is an object
 *   - planned_action_kind is in the supported set
 *   - required identity fields are non-empty
 */
export function checkUserExplicitFixture(
  fixture: HCCUserExplicitInvocationFixture,
): string | null {
  if (!isNonEmptyString(fixture.explicit_user_trigger_token)) {
    return "missing explicit_user_trigger_token (invoker is user-explicit, no fallback)";
  }
  if (
    !fixture.dispatch_adapter ||
    typeof fixture.dispatch_adapter !== "object"
  ) {
    return "missing dispatch_adapter (invoker does not perform I/O)";
  }
  const adapter = fixture.dispatch_adapter;
  if (typeof adapter.supportsKind !== "function") {
    return "dispatch_adapter.supportsKind must be a function";
  }
  if (typeof adapter.dispatch !== "function") {
    return "dispatch_adapter.dispatch must be a function";
  }
  if (!isNonEmptyString(fixture.task_id)) {
    return "missing task_id";
  }
  if (!isNonEmptyString(fixture.source_plan_ref)) {
    return "missing source_plan_ref";
  }
  if (!isNonEmptyString(fixture.requested_by_user)) {
    return "missing requested_by_user";
  }
  if (!isNonEmptyString(fixture.authorization_id)) {
    return "missing authorization_id";
  }
  if (!isNonEmptyString(fixture.dry_run_artifact_hash)) {
    return "missing dry_run_artifact_hash";
  }
  if (!isNonEmptyString(fixture.planned_action_id)) {
    return "missing planned_action_id";
  }
  if (!isNonEmptyString(fixture.whitelist_action_id)) {
    return "missing whitelist_action_id";
  }
  if (
    fixture.planned_action_kind !== "shell_command" &&
    fixture.planned_action_kind !== "file_write" &&
    fixture.planned_action_kind !== "config_patch"
  ) {
    return `unsupported planned_action_kind: "${String(
      fixture.planned_action_kind,
    )}"`;
  }
  if (!isNonEmptyString(fixture.target_path)) {
    return "missing target_path";
  }
  return null;
}

/**
 * Build the final dispatch input from a fixture. Pure. The
 * caller is expected to have already run `checkUserExplicitFixture`;
 * the invoker runs it again defensively and refuses to build
 * the input if the fixture is invalid.
 */
export function buildFinalDispatchInputFromFixture(
  fixture: HCCUserExplicitInvocationFixture,
): HCCFinalControlledRealDispatchInput {
  const guardReason = checkUserExplicitFixture(fixture);
  if (guardReason !== null) {
    throw new Error(
      `HCC user-explicit local invoker refused fixture: ${guardReason}`,
    );
  }
  return {
    task_id: fixture.task_id,
    source_plan_ref: fixture.source_plan_ref,
    requested_by_user: fixture.requested_by_user,
    authorization_id: fixture.authorization_id,
    dry_run_artifact_hash: fixture.dry_run_artifact_hash,
    planned_action_id: fixture.planned_action_id,
    planned_action_kind: fixture.planned_action_kind,
    whitelist_action_id: fixture.whitelist_action_id,
    explicit_user_triggered: true,
    target_path: fixture.target_path,
    authorization_result: fixture.authorization_result,
    runner_result: fixture.runner_result,
    audit_result: fixture.audit_result,
    rollback_plan: fixture.rollback_plan,
    dispatch_adapter: fixture.dispatch_adapter,
  };
}

/**
 * Top-level user-explicit local invoker. Async. Delegates to
 * `evaluateFinalControlledRealDispatch` after running the
 * invoker-local guard.
 *
 * The invoker never returns a successful verdict that the
 * final dispatch would have rejected: NO-GO propagates.
 * The success result preserves the final dispatch's
 * literal-false / "NO-GO" user-explicit boundary fields.
 */
export async function invokeUserExplicitControlledRealDispatch(
  fixture: HCCUserExplicitInvocationFixture,
): Promise<HCCFinalControlledRealDispatchResult> {
  const guardReason = checkUserExplicitFixture(fixture);
  if (guardReason !== null) {
    // No prior state to project. Build a NO-GO result with
    // the invoker-local fields populated from the fixture
    // and the rest left blank. The result shape matches
    // `HCCFinalControlledRealDispatchResult` so callers do
    // not need to branch on guard outcome.
    return {
      schema_version: "1.0.0",
      verdict: "NO-GO",
      reason: `invoker refused: ${guardReason}`,
      task_id: fixture.task_id ?? "",
      source_plan_ref: fixture.source_plan_ref ?? "",
      requested_by_user: fixture.requested_by_user ?? "",
      authorization_id: fixture.authorization_id ?? "",
      dry_run_artifact_hash: fixture.dry_run_artifact_hash ?? "",
      planned_action_id: fixture.planned_action_id ?? "",
      planned_action_kind:
        (fixture.planned_action_kind as
          | "shell_command"
          | "file_write"
          | "config_patch"
          | "") ?? "",
      whitelist_action_id: fixture.whitelist_action_id ?? "",
      controlled_command_id: "",
      real_execution_ready: false,
      would_execute: false,
      any_command_executed: false,
      executed_commands: [],
      subprocess_count: 0,
      auto_executor_started: false,
      unattended_ready: false,
      night_run_ready: false,
      go_no_go: "NO-GO",
    };
  }

  const input = buildFinalDispatchInputFromFixture(fixture);
  return await evaluateFinalControlledRealDispatch(input);
}
