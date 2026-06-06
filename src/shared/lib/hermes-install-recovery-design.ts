// Hermes Pro Hermes-native install / recovery read-only diagnostics
// descriptor (MODEL-STRATEGY-005C).
//
// Pure design descriptor: produces 5 install-error categories. No install
// script is executed. No repair is performed. 006 Live config adapter
// remains future and requires explicit approval. No install / repair /
// execute / run / auto_fix / silent_fix / apply / commit / flush /
// activate / route method surface.

import {
  ECHOBIRD_TAXONOMY_DESIGN_NOTE,
  ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
  type EchobirdPatternTaxonomySnapshot,
} from "./echobird-pattern-taxonomy";

export const HERMES_INSTALL_RECOVERY_SCHEMA_VERSION = "1.0.0" as const;
export const HERMES_INSTALL_RECOVERY_MODE = "read_only_install_diagnostics" as const;

export const HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE =
  "006_live_config_adapter_remains_future_requires_explicit_approval" as const;

export const HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN = "install_repair" as const;
export const HERMES_INSTALL_RECOVERY_CATEGORY_COUNT = 5 as const;

export type InstallErrorCategoryId =
  | "network_blocked"
  | "python_missing"
  | "permission_denied"
  | "version_conflict"
  | "unknown";

export type InstallRecoveryActionKind =
  | "manual_install"
  | "consult_docs"
  | "report_issue";

export type InstallRecoveryForbiddenUse =
  | "install_script_execution"
  | "automatic_repair"
  | "silent_fix"
  | "runtime_behavior_replication";

const FORBIDDEN_USE_LIST: readonly InstallRecoveryForbiddenUse[] = [
  "install_script_execution",
  "automatic_repair",
  "silent_fix",
  "runtime_behavior_replication",
];

const ALLOWED_ACTION_KINDS: readonly InstallRecoveryActionKind[] = [
  "manual_install",
  "consult_docs",
  "report_issue",
];

interface CategorySeed {
  category_id: InstallErrorCategoryId;
  display_name: string;
  hermes_native_description: string;
  recommended_action_kind: InstallRecoveryActionKind;
}

const CATEGORY_SEEDS: readonly CategorySeed[] = [
  {
    category_id: "network_blocked",
    display_name: "Network blocked during install",
    hermes_native_description:
      "Network access is blocked, restricted, or routed through a proxy or firewall that prevents downloading install dependencies.",
    recommended_action_kind: "manual_install",
  },
  {
    category_id: "python_missing",
    display_name: "Python runtime missing",
    hermes_native_description:
      "The Python interpreter or a required virtual environment cannot be located on the host for Hermes install.",
    recommended_action_kind: "manual_install",
  },
  {
    category_id: "permission_denied",
    display_name: "Permission denied",
    hermes_native_description:
      "The current user lacks read or write access to the install target path, cache, or required system directories.",
    recommended_action_kind: "consult_docs",
  },
  {
    category_id: "version_conflict",
    display_name: "Version conflict",
    hermes_native_description:
      "A required runtime or dependency version is incompatible with Hermes; no automatic upgrade is attempted.",
    recommended_action_kind: "consult_docs",
  },
  {
    category_id: "unknown",
    display_name: "Unknown install failure",
    hermes_native_description:
      "An install failure was reported that does not match a known category; manual triage is required.",
    recommended_action_kind: "report_issue",
  },
];

export interface HermesInstallRecoveryCategory {
  category_id: InstallErrorCategoryId;
  display_name: string;
  hermes_native_description: string;
  read_only: true;
  requires_user_intervention: true;
  install_script_execution_allowed: false;
  automatic_repair_allowed: false;
  silent_fix_allowed: false;
  recommended_action_kind: InstallRecoveryActionKind;
  no_code_copy: true;
  no_install_script_copy: true;
  no_runtime_behavior_copy: true;
  reference_only: true;
  forbidden_use: readonly InstallRecoveryForbiddenUse[];
  applies_to_pattern: typeof HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN;
  source_pattern_taxonomy_id: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
  future_live_adapter_state: typeof HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE;
}

