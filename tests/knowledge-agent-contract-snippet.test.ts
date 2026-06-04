import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildKnowledgeAgentContractSnippet,
  shouldAttachKnowledgeContract,
  assertKnowledgeContractNoRuntime,
  assertSnippetShape,
  FORBIDDEN_RUNTIME_TOKENS,
  SUPPORTED_TARGET_AGENTS,
  type KnowledgeContractTargetAgent,
  type KnowledgeContractAttachContext,
} from "../src/shared/lib/knowledge-agent-contract-snippet";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-agent-contract-snippet.ts"
);
const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-claude-code-contract-landing-2026-06-03.md"
);
const DOC = readFileSync(DOC_PATH, "utf8");

const REQUIRED_POSITIVE_RULES: ReadonlyArray<string> = [
  "Hermes Pro internal knowledge store",
  "Do not ask the user for an Obsidian Vault path",
  "MEMORY.md",
  ".wolf/cerebrum.md",
  "Do not use any of the deceptive-phrase",
  "local_known",
  "newly_found",
  "judgment",
  "ingest_draft",
  "source_uri",
  "fetched_at",
  "source_type='vault' is reserved for vault:// URIs",
  "Bucket semantics",
  "local_plan",
  "github",
  "web",
  "Stale",
  "Confirmation only makes the draft eligible",
  "runtime_flush_allowed = false",
];

const FORBIDDEN_PHRASES_IN_SNIPPET: ReadonlyArray<string> = [
  "saved successfully",
  "已保存",
  "写入成功",
  "will be written after confirm",
  "确认后将写入",
];

// -----------------------------------------------------------------
// 1. helper self-check — no runtime tokens as imports or calls
// -----------------------------------------------------------------

describe("knowledge agent contract helper — source self-check", () => {
  it("does not contain runtime / IPC / network call tokens as imports or calls", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const lines = src.split(/\n/);
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const token of FORBIDDEN_RUNTIME_TOKENS) {
      const callRe = new RegExp("\\b" + escapeRegex(token) + "\\s*\\(");
      const importRe = new RegExp(
        "^\\s*import\\s.*\\b" + escapeRegex(token) + "\\b",
        "m"
      );
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
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
// 2. buildKnowledgeAgentContractSnippet — required positive rules
// -----------------------------------------------------------------

describe("buildKnowledgeAgentContractSnippet — required rules", () => {
  const snippet = buildKnowledgeAgentContractSnippet("claude_code");

  it.each(REQUIRED_POSITIVE_RULES)("snippet includes required rule: %s", (rule) => {
    expect(snippet.includes(rule), `missing required rule: ${rule}`).toBe(true);
  });

  it("snippet does NOT include forbidden promise phrases", () => {
    for (const phrase of FORBIDDEN_PHRASES_IN_SNIPPET) {
      expect(
        snippet.includes(phrase),
        `snippet should not contain: ${phrase}`
      ).toBe(false);
    }
  });

  it("assertSnippetShape reports ok=true for the canonical snippet", () => {
    const shape = assertSnippetShape(snippet);
    expect(shape.ok).toBe(true);
    expect(shape.missing_required).toEqual([]);
    expect(shape.missing_forbidden).toEqual([]);
  });

  it("supports 4 target agents: claude_code / codex / hermes_pro / hermes", () => {
    for (const agent of SUPPORTED_TARGET_AGENTS) {
      expect([
        "claude_code",
        "codex",
        "hermes_pro",
        "hermes",
      ]).toContain(agent);
    }
  });

  it("snippet header includes target agent name", () => {
    for (const agent of SUPPORTED_TARGET_AGENTS) {
      const s = buildKnowledgeAgentContractSnippet(agent);
      expect(s).toContain(agent);
    }
  });
});

// -----------------------------------------------------------------
// 3. shouldAttachKnowledgeContract — 5 trigger true cases
// -----------------------------------------------------------------

describe("shouldAttachKnowledgeContract — trigger true cases", () => {
  it("returns true for explicit save-to-knowledge request", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "Compare A vs B, and save the result to the knowledge base",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });

  it("returns true for Chinese save keyword (保存/沉淀/存档)", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "把这个 GitHub 仓库的活跃度分析沉淀到 Hermes Pro 知识库",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });

  it("returns true for GitHub research + save request", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "研究 GitHub 仓库活跃度, 写进 Hermes Pro 知识库",
      task_kind: "github_research",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });

  it("returns true for tool_comparison / technical_selection", () => {
    expect(
      shouldAttachKnowledgeContract({
        request_text: "工具选型: vite vs webpack",
        task_kind: "technical_selection",
      })
    ).toBe(true);
  });

  it("returns true for handoff context with ingest_draft", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "tool selection",
      task_kind: "tool_comparison",
      handoff_context: {
        has_ingest_draft: true,
        has_local_known: true,
        has_newly_found: true,
        owner: "hermes",
      },
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });

  it("returns true for handoff context with flush_pending", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "research",
      handoff_context: { has_flush_pending: true },
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });

  it("returns true for handoff context with local_known + newly_found", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "research",
      handoff_context: {
        has_local_known: true,
        has_newly_found: true,
      },
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });

  it("returns true for research keyword alone (no save)", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "研究 React 19 的新特性",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. shouldAttachKnowledgeContract — false cases
// -----------------------------------------------------------------

describe("shouldAttachKnowledgeContract — false cases", () => {
  it("returns false for ordinary code-only task without knowledge save intent", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "fix the bug in src/foo.ts",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(false);
  });

  it("returns false for refactor task", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "refactor the auth module to use new helper",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(false);
  });

  it("returns false for test addition", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "add unit tests for the new parser",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(false);
  });

  it("returns false for greeting / chitchat", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "hi",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(false);
  });

  it("returns false for empty request", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(false);
  });

  it("returns false for list-directory task", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "list files in src",
    };
    expect(shouldAttachKnowledgeContract(ctx)).toBe(false);
  });
});

