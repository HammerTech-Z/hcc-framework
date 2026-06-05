import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const modelsSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Models/Models.tsx"),
  "utf-8",
);
const toolsSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Tools/Tools.tsx"),
  "utf-8",
);
const skillsSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Skills/Skills.tsx"),
  "utf-8",
);
const cssSrc = readFileSync(
  join(ROOT, "src/renderer/src/assets/main.css"),
  "utf-8",
);

function effectBodies(src: string): string[] {
  return [...src.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \},/g)].map(
    (match) => match[1],
  );
}

describe("Slice 6C Models + Tools + Skills preference-pane boundary", () => {
  it("keeps Models secret entry redacted and reveal-gated", () => {
    expect(modelsSrc).toContain('type={showApiKey ? "text" : "password"}');
    expect(modelsSrc).toContain("setShowApiKey(!showApiKey)");
    expect(modelsSrc).toContain("formProvider === \"custom\"");
  });

  it("keeps Models writes and delete confirmation behind explicit handlers", () => {
    expect(modelsSrc).toContain("async function handleSave");
    expect(modelsSrc).toContain("async function handleDelete");
    expect(modelsSrc).toContain("onClick={handleSave}");
    expect(modelsSrc).toContain("setConfirmDelete(m.id)");
    expect(modelsSrc).toContain("onClick={() => handleDelete(m.id)}");

    const effects = effectBodies(modelsSrc).join("\n");
    expect(effects).not.toMatch(/addModel|updateModel|removeModel|setEnv/);
  });

  it("keeps Tools toggle writes user-triggered and outside useEffect", () => {
    expect(toolsSrc).toContain("async function handleToggle");
    expect(toolsSrc).toContain("setToolsetEnabled(key, !currentEnabled, profile)");
    expect(toolsSrc).toContain("onClick={() => handleToggle(t.key, t.enabled)}");
    expect(toolsSrc).toContain("onChange={() => handleToggle(t.key, t.enabled)}");

    const effects = effectBodies(toolsSrc).join("\n");
    expect(effects).not.toContain("setToolsetEnabled");
  });

  it("keeps Skills install and uninstall writes explicit", () => {
    expect(skillsSrc).toContain("async function handleInstall");
    expect(skillsSrc).toContain("async function handleUninstall");
    expect(skillsSrc).toContain("installSkill(name, profile)");
    expect(skillsSrc).toContain("uninstallSkill(name, profile)");
    expect(skillsSrc).toContain("onClick={() => handleUninstall(detailSkill.name)}");
    expect(skillsSrc).toContain("handleInstall(skill.name)");

    const effects = effectBodies(skillsSrc).join("\n");
    expect(effects).not.toMatch(/installSkill|uninstallSkill/);
  });

  it("adds scoped preference-pane shells for all 6C screens", () => {
    for (const selector of [
      ".models-pref-header",
      ".models-pref-layout",
      ".models-pref-nav",
      ".models-pref-content",
      ".tools-pref-header",
      ".tools-pref-layout",
      ".tools-pref-nav",
      ".tools-pref-content",
      ".skills-pref-header",
      ".skills-pref-layout",
      ".skills-pref-nav",
      ".skills-pref-content",
    ]) {
      expect(cssSrc).toContain(selector);
    }
  });
});
