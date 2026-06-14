// HCC Terminal Agent Invoker.
//
// Terminal Hermes agent invoker: the first terminal-facing
// HCC entrypoint. The invoker consumes the shared invocation
// service + the controlled dispatch adapter (fully injected)
// and produces a terminal-shaped result. It is user-explicit
// by construction:
//
//   - the invoker is driven solely by an explicit
//     `TerminalInvocationFixture`; there is no other
//     entrypoint, no default fixture, no fallback
//   - the fixture must carry an `explicit_user_trigger_token`
//     and a `terminal_agent_session_id`; missing either is
//     NO-GO
//   - the dispatch adapter is fully injected; the invoker
//     never calls spawn / exec / child_process directly
//   - no app boot, no IPC, no renderer, no preload, no
//     timer, no cron, no auto-arm path may trigger this
//     invoker. The fixture and the trigger token are the
//     only way to produce a candidate result.
//
// This slice does NOT add a CLI process or a package.json
// bin entry. The invoker is a library callable; a future
// slice will wire the terminal Hermes agent (which lives
// outside this repo) to import this lib and call it.
//
// Per HCC governance (origin `b2521bc`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal

import {
  checkSharedInvocationFixture,
  invokeSharedControlledRealDispatch,
  type HCCSharedInvocationFixture,
  type HCCSharedInvocationResult,
} from "./hcc-shared-invocation-service";
import {
  buildControlledDispatchAdapter,
  type HCCControlledDispatchInput,
} from "./hcc-controlled-dispatch-adapter";

export const HCC_TERMINAL_AGENT_INVOKER_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Terminal caller identity. The invoker refuses any fixture
 * that does not carry this id. The id is opaque; the
 * invoker only checks presence + non-empty. The terminal
 * agent is expected to mint this id at session start and
 * pass it through every invocation.
 */
export type TerminalAgentSessionId = string;

/**
 * Terminal-side invocation fixture. Wraps the shared fixture
 * with terminal-specific fields. The terminal caller is
 * expected to gather every field; there is no default.
 */
export interface HCCTerminalInvocationFixture {
  /** Stable id of the terminal session. */
  terminal_agent_session_id: TerminalAgentSessionId;
  /** Stable id of the local terminal invocation. */
  terminal_invocation_id: string;
  /** The shared fixture carrying the planned action identity. */
  shared_fixture: HCCSharedInvocationFixture;
  /**
   * The pre-mint of the dispatch adapter. The invoker
   * never auto-builds an adapter; the terminal caller
   * supplies it (typically by calling
   * `buildControlledDispatchAdapter(...)` with their own
   * executor dependency).
   */
  dispatch_adapter: HCCSharedInvocationFixture["dispatch_adapter"];
}

/**
 * Terminal-shaped result. Mirrors the shared result plus
 * the terminal caller identity + the terminal invocation
 * id + a typed failure reason. NO-GO is propagated; the
 * success fields may carry the final dispatch's
 * ready-bit flip because the shared service contract
 * already gates that.
 */
export type HCCTerminalAgentResult =
  | (HCCSharedInvocationResult & {
      terminal_agent_session_id: TerminalAgentSessionId;
      terminal_invocation_id: string;
      reason: string;
    })
  | {
      schema_version: "1.0.0";
      verdict: "NO-GO";
      reason: string;
      task_id: string;
      source_plan_ref: string;
      requested_by_user: string;
      authorization_id: string;
      dry_run_artifact_hash: string;
      planned_action_id: string;
      planned_action_kind:
        | "shell_command"
        | "file_write"
        | "config_patch"
        | "";
      whitelist_action_id: string;
      controlled_command_id: string;
      real_execution_ready: false;
      would_execute: false;
      any_command_executed: false;
      executed_commands: readonly [];
      subprocess_count: 0;
      auto_executor_started: false;
      unattended_ready: false;
      night_run_ready: false;
      go_no_go: "NO-GO";
      terminal_agent_session_id: TerminalAgentSessionId;
      terminal_invocation_id: string;
    };

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Synchronous guard. Returns `null` if the fixture is OK;
 * otherwise returns a human-readable reason string. The
 * shared service is the single source of truth for the
 * 4 prior verdicts / identity agreement; this guard
 * covers terminal-local concerns:
 *   - terminal_agent_session_id non-empty
 *   - terminal_invocation_id non-empty
 *   - dispatch_adapter present
 *   - shared_fixture passes checkSharedInvocationFixture
 */
