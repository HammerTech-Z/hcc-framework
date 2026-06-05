import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);
const cssSrc = readFileSync(
  join(ROOT, "src/renderer/src/assets/main.css"),
  "utf-8",
);

describe("Slice 7 UI polish accessibility and responsive boundary", () => {
  it("adds active navigation semantics without changing the route inventory", () => {
    expect(layoutSrc).toContain('aria-label="Primary navigation"');
    expect(layoutSrc).toContain('aria-current={view === v ? "page" : undefined}');
    expect(layoutSrc).toContain('aria-label={activeLabel}');

    for (const route of [
      '"chat"',
      '"mission"',
      '"knowledgeControl"',
      '"knowledge"',
      '"models"',
      '"providers"',
      '"tools"',
      '"settings"',
    ]) {
      expect(layoutSrc).toContain(`view: ${route}`);
    }
  });

  it("keeps shell keyboard shortcuts renderer-local and state-only", () => {
    expect(layoutSrc).toContain('window.addEventListener("keydown", handleShellShortcut)');
    expect(layoutSrc).toContain('event.metaKey && event.key === "\\\\"');
    expect(layoutSrc).toContain('event.metaKey && event.altKey && key === "i"');
    expect(layoutSrc).toContain("setSidebarCollapsed((value) => !value)");
    expect(layoutSrc).toContain("setInspectorOpen((value) => !value)");

    const shortcutBody = layoutSrc.match(
      /function handleShellShortcut\(event: KeyboardEvent\): void \{([\s\S]*?)\n    \}/,
    )?.[1] ?? "";
    expect(shortcutBody).not.toContain("window.hermesAPI");
    expect(shortcutBody).not.toMatch(/fetch\(|runPlaybook|triggerCronJob|sendMessage/);
  });

  it("marks shell toggle buttons with pressed and expanded state", () => {
    expect(layoutSrc).toContain("aria-pressed={sidebarCollapsed}");
    expect(layoutSrc).toContain('aria-label={inspectorOpen ? "Close inspector" : "Open inspector"}');
    expect(layoutSrc).toContain("aria-expanded={inspectorOpen}");
    expect(layoutSrc).toContain("aria-pressed={inspectorOpen}");
  });

  it("adds focus-visible affordances for shell and preference navigation", () => {
    for (const selector of [
      ".sidebar-nav-item:focus-visible",
      ".sidebar-collapse-btn:focus-visible",
      ".shell-inspector-toggle:focus-visible",
      ".settings-pref-nav-item:focus-visible",
      ".providers-pref-nav-item:focus-visible",
      ".models-pref-nav-item:focus-visible",
      ".tools-pref-nav-item:focus-visible",
      ".skills-pref-nav-item:focus-visible",
      ".memory-pref-nav-item:focus-visible",
      ".soul-pref-nav-item:focus-visible",
    ]) {
      expect(cssSrc).toContain(selector);
    }
  });

  it("keeps preference panes responsive without decorative motion", () => {
    expect(cssSrc).toContain("@media (max-width: 860px)");
    expect(cssSrc).toContain(".settings-pref-layout");
    expect(cssSrc).toContain(".memory-pref-layout");
    expect(cssSrc).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(cssSrc).not.toMatch(/gradient-orb|bokeh|decorative-orb/);
  });
});
