import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import {
  ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT,
  type EchobirdPatternTaxonomySnapshot,
} from "../src/shared/lib/echobird-pattern-taxonomy";
import {
  MODEL_STRATEGY_DRY_RUN_SNAPSHOT,
  PROVIDER_CATALOG_SNAPSHOT,
  SMOKE_TEST_MATRIX_SNAPSHOT,
} from "../src/shared/lib/model-strategy-snapshots";
import { buildHermesModelNexusDesign } from "../src/shared/lib/hermes-model-nexus-design";
import {
  buildHermesInstallRecoveryDesign,
  HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN,
  HERMES_INSTALL_RECOVERY_CATEGORY_COUNT,
  HERMES_INSTALL_RECOVERY_DESIGN_NOTE,
  HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE,
  HERMES_INSTALL_RECOVERY_MODE,
  HERMES_INSTALL_RECOVERY_SCHEMA_VERSION,
  type HermesInstallRecoveryCategory,
  type HermesInstallRecoveryDesignResult,
  type InstallErrorCategoryId,
  type InstallRecoveryActionKind,
} from "../src/shared/lib/hermes-install-recovery-design";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/hermes-install-recovery-design.ts"),
  "utf-8",
);

const taxonomy: EchobirdPatternTaxonomySnapshot = ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT;

const EXPECTED_CATEGORY_ORDER: readonly InstallErrorCategoryId[] = [
  "network_blocked",
  "python_missing",
  "permission_denied",
  "version_conflict",
  "unknown",
];

const EXPECTED_ACTION_KIND: Readonly<
  Record<InstallErrorCategoryId, InstallRecoveryActionKind>
> = {
  network_blocked: "manual_install",
  python_missing: "manual_install",
  permission_denied: "consult_docs",
  version_conflict: "consult_docs",
  unknown: "report_issue",
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("MODEL-STRATEGY-005C schema pins", () => {
  it("uses schema 1.0.0 and read_only_install_diagnostics mode", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    expect(HERMES_INSTALL_RECOVERY_SCHEMA_VERSION).toBe("1.0.0");
    expect(HERMES_INSTALL_RECOVERY_MODE).toBe("read_only_install_diagnostics");
    expect(result.schema_version).toBe("1.0.0");
    expect(result.mode).toBe("read_only_install_diagnostics");
  });

  it("reference_only and applies_to_pattern are pinned to install_repair", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    expect(result.reference_only).toBe(true);
    expect(result.applies_to_pattern).toBe("install_repair");
    expect(HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN).toBe("install_repair");
  });

  it("emits exactly 5 categories", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    expect(result.category_count).toBe(5);
    expect(HERMES_INSTALL_RECOVERY_CATEGORY_COUNT).toBe(5);
    expect(result.categories).toHaveLength(5);
  });

  it("categories appear in canonical order", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    expect(result.categories.map((c) => c.category_id)).toEqual(
      EXPECTED_CATEGORY_ORDER,
    );
  });
});

describe("MODEL-STRATEGY-005C per-category protection flags", () => {
  it("every category has read_only and requires_user_intervention as true", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.read_only).toBe(true);
      expect(c.requires_user_intervention).toBe(true);
    }
  });

  it("every category blocks install_script_execution, automatic_repair, and silent_fix", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.install_script_execution_allowed).toBe(false);
      expect(c.automatic_repair_allowed).toBe(false);
      expect(c.silent_fix_allowed).toBe(false);
    }
  });

  it("every category sets no_code_copy / no_install_script_copy / no_runtime_behavior_copy as true", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.no_code_copy).toBe(true);
      expect(c.no_install_script_copy).toBe(true);
      expect(c.no_runtime_behavior_copy).toBe(true);
      expect(c.reference_only).toBe(true);
    }
  });

  it("every category carries source_pattern_taxonomy_id and 006 future state", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.source_pattern_taxonomy_id).toBe(
        taxonomy.source_reference_url,
      );
      expect(c.future_live_adapter_state).toBe(
        HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE,
      );
      expect(c.applies_to_pattern).toBe("install_repair");
    }
  });
});

describe("MODEL-STRATEGY-005C per-category recommended_action_kind", () => {
  it("maps each category to the canonical action kind", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.recommended_action_kind).toBe(
        EXPECTED_ACTION_KIND[c.category_id],
      );
    }
  });

  it("no category uses automatic_repair / silent_fix / auto_install / auto_fix", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.recommended_action_kind).not.toBe("automatic_repair");
      expect(c.recommended_action_kind).not.toBe("silent_fix");
      expect(c.recommended_action_kind).not.toBe("auto_install");
      expect(c.recommended_action_kind).not.toBe("auto_fix");
    }
  });

  it("forbidden_use lists the 4 forbidden categories for every category", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    for (const c of result.categories) {
      expect(c.forbidden_use).toEqual([
        "install_script_execution",
        "automatic_repair",
        "silent_fix",
        "runtime_behavior_replication",
      ]);
    }
  });
});

