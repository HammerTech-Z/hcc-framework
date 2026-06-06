// Hermes Pro lane/provider requirements design descriptor (MODEL-STRATEGY-006A).
// Pure design-only pre-research. No credential pool. No keychain. No local
// runtime activation. 006 Live config adapter remains future and requires
// explicit approval. This helper never outputs raw catalog objects and never
// echoes secret-like values; any such detection enters validation_issues.

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyLane,
  ModelStrategyLaneId,
  ModelStrategyProvider,
} from "./model-strategy-dry-run";
import type { ProviderCatalogFixture } from "./provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "./smoke-test-matrix";
import {
  ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
  type EchobirdPatternId,
} from "./echobird-pattern-taxonomy";

export const LANE_PROVIDER_REQUIREMENTS_SCHEMA_VERSION = "1.0.0" as const;
export const LANE_PROVIDER_REQUIREMENTS_MODE =
  "design_only_user_configured_provider" as const;
export const LANE_PROVIDER_REQUIREMENTS_SOURCE_STRATEGY_FIXTURE_ID =
  "model-strategy-dry-run-2026-06-05" as const;

export const LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_SOURCE =
  "user_provided" as const;
export const LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_POOL_INTEGRATION =
  "future_requires_explicit_approval" as const;
export const LANE_PROVIDER_REQUIREMENTS_KEYCHAIN_INTEGRATION =
  "future_requires_explicit_approval" as const;
export const LANE_PROVIDER_REQUIREMENTS_LOCAL_RUNTIME_ACTIVATION =
  "future_requires_explicit_user_approval" as const;
export const LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE =
  "006_live_config_adapter_remains_future_requires_explicit_approval" as const;

export const LOCAL_FALLBACK_PATTERN_ID = "local_fallback" as const;

const ALLOWED_URL_PATH_PREFIXES: readonly string[] = [
  "/v1/chat/completions",
  "/v1",
  "/chat/completions",
];

// Marker sentinel: SECRET_FIELD_NAMES is the canonical secret-field registry.
const SECRET_FIELD_NAMES: readonly string[] = [
  "apiKey",
  "api_key",
  "token",
  "authorization",
  "password",
  "secret",
  "accessToken",
  "access_token",
  "Bearer",
];

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /^sk-[A-Za-z0-9]{8,}$/,
  /^xox[abp]-[A-Za-z0-9-]{8,}$/,
  /^Bearer\s+[A-Za-z0-9._-]{16,}$/,
  /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  /^[a-f0-9]{32,}$/i,
  /^[A-F0-9]{32,}$/,
];

export type LaneProviderRequirementsValidationCode =
  | "candidate_must_remain_unverified"
  | "verified_candidate_not_allowed_in_design_descriptor"
  | "secret_like_field_detected"
  | "secret_like_value_detected"
  | "secret_material_must_not_enter_descriptor"
  | "provider_id_not_found_in_catalog"
  | "smoke_lane_not_in_matrix";

export interface LaneProviderRequirementsValidationIssue {
  code: LaneProviderRequirementsValidationCode;
  lane?: ModelStrategyLaneId;
  field?: string;
  message: string;
}

export interface BaseUrlMetadata {
  scheme: "http" | "https" | null;
  host: string | null;
  port: number | null;
  path_prefix: string | null;
}

export interface LaneProviderRequirement {
  lane: ModelStrategyLaneId;
  provider: ModelStrategyProvider;
  candidate_model: string;
  base_url_metadata: BaseUrlMetadata | null;
  credential_source: "user_provided";
  requires_user_action: string;
  fixtures_must_not_contain_keys: true;
  docs_must_not_contain_keys: true;
  local_fallback_pattern_id: EchobirdPatternId | null;
  user_intent_required: boolean;
  rollback_baseline_match_required: boolean;
  verification_state: "unverified";
  candidate_verified_state: false;
  enabled: false;
  disabled: true;
  future_live_adapter_state: typeof LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE;
}

