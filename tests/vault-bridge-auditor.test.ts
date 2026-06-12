import { describe, expect, it } from "vitest";
import {
  parseFrontmatter,
  detectTopicCoverage,
  detectCrossVaultGaps,
  findSharedBasenames,
  countWikilinks,
  generateBridgeReport,
  type BridgeFileEntry,
} from "../src/shared/lib/vault-bridge-auditor";

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function hermesFile(path: string, content: string): BridgeFileEntry {
  return { path, content, sizeBytes: content.length, mtime: Date.now(), vault: "hermes" };
}

function obsidianFile(path: string, content: string): BridgeFileEntry {
  return { path, content, sizeBytes: content.length, mtime: Date.now(), vault: "obsidian" };
}

// -----------------------------------------------------------------
// parseFrontmatter
// -----------------------------------------------------------------

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter with all fields", () => {
    const content = `---
title: Test Document
type: concept
tags: [knowledge, vault, architecture]
related: [tools/openhands, concepts/delegate]
created: 2026-06-01
updated: 2026-06-12
authors: [Alice, Bob]
year: 2026
---

# Test Document

Content here.`;

    const fm = parseFrontmatter(content);
    expect(fm.title).toBe("Test Document");
    expect(fm.type).toBe("concept");
    expect(fm.tags).toEqual(["knowledge", "vault", "architecture"]);
    expect(fm.related).toEqual(["tools/openhands", "concepts/delegate"]);
    expect(fm.created).toBe("2026-06-01");
    expect(fm.updated).toBe("2026-06-12");
    expect(fm.authors).toEqual(["Alice", "Bob"]);
    expect(fm.year).toBe(2026);
  });

  it("returns defaults for missing frontmatter", () => {
    const content = "# Just a heading\n\nNo frontmatter here.";
    const fm = parseFrontmatter(content);
    expect(fm.title).toBeNull();
    expect(fm.tags).toEqual([]);
    expect(fm.type).toBeNull();
    expect(fm.related).toEqual([]);
    expect(fm.authors).toEqual([]);
    expect(fm.year).toBeNull();
  });

  it("parses multi-line array tags", () => {
    const content = `---
title: Multi Tags
tags:
- tag1
- tag2
- tag3
---

# Document`;

    const fm = parseFrontmatter(content);
    expect(fm.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("parses multi-line array related", () => {
    const content = `---
title: Related Test
related:
- concepts/a
- tools/b
- patterns/c
---

# Document`;

    const fm = parseFrontmatter(content);
    expect(fm.related).toEqual(["concepts/a", "tools/b", "patterns/c"]);
  });

  it("handles empty frontmatter block", () => {
    const content = `---
---

# Document`;
    const fm = parseFrontmatter(content);
    expect(fm.title).toBeNull();
    expect(fm.tags).toEqual([]);
  });
});

// -----------------------------------------------------------------
// detectTopicCoverage
// -----------------------------------------------------------------

describe("detectTopicCoverage", () => {
  it("detects topics present in both vaults", () => {
    const hermes = [hermesFile("tools/claude-code.md", "Claude Code is an AI coding assistant by Anthropic.")];
    const obsidian = [obsidianFile("claude-code-notes.md", "Notes about using Claude Code for development.")];

    const topics = detectTopicCoverage(hermes, obsidian);
    const claude = topics.find((t) => t.name === "claude-code");
    expect(claude).toBeDefined();
    expect(claude!.coverage).toBe("both");
    expect(claude!.hermesFiles).toHaveLength(1);
    expect(claude!.obsidianFiles).toHaveLength(1);
  });

  it("detects topics only in Hermes vault", () => {
    const hermes = [hermesFile("codebase/cron-B.md", "MCP protocol deep dive and delegate_task best practices.")];
    const obsidian: BridgeFileEntry[] = [];

    const topics = detectTopicCoverage(hermes, obsidian);
    const mcp = topics.find((t) => t.name === "mcp-protocol");
    expect(mcp).toBeDefined();
    expect(mcp!.coverage).toBe("hermes_only");
  });

  it("detects topics only in Obsidian vault", () => {
    const hermes: BridgeFileEntry[] = [];
    const obsidian = [obsidianFile("design.md", "UI design system with Tailwind CSS and custom components.")];

    const topics = detectTopicCoverage(hermes, obsidian);
    const ui = topics.find((t) => t.name === "ui-design");
    expect(ui).toBeDefined();
    expect(ui!.coverage).toBe("obsidian_only");
  });

  it("detects Chinese keywords", () => {
    const hermes = [hermesFile("creative/ai-comic.md", "AI漫剧制作流程与技术选型分析。")];
    const obsidian: BridgeFileEntry[] = [];

    const topics = detectTopicCoverage(hermes, obsidian);
    const comic = topics.find((t) => t.name === "ai-comic");
    expect(comic).toBeDefined();
    expect(comic!.coverage).toBe("hermes_only");
  });

  it("returns empty array when no topics match", () => {
    const hermes = [hermesFile("misc/empty.md", "Nothing interesting here.")];
    const obsidian = [obsidianFile("misc/also-empty.md", "Also nothing.")];

    const topics = detectTopicCoverage(hermes, obsidian);
    expect(topics).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// detectCrossVaultGaps
// -----------------------------------------------------------------

describe("detectCrossVaultGaps", () => {
  it("flags high severity gap for knowledge-base", () => {
    const topics = [{
      name: "knowledge-base",
      hermesFiles: ["codebase/cron-B.md"],
      obsidianFiles: [],
      coverage: "hermes_only" as const,
    }];

    const gaps = detectCrossVaultGaps(topics);
    expect(gaps).toHaveLength(1);
    expect(gaps[0].topic).toBe("knowledge-base");
    expect(gaps[0].severity).toBe("high");
    expect(gaps[0].presentIn).toBe("hermes");
  });

  it("filters out topics present in both vaults", () => {
    const topics = [{
      name: "claude-code",
      hermesFiles: ["tools/claude-code.md"],
      obsidianFiles: ["claude-code-notes.md"],
      coverage: "both" as const,
    }];

    const gaps = detectCrossVaultGaps(topics);
    expect(gaps).toHaveLength(0);
  });

  it("sorts by severity", () => {
    const topics = [
      { name: "low-topic", hermesFiles: ["a.md"], obsidianFiles: [], coverage: "hermes_only" as const },
      { name: "agent-architecture", hermesFiles: ["b.md"], obsidianFiles: [], coverage: "hermes_only" as const },
    ];

    const gaps = detectCrossVaultGaps(topics);
    expect(gaps[0].severity).toBe("high"); // agent-architecture is high severity
    expect(gaps[0].topic).toBe("agent-architecture");
  });
});

// -----------------------------------------------------------------
// findSharedBasenames
// -----------------------------------------------------------------

describe("findSharedBasenames", () => {
  it("finds shared basenames across vaults", () => {
    const hermes = ["tools/claude-code-2026-features.md", "concepts/mcp.md"];
    const obsidian = ["wiki/tools/claude-code-2026-features.md", "wiki/something-else.md"];

    const shared = findSharedBasenames(hermes, obsidian);
    expect(shared).toContain("claude-code-2026-features");
    expect(shared).toHaveLength(1);
  });

  it("is case insensitive when matching", () => {
    const hermes = ["tools/README.md"];
    const obsidian = ["wiki/readme.md"];
    const shared = findSharedBasenames(hermes, obsidian);
    expect(shared).toContain("readme");
  });

  it("returns empty when no overlap", () => {
    const hermes = ["tools/a.md", "concepts/b.md"];
    const obsidian = ["wiki/c.md", "wiki/d.md"];
    const shared = findSharedBasenames(hermes, obsidian);
    expect(shared).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// countWikilinks
// -----------------------------------------------------------------

describe("countWikilinks", () => {
  it("counts wikilinks across entries", () => {
    const entries: BridgeFileEntry[] = [
      hermesFile("a.md", "See [[b]] and [[c]] for details."),
      hermesFile("b.md", "Related to [[a]] and [[d|Document D]]."),
      obsidianFile("c.md", "No links here."),
    ];

    expect(countWikilinks(entries)).toBe(4);
  });
});

// -----------------------------------------------------------------
// generateBridgeReport
// -----------------------------------------------------------------

describe("generateBridgeReport", () => {
  it("generates a complete bridge report", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    const hermesEntries: BridgeFileEntry[] = [
      hermesFile("tools/claude-code.md", "Claude Code is an AI coding tool by Anthropic. Related to agent architecture."),
      hermesFile("concepts/mcp.md", "MCP protocol enables tool use by LLM agents."),
    ];
    const obsidianEntries: BridgeFileEntry[] = [
      obsidianFile("wiki/ai-comic.md", "AI漫剧制作流程：从剧本到视频的端到端自动化。"),
      obsidianFile("wiki/design-system.md", "UI design system tokens and Tailwind configuration."),
    ];

    const report = generateBridgeReport({
      hermesRoot: "/hermes/vault",
      obsidianRoot: "/obsidian/vault",
      hermesEntries,
      obsidianEntries,
      nowMs: now,
    });

    expect(report.hermesFileCount).toBe(2);
    expect(report.obsidianFileCount).toBe(2);
    expect(report.generatedAt).toBeDefined();

    // Topics: claude-code should be in both (both mention it), ai-comic in obsidian only, etc.
    const claude = report.topics.find((t) => t.name === "claude-code");
    expect(claude).toBeDefined();

    const comic = report.topics.find((t) => t.name === "ai-comic");
    expect(comic).toBeDefined();
    expect(comic!.coverage).toBe("obsidian_only");

    const ui = report.topics.find((t) => t.name === "ui-design");
    expect(ui).toBeDefined();
    expect(ui!.coverage).toBe("obsidian_only");

    // Unique files
    expect(report.uniqueToHermes).toHaveLength(2);
    expect(report.uniqueToObsidian).toHaveLength(2);
  });
});
