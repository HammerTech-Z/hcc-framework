// Knowledge IPC Migration Slice 4: main gateway client executor helper.
// Pure helper that converts a Slice 2 GatewayRequestDescriptor into a
// transport request, then dispatches to an injected transport function.
// No fetch call, no globalThis access, no electron / ipcMain import.
// This is the *candidate* gatewayClient implementation for Slice 3; it
// is not wired into src/main/index.ts in this slice.

import {
  type GatewayRequestDescriptor,
} from "./knowledge-ipc-gateway-adapter";
import type { KnowledgeGatewayClient } from "./knowledge-ipc-handlers";

export interface KnowledgeGatewayTransportRequest {
  method: "GET" | "POST";
  path: string;
  query: Readonly<Record<string, string>>;
  body: unknown;
  timeout_ms: number;
  // Source-channel label for cross-checking in the fake transport.
  source_channel: string;
}

export type KnowledgeGatewayTransportResult = unknown;

export type KnowledgeGatewayTransport = (
  request: KnowledgeGatewayTransportRequest,
) => Promise<KnowledgeGatewayTransportResult>;

export interface KnowledgeGatewayClientOptions {
  transport: KnowledgeGatewayTransport;
}

export type KnowledgeGatewayClientExecuteOutcome =
  | { ok: true; data: unknown }
  | { ok: false; code: "gateway_unavailable"; reason: string };

function classifyTransportError(message: string): {
  code: "gateway_unavailable" | "gateway_error";
  reason: string;
} {
  if (
    /unavailable|econnrefused|fetch failed|network|socket hang up/i.test(
      message,
    )
  ) {
    return { code: "gateway_unavailable", reason: message };
  }
  if (/timeout|timed out/i.test(message)) {
    // The Slice 3 dispatcher maps timeouts itself; we still surface them
    // as a generic error from here so the execute() result type stays
    // narrow. The Slice 3 path handles the timeout-to-gateway_timeout
    // upgrade.
    return { code: "gateway_error", reason: message };
  }
  return { code: "gateway_error", reason: message };
}

export function createKnowledgeGatewayClient(
  options: KnowledgeGatewayClientOptions,
): KnowledgeGatewayClient {
  const { transport } = options;
  return {
    async execute(descriptor: GatewayRequestDescriptor) {
      const request: KnowledgeGatewayTransportRequest = {
        method: descriptor.method,
        path: descriptor.path,
        query: descriptor.query,
        body: descriptor.body,
        timeout_ms: descriptor.timeout_ms,
        source_channel: descriptor.source_channel,
      };
      try {
        const data = await transport(request);
        return { ok: true as const, data };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const classified = classifyTransportError(message);
        return {
          ok: false as const,
          code: classified.code,
          reason: classified.reason,
        };
      }
    },
  };
}

export const KNOWLEDGE_IPC_GATEWAY_CLIENT_SAFETY = {
  registered_in_app_startup: false,
  preload_switched_to_ipc: false,
  renderer_behavior_changed: false,
  default_network_enabled: false,
  real_fetch_required: false,
  auto_gateway_start_allowed: false,
  config_write_allowed: false,
  audit_write_allowed: false,
} as const;
