// Knowledge IPC Migration Slice 1: IPC shape contract.
// Pure data projection. No runtime wiring, no preload / main / renderer
// changes. Defines channel names, request / response payloads, validation
// rules, error codes, and a no-secret-echo rule for the future main
// handler + preload bridge. Migration status remains planned_not_applied.

import {
  getKnowledgeIpcMigrationContract,
  KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION,
  type KnowledgeIpcMigrationMethod,
} from "./knowledge-ipc-migration-contract";

export const KNOWLEDGE_IPC_SHAPE_CONTRACT_SCHEMA_VERSION = "1.0.0" as const;
export const KNOWLEDGE_IPC_SHAPE_CONTRACT_MODE =
  "ipc_shape_contract_only" as const;

export type KnowledgeIpcChannel =
  | "knowledge-search"
  | "knowledge-ingest"
  | "knowledge-stats";

export type KnowledgeIpcErrorCode =
  | "invalid_payload"
  | "gateway_unavailable"
  | "gateway_timeout"
  | "gateway_error"
  | "response_shape_mismatch";

export type KnowledgeSearchResult = {
  file: string;
  score: number;
  preview: string;
};

export interface KnowledgeSearchRequest {
  query: string;
  limit?: number;
}

export interface KnowledgeSearchResponse {
  status: string;
  results: readonly KnowledgeSearchResult[];
}

export interface KnowledgeIngestRequest {
  title: string;
  content: string;
}

export interface KnowledgeIngestResponse {
  status: string;
  path?: string;
  message?: string;
}

export interface KnowledgeStatsResponse {
  // Mirrors the current preload getGbrainStats return shape. Fields are
  // intentionally typed as `unknown` to avoid claiming tighter semantics
  // than the existing runtime provides; the contract only requires the
  // response to be JSON-serialisable.
  [key: string]: unknown;
}

export interface KnowledgeStatsRequest {
  // Empty payload by design. Listed explicitly so the contract documents
  // the absence of input.
  readonly __empty: never;
}

export type KnowledgeRequestPayload =
  | KnowledgeSearchRequest
  | KnowledgeIngestRequest
  | KnowledgeStatsRequest;

export type KnowledgeResponsePayload =
  | KnowledgeSearchResponse
  | KnowledgeIngestResponse
  | KnowledgeStatsResponse;

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: KnowledgeIpcErrorCode; reason: string };

export interface KnowledgeChannelShape {
  channel: KnowledgeIpcChannel;
  method: KnowledgeIpcMigrationMethod["name"];
  request_example: KnowledgeRequestPayload;
  response_example: KnowledgeResponsePayload;
  timeout_ms: number;
  retry_policy: "no_retry_display_only";
}

export interface KnowledgeIpcShapeContract {
  schema_version: typeof KNOWLEDGE_IPC_SHAPE_CONTRACT_SCHEMA_VERSION;
  mode: typeof KNOWLEDGE_IPC_SHAPE_CONTRACT_MODE;
  source_contract: "knowledge_ipc_migration_contract_slice_0";
  // Reference back to Slice 0 — keep this string-only so we don't pull the
  // whole contract object into a doc-like shape.
  source_schema_version: typeof KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION;
  channels: readonly KnowledgeChannelShape[];
  error_codes: readonly KnowledgeIpcErrorCode[];
  // Limits enforced by future request validators. Display-only for now.
  limits: {
    max_title_length: number;
    max_content_length: number;
    min_search_limit: number;
    max_search_limit: number;
  };
  // Display-only retry/timeout policy. Not enforced anywhere in this
  // slice; future main handler must respect it.
  policy: {
    timeout_ms_default: number;
    retry_policy: "no_retry_display_only";
    secret_echo_allowed: false;
  };
  safety: {
    runtime_wiring_added: false;
    preload_fetch_removed: false;
    main_handler_added: false;
    ipc_invocation_enabled: false;
    renderer_behavior_changed: false;
    secret_echo_allowed: false;
    config_write_allowed: false;
    audit_write_allowed: false;
  };
}

const SEARCH_RESPONSE_EXAMPLE: KnowledgeSearchResponse = {
  status: "ok",
  results: [
    { file: "notes/example.md", score: 0.91, preview: "snippet …" },
  ],
};

const INGEST_RESPONSE_EXAMPLE: KnowledgeIngestResponse = {
  status: "ok",
  path: "vault/notes/example.md",
  message: "ingested",
};

const STATS_RESPONSE_EXAMPLE: KnowledgeStatsResponse = {
  status: "ok",
  total_files: 0,
  total_chunks: 0,
  gbrain_loaded: false,
};

const CHANNELS: readonly KnowledgeChannelShape[] = [
  {
    channel: "knowledge-search",
    method: "knowledgeSearch",
    request_example: { query: "example", limit: 10 },
    response_example: SEARCH_RESPONSE_EXAMPLE,
    timeout_ms: 5_000,
    retry_policy: "no_retry_display_only",
  },
  {
    channel: "knowledge-ingest",
    method: "knowledgeIngest",
    request_example: { title: "example", content: "body" },
    response_example: INGEST_RESPONSE_EXAMPLE,
    timeout_ms: 10_000,
    retry_policy: "no_retry_display_only",
  },
  {
    channel: "knowledge-stats",
    method: "getGbrainStats",
    request_example: { __empty: undefined as never },
    response_example: STATS_RESPONSE_EXAMPLE,
    timeout_ms: 2_000,
    retry_policy: "no_retry_display_only",
  },
];

