import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const memorySrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Memory/Memory.tsx"),
  "utf-8",
);
const soulSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Soul/Soul.tsx"),
  "utf-8",
);

describe("Slice 6B-2 Memory + Soul preference-pane boundary", () => {
  it("keeps the memory provider env input redacted as type=password", () => {
    expect(memorySrc).toContain('type="password"');
  });

  it("keeps the delete-entry confirmation flow (setConfirmDelete -> handleDeleteEntry)", () => {
    expect(memorySrc).toContain("setConfirmDelete");
    expect(memorySrc).toContain("handleDeleteEntry");
    expect(memorySrc).toMatch(/onClick=\{\(\) => setConfirmDelete\(entry\.index\)\}/);
  });

  it("does not auto-fire writeUserProfile from any useEffect", () => {
    const effects = [...memorySrc.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \},/g)].map(
      (m) => m[1],
    );
    for (const body of effects) {
      expect(body).not.toMatch(/writeUserProfile|setEnv|setConfig|addMemoryEntry|updateMemoryEntry|removeMemoryEntry/);
    }
    expect(memorySrc).toMatch(/async function handleSaveUserProfile/);
    expect(memorySrc).toMatch(/onClick=\{handleSaveUserProfile\}/);
  });

  it("keeps the Soul reset confirmation flow (setShowReset -> handleReset)", () => {
    expect(soulSrc).toContain("setShowReset");
    expect(soulSrc).toContain("async function handleReset");
    expect(soulSrc).toMatch(/onClick=\{\(\) => setShowReset\(true\)\}/);
    expect(soulSrc).toMatch(/onClick=\{handleReset\}/);
  });

  it("Soul writeSoul is invoked in both explicit save and auto-save, guarded by loaded.current", () => {
    expect(soulSrc).toContain("loaded.current");
    expect(soulSrc).toContain("saveSoul(content)");
    expect(soulSrc).toContain("await window.hermesAPI.writeSoul(text, profile)");
    const effects = [...soulSrc.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \},/g)].map(
      (m) => m[1],
    );
    const autoSave = effects.find((b) => b.includes("saveSoul(content)"));
    expect(autoSave).toBeDefined();
    expect(autoSave).toMatch(/if \(!loaded\.current\) return/);
  });

  it("does not introduce a new write useEffect in Memory or Soul beyond the pre-existing ones", () => {
    const memoryEffects = (memorySrc.match(/useEffect\(/g) || []).length;
    const soulEffects = (soulSrc.match(/useEffect\(/g) || []).length;
    expect(memoryEffects).toBe(1);
    expect(soulEffects).toBe(2);
  });
});
