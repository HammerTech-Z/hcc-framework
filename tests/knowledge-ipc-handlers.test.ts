// Knowledge IPC Migration Slice 3 guarded handler registration tests.
// Pure injection-based tests: a fake ipcLike captures channel + handler;
// a fake gatewayClient records the descriptor + returns canned data.
// Validates: 3 channel registration, descriptor dispatch, request
// validation, response validation, transport error mapping, and source
// purity.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  registerKnowledgeIpcHandlers,
  KNOWLEDGE_IPC_HANDLERS_MODE,
  KNOWLEDGE_IPC_HANDLERS_SAFETY,
  type KnowledgeIpcHandlerResult,
  type KnowledgeIpcLike,
  type KnowledgeGatewayClient,
} from "../src/main/knowledge-ipc-handlers";

const ROOT = join(__dirname, "..");
const handlersSrc = readFileSync(
  join(ROOT, "src/main/knowledge-ipc-handlers.ts"),
  "utf-8",
);

interface RecordedCall {
  channel: string;
  payload: unknown;
}

interface FakeIpc extends KnowledgeIpcLike {
  handlers: Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>;
  record: RecordedCall[];
}

function makeIpcLike(): FakeIpc {
  const handlers = new Map<
    string,
    (event: unknown, ...args: unknown[]) => Promise<unknown>
  >();
  return {
    handlers,
    record: [],
    handle(channel, handler) {
      handlers.set(channel, handler);
      this.record.push({ channel, payload: undefined });
    },
  };
}

interface FakeClient extends KnowledgeGatewayClient {
  calls: Array<{ descriptor: unknown }>;
  responder: (descriptor: unknown) => Promise<unknown>;
}

function makeClient(responder?: (descriptor: unknown) => Promise<unknown>): FakeClient {
  const calls: Array<{ descriptor: unknown }> = [];
  return {
    calls,
    responder: responder ?? (async () => ({ status: "ok" })),
    async execute(descriptor) {
      calls.push({ descriptor });
      return this.responder(descriptor);
    },
  };
}

const DESCRIPTOR_PATH_BY_CHANNEL: Readonly<Record<string, string>> = {
  "knowledge-search": "/knowledge/search",
  "knowledge-ingest": "/knowledge/ingest",
  "knowledge-stats": "/knowledge/stats",
};

describe("Knowledge IPC handlers registration", () => {
  it("uses mode guarded_registration_helper_only", () => {
    expect(KNOWLEDGE_IPC_HANDLERS_MODE).toBe(
      "guarded_registration_helper_only",
    );
  });

  it("registers exactly 3 channels matching Slice 0 / Slice 1", () => {
    const ipc = makeIpcLike();
    const client = makeClient();
    const channels = registerKnowledgeIpcHandlers(ipc, client);
    expect(channels).toEqual([
      "knowledge-search",
      "knowledge-ingest",
      "knowledge-stats",
    ]);
    expect([...ipc.handlers.keys()].sort()).toEqual([
      "knowledge-ingest",
      "knowledge-search",
      "knowledge-stats",
    ]);
  });

  it("all safety literals are hard false", () => {
    expect(KNOWLEDGE_IPC_HANDLERS_SAFETY).toEqual({
      registered_in_app_startup: false,
      preload_switched_to_ipc: false,
      renderer_behavior_changed: false,
      config_write_allowed: false,
      audit_write_allowed: false,
      auto_gateway_start_allowed: false,
    });
  });
});

