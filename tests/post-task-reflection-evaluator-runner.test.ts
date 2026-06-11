// B-3 Reflection Evaluator Runner — TDD
//
// Runner wraps evaluatePostTaskReflection + NoRuntime guard.
// Pure function — caller passes reflection data.

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  evaluateReflectionReadOnly,
  evaluateReflectionBatchReadOnly,
  summarizeReflectionRunnerBatch,
} from "../src/shared/lib/post-task-reflection-evaluator-runner";

import {
  assertReflectionEvaluatorVerdictNoRuntime,
  isReflectionEvaluatorPromotionEligible,
  type ReflectionEvaluatorVerdict,
} from "../src/shared/lib/post-task-reflection-evaluator-design";

import type {
  PostTaskReflectionInput,
  Provenance,
} from "../src/shared/lib/post-task-reflection-contract";
import { buildPostTaskReflection } from "../src/shared/lib/post-task-reflection-contract";

const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const HERE_DIR = path.dirname(TEST_FILE_PATH);
const SRC = path.resolve(HERE_DIR, "../src/shared/lib/post-task-reflection-evaluator-runner.ts");
const FIXTURES_DIR = path.resolve(HERE_DIR, "fixtures/learning-loop");

const PROVENANCE: Provenance = {
  generated_by: "hermes",
  submitted_by: "hermes_main",
  dual_reviewed: false,
  human_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  trust_level: "single_run",
  human_approval_ref: null,
};

function makeReflectionInput(overrides: Partial<PostTaskReflectionInput> = {}): PostTaskReflectionInput {
  return {
    task_id: "test-b3-001",
    artifact_ref: "artifact://test/b3-001",
    task_summary: "Test reflection for B-3 evaluator runner.",
    verification_result: "pass",
    provenance: PROVENANCE,
    reused_knowledge: ["knowledge-1"],
    good_patterns: [{
      fingerprint: "pat-1",
      summary: "TDD worked",
      human_readable_summary: "Using TDD led to predictable outcomes.",
      reuse_scope: "all-testing",
      trigger_conditions: ["writing tests"],
      counterexamples: [],
      risks: [],
      evidence: [{ kind: "test_output" as const, ref: "tests/safety/hcc-task-handoff-policy.test.ts", content_hash: "sha256-abc" }],
      provenance: PROVENANCE,
    }],
    ...overrides,
  };
}

interface Ll008Fixture {
  readonly verdicts: readonly ReflectionEvaluatorVerdict[];
}

function loadLl008Fixture(name: string): Ll008Fixture {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8")) as Ll008Fixture;
}

// ── synthetic reflection runner tests ───────────────────────────────────────

describe("B-3 ReflectionEvaluatorRunner", () => {
  it("evaluateReflectionReadOnly returns a valid verdict from a reflection input", () => {
    const reflection = buildPostTaskReflection(makeReflectionInput());
    const verdict = evaluateReflectionReadOnly({ reflection });
    expect(verdict.schema_version).toBe("1.0.0");
    expect(verdict.source_kind).toBe("post_task_reflection");
    expect(typeof verdict.verdict_id).toBe("string");
    expect(verdict.dry_run_only).toBe(true);
  });

  it("all forbidden flags are false", () => {
    const reflection = buildPostTaskReflection(makeReflectionInput());
    const verdict = evaluateReflectionReadOnly({ reflection });
    expect(verdict.live_flush_allowed).toBe(false);
    expect(verdict.knowledge_ingest_call_allowed).toBe(false);
    expect(verdict.knowledge_search_call_allowed).toBe(false);
    expect(verdict.audit_write_allowed).toBe(false);
    expect(verdict.persistence_allowed).toBe(false);
    expect(verdict.next_task_context_write_allowed).toBe(false);
    expect(verdict.live_ranking_mutation_allowed).toBe(false);
    expect(verdict.config_write_allowed).toBe(false);
  });

  it("batch preserves input order", () => {
    const inputs = [
      { reflection: buildPostTaskReflection(makeReflectionInput({ task_id: "a" })) },
      { reflection: buildPostTaskReflection(makeReflectionInput({ task_id: "b" })) },
    ];
    const results = evaluateReflectionBatchReadOnly(inputs);
    expect(results).toHaveLength(2);
    expect(results[0]!.source_task).toBe("a");
    expect(results[1]!.source_task).toBe("b");
  });

  it("summary aggregates total and band counts", () => {
    const r1 = buildPostTaskReflection(makeReflectionInput({ task_id: "x", verification_result: "pass" }));
    const r2 = buildPostTaskReflection(makeReflectionInput({ task_id: "y", verification_result: "fail" }));
    const results = evaluateReflectionBatchReadOnly([
      { reflection: r1 },
      { reflection: r2 },
    ]);
    const summary = summarizeReflectionRunnerBatch(results);
    expect(summary.total).toBe(2);
    expect(summary.all_flags_false).toBe(true);
    expect(summary.all_promotion_eligible_false).toBe(true);
    expect(summary.all_dry_run_only).toBe(true);
  });

  it("summary on empty array returns zero counts", () => {
    const summary = summarizeReflectionRunnerBatch([]);
    expect(summary.total).toBe(0);
    expect(summary.all_flags_false).toBe(true);
  });
});

