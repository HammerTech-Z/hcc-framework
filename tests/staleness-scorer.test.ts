import { describe, expect, it } from "vitest";
import {
  classifyStaleness,
  runStalenessAudit,
  createHalfLifeProfile,
  DEFAULT_THRESHOLDS,
  CATEGORY_HALF_LIFE,
} from "../src/shared/lib/staleness-scorer";

describe("classifyStaleness", () => {
  it("classifies fresh files", () => {
    expect(classifyStaleness(0.05)).toBe("fresh");
  });

  it("classifies aging files", () => {
    expect(classifyStaleness(0.25)).toBe("aging");
  });

  it("classifies stale files", () => {
    expect(classifyStaleness(0.5)).toBe("stale");
  });

  it("classifies critical files", () => {
    expect(classifyStaleness(0.7)).toBe("critical");
  });

  it("classifies archive files", () => {
    expect(classifyStaleness(0.9)).toBe("archive");
  });

  it("respects custom thresholds", () => {
    const custom = { stale: 0.3, critical: 0.5, archive: 0.8 };
    expect(classifyStaleness(0.4, custom)).toBe("stale");
  });
});

describe("runStalenessAudit", () => {
  it("runs a complete audit on multiple files", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    const files = [
      { path: "tools/fresh.md", mtime: new Date("2026-06-12T00:00:00Z").getTime() },
      { path: "codebase/old.md", mtime: new Date("2026-05-01T00:00:00Z").getTime() },
      { path: "concepts/ancient.md", mtime: new Date("2025-06-12T00:00:00Z").getTime() },
    ];

    const audit = runStalenessAudit(files, DEFAULT_THRESHOLDS, now);
    expect(audit.scored).toHaveLength(3);
    expect(audit.summary.total).toBe(3);

    // fresh.md should be fresh
    const fresh = audit.scored.find((s) => s.file === "tools/fresh.md");
    expect(fresh!.level).toBe("fresh");

    // old.md (42 days) should be stale/critical for codebase (14d half-life)
    const old = audit.scored.find((s) => s.file === "codebase/old.md");
    expect(old!.score).toBeGreaterThan(0.7);

    // ancient.md (365 days) should be archive
    const ancient = audit.scored.find((s) => s.file === "concepts/ancient.md");
    expect(ancient!.level).toBe("archive");

    // Most stale first
    expect(audit.scored[0].score).toBeGreaterThanOrEqual(audit.scored[1].score);
  });

  it("reports stalest category", () => {
    const now = new Date("2026-06-12T12:00:00Z").getTime();
    const files = [
      { path: "codebase/old1.md", mtime: new Date("2026-05-01T00:00:00Z").getTime() },
      { path: "codebase/old2.md", mtime: new Date("2026-05-01T00:00:00Z").getTime() },
      { path: "concepts/fresh-concept.md", mtime: new Date("2026-06-12T00:00:00Z").getTime() },
    ];

    const audit = runStalenessAudit(files, DEFAULT_THRESHOLDS, now);
    // codebase files should be stalest category (42d old, 14d half-life)
    expect(audit.summary.stalestCategory).toBe("codebase");
  });
});

describe("createHalfLifeProfile", () => {
  it("creates a custom profile with overrides", () => {
    const profile = createHalfLifeProfile({ codebase: 7, tools: 15 });
    expect(profile.codebase).toBe(7);
    expect(profile.tools).toBe(15);
    // Unchanged defaults
    expect(profile.concepts).toBe(CATEGORY_HALF_LIFE.concepts);
  });
});
