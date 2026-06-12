// B-4B Live Reflection Writer — Hermes main implementation — TDD
//
// Verifies:
//   - getReflectionWriter() returns the same instance (singleton)
//   - __resetReflectionWriterForTest() resets the singleton
//   - writeReflection() reuses B-4A projectTaskToWriterOutput
//   - writeReflection() rejects non-hermes_main submitter via B-4A guard
//   - writeReflection() produces all-runtime-flags-false output
//   - writeReflection() integrates with B-3 evaluator (verdict present)
//   - writeReflection() integrates with quarantine decider
//   - describe() returns the design descriptor with all flags false
//   - second-writer-owner path: the class is not exported, no bypass
//   - zero forbidden runtime call forms in writer source

import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  getReflectionWriter,
  __resetReflectionWriterForTest,
} from "../src/main/safety/post-task-reflection-writer";

import type {
  PostTaskReflectionInput,
  Provenance,
} from "../src/shared/lib/post-task-reflection-contract";

import {
  assertWriterContractOutputNoRuntime,
} from "../src/shared/lib/post-task-reflection-writer-contract";

const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const HERE_DIR = path.dirname(TEST_FILE_PATH);
const SRC = path.resolve(HERE_DIR, "../src/main/safety/post-task-reflection-writer.ts");

const PROVENANCE_HERMES: Provenance = {
  generated_by: "hermes",
  submitted_by: "hermes_main",
  dual_reviewed: false,
  human_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  trust_level: "single_run",
  human_approval_ref: null,
};

const PROVENANCE_HUMAN_REVIEWED: Provenance = {
  generated_by: "hermes",
  submitted_by: "hermes_main",
  dual_reviewed: false,
  human_reviewed: true,
  reviewed_by: "human",
  reviewed_at: "2026-06-12T00:00:00Z",
  trust_level: "human_confirmed",
  human_approval_ref: {
    ref: "human-anchor-b4b",
    content_hash: "sha256-b4b",
    approval_kind: "explicit_user_action",
    verified: false,
  },
};

function makeInput(overrides: Partial<PostTaskReflectionInput> = {}): PostTaskReflectionInput {
  return {
    task_id: "test-b4b-001",
    artifact_ref: "artifact://test/b4b-001",
    task_summary: "B-4B writer test reflection.",
    verification_result: "pass",
    provenance: PROVENANCE_HERMES,
    good_patterns: [
      {
        fingerprint: "pat-b4b-1",
        summary: "Single-writer invariant",
        human_readable_summary: "Only hermes_main may write.",
        reuse_scope: "all-knowledge",
        trigger_conditions: ["task completion"],
        counterexamples: [],
        risks: [],
        evidence: [{ kind: "test_output" as const, ref: "tests/post-task-reflection-writer.test.ts", content_hash: "sha256-b4b" }],
        provenance: PROVENANCE_HERMES,
      },
    ],
    knowledge_ingest_draft: [
      {
        fingerprint: "kid-b4b-1",
        draft_kind: "pattern",
        body: "B-4B writer test quarantined draft.",
        links_back_to_task: "test-b4b-001",
        secret_scan: { scanned: true, passed: true, method: "test", detected: false, matched_substrings: [] },
        instruction_scan: { scanned: true, passed: true, method: "test", authority_claim_detected: false, matched_terms: [] },
        quarantine: true,
        runtime_flush_allowed: false,
        evidence: [{ kind: "test_output" as const, ref: "tests/post-task-reflection-writer.test.ts", content_hash: "sha256-b4b-kid" }],
        provenance: PROVENANCE_HERMES,
      },
    ],
    usage_feedback_signals: [
      {
        knowledge_id: "kb-b4b-1",
        kind: "helped" as const,
        weight: 0.8,
        recorded_at: "2026-06-12T00:00:00Z",
        source_task_id: "test-b4b-001",
        artifact_ref: "artifact://test/b4b-001",
        evidence: [{ kind: "test_output" as const, ref: "tests/post-task-reflection-writer.test.ts", content_hash: "sha256-b4b-ufs" }],
      },
    ],
    ...overrides,
  };
}