export interface LaneProviderRequirementsResult {
  schema_version: typeof LANE_PROVIDER_REQUIREMENTS_SCHEMA_VERSION;
  mode: typeof LANE_PROVIDER_REQUIREMENTS_MODE;
  reference_only: true;
  source_strategy_fixture_id: typeof LANE_PROVIDER_REQUIREMENTS_SOURCE_STRATEGY_FIXTURE_ID;
  source_pattern_taxonomy_id: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
  lane_count: 6;
  credential_source: "user_provided";
  credential_pool_integration: "future_requires_explicit_approval";
  keychain_integration: "future_requires_explicit_approval";
  local_runtime_activation: "future_requires_explicit_user_approval";
  future_live_adapter_state: typeof LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE;
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    runtime_replication_allowed: false;
    credential_pool_integration_allowed: false;
    keychain_integration_allowed: false;
    local_runtime_activation_allowed: false;
  };
  validation_issues: LaneProviderRequirementsValidationIssue[];
  requirements: LaneProviderRequirement[];
}

interface CatalogLookup {
  byProviderId: Map<ModelStrategyProvider, string>;
  byProviderModel: Map<string, true>;
}

function buildCatalogIndex(
  catalog: ProviderCatalogFixture,
): CatalogLookup {
  const byProviderId = new Map<ModelStrategyProvider, string>();
  const byProviderModel = new Map<string, true>();
  for (const entry of catalog.provider_catalog) {
    byProviderId.set(entry.provider_id as ModelStrategyProvider, entry.base_url);
    byProviderModel.set(`${entry.provider_id}::${entry.model_id}`, true);
  }
  return { byProviderId, byProviderModel };
}

function parseBaseUrlMetadata(rawBaseUrl: string | null): BaseUrlMetadata | null {
  if (rawBaseUrl == null) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawBaseUrl);
  } catch {
    return { scheme: null, host: null, port: null, path_prefix: null };
  }
  const pathPrefix = ALLOWED_URL_PATH_PREFIXES.find((p) =>
    parsed.pathname.startsWith(p),
  ) ?? null;
  const port = parsed.port === "" ? null : Number(parsed.port);
  return {
    scheme:
      parsed.protocol === "http:" || parsed.protocol === "https:"
        ? (parsed.protocol.slice(0, -1) as "http" | "https")
        : null,
    host: parsed.hostname === "" ? null : parsed.hostname,
    port: port === null || Number.isNaN(port) ? null : port,
    path_prefix: pathPrefix,
  };
}

function detectSecretField(fieldName: string): boolean {
  return SECRET_FIELD_NAMES.includes(fieldName);
}

function detectSecretValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  for (const re of SECRET_VALUE_PATTERNS) {
    if (re.test(value)) return true;
  }
  if (/^Bearer\s/i.test(value)) return true;
  return false;
}

function scanObjectForSecrets(
  obj: unknown,
  issues: LaneProviderRequirementsValidationIssue[],
  lane?: ModelStrategyLaneId,
): void {
  if (obj == null) return;
  if (typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (detectSecretField(k)) {
      issues.push({
        code: "secret_like_field_detected",
        lane,
        field: k,
        message: `Secret-like field ${k} detected; remove from input before passing to design descriptor.`,
      });
      continue;
    }
    if (typeof v === "string" && detectSecretValue(v)) {
      issues.push({
        code: "secret_like_value_detected",
        lane,
        field: k,
        message: `Secret-like value detected in field ${k}; not echoed in descriptor.`,
      });
    } else if (typeof v === "object" && v !== null) {
      scanObjectForSecrets(v, issues, lane);
    }
  }
}

interface SmokeLookup {
  byLane: Map<ModelStrategyLaneId, true>;
}

function buildSmokeIndex(smoke: SmokeTestMatrixFixture): SmokeLookup {
  const byLane = new Map<ModelStrategyLaneId, true>();
  for (const entry of smoke.matrix) byLane.set(entry.lane, true);
  return { byLane };
}

function requiresUserActionForLane(lane: ModelStrategyLaneId): string {
  if (lane === "daily_fallback") {
    return "supply_local_endpoint";
  }
  return "supply_api_key_supply_base_url_supply_model_id";
}

