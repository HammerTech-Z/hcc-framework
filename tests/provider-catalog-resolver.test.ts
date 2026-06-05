import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  type ModelStrategyDryRunFixture,
} from "../src/shared/lib/model-strategy-dry-run";

import {
  assertDeepseekRollbackAliasResolves,
  assertProviderCatalogNoRuntimeAccess,
  buildProviderCatalogSummaries,
  DEEPSEEK_ROLLBACK_BASELINE_CANONICAL,
  DEEPSEEK_ROLLBACK_BASELINE_LEGACY,
  PROVIDER_CATALOG_AUTOMATIC_ROUTING_ENABLED,
  PROVIDER_CATALOG_HCC_AUTO_EXECUTOR_ALLOWED,
  PROVIDER_CATALOG_LIVE_CONFIG_WRITES_ALLOWED,
  PROVIDER_CATALOG_MODE,
  PROVIDER_CATALOG_RUNTIME_ROUTER_ALLOWED,
  PROVIDER_CATALOG_SCHEMA_VERSION,
  PROVIDER_CATALOG_SECRETS_INLINE_ALLOWED,
  type ProviderCatalogFixture,
  resolveProviderFromCatalog,
  validateProviderCatalog,
  validateProviderCatalogResolution,
} from "../src/shared/lib/provider-catalog-resolver";

import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05.json";
import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05.json";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/provider-catalog-resolver.ts"),
  "utf-8",
);
const catalogSrc = readFileSync(
  join(ROOT, "tests/fixtures/model-strategy/provider-catalog-2026-06-05.json"),
  "utf-8",
);
const fixture001Src = readFileSync(
  join(ROOT, "tests/fixtures/model-strategy/model-strategy-dry-run-2026-06-05.json"),
  "utf-8",
);

const catalog = catalogJson as ProviderCatalogFixture;
const fixture001 = fixture001Json as ModelStrategyDryRunFixture;

function cloneCatalog(): ProviderCatalogFixture {
  return JSON.parse(JSON.stringify(catalog)) as ProviderCatalogFixture;
}

function cloneFixture(): ModelStrategyDryRunFixture {
  return JSON.parse(JSON.stringify(fixture001)) as ModelStrategyDryRunFixture;
}

