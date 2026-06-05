// Hermes Pro smoke-test matrix dry-run helpers (MODEL-STRATEGY-002B).
// Pure structural checks only: no filesystem, no IPC, no gateway,
// no live config writes, no runtime routing, no HTTP / DNS / socket probes.

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyLaneId,
} from "./model-strategy-dry-run";
import type {
  ProviderCatalogEntry,
  ProviderCatalogFixture,
} from "./provider-catalog-resolver";

export const SMOKE_TEST_MATRIX_SCHEMA_VERSION = "1.0.0" as const;
export const SMOKE_TEST_MATRIX_MODE = "dry_run" as const;

export const SMOKE_TEST_LIVE_CONFIG_WRITES_ALLOWED = false as const;
export const SMOKE_TEST_AUTOMATIC_ROUTING_ENABLED = false as const;
export const SMOKE_TEST_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const SMOKE_TEST_RUNTIME_ROUTER_ALLOWED = false as const;
export const SMOKE_TEST_NETWORK_PROBE_ALLOWED = false as const;

export const SMOKE_TEST_LOCAL_CHECK_TYPE = "structural_only" as const;

export const SMOKE_TEST_LOCAL_REQUIRED_CHECKS = [
  "local_base_url_structure_check",
  "loopback_host_check",
  "path_prefix_check",
] as const;

export const SMOKE_TEST_COMPLEX_CODE_REQUIRED_CHECKS = [
  "user_intent_gate_check",
] as const;

export const SMOKE_TEST_TASK_FALLBACK_REQUIRED_CHECKS = [
  "rollback_baseline_match_check",
] as const;

export const REQUIRED_LANE_ORDER: readonly ModelStrategyLaneId[] = [
  "daily",
  "daily_fallback",
  "light_task",
  "complex_code",
  "task_fallback",
  "god",
];

export type SmokeTestCheckType = "structural_only" | string;
export type SmokeTestVerificationState =
  | "unverified"
  | "blocked"
  | "verified"
  | "unavailable";

export interface SmokeTestMatrixEntry {
  lane: ModelStrategyLaneId;
  provider_id: string;
  model_id: string;
  check_type: SmokeTestCheckType;
  verification_state: SmokeTestVerificationState;
  checks: string[];
}

export interface SmokeTestMatrixFixture {
  schema_version: typeof SMOKE_TEST_MATRIX_SCHEMA_VERSION;
  mode: typeof SMOKE_TEST_MATRIX_MODE;
  status: "planned";
  active_profile: string;
  check_type_for_local_fallback: "structural_only";
  matrix: SmokeTestMatrixEntry[];
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_runtime_routing_enabled: false;
    hcc_auto_executor_allowed: false;
    runtime_router_allowed: false;
    network_probe_allowed: false;
  };
}

export interface SmokeTestValidationIssue {
  code: string;
  lane?: ModelStrategyLaneId;
  message: string;
}

export interface SmokeTestValidationResult {
  ok: boolean;
  issues: SmokeTestValidationIssue[];
}

export interface LocalBaseUrlStructureResult {
  ok: boolean;
  issues: string[];
}

export interface SmokeTestMatrixSummary {
  lane: ModelStrategyLaneId;
  provider_id: string;
  model_id: string;
  check_type: string;
  check_count: number;
  verification_state: SmokeTestVerificationState;
  required_checks_present: string[];
  required_checks_missing: string[];
}

interface CatalogLookup {
  byProviderModel: Map<string, ProviderCatalogEntry>;
  byProviderId: Map<string, ProviderCatalogEntry>;
  byLegacyAlias: Map<string, ProviderCatalogEntry>;
}

function buildCatalogIndex(
  catalog: ProviderCatalogFixture,
): CatalogLookup {
  const byProviderModel = new Map<string, ProviderCatalogEntry>();
  const byProviderId = new Map<string, ProviderCatalogEntry>();
  const byLegacyAlias = new Map<string, ProviderCatalogEntry>();
  for (const entry of catalog.provider_catalog) {
    byProviderModel.set(`${entry.provider_id}::${entry.model_id}`, entry);
    byProviderId.set(entry.provider_id, entry);
    if (entry.legacy_aliases) {
      for (const alias of entry.legacy_aliases) {
        byLegacyAlias.set(alias, entry);
      }
    }
  }
  return { byProviderModel, byProviderId, byLegacyAlias };
}

