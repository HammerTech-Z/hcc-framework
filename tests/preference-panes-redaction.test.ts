import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const settingsSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Settings/Settings.tsx"),
  "utf-8",
);
const cssSrc = readFileSync(
  join(ROOT, "src/renderer/src/assets/main.css"),
  "utf-8",
);

describe("Slice 6A Settings preference pane boundary", () => {
  it("keeps the remote API key input redacted", () => {
    expect(settingsSrc).toContain('type="password"');
    expect(settingsSrc).toContain("connApiKey");
  });

  it("adds the preference-pane shell without replacing existing sections", () => {
    expect(settingsSrc).toContain("settings-pref-layout");
    expect(settingsSrc).toContain("settings-pref-nav");
    expect(settingsSrc).toContain('id="settings-agent"');
    expect(settingsSrc).toContain('id="settings-connection"');
    expect(settingsSrc).toContain('id="settings-mcp"');
    expect(settingsSrc).toContain('id="settings-appearance"');
    expect(settingsSrc).toContain('id="settings-network"');
    expect(settingsSrc).toContain('id="settings-data"');
    expect(settingsSrc).toContain('id="settings-logs"');
  });

  it("keeps external actions behind explicit handlers", () => {
    const externalHandlers = [
      "handleMigrate",
      "handleBackup",
      "handleImport",
      "handleDoctor",
      "handleUpdateHermes",
    ];

    for (const handler of externalHandlers) {
      expect(settingsSrc).toContain(`function ${handler}`);
      expect(settingsSrc).toMatch(new RegExp(`onClick=\\{${handler}\\}`));
    }
  });

  it("does not add startup-only calls for external actions", () => {
    const effects = [...settingsSrc.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \},/g)].map(
      (match) => match[1],
    );
    const effectBody = effects.join("\n");

    for (const forbidden of [
      "runHermesBackup",
      "runHermesImport",
      "runHermesDoctor",
      "runHermesUpdate",
      "runHermesDump",
      "runClawMigrate",
    ]) {
      expect(effectBody).not.toContain(forbidden);
    }
  });

  it("preserves write operations as user-triggered settings behavior only", () => {
    expect(settingsSrc).toContain("onBlur={handleSaveConnection}");
    expect(settingsSrc).toContain("onBlur={async () =>");
    expect(settingsSrc).toContain("await window.hermesAPI.setConfig(");
    expect(settingsSrc).not.toContain("setInterval(");
  });

  it("uses scoped Settings preference CSS selectors", () => {
    expect(cssSrc).toContain(".settings-pref-header");
    expect(cssSrc).toContain(".settings-pref-layout");
    expect(cssSrc).toContain(".settings-pref-nav");
    expect(cssSrc).toContain(".settings-pref-content");
    expect(cssSrc).not.toContain(".models-pref");
  });
});
