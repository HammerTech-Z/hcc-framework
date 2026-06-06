// Hermes Pro profile rollout simulation helper (MODEL-STRATEGY-004A).
// Pure functions only. No filesystem, no IPC, no runtime, no config writes,
// no network probes. Returns descriptive projections.

import type {
  ModelStrategyLane,
  ModelStrategyLaneId,
  ModelStrategyRollbackBaseline,
} from "./model-strategy-dry-run";
import type { ProviderCatalogFixture } from "./provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "./smoke-test-matrix";
import {
  PROFILE_ROLLOUT_AUTOMATIC_ROUTING_ENABLED,
  PROFILE_ROLLOUT_HCC_AUTO_EXECUTOR_ALLOWED,
  PROFILE_ROLLOUT_LIVE_CONFIG_WRITES_ALLOWED,
  PROFILE_ROLLOUT_MODE,
  PROFILE_ROLLOUT_RUNTIME_ROUTER_ALLOWED,
  PROFILE_ROLLOUT_SCHEMA_VERSION,
  PROFILE_ROLLOUT_STATUS,
  PROFILE_ROLLOUT_WRITES_TO_CONFIG,
  type ProfileRolloutGateKind,
  type ProfileRolloutSimulationSnapshot,
  type ProfileRolloutStep,
} from "./profile-rollout-snapshot";

export interface ProfileRolloutDelta {
  lane: ModelStrategyLaneId;
  baseline_model: string | null;
  candidate_model: string;
  baseline_alias: string | null;
  candidate_alias: string | null;
  is_legacy_alias_drift: boolean;
  is_primary_baseline: boolean;
}

export interface ProfileRolloutGateEvaluation {
  gate: ProfileRolloutGateKind;
  passed: boolean;
  reason: string | null;
}

export interface ProfileRolloutLaneEvaluation {
  lane: ModelStrategyLaneId;
  candidate_model: string;
  eligible_in_step: boolean;
  /** Always false in dry-run. 002/003 边界：unverified candidate 不允许 gatesPassed 语义。 */
  gates_satisfied: false;
  /** 描述 dry-run 未真实评估 gate 行为。 */
  gates_evaluated: false;
  /** gate 评估状态之一：dry_run_not_evaluated / shadow / blocked / etc. */
  gate_status: ProfileRolloutGateStatus;
  /** candidate 实际要求的 gate 列表（含 step 必過 + candidate 自身要求）。 */
  required_gates: ProfileRolloutGateKind[];
  /** 因 candidate unverified / shadow 模式而需后续真实评估的 gate。 */
  pending_gates: ProfileRolloutGateKind[];
  blocked_reasons: string[];
  gate_evaluations: ProfileRolloutGateEvaluation[];
}

export type ProfileRolloutGateStatus =
  | "dry_run_not_evaluated"
  | "shadow_projection"
  | "user_intent_required"
  | "rollback_baseline_required"
  | "smoke_test_pending"
  | "catalog_pending"
  | "blocked";

export interface ProfileRolloutStepResult {
  dry_run_only: true;
  no_runtime_activation: true;
  no_live_routing: true;
  step_index: 0 | 1 | 2 | 3;
  step_kind: ProfileRolloutStep["kind"];
  /** 仅作"dry-run 投影"，不表示 lane 已真实生效。 */
  projected_models: ModelStrategyLaneId[];
  blocked_lanes: ModelStrategyLaneId[];
  /** 全 snapshot 候选 lane 在此 step 的 gate 状态分布。 */
  gate_evaluations: ProfileRolloutGateEvaluation[];
  lane_evaluations: ProfileRolloutLaneEvaluation[];
}

export interface ProfileRolloutValidationIssue {
  code: string;
  lane?: ModelStrategyLaneId;
  message: string;
}

export interface ProfileRolloutValidationResult {
  ok: boolean;
  issues: ProfileRolloutValidationIssue[];
}

interface CatalogLookup {
  byProviderModel: Map<string, true>;
  byProviderId: Map<string, true>;
  byLegacyAlias: Map<string, true>;
  rollbackGuardByProvider: Map<string, boolean>;
}

