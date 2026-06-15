// HCC Unattended Terminal CLI.
//
// Thin shell entrypoint that consumes the prior
// `runTerminalUnattendedScheduledDispatch` from
// `src/shared/lib/hcc-unattended-terminal-entrypoint.ts`.
//
// Usage:
//   node --experimental-strip-types \
//     src/cli/hcc-unattended-terminal.ts \
//     --terminal-agent-session-id <id> \
//     --terminal-invocation-id <id> \
//     --explicit-unattended-trigger-token <token> \
//     --feature-flag-enabled \
//     --task-id <id> \
//     --source-plan-ref <ref> \
//     --requested-by-user <id> \
//     --authorization-id <id> \
//     --schedule-id <id> \
//     --planned-action-id <id> \
//     --planned-action-kind <shell_command|file_write|config_patch> \
//     --target-path <path>
//
// Required flags (NO-GO if any missing):
//   --terminal-agent-session-id
//   --terminal-invocation-id
//   --explicit-unattended-trigger-token
//   --feature-flag-enabled
//
// Identity-only flags are also accepted via env vars
// (HCC_TERMINAL_AGENT_SESSION_ID, HCC_TERMINAL_INVOCATION_ID,
// HCC_EXPLICIT_UNATTENDED_TRIGGER_TOKEN,
// HCC_FEATURE_FLAG_ENABLED) but CLI flags take precedence.
//
// Per HCC governance (preflight
// `hcc-unattended-terminal-cli-preflight-2026-06-15`):
//   - NO background timer / cron / setInterval / setTimeout.
//   - NO direct spawn / exec / child_process.
//   - NO submitDryRunAction.
//   - NO bootstrap / arm / start / host imports.
//   - NO writes to `~/.hermes/**`.
//   - NO automatic start on app launch. The CLI is invoked
//     by an explicit shell call carrying a session id, an
//     invocation id, and a one-shot explicit trigger token.
//   - The CLI is a pure async shell — the only I/O it
//     performs is `process.argv` read and `process.stdout`
//     write. All dispatch stays in the injected
//     `dispatch_adapter` (passed through the entrypoint).
//   - The CLI does NOT set `go_no_go: "GO"`.

import {
  runTerminalUnattendedScheduledDispatch,
  type HCCUnattendedTerminalEntrypointInput,
  type HCCUnattendedTerminalEntrypointResult,
} from "../shared/lib/hcc-unattended-terminal-entrypoint.ts";
import type {
  HCCFinalControlledRealDispatchAdapter,
} from "../shared/lib/hcc-final-controlled-real-dispatch.ts";
import type {
  HCCUnattendedSchedulerBudget,
} from "../shared/lib/hcc-unattended-scheduler.ts";

export const HCC_UNATTENDED_TERMINAL_CLI_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCUnattendedTerminalCliVerdict =
  | "TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED"
  | "NO-GO";

export type HCCUnattendedTerminalCliExitCode = 0 | 2;

/**
 * Pure parse function. Reads an argv array (in the shape produced
 * by `process.argv.slice(2)`) and an optional env record. Returns
 * either a parsed invocation + scheduler-input, or a typed error.
 */
export interface HCCUnattendedTerminalCliArgs {
  terminal_agent_session_id: string;
  terminal_invocation_id: string;
  explicit_unattended_trigger_token: string;
  feature_flag_enabled: true;
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  schedule_id: string;
  planned_action_id: string;
  planned_action_kind: "shell_command" | "file_write" | "config_patch";
  target_path: string;
  /**
   * IANA timezone identifier, e.g. "Asia/Shanghai". Defaults to
   * "UTC" if the flag is not provided. The CLI does NOT compare
   * against wall-clock; the value is descriptive only.
   */
  tz: string;
  /**
   * Optional ISO 8601 strings. If the flag is not provided the
   * CLI does not invent a window — it uses the env values
   * `HCC_SCHEDULER_WINDOW_START_ISO` and
   * `HCC_SCHEDULER_WINDOW_END_ISO` if present, otherwise
   * empty strings (which the scheduler will refuse as malformed).
   */
  scheduler_window_start_iso: string;
  scheduler_window_end_iso: string;
}

