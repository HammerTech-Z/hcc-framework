// B-4A Live Reflection Writer — Contract / Descriptor — TDD
//
// Verifies:
//   - WRITER_CONTRACT_DESIGN reports contract_only with all flags false
//   - single-writer guard rejects non-hermes_main submitters
//   - decideQuarantineForReflection honors the matrix
//   - projectTaskToWriterOutput produces a valid WriterContractOutput
//   - assertWriterContractOutputNoRuntime rejects any tampered flag
//   - zero forbidden runtime call forms in contract source

import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  WRITER_CONTRACT_DESIGN,
  buildWriterOutputId,
  assertSingleWriterHermesMain,
  decideQuarantineForReflection,
  hasReflectionContent,
  projectTaskToWriterOutput,
  assertWriterContractOutputNoRuntime,
  type WriterContractOutput,
} from "../src/shared/lib/post-task-reflection-writer-contract";

import type {
  PostTaskReflectionInput,
  Provenance,
} from "../src/shared/lib/post-task-reflection-contract";
import { buildPostTaskReflection } from "../src/shared/lib/post-task-reflection-contract";

const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const HERE_DIR = path.dirname(TEST_FILE_PATH);
const SRC = path.resolve(HERE_DIR, "../src/shared/lib/post-task-reflection-writer-contract.ts");

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

const PROVENANCE_CLAUDE: Provenance = {
  generated_by: "claude_code",
  submitted_by: "claude_code",
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
    ref: "human-anchor-1",
    content_hash: "sha256-b4a",
    approval_kind: "explicit_user_action",
    verified: false,
  },
};

function makeInput(overrides: Partial<PostTaskReflectionInput> = {}): PostTaskReflectionInput {
  return {
    task_id: "test-b4a-001",
    artifact_ref: "artifact://test/b4a-001",
    task_summary: "Test reflection for B-4A writer contract.",
    verification_result: "pass",
    provenance: PROVENANCE_HERMES,
    good_patterns: [
      {
        fingerprint: "pat-b4a-1",
        summary: "Single-writer invariant",
        human_readable_summary: "Only hermes_main may write.",
        reuse_scope: "all-knowledge",
        trigger_conditions: ["task completion"],
        counterexamples: [],
        risks: [],
        evidence: [{ kind: "test_output" as const, ref: "tests/post-task-reflection-writer-contract.test.ts", content_hash: "sha256-b4a" }],
        provenance: PROVENANCE_HERMES,
      },
    ],
    ...overrides,
  };
}

// ── design descriptor invariants ─────────────────────────────────────────────

describe("B-4A WRITER_CONTRACT_DESIGN invariants", () => {
  it("writer_status is contract_only", () => {
    expect(WRITER_CONTRACT_DESIGN.writer_status).toBe("contract_only");
  });

  it("writer_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.writer_allowed).toBe(false);
  });

  it("live_flush_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.live_flush_allowed).toBe(false);
  });

  it("knowledge_ingest_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.knowledge_ingest_allowed).toBe(false);
  });

  it("knowledge_search_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.knowledge_search_allowed).toBe(false);
  });

  it("audit_write_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.audit_write_allowed).toBe(false);
  });

  it("persistence_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.persistence_allowed).toBe(false);
  });

  it("next_task_context_write_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.next_task_context_write_allowed).toBe(false);
  });

  it("live_ranking_mutation_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.live_ranking_mutation_allowed).toBe(false);
  });

  it("config_write_allowed is false", () => {
    expect(WRITER_CONTRACT_DESIGN.config_write_allowed).toBe(false);
  });

  it("single_writer_required is true and writer_owner is hermes_main", () => {
    expect(WRITER_CONTRACT_DESIGN.single_writer_required).toBe(true);
    expect(WRITER_CONTRACT_DESIGN.writer_owner).toBe("hermes_main");
  });

  it("b3_evaluator_required is true", () => {
    expect(WRITER_CONTRACT_DESIGN.b3_evaluator_required).toBe(true);
  });

  it("quarantine_default is true", () => {
    expect(WRITER_CONTRACT_DESIGN.quarantine_default).toBe(true);
  });

  it("human_approval_ref_required is true", () => {
    expect(WRITER_CONTRACT_DESIGN.human_approval_ref_required).toBe(true);
  });

  it("schema_version is 1.0.0", () => {
    expect(WRITER_CONTRACT_DESIGN.schema_version).toBe("1.0.0");
  });
});