function buildCatalogIndex(catalog: ProviderCatalogFixture): CatalogLookup {
  const byProviderModel = new Map<string, true>();
  const byProviderId = new Map<string, true>();
  const byLegacyAlias = new Map<string, true>();
  const rollbackGuardByProvider = new Map<string, boolean>();
  for (const entry of catalog.provider_catalog) {
    byProviderModel.set(`${entry.provider_id}::${entry.model_id}`, true);
    byProviderId.set(entry.provider_id, true);
    if (entry.legacy_aliases) {
      for (const alias of entry.legacy_aliases) {
        byLegacyAlias.set(alias, true);
      }
    }
    rollbackGuardByProvider.set(
      entry.provider_id,
      entry.rollback_guard === true,
    );
  }
  return { byProviderModel, byProviderId, byLegacyAlias, rollbackGuardByProvider };
}

interface SmokeLookup {
  byLane: Map<ModelStrategyLaneId, true>;
}

function buildSmokeIndex(smoke: SmokeTestMatrixFixture): SmokeLookup {
  const byLane = new Map<ModelStrategyLaneId, true>();
  for (const entry of smoke.matrix) {
    byLane.set(entry.lane, true);
  }
  return { byLane };
}

function baselineModelForLane(
  lane: ModelStrategyLaneId,
  baseline: ModelStrategyRollbackBaseline,
): string | null {
  if (lane === "daily" || lane === "light_task") {
    return baseline.daily_model;
  }
  if (lane === "task_fallback") {
    return baseline.task_fallback_model;
  }
  return null;
}

function baselineAliasForLane(
  lane: ModelStrategyLaneId,
  baseline: ModelStrategyRollbackBaseline,
): string | null {
  if (lane === "task_fallback") {
    return baseline.task_fallback_model;
  }
  return null;
}

export function compareProfiles(
  legacyBaseline: ModelStrategyRollbackBaseline,
  candidateProfile: { lanes: ModelStrategyLane[] },
): ProfileRolloutDelta[] {
  return candidateProfile.lanes.map((lane) => {
    const baselineModel = baselineModelForLane(lane.lane, legacyBaseline);
    const baselineAlias = baselineAliasForLane(lane.lane, legacyBaseline);
    const isLegacyAliasDrift =
      baselineAlias !== null && baselineAlias === lane.candidate_model;
    const isPrimaryBaseline =
      baselineModel !== null && baselineModel === lane.candidate_model;
    return {
      lane: lane.lane,
      baseline_model: baselineModel,
      candidate_model: lane.candidate_model,
      baseline_alias: baselineAlias,
      candidate_alias: lane.candidate_model,
      is_legacy_alias_drift: isLegacyAliasDrift,
      is_primary_baseline: isPrimaryBaseline,
    };
  });
}

function evaluateGate(
  gate: ProfileRolloutGateKind,
  lane: ModelStrategyLane,
  catalogIndex: CatalogLookup,
  smokeIndex: SmokeLookup,
): ProfileRolloutGateEvaluation {
  switch (gate) {
    case "catalog_resolution": {
      const direct = catalogIndex.byProviderModel.has(
        `${lane.provider}::${lane.candidate_model}`,
      );
      const legacy = catalogIndex.byLegacyAlias.has(lane.candidate_model);
      const byProvider = catalogIndex.byProviderId.has(lane.provider);
      const passed = direct || (byProvider && !legacy) || false;
      return {
        gate,
        passed,
        reason: passed ? null : "catalog_resolution_required",
      };
    }
    case "smoke_test": {
      const inMatrix = smokeIndex.byLane.has(lane.lane);
      const requires =
        lane.requires_smoke_test === true ||
        lane.requires_multimodal_smoke_test === true;
      const passed = inMatrix && requires;
      return {
        gate,
        passed,
        reason: passed
          ? null
          : inMatrix
            ? "smoke_not_required_for_lane"
            : "smoke_matrix_entry_missing",
      };
    }
    case "user_intent": {
      const passed = lane.requires_user_intent === true;
      return {
        gate,
        passed,
        reason: passed ? null : "user_intent_gate_missing",
      };
    }
    case "rollback_baseline_match": {
      const guard = catalogIndex.rollbackGuardByProvider.get(lane.provider);
      const passed = guard === true;
      return {
        gate,
        passed,
        reason: passed ? null : "rollback_guard_missing",
      };
    }
  }
}

