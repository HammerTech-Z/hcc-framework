import { describe, expect, it } from "vitest";
import {
  inferTypedLinks,
  buildKnowledgeNodes,
  type Provenance,
  type TrustLevel,
} from "../src/shared/lib/typed-links";
import type { KnowledgeNode } from "../src/shared/lib/typed-links";

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

function makeNode(overrides: Partial<KnowledgeNode> = {}): KnowledgeNode {
  const now = Date.now();
  return {
    id: "vault://wiki/test.md",
    kind: "vault_file",
    title: "test",
    content: "test content",
    path: "wiki/test.md",
    // Use a fixed recent timestamp so mtime comparisons are meaningful
    mtime: 1800000000000, // ~2027
    ...overrides,
  };
}

// -----------------------------------------------------------------
// elaborates
// -----------------------------------------------------------------

describe("elaborates", () => {
  it("generates link when source is in sub-path of target", () => {
    // target path = "wiki/ai" (directory-like prefix), child = "wiki/ai/deepseek.md"
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];

    const links = inferTypedLinks(nodes);

    expect(links).toHaveLength(1);
    expect(links[0].relationType).toBe("elaborates");
    expect(links[0].sourceId).toBe("vault://wiki/ai/deepseek.md");
    expect(links[0].targetId).toBe("vault://wiki/ai");
    expect(links[0].confidence).toBe(0.85);
    expect(links[0].evidence).toBeTruthy();
  });

  it("does NOT generate link for sibling files", () => {
    const nodes = [
      makeNode({ id: "vault://wiki/ai.md", title: "ai", path: "wiki/ai.md" }),
      makeNode({ id: "vault://wiki/ml.md", title: "ml", path: "wiki/ml.md" }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.filter((l) => l.relationType === "elaborates")).toHaveLength(0);
  });

  it("does NOT generate self-link", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// supersedes
// -----------------------------------------------------------------

describe("supersedes", () => {
  it("generates link when horizon date is newer than vault mtime", () => {
    // vault is older (year 2000), horizon is newer (2026-05-30)
    const nodes = [
      makeNode({
        id: "vault://wiki/tools/horizon-2026-05-30.md",
        kind: "horizon_summary",
        title: "horizon-2026-05-30",
        path: "wiki/tools/horizon-2026-05-30.md",
        mtime: 1751241600000, // 2026-05-30
      }),
      makeNode({
        id: "vault://wiki/ai.md",
        kind: "vault_file",
        title: "ai",
        path: "wiki/ai.md",
        mtime: 1700000000000, // older real timestamp (~2013)
      }),
    ];

    const links = inferTypedLinks(nodes);

    expect(links).toHaveLength(1);
    expect(links[0].relationType).toBe("supersedes");
    expect(links[0].sourceId).toBe(
      "vault://wiki/tools/horizon-2026-05-30.md"
    );
    expect(links[0].targetId).toBe("vault://wiki/ai.md");
    expect(links[0].confidence).toBe(0.8);
  });

  it("generates link when horizon title overlaps with vault title", () => {
    // vault is newer than horizon (timeBased=false)
    // Use identical base titles so title-based overlap triggers
    const nodes = [
      makeNode({
        id: "vault://wiki/tools/horizon-2026-05-28.md",
        kind: "horizon_summary",
        title: "horizon-2026-05-28",
        path: "wiki/tools/horizon-2026-05-28.md",
        mtime: 1750000000000, // older
      }),
      makeNode({
        id: "vault://wiki/doc-2026-05-28.md",
        kind: "vault_file",
        title: "horizon-2026-05-28",
        content: "vault content here",
        path: "wiki/doc-2026-05-28.md",
        mtime: 1760000000000, // newer (timeBased=false)
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links).toHaveLength(1);
    expect(links[0].relationType).toBe("supersedes");
  });

  it("does NOT generate link when no time or title relationship", () => {
    // horizon-2025-01-01 date < vault mtime=2026-01-01 AND titles don't overlap
    const nodes = [
      makeNode({
        id: "vault://wiki/tools/horizon-2025-01-01.md",
        kind: "horizon_summary",
        title: "horizon-2025-01-01",
        path: "wiki/tools/horizon-2025-01-01.md",
        mtime: 1735689600000, // 2025-01-01
      }),
      makeNode({
        id: "vault://wiki/ai.md",
        kind: "vault_file",
        title: "ai",
        path: "wiki/ai.md",
        mtime: 1767225600000, // 2026-01-01 — newer than horizon filename date
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// depends_on
// -----------------------------------------------------------------

describe("depends_on", () => {
  it("generates link from dependency fixture", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/planning.md",
        title: "planning",
        path: "wiki/planning.md",
      }),
      makeNode({
        id: "vault://wiki/architecture.md",
        title: "architecture",
        path: "wiki/architecture.md",
      }),
    ];

    const links = inferTypedLinks(
      nodes,
      {
        dependencies: [
          {
            source: "vault://wiki/planning.md",
            target: "vault://wiki/architecture.md",
          },
        ],
      }
    );

    expect(links).toHaveLength(1);
    expect(links[0].relationType).toBe("depends_on");
    expect(links[0].confidence).toBe(0.9);
  });

  it("returns empty list when dependency fixture is empty (real data)", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/planning.md",
        title: "planning",
        path: "wiki/planning.md",
      }),
    ];

    const links = inferTypedLinks(nodes, {});
    expect(links).toHaveLength(0);
  });

  it("skips dep where source or target not in nodes", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/planning.md",
        title: "planning",
        path: "wiki/planning.md",
      }),
    ];

    const links = inferTypedLinks(nodes, {
      dependencies: [
        {
          source: "vault://wiki/planning.md",
          target: "vault://wiki/absent.md",
        },
      ],
    });

    expect(links).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// repeats
// -----------------------------------------------------------------

describe("repeats", () => {
  it("does NOT generate repeats when similarityProvider is absent", () => {
    const nodes = [
      makeNode({ id: "vault://a.md", title: "A", path: "a.md" }),
      makeNode({ id: "vault://b.md", title: "B", path: "b.md" }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.filter((l) => l.relationType === "repeats")).toHaveLength(0);
  });

  it("generates repeats when provider returns score > 0.85", () => {
    const nodes = [
      makeNode({
        id: "vault://a.md",
        title: "A",
        path: "a.md",
        content: "content alpha",
      }),
      makeNode({
        id: "vault://b.md",
        title: "B",
        path: "b.md",
        content: "content alpha",
      }),
    ];

    const provider = () => 0.92;
    const links = inferTypedLinks(nodes, {}, provider);

    expect(links).toHaveLength(1);
    expect(links[0].relationType).toBe("repeats");
    expect(links[0].confidence).toBe(0.92);
  });

  it("does NOT generate repeats when provider returns score < 0.85", () => {
    const nodes = [
      makeNode({
        id: "vault://a.md",
        title: "A",
        path: "a.md",
        content: "content a",
      }),
      makeNode({
        id: "vault://b.md",
        title: "B",
        path: "b.md",
        content: "content b",
      }),
    ];

    const provider = () => 0.5;
    const links = inferTypedLinks(nodes, {}, provider);

    expect(links.filter((l) => l.relationType === "repeats")).toHaveLength(0);
  });

  it("generates repeats via exact normalized title+content match fallback", () => {
    const nodes = [
      makeNode({
        id: "vault://a.md",
        title: "Exact Duplicate",
        path: "a.md",
        content: "Same exact content here",
      }),
      makeNode({
        id: "vault://b.md",
        title: "Exact Duplicate",
        path: "b.md",
        content: "Same exact content here",
      }),
    ];

    // No provider — exact match fallback triggers
    const links = inferTypedLinks(nodes);
    expect(links).toHaveLength(1);
    expect(links[0].relationType).toBe("repeats");
    expect(links[0].confidence).toBe(1.0);
  });

  it("does NOT generate repeats via exact match for trivial titles (< 3 chars)", () => {
    const nodes = [
      makeNode({ id: "vault://a.md", title: "ab", path: "a.md", content: "same" }),
      makeNode({ id: "vault://b.md", title: "ab", path: "b.md", content: "same" }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.filter((l) => l.relationType === "repeats")).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// confidence thresholds
// -----------------------------------------------------------------

describe("confidence threshold handling", () => {
  it("confidence values are correctly stored on generated links", () => {
    // elaborates: base confidence 0.85
    const nodesElab = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];
    const linksElab = inferTypedLinks(nodesElab);
    expect(linksElab).toHaveLength(1);
    expect(linksElab[0].confidence).toBe(0.85);

    // depends_on: base confidence 0.9
    const nodesDep = [
      makeNode({
        id: "vault://wiki/planning.md",
        title: "planning",
        path: "wiki/planning.md",
      }),
      makeNode({
        id: "vault://wiki/architecture.md",
        title: "architecture",
        path: "wiki/architecture.md",
      }),
    ];
    const linksDep = inferTypedLinks(nodesDep, {
      dependencies: [
        {
          source: "vault://wiki/planning.md",
          target: "vault://wiki/architecture.md",
        },
      ],
    });
    expect(linksDep).toHaveLength(1);
    expect(linksDep[0].confidence).toBe(0.9);

    // repeats via exact match: confidence 1.0
    const nodesExact = [
      makeNode({
        id: "vault://a.md",
        title: "Exact Duplicate",
        content: "Same content",
        path: "a.md",
      }),
      makeNode({
        id: "vault://b.md",
        title: "Exact Duplicate",
        content: "Same content",
        path: "b.md",
      }),
    ];
    const linksExact = inferTypedLinks(nodesExact);
    expect(linksExact).toHaveLength(1);
    expect(linksExact[0].confidence).toBe(1.0);
  });

  it("at 0.85 threshold, 0.85+ scores pass and below-threshold scores do not", () => {
    const nodes = [
      makeNode({
        id: "vault://a.md",
        title: "A",
        path: "a.md",
        content: "content alpha",
      }),
      makeNode({
        id: "vault://b.md",
        title: "B",
        path: "b.md",
        content: "content alpha",
      }),
    ];

    // At exactly 0.85 (the repeats threshold) the link is generated
    const provider85 = () => 0.85;
    const links85 = inferTypedLinks(nodes, {}, provider85);
    expect(links85).toHaveLength(1);
    expect(links85[0].confidence).toBe(0.85);

    // Below threshold (< 0.85) produces no repeats link
    const provider84 = () => 0.84;
    const links84 = inferTypedLinks(nodes, {}, provider84);
    expect(links84.filter((l) => l.relationType === "repeats")).toHaveLength(0);
  });
});

// -----------------------------------------------------------------
// provenance and trust_level
// -----------------------------------------------------------------

describe("provenance and trust_level", () => {
  it("every generated link has provenance", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.provenance).toBeDefined();
      expect(link.provenance).not.toBeNull();
    }
  });

  it("every generated link has sourceTrustLevel and targetTrustLevel", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.sourceTrustLevel).toBeDefined();
      expect(link.targetTrustLevel).toBeDefined();
    }
  });

  it("vault-sourced links default to semi_trusted_local with safe_to_use_as_instruction=false", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
        mtime: 1800000000000,
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
        mtime: 1700000000000,
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.provenance.trust_level).toBe("semi_trusted_local");
      expect(link.provenance.safe_to_use_as_instruction).toBe(false);
    }
  });

  it("vault provenance has source_type='vault' and source_uri set to node id", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.provenance.source_type).toBe("vault");
      expect(link.provenance.source_uri).toBeTruthy();
    }
  });

  it("vault provenance indexed_at uses node mtime in ISO 8601", () => {
    const mtime = 1800000000000;
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
        mtime,
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.length).toBeGreaterThan(0);
    const link = links[0];
    expect(link.provenance.indexed_at).toBe(new Date(mtime).toISOString());
  });

  it("sourceTrustLevel and targetTrustLevel match provenance trust_level", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai",
        title: "ai",
        path: "wiki/ai",
      }),
    ];

    const links = inferTypedLinks(nodes);
    for (const link of links) {
      expect(link.sourceTrustLevel).toBe(link.provenance.trust_level);
      expect(link.targetTrustLevel).toBe(link.provenance.trust_level);
    }
  });
});