describe("MODEL-STRATEGY-005C safety invariants", () => {
  it("all 8 safety invariants are hard false", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
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

  it("result future_live_adapter_state is the canonical 006 literal", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    expect(HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE).toBe(
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    );
    expect(result.future_live_adapter_state).toBe(
      HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE,
    );
    expect(HERMES_INSTALL_RECOVERY_DESIGN_NOTE).toContain(
      "006 Live config adapter remains future",
    );
  });
});

describe("MODEL-STRATEGY-005C immutability and default path", () => {
  it("does not modify taxonomy input", () => {
    const before = deepClone(taxonomy);
    buildHermesInstallRecoveryDesign(taxonomy);
    expect(taxonomy).toEqual(before);
  });

  it("default installErrorCategories path returns 5 categories", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy);
    expect(result.categories).toHaveLength(5);
  });

  it("explicit installErrorCategories with unknown id does not introduce new enum value", () => {
    const result = buildHermesInstallRecoveryDesign(taxonomy, [
      "network_blocked",
      "totally_made_up_category" as InstallErrorCategoryId,
    ]);
    // Unknown category is dropped; no new category_id appears in result.
    expect(result.categories.map((c) => c.category_id)).toEqual([
      "network_blocked",
      "python_missing",
      "permission_denied",
      "version_conflict",
      "unknown",
    ]);
  });

  it("missing install_repair pattern in taxonomy still returns 5 categories without throwing", () => {
    const tampered = deepClone(taxonomy);
    tampered.patterns = tampered.patterns.filter(
      (p) => p.pattern_id !== "install_repair",
    );
    expect(() => buildHermesInstallRecoveryDesign(tampered)).not.toThrow();
    const result = buildHermesInstallRecoveryDesign(tampered);
    expect(result.categories).toHaveLength(5);
  });
});

describe("MODEL-STRATEGY-005C source guardrails", () => {
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

  it("helper source does not declare method-style install / repair / execute / run / auto_fix / silent_fix / apply / commit / flush / activate / route", () => {
    const methodNamePattern =
      /\b(install|repair|execute|run|auto_fix|silent_fix|apply|commit|flush|activate|route)\s*\(/g;
    const matches = helperSrc.match(methodNamePattern);
    expect(matches).toBeNull();
  });

  it("helper source does not reference 004C rollout_step tokens", () => {
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

describe("MODEL-STRATEGY-005C cross-subslice alignment", () => {
  it("install_repair pattern summary in 005B uses install_recovery_diagnostics field", () => {
    const designB = buildHermesModelNexusDesign(
      ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT,
      MODEL_STRATEGY_DRY_RUN_SNAPSHOT,
      PROVIDER_CATALOG_SNAPSHOT,
      SMOKE_TEST_MATRIX_SNAPSHOT,
    );

    const installRepairSummary = designB.pattern_summaries.find(
      (summary) => summary.pattern_id === "install_repair",
    );

    expect(installRepairSummary).toBeTruthy();
    expect(installRepairSummary?.hermes_native_field).toBe(
      "install_recovery_diagnostics",
    );
  });

  it("005C result.applies_to_pattern === install_repair matches 005B install_repair pattern", () => {
    const designB = buildHermesModelNexusDesign(
      ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT,
      MODEL_STRATEGY_DRY_RUN_SNAPSHOT,
      PROVIDER_CATALOG_SNAPSHOT,
      SMOKE_TEST_MATRIX_SNAPSHOT,
    );
    const resultC = buildHermesInstallRecoveryDesign(ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT);

    const installRepairSummary = designB.pattern_summaries.find(
      (summary) => summary.pattern_id === "install_repair",
    );

    expect(resultC.applies_to_pattern).toBe("install_repair");
    expect(installRepairSummary?.hermes_native_field).toBe(
      "install_recovery_diagnostics",
    );
  });

  it("005C does not import 004C rollout_step tokens", () => {
    // Indirect cross-slice: 005C imports 005A taxonomy only, never 004C.
    const import004 = /\.\/profile-rollout-simulation/;
    expect(import004.test(helperSrc)).toBe(false);
  });
});

// Type-only sentinel: HermesInstallRecoveryCategory is the only descriptor type.
type _DescriptorTypeSentinel = HermesInstallRecoveryCategory;
type _DescriptorResultSentinel = HermesInstallRecoveryDesignResult;
