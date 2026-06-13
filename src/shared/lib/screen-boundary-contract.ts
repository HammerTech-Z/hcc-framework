// UI Slice 1 screen boundary contract descriptor.
// Pure data projection only. No renderer wiring, no IPC, no network.
//
// ─────────────────────────────────────────────────────────────────────────────
// Shell-level surface registry — PROMOTED to contract entry 2026-06-13
// per preflight UI-SHELL-CONTRACT-001 (soul-level approval, audit I-6).
//
// The 22-view CONTRACTS array below now includes a `shell` pseudo-view entry
// covering the four pre-existing Layout.tsx shell APIs:
//   - downloadUpdate        : external-action  (auto-update flow)
//   - installUpdate         : external-action  (replaces app binary; VERIFIED
//     2026-06-11: NO native confirm dialog — gated only by user clicking the
//     update button. UI-SAFETY-001 checked.)
//   - abortChat             : chat-runtime     (paired with sendMessage)
//   - getSessionMessages    : read-only        (session resume helper)
//
// Shell is a pseudo-view — not rendered as a nav route, not in sidebar.
// Always reachable while any of the 21 Layout routes is active.
// Net new IPC bridges in Layout.tsx remain forbidden. Any future addition
// of a fifth shell-level API MUST be logged here AND in the layout-route-table
// test before it is allowed.
// ─────────────────────────────────────────────────────────────────────────────

export const SCREEN_BOUNDARY_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;
export const SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT = 22 as const;
export const SCREEN_BOUNDARY_CONTRACT_NO_RENDERER_WIRING = true as const;
export const SCREEN_BOUNDARY_CONTRACT_NEW_IPC_ALLOWED = false as const;
export const SCREEN_BOUNDARY_CONTRACT_RUNTIME_ACTIVATION_ALLOWED = false as const;
export const SCREEN_BOUNDARY_CONTRACT_CONFIG_WRITES_ALLOWED = false as const;
export const SCREEN_BOUNDARY_CONTRACT_HCC_AUTO_EXECUTOR_ALLOWED = false as const;
export const SCREEN_BOUNDARY_CONTRACT_DIRECT_GATEWAY_FIX_APPLIED = true as const;

export type ScreenSidebarGroup = "Work" | "Knowledge" | "Agents" | "System";

export type ScreenViewId =
  | "chat"
  | "sessions"
  | "office"
  | "mission"
  | "playbooks"
  | "understand"
  | "skills"
  | "knowledgeControl"
  | "knowledge"
  | "soul"
  | "memory"
  | "agents"
  | "bailongma"
  | "hccCockpit"
  | "monitor"
  | "models"
  | "providers"
  | "tools"
  | "schedules"
  | "gateway"
  | "settings"
  | "shell";

export type ScreenBoundaryKind =
  | "read_only"
  | "read_write_config"
  | "read_write_runtime"
  | "external_action"
  | "mixed";

export type ScreenBoundaryRiskLevel = "P0" | "P1" | "P2" | "P3";

export type EnforcementLevel =
  | "static-string"
  | "import-graph"
  | "runtime-assert";

export type ScreenApiChannel =
  | "ipc_bridge"
  | "renderer_event"
  | "preload_direct_gateway"
  | "component_callback"
  | "none";

export interface ScreenApiMethod {
  name: string;
  channel: ScreenApiChannel;
  mutates: boolean;
  direct_gateway: boolean;
}

export interface ScreenBoundaryContract {
  view: ScreenViewId;
  sidebar_group: ScreenSidebarGroup;
  display_label: string;
  component_surface: string;
  boundary_kind: ScreenBoundaryKind;
  risk_level: ScreenBoundaryRiskLevel;
  api_methods: ScreenApiMethod[];
  write_surfaces: string[];
  direct_gateway_methods: string[];
  // Methods that have been migrated from preload direct gateway
  // access to the main-process IPC bridge. Empty for views that never
  // had a direct-gateway path. The Knowledge IPC Migration closeout
  // (Slice 8B) populates this for the knowledge / knowledgeControl
  // views.
  migrated_ipc_methods: string[];
  remote_mode_restricted: boolean;
  model_strategy_relevant: boolean;
  notes: string[];
  enforcement: EnforcementLevel;
  safety_invariants: {
    new_ipc_allowed: false;
    runtime_activation_allowed: false;
    config_writes_allowed_by_contract: false;
    hcc_auto_executor_allowed: false;
    direct_gateway_fix_applied: true;
  };
}

