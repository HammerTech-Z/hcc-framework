import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildKnowledgeControlItem,
  deriveLifecycle,
  deriveStaleState,
} from "../src/renderer/src/screens/KnowledgeControl/knowledge-control-model";

const ROOT = join(__dirname, "..");
const knowledgeControlSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx"),
  "utf-8",
);
const modelSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/KnowledgeControl/knowledge-control-model.ts"),
  "utf-8",
);
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);
const layoutRoutesSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/layout-routes.tsx"),
  "utf-8",
);

describe("Knowledge Control read-only boundary", () => {
  const allowedReadApis = [
    "listVaultFiles",
    "getVaultStats",
    "getGbrainStats",
    "readVaultFile",
    "knowledgeSearch",
  ];

  const forbiddenApis = [
    "knowledgeIngest",
    "createCronJob",
    "triggerCronJob",
    "runPlaybook",
    "sendMessage",
    "setConfig",
    "setEnv",
    "writeSoul",
    "addMemoryEntry",
    "updateMemoryEntry",
    "removeMemoryEntry",
  ];

  it("only calls approved read APIs from the Knowledge Control screen", () => {
    const calls = [
      ...knowledgeControlSrc.matchAll(/window\.hermesAPI\s*\.\s*([A-Za-z0-9_]+)/g),
    ].map((match) => match[1]);

    expect([...new Set(calls)].sort()).toEqual([...allowedReadApis].sort());
  });

  it("does not call write or runtime APIs", () => {
    for (const api of forbiddenApis) {
      expect(knowledgeControlSrc).not.toContain(`window.hermesAPI.${api}`);
    }
  });

  it("does not add drag-drop affordances or libraries", () => {
    expect(knowledgeControlSrc).not.toMatch(/drag|drop|draggable|onDrag/i);
    expect(knowledgeControlSrc).not.toMatch(/dnd-kit|react-beautiful-dnd|sortable/i);
  });

  it("keeps Knowledge Control separate from the existing Knowledge screen", () => {
    // UI Slice 2: panes driven by LAYOUT_ROUTES. Verify the route table
    // preserves the Knowledge Control vs Knowledge separation.
    expect(layoutSrc).toContain('view: "knowledgeControl"');
    expect(layoutRoutesSrc).toContain('view: "knowledgeControl"');
    expect(layoutRoutesSrc).toContain("<KnowledgeControl />");
    expect(layoutSrc).toContain('view: "knowledge"');
    expect(layoutRoutesSrc).toContain('view: "knowledge"');
    expect(layoutRoutesSrc).toContain("<Knowledge />");
  });

  it("derives lifecycle columns deterministically", () => {
    expect(deriveLifecycle({ trustLevel: "unverified", stale: false })).toBe("inbox");
    expect(deriveLifecycle({ trustLevel: "candidate", stale: false })).toBe("candidate");
    expect(deriveLifecycle({ trustLevel: "verified", stale: false })).toBe("verified");
    expect(
      deriveLifecycle({
        trustLevel: "verified",
        stale: false,
        linkedNotes: ["vault://a.md"],
      }),
    ).toBe("linked");
    expect(deriveLifecycle({ trustLevel: "verified", stale: true })).toBe("stale");
    expect(deriveLifecycle({ trustLevel: "verified", stale: false, archived: true })).toBe("archived");
  });

  it("derives stale state without LLM or write actions", () => {
    const now = new Date("2026-06-05T00:00:00Z").getTime();
    expect(
      deriveStaleState({
        capturedAt: "2026-05-20T00:00:00Z",
        verifiedAt: null,
        sourceType: "web",
        now,
      }),
    ).toBe(true);
    expect(
      deriveStaleState({
        capturedAt: "2026-06-01T00:00:00Z",
        verifiedAt: null,
        sourceType: "web",
        now,
      }),
    ).toBe(false);
  });

  it("builds card policy from frontmatter and content", () => {
    const item = buildKnowledgeControlItem({
      path: "wiki/github/clawpanel.md",
      name: "clawpanel.md",
      dir: "wiki",
      size: 1200,
      mtime: 1780000000,
      content: "Reference [[obsidian-kanban]] for HCC Slice planning. https://example.com",
      frontmatter: {
        title: "ClawPanel UI Notes",
        source_type: "github",
        trust_level: "verified",
        verified_at: "2026-06-04T00:00:00Z",
        allow_prompt_use: "prefer_local",
      },
    });

    expect(item.title).toBe("ClawPanel UI Notes");
    expect(item.sourceType).toBe("github");
    expect(item.trustLevel).toBe("verified");
    expect(item.linkedNotes).toContain("obsidian-kanban");
    expect(item.linkedTasks).toContain("HCC");
    expect(item.allowPromptUse).toBe("prefer_local");
  });

  it("does not hide forbidden terms in the model layer", () => {
    expect(modelSrc).not.toContain("knowledgeIngest");
    expect(modelSrc).not.toContain("fetch(");
  });
});
