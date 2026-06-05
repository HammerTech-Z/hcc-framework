import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const providersSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Providers/Providers.tsx"),
  "utf-8",
);
const cssSrc = readFileSync(
  join(ROOT, "src/renderer/src/assets/main.css"),
  "utf-8",
);

describe("Slice 6B-1 Providers preference pane secrets boundary", () => {
  it("preserves password inputs and visibleKeys reveal toggle", () => {
    expect(providersSrc).toContain('type="password"');
    expect(providersSrc).toContain("visibleKeys");
    expect(providersSrc).toContain("toggleVisibility");
    expect(providersSrc).toContain("field.type === \"password\" && !visibleKeys.has(field.key)");
  });

  it("keeps credential pool writes behind explicit button handlers", () => {
    expect(providersSrc).toContain("async function handleAddPoolKey");
    expect(providersSrc).toContain("async function handleRemovePoolKey");
    expect(providersSrc).toContain("onClick={handleAddPoolKey}");
    expect(providersSrc).toContain("onClick={() => handleRemovePoolKey(provider, idx)}");
  });

  it("does not write credential pool or env values from useEffect", () => {
    const effectBodies = [
      ...providersSrc.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \},/g),
    ].map((match) => match[1]).join("\n");

    expect(effectBodies).not.toContain("setCredentialPool");
    expect(effectBodies).not.toContain("setEnv(");
  });

  it("keeps env writes explicit and blur-triggered only", () => {
    expect(providersSrc).toContain("async function handleBlur");
    expect(providersSrc).toContain("await window.hermesAPI.setEnv(key, value, profile)");
    expect(providersSrc).toContain("onBlur={() => handleBlur(field.key)}");
  });

  it("adds only Providers-scoped preference CSS", () => {
    expect(cssSrc).toContain(".providers-pref-header");
    expect(cssSrc).toContain(".providers-pref-layout");
    expect(cssSrc).toContain(".providers-pref-nav");
    expect(cssSrc).toContain(".providers-pref-content");
    expect(cssSrc).not.toContain(".memory-pref");
    expect(cssSrc).not.toContain(".soul-pref");
  });
});
