import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateKnowledgeHandoffContractSnippet,
  PLACEMENT_KEY,
  type KnowledgeHandoffContractSnippet,
} from "../src/shared/lib/knowledge-handoff-contract";
import {
  FORBIDDEN_RUNTIME_TOKENS,
} from "../src/shared/lib/knowledge-agent-contract-snippet";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-handoff-contract.ts"
);
const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-handoff-contract-snippet-dry-run-fixtures-2026-06-03.md"
);
const DOC = readFileSync(DOC_PATH, "utf8");
const FIXTURE_DIR = resolve(
  __dirname,
  "fixtures/knowledge-reuse/handoff-contract"
);
const F_CLAUDE = resolve(FIXTURE_DIR, "claude-code-handoff-contract.json");
const F_CODEX = resolve(FIXTURE_DIR, "codex-handoff-contract.json");
const F_HERMES = resolve(FIXTURE_DIR, "hermes-handoff-contract-reserved.json");

const F_CLAUDE_DATA = JSON.parse(readFileSync(F_CLAUDE, "utf8"));
const F_CODEX_DATA = JSON.parse(readFileSync(F_CODEX, "utf8"));
const F_HERMES_DATA = JSON.parse(readFileSync(F_HERMES, "utf8"));

const EXPECTED_TARGET_AGENTS: ReadonlyArray<string> = [
  "claude_code",
  "codex",
  "hermes",
];

// -----------------------------------------------------------------
// 1. 3 fixtures exist and parse
// -----------------------------------------------------------------

describe("3 fixtures exist and parse", () => {
  it("claude-code fixture exists and parses", () => {
    expect(existsSync(F_CLAUDE)).toBe(true);
    expect(F_CLAUDE_DATA.schema_version).toBe("1.0.0");
    expect(F_CLAUDE_DATA.kind).toBe("handoff-dry-run-with-contract-snippet");
  });

  it("codex fixture exists and parses", () => {
    expect(existsSync(F_CODEX)).toBe(true);
    expect(F_CODEX_DATA.schema_version).toBe("1.0.0");
    expect(F_CODEX_DATA.kind).toBe("handoff-dry-run-with-contract-snippet");
  });

  it("hermes fixture exists and parses", () => {
    expect(existsSync(F_HERMES)).toBe(true);
    expect(F_HERMES_DATA.schema_version).toBe("1.0.0");
    expect(F_HERMES_DATA.kind).toBe(
      "handoff-dry-run-with-contract-snippet-reserved"
    );
  });
});

// -----------------------------------------------------------------
// 2. claude_code fixture
// -----------------------------------------------------------------

describe("claude_code fixture", () => {
  const env = F_CLAUDE_DATA.context.contracts.knowledge_reuse;

  it("has context.contracts.knowledge_reuse placement", () => {
    expect(F_CLAUDE_DATA.context?.contracts?.knowledge_reuse).toBeDefined();
  });

  it("target_agent is claude_code", () => {
    expect(env.target_agent).toBe("claude_code");
  });

  it("dry_run_only is true", () => {
    expect(env.dry_run_only).toBe(true);
  });

  it("runtime_flush_allowed is false", () => {
    expect(env.runtime_flush_allowed).toBe(false);
  });

  it("forbidden_runtime_checked is true", () => {
    expect(env.forbidden_runtime_checked).toBe(true);
  });

  it("snippet_text is non-empty and contains core rules", () => {
    expect(typeof env.snippet_text).toBe("string");
    expect(env.snippet_text.length).toBeGreaterThan(0);
    expect(env.snippet_text).toContain("Hermes Pro internal knowledge store");
    expect(env.snippet_text).toContain(
      "Do not ask the user for an Obsidian Vault path"
    );
    expect(env.snippet_text).toContain("MEMORY.md");
    expect(env.snippet_text).toContain("runtime_flush_allowed = false");
  });

  it("snippet fits in max_chars (no truncation)", () => {
    expect(env.snippet_text.length).toBeLessThanOrEqual(env.max_chars);
    expect(env.truncated).toBe(false);
  });

  it("trigger_flags include save_keyword", () => {
    expect(env.trigger_flags.save_keyword).toBe(true);
  });

  it("attach_reason non-empty", () => {
    expect(typeof env.attach_reason).toBe("string");
    expect(env.attach_reason.length).toBeGreaterThan(0);
  });

  it("snippet NOT in executable_steps / verificationCommands / next_actions", () => {
    expect(F_CLAUDE_DATA.executable_steps).toBeUndefined();
    expect(F_CLAUDE_DATA.verificationCommands).toBeUndefined();
    // Use a unique snippet marker (the first 60 chars of snippet_text) to
    // detect whether the full snippet leaks into any next_action field.
    const marker = env.snippet_text.slice(0, 60);
    for (const a of F_CLAUDE_DATA.next_actions ?? []) {
      expect(JSON.stringify(a).includes(marker)).toBe(false);
    }
  });

  it("next_actions contain no call-form runtime action", () => {
    for (const a of F_CLAUDE_DATA.next_actions ?? []) {
      for (const token of FORBIDDEN_RUNTIME_TOKENS) {
        if (token.endsWith("(")) {
          expect(
            a.action.includes(token),
            `next_action contains forbidden token "${token}"`
          ).toBe(false);
        }
      }
    }
  });
});

