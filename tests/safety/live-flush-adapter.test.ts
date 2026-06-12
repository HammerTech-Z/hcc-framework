// B-4C Live Flush Adapter — TDD
//
// Verifies:
//   - getLiveFlushAdapter() returns the same instance (singleton)
//   - __resetLiveFlushAdapterForTest() resets the singleton
//   - buildRequest() accepts B-4B writer promotion_candidate output
//   - buildRequest() rejects non-promotion_candidate
//   - buildRequest() rejects human_approval_ref.verified=true tampered output
//   - buildRequest() produces all-runtime-flags-false request
//   - getCopyDeckRedline() returns the preflight-approved text
//   - describe() returns the design descriptor
//   - no second-flush-owner / no bypass path (class not exported)
//   - zero forbidden runtime call forms in adapter source

import { afterEach, describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

import {
  getLiveFlushAdapter,
  __resetLiveFlushAdapterForTest,
} from "../../src/main/safety/live-flush-adapter";

import {
  buildLiveFlushRequest,
  assertLiveFlushRequestNoRuntime,
  LIVE_FLUSH_COPY_DECK_REDLINE,
  type LiveFlushRequest,
} from "../../src/shared/lib/post-task-reflection-flush-gate";

import { projectTaskToWriterOutput } from "../../src/shared/lib/post-task-reflection-writer-contract";

import type {
  PostTaskReflectionInput,
  Provenance,
} from "../../src/shared/lib/post-task-reflection-contract";

const TEST_FILE_PATH = fileURLToPath(import.meta.url);
const HERE_DIR = path.dirname(TEST_FILE_PATH);
const SRC_ADAPTER = path.resolve(HERE_DIR, "../../src/main/safety/live-flush-adapter.ts");
const SRC_GATE = path.resolve(HERE_DIR, "../../src/shared/lib/post-task-reflection-flush-gate.ts");

const PROVENANCE_HUMAN_REVIEWED: Provenance = {
  generated_by: "hermes",
  submitted_by: "hermes_main",
  dual_reviewed: false,
  human_reviewed: true,
  reviewed_by: "human",
  reviewed_at: "2026-06-12T00:00:00Z",
  trust_level: "human_confirmed",
  human_approval_ref: {
    ref: "human-anchor-b4c",
    content_hash: "sha256-b4c",
    approval_kind: "explicit_user_action",
    verified: false,
  },
};

const PROVENANCE_AGENT: Provenance = {
  generated_by: "hermes",
  submitted_by: "hermes_main",
  dual_reviewed: false,
  human_reviewed: false,
  reviewed_by: null,
  reviewed_at: null,
  trust_level: "single_run",
  human_approval_ref: null,
};

function makeInput(overrides: Partial<PostTaskReflectionInput> = {}): PostTaskReflectionInput {
  return {
    task_id: "test-b4c-001",
    artifact_ref: "artifact://test/b4c-001",
    task_summary: "B-4C live flush adapter test.",
    verification_result: "pass",
    provenance: PROVENANCE_HUMAN_REVIEWED,
    good_patterns: [
      {
        fingerprint: "pat-b4c-1",
        summary: "Pending user approval flush",
        human_readable_summary: "Awaiting user approval.",
        reuse_scope: "all-knowledge",
        trigger_conditions: ["task completion"],
        counterexamples: [],
        risks: [],
        evidence: [{ kind: "test_output" as const, ref: "tests/safety/live-flush-adapter.test.ts", content_hash: "sha256-b4c" }],
        provenance: PROVENANCE_HUMAN_REVIEWED,
      },
    ],
    knowledge_ingest_draft: [],
    ...overrides,
  };
}

afterEach(() => {
  __resetLiveFlushAdapterForTest();
});

// ── singleton invariant ──────────────────────────────────────────────────────

describe("B-4C getLiveFlushAdapter singleton", () => {
  it("returns the same instance on repeated calls", () => {
    const a = getLiveFlushAdapter();
    const b = getLiveFlushAdapter();
    expect(a).toBe(b);
  });

  it("__resetLiveFlushAdapterForTest creates a new instance on next call", () => {
    const a = getLiveFlushAdapter();
    __resetLiveFlushAdapterForTest();
    const b = getLiveFlushAdapter();
    expect(a).not.toBe(b);
  });
});

// ── buildRequest precondition: promotion_candidate only ──────────────────────

describe("B-4C buildRequest promotion_candidate precondition", () => {
  it("accepts a promotion_candidate output", () => {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(makeInput());
    expect(out.quarantine_decision).toBe("promotion_candidate");
    const req = a.buildRequest(out);
    expect(req.status).toBe("pending_user_approval");
  });

  it("rejects a remain_quarantined output", () => {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(
      makeInput({ provenance: PROVENANCE_AGENT }),
    );
    expect(out.quarantine_decision).toBe("remain_quarantined");
    expect(() => a.buildRequest(out)).toThrow(/not a promotion_candidate/);
  });
});

// ── buildRequest precondition: human_approval_ref.verified must be false ────

describe("B-4C buildRequest human_approval_ref.verified guard", () => {
  it("rejects a tampered output with human_approval_ref.verified=true", () => {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(makeInput());
    const tampered = {
      ...out,
      reflection: {
        ...out.reflection,
        provenance: {
          ...out.reflection.provenance,
          human_approval_ref: out.reflection.provenance.human_approval_ref
            ? { ...out.reflection.provenance.human_approval_ref, verified: true }
            : {
                ref: "tamper",
                content_hash: "sha256-tamper",
                approval_kind: "explicit_user_action" as const,
                verified: true,
              },
        },
      },
    };
    expect(() => a.buildRequest(tampered)).toThrow(/verified/);
  });
});

// ── request shape: all runtime/apply flags false ─────────────────────────────

describe("B-4C buildRequest output safety flags", () => {
  it("all 9 runtime/apply flags on the request are hard-wired false", () => {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(makeInput());
    const req = a.buildRequest(out);
    expect(req.live_flush_allowed).toBe(false);
    expect(req.knowledge_ingest_call_allowed).toBe(false);
    expect(req.knowledge_search_call_allowed).toBe(false);
    expect(req.audit_write_allowed).toBe(false);
    expect(req.persistence_allowed).toBe(false);
    expect(req.config_write_allowed).toBe(false);
    expect(req.live_ranking_mutation_allowed).toBe(false);
    expect(req.auto_apply_eligible).toBe(false);
    expect(req.dry_run_only).toBe(true);
  });

  it("request status is pending_user_approval (only pending allowed at gate)", () => {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(makeInput());
    const req = a.buildRequest(out);
    expect(req.status).toBe("pending_user_approval");
  });

  it("passes assertLiveFlushRequestNoRuntime", () => {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(makeInput());
    const req = a.buildRequest(out);
    expect(() => assertLiveFlushRequestNoRuntime(req)).not.toThrow();
  });
});

// ── status guard: only pending_user_approval allowed ─────────────────────────

describe("B-4C assertLiveFlushRequestNoRuntime status guard", () => {
  function baseRequest(): LiveFlushRequest {
    const a = getLiveFlushAdapter();
    const out = projectTaskToWriterOutput(makeInput());
    return a.buildRequest(out);
  }

  it("rejects tampered request with status='approved'", () => {
    const tampered = { ...baseRequest(), status: "approved" as const };
    expect(() => assertLiveFlushRequestNoRuntime(tampered)).toThrow(/pending_user_approval/);
  });

  it("rejects tampered request with status='rejected'", () => {
    const tampered = { ...baseRequest(), status: "rejected" as const };
    expect(() => assertLiveFlushRequestNoRuntime(tampered)).toThrow(/pending_user_approval/);
  });

  it("rejects tampered request with status='expired'", () => {
    const tampered = { ...baseRequest(), status: "expired" as const };
    expect(() => assertLiveFlushRequestNoRuntime(tampered)).toThrow(/pending_user_approval/);
  });

  it("accepts request with status='pending_user_approval'", () => {
    const req = baseRequest();
    expect(req.status).toBe("pending_user_approval");
    expect(() => assertLiveFlushRequestNoRuntime(req)).not.toThrow();
  });
});

// ── copy-deck redline ────────────────────────────────────────────────────────

describe("B-4C getCopyDeckRedline", () => {
  it("returns the preflight-approved redline text", () => {
    const a = getLiveFlushAdapter();
    expect(a.getCopyDeckRedline()).toBe(LIVE_FLUSH_COPY_DECK_REDLINE);
  });

  it("the redline contains the required red flags", () => {
    const text = getLiveFlushAdapter().getCopyDeckRedline();
    expect(text).toMatch(/LIVE FLUSH/);
    expect(text).toMatch(/per-request human approval/);
    expect(text).toMatch(/Auto Executor/);
    expect(text).toMatch(/Live Ranking/);
    expect(text).toMatch(/promotion_candidate/);
    expect(text).toMatch(/NOT enabled/);
  });
});

// ── describe() returns the design descriptor ─────────────────────────────────

describe("B-4C describe()", () => {
  it("returns adapter_status=design_only", () => {
    const a = getLiveFlushAdapter();
    expect(a.describe().adapter_status).toBe("design_only");
  });

  it("returns all 9 runtime/apply flags false", () => {
    const a = getLiveFlushAdapter();
    const d = a.describe();
    expect(d.live_flush_allowed).toBe(false);
    expect(d.knowledge_ingest_call_allowed).toBe(false);
    expect(d.knowledge_search_call_allowed).toBe(false);
    expect(d.audit_write_allowed).toBe(false);
    expect(d.persistence_allowed).toBe(false);
    expect(d.config_write_allowed).toBe(false);
    expect(d.live_ranking_mutation_allowed).toBe(false);
    expect(d.auto_apply_eligible).toBe(false);
    expect(d.dry_run_only).toBe(true);
  });

  it("returns per_request_approval=true and user_approval_required=true", () => {
    const a = getLiveFlushAdapter();
    const d = a.describe();
    expect(d.per_request_approval).toBe(true);
    expect(d.user_approval_required).toBe(true);
  });
});

// ── no second-flush-owner / no bypass path ──────────────────────────────────

describe("B-4C no second flush owner / no bypass", () => {
  it("the adapter class is not exported (only the factory getter)", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    expect(src).not.toMatch(/export\s+class\s+LiveFlushAdapter/);
    expect(src).toMatch(/export\s+function\s+getLiveFlushAdapter/);
  });

  it("the adapter does not export any apply / persist / flush hook", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+apply/);
    expect(src).not.toMatch(/export\s+function\s+flush/);
    expect(src).not.toMatch(/export\s+function\s+persist/);
    expect(src).not.toMatch(/export\s+function\s+writeToDisk/);
    expect(src).not.toMatch(/export\s+function\s+sendToKnowledge/);
    expect(src).not.toMatch(/export\s+function\s+executeFlush/);
  });

  it("the gate contract does not export any apply function", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    expect(src).not.toMatch(/export\s+function\s+apply/);
    expect(src).not.toMatch(/export\s+function\s+flush/);
    expect(src).not.toMatch(/export\s+function\s+execute/);
  });
});

