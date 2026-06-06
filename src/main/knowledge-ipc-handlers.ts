// Knowledge IPC Migration Slice 3: guarded IPC handler registration helper.
// Registers 3 channels (knowledge-search / knowledge-ingest / knowledge-stats)
// against an injected ipcLike surface, dispatching to an injected
// gatewayClient.execute(descriptor). NO preload switch, NO app startup
// activation, NO renderer wiring, NO config / audit write, NO automatic
// gateway start. This file does not import electron, ipcMain, or any
// renderer / preload module.

import {
  validateChannelResponse,
  buildGatewayRequestDescriptor,
  mapTransportErrorToIpcError,
  KNOWLEDGE_IPC_GATEWAY_ADAPTER_MODE,
  type GatewayRequestDescriptor,
} from "./knowledge-ipc-gateway-adapter";
import {
  type KnowledgeIpcChannel,
  type KnowledgeIpcErrorCode,
  type KnowledgeRequestPayload,
  type KnowledgeResponsePayload,
  type ValidationResult,
} from "../shared/lib/knowledge-ipc-shape-contract";

export const KNOWLEDGE_IPC_HANDLERS_MODE = "guarded_registration_helper_only" as const;

export type KnowledgeIpcLike = {
  handle(
    channel: string,
    handler: (event: unknown, ...args: unknown[]) => Promise<unknown> | unknown,
  ): void;
};

export type KnowledgeGatewayClient = {
  execute(descriptor: GatewayRequestDescriptor): Promise<unknown>;
};

export interface KnowledgeIpcErrorPayload {
  ok: false;
  code: KnowledgeIpcErrorCode;
  reason: string;
}

export type KnowledgeIpcOkPayload = {
  ok: true;
  data: KnowledgeResponsePayload;
};

export type KnowledgeIpcHandlerResult = KnowledgeIpcOkPayload | KnowledgeIpcErrorPayload;

const SUPPORTED_CHANNELS: readonly KnowledgeIpcChannel[] = [
  "knowledge-search",
  "knowledge-ingest",
  "knowledge-stats",
];

function errorResult(
  code: KnowledgeIpcErrorCode,
  reason: string,
): KnowledgeIpcErrorPayload {
  return { ok: false, code, reason };
}

function okResult(data: KnowledgeResponsePayload): KnowledgeIpcOkPayload {
  return { ok: true, data };
}

function buildValidation(
  result: ValidationResult,
  fallback: KnowledgeIpcErrorCode = "invalid_payload",
): KnowledgeIpcErrorPayload | null {
  if (result.ok) return null;
  return errorResult(result.code ?? fallback, result.reason);
}

async function dispatch(
  channel: KnowledgeIpcChannel,
  payload: KnowledgeRequestPayload,
  gatewayClient: KnowledgeGatewayClient,
): Promise<KnowledgeIpcHandlerResult> {
  // Step 1: build descriptor (this re-runs Slice 1 request validators).
  const built = buildGatewayRequestDescriptor(channel, payload);
  if (!built.ok || !built.descriptor) {
    return errorResult(
      built.code ?? "invalid_payload",
      built.reason ?? "descriptor build failed",
    );
  }
  // Step 2: execute via the injected gateway client.
  let raw: unknown;
  try {
    raw = await gatewayClient.execute(built.descriptor);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Map known transport-error substrings to Slice 1 codes; default to
    // gateway_error for any other rejection.
    if (/timeout|timed out/i.test(message)) {
      const mapped = mapTransportErrorToIpcError("gateway_timeout");
      return errorResult(mapped.code, mapped.reason);
    }
    if (/unavailable|econnrefused|fetch failed|network/i.test(message)) {
      const mapped = mapTransportErrorToIpcError("gateway_unavailable");
      return errorResult(mapped.code, mapped.reason);
    }
    const mapped = mapTransportErrorToIpcError("gateway_error");
    return errorResult(mapped.code, `${mapped.reason}: ${message}`);
  }
  // Step 3: validate response shape against Slice 1 response validator.
  const responseCheck = buildValidation(
    validateChannelResponse(channel, raw),
  );
  if (responseCheck) return responseCheck;
  return okResult(raw as KnowledgeResponsePayload);
}

export function registerKnowledgeIpcHandlers(
  ipcLike: KnowledgeIpcLike,
  gatewayClient: KnowledgeGatewayClient,
): readonly KnowledgeIpcChannel[] {
  ipcLike.handle(
    "knowledge-search",
    async (_event, rawPayload: unknown) =>
      dispatch("knowledge-search", rawPayload as KnowledgeRequestPayload, gatewayClient),
  );
  ipcLike.handle(
    "knowledge-ingest",
    async (_event, rawPayload: unknown) =>
      dispatch("knowledge-ingest", rawPayload as KnowledgeRequestPayload, gatewayClient),
  );
  ipcLike.handle(
    "knowledge-stats",
    async (_event, rawPayload: unknown) =>
      dispatch("knowledge-stats", rawPayload as KnowledgeRequestPayload, gatewayClient),
  );
  return SUPPORTED_CHANNELS;
}

export const KNOWLEDGE_IPC_HANDLERS_SAFETY = {
  registered_in_app_startup: false,
  preload_switched_to_ipc: false,
  renderer_behavior_changed: false,
  config_write_allowed: false,
  audit_write_allowed: false,
  auto_gateway_start_allowed: false,
} as const;

export const _ADAPTER_MODE_REFERENCED = KNOWLEDGE_IPC_GATEWAY_ADAPTER_MODE;
