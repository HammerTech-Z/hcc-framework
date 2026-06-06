// Hermes Pro live config adapter approval contract (MODEL-STRATEGY-006B).
// Design-only contract data for a future approved adapter. This helper does
// not perform filesystem, IPC, network, credential, keychain, or runtime work.

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyLaneId,
} from "./model-strategy-dry-run";

export const LIVE_CONFIG_ADAPTER_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;
export const LIVE_CONFIG_ADAPTER_CONTRACT_MODE =
  "approval_contract_only" as const;
export const LIVE_CONFIG_ADAPTER_APPROVAL_STATE = "not_approved" as const;
export const LIVE_CONFIG_ADAPTER_EXPLICIT_APPROVAL_PHRASE =
  "我授权写入 ~/.hermes/config.yaml" as const;
export const LIVE_CONFIG_ADAPTER_FUTURE_STATE =
  "006_live_config_adapter_remains_future_requires_explicit_approval" as const;

export type LiveConfigAdapterState =
  | "not_approved"
  | "contract_drafted"
  | "requires_explicit_user_approval"
  | "backup_completed_and_verified"
  | "write_performed"
  | "post_write_verification_passed"
  | "rollback_completed";

export interface LiveConfigBackupSpec {
  backup_command: string;
  backup_target_path: string;
  verify_backup_command: string;
  rollback_command: string;
  dry_run_only: true;
  requires_explicit_approval: true;
}

export interface LiveConfigWriteField {
  config_path: string;
  field_description: string;
  allowed_value_source:
    | "user_input"
    | "derived_from_catalog_only"
    | "not_allowed_to_write";
  secret_redaction_required: boolean;
  requires_pre_write_backup: boolean;
  applies_to_lanes: readonly ModelStrategyLaneId[];
  reason: string;
}

export interface LiveConfigApprovalContract {
  schema_version: typeof LIVE_CONFIG_ADAPTER_CONTRACT_SCHEMA_VERSION;
  mode: typeof LIVE_CONFIG_ADAPTER_CONTRACT_MODE;
  reference_only: true;
  approval_state: typeof LIVE_CONFIG_ADAPTER_APPROVAL_STATE;
  explicit_approval_phrase: typeof LIVE_CONFIG_ADAPTER_EXPLICIT_APPROVAL_PHRASE;
  future_live_adapter_state: typeof LIVE_CONFIG_ADAPTER_FUTURE_STATE;
  lane_order: readonly ModelStrategyLaneId[];
  backup_spec: LiveConfigBackupSpec;
  write_field_spec: readonly LiveConfigWriteField[];
  rollback_spec: LiveConfigBackupSpec;
  pre_write_validation_checks: readonly string[];
  post_write_verification_checks: readonly string[];
  safety_invariants: {
    live_config_writes_allowed: false;
    automatic_routing_enabled: false;
    runtime_router_allowed: false;
    hcc_auto_executor_allowed: false;
    credential_pool_allowed: false;
    keychain_integration_allowed: false;
    local_runtime_activation_allowed: false;
    api_key_write_allowed: false;
    secret_write_allowed: false;
  };
  rollback_baseline_reference: {
    daily_model: string;
    task_fallback_model: string;
    live_config_write_allowed: false;
  };
}

type ContractDraftInput = Partial<
  Omit<
    LiveConfigApprovalContract,
    | "schema_version"
    | "mode"
    | "reference_only"
    | "approval_state"
    | "explicit_approval_phrase"
    | "future_live_adapter_state"
    | "lane_order"
    | "backup_spec"
    | "write_field_spec"
    | "rollback_spec"
    | "pre_write_validation_checks"
    | "post_write_verification_checks"
    | "safety_invariants"
    | "rollback_baseline_reference"
  >
> & {
  approval_state?: string;
  backup_command?: string;
};

const BACKUP_TARGET_PATH = "~/.hermes/config.yaml.bak.<timestamp>" as const;

const PRE_WRITE_VALIDATION_CHECKS = [
  "snapshot rollback baseline unchanged from 001 fixture",
  "no secret-like field or value in payload",
  "explicit user approval phrase confirmed",
  "backup file created and verified",
  "no provider has empty base_url unless local fallback with localhost",
] as const;

const POST_WRITE_VERIFICATION_CHECKS = [
  "config.yaml parseable as YAML",
  "rollback_baseline fields unchanged from pre-write snapshot",
  "provider_defaults keys match 001 lane identifiers",
  "no API key / token / secret-like values in written config",
] as const;

