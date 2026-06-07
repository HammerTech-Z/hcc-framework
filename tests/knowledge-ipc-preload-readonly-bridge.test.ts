// Knowledge IPC Migration Slice 8A preload read-only bridge tests.
// Verifies that knowledgeSearch and getGbrainStats are switched to the
// IPC bridge while knowledgeIngest is still raw fetch. Locks the
// partial-migration state so a future slice can apply the ingest
// bridge switch explicitly.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const preloadSrc = readFileSync(
  join(ROOT, "src/preload/index.ts"),
  "utf-8",
);
const preloadDts = readFileSync(
  join(ROOT, "src/preload/index.d.ts"),
  "utf-8",
);

// Helper: extract the body of a single named method from the preload
// hermesAPI object literal. Returns the substring from the property
// name up to the next top-level entry boundary. We approximate
// "top-level" as: next `\n  ` line-start (a sibling property in the
// outer object literal). The preload source uses 2-space indentation
// inside `hermesAPI = { ... }`, so this heuristic is reliable for the
// knowledge method group.
function extractMethodBody(source: string, name: string): string {
  const idx = source.search(new RegExp(`\\b${name}\\s*:`));
  if (idx === -1) return "";
  // Walk forward to a sibling-property marker: `\n  <word>:` at the
  // same outer-object indentation level. The outer object is at
  // zero indent; sibling properties start at 2-space indent.
  const rest = source.slice(idx);
  // Match the next sibling property start, anchored to `\n  wordName:`
  // (or closing brace `}` at the same indent).
  const siblingMatch = rest.match(/\n  [a-zA-Z_][a-zA-Z0-9_]*\s*:/);
  const endIdx = siblingMatch ? idx + siblingMatch.index! : source.length;
  return source.slice(idx, endIdx);
}

describe("Knowledge IPC Migration Slice 8A preload read-only bridge", () => {
  it("knowledgeSearch uses ipcRenderer.invoke('knowledge-search', ...)", () => {
    const body = extractMethodBody(preloadSrc, "knowledgeSearch");
    expect(body).toContain('ipcRenderer.invoke("knowledge-search"');
    expect(body).toContain("{ query, limit }");
  });

  it("getGbrainStats uses ipcRenderer.invoke('knowledge-stats', ...)", () => {
    const body = extractMethodBody(preloadSrc, "getGbrainStats");
    expect(body).toContain('ipcRenderer.invoke("knowledge-stats"');
    expect(body).toContain("{}");
  });

  it("knowledgeIngest now uses ipcRenderer.invoke('knowledge-ingest', ...)", () => {
    // Slice 8B completes the preload bridge switch. knowledgeIngest
    // is no longer raw fetch.
    const body = extractMethodBody(preloadSrc, "knowledgeIngest");
    expect(body).toContain('ipcRenderer.invoke("knowledge-ingest"');
    expect(body).toContain("{ title, content }");
  });

  it("preload no longer contains a raw fetch for /knowledge/search", () => {
    expect(preloadSrc.includes("http://127.0.0.1:8643/knowledge/search")).toBe(
      false,
    );
    expect(preloadSrc.includes("/knowledge/search?q=")).toBe(false);
  });

  it("preload no longer contains a raw fetch for /knowledge/stats", () => {
    expect(preloadSrc.includes("http://127.0.0.1:8643/knowledge/stats")).toBe(
      false,
    );
  });

  it("preload no longer contains a raw fetch for /knowledge/ingest", () => {
    expect(preloadSrc.includes("http://127.0.0.1:8643/knowledge/ingest")).toBe(
      false,
    );
  });

  it("preload contains no knowledge gateway raw fetch URLs at all", () => {
    // Slice 8B completes the bridge switch; the preload surface
    // should not contain any /knowledge raw URL.
    const matches = preloadSrc.match(
      /http:\/\/127\.0\.0\.1:8643\/knowledge\//g,
    );
    expect(matches).toBeNull();
  });

  it("preload exposes the same three method names to the renderer", () => {
    expect(preloadSrc).toMatch(/knowledgeSearch\s*:/);
    expect(preloadSrc).toMatch(/knowledgeIngest\s*:/);
    expect(preloadSrc).toMatch(/getGbrainStats\s*:/);
  });

  it("preload .d.ts declares the same three method names with compatible shapes", () => {
    expect(preloadDts).toMatch(/knowledgeSearch\s*:/);
    expect(preloadDts).toMatch(/knowledgeIngest\s*:/);
    expect(preloadDts).toMatch(/getGbrainStats\s*:/);
  });

  it("preload .d.ts knowledgeSearch signature unchanged (query + limit)", () => {
    const body = extractMethodBody(preloadDts, "knowledgeSearch");
    expect(body).toContain("query: string");
    expect(body).toContain("limit?: number");
  });

  it("preload .d.ts knowledgeIngest signature unchanged (title + content)", () => {
    const body = extractMethodBody(preloadDts, "knowledgeIngest");
    expect(body).toContain("title: string");
    expect(body).toContain("content: string");
  });

  it("preload .d.ts getGbrainStats signature unchanged (no args)", () => {
    const body = extractMethodBody(preloadDts, "getGbrainStats");
    expect(body).toMatch(/getGbrainStats\s*:\s*\(\s*\)\s*=>/);
  });

  it("Slice 8A does not modify the main startup wiring or renderer", () => {
    expect(preloadSrc.includes("ipcMain.handle")).toBe(false);
  });
});
