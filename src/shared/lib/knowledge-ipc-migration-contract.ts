// Knowledge IPC Migration Slice 0: contract descriptor only.
// Pure data projection. No runtime, no IPC, no preload/main wiring change.
// Describes the planned migration of the 3 P0 direct-gateway methods
// (knowledgeSearch / knowledgeIngest / getGbrainStats) from preload raw
// fetch to main-process IPC. The migration is NOT applied by this slice.

export const KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION =
  "1.0.0" as const;

export const KNOWLEDGE_IPC_MIGRATION_CONTRACT_MODE =
  "migration_contract_only" as const;

export const KNOWLEDGE_IPC_MIGRATION_CONTRACT_DISPLAY_STATUS =
  "display_only" as const;

export type KnowledgeIpcMigrationStatus =
  | "planned_not_applied"
  | "in_progress"
  | "applied"
  | "rolled_back";

export type KnowledgeIpcMigrationPath = "preload_direct_gateway" | "main_ipc";

export type KnowledgeIpcMigrationView = "knowledge" | "knowledgeControl";

export interface KnowledgeIpcMigrationMethod {
  name: "knowledgeSearch" | "knowledgeIngest" | "getGbrainStats";
  risk_level: "P0";
  current_path: KnowledgeIpcMigrationPath;
  target_path: KnowledgeIpcMigrationPath;
  proposed_ipc_channel: string;
  migration_status: KnowledgeIpcMigrationStatus;
}

export interface KnowledgeIpcMigrationContract {
  schema_version: typeof KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION;
  mode: typeof KNOWLEDGE_IPC_MIGRATION_CONTRACT_MODE;
  source_risk: "direct_gateway_preload_fetch";
  display_status: typeof KNOWLEDGE_IPC_MIGRATION_CONTRACT_DISPLAY_STATUS;
  affected_methods: readonly KnowledgeIpcMigrationMethod[];
  current_path_label: string;
  target_path_label: string;
  affected_views: readonly KnowledgeIpcMigrationView[];
  // Phrases the contract explicitly disclaims. Used by tests to lock the
  // descriptive copy against accidental recovery claims.
  forbidden_claims: readonly string[];
  safety: {
    runtime_migration_applied: false;
    preload_fetch_removed: false;
    main_ipc_handlers_added: false;
    renderer_behavior_changed: false;
    config_writes_allowed: false;
    credential_access_allowed: false;
    live_gateway_activation_allowed: false;
    audit_write_allowed: false;
  };
}

const METHODS: readonly KnowledgeIpcMigrationMethod[] = [
  {
    name: "knowledgeSearch",
    risk_level: "P0",
    current_path: "preload_direct_gateway",
    target_path: "main_ipc",
    proposed_ipc_channel: "knowledge-search",
    migration_status: "planned_not_applied",
  },
  {
    name: "knowledgeIngest",
    risk_level: "P0",
    current_path: "preload_direct_gateway",
    target_path: "main_ipc",
    proposed_ipc_channel: "knowledge-ingest",
    migration_status: "planned_not_applied",
  },
  {
    name: "getGbrainStats",
    risk_level: "P0",
    current_path: "preload_direct_gateway",
    target_path: "main_ipc",
    proposed_ipc_channel: "knowledge-stats",
    migration_status: "planned_not_applied",
  },
];

const FORBIDDEN_CLAIMS: readonly string[] = [
  "fixed",
  "migrated",
  "resolved",
  "protected_by_ipc",
  "safe",
];

export const KNOWLEDGE_IPC_MIGRATION_CONTRACT: KnowledgeIpcMigrationContract =
  {
    schema_version: KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION,
    mode: KNOWLEDGE_IPC_MIGRATION_CONTRACT_MODE,
    source_risk: "direct_gateway_preload_fetch",
    display_status: KNOWLEDGE_IPC_MIGRATION_CONTRACT_DISPLAY_STATUS,
    affected_methods: METHODS,
    current_path_label:
      "preload direct fetch to localhost gateway (raw fetch bypasses main-process IPC)",
    target_path_label:
      "renderer -> preload hermesAPI method -> ipcRenderer.invoke -> main handler -> gateway request",
    affected_views: ["knowledge", "knowledgeControl"],
    forbidden_claims: FORBIDDEN_CLAIMS,
    safety: {
      runtime_migration_applied: false,
      preload_fetch_removed: false,
      main_ipc_handlers_added: false,
      renderer_behavior_changed: false,
      config_writes_allowed: false,
      credential_access_allowed: false,
      live_gateway_activation_allowed: false,
      audit_write_allowed: false,
    },
  };

export function getKnowledgeIpcMigrationContract(): KnowledgeIpcMigrationContract {
  return KNOWLEDGE_IPC_MIGRATION_CONTRACT;
}

export function getKnowledgeIpcMigrationMethod(
  name: KnowledgeIpcMigrationMethod["name"],
): KnowledgeIpcMigrationMethod | undefined {
  return KNOWLEDGE_IPC_MIGRATION_CONTRACT.affected_methods.find(
    (method) => method.name === name,
  );
}
