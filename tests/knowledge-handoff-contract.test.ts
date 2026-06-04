import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildKnowledgeHandoffContractSnippet,
  validateKnowledgeHandoffContractSnippet,
  assertKnowledgeHandoffContractNoRuntime,
  projectKnowledgeHandoffContractToPlacement,
  KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION,
  PLACEMENT_KEY,
  SOURCE_DOC_ID,
  DEFAULT_MAX_CHARS,
  type KnowledgeHandoffContractSnippet,
  type BuildKnowledgeHandoffContractSnippetInput,
} from "../src/shared/lib/knowledge-handoff-contract";
import { type KnowledgeContractAttachContext } from "../src/shared/lib/knowledge-agent-contract-snippet";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-handoff-contract.ts"
);
const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-handoff-contract-snippet-insertion-design-2026-06-03.md"
);
const DOC = readFileSync(DOC_PATH, "utf8");

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

function makeInput(
  overrides: Partial<BuildKnowledgeHandoffContractSnippetInput> = {}
): BuildKnowledgeHandoffContractSnippetInput {
  const ctx: KnowledgeContractAttachContext = {
    request_text: "save this to the knowledge base",
    task_kind: "github_research",
    handoff_context: {
      has_ingest_draft: true,
      has_local_known: true,
      has_newly_found: true,
      owner: "hermes",
    },
  };
  return {
    target_agent: "claude_code",
    attach_context: ctx,
    now_iso: "2026-06-03T10:00:00.000Z",
    max_chars: 2048,
    ...overrides,
  };
}

function makeEnvelope(
  overrides: Partial<BuildKnowledgeHandoffContractSnippetInput> = {}
): KnowledgeHandoffContractSnippet {
  return buildKnowledgeHandoffContractSnippet(makeInput(overrides));
}

// -----------------------------------------------------------------
// 1. build — required fields
// -----------------------------------------------------------------

describe("buildKnowledgeHandoffContractSnippet — required fields", () => {
  it("emits all 13 required fields with correct types", () => {
    const env = makeEnvelope();
    expect(env.target_agent).toBe("claude_code");
    expect(env.snippet_version).toBe(KNOWLEDGE_HANDOFF_CONTRACT_SCHEMA_VERSION);
    expect(typeof env.snippet_text).toBe("string");
    expect(env.snippet_text.length).toBeGreaterThan(0);
    expect(typeof env.attach_reason).toBe("string");
    expect(env.attach_reason.length).toBeGreaterThan(0);
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.source_doc).toBe(SOURCE_DOC_ID);
    expect(typeof env.created_at).toBe("string");
    expect(env.created_at).toBe("2026-06-03T10:00:00.000Z");
    expect(env.max_chars).toBe(2048);
    expect(typeof env.truncated).toBe("boolean");
    expect(env.forbidden_runtime_checked).toBe(true);
  });

  it("preserves trigger_flags", () => {
    const env = makeEnvelope();
    expect(env.trigger_flags.save_keyword).toBe(true);
    expect(env.trigger_flags.research_keyword).toBe(false);
    expect(env.trigger_flags.research_task_kind).toBe(true);
    expect(env.trigger_flags.has_ingest_draft).toBe(true);
    expect(env.trigger_flags.has_flush_pending).toBe(false);
    expect(env.trigger_flags.has_local_known_and_newly_found).toBe(true);
  });

  it("attach_reason is non-empty and derived from triggers", () => {
    const env = makeEnvelope();
    expect(env.attach_reason.length).toBeGreaterThan(0);
    // save_keyword is true → reason should mention save
    expect(env.attach_reason).toContain("save");
  });

  it("emits 3 target agents (claude_code / codex / hermes)", () => {
    for (const a of ["claude_code", "codex", "hermes"] as const) {
      const env = makeEnvelope({ target_agent: a });
      expect(env.target_agent).toBe(a);
    }
  });
});

// -----------------------------------------------------------------
// 2. build — max_chars + truncation
// -----------------------------------------------------------------

describe("buildKnowledgeHandoffContractSnippet — max_chars / truncated", () => {
  it("truncated=false when text fits in max_chars", () => {
    const env = makeEnvelope({ max_chars: 4096 });
    expect(env.truncated).toBe(false);
    expect(env.snippet_text.length).toBeLessThanOrEqual(4096);
  });

  it("truncated=true when text exceeds max_chars", () => {
    const env = makeEnvelope({ max_chars: 64 });
    expect(env.truncated).toBe(true);
    expect(env.snippet_text.length).toBe(64);
  });

  it("default max_chars is 2048", () => {
    const env = makeEnvelope({ max_chars: undefined });
    expect(env.max_chars).toBe(DEFAULT_MAX_CHARS);
  });
});