// -----------------------------------------------------------------
// 5. assertKnowledgeContractNoRuntime — catches runtime call expressions
// -----------------------------------------------------------------

describe("assertKnowledgeContractNoRuntime", () => {
  it("returns ok=true for the canonical snippet (no call expressions)", () => {
    const snippet = buildKnowledgeAgentContractSnippet("claude_code");
    const result = assertKnowledgeContractNoRuntime(snippet);
    expect(result.ok).toBe(true);
    expect(result.hits.length).toBe(0);
  });

  it("catches knowledgeIngest( as a call expression", () => {
    const tampered = "Some text.\nconst x = knowledgeIngest('hi');\nDone.";
    const result = assertKnowledgeContractNoRuntime(tampered);
    expect(result.ok).toBe(false);
    expect(result.hits.some((h) => h.token === "knowledgeIngest")).toBe(true);
  });

  it("catches knowledgeSearch( as a call expression", () => {
    const tampered = "const r = knowledgeSearch('q', 10);";
    const result = assertKnowledgeContractNoRuntime(tampered);
    expect(result.ok).toBe(false);
    expect(result.hits.some((h) => h.token === "knowledgeSearch")).toBe(true);
  });

  it("catches fetch( as a call expression", () => {
    const tampered = "const r = fetch('https://example.com');";
    const result = assertKnowledgeContractNoRuntime(tampered);
    expect(result.ok).toBe(false);
    expect(result.hits.some((h) => h.token === "fetch(")).toBe(true);
  });

  it("catches runPlaybook( as a call expression", () => {
    const tampered = "runPlaybook('foo');";
    const result = assertKnowledgeContractNoRuntime(tampered);
    expect(result.ok).toBe(false);
    expect(result.hits.some((h) => h.token === "runPlaybook")).toBe(true);
  });

  it("does NOT flag token names in negative clauses (e.g. 'Do not call knowledgeIngest')", () => {
    const text = "Do not call knowledgeIngest. Do not call knowledgeSearch.";
    const result = assertKnowledgeContractNoRuntime(text);
    // The pattern only matches call expressions (token followed by '('),
    // so negative-clause mentions are NOT flagged.
    expect(result.ok).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. assertSnippetShape — defensive guard for canonical snippet
// -----------------------------------------------------------------

describe("assertSnippetShape", () => {
  it("returns ok=true for the canonical snippet", () => {
    const snippet = buildKnowledgeAgentContractSnippet("claude_code");
    const shape = assertSnippetShape(snippet);
    expect(shape.ok).toBe(true);
  });

  it("returns ok=false for a stripped snippet missing rules", () => {
    const shape = assertSnippetShape("minimal");
    expect(shape.ok).toBe(false);
    expect(shape.missing_required.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------
// 7. JSON round-trip for attach context
// -----------------------------------------------------------------

describe("JSON round-trip", () => {
  it("attach context survives JSON.stringify + JSON.parse", () => {
    const ctx: KnowledgeContractAttachContext = {
      request_text: "save to knowledge",
      task_kind: "github_research",
      handoff_context: {
        has_ingest_draft: true,
        has_flush_pending: false,
        has_local_known: true,
        has_newly_found: true,
        owner: "hermes",
      },
    };
    const restored = JSON.parse(JSON.stringify(ctx));
    expect(shouldAttachKnowledgeContract(restored)).toBe(true);
  });

  it("snippet survives JSON.stringify + JSON.parse", () => {
    const snippet = buildKnowledgeAgentContractSnippet("codex");
    const restored = JSON.parse(JSON.stringify(snippet));
    expect(restored).toBe(snippet);
  });
});

// -----------------------------------------------------------------
// 8. doc exists and contains required sections
// -----------------------------------------------------------------

describe("contract landing doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it("contains 10 required sections", () => {
    const required = [
      "## 1. Purpose",
      "## 2. Non-goals",
      "## 3. Trigger conditions",
      "## 4. Contract snippet",
      "## 5. Handoff integration point",
      "## 6. Task prompt insertion point",
      "## 7. Expected Claude Code behavior",
      "## 8. Forbidden Claude Code behavior",
      "## 9. Dry-run only boundary",
      "## 10. Tests / acceptance criteria",
      "## 11. Future implementation slices",
    ];
    for (const sec of required) {
      expect(DOC.includes(sec), `missing section: ${sec}`).toBe(true);
    }
  });

  it("states no runtime / no Claude Code subprocess", () => {
    expect(DOC).toContain("不启动 Claude Code 子进程");
    expect(DOC).toContain("不改 Claude Code runtime binary");
  });

  it("states no handoff builder modification", () => {
    expect(DOC).toContain("不改 `src/main/hcc-handoff-pack.ts`");
  });
});
