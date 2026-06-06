// Hermes Pro Hermes-native model-nexus design descriptor (MODEL-STRATEGY-005B).
// Pure design descriptor: produces pattern summaries + lane-level mappings.
// No EchoBird code, UI composition, install scripts, or runtime behavior
// is copied. 006 Live config adapter remains future and requires explicit
// approval. No apply / commit / flush / activate / route method surface.

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyLane,
  ModelStrategyLaneId,
  ModelStrategyProvider,
  ModelStrategyVerificationState,
} from "./model-strategy-dry-run";
import type { ProviderCatalogFixture } from "./provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "./smoke-test-matrix";
import {
  ECHOBIRD_TAXONOMY_DESIGN_NOTE,
  ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
  type EchobirdPatternId,
  type EchobirdPatternTaxonomySnapshot,
} from "./echobird-pattern-taxonomy";

export const HERMES_MODEL_NEXUS_DESIGN_SCHEMA_VERSION = "1.0.0" as const;
export const HERMES_MODEL_NEXUS_DESIGN_MODE = "design_descriptor_only" as const;

export const HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE =
  "006_live_config_adapter_remains_future_requires_explicit_approval" as const;

export type HermesModelNexusFieldKind =
  | "lane_summary"
  | "local_fallback_structural_check"
  | "install_recovery_diagnostics"
  | "cockpit_product_inventory";

const PATTERN_TO_HERMES_FIELD: Readonly<
  Record<EchobirdPatternId, HermesModelNexusFieldKind>
> = {
  model_nexus: "lane_summary",
  local_fallback: "local_fallback_structural_check",
  install_repair: "install_recovery_diagnostics",
  project_management: "cockpit_product_inventory",
};

const PATTERN_TO_LANE_IDS: Readonly<
  Record<EchobirdPatternId, ModelStrategyLaneId[]>
> = {
  model_nexus: [
    "daily",
    "daily_fallback",
    "light_task",
    "complex_code",
    "task_fallback",
    "god",
  ],
  local_fallback: ["daily_fallback"],
  install_repair: [],
  project_management: [],
};

export interface HermesModelNexusPatternSummary {
  pattern_id: EchobirdPatternId;
  hermes_native_field: HermesModelNexusFieldKind;
  applicable_lane_ids: ModelStrategyLaneId[];
  design_only: true;
  no_code_copy: true;
  no_ui_composition_copy: true;
  no_install_script_copy: true;
  no_runtime_behavior_copy: true;
  allow_reuse_as_design_only: true;
  requires_explicit_user_approval_for_live_writes: true;
  future_live_adapter_state: typeof HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE;
  source_pattern_taxonomy_id: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
}

export interface HermesModelNexusLaneMapping {
  mapping_id: string;
  pattern_id: EchobirdPatternId;
  lane_id: ModelStrategyLaneId;
  candidate_model: string;
  provider: ModelStrategyProvider;
  hermes_native_field: HermesModelNexusFieldKind;
  in_provider_catalog: boolean;
  in_smoke_matrix: boolean;
  design_only: true;
  no_code_copy: true;
  no_ui_composition_copy: true;
  no_install_script_copy: true;
  no_runtime_behavior_copy: true;
  allow_reuse_as_design_only: true;
  requires_explicit_user_approval_for_live_writes: true;
  future_live_adapter_state: typeof HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE;
  source_pattern_taxonomy_id: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
}

export interface HermesModelNexusDesignResult {
  schema_version: typeof HERMES_MODEL_NEXUS_DESIGN_SCHEMA_VERSION;
  mode: typeof HERMES_MODEL_NEXUS_DESIGN_MODE;
  reference_only: true;
  source_pattern_taxonomy_id: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
  design_note: typeof ECHOBIRD_TAXONOMY_DESIGN_NOTE;
  pattern_count: 4;
  lane_mapping_count: 7;
  descriptor_item_count: 11;
  future_live_adapter_state: typeof HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE;
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    runtime_replication_allowed: false;
    install_script_execution_allowed: false;
    code_copy_allowed: false;
    ui_composition_copy_allowed: false;
  };
  pattern_summaries: HermesModelNexusPatternSummary[];
  lane_mappings: HermesModelNexusLaneMapping[];
}

interface CatalogLookup {
  byProviderModel: Map<string, true>;
  byLegacyAlias: Map<string, true>;
}

function buildCatalogIndex(catalog: ProviderCatalogFixture): CatalogLookup {
  const byProviderModel = new Map<string, true>();
  const byLegacyAlias = new Map<string, true>();
  for (const entry of catalog.provider_catalog) {
    byProviderModel.set(`${entry.provider_id}::${entry.model_id}`, true);
    if (entry.legacy_aliases) {
      for (const alias of entry.legacy_aliases) byLegacyAlias.set(alias, true);
    }
  }
  return { byProviderModel, byLegacyAlias };
}

interface SmokeLookup {
  byLane: Map<ModelStrategyLaneId, true>;
}

function buildSmokeIndex(smoke: SmokeTestMatrixFixture): SmokeLookup {
  const byLane = new Map<ModelStrategyLaneId, true>();
  for (const entry of smoke.matrix) byLane.set(entry.lane, true);
  return { byLane };
}