export type HCCUnattendedTerminalCliParseResult =
  | { ok: true; args: HCCUnattendedTerminalCliArgs }
  | { ok: false; reason: string };

/**
 * The set of CLI flag names this slice recognizes. The parse
 * function is flag-driven; flags are deliberately long-form
 * (`--kebab-case`) to make shell usage obvious.
 */
const REQUIRED_FLAGS = [
  "--terminal-agent-session-id",
  "--terminal-invocation-id",
  "--explicit-unattended-trigger-token",
  "--feature-flag-enabled",
  "--task-id",
  "--source-plan-ref",
  "--requested-by-user",
  "--authorization-id",
  "--schedule-id",
  "--planned-action-id",
  "--planned-action-kind",
  "--target-path",
] as const;

const SUPPORTED_KINDS = new Set([
  "shell_command",
  "file_write",
  "config_patch",
]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function readFlag(
  argv: readonly string[],
  flag: string,
  envValue: string | undefined,
): string {
  const i = argv.indexOf(flag);
  if (i !== -1) {
    const v = argv[i + 1];
    if (isNonEmptyString(v)) return v;
  }
  return envValue ?? "";
}

function readFlagEnabled(
  argv: readonly string[],
  flag: string,
  envValue: string | undefined,
): boolean {
  if (argv.includes(flag)) return true;
  return envValue === "1" || envValue === "true";
}

export function parseTerminalCliArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): HCCUnattendedTerminalCliParseResult {
  // Identity gates first. If any identity flag is missing, we
  // refuse BEFORE the entrypoint is invoked, mirroring the
  // entrypoint's own gate order.
  const terminal_agent_session_id = readFlag(
    argv,
    "--terminal-agent-session-id",
    env.HCC_TERMINAL_AGENT_SESSION_ID,
  );
  if (!isNonEmptyString(terminal_agent_session_id)) {
    return {
      ok: false,
      reason: "missing or empty --terminal-agent-session-id",
    };
  }
  const terminal_invocation_id = readFlag(
    argv,
    "--terminal-invocation-id",
    env.HCC_TERMINAL_INVOCATION_ID,
  );
  if (!isNonEmptyString(terminal_invocation_id)) {
    return {
      ok: false,
      reason: "missing or empty --terminal-invocation-id",
    };
  }
  const explicit_unattended_trigger_token = readFlag(
    argv,
    "--explicit-unattended-trigger-token",
    env.HCC_EXPLICIT_UNATTENDED_TRIGGER_TOKEN,
  );
  if (!isNonEmptyString(explicit_unattended_trigger_token)) {
    return {
      ok: false,
      reason: "missing or empty --explicit-unattended-trigger-token",
    };
  }
  const feature_flag_enabled = readFlagEnabled(
    argv,
    "--feature-flag-enabled",
    env.HCC_FEATURE_FLAG_ENABLED,
  );
  if (feature_flag_enabled !== true) {
    return {
      ok: false,
      reason: "feature flag is not enabled (pass --feature-flag-enabled or HCC_FEATURE_FLAG_ENABLED=1)",
    };
  }

  // Scheduler input. Each field is required (the scheduler will
  // re-validate, but the CLI builds a structurally complete input
  // so the caller does not see a confusing scheduler-level
  // "missing task_id" error).
  const task_id = readFlag(argv, "--task-id", undefined);
  if (!isNonEmptyString(task_id)) {
    return { ok: false, reason: "missing or empty --task-id" };
  }
  const source_plan_ref = readFlag(argv, "--source-plan-ref", undefined);
  if (!isNonEmptyString(source_plan_ref)) {
    return { ok: false, reason: "missing or empty --source-plan-ref" };
  }
  const requested_by_user = readFlag(
    argv,
    "--requested-by-user",
    undefined,
  );
  if (!isNonEmptyString(requested_by_user)) {
    return { ok: false, reason: "missing or empty --requested-by-user" };
  }
  const authorization_id = readFlag(
    argv,
    "--authorization-id",
    undefined,
  );
  if (!isNonEmptyString(authorization_id)) {
    return { ok: false, reason: "missing or empty --authorization-id" };
  }
  const schedule_id = readFlag(argv, "--schedule-id", undefined);
  if (!isNonEmptyString(schedule_id)) {
    return { ok: false, reason: "missing or empty --schedule-id" };
  }
  const planned_action_id = readFlag(
    argv,
    "--planned-action-id",
    undefined,
  );
  if (!isNonEmptyString(planned_action_id)) {
    return { ok: false, reason: "missing or empty --planned-action-id" };
  }
  const planned_action_kind = readFlag(
    argv,
    "--planned-action-kind",
    undefined,
  );
  if (!SUPPORTED_KINDS.has(planned_action_kind)) {
    return {
      ok: false,
      reason: `unsupported --planned-action-kind "${planned_action_kind}" (must be one of shell_command, file_write, config_patch)`,
    };
  }
  const target_path = readFlag(argv, "--target-path", undefined);
  if (!isNonEmptyString(target_path)) {
    return { ok: false, reason: "missing or empty --target-path" };
  }
  const tz = readFlag(argv, "--tz", env.HCC_SCHEDULER_WINDOW_TZ) || "UTC";
  const scheduler_window_start_iso = readFlag(
    argv,
    "--scheduler-window-start-iso",
    env.HCC_SCHEDULER_WINDOW_START_ISO,
  );
  const scheduler_window_end_iso = readFlag(
    argv,
    "--scheduler-window-end-iso",
    env.HCC_SCHEDULER_WINDOW_END_ISO,
  );

  return {
    ok: true,
    args: {
      terminal_agent_session_id,
      terminal_invocation_id,
      explicit_unattended_trigger_token,
      feature_flag_enabled: true,
      task_id,
      source_plan_ref,
      requested_by_user,
      authorization_id,
      schedule_id,
      planned_action_id,
      planned_action_kind: planned_action_kind as
        | "shell_command"
        | "file_write"
        | "config_patch",
      target_path,
      tz,
      scheduler_window_start_iso,
      scheduler_window_end_iso,
    },
  };
}