describe("MODEL-STRATEGY-002A provider catalog fixture", () => {
  it("pins schema_version 1.0.0 and dry_run mode", () => {
    expect(PROVIDER_CATALOG_SCHEMA_VERSION).toBe("1.0.0");
    expect(PROVIDER_CATALOG_MODE).toBe("dry_run");
    expect(catalog.schema_version).toBe("1.0.0");
    expect(catalog.mode).toBe("dry_run");
    expect(catalog.status).toBe("planned");
  });

  it("keeps all five safety literals hard false", () => {
    expect(PROVIDER_CATALOG_LIVE_CONFIG_WRITES_ALLOWED).toBe(false);
    expect(PROVIDER_CATALOG_AUTOMATIC_ROUTING_ENABLED).toBe(false);
    expect(PROVIDER_CATALOG_HCC_AUTO_EXECUTOR_ALLOWED).toBe(false);
    expect(PROVIDER_CATALOG_RUNTIME_ROUTER_ALLOWED).toBe(false);
    expect(PROVIDER_CATALOG_SECRETS_INLINE_ALLOWED).toBe(false);

    expect(catalog.safety_invariants.live_config_writes_allowed).toBe(false);
    expect(catalog.safety_invariants.automatic_runtime_routing_enabled).toBe(false);
    expect(catalog.safety_invariants.hcc_auto_executor_allowed).toBe(false);
    expect(catalog.safety_invariants.runtime_router_allowed).toBe(false);
    expect(catalog.safety_invariants.secrets_inline_allowed).toBe(false);
  });

  it("contains the five required provider entries", () => {
    const ids = catalog.provider_catalog.map((entry) => entry.provider_id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "minimax",
        "openai",
        "deepseek",
        "anthropic",
        "custom",
      ]),
    );

    const minimax = catalog.provider_catalog.find(
      (entry) => entry.provider_id === "minimax",
    )!;
    expect(minimax.model_id).toBe("MiniMax 3.0");
    expect(minimax.version).toBe("unresolved-provider-catalog");
    expect(minimax.requires_secrets_out_of_band).toBe(true);
    expect(minimax.capabilities).toEqual(
      expect.arrayContaining(["chat", "vision", "streaming"]),
    );

    const openai = catalog.provider_catalog.find(
      (entry) => entry.provider_id === "openai",
    )!;
    expect(openai.model_id).toBe("gpt-5.5");
    expect(openai.requires_secrets_out_of_band).toBe(true);
    expect(openai.capabilities).toEqual(
      expect.arrayContaining(["chat", "tool_use", "long_context", "reasoning"]),
    );

    const deepseek = catalog.provider_catalog.find(
      (entry) => entry.provider_id === "deepseek",
    )!;
    expect(deepseek.model_id).toBe(DEEPSEEK_ROLLBACK_BASELINE_CANONICAL);
    expect(deepseek.legacy_aliases).toContain(DEEPSEEK_ROLLBACK_BASELINE_LEGACY);
    expect(deepseek.rollback_guard).toBe(true);
    expect(deepseek.cost_fallback_model).toBeTruthy();

    const anthropic = catalog.provider_catalog.find(
      (entry) => entry.provider_id === "anthropic",
    )!;
    expect(anthropic.model_id).toBe("provider_current_opus");
    expect(anthropic.requires_provider_catalog_resolution).toBe(true);

    const custom = catalog.provider_catalog.find(
      (entry) => entry.provider_id === "custom",
    )!;
    expect(custom.model_id).toBe("gemma-4-12b-it");
    expect(custom.base_url).toBe("http://localhost:1234/v1");
    expect(custom.api_format).toBe("openai_compat");
    expect(custom.region).toBe("local");
    expect(custom.requires_secrets_out_of_band).toBe(false);
  });

  it("validates the committed catalog fixture", () => {
    const result = validateProviderCatalog(catalog);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(() => assertProviderCatalogNoRuntimeAccess(catalog)).not.toThrow();
  });
});

describe("MODEL-STRATEGY-002A catalog resolution against 001 fixture", () => {
  it("resolves the six 001 lanes against the catalog", () => {
    const result = validateProviderCatalogResolution(fixture001, catalog);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);

    const daily = resolveProviderFromCatalog(
      fixture001.lanes.find((lane) => lane.lane === "daily")!,
      catalog,
    );
    expect(daily.provider_id).toBe("minimax");
    expect(daily.model_id).toBe("MiniMax 3.0");
    expect(daily.catalog_status).toBe("resolved");
    expect(daily.verification_state).toBe("unverified");

    const lightTask = resolveProviderFromCatalog(
      fixture001.lanes.find((lane) => lane.lane === "light_task")!,
      catalog,
    );
    expect(lightTask.provider_id).toBe("minimax");
    expect(lightTask.model_id).toBe("MiniMax 3.0");

    const complexCode = resolveProviderFromCatalog(
      fixture001.lanes.find((lane) => lane.lane === "complex_code")!,
      catalog,
    );
    expect(complexCode.provider_id).toBe("openai");
    expect(complexCode.model_id).toBe("gpt-5.5");

    const local = resolveProviderFromCatalog(
      fixture001.lanes.find((lane) => lane.lane === "daily_fallback")!,
      catalog,
    );
    expect(local.provider_id).toBe("custom");
    expect(local.model_id).toBe("gemma-4-12b-it");
    expect(local.base_url).toBe("http://localhost:1234/v1");
    expect(local.region).toBe("local");
    expect(local.resolved_via).toBe("lane_provider_label");

    const taskFallback = resolveProviderFromCatalog(
      fixture001.lanes.find((lane) => lane.lane === "task_fallback")!,
      catalog,
    );
    expect(taskFallback.provider_id).toBe("deepseek");
    expect(taskFallback.model_id).toBe(DEEPSEEK_ROLLBACK_BASELINE_CANONICAL);

    const god = resolveProviderFromCatalog(
      fixture001.lanes.find((lane) => lane.lane === "god")!,
      catalog,
    );
    expect(god.provider_id).toBe("anthropic");
    expect(god.model_id).toBe("provider_current_opus");
  });

  it("keeps MiniMax 3.0 unverified and requires catalog resolution", () => {
    const daily = fixture001.lanes.find((lane) => lane.lane === "daily")!;
    expect(daily.requires_provider_catalog_resolution).toBe(true);
    expect(daily.verification_state).toBe("unverified");

    const bad = cloneFixture();
    const dailyBad = bad.lanes.find((lane) => lane.lane === "daily")!;
    (dailyBad as { requires_provider_catalog_resolution?: boolean })
      .requires_provider_catalog_resolution = false;
    const result = validateProviderCatalogResolution(bad, catalog);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "minimax_requires_catalog_resolution",
    );
  });

  it("gates gpt-5.5 by user intent and leaves it unverified", () => {
    const complexCode = fixture001.lanes.find(
      (lane) => lane.lane === "complex_code",
    )!;
    expect(complexCode.requires_user_intent).toBe(true);
    expect(complexCode.verification_state).toBe("unverified");
  });
});

