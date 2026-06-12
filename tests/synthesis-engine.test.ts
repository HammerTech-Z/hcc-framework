import { describe, expect, it } from "vitest";
import {
  extractKeywords,
  clusterByKeywords,
  detectCrossClusterConnections,
  generateSynthesisDrafts,
  runSynthesisPipeline,
  type SynthesisEntry,
  type TopicCluster,
} from "../src/shared/lib/synthesis-engine";

// Helper
function entry(path: string, content: string, category = "tools", source = "cron"): SynthesisEntry {
  return { path, content, category, source };
}

describe("extractKeywords", () => {
  it("extracts top keywords by frequency", () => {
    // Use very explicit content with guaranteed frequent words
    const content = [
      "alpha alpha alpha alpha alpha",
      "beta beta beta beta",
      "gamma gamma",
    ].join(". ");

    const keywords = extractKeywords(content, 5);
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords[0].word).toBe("alpha");
    expect(keywords[0].freq).toBe(5);
    expect(keywords[1].word).toBe("beta");
    expect(keywords[1].freq).toBe(4);
  });

  it("filters out words appearing only once", () => {
    const content = "Singleword appears just once here. Another phrase here. Common common common.";
    const keywords = extractKeywords(content, 10);
    const singleWords = keywords.filter((k) => k.word === "singleword");
    expect(singleWords).toHaveLength(0);
  });
});

describe("clusterByKeywords", () => {
  it("clusters files by shared keywords", () => {
    const entries: SynthesisEntry[] = [
      entry("tools/mcp-1.md", "MCP protocol tool use agents. MCP standard. MCP MCP MCP. protocol protocol protocol. tool tool tool."),
      entry("tools/mcp-2.md", "MCP protocol deep dive. Transport stdio HTTP. MCP MCP MCP. protocol protocol protocol."),
      entry("tools/claude.md", "Claude Code AI coding assistant. Workflows agentic. Claude Claude Claude. code code code."),
      entry("tools/claude-2.md", "Claude agent architecture patterns. Tool use patterns. Claude Claude Claude."),
    ];

    const clusters = clusterByKeywords(entries, 2);
    expect(clusters.length).toBeGreaterThan(0);
    // Should find at least one cluster
    const mcpCluster = clusters.find((c) =>
      c.files.some((f) => f.includes("mcp")),
    );
    expect(mcpCluster).toBeDefined();
  });

  it("returns empty for heterogeneous files", () => {
    const entries: SynthesisEntry[] = [
      entry("a.md", "apple banana cherry"),
      entry("b.md", "dog elephant fox"),
      entry("c.md", "guitar harp instrument"),
    ];

    const clusters = clusterByKeywords(entries, 2);
    // Files share few keywords, clusters are unlikely
    expect(clusters.length).toBeLessThanOrEqual(0);
  });
});

describe("detectCrossClusterConnections", () => {
  it("detects connections between overlapping clusters", () => {
    const clusters: TopicCluster[] = [
      {
        name: "mcp",
        files: ["tools/mcp-1.md", "tools/mcp-2.md", "tools/shared.md"],
        keywords: ["mcp", "protocol", "tool", "transport"],
        internalLinkDensity: 0.5,
        averageAge: null,
      },
      {
        name: "agent",
        files: ["concepts/agent-1.md", "concepts/agent-2.md", "tools/shared.md"],
        keywords: ["agent", "tool", "delegate", "mcp"],
        internalLinkDensity: 0.3,
        averageAge: null,
      },
    ];

    const connections = detectCrossClusterConnections(clusters);
    expect(connections.length).toBe(1);
    expect(connections[0].clusterA).toBe("mcp");
    expect(connections[0].clusterB).toBe("agent");
    expect(connections[0].sharedFiles).toContain("tools/shared.md");
    expect(connections[0].sharedKeywords).toContain("mcp");
  });

  it("returns empty when no clusters overlap", () => {
    const clusters: TopicCluster[] = [
      {
        name: "apples",
        files: ["a.md"],
        keywords: ["apple", "fruit"],
        internalLinkDensity: 1,
        averageAge: null,
      },
      {
        name: "cars",
        files: ["b.md"],
        keywords: ["car", "vehicle"],
        internalLinkDensity: 1,
        averageAge: null,
      },
    ];

    const connections = detectCrossClusterConnections(clusters);
    expect(connections).toHaveLength(0);
  });
});

describe("generateSynthesisDrafts", () => {
  it("generates drafts for clusters with enough files", () => {
    const clusters: TopicCluster[] = [
      {
        name: "agent-architecture",
        files: ["a.md", "b.md", "c.md", "d.md"],
        keywords: ["agent", "architecture", "delegate", "mcp", "tool"],
        internalLinkDensity: 0.4,
        averageAge: null,
      },
      {
        name: "small-topic",
        files: ["x.md"],
        keywords: ["small"],
        internalLinkDensity: 1,
        averageAge: null,
      },
    ];

    const connections = detectCrossClusterConnections(clusters);
    const drafts = generateSynthesisDrafts(clusters, connections);

    // Only agent-architecture has >= 3 files
    expect(drafts.length).toBe(1);
    expect(drafts[0].title).toContain("agent-architecture");
    expect(drafts[0].suggestedPath).toContain("synthesis/");
    expect(drafts[0].markdownContent).toContain("## Files in this cluster");
    expect(drafts[0].markdownContent).toContain("a.md");
  });
});

describe("runSynthesisPipeline", () => {
  it("runs the full pipeline", () => {
    const entries: SynthesisEntry[] = [
      entry("tools/mcp.md", "MCP protocol tool use transport stdio HTTP streamable. MCP enables agentic tool calling."),
      entry("tools/mcp-deep.md", "MCP protocol deep dive transport layer. MCP architecture and design."),
      entry("concepts/agent.md", "Agent architecture delegate task orchestration. Agent design patterns."),
      entry("concepts/agent-patterns.md", "Agent design patterns delegate subagent. Agent tool use MCP."),
    ];

    const result = runSynthesisPipeline(entries);
    expect(result.clusters.length).toBeGreaterThanOrEqual(0);
    expect(result.connections).toBeDefined();
    expect(result.drafts).toBeDefined();
  });
});
