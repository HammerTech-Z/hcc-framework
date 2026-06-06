// Knowledge IPC Migration Slice 2 main gateway adapter invariants.
// Static + pure checks: builds correct GET/POST descriptors for the
// 3 channels; reuses Slice 1 validators for request/response; maps
// transport errors to Slice 1 error codes; safety literals hard false;
// helper has no fetch, no ipcMain.handle, no electron import.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildGatewayRequestDescriptor,
  KNOWLEDGE_IPC_GATEWAY_ADAPTER_MODE,
  KNOWLEDGE_IPC_GATEWAY_ADAPTER_SAFETY,
  KNOWLEDGE_IPC_GATEWAY_TARGET_HOST,
  mapTransportErrorToIpcError,
  validateChannelResponse,
  type GatewayHttpMethod,
  type GatewayRequestDescriptor,
} from "../src/main/knowledge-ipc-gateway-adapter";

const ROOT = join(__dirname, "..");
const adapterSrc = readFileSync(
  join(ROOT, "src/main/knowledge-ipc-gateway-adapter.ts"),
  "utf-8",
);

const CHANNEL_TO_EXPECTED: ReadonlyArray<{
  channel: "knowledge-search" | "knowledge-ingest" | "knowledge-stats";
  method: GatewayHttpMethod;
  path: string;
  timeout_ms: number;
}> = [
  {
    channel: "knowledge-search",
    method: "GET",
    path: "/knowledge/search",
    timeout_ms: 5_000,
  },
  {
    channel: "knowledge-ingest",
    method: "POST",
    path: "/knowledge/ingest",
    timeout_ms: 10_000,
  },
  {
    channel: "knowledge-stats",
    method: "GET",
    path: "/knowledge/stats",
    timeout_ms: 2_000,
  },
];

function buildOk(
  channel: "knowledge-search" | "knowledge-ingest" | "knowledge-stats",
  payload: unknown,
): { descriptor: GatewayRequestDescriptor } {
  const result = buildGatewayRequestDescriptor(channel, payload);
  expect(result.ok).toBe(true);
  if (!result.descriptor) {
    throw new Error(`missing descriptor for ${channel}`);
  }
  return { descriptor: result.descriptor };
}

describe("Knowledge IPC main gateway adapter shape", () => {
  it("uses mode main_gateway_adapter_helper_only", () => {
    expect(KNOWLEDGE_IPC_GATEWAY_ADAPTER_MODE).toBe(
      "main_gateway_adapter_helper_only",
    );
  });

  it("target host is descriptor-only (label local_gateway)", () => {
    expect(KNOWLEDGE_IPC_GATEWAY_TARGET_HOST).toBe("local_gateway");
  });

  it("all safety literals are hard false", () => {
    expect(KNOWLEDGE_IPC_GATEWAY_ADAPTER_SAFETY).toEqual({
      fetch_executed: false,
      ipc_handler_registered: false,
      preload_bridge_changed: false,
      renderer_behavior_changed: false,
      audit_write_allowed: false,
      config_write_allowed: false,
      runtime_migration_applied: false,
    });
  });
});

