// HCC Plan Fixture Generator.
//
// Pure async fixture generator for the terminal Hermes plan
// invoker. Consumes a HCCPlanFixtureGeneratorInput (an
// `HCCSharedInvocationFixture` shape + the four prior HCC
// verdict objects) and produces a serialized JSON fixture in
// the exact shape consumed by `bin/hcc-terminal-plan-invoker.mjs`
// / `src/cli/hcc-terminal-plan-invoker.ts::parsePlanFixture`.
//
// This module also exports `buildDispatchAdapterFromPlanFixture`
// — a pure factory that converts a plan fixture's
// `dispatch_backend` / `dispatch_payload` into a real
// `HCCFinalControlledRealDispatchAdapter` backed by the caller's
// injected `executors`. The factory never spawns, writes, or
// patches directly; it only wires the caller-supplied executors
// into the controlled dispatch adapter.
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
//   - File write only through injected `writer`.

export const HCC_PLAN_FIXTURE_GENERATOR_SCHEMA_VERSION = "1.0.0" as const;

export type HCCPlanFixtureDispatchBackend =
  | "in_memory"
  | "shell_command"
  | "file_write"
  | "config_patch";

export type HCCPlanFixturePlannedActionKind =
  | "shell_command"
  | "file_write"
  | "config_patch";

export interface HCCPlanFixtureGeneratorInput {
  task_id: string;
  source_plan_ref: string;
  requested_by_user: string;
  authorization_id: string;
  dry_run_artifact_hash: string;
  planned_action_id: string;
  planned_action_kind: HCCPlanFixturePlannedActionKind;
  whitelist_action_id: string;
  target_path: string;
  authorization_result: Record<string, unknown>;
  runner_result: Record<string, unknown>;
  audit_result: Record<string, unknown>;
  rollback_plan: Record<string, unknown>;
  dispatch_backend: HCCPlanFixtureDispatchBackend;
  dispatch_payload: unknown;
  /**
   * When true, do not call `writer`; produce the JSON string
   * only and return it. When false (default), call `writer`
   * with the JSON content if provided.
   */
  dry_run?: boolean;
}

export interface HCCPlanFixtureWriter {
  (target_path: string, content: string): Promise<void> | void;
}

export interface HCCPlanFixtureGeneratorResult {
  schema_version: typeof HCC_PLAN_FIXTURE_GENERATOR_SCHEMA_VERSION;
  fixture_json: string;
  fixture_path: string;
  bytes: number;
  task_id: string;
  planned_action_id: string;
  go_no_go: "NO-GO";
  dry_run: boolean;
  wrote_to_disk: boolean;
}

export type HCCPlanFixtureGeneratorParseResult =
  | { ok: true; result: HCCPlanFixtureGeneratorResult }
  | { ok: false; reason: string };

const SUPPORTED_ACTION_KINDS: ReadonlySet<HCCPlanFixturePlannedActionKind> =
  new Set(["shell_command", "file_write", "config_patch"]);

const SUPPORTED_BACKENDS: ReadonlySet<HCCPlanFixtureDispatchBackend> = new Set([
  "in_memory",
  "shell_command",
  "file_write",
  "config_patch",
]);

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function buildPlanFixtureObject(
  input: HCCPlanFixtureGeneratorInput,
): Record<string, unknown> {
  return {
    task_id: input.task_id,
    source_plan_ref: input.source_plan_ref,
    requested_by_user: input.requested_by_user,
    authorization_id: input.authorization_id,
    dry_run_artifact_hash: input.dry_run_artifact_hash,
    planned_action_id: input.planned_action_id,
    planned_action_kind: input.planned_action_kind,
    whitelist_action_id: input.whitelist_action_id,
    target_path: input.target_path,
    authorization_result: input.authorization_result,
    runner_result: input.runner_result,
    audit_result: input.audit_result,
    rollback_plan: input.rollback_plan,
    dispatch_backend: input.dispatch_backend,
    dispatch_payload: input.dispatch_payload,
  };
}

