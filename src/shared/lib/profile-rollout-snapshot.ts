// Hermes Pro profile rollout simulation snapshot (MODEL-STRATEGY-004A).
// Pure data; no filesystem, no IPC, no runtime, no config writes.
// Mirrors MODEL-STRATEGY-001 dry-run lanes and MODEL-STRATEGY-002A catalog
// at the data layer only. No verified production baseline is invented.

import type { ModelStrategyLane, ModelStrategyLaneId, ModelStrategyRollbackBaseline } from "./model-strategy-dry-run";

export const PROFILE_ROLLOUT_SCHEMA_VERSION = "1.0.0" as const;
export const PROFILE_ROLLOUT_MODE = "dry_run_simulation" as const;
export const PROFILE_ROLLOUT_STATUS = "planned" as const;

export const PROFILE_ROLLOUT_LIVE_CONFIG_WRITES_ALLOWED = false as const;
export const PROFILE_ROLLOUT_AUTOMATIC_ROUTING_ENABLED = false as const;
export const PROFILE_ROLLOUT_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const PROFILE_ROLLOUT_RUNTIME_ROUTER_ALLOWED = false as const;
export const PROFILE_ROLLOUT_WRITES_TO_CONFIG = false as const;

export const PROFILE_ROLLOUT_SOURCE_FIXTURE_ID =
  "model-strategy-dry-run-2026-06-05" as const;

export type ProfileRolloutStepKind =
  | "shadow_observation"
  | "user_opt_in"
  | "internal_only"
  | "release_candidate_preview";

export type ProfileRolloutGateKind =
  | "smoke_test"
  | "user_intent"
  | "catalog_resolution"
  | "rollback_baseline_match";

export interface ProfileRolloutStep {
  step_index: 0 | 1 | 2 | 3;
  kind: ProfileRolloutStepKind;
  eligible_lane_ids: ModelStrategyLaneId[];
  gate_pass_required: ProfileRolloutGateKind[];
  dry_run_only: true;
  description: string;
}

export interface ProfileCandidateProfile {
  schema_version: typeof PROFILE_ROLLOUT_SCHEMA_VERSION;
  source: typeof PROFILE_ROLLOUT_SOURCE_FIXTURE_ID;
  lanes: ModelStrategyLane[];
}

export interface ProfileRolloutSimulationSnapshot {
  schema_version: typeof PROFILE_ROLLOUT_SCHEMA_VERSION;
  mode: typeof PROFILE_ROLLOUT_MODE;
  status: typeof PROFILE_ROLLOUT_STATUS;
  active_profile: string;
  legacy_baseline: ModelStrategyRollbackBaseline;
  current_candidate_profile: ProfileCandidateProfile;
  rollout_steps: ProfileRolloutStep[];
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    rollout_writes_to_config: false;
  };
}

// Reference: 001 dry-run fixture — pinned by type, not duplicated by hand.
import { MODEL_STRATEGY_DRY_RUN_SNAPSHOT } from "./model-strategy-snapshots";

const LEGACY_BASELINE: ModelStrategyRollbackBaseline = {
  daily_model: "minimax2.7",
  task_fallback_model: "deepseekV4pro",
  live_config_write_allowed: false,
};

const CANDIDATE_PROFILE: ProfileCandidateProfile = {
  schema_version: PROFILE_ROLLOUT_SCHEMA_VERSION,
  source: PROFILE_ROLLOUT_SOURCE_FIXTURE_ID,
  lanes: MODEL_STRATEGY_DRY_RUN_SNAPSHOT.lanes.map((lane) => ({
    ...lane,
    verification_state: "unverified",
  })),
};

const ROLLOUT_STEPS: ProfileRolloutStep[] = [
  {
    step_index: 0,
    kind: "shadow_observation",
    eligible_lane_ids: [
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ],
    gate_pass_required: [
      "smoke_test",
      "catalog_resolution",
    ],
    dry_run_only: true,
    description:
      "Shadow observation only: no live traffic, no routing changes, no config writes.",
  },
  {
    step_index: 1,
    kind: "user_opt_in",
    eligible_lane_ids: ["complex_code", "god"],
    gate_pass_required: [
      "smoke_test",
      "catalog_resolution",
      "user_intent",
    ],
    dry_run_only: true,
    description:
      "User opt-in dry-run: candidate lane is offered only after explicit user intent gate.",
  },
  {
    step_index: 2,
    kind: "internal_only",
    eligible_lane_ids: ["complex_code", "task_fallback"],
    gate_pass_required: [
      "smoke_test",
      "catalog_resolution",
      "user_intent",
      "rollback_baseline_match",
    ],
    dry_run_only: true,
    description:
      "Internal cohort dry-run: rollback baseline match required for deepseek fallback.",
  },
  {
    step_index: 3,
    kind: "release_candidate_preview",
    eligible_lane_ids: ["daily", "light_task", "task_fallback"],
    gate_pass_required: [
      "smoke_test",
      "catalog_resolution",
      "rollback_baseline_match",
    ],
    dry_run_only: true,
    description:
      "Release candidate preview: not general availability; still dry-run only and never writes to config.",
  },
];

export const PROFILE_ROLLOUT_SIMULATION_SNAPSHOT: ProfileRolloutSimulationSnapshot =
  {
    schema_version: PROFILE_ROLLOUT_SCHEMA_VERSION,
    mode: PROFILE_ROLLOUT_MODE,
    status: PROFILE_ROLLOUT_STATUS,
    active_profile: "hermes-balanced-2026-06",
    legacy_baseline: LEGACY_BASELINE,
    current_candidate_profile: CANDIDATE_PROFILE,
    rollout_steps: ROLLOUT_STEPS,
    safety_invariants: {
      live_config_writes_allowed: PROFILE_ROLLOUT_LIVE_CONFIG_WRITES_ALLOWED,
      automatic_runtime_routing_enabled:
        PROFILE_ROLLOUT_AUTOMATIC_ROUTING_ENABLED,
      hcc_auto_executor_allowed: PROFILE_ROLLOUT_HCC_AUTO_EXECUTOR_ALLOWED,
      runtime_router_allowed: PROFILE_ROLLOUT_RUNTIME_ROUTER_ALLOWED,
      rollout_writes_to_config: PROFILE_ROLLOUT_WRITES_TO_CONFIG,
    },
  } as const satisfies ProfileRolloutSimulationSnapshot;

export default {
  PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
  LEGACY_BASELINE,
  CANDIDATE_PROFILE,
  ROLLOUT_STEPS,
} as const;
