// Knowledge IPC Migration Slice 6 startup wiring tests.
// Verifies the explicit main startup wiring: registerKnowledgeIpcStartupHandlers
// registers exactly the 3 channels via Slice 3 registerKnowledgeIpcHandlers,
// builds a Slice 4 createKnowledgeGatewayClient, and does not touch
// preload, renderer, config, audit, or real network. Also confirms
// src/main/index.ts now imports + invokes the startup helper exactly once.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  registerKnowledgeIpcStartupHandlers,
  buildLocalKnowledgeGatewayUrl,
  KNOWLEDGE_IPC_STARTUP_MODE,
  KNOWLEDGE_IPC_STARTUP_TARGET_FILE,
  KNOWLEDGE_IPC_STARTUP_WIRED_CHANNELS,
  KNOWLEDGE_IPC_STARTUP_SAFETY,
  type KnowledgeIpcStartupResult,
} from "../src/main/knowledge-ipc-startup";
import type { KnowledgeIpcLike } from "../src/main/knowledge-ipc-handlers";
import type { KnowledgeGatewayTransport } from "../src/main/knowledge-ipc-gateway-client";

const ROOT = join(__dirname, "..");
const startupSrc = readFileSync(
  join(ROOT, "src/main/knowledge-ipc-startup.ts"),
  "utf-8",
);
const mainIndexSrc = readFileSync(
  join(ROOT, "src/main/index.ts"),
  "utf-8",
);
const preloadSrc = readFileSync(
  join(ROOT, "src/preload/index.ts"),
  "utf-8",
);

const EXPECTED_CHANNELS = [
  "knowledge-search",
  "knowledge-ingest",
  "knowledge-stats",
] as const;

// Source forbidden inside startup helper. Slice 6 contract explicitly
// bans the runtime mutation primitives and any reference to the preload
// bridge in the main wiring code.
const FORBIDDEN_STARTUP_PATTERNS = [
  "window.hermesAPI",
  "setModelConfig(",
  "setEnv(",
  "startGateway(",
  "runPlaybook(",
  "triggerCronJob(",
  "writeFile",
  "appendFile",
  "~/.hermes",
  "handoff/packs",
  ".hermes/audit",
];

const FORBIDDEN_STARTUP_IMPORTS = [
  'from "../preload/index"',
  "from '../preload/index'",
  'from "./preload/index"',
  "from './preload/index'",
  'from "../../src/preload/index"',
  "from '../../src/preload/index'",
];

interface FakeIpc extends KnowledgeIpcLike {
  handlers: Map<string, (event: unknown, ...args: unknown[]) => Promise<unknown>>;
}

function makeIpcLike(): FakeIpc {
  const handlers = new Map<
    string,
    (event: unknown, ...args: unknown[]) => Promise<unknown>
  >();
  return {
    handlers,
    handle(channel, handler) {
      handlers.set(channel, handler);
    },
  };
}