// -----------------------------------------------------------------
// 3. forbidden_runtime_checked=true
// -----------------------------------------------------------------

describe("forbidden_runtime_checked literal", () => {
  it("always true", () => {
    const env = makeEnvelope();
    expect(env.forbidden_runtime_checked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. validate — runtime_flush_allowed reject
// -----------------------------------------------------------------

describe("validateKnowledgeHandoffContractSnippet — runtime_flush_allowed", () => {
  it("rejects runtime_flush_allowed=true", () => {
    const env = makeEnvelope();
    const tampered = { ...env, runtime_flush_allowed: true as never };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "runtime_flush_allowed")).toBe(true);
  });

  it("rejects dry_run_only=false", () => {
    const env = makeEnvelope();
    const tampered = { ...env, dry_run_only: false as never };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "dry_run_only")).toBe(true);
  });

  it("rejects forbidden_runtime_checked=false", () => {
    const env = makeEnvelope();
    const tampered = { ...env, forbidden_runtime_checked: false as never };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "forbidden_runtime_checked")).toBe(true);
  });

  it("rejects missing snippet_text", () => {
    const env = makeEnvelope();
    const tampered = { ...env, snippet_text: "" };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "snippet_text")).toBe(true);
  });

  it("rejects empty attach_reason", () => {
    const env = makeEnvelope();
    const tampered = { ...env, attach_reason: "" };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "attach_reason")).toBe(true);
  });

  it("rejects snippet_text exceeding max_chars", () => {
    const env = makeEnvelope({ max_chars: 64 });
    const tampered = { ...env, snippet_text: "x".repeat(100) };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "snippet_text_exceeds_max_chars")).toBe(true);
  });

  it("rejects wrong snippet_version", () => {
    const env = makeEnvelope();
    const tampered = { ...env, snippet_version: "0.9.0" as never };
    const result = validateKnowledgeHandoffContractSnippet(tampered);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "snippet_version")).toBe(true);
  });

  it("rejects non-object payload", () => {
    const result = validateKnowledgeHandoffContractSnippet(null);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "not_object")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. assertNoRuntime — rejects executable placement
// -----------------------------------------------------------------

describe("assertKnowledgeHandoffContractNoRuntime", () => {
  it("does not throw for canonical envelope", () => {
    const env = makeEnvelope();
    expect(() => assertKnowledgeHandoffContractNoRuntime(env)).not.toThrow();
  });

  it("throws when payload has forbidden field 'executable_command'", () => {
    const env = makeEnvelope() as KnowledgeHandoffContractSnippet & {
      executable_command?: string;
    };
    env.executable_command = "echo pwned";
    expect(() => assertKnowledgeHandoffContractNoRuntime(env)).toThrow(
      /executable_command/
    );
  });

  it("throws when payload has forbidden field 'verification_command'", () => {
    const env = makeEnvelope() as KnowledgeHandoffContractSnippet & {
      verification_command?: string;
    };
    env.verification_command = "echo pwned";
    expect(() => assertKnowledgeHandoffContractNoRuntime(env)).toThrow(
      /verification_command/
    );
  });

  it("throws when payload has forbidden field 'fetch_url'", () => {
    const env = makeEnvelope() as KnowledgeHandoffContractSnippet & {
      fetch_url?: string;
    };
    env.fetch_url = "https://example.com";
    expect(() => assertKnowledgeHandoffContractNoRuntime(env)).toThrow(/fetch_url/);
  });

  it("throws when payload has forbidden field 'write_to_path'", () => {
    const env = makeEnvelope() as KnowledgeHandoffContractSnippet & {
      write_to_path?: string;
    };
    env.write_to_path = "/etc/passwd";
    expect(() => assertKnowledgeHandoffContractNoRuntime(env)).toThrow(/write_to_path/);
  });

  it("throws when snippet_text contains knowledgeIngest( as a call", () => {
    const env = makeEnvelope();
    const tampered = {
      ...env,
      snippet_text: env.snippet_text + "\nconst x = knowledgeIngest('hi');",
    };
    expect(() => assertKnowledgeHandoffContractNoRuntime(tampered)).toThrow(
      /knowledgeIngest/
    );
  });
});

// -----------------------------------------------------------------
// 6. projectKnowledgeHandoffContractToPlacement
// -----------------------------------------------------------------

describe("projectKnowledgeHandoffContractToPlacement", () => {
  it("returns the canonical placement key", () => {
    const env = makeEnvelope();
    const placement = projectKnowledgeHandoffContractToPlacement(env);
    expect(placement.path).toBe(PLACEMENT_KEY);
    expect(placement.path).toBe("context.contracts.knowledge_reuse");
  });

  it("envelope round-trips unchanged", () => {
    const env = makeEnvelope();
    const placement = projectKnowledgeHandoffContractToPlacement(env);
    expect(placement.envelope).toBe(env);
  });
});

// -----------------------------------------------------------------
// 7. JSON round-trip
// -----------------------------------------------------------------

describe("JSON round trip", () => {
  it("envelope survives JSON.stringify + JSON.parse", () => {
    const env = makeEnvelope();
    const restored = JSON.parse(JSON.stringify(env)) as KnowledgeHandoffContractSnippet;
    expect(restored).toEqual(env);
    expect(restored.dry_run_only).toBe(true);
    expect(restored.runtime_flush_allowed).toBe(false);
    expect(restored.forbidden_runtime_checked).toBe(true);
  });

  it("placement survives JSON round-trip", () => {
    const env = makeEnvelope();
    const placement = projectKnowledgeHandoffContractToPlacement(env);
    const restored = JSON.parse(JSON.stringify(placement));
    expect(restored.path).toBe(PLACEMENT_KEY);
    expect(restored.envelope).toEqual(env);
  });
});

// -----------------------------------------------------------------
// 8. build throws when attach_context does not pass shouldAttach
// -----------------------------------------------------------------

describe("build throws when context does not pass shouldAttach", () => {
  it("throws when request_text is empty and no triggers fire", () => {
    const input: BuildKnowledgeHandoffContractSnippetInput = {
      target_agent: "claude_code",
      attach_context: { request_text: "" },
    };
    expect(() => buildKnowledgeHandoffContractSnippet(input)).toThrow(
      /did not pass shouldAttachKnowledgeContract/
    );
  });

  it("throws when target_agent is missing", () => {
    const input = {
      attach_context: { request_text: "save to knowledge" },
    } as unknown as BuildKnowledgeHandoffContractSnippetInput;
    expect(() => buildKnowledgeHandoffContractSnippet(input)).toThrow(
      /target_agent is required/
    );
  });
});

// -----------------------------------------------------------------
// 9. helper self-check — no runtime tokens as imports or calls
// -----------------------------------------------------------------

describe("knowledge handoff contract helper — source self-check", () => {
  it("does not contain runtime / IPC / network call tokens as imports or calls", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const lines = src.split(/\n/);
    const escapeRegex = (s: string) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const forbidden: ReadonlyArray<string> = [
      "knowledgeIngest",
      "knowledgeSearch",
      "ipcMain",
      "ipcRenderer",
      "triggerCronJob",
      "sendMessage",
      "runPlaybook",
      "child_process",
      "delegate_task",
      "fetch(",
      "axios",
      "XMLHttpRequest",
      "serve",
      "agent",
    ];
    for (const token of forbidden) {
      const callRe = new RegExp(
        "\\b" + escapeRegex(token) + (token.endsWith("(") ? "\\s*" : "\\s*\\(")
      );
      const importRe = new RegExp(
        "^\\s*import\\s.*\\b" + escapeRegex(token) + "\\b",
        "m"
      );
      for (const line of lines) {
        const trimmed = line.trim();
        if (
          trimmed.startsWith("//") ||
          trimmed.startsWith("*") ||
          trimmed.startsWith("/*")
        )
          continue;
        if (callRe.test(line) || importRe.test(line)) {
          throw new Error(
            `helper line contains forbidden runtime token "${token}": ${line}`
          );
        }
      }
    }
  });

  it("does not import from runtime / preload / main layers", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    expect(src.includes('from "../preload')).toBe(false);
    expect(src.includes('from "../main')).toBe(false);
    expect(src.includes("window.hermesAPI")).toBe(false);
  });
});

