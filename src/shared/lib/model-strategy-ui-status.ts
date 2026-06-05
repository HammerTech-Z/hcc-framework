// Hermes Pro model strategy UI disabled status descriptor (MODEL-STRATEGY-002C).
// Pure data projection only: no filesystem, no IPC, no gateway,
// no live config writes, no runtime routing, no UI wiring.

import {
  deriveLaneBlockedReason,
  type ModelStrategyDryRunFixture,
  type ModelStrategyLane,
  type ModelStrategyLaneId,
  type ModelStrategyProvider,
  type ModelStrategyVerificationState,
} from "./model-strategy-dry-run";
import type {
  ProviderCatalogEntry,
  ProviderCatalogFixture,
} from "./provider-catalog-resolver";
import type {
  SmokeTestMatrixEntry,
  SmokeTestMatrixFixture,
} from "./smoke-test-matrix";

export const UI_STATUS_SCHEMA_VERSION = "1.0.0" as const;

export const UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED = false as const;
export const UI_STATUS_AUTOMATIC_ROUTING_ENABLED = false as const;
export const UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const UI_STATUS_RUNTIME_ROUTER_ALLOWED = false as const;
export const UI_STATUS_UI_ENABLEMENT_ALLOWED = false as const;

export const UI_STATUS_REASON_PROVIDER_CATALOG_RESOLUTION_REQUIRED =
  "provider_catalog_resolution_required" as const;

export const UI_STATUS_REASON_LOCAL_FALLBACK_STRUCTURAL_ONLY =
  "local_fallback_structural_only" as const;

export const UI_STATUS_REASON_USER_INTENT_REQUIRED =
  "user_intent_required" as const;

export const UI_STATUS_REASON_SMOKE_TEST_REQUIRED =
  "smoke_test_required" as const;

export const UI_STATUS_REASON_MULTIMODAL_SMOKE_TEST_REQUIRED =
  "multimodal_smoke_test_required" as const;

export const UI_STATUS_REASON_ROLLBACK_GUARD_PRESENT =
  "rollback_guard_present" as const;

export const UI_STATUS_REASON_CATALOG_ENTRY_MISSING =
  "catalog_entry_missing" as const;

export const UI_STATUS_REASON_SMOKE_MATRIX_ENTRY_MISSING =
  "smoke_matrix_entry_missing" as const;

export type UiStatusCatalogStatus =
  | "unresolved"
  | "resolved"
  | "missing";

export type UiStatusSmokeStatus =
  | "not_required"
  | "structural_only"
  | "required"
  | "missing";

export interface ModelStrategyUiStatus {
  schema_version: typeof UI_STATUS_SCHEMA_VERSION;
  lane: ModelStrategyLaneId;
  provider: ModelStrategyProvider;
  label: string;
  candidateModel: string;
  enabled: false;
  disabled: true;
  disabledReason: string;
  verificationState: ModelStrategyVerificationState;
  catalogStatus: UiStatusCatalogStatus;
  smokeStatus: UiStatusSmokeStatus;
  requiresUserIntent: boolean;
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    ui_enablement_allowed: false;
  };
}

export interface ModelStrategyUiStatusesResult {
  schema_version: typeof UI_STATUS_SCHEMA_VERSION;
  statuses: ModelStrategyUiStatus[];
}

export interface ModelStrategyUiValidationIssue {
  code: string;
  lane?: ModelStrategyLaneId;
  message: string;
}

export interface ModelStrategyUiValidationResult {
  ok: boolean;
  issues: ModelStrategyUiValidationIssue[];
}

const UI_STATUS_SAFETY_INVARIANTS = {
  live_config_writes_allowed: UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled: UI_STATUS_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: UI_STATUS_RUNTIME_ROUTER_ALLOWED,
  ui_enablement_allowed: UI_STATUS_UI_ENABLEMENT_ALLOWED,
} as const;

interface CatalogLookup {
  byProviderId: Map<string, ProviderCatalogEntry>;
  byProviderModel: Map<string, ProviderCatalogEntry>;
}