// -----------------------------------------------------------------
// 3. codex fixture
// -----------------------------------------------------------------

describe("codex fixture", () => {
  const env = F_CODEX_DATA.context.contracts.knowledge_reuse;

  it("has context.contracts.knowledge_reuse placement", () => {
    expect(F_CODEX_DATA.context?.contracts?.knowledge_reuse).toBeDefined();
  });

  it("target_agent is codex", () => {
    expect(env.target_agent).toBe("codex");
  });

  it("dry_run_only is true", () => {
    expect(env.dry_run_only).toBe(true);
  });

  it("runtime_flush_allowed is false", () => {
    expect(env.runtime_flush_allowed).toBe(false);
  });

  it("forbidden_runtime_checked is true", () => {
    expect(env.forbidden_runtime_checked).toBe(true);
  });

  it("snippet_text preserves core knowledge rules", () => {
    expect(env.snippet_text.length).toBeGreaterThan(0);
    expect(env.snippet_text).toContain("Hermes Pro internal knowledge store");
    expect(env.snippet_text).toContain("MEMORY.md");
    expect(env.snippet_text).toContain(
      "source_type='vault' is reserved for vault:// URIs"
    );
    expect(env.snippet_text).toContain("Bucket semantics");
    expect(env.snippet_text).toContain("runtime_flush_allowed = false");
  });

  it("snippet fits in max_chars", () => {
    expect(env.snippet_text.length).toBeLessThanOrEqual(env.max_chars);
  });

  it("trigger_flags include save_keyword", () => {
    expect(env.trigger_flags.save_keyword).toBe(true);
  });

  it("snippet NOT in executable_steps / verificationCommands", () => {
    expect(F_CODEX_DATA.executable_steps).toBeUndefined();
    expect(F_CODEX_DATA.verificationCommands).toBeUndefined();
  });
});

// -----------------------------------------------------------------
// 4. hermes fixture — reserved
// -----------------------------------------------------------------