export interface ScreenBoundaryContractResult {
  schema_version: typeof SCREEN_BOUNDARY_CONTRACT_SCHEMA_VERSION;
  mode: "ui_slice_1_contract_descriptor";
  view_count: typeof SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT;
  contracts: ScreenBoundaryContract[];
  safety_invariants: {
    no_renderer_wiring: true;
    new_ipc_allowed: false;
    runtime_activation_allowed: false;
    config_writes_allowed_by_contract: false;
    hcc_auto_executor_allowed: false;
    direct_gateway_fix_applied: true;
  };
}

const SAFETY_INVARIANTS = {
  new_ipc_allowed: SCREEN_BOUNDARY_CONTRACT_NEW_IPC_ALLOWED,
  runtime_activation_allowed: SCREEN_BOUNDARY_CONTRACT_RUNTIME_ACTIVATION_ALLOWED,
  config_writes_allowed_by_contract:
    SCREEN_BOUNDARY_CONTRACT_CONFIG_WRITES_ALLOWED,
  hcc_auto_executor_allowed: SCREEN_BOUNDARY_CONTRACT_HCC_AUTO_EXECUTOR_ALLOWED,
  direct_gateway_fix_applied:
    SCREEN_BOUNDARY_CONTRACT_DIRECT_GATEWAY_FIX_APPLIED,
} as const;

const RESULT_SAFETY_INVARIANTS = {
  no_renderer_wiring: SCREEN_BOUNDARY_CONTRACT_NO_RENDERER_WIRING,
  ...SAFETY_INVARIANTS,
} as const;

function api(
  name: string,
  channel: ScreenApiChannel,
  mutates = false,
  directGateway = false,
): ScreenApiMethod {
  return {
    name,
    channel,
    mutates,
    direct_gateway: directGateway,
  };
}

function read(name: string): ScreenApiMethod {
  return api(name, "ipc_bridge");
}

function event(name: string): ScreenApiMethod {
  return api(name, "renderer_event");
}

function write(name: string): ScreenApiMethod {
  return api(name, "ipc_bridge", true);
}

function contract(
  input: Omit<ScreenBoundaryContract, "safety_invariants">,
): ScreenBoundaryContract {
  return {
    ...input,
    safety_invariants: { ...SAFETY_INVARIANTS },
  };
}

