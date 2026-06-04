import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-runtime-default-injection-design-2026-06-04.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/runtime-default-injection-design.json"
);
const DOC = readFileSync(DOC_PATH, "utf8");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. L4 vs L5 Boundary",
  "## 4. Injection Targets",
  "## 5. Trigger Conditions",
  "## 6. Injection Surfaces",
  "## 7. Recommended Surface",
  "## 8. Prompt Snippet Source",
  "## 9. Dispatch / Handoff Integration Options",
  "## 10. Runtime Safety Gates",
  "## 11. Target Agent Matrix",
  "## 12. Failure Modes",
  "## 13. Rollback Strategy",
  "## 14. Test Plan",
  "## 15. Go / No-Go Decision",
  "## 16. Future Implementation Slices",
];

const TARGETS: ReadonlyArray<string> = [
  "claude_code",
  "codex",
  "hermes_pro",
  "hermes_self_call",
];

// -----------------------------------------------------------------
// 1. design doc exists
// -----------------------------------------------------------------

describe("design doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. L4/L5 boundary
// -----------------------------------------------------------------

describe("L4 vs L5 boundary", () => {
  it("doc defines L4 (dry-run handoff payload can carry snippet)", () => {
    expect(DOC).toContain("L4");
    expect(DOC).toContain("dry-run handoff payload can carry snippet");
  });

  it("doc defines L5 (runtime default injection)", () => {
    expect(DOC).toContain("L5");
    expect(DOC).toContain("runtime default injection");
  });

  it("doc states 008A does NOT implement L5", () => {
    expect(DOC.includes("008A scope") || DOC.includes("008A 仅")).toBe(true);
    // Look for the explicit NOT-implement assertion: 中文 "不实现" + L5 within 600 chars.
    const l5NotImplemented = /L5[\s\S]{0,600}(不实现|do not implement|not implemented|design only|仅 design)/i.test(
      DOC
    );
    expect(l5NotImplemented, "doc must state 008A does not implement L5").toBe(true);
  });

  it("doc states 008A only designs L5", () => {
    // Look for design-only assertion within 600 chars of L5.
    const l5DesignOnly = /L5[\s\S]{0,600}(design only|仅 design|008A 仅 design|008A only designs)/i.test(
      DOC
    );
    expect(l5DesignOnly, "doc must state 008A only designs L5").toBe(true);
  });
});

// -----------------------------------------------------------------
// 3. 4 target states
// -----------------------------------------------------------------

describe("4 target states covered", () => {
  it.each(TARGETS)("doc mentions target: %s", (target) => {
    // For "hermes_self_call", we look for "hermes" + "self-call" or "hermes (self-call"
    if (target === "hermes_self_call") {
      expect(
        DOC.includes("hermes") && DOC.includes("self-call"),
        "doc must mention hermes self-call"
      ).toBe(true);
    } else {
      expect(DOC).toContain(target);
    }
  });

  it("doc covers claude_code / codex / hermes_pro / hermes self-call", () => {
    expect(DOC).toContain("claude_code");
    expect(DOC).toContain("codex");
    expect(DOC).toContain("hermes_pro");
    expect(DOC.includes("hermes") && DOC.includes("self-call")).toBe(true);
  });

  it("doc states hermes self-call is reserved / no default attach", () => {
    const hasReserved = DOC.toLowerCase().includes("reserved");
    const hasNoDefault = DOC.includes("no default attach");
    expect(hasReserved).toBe(true);
    expect(hasNoDefault).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. 3 injection surfaces compared
// -----------------------------------------------------------------

describe("3 injection surfaces compared", () => {
  it("doc compares 3 surfaces: A (handoff) / B (task prompt) / C (default system prompt)", () => {
    // Surface A markers
    expect(
      DOC.includes("A") && DOC.includes("handoff payload"),
      "doc must compare Surface A (handoff)"
    ).toBe(true);
    // Surface B markers
    expect(
      DOC.includes("B") && DOC.includes("task prompt"),
      "doc must compare Surface B (task prompt preamble)"
    ).toBe(true);
    // Surface C markers
    expect(
      DOC.includes("C") && DOC.includes("default system prompt"),
      "doc must compare Surface C (default system prompt)"
    ).toBe(true);
  });

  it("doc recommends handoff / task prompt injection first", () => {
    expect(DOC).toContain("推荐");
    expect(DOC).toContain("B");
    // The recommendation must point at B (task prompt preamble)
    const lower = DOC.toLowerCase();
    expect(lower).toContain("surface b");
  });

  it("doc rejects direct global default system prompt as first step", () => {
    const hasReject = /不推荐|reject|高 blast|do not.*first step/i.test(DOC);
    expect(hasReject, "doc must reject Surface C as first step").toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. trigger conditions
// -----------------------------------------------------------------

describe("trigger conditions", () => {
  it("doc covers save/ingest/archive keywords", () => {
    expect(DOC).toContain("save");
    expect(DOC).toContain("ingest");
    expect(DOC).toContain("archive");
  });

  it("doc covers research/comparison/selection task kind", () => {
    expect(DOC).toContain("research");
    expect(DOC).toContain("comparison");
    expect(DOC).toContain("selection");
  });

  it("doc covers handoff context has ingest_draft / flush_pending", () => {
    expect(DOC).toContain("ingest_draft");
    expect(DOC).toContain("flush_pending");
  });

  it("doc covers local_known + newly_found present", () => {
    expect(DOC).toContain("local_known");
    expect(DOC).toContain("newly_found");
  });

  it("doc covers ordinary code-only task without knowledge intent does not attach", () => {
    expect(DOC.toLowerCase().includes("ordinary code-only task") || DOC.includes("Ordinary code-only")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. runtime safety gates
// -----------------------------------------------------------------

describe("runtime safety gates", () => {
  it("doc covers 10 safety gates", () => {
    // Look for the 10 numbered items under § 10
    for (let i = 1; i <= 10; i += 1) {
      const needle = `${i}. **`;
      expect(
        DOC.includes(needle),
        `safety gate ${i} not found in § 10`
      ).toBe(true);
    }
  });

  it("safety gate: snippet source must come from helpers", () => {
    expect(DOC).toContain("buildKnowledgeAgentContractSnippet");
    expect(DOC).toContain("buildKnowledgeHandoffContractSnippet");
  });

  it("safety gate: runtime_flush_allowed=false", () => {
    expect(DOC).toContain("runtime_flush_allowed");
    expect(DOC).toContain("false");
  });

  it("safety gate: no knowledgeIngest / knowledgeSearch / IPC / cron", () => {
    expect(DOC).toContain("knowledgeIngest");
    expect(DOC).toContain("knowledgeSearch");
    expect(DOC).toContain("IPC");
    expect(DOC).toContain("cron");
  });

  it("safety gate: no Obsidian / MEMORY / .wolf path", () => {
    expect(DOC).toContain("Obsidian");
    expect(DOC).toContain("MEMORY");
    expect(DOC).toContain(".wolf");
  });

  it("safety gate: target_agent must not be hermes self-call unless explicit override", () => {
    expect(DOC).toContain("hermes");
    expect(DOC).toContain("override");
  });

  it("safety gate: injection must be visible in dry-run artifact before real dispatch", () => {
    expect(DOC).toContain("dry-run artifact");
  });
});

// -----------------------------------------------------------------
// 7. failure modes
// -----------------------------------------------------------------

describe("failure modes", () => {
  it("doc covers snippet missing when expected", () => {
    expect(DOC.toLowerCase()).toContain("snippet missing when expected");
  });

  it("doc covers snippet attached to ordinary code task", () => {
    expect(DOC.toLowerCase()).toContain("snippet attached to ordinary code task");
  });

  it("doc covers snippet attached to hermes self-call", () => {
    expect(DOC.toLowerCase()).toContain("snippet attached to hermes self-call");
  });

  it("doc covers runtime token leakage", () => {
    expect(DOC.toLowerCase()).toContain("runtime token leakage");
  });

  it("doc covers overlong snippet", () => {
    expect(DOC.toLowerCase()).toContain("overlong snippet");
  });

  it("doc covers user-visible overpromise wording", () => {
    expect(DOC.toLowerCase()).toContain("overpromise");
  });

  it("doc covers source fidelity or bucket semantics omitted", () => {
    expect(DOC.toLowerCase()).toContain("source fidelity or bucket semantics omitted");
  });

  it("doc covers dispatch prompt changed without artifact", () => {
    expect(DOC.toLowerCase()).toContain("dispatch prompt changed without artifact");
  });
});

// -----------------------------------------------------------------
// 8. rollback strategy
// -----------------------------------------------------------------

describe("rollback strategy", () => {
  it("doc covers feature flag (KNOWLEDGE_CONTRACT_INJECTION_ENABLED)", () => {
    expect(DOC).toContain("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });

  it("doc covers remove from dispatch prompt", () => {
    expect(DOC.toLowerCase()).toContain("remove");
    expect(DOC.toLowerCase()).toContain("dispatch prompt");
  });

  it("doc covers fall back to L4", () => {
    expect(DOC.toLowerCase()).toContain("fall back to l4");
  });

  it("doc covers preserve no-write", () => {
    expect(DOC.toLowerCase()).toContain("preserve no-write");
  });

  it("doc covers keep live flush disabled", () => {
    expect(DOC.toLowerCase()).toContain("keep live flush disabled");
  });
});

// -----------------------------------------------------------------
// 9. design fixture
// -----------------------------------------------------------------

describe("design fixture", () => {
  it("file exists and parses", () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true);
    expect(FIXTURE.schema_version).toBe("1.0.0");
    expect(FIXTURE.slice).toBe("008A");
    expect(FIXTURE.kind).toBe("runtime-default-injection-design");
  });

  it("fixture covers 4 targets", () => {
    const names = FIXTURE.targets.map((t: { name: string }) => t.name);
    for (const t of TARGETS) {
      expect(names, `fixture missing target: ${t}`).toContain(t);
    }
  });

  it("fixture compares 3 surfaces", () => {
    expect(FIXTURE.surfaces.length).toBe(3);
  });

  it("fixture recommends Surface B (task prompt preamble)", () => {
    expect(FIXTURE.recommended_surface.name).toContain("task_prompt_preamble");
  });

  it("fixture trigger_conditions covers 5 categories", () => {
    expect(FIXTURE.trigger_conditions.length).toBeGreaterThanOrEqual(5);
  });

  it("fixture safety_gates covers at least 8 items", () => {
    expect(FIXTURE.safety_gates.length).toBeGreaterThanOrEqual(8);
  });

  it("fixture failure_modes covers at least 8 items", () => {
    expect(FIXTURE.failure_modes.length).toBeGreaterThanOrEqual(8);
  });

  it("fixture rollback_strategy covers feature flag + 4 sub-strategies", () => {
    expect(FIXTURE.rollback_strategy.feature_flag).toBeDefined();
    expect(FIXTURE.rollback_strategy.remove_from_dispatch_prompt).toBeDefined();
    expect(FIXTURE.rollback_strategy.fall_back_to_L4).toBeDefined();
    expect(FIXTURE.rollback_strategy.preserve_no_write).toBeDefined();
    expect(FIXTURE.rollback_strategy.keep_live_flush_disabled).toBeDefined();
  });

  it("fixture go_no_go GO: design only", () => {
    expect(FIXTURE.go_no_go.GO.length).toBeGreaterThan(0);
    const goText = FIXTURE.go_no_go.GO.join(" ").toLowerCase();
    expect(goText).toContain("design only");
  });

  it("fixture go_no_go NOT_GO: L5 implementation + real handoff + live flush + live search + IPC", () => {
    const notGo = FIXTURE.go_no_go.NOT_GO.join(" ").toLowerCase();
    for (const item of [
      "l5 runtime default injection implementation",
      "real handoff write",
      "live flush",
      "live search",
      "ipc",
    ]) {
      expect(notGo, `fixture missing NOT-GO: ${item}`).toContain(item);
    }
  });
});

// -----------------------------------------------------------------
// 10. NOT-GO for runtime implementation in this slice
// -----------------------------------------------------------------

describe("NOT-GO for runtime implementation in this slice", () => {
  it("doc states NOT-GO for L5 runtime default injection", () => {
    expect(DOC.includes("L5") && DOC.includes("runtime default injection")).toBe(true);
    const hasNotGo = /L5[^\n]{0,200}(不实现|❌|NOT[- ]GO|留 future|留 008)/i.test(DOC);
    expect(hasNotGo, "doc must state L5 runtime injection NOT-GO").toBe(true);
  });

  it("doc states NOT-GO for real handoff write", () => {
    const hasNotGo = /real handoff write[^\n]{0,80}(❌|不写真实|留 008)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO real handoff write").toBe(true);
  });

  it("doc states NOT-GO for live flush", () => {
    const hasNotGo = /live flush[^\n]{0,80}(❌|留)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO live flush").toBe(true);
  });

  it("doc states NOT-GO for live search adapter", () => {
    const hasNotGo = /live search[^\n]{0,80}(❌|留)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO live search").toBe(true);
  });

  it("doc states NOT-GO for IPC / gateway adapter", () => {
    const hasNotGo = /ipc[^\n]{0,200}(❌|留|adapter)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO IPC").toBe(true);
  });
});

// -----------------------------------------------------------------
// 11. no real handoff write in this slice (mtime guard)
// -----------------------------------------------------------------

describe("mtime guard (no real handoff write in this slice)", () => {
  it("doc explicitly states mtime guard preserved on rollback", () => {
    // The doc must mention mtime + the principle of no-write (regardless of
    // whether the exact baseline digits 1780195726 / 1780230084 are quoted).
    expect(DOC.toLowerCase()).toContain("mtime");
    // Either 1780195726 or the literal "no write" / "no-write" must appear
    const hasMtime = DOC.includes("1780195726") || DOC.toLowerCase().includes("no write") || DOC.toLowerCase().includes("no-write");
    expect(hasMtime, "doc must mention mtime guard or no-write").toBe(true);
  });
});