/**
 * Build the JSON content + deterministic metadata. Pure. Does
 * NOT call the writer; that is the caller's responsibility via
 * the optional `writer` injection in `generatePlanFixture`.
 */
export function buildPlanFixtureJson(input: HCCPlanFixtureGeneratorInput): string {
  const obj = buildPlanFixtureObject(input);
  return JSON.stringify(obj, null, 2);
}

/**
 * Validate the generator input structurally before serialization.
 * Mirrors the CLI's `parsePlanFixture` rules so the generator
 * never produces a fixture the CLI will reject.
 */
export function validatePlanFixtureInput(
  input: HCCPlanFixtureGeneratorInput,
): string | null {
  const requiredStrings: readonly (keyof HCCPlanFixtureGeneratorInput)[] = [
    "task_id",
    "source_plan_ref",
    "requested_by_user",
    "authorization_id",
    "dry_run_artifact_hash",
    "planned_action_id",
    "whitelist_action_id",
    "target_path",
  ];
  for (const field of requiredStrings) {
    if (!isNonEmptyString(input[field])) {
      return `field "${String(field)}" must be a non-empty string`;
    }
  }
  if (!SUPPORTED_ACTION_KINDS.has(input.planned_action_kind)) {
    return `planned_action_kind "${String(input.planned_action_kind)}" is not supported`;
  }
  if (!SUPPORTED_BACKENDS.has(input.dispatch_backend)) {
    return `dispatch_backend "${String(input.dispatch_backend)}" is not supported`;
  }
  const requiredObjects: readonly (keyof HCCPlanFixtureGeneratorInput)[] = [
    "authorization_result",
    "runner_result",
    "audit_result",
    "rollback_plan",
  ];
  for (const field of requiredObjects) {
    const v = input[field];
    if (v === null || typeof v !== "object" || Array.isArray(v)) {
      return `field "${String(field)}" must be an object`;
    }
  }
  return null;
}

/**
 * The single generator entrypoint. Pure async. Builds the JSON,
 * optionally writes it via the injected `writer`, and returns
 * deterministic metadata. Does NOT throw on input validation
 * failure — returns `{ ok: false, reason }`. The writer throw
 * path surfaces as a typed `{ ok: false, reason }`.
 *
 * `writer` is optional; if omitted, the generator runs in pure
 * dry-run mode (no write, returns `wrote_to_disk: false`). The
 * `dry_run` input flag has the same effect and forces no write
 * even when a `writer` is provided.
 *
 * The writer receives `(fixture_path, content)`. The generator
 * does NOT touch the filesystem directly. Production wiring
 * supplies a real writer; tests inject a mock.
 */
export async function generatePlanFixture(
  input: HCCPlanFixtureGeneratorInput,
  fixture_path: string,
  writer?: HCCPlanFixtureWriter,
): Promise<HCCPlanFixtureGeneratorParseResult> {
  const reason = validatePlanFixtureInput(input);
  if (reason !== null) {
    return { ok: false, reason };
  }

  const json = buildPlanFixtureJson(input);
  const bytes = Buffer.byteLength(json, "utf-8");

  const isDryRun = input.dry_run === true || writer === undefined;

  if (!isDryRun) {
    try {
      await writer!(fixture_path, json);
    } catch (err) {
      return {
        ok: false,
        reason: `writer rejected: ${(err as Error).message ?? String(err)}`,
      };
    }
  }

  return {
    ok: true,
    result: {
      schema_version: HCC_PLAN_FIXTURE_GENERATOR_SCHEMA_VERSION,
      fixture_json: json,
      fixture_path,
      bytes,
      task_id: input.task_id,
      planned_action_id: input.planned_action_id,
      go_no_go: "NO-GO",
      dry_run: isDryRun,
      wrote_to_disk: !isDryRun,
    },
  };
}