const CONTRACTS: readonly ScreenBoundaryContract[] = [
  contract({
    view: "chat",
    sidebar_group: "Work",
    display_label: "Chat",
    component_surface: "Chat",
    boundary_kind: "mixed",
    risk_level: "P1",
    api_methods: [
      read("getAppVersion"),
      read("getConfig"),
      read("getHermesVersion"),
      read("getModelConfig"),
      read("getToolsets"),
      read("listInstalledSkills"),
      read("listModels"),
      read("readMemory"),
      read("readSoul"),
      event("onChatChunk"),
      event("onChatDone"),
      event("onChatError"),
      event("onChatToolProgress"),
      event("onChatUsage"),
      write("abortChat"),
      write("sendMessage"),
      write("setConfig"),
      write("setModelConfig"),
    ],
    write_surfaces: ["llm_inference", "chat_abort", "chat_runtime_config"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: [
      "Primary runtime LLM path; future UI work must preserve explicit action boundaries.",
      "Contains config writes for chat defaults and model selection.",
    ],
    enforcement: "static-string",
  }),
  contract({
    view: "sessions",
    sidebar_group: "Work",
    display_label: "Sessions",
    component_surface: "Sessions",
    boundary_kind: "read_write_runtime",
    risk_level: "P2",
    api_methods: [
      read("listCachedSessions"),
      read("searchSessions"),
      write("syncSessionCache"),
    ],
    write_surfaces: ["session_cache_refresh"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Session browser is mostly read path, with cache sync side effect."],
    enforcement: "static-string",
  }),
  contract({
    view: "office",
    sidebar_group: "Work",
    display_label: "Office",
    component_surface: "Office",
    boundary_kind: "external_action",
    risk_level: "P1",
    api_methods: [
      read("claw3dGetLogs"),
      read("claw3dStatus"),
      event("onClaw3dSetupProgress"),
      write("claw3dSetPort"),
      write("claw3dSetWsUrl"),
      write("claw3dSetup"),
      write("claw3dStartAll"),
      write("claw3dStopAll"),
      write("openExternal"),
    ],
    write_surfaces: ["claw3d_lifecycle", "claw3d_settings", "external_open"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: false,
    notes: ["Can start or stop local office/Claw3D services and open URLs."],
    enforcement: "static-string",
  }),
  contract({
    view: "mission",
    sidebar_group: "Work",
    display_label: "Mission",
    component_surface: "Mission",
    boundary_kind: "read_only",
    risk_level: "P3",
    api_methods: [
      read("checkGatewayHealth"),
      read("getCronJobHistory"),
      read("getEvents"),
      read("getGatewayState"),
      read("listCronJobs"),
      read("listPipelineRuns"),
      read("listPlaybooks"),
      read("listVaultFiles"),
    ],
    write_surfaces: [],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: ["Display cockpit surface; no write method is part of this view contract."],
    enforcement: "import-graph",
  }),
  contract({
    view: "playbooks",
    sidebar_group: "Work",
    display_label: "Playbooks",
    component_surface: "PlaybookRunner",
    boundary_kind: "read_write_runtime",
    risk_level: "P1",
    api_methods: [
      read("listPlaybooks"),
      event("onPlaybookStep"),
      event("onPlaybookDone"),
      event("onPlaybookError"),
      write("runPlaybook"),
    ],
    write_surfaces: ["hcc_pipeline_run"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: ["Current component can run a playbook when a playbook is selected."],
    enforcement: "static-string",
  }),
  contract({
    view: "understand",
    sidebar_group: "Work",
    display_label: "Understand",
    component_surface: "Understand",
    boundary_kind: "read_write_runtime",
    risk_level: "P1",
    api_methods: [
      read("listUnderstandingHistory"),
      read("readUnderstandingHistory"),
      write("runPlaybook"),
      write("understandAnything"),
    ],
    write_surfaces: ["llm_understanding", "playbook_dispatch"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: false,
    notes: ["Can trigger understanding work and optionally dispatch a playbook."],
    enforcement: "static-string",
  }),
  contract({
    view: "skills",
    sidebar_group: "Knowledge",
    display_label: "Skills",
    component_surface: "Skills",
    boundary_kind: "read_write_config",
    risk_level: "P2",
    api_methods: [
      read("getSkillContent"),
      read("listBundledSkills"),
      read("listInstalledSkills"),
      write("installSkill"),
      write("uninstallSkill"),
    ],
    write_surfaces: ["skill_installation"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Mutates local skill installation state."],
    enforcement: "static-string",
  }),
  contract({
    view: "knowledgeControl",
    sidebar_group: "Knowledge",
    display_label: "Knowledge Control",
    component_surface: "KnowledgeControl",
    boundary_kind: "read_only",
    risk_level: "P2",
    api_methods: [
      read("getGbrainStats"),
      read("getVaultStats"),
      read("knowledgeSearch"),
      read("listVaultFiles"),
      read("readVaultFile"),
    ],
    write_surfaces: [],
    direct_gateway_methods: [],
    migrated_ipc_methods: ["knowledgeSearch", "getGbrainStats"],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: [
      "knowledgeSearch and getGbrainStats are routed through the main-process IPC bridge; preload raw gateway access has been removed.",
      "IPC bridge active; no direct-gateway methods remain in this view.",
    ],
    enforcement: "import-graph",
  }),
  contract({
    view: "knowledge",
    sidebar_group: "Knowledge",
    display_label: "Knowledge",
    component_surface: "Knowledge",
    boundary_kind: "mixed",
    risk_level: "P2",
    api_methods: [
      read("getGbrainStats"),
      read("getVaultStats"),
      write("knowledgeIngest"),
      read("knowledgeSearch"),
      read("listVaultFiles"),
      read("readVaultFile"),
    ],
    write_surfaces: ["knowledge_ingest_explicit_user_action"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [
      "knowledgeSearch",
      "knowledgeIngest",
      "getGbrainStats",
    ],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: [
      "All three knowledge gateway methods are now routed through the main-process IPC bridge; preload raw gateway access has been removed.",
      "knowledgeIngest remains a write path and must only be triggered by explicit user action.",
      "IPC bridge active; no direct-gateway methods remain in this view.",
    ],
    enforcement: "static-string",
  }),
  contract({
    view: "soul",
    sidebar_group: "Knowledge",
    display_label: "Soul",
    component_surface: "Soul",
    boundary_kind: "read_write_config",
    risk_level: "P2",
    api_methods: [read("readSoul"), write("resetSoul"), write("writeSoul")],
    write_surfaces: ["persona_config"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Reads and writes persona state."],
    enforcement: "static-string",
  }),
  contract({
    view: "memory",
    sidebar_group: "Knowledge",
    display_label: "Memory",
    component_surface: "Memory",
    boundary_kind: "mixed",
    risk_level: "P2",
    api_methods: [
      write("addMemoryEntry"),
      read("discoverMemoryProviders"),
      read("getConfig"),
      read("getEnv"),
      write("openExternal"),
      read("readMemory"),
      write("removeMemoryEntry"),
      write("setConfig"),
      write("setEnv"),
      write("updateMemoryEntry"),
      write("writeUserProfile"),
    ],
    write_surfaces: ["memory_store", "user_profile", "memory_provider_config"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Combines memory edits, profile writes, config writes, and external links."],
    enforcement: "static-string",
  }),
  contract({
    view: "agents",
    sidebar_group: "Agents",
    display_label: "Agents",
    component_surface: "Agents",
    boundary_kind: "read_write_config",
    risk_level: "P2",
    api_methods: [
      write("createProfile"),
      write("deleteProfile"),
      read("listProfiles"),
      write("setActiveProfile"),
    ],
    write_surfaces: ["profile_management"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Profile lifecycle and active-profile mutation."],
    enforcement: "static-string",
  }),
  contract({
    view: "bailongma",
    sidebar_group: "Agents",
    display_label: "BaiLongma",
    component_surface: "Mission legacySource=bailongma",
    boundary_kind: "read_only",
    risk_level: "P3",
    api_methods: [
      read("getEvents"),
      read("getGatewayState"),
      read("listCronJobs"),
      read("listPipelineRuns"),
      read("listVaultFiles"),
    ],
    write_surfaces: [],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: ["Read-only cockpit route used as a legacy mission source."],
    enforcement: "import-graph",
  }),
  contract({
    view: "hccCockpit",
    sidebar_group: "Agents",
    display_label: "HccCockpit",
    component_surface: "Mission legacySource=hcc",
    boundary_kind: "read_only",
    risk_level: "P3",
    api_methods: [
      read("checkGatewayHealth"),
      read("getCronJobHistory"),
      read("getEvents"),
      read("getGatewayState"),
      read("listPipelineRuns"),
      read("listPlaybooks"),
    ],
    write_surfaces: [],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: [
      "ModelStrategyDryRunPanel is embedded under HccCockpit and has zero IPC calls.",
      "Cockpit read polling remains a read-only concern for later UI slices.",
    ],
    enforcement: "import-graph",
  }),
  contract({
    view: "monitor",
    sidebar_group: "Agents",
    display_label: "Monitor",
    component_surface: "AgentMonitor",
    boundary_kind: "read_only",
    risk_level: "P3",
    api_methods: [
      read("checkGatewayHealth"),
      read("getCronJobHistory"),
      read("getEvents"),
      read("getGatewayState"),
      read("listCachedSessions"),
      read("listPipelineRuns"),
      read("listVaultFiles"),
      event("onPlaybookStep"),
      event("onPlaybookDone"),
      event("onPlaybookError"),
    ],
    write_surfaces: [],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: true,
    notes: [
      "Read-only monitoring plus renderer event subscriptions.",
      "Enforcement: static-string (not import-graph) — no dedicated monitor boundary test exists yet. Upgrade to import-graph requires tests/monitor-control-readonly.test.ts or equivalent.",
    ],
    enforcement: "static-string",
  }),
  contract({
    view: "models",
    sidebar_group: "System",
    display_label: "Models",
    component_surface: "Models",
    boundary_kind: "read_write_config",
    risk_level: "P1",
    api_methods: [
      write("addModel"),
      read("listModels"),
      write("removeModel"),
      write("setEnv"),
      write("updateModel"),
    ],
    write_surfaces: ["model_catalog", "model_env"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: ["Mutates saved model catalog and related environment configuration."],
    enforcement: "static-string",
  }),
  contract({
    view: "providers",
    sidebar_group: "System",
    display_label: "Providers",
    component_surface: "Providers",
    boundary_kind: "read_write_config",
    risk_level: "P1",
    api_methods: [
      write("addModel"),
      read("getCredentialPool"),
      read("getEnv"),
      read("getModelConfig"),
      write("setCredentialPool"),
      write("setEnv"),
      write("setModelConfig"),
    ],
    write_surfaces: ["credential_pool", "provider_config", "model_config"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: true,
    notes: [
      "Primary user-provided API key and model provider configuration surface.",
    ],
    enforcement: "static-string",
  }),
  contract({
    view: "tools",
    sidebar_group: "System",
    display_label: "Tools",
    component_surface: "Tools",
    boundary_kind: "read_write_config",
    risk_level: "P2",
    api_methods: [
      read("getToolsets"),
      read("listMcpServers"),
      write("setToolsetEnabled"),
    ],
    write_surfaces: ["toolset_toggle"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Toolset enablement toggle is a low-blast-radius config write."],
    enforcement: "static-string",
  }),
  contract({
    view: "schedules",
    sidebar_group: "System",
    display_label: "Schedules",
    component_surface: "Schedules",
    boundary_kind: "read_write_runtime",
    risk_level: "P1",
    api_methods: [
      write("createCronJob"),
      read("listCronJobs"),
      write("pauseCronJob"),
      write("removeCronJob"),
      write("resumeCronJob"),
      write("triggerCronJob"),
    ],
    write_surfaces: ["cron_management", "manual_cron_trigger"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: false,
    notes: ["Can create, remove, pause, resume, and trigger jobs."],
    enforcement: "static-string",
  }),
  contract({
    view: "gateway",
    sidebar_group: "System",
    display_label: "Gateway",
    component_surface: "Gateway",
    boundary_kind: "mixed",
    risk_level: "P1",
    api_methods: [
      read("gatewayStatus"),
      read("getEnv"),
      read("getPlatformEnabled"),
      write("setEnv"),
      write("setPlatformEnabled"),
      write("startGateway"),
      write("stopGateway"),
    ],
    write_surfaces: ["gateway_lifecycle", "gateway_env", "platform_toggle"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: true,
    model_strategy_relevant: false,
    notes: ["Daemon lifecycle and platform enablement controls."],
    enforcement: "static-string",
  }),
  contract({
    view: "settings",
    sidebar_group: "System",
    display_label: "Settings",
    component_surface: "Settings",
    boundary_kind: "mixed",
    risk_level: "P1",
    api_methods: [
      write("addMcpServer"),
      read("checkOpenClaw"),
      read("getAppVersion"),
      read("getConfig"),
      read("getConnectionConfig"),
      read("getHermesHome"),
      read("getHermesVersion"),
      read("listMcpServers"),
      event("onInstallProgress"),
      event("onMcpTestDone"),
      event("onMcpTestError"),
      event("onMcpTestOutput"),
      read("readLogs"),
      read("refreshHermesVersion"),
      write("removeMcpServer"),
      write("runClawMigrate"),
      write("runHermesBackup"),
      write("runHermesDoctor"),
      write("runHermesDump"),
      write("runHermesImport"),
      write("runHermesUpdate"),
      write("setConfig"),
      write("setConnectionConfig"),
      write("setSshConfig"),
      write("testMcpServer"),
      write("testRemoteConnection"),
      write("testSshConnection"),
      write("toggleMcpServer"),
    ],
    write_surfaces: [
      "system_config",
      "connection_config",
      "mcp_config",
      "backup_import_update",
      "diagnostic_command",
    ],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: true,
    notes: ["Broad system settings surface with config, MCP, backup, and update actions."],
    enforcement: "static-string",
  }),
  contract({
    view: "shell",
    sidebar_group: "Work",
    display_label: "Shell",
    component_surface: "Layout",
    boundary_kind: "mixed",
    risk_level: "P1",
    api_methods: [
      read("getSessionMessages"),
      write("abortChat"),
      api("downloadUpdate", "ipc_bridge", true),
      api("installUpdate", "ipc_bridge", true),
    ],
    write_surfaces: ["app_update_install", "chat_runtime_abort"],
    direct_gateway_methods: [],
    migrated_ipc_methods: [],
    remote_mode_restricted: false,
    model_strategy_relevant: false,
    notes: [
      "Shell-level pseudo-view — not rendered as a nav route. Registered 2026-06-13 per audit P2-5 / preflight UI-SHELL-CONTRACT-001.",
      "Always reachable while any of the 21 Layout routes is active.",
      "installUpdate confirm dialog: VERIFIED absent by UI-SAFETY-001.",
      "4 shell APIs were previously documented only in file-header comment (UI-DOC-SYNC-001); now promoted to contract entry.",
    ],
    enforcement: "static-string",
  }),
] as const;

export const SCREEN_BOUNDARY_CONTRACTS: readonly ScreenBoundaryContract[] =
  CONTRACTS;

export function buildScreenBoundaryContract(): ScreenBoundaryContractResult {
  return {
    schema_version: SCREEN_BOUNDARY_CONTRACT_SCHEMA_VERSION,
    mode: "ui_slice_1_contract_descriptor",
    view_count: SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT,
    contracts: CONTRACTS.map((entry) => ({
      ...entry,
      api_methods: entry.api_methods.map((method) => ({ ...method })),
      write_surfaces: [...entry.write_surfaces],
      direct_gateway_methods: [...entry.direct_gateway_methods],
      notes: [...entry.notes],
      safety_invariants: { ...entry.safety_invariants },
    })),
    safety_invariants: { ...RESULT_SAFETY_INVARIANTS },
  };
}

export function getScreenBoundaryContract(
  view: ScreenViewId,
): ScreenBoundaryContract | undefined {
  return buildScreenBoundaryContract().contracts.find((entry) => entry.view === view);
}

export const SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS = {
  no_renderer_wiring: SCREEN_BOUNDARY_CONTRACT_NO_RENDERER_WIRING,
  new_ipc_allowed: SCREEN_BOUNDARY_CONTRACT_NEW_IPC_ALLOWED,
  runtime_activation_allowed:
    SCREEN_BOUNDARY_CONTRACT_RUNTIME_ACTIVATION_ALLOWED,
  config_writes_allowed_by_contract:
    SCREEN_BOUNDARY_CONTRACT_CONFIG_WRITES_ALLOWED,
  hcc_auto_executor_allowed: SCREEN_BOUNDARY_CONTRACT_HCC_AUTO_EXECUTOR_ALLOWED,
  direct_gateway_fix_applied:
    SCREEN_BOUNDARY_CONTRACT_DIRECT_GATEWAY_FIX_APPLIED,
} as const;
