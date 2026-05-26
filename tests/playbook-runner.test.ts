import { describe, it, expect } from "vitest";
import {
  suggestPlaybookHeuristic,
  recommendPlaybookLlm,
} from "../src/main/playbook-runner";

describe("suggestPlaybookHeuristic", () => {
  it("returns code_dev with reasoning when code keywords are present", () => {
    const result = suggestPlaybookHeuristic("I need to write a TypeScript function for class User");
    expect(result.playbook).toBe("code_dev");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reasoning).toContain("code_dev_keyword_match");
    expect(result.reasoning).toContain("code_dev");
    expect(result.matchedKeywords).toBeDefined();
    expect(result.matchedKeywords!.length).toBeGreaterThan(0);
  });

  it("returns manga_industrial with reasoning when manga keywords are present", () => {
    const result = suggestPlaybookHeuristic("This manga animation needs new sprites");
    expect(result.playbook).toBe("manga_industrial");
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.reasoning).toContain("manga_keyword_match");
    expect(result.reasoning).toContain("manga_industrial");
    expect(result.matchedKeywords).toContain("manga");
    expect(result.matchedKeywords).toContain("animation");
  });

  it("returns confidence = 1 when all 6 code_dev keywords match", () => {
    const result = suggestPlaybookHeuristic(
      "code function class typescript javascript react",
    );
    expect(result.playbook).toBe("code_dev");
    expect(result.confidence).toBe(1);
  });

  it("returns partial confidence when only some keywords match", () => {
    const result = suggestPlaybookHeuristic("react and typescript");
    expect(result.playbook).toBe("code_dev");
    expect(result.confidence).toBe(2 / 6); // 2 out of 6 keywords
    expect(result.matchedKeywords).toEqual(["typescript", "react"]);
  });

  it("returns null and confidence=0 when no keywords match", () => {
    const result = suggestPlaybookHeuristic(
      "this is just some random text about cooking",
    );
    expect(result.playbook).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toBe("无匹配规则");
  });

  it("matches case-insensitively", () => {
    const result = suggestPlaybookHeuristic("TypeScript Code React");
    expect(result.playbook).toBe("code_dev");
    expect(result.confidence).toBe(3 / 6);
  });
});

describe("recommendPlaybookLlm", () => {
  it("returns fallback when Ollama is unavailable", async () => {
    // execSync('ollama run ...') will throw in test environment
    const result = await recommendPlaybookLlm("test content");
    expect(result.playbook).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain("LLM");
  }, 20000); // needs 15s+ for execSync timeout
});
