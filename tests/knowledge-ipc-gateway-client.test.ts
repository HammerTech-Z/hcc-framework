// Knowledge IPC Migration Slice 4 gateway client executor invariants.
// Pure injection-based tests: a fake transport captures the request
// object and returns canned data / rejects with a marker. Validates:
// client shape, descriptor -> transport-request conversion for the 3
// channels, transport-error mapping, missing-transport safety, and
// source purity.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  createKnowledgeGatewayClient,
  KNOWLEDGE_IPC_GATEWAY_CLIENT_SAFETY,
  type KnowledgeGatewayTransport,
  type KnowledgeGatewayTransportRequest,
} from "../src/main/knowledge-ipc-gateway-client";

const ROOT = join(__dirname, "..");
const clientSrc = readFileSync(
  join(ROOT, "src/main/knowledge-ipc-gateway-client.ts"),
  "utf-8",
);

interface FakeTransport extends KnowledgeGatewayTransport {
  calls: KnowledgeGatewayTransportRequest[];
  responder: (request: KnowledgeGatewayTransportRequest) => Promise<unknown>;
}

function makeTransport(
  responder?: (request: KnowledgeGatewayTransportRequest) => Promise<unknown>,
): KnowledgeGatewayTransport & {
  calls: KnowledgeGatewayTransportRequest[];
} {
  const calls: KnowledgeGatewayTransportRequest[] = [];
  async function transport(
    request: KnowledgeGatewayTransportRequest,
  ): Promise<unknown> {
    calls.push(request);
    return responder ? responder(request) : { status: "ok" };
  }
  transport.calls = calls;
  return transport;
}

const SEARCH_DESCRIPTOR: GatewayRequestDescriptor = {
  host: "local_gateway",
  method: "GET",
  path: "/knowledge/search",
  query: { q: "example", limit: "10" },
  body: null,
  timeout_ms: 5_000,
  retry_policy: "no_retry_display_only",
  source_channel: "knowledge-search",
};

const SEARCH_NO_LIMIT_DESCRIPTOR: GatewayRequestDescriptor = {
  ...SEARCH_DESCRIPTOR,
  query: { q: "x" },
};

const INGEST_DESCRIPTOR: GatewayRequestDescriptor = {
  host: "local_gateway",
  method: "POST",
  path: "/knowledge/ingest",
  query: {},
  body: { title: "t", content: "body" },
  timeout_ms: 10_000,
  retry_policy: "no_retry_display_only",
  source_channel: "knowledge-ingest",
};

const STATS_DESCRIPTOR: GatewayRequestDescriptor = {
  host: "local_gateway",
  method: "GET",
  path: "/knowledge/stats",
  query: {},
  body: null,
  timeout_ms: 2_000,
  retry_policy: "no_retry_display_only",
  source_channel: "knowledge-stats",
};

describe("Knowledge IPC gateway client shape", () => {
  it("emits an object with an execute() function", () => {
    const client = createKnowledgeGatewayClient({
      transport: makeTransport(),
    });
    expect(typeof client.execute).toBe("function");
  });

  it("all safety literals are hard false", () => {
    expect(KNOWLEDGE_IPC_GATEWAY_CLIENT_SAFETY).toEqual({
      registered_in_app_startup: false,
      preload_switched_to_ipc: false,
      renderer_behavior_changed: false,
      default_network_enabled: false,
      real_fetch_required: false,
      auto_gateway_start_allowed: false,
      config_write_allowed: false,
      audit_write_allowed: false,
    });
  });
});

