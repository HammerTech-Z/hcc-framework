import { describe, expect, it } from "vitest";
import {
  extractClaims,
  detectPairContradictions,
  runContradictionProbe,
  type ProbeEntry,
  type Contradiction,
} from "../src/shared/lib/contradiction-probe";

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

function entry(path: string, content: string): ProbeEntry {
  return { path, content, mtime: Date.now() };
}

// -----------------------------------------------------------------
// extractClaims
// -----------------------------------------------------------------

describe("extractClaims", () => {
  it("extracts sentences with signal words", () => {
    const claims = extractClaims(
      "The MCP protocol is recommended for tool use. This is a short sentence. You should use delegate_task for agent orchestration.",
    );
    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(claims.some((c) => c.includes("recommended"))).toBe(true);
    expect(claims.some((c) => c.includes("should"))).toBe(true);
  });

  it("filters out short sentences", () => {
    const claims = extractClaims("Short. Another short one. This one is long enough to be a claim sentence here.");
    expect(claims.length).toBe(1);
    expect(claims[0]).toContain("long enough");
  });
});

// -----------------------------------------------------------------
// detectPairContradictions
// -----------------------------------------------------------------

describe("detectPairContradictions", () => {
  it("detects deprecation vs recommendation contradiction", () => {
    const a = entry("a.md", "We recommend using delegate_task for all agent orchestration tasks. It is the standard approach.");
    const b = entry("b.md", "delegate_task is now deprecated and should no longer be used. Use the new task-runner instead.");

    const contradictions = detectPairContradictions(a, b);
    expect(contradictions.length).toBeGreaterThan(0);
    // Should find deprecation_vs_recommendation
    const deprecationHit = contradictions.find(
      (c) => c.evidence.includes("deprecation_vs_recommendation"),
    );
    expect(deprecationHit).toBeDefined();
  });

  it("detects enable vs disable contradiction", () => {
    const a = entry("a.md", "HCC Auto Executor is NOT APPROVED and remains disabled. Productionization is frozen.");
    const b = entry("b.md", "HCC Auto Executor has been authorized and is now enabled for production use.");

    const contradictions = detectPairContradictions(a, b);
    const enableHit = contradictions.find(
      (c) => c.evidence.includes("enable_vs_disable"),
    );
    expect(enableHit).toBeDefined();
    expect(enableHit!.severity).toBe("definite");
  });

  it("returns empty for compatible articles", () => {
    const a = entry("a.md", "The knowledge base system uses markdown files for storage. It supports wikilinks for cross-referencing.");
    const b = entry("b.md", "Markdown files are an excellent format for knowledge bases. Wikilinks enable easy navigation between pages.");

    const contradictions = detectPairContradictions(a, b);
    expect(contradictions).toHaveLength(0);
  });

  it("skips very short content", () => {
    const a = entry("a.md", "Short.");
    const b = entry("b.md", "Also short.");
    const contradictions = detectPairContradictions(a, b);
    expect(contradictions).toHaveLength(0);
  });

  it("detects pass vs fail contradiction", () => {
    const a = entry("a.md", "All tests passed successfully. The build is verified and working correctly.");
    const b = entry("b.md", "The tests failed completely. The build is broken with error.");

    const contradictions = detectPairContradictions(a, b);
    const passHit = contradictions.find((c) => c.evidence.includes("pass_vs_fail"));
    expect(passHit).toBeDefined();
  });
});

// -----------------------------------------------------------------
// runContradictionProbe
// -----------------------------------------------------------------

describe("runContradictionProbe", () => {
  it("runs a full probe on multiple entries", () => {
    const entries: ProbeEntry[] = [
      entry("tools/a.md", "We recommend using delegate_task for agent orchestration. It is the standard and best practice approach."),
      entry("tools/b.md", "delegate_task is deprecated and should be removed. It no longer works with the latest API."),
      entry("tools/c.md", "Unrelated content about markdown formatting and wikilink syntax in vault files."),
    ];

    const result = runContradictionProbe(entries, 0.1, 50);
    expect(result.candidates).toBe(3);
    expect(result.checkedPairs.length).toBeGreaterThan(0);
  });

  it("handles empty input", () => {
    const result = runContradictionProbe([], 0.3, 100);
    expect(result.contradictions).toHaveLength(0);
    expect(result.checkedPairs).toHaveLength(0);
  });

  it("respects maxPairs limit", () => {
    const entries: ProbeEntry[] = Array.from({ length: 10 }, (_, i) =>
      entry(`file${i}.md`, `Content for file number ${i}. Some additional words to reach minimum length for claim extraction here.`),
    );

    const result = runContradictionProbe(entries, 0.0, 5);
    expect(result.checkedPairs.length).toBeLessThanOrEqual(5);
  });
});