function localFallbackPatternIdForLane(
  lane: ModelStrategyLaneId,
): EchobirdPatternId | null {
  if (lane === "daily_fallback") return LOCAL_FALLBACK_PATTERN_ID;
  return null;
}

function buildRequirement(
  lane: ModelStrategyLane,
  catalogLookup: CatalogLookup,
  smokeLookup: SmokeLookup,
  issues: LaneProviderRequirementsValidationIssue[],
): LaneProviderRequirement {
  const catalogEntry = catalogLookup.byProviderId.get(lane.provider);
  const baseUrlMetadata = parseBaseUrlMetadata(catalogEntry ?? null);

  if (!catalogEntry) {
    issues.push({
      code: "provider_id_not_found_in_catalog",
      lane: lane.lane,
      message: `Provider ${lane.provider} not found in 002A catalog.`,
    });
  }

  if (!smokeLookup.byLane.has(lane.lane)) {
    issues.push({
      code: "smoke_lane_not_in_matrix",
      lane: lane.lane,
      message: `Lane ${lane.lane} not found in 002B smoke matrix.`,
    });
  }

  if (lane.verification_state !== "unverified") {
    issues.push({
      code:
        lane.verification_state === "verified"
          ? "verified_candidate_not_allowed_in_design_descriptor"
          : "candidate_must_remain_unverified",
      lane: lane.lane,
      message: `Lane ${lane.lane} verification_state=${lane.verification_state} is not allowed in design descriptor; projection remains unverified.`,
    });
  }

  return {
    lane: lane.lane,
    provider: lane.provider,
    candidate_model: lane.candidate_model,
    base_url_metadata: baseUrlMetadata,
    credential_source: "user_provided",
    requires_user_action: requiresUserActionForLane(lane.lane),
    fixtures_must_not_contain_keys: true,
    docs_must_not_contain_keys: true,
    local_fallback_pattern_id: localFallbackPatternIdForLane(lane.lane),
    user_intent_required: lane.requires_user_intent === true,
    rollback_baseline_match_required: lane.lane === "task_fallback",
    verification_state: "unverified",
    candidate_verified_state: false,
    enabled: false,
    disabled: true,
    future_live_adapter_state:
      LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE,
  };
}

export function buildLaneProviderRequirements(
  strategyFixture: ModelStrategyDryRunFixture,
  providerCatalog: ProviderCatalogFixture,
  smokeMatrix: SmokeTestMatrixFixture,
): LaneProviderRequirementsResult {
  const issues: LaneProviderRequirementsValidationIssue[] = [];
  scanObjectForSecrets(providerCatalog, issues);
  scanObjectForSecrets(smokeMatrix, issues);

  const catalogLookup = buildCatalogIndex(providerCatalog);
  const smokeLookup = buildSmokeIndex(smokeMatrix);

  const requirements: LaneProviderRequirement[] = strategyFixture.lanes.map(
    (lane) => buildRequirement(lane, catalogLookup, smokeLookup, issues),
  );

  return {
    schema_version: LANE_PROVIDER_REQUIREMENTS_SCHEMA_VERSION,
    mode: LANE_PROVIDER_REQUIREMENTS_MODE,
    reference_only: true,
    source_strategy_fixture_id:
      LANE_PROVIDER_REQUIREMENTS_SOURCE_STRATEGY_FIXTURE_ID,
    source_pattern_taxonomy_id: ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
    lane_count: requirements.length as 6,
    credential_source: "user_provided",
    credential_pool_integration:
      LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_POOL_INTEGRATION,
    keychain_integration: LANE_PROVIDER_REQUIREMENTS_KEYCHAIN_INTEGRATION,
    local_runtime_activation:
      LANE_PROVIDER_REQUIREMENTS_LOCAL_RUNTIME_ACTIVATION,
    future_live_adapter_state:
      LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE,
    safety_invariants: {
      live_config_writes_allowed: false,
      automatic_runtime_routing_enabled: false,
      hcc_auto_executor_allowed: false,
      runtime_router_allowed: false,
      runtime_replication_allowed: false,
      credential_pool_integration_allowed: false,
      keychain_integration_allowed: false,
      local_runtime_activation_allowed: false,
    },
    validation_issues: issues,
    requirements,
  };
}
