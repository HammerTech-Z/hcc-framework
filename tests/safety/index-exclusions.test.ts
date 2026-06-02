/**
 * P2.5 Index Exclusion Tests
 *
 * Covers:
 * - Path fragment exclusions (/过时计划/, /docs/archive/)
 * - File name pattern exclusions (*.before-*)
 * - Marker-based exclusion explanation
 * - Normal files NOT excluded
 * - fnmatch edge cases
 */

import { describe, it, expect } from "vitest";
import {
  shouldExcludeFromIndex,
  explainIndexExclusion,
  EXCLUDED_PATH_FRAGMENTS,
  EXCLUDED_FILE_NAME_PATTERNS,
  EXCLUDED_DIR_MARKERS,
} from "../../src/shared/config/index-exclusions";

describe("P2.5 Index Exclusions", () => {
  describe("EXCLUDED_PATH_FRAGMENTS", () => {
    it("contains /过时计划/", () => {
      expect(EXCLUDED_PATH_FRAGMENTS).toContain("/过时计划/");
    });
    it("contains /docs/archive/", () => {
      expect(EXCLUDED_PATH_FRAGMENTS).toContain("/docs/archive/");
    });
    it("contains system dirs (.obsidian, .trash)", () => {
      expect(EXCLUDED_PATH_FRAGMENTS).toContain("/.obsidian/");
      expect(EXCLUDED_PATH_FRAGMENTS).toContain("/.trash/");
    });
  });

  describe("EXCLUDED_FILE_NAME_PATTERNS", () => {
    it("contains *.before-*", () => {
      expect(EXCLUDED_FILE_NAME_PATTERNS).toContain("*.before-*");
    });
  });

  describe("EXCLUDED_DIR_MARKERS", () => {
    it("contains .noindex, .ignore, HERMES-ARCHIVE-LOCK.md", () => {
      expect(EXCLUDED_DIR_MARKERS).toContain(".noindex");
      expect(EXCLUDED_DIR_MARKERS).toContain(".ignore");
      expect(EXCLUDED_DIR_MARKERS).toContain("HERMES-ARCHIVE-LOCK.md");
    });
  });

  // -------------------------------------------------------------------------
  // Path fragment exclusions
  // -------------------------------------------------------------------------
  describe("shouldExcludeFromIndex — path fragments", () => {
    it("excludes files under /过时计划/", () => {
      expect(
        shouldExcludeFromIndex(
          "/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/2026-05-28.md",
        ),
      ).toBe(true);
    });

    it("excludes files under /docs/archive/", () => {
      expect(
        shouldExcludeFromIndex("/Users/midoudou/hermes-pro/docs/archive/old-plan.md"),
      ).toBe(true);
    });

    it("excludes .obsidian internal files", () => {
      expect(
        shouldExcludeFromIndex(
          "/Users/midoudou/Desktop/知识/.obsidian/app.json",
        ),
      ).toBe(true);
    });

    it("excludes .trash files", () => {
      expect(
        shouldExcludeFromIndex("/Users/midoudou/Desktop/知识/.trash/deleted.md"),
      ).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // File name pattern exclusions
  // -------------------------------------------------------------------------
  describe("shouldExcludeFromIndex — filename patterns", () => {
    it("excludes *.before-* files", () => {
      expect(shouldExcludeFromIndex("/path/plan.2026-05-01.before-2026-05-28.md")).toBe(
        true,
      );
      expect(shouldExcludeFromIndex("/path/old.backup.before-2026-05-31.md")).toBe(true);
      expect(shouldExcludeFromIndex("/path/notes.2026.before-yesterday.md")).toBe(true);
    });

    it("excludes *.tmp files", () => {
      expect(shouldExcludeFromIndex("/path/document.tmp")).toBe(true);
    });

    it("excludes .DS_Store", () => {
      expect(shouldExcludeFromIndex("/path/.DS_Store")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Normal files NOT excluded
  // -------------------------------------------------------------------------
  describe("shouldExcludeFromIndex — normal files pass through", () => {
    it("allows normal .md files", () => {
      expect(shouldExcludeFromIndex("/Users/midoudou/Desktop/知识/我的笔记.md")).toBe(
        false,
      );
      expect(
        shouldExcludeFromIndex(
          "/Users/midoudou/hermes-pro/src/shared/config/index-exclusions.ts",
        ),
      ).toBe(false);
    });

    it("allows files in normal subdirectories", () => {
      expect(
        shouldExcludeFromIndex("/Users/midoudou/Desktop/知识/Hermes 代码任务/current-task.md"),
      ).toBe(false);
    });

    it("allows files in docs/ subdirectories (not archive/)", () => {
      expect(
        shouldExcludeFromIndex("/Users/midoudou/hermes-pro/docs/security/p2-5-safety-foundation-2026-05-30.md"),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe("shouldExcludeFromIndex — edge cases", () => {
    it("rejects empty or non-string path", () => {
      expect(shouldExcludeFromIndex("")).toBe(true);
      expect(shouldExcludeFromIndex(null as unknown as string)).toBe(true);
      expect(shouldExcludeFromIndex(undefined as unknown as string)).toBe(true);
    });

    it("fnmatch: * matches any actual exclusion pattern (universal wildcard)", () => {
      // The pattern '*' in EXCLUDED_FILE_NAME_PATTERNS is the universal '*'
      // It matches filenames that match any defined pattern — not arbitrary strings
      // Verify *.tmp matches document.tmp
      expect(shouldExcludeFromIndex("/path/document.tmp")).toBe(true);
      // Verify *.before-* matches old.backup.before-2026-05-31.md
      expect(shouldExcludeFromIndex("/path/old.backup.before-2026-05-31.md")).toBe(true);
    });

    it("fnmatch: exact match when no asterisk", () => {
      expect(
        shouldExcludeFromIndex("/path/notes.2026.before-yesterday.md"),
      ).toBe(true);
      // A file whose name is literally "*.before-*" would also be excluded
      expect(shouldExcludeFromIndex("/path/*.before-*")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // explainIndexExclusion
  // -------------------------------------------------------------------------
  describe("explainIndexExclusion", () => {
    it("returns explanation for /过时计划/", () => {
      const result = explainIndexExclusion(
        "/Users/midoudou/Desktop/知识/Hermes 代码任务/过时计划/2026-05-28.md",
      );
      expect(result).toContain("/过时计划/");
      expect(result).toContain("P2.5 §12");
    });

    it("returns explanation for *.before-*", () => {
      const result = explainIndexExclusion("/path/old.backup.before-2026-05-31.md");
      expect(result).toContain("*.before-*");
      expect(result).toContain("P2.5 §12");
    });

    it("returns null for normal files", () => {
      expect(
        explainIndexExclusion("/Users/midoudou/Desktop/知识/我的笔记.md"),
      ).toBeNull();
    });

    it("returns error string for invalid path", () => {
      expect(explainIndexExclusion("")).toContain("Invalid path");
      expect(explainIndexExclusion(null as unknown as string)).toContain(
        "Invalid path",
      );
    });
  });
});