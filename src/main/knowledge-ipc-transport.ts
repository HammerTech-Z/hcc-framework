// Knowledge IPC Migration Slice 7: main gateway transport.
// Pure HTTP transport that turns a Slice 4 transport request into a
// gateway HTTP call. No IPC handler registration, no electron import,
// no config / audit / file write. The default transport uses
// globalThis.fetch and the project's existing getApiUrl() helper;
// tests inject a fake fetchLike so no real network is touched.

import { getApiUrl } from "./hermes";
import type { KnowledgeGatewayTransportRequest } from "./knowledge-ipc-gateway-client";

export const KNOWLEDGE_IPC_TRANSPORT_MODE =
  "main_gateway_transport_only" as const;

export const KNOWLEDGE_IPC_GATEWAY_PORT_FALLBACK = 8643 as const;

// Local-host default base URL used when the project's getApiUrl() is
// unavailable (e.g. unit tests in a non-electron context). The Hermes
// chat gateway listens on 8642; the knowledge gateway listens on 8643.
// We keep 8642 as the chat default (driven by getApiUrl) and 8643 as
// the local-knowledge default when getApiUrl is bypassed. Production
// startup always uses getApiUrl().
const LOCAL_KNOWLEDGE_FALLBACK_BASE = "http://127.0.0.1:8643";

export type KnowledgeFetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string | null;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface KnowledgeGatewayTransportOptions {
  // Tests inject a fake fetch implementation. Production leaves this
  // undefined and the transport uses globalThis.fetch.
  fetchLike?: KnowledgeFetchLike;
  // Base URL for the gateway. Production callers leave this undefined
  // and the transport uses getApiUrl() at call time. Tests inject a
  // fixed base.
  baseUrl?: string;
  // When true, bypass getApiUrl() and use a hard-coded localhost base
  // URL. Intended for non-electron test environments. Default false.
  useLocalFallback?: boolean;
}

export interface KnowledgeGatewayTransportError extends Error {
  code: "gateway_unavailable" | "gateway_timeout" | "gateway_error";
  cause?: unknown;
}

// Build the absolute URL for a Slice 4 transport request against the
// given base. Pure function; exported for tests.
export function buildKnowledgeGatewayUrl(
  base: string,
  request: KnowledgeGatewayTransportRequest,
): string {
  const trimmed = base.replace(/\/+$/, "");
  const queryString = Object.entries(request.query)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
  const path = request.path.startsWith("/") ? request.path : `/${request.path}`;
  return queryString.length > 0
    ? `${trimmed}${path}?${queryString}`
    : `${trimmed}${path}`;
}

// Map an AbortError / network failure to a Slice 1 error code.
function classifyFetchError(err: unknown): {
  code: "gateway_unavailable" | "gateway_timeout" | "gateway_error";
  reason: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  if (name === "AbortError" || /timeout|timed out/i.test(message)) {
    return { code: "gateway_timeout", reason: message || "request timed out" };
  }
  if (
    /unavailable|econnrefused|fetch failed|network|socket hang up|ENOTFOUND|ECONNREFUSED/i.test(
      message,
    )
  ) {
    return {
      code: "gateway_unavailable",
      reason: message || "gateway unreachable",
    };
  }
  return { code: "gateway_error", reason: message || "gateway error" };
}

function defaultFetchLike(): KnowledgeFetchLike {
  const f = (globalThis as { fetch?: unknown }).fetch;
  if (typeof f !== "function") {
    throw new Error(
      "globalThis.fetch is not available; inject fetchLike explicitly",
    );
  }
  return f as unknown as KnowledgeFetchLike;
}

export function createKnowledgeGatewayTransport(
  options: KnowledgeGatewayTransportOptions = {},
): (
  request: KnowledgeGatewayTransportRequest,
) => Promise<unknown> {
  const fetchLike = options.fetchLike ?? defaultFetchLike();

  return async (request) => {
    const base =
      options.baseUrl ??
      (options.useLocalFallback
        ? LOCAL_KNOWLEDGE_FALLBACK_BASE
        : safeGetApiUrl());
    const url = buildKnowledgeGatewayUrl(base, request);
    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const init: {
      method: string;
      headers: Record<string, string>;
      body?: string | null;
      signal?: AbortSignal;
    } = {
      method: request.method,
      headers,
    };
    if (request.method === "POST" && request.body !== null && request.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(request.body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeout_ms);
    init.signal = controller.signal;
    let res: Awaited<ReturnType<KnowledgeFetchLike>>;
    try {
      res = await fetchLike(url, init);
    } catch (err) {
      clearTimeout(timer);
      const classified = classifyFetchError(err);
      const wrapped = new Error(classified.reason) as KnowledgeGatewayTransportError;
      wrapped.code = classified.code;
      wrapped.cause = err;
      throw wrapped;
    }
    clearTimeout(timer);
    if (!res.ok) {
      let body = "";
      try {
        body = await res.text();
      } catch {
        // ignore body-read failure
      }
      const wrapped = new Error(
        `gateway returned status ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`,
      ) as KnowledgeGatewayTransportError;
      wrapped.code = "gateway_error";
      throw wrapped;
    }
    try {
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const wrapped = new Error(
        `gateway response was not valid JSON: ${message}`,
      ) as KnowledgeGatewayTransportError;
      wrapped.code = "gateway_error";
      throw wrapped;
    }
  };
}

function safeGetApiUrl(): string {
  try {
    return getApiUrl();
  } catch {
    return LOCAL_KNOWLEDGE_FALLBACK_BASE;
  }
}

export const KNOWLEDGE_IPC_TRANSPORT_SAFETY = {
  transport_implemented: true,
  preload_switched_to_ipc: false,
  renderer_behavior_changed: false,
  auto_gateway_start_allowed: false,
  config_write_allowed: false,
  audit_write_allowed: false,
  default_network_enabled: false,
  // Production uses getApiUrl() + globalThis.fetch. Real network is
  // only touched when an IPC handler is actually invoked, not at
  // startup.
  real_network_on_handler_invoke_only: true,
} as const;
