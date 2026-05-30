export type ErrorType =
  | "rate_limited"
  | "server_error"
  | "client_error"
  | "timeout"
  | "connection_refused"
  | "tls_error"
  | "auth_expired"
  | "permission_denied"
  | "delivery_failed"
  | "unknown";

export interface ErrorClassification {
  type: ErrorType;
  retryable: boolean;
}

export function classifyError(lastError: string | null): ErrorClassification {
  if (!lastError) return { type: "unknown", retryable: false };

  const err = lastError.toLowerCase();

  if (
    err.includes("rate limit") ||
    err.includes("rate_limited") ||
    err.includes("too many requests") ||
    /\b429\b/.test(err)
  ) {
    return { type: "rate_limited", retryable: true };
  }

  if (
    err.includes("token expired") ||
    err.includes("expired token") ||
    err.includes("auth expired") ||
    err.includes("authentication expired") ||
    /\b401\b/.test(err)
  ) {
    return { type: "auth_expired", retryable: false };
  }

  if (
    err.includes("permission") ||
    err.includes("forbidden") ||
    err.includes("access denied") ||
    /\b403\b/.test(err)
  ) {
    return { type: "permission_denied", retryable: false };
  }

  if (
    err.includes("tls") ||
    err.includes("ssl") ||
    err.includes("certificate") ||
    err.includes("cert ")
  ) {
    return { type: "tls_error", retryable: false };
  }

  if (
    err.includes("delivery failed") ||
    err.includes("message delivery") ||
    err.includes("wechat") ||
    err.includes("bluebubbles")
  ) {
    return { type: "delivery_failed", retryable: false };
  }

  if (
    err.includes("timeout") ||
    err.includes("timed out") ||
    err.includes("etimedout")
  ) {
    return { type: "timeout", retryable: true };
  }

  if (
    err.includes("connection refused") ||
    err.includes("econnrefused") ||
    err.includes("connection reset") ||
    err.includes("econnreset")
  ) {
    return { type: "connection_refused", retryable: false };
  }

  if (/\b5\d\d\b/.test(err) || err.includes("server error")) {
    return { type: "server_error", retryable: true };
  }

  if (
    /\b400\b/.test(err) ||
    /\b404\b/.test(err) ||
    /\b422\b/.test(err) ||
    err.includes("bad request") ||
    err.includes("not found") ||
    err.includes("unprocessable")
  ) {
    return { type: "client_error", retryable: false };
  }

  return { type: "unknown", retryable: false };
}

export function errorTypeLabel(t: ErrorType): string {
  switch (t) {
    case "rate_limited":
      return "Rate Limited";
    case "server_error":
      return "Server Error";
    case "client_error":
      return "Client Error";
    case "timeout":
      return "Timeout";
    case "connection_refused":
      return "Connection Refused";
    case "tls_error":
      return "TLS Error";
    case "auth_expired":
      return "Auth Expired";
    case "permission_denied":
      return "Permission Denied";
    case "delivery_failed":
      return "Delivery Failed";
    default:
      return "Unknown";
  }
}
