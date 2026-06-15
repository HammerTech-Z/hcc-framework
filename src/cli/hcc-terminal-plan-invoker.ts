// HCC Terminal Plan Invoker CLI.
//
// Terminal Hermes agent plan invoker: reads a Hermes Pro
// remaining execution plan from an explicit JSON fixture file,
// constructs a HCCTerminalInvocationFixture, and calls
// invokeTerminalAgentControlledRealDispatch(...).
//
// Usage:
//   node bin/hcc-terminal-plan-invoker.mjs \
//     --plan-fixture <path> \
//     --terminal-agent-session-id <id> \
//     --terminal-invocation-id <id> \
//     --explicit-user-trigger-token <token> \
//     --feature-flag-enabled
//
// Required flags (NO-GO if any missing):
//   --plan-fixture
//   --terminal-agent-session-id
//   --terminal-invocation-id
//   --explicit-user-trigger-token
//   --feature-flag-enabled
//
// Identity-only flags are also accepted via env vars
// (HCC_TERMINAL_AGENT_SESSION_ID, HCC_TERMINAL_INVOCATION_ID,
// HCC_EXPLICIT_USER_TRIGGER_TOKEN,
// HCC_FEATURE_FLAG_ENABLED) but CLI flags take precedence.
//
// Per HCC governance:
//   - NO background timer / cron / setInterval / setTimeout.
//   - NO direct spawn / exec / child_process.
//   - NO submitDryRunAction.
//   - NO bootstrap / arm / start / host imports.
//   - NO writes to ~/.hermes/**.
//   - NO automatic start on app launch.
//   - NO ipcMain / BrowserWindow / contextBridge registration.
//   - NO runtime go_no_go: "GO".
//   - NO runtime night_run_ready: true.
//   - Real side effects only through injected dispatch adapter.

import { readFileSync } from "node:fs";

import {
  invokeTerminalAgentControlledRealDispatch,
  type HCCTerminalInvocationFixture,
} from "../shared/lib/hcc-terminal-agent-invoker";
import type {
  HCCFinalControlledRealDispatchAdapter,
  HCCFinalControlledRealDispatchInput,
} from "../shared/lib/hcc-final-controlled-real-dispatch";

export const HCC_TERMINAL_PLAN_INVOKER_CLI_SCHEMA_VERSION =
  "1.0.0" as const;

export type HCCTerminalPlanInvokerCliVerdict =
  | "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE"
  | "NO-GO";

export type HCCTerminalPlanInvokerCliExitCode = 0 | 2;

// ---------------------------------------------------------------------------
// Plan fixture schema
// ---------------------------------------------------------------------------

