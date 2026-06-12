/**
 * §4.7 — Secrets boundary (secretAccessor)
 *
 * Pure function module. No I/O at import time. Wraps the existing
 * `redaction-scanner.ts` (P2.5) and adds a typed accessor surface:
 *
 *   - secretAccessor.get(name) returns the value at the call site
 *     only, never stashed in module state.
 *   - secretAccessor.redact(text) is a thin wrapper over
 *     scanForSensitiveContent; logs and crash dumps pass through here.
 *
 * The accessor refuses to return values for names not in the allowlist
 * (closed-by-default). The host wires the real `~/.hermes/vault/secrets/`
 * (or equivalent) at construction time; this module never reads the
 * vault directly.
 */

import { scanForSensitiveContent } from "../safety/redaction-scanner";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type SecretValue = string;

export interface SecretStore {
  /**
   * Read a secret by name. Returns undefined if the secret is not
   * present. The store is responsible for any underlying I/O.
   * This module does not implement I/O.
   */
  read(name: string): SecretValue | undefined;
}

export interface SecretAccessorConfig {
  /** Names the boundary is allowed to retrieve. Closed-by-default. */
  allowlist: ReadonlySet<string>;
  /** Backing store. Injected; in-memory by default in tests. */
  store?: SecretStore;
}

export interface SecretAccessor {
  /**
   * Retrieve a secret by name. Returns the value only if the name is on
   * the allowlist. Throws a typed error otherwise. The value is NOT
   * cached by the accessor.
   */
  get(name: string): SecretValue;
  /**
   * Try to retrieve a secret by name. Returns null if not on the
   * allowlist. Useful for optional secrets.
   */
  tryGet(name: string): SecretValue | null;
  /**
   * Redact a string of text. Returns the redacted form. The original
   * text is never retained by the accessor.
   */
  redact(text: string): string;
  /** Read-only view of the allowlist. */
  allowlist(): ReadonlySet<string>;
}

// -----------------------------------------------------------------
// Errors
// -----------------------------------------------------------------

export class SecretNotAllowedError extends Error {
  readonly name = "SecretNotAllowedError";
  constructor(public readonly secretName: string) {
    super(`secret '${secretName}' is not on the allowlist`);
  }
}

// -----------------------------------------------------------------
// In-memory store (for tests and dry-run)
// -----------------------------------------------------------------

export function createMemorySecretStore(
  initial: Record<string, SecretValue> = {},
): SecretStore {
  const map = new Map<string, SecretValue>(Object.entries(initial));
  return {
    read(name: string): SecretValue | undefined {
      return map.get(name);
    },
  };
}

// -----------------------------------------------------------------
// Public API
// -----------------------------------------------------------------

export function createSecretAccessor(config: SecretAccessorConfig): SecretAccessor {
  const store = config.store ?? createMemorySecretStore();

  const getOrThrow = (name: string): SecretValue => {
    if (!config.allowlist.has(name)) {
      throw new SecretNotAllowedError(name);
    }
    const v = store.read(name);
    if (v === undefined) {
      throw new SecretNotAllowedError(name);
    }
    return v;
  };

  return {
    get(name: string): SecretValue {
      return getOrThrow(name);
    },
    tryGet(name: string): SecretValue | null {
      if (!config.allowlist.has(name)) return null;
      const v = store.read(name);
      return v === undefined ? null : v;
    },
    redact(text: string): string {
      return scanForSensitiveContent({ content: text, mode: "generic" })
        .redactedContent;
    },
    allowlist(): ReadonlySet<string> {
      return config.allowlist;
    },
  };
}
