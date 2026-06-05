// Hermes Pro model strategy dry-run helpers.
// Pure validation/projection only: no filesystem, no IPC, no gateway,
// no live config writes, and no runtime routing.

export const MODEL_STRATEGY_SCHEMA_VERSION = "1.0.0" as const;
export const MODEL_STRATEGY_MODE = "dry_run" as const;

export const MODEL_STRATEGY_LIVE_CONFIG_WRITES_ALLOWED = false as const;
export const MODEL_STRATEGY_AUTOMATIC_ROUTING_ENABLED = false as const;
export const MODEL_STRATEGY_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const MODEL_STRATEGY_RUNTIME_ROUTER_ALLOWED = false as const;

export type ModelStrategyLaneId =
  | "daily"
  | "daily_fallback"
  | "light_task"
  | "complex_code"
  | "task_fallback"
  | "god";

export type ModelStrategyProvider =
  | "minimax"
  | "custom"
  | "openai"
  | "deepseek"
  | "anthropic";

export type ModelStrategyVerificationState =
  | "unverified"
  | "blocked"
  | "verified"
  | "unavailable";

export interface ModelStrategyLane {
  lane: ModelStrategyLaneId;
  purpose: string;
  provider: ModelStrategyProvider;
  lane_provider_label?: string;
  model_policy: string;
  candidate_model: string;
  base_url?: string | null;
  cost_fallback_model?: string;
  requires_provider_catalog_resolution?: boolean;
  requires_smoke_test?: boolean;
  requires_multimodal_smoke_test?: boolean;
  requires_user_intent?: boolean;
  enablement: string;
  verification_state: ModelStrategyVerificationState;
}

export interface ModelStrategyRollbackBaseline {
  daily_model: string;
  task_fallback_model: string;
  live_config_write_allowed: false;
}

export interface ModelStrategySafetyInvariants {
  live_config_writes_allowed: false;
  automatic_runtime_routing_enabled: false;
  hcc_auto_executor_allowed: false;
  runtime_router_allowed: false;
  secrets_inline_allowed: false;
}

export interface ModelStrategyDryRunFixture {
  schema_version: typeof MODEL_STRATEGY_SCHEMA_VERSION;
  mode: typeof MODEL_STRATEGY_MODE;
  status: "planned";
  active_profile: string;
  rollback_baseline: ModelStrategyRollbackBaseline;
  safety_invariants: ModelStrategySafetyInvariants;
  lanes: ModelStrategyLane[];
}

export interface ModelStrategyValidationIssue {
  code: string;
  lane?: ModelStrategyLaneId;
  message: string;
}

export interface ModelStrategyValidationResult {
  ok: boolean;
  issues: ModelStrategyValidationIssue[];
}

export interface ModelStrategyLaneSummary {
  lane: ModelStrategyLaneId;
  provider: ModelStrategyProvider;
  label: string;
  candidateModel: string;
  enablement: string;
  verificationState: ModelStrategyVerificationState;
  blockedReason: string | null;
}

const REQUIRED_LANE_ORDER: readonly ModelStrategyLaneId[] = [
  "daily",
  "daily_fallback",
  "light_task",
  "complex_code",
  "task_fallback",
  "god",
];

const USER_INTENT_REQUIRED_LANES = new Set<ModelStrategyLaneId>([
  "complex_code",
  "god",
]);

