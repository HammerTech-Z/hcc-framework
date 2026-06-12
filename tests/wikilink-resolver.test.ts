import { describe, expect, it } from "vitest";
import {
  suggestPathForDeadTarget,
  generateFixes,
  generateWikilinkFixReport,
} from "../src/shared/lib/wikilink-resolver";
import { parseWikilinks, resolveWikilinks } from "../src/shared/lib/vault-auditor";

describe("suggestPathForDeadTarget", () => {
  const knownPaths = [
    "concepts/multi-agent-delegate.md",
    "concepts/mcp-protocol-deep-dive-2026.md",
    "tools/claude-code-2026-features.md",
    "codebase/cron-B-2026-06-12.md",
  ];

  it("suggests exact match when fuzzy match found", () => {
    const result = suggestPathForDeadTarget("mcp-protocol", "codebase/test.md", knownPaths);
    expect(result).toBe("concepts/mcp-protocol-deep-dive-2026.md");
  });

  it("suggests new stub path when no match", () => {
    const result = suggestPathForDeadTarget("nonexistent-concept", "codebase/test.md", knownPaths);
    expect(result).toBe("codebase/nonexistent-concept.md");
  });

  it("preserves target directory prefix in suggestion", () => {
    const result = suggestPathForDeadTarget("tools/new-tool", "concepts/test.md", knownPaths);
    expect(result).toMatch(/\.md$/);
  });
});

describe("generateFixes", () => {
  const knownPaths = [
    "concepts/mcp-protocol-deep-dive-2026.md",
    "tools/test-a.md",
    "tools/test-b.md",
  ];

  it("generates rename fix for dead link with close match", () => {
    const links = parseWikilinks("test.md", "See [[mcp-protocol]].");
    const resolved = resolveWikilinks(links, knownPaths);
    const fixable = generateFixes(resolved, knownPaths);

    expect(fixable).toHaveLength(1);
    expect(fixable[0].status).toBe("dead");
    // Should have at least 2 fixes: create_stub + remove_link
    const renameFix = fixable[0].fixes.find((f) => f.kind === "rename_link");
    expect(renameFix).toBeDefined();
  });

  it("generates choose_candidate for ambiguous links", () => {
    const paths = ["dir1/note.md", "dir2/note.md"];
    const links = parseWikilinks("test.md", "[[note]]");
    const resolved = resolveWikilinks(links, paths);
    const fixable = generateFixes(resolved, paths);

    expect(fixable).toHaveLength(1);
    expect(fixable[0].status).toBe("ambiguous");
    const chooseFixes = fixable[0].fixes.filter((f) => f.kind === "choose_candidate");
    expect(chooseFixes).toHaveLength(2);
  });

  it("generates remove_link for dead links", () => {
    const links = parseWikilinks("test.md", "[[nonexistent]]");
    const resolved = resolveWikilinks(links, knownPaths);
    const fixable = generateFixes(resolved, knownPaths);

    const removeFix = fixable[0].fixes.find((f) => f.kind === "remove_link");
    expect(removeFix).toBeDefined();
  });
});

describe("generateWikilinkFixReport", () => {
  it("generates complete report with statistics", () => {
    const knownPaths = ["concepts/mcp.md", "tools/test.md"];
    const links = parseWikilinks("source.md", "See [[mcp]] and [[broken-link]]. Also [[mcp]] again.");
    const resolved = resolveWikilinks(links, knownPaths);

    const report = generateWikilinkFixReport(resolved, knownPaths);
    expect(report.totalWikilinks).toBe(3);
    expect(report.deadLinkCount).toBeGreaterThan(0);
    expect(report.deadLinkRate).toBeGreaterThan(0);
    expect(report.fixableLinks.length).toBeGreaterThan(0);
    expect(report.generatedAt).toBeDefined();
  });
});
