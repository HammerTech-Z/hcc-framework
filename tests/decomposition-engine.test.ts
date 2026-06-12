import { describe, expect, it } from "vitest";
import {
  extractHeadingStructure,
  slugifyHeading,
  analyzeDecomposition,
  runDecompositionAnalysis,
  DEFAULT_DECOMPOSITION_THRESHOLDS,
} from "../src/shared/lib/decomposition-engine";

describe("extractHeadingStructure", () => {
  it("extracts H1 and H2 headings", () => {
    const content = `# Main Title

Some intro text.

## Section One

Content for section one.

## Section Two

Content for section two.

### Sub section

Deeper content.`;

    const sections = extractHeadingStructure(content);
    expect(sections).toHaveLength(1); // One H1
    expect(sections[0].heading).toBe("Main Title");
    expect(sections[0].subHeadings).toHaveLength(2); // Two H2s under H1
    expect(sections[0].subHeadings[0].heading).toBe("Section One");
    expect(sections[0].subHeadings[1].heading).toBe("Section Two");
  });

  it("handles content with no headings", () => {
    const sections = extractHeadingStructure("Just plain text without any headings.");
    expect(sections).toHaveLength(0);
  });

  it("records line numbers", () => {
    const content = `# Title

## First Section

Content here.

## Second Section

More content.`;

    const sections = extractHeadingStructure(content);
    expect(sections[0].lineStart).toBe(0);
    expect(sections[0].subHeadings[0].lineStart).toBe(2);
  });

  it("extracts Chinese headings", () => {
    const content = `# 主标题

## 第一节

内容。

## 第二节

更多内容。`;

    const sections = extractHeadingStructure(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe("主标题");
    expect(sections[0].subHeadings[0].heading).toBe("第一节");
  });
});

describe("slugifyHeading", () => {
  it("converts English heading to slug", () => {
    expect(slugifyHeading("Agent Architecture Overview")).toBe("agent-architecture-overview");
  });

  it("preserves Chinese characters", () => {
    expect(slugifyHeading("知识库 架构 设计")).toBe("知识库-架构-设计");
  });

  it("removes special characters and collapses multiple dashes", () => {
    expect(slugifyHeading("MCP: Protocol & Tool Use")).toBe("mcp-protocol-tool-use");
  });

  it("truncates long headings", () => {
    const long = "A".repeat(100);
    expect(slugifyHeading(long).length).toBeLessThanOrEqual(80);
  });
});

describe("analyzeDecomposition", () => {
  it("returns null for small files", () => {
    const result = analyzeDecomposition("test.md", "# Small\n\nJust a small file.");
    expect(result).toBeNull();
  });

  it("detects oversized files with many H2 sections", () => {
    // Build a file with 500+ lines and 3+ H2 sections
    let content = "# Big File\n\n";
    for (let i = 1; i <= 5; i++) {
      content += `## Section ${i}\n\n`;
      content += "Content line.\n".repeat(30);
    }
    // Add more lines to exceed the threshold
    content += "Extra line.\n".repeat(400);

    const result = analyzeDecomposition("big-file.md", content, {
      maxLines: 200,
      maxSizeBytes: 100 * 1024,
      minHeadings: 3,
    });
    expect(result).not.toBeNull();
    expect(result!.currentLines).toBeGreaterThan(200);
    expect(result!.subPages.length).toBeGreaterThanOrEqual(3);
    expect(result!.reason).toContain("lines");
  });

  it("respects custom thresholds", () => {
    let content = "# Small\n\n";
    for (let i = 1; i <= 3; i++) {
      content += `## Section ${i}\n\n`;
      content += "Content line.\n".repeat(25);
    }

    // Low threshold triggers decomposition
    const result = analyzeDecomposition("small.md", content, {
      maxLines: 10,
      maxSizeBytes: 100,
      minHeadings: 2,
    });
    expect(result).not.toBeNull();
  });
});

describe("runDecompositionAnalysis", () => {
  it("analyzes multiple files", () => {
    let bigContent = "# Big\n\n";
    for (let i = 1; i <= 4; i++) {
      bigContent += `## Section ${i}\n\n`;
      bigContent += "Line.\n".repeat(30);
    }
    bigContent += "Extra.\n".repeat(400);

    const files = [
      { path: "small.md", content: "# Small\n\nJust a tiny file." },
      { path: "big.md", content: bigContent },
    ];

    const result = runDecompositionAnalysis(files, {
      maxLines: 200,
      maxSizeBytes: 100 * 1024,
      minHeadings: 3,
    });

    expect(result.analyzed).toBe(2);
    expect(result.oversized.length).toBe(1);
    expect(result.oversized[0].sourceFile).toBe("big.md");
  });
});
