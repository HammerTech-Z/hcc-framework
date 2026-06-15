// HCC Plan Fixture Generator.
//
// Pure async fixture generator for the terminal Hermes plan
// invoker. Consumes a HCCPlanFixtureGeneratorInput (an
// `HCCSharedInvocationFixture` shape + the four prior HCC
// verdict objects) and produces a serialized JSON fixture in
// the exact shape consumed by `bin/hcc-terminal-plan-invoker.mjs`
// / `src/cli/hcc-terminal-plan-invoker.ts::parsePlanFixture`.
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
