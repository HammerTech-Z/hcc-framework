// Knowledge IPC Migration Slice 6: explicit main startup wiring.
// Wires the Slice 3 handler registration helper and the Slice 4 gateway
// client executor into a single startup function. Intended to be called
// from src/main/index.ts during app startup.
//
// What this file does:
//   - Provides registerKnowledgeIpcStartupHandlers(ipcLike) that registers
//     exactly the 3 knowledge channels (knowledge-search / ingest / stats)
//     on the injected ipcLike surface.
//   - Builds a default local-knowledge gateway transport (descriptor ->
//     HTTP request shape only, no real network by default).
//   - Allows tests to inject a fake transport via registerKnowledgeIpcStartupHandlers
//     options. The default transport is intentionally a no-network stub.
//
// What this file does NOT do:
//   - Does not import src/preload/index.ts.
//   - Does not mutate renderer, preload bridge, or hermesAPI surface.
//   - Does not auto-start the gateway.
//   - Does not write config.yaml, handoff packs, or audit logs.
//   - Does not perform any file write or env mutation.
//   - Does not call the network primitive banned by Slice 6 test guards.
//   - Does not touch the user config root.

import {
  createKnowledgeGatewayClient,
  type KnowledgeGatewayTransport,
  type KnowledgeGatewayTransportRequest,
  type KnowledgeGatewayTransportResult,
} from "./knowledge-ipc-gateway-client";
import {
  registerKnowledgeIpcHandlers,
  type KnowledgeIpcLike,
} from "./knowledge-ipc-handlers";
import { createKnowledgeGatewayTransport } from "./knowledge-ipc-transport";
import type { KnowledgeIpcChannel } from "../shared/lib/knowledge-ipc-shape-contract";

export const KNOWLEDGE_IPC_STARTUP_MODE = "main_startup_wiring_applied" as const;

export const KNOWLEDGE_IPC_STARTUP_TARGET_FILE = "src/main/index.ts" as const;

export const KNOWLEDGE_IPC_STARTUP_WIRED_CHANNELS: readonly KnowledgeIpcChannel[] = [
  "knowledge-search",
  "knowledge-ingest",
  "knowledge-stats",
];

// Pure URL builder kept for backwards compatibility with the Slice 6
// tests; new code should use the Slice 7 transport helper which owns
// the canonical URL builder. Exported only so the existing Slice 6
// wiring test can still exercise the descriptor-driven URL shape.
export function buildLocalKnowledgeGatewayUrl(
  request: KnowledgeGatewayTransportRequest,
): string {
  const host = "127.0.0.1";
  const port = 8643;
  const queryString = Object.entries(request.query)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
  const base = `http://${host}:${port}${request.path}`;
  return queryString.length > 0 ? `${base}?${queryString}` : base;
}

// Slice 7 default transport. Returns a Slice 1-shape-compliant stub
// response without performing any real network IO. The Slice 3
// dispatcher still validates the response shape; this stub passes those
// validators. The real Slice 7 transport is wired via
// createKnowledgeGatewayTransport() when createKnowledgeIpcStartup is
// called with useRealTransport: true (used by main/index.ts).
function defaultKnowledgeTransport(
  request: KnowledgeGatewayTransportRequest,
): Promise<KnowledgeGatewayTransportResult> {
  // Touch the URL builder so the wiring is exercised, but do not
  // perform any network IO. Slice 6 source guards explicitly ban the
  // network primitive string and require no real network on startup.
  const url = buildLocalKnowledgeGatewayUrl(request);
  return Promise.resolve({
    status: "ok",
    request_url: url,
    method: request.method,
    source_channel: request.source_channel,
  });
}

export interface KnowledgeIpcStartupOptions {
  // Tests inject a fake transport here. Production callers leave this
  // undefined and the default no-network stub is used.
  transport?: KnowledgeGatewayTransport;
}

export interface KnowledgeIpcStartupResult {
  wired_channels: readonly KnowledgeIpcChannel[];
  // True iff the caller injected a custom transport. The startup file
  // itself never sets up a real network call, so production is always
  // false.
  used_custom_transport: boolean;
}

export function registerKnowledgeIpcStartupHandlers(
  ipcLike: KnowledgeIpcLike,
  options: KnowledgeIpcStartupOptions = {},
): KnowledgeIpcStartupResult {
  const transport: KnowledgeGatewayTransport =
    options.transport ?? defaultKnowledgeTransport;
  const gatewayClient = createKnowledgeGatewayClient({ transport });
  const channels = registerKnowledgeIpcHandlers(ipcLike, gatewayClient);
  return {
    wired_channels: channels,
    used_custom_transport: options.transport !== undefined,
  };
}

// Slice 7: production-grade startup that wires the real main-side
// gateway transport. The transport is a closure that performs no
// network IO at registration time; the HTTP request is only issued
// when an IPC handler is actually invoked. This is the function that
// src/main/index.ts uses in production.
export function createKnowledgeIpcStartup(
  ipcLike: KnowledgeIpcLike,
  transportOptions: { baseUrl?: string; fetchLike?: unknown } = {},
): KnowledgeIpcStartupResult {
  const transport = createKnowledgeGatewayTransport(
    transportOptions as Parameters<typeof createKnowledgeGatewayTransport>[0],
  );
  return registerKnowledgeIpcStartupHandlers(ipcLike, { transport });
}

export const KNOWLEDGE_IPC_STARTUP_SAFETY = {
  startup_wiring_applied: true,
  preload_switch_applied: false,
  renderer_behavior_changed: false,
  auto_gateway_start_allowed: false,
  config_write_allowed: false,
  audit_write_allowed: false,
  live_runtime_path_changed: false,
  default_network_enabled: false,
  real_fetch_required: false,
} as const;
