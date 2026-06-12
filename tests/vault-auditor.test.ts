import { describe, expect, it } from "vitest";
import {
  parseWikilinks,
  resolveWikilinks,
  computeStaleness,
  classifyPath,
  tokenizeContent,
  jaccardSimilarity,
  detectOverlaps,
  detectDeadDirectories,
  findOrphanFiles,
  generateHealthReport,
  type VaultFileEntry,
} from "../src/shared/lib/vault-auditor";

// -----------------------------------------------------------------
// parseWikilinks
// -----------------------------------------------------------------

describe("parseWikilinks", () => {
  it("extracts simple wikilinks", () => {
    const links = parseWikilinks("test.md", "See [[tools/openhands]] for details.");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("tools/openhands");
    expect(links[0].alias).toBeNull();
    expect(links[0].sourceFile).toBe("test.md");
    expect(links[0].line).toBe(1);
  });

  it("extracts wikilinks with aliases", () => {
    const links = parseWikilinks("test.md", "See [[tools/openhands|OpenHands]] for details.");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("tools/openhands");
    expect(links[0].alias).toBe("OpenHands");
  });

  it("extracts multiple wikilinks from same file", () => {
    const content = `Line 1: [[concepts/delegate]]
Line 2: [[tools/claude-code|Claude Code]]
Line 3: [[patterns/pitfall]]`;
    const links = parseWikilinks("multi.md", content);
    expect(links).toHaveLength(3);
    expect(links[0].target).toBe("concepts/delegate");
    expect(links[0].line).toBe(1);
    expect(links[1].target).toBe("tools/claude-code");
    expect(links[1].alias).toBe("Claude Code");
    expect(links[1].line).toBe(2);
    expect(links[2].target).toBe("patterns/pitfall");
    expect(links[2].line).toBe(3);
  });

  it("returns empty array when no wikilinks present", () => {
    const links = parseWikilinks("empty.md", "Just plain text, no links here.");
    expect(links).toHaveLength(0);
  });

  it("handles inline wikilinks with surrounding text", () => {
    const links = parseWikilinks("inline.md", "The [[concept]] is important for [[other]] reasons.");
    expect(links).toHaveLength(2);
    expect(links[0].target).toBe("concept");
    expect(links[1].target).toBe("other");
  });

  it("handles special characters in targets", () => {
    const links = parseWikilinks("special.md", "See [[tools/cron-A-2026-06-12-00]] for details.");
    expect(links).toHaveLength(1);
    expect(links[0].target).toBe("tools/cron-A-2026-06-12-00");
  });
});

// -----------------------------------------------------------------
// resolveWikilinks
// -----------------------------------------------------------------

describe("resolveWikilinks", () => {
  const knownPaths = [
    "tools/openhands-2026-06-12.md",
    "tools/cron-A-2026-06-12-00.md",
    "concepts/multi-agent-delegate.md",
    "concepts/mcp-protocol-deep-dive-2026.md",
    "codebase/cron-B-2026-06-12.md",
    "index.md",
    "README.md",
  ];

  it("resolves exact path match", () => {
    const links = parseWikilinks("test.md", "[[tools/openhands-2026-06-12]]");
    const resolved = resolveWikilinks(links, knownPaths);
    expect(resolved[0].status).toBe("resolved");
    expect(resolved[0].resolvedPath).toBe("tools/openhands-2026-06-12.md");
  });

  it("resolves by unique basename", () => {
    const links = parseWikilinks("test.md", "[[multi-agent-delegate]]");
    const resolved = resolveWikilinks(links, knownPaths);
    expect(resolved[0].status).toBe("resolved");
    expect(resolved[0].resolvedPath).toBe("concepts/multi-agent-delegate.md");
  });

  it("marks external links", () => {
    const links = parseWikilinks("test.md", "[[https://example.com]]");
    const resolved = resolveWikilinks(links, knownPaths);
    expect(resolved[0].status).toBe("external");
  });

  it("marks dead links", () => {
    const links = parseWikilinks("test.md", "[[nonexistent-file]]");
    const resolved = resolveWikilinks(links, knownPaths);
    expect(resolved[0].status).toBe("dead");
  });

  it("marks ambiguous basename", () => {
    const links = parseWikilinks("test.md", "[[README]]");
    // README.md and index.md both in root — but only README matches basename
    // Let's make truly ambiguous: two files with same basename in different dirs
    const ambiguousPaths = [
      "dir1/note.md",
      "dir2/note.md",
    ];
    const raw = parseWikilinks("test.md", "[[note]]");
    const resolved = resolveWikilinks(raw, ambiguousPaths);
    expect(resolved[0].status).toBe("ambiguous");
    expect(resolved[0].candidates).toHaveLength(2);
  });

  it("resolves link with .md extension in target", () => {
    const links = parseWikilinks("test.md", "[[tools/openhands-2026-06-12.md]]");
    const resolved = resolveWikilinks(links, knownPaths);
    expect(resolved[0].status).toBe("resolved");
    expect(resolved[0].resolvedPath).toBe("tools/openhands-2026-06-12.md");
  });
});