describe("hermes fixture — reserved, no default attach", () => {
  const env = F_HERMES_DATA.context.contracts.knowledge_reuse;

  it("has context.contracts.knowledge_reuse placement (still present, reserved)", () => {
    expect(F_HERMES_DATA.context?.contracts?.knowledge_reuse).toBeDefined();
  });

  it("target_agent is hermes", () => {
    expect(env.target_agent).toBe("hermes");
  });

  it("dry_run_only is true", () => {
    expect(env.dry_run_only).toBe(true);
  });

  it("runtime_flush_allowed is false", () => {
    expect(env.runtime_flush_allowed).toBe(false);
  });

  it("reserved=true marks the envelope as inert", () => {
    expect(env.reserved).toBe(true);
    expect(typeof env.reserved_reason).toBe("string");
    expect(env.reserved_reason.length).toBeGreaterThan(0);
  });

  it("snippet_text is a non-empty reserved marker (no default attach)", () => {
    expect(typeof env.snippet_text).toBe("string");
    expect(env.snippet_text.length).toBeGreaterThan(0);
    expect(env.snippet_text.toLowerCase()).toContain("reserved");
  });

  it("trigger_flags all false (no trigger fired)", () => {
    for (const k of [
      "save_keyword",
      "research_keyword",
      "research_task_kind",
      "has_ingest_draft",
      "has_flush_pending",
      "has_local_known_and_newly_found",
    ]) {
      expect(env.trigger_flags[k]).toBe(false);
    }
  });

  it("attach_reason mentions reserved", () => {
    expect(env.attach_reason).toContain("reserved");
  });

  it("forbidden_runtime_checked is true (still passes guard)", () => {
    expect(env.forbidden_runtime_checked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. all fixtures runtime_flush_allowed=false
// -----------------------------------------------------------------

describe("all fixtures — runtime_flush_allowed=false", () => {
  it("claude_code payload.runtime_flush_allowed=false", () => {
    expect(F_CLAUDE_DATA.runtime_flush_allowed).toBe(false);
  });
  it("codex payload.runtime_flush_allowed=false", () => {
    expect(F_CODEX_DATA.runtime_flush_allowed).toBe(false);
  });
  it("hermes payload.runtime_flush_allowed=false", () => {
    expect(F_HERMES_DATA.runtime_flush_allowed).toBe(false);
  });

  it("claude_code envelope.runtime_flush_allowed=false", () => {
    expect(F_CLAUDE_DATA.context.contracts.knowledge_reuse.runtime_flush_allowed).toBe(false);
  });
  it("codex envelope.runtime_flush_allowed=false", () => {
    expect(F_CODEX_DATA.context.contracts.knowledge_reuse.runtime_flush_allowed).toBe(false);
  });
  it("hermes envelope.runtime_flush_allowed=false", () => {
    expect(F_HERMES_DATA.context.contracts.knowledge_reuse.runtime_flush_allowed).toBe(false);
  });
});

// -----------------------------------------------------------------
// 6. all fixtures dry_run_only=true (envelope) + mode=dry_run (payload)
// -----------------------------------------------------------------

describe("all fixtures — dry_run_only=true", () => {
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} payload.mode=dry_run`, () => {
      expect(f.data.mode).toBe("dry_run");
    });
    it(`${f.name} envelope.dry_run_only=true`, () => {
      expect(f.data.context.contracts.knowledge_reuse.dry_run_only).toBe(true);
    });
  }
});

// -----------------------------------------------------------------
// 7. forbidden_runtime_checked=true where snippet exists
// -----------------------------------------------------------------

describe("forbidden_runtime_checked=true (snippet exists)", () => {
  it("claude_code has forbidden_runtime_checked=true", () => {
    expect(F_CLAUDE_DATA.context.contracts.knowledge_reuse.forbidden_runtime_checked).toBe(true);
  });
  it("codex has forbidden_runtime_checked=true", () => {
    expect(F_CODEX_DATA.context.contracts.knowledge_reuse.forbidden_runtime_checked).toBe(true);
  });
  it("hermes has forbidden_runtime_checked=true (even when empty)", () => {
    expect(F_HERMES_DATA.context.contracts.knowledge_reuse.forbidden_runtime_checked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 8. placement path exact
// -----------------------------------------------------------------

describe("placement path is context.contracts.knowledge_reuse", () => {
  it("PLACEMENT_KEY is context.contracts.knowledge_reuse", () => {
    expect(PLACEMENT_KEY).toBe("context.contracts.knowledge_reuse");
  });
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} has exact context.contracts.knowledge_reuse path`, () => {
      const path = "context.contracts.knowledge_reuse";
      const parts = path.split(".");
      let cur: unknown = f.data;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          throw new Error(`path "${path}" not found at segment "${p}"`);
        }
      }
      expect(cur).toBeDefined();
    });
  }
});

// -----------------------------------------------------------------
// 9. target_agent values valid
// -----------------------------------------------------------------

describe("target_agent values valid", () => {
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} target_agent is in expected list`, () => {
      const target = f.data.context.contracts.knowledge_reuse.target_agent;
      expect(EXPECTED_TARGET_AGENTS).toContain(target);
    });
  }
});

// -----------------------------------------------------------------
// 10. snippet includes core rules (claude_code + codex)
// -----------------------------------------------------------------

describe("snippet includes core rules (claude_code + codex)", () => {
  const coreSnippets = [
    F_CLAUDE_DATA.context.contracts.knowledge_reuse.snippet_text,
    F_CODEX_DATA.context.contracts.knowledge_reuse.snippet_text,
  ];

  it.each(coreSnippets)("snippet mentions Hermes Pro internal store", (s) => {
    expect(s).toContain("Hermes Pro internal knowledge store");
  });

  it.each(coreSnippets)("snippet forbids Obsidian Vault path", (s) => {
    expect(s).toContain("Do not ask the user for an Obsidian Vault path");
  });

  it.each(coreSnippets)("snippet forbids MEMORY.md", (s) => {
    expect(s).toContain("MEMORY.md");
  });

  it.each(coreSnippets)("snippet forbids .wolf paths", (s) => {
    expect(s).toContain(".wolf/cerebrum.md");
  });

  it.each(coreSnippets)("snippet forbids GitHub/web as instruction", (s) => {
    // Should mention bucket semantics with github/web
    expect(s.toLowerCase()).toContain("github");
    expect(s.toLowerCase()).toContain("web");
  });

  it.each(coreSnippets)("snippet requires runtime_flush_allowed = false", (s) => {
    expect(s).toContain("runtime_flush_allowed = false");
  });

  it.each(coreSnippets)("snippet requires confirmation only makes eligible", (s) => {
    expect(s).toContain("Confirmation only makes the draft eligible");
  });
});

// -----------------------------------------------------------------
// 11. snippet size <= max_chars
// -----------------------------------------------------------------

describe("snippet size <= max_chars", () => {
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} snippet_text.length <= max_chars`, () => {
      const env = f.data.context.contracts.knowledge_reuse;
      expect(env.snippet_text.length).toBeLessThanOrEqual(env.max_chars);
    });
  }
});