export interface HermesInstallRecoveryDesignResult {
  schema_version: typeof HERMES_INSTALL_RECOVERY_SCHEMA_VERSION;
  mode: typeof HERMES_INSTALL_RECOVERY_MODE;
  reference_only: true;
  applies_to_pattern: typeof HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN;
  source_pattern_taxonomy_id: typeof ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL;
  design_note: typeof ECHOBIRD_TAXONOMY_DESIGN_NOTE;
  category_count: typeof HERMES_INSTALL_RECOVERY_CATEGORY_COUNT;
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
  future_live_adapter_state: typeof HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE;
  categories: HermesInstallRecoveryCategory[];
}

const SAFETY_INVARIANTS: HermesInstallRecoveryDesignResult["safety_invariants"] = {
  live_config_writes_allowed: false,
  automatic_runtime_routing_enabled: false,
  hcc_auto_executor_allowed: false,
  runtime_router_allowed: false,
  runtime_replication_allowed: false,
  install_script_execution_allowed: false,
  code_copy_allowed: false,
  ui_composition_copy_allowed: false,
};

function buildCategory(seed: CategorySeed): HermesInstallRecoveryCategory {
  if (!ALLOWED_ACTION_KINDS.includes(seed.recommended_action_kind)) {
    throw new Error(
      `install_recovery_action_kind_out_of_allowed_set:${seed.recommended_action_kind}`,
    );
  }
  return {
    category_id: seed.category_id,
    display_name: seed.display_name,
    hermes_native_description: seed.hermes_native_description,
    read_only: true,
    requires_user_intervention: true,
    install_script_execution_allowed: false,
    automatic_repair_allowed: false,
    silent_fix_allowed: false,
    recommended_action_kind: seed.recommended_action_kind,
    no_code_copy: true,
    no_install_script_copy: true,
    no_runtime_behavior_copy: true,
    reference_only: true,
    forbidden_use: FORBIDDEN_USE_LIST,
    applies_to_pattern: HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN,
    source_pattern_taxonomy_id: ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
    future_live_adapter_state: HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE,
  };
}

export function buildHermesInstallRecoveryDesign(
  _taxonomy: EchobirdPatternTaxonomySnapshot,
  installErrorCategories?: readonly InstallErrorCategoryId[],
): HermesInstallRecoveryDesignResult {
  // installErrorCategories is acknowledged but only 005A-defined category_ids
  // are emitted. Unknown ids are silently dropped (no new enum value).
  const allowedIds = new Set<InstallErrorCategoryId>(
    CATEGORY_SEEDS.map((s) => s.category_id),
  );
  void installErrorCategories;

  const categories: HermesInstallRecoveryCategory[] = CATEGORY_SEEDS.filter(
    (s) => allowedIds.has(s.category_id),
  ).map(buildCategory);

  return {
    schema_version: HERMES_INSTALL_RECOVERY_SCHEMA_VERSION,
    mode: HERMES_INSTALL_RECOVERY_MODE,
    reference_only: true,
    applies_to_pattern: HERMES_INSTALL_RECOVERY_APPLIES_TO_PATTERN,
    source_pattern_taxonomy_id: ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
    design_note: ECHOBIRD_TAXONOMY_DESIGN_NOTE,
    category_count: HERMES_INSTALL_RECOVERY_CATEGORY_COUNT,
    safety_invariants: SAFETY_INVARIANTS,
    future_live_adapter_state: HERMES_INSTALL_RECOVERY_FUTURE_LIVE_ADAPTER_STATE,
    categories,
  };
}

export const HERMES_INSTALL_RECOVERY_DESIGN_NOTE =
  "005C is read-only install diagnostics. No install / repair / execute / run / auto_fix / silent_fix method surface. 006 Live config adapter remains future and requires explicit approval.";