describe("Knowledge IPC main gateway adapter descriptor building", () => {
  it.each(CHANNEL_TO_EXPECTED)(
    "builds descriptor for $channel",
    ({ channel, method, path, timeout_ms }) => {
      const payload =
        channel === "knowledge-search"
          ? { query: "example", limit: 10 }
          : channel === "knowledge-ingest"
            ? { title: "t", content: "body" }
            : {};
      const { descriptor } = buildOk(channel, payload);
      expect(descriptor.method).toBe(method);
      expect(descriptor.path).toBe(path);
      expect(descriptor.host).toBe("local_gateway");
      expect(descriptor.timeout_ms).toBe(timeout_ms);
      expect(descriptor.retry_policy).toBe("no_retry_display_only");
      expect(descriptor.source_channel).toBe(channel);
    },
  );

  it("knowledge-search builds GET descriptor with q + limit query and no body", () => {
    const { descriptor } = buildOk("knowledge-search", {
      query: "example",
      limit: 10,
    });
    expect(descriptor.method).toBe("GET");
    expect(descriptor.path).toBe("/knowledge/search");
    expect(descriptor.query).toEqual({ q: "example", limit: "10" });
    expect(descriptor.body).toBeNull();
  });

  it("knowledge-search without limit omits the limit query key", () => {
    const { descriptor } = buildOk("knowledge-search", { query: "x" });
    expect(descriptor.query).toEqual({ q: "x" });
  });

  it("knowledge-ingest builds POST descriptor with title/content body and empty query", () => {
    const { descriptor } = buildOk("knowledge-ingest", {
      title: "t",
      content: "body",
    });
    expect(descriptor.method).toBe("POST");
    expect(descriptor.path).toBe("/knowledge/ingest");
    expect(descriptor.query).toEqual({});
    expect(descriptor.body).toEqual({ title: "t", content: "body" });
  });

  it("knowledge-stats builds GET descriptor with no body and empty query", () => {
    const { descriptor } = buildOk("knowledge-stats", {});
    expect(descriptor.method).toBe("GET");
    expect(descriptor.path).toBe("/knowledge/stats");
    expect(descriptor.query).toEqual({});
    expect(descriptor.body).toBeNull();
  });
});

describe("Knowledge IPC main gateway adapter validation + error mapping", () => {
  it("rejects invalid payload using Slice 1 validators", () => {
    const badSearch = buildGatewayRequestDescriptor("knowledge-search", {
      query: "",
    });
    expect(badSearch.ok).toBe(false);
    if (!badSearch.ok) {
      expect(badSearch.code).toBe("invalid_payload");
    }
    const badIngest = buildGatewayRequestDescriptor("knowledge-ingest", {
      title: "",
      content: "x",
    });
    expect(badIngest.ok).toBe(false);
    const badStats = buildGatewayRequestDescriptor("knowledge-stats", {
      unexpected: true,
    });
    expect(badStats.ok).toBe(false);
  });

  it("maps transport errors to Slice 1 error codes", () => {
    expect(mapTransportErrorToIpcError("gateway_unavailable")).toEqual({
      code: "gateway_unavailable",
      reason: "gateway unreachable",
    });
    expect(mapTransportErrorToIpcError("gateway_timeout")).toEqual({
      code: "gateway_timeout",
      reason: "gateway request timed out",
    });
    expect(mapTransportErrorToIpcError("gateway_error")).toEqual({
      code: "gateway_error",
      reason: "gateway returned a non-2xx status",
    });
  });

  it("response validation reuses Slice 1 validators", () => {
    // knowledgeSearch: ok example
    expect(
      validateChannelResponse("knowledge-search", {
        status: "ok",
        results: [],
      }).ok,
    ).toBe(true);
    // knowledgeIngest: ok example
    expect(
      validateChannelResponse("knowledge-ingest", {
        status: "ok",
        path: "vault/x.md",
      }).ok,
    ).toBe(true);
    // knowledgeStats: accepts any JSON object
    expect(
      validateChannelResponse("knowledge-stats", { total_files: 0 }).ok,
    ).toBe(true);
    // Mismatched shape returns response_shape_mismatch
    const bad = validateChannelResponse("knowledge-search", { results: [] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) {
      expect(bad.code).toBe("response_shape_mismatch");
    }
  });
});

describe("Knowledge IPC main gateway adapter source purity", () => {
  it("source contains no forbidden runtime/IPC/electron call forms", () => {
    // Strip comments so doc text mentioning forbidden names does not trip
    // the assertion.
    const code = adapterSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of [
      "fetch(",
      "ipcMain",
      "ipcRenderer",
      "window.hermesAPI",
      "ipcMain.handle",
      "app.on(",
      "BrowserWindow",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  it("source does not import electron", () => {
    expect(adapterSrc).not.toMatch(/from\s+["']electron["']/);
    expect(adapterSrc).not.toMatch(/require\(\s*["']electron["']\s*\)/);
  });
});