export interface HCCTerminalPlanFixture {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  dry_run_artifact_hash: string;
  planned_action_id: string;
  planned_action_kind: "shell_command" | "file_write" | "config_patch";
  whitelist_action_id: string;
  target_path: string;
  authorization_result: Record<string, unknown>;
  runner_result: Record<string, unknown>;
  audit_result: Record<string, unknown>;
  rollback_plan: Record<string, unknown>;
  dispatch_backend: "in_memory" | "shell_command" | "file_write" | "config_patch";
  dispatch_payload: unknown;
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

export interface HCCTerminalPlanInvokerCliArgs {
  plan_fixture_path: string;
  terminal_agent_session_id: string;
  terminal_invocation_id: string;
  explicit_user_trigger_token: string;
  feature_flag_enabled: true;
}

export type HCCTerminalPlanInvokerCliParseResult =
  | { ok: true; args: HCCTerminalPlanInvokerCliArgs }
  | { ok: false; reason: string };

const REQUIRED_FLAGS = [
  "--plan-fixture",
  "--terminal-agent-session-id",
  "--terminal-invocation-id",
  "--explicit-user-trigger-token",
  "--feature-flag-enabled",
] as const;

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

export function parseTerminalPlanInvokerCliArgs(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): HCCTerminalPlanInvokerCliParseResult {
  const plan_fixture_path = readFlag(argv, "--plan-fixture", undefined);
  if (!isNonEmptyString(plan_fixture_path)) {
    return { ok: false, reason: "missing or empty --plan-fixture" };
  }

  const terminal_agent_session_id = readFlag(
    argv,
    "--terminal-agent-session-id",
    env.HCC_TERMINAL_AGENT_SESSION_ID,
  );
  if (!isNonEmptyString(terminal_agent_session_id)) {
    return { ok: false, reason: "missing or empty --terminal-agent-session-id" };
  }

  const terminal_invocation_id = readFlag(
    argv,
    "--terminal-invocation-id",
    env.HCC_TERMINAL_INVOCATION_ID,
  );
  if (!isNonEmptyString(terminal_invocation_id)) {
    return { ok: false, reason: "missing or empty --terminal-invocation-id" };
  }

  const explicit_user_trigger_token = readFlag(
    argv,
    "--explicit-user-trigger-token",
    env.HCC_EXPLICIT_USER_TRIGGER_TOKEN,
  );
  if (!isNonEmptyString(explicit_user_trigger_token)) {
    return { ok: false, reason: "missing or empty --explicit-user-trigger-token" };
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

  return {
    ok: true,
    args: {
      plan_fixture_path,
      terminal_agent_session_id,
      terminal_invocation_id,
      explicit_user_trigger_token,
      feature_flag_enabled: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Plan fixture validation
// ---------------------------------------------------------------------------

const REQUIRED_FIXTURE_FIELDS: readonly (keyof HCCTerminalPlanFixture)[] = [
  "task_id",
  "source_plan_ref",
  "requested_by_user",
  "authorization_id",
  "dry_run_artifact_hash",
  "planned_action_id",
  "planned_action_kind",
  "whitelist_action_id",
  "target_path",
  "authorization_result",
  "runner_result",
  "audit_result",
  "rollback_plan",
  "dispatch_backend",
  "dispatch_payload",
];

const SUPPORTED_ACTION_KINDS = new Set([
  "shell_command",
  "file_write",
  "config_patch",
]);

const SUPPORTED_BACKENDS = new Set([
  "in_memory",
  "shell_command",
  "file_write",
  "config_patch",
]);

export type HCCTerminalPlanFixtureParseResult =
  | { ok: true; fixture: HCCTerminalPlanFixture }
  | { ok: false; reason: string };

export function parsePlanFixture(
  raw: string,
): HCCTerminalPlanFixtureParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      ok: false,
      reason: `plan fixture is not valid JSON: ${(err as Error).message ?? String(err)}`,
    };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "plan fixture must be a JSON object" };
  }

  const obj = parsed as Record<string, unknown>;

  for (const field of REQUIRED_FIXTURE_FIELDS) {
    if (!(field in obj)) {
      return { ok: false, reason: `plan fixture missing required field: ${field}` };
    }
  }

  for (const field of ["task_id", "source_plan_ref", "requested_by_user",
    "authorization_id", "dry_run_artifact_hash", "planned_action_id",
    "whitelist_action_id", "target_path"]) {
    if (!isNonEmptyString(obj[field])) {
      return { ok: false, reason: `plan fixture field "${field}" must be a non-empty string` };
    }
  }

  if (!SUPPORTED_ACTION_KINDS.has(obj.planned_action_kind as string)) {
    return {
      ok: false,
      reason: `plan fixture planned_action_kind "${String(obj.planned_action_kind)}" is not supported`,
    };
  }

  if (!SUPPORTED_BACKENDS.has(obj.dispatch_backend as string)) {
    return {
      ok: false,
      reason: `plan fixture dispatch_backend "${String(obj.dispatch_backend)}" is not supported`,
    };
  }

  for (const field of ["authorization_result", "runner_result", "audit_result", "rollback_plan"]) {
    const v = obj[field];
    if (v === null || typeof v !== "object") {
      return { ok: false, reason: `plan fixture field "${field}" must be an object` };
    }
  }

  return {
    ok: true,
    fixture: {
      task_id: obj.task_id as string,
      source_plan_ref: obj.source_plan_ref as string,
      requested_by_user: obj.requested_by_user as string,
      authorization_id: obj.authorization_id as string,
      dry_run_artifact_hash: obj.dry_run_artifact_hash as string,
      planned_action_id: obj.planned_action_id as string,
      planned_action_kind: obj.planned_action_kind as HCCTerminalPlanFixture["planned_action_kind"],
      whitelist_action_id: obj.whitelist_action_id as string,
      target_path: obj.target_path as string,
      authorization_result: obj.authorization_result as Record<string, unknown>,
      runner_result: obj.runner_result as Record<string, unknown>,
      audit_result: obj.audit_result as Record<string, unknown>,
      rollback_plan: obj.rollback_plan as Record<string, unknown>,
      dispatch_backend: obj.dispatch_backend as HCCTerminalPlanFixture["dispatch_backend"],
      dispatch_payload: obj.dispatch_payload,
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

function defaultNoOpAdapter(): HCCFinalControlledRealDispatchAdapter {
  return {
    supportsKind: () => false,
    dispatch: () => {
      throw new Error(
        "hcc-terminal-plan-invoker-cli: no dispatch adapter injected; the CLI default no-op adapter refuses dispatch. Inject a real adapter via runTerminalPlanInvokerCli().",
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Core entrypoint
// ---------------------------------------------------------------------------

export interface HCCTerminalPlanInvokerCliResult {
  schema_version: string;
  verdict: HCCTerminalPlanInvokerCliVerdict;
  reason: string;
  terminal_agent_session_id: string;
  terminal_invocation_id: string;
  task_id: string;
  planned_action_id: string;
  unattended_ready: boolean;
  night_run_ready: boolean;
  go_no_go: string;
}

function noGoResult(
  reason: string,
  args?: Partial<HCCTerminalPlanInvokerCliArgs>,
  task_id?: string,
  planned_action_id?: string,
): HCCTerminalPlanInvokerCliResult {
  return {
    schema_version: HCC_TERMINAL_PLAN_INVOKER_CLI_SCHEMA_VERSION,
    verdict: "NO-GO",
    reason,
    terminal_agent_session_id: args?.terminal_agent_session_id ?? "",
    terminal_invocation_id: args?.terminal_invocation_id ?? "",
    task_id: task_id ?? "",
    planned_action_id: planned_action_id ?? "",
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}

export async function runTerminalPlanInvokerCli(
  args: HCCTerminalPlanInvokerCliArgs,
  dispatchAdapter: HCCFinalControlledRealDispatchAdapter = defaultNoOpAdapter(),
  readFixture: (path: string) => string = (p) => readFileSync(p, "utf-8"),
): Promise<HCCTerminalPlanInvokerCliResult> {
  // Read fixture file.
  let raw: string;
  try {
    raw = readFixture(args.plan_fixture_path);
  } catch (err) {
    return noGoResult(
      `cannot read plan fixture: ${(err as Error).message ?? String(err)}`,
      args,
    );
  }

  // Parse and validate fixture.
  const parsed = parsePlanFixture(raw);
  if (!parsed.ok) {
    return noGoResult(parsed.reason, args);
  }

  const f = parsed.fixture;

  // Build the terminal invocation fixture.
  const terminalFixture: HCCTerminalInvocationFixture = {
    terminal_agent_session_id: args.terminal_agent_session_id,
    terminal_invocation_id: args.terminal_invocation_id,
    shared_fixture: {
      task_id: f.task_id,
      source_plan_ref: f.source_plan_ref,
      requested_by_user: f.requested_by_user,
      authorization_id: f.authorization_id,
      dry_run_artifact_hash: f.dry_run_artifact_hash,
      planned_action_id: f.planned_action_id,
      planned_action_kind: f.planned_action_kind,
      whitelist_action_id: f.whitelist_action_id,
      target_path: f.target_path,
      explicit_user_trigger_token: args.explicit_user_trigger_token,
      dispatch_adapter: dispatchAdapter,
      authorization_result: f.authorization_result as HCCFinalControlledRealDispatchInput["authorization_result"],
      runner_result: f.runner_result as HCCFinalControlledRealDispatchInput["runner_result"],
      audit_result: f.audit_result as HCCFinalControlledRealDispatchInput["audit_result"],
      rollback_plan: f.rollback_plan as HCCFinalControlledRealDispatchInput["rollback_plan"],
    },
    dispatch_adapter: dispatchAdapter,
  };

  // Invoke.
  let result: Awaited<ReturnType<typeof invokeTerminalAgentControlledRealDispatch>>;
  try {
    result = await invokeTerminalAgentControlledRealDispatch(terminalFixture);
  } catch (err) {
    return noGoResult(
      `invoker raised: ${(err as Error).message ?? String(err)}`,
      args,
      f.task_id,
      f.planned_action_id,
    );
  }

  const isCandidate = result.verdict === "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE";

  return {
    schema_version: HCC_TERMINAL_PLAN_INVOKER_CLI_SCHEMA_VERSION,
    verdict: isCandidate ? "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" : "NO-GO",
    reason: result.reason ?? "",
    terminal_agent_session_id: result.terminal_agent_session_id,
    terminal_invocation_id: result.terminal_invocation_id,
    task_id: f.task_id,
    planned_action_id: f.planned_action_id,
    unattended_ready: isCandidate ? result.unattended_ready : false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

export async function main(argv: readonly string[]): Promise<HCCTerminalPlanInvokerCliExitCode> {
  const env = process.env as Record<string, string | undefined>;
  const parsed = parseTerminalPlanInvokerCliArgs(argv, env);
  if (!parsed.ok) {
    const err = noGoResult(parsed.reason);
    process.stdout.write(JSON.stringify(err, null, 2) + "\n");
    return 2;
  }
  const result = await runTerminalPlanInvokerCli(parsed.args);
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  return result.verdict === "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" ? 0 : 2;
}

// Auto-exec guard.
const invokedDirectly = (() => {
  try {
    if (typeof process === "undefined") return false;
    const arg1 = process.argv[1];
    if (!isNonEmptyString(arg1)) return false;
    const url = new URL(import.meta.url);
    const invoked = arg1.startsWith("/") ? arg1 : arg1;
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