describe("MODEL-STRATEGY-002A deepseek rollback alias guard", () => {
  it("resolves the legacy baseline alias to the canonical model id", () => {
    const entry = assertDeepseekRollbackAliasResolves(
      DEEPSEEK_ROLLBACK_BASELINE_LEGACY,
      catalog,
    );
    expect(entry.model_id).toBe(DEEPSEEK_ROLLBACK_BASELINE_CANONICAL);
    expect(entry.rollback_guard).toBe(true);
    expect(entry.legacy_aliases).toContain(DEEPSEEK_ROLLBACK_BASELINE_LEGACY);
  });

  it("rejects a drifted legacy alias string", () => {
    expect(() =>
      assertDeepseekRollbackAliasResolves("deepseek-v4-pro", catalog),
    ).toThrow(/deepseek_legacy_alias_drift/);
  });

  it("rejects a catalog where deepseek lost its rollback_guard", () => {
    const bad = cloneCatalog();
    const deepseek = bad.provider_catalog.find(
      (entry) => entry.provider_id === "deepseek",
    )!;
    (deepseek as { rollback_guard?: boolean }).rollback_guard = false;
    expect(() =>
      assertDeepseekRollbackAliasResolves(
        DEEPSEEK_ROLLBACK_BASELINE_LEGACY,
        bad,
      ),
    ).toThrow(/deepseek_rollback_guard_missing/);
  });

  it("rejects a catalog where deepseek lost its legacy alias entry", () => {
    const bad = cloneCatalog();
    const deepseek = bad.provider_catalog.find(
      (entry) => entry.provider_id === "deepseek",
    )!;
    (deepseek as { legacy_aliases?: string[] }).legacy_aliases = [];
    expect(() =>
      assertDeepseekRollbackAliasResolves(
        DEEPSEEK_ROLLBACK_BASELINE_LEGACY,
        bad,
      ),
    ).toThrow(/deepseek_legacy_alias_not_in_catalog/);
  });

  it("rejects a task_fallback lane that drifts back to the legacy alias", () => {
    const bad = cloneFixture();
    const taskFallback = bad.lanes.find(
      (lane) => lane.lane === "task_fallback",
    )!;
    (taskFallback as { candidate_model?: string }).candidate_model =
      DEEPSEEK_ROLLBACK_BASELINE_LEGACY;
    const result = validateProviderCatalogResolution(bad, catalog);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "deepseek_legacy_alias_in_lane",
    );
  });
});

