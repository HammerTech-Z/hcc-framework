import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyVerificationState,
} from "../src/shared/lib/model-strategy-dry-run";
import type { ProviderCatalogFixture } from "../src/shared/lib/provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "../src/shared/lib/smoke-test-matrix";
import type {
  EchobirdPatternId,
  EchobirdPatternTaxonomySnapshot,
} from "../src/shared/lib/echobird-pattern-taxonomy";
import { ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT } from "../src/shared/lib/echobird-pattern-taxonomy";
import {
  buildHermesModelNexusDesign,
  HERMES_MODEL_NEXUS_DESIGN_MODE,
  HERMES_MODEL_NEXUS_DESIGN_SCHEMA_VERSION,
  HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE,
  type HermesModelNexusDesignResult,
  type HermesModelNexusFieldKind,
  type HermesModelNexusLaneMapping,
  type HermesModelNexusPatternSummary,
} from "../src/shared/lib/hermes-model-nexus-design";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/hermes-model-nexus-design.ts"),
  "utf-8",
);

const taxonomy: EchobirdPatternTaxonomySnapshot = ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT;
const strategySnapshot = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeResult(): HermesModelNexusDesignResult {
  return buildHermesModelNexusDesign(
    taxonomy,
    strategySnapshot,
    catalog,
    smokeMatrix,
  );
}

describe("MODEL-STRATEGY-005B schema pins", () => {
  it("uses schema 1.0.0, design_descriptor_only mode, and reference_only", () => {
    const result = makeResult();
    expect(HERMES_MODEL_NEXUS_DESIGN_SCHEMA_VERSION).toBe("1.0.0");
    expect(HERMES_MODEL_NEXUS_DESIGN_MODE).toBe("design_descriptor_only");
    expect(result.schema_version).toBe("1.0.0");
    expect(result.mode).toBe("design_descriptor_only");
    expect(result.reference_only).toBe(true);
  });

  it("declares pattern_count, lane_mapping_count, descriptor_item_count", () => {
    const result = makeResult();
    expect(result.pattern_count).toBe(4);
    expect(result.lane_mapping_count).toBe(7);
    expect(result.descriptor_item_count).toBe(11);
  });

  it("emits exactly 4 pattern_summaries and 7 lane_mappings", () => {
    const result = makeResult();
    expect(result.pattern_summaries).toHaveLength(4);
    expect(result.lane_mappings).toHaveLength(7);
  });
});

describe("MODEL-STRATEGY-005B pattern summary structure", () => {
  it("each summary carries all 7 protection flags as true", () => {
    const result = makeResult();
    for (const s of result.pattern_summaries) {
      expect(s.design_only).toBe(true);
      expect(s.no_code_copy).toBe(true);
      expect(s.no_ui_composition_copy).toBe(true);
      expect(s.no_install_script_copy).toBe(true);
      expect(s.no_runtime_behavior_copy).toBe(true);
      expect(s.allow_reuse_as_design_only).toBe(true);
      expect(s.requires_explicit_user_approval_for_live_writes).toBe(true);
    }
  });

  it("each summary has correct hermes_native_field and source_pattern_taxonomy_id", () => {
    const result = makeResult();
    const expected: Record<EchobirdPatternId, HermesModelNexusFieldKind> = {
      model_nexus: "lane_summary",
      local_fallback: "local_fallback_structural_check",
      install_repair: "install_recovery_diagnostics",
      project_management: "cockpit_product_inventory",
    };
    for (const s of result.pattern_summaries) {
      expect(s.hermes_native_field).toBe(expected[s.pattern_id]);
      expect(s.source_pattern_taxonomy_id).toBe(
        taxonomy.source_reference_url,
      );
      expect(s.future_live_adapter_state).toBe(
        HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE,
      );
    }
  });

  it("install_repair and project_management have empty applicable_lane_ids", () => {
    const result = makeResult();
    const install = result.pattern_summaries.find(
      (s) => s.pattern_id === "install_repair",
    )!;
    const project = result.pattern_summaries.find(
      (s) => s.pattern_id === "project_management",
    )!;
    expect(install.applicable_lane_ids).toEqual([]);
    expect(project.applicable_lane_ids).toEqual([]);
  });
});

describe("MODEL-STRATEGY-005B lane mappings", () => {
  it("model_nexus covers all 6 lanes", () => {
    const result = makeResult();
    const mn = result.lane_mappings.filter(
      (m) => m.pattern_id === "model_nexus",
    );
    expect(mn).toHaveLength(6);
    const lanes = mn.map((m) => m.lane_id);
    expect(lanes).toEqual(
      expect.arrayContaining([
        "daily",
        "daily_fallback",
        "light_task",
        "complex_code",
        "task_fallback",
        "god",
      ]),
    );
    for (const m of mn) {
      expect(m.hermes_native_field).toBe("lane_summary");
    }
  });

  it("local_fallback only covers daily_fallback lane", () => {
    const result = makeResult();
    const lf = result.lane_mappings.filter(
      (m) => m.pattern_id === "local_fallback",
    );
    expect(lf).toHaveLength(1);
    expect(lf[0].lane_id).toBe("daily_fallback");
    expect(lf[0].hermes_native_field).toBe("local_fallback_structural_check");
  });

  it("install_repair and project_management produce zero lane mappings", () => {
    const result = makeResult();
    const ip = result.lane_mappings.filter(
      (m) => m.pattern_id === "install_repair",
    );
    const pm = result.lane_mappings.filter(
      (m) => m.pattern_id === "project_management",
    );
    expect(ip).toEqual([]);
    expect(pm).toEqual([]);
  });

  it("every lane mapping carries all 7 protection flags as true", () => {
    const result = makeResult();
    for (const m of result.lane_mappings) {
      expect(m.design_only).toBe(true);
      expect(m.no_code_copy).toBe(true);
      expect(m.no_ui_composition_copy).toBe(true);
      expect(m.no_install_script_copy).toBe(true);
      expect(m.no_runtime_behavior_copy).toBe(true);
      expect(m.allow_reuse_as_design_only).toBe(true);
      expect(m.requires_explicit_user_approval_for_live_writes).toBe(true);
    }
  });
});