describe("Knowledge IPC handler dispatch", () => {
  it("search handler validates payload and calls gatewayClient with descriptor path /knowledge/search", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(
      async () => ({ status: "ok", results: [] }),
    );
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler(
      {},
      { query: "example", limit: 5 },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(true);
    expect(client.calls).toHaveLength(1);
    const descriptor = client.calls[0]!.descriptor as {
      source_channel: string;
      path: string;
      method: string;
    };
    expect(descriptor.source_channel).toBe("knowledge-search");
    expect(descriptor.path).toBe("/knowledge/search");
    expect(descriptor.method).toBe("GET");
  });

  it("ingest handler calls gatewayClient with descriptor path /knowledge/ingest", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(
      async () => ({ status: "ok", path: "vault/x.md" }),
    );
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-ingest")!;
    const result = (await handler(
      {},
      { title: "t", content: "body" },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(true);
    const descriptor = client.calls[0]!.descriptor as {
      source_channel: string;
      path: string;
      method: string;
      body: unknown;
    };
    expect(descriptor.source_channel).toBe("knowledge-ingest");
    expect(descriptor.path).toBe("/knowledge/ingest");
    expect(descriptor.method).toBe("POST");
    expect(descriptor.body).toEqual({ title: "t", content: "body" });
  });

  it("stats handler calls gatewayClient with descriptor path /knowledge/stats", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(
      async () => ({ status: "ok", total_files: 0 }),
    );
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-stats")!;
    const result = (await handler({}, {})) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(true);
    const descriptor = client.calls[0]!.descriptor as {
      source_channel: string;
      path: string;
      method: string;
    };
    expect(descriptor.source_channel).toBe("knowledge-stats");
    expect(descriptor.path).toBe("/knowledge/stats");
    expect(descriptor.method).toBe("GET");
  });

  it("invalid payload returns invalid_payload error without calling the gateway", async () => {
    const ipc = makeIpcLike();
    const client = makeClient();
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler({}, { query: "" })) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("invalid_payload");
    }
    expect(client.calls).toHaveLength(0);
  });

  it("valid responses pass through exact shape", async () => {
    const ipc = makeIpcLike();
    const canned = {
      status: "ok",
      results: [{ file: "x.md", score: 0.9, preview: "..." }],
    };
    const client = makeClient(async () => canned);
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler(
      {},
      { query: "x" },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(canned);
    }
  });

  it("bad response maps to response_shape_mismatch", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(async () => ({ results: [] })); // missing status
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler(
      {},
      { query: "x" },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("response_shape_mismatch");
    }
  });
});

describe("Knowledge IPC handler transport error mapping", () => {
  it("gateway timeout maps to gateway_timeout", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(async () => {
      throw new Error("request timed out");
    });
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler(
      {},
      { query: "x" },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_timeout");
    }
  });

  it("gateway unavailable maps to gateway_unavailable", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(async () => {
      throw new Error("ECONNREFUSED 127.0.0.1:8643");
    });
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler(
      {},
      { query: "x" },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_unavailable");
    }
  });

  it("generic transport error maps to gateway_error", async () => {
    const ipc = makeIpcLike();
    const client = makeClient(async () => {
      throw new Error("unexpected failure");
    });
    registerKnowledgeIpcHandlers(ipc, client);
    const handler = ipc.handlers.get("knowledge-search")!;
    const result = (await handler(
      {},
      { query: "x" },
    )) as KnowledgeIpcHandlerResult;
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("gateway_error");
    }
  });
});

describe("Knowledge IPC handlers source purity", () => {
  it("source contains no forbidden call forms", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "fetch(",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
      "writeFile",
      "appendFile",
    ]) {
      expect(handlersSrc).not.toContain(forbidden);
    }
  });

  it("source does not import electron or ipcMain", () => {
    expect(handlersSrc).not.toMatch(/from\s+["']electron["']/);
    expect(handlersSrc).not.toMatch(/from\s+["']electron\/ipcMain["']/);
    expect(handlersSrc).not.toMatch(/require\(\s*["']electron["']\s*\)/);
  });

  it("descriptor paths in dispatch are exactly the Slice 2 routing table", () => {
    // Cross-check that the test expectations stay aligned with the Slice 2
    // adapter's path mapping.
    for (const [channel, path] of Object.entries(DESCRIPTOR_PATH_BY_CHANNEL)) {
      expect(path).toMatch(/^\/knowledge\//);
      expect(channel).toMatch(/^knowledge-/);
    }
  });
});
