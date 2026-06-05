// Hermes Pro provider catalog dry-run resolver (MODEL-STRATEGY-002A).
// Pure validation/projection only: no filesystem, no IPC, no gateway,
// no live config writes, no runtime routing, and no network calls.

import {
  MODEL_STRATEGY_SCHEMA_VERSION,
  type ModelStrategyDryRunFixture,
  type ModelStrategyLane,
  type ModelStrategyLaneId,
} from "./model-strategy-dry-run";

export const PROVIDER_CATALOG_SCHEMA_VERSION = "1.0.0" as const;
export const PROVIDER_CATALOG_MODE = "dry_run" as const;

export const PROVIDER_CATALOG_LIVE_CONFIG_WRITES_ALLOWED = false as const;
export const PROVIDER_CATALOG_AUTOMATIC_ROUTING_ENABLED = false as const;
export const PROVIDER_CATALOG_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const PROVIDER_CATALOG_RUNTIME_ROUTER_ALLOWED = false as const;
export const PROVIDER_CATALOG_SECRETS_INLINE_ALLOWED = false as const;

export const DEEPSEEK_ROLLBACK_BASELINE_LEGACY = "deepseekV4pro" as const;
export const DEEPSEEK_ROLLBACK_BASELINE_CANONICAL = "deepseek-v4-pro" as const;

export type ProviderCatalogApiFormat =
  | "openai_compat"
  | "anthropic"
  | "google"
  | "native";

export type ProviderCatalogCapability =
  | "chat"
  | "vision"
  | "tool_use"
  | "long_context"
  | "streaming"
  | "reasoning";

export interface ProviderCatalogEntry {
  provider_id: string;
  display_name: string;
  base_url: string;
  api_format: ProviderCatalogApiFormat;
  model_id: string;
  version: string;
  capabilities: ProviderCatalogCapability[];
  region: string;
  endpoint_alias: string;
  safety_profile: string;
  requires_secrets_out_of_band: boolean;
  legacy_aliases?: string[];
  cost_fallback_model?: string;
  rollback_guard?: boolean;
  requires_provider_catalog_resolution?: boolean;
}

export interface ProviderCatalogFixture {
  schema_version: typeof PROVIDER_CATALOG_SCHEMA_VERSION;
  mode: typeof PROVIDER_CATALOG_MODE;
  status: "planned";
  active_profile: string;
  provider_catalog: ProviderCatalogEntry[];
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    secrets_inline_allowed: false;
  };
}

export interface ProviderCatalogValidationIssue {
  code: string;
  provider_id?: string;
  lane?: ModelStrategyLaneId;
  message: string;
}

export interface ProviderCatalogValidationResult {
  ok: boolean;
  issues: ProviderCatalogValidationIssue[];
}

export interface ProviderCatalogResolution {
  lane: ModelStrategyLaneId;
  provider_id: string;
  model_id: string;
  api_format: ProviderCatalogApiFormat;
  base_url: string;
  region: string;
  endpoint_alias: string;
  version: string;
  capabilities: ProviderCatalogCapability[];
  requires_secrets_out_of_band: boolean;
  resolved_via: "canonical" | "legacy_alias" | "lane_provider_label";
  catalog_status: "unresolved" | "resolved";
  verification_state: "unverified" | "blocked";
}

export interface ProviderCatalogSummary {
  provider_id: string;
  display_name: string;
  model_id: string;
  api_format: ProviderCatalogApiFormat;
  capabilities: ProviderCatalogCapability[];
  region: string;
  version: string;
  verification_state: "unverified" | "blocked";
  rollback_guard: boolean;
  legacy_aliases: string[];
}

const VALID_API_FORMATS = new Set<ProviderCatalogApiFormat>([
  "openai_compat",
  "anthropic",
  "google",
  "native",
]);

const VALID_CAPABILITIES = new Set<ProviderCatalogCapability>([
  "chat",
  "vision",
  "tool_use",
  "long_context",
  "streaming",
  "reasoning",
]);