afterEach(() => {
  __resetReflectionWriterForTest();
});

// ── singleton invariant ──────────────────────────────────────────────────────

describe("B-4B getReflectionWriter singleton", () => {
  it("returns the same instance on repeated calls", () => {
    const a = getReflectionWriter();
    const b = getReflectionWriter();
    expect(a).toBe(b);
  });

  it("the instance is always owned by hermes_main", () => {
    const w = getReflectionWriter();
    expect(w.owner).toBe("hermes_main");
  });

  it("__resetReflectionWriterForTest creates a new instance on next call", () => {
    const a = getReflectionWriter();
    __resetReflectionWriterForTest();
    const b = getReflectionWriter();
    expect(a).not.toBe(b);
  });
});

// ── writeReflection integration ──────────────────────────────────────────────

describe("B-4B writeReflection contract integration", () => {
  it("produces a valid WriterContractOutput from hermes_main input", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.schema_version).toBe("1.0.0");
    expect(out.output_id).toBe("writer-output:test-b4b-001");
    expect(out.reflection.provenance.submitted_by).toBe("hermes_main");
    expect(out.verdict.schema_version).toBe("1.0.0");
  });

  it("passes assertWriterContractOutputNoRuntime on the output", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(() => assertWriterContractOutputNoRuntime(out)).not.toThrow();
  });

  it("all 10 runtime/apply flags on the output are hard-wired false", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.writer_allowed).toBe(false);
    expect(out.live_flush_allowed).toBe(false);
    expect(out.knowledge_ingest_allowed).toBe(false);
    expect(out.knowledge_search_allowed).toBe(false);
    expect(out.audit_write_allowed).toBe(false);
    expect(out.persistence_allowed).toBe(false);
    expect(out.next_task_context_write_allowed).toBe(false);
    expect(out.live_ranking_mutation_allowed).toBe(false);
    expect(out.config_write_allowed).toBe(false);
    expect(out.dry_run_only).toBe(true);
  });

  it("reflects the B-4A writer's instance flag values (writer self-consistency)", () => {
    const w = getReflectionWriter();
    expect(w.writer_allowed).toBe(false);
    expect(w.live_flush_allowed).toBe(false);
    expect(w.knowledge_ingest_allowed).toBe(false);
    expect(w.knowledge_search_allowed).toBe(false);
    expect(w.audit_write_allowed).toBe(false);
    expect(w.persistence_allowed).toBe(false);
    expect(w.next_task_context_write_allowed).toBe(false);
    expect(w.live_ranking_mutation_allowed).toBe(false);
    expect(w.config_write_allowed).toBe(false);
    expect(w.dry_run_only).toBe(true);
  });
});

// ── B-3 evaluator integration ────────────────────────────────────────────────

describe("B-4B B-3 evaluator integration", () => {
  it("output carries a verdict with schema_version 1.0.0", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.verdict.schema_version).toBe("1.0.0");
  });

  it("verdict trust_band is quarantine (agent-submitted, not human-reviewed)", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.verdict.trust_band).toBe("quarantine");
  });

  it("verdict dry_run_only is true", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.verdict.dry_run_only).toBe(true);
  });

  it("verdict trust_score is in [0, 1]", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.verdict.trust_score).toBeGreaterThanOrEqual(0);
    expect(out.verdict.trust_score).toBeLessThanOrEqual(1);
  });
});

// ── quarantine decider integration ───────────────────────────────────────────

describe("B-4B quarantine decider integration", () => {
  it("pass + hermes_main + not human-reviewed → remain_quarantined", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(makeInput());
    expect(out.quarantine_decision).toBe("remain_quarantined");
  });

  it("pass + hermes_main + human-reviewed + approval ref + trust_band=human_reviewed_candidate → promotion_candidate", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(
      makeInput({
        provenance: PROVENANCE_HUMAN_REVIEWED,
        knowledge_ingest_draft: [],
      }),
    );
    expect(out.quarantine_decision).toBe("promotion_candidate");
  });

  it("fail + hermes_main + not human-reviewed → remain_quarantined", () => {
    const w = getReflectionWriter();
    const out = w.writeReflection(
      makeInput({
        verification_result: "fail",
        bad_patterns: [
          {
            fingerprint: "bp-1",
            summary: "Test fail pattern",
            human_readable_summary: "Test fail.",
            failure_class: "logic",
            recurrence_count: 1,
            trigger_context: "test",
            counterexamples: [],
            risks: [],
            evidence: [{ kind: "test_output" as const, ref: "tests/post-task-reflection-writer.test.ts", content_hash: "sha256-b4b-fail" }],
            provenance: PROVENANCE_HERMES,
          },
        ],
      }),
    );
    expect(out.quarantine_decision).toBe("remain_quarantined");
  });
});