function evaluateLane(
  lane: ModelStrategyLane,
  step: ProfileRolloutStep,
  catalogIndex: CatalogLookup,
  smokeIndex: SmokeLookup,
): ProfileRolloutLaneEvaluation {
  const eligible = step.eligible_lane_ids.includes(lane.lane);
  const evaluations = step.gate_pass_required.map((gate) =>
    evaluateGate(gate, lane, catalogIndex, smokeIndex),
  );

  const requiredGates = step.gate_pass_required.slice();
  const pendingGates: ProfileRolloutGateKind[] = [];

  if (lane.verification_state !== "verified") {
    pendingGates.push(...requiredGates);
  }
  for (const g of requiredGates) {
    if (!pendingGates.includes(g)) pendingGates.push(g);
  }

  const blockedReasons: string[] = [];
  if (!eligible) {
    blockedReasons.push("lane_not_eligible_in_step");
  }
  if (lane.verification_state === "verified") {
    blockedReasons.push("candidate_lane_already_verified");
  }
  if (lane.verification_state === "blocked") {
    blockedReasons.push("candidate_lane_blocked");
  }
  if (lane.verification_state === "unavailable") {
    blockedReasons.push("candidate_lane_unavailable");
  }
  if (lane.verification_state === "unverified") {
    blockedReasons.push("candidate_lane_unverified_dry_run");
  }
  for (const ev of evaluations) {
    if (!ev.passed) blockedReasons.push(ev.gate);
  }

  let gateStatus: ProfileRolloutGateStatus = "dry_run_not_evaluated";
  if (lane.verification_state === "verified") {
    gateStatus = "blocked";
  } else if (!eligible) {
    gateStatus = "blocked";
  } else if (step.kind === "shadow_observation") {
    gateStatus = "shadow_projection";
  } else if (step.gate_pass_required.includes("rollback_baseline_match")) {
    gateStatus = "rollback_baseline_required";
  } else if (step.gate_pass_required.includes("user_intent")) {
    gateStatus = "user_intent_required";
  } else if (step.gate_pass_required.includes("smoke_test")) {
    gateStatus = "smoke_test_pending";
  } else if (step.gate_pass_required.includes("catalog_resolution")) {
    gateStatus = "catalog_pending";
  }

  return {
    lane: lane.lane,
    candidate_model: lane.candidate_model,
    eligible_in_step: eligible,
    gates_satisfied: false,
    gates_evaluated: false,
    gate_status: gateStatus,
    required_gates: requiredGates,
    pending_gates: pendingGates,
    blocked_reasons: blockedReasons,
    gate_evaluations: evaluations,
  };
}

export function simulateRolloutStep(
  snapshot: ProfileRolloutSimulationSnapshot,
  stepIndex: 0 | 1 | 2 | 3,
  smokeMatrix: SmokeTestMatrixFixture,
  providerCatalog: ProviderCatalogFixture,
): ProfileRolloutStepResult {
  const step = snapshot.rollout_steps.find((s) => s.step_index === stepIndex);
  if (!step) {
    throw new Error(`profile_rollout_step_not_found:${stepIndex}`);
  }
  const catalogIndex = buildCatalogIndex(providerCatalog);
  const smokeIndex = buildSmokeIndex(smokeMatrix);

  const laneEvaluations = snapshot.current_candidate_profile.lanes.map((lane) =>
    evaluateLane(lane, step, catalogIndex, smokeIndex),
  );

  const allGateEvaluations = laneEvaluations.flatMap((e) => e.gate_evaluations);
  const projectedModels = laneEvaluations
    .filter((e) => e.eligible_in_step)
    .map((e) => e.lane);
  const blockedLanes = laneEvaluations
    .filter((e) => !e.eligible_in_step)
    .map((e) => e.lane);

  return {
    dry_run_only: true,
    no_runtime_activation: true,
    no_live_routing: true,
    step_index: stepIndex,
    step_kind: step.kind,
    projected_models: projectedModels,
    blocked_lanes: blockedLanes,
    gate_evaluations: allGateEvaluations,
    lane_evaluations: laneEvaluations,
  };
}

