// Hermes Pro profile rollout rollback preview helper (MODEL-STRATEGY-004B).
// Pure functions only. No filesystem, no IPC, no runtime, no config writes,
// no network probes. Returns descriptive projections; never executes rollback.

import type {
  ModelStrategyLane,
  ModelStrategyLaneId,
  ModelStrategyRollbackBaseline,
} from "./model-strategy-dry-run";
import type { ProviderCatalogFixture } from "./provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "./smoke-test-matrix";

export const PROFILE_ROLLBACK_PREVIEW_SCHEMA_VERSION = "1.0.0" as const;
export const PROFILE_ROLLBACK_PREVIEW_MODE = "dry_run_rollback_preview" as const;

export const PROFILE_ROLLBACK_PREVIEW_DRY_RUN_ONLY = true as const;
export const PROFILE_ROLLBACK_PREVIEW_NO_RUNTIME_ACTIVATION = true as const;
export const PROFILE_ROLLBACK_PREVIEW_NO_LIVE_ROUTING = true as const;
export const PROFILE_ROLLBACK_PREVIEW_ROLLOUT_WRITES_TO_CONFIG = false as const;
export const PROFILE_ROLLBACK_PREVIEW_SOURCE_CANDIDATE_ID =
  "model-strategy-dry-run-2026-06-05" as const;

export const PROFILE_ROLLBACK_PREVIEW_AFFECTED_LANES: readonly ModelStrategyLaneId[] = [
  "daily",
  "light_task",
] as const;

export const PROFILE_ROLLBACK_PREVIEW_PROTECTED_LANES: readonly ModelStrategyLaneId[] = [
  "task_fallback",
] as const;

export const PROFILE_ROLLBACK_PREVIEW_NO_LEGACY_BASELINE_LANES: readonly ModelStrategyLaneId[] = [
  "daily_fallback",
  "complex_code",
  "god",
] as const;

export const PROFILE_ROLLBACK_REASON_NO_LEGACY_BASELINE =
  "no_legacy_baseline_preserve_current_candidate" as const;

export interface ProfileRollbackPreviewLane {
  lane: ModelStrategyLaneId;
  candidate_model: string;
  baseline_model: string | null;
  baseline_alias: string | null;
  rollback_target_model: string | null;
  requires_rollback: boolean;
  preserve_candidate: boolean;
  protected_lane: boolean;
  reason: string;
}

export interface ProfileRollbackPreview {
  schema_version: typeof PROFILE_ROLLBACK_PREVIEW_SCHEMA_VERSION;
  mode: typeof PROFILE_ROLLBACK_PREVIEW_MODE;
  dry_run_only: true;
  no_runtime_activation: true;
  no_live_routing: true;
  rollout_writes_to_config: false;
  target_legacy_baseline: ModelStrategyRollbackBaseline;
  source_candidate_profile_id: typeof PROFILE_ROLLBACK_PREVIEW_SOURCE_CANDIDATE_ID;
  affected_lanes: ModelStrategyLaneId[];
  protected_lanes: ModelStrategyLaneId[];
  no_legacy_baseline_lanes: ModelStrategyLaneId[];
  estimated_steps_to_rollback: number;
  lane_previews: ProfileRollbackPreviewLane[];
}

function baselineForLane(
  lane: ModelStrategyLaneId,
  baseline: ModelStrategyRollbackBaseline,
): { baseline_model: string | null; baseline_alias: string | null } {
  if (lane === "daily" || lane === "light_task") {
    return { baseline_model: baseline.daily_model, baseline_alias: null };
  }
  if (lane === "task_fallback") {
    return {
      baseline_model: null,
      baseline_alias: baseline.task_fallback_model,
    };
  }
  return { baseline_model: null, baseline_alias: null };
}

function protectedFlagFor(lane: ModelStrategyLaneId): boolean {
  return lane === "task_fallback";
}

function noLegacyBaselineFlagFor(lane: ModelStrategyLaneId): boolean {
  return (
    lane === "daily_fallback" ||
    lane === "complex_code" ||
    lane === "god"
  );
}