const ERROR_CODES: readonly KnowledgeIpcErrorCode[] = [
  "invalid_payload",
  "gateway_unavailable",
  "gateway_timeout",
  "gateway_error",
  "response_shape_mismatch",
];

const LIMITS = {
  max_title_length: 256,
  max_content_length: 1_048_576,
  min_search_limit: 1,
  max_search_limit: 50,
};

const POLICY = {
  timeout_ms_default: 5_000,
  retry_policy: "no_retry_display_only" as const,
  secret_echo_allowed: false as const,
};

// --- pure validators (no IO) ---

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  );
}

export function validateKnowledgeSearchRequest(
  payload: unknown,
): ValidationResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "payload must be an object",
    };
  }
  const record = payload as Record<string, unknown>;
  if (!isNonEmptyString(record.query)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "query must be a non-empty string",
    };
  }
  if (
    record.limit !== undefined &&
    !isIntegerInRange(record.limit, LIMITS.min_search_limit, LIMITS.max_search_limit)
  ) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: `limit must be an integer in [${LIMITS.min_search_limit}, ${LIMITS.max_search_limit}]`,
    };
  }
  return { ok: true };
}

export function validateKnowledgeIngestRequest(
  payload: unknown,
): ValidationResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "payload must be an object",
    };
  }
  const record = payload as Record<string, unknown>;
  if (!isNonEmptyString(record.title)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "title must be a non-empty string",
    };
  }
  if (record.title.length > LIMITS.max_title_length) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: `title must be <= ${LIMITS.max_title_length} characters`,
    };
  }
  if (!isNonEmptyString(record.content)) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "content must be a non-empty string",
    };
  }
  if (record.content.length > LIMITS.max_content_length) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: `content must be <= ${LIMITS.max_content_length} characters`,
    };
  }
  return { ok: true };
}

export function validateKnowledgeStatsRequest(
  payload: unknown,
): ValidationResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "payload must be an empty object",
    };
  }
  const keys = Object.keys(payload);
  if (keys.length !== 0) {
    return {
      ok: false,
      code: "invalid_payload",
      reason: "knowledge-stats request must be an empty object",
    };
  }
  return { ok: true };
}

export function validateKnowledgeResponse(
  method: KnowledgeIpcMigrationMethod["name"],
  payload: unknown,
): ValidationResult {
  if (typeof payload !== "object" || payload === null) {
    return {
      ok: false,
      code: "response_shape_mismatch",
      reason: "response must be an object",
    };
  }
  const record = payload as Record<string, unknown>;
  if (method === "knowledgeSearch") {
    if (typeof record.status !== "string") {
      return {
        ok: false,
        code: "response_shape_mismatch",
        reason: "knowledgeSearch response.status must be a string",
      };
    }
    if (!Array.isArray(record.results)) {
      return {
        ok: false,
        code: "response_shape_mismatch",
        reason: "knowledgeSearch response.results must be an array",
      };
    }
    return { ok: true };
  }
  if (method === "knowledgeIngest") {
    if (typeof record.status !== "string") {
      return {
        ok: false,
        code: "response_shape_mismatch",
        reason: "knowledgeIngest response.status must be a string",
      };
    }
    return { ok: true };
  }
  // getGbrainStats: any JSON-serialisable object is acceptable.
  return { ok: true };
}

export const KNOWLEDGE_IPC_SHAPE_CONTRACT: KnowledgeIpcShapeContract = {
  schema_version: KNOWLEDGE_IPC_SHAPE_CONTRACT_SCHEMA_VERSION,
  mode: KNOWLEDGE_IPC_SHAPE_CONTRACT_MODE,
  source_contract: "knowledge_ipc_migration_contract_slice_0",
  source_schema_version: KNOWLEDGE_IPC_MIGRATION_CONTRACT_SCHEMA_VERSION,
  channels: CHANNELS,
  error_codes: ERROR_CODES,
  limits: LIMITS,
  policy: POLICY,
  safety: {
    runtime_wiring_added: false,
    preload_fetch_removed: false,
    main_handler_added: false,
    ipc_invocation_enabled: false,
    renderer_behavior_changed: false,
    secret_echo_allowed: false,
    config_write_allowed: false,
    audit_write_allowed: false,
  },
};

export function getKnowledgeIpcShapeContract(): KnowledgeIpcShapeContract {
  return KNOWLEDGE_IPC_SHAPE_CONTRACT;
}

export function getChannelForMethod(
  method: KnowledgeIpcMigrationMethod["name"],
): KnowledgeIpcChannel | undefined {
  return getKnowledgeIpcShapeContract().channels.find(
    (channel) => channel.method === method,
  )?.channel;
}

export function isMigrationContractStillPlanned(): boolean {
  // Slice 1 must keep Slice 0's planned_not_applied state for every method.
  const contract = getKnowledgeIpcMigrationContract();
  return contract.affected_methods.every(
    (method) => method.migration_status === "planned_not_applied",
  );
}
