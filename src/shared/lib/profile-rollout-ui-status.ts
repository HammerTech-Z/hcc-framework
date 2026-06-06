// Hermes Pro profile rollout UI status projection (MODEL-STRATEGY-004C).
// Pure data projection only. No filesystem, no IPC, no runtime routing.
// All inputs are read-only and never mutated. No UI wiring.

import {
  type ProfileRolloutGateKind,
  type ProfileRolloutSimulationSnapshot,
  type ProfileRolloutStepKind,
} from "./profile-rollout-snapshot";
import { simulateRolloutStep } from "./profile-rollout-simulation";
import type {
  ProfileRollbackPreview,
  ProfileRollbackPreviewLane,
} from "./profile-rollout-rollback-preview";
import type { ProviderCatalogFixture } from "./provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "./smoke-test-matrix";
import type {
  ModelStrategyLaneId,
  ModelStrategyProvider,
  ModelStrategyVerificationState,
} from "./model-strategy-dry-run";

export const PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION = "1.0.0" as const;

export const PROFILE_ROLLOUT_UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED = false as const;
export const PROFILE_ROLLOUT_UI_STATUS_AUTOMATIC_ROUTING_ENABLED = false as const;
export const PROFILE_ROLLOUT_UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const PROFILE_ROLLOUT_UI_STATUS_RUNTIME_ROUTER_ALLOWED = false as const;
export const PROFILE_ROLLOUT_UI_STATUS_ROLLOUT_WRITES_TO_CONFIG = false as const;

export const PROFILE_ROLLOUT_UI_STATUS_SOURCE_SNAPSHOT_ID =
  "model-strategy-dry-run-2026-06-05" as const;

export type ProfileRolloutStepToken =
  | "rollout_step_shadow"
  | "rollout_step_user_opt_in"
  | "rollout_step_internal_only"
  | "rollout_step_release_candidate_preview";

export interface ProfileRolloutUiStatus {
  schema_version: typeof PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION;
  lane: ModelStrategyLaneId;
  provider: ModelStrategyProvider;
  candidateModel: string;
  enabled: false;
  disabled: true;
  verificationState: ModelStrategyVerificationState;
  disabledReason: string;
  stepKind: ProfileRolloutStepKind | null;
  stepIndex: 0 | 1 | 2 | 3 | null;
  protectedLane: boolean;
  rollbackAvailable: boolean;
  preserveCandidate: boolean;
  noLegacyBaseline: boolean;
  pendingGates: ProfileRolloutGateKind[];
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    rollout_writes_to_config: false;
  };
}

export interface ProfileRolloutUiStatusesResult {
  schema_version: typeof PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION;
  source_snapshot_id: typeof PROFILE_ROLLOUT_UI_STATUS_SOURCE_SNAPSHOT_ID;
  step_index: 0 | 1 | 2 | 3;
  step_kind: ProfileRolloutStepKind;
  statuses: ProfileRolloutUiStatus[];
}

const STEP_TOKEN_BY_KIND: Readonly<
  Record<ProfileRolloutStepKind, ProfileRolloutStepToken>
> = {
  shadow_observation: "rollout_step_shadow",
  user_opt_in: "rollout_step_user_opt_in",
  internal_only: "rollout_step_internal_only",
  release_candidate_preview: "rollout_step_release_candidate_preview",
};

const CANDIDATE_TOKENS_BY_LANE: Readonly<
  Record<ModelStrategyLaneId, string[]>
> = {
  daily: ["provider_catalog_resolution_required", "smoke_test_required"],
  daily_fallback: ["local_fallback_structural_only"],
  light_task: ["provider_catalog_resolution_required", "smoke_test_required"],
  complex_code: [
    "provider_catalog_resolution_required",
    "user_intent_required",
    "smoke_test_required",
  ],
  task_fallback: ["rollback_guard_present", "smoke_test_required"],
  god: [
    "provider_catalog_resolution_required",
    "user_intent_required",
    "smoke_test_required",
  ],
};

const SAFETY_INVARIANTS = {
  live_config_writes_allowed:
    PROFILE_ROLLOUT_UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled:
    PROFILE_ROLLOUT_UI_STATUS_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: PROFILE_ROLLOUT_UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: PROFILE_ROLLOUT_UI_STATUS_RUNTIME_ROUTER_ALLOWED,
  rollout_writes_to_config: PROFILE_ROLLOUT_UI_STATUS_ROLLOUT_WRITES_TO_CONFIG,
} as const;

