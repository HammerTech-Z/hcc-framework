// Knowledge IPC Migration Slice 5 readiness contract invariants.
// Static checks: exact mode, all three channels present, future helper
// import names recorded as strings, exact readiness status, every safety
// literal hard false, startup target src/main/index.ts recorded, source
// does not import src/main/index.ts or src/preload/index.ts, source has
// no forbidden call forms. No startup wiring, no preload switch.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  getKnowledgeIpcStartupReadinessContract,
  KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT_MODE,
  KNOWLEDGE_IPC_STARTUP_READINESS_SCHEMA_VERSION,
  KNOWLEDGE_IPC_STARTUP_READINESS_STATUS,
  KNOWLEDGE_IPC_STARTUP_READINESS_TARGET_FILE,
  type KnowledgeIpcStartupReadinessChannel,
} from "../src/shared/lib/knowledge-ipc-startup-readiness";

const ROOT = join(__dirname, "..");
const contractSrc = readFileSync(
  join(ROOT, "src/shared/lib/knowledge-ipc-startup-readiness.ts"),
  "utf-8",
);

const EXPECTED_CHANNELS: ReadonlyArray<string> = [
  "knowledge-search",
  "knowledge-ingest",
  "knowledge-stats",
];

const EXPECTED_FUTURE_IMPORTS: ReadonlyArray<string> = [
  "registerKnowledgeIpcHandlers",
  "createKnowledgeGatewayClient",
];

const FORBIDDEN_CALL_FORMS: ReadonlyArray<string> = [
  "ipcMain.handle",
  "registerKnowledgeIpcHandlers(",
  "createKnowledgeGatewayClient(",
  "fetch(",
  "window.hermesAPI",
  "setModelConfig(",
  "setEnv(",
  "startGateway(",
  "writeFile",
  "appendFile",
];

const FORBIDDEN_IMPORT_PATHS: ReadonlyArray<string> = [
  "src/main/index.ts",
  "src/preload/index.ts",
];

describe("Knowledge IPC Migration Slice 5 startup readiness contract", () => {
  it("uses exact readiness contract mode", () => {
    expect(KNOWLEDGE_IPC_STARTUP_READINESS_CONTRACT_MODE).toBe(
      "startup_readiness_contract_only",
    );
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.mode).toBe("startup_readiness_contract_only");
  });

  it("uses exact schema version constant", () => {
    expect(KNOWLEDGE_IPC_STARTUP_READINESS_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("uses exact readiness status", () => {
    expect(KNOWLEDGE_IPC_STARTUP_READINESS_STATUS).toBe(
      "ready_for_explicit_startup_wiring_approval",
    );
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.readiness_status).toBe(
      "ready_for_explicit_startup_wiring_approval",
    );
  });

  it("records startup hook target as src/main/index.ts", () => {
    expect(KNOWLEDGE_IPC_STARTUP_READINESS_TARGET_FILE).toBe(
      "src/main/index.ts",
    );
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.expected_startup_hook_target).toBe("src/main/index.ts");
  });

  it("has startup_wiring_applied false at top level", () => {
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.startup_wiring_applied).toBe(false);
  });

  it("has preload_switch_applied false at top level", () => {
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.preload_switch_applied).toBe(false);
  });

  it("declares all three required channels", () => {
    const channels: ReadonlyArray<KnowledgeIpcStartupReadinessChannel> =
      getKnowledgeIpcStartupReadinessContract().required_channels;
    const channelNames = channels.map((entry) => entry.channel).sort();
    expect(channelNames).toEqual([...EXPECTED_CHANNELS].sort());
    for (const expected of EXPECTED_CHANNELS) {
      const entry = channels.find((c) => c.channel === expected);
      expect(entry).toBeDefined();
      expect(entry?.helper_to_register).toBe("registerKnowledgeIpcHandlers");
    }
  });

  it("declares future helper import names as strings", () => {
    const imports = getKnowledgeIpcStartupReadinessContract()
      .required_helper_imports;
    const symbols = imports.map((entry) => entry.symbol).sort();
    expect(symbols).toEqual([...EXPECTED_FUTURE_IMPORTS].sort());
    for (const entry of imports) {
      expect(typeof entry.symbol).toBe("string");
      expect(typeof entry.from).toBe("string");
      expect(entry.from.length).toBeGreaterThan(0);
    }
  });

  it("declares all required safety gates with enforced false", () => {
    const gates = getKnowledgeIpcStartupReadinessContract()
      .required_safety_gates;
    const ids = gates.map((gate) => gate.id).sort();
    expect(ids).toEqual(
      [
        "no_preload_switch_in_same_slice",
        "no_renderer_behavior_change",
        "no_auto_gateway_start",
        "no_config_write",
        "no_audit_write",
      ].sort(),
    );
    for (const gate of gates) {
      expect(gate.enforced).toBe(false);
    }
  });

  it("has empty blockers list", () => {
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.blockers).toEqual([]);
  });

  it("carries the preload-switch warning verbatim", () => {
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.warnings).toContain(
      "startup wiring makes handlers available but does not change UI until preload switch",
    );
  });

  it("hard-codes every safety literal to false", () => {
    const contract = getKnowledgeIpcStartupReadinessContract();
    expect(contract.safety).toEqual({
      startup_wiring_applied: false,
      preload_switch_applied: false,
      renderer_behavior_changed: false,
      auto_gateway_start_allowed: false,
      config_write_allowed: false,
      audit_write_allowed: false,
      live_runtime_path_changed: false,
    });
  });

  it("source does not import src/main/index.ts or src/preload/index.ts", () => {
    for (const forbidden of FORBIDDEN_IMPORT_PATHS) {
      const importPatterns = [
        `from "${forbidden}"`,
        `from '${forbidden}'`,
        `require("${forbidden}")`,
        `require('${forbidden}')`,
      ];
      for (const pattern of importPatterns) {
        expect(contractSrc.includes(pattern)).toBe(false);
      }
    }
  });

  it("source contains no forbidden runtime call forms", () => {
    for (const form of FORBIDDEN_CALL_FORMS) {
      expect(contractSrc.includes(form)).toBe(false);
    }
  });

  it("source does not reference the contract source path itself in a way that would import runtime", () => {
    // The contract may reference its own file name in a comment, but
    // must not include any runtime import. We assert no import-style
    // mention of the same directory.
    expect(
      /from\s+["']\.\/knowledge-ipc-startup-readiness["']/.test(contractSrc),
    ).toBe(false);
  });
});