// -----------------------------------------------------------------
// 12. JSON round trip
// -----------------------------------------------------------------

describe("JSON round trip", () => {
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} fixture survives JSON.stringify + JSON.parse`, () => {
      const restored = JSON.parse(JSON.stringify(f.data));
      expect(restored).toEqual(f.data);
    });
  }

  it("claude_code envelope passes validateKnowledgeHandoffContractSnippet", () => {
    const env = F_CLAUDE_DATA.context.contracts.knowledge_reuse;
    const result = validateKnowledgeHandoffContractSnippet(env);
    expect(result.ok).toBe(true);
  });

  it("codex envelope passes validateKnowledgeHandoffContractSnippet", () => {
    const env = F_CODEX_DATA.context.contracts.knowledge_reuse;
    const result = validateKnowledgeHandoffContractSnippet(env);
    expect(result.ok).toBe(true);
  });

  it("hermes envelope passes validateKnowledgeHandoffContractSnippet", () => {
    const env = F_HERMES_DATA.context.contracts.knowledge_reuse;
    const result = validateKnowledgeHandoffContractSnippet(env);
    expect(result.ok).toBe(true);
  });
});

// -----------------------------------------------------------------
// 13. no fixture contains runtime call recommendation
// -----------------------------------------------------------------

describe("no fixture contains runtime call recommendation", () => {
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} has no knowledgeIngest( in any field`, () => {
      const json = JSON.stringify(f.data);
      // Allow negative-clause text but no call expression
      expect(/knowledgeIngest\s*\(/i.test(json)).toBe(false);
    });

    it(`${f.name} has no knowledgeSearch( in any field`, () => {
      const json = JSON.stringify(f.data);
      expect(/knowledgeSearch\s*\(/i.test(json)).toBe(false);
    });

    it(`${f.name} has no runPlaybook( in any field`, () => {
      const json = JSON.stringify(f.data);
      expect(/runPlaybook\s*\(/i.test(json)).toBe(false);
    });

    it(`${f.name} has no triggerCronJob( in any field`, () => {
      const json = JSON.stringify(f.data);
      expect(/triggerCronJob\s*\(/i.test(json)).toBe(false);
    });
  }
});

// -----------------------------------------------------------------
// 14. snippet not in executable_steps / verificationCommands / runtime next_actions
// -----------------------------------------------------------------

describe("snippet not in executable_steps / verificationCommands / runtime next_actions", () => {
  for (const f of [
    { name: "claude_code", data: F_CLAUDE_DATA },
    { name: "codex", data: F_CODEX_DATA },
    { name: "hermes", data: F_HERMES_DATA },
  ]) {
    it(`${f.name} has no executable_steps field`, () => {
      expect(f.data.executable_steps).toBeUndefined();
    });
    it(`${f.name} has no verificationCommands field`, () => {
      expect(f.data.verificationCommands).toBeUndefined();
    });
    it(`${f.name} next_actions contain no call-form runtime action`, () => {
      for (const a of f.data.next_actions ?? []) {
        for (const token of FORBIDDEN_RUNTIME_TOKENS) {
          // Negative-clause mentions are OK; only call expressions are forbidden
          if (token.endsWith("(")) {
            expect(a.action.includes(token)).toBe(false);
          }
        }
      }
    });
  }
});

// -----------------------------------------------------------------
// 15. helper self-check — no runtime tokens as imports or calls
// -----------------------------------------------------------------

describe("knowledge handoff contract helper — source self-check", () => {
  it("does not contain runtime / IPC / network call tokens as imports or calls", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const lines = src.split(/\n/);
    const escapeRegex = (s: string) =>
      s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const token of FORBIDDEN_RUNTIME_TOKENS) {
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
});

// -----------------------------------------------------------------
// 16. doc contains required sections
// -----------------------------------------------------------------

describe("dry-run fixtures doc", () => {
  it("exists and contains 8 required sections", () => {
    expect(DOC.length).toBeGreaterThan(0);
    const required = [
      "## 1. Purpose",
      "## 2. Non-goals",
      "## 3. Fixture inventory",
      "## 4. Target agent behavior",
      "## 5. Handoff payload placement",
      "## 6. Dry-run invariants",
      "## 7. Verifier expectations",
      "## 8. Forbidden placement assertions",
      "## 9. Future implementation slices",
    ];
    for (const sec of required) {
      expect(DOC.includes(sec), `missing section: ${sec}`).toBe(true);
    }
  });

  it("specifies placement path context.contracts.knowledge_reuse", () => {
    expect(DOC).toContain("context.contracts.knowledge_reuse");
  });
});