export function validateModelStrategyDryRunFixture(
  fixture: ModelStrategyDryRunFixture,
): ModelStrategyValidationResult {
  const issues: ModelStrategyValidationIssue[] = [];

  if (fixture.schema_version !== MODEL_STRATEGY_SCHEMA_VERSION) {
    issues.push({
      code: "schema_version_mismatch",
      message: "Model strategy dry-run schema version must be 1.0.0.",
    });
  }
  if (fixture.mode !== MODEL_STRATEGY_MODE) {
    issues.push({
      code: "mode_not_dry_run",
      message: "Model strategy fixture must stay in dry_run mode.",
    });
  }
  if (fixture.safety_invariants.live_config_writes_allowed !== false) {
    issues.push({
      code: "live_config_write_allowed",
      message: "MODEL-STRATEGY-001 must not allow live config writes.",
    });
  }
  if (fixture.safety_invariants.automatic_runtime_routing_enabled !== false) {
    issues.push({
      code: "automatic_runtime_routing_enabled",
      message: "MODEL-STRATEGY-001 must not enable automatic routing.",
    });
  }
  if (fixture.safety_invariants.hcc_auto_executor_allowed !== false) {
    issues.push({
      code: "hcc_auto_executor_allowed",
      message: "MODEL-STRATEGY-001 must not enable HCC Auto Executor.",
    });
  }
  if (fixture.safety_invariants.runtime_router_allowed !== false) {
    issues.push({
      code: "runtime_router_allowed",
      message: "MODEL-STRATEGY-001 must not expose a live router.",
    });
  }
  if (fixture.safety_invariants.secrets_inline_allowed !== false) {
    issues.push({
      code: "secrets_inline_allowed",
      message: "Model strategy fixture must not inline API keys or secrets.",
    });
  }
  if (fixture.rollback_baseline.live_config_write_allowed !== false) {
    issues.push({
      code: "rollback_baseline_write_allowed",
      message: "Rollback baseline must be documentation-only.",
    });
  }

  const lanesById = new Map<ModelStrategyLaneId, ModelStrategyLane>();
  for (const lane of fixture.lanes) {
    if (lanesById.has(lane.lane)) {
      issues.push({
        code: "duplicate_lane",
        lane: lane.lane,
        message: `Duplicate lane ${lane.lane}.`,
      });
    }
    lanesById.set(lane.lane, lane);
  }

  for (const laneId of REQUIRED_LANE_ORDER) {
    if (!lanesById.has(laneId)) {
      issues.push({
        code: "missing_lane",
        lane: laneId,
        message: `Missing required lane ${laneId}.`,
      });
    }
  }

  for (const [laneId, lane] of lanesById) {
    if (lane.verification_state === "verified") {
      issues.push({
        code: "lane_prematurely_verified",
        lane: laneId,
        message: "MODEL-STRATEGY-001 must not mark lanes verified.",
      });
    }
    if (!lane.candidate_model.trim()) {
      issues.push({
        code: "missing_candidate_model",
        lane: laneId,
        message: "Each lane needs a candidate model or provider placeholder.",
      });
    }
    if (USER_INTENT_REQUIRED_LANES.has(laneId) && lane.requires_user_intent !== true) {
      issues.push({
        code: "missing_user_intent_gate",
        lane: laneId,
        message: `${laneId} must require explicit user intent.`,
      });
    }
  }

  const daily = lanesById.get("daily");
  if (
    daily &&
    daily.provider === "minimax" &&
    daily.candidate_model === "MiniMax 3.0" &&
    daily.requires_provider_catalog_resolution !== true
  ) {
    issues.push({
      code: "minimax_requires_catalog_resolution",
      lane: "daily",
      message: "MiniMax 3.0 must be resolved before any live config write.",
    });
  }

  const lightTask = lanesById.get("light_task");
  if (
    lightTask &&
    lightTask.provider === "minimax" &&
    lightTask.requires_provider_catalog_resolution !== true
  ) {
    issues.push({
      code: "light_task_minimax_requires_catalog_resolution",
      lane: "light_task",
      message: "MiniMax light task lane must resolve exact model id and endpoint.",
    });
  }

  const localFallback = lanesById.get("daily_fallback");
  if (localFallback) {
    if (localFallback.provider !== "custom") {
      issues.push({
        code: "local_fallback_must_map_to_custom_provider",
        lane: "daily_fallback",
        message: "Local fallback live mapping must use provider=custom.",
      });
    }
    if (localFallback.lane_provider_label !== "local") {
      issues.push({
        code: "local_fallback_missing_lane_label",
        lane: "daily_fallback",
        message: "Local fallback should keep local as a lane label only.",
      });
    }
    if (!localFallback.base_url?.startsWith("http://localhost")) {
      issues.push({
        code: "local_fallback_missing_local_base_url",
        lane: "daily_fallback",
        message: "Local fallback needs an explicit localhost base URL.",
      });
    }
  }

  const complexCode = lanesById.get("complex_code");
  if (complexCode?.candidate_model !== "gpt-5.5") {
    issues.push({
      code: "complex_code_candidate_not_gpt_5_5",
      lane: "complex_code",
      message: "Complex code lane should use gpt-5.5 as the current target candidate.",
    });
  }

  return { ok: issues.length === 0, issues };
}

export function buildModelStrategyLaneSummaries(
  fixture: ModelStrategyDryRunFixture,
): ModelStrategyLaneSummary[] {
  return fixture.lanes.map((lane) => ({
    lane: lane.lane,
    provider: lane.provider,
    label: lane.lane_provider_label ?? lane.provider,
    candidateModel: lane.candidate_model,
    enablement: lane.enablement,
    verificationState: lane.verification_state,
    blockedReason: deriveLaneBlockedReason(lane),
  }));
}

export function deriveLaneBlockedReason(lane: ModelStrategyLane): string | null {
  if (lane.verification_state === "verified") return null;
  if (lane.requires_provider_catalog_resolution) {
    return "provider_catalog_resolution_required";
  }
  if (lane.requires_multimodal_smoke_test) {
    return "multimodal_smoke_test_required";
  }
  if (lane.requires_smoke_test) {
    return "smoke_test_required";
  }
  return "manual_review_required";
}

export function assertModelStrategyNoLiveConfigWrites(
  fixture: ModelStrategyDryRunFixture,
): void {
  const result = validateModelStrategyDryRunFixture(fixture);
  const writeIssues = result.issues.filter((issue) =>
    [
      "live_config_write_allowed",
      "rollback_baseline_write_allowed",
      "automatic_runtime_routing_enabled",
      "runtime_router_allowed",
    ].includes(issue.code),
  );
  if (writeIssues.length > 0) {
    throw new Error(writeIssues.map((issue) => issue.code).join(","));
  }
}