export function validateProfileRolloutSimulation(
  snapshot: ProfileRolloutSimulationSnapshot,
): ProfileRolloutValidationResult {
  const issues: ProfileRolloutValidationIssue[] = [];

  if (snapshot.schema_version !== "1.0.0") {
    issues.push({
      code: "schema_version_mismatch",
      message: "Profile rollout simulation schema must be 1.0.0.",
    });
  }
  if (snapshot.mode !== "dry_run_simulation") {
    issues.push({
      code: "mode_not_dry_run_simulation",
      message: "Profile rollout simulation must stay in dry_run_simulation mode.",
    });
  }

  const si = snapshot.safety_invariants;
  if (si.live_config_writes_allowed !== false) {
    issues.push({
      code: "live_config_writes_allowed",
      message: "Profile rollout must not allow live config writes.",
    });
  }
  if (si.automatic_runtime_routing_enabled !== false) {
    issues.push({
      code: "automatic_runtime_routing_enabled",
      message: "Profile rollout must not enable automatic runtime routing.",
    });
  }
  if (si.hcc_auto_executor_allowed !== false) {
    issues.push({
      code: "hcc_auto_executor_allowed",
      message: "Profile rollout must not enable HCC Auto Executor.",
    });
  }
  if (si.runtime_router_allowed !== false) {
    issues.push({
      code: "runtime_router_allowed",
      message: "Profile rollout must not expose a runtime router.",
    });
  }
  if (si.rollout_writes_to_config !== false) {
    issues.push({
      code: "rollout_writes_to_config",
      message: "Profile rollout must not write to config.",
    });
  }

  for (const lane of snapshot.current_candidate_profile.lanes) {
    if (lane.verification_state === "verified") {
      issues.push({
        code: lane.candidate_model === "MiniMax 3.0"
          ? "minimax_candidate_must_be_unverified"
          : lane.candidate_model === "gpt-5.5"
            ? "gpt_5_5_candidate_must_be_unverified"
            : "candidate_lane_must_be_unverified",
        lane: lane.lane,
        message: `${lane.candidate_model} lane must not be marked verified.`,
      });
    }
  }

  for (const step of snapshot.rollout_steps) {
    if (step.dry_run_only !== true) {
      issues.push({
        code: "rollout_step_dry_run_only_false",
        message: `Step ${step.step_index} must declare dry_run_only: true.`,
      });
    }
  }

  if (snapshot.rollout_steps.length !== 4) {
    issues.push({
      code: "rollout_steps_count_mismatch",
      message: "Profile rollout must define exactly 4 steps.",
    });
  }

  return { ok: issues.length === 0, issues };
}

export function assertProfileRolloutNoRuntimeAccess(
  snapshot: ProfileRolloutSimulationSnapshot,
): void {
  const result = validateProfileRolloutSimulation(snapshot);
  const runtimeCodes = [
    "live_config_writes_allowed",
    "automatic_runtime_routing_enabled",
    "hcc_auto_executor_allowed",
    "runtime_router_allowed",
    "rollout_writes_to_config",
  ];
  const matched = result.issues.filter((issue) => runtimeCodes.includes(issue.code));
  if (matched.length > 0) {
    throw new Error(matched.map((issue) => issue.code).join(","));
  }
}

export const PROFILE_ROLLOUT_SAFETY_LITERALS = {
  schema_version: PROFILE_ROLLOUT_SCHEMA_VERSION,
  mode: PROFILE_ROLLOUT_MODE,
  status: PROFILE_ROLLOUT_STATUS,
  live_config_writes_allowed: PROFILE_ROLLOUT_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled: PROFILE_ROLLOUT_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: PROFILE_ROLLOUT_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: PROFILE_ROLLOUT_RUNTIME_ROUTER_ALLOWED,
  rollout_writes_to_config: PROFILE_ROLLOUT_WRITES_TO_CONFIG,
} as const;
