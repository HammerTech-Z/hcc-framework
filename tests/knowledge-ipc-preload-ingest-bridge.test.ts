// Knowledge IPC Migration Slice 8B preload ingest bridge tests.
// Verifies that knowledgeIngest is switched to the IPC bridge and that
// no knowledge raw fetch remains in the preload surface. This is the
// final partial-bridge step; the renderer-visible method names and
// shapes are unchanged.

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

function extractMethodBody(source: string, name: string): string {
  const idx = source.search(new RegExp(`\\b${name}\\s*:`));
  if (idx === -1) return "";
  const rest = source.slice(idx);
  const siblingMatch = rest.match(/\n  [a-zA-Z_][a-zA-Z0-9_]*\s*:/);
  const endIdx = siblingMatch ? idx + siblingMatch.index! : source.length;
  return source.slice(idx, endIdx);
}

describe("Knowledge IPC Migration Slice 8B preload ingest bridge", () => {
  it("knowledgeIngest uses ipcRenderer.invoke('knowledge-ingest', { title, content })", () => {
    const body = extractMethodBody(preloadSrc, "knowledgeIngest");
    expect(body).toContain('ipcRenderer.invoke("knowledge-ingest"');
    expect(body).toContain("{ title, content }");
  });

  it("preload no longer contains any /knowledge/<verb> raw fetch URL", () => {
    // Slice 8B is the final bridge step. The preload should have no
    // direct gateway URLs for any knowledge endpoint.
    expect(preloadSrc.includes("http://127.0.0.1:8643/knowledge")).toBe(false);
  });

  it("preload no longer contains a raw fetch call for /knowledge/ingest", () => {
    expect(preloadSrc).not.toMatch(
      /fetch\(\s*["'`][^"'`]*knowledge\/ingest/,
    );
  });

  it("preload no longer contains a raw fetch call for /knowledge/search", () => {
    expect(preloadSrc).not.toMatch(
      /fetch\(\s*["'`][^"'`]*knowledge\/search/,
    );
  });

  it("preload no longer contains a raw fetch call for /knowledge/stats", () => {
    expect(preloadSrc).not.toMatch(
      /fetch\(\s*["'`][^"'`]*knowledge\/stats/,
    );
  });

  it("preload exposes the same three method names to the renderer", () => {
    expect(preloadSrc).toMatch(/knowledgeSearch\s*:/);
    expect(preloadSrc).toMatch(/knowledgeIngest\s*:/);
    expect(preloadSrc).toMatch(/getGbrainStats\s*:/);
  });

  it("preload .d.ts declares the same three method names", () => {
    expect(preloadDts).toMatch(/knowledgeSearch\s*:/);
    expect(preloadDts).toMatch(/knowledgeIngest\s*:/);
    expect(preloadDts).toMatch(/getGbrainStats\s*:/);
  });

  it("preload .d.ts knowledgeIngest signature unchanged (title + content)", () => {
    const body = extractMethodBody(preloadDts, "knowledgeIngest");
    expect(body).toContain("title: string");
    expect(body).toContain("content: string");
  });

  it("preload .d.ts response shape for knowledgeIngest unchanged", () => {
    const body = extractMethodBody(preloadDts, "knowledgeIngest");
    expect(body).toContain("status: string");
    expect(body).toContain("path?: string");
    expect(body).toContain("message?: string");
  });

  it("preload does not import or auto-start the gateway", () => {
    // Slice 8B is a renderer-side bridge switch. It must not
    // introduce any startGateway, writeFile, or setEnv primitive.
    for (const pattern of [
      "startGateway(",
      "setEnv(",
      "setModelConfig(",
      "writeFile",
      "appendFile",
    ]) {
      expect(preloadSrc.includes(pattern)).toBe(false);
    }
  });
});
