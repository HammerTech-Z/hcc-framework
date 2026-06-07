// Knowledge IPC Migration Slice 7 main gateway transport tests.
// Verifies the descriptor-driven HTTP transport: URL building, GET vs
// POST semantics, error mapping, and isolation from real network. All
// tests inject a fake fetchLike so the suite is hermetic.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildKnowledgeGatewayUrl,
  createKnowledgeGatewayTransport,
  KNOWLEDGE_IPC_TRANSPORT_MODE,
  KNOWLEDGE_IPC_TRANSPORT_SAFETY,
  type KnowledgeFetchLike,
} from "../src/main/knowledge-ipc-transport";
import type { KnowledgeGatewayTransportRequest } from "../src/main/knowledge-ipc-gateway-client";

const ROOT = join(__dirname, "..");
const transportSrc = readFileSync(
  join(ROOT, "src/main/knowledge-ipc-transport.ts"),
  "utf-8",
);
const startupSrc = readFileSync(
  join(ROOT, "src/main/knowledge-ipc-startup.ts"),
  "utf-8",
);

interface RecordedFetch {
  url: string;
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string | null;
    signal?: unknown;
  };
}

interface FakeFetch extends KnowledgeFetchLike {
  calls: RecordedFetch[];
  responder: (call: RecordedFetch) => {
    ok: boolean;
    status: number;
    body: unknown;
  };
  forceError?: Error;
  forceAbort?: boolean;
}