function resolveCatalogEntry(
  providerId: string,
  modelId: string,
  index: CatalogLookup,
): ProviderCatalogEntry | null {
  const direct = index.byProviderModel.get(`${providerId}::${modelId}`);
  if (direct) return direct;
  const byProvider = index.byProviderId.get(providerId);
  if (byProvider && byProvider.model_id === modelId) return byProvider;
  const legacy = index.byLegacyAlias.get(modelId);
  if (legacy && legacy.provider_id === providerId) return legacy;
  return null;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function assertLocalBaseUrlStructurallyReachable(
  url: string,
): LocalBaseUrlStructureResult {
  const issues: string[] = [];

  if (typeof url !== "string" || url.trim().length === 0) {
    return { ok: false, issues: ["url_parse_failed"] };
  }

  const schemeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//);
  if (!schemeMatch) {
    return { ok: false, issues: ["url_parse_failed"] };
  }
  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== "http" && scheme !== "https") {
    issues.push("scheme_not_http_or_https");
  }

  const afterScheme = url.slice(schemeMatch[0].length);
  const pathStart = afterScheme.search(/[/?#]/);
  const authority = pathStart === -1 ? afterScheme : afterScheme.slice(0, pathStart);
  const remainder = pathStart === -1 ? "" : afterScheme.slice(pathStart);

  if (!authority) {
    return { ok: false, issues: ["url_parse_failed"] };
  }

  let hostPart = authority;
  let portPart = "";
  if (authority.startsWith("[")) {
    const closing = authority.indexOf("]");
    if (closing === -1) {
      return { ok: false, issues: ["url_parse_failed"] };
    }
    hostPart = authority.slice(0, closing + 1);
    const afterBracket = authority.slice(closing + 1);
    if (afterBracket.startsWith(":")) {
      portPart = afterBracket.slice(1);
    } else if (afterBracket.length > 0) {
      return { ok: false, issues: ["url_parse_failed"] };
    }
  } else {
    const colon = authority.lastIndexOf(":");
    if (colon !== -1) {
      hostPart = authority.slice(0, colon);
      portPart = authority.slice(colon + 1);
    }
  }

  const normalizedHost = hostPart.toLowerCase();
  const strippedHost = normalizedHost.startsWith("[") && normalizedHost.endsWith("]")
    ? normalizedHost.slice(1, -1)
    : normalizedHost;
  if (!LOOPBACK_HOSTS.has(strippedHost)) {
    issues.push("host_not_loopback");
  }
  if (!portPart) {
    issues.push("port_missing");
  } else {
    if (!/^\d+$/.test(portPart)) {
      issues.push("port_invalid");
    } else {
      const portNum = Number(portPart);
      if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
        issues.push("port_invalid");
      }
    }
  }

  let pathname = "";
  if (remainder.startsWith("?")) {
    pathname = "";
  } else if (remainder.startsWith("#")) {
    pathname = "";
  } else {
    const queryHash = remainder.search(/[?#]/);
    pathname = queryHash === -1 ? remainder : remainder.slice(0, queryHash);
  }

  if (!pathname.startsWith("/v1")) {
    issues.push("path_prefix_not_v1");
  }

  return { ok: issues.length === 0, issues };
}

function validateSafetyInvariants(
  matrix: SmokeTestMatrixFixture,
): SmokeTestValidationIssue[] {
  const issues: SmokeTestValidationIssue[] = [];
  if (matrix.safety_invariants.live_config_writes_allowed !== false) {
    issues.push({
      code: "live_config_writes_allowed",
      message: "Smoke matrix must not allow live config writes.",
    });
  }
  if (matrix.safety_invariants.automatic_runtime_routing_enabled !== false) {
    issues.push({
      code: "automatic_runtime_routing_enabled",
      message: "Smoke matrix must not enable automatic runtime routing.",
    });
  }
  if (matrix.safety_invariants.hcc_auto_executor_allowed !== false) {
    issues.push({
      code: "hcc_auto_executor_allowed",
      message: "Smoke matrix must not enable HCC Auto Executor.",
    });
  }
  if (matrix.safety_invariants.runtime_router_allowed !== false) {
    issues.push({
      code: "runtime_router_allowed",
      message: "Smoke matrix must not expose a live router.",
    });
  }
  if (matrix.safety_invariants.network_probe_allowed !== false) {
    issues.push({
      code: "network_probe_allowed",
      message: "Smoke matrix must not enable network probes.",
    });
  }
  return issues;
}

export function validateSmokeTestMatrix(
  strategyFixture: ModelStrategyDryRunFixture,
  providerCatalog: ProviderCatalogFixture,
  smokeMatrix: SmokeTestMatrixFixture,
): SmokeTestValidationResult {
  const issues: SmokeTestValidationIssue[] = [];

  if (smokeMatrix.schema_version !== SMOKE_TEST_MATRIX_SCHEMA_VERSION) {
    issues.push({
      code: "schema_version_mismatch",
      message: "Smoke matrix schema version must be 1.0.0.",
    });
  }
  if (smokeMatrix.mode !== SMOKE_TEST_MATRIX_MODE) {
    issues.push({
      code: "mode_not_dry_run",
      message: "Smoke matrix must stay in dry_run mode.",
    });
  }
  if (
    smokeMatrix.check_type_for_local_fallback !== SMOKE_TEST_LOCAL_CHECK_TYPE
  ) {
    issues.push({
      code: "local_check_type_must_be_structural_only",
      message:
        "Smoke matrix must declare check_type_for_local_fallback=structural_only.",
    });
  }

  issues.push(...validateSafetyInvariants(smokeMatrix));

  const index = buildCatalogIndex(providerCatalog);

  const lanesById = new Map<ModelStrategyLaneId, SmokeTestMatrixEntry>();
  for (const entry of smokeMatrix.matrix) {
    if (lanesById.has(entry.lane)) {
      issues.push({
        code: "duplicate_lane_matrix_entry",
        lane: entry.lane,
        message: `Duplicate matrix entry for lane ${entry.lane}.`,
      });
    }
    lanesById.set(entry.lane, entry);
  }

  for (const laneId of REQUIRED_LANE_ORDER) {
    if (!lanesById.has(laneId)) {
      issues.push({
        code: "missing_lane_matrix_entry",
        lane: laneId,
        message: `Missing smoke matrix entry for lane ${laneId}.`,
      });
    }
  }

  for (const [laneId, entry] of lanesById) {
    if (entry.verification_state === "verified") {
      issues.push({
        code: "lane_prematurely_verified",
        lane: laneId,
        message: "Smoke matrix must not mark lanes verified in dry-run.",
      });
    }

    const catalogEntry = resolveCatalogEntry(
      entry.provider_id,
      entry.model_id,
      index,
    );
    if (!catalogEntry) {
      issues.push({
        code: "matrix_model_not_in_catalog",
        lane: laneId,
        message: `Matrix ${entry.provider_id}/${entry.model_id} not in provider catalog.`,
      });
    }

    const strategyLane = strategyFixture.lanes.find(
      (lane) => lane.lane === laneId,
    );
    const requiresSmoke =
      strategyLane?.requires_smoke_test === true ||
      strategyLane?.requires_multimodal_smoke_test === true;

    if (requiresSmoke && (!entry.checks || entry.checks.length === 0)) {
      issues.push({
        code: "smoke_required_lane_empty_checks",
        lane: laneId,
        message: `Smoke-required lane ${laneId} must declare at least one check.`,
      });
    }

    if (entry.check_type !== "structural_only") {
      issues.push({
        code: "non_structural_check_type_not_allowed",
        lane: laneId,
        message: `Smoke matrix entry for ${laneId} must use check_type=structural_only in dry-run.`,
      });
    }

    if (laneId === "daily_fallback") {
      if (entry.check_type !== "structural_only") {
        issues.push({
          code: "local_fallback_must_be_structural_only",
          lane: laneId,
          message: "Local fallback matrix entry must be structural_only.",
        });
      }
      for (const required of SMOKE_TEST_LOCAL_REQUIRED_CHECKS) {
        if (!entry.checks.includes(required)) {
          issues.push({
            code: "local_fallback_required_check_missing",
            lane: laneId,
            message: `Local fallback matrix entry missing required check ${required}.`,
          });
        }
      }
      const baseUrl = catalogEntry?.base_url;
      if (!baseUrl) {
        issues.push({
          code: "local_fallback_base_url_missing",
          lane: laneId,
          message: "Local fallback catalog entry must declare base_url.",
        });
      } else {
        const result = assertLocalBaseUrlStructurallyReachable(baseUrl);
        if (!result.ok) {
          for (const code of result.issues) {
            issues.push({
              code: `local_fallback_${code}`,
              lane: laneId,
              message: `Local fallback base_url ${baseUrl} failed structural check: ${code}.`,
            });
          }
        }
      }
    }

    if (laneId === "complex_code") {
      for (const required of SMOKE_TEST_COMPLEX_CODE_REQUIRED_CHECKS) {
        if (!entry.checks.includes(required)) {
          issues.push({
            code: "complex_code_required_check_missing",
            lane: laneId,
            message: `complex_code matrix entry missing required check ${required}.`,
          });
        }
      }
    }

    if (laneId === "task_fallback") {
      for (const required of SMOKE_TEST_TASK_FALLBACK_REQUIRED_CHECKS) {
        if (!entry.checks.includes(required)) {
          issues.push({
            code: "task_fallback_required_check_missing",
            lane: laneId,
            message: `task_fallback matrix entry missing required check ${required}.`,
          });
        }
      }
    }
  }

  return { ok: issues.length === 0, issues };
}

export function buildSmokeTestMatrixSummaries(
  smokeMatrix: SmokeTestMatrixFixture,
): SmokeTestMatrixSummary[] {
  return smokeMatrix.matrix.map((entry) => {
    const requiredByLane: Record<ModelStrategyLaneId, string[]> = {
      daily: ["provider_catalog_resolution_check"],
      daily_fallback: [...SMOKE_TEST_LOCAL_REQUIRED_CHECKS],
      light_task: ["provider_catalog_resolution_check"],
      complex_code: [...SMOKE_TEST_COMPLEX_CODE_REQUIRED_CHECKS],
      task_fallback: [...SMOKE_TEST_TASK_FALLBACK_REQUIRED_CHECKS],
      god: ["provider_catalog_resolution_check", "user_intent_gate_check"],
    };
    const required = requiredByLane[entry.lane] ?? [];
    const present = required.filter((req) => entry.checks.includes(req));
    return {
      lane: entry.lane,
      provider_id: entry.provider_id,
      model_id: entry.model_id,
      check_type: entry.check_type,
      check_count: entry.checks.length,
      verification_state: entry.verification_state,
      required_checks_present: present,
      required_checks_missing: required.filter((req) => !present.includes(req)),
    };
  });
}

export function assertSmokeTestMatrixNoRuntimeAccess(
  smokeMatrix: SmokeTestMatrixFixture,
): void {
  const result = validateSmokeTestMatrix(
    { lanes: [] } as unknown as ModelStrategyDryRunFixture,
    { provider_catalog: [] } as unknown as ProviderCatalogFixture,
    smokeMatrix,
  );
  const liveCodes = [
    "live_config_writes_allowed",
    "automatic_runtime_routing_enabled",
    "hcc_auto_executor_allowed",
    "runtime_router_allowed",
    "network_probe_allowed",
  ];
  const matched = result.issues.filter((issue) =>
    liveCodes.includes(issue.code),
  );
  if (matched.length > 0) {
    throw new Error(matched.map((issue) => issue.code).join(","));
  }
}

export const SMOKE_TEST_SAFETY_LITERALS = {
  schema_version: SMOKE_TEST_MATRIX_SCHEMA_VERSION,
  mode: SMOKE_TEST_MATRIX_MODE,
  live_config_writes_allowed: SMOKE_TEST_LIVE_CONFIG_WRITES_ALLOWED,
  automatic_runtime_routing_enabled: SMOKE_TEST_AUTOMATIC_ROUTING_ENABLED,
  hcc_auto_executor_allowed: SMOKE_TEST_HCC_AUTO_EXECUTOR_ALLOWED,
  runtime_router_allowed: SMOKE_TEST_RUNTIME_ROUTER_ALLOWED,
  network_probe_allowed: SMOKE_TEST_NETWORK_PROBE_ALLOWED,
  check_type_for_local_fallback: SMOKE_TEST_LOCAL_CHECK_TYPE,
} as const;