function buildBackupSpec(): LiveConfigBackupSpec {
  return {
    backup_command:
      "cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak.<timestamp>",
    backup_target_path: BACKUP_TARGET_PATH,
    verify_backup_command:
      "diff ~/.hermes/config.yaml ~/.hermes/config.yaml.bak.<timestamp>",
    rollback_command:
      "mv ~/.hermes/config.yaml.bak.<timestamp> ~/.hermes/config.yaml",
    dry_run_only: true,
    requires_explicit_approval: true,
  };
}

function buildWriteFieldSpec(
  laneOrder: readonly ModelStrategyLaneId[],
): readonly LiveConfigWriteField[] {
  return [
    {
      config_path: "provider_defaults[<lane>].provider",
      field_description: "provider_id per lane",
      allowed_value_source: "derived_from_catalog_only",
      secret_redaction_required: false,
      requires_pre_write_backup: true,
      applies_to_lanes: laneOrder,
      reason: "user opts into candidate via UI, not direct edit",
    },
    {
      config_path: "provider_defaults[<lane>].base_url",
      field_description: "base_url per lane",
      allowed_value_source: "user_input",
      secret_redaction_required: false,
      requires_pre_write_backup: true,
      applies_to_lanes: laneOrder,
      reason: "user supplies own endpoint",
    },
    {
      config_path: "provider_defaults[<lane>].model_id",
      field_description: "model_id per lane",
      allowed_value_source: "derived_from_catalog_only",
      secret_redaction_required: false,
      requires_pre_write_backup: true,
      applies_to_lanes: laneOrder,
      reason: "resolved from 002A catalog",
    },
    {
      config_path: "provider_defaults[<lane>].api_key",
      field_description: "API key",
      allowed_value_source: "not_allowed_to_write",
      secret_redaction_required: true,
      requires_pre_write_backup: true,
      applies_to_lanes: laneOrder,
      reason: "never stored in config",
    },
    {
      config_path: "rollback_baseline",
      field_description: "daily_model + task_fallback_model",
      allowed_value_source: "derived_from_catalog_only",
      secret_redaction_required: false,
      requires_pre_write_backup: true,
      applies_to_lanes: ["daily", "task_fallback"],
      reason: "must match 001 legacy baseline",
    },
    {
      config_path: "candidate_profile",
      field_description: "current unverified lanes",
      allowed_value_source: "not_allowed_to_write",
      secret_redaction_required: false,
      requires_pre_write_backup: true,
      applies_to_lanes: laneOrder,
      reason: "004A projection only",
    },
  ] as const;
}

export function buildLiveConfigApprovalContract(
  strategyFixture: ModelStrategyDryRunFixture,
  _draftInput?: ContractDraftInput,
): LiveConfigApprovalContract {
  const laneOrder = strategyFixture.lanes.map((lane) => lane.lane);
  return {
    schema_version: LIVE_CONFIG_ADAPTER_CONTRACT_SCHEMA_VERSION,
    mode: LIVE_CONFIG_ADAPTER_CONTRACT_MODE,
    reference_only: true,
    approval_state: LIVE_CONFIG_ADAPTER_APPROVAL_STATE,
    explicit_approval_phrase: LIVE_CONFIG_ADAPTER_EXPLICIT_APPROVAL_PHRASE,
    future_live_adapter_state: LIVE_CONFIG_ADAPTER_FUTURE_STATE,
    lane_order: laneOrder,
    backup_spec: buildBackupSpec(),
    write_field_spec: buildWriteFieldSpec(laneOrder),
    rollback_spec: buildBackupSpec(),
    pre_write_validation_checks: PRE_WRITE_VALIDATION_CHECKS,
    post_write_verification_checks: POST_WRITE_VERIFICATION_CHECKS,
    safety_invariants: {
      live_config_writes_allowed: false,
      automatic_routing_enabled: false,
      runtime_router_allowed: false,
      hcc_auto_executor_allowed: false,
      credential_pool_allowed: false,
      keychain_integration_allowed: false,
      local_runtime_activation_allowed: false,
      api_key_write_allowed: false,
      secret_write_allowed: false,
    },
    rollback_baseline_reference: {
      daily_model: strategyFixture.rollback_baseline.daily_model,
      task_fallback_model: strategyFixture.rollback_baseline.task_fallback_model,
      live_config_write_allowed:
        strategyFixture.rollback_baseline.live_config_write_allowed,
    },
  };
}