// -----------------------------------------------------------------
// 10. doc structure
// -----------------------------------------------------------------

describe("contract snippet insertion design doc", () => {
  it("exists and contains 12 required sections", () => {
    expect(DOC.length).toBeGreaterThan(0);
    const required = [
      "## 1. Purpose",
      "## 2. Non-goals",
      "## 3. Current Handoff Pack boundary",
      "## 4. Trigger conditions",
      "## 5. Proposed payload schema",
      "## 6. Field placement",
      "## 7. Target agent rules",
      "## 8. Snippet size / truncation rules",
      "## 9. Dry-run safety invariants",
      "## 10. Verifier expectations",
      "## 11. Forbidden runtime instructions",
      "## 12. Failure modes",
      "## 13. Future implementation slices",
    ];
    for (const sec of required) {
      expect(DOC.includes(sec), `missing section: ${sec}`).toBe(true);
    }
  });

  it("specifies placement path context.contracts.knowledge_reuse", () => {
    expect(DOC).toContain("context.contracts.knowledge_reuse");
  });

  it("specifies 13 required fields with literal types", () => {
    expect(DOC).toContain("dry_run_only: true");
    expect(DOC).toContain("runtime_flush_allowed: false");
    expect(DOC).toContain("forbidden_runtime_checked: true");
  });
});