// ── output id builder ────────────────────────────────────────────────────────

describe("B-4A buildWriterOutputId", () => {
  it("produces stable id with writer-output: prefix", () => {
    expect(buildWriterOutputId({ task_id: "t-1" })).toBe("writer-output:t-1");
  });

  it("distinct task_ids produce distinct ids", () => {
    expect(buildWriterOutputId({ task_id: "a" })).not.toBe(buildWriterOutputId({ task_id: "b" }));
  });
});

// ── single-writer guard ──────────────────────────────────────────────────────

describe("B-4A assertSingleWriterHermesMain", () => {
  it("accepts hermes_main", () => {
    expect(() => assertSingleWriterHermesMain({ submitted_by: "hermes_main" })).not.toThrow();
  });

  it("rejects claude_code", () => {
    expect(() => assertSingleWriterHermesMain({ submitted_by: "claude_code" })).toThrow(
      /single-writer violation/,
    );
  });

  it("rejects codex", () => {
    expect(() => assertSingleWriterHermesMain({ submitted_by: "codex" })).toThrow(
      /single-writer violation/,
    );
  });

  it("rejects human", () => {
    expect(() => assertSingleWriterHermesMain({ submitted_by: "human" })).toThrow(
      /single-writer violation/,
    );
  });
});

// ── quarantine decider matrix ────────────────────────────────────────────────

describe("B-4A decideQuarantineForReflection matrix", () => {
  it("rejects when no content", () => {
    const r = decideQuarantineForReflection({
      submitted_by: "hermes_main",
      verification_result: "pass",
      human_reviewed: false,
      human_approval_ref_present: false,
      verdict_trust_band: "quarantine",
      has_content: false,
    });
    expect(r.decision).toBe("reject");
    expect(r.reason).toMatch(/no content/);
  });

  it("rejects when submitted_by is not hermes_main", () => {
    const r = decideQuarantineForReflection({
      submitted_by: "claude_code",
      verification_result: "pass",
      human_reviewed: false,
      human_approval_ref_present: false,
      verdict_trust_band: "quarantine",
      has_content: true,
    });
    expect(r.decision).toBe("reject");
    expect(r.reason).toMatch(/single-writer/);
  });

  it("promotion_candidate when human_reviewed + approval ref + trust_band=human_reviewed_candidate", () => {
    const r = decideQuarantineForReflection({
      submitted_by: "hermes_main",
      verification_result: "pass",
      human_reviewed: true,
      human_approval_ref_present: true,
      verdict_trust_band: "human_reviewed_candidate",
      has_content: true,
    });
    expect(r.decision).toBe("promotion_candidate");
  });

  it("remain_quarantined on fail + not human-reviewed", () => {
    const r = decideQuarantineForReflection({
      submitted_by: "hermes_main",
      verification_result: "fail",
      human_reviewed: false,
      human_approval_ref_present: false,
      verdict_trust_band: "quarantine",
      has_content: true,
    });
    expect(r.decision).toBe("remain_quarantined");
  });

  it("remain_quarantined on pass + not human-reviewed (default)", () => {
    const r = decideQuarantineForReflection({
      submitted_by: "hermes_main",
      verification_result: "pass",
      human_reviewed: false,
      human_approval_ref_present: false,
      verdict_trust_band: "quarantine",
      has_content: true,
    });
    expect(r.decision).toBe("remain_quarantined");
  });
});

// ── projection chain ─────────────────────────────────────────────────────────

describe("B-4A projectTaskToWriterOutput chain", () => {
  it("produces a valid WriterContractOutput from hermes_main input", () => {
    const out = projectTaskToWriterOutput(makeInput());
    expect(out.schema_version).toBe("1.0.0");
    expect(out.output_id).toBe("writer-output:test-b4a-001");
    expect(out.reflection.provenance.submitted_by).toBe("hermes_main");
    expect(out.verdict.schema_version).toBe("1.0.0");
    expect(["remain_quarantined", "promotion_candidate", "reject"]).toContain(
      out.quarantine_decision,
    );
  });

  it("passes assertWriterContractOutputNoRuntime on hermes_main input", () => {
    const out = projectTaskToWriterOutput(makeInput());
    expect(() => assertWriterContractOutputNoRuntime(out)).not.toThrow();
  });

  it("rejects claude_code submitter via single-writer guard", () => {
    expect(() =>
      projectTaskToWriterOutput(makeInput({ provenance: PROVENANCE_CLAUDE })),
    ).toThrow(/single-writer violation/);
  });

  it("pass + human-reviewed + approval ref → promotion_candidate", () => {
    const out = projectTaskToWriterOutput(makeInput({ provenance: PROVENANCE_HUMAN_REVIEWED }));
    expect(out.quarantine_decision).toBe("promotion_candidate");
    expect(() => assertWriterContractOutputNoRuntime(out)).not.toThrow();
  });
});