// -----------------------------------------------------------------
// classifyPath
// -----------------------------------------------------------------

describe("classifyPath", () => {
  it("classifies tools files", () => {
    expect(classifyPath("tools/openhands.md")).toBe("tools");
  });

  it("classifies codebase files", () => {
    expect(classifyPath("codebase/cron-B-2026-06-12.md")).toBe("codebase");
  });

  it("classifies concepts files", () => {
    expect(classifyPath("concepts/multi-agent-delegate.md")).toBe("concepts");
  });

  it("defaults to other for unknown paths", () => {
    expect(classifyPath("misc/random.md")).toBe("other");
  });

  it("handles nested paths", () => {
    expect(classifyPath("wiki/tools/horizon-2026-06-03.md")).toBe("tools");
  });
});

// -----------------------------------------------------------------
// computeStaleness
// -----------------------------------------------------------------

describe("computeStaleness", () => {
  it("scores fresh file as near zero", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    const mtime = new Date("2026-06-12T00:00:00Z").getTime();
    const result = computeStaleness("tools/test.md", mtime, now);
    expect(result.category).toBe("tools");
    expect(result.score).toBeLessThan(0.1);
    expect(result.halfLifeDays).toBe(30);
  });

  it("scores file at half-life as 0.5", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    // 30 days ago = half-life for tools
    const mtime = new Date("2026-05-13T12:00:00Z").getTime();
    const result = computeStaleness("tools/old.md", mtime, now);
    expect(result.score).toBeCloseTo(0.5, 1);
  });

  it("scores very old file as near 1", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    // 200 days ago
    const mtime = new Date("2025-11-24T12:00:00Z").getTime();
    const result = computeStaleness("tools/ancient.md", mtime, now);
    expect(result.score).toBeGreaterThan(0.95);
  });

  it("codebase files decay faster than concepts", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    const mtime = new Date("2026-05-29T12:00:00Z").getTime(); // 14 days ago

    const codebaseResult = computeStaleness("codebase/cron-B.md", mtime, now);
    const conceptResult = computeStaleness("concepts/delegate.md", mtime, now);

    // Codebase half-life is 14 days, concepts half-life is 60 days
    expect(codebaseResult.score).toBeGreaterThan(conceptResult.score);
  });
});

// -----------------------------------------------------------------
// tokenizeContent
// -----------------------------------------------------------------

describe("tokenizeContent", () => {
  it("tokenizes markdown text", () => {
    const tokens = tokenizeContent("The quick brown fox jumps over the lazy dog");
    expect(tokens.has("quick")).toBe(true);
    expect(tokens.has("brown")).toBe(true);
    expect(tokens.has("fox")).toBe(true);
    // Stop words removed
    expect(tokens.has("the")).toBe(false);
    expect(tokens.has("over")).toBe(false);
  });

  it("strips code blocks", () => {
    const content = "Important concept here ```\ncode block content\n``` and more text";
    const tokens = tokenizeContent(content);
    expect(tokens.has("important")).toBe(true);
    expect(tokens.has("concept")).toBe(true);
    // Code block content is stripped
    expect(tokens.has("block")).toBe(false);
  });

  it("strips markdown syntax", () => {
    const content = "## Heading\n**bold text** with [link](url) and [[wikilink]]";
    const tokens = tokenizeContent(content);
    expect(tokens.has("heading")).toBe(true);
    expect(tokens.has("bold")).toBe(true);
    expect(tokens.has("link")).toBe(true);
    expect(tokens.has("wikilink")).toBe(true);
  });

  it("removes numbers and single characters", () => {
    const tokens = tokenizeContent("a 1 12 abc def ghi");
    // "a" is 1 char, removed. "12" is 2 chars, removed. "abc" etc kept.
    expect(tokens.has("abc")).toBe(true);
    expect(tokens.has("def")).toBe(true);
    expect(tokens.has("ghi")).toBe(true);
  });
});

// -----------------------------------------------------------------
// jaccardSimilarity
// -----------------------------------------------------------------

describe("jaccardSimilarity", () => {
  it("returns 1 for identical sets", () => {
    const a = new Set(["apple", "banana", "cherry"]);
    const b = new Set(["apple", "banana", "cherry"]);
    expect(jaccardSimilarity(a, b)).toBe(1);
  });

  it("returns 0 for disjoint sets", () => {
    const a = new Set(["apple", "banana"]);
    const b = new Set(["cherry", "date"]);
    expect(jaccardSimilarity(a, b)).toBe(0);
  });

  it("returns correct partial overlap", () => {
    const a = new Set(["apple", "banana", "cherry"]);
    const b = new Set(["banana", "cherry", "date"]);
    // Intersection: banana, cherry (2), Union: apple, banana, cherry, date (4)
    expect(jaccardSimilarity(a, b)).toBe(0.5);
  });

  it("returns 1 for both empty sets", () => {
    expect(jaccardSimilarity(new Set(), new Set())).toBe(1);
  });
});

// -----------------------------------------------------------------
// detectOverlaps
// -----------------------------------------------------------------

