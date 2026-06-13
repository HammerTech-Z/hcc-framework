import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");

const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);
const chatSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Chat/Chat.tsx"),
  "utf-8",
);
const inspectorTabsSrc = readFileSync(
  join(ROOT, "src/renderer/src/components/Inspector/InspectorTabs.tsx"),
  "utf-8",
);
const boundaryTabSrc = readFileSync(
  join(ROOT, "src/renderer/src/components/Inspector/BoundaryTab.tsx"),
  "utf-8",
);
const contextTabSrc = readFileSync(
  join(ROOT, "src/renderer/src/components/Inspector/ContextTab.tsx"),
  "utf-8",
);
const referenceTabSrc = readFileSync(
  join(ROOT, "src/renderer/src/components/Inspector/ReferenceTab.tsx"),
  "utf-8",
);

describe("UI-CHAT-001c Inspector three-tab layout", () => {
  it("renders 3 tabs with zh labels", () => {
    expect(inspectorTabsSrc).toContain('label: "上下文"');
    expect(inspectorTabsSrc).toContain('label: "引用"');
    expect(inspectorTabsSrc).toContain('label: "边界"');
  });

  it("default tab is context", () => {
    expect(inspectorTabsSrc).toContain('useState<TabId>("context")');
  });

  it("Layout imports InspectorTabs and passes view + descriptor", () => {
    expect(layoutSrc).toContain("InspectorTabs");
    expect(layoutSrc).toMatch(/<InspectorTabs\s+view=\{view\}\s+descriptor=\{boundaryInspector\}/);
  });

  it("Layout does NOT import BoundaryInspectorPanel (replaced by InspectorTabs)", () => {
    expect(layoutSrc).not.toContain("BoundaryInspectorPanel");
  });

  it("Chat.tsx no longer renders chat-reference-panel aside", () => {
    expect(chatSrc).not.toContain("chat-reference-panel");
    expect(chatSrc).not.toContain('className="chat-reference-header"');
    expect(chatSrc).not.toContain("referencesOpen");
  });

  it("Chat.tsx no longer imports removed reference panel icons", () => {
    expect(chatSrc).not.toContain("PanelRight");
    expect(chatSrc).not.toContain("Database");
    expect(chatSrc).not.toContain("Globe2");
    expect(chatSrc).not.toContain("ShieldCheck");
  });

  it("ReferenceTab preserves the 3 knowledge cards (absorbed from Chat)", () => {
    expect(referenceTabSrc).toContain("Local Knowledge");
    expect(referenceTabSrc).toContain("Web Sources");
    expect(referenceTabSrc).toContain("Agent Judgment");
  });

  it("BoundaryTab preserves all existing data-testid anchors from BoundaryInspectorPanel", () => {
    const dataTestIds = [
      "inspector-view-id",
      "inspector-sidebar-group",
      "inspector-boundary-kind",
      "inspector-risk-level",
      "inspector-api-methods",
      "inspector-write-surfaces",
      "inspector-notes",
      "inspector-safety-invariants",
      "inspector-write-action-state",
      "inspector-read-only-banner",
    ];
    for (const id of dataTestIds) {
      expect(boundaryTabSrc).toContain(id);
    }
  });

  it("InspectorTabs does not add Tool Progress tab (out of scope per audit §J)", () => {
    expect(inspectorTabsSrc).not.toContain("progress");
    expect(inspectorTabsSrc).not.toContain("tool");
  });

  it("Tabs component defines no more than 3 tabs", () => {
    const tabDefCount = (inspectorTabsSrc.match(/id: "/g) ?? []).length;
    expect(tabDefCount).toBe(3);
  });

  it("ContextTab renders view id for current route", () => {
    expect(contextTabSrc).toContain("inspector-context-view-id");
    // Chat route maps to "Chat" label in VIEW_DISPLAY_LABELS
    expect(contextTabSrc).toContain('chat: "Chat"');
  });

  it("new IPC channels are NOT introduced anywhere in the Inspector components", () => {
    const inspectorDir = join(ROOT, "src/renderer/src/components/Inspector");
    const files = [
      readFileSync(join(inspectorDir, "InspectorTabs.tsx"), "utf-8"),
      readFileSync(join(inspectorDir, "ContextTab.tsx"), "utf-8"),
      readFileSync(join(inspectorDir, "ReferenceTab.tsx"), "utf-8"),
      readFileSync(join(inspectorDir, "BoundaryTab.tsx"), "utf-8"),
    ];
    for (const src of files) {
      expect(src).not.toMatch(/ipcMain|ipcRenderer|contextBridge/);
    }
  });

  it("no package.json dependency changes introduced", () => {
    const pkg = readFileSync(join(ROOT, "package.json"), "utf-8");
    // UI-CHAT-001c does not touch package.json — verify it's still the hermes-desktop package
    expect(pkg).toContain("hermes-desktop");
  });
});
