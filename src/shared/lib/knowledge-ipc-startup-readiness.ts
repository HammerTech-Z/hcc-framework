// Knowledge IPC Migration Slice 5: startup registration readiness contract.
// Pure data projection. No runtime, no startup wiring, no IPC, no preload
// switch. Describes the prerequisites for the NEXT slice to wire the
// knowledge IPC handlers into src/main/index.ts. The startup wiring is
// NOT applied by this slice.

export const KNOWLEDGE_IPC_STARTUP_READINESS_SCHEMA_VERSION =
  "1.0.0" as const;

export const KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT_MODE =
  "startup_readiness_contract_only" as const;

export const KNOWLEDGE_IPC_STARTUP_READINESS_STATUS =
  "ready_for_explicit_startup_wiring_approval" as const;

export const KNOWLEDGE_IPC_STARTUP_READINESS_TARGET_FILE =
  "src/main/index.ts" as const;

export interface KnowledgeIpcStartupReadinessChannel {
  channel: string;
  helper_to_register:
    | "registerKnowledgeIpcHandlers"
    | "createKnowledgeGatewayClient";
}

export interface KnowledgeIpcStartupReadinessRequiredImport {
  symbol: string;
  from: string;
}

export interface KnowledgeIpcStartupReadinessSafetyGate {
  id: string;
  description: string;
  enforced: false;
}

export interface KnowledgeIpcStartupReadinessContract {
  schema_version: string;
  mode: string;
  readiness_status: string;
  expected_startup_hook_target: string;
  required_helper_imports: readonly KnowledgeIpcStartupReadinessRequiredImport[];
  required_channels: readonly KnowledgeIpcStartupReadinessChannel[];
  required_safety_gates: readonly KnowledgeIpcStartupReadinessSafetyGate[];
  startup_wiring_applied: false;
  preload_switch_applied: false;
  safety: {
    startup_wiring_applied: false;
    preload_switch_applied: false;
    renderer_behavior_changed: false;
    auto_gateway_start_allowed: false;
    config_write_allowed: false;
    audit_write_allowed: false;
    live_runtime_path_changed: false;
  };
  warnings: readonly string[];
  blockers: readonly string[];
}

const REQUIRED_IMPORTS: readonly KnowledgeIpcStartupReadinessRequiredImport[] =
  [
    {
      symbol: "registerKnowledgeIpcHandlers",
      from: "src/main/knowledge-ipc-handlers",
    },
    {
      symbol: "createKnowledgeGatewayClient",
      from: "src/main/knowledge-ipc-gateway-client",
    },
  ];

const REQUIRED_CHANNELS: readonly KnowledgeIpcStartupReadinessChannel[] = [
  {
    channel: "knowledge-search",
    helper_to_register: "registerKnowledgeIpcHandlers",
  },
  {
    channel: "knowledge-ingest",
    helper_to_register: "registerKnowledgeIpcHandlers",
  },
  {
    channel: "knowledge-stats",
    helper_to_register: "registerKnowledgeIpcHandlers",
  },
];

const REQUIRED_SAFETY_GATES: readonly KnowledgeIpcStartupReadinessSafetyGate[] =
  [
    {
      id: "no_preload_switch_in_same_slice",
      description:
        "no preload switch in same slice unless explicit approval",
      enforced: false,
    },
    {
      id: "no_renderer_behavior_change",
      description: "no renderer behavior change",
      enforced: false,
    },
    {
      id: "no_auto_gateway_start",
      description: "no auto gateway start",
      enforced: false,
    },
    {
      id: "no_config_write",
      description: "no config write",
      enforced: false,
    },
    {
      id: "no_audit_write",
      description: "no audit write",
      enforced: false,
    },
  ];

const WARNINGS: readonly string[] = [
  "startup wiring makes handlers available but does not change UI until preload switch",
];

export const KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT: KnowledgeIpcStartupReadinessContract =
  {
    schema_version: KNOWLEDGE_IPC_STARTUP_READINESS_SCHEMA_VERSION,
    mode: KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT_MODE,
    readiness_status: KNOWLEDGE_IPC_STARTUP_READINESS_STATUS,
    expected_startup_hook_target: KNOWLEDGE_IPC_STARTUP_READINESS_TARGET_FILE,
    required_helper_imports: REQUIRED_IMPORTS,
    required_channels: REQUIRED_CHANNELS,
    required_safety_gates: REQUIRED_SAFETY_GATES,
    startup_wiring_applied: false,
    preload_switch_applied: false,
    safety: {
      startup_wiring_applied: false,
      preload_switch_applied: false,
      renderer_behavior_changed: false,
      auto_gateway_start_allowed: false,
      config_write_allowed: false,
      audit_write_allowed: false,
      live_runtime_path_changed: false,
    },
    warnings: WARNINGS,
    blockers: [],
  };

export function getKnowledgeIpcStartupReadinessContract(): KnowledgeIpcStartupReadinessContract {
  return KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT;
}

export function getKnowledgeIpcStartupReadinessRequiredImports(): readonly KnowledgeIpcStartupReadinessRequiredImport[] {
  return KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT.required_helper_imports;
}

export function getKnowledgeIpcStartupReadinessChannels(): readonly KnowledgeIpcStartupReadinessChannel[] {
  return KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT.required_channels;
}