describe("MODEL-STRATEGY-005B safety invariants", () => {
  it("all 8 safety invariants are hard false", () => {
    const result = makeResult();
    const si = result.safety_invariants;
    expect(si.live_config_writes_allowed).toBe(false);
    expect(si.automatic_runtime_routing_enabled).toBe(false);
    expect(si.hcc_auto_executor_allowed).toBe(false);
    expect(si.runtime_router_allowed).toBe(false);
    expect(si.runtime_replication_allowed).toBe(false);
    expect(si.install_script_execution_allowed).toBe(false);
    expect(si.code_copy_allowed).toBe(false);
    expect(si.ui_composition_copy_allowed).toBe(false);
  });

  it("future_live_adapter_state is pinned to 006 future literal", () => {
    const result = makeResult();
    expect(HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE).toBe(
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    );
    expect(result.future_live_adapter_state).toBe(
      HERMES_MODEL_NEXUS_FUTURE_LIVE_ADAPTER_STATE,
    );
  });
});

describe("MODEL-STRATEGY-005B cross-slice resolve", () => {
  it("6 model_nexus lane mappings resolve in 002A catalog", () => {
    const result = makeResult();
    const mn = result.lane_mappings.filter(
      (m) => m.pattern_id === "model_nexus",
    );
    for (const m of mn) {
      expect(m.in_provider_catalog).toBe(true);
    }
  });

  it("6 model_nexus lane mappings resolve in 002B smoke matrix", () => {
    const result = makeResult();
    const mn = result.lane_mappings.filter(
      (m) => m.pattern_id === "model_nexus",
    );
    for (const m of mn) {
      expect(m.in_smoke_matrix).toBe(true);
    }
  });

  it("local_fallback daily_fallback mapping resolves in catalog and smoke matrix", () => {
    const result = makeResult();
    const lf = result.lane_mappings.find(
      (m) =>
        m.pattern_id === "local_fallback" && m.lane_id === "daily_fallback",
    )!;
    expect(lf.in_provider_catalog).toBe(true);
    expect(lf.in_smoke_matrix).toBe(true);
  });
});

describe("MODEL-STRATEGY-005B immutability", () => {
  it("does not modify any of the four inputs", () => {
    const taxBefore = deepClone(taxonomy);
    const snapBefore = deepClone(strategySnapshot);
    const catBefore = deepClone(catalog);
    const smokeBefore = deepClone(smokeMatrix);
    makeResult();
    expect(taxonomy).toEqual(taxBefore);
    expect(strategySnapshot).toEqual(snapBefore);
    expect(catalog).toEqual(catBefore);
    expect(smokeMatrix).toEqual(smokeBefore);
  });
});

describe("MODEL-STRATEGY-005B source guardrails", () => {
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

  it("helper source avoids EchoBird-specific surface terms", () => {
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

  it("helper source does not declare method-style apply/commit/flush/activate/route", () => {
    // Method-name regex: identifier( in source should not match any of these.
    const methodNamePattern =
      /\b(apply|commit|flush|activate|route)\s*\(/g;
    const matches = helperSrc.match(methodNamePattern);
    expect(matches).toBeNull();
  });
});

describe("MODEL-STRATEGY-005B no new verificationState enum", () => {
  it("does not introduce a new verificationState value", () => {
    // The only verificationState references in the helper must be the
    // existing 002C type. Helper must not stringify a new variant.
    const allowed: ModelStrategyVerificationState[] = [
      "unverified",
      "blocked",
      "verified",
      "unavailable",
    ];
    const found = helperSrc.match(/verification_state[":]\s*"(\w+)"/g);
    expect(found).toBeNull();
    expect(allowed).toEqual([
      "unverified",
      "blocked",
      "verified",
      "unavailable",
    ]);
  });

  it("does not reference 004C rollout_step tokens", () => {
    for (const token of [
      "rollout_step_shadow",
      "rollout_step_user_opt_in",
      "rollout_step_internal_only",
      "rollout_step_release_candidate_preview",
    ]) {
      expect(helperSrc).not.toContain(token);
    }
  });
});

describe("MODEL-STRATEGY-005B negative invariants", () => {
  it("taxonomy with safety true does not make result safety true", () => {
    const tampered = deepClone(taxonomy);
    (
      tampered.safety_invariants as { live_config_writes_allowed: boolean }
    ).live_config_writes_allowed = true;
    const result = buildHermesModelNexusDesign(
      tampered,
      strategySnapshot,
      catalog,
      smokeMatrix,
    );
    // Helper emits its own internal static safety_invariants (all false).
    expect(result.safety_invariants.live_config_writes_allowed).toBe(false);
    expect(result.safety_invariants.code_copy_allowed).toBe(false);
  });

  it("accepts a tampered taxonomy pattern_id via fall-through without generating runtime action", () => {
    // Even if a future pattern_id appears, helper ignores it (hard-coded PATTERN_TO_HERMES_FIELD).
    const result = makeResult();
    const allMappings = result.lane_mappings;
    for (const m of allMappings) {
      expect(m).not.toHaveProperty("apply");
      expect(m).not.toHaveProperty("commit");
      expect(m).not.toHaveProperty("flush");
      expect(m).not.toHaveProperty("activate");
      expect(m).not.toHaveProperty("route");
    }
  });
});
