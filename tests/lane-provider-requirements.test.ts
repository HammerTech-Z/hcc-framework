import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyLaneId,
} from "../src/shared/lib/model-strategy-dry-run";
import type { ProviderCatalogFixture } from "../src/shared/lib/provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "../src/shared/lib/smoke-test-matrix";
import {
  buildLaneProviderRequirements,
  LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_POOL_INTEGRATION,
  LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_SOURCE,
  LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE,
  LANE_PROVIDER_REQUIREMENTS_KEYCHAIN_INTEGRATION,
  LANE_PROVIDER_REQUIREMENTS_LOCAL_RUNTIME_ACTIVATION,
  LANE_PROVIDER_REQUIREMENTS_MODE,
  LANE_PROVIDER_REQUIREMENTS_SCHEMA_VERSION,
  LANE_PROVIDER_REQUIREMENTS_SOURCE_STRATEGY_FIXTURE_ID,
  type LaneProviderRequirement,
  type LaneProviderRequirementsResult,
} from "../src/shared/lib/lane-provider-requirements";
import { ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL } from "../src/shared/lib/echobird-pattern-taxonomy";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/lane-provider-requirements.ts"),
  "utf-8",
);

const fixture001 = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

const EXPECTED_LANE_ORDER: ModelStrategyLaneId[] = [
  "daily",
  "daily_fallback",
  "light_task",
  "complex_code",
  "task_fallback",
  "god",
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeResult(): LaneProviderRequirementsResult {
  return buildLaneProviderRequirements(fixture001, catalog, smokeMatrix);
}

describe("MODEL-STRATEGY-006A schema pins", () => {
  it("uses schema 1.0.0 and design_only_user_configured_provider mode", () => {
    expect(LANE_PROVIDER_REQUIREMENTS_SCHEMA_VERSION).toBe("1.0.0");
    expect(LANE_PROVIDER_REQUIREMENTS_MODE).toBe(
      "design_only_user_configured_provider",
    );
    const result = makeResult();
    expect(result.schema_version).toBe("1.0.0");
    expect(result.mode).toBe("design_only_user_configured_provider");
    expect(result.reference_only).toBe(true);
  });

  it("declares lane_count 6 and source_strategy_fixture_id", () => {
    const result = makeResult();
    expect(result.lane_count).toBe(6);
    expect(LANE_PROVIDER_REQUIREMENTS_SOURCE_STRATEGY_FIXTURE_ID).toBe(
      "model-strategy-dry-run-2026-06-05",
    );
    expect(result.source_strategy_fixture_id).toBe(
      "model-strategy-dry-run-2026-06-05",
    );
    expect(result.source_pattern_taxonomy_id).toBe(
      ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
    );
  });

  it("emits 6 requirements in canonical 001 order", () => {
    const result = makeResult();
    expect(result.requirements).toHaveLength(6);
    expect(result.requirements.map((r) => r.lane)).toEqual(EXPECTED_LANE_ORDER);
  });
});

describe("MODEL-STRATEGY-006A per-lane protection flags", () => {
  it("all credential_source is user_provided", () => {
    const result = makeResult();
    for (const r of result.requirements) {
      expect(r.credential_source).toBe("user_provided");
    }
    expect(result.credential_source).toBe(
      LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_SOURCE,
    );
  });

  it("all enabled/disabled/verification_state/candidate_verified_state are correct", () => {
    const result = makeResult();
    for (const r of result.requirements) {
      expect(r.enabled).toBe(false);
      expect(r.disabled).toBe(true);
      expect(r.verification_state).toBe("unverified");
      expect(r.candidate_verified_state).toBe(false);
      expect(r.fixtures_must_not_contain_keys).toBe(true);
      expect(r.docs_must_not_contain_keys).toBe(true);
    }
  });

  it("daily_fallback has local_fallback_pattern_id and supply_local_endpoint", () => {
    const result = makeResult();
    const dailyFallback = result.requirements.find(
      (r) => r.lane === "daily_fallback",
    )!;
    expect(dailyFallback.local_fallback_pattern_id).toBe("local_fallback");
    expect(dailyFallback.requires_user_action).toBe("supply_local_endpoint");
  });

  it("daily / light_task require supply_api_key_supply_base_url_supply_model_id", () => {
    const result = makeResult();
    for (const laneId of ["daily", "light_task"] as const) {
      const r = result.requirements.find((x) => x.lane === laneId)!;
      expect(r.requires_user_action).toBe(
        "supply_api_key_supply_base_url_supply_model_id",
      );
      expect(r.user_intent_required).toBe(false);
      expect(r.rollback_baseline_match_required).toBe(false);
      expect(r.local_fallback_pattern_id).toBeNull();
    }
  });

  it("complex_code and god require user_intent_required", () => {
    const result = makeResult();
    for (const laneId of ["complex_code", "god"] as const) {
      const r = result.requirements.find((x) => x.lane === laneId)!;
      expect(r.user_intent_required).toBe(true);
      expect(r.requires_user_action).toBe(
        "supply_api_key_supply_base_url_supply_model_id",
      );
    }
  });

  it("task_fallback requires rollback_baseline_match_required", () => {
    const result = makeResult();
    const tf = result.requirements.find((r) => r.lane === "task_fallback")!;
    expect(tf.rollback_baseline_match_required).toBe(true);
    expect(tf.user_intent_required).toBe(false);
  });
});

describe("MODEL-STRATEGY-006A verified injection rejection", () => {
  it("injected verified daily lane keeps output unverified and adds issue", () => {
    const tampered = deepClone(fixture001);
    const daily = tampered.lanes.find((l) => l.lane === "daily")!;
    (daily as { verification_state: string }).verification_state = "verified";
    const result = buildLaneProviderRequirements(tampered, catalog, smokeMatrix);
    const dailyR = result.requirements.find((r) => r.lane === "daily")!;
    expect(dailyR.verification_state).toBe("unverified");
    expect(dailyR.candidate_verified_state).toBe(false);
    expect(dailyR.enabled).toBe(false);
    expect(dailyR.disabled).toBe(true);
    const issues = result.validation_issues.filter(
      (i) => i.lane === "daily" && i.code === "verified_candidate_not_allowed_in_design_descriptor",
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("all-six verified injection creates >=6 issues and enabled stays false", () => {
    const tampered = deepClone(fixture001);
    for (const lane of tampered.lanes) {
      (lane as { verification_state: string }).verification_state = "verified";
    }
    const result = buildLaneProviderRequirements(tampered, catalog, smokeMatrix);
    const verifiedIssues = result.validation_issues.filter(
      (i) => i.code === "verified_candidate_not_allowed_in_design_descriptor",
    );
    expect(verifiedIssues.length).toBeGreaterThanOrEqual(6);
    for (const r of result.requirements) {
      expect(r.enabled).toBe(false);
      expect(r.verification_state).toBe("unverified");
    }
  });

  it("injected verified gpt-5.5 candidate creates verified-related issue", () => {
    const tampered = deepClone(fixture001);
    const cc = tampered.lanes.find((l) => l.candidate_model === "gpt-5.5")!;
    (cc as { verification_state: string }).verification_state = "verified";
    const result = buildLaneProviderRequirements(tampered, catalog, smokeMatrix);
    const issues = result.validation_issues.filter(
      (i) =>
        i.lane === "complex_code" &&
        (i.code === "verified_candidate_not_allowed_in_design_descriptor" ||
          i.code === "candidate_must_remain_unverified"),
    );
    expect(issues.length).toBeGreaterThan(0);
  });
});

describe("MODEL-STRATEGY-006A secret-like detection", () => {
  it("apiKey field injection creates secret_like_field_detected issue", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog[0] = {
      ...tampered.provider_catalog[0],
      apiKey: "sk-abcdef1234567890abcdef",
    } as never;
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    const issues = result.validation_issues.filter(
      (i) => i.code === "secret_like_field_detected",
    );
    expect(issues.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("sk-abcdef1234567890abcdef");
  });

  it("api_key field injection creates secret_like_field_detected issue", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog[0] = {
      ...tampered.provider_catalog[0],
      api_key: "sk-deadbeefcafebabe1234567890abcdef",
    } as never;
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    expect(
      result.validation_issues.some(
        (i) => i.code === "secret_like_field_detected",
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      "sk-deadbeefcafebabe1234567890abcdef",
    );
  });

  it("Bearer token value injection creates secret_like_value_detected issue", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog[0] = {
      ...tampered.provider_catalog[0],
      base_url: "https://api.example.com/v1/" + "Bearer " + "abcdef1234567890abcdefghij",
    } as never;
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    expect(
      result.validation_issues.some(
        (i) => i.code === "secret_like_value_detected",
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      "abcdef1234567890abcdefghij",
    );
  });

  it("JWT three-segment value injection creates secret_like_value_detected issue", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog[0] = {
      ...tampered.provider_catalog[0],
      base_url: "eyJabc.def_ghi.jkl-mno1234567890",
    } as never;
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    expect(
      result.validation_issues.some(
        (i) => i.code === "secret_like_value_detected",
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      "eyJabc.def_ghi.jkl-mno1234567890",
    );
  });

  it("32+ hex value injection creates secret_like_value_detected issue", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog[0] = {
      ...tampered.provider_catalog[0],
      base_url: "deadbeef0123456789abcdef0123456789",
    } as never;
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    expect(
      result.validation_issues.some(
        (i) => i.code === "secret_like_value_detected",
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain(
      "deadbeef0123456789abcdef0123456789",
    );
  });

  it("base_url_metadata strips query and fragment", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog[0] = {
      ...tampered.provider_catalog[0],
      base_url: "https://api.example.com/v1/chat/completions?api_key=sk-should_not_echo&token=eyJ",
    } as never;
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    const daily = result.requirements.find((r) => r.lane === "daily")!;
    expect(daily.base_url_metadata?.path_prefix).toBe("/v1/chat/completions");
    const serialized = JSON.stringify(daily.base_url_metadata);
    expect(serialized).not.toContain("api_key=sk-should_not_echo");
    expect(serialized).not.toContain("eyJ");
  });

  it("result JSON does not contain raw providerCatalog references", () => {
    const result = makeResult();
    const serialized = JSON.stringify(result);
    // The helper only emits requirements, validation_issues, safety_invariants.
    expect(serialized).not.toContain("\"provider_catalog\"");
    expect(serialized).not.toContain("\"api_format\"");
    expect(serialized).not.toContain("\"capabilities\"");
  });
});

describe("MODEL-STRATEGY-006A safety invariants", () => {
  it("all 8 safety invariants are hard false", () => {
    const result = makeResult();
    const si = result.safety_invariants;
    expect(si.live_config_writes_allowed).toBe(false);
    expect(si.automatic_runtime_routing_enabled).toBe(false);
    expect(si.hcc_auto_executor_allowed).toBe(false);
    expect(si.runtime_router_allowed).toBe(false);
    expect(si.runtime_replication_allowed).toBe(false);
    expect(si.credential_pool_integration_allowed).toBe(false);
    expect(si.keychain_integration_allowed).toBe(false);
    expect(si.local_runtime_activation_allowed).toBe(false);
  });

  it("future_live_adapter_state is the 006 canonical literal", () => {
    expect(LANE_PROVIDER_REQUIREMENTS_FUTURE_LIVE_ADAPTER_STATE).toBe(
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    );
    const result = makeResult();
    expect(result.future_live_adapter_state).toBe(
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    );
    expect(result.credential_pool_integration).toBe(
      LANE_PROVIDER_REQUIREMENTS_CREDENTIAL_POOL_INTEGRATION,
    );
    expect(result.keychain_integration).toBe(
      LANE_PROVIDER_REQUIREMENTS_KEYCHAIN_INTEGRATION,
    );
    expect(result.local_runtime_activation).toBe(
      LANE_PROVIDER_REQUIREMENTS_LOCAL_RUNTIME_ACTIVATION,
    );
  });
});

describe("MODEL-STRATEGY-006A immutability and degraded input", () => {
  it("does not modify any of the three inputs", () => {
    const beforeS = deepClone(fixture001);
    const beforeC = deepClone(catalog);
    const beforeM = deepClone(smokeMatrix);
    makeResult();
    expect(fixture001).toEqual(beforeS);
    expect(catalog).toEqual(beforeC);
    expect(smokeMatrix).toEqual(beforeM);
  });

  it("missing catalog provider keeps 6 entries but base_url_metadata null + issue", () => {
    const tampered = deepClone(catalog);
    tampered.provider_catalog = tampered.provider_catalog.filter(
      (e) => e.provider_id !== "minimax",
    );
    const result = buildLaneProviderRequirements(fixture001, tampered, smokeMatrix);
    expect(result.requirements).toHaveLength(6);
    const daily = result.requirements.find((r) => r.lane === "daily")!;
    expect(daily.base_url_metadata).toBeNull();
    expect(
      result.validation_issues.some(
        (i) => i.code === "provider_id_not_found_in_catalog" && i.lane === "daily",
      ),
    ).toBe(true);
  });

  it("missing smoke lane keeps 6 entries + descriptor issue", () => {
    const tampered = deepClone(smokeMatrix);
    tampered.matrix = tampered.matrix.filter((e) => e.lane !== "daily");
    const result = buildLaneProviderRequirements(fixture001, catalog, tampered);
    expect(result.requirements).toHaveLength(6);
    expect(
      result.validation_issues.some(
        (i) => i.code === "smoke_lane_not_in_matrix" && i.lane === "daily",
      ),
    ).toBe(true);
  });
});

describe("MODEL-STRATEGY-006A cross-subslice alignment", () => {
  it("lane order matches 001 dry-run fixture", () => {
    const result = makeResult();
    const fixtureLanes = fixture001.lanes.map((l) => l.lane);
    const resultLanes = result.requirements.map((r) => r.lane);
    expect(resultLanes).toEqual(fixtureLanes);
    expect(resultLanes).toEqual(EXPECTED_LANE_ORDER);
  });

  it("daily_fallback local_fallback_pattern_id aligns with 005A local_fallback", () => {
    const result = makeResult();
    const dailyFallback = result.requirements.find(
      (r) => r.lane === "daily_fallback",
    )!;
    expect(dailyFallback.local_fallback_pattern_id).toBe("local_fallback");
  });

  it("task_fallback rollback_baseline_match_required aligns with 002A catalog rollback_guard", () => {
    const result = makeResult();
    const tf = result.requirements.find((r) => r.lane === "task_fallback")!;
    expect(tf.rollback_baseline_match_required).toBe(true);
    const catalogDeepseek = catalog.provider_catalog.find(
      (e) => e.provider_id === "deepseek",
    )!;
    expect(catalogDeepseek.rollback_guard).toBe(true);
  });

  it("complex_code / god user_intent_required aligns with 001 fixture", () => {
    const result = makeResult();
    for (const laneId of ["complex_code", "god"] as const) {
      const fixtureLane = fixture001.lanes.find((l) => l.lane === laneId)!;
      expect(fixtureLane.requires_user_intent).toBe(true);
      const r = result.requirements.find((x) => x.lane === laneId)!;
      expect(r.user_intent_required).toBe(true);
    }
  });
});

describe("MODEL-STRATEGY-006A source guardrails", () => {
  it("helper source does not reference runtime/config/network surfaces", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      "spawn(",
      "exec(",
      "config.yaml",
      "setModelConfig",
      "setEnv",
      "startGateway",
      "runPlaybook",
      "triggerCronJob",
      "knowledgeIngest",
      "handoff/packs",
      ".hermes/audit",
      "http.request(",
      "https.request(",
      "net.connect(",
      "dns.lookup(",
      "https.Agent",
    ]) {
      expect(helperSrc).not.toContain(forbidden);
    }
    expect(helperSrc).not.toContain("general_availability");
  });

  it("helper source avoids EchoBird surface terms", () => {
    for (const term of [
      "echobird_core",
      "edison7009",
      "vLLM",
      "SGLang",
      "llama.cpp",
      "Model Nexus",
      "App Manager",
      "Install & Repair Agent",
    ]) {
      expect(helperSrc).not.toContain(term);
    }
  });

  it("helper source does not declare method-style runtime/write names", () => {
    const methodNamePattern =
      /\b(install|repair|execute|run|auto_fix|silent_fix|apply|commit|flush|activate|route)\s*\(/g;
    const matches = helperSrc.match(methodNamePattern);
    expect(matches).toBeNull();
  });
});