function fallbackFlagsForLane(
  lane: ModelStrategyLaneId,
): { protectedLane: boolean; rollbackAvailable: boolean; preserveCandidate: boolean; noLegacyBaseline: boolean } {
  const protectedLane = lane === "task_fallback";
  const rollbackAvailable = lane === "daily" || lane === "light_task";
  const preserveCandidate =
    lane === "daily_fallback" ||
    lane === "complex_code" ||
    lane === "god" ||
    lane === "task_fallback";
  const noLegacyBaseline =
    lane === "daily_fallback" || lane === "complex_code" || lane === "god";
  return { protectedLane, rollbackAvailable, preserveCandidate, noLegacyBaseline };
}

function flagsFromPreview(
  previewLane: ProfileRollbackPreviewLane,
): { protectedLane: boolean; rollbackAvailable: boolean; preserveCandidate: boolean; noLegacyBaseline: boolean } {
  const fallback = fallbackFlagsForLane(previewLane.lane);
  return {
    protectedLane: previewLane.protected_lane,
    rollbackAvailable: previewLane.requires_rollback,
    preserveCandidate: previewLane.preserve_candidate,
    noLegacyBaseline: fallback.noLegacyBaseline,
  };
}

function composeDisabledReason(
  stepToken: ProfileRolloutStepToken,
  lane: ModelStrategyLaneId,
  pendingGates: ProfileRolloutGateKind[],
): string {
  const tokens: string[] = [stepToken];
  const candidateTokens = CANDIDATE_TOKENS_BY_LANE[lane];
  for (const t of candidateTokens) {
    if (!tokens.includes(t)) tokens.push(t);
  }
  for (const g of pendingGates) {
    const token = `gate_${g}`;
    if (!tokens.includes(token)) tokens.push(token);
  }
  return tokens.join("|");
}

export function buildProfileRolloutUiStatus(
  snapshot: ProfileRolloutSimulationSnapshot,
  stepIndex: 0 | 1 | 2 | 3,
  smokeMatrix: SmokeTestMatrixFixture,
  providerCatalog: ProviderCatalogFixture,
  rollbackPreview?: ProfileRollbackPreview,
): ProfileRolloutUiStatusesResult {
  const step = snapshot.rollout_steps.find((s) => s.step_index === stepIndex);
  if (!step) {
    throw new Error(`profile_rollout_ui_status_step_not_found:${stepIndex}`);
  }

  const stepResult = simulateRolloutStep(
    snapshot,
    stepIndex,
    smokeMatrix,
    providerCatalog,
  );

  const stepToken = STEP_TOKEN_BY_KIND[step.kind];

  const statuses: ProfileRolloutUiStatus[] = snapshot.current_candidate_profile.lanes.map(
    (lane) => {
      const evalResult = stepResult.lane_evaluations.find(
        (e) => e.lane === lane.lane,
      )!;
      const pendingGates = evalResult.pending_gates;

      const previewLane = rollbackPreview?.lane_previews.find(
        (p) => p.lane === lane.lane,
      );
      const flags = previewLane
        ? flagsFromPreview(previewLane)
        : fallbackFlagsForLane(lane.lane);

      return {
        schema_version: PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION,
        lane: lane.lane,
        provider: lane.provider,
        candidateModel: lane.candidate_model,
        enabled: false as const,
        disabled: true as const,
        verificationState: lane.verification_state,
        disabledReason: composeDisabledReason(
          stepToken,
          lane.lane,
          pendingGates,
        ),
        stepKind: step.kind,
        stepIndex,
        protectedLane: flags.protectedLane,
        rollbackAvailable: flags.rollbackAvailable,
        preserveCandidate: flags.preserveCandidate,
        noLegacyBaseline: flags.noLegacyBaseline,
        pendingGates,
        safety_invariants: { ...SAFETY_INVARIANTS },
      };
    },
  );

  return {
    schema_version: PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION,
    source_snapshot_id: PROFILE_ROLLOUT_UI_STATUS_SOURCE_SNAPSHOT_ID,
    step_index: stepIndex,
    step_kind: step.kind,
    statuses,
  };
}

export const PROFILE_ROLLOUT_UI_STATUS_SAFETY_LITERALS = {
  schema_version: PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION,
  source_snapshot_id: PROFILE_ROLLOUT_UI_STATUS_SOURCE_SNAPSHOT_ID,
  live_config_writes_allowed: PROFILE_ROLLOUT_UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled:
    PROFILE_ROLLOUT_UI_STATUS_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: PROFILE_ROLLOUT_UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: PROFILE_ROLLOUT_UI_STATUS_RUNTIME_ROUTER_ALLOWED,
  rollout_writes_to_config: PROFILE_ROLLOUT_UI_STATUS_ROLLOUT_WRITES_TO_CONFIG,
} as const;
