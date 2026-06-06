// Knowledge IPC Migration Slice 1 shape contract invariants.
// Static + pure-function checks: 3 channels matching Slice 0; method
// mapping matches Slice 0; migration status remains planned_not_applied;
// request validators pass / fail expected examples; response validators
// accept canonical examples; error codes are the exact list; safety
// literals hard false; helper has no preload / main / renderer import or
// call forms.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  getChannelForMethod,
  getKnowledgeIpcShapeContract,
  isMigrationContractStillPlanned,
  KNOWLEDGE_IPC_SHAPE_CONTRACT_MODE,
  KNOWLEDGE_IPC_SHAPE_CONTRACT_SCHEMA_VERSION,
  validateKnowledgeIngestRequest,
  validateKnowledgeResponse,
  validateKnowledgeSearchRequest,
  validateKnowledgeStatsRequest,
  type KnowledgeIpcChannel,
  type KnowledgeIpcErrorCode,
} from "../src/shared/lib/knowledge-ipc-shape-contract";
import { getKnowledgeIpcMigrationContract } from "../src/shared/lib/knowledge-ipc-migration-contract";

const ROOT = join(__dirname, "..");
const shapeContractSrc = readFileSync(
  join(ROOT, "src/shared/lib/knowledge-ipc-shape-contract.ts"),
  "utf-8",
);

const EXPECTED_CHANNELS: ReadonlyArray<KnowledgeIpcChannel> = [
  "knowledge-search",
  "knowledge-ingest",
  "knowledge-stats",
];

const EXPECTED_METHODS = [
  "knowledgeSearch",
  "knowledgeIngest",
  "getGbrainStats",
] as const;

const EXPECTED_ERROR_CODES: ReadonlyArray<KnowledgeIpcErrorCode> = [
  "invalid_payload",
  "gateway_unavailable",
  "gateway_timeout",
  "gateway_error",
  "response_shape_mismatch",
];

const EXPECTED_SAFETY = {
  runtime_wiring_added: false,
  preload_fetch_removed: false,
  main_handler_added: false,
  ipc_invocation_enabled: false,
  renderer_behavior_changed: false,
  secret_echo_allowed: false,
  config_write_allowed: false,
  audit_write_allowed: false,
} as const;