describe("Knowledge IPC Migration Slice 6 main startup wiring", () => {
  it("declares mode main_startup_wiring_applied", () => {
    expect(KNOWLEDGE_IPC_STARTUP_MODE).toBe("main_startup_wiring_applied");
  });

  it("records expected startup hook target as src/main/index.ts", () => {
    expect(KNOWLEDGE_IPC_STARTUP_TARGET_FILE).toBe("src/main/index.ts");
  });

  it("declares exactly 3 wired channels matching Slice 0/1 contracts", () => {
    expect([...KNOWLEDGE_IPC_STARTUP_WIRED_CHANNELS].sort()).toEqual(
      [...EXPECTED_CHANNELS].sort(),
    );
    for (const ch of EXPECTED_CHANNELS) {
      expect(KNOWLEDGE_IPC_STARTUP_WIRED_CHANNELS).toContain(ch);
    }
  });

  it("hard-codes startup_wiring_applied true but keeps preload_switch_applied false", () => {
    expect(KNOWLEDGE_IPC_STARTUP_SAFETY).toMatchObject({
      startup_wiring_applied: true,
      preload_switch_applied: false,
      renderer_behavior_changed: false,
      auto_gateway_start_allowed: false,
      config_write_allowed: false,
      audit_write_allowed: false,
      live_runtime_path_changed: false,
      default_network_enabled: false,
      real_fetch_required: false,
    });
  });

  it("registers exactly the 3 knowledge channels via Slice 3 helper", () => {
    const ipc = makeIpcLike();
    const result: KnowledgeIpcStartupResult =
      registerKnowledgeIpcStartupHandlers(ipc);
    expect([...ipc.handlers.keys()].sort()).toEqual(
      [...EXPECTED_CHANNELS].sort(),
    );
    expect([...result.wired_channels].sort()).toEqual(
      [...EXPECTED_CHANNELS].sort(),
    );
    expect(result.used_custom_transport).toBe(false);
  });

  it("routes a knowledge-search invocation through the injected client", async () => {
    let observed: { method: string; path: string; query: unknown } | null =
      null;
    const fakeTransport: KnowledgeGatewayTransport = async (req) => {
      observed = {
        method: req.method,
        path: req.path,
        query: req.query,
      };
      return { status: "ok", results: [], source_channel: req.source_channel };
    };
    const ipc = makeIpcLike();
    const result = registerKnowledgeIpcStartupHandlers(ipc, {
      transport: fakeTransport,
    });
    expect(result.used_custom_transport).toBe(true);
    const handler = ipc.handlers.get("knowledge-search");
    expect(handler).toBeDefined();
    const response = (await handler!(
      {},
      { query: "alpha", limit: 3 },
    )) as { ok: boolean; code?: string; reason?: string; data?: { status: string; results: unknown[] } };
    expect(response.ok).toBe(true);
    if (response.ok) {
      expect(response.data.status).toBe("ok");
      expect(Array.isArray(response.data.results)).toBe(true);
    }
    expect(observed).toEqual({
      method: "GET",
      path: "/knowledge/search",
      query: { q: "alpha", limit: "3" },
    });
  });

  it("maps an injected transport rejection to a gateway_unavailable IPC error", async () => {
    const fakeTransport: KnowledgeGatewayTransport = async () => {
      throw new Error("connect ECONNREFUSED 127.0.0.1:8643");
    };
    const ipc = makeIpcLike();
    registerKnowledgeIpcStartupHandlers(ipc, { transport: fakeTransport });
    const handler = ipc.handlers.get("knowledge-stats");
    expect(handler).toBeDefined();
    const response = (await handler!({}, {})) as {
      ok: boolean;
      code?: string;
      reason?: string;
    };
    expect(response.ok).toBe(false);
    expect(response.code).toBe("gateway_unavailable");
  });

  it("builds the local-knowledge URL with descriptor path and query", () => {
    const url = buildLocalKnowledgeGatewayUrl({
      method: "GET",
      path: "/knowledge/search",
      query: { q: "alpha beta", limit: "5" },
      body: null,
      timeout_ms: 5_000,
      source_channel: "knowledge-search",
    });
    expect(url).toBe(
      "http://127.0.0.1:8643/knowledge/search?q=alpha%20beta&limit=5",
    );
  });

  it("source does not import src/preload/index.ts or src/renderer", () => {
    for (const pattern of FORBIDDEN_STARTUP_IMPORTS) {
      expect(startupSrc.includes(pattern)).toBe(false);
    }
    expect(
      startupSrc.includes('from "../renderer/') ||
        startupSrc.includes("from '../renderer/"),
    ).toBe(false);
  });

  it("source contains no forbidden runtime mutation primitives", () => {
    for (const pattern of FORBIDDEN_STARTUP_PATTERNS) {
      expect(startupSrc.includes(pattern)).toBe(false);
    }
    // fetch() is banned by Slice 6 source guards.
    expect(startupSrc.includes("fetch(")).toBe(false);
  });

  it("src/main/index.ts imports the startup helper exactly once", () => {
    const importMatches = mainIndexSrc.match(
      /from\s+["']\.\/knowledge-ipc-startup["']/g,
    );
    expect(importMatches).not.toBeNull();
    expect(importMatches!.length).toBe(1);
  });

  it("src/main/index.ts calls the startup helper exactly once", () => {
    const callMatches = mainIndexSrc.match(
      /registerKnowledgeIpcStartupHandlers\s*\(/g,
    );
    expect(callMatches).not.toBeNull();
    expect(callMatches!.length).toBe(1);
  });

  it("src/main/index.ts does not call forbidden startup primitives directly", () => {
    // Slice 6 only adds the knowledge wiring; it must not introduce new
    // direct calls to startGateway / setEnv / setModelConfig / etc. in
    // the wiring path. Existing call sites elsewhere in main/index.ts
    // are out of scope (see forbidden-claims test below).
    const wiringSnippet = extractStartupWiringSnippet(mainIndexSrc);
    for (const pattern of [
      "startGateway(",
      "setEnv(",
      "setModelConfig(",
      "runPlaybook(",
      "triggerCronJob(",
      "writeFile",
      "appendFile",
    ]) {
      expect(wiringSnippet.includes(pattern)).toBe(false);
    }
  });

  it("src/preload/index.ts remains unchanged (no knowledgeSearch/Ingest/getGbrainStats removal)", () => {
    // The 3 raw fetch calls must still be present and unaltered.
    expect(preloadSrc).toContain("http://127.0.0.1:8643/knowledge/search");
    expect(preloadSrc).toContain("http://127.0.0.1:8643/knowledge/ingest");
    expect(preloadSrc).toContain("http://127.0.0.1:8643/knowledge/stats");
    expect(preloadSrc).toContain("knowledgeSearch:");
    expect(preloadSrc).toContain("knowledgeIngest:");
    expect(preloadSrc).toContain("getGbrainStats:");
  });
});

function extractStartupWiringSnippet(source: string): string {
  // Locate the import line for knowledge-ipc-startup and grab up to the
  // end of the call expression that invokes the helper. We do this by
  // walking balanced parens starting from the call site.
  const importIdx = source.indexOf('from "./knowledge-ipc-startup"');
  if (importIdx === -1) return "";
  // Find the FIRST invocation of the helper after the import.
  const callIdx = source.indexOf("registerKnowledgeIpcStartupHandlers(", importIdx);
  if (callIdx === -1) return "";
  // Walk to the matching closing paren.
  let depth = 0;
  for (let i = callIdx; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) {
        // Trim to import line + the call line (a few comment lines above
        // are expected and contain only descriptive text, not code).
        const importLineEnd = source.indexOf("\n", importIdx);
        const importLine =
          importLineEnd === -1
            ? source.slice(importIdx)
            : source.slice(importIdx, importLineEnd);
        const callLine = source.slice(callIdx, i + 1);
        return `${importLine}\n  ${callLine}`;
      }
    }
  }
  return source.slice(importIdx);
}