describe("Knowledge IPC gateway client transport-request conversion", () => {
  it("search descriptor becomes GET transport request with /knowledge/search and q+limit query", async () => {
    const transport = makeTransport();
    const client = createKnowledgeGatewayClient({ transport });
    const result = await client.execute(SEARCH_DESCRIPTOR);
    expect(result.ok).toBe(true);
    expect(transport.calls).toHaveLength(1);
    const request = transport.calls[0]!;
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/knowledge/search");
    expect(request.query).toEqual({ q: "example", limit: "10" });
    expect(request.body).toBeNull();
    expect(request.source_channel).toBe("knowledge-search");
    expect(request.timeout_ms).toBe(5_000);
  });

  it("search descriptor without limit omits the limit key in the request", async () => {
    const transport = makeTransport();
    const client = createKnowledgeGatewayClient({ transport });
    await client.execute(SEARCH_NO_LIMIT_DESCRIPTOR);
    const request = transport.calls[0]!;
    expect(request.query).toEqual({ q: "x" });
    expect("limit" in request.query).toBe(false);
  });

  it("ingest descriptor becomes POST transport request with JSON title/content body", async () => {
    const transport = makeTransport();
    const client = createKnowledgeGatewayClient({ transport });
    await client.execute(INGEST_DESCRIPTOR);
    const request = transport.calls[0]!;
    expect(request.method).toBe("POST");
    expect(request.path).toBe("/knowledge/ingest");
    expect(request.query).toEqual({});
    expect(request.body).toEqual({ title: "t", content: "body" });
  });

  it("stats descriptor becomes GET transport request with /knowledge/stats and no body", async () => {
    const transport = makeTransport();
    const client = createKnowledgeGatewayClient({ transport });
    await client.execute(STATS_DESCRIPTOR);
    const request = transport.calls[0]!;
    expect(request.method).toBe("GET");
    expect(request.path).toBe("/knowledge/stats");
    expect(request.query).toEqual({});
    expect(request.body).toBeNull();
  });
});

describe("Knowledge IPC gateway client transport-result handling", () => {
  it("valid response passes through unchanged", async () => {
    const canned = { status: "ok", results: [] };
    const transport = makeTransport(async () => canned);
    const client = createKnowledgeGatewayClient({ transport });
    const result = await client.execute(SEARCH_DESCRIPTOR);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(canned);
    }
  });

  it("transport rejection with 'unavailable' marker maps to gateway_unavailable", async () => {
    const transport = makeTransport(async () => {
      throw new Error("ECONNREFUSED 127.0.0.1:8643");
    });
    const client = createKnowledgeGatewayClient({ transport });
    const result = await client.execute(SEARCH_DESCRIPTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_unavailable");
    }
  });

  it("transport rejection with 'timeout' marker maps to gateway_error (Slice 3 dispatcher upgrades to gateway_timeout)", async () => {
    const transport = makeTransport(async () => {
      throw new Error("request timed out");
    });
    const client = createKnowledgeGatewayClient({ transport });
    const result = await client.execute(SEARCH_DESCRIPTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_error");
    }
  });

  it("transport rejection with unknown marker maps to gateway_error", async () => {
    const transport = makeTransport(async () => {
      throw new Error("unexpected failure");
    });
    const client = createKnowledgeGatewayClient({ transport });
    const result = await client.execute(SEARCH_DESCRIPTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_error");
    }
  });
});

describe("Knowledge IPC gateway client missing-transport safety", () => {
  it("client with null transport treats transport call rejection as gateway_error", async () => {
    // When transport is null/undefined, calling it throws TypeError.
    // The client catches the error and maps it to gateway_error.
    const client = createKnowledgeGatewayClient({
      transport: null as unknown as KnowledgeGatewayTransport,
    });
    const result = await client.execute(SEARCH_DESCRIPTOR);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_error");
    }
  });
});

describe("Knowledge IPC gateway client source purity", () => {
  it("source contains no forbidden call forms", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcMain.handle",
      "app.on(",
      "BrowserWindow",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
      "writeFile",
      "appendFile",
    ]) {
      expect(clientSrc).not.toContain(forbidden);
    }
  });

  it("source does not import electron, ipcMain, or ipcRenderer", () => {
    expect(clientSrc).not.toMatch(/from\s+["']electron/);
    expect(clientSrc).not.toMatch(/from\s+["']electron\/ipcMain/);
    expect(clientSrc).not.toMatch(/from\s+["']electron\/ipcRenderer/);
    expect(clientSrc).not.toMatch(/require\(\s*["']electron/);
  });

  it("source does not contain a fetch call (token may appear only as a marker / comment)", () => {
    // The classifier cares about actual call forms, not the substring
    // "fetch" inside a regex marker. Strip comments and check.
    const code = clientSrc
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toMatch(/\bfetch\(/);
  });
});