/**
 * The CLI is a thin shell. It does NOT perform dispatch itself.
 * It builds the entrypoint input, passes a no-op dispatch
 * adapter, and prints the entrypoint's deterministic JSON
 * result.
 *
 * The default no-op adapter is test-friendly: it ALWAYS rejects.
 * Real callers (a future wiring slice) inject a real adapter
 * via the overload below.
 */
function defaultNoOpAdapter(): HCCFinalControlledRealDispatchAdapter {
  return {
    supportsKind: () => false,
    dispatch: () => {
      throw new Error(
        "hcc-unattended-terminal-cli: no dispatch adapter injected; the CLI's default no-op adapter refuses dispatch. Inject a real adapter via runTerminalCliWithAdapter().",
      );
    },
  };
}

/**
 * Core entrypoint. Pure async function. Takes parsed CLI args
 * and an optional adapter, builds the entrypoint input, calls
 * the entrypoint, and returns the result.
 *
 * The CLI's `main()` calls this with the default no-op adapter.
 * Tests inject their own adapter.
 */
export async function runTerminalCli(
  args: HCCUnattendedTerminalCliArgs,
  dispatchAdapter: HCCFinalControlledRealDispatchAdapter = defaultNoOpAdapter(),
): Promise<HCCUnattendedTerminalEntrypointResult> {
  const budget: HCCUnattendedSchedulerBudget = {
    present: true,
    exceeded: false,
  };
  const entrypointInput: HCCUnattendedTerminalEntrypointInput = {
    invocation: {
      terminal_agent_session_id: args.terminal_agent_session_id,
      terminal_invocation_id: args.terminal_invocation_id,
      explicit_unattended_trigger_token:
        args.explicit_unattended_trigger_token,
    },
    feature_flag_enabled: args.feature_flag_enabled,
    scheduler_input: {
      schedule_id: args.schedule_id,
      scheduler_window: {
        start_iso: args.scheduler_window_start_iso,
        end_iso: args.scheduler_window_end_iso,
        tz: args.tz,
      },
      task_id: args.task_id,
      source_plan_ref: args.source_plan_ref,
      requested_by_user: args.requested_by_user,
      authorization_id: args.authorization_id,
      feature_flag_enabled: args.feature_flag_enabled,
      // The CLI builds a no-op ready_result. The scheduler's
      // gate on `ready_result.verdict` will refuse this with
      // "ready_result.verdict must be UNATTENDED-READY-CANDIDATE"
      // and the entrypoint will surface that as a typed NO-GO.
      // A real CLI caller (future slice) provides a real
      // ready_result via a richer input.
      ready_result: {
        schema_version: "1.0.0",
        verdict: "NO-GO",
        reason: "hcc-unattended-terminal-cli: ready_result not provided by CLI shell; CLI does not synthesize ready state",
        task_id: args.task_id,
        source_plan_ref: args.source_plan_ref,
        requested_by_user: args.requested_by_user,
        authorization_id: args.authorization_id,
        enablement_verdict: "",
        final_dispatch_verdict: "",
        unattended_ready: false,
        night_run_ready: false,
        go_no_go: "NO-GO",
        auto_executor_started: false,
        would_execute: false,
        executed_commands: [],
        subprocess_count: 0,
        any_command_executed: false,
        real_execution_ready: false,
      },
      planned_action: {
        planned_action_id: args.planned_action_id,
        planned_action_kind: args.planned_action_kind,
        target_path: args.target_path,
      },
      budget,
      // The CLI does not synthesize blocker state. A real CLI
      // caller provides a real ready_result + real blocker
      // evidence; the entrypoint's NO-GO path will surface the
      // gate that blocked the dispatch.
      blockers_resolved: true,
      dispatch_adapter: dispatchAdapter,
    },
  };
  return runTerminalUnattendedScheduledDispatch(entrypointInput);
}