describe("Knowledge IPC shape contract shape", () => {
  it("uses schema 1.0.0 / ipc_shape_contract_only", () => {
    expect(KNOWLEDGE_IPC_SHAPE_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(KNOWLEDGE_IPC_SHAPE_CONTRACT_MODE).toBe(
      "ipc_shape_contract_only",
    );
    const contract = getKnowledgeIpcShapeContract();
    expect(contract.schema_version).toBe("1.0.0");
    expect(contract.mode).toBe("ipc_shape_contract_only");
    expect(contract.source_contract).toBe(
      "knowledge_ipc_migration_contract_slice_0",
    );
  });

  it("emits exactly 3 channels matching Slice 0", () => {
    const contract = getKnowledgeIpcShapeContract();
    expect(contract.channels).toHaveLength(3);
    expect(contract.channels.map((c) => c.channel)).toEqual([
      ...EXPECTED_CHANNELS,
    ]);
  });

  it("method mapping matches Slice 0 (knowledgeSearch / knowledgeIngest / getGbrainStats)", () => {
    const contract = getKnowledgeIpcShapeContract();
    const slice0Methods = getKnowledgeIpcMigrationContract().affected_methods.map(
      (m) => m.name,
    );
    expect(contract.channels.map((c) => c.method)).toEqual([
      ...EXPECTED_METHODS,
    ]);
    expect(slice0Methods).toEqual([...EXPECTED_METHODS]);
    for (const method of EXPECTED_METHODS) {
      expect(getChannelForMethod(method)).toBeDefined();
    }
  });

  it("Slice 0 migration status remains planned_not_applied for every method", () => {
    expect(isMigrationContractStillPlanned()).toBe(true);
  });

  it("error codes are the exact required list", () => {
    const contract = getKnowledgeIpcShapeContract();
    expect(contract.error_codes).toEqual([...EXPECTED_ERROR_CODES]);
  });
});

describe("Knowledge IPC shape contract request validators", () => {
  it("knowledgeSearch accepts canonical payload and rejects empty query / invalid limit", () => {
    expect(
      validateKnowledgeSearchRequest({ query: "example", limit: 10 }),
    ).toEqual({ ok: true });
    expect(validateKnowledgeSearchRequest({ query: "x" })).toEqual({
      ok: true,
    });
    const empty = validateKnowledgeSearchRequest({ query: "" });
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.code).toBe("invalid_payload");
    }
    const tooSmall = validateKnowledgeSearchRequest({ query: "x", limit: 0 });
    expect(tooSmall.ok).toBe(false);
    const tooLarge = validateKnowledgeSearchRequest({
      query: "x",
      limit: 51,
    });
    expect(tooLarge.ok).toBe(false);
    const notInt = validateKnowledgeSearchRequest({
      query: "x",
      limit: 1.5,
    });
    expect(notInt.ok).toBe(false);
    const wrongType = validateKnowledgeSearchRequest({ query: 42 });
    expect(wrongType.ok).toBe(false);
  });

  it("knowledgeIngest accepts canonical payload and rejects empty / too-long title or content", () => {
    expect(
      validateKnowledgeIngestRequest({ title: "t", content: "body" }),
    ).toEqual({ ok: true });
    const emptyTitle = validateKnowledgeIngestRequest({
      title: "",
      content: "body",
    });
    expect(emptyTitle.ok).toBe(false);
    if (!emptyTitle.ok) {
      expect(emptyTitle.code).toBe("invalid_payload");
    }
    const emptyContent = validateKnowledgeIngestRequest({
      title: "t",
      content: "",
    });
    expect(emptyContent.ok).toBe(false);
    const longTitle = validateKnowledgeIngestRequest({
      title: "x".repeat(257),
      content: "body",
    });
    expect(longTitle.ok).toBe(false);
    if (!longTitle.ok) {
      expect(longTitle.reason).toContain("title");
    }
    const longContent = validateKnowledgeIngestRequest({
      title: "t",
      content: "x".repeat(1_048_577),
    });
    expect(longContent.ok).toBe(false);
    if (!longContent.ok) {
      expect(longContent.reason).toContain("content");
    }
  });

  it("getGbrainStats accepts empty object only", () => {
    expect(validateKnowledgeStatsRequest({})).toEqual({ ok: true });
    const notEmpty = validateKnowledgeStatsRequest({ extra: true });
    expect(notEmpty.ok).toBe(false);
    if (!notEmpty.ok) {
      expect(notEmpty.code).toBe("invalid_payload");
    }
    const notObject = validateKnowledgeStatsRequest(null);
    expect(notObject.ok).toBe(false);
  });
});

describe("Knowledge IPC shape contract response validators", () => {
  it("accepts canonical response examples for all 3 methods", () => {
    expect(
      validateKnowledgeResponse("knowledgeSearch", {
        status: "ok",
        results: [],
      }).ok,
    ).toBe(true);
    expect(
      validateKnowledgeResponse("knowledgeIngest", {
        status: "ok",
        path: "vault/x.md",
      }).ok,
    ).toBe(true);
    expect(
      validateKnowledgeResponse("getGbrainStats", {
        status: "ok",
        total_files: 0,
      }).ok,
    ).toBe(true);
  });

  it("rejects responses with mismatched shape", () => {
    const badSearch = validateKnowledgeResponse("knowledgeSearch", {
      results: [],
    });
    expect(badSearch.ok).toBe(false);
    if (!badSearch.ok) {
      expect(badSearch.code).toBe("response_shape_mismatch");
    }
    const badIngest = validateKnowledgeResponse("knowledgeIngest", {});
    expect(badIngest.ok).toBe(false);
  });
});

describe("Knowledge IPC shape contract safety & source purity", () => {
  it("all safety literals are hard false", () => {
    const contract = getKnowledgeIpcShapeContract();
    expect(contract.safety).toEqual(EXPECTED_SAFETY);
  });

  it("policy.secret_echo_allowed is hard false", () => {
    const contract = getKnowledgeIpcShapeContract();
    expect(contract.policy.secret_echo_allowed).toBe(false);
  });

  it("source does not import src/preload or src/main or src/renderer", () => {
    expect(shapeContractSrc).not.toMatch(/from\s+["'][^"']*preload[^"']*["']/);
    expect(shapeContractSrc).not.toMatch(/from\s+["'][^"']*main[^"']*["']/);
    expect(shapeContractSrc).not.toMatch(/from\s+["'][^"']*renderer[^"']*["']/);
  });

  it("source contains no forbidden call forms", () => {
    for (const forbidden of [
      "fetch(",
      "ipcRenderer",
      "ipcMain",
      "window.hermesAPI",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
    ]) {
      expect(shapeContractSrc).not.toContain(forbidden);
    }
  });
});