describe("detectOverlaps", () => {
  it("detects near-duplicate files", () => {
    const shared = "The hermes pro knowledge base system architecture design pattern";
    const entries: VaultFileEntry[] = [
      { path: "a.md", content: shared + " unique content for file a here extra words make it different", sizeBytes: 100, mtime: Date.now() },
      { path: "b.md", content: shared + " unique content for file b here extra words make it different", sizeBytes: 100, mtime: Date.now() },
    ];
    const overlaps = detectOverlaps(entries, 0.6);
    expect(overlaps.length).toBe(1);
    expect(overlaps[0].fileA).toBe("a.md");
    expect(overlaps[0].fileB).toBe("b.md");
    expect(overlaps[0].similarity).toBeGreaterThan(0.6);
  });

  it("returns empty for completely different files", () => {
    const entries: VaultFileEntry[] = [
      { path: "a.md", content: "apple banana cherry date elderberry fig grape", sizeBytes: 100, mtime: Date.now() },
      { path: "b.md", content: "zebra yak xray whale victor uniform tiger", sizeBytes: 100, mtime: Date.now() },
    ];
    const overlaps = detectOverlaps(entries, 0.5);
    expect(overlaps).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// detectDeadDirectories
// -----------------------------------------------------------------

describe("detectDeadDirectories", () => {
  it("flags directories with few files", () => {
    const claims = [
      { path: "tools", description: "Tool knowledge" },
      { path: "concepts", description: "Concepts" },
    ];
    const actualCounts = new Map([
      ["tools", 15],
      ["concepts", 1],
    ]);
    const dead = detectDeadDirectories(claims, actualCounts, 3);
    expect(dead).toHaveLength(1);
    expect(dead[0].path).toBe("concepts");
    expect(dead[0].actualFileCount).toBe(1);
  });
});

// -----------------------------------------------------------------
// findOrphanFiles
// -----------------------------------------------------------------

describe("findOrphanFiles", () => {
  it("finds files with no inbound links", () => {
    const links = parseWikilinks("a.md", "[[b]] [[c]]");
    const knownPaths = ["a.md", "b.md", "c.md", "orphan.md"];
    const resolved = resolveWikilinks(links, knownPaths);
    const orphans = findOrphanFiles(resolved, knownPaths);
    expect(orphans).toContain("a.md"); // source file, no one links to it
    expect(orphans).toContain("orphan.md"); // no one links to it
    // b and c are targets
    expect(orphans).not.toContain("b.md");
    expect(orphans).not.toContain("c.md");
  });
});

// -----------------------------------------------------------------
// generateHealthReport
// -----------------------------------------------------------------

describe("generateHealthReport", () => {
  it("generates a complete health report", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    const entries: VaultFileEntry[] = [
      {
        path: "tools/test-tool.md",
        content: "## Test Tool\n\nA tool for testing. See [[concepts/test-concept]] and [[nonexistent]].\n\nAlso see [[https://example.com]].",
        sizeBytes: 150,
        mtime: new Date("2026-06-10T00:00:00Z").getTime(),
      },
      {
        path: "concepts/test-concept.md",
        content: "## Test Concept\n\nA concept about testing.",
        sizeBytes: 80,
        mtime: new Date("2026-06-01T00:00:00Z").getTime(),
      },
    ];
    const indexClaims = [
      { path: "tools", description: "Tool knowledge" },
      { path: "concepts", description: "Concepts" },
      { path: "dead-dir", description: "Empty directory" },
    ];
    const knownPaths = [
      "tools/test-tool.md",
      "concepts/test-concept.md",
    ];

    const report = generateHealthReport({
      vaultRoot: "/test/vault",
      entries,
      indexClaims,
      knownPaths,
      nowMs: now,
    });

    expect(report.totalFiles).toBe(2);
    expect(report.totalWikilinks).toBe(3);
    expect(report.deadLinks).toHaveLength(1); // [[nonexistent]]
    expect(report.deadLinks[0].target).toBe("nonexistent");
    expect(report.deadLinkRate).toBe(0.5); // 1 dead out of 2 resolvable (excluding external)
    expect(report.ambiguousLinks).toHaveLength(0);

    // Staleness: test-tool is 2 days old, test-concept is 11 days old
    const toolScore = report.stalenessScores.find((s) => s.file === "tools/test-tool.md");
    const conceptScore = report.stalenessScores.find((s) => s.file === "concepts/test-concept.md");
    expect(toolScore).toBeDefined();
    expect(conceptScore).toBeDefined();
    expect(toolScore!.score).toBeLessThan(conceptScore!.score);

    // Dead directories: tools and concepts each have 1 file (<3 min), dead-dir has 0
    expect(report.deadDirectories).toHaveLength(3);
    const deadPaths = report.deadDirectories.map((d) => d.path);
    expect(deadPaths).toContain("dead-dir");
    expect(deadPaths).toContain("tools");
    expect(deadPaths).toContain("concepts");

    // Isolated: test-concept has no outbound links
    expect(report.isolatedFiles).toContain("concepts/test-concept.md");

    // Timeline
    expect(report.generatedAt).toBeDefined();
  });
});