// -----------------------------------------------------------------
// evidence is required
// -----------------------------------------------------------------

describe("evidence is required", () => {
  it("every generated link has non-empty evidence", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai.md",
        title: "ai",
        path: "wiki/ai.md",
      }),
    ];

    const links = inferTypedLinks(nodes);
    expect(links.every((l) => l.evidence.trim().length > 0)).toBe(true);
  });
});

// -----------------------------------------------------------------
// buildKnowledgeNodes
// -----------------------------------------------------------------

describe("buildKnowledgeNodes", () => {
  it("builds vault_file and horizon_summary nodes", () => {
    const vaultFiles = [
      { path: "wiki/ai.md", name: "ai.md", size: 100, mtime: 1000 },
    ];
    const horizonFiles = [
      {
        path: "wiki/tools/horizon-2026-05-28.md",
        name: "horizon-2026-05-28.md",
        size: 50,
        mtime: 2000,
      },
    ];
    const vaultContents = new Map([["wiki/ai.md", "ai content"]]);
    const horizonContents = new Map([
      ["wiki/tools/horizon-2026-05-28.md", "horizon content"],
    ]);

    const nodes = buildKnowledgeNodes(
      vaultFiles,
      horizonFiles,
      vaultContents,
      horizonContents
    );

    expect(nodes).toHaveLength(2);
    const vaultNode = nodes.find((n) => n.kind === "vault_file");
    const horizonNode = nodes.find((n) => n.kind === "horizon_summary");
    expect(vaultNode).toBeDefined();
    expect(vaultNode!.id).toBe("vault://wiki/ai.md");
    expect(horizonNode).toBeDefined();
    expect(horizonNode!.id).toBe("vault://wiki/tools/horizon-2026-05-28.md");
  });
});

// -----------------------------------------------------------------
// determinism and purity
// -----------------------------------------------------------------

describe("determinism", () => {
  it("calling inferTypedLinks twice with same input returns equal results", () => {
    const nodes = [
      makeNode({
        id: "vault://wiki/ai/deepseek.md",
        title: "deepseek",
        path: "wiki/ai/deepseek.md",
      }),
      makeNode({
        id: "vault://wiki/ai.md",
        title: "ai",
        path: "wiki/ai.md",
      }),
    ];

    const first = inferTypedLinks(nodes);
    const second = inferTypedLinks(nodes);

    expect(first).toEqual(second);
  });
});