function buildCatalogIndex(
  catalog: ProviderCatalogFixture,
): CatalogLookup {
  const byProviderId = new Map<string, ProviderCatalogEntry>();
  const byProviderModel = new Map<string, ProviderCatalogEntry>();
  for (const entry of catalog.provider_catalog) {
    byProviderId.set(entry.provider_id, entry);
    byProviderModel.set(
      `${entry.provider_id}::${entry.model_id}`,
      entry,
    );
  }
  return { byProviderId, byProviderModel };
}

function findCatalogEntry(
  lane: ModelStrategyLane,
  index: CatalogLookup,
): ProviderCatalogEntry | null {
  const direct = index.byProviderModel.get(
    `${lane.provider}::${lane.candidate_model}`,
  );
  if (direct) return direct;
  const byProvider = index.byProviderId.get(lane.provider);
  if (byProvider && byProvider.model_id === lane.candidate_model) {
    return byProvider;
  }
  return null;
}

function findSmokeEntry(
  lane: ModelStrategyLaneId,
  matrix: SmokeTestMatrixFixture,
): SmokeTestMatrixEntry | null {
  return matrix.matrix.find((entry) => entry.lane === lane) ?? null;
}

function computeCatalogStatus(
  lane: ModelStrategyLane,
  entry: ProviderCatalogEntry | null,
): UiStatusCatalogStatus {
  if (!entry) return "missing";
  if (lane.requires_provider_catalog_resolution === true) {
    if (entry.version === "unresolved-provider-catalog") {
      return "unresolved";
    }
  }
  return "resolved";
}

function computeSmokeStatus(
  lane: ModelStrategyLane,
  matrixEntry: SmokeTestMatrixEntry | null,
): UiStatusSmokeStatus {
  const requiresSmoke =
    lane.requires_smoke_test === true ||
    lane.requires_multimodal_smoke_test === true;
  if (!requiresSmoke) {
    if (lane.lane === "daily_fallback") {
      return "structural_only";
    }
    return "not_required";
  }
  if (!matrixEntry) return "missing";
  if (matrixEntry.check_type === "structural_only") {
    if (lane.lane === "daily_fallback") {
      return "structural_only";
    }
    return "required";
  }
  return "required";
}

function composeDisabledReason(
  lane: ModelStrategyLane,
  matrixEntry: SmokeTestMatrixEntry | null,
  catalogEntry: ProviderCatalogEntry | null,
): string {
  const parts: string[] = [];

  if (lane.requires_provider_catalog_resolution === true) {
    parts.push(UI_STATUS_REASON_PROVIDER_CATALOG_RESOLUTION_REQUIRED);
  }

  if (lane.lane === "daily_fallback") {
    parts.push(UI_STATUS_REASON_LOCAL_FALLBACK_STRUCTURAL_ONLY);
  }

  if (lane.requires_user_intent === true) {
    parts.push(UI_STATUS_REASON_USER_INTENT_REQUIRED);
  }

  if (lane.requires_multimodal_smoke_test === true) {
    parts.push(UI_STATUS_REASON_MULTIMODAL_SMOKE_TEST_REQUIRED);
  } else if (lane.requires_smoke_test === true) {
    parts.push(UI_STATUS_REASON_SMOKE_TEST_REQUIRED);
  }

  if (lane.lane === "task_fallback" && catalogEntry?.rollback_guard === true) {
    parts.push(UI_STATUS_REASON_ROLLBACK_GUARD_PRESENT);
  }

  if (!catalogEntry) {
    parts.push(UI_STATUS_REASON_CATALOG_ENTRY_MISSING);
  }

  if (
    (lane.requires_smoke_test === true ||
      lane.requires_multimodal_smoke_test === true) &&
    !matrixEntry
  ) {
    parts.push(UI_STATUS_REASON_SMOKE_MATRIX_ENTRY_MISSING);
  }

  const blocked = deriveLaneBlockedReason(lane);
  if (blocked && !parts.includes(blocked)) {
    parts.push(blocked);
  }

  return parts.join("|");
}