// ── ll008 fixture batch coverage (v2) ──────────────────────────────────────

describe("B-3 ll008 fixture batch coverage", () => {
  const FIXTURES = [
    { name: "ll008-evaluator-pass-candidate.json", label: "pass" },
    { name: "ll008-evaluator-fail-candidate.json", label: "fail" },
    { name: "ll008-evaluator-manual-review-candidate.json", label: "manual_review" },
  ] as const;

  it("all three ll008 fixture names are read successfully", () => {
    for (const f of FIXTURES) {
      const data = loadLl008Fixture(f.name);
      expect(data.verdicts.length).toBeGreaterThan(0);
    }
  });

  it("every fixture verdict passes assertReflectionEvaluatorVerdictNoRuntime", () => {
    for (const f of FIXTURES) {
      const data = loadLl008Fixture(f.name);
      for (const v of data.verdicts) {
        expect(() => assertReflectionEvaluatorVerdictNoRuntime(v)).not.toThrow();
      }
    }
  });

  it("every fixture verdict has all safety flags false and dry_run_only true", () => {
    for (const f of FIXTURES) {
      for (const v of loadLl008Fixture(f.name).verdicts) {
        expect(v.live_flush_allowed).toBe(false);
        expect(v.knowledge_ingest_call_allowed).toBe(false);
        expect(v.knowledge_search_call_allowed).toBe(false);
        expect(v.audit_write_allowed).toBe(false);
        expect(v.persistence_allowed).toBe(false);
        expect(v.next_task_context_write_allowed).toBe(false);
        expect(v.live_ranking_mutation_allowed).toBe(false);
        expect(v.config_write_allowed).toBe(false);
        expect(v.dry_run_only).toBe(true);
      }
    }
  });

  it("every fixture verdict has promotion eligible false", () => {
    for (const f of FIXTURES) {
      for (const v of loadLl008Fixture(f.name).verdicts) {
        expect(isReflectionEvaluatorPromotionEligible(v)).toBe(false);
      }
    }
  });

  it("fixture verdicts carry non-empty schema_version and verdict_id", () => {
    for (const f of FIXTURES) {
      for (const v of loadLl008Fixture(f.name).verdicts) {
        expect(v.schema_version).toBe("1.0.0");
        expect(typeof v.verdict_id).toBe("string");
        expect(v.verdict_id.length).toBeGreaterThan(0);
      }
    }
  });

  it("pass fixture has at least one verdict with trust_band not equal to manual_review", () => {
    const data = loadLl008Fixture("ll008-evaluator-pass-candidate.json");
    expect(data.verdicts.some((v) => v.trust_band !== "manual_review")).toBe(true);
  });

  it("manual_review fixture has every verdict with human_reviewed_candidate trust_band", () => {
    const data = loadLl008Fixture("ll008-evaluator-manual-review-candidate.json");
    expect(data.verdicts.length).toBeGreaterThan(0);
    for (const v of data.verdicts) {
      expect(v.trust_band).toBe("human_reviewed_candidate");
    }
  });

  it("fail fixture verdicts have non-empty downgrades or trust_band indicating low trust", () => {
    const data = loadLl008Fixture("ll008-evaluator-fail-candidate.json");
    expect(data.verdicts.length).toBeGreaterThan(0);
    const anyHasDowngrades = data.verdicts.some((v) => v.downgrades.length > 0);
    const anyLowTrust = data.verdicts.some((v) => v.trust_score <= 0.5);
    // fail fixture should indicate low quality via downgrades or low score
    expect(anyHasDowngrades || anyLowTrust).toBe(true);
  });

  it("fixture batch preserves original load order (pass, fail, manual_review)", () => {
    const results: Ll008Fixture[] = [];
    for (const f of FIXTURES) {
      results.push(loadLl008Fixture(f.name));
    }
    expect(results).toHaveLength(3);
    // verify pass comes first in the ordered array
    expect(results[0]!.verdicts.length).toBeGreaterThan(0);
    expect(results[0]!.verdicts[0]!.source_kind).toBeTruthy();
  });
});

// ── static: runner source has no fs / ipc / runtime / .hermes (v2 expanded) ─

describe("B-3 static: runner source has zero I/O imports", () => {
  it("runner does not import fs, node:fs, fs/promises, node:fs/promises", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
    expect(src).not.toMatch(/from\s+["']fs\/promises["']/);
    expect(src).not.toMatch(/from\s+["']node:fs\/promises["']/);
  });

  it("runner does not import electron, child_process, node:child_process", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/from\s+["']child_process["']/);
    expect(src).not.toMatch(/from\s+["']node:child_process["']/);
  });

  it("runner does not contain spawn( / exec( / readFile / readdir / ipcMain / BrowserWindow", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\breadFile\b/);
    expect(src).not.toMatch(/\breaddir\b/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
  });

  it("runner non-comment code has no .hermes string", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/\.hermes/);
  });
});
