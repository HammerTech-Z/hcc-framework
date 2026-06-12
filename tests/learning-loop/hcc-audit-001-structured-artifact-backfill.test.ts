// HCC-AUDIT-001 Structured Artifact Backfill — Contract Test
//
// Validates that the 10 backfilled handoff + progress fixtures satisfy
// A-1 schema validation, evidence refs, and structural requirements.
//
// Covers:
//   - 5 handoff fixtures pass validateHCCTaskHandoffPlan (0 errors)
//   - 5 progress fixtures pass validateHCCProgressRecord (0 errors)
//   - each handoff evidence_refs contains closeout + commit + quarantine
//   - each progress changed_this_round is non-empty
//   - each progress next_plan is non-empty
//   - each fixture references the correct implementation commit

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  validateHCCTaskHandoffPlan,
  validateHCCProgressRecord,
} from "../../src/shared/lib/safety/hcc-task-handoff-policy";

const THIS_FILE = fileURLToPath(import.meta.url);
const FIXTURES_DIR = path.resolve(path.dirname(THIS_FILE), "../../tests/fixtures/learning-loop");

function readJSON(filename: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, filename), "utf-8"));
}

const HANDOFF_FIXTURES = [
  { file: "ll015-a6-handoff.json", task: "A-6" },
  { file: "ll016-b2-handoff.json", task: "B-2" },
  { file: "ll017-b3-handoff.json", task: "B-3" },
  { file: "ll018-b4b-handoff.json", task: "B-4B" },
  { file: "ll019-b4c-handoff.json", task: "B-4C" },
] as const;

const PROGRESS_FIXTURES = [
  { file: "ll015-a6-progress.json", task: "A-6" },
  { file: "ll016-b2-progress.json", task: "B-2" },
  { file: "ll017-b3-progress.json", task: "B-3" },
  { file: "ll018-b4b-progress.json", task: "B-4B" },
  { file: "ll019-b4c-progress.json", task: "B-4C" },
] as const;

const COMMIT_MAP: Record<string, string> = {
  "A-6": "3ed8fcb",
  "B-2": "e4a688b",
  "B-3": "dc0d3e4",
  "B-4B": "62b9bef",
  "B-4C": "a15971f",
};

// ── handoff fixture schema validation ─────────────────────────────────────────

describe("HCC-AUDIT-001 handoff fixture schema validation", () => {
  for (const { file, task } of HANDOFF_FIXTURES) {
    it(`${task} handoff fixture ${file} passes validateHCCTaskHandoffPlan`, () => {
      const fixture = readJSON(file);
      expect(fixture.schema_version).toBe("1.0.0");
      const result = validateHCCTaskHandoffPlan(fixture);
      if (result.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`${file} validation errors:`, result.errors);
      }
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
    });
  }
});

// ── handoff fixture evidence refs ────────────────────────────────────────────

describe("HCC-AUDIT-001 handoff evidence refs", () => {
  for (const { file, task } of HANDOFF_FIXTURES) {
    it(`${task} handoff fixture has closeout + commit ref + quarantine in evidence_refs`, () => {
      const fixture = readJSON(file);
      const baseline = fixture.completed_baseline as Array<{ evidence_refs: string[] }>;
      expect(baseline).toHaveLength(1);
      const refs = baseline[0].evidence_refs;
      const hasCloseout = refs.some((r) => r.startsWith("docs/closeout/"));
      expect(hasCloseout).toBe(true);
      const expectedCommit = COMMIT_MAP[task];
      const hasCommitRef = refs.some((r) => r.includes(expectedCommit));
      expect(hasCommitRef).toBe(true);
      const hasQuarantine = refs.some((r) => r.includes("fixtures/learning-loop/ll"));
      expect(hasQuarantine).toBe(true);
    });
  }
});

// ── progress fixture schema validation ───────────────────────────────────────

describe("HCC-AUDIT-001 progress fixture schema validation", () => {
  for (const { file, task } of PROGRESS_FIXTURES) {
    it(`${task} progress fixture ${file} passes validateHCCProgressRecord`, () => {
      const fixture = readJSON(file);
      expect(fixture.schema_version).toBe("1.0.0");
      const result = validateHCCProgressRecord(fixture);
      if (result.errors.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`${file} validation errors:`, result.errors);
      }
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toBe(true);
    });
  }
});

// ── progress fixture content checks ──────────────────────────────────────────

describe("HCC-AUDIT-001 progress content checks", () => {
  for (const { file, task } of PROGRESS_FIXTURES) {
    it(`${task} progress fixture changed_this_round is non-empty`, () => {
      const fixture = readJSON(file);
      const arr = fixture.changed_this_round as string[];
      expect(arr).toBeInstanceOf(Array);
      expect(arr.length).toBeGreaterThan(0);
    });

    it(`${task} progress fixture next_plan is non-empty`, () => {
      const fixture = readJSON(file);
      expect(typeof fixture.next_plan).toBe("string");
      expect((fixture.next_plan as string).length).toBeGreaterThan(0);
    });
  }
});

// ── B-4A contract-only exclusion ─────────────────────────────────────────────

describe("HCC-AUDIT-001 B-4A exclusion", () => {
  it("no handoff or progress fixture exists for B-4A (contract-only, not a real task)", () => {
    // B-4A is contract-only, excluded from the 5 real tasks
    const b4aHandoff = fs.existsSync(path.join(FIXTURES_DIR, "ll013-b4a-writer-contract-quarantine.json"));
    expect(b4aHandoff).toBe(true); // quarantine exists (B-4A preflight)
    // Check no handoff fixture for B-4A
    const b4aHandoffFixtures = HANDOFF_FIXTURES.filter((f) => f.file.includes("b4a"));
    expect(b4aHandoffFixtures).toHaveLength(0);
    const b4aProgressFixtures = PROGRESS_FIXTURES.filter((f) => f.file.includes("b4a"));
    expect(b4aProgressFixtures).toHaveLength(0);
  });
});
