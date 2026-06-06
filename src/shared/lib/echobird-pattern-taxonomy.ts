// Hermes Pro EchoBird pattern taxonomy (MODEL-STRATEGY-005A).
// Read-only / design-reference-only taxonomy of EchoBird product patterns
// that may inform Hermes-native design work.
//
// 005 is read-only design-only. 006 Live config adapter remains future and
// requires explicit approval. No EchoBird source code, UI composition,
// install scripts, or runtime behavior may be copied into Hermes.
//
// Reference: https://github.com/edison7009/EchoBird (BUSL-1.1)
// Hermes never imports, forks, or traces EchoBird source.

import type { ModelStrategyLaneId } from "./model-strategy-dry-run";

export const ECHOBIRD_TAXONOMY_SCHEMA_VERSION = "1.0.0" as const;
export const ECHOBIRD_TAXONOMY_MODE = "design_reference_only" as const;
export const ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL =
  "https://github.com/edison7009/EchoBird" as const;

export type EchobirdPatternId =
  | "model_nexus"
  | "local_fallback"
  | "install_repair"
  | "project_management";

export type EchobirdRiskClass = "low" | "medium" | "high";

export type EchobirdForbiddenUse =
  | "code_copy"
  | "ui_composition_copy"
  | "install_script_copy"
  | "runtime_behavior_copy";

export const ECHOBIRD_FORBIDDEN_USES: readonly EchobirdForbiddenUse[] = [
  "code_copy",
  "ui_composition_copy",
  "install_script_copy",
  "runtime_behavior_copy",
] as const;

export interface EchobirdLicenseConstraints {
  license: "BUSL-1.1";
  private_core: "echobird_core";
  trade_dress: true;
  hermes_code_copy_forbidden: true;
  hermes_ui_composition_copy_forbidden: true;
  hermes_install_script_copy_forbidden: true;
  hermes_runtime_behavior_copy_forbidden: true;
}

export interface EchobirdPattern {
  pattern_id: EchobirdPatternId;
  echobird_surface: string;
  hermes_target: string;
  value: "low" | "medium" | "medium-high" | "high";
  risk_class: EchobirdRiskClass;
  licensing_constraint: EchobirdLicenseConstraints;
  allowed_use: "design_reference_only";
  forbidden_use: readonly EchobirdForbiddenUse[];
  applicable_lane_ids: ModelStrategyLaneId[];
  // 显式说明：006 Live config adapter 保持 future / requires explicit approval
  future_live_adapter_state:
    "006_live_config_adapter_remains_future_requires_explicit_approval";
  contains_live_routing_keywords: false;
  contains_live_config_keywords: false;
  contains_runtime_dispatch_keywords: false;
}

export interface EchobirdPatternTaxonomySnapshot {
  schema_version: typeof ECHOBIRD_TAXONOMY_SCHEMA_VERSION;
  mode: typeof ECHOBIRD_TAXONOMY_MODE;
  status: "planned";
  active_profile: string;
  source_reference_url: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
  reference_only: true;
  description_note: string;
  license_constraints: EchobirdLicenseConstraints;
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
  future_live_adapter_state:
    "006_live_config_adapter_remains_future_requires_explicit_approval";
  patterns: EchobirdPattern[];
}

const LICENSE_CONSTRAINTS: EchobirdLicenseConstraints = {
  license: "BUSL-1.1",
  private_core: "echobird_core",
  trade_dress: true,
  hermes_code_copy_forbidden: true,
  hermes_ui_composition_copy_forbidden: true,
  hermes_install_script_copy_forbidden: true,
  hermes_runtime_behavior_copy_forbidden: true,
};

const FORBIDDEN_USE_LIST: readonly EchobirdForbiddenUse[] =
  ECHOBIRD_FORBIDDEN_USES;

const PATTERNS: EchobirdPattern[] = [
  {
    pattern_id: "model_nexus",
    echobird_surface:
      "Central model data hub: provider directory, latency test, model ID resolution, rollback state.",
    hermes_target:
      "Hermes-native model strategy catalog descriptor (read-only, design reference only).",
    value: "high",
    risk_class: "medium",
    licensing_constraint: LICENSE_CONSTRAINTS,
    allowed_use: "design_reference_only",
    forbidden_use: FORBIDDEN_USE_LIST,
    applicable_lane_ids: [
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ],
    future_live_adapter_state:
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    contains_live_routing_keywords: false,
    contains_live_config_keywords: false,
    contains_runtime_dispatch_keywords: false,
  },
  {
    pattern_id: "local_fallback",
    echobird_surface:
      "One-click local LLM: vLLM / SGLang / llama.cpp local runtime choice.",
    hermes_target:
      "Hermes daily_fallback lane: structural-only smoke + 001 fallback model + 002B base URL check.",
    value: "medium-high",
    risk_class: "medium",
    licensing_constraint: LICENSE_CONSTRAINTS,
    allowed_use: "design_reference_only",
    forbidden_use: FORBIDDEN_USE_LIST,
    applicable_lane_ids: ["daily_fallback"],
    future_live_adapter_state:
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    contains_live_routing_keywords: false,
    contains_live_config_keywords: false,
    contains_runtime_dispatch_keywords: false,
  },
  {
    pattern_id: "install_repair",
    echobird_surface:
      "Install & Repair Agent: tool install manifests and failure recovery.",
    hermes_target:
      "Hermes-native install/recovery read-only diagnostics descriptor (future slice 005C).",
    value: "high",
    risk_class: "low",
    licensing_constraint: LICENSE_CONSTRAINTS,
    allowed_use: "design_reference_only",
    forbidden_use: FORBIDDEN_USE_LIST,
    applicable_lane_ids: [],
    future_live_adapter_state:
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    contains_live_routing_keywords: false,
    contains_live_config_keywords: false,
    contains_runtime_dispatch_keywords: false,
  },
  {
    pattern_id: "project_management",
    echobird_surface:
      "My AI Projects + App Manager: launch/manage AI tools and projects.",
    hermes_target:
      "HCC Cockpit product inventory surface (future sub-slice, read-only).",
    value: "medium",
    risk_class: "low",
    licensing_constraint: LICENSE_CONSTRAINTS,
    allowed_use: "design_reference_only",
    forbidden_use: FORBIDDEN_USE_LIST,
    applicable_lane_ids: [],
    future_live_adapter_state:
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    contains_live_routing_keywords: false,
    contains_live_config_keywords: false,
    contains_runtime_dispatch_keywords: false,
  },
];

export const ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT: EchobirdPatternTaxonomySnapshot =
  {
    schema_version: ECHOBIRD_TAXONOMY_SCHEMA_VERSION,
    mode: ECHOBIRD_TAXONOMY_MODE,
    status: "planned",
    active_profile: "hermes-balanced-2026-06",
    source_reference_url: ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
    reference_only: true,
    description_note:
      "005 is read-only design-only. No EchoBird source code, UI composition, install scripts, or runtime behavior may be copied into Hermes. 006 Live config adapter remains future and requires explicit approval.",
    license_constraints: LICENSE_CONSTRAINTS,
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
    future_live_adapter_state:
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    patterns: PATTERNS,
  } as const;

export const ECHOBIRD_TAXONOMY_DESIGN_NOTE =
  "005 is read-only design-only. 006 Live config adapter remains future and requires explicit approval. No EchoBird source code, UI composition, install scripts, or runtime behavior may be copied into Hermes.";

export default ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT;
