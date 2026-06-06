// Knowledge IPC Migration Slice 2: main gateway adapter helper.
// Pure data projection. No fetch, no ipcMain.handle, no electron import.
// Describes how the future main handler will map Slice 1 channel +
// request payload into a gateway HTTP request descriptor, and how the
// gateway response should be validated against Slice 1 error codes.

import {
  validateKnowledgeIngestRequest,
  validateKnowledgeResponse,
  validateKnowledgeSearchRequest,
  validateKnowledgeStatsRequest,
  KNOWLEDGE_IPC_SHAPE_CONTRACT,
  type KnowledgeIpcChannel,
  type KnowledgeIpcErrorCode,
  type KnowledgeRequestPayload,
  type KnowledgeResponsePayload,
  type ValidationResult,
} from "../shared/lib/knowledge-ipc-shape-contract";
import type { KnowledgeIpcMigrationMethod } from "../shared/lib/knowledge-ipc-migration-contract";

export const KNOWLEDGE_IPC_GATEWAY_ADAPTER_MODE =
  "main_gateway_adapter_helper_only" as const;

export const KNOWLEDGE_IPC_GATEWAY_TARGET_HOST = "local_gateway" as const;

export type GatewayHttpMethod = "GET" | "POST";

export interface GatewayRequestDescriptor {
  host: typeof KNOWLEDGE_IPC_GATEWAY_TARGET_HOST;
  method: GatewayHttpMethod;
  path: string;
  query: Readonly<Record<string, string>>;
  body: unknown;
  // Display-only timeout/retry metadata. Not enforced anywhere in this
  // slice; it documents the policy the future real fetch wrapper will
  // apply.
  timeout_ms: number;
  retry_policy: "no_retry_display_only";
  // Which Slice 1 channel produced this descriptor. Round-trip info for
  // tests and for the future handler.
  source_channel: KnowledgeIpcChannel;
}

export interface GatewayAdapterResult {
  ok: boolean;
  // When ok=true, the (validated) Slice 1 response payload.
  response?: KnowledgeResponsePayload;
  // When ok=false, the mapped error code from Slice 1.
  code?: KnowledgeIpcErrorCode;
  reason?: string;
}

const GATEWAY_PATH_BY_CHANNEL: Readonly<
  Record<KnowledgeIpcChannel, string>
> = {
  "knowledge-search": "/knowledge/search",
  "knowledge-ingest": "/knowledge/ingest",
  "knowledge-stats": "/knowledge/stats",
};

const HTTP_METHOD_BY_CHANNEL: Readonly<
  Record<KnowledgeIpcChannel, GatewayHttpMethod>
> = {
  "knowledge-search": "GET",
  "knowledge-ingest": "POST",
  "knowledge-stats": "GET",
};

const TIMEOUT_BY_CHANNEL: Readonly<Record<KnowledgeIpcChannel, number>> = {
  "knowledge-search": 5_000,
  "knowledge-ingest": 10_000,
  "knowledge-stats": 2_000,
};

function channelToMethod(
  channel: KnowledgeIpcChannel,
): KnowledgeIpcMigrationMethod["name"] {
  const shape = KNOWLEDGE_IPC_SHAPE_CONTRACT.channels.find(
    (entry) => entry.channel === channel,
  );
  if (!shape) {
    throw new Error(
      `unknown channel: ${channel} (no matching Slice 1 shape)`,
    );
  }
  return shape.method;
}

export function buildGatewayRequestDescriptor(
  channel: KnowledgeIpcChannel,
  payload: KnowledgeRequestPayload,
): GatewayAdapterResult & { descriptor?: GatewayRequestDescriptor } {
  const validation = validateChannelRequest(channel, payload);
  if (!validation.ok) {
    return { ok: false, code: validation.code, reason: validation.reason };
  }

  const path = GATEWAY_PATH_BY_CHANNEL[channel];
  const method = HTTP_METHOD_BY_CHANNEL[channel];
  const timeout = TIMEOUT_BY_CHANNEL[channel];

  if (channel === "knowledge-search") {
    const record = payload as { query: string; limit?: number };
    const query: Record<string, string> = { q: record.query };
    if (record.limit !== undefined) {
      query.limit = String(record.limit);
    }
    return {
      ok: true,
      descriptor: {
        host: KNOWLEDGE_IPC_GATEWAY_TARGET_HOST,
        method,
        path,
        query,
        body: null,
        timeout_ms: timeout,
        retry_policy: "no_retry_display_only",
        source_channel: channel,
      },
    };
  }
  if (channel === "knowledge-ingest") {
    const record = payload as { title: string; content: string };
    return {
      ok: true,
      descriptor: {
        host: KNOWLEDGE_IPC_GATEWAY_TARGET_HOST,
        method,
        path,
        query: {},
        body: { title: record.title, content: record.content },
        timeout_ms: timeout,
        retry_policy: "no_retry_display_only",
        source_channel: channel,
      },
    };
  }
  // knowledge-stats
  return {
    ok: true,
    descriptor: {
      host: KNOWLEDGE_IPC_GATEWAY_TARGET_HOST,
      method,
      path,
      query: {},
      body: null,
      timeout_ms: timeout,
      retry_policy: "no_retry_display_only",
      source_channel: channel,
    },
  };
}

function validateChannelRequest(
  channel: KnowledgeIpcChannel,
  payload: unknown,
): ValidationResult {
  if (channel === "knowledge-search") {
    return validateKnowledgeSearchRequest(payload);
  }
  if (channel === "knowledge-ingest") {
    return validateKnowledgeIngestRequest(payload);
  }
  return validateKnowledgeStatsRequest(payload);
}

export function validateChannelResponse(
  channel: KnowledgeIpcChannel,
  payload: unknown,
): ValidationResult {
  return validateKnowledgeResponse(channelToMethod(channel), payload);
}

// Map a future transport-level error to a Slice 1 error code. The
// transport itself is not invoked here; this function is pure and is
// only used by tests + the future handler.
export function mapTransportErrorToIpcError(
  reason: "gateway_unavailable" | "gateway_timeout" | "gateway_error",
): { code: KnowledgeIpcErrorCode; reason: string } {
  switch (reason) {
    case "gateway_unavailable":
      return { code: "gateway_unavailable", reason: "gateway unreachable" };
    case "gateway_timeout":
      return { code: "gateway_timeout", reason: "gateway request timed out" };
    case "gateway_error":
      return { code: "gateway_error", reason: "gateway returned a non-2xx status" };
  }
}

export const KNOWLEDGE_IPC_GATEWAY_ADAPTER_SAFETY = {
  fetch_executed: false,
  ipc_handler_registered: false,
  preload_bridge_changed: false,
  renderer_behavior_changed: false,
  audit_write_allowed: false,
  config_write_allowed: false,
  runtime_migration_applied: false,
} as const;