export function validateProviderCatalog(
  catalog: ProviderCatalogFixture,
): ProviderCatalogValidationResult {
  const issues: ProviderCatalogValidationIssue[] = [];

  if (catalog.schema_version !== PROVIDER_CATALOG_SCHEMA_VERSION) {
    issues.push({
      code: "schema_version_mismatch",
      message: "Provider catalog schema version must be 1.0.0.",
    });
  }
  if (catalog.mode !== PROVIDER_CATALOG_MODE) {
    issues.push({
      code: "mode_not_dry_run",
      message: "Provider catalog fixture must stay in dry_run mode.",
    });
  }

  if (catalog.safety_invariants.live_config_writes_allowed !== false) {
    issues.push({ code: "live_config_writes_allowed", message: "Catalog must not allow live config writes." });
  }
  if (catalog.safety_invariants.automatic_runtime_routing_enabled !== false) {
    issues.push({ code: "automatic_runtime_routing_enabled", message: "Catalog must not enable automatic runtime routing." });
  }
  if (catalog.safety_invariants.hcc_auto_executor_allowed !== false) {
    issues.push({ code: "hcc_auto_executor_allowed", message: "Catalog must not enable HCC Auto Executor." });
  }
  if (catalog.safety_invariants.runtime_router_allowed !== false) {
    issues.push({ code: "runtime_router_allowed", message: "Catalog must not expose a live router." });
  }
  if (catalog.safety_invariants.secrets_inline_allowed !== false) {
    issues.push({ code: "secrets_inline_allowed", message: "Catalog must not inline secrets." });
  }

  const seenPairs = new Set<string>();
  for (const entry of catalog.provider_catalog) {
    const requiredStringFields: Array<[keyof ProviderCatalogEntry, string]> = [
      ["provider_id", "provider_id_missing"],
      ["display_name", "display_name_missing"],
      ["base_url", "base_url_missing"],
      ["model_id", "model_id_missing"],
      ["version", "version_missing"],
      ["api_format", "api_format_missing"],
      ["region", "region_missing"],
      ["endpoint_alias", "endpoint_alias_missing"],
      ["safety_profile", "safety_profile_missing"],
    ];
    for (const [field, code] of requiredStringFields) {
      const value = entry[field];
      if (typeof value !== "string" || value.trim().length === 0) {
        issues.push({
          code,
          provider_id: entry.provider_id,
          message: `Provider catalog entry ${String(field)} is required.`,
        });
      }
    }

    if (typeof entry.requires_secrets_out_of_band !== "boolean") {
      issues.push({
        code: "requires_secrets_out_of_band_missing",
        provider_id: entry.provider_id,
        message:
          "Provider catalog entry must declare requires_secrets_out_of_band as boolean.",
      });
    }

    if (!Array.isArray(entry.capabilities) || entry.capabilities.length === 0) {
      issues.push({
        code: "capabilities_missing",
        provider_id: entry.provider_id,
        message: "Provider catalog entry must declare at least one capability.",
      });
    } else {
      for (const cap of entry.capabilities) {
        if (!VALID_CAPABILITIES.has(cap as ProviderCatalogCapability)) {
          issues.push({
            code: "unknown_capability",
            provider_id: entry.provider_id,
            message: `Unknown capability ${String(cap)} in provider catalog.`,
          });
        }
      }
    }

    if (
      typeof entry.api_format === "string" &&
      !VALID_API_FORMATS.has(entry.api_format as ProviderCatalogApiFormat)
    ) {
      issues.push({
        code: "unknown_api_format",
        provider_id: entry.provider_id,
        message: `Unknown api_format ${entry.api_format} in provider catalog.`,
      });
    }

    const pairKey = `${entry.provider_id}::${entry.model_id}`;
    if (seenPairs.has(pairKey)) {
      issues.push({
        code: "duplicate_provider_model_pair",
        provider_id: entry.provider_id,
        message: `Duplicate provider_id+model_id pair ${pairKey}.`,
      });
    }
    seenPairs.add(pairKey);
  }

  return { ok: issues.length === 0, issues };
}

export function validateProviderCatalogResolution(
  fixture: ModelStrategyDryRunFixture,
  catalog: ProviderCatalogFixture,
): ProviderCatalogValidationResult {
  const collected: ProviderCatalogValidationIssue[] = [];

  const catalogResult = validateProviderCatalog(catalog);
  collected.push(...catalogResult.issues);

  const index = buildProviderCatalogIndex(catalog);

  for (const lane of fixture.lanes) {
    const laneIssues = validateLaneAgainstCatalog(lane, index);
    collected.push(...laneIssues);
  }

  return { ok: collected.length === 0, issues: collected };
}