function resolveInProviderCatalog(
  lane: ModelStrategyLane,
  index: CatalogLookup,
): boolean {
  if (index.byProviderModel.has(`${lane.provider}::${lane.candidate_model}`)) {
    return true;
  }
  if (index.byLegacyAlias.has(lane.candidate_model)) return true;
  return false;
}

function resolveInSmokeMatrix(
  laneId: ModelStrategyLaneId,
  index: SmokeLookup,
): boolean {
  return index.byLane.has(laneId);
}

function buildPatternSummary(
  pattern_id: EchobirdPatternId,
  source: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
  applicable_lane_ids: ModelStrategyLaneId[],
): HermesModelNexusPatternSummary {
  return {
    pattern_id,
    hermes_native_field: PATTERN_TO_HERMES_FIELD[pattern_id],
    applicable_lane_ids,
    design_only: true,
    no_code_copy: true,
    no_ui_composition_copy: true,
    no_install_script_copy: true,
    no_runtime_behavior_copy: true,
    allow_reuse_as_design_only: true,
    requires_explicit_user_approval_for_live_writes: true,
    future_live_adapter_state: HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE,
    source_pattern_taxonomy_id: source,
  };
}

function buildLaneMapping(
  pattern_id: EchobirdPatternId,
  lane: ModelStrategyLane,
  catalogIndex: CatalogLookup,
  smokeIndex: SmokeLookup,
  source: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
): HermesModelNexusLaneMapping {
  return {
    mapping_id: `${pattern_id}__${lane.lane}`,
    pattern_id,
    lane_id: lane.lane,
    candidate_model: lane.candidate_model,
    provider: lane.provider,
    hermes_native_field: PATTERN_TO_HERMES_FIELD[pattern_id],
    in_provider_catalog: resolveInProviderCatalog(lane, catalogIndex),
    in_smoke_matrix: resolveInSmokeMatrix(lane.lane, smokeIndex),
    design_only: true,
    no_code_copy: true,
    no_ui_composition_copy: true,
    no_install_script_copy: true,
    no_runtime_behavior_copy: true,
    allow_reuse_as_design_only: true,
    requires_explicit_user_approval_for_live_writes: true,
    future_live_adapter_state: HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE,
    source_pattern_taxonomy_id: source,
  };
}

export function buildHermesModelNexusDesign(
  taxonomy: EchobirdPatternTaxonomySnapshot,
  strategySnapshot: ModelStrategyDryRunFixture,
  providerCatalog: ProviderCatalogFixture,
  smokeMatrix: SmokeTestMatrixFixture,
): HermesModelNexusDesignResult {
  const source = taxonomy.source_reference_url;
  const catalogIndex = buildCatalogIndex(providerCatalog);
  const smokeIndex = buildSmokeIndex(smokeMatrix);

  const pattern_summaries: HermesModelNexusPatternSummary[] = taxonomy.patterns.map(
    (p) => buildPatternSummary(p.pattern_id, source, [...p.applicable_lane_ids]),
  );

  const lane_mappings: HermesModelNexusLaneMapping[] = [];
  for (const pattern of taxonomy.patterns) {
    const allowedLanes = PATTERN_TO_LANE_IDS[pattern.pattern_id];
    if (allowedLanes.length === 0) continue;
    for (const laneId of allowedLanes) {
      const lane = strategySnapshot.lanes.find((l) => l.lane === laneId);
      if (!lane) continue;
      lane_mappings.push(
        buildLaneMapping(
          pattern.pattern_id,
          lane,
          catalogIndex,
          smokeIndex,
          source,
        ),
      );
    }
  }

  return {
    schema_version: HERMES_MODEL_NEXUS_DESIGN_SCHEMA_VERSION,
    mode: HERMES_MODEL_NEXUS_DESIGN_MODE,
    reference_only: true,
    source_pattern_taxonomy_id: source,
    design_note: ECHOBIRD_TAXONOMY_DESIGN_NOTE,
    pattern_count: pattern_summaries.length as 4,
    lane_mapping_count: lane_mappings.length as 7,
    descriptor_item_count:
      (pattern_summaries.length + lane_mappings.length) as 11,
    future_live_adapter_state: HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE,
    safety_invariants: {
      live_config_writes_allowed: false,
      automatic_runtime_routing_enabled: false,
      hcc_auto_executor_allowed: false,
      runtime_router_allowed: false,
      runtime_replication_allowed: false,
      install_script_execution_allowed: false,
      code_copy_allowed: false,
      ui_composition_copy_allowed: false,
    },
    pattern_summaries,
    lane_mappings,
  };
}

// Compile-time sentinel: 002C verificationState enum must remain 4-valued.
// (Type-import only; no runtime side effect.)
type _UiStatusVerificationStateAllowedValues = ModelStrategyVerificationState;
// Force the import to be retained (compile-time reference).
const _enumGuard: _UiStatusVerificationStateAllowedValues[] = [
  "unverified",
  "blocked",
  "verified",
  "unavailable",
];
void _enumGuard;
