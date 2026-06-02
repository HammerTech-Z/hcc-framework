// P2.5 Redaction Scanner — shared pure function module
// No IPC, no file I/O, no Node.js built-in modules.
// Scans content for sensitive data and returns redacted version + findings.

// -----------------------------------------------------------------
// Input / Output Types
// -----------------------------------------------------------------

export type ScanMode = "handoff_pack" | "cloud_payload" | "generic";

export type FindingKind =
  | "api_key"
  | "token"
  | "private_key"
  | "high_entropy"
  | "pii"
  | "sensitive_path"
  | "long_chat_log";

export type Severity = "low" | "medium" | "high";

export interface RedactionFinding {
  kind: FindingKind;
  severity: Severity;
  start: number;   // byte offset in original string
  end: number;     // byte offset in original string
  evidencePreview: string;   // always redacted, never exposes full secret
  recommendation: string;
}

export interface ScanResult {
  status: "pass" | "fail";
  findings: RedactionFinding[];
  redactedContent: string;
  summary: string;
}

export interface ScanInput {
  content: string;
  sourceRef?: string;
  mode?: ScanMode;
}

// -----------------------------------------------------------------
// Detection Rules
// -----------------------------------------------------------------

/** Returns null if no match at this position. */
type PatternMatch = { start: number; end: number; severity: Severity; kind: FindingKind; preview: string };

function matchAPIKey(s: string, i: number): PatternMatch | null {
  // Generic API key pattern: must have known prefix + 20+ total chars
  // Prefixes: sk_, ak_, pk_, ghp_, ghs_, gog_, eyJ (JWT), Bearer
  const rest = s.slice(i);
  const prefixM = rest.match(/^(sk_|ak_|pk_|ghp_|ghs_|gog_|eyJ[Aa-z0-9]+-[A-Za-z0-9_.\-]+)/);
  if (!prefixM) return null;
  // After prefix, expect remaining alphanumeric/special >= 6 chars
  const afterPrefix = rest.slice(prefixM[0].length);
  const keyM = afterPrefix.match(/^[A-Za-z0-9_\/\+=]{6,}/);
  if (!keyM) return null;
  const fullKey = prefixM[0] + keyM[0];
  // Reject long pure-base64 strings (>30 chars) — they belong to high_entropy
  if (fullKey.length > 30 && /^[A-Za-z0-9\/\+=]{25,}$/.test(fullKey)) return null;
  const end = i + fullKey.length;
  return { start: i, end, severity: "high", kind: "api_key", preview: truncate(fullKey) };
}

function matchBearerToken(s: string, i: number): PatternMatch | null {
  const m = s.slice(i).match(/^(Bearer\s+[A-Za-z0-9_\-\.]+)/i);
  if (!m) return null;
  const token = m[1];
  if (token.length < 20) return null;
  return { start: i, end: i + token.length, severity: "high", kind: "token", preview: truncateBearer(token) };
}

