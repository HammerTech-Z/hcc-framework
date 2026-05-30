import { describe, expect, it } from "vitest";
import { classifyError } from "../src/renderer/src/screens/BaiLongma/error-classification";

describe("BaiLongma error classification", () => {
  it.each([
    ["OpenAI rate limit 429", "rate_limited", true],
    ["upstream returned 503 server error", "server_error", true],
    ["HTTP 422 unprocessable entity", "client_error", false],
    ["request timed out after 30s", "timeout", true],
    ["ECONNREFUSED 127.0.0.1:8642", "connection_refused", false],
    ["Python TLS certificate verify failed", "tls_error", false],
    ["401 token expired", "auth_expired", false],
    ["403 permission denied", "permission_denied", false],
    ["WeChat message delivery failed", "delivery_failed", false],
    ["unexpected worker panic", "unknown", false],
    [null, "unknown", false],
  ] as const)(
    "classifies %s",
    (message, expectedType, expectedRetryable) => {
      expect(classifyError(message)).toEqual({
        type: expectedType,
        retryable: expectedRetryable,
      });
    },
  );
});