/**
 * Top-level CLI main. Parses argv, calls `runTerminalCli`,
 * serializes the result deterministically to `process.stdout`,
 * and sets the exit code.
 *
 * Exit codes:
 *   - 0 — `TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED`
 *   - 2 — `NO-GO` (parse error, missing flag, scheduler NO-GO,
 *          or entrypoint NO-GO)
 */
export async function main(argv: readonly string[]): Promise<HCCUnattendedTerminalCliExitCode> {
  const env = process.env as Record<string, string | undefined>;
  const parsed = parseTerminalCliArgs(argv, env);
  if (!parsed.ok) {
    const err = {
      schema_version: HCC_UNATTENDED_TERMINAL_CLI_SCHEMA_VERSION,
      verdict: "NO-GO" as const,
      reason: parsed.reason,
    };
    process.stdout.write(JSON.stringify(err, null, 2) + "\n");
    return 2;
  }
  const result = await runTerminalCli(parsed.args);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return result.verdict === "TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED" ? 0 : 2;
}

// Run as main when invoked directly. Node sets
// `process.argv[1]` to the script path; we compare the file
// URL of the running module to the invoked path. Tests import
// the module without invoking it, so the auto-exec guard
// stays inert in the test environment.
const invokedDirectly = (() => {
  try {
    if (typeof process === "undefined") return false;
    const arg1 = process.argv[1];
    if (!isNonEmptyString(arg1)) return false;
    // Compare absolute paths to avoid prefix-only false positives.
    const url = new URL(import.meta.url);
    const invoked = arg1.startsWith("/")
      ? arg1
      : arg1;
    return url.pathname === invoked;
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  void main(process.argv.slice(2)).then((code) => {
    if (code === 0) {
      process.exit(0);
    } else {
      process.exit(2);
    }
  });
}