function matchPrivateKey(s: string, i: number): PatternMatch | null {
  const rest = s.slice(i);
  const m = rest.match(/^-----BEGIN (RSA |DSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/);
  if (!m) return null;
  // Find matching END line
  const afterBegin = rest.slice(m[0].length);
  const endMatch = afterBegin.search(/-----END (RSA |DSA |EC |OPENSSH |PRIVATE )?PRIVATE KEY-----/);
  if (endMatch === -1) return null;
  const end = i + m[0].length + endMatch + 29; // approximate
  return { start: i, end: Math.min(end, s.length), severity: "high", kind: "private_key", preview: "[BEGIN PRIVATE KEY]" };
}

function matchHighEntropy(s: string, i: number): PatternMatch | null {
  // Base64-encoded or hex long strings >= 40 chars with sufficient variance
  const rest = s.slice(i);
  // Alphanumeric + /+= sequences >= 40 chars
  const m = rest.match(/^[A-Za-z0-9\/\+=]{40,}/);
  if (!m) return null;
  // Check entropy: must have mix of characters (ratio >= 0.2)
  const str = m[0];
  const uniqueRatio = new Set(str.split("")).size / str.length;
  if (uniqueRatio < 0.2) return null;
  return { start: i, end: i + str.length, severity: "medium", kind: "high_entropy", preview: truncate(str) };
}

function matchSensitivePath(s: string, i: number): PatternMatch | null {
  const rest = s.slice(i);
  // Require /Users/ at a word boundary (not preceded by alphanumeric)
  // This prevents /u /Id etc. inside phone/ID numbers from being matched
  if (i > 0 && /[a-zA-Z0-9]/.test(s[i - 1])) return null;
  const m = rest.match(/^\/Users\/[^\s]{3,}/);  // /Users/xxx with at least 3 non-space chars after
  if (!m) return null;
  return { start: i, end: i + m[0].length, severity: "medium", kind: "sensitive_path", preview: "[SENSITIVE_PATH]" };
}

function matchPII(s: string, i: number): PatternMatch | null {
  const rest = s.slice(i);
  // Chinese mobile: 1[3-9]xxxxxxxxx
  const mobileM = rest.match(/^1[3-9]\d{9}/);
  if (mobileM) {
    return { start: i, end: i + 11, severity: "high", kind: "pii", preview: "[PHONE]" };
  }
  // Email
  const emailM = rest.match(/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
  if (emailM) {
    return { start: i, end: i + emailM[0].length, severity: "medium", kind: "pii", preview: "[EMAIL]" };
  }
  // Chinese ID (18 digit)
  const idM = rest.match(/^[1-9]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]/);
  if (idM) {
    return { start: i, end: i + 18, severity: "high", kind: "pii", preview: "[ID]" };
  }
  return null;
}

function matchLongChatLog(s: string, i: number): PatternMatch | null {
  // Detect multi-turn chat patterns: repeating name: message structure, 3+ turns
  // Simple heuristic: lines starting with - USER: or - ASSISTANT: or similar, 3+ occurrences within 30 lines
  const lines = s.split("\n");
  // Find position i in the string, determine which line it is
  let charCount = 0;
  let lineIdx = 0;
  for (let li = 0; li < lines.length; li++) {
    charCount += lines[li].length + 1; // +1 for newline
    if (charCount > i) { lineIdx = li; break; }
    lineIdx = li;
  }
  // Count chat-like lines starting from lineIdx
  let turnCount = 0;
  const chatPattern = /^[-*]\s*(USER|ASSISTANT|AI|BOT|HUMAN|HUM):\s/mi;
  for (let li = lineIdx; li < Math.min(lineIdx + 30, lines.length); li++) {
    if (chatPattern.test(lines[li])) turnCount++;
  }
  if (turnCount >= 3) {
    // Return spanning all matched chat lines (approximate)
    const end = Math.min(i + 2000, s.length);
    return { start: i, end, severity: "low", kind: "long_chat_log", preview: "[CHAT_LOG]" };
  }
  return null;
}

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function truncate(s: string): string {
  if (s.length <= 12) return "[REDACTED]";
  return s.slice(0, 6) + "..." + s.slice(-4);
}

function truncateBearer(token: string): string {
  // Extract the actual token part after "Bearer "
  const actual = token.replace(/^Bearer\s+/i, "");
  return "Bearer " + truncate(actual);
}

// Scan all positions in the string using non-overlapping match dispatch
function scanAll(content: string): RedactionFinding[] {
  const findings: RedactionFinding[] = [];
  let i = 0;
  const n = content.length;

  while (i < n) {
    let matched = false;

    // Try each pattern
    const dispatch: Array<{ fn: (s: string, idx: number) => PatternMatch | null }> = [
      { fn: matchPrivateKey },
      { fn: matchBearerToken },
      { fn: matchAPIKey },
      { fn: matchHighEntropy },
      { fn: matchSensitivePath },
      { fn: matchPII },
      { fn: matchLongChatLog },
    ];

    for (const { fn } of dispatch) {
      const m = fn(content, i);
      if (m) {
        findings.push({
          kind: m.kind,
          severity: m.severity,
          start: m.start,
          end: m.end,
          evidencePreview: m.preview,
          recommendation: getRecommendation(m.kind),
        });
        i = m.end;
        matched = true;
        break;
      }
    }

    if (!matched) i++;
  }

  return findings;
}

function getRecommendation(kind: FindingKind): string {
  switch (kind) {
    case "api_key":        return "Rotate the API key and store it in environment variables instead of source code.";
    case "token":          return "Revoke the exposed token and use a secrets manager.";
    case "private_key":    return "Remove the private key immediately and ensure it is not committed to version control.";
    case "high_entropy":   return "Verify whether this string is a secret; if so, redact it before logging or transmitting.";
    case "pii":            return "Apply data minimization; do not log or persist PII without lawful basis.";
    case "sensitive_path": return "Obfuscate or generalize local file paths in logs and diagnostics.";
    case "long_chat_log":  return "Truncate conversation history to the last 2 turns; do not persist full chat logs.";
  }
}

// -----------------------------------------------------------------
// Main Scan Function
// -----------------------------------------------------------------

export function scanForSensitiveContent(input: ScanInput): ScanResult {
  const { content, sourceRef: _sourceRef, mode = "generic" } = input;

  const allFindings = scanAll(content);

  // Sort by start position
  allFindings.sort((a, b) => a.start - b.start);

  // Build redacted content
  let redacted = "";
  let lastEnd = 0;
  for (const f of allFindings) {
    redacted += content.slice(lastEnd, f.start);
    redacted += `[REDACTED:${f.kind}]`;
    lastEnd = f.end;
  }
  redacted += content.slice(lastEnd);

  // Determine status based on mode
  let status: "pass" | "fail" = "pass";
  if (mode === "handoff_pack" || mode === "cloud_payload") {
    if (allFindings.some((f) => f.severity === "high")) {
      status = "fail";
    }
  }

  const summary = buildSummary(allFindings, mode);

  return { status, findings: allFindings, redactedContent: redacted, summary };
}

function buildSummary(findings: RedactionFinding[], mode: ScanMode): string {
  if (findings.length === 0) {
    return "No sensitive content detected.";
  }
  const bySev = { high: 0, medium: 0, low: 0 };
  for (const f of findings) bySev[f.severity]++;
  const parts: string[] = [];
  if (bySev.high) parts.push(`${bySev.high} high`);
  if (bySev.medium) parts.push(`${bySev.medium} medium`);
  if (bySev.low) parts.push(`${bySev.low} low`);
  const detail = parts.join(", ");
  const block = (mode === "handoff_pack" || mode === "cloud_payload") && bySev.high > 0
    ? " Content is blocked."
    : "";
  return `Found ${findings.length} sensitive item(s) [${detail}].${block}`;
}