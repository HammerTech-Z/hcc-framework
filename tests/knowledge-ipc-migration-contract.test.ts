// Knowledge IPC Migration Slice 0 contract invariants.
// Static checks: 3 affected methods, exact method names, exact IPC
// channels, P0 + planned_not_applied for every method, affected_views
// contains knowledge + knowledgeControl, all safety literals hard false,
// no forbidden recovery claims outside the explicit forbidden_claims
// list, source has no IPC / runtime / preload / main call forms.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  getKnowledgeIpcMigrationContract,
  getKnowledgeIpcMigrationMethod,
  KNOWLEDGE_IPC_MIGRATION_CONTRACT,
  KNOWLEDGE_IPC_MIGRATION_CONTRACT_DISPLAY_STATUS,
  KNOWLEDGE_IPC_MIGRATION_CONTRACT_MODE,
  KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION,
  type KnowledgeIpcMigrationMethod,
} from "../src/shared/lib/knowledge-ipc-migration-contract";

const ROOT = join(__dirname, "..");
const contractSrc = readFileSync(
  join(ROOT, "src/shared/lib/knowledge-ipc-migration-contract.ts"),
  "utf-8",
);

const EXPECTED_METHODS: ReadonlyArray<KnowledgeIpcMigrationMethod["name"]> = [
  "knowledgeSearch",
  "knowledgeIngest",
  "getGbrainStats",
];

const EXPECTED_CHANNELS: ReadonlyArray<string> = [
  "knowledge-search",
  "knowledge-ingest",
  "knowledge-stats",
];

const FORBIDDEN_RECOVERY_CLAIMS = [
  "fixed",
  "migrated",
  "resolved",
  "protected_by_ipc",
  "safe",
];

const EXPECTED_SAFETY = {
  runtime_migration_applied: false,
  preload_fetch_removed: false,
  main_ipc_handlers_added: false,
  renderer_behavior_changed: false,
  config_writes_allowed: false,
  credential_access_allowed: false,
  live_gateway_activation_allowed: false,
  audit_write_allowed: false,
} as const;

describe("Knowledge IPC migration contract shape", () => {
  it("uses schema 1.0.0 / migration_contract_only / display_only", () => {
    expect(KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(KNOWLEDGE_IPC_MIGRATION_CONTRACT_MODE).toBe(
      "migration_contract_only",
    );
    expect(KNOWLEDGE_IPC_MIGRATION_CONTRACT_DISPLAY_STATUS).toBe(
      "display_only",
    );
    const contract = getKnowledgeIpcMigrationContract();
    expect(contract.schema_version).toBe("1.0.0");
    expect(contract.mode).toBe("migration_contract_only");
    expect(contract.display_status).toBe("display_only");
    expect(contract.source_risk).toBe("direct_gateway_preload_fetch");
  });

  it("emits exactly 3 affected methods: knowledgeSearch / knowledgeIngest / getGbrainStats", () => {
    const contract = getKnowledgeIpcMigrationContract();
    expect(contract.affected_methods).toHaveLength(3);
    const names = contract.affected_methods.map((m) => m.name);
    expect(names).toEqual([...EXPECTED_METHODS]);
  });

  it("every affected method is risk_level P0 with migration_status planned_not_applied", () => {
    const contract = getKnowledgeIpcMigrationContract();
    for (const method of contract.affected_methods) {
      expect(method.risk_level).toBe("P0");
      expect(method.migration_status).toBe("planned_not_applied");
    }
  });

  it("target IPC channels exactly match knowledge-search / knowledge-ingest / knowledge-stats", () => {
    const contract = getKnowledgeIpcMigrationContract();
    const channels = contract.affected_methods.map(
      (m) => m.proposed_ipc_channel,
    );
    expect(channels).toEqual([...EXPECTED_CHANNELS]);
  });

  it("affected views include knowledge and knowledgeControl", () => {
    const contract = getKnowledgeIpcMigrationContract();
    expect(contract.affected_views).toEqual(
      expect.arrayContaining(["knowledge", "knowledgeControl"]),
    );
    expect(contract.affected_views).toHaveLength(2);
  });

  it("getKnowledgeIpcMigrationMethod returns the matching method", () => {
    expect(getKnowledgeIpcMigrationMethod("knowledgeSearch")?.name).toBe(
      "knowledgeSearch",
    );
    expect(getKnowledgeIpcMigrationMethod("getGbrainStats")?.proposed_ipc_channel).toBe(
      "knowledge-stats",
    );
  });
});

describe("Knowledge IPC migration contract safety & source purity", () => {
  it("safety literals are all hard false", () => {
    const contract = getKnowledgeIpcMigrationContract();
    expect(contract.safety).toEqual(EXPECTED_SAFETY);
  });

  it("forbidden recovery claims list contains the expected phrases", () => {
    const contract = getKnowledgeIpcMigrationContract();
    for (const phrase of FORBIDDEN_RECOVERY_CLAIMS) {
      expect(contract.forbidden_claims).toContain(phrase);
    }
  });

  it("source does not import src/preload or src/main", () => {
    expect(contractSrc).not.toMatch(/from\s+["'][^"']*preload[^"']*["']/);
    expect(contractSrc).not.toMatch(/from\s+["'][^"']*main[^"']*["']/);
    expect(contractSrc).not.toMatch(/from\s+["'][^"']*renderer[^"']*["']/);
  });

  it("source contains no forbidden call forms", () => {
    // Strip the target_path_label because it intentionally describes the
    // *planned* migration path (renderer -> preload hermesAPI method ->
    // ipcRenderer.invoke -> main handler) as a string label, not as actual
    // call wiring. The literal "ipcRenderer.invoke" appears in the label.
    const body = contractSrc.replace(/target_path_label:[\s\S]*?,\n/, "");
    for (const forbidden of [
      "fetch(",
      "ipcMain",
      "window.hermesAPI",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
    ]) {
      expect(body).not.toContain(forbidden);
    }
    // The standalone "ipcRenderer" token must not appear as code (e.g.
    // ipcRenderer.invoke or ipcRenderer.send) — the label is a string
    // literal, not a function call. Assert the body has no token-shaped
    // call form.
    expect(body).not.toMatch(/\bipcRenderer\.\w+\(/);
  });

  it("source descriptive copy does not claim fixed / migrated / resolved / protected_by_ipc / safe outside the forbidden_claims list", () => {
    // Strip the explicit forbidden_claims literal (the FORBIDDEN_CLAIMS
    // const array AND the forbidden_claims property assignment), the
    // target_path_label (mentions "ipcRenderer.invoke" and the migration
    // arrow as a string plan, not a state claim), and the current_path_label
    // (mentions the "direct fetch" risk class, not a recovery claim).
    let body = contractSrc;
    body = body.replace(
      /const FORBIDDEN_CLAIMS[\s\S]*?\];/,
      "",
    );
    body = body.replace(/forbidden_claims:\s*FORBIDDEN_CLAIMS,?/g, "");
    body = body.replace(/target_path_label:[\s\S]*?,\n/, "");
    body = body.replace(/current_path_label:[\s\S]*?,\n/, "");
    for (const phrase of FORBIDDEN_RECOVERY_CLAIMS) {
      // Whole-word match so e.g. "safety" does not trip "safe".
      const pattern = new RegExp(`\\b${phrase}\\b`, "i");
      const match = body.match(pattern);
      expect(
        match,
        `unexpected ${phrase} outside forbidden_claims: ${match?.[0] ?? ""}`,
      ).toBeNull();
    }
  });
});