function makeFetchLike(responder?: FakeFetch["responder"]): FakeFetch {
  const calls: RecordedFetch[] = [];
  const fetchLike: FakeFetch = (((
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body?: string | null;
      signal?: unknown;
    },
  ) => {
    calls.push({ url, init });
    if (fetchLike.forceAbort) {
      const err = new Error("aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    }
    if (fetchLike.forceError) {
      return Promise.reject(fetchLike.forceError);
    }
    const responderLocal = responder ?? (() => ({ ok: true, status: 200, body: { status: "ok" } }));
    const out = responderLocal(calls[calls.length - 1]!);
    return Promise.resolve({
      ok: out.ok,
      status: out.status,
      async text() {
        return typeof out.body === "string" ? out.body : JSON.stringify(out.body);
      },
      async json() {
        if (typeof out.body === "string") {
          return JSON.parse(out.body);
        }
        return out.body;
      },
    });
  }) as unknown) as FakeFetch;
  fetchLike.calls = calls;
  fetchLike.responder = responder ?? (() => ({ ok: true, status: 200, body: { status: "ok" } }));
  return fetchLike;
}

const SEARCH_REQ: KnowledgeGatewayTransportRequest = {
  method: "GET",
  path: "/knowledge/search",
  query: { q: "alpha", limit: "3" },
  body: null,
  timeout_ms: 5_000,
  source_channel: "knowledge-search",
};

const INGEST_REQ: KnowledgeGatewayTransportRequest = {
  method: "POST",
  path: "/knowledge/ingest",
  query: {},
  body: { title: "t", content: "body" },
  timeout_ms: 10_000,
  source_channel: "knowledge-ingest",
};

const STATS_REQ: KnowledgeGatewayTransportRequest = {
  method: "GET",
  path: "/knowledge/stats",
  query: {},
  body: null,
  timeout_ms: 2_000,
  source_channel: "knowledge-stats",
};

describe("Knowledge IPC Migration Slice 7 main gateway transport", () => {
  it("declares mode main_gateway_transport_only", () => {
    expect(KNOWLEDGE_IPC_TRANSPORT_MODE).toBe(
      "main_gateway_transport_only",
    );
  });

  it("declares transport_implemented true but keeps preload_switched_to_ipc false", () => {
    expect(KNOWLEDGE_IPC_TRANSPORT_SAFETY).toMatchObject({
      transport_implemented: true,
      preload_switched_to_ipc: false,
      renderer_behavior_changed: false,
      auto_gateway_start_allowed: false,
      config_write_allowed: false,
      audit_write_allowed: false,
      real_network_on_handler_invoke_only: true,
    });
  });

  it("builds exact URL for knowledge-search with q + limit", () => {
    const url = buildKnowledgeGatewayUrl(
      "http://127.0.0.1:8643",
      SEARCH_REQ,
    );
    expect(url).toBe(
      "http://127.0.0.1:8643/knowledge/search?q=alpha&limit=3",
    );
  });

  it("omits limit query when descriptor has no limit", () => {
    const url = buildKnowledgeGatewayUrl("http://127.0.0.1:8643", {
      ...SEARCH_REQ,
      query: { q: "x" },
    });
    expect(url).toBe("http://127.0.0.1:8643/knowledge/search?q=x");
  });

  it("search GET request: method GET, no body, Accept header", async () => {
    const f = makeFetchLike();
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await t(SEARCH_REQ);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    expect(call.url).toBe(
      "http://127.0.0.1:8643/knowledge/search?q=alpha&limit=3",
    );
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
    expect(call.init.headers.Accept).toBe("application/json");
  });

  it("ingest POST request: method POST, JSON body, Content-Type", async () => {
    const f = makeFetchLike();
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await t(INGEST_REQ);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    expect(call.url).toBe("http://127.0.0.1:8643/knowledge/ingest");
    expect(call.init.method).toBe("POST");
    expect(call.init.body).toBe(JSON.stringify({ title: "t", content: "body" }));
    expect(call.init.headers["Content-Type"]).toBe("application/json");
  });

  it("stats GET request: method GET, no body, no Content-Type", async () => {
    const f = makeFetchLike();
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await t(STATS_REQ);
    expect(f.calls).toHaveLength(1);
    const call = f.calls[0]!;
    expect(call.url).toBe("http://127.0.0.1:8643/knowledge/stats");
    expect(call.init.method).toBe("GET");
    expect(call.init.body).toBeUndefined();
    expect(call.init.headers["Content-Type"]).toBeUndefined();
  });

  it("returns parsed JSON payload on 2xx response", async () => {
    const f = makeFetchLike(() => ({
      ok: true,
      status: 200,
      body: { status: "ok", results: [{ file: "x", score: 0.9, preview: "p" }] },
    }));
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    const out = await t(SEARCH_REQ);
    expect(out).toEqual({
      status: "ok",
      results: [{ file: "x", score: 0.9, preview: "p" }],
    });
  });

  it("non-2xx response throws with code gateway_error", async () => {
    const f = makeFetchLike(() => ({
      ok: false,
      status: 500,
      body: "boom",
    }));
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await expect(t(SEARCH_REQ)).rejects.toMatchObject({
      code: "gateway_error",
    });
  });

  it("AbortError / timeout throws with code gateway_timeout", async () => {
    const f = makeFetchLike();
    f.forceAbort = true;
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await expect(t(SEARCH_REQ)).rejects.toMatchObject({
      code: "gateway_timeout",
    });
  });

  it("connection error throws with code gateway_unavailable", async () => {
    const f = makeFetchLike();
    f.forceError = new Error("connect ECONNREFUSED 127.0.0.1:8643");
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await expect(t(SEARCH_REQ)).rejects.toMatchObject({
      code: "gateway_unavailable",
    });
  });

  it("malformed JSON response throws with code gateway_error", async () => {
    const f = makeFetchLike(() => ({
      ok: true,
      status: 200,
      body: "<<not-json>>",
    }));
    const t = createKnowledgeGatewayTransport({
      fetchLike: f,
      baseUrl: "http://127.0.0.1:8643",
    });
    await expect(t(SEARCH_REQ)).rejects.toMatchObject({
      code: "gateway_error",
    });
  });

  it("source contains no forbidden runtime mutation primitives", () => {
    const forbidden = [
      "ipcMain.handle",
      "window.hermesAPI",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
      "writeFile",
      "appendFile",
      "handoff/packs",
      ".hermes/audit",
    ];
    for (const pattern of forbidden) {
      expect(transportSrc.includes(pattern)).toBe(false);
    }
  });

  it("startup file does not introduce a forbidden real fetch at module scope", () => {
    // The startup module imports the transport factory but does not
    // call the network primitive directly. The Slice 6 source guard
    // continues to ban the literal string at module scope; the Slice 7
    // transport helper is the only place where the network primitive
    // may appear.
    expect(startupSrc.includes("fetch(")).toBe(false);
  });
});
