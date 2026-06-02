// P2.5 Redaction Scanner tests
import { describe, it, expect } from "vitest";
import { scanForSensitiveContent } from "@shared/lib/safety/redaction-scanner";
import type { RedactionFinding } from "@shared/lib/safety/redaction-scanner";

describe("Redaction Scanner", () => {

  // ── api_key ─────────────────────────────────────────────────────────────────

  it("detects fake API key and redacts", () => {
    const result = scanForSensitiveContent({ content: "sk_test_1234567890abcdefghijklmnop" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "api_key")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:api_key]");
  });

  it("api_key evidencePreview does not expose full key", () => {
    const result = scanForSensitiveContent({ content: "sk_test_1234567890abcdefghijklmnop" });
    const finding = result.findings.find((f: RedactionFinding) => f.kind === "api_key")!;
    expect(finding.severity).toBe("high");
    expect(finding.evidencePreview).not.toContain("sk_test_1234567890abcdefghijklmnop");
    expect(finding.evidencePreview).not.toContain("1234567890abcdef");
  });

  // ── token ───────────────────────────────────────────────────────────────────

  it("detects Bearer token and redacts", () => {
    const result = scanForSensitiveContent({ content: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9MTIzNDU2Nzg5MA" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "token")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:token]");
  });

  it("token evidencePreview shows truncated form", () => {
    const result = scanForSensitiveContent({ content: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9MTIzNDU2Nzg5MA" });
    const finding = result.findings.find((f: RedactionFinding) => f.kind === "token")!;
    expect(finding.evidencePreview).toContain("Bearer ");
    expect(finding.evidencePreview).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  });

  // ── private_key ──────────────────────────────────────────────────────────────

  it("detects private key header and redacts", () => {
    const content = "-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBQJBAMHCgg测试\n-----END RSA PRIVATE KEY-----";
    const result = scanForSensitiveContent({ content });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "private_key")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:private_key]");
    expect(result.redactedContent).not.toContain("BEGIN RSA PRIVATE KEY");
  });

  it("private_key severity is high", () => {
    const content = "-----BEGIN EC PRIVATE KEY-----\ndata\n-----END EC PRIVATE KEY-----";
    const result = scanForSensitiveContent({ content });
    const finding = result.findings.find((f: RedactionFinding) => f.kind === "private_key")!;
    expect(finding.severity).toBe("high");
  });

  // ── high_entropy ─────────────────────────────────────────────────────────────

  it("detects long base64 strings with high entropy", () => {
    const result = scanForSensitiveContent({ content: "YXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGZhc2Rm" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "high_entropy")).toBe(true);
  });

  it("high_entropy evidencePreview does not reveal full string", () => {
    const result = scanForSensitiveContent({ content: "YXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGZhc2RmYXNkZmFzZGZhc2Rm" });
    const finding = result.findings.find((f: RedactionFinding) => f.kind === "high_entropy")!;
    expect(finding.evidencePreview).not.toContain("YXNkZmFzZGZ");
    expect(finding.evidencePreview).toContain("...");
  });

  // ── sensitive_path ────────────────────────────────────────────────────────────

  it("detects /Users/midoudou path and redacts", () => {
    const result = scanForSensitiveContent({ content: "file path: /Users/midoudou/.hermes/handoff.json" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "sensitive_path")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:sensitive_path]");
  });

  it("sensitive_path severity is medium", () => {
    const result = scanForSensitiveContent({ content: "/Users/midoudou/.ssh/id_rsa" });
    const finding = result.findings.find((f: RedactionFinding) => f.kind === "sensitive_path")!;
    expect(finding.severity).toBe("medium");
  });

  // ── pii ──────────────────────────────────────────────────────────────────────

  it("detects Chinese mobile number", () => {
    const result = scanForSensitiveContent({ content: "contact: 13812345678" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "pii" && f.severity === "high")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:pii]");
  });

  it("detects email address", () => {
    const result = scanForSensitiveContent({ content: "user@example.com" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "pii" && f.severity === "medium")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:pii]");
  });

  it("detects Chinese ID number", () => {
    const result = scanForSensitiveContent({ content: "id: 11010119900301563X" });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "pii" && f.severity === "high")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:pii]");
  });

  // ── long_chat_log ────────────────────────────────────────────────────────────

  it("detects long chat log with 3+ turns", () => {
    const content = [
      "- USER: Hello",
      "- ASSISTANT: Hi there",
      "- USER: How are you?",
      "- ASSISTANT: I'm good",
    ].join("\n");
    const result = scanForSensitiveContent({ content });
    expect(result.findings.some((f: RedactionFinding) => f.kind === "long_chat_log")).toBe(true);
    expect(result.redactedContent).toContain("[REDACTED:long_chat_log]");
  });

  it("long_chat_log severity is low", () => {
    const content = "- USER: hi\n- ASSISTANT: hi\n- USER: hi\n- ASSISTANT: hi";
    const result = scanForSensitiveContent({ content });
    const finding = result.findings.find((f: RedactionFinding) => f.kind === "long_chat_log")!;
    expect(finding.severity).toBe("low");
  });

  // ── clean content ────────────────────────────────────────────────────────────

  it("clean content returns status pass", () => {
    const result = scanForSensitiveContent({ content: "Hello world, this is a normal document." });
    expect(result.status).toBe("pass");
    expect(result.findings).toHaveLength(0);
    expect(result.redactedContent).toBe("Hello world, this is a normal document.");
    expect(result.summary).toBe("No sensitive content detected.");
  });

  // ── handoff_pack / cloud_payload mode ────────────────────────────────────────

  it("handoff_pack with high severity finding returns fail", () => {
    const result = scanForSensitiveContent({
      content: "sk_test_abcdef1234567890abcdef",
      mode: "handoff_pack",
    });
    expect(result.status).toBe("fail");
  });

  it("cloud_payload with high severity finding returns fail", () => {
    const result = scanForSensitiveContent({
      content: "-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----",
      mode: "cloud_payload",
    });
    expect(result.status).toBe("fail");
  });

  it("cloud_payload with only medium/low findings returns pass", () => {
    const result = scanForSensitiveContent({
      content: "/Users/midoudou/.ssh/id_rsa\nuser@example.com",
      mode: "cloud_payload",
    });
    expect(result.status).toBe("pass");
  });

  // ── generic mode ─────────────────────────────────────────────────────────────

  it("generic mode with high severity findings returns pass (not fail)", () => {
    const result = scanForSensitiveContent({
      content: "Bearer eyJhbGciOiJIUzI1NiJ9MTIzNDU2Nzg5MA",
      mode: "generic",
    });
    expect(result.status).toBe("pass");
    expect(result.findings.some((f: RedactionFinding) => f.severity === "high")).toBe(true);
  });

  // ── redactedContent correctness ───────────────────────────────────────────────

  it("redactedContent replaces only the sensitive portion", () => {
    const result = scanForSensitiveContent({
      content: "prefix sk_test_abcdef1234567890abcdef suffix",
    });
    expect(result.redactedContent).toContain("prefix ");
    expect(result.redactedContent).toContain(" suffix");
    expect(result.redactedContent).not.toContain("sk_test_abcdef");
  });

  it("redactedContent multiple findings all replaced", () => {
    const result = scanForSensitiveContent({
      content: "api: sk_test_1234567890abcdef1234567890\nBearer eyJhbGciOiJIUzI1NiJ9.fakepayload.fakeSignature\npath: /Users/midoudou/file",
    });
    expect(result.redactedContent).toContain("[REDACTED:api_key]");
    expect(result.redactedContent).toContain("[REDACTED:token]");
    expect(result.redactedContent).toContain("[REDACTED:sensitive_path]");
  });

  // ── recommendation always present ────────────────────────────────────────────

  it("every finding has a recommendation", () => {
    const result = scanForSensitiveContent({
      content: "Bearer eyJhbGciOiJIUzI1NiJ9MTIz\n/Users/midoudou/.env\n13812345678\nuser@example.com\n-----BEGIN RSA PRIVATE KEY-----\ndata\n-----END RSA PRIVATE KEY-----",
    });
    for (const f of result.findings) {
      expect(f.recommendation.length).toBeGreaterThan(0);
    }
  });

  // ── sourceRef optional ────────────────────────────────────────────────────────

  it("works without sourceRef", () => {
    const result = scanForSensitiveContent({ content: "sk_test_abc" });
    expect(result.status).toBeDefined();
    expect(result.findings).toBeDefined();
  });

  // ── start/end offsets are valid ─────────────────────────────────────────────

  it("findings have valid start < end offsets", () => {
    const result = scanForSensitiveContent({
      content: "Bearer eyJhbGciOiJIUzI1NiJ9MTIzNDU2Nzg5MA\n/Users/midoudou/.env\n13812345678",
    });
    for (const f of result.findings) {
      expect(f.start).toBeLessThan(f.end);
      expect(f.end).toBeLessThanOrEqual(result.redactedContent.length + 1000); // approximate
    }
  });

  // ── scanAll returns sorted by start ─────────────────────────────────────────

  it("findings are sorted by start position", () => {
    const result = scanForSensitiveContent({
      content: "prefix sk_key1 suffix /Users/midoudou path",
    });
    for (let i = 1; i < result.findings.length; i++) {
      expect(result.findings[i].start).toBeGreaterThan(result.findings[i - 1].start);
    }
  });
});