export function checkTerminalFixture(
  fixture: HCCTerminalInvocationFixture,
): string | null {
  if (!isNonEmptyString(fixture.terminal_agent_session_id)) {
    return "missing terminal_agent_session_id (invoker is terminal-agent-explicit)";
  }
  if (!isNonEmptyString(fixture.terminal_invocation_id)) {
    return "missing terminal_invocation_id";
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
  if (!fixture.shared_fixture) {
    return "missing shared_fixture";
  }
  if (!isNonEmptyString(fixture.shared_fixture.explicit_user_trigger_token)) {
    return "missing explicit_user_trigger_token on shared_fixture";
  }
  const sharedReason = checkSharedInvocationFixture(fixture.shared_fixture);
  if (sharedReason !== null) {
    return `shared_fixture: ${sharedReason}`;
  }
  return null;
}

/**
 * Build a terminal-shaped NO-GO result with the terminal
 * identity fields populated from the fixture. Pure
 * projection. Used by `invokeTerminalAgentControlledReal
 * Dispatch` when the guard fails.
 */
function noGo(
  fixture: HCCTerminalInvocationFixture,
  reason: string,
): HCCTerminalAgentResult {
  const shared = fixture.shared_fixture ?? ({} as Partial<HCCSharedInvocationFixture>);
  return {
    schema_version: "1.0.0",
    verdict: "NO-GO",
    reason,
    task_id: shared.task_id ?? "",
    source_plan_ref: shared.source_plan_ref ?? "",
    requested_by_user: shared.requested_by_user ?? "",
    authorization_id: shared.authorization_id ?? "",
    dry_run_artifact_hash: shared.dry_run_artifact_hash ?? "",
    planned_action_id: shared.planned_action_id ?? "",
    planned_action_kind:
      (shared.planned_action_kind as
        | "shell_command"
        | "file_write"
        | "config_patch"
        | "") ?? "",
    whitelist_action_id: shared.whitelist_action_id ?? "",
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
    terminal_agent_session_id: fixture.terminal_agent_session_id,
    terminal_invocation_id: fixture.terminal_invocation_id,
  };
}

/**
 * Top-level terminal-agent entrypoint. Async. Delegates to
 * the shared invocation service after running the
 * terminal-local guard. The terminal caller is the only
 * way to reach the final dispatch from this slice; there
 * is no other path.
 */
export async function invokeTerminalAgentControlledRealDispatch(
  fixture: HCCTerminalInvocationFixture,
): Promise<HCCTerminalAgentResult> {
  const guardReason = checkTerminalFixture(fixture);
  if (guardReason !== null) {
    return noGo(fixture, `terminal invoker refused: ${guardReason}`);
  }

  let sharedResult: HCCSharedInvocationResult;
  try {
    sharedResult = await invokeSharedControlledRealDispatch(
      fixture.shared_fixture,
    );
  } catch (err) {
    return noGo(
      fixture,
      `dispatch adapter raised: ${(err as Error).message ?? String(err)}`,
    );
  }

  return {
    ...sharedResult,
    terminal_agent_session_id: fixture.terminal_agent_session_id,
    terminal_invocation_id: fixture.terminal_invocation_id,
  };
}

/**
 * Helper: build a controlled dispatch adapter from a
 * factory + executor dependency. Exposed for terminal
 * callers that want to construct their own adapter with
 * their own executor. The terminal invoker does NOT call
 * this automatically; the caller supplies the adapter.
 */
export function buildTerminalDispatchAdapter(
  factory: () => Omit<HCCControlledDispatchInput, "executors" | "now"> & {
    executors: HCCControlledDispatchInput["executors"];
    now: () => string;
  },
) {
  return buildControlledDispatchAdapter(factory);
}