// ---------------------------------------------------------------------------
// Dispatch adapter factory
// ---------------------------------------------------------------------------

import {
  buildControlledDispatchAdapter,
  type HCCControlledDispatchExecutorDeps,
  type HCCControlledDispatchInput,
} from "./hcc-controlled-dispatch-adapter";
import type {
  HCCFinalControlledRealDispatchAdapter,
} from "./hcc-final-controlled-real-dispatch";

/**
 * Build a real `HCCFinalControlledRealDispatchAdapter` from a
 * parsed plan fixture + injected executors. Pure factory — no
 * side effects, no I/O. The factory wires the caller's
 * `executors.{shell_executor, writer, patcher}` into the
 * controlled dispatch backend selected by the fixture's
 * `dispatch_backend` field.
 *
 * The factory returns a fresh closure for each call so callers
 * can mint multiple independent adapters (e.g., one per
 * terminal invocation).
 *
 * The factory does NOT:
 *   - call any executor itself
 *   - read or write files
 *   - spawn processes
 *   - touch `~/.hermes/**`
 *   - set `go_no_go: "GO"` or `night_run_ready: true`
 */
export function buildDispatchAdapterFromPlanFixture(
  fixture: Pick<
    HCCPlanFixtureGeneratorInput,
    | "task_id"
    | "planned_action_id"
    | "dispatch_backend"
    | "dispatch_payload"
  >,
  executors: HCCControlledDispatchExecutorDeps,
  now: () => string = () => new Date().toISOString(),
): HCCFinalControlledRealDispatchAdapter {
  return buildControlledDispatchAdapter(() => ({
    planned_action_id: fixture.planned_action_id,
    backend: fixture.dispatch_backend,
    payload: derivePayloadFromPlanFixture(
      fixture.dispatch_backend,
      fixture.dispatch_payload,
    ),
    trigger_proof: {
      explicit_user_trigger_token: fixture.task_id,
      source_service: "hcc-user-explicit-local-invoker",
    },
    executors,
    now,
  }));
}

/**
 * Pure projection: convert the fixture's `dispatch_payload`
 * (an untyped JSON value produced by the generator) into the
 * typed `HCCControlledDispatchInput["payload"]` shape the
 * controlled dispatch adapter expects. Returns `undefined` for
 * `in_memory` backend (no payload required).
 */
function derivePayloadFromPlanFixture(
  backend: HCCPlanFixtureDispatchBackend,
  raw: unknown,
): HCCControlledDispatchInput["payload"] {
  if (backend === "in_memory") return undefined;
  if (backend === "shell_command") {
    if (raw === null || typeof raw !== "object") return undefined;
    const obj = raw as { argv?: unknown };
    if (!Array.isArray(obj.argv)) return undefined;
    const argv: string[] = [];
    for (const a of obj.argv) {
      if (typeof a !== "string") return undefined;
      argv.push(a);
    }
    return { kind: "shell", argv };
  }
  if (backend === "file_write") {
    if (raw === null || typeof raw !== "object") return undefined;
    const obj = raw as { target_path?: unknown; content?: unknown };
    if (typeof obj.target_path !== "string") return undefined;
    if (typeof obj.content !== "string") return undefined;
    return { kind: "file", target_path: obj.target_path, content: obj.content };
  }
  // config_patch
  if (raw === null || typeof raw !== "object") return undefined;
  const obj = raw as { target_path?: unknown; patch?: unknown };
  if (typeof obj.target_path !== "string") return undefined;
  if (!Array.isArray(obj.patch)) return undefined;
  const patch: Array<{ key: string; value: unknown }> = [];
  for (const entry of obj.patch) {
    if (entry === null || typeof entry !== "object") return undefined;
    const e = entry as { key?: unknown; value?: unknown };
    if (typeof e.key !== "string") return undefined;
    patch.push({ key: e.key, value: e.value });
  }
  return { kind: "config", target_path: obj.target_path, patch };
}
