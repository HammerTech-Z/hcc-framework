import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyProvenanceSourceUri,
  validateKnowledgeSourceFidelity,
  VAULT_URI_PREFIX,
} from "../src/shared/lib/knowledge-reuse-integration";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-reuse-integration.ts"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/tri-agent-evaluation-input.json"
);

interface FixtureFinding {
  id: string;
  source_type: string;
  source_uri: string;
  finding: string;
  fetched_at: string;
  trust_level: string;
  do_not_use_as_current_truth?: boolean;
  stale_reason?: string | null;
}

function loadFixture(): { input_findings: FixtureFinding[]; fidelity: {
  expected_stale_fetched_at: string;
  vault_uri_prefix: string;
  local_plan_uri_prefix: string;
  rules: string[];
  soft_fail_triggers: string[];
  hard_fail_triggers: string[];
  by_finding: Record<string, unknown>;
} } {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

// -----------------------------------------------------------------
// 1. classifyProvenanceSourceUri
// -----------------------------------------------------------------

describe("classifyProvenanceSourceUri", () => {
  it("returns 'vault' for vault:// URIs", () => {
    expect(classifyProvenanceSourceUri("vault://wiki/foo.md")).toBe("vault");
    expect(classifyProvenanceSourceUri("vault://")).toBe("vault");
  });

  it("returns 'unknown' for /Users/... paths (local filesystem)", () => {
    expect(
      classifyProvenanceSourceUri(
        "/Users/midoudou/hermes-pro/docs/knowledge/foo.md"
      )
    ).toBe("unknown");
  });

  it("returns 'unknown' for docs/... paths (relative repo paths)", () => {
    expect(classifyProvenanceSourceUri("docs/current-fusion-plan-2026-05-30.md")).toBe(
      "unknown"
    );
  });

  it("returns 'unknown' for Desktop知识/... paths (Chinese-stem local paths)", () => {
    expect(
      classifyProvenanceSourceUri(
        "/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/old.md"
      )
    ).toBe("unknown");
  });

  it("returns 'unknown' for https:// URIs", () => {
    expect(
      classifyProvenanceSourceUri("https://github.com/example/repo")
    ).toBe("unknown");
  });

  it("returns 'unknown' for empty or non-string input", () => {
    expect(classifyProvenanceSourceUri("")).toBe("unknown");
    // @ts-expect-error testing runtime guard
    expect(classifyProvenanceSourceUri(null)).toBe("unknown");
    // @ts-expect-error testing runtime guard
    expect(classifyProvenanceSourceUri(undefined)).toBe("unknown");
  });
});

// -----------------------------------------------------------------
// 2. validateKnowledgeSourceFidelity
// -----------------------------------------------------------------

describe("validateKnowledgeSourceFidelity", () => {
  it("returns ok=true when output preserves input exactly", () => {
    const input = [
      {
        source_type: "vault" as const,
        source_uri: "vault://wiki/foo.md",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const output = [
      {
        source_type: "vault" as const,
        source_uri: "vault://wiki/foo.md",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const report = validateKnowledgeSourceFidelity(input, output);
    expect(report.ok).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("flags fetched_at drift as soft_fail", () => {
    const input = [
      {
        source_type: "local_plan" as const,
        source_uri: "/Users/x/docs/foo.md",
        fetched_at: "2026-05-20T00:00:00+08:00",
      },
    ];
    const output = [
      {
        source_type: "local_plan" as const,
        source_uri: "/Users/x/docs/foo.md",
        fetched_at: "2025-05-20T00:00:00+08:00", // year drift
      },
    ];
    const report = validateKnowledgeSourceFidelity(input, output);
    expect(report.ok).toBe(false);
    expect(report.drifted_fetched_at).toBe(1);
    expect(report.issues.some((i) => i.field === "fetched_at")).toBe(true);
  });

  it("flags source_uri rewrite as soft_fail", () => {
    const input = [
      {
        source_type: "github" as const,
        source_uri: "https://github.com/example/repo",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const output = [
      {
        source_type: "github" as const,
        source_uri: "https://github.com/example/different-repo", // rewrite
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const report = validateKnowledgeSourceFidelity(input, output);
    expect(report.ok).toBe(false);
    expect(report.rewritten_source_uris).toBe(1);
  });

  it("flags source_type mismatch (local file labeled vault) as soft_fail by default", () => {
    const input = [
      {
        source_type: "local_plan" as const,
        source_uri: "/Users/x/docs/foo.md",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const output = [
      {
        source_type: "vault" as const, // wrong label
        source_uri: "/Users/x/docs/foo.md",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const report = validateKnowledgeSourceFidelity(input, output);
    expect(report.ok).toBe(false);
    expect(report.mismatched_source_types).toBe(1);
    expect(
      report.issues.find((i) => i.field === "source_type")?.severity
    ).toBe("soft_fail");
  });

  it("escalates vault-label on non-vault URI to hard_fail when allow_hard_fail=true", () => {
    const input = [
      {
        source_type: "local_plan" as const,
        source_uri: "/Users/x/docs/foo.md",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const output = [
      {
        source_type: "vault" as const,
        source_uri: "/Users/x/docs/foo.md",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    expect(() =>
      validateKnowledgeSourceFidelity(input, output, { allow_hard_fail: true })
    ).toThrow(/source fidelity hard_fail/);
  });

  it("does NOT escalate other source_type mismatches to hard_fail", () => {
    const input = [
      {
        source_type: "vault" as const,
        source_uri: "vault://x",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    const output = [
      {
        source_type: "github" as const, // also a mismatch, but not vault-on-non-vault
        source_uri: "vault://x",
        fetched_at: "2026-06-03T00:00:00+08:00",
      },
    ];
    // Even with allow_hard_fail=true, this is only soft_fail (no vault-on-non-vault escalation).
    const report = validateKnowledgeSourceFidelity(input, output, { allow_hard_fail: true });
    expect(report.mismatched_source_types).toBe(1);
    expect(
      report.issues.find((i) => i.field === "source_type")?.severity
    ).toBe("soft_fail");
  });
});

// -----------------------------------------------------------------
// 3. helper invariants for the golden fixture (tri-agent input)
// -----------------------------------------------------------------

describe("golden fixture (tri-agent input) fidelity invariants", () => {
  it("f-5 stale fetched_at is 2026-05-20T00:00:00+08:00", () => {
    const fx = loadFixture();
    const f5 = fx.input_findings.find((f) => f.id === "f-5");
    expect(f5).toBeDefined();
    expect(f5?.fetched_at).toBe("2026-05-20T00:00:00+08:00");
  });

  it("expected_stale_fetched_at in fidelity block matches f-5", () => {
    const fx = loadFixture();
    expect(fx.fidelity.expected_stale_fetched_at).toBe(
      "2026-05-20T00:00:00+08:00"
    );
  });

  it("vault_uri_prefix in fidelity block is 'vault://'", () => {
    const fx = loadFixture();
    expect(fx.fidelity.vault_uri_prefix).toBe(VAULT_URI_PREFIX);
  });

  it("local_plan_uri_prefix in fidelity block is '/Users/'", () => {
    const fx = loadFixture();
    expect(fx.fidelity.local_plan_uri_prefix).toBe("/Users/");
  });

  it("fidelity.rules includes vault source_type requires vault:// prefix", () => {
    const fx = loadFixture();
    expect(
      fx.fidelity.rules.some((r) =>
        /vault[^]*requires[^]*vault:\/\//i.test(r)
      )
    ).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. helper applies to the golden fixture cleanly
// -----------------------------------------------------------------

describe("apply fidelity helper to the tri-agent fixture", () => {
  it("all 5 findings pass when output preserves input exactly", () => {
    const fx = loadFixture();
    const report = validateKnowledgeSourceFidelity(
      fx.input_findings.map((f) => ({
        source_type: f.source_type as never,
        source_uri: f.source_uri,
        fetched_at: f.fetched_at,
      })),
      fx.input_findings.map((f) => ({
        source_type: f.source_type as never,
        source_uri: f.source_uri,
        fetched_at: f.fetched_at,
      }))
    );
    expect(report.ok).toBe(true);
    expect(report.drifted_fetched_at).toBe(0);
    expect(report.rewritten_source_uris).toBe(0);
    expect(report.mismatched_source_types).toBe(0);
  });

  it("f-1 local file must NOT be classified as vault", () => {
    const fx = loadFixture();
    const f1 = fx.input_findings.find((f) => f.id === "f-1")!;
    expect(classifyProvenanceSourceUri(f1.source_uri)).toBe("unknown");
    // The fidelity rules require the output source_type to remain local_plan,
    // not vault. A report that flips it to vault should detect a mismatch.
    const output = [
      {
        source_type: "vault" as never,
        source_uri: f1.source_uri,
        fetched_at: f1.fetched_at,
      },
    ];
    const input = [
      {
        source_type: "local_plan" as never,
        source_uri: f1.source_uri,
        fetched_at: f1.fetched_at,
      },
    ];
    const report = validateKnowledgeSourceFidelity(input, output);
    expect(report.mismatched_source_types).toBe(1);
  });

  it("f-2 vault:// URI classifies as vault", () => {
    const fx = loadFixture();
    const f2 = fx.input_findings.find((f) => f.id === "f-2")!;
    expect(classifyProvenanceSourceUri(f2.source_uri)).toBe("vault");
  });
});

// -----------------------------------------------------------------
// 5. source code self-check — integration helper has no runtime tokens
// -----------------------------------------------------------------

describe("source code self-check (integration helper)", () => {
  it("does not contain runtime call tokens", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    // Build runtime-construct token check to avoid false positives on
    // description / regex strings.
    const tokens: Array<{ label: string; needle: string }> = [
      { label: "ipcMain", needle: ["ipc", "Main"].join("") },
      { label: "ipcRenderer", needle: ["ipc", "Renderer"].join("") },
      { label: "triggerCronJob", needle: ["trigger", "Cron", "Job"].join("") },
      { label: "sendMessage", needle: ["send", "Message"].join("") },
      { label: "runPlaybook", needle: ["run", "Playbook"].join("") },
      { label: "childProcess", needle: ["child", "_", "process"].join("") },
    ];
    for (const t of tokens) {
      expect(
        code.includes(t.needle),
        `integration helper must not contain: ${t.label}`
      ).toBe(false);
    }
    // Runtime call patterns — use regex built at runtime to avoid the
    // literal "fetch(" string appearing in this test file.
    const knowledgeIngest = new RegExp("knowledge" + "Ingest" + "\\s*\\(");
    const knowledgeSearch = new RegExp("knowledge" + "Search" + "\\s*\\(");
    expect(code.match(knowledgeIngest), "no knowledgeIngest( call").toBeNull();
    expect(code.match(knowledgeSearch), "no knowledgeSearch( call").toBeNull();
  });
});