interface ProviderCatalogIndex {
  byProviderModel: Map<string, ProviderCatalogEntry>;
  byLegacyAlias: Map<string, ProviderCatalogEntry>;
  byProviderId: Map<string, ProviderCatalogEntry>;
}

function buildProviderCatalogIndex(
  catalog: ProviderCatalogFixture,
): ProviderCatalogIndex {
  const byProviderModel = new Map<string, ProviderCatalogEntry>();
  const byLegacyAlias = new Map<string, ProviderCatalogEntry>();
  const byProviderId = new Map<string, ProviderCatalogEntry>();

  for (const entry of catalog.provider_catalog) {
    byProviderModel.set(`${entry.provider_id}::${entry.model_id}`, entry);
    byProviderId.set(entry.provider_id, entry);
    if (entry.legacy_aliases) {
      for (const alias of entry.legacy_aliases) {
        byLegacyAlias.set(alias, entry);
      }
    }
  }

  return { byProviderModel, byLegacyAlias, byProviderId };
}

function validateLaneAgainstCatalog(
  lane: ModelStrategyLane,
  index: ProviderCatalogIndex,
): ProviderCatalogValidationIssue[] {
  const issues: ProviderCatalogValidationIssue[] = [];

  if (
    lane.candidate_model === "MiniMax 3.0" &&
    lane.requires_provider_catalog_resolution !== true
  ) {
    issues.push({
      code: "minimax_requires_catalog_resolution",
      lane: lane.lane,
      message: "MiniMax 3.0 must require provider catalog resolution.",
    });
  }

  if (lane.requires_provider_catalog_resolution === true) {
    const entry = index.byProviderId.get(lane.provider);
    if (!entry) {
      issues.push({
        code: "candidate_model_not_in_catalog",
        lane: lane.lane,
        message: `Provider ${lane.provider} not found in provider catalog.`,
      });
      return issues;
    }
    if (entry.model_id !== lane.candidate_model) {
      issues.push({
        code: "candidate_model_not_in_catalog",
        lane: lane.lane,
        message: `Lane ${lane.lane} candidate_model ${lane.candidate_model} does not match catalog model_id ${entry.model_id}.`,
      });
    }
  } else {
    const directKey = `${lane.provider}::${lane.candidate_model}`;
    if (!index.byProviderModel.has(directKey)) {
      const legacy = index.byLegacyAlias.get(lane.candidate_model);
      if (!legacy || legacy.provider_id !== lane.provider) {
        if (lane.lane !== "daily_fallback") {
          issues.push({
            code: "candidate_model_not_in_catalog",
            lane: lane.lane,
            message: `Candidate model ${lane.candidate_model} for provider ${lane.provider} not found in catalog.`,
          });
        }
      }
    }
  }

  if (
    lane.lane === "task_fallback" &&
    lane.candidate_model === DEEPSEEK_ROLLBACK_BASELINE_LEGACY
  ) {
    issues.push({
      code: "deepseek_legacy_alias_in_lane",
      lane: lane.lane,
      message:
        "task_fallback lane must use canonical model_id deepseek-v4-pro, not legacy alias.",
    });
  }

  if (lane.lane === "daily_fallback") {
    if (lane.provider !== "custom") {
      issues.push({
        code: "local_fallback_must_map_to_custom_provider",
        lane: lane.lane,
        message: "Local fallback must map to provider=custom.",
      });
    }
    if (lane.lane_provider_label !== "local") {
      issues.push({
        code: "local_fallback_missing_lane_label",
        lane: lane.lane,
        message: "Local fallback should keep local as a lane label only.",
      });
    }
  }

  return issues;
}

export function resolveProviderFromCatalog(
  lane: ModelStrategyLane,
  catalog: ProviderCatalogFixture,
): ProviderCatalogResolution {
  const index = buildProviderCatalogIndex(catalog);

  if (lane.lane === "daily_fallback") {
    const entry = index.byProviderId.get("custom");
    if (!entry) {
      throw new Error("local_fallback_provider_missing");
    }
    return {
      lane: lane.lane,
      provider_id: entry.provider_id,
      model_id: entry.model_id,
      api_format: entry.api_format,
      base_url: entry.base_url,
      region: entry.region,
      endpoint_alias: entry.endpoint_alias,
      version: entry.version,
      capabilities: entry.capabilities,
      requires_secrets_out_of_band: entry.requires_secrets_out_of_band,
      resolved_via: "lane_provider_label",
      catalog_status: "unresolved",
      verification_state: "unverified",
    };
  }

  const direct = index.byProviderModel.get(
    `${lane.provider}::${lane.candidate_model}`,
  );
  if (direct) {
    return projectEntry(direct, lane, "canonical");
  }

  const legacy = index.byLegacyAlias.get(lane.candidate_model);
  if (legacy && legacy.provider_id === lane.provider) {
    return projectEntry(legacy, lane, "legacy_alias");
  }

  if (lane.requires_provider_catalog_resolution === true) {
    const byProvider = index.byProviderId.get(lane.provider);
    if (byProvider) {
      return projectEntry(byProvider, lane, "canonical");
    }
  }

  throw new Error(
    `provider_catalog_resolution_failed:${lane.lane}:${lane.candidate_model}`,
  );
}

function projectEntry(
  entry: ProviderCatalogEntry,
  lane: ModelStrategyLane,
  resolved_via: ProviderCatalogResolution["resolved_via"],
): ProviderCatalogResolution {
  return {
    lane: lane.lane,
    provider_id: entry.provider_id,
    model_id: entry.model_id,
    api_format: entry.api_format,
    base_url: entry.base_url,
    region: entry.region,
    endpoint_alias: entry.endpoint_alias,
    version: entry.version,
    capabilities: entry.capabilities,
    requires_secrets_out_of_band: entry.requires_secrets_out_of_band,
    resolved_via,
    catalog_status: "resolved",
    verification_state: "unverified",
  };
}

export function buildProviderCatalogSummaries(
  catalog: ProviderCatalogFixture,
): ProviderCatalogSummary[] {
  return catalog.provider_catalog.map((entry) => ({
    provider_id: entry.provider_id,
    display_name: entry.display_name,
    model_id: entry.model_id,
    api_format: entry.api_format,
    capabilities: entry.capabilities,
    region: entry.region,
    version: entry.version,
    verification_state: "unverified",
    rollback_guard: entry.rollback_guard === true,
    legacy_aliases: entry.legacy_aliases ?? [],
  }));
}

export function assertDeepseekRollbackAliasResolves(
  legacyAlias: string,
  catalog: ProviderCatalogFixture,
): ProviderCatalogEntry {
  if (legacyAlias !== DEEPSEEK_ROLLBACK_BASELINE_LEGACY) {
    throw new Error("deepseek_legacy_alias_drift");
  }
  const index = buildProviderCatalogIndex(catalog);
  const entry = index.byLegacyAlias.get(legacyAlias);
  if (!entry) {
    throw new Error("deepseek_legacy_alias_not_in_catalog");
  }
  if (entry.model_id !== DEEPSEEK_ROLLBACK_BASELINE_CANONICAL) {
    throw new Error("deepseek_legacy_alias_drift");
  }
  if (entry.rollback_guard !== true) {
    throw new Error("deepseek_rollback_guard_missing");
  }
  return entry;
}

export function assertProviderCatalogNoRuntimeAccess(
  catalog: ProviderCatalogFixture,
): void {
  const result = validateProviderCatalog(catalog);
  const liveIssues = result.issues.filter((issue) =>
    [
      "live_config_writes_allowed",
      "automatic_runtime_routing_enabled",
      "hcc_auto_executor_allowed",
      "runtime_router_allowed",
      "secrets_inline_allowed",
    ].includes(issue.code),
  );
  if (liveIssues.length > 0) {
    throw new Error(liveIssues.map((issue) => issue.code).join(","));
  }
}

export const PROVIDER_CATALOG_SAFETY_LITERALS = {
  schema_version: PROVIDER_CATALOG_SCHEMA_VERSION,
  mode: PROVIDER_CATALOG_MODE,
  live_config_writes_allowed: PROVIDER_CATALOG_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled:
    PROVIDER_CATALOG_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: PROVIDER_CATALOG_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: PROVIDER_CATALOG_RUNTIME_ROUTER_ALLOWED,
  secrets_inline_allowed: PROVIDER_CATALOG_SECRETS_INLINE_ALLOWED,
} as const;

export const _MODEL_STRATEGY_SCHEMA_VERSION_REF =
  MODEL_STRATEGY_SCHEMA_VERSION;