// ── static: zero I/O imports / forbidden runtime call forms ────────────────

describe("B-4C static: adapter and gate source have zero I/O imports", () => {
  it("adapter does not import fs, node:fs, fs/promises, node:fs/promises", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
    expect(src).not.toMatch(/from\s+["']fs\/promises["']/);
    expect(src).not.toMatch(/from\s+["']node:fs\/promises["']/);
  });

  it("adapter does not import electron, child_process, node:child_process", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/from\s+["']child_process["']/);
    expect(src).not.toMatch(/from\s+["']node:child_process["']/);
  });

  it("adapter does not contain spawn( / exec( / readFile / readdir / ipcMain / BrowserWindow", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\breadFile\b/);
    expect(src).not.toMatch(/\breaddir\b/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
  });

  it("adapter non-comment code has no .hermes string", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/\.hermes/);
  });

  it("adapter non-comment code does not call knowledgeIngest / knowledgeSearch", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/knowledgeIngest/);
    expect(codeLines.join("\n")).not.toMatch(/knowledgeSearch/);
  });

  it("adapter does not declare live_flush_allowed=true or auto_apply_eligible=true literal", async () => {
    const src = await fs.promises.readFile(SRC_ADAPTER, "utf-8");
    expect(src).not.toMatch(/live_flush_allowed:\s*true/);
    expect(src).not.toMatch(/auto_apply_eligible:\s*true/);
  });

  it("gate contract does not import fs, node:fs, fs/promises, node:fs/promises", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    expect(src).not.toMatch(/from\s+["']fs["']/);
    expect(src).not.toMatch(/from\s+["']node:fs["']/);
    expect(src).not.toMatch(/from\s+["']fs\/promises["']/);
    expect(src).not.toMatch(/from\s+["']node:fs\/promises["']/);
  });

  it("gate contract does not import electron, child_process, node:child_process", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    expect(src).not.toMatch(/from\s+["']electron["']/);
    expect(src).not.toMatch(/from\s+["']child_process["']/);
    expect(src).not.toMatch(/from\s+["']node:child_process["']/);
  });

  it("gate contract does not contain spawn( / exec( / readFile / readdir / ipcMain / BrowserWindow", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/\breadFile\b/);
    expect(src).not.toMatch(/\breaddir\b/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
  });

  it("gate contract non-comment code has no .hermes string", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/\.hermes/);
  });

  it("gate contract non-comment code does not call knowledgeIngest / knowledgeSearch", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    expect(codeLines.join("\n")).not.toMatch(/knowledgeIngest/);
    expect(codeLines.join("\n")).not.toMatch(/knowledgeSearch/);
  });

  it("gate contract does not declare live_flush_allowed=true or auto_apply_eligible=true literal", async () => {
    const src = await fs.promises.readFile(SRC_GATE, "utf-8");
    expect(src).not.toMatch(/live_flush_allowed:\s*true/);
    expect(src).not.toMatch(/auto_apply_eligible:\s*true/);
  });
});

// ── gate contract pure-function tests ───────────────────────────────────────

describe("B-4C buildLiveFlushRequest direct", () => {
  it("builds a request for a promotion_candidate output", () => {
    const out = projectTaskToWriterOutput(makeInput());
    const req = buildLiveFlushRequest(out);
    expect(req.reflection_task_id).toBe("test-b4c-001");
    expect(req.reflection_quarantine_decision).toBe("promotion_candidate");
  });

  it("throws on remain_quarantined", () => {
    const out = projectTaskToWriterOutput(makeInput({ provenance: PROVENANCE_AGENT }));
    expect(() => buildLiveFlushRequest(out)).toThrow(/not a promotion_candidate/);
  });
});