function affectedFlagFor(lane: ModelStrategyLaneId): boolean {
  return lane === "daily" || lane === "light_task";
}

function lanePreviewFor(
  lane: ModelStrategyLane,
  baseline: ModelStrategyRollbackBaseline,
): ProfileRollbackPreviewLane {
  const { baseline_model, baseline_alias } = baselineForLane(lane.lane, baseline);
  const isProtected = protectedFlagFor(lane.lane);
  const isNoLegacy = noLegacyBaselineFlagFor(lane.lane);
  const isAffected = affectedFlagFor(lane.lane);

  const requires_rollback = !isProtected && !isNoLegacy && isAffected;
  const preserve_candidate = isProtected || isNoLegacy;
  const rollback_target_model = requires_rollback ? baseline_model : null;

  let reason: string;
  if (isProtected) {
    reason = `protected_lane: rollback_guard preserves ${lane.candidate_model}; legacy alias ${baseline_alias} kept as reference only.`;
  } else if (isNoLegacy) {
    reason = PROFILE_ROLLBACK_REASON_NO_LEGACY_BASELINE;
  } else if (requires_rollback) {
    reason = `rollback_target=${rollback_target_model} from 001 rollback baseline.`;
  } else {
    reason = "no_op_dry_run_rollback_preview";
  }

  return {
    lane: lane.lane,
    candidate_model: lane.candidate_model,
    baseline_model,
    baseline_alias,
    rollback_target_model,
    requires_rollback,
    preserve_candidate,
    protected_lane: isProtected,
    reason,
  };
}

export function previewRollback(
  currentCandidateProfile: { lanes: ModelStrategyLane[] },
  legacyBaseline: ModelStrategyRollbackBaseline,
  _smokeMatrix: SmokeTestMatrixFixture,
  _providerCatalog: ProviderCatalogFixture,
): ProfileRollbackPreview {
  const lane_previews = currentCandidateProfile.lanes.map((lane) =>
    lanePreviewFor(lane, legacyBaseline),
  );
  return {
    schema_version: PROFILE_ROLLBACK_PREVIEW_SCHEMA_VERSION,
    mode: PROFILE_ROLLBACK_PREVIEW_MODE,
    dry_run_only: PROFILE_ROLLBACK_PREVIEW_DRY_RUN_ONLY,
    no_runtime_activation: PROFILE_ROLLBACK_PREVIEW_NO_RUNTIME_ACTIVATION,
    no_live_routing: PROFILE_ROLLBACK_PREVIEW_NO_LIVE_ROUTING,
    rollout_writes_to_config: PROFILE_ROLLBACK_PREVIEW_ROLLOUT_WRITES_TO_CONFIG,
    target_legacy_baseline: legacyBaseline,
    source_candidate_profile_id:
      PROFILE_ROLLBACK_PREVIEW_SOURCE_CANDIDATE_ID,
    affected_lanes: [...PROFILE_ROLLBACK_PREVIEW_AFFECTED_LANES],
    protected_lanes: [...PROFILE_ROLLBACK_PREVIEW_PROTECTED_LANES],
    no_legacy_baseline_lanes: [
      ...PROFILE_ROLLBACK_PREVIEW_NO_LEGACY_BASELINE_LANES,
    ],
    estimated_steps_to_rollback: 1,
    lane_previews,
  };
}

export const PROFILE_ROLLBACK_PREVIEW_SAFETY_LITERALS = {
  schema_version: PROFILE_ROLLBACK_PREVIEW_SCHEMA_VERSION,
  mode: PROFILE_ROLLBACK_PREVIEW_MODE,
  dry_run_only: PROFILE_ROLLBACK_PREVIEW_DRY_RUN_ONLY,
  no_runtime_activation: PROFILE_ROLLBACK_PREVIEW_NO_RUNTIME_ACTIVATION,
  no_live_routing: PROFILE_ROLLBACK_PREVIEW_NO_LIVE_ROUTING,
  rollout_writes_to_config: PROFILE_ROLLBACK_PREVIEW_ROLLOUT_WRITES_TO_CONFIG,
} as const;