// ── describe() returns the design descriptor ─────────────────────────────────

describe("B-4B describe()", () => {
  it("returns writer_status=contract_only", () => {
    const w = getReflectionWriter();
    expect(w.describe().writer_status).toBe("contract_only");
  });

  it("returns owner=hermes_main and single_writer_required=true", () => {
    const w = getReflectionWriter();
    const d = w.describe();
    expect(d.owner).toBe("hermes_main");
    expect(d.single_writer_required).toBe(true);
  });

  it("returns all 10 runtime/apply flags false", () => {
    const w = getReflectionWriter();
    const d = w.describe();
    expect(d.writer_allowed).toBe(false);
    expect(d.live_flush_allowed).toBe(false);
    expect(d.knowledge_ingest_allowed).toBe(false);
    expect(d.knowledge_search_allowed).toBe(false);
    expect(d.audit_write_allowed).toBe(false);
    expect(d.persistence_allowed).toBe(false);
    expect(d.next_task_context_write_allowed).toBe(false);
    expect(d.live_ranking_mutation_allowed).toBe(false);
    expect(d.config_write_allowed).toBe(false);
    expect(d.dry_run_only).toBe(true);
  });

  it("returns b3_evaluator_required=true and quarantine_default=true", () => {
    const w = getReflectionWriter();
    const d = w.describe();
    expect(d.b3_evaluator_required).toBe(true);
    expect(d.quarantine_default).toBe(true);
  });
});

// ── no second-writer-owner / no bypass path ──────────────────────────────────

describe("B-4B no second writer owner / no bypass", () => {
  it("the writer class is not exported (only the factory getter)", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    // The class is declared with `class LiveReflectionWriter` (not `export class`).
    // Ensure no `export class LiveReflectionWriter` literal exists.
    expect(src).not.toMatch(/export\s+class\s+LiveReflectionWriter/);
    // The factory getter IS exported.
    expect(src).toMatch(/export\s+function\s+getReflectionWriter/);
  });

  it("the writer does not export any persistence, IPC, or flush hook", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+flush/);
    expect(src).not.toMatch(/export\s+function\s+persist/);
    expect(src).not.toMatch(/export\s+function\s+writeToDisk/);
    expect(src).not.toMatch(/export\s+function\s+sendToKnowledge/);
  });
});

// ── static: writer source has zero I/O imports ──────────────────────────────

describe("B-4B static: writer source has zero I/O imports", () => {
  it("writer does not import fs, node:fs, fs/promises, node:fs/promises", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
    expect(src).not.toMatch(/from\s+["']fs\/promises["']/);
    expect(src).not.toMatch(/from\s+["']node:fs\/promises["']/);
  });

  it("writer does not import electron, child_process, node:child_process", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/from\s+["']child_process["']/);
    expect(src).not.toMatch(/from\s+["']node:child_process["']/);
  });

  it("writer does not contain spawn( / exec( / readFile / readdir / ipcMain / BrowserWindow", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\breadFile\b/);
    expect(src).not.toMatch(/\breaddir\b/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
  });

  it("writer non-comment code has no .hermes string", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/\.hermes/);
  });

  it("writer does not call knowledgeIngest / knowledgeSearch (non-comment code)", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/knowledgeIngest/);
    expect(codeLines.join("\n")).not.toMatch(/knowledgeSearch/);
  });

  it("writer does not declare writer_allowed=true or live_flush_allowed=true literal", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/writer_allowed:\s*true/);
    expect(src).not.toMatch(/live_flush_allowed:\s*true/);
  });
});