describe("MODEL-STRATEGY-002A provider catalog summaries", () => {
  it("builds UI-ready summaries without enabling any provider", () => {
    const summaries = buildProviderCatalogSummaries(catalog);
    expect(summaries).toHaveLength(5);
    expect(summaries.every((summary) => summary.verification_state === "unverified")).toBe(
      true,
    );
    expect(summaries.find((summary) => summary.provider_id === "deepseek")?.rollback_guard).toBe(
      true,
    );
    expect(
      summaries.find((summary) => summary.provider_id === "deepseek")?.legacy_aliases,
    ).toContain(DEEPSEEK_ROLLBACK_BASELINE_LEGACY);
  });
});

describe("MODEL-STRATEGY-002A negative invariants", () => {
  it("rejects candidate model not in catalog", () => {
    const bad = cloneFixture();
    const complexCode = bad.lanes.find(
      (lane) => lane.lane === "complex_code",
    )!;
    (complexCode as { candidate_model?: string }).candidate_model =
      "gpt-6.0-not-in-catalog";
    (complexCode as { requires_provider_catalog_resolution?: boolean })
      .requires_provider_catalog_resolution = true;
    const result = validateProviderCatalogResolution(bad, catalog);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "candidate_model_not_in_catalog",
    );
  });

  it("rejects duplicate provider_id+model_id pairs in the catalog", () => {
    const bad = cloneCatalog();
    const dup: typeof catalog.provider_catalog[number] = {
      ...bad.provider_catalog[0],
    };
    (bad.provider_catalog as typeof catalog.provider_catalog).push(dup);
    const result = validateProviderCatalog(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "duplicate_provider_model_pair",
    );
  });

  it("rejects missing required fields on a catalog entry", () => {
    const bad = cloneCatalog();
    const openai = bad.provider_catalog.find(
      (entry) => entry.provider_id === "openai",
    )!;
    (openai as { base_url?: string }).base_url = "";
    const result = validateProviderCatalog(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("base_url_missing");
  });

  it("rejects unknown api_format and unknown capability", () => {
    const bad = cloneCatalog();
    const openai = bad.provider_catalog.find(
      (entry) => entry.provider_id === "openai",
    )!;
    (openai as { api_format?: string }).api_format = "shiny_new_format";
    (openai as { capabilities?: string[] }).capabilities = ["chat", "telepathy"];
    const result = validateProviderCatalog(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("unknown_api_format");
    expect(result.issues.map((issue) => issue.code)).toContain("unknown_capability");
  });

  it("rejects unsafe safety_invariants in the catalog", () => {
    const bad = cloneCatalog();
    (bad.safety_invariants as { live_config_writes_allowed: boolean }).live_config_writes_allowed = true;
    const result = validateProviderCatalog(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "live_config_writes_allowed",
    );
    expect(() => assertProviderCatalogNoRuntimeAccess(bad)).toThrow(
      /live_config_writes_allowed/,
    );
  });
});

describe("MODEL-STRATEGY-002A source and fixture guardrails", () => {
  it("helper source stays pure and does not reference runtime surfaces", () => {
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
      "net.connect(",
      "dns.lookup(",
      "https.Agent",
    ]) {
      expect(helperSrc).not.toContain(forbidden);
    }
  });

  it("catalog fixture has no live config write signal", () => {
    expect(catalogSrc).toContain("\"live_config_writes_allowed\": false");
    expect(catalogSrc).toContain("\"requires_secrets_out_of_band\": true");
  });

  it("001 fixture still pins MiniMax 3.0, gpt-5.5, and deepseek baseline", () => {
    expect(fixture001Src).toContain("\"candidate_model\": \"MiniMax 3.0\"");
    expect(fixture001Src).toContain("\"candidate_model\": \"gpt-5.5\"");
    expect(fixture001Src).toContain("\"task_fallback_model\": \"deepseekV4pro\"");
  });
});