// ── runtime guard rejects tampered flags ─────────────────────────────────────

describe("B-4A assertWriterContractOutputNoRuntime guards", () => {
  function makeValidOutput(): WriterContractOutput {
    return projectTaskToWriterOutput(makeInput());
  }

  it("rejects writer_allowed=true", () => {
    const out = makeValidOutput();
    const tampered = { ...out, writer_allowed: true as true };
    expect(() => assertWriterContractOutputNoRuntime(tampered)).toThrow(/writer_allowed/);
  });

  it("rejects live_flush_allowed=true", () => {
    const out = makeValidOutput();
    const tampered = { ...out, live_flush_allowed: true as true };
    expect(() => assertWriterContractOutputNoRuntime(tampered)).toThrow(/live_flush_allowed/);
  });

  it("rejects knowledge_ingest_allowed=true", () => {
    const out = makeValidOutput();
    const tampered = { ...out, knowledge_ingest_allowed: true as true };
    expect(() => assertWriterContractOutputNoRuntime(tampered)).toThrow(/knowledge_ingest_allowed/);
  });

  it("rejects dry_run_only=false", () => {
    const out = makeValidOutput();
    const tampered = { ...out, dry_run_only: false as false };
    expect(() => assertWriterContractOutputNoRuntime(tampered)).toThrow(/dry_run_only/);
  });

  it("rejects human_approval_ref.verified=true on the underlying reflection", () => {
    const tampered = projectTaskToWriterOutput(
      makeInput({ provenance: PROVENANCE_HUMAN_REVIEWED }),
    );
    // forge verified=true on the provenance human_approval_ref
    const out = {
      ...tampered,
      reflection: {
        ...tampered.reflection,
        provenance: {
          ...tampered.reflection.provenance,
          human_approval_ref: tampered.reflection.provenance.human_approval_ref
            ? { ...tampered.reflection.provenance.human_approval_ref, verified: true }
            : { ref: "x", content_hash: "sha256-x", approval_kind: "manual_review" as const, verified: true },
        },
      },
    };
    expect(() => assertWriterContractOutputNoRuntime(out)).toThrow(/verified/);
  });
});

// ── hasReflectionContent helper ──────────────────────────────────────────────

describe("B-4A hasReflectionContent", () => {
  it("true when reflection has a good_pattern", () => {
    const r = buildPostTaskReflection(makeInput());
    expect(hasReflectionContent(r)).toBe(true);
  });

  it("false when reflection has no patterns / signals", () => {
    const r = buildPostTaskReflection(
      makeInput({ good_patterns: [], bad_patterns: [], dead_ends: [], skill_candidates: [], model_feedback: [], knowledge_ingest_draft: [], usage_feedback_signals: [], next_task_recommendations: [] }),
    );
    expect(hasReflectionContent(r)).toBe(false);
  });
});

// ── static: writer contract source has zero I/O imports ─────────────────────

describe("B-4A static: contract source has zero I/O imports", () => {
  it("contract does not import fs, node:fs, fs/promises, node:fs/promises", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
    expect(src).not.toMatch(/from\s+["']fs\/promises["']/);
    expect(src).not.toMatch(/from\s+["']node:fs\/promises["']/);
  });

  it("contract does not import electron, child_process, node:child_process", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/from\s+["']child_process["']/);
    expect(src).not.toMatch(/from\s+["']node:child_process["']/);
  });

  it("contract does not contain spawn( / exec( / readFile / readdir / ipcMain / BrowserWindow", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\breadFile\b/);
    expect(src).not.toMatch(/\breaddir\b/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
  });

  it("contract non-comment code has no .hermes string", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/\.hermes/);
  });

  it("contract does not declare writer_allowed=true or live_flush_allowed=true literal", async () => {
    const src = await fs.promises.readFile(SRC, "utf-8");
    expect(src).not.toMatch(/writer_allowed:\s*true/);
    expect(src).not.toMatch(/live_flush_allowed:\s*true/);
  });
});