export function buildModelStrategyDisabledStatuses(
  strategyFixture: ModelStrategyDryRunFixture,
  providerCatalog: ProviderCatalogFixture,
  smokeMatrix: SmokeTestMatrixFixture,
): ModelStrategyUiStatusesResult {
  const index = buildCatalogIndex(providerCatalog);
  const statuses: ModelStrategyUiStatus[] = strategyFixture.lanes.map(
    (lane) => {
      const catalogEntry = findCatalogEntry(lane, index);
      const matrixEntry = findSmokeEntry(lane.lane, smokeMatrix);
      const disabledReason = composeDisabledReason(
        lane,
        matrixEntry,
        catalogEntry,
      );
      return {
        schema_version: UI_STATUS_SCHEMA_VERSION,
        lane: lane.lane,
        provider: lane.provider,
        label: lane.lane_provider_label ?? lane.provider,
        candidateModel: lane.candidate_model,
        enabled: false as const,
        disabled: true as const,
        disabledReason,
        verificationState: lane.verification_state,
        catalogStatus: computeCatalogStatus(lane, catalogEntry),
        smokeStatus: computeSmokeStatus(lane, matrixEntry),
        requiresUserIntent: lane.requires_user_intent === true,
        safety_invariants: { ...UI_STATUS_SAFETY_INVARIANTS },
      };
    },
  );
  return { schema_version: UI_STATUS_SCHEMA_VERSION, statuses };
}

export function validateModelStrategyDisabledStatuses(
  result: ModelStrategyUiStatusesResult,
): ModelStrategyUiValidationResult {
  const issues: ModelStrategyUiValidationIssue[] = [];
  const seenLanes = new Set<ModelStrategyLaneId>();

  for (const status of result.statuses) {
    if (seenLanes.has(status.lane)) {
      issues.push({
        code: "duplicate_lane_status",
        lane: status.lane,
        message: `Duplicate UI status for lane ${status.lane}.`,
      });
    }
    seenLanes.add(status.lane);

    if (status.enabled !== false) {
      issues.push({
        code: "ui_status_enabled_unexpectedly",
        lane: status.lane,
        message: `UI status for ${status.lane} must be enabled=false.`,
      });
    }
    if (status.disabled !== true) {
      issues.push({
        code: "ui_status_disabled_flag_unexpectedly",
        lane: status.lane,
        message: `UI status for ${status.lane} must be disabled=true.`,
      });
    }
    if (
      status.safety_invariants.live_config_writes_allowed !== false ||
      status.safety_invariants.automatic_runtime_routing_enabled !== false ||
      status.safety_invariants.hcc_auto_executor_allowed !== false ||
      status.safety_invariants.runtime_router_allowed !== false ||
      status.safety_invariants.ui_enablement_allowed !== false
    ) {
      issues.push({
        code: "ui_status_safety_invariant_breach",
        lane: status.lane,
        message: `UI status for ${status.lane} must keep all safety literals false.`,
      });
    }
    if (status.disabledReason.trim().length === 0) {
      issues.push({
        code: "ui_status_disabled_reason_missing",
        lane: status.lane,
        message: `UI status for ${status.lane} must declare a disabledReason.`,
      });
    }
  }

  const requiredLanes: ModelStrategyLaneId[] = [
    "daily",
    "daily_fallback",
    "light_task",
    "complex_code",
    "task_fallback",
    "god",
  ];
  for (const laneId of requiredLanes) {
    if (!seenLanes.has(laneId)) {
      issues.push({
        code: "ui_status_lane_missing",
        lane: laneId,
        message: `UI status missing for lane ${laneId}.`,
      });
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertUiStatusNoRuntimeAccess(
  result: ModelStrategyUiStatusesResult,
): void {
  const validation = validateModelStrategyDisabledStatuses(result);
  const liveCodes = [
    "ui_status_enabled_unexpectedly",
    "ui_status_disabled_flag_unexpectedly",
    "ui_status_safety_invariant_breach",
  ];
  const matched = validation.issues.filter((issue) =>
    liveCodes.includes(issue.code),
  );
  if (matched.length > 0) {
    throw new Error(matched.map((issue) => issue.code).join(","));
  }
}

export const UI_STATUS_SAFETY_LITERALS = {
  schema_version: UI_STATUS_SCHEMA_VERSION,
  live_config_writes_allowed: UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled: UI_STATUS_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: UI_STATUS_RUNTIME_ROUTER_ALLOWED,
  ui_enablement_allowed: UI_STATUS_UI_ENABLEMENT_ALLOWED,
} as const;
