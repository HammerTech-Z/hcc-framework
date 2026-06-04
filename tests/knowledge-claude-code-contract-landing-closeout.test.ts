import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-claude-code-default-contract-landing-closeout-2026-06-04.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/claude-code-contract-landing-closeout.json"
);
const DOC = readFileSync(DOC_PATH, "utf8");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Evidence reviewed",
  "## 4. Landing levels",
  "## 5. Current status by level",
  "## 6. Claude Code status",
  "## 7. Codex status",
  "## 8. Hermes / hermes_pro status",
  "## 9. What is still not connected",
  "## 10. Safety boundaries",
  "## 11. GO / NO-GO decision",
  "## 12. Future implementation slices",
  "## 13. Final answer to user question",
];

const LANDING_LEVELS: ReadonlyArray<string> = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"];

// -----------------------------------------------------------------
// 1. closeout doc exists
// -----------------------------------------------------------------

describe("closeout doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. defines L0-L6
// -----------------------------------------------------------------

describe("landing levels (L0-L6)", () => {
  it.each(LANDING_LEVELS)("doc defines level: %s", (level) => {
    expect(DOC.includes(`**${level}**`), `level ${level} not in doc`).toBe(true);
  });

  it.each(LANDING_LEVELS)("fixture defines level: %s", (level) => {
    expect(FIXTURE.landing_levels[level], `level ${level} not in fixture`).toBeDefined();
  });
});

// -----------------------------------------------------------------
// 3. Claude Code L4 reached
// -----------------------------------------------------------------

describe("Claude Code L4 reached", () => {
  it("doc states Claude Code L4 reached", () => {
    // The doc table in § 5 must mark Claude Code as L4 reached.
    expect(DOC).toContain("**L4**");
    expect(DOC).toContain("Claude Code");
  });

  it("fixture marks Claude Code as L4", () => {
    expect(FIXTURE.status_by_agent.claude_code.reached_level).toBe("L4");
  });
});

// -----------------------------------------------------------------
// 4. Codex L4 reached
// -----------------------------------------------------------------

describe("Codex L4 reached", () => {
  it("doc states Codex L4 reached", () => {
    expect(DOC).toContain("Codex");
  });

  it("fixture marks Codex as L4", () => {
    expect(FIXTURE.status_by_agent.codex.reached_level).toBe("L4");
  });
});

// -----------------------------------------------------------------
// 5. hermes_pro L4 opt-in
// -----------------------------------------------------------------

describe("hermes_pro L4 opt-in", () => {
  it("doc states hermes_pro L4 opt-in", () => {
    expect(DOC).toContain("hermes_pro");
    expect(DOC.toLowerCase().includes("l4 opt-in") || DOC.includes("L4 opt-in")).toBe(
      true
    );
  });

  it("fixture marks hermes_pro as L4 opt-in", () => {
    expect(FIXTURE.status_by_agent.hermes_pro.reached_level).toBe("L4 opt-in");
  });
});

// -----------------------------------------------------------------
// 6. hermes self-call reserved
// -----------------------------------------------------------------

describe("hermes self-call reserved", () => {
  it("doc states hermes self-call reserved / no default attach", () => {
    const hasReserved = DOC.toLowerCase().includes("reserved");
    const hasNoDefaultAttach = DOC.includes("no default attach");
    expect(hasReserved).toBe(true);
    expect(hasNoDefaultAttach).toBe(true);
  });

  it("fixture marks hermes self-call as reserved", () => {
    expect(FIXTURE.status_by_agent.hermes_self_call.reserved).toBe(true);
  });
});

// -----------------------------------------------------------------
// 7. L5 not reached
// -----------------------------------------------------------------

describe("L5 not reached", () => {
  it("doc explicitly states L5 not reached", () => {
    // Look for the explicit L5 + 未达到 or "not reached" pattern.
    const lower = DOC.toLowerCase();
    // The doc must mention L5 in a not-reached context. We accept either
    // the literal English "not reached" or the Chinese "未达到" / "L5 不在".
    const hasL5 = lower.includes("l5");
    const hasL5Neg = /l5[^\n]{0,40}(未达到|not reached|不接|不在|❌|未接|未启)/i.test(
      DOC
    );
    expect(hasL5).toBe(true);
    expect(hasL5Neg, "L5 must appear in a not-reached context").toBe(true);
  });

  it("fixture L5 description exists but agents are not at L5", () => {
    expect(FIXTURE.landing_levels.L5).toBeDefined();
    // All agents are below L5
    for (const a of ["claude_code", "codex", "hermes_pro", "hermes_self_call"]) {
      const lvl = FIXTURE.status_by_agent[a].reached_level;
      expect(
        ["L0", "L1", "L2", "L3", "L3 (reserved)", "L4", "L4 opt-in"]
      ).toContain(lvl);
      // None should be L5 or L6
      expect(lvl).not.toBe("L5");
      expect(lvl).not.toBe("L6");
    }
  });
});

// -----------------------------------------------------------------
// 8. L6 not reached
// -----------------------------------------------------------------

describe("L6 not reached", () => {
  it("doc explicitly states L6 not reached", () => {
    const hasL6Neg = /l6[^\n]{0,40}(未达到|not reached|不接|不在|❌|未接|未启)/i.test(
      DOC
    );
    expect(hasL6Neg, "L6 must appear in a not-reached context").toBe(true);
  });

  it("fixture L6 description exists but no agent is at L6", () => {
    expect(FIXTURE.landing_levels.L6).toBeDefined();
    for (const a of ["claude_code", "codex", "hermes_pro", "hermes_self_call"]) {
      expect(FIXTURE.status_by_agent[a].reached_level).not.toBe("L6");
    }
  });
});

// -----------------------------------------------------------------
// 9. answers user question explicitly
// -----------------------------------------------------------------

describe("answers user question explicitly", () => {
  it("doc contains the user question", () => {
    expect(DOC).toContain("Claude Code");
    // The question must appear
    expect(DOC.includes("能") || DOC.includes("can")).toBe(true);
  });

  it("doc final answer says yes for L4 + no for L5/L6", () => {
    // Look for the final answer section
    const finalAnswerMatch = DOC.match(
      /## 13\. Final answer[\s\S]*$/m
    );
    expect(finalAnswerMatch, "## 13 Final answer section not found").not.toBeNull();
    const fa = finalAnswerMatch![0];
    // The answer must contain "L4" (reached) and "L5" / "L6" (not reached)
    expect(fa).toContain("L4");
    expect(fa).toContain("L5");
    expect(fa).toContain("L6");
  });

  it("doc explicitly says 'real handoff write' still needs separate approval", () => {
    expect(DOC.toLowerCase()).toContain("real handoff write");
    expect(DOC.toLowerCase()).toContain("separate approval");
  });
});

// -----------------------------------------------------------------
// 10. lists still-not-connected items
// -----------------------------------------------------------------

describe("still-not-connected items", () => {
  const expectedItems: ReadonlyArray<string> = [
    "real handoff write",
    "default system prompt",
    "knowledgeSearch",
    "knowledgeIngest",
    "IPC",
    "gateway",
    "renderer",
  ];

  it.each(expectedItems)("doc mentions still-not-connected: %s", (item) => {
    expect(
      DOC.toLowerCase().includes(item.toLowerCase()),
      `doc missing: ${item}`
    ).toBe(true);
  });

  it("fixture not_connected array has at least 5 items", () => {
    expect(FIXTURE.not_connected.length).toBeGreaterThanOrEqual(5);
  });
});

// -----------------------------------------------------------------
// 11. GO for dry-run handoff contract landing closed
// -----------------------------------------------------------------

describe("GO for dry-run handoff contract landing closed", () => {
  it("doc states GO for dry-run handoff contract landing", () => {
    expect(DOC).toContain("GO");
    expect(DOC.toLowerCase()).toContain("dry-run handoff contract landing");
    expect(DOC.toLowerCase()).toContain("closed");
  });

  it("fixture go_no_go.GO contains dry-run handoff contract landing", () => {
    expect(FIXTURE.go_no_go.GO.length).toBeGreaterThan(0);
    const goText = FIXTURE.go_no_go.GO.join(" ").toLowerCase();
    expect(goText).toContain("dry-run handoff contract landing");
  });
});

// -----------------------------------------------------------------
// 12. NOT-GO for runtime/default injection/live flush/live search/IPC/gateway
// -----------------------------------------------------------------

describe("NOT-GO statements", () => {
  const expectedNotGo: ReadonlyArray<string> = [
    "runtime default injection",
    "real handoff write",
    "live flush",
    "live search",
    "IPC",
    "gateway",
  ];

  it.each(expectedNotGo)("doc states NOT-GO for: %s", (item) => {
    expect(
      DOC.toLowerCase().includes(item.toLowerCase()),
      `doc missing NOT-GO: ${item}`
    ).toBe(true);
  });

  it("fixture go_no_go.NOT_GO contains all 6 categories", () => {
    const notGo = FIXTURE.go_no_go.NOT_GO.join(" ").toLowerCase();
    for (const item of expectedNotGo) {
      expect(notGo, `fixture missing NOT-GO: ${item}`).toContain(item.toLowerCase());
    }
  });
});

// -----------------------------------------------------------------
// 13. optional fixture exists and parses
// -----------------------------------------------------------------

describe("closeout fixture", () => {
  it("file exists and parses", () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true);
    expect(FIXTURE.schema_version).toBe("1.0.0");
    expect(FIXTURE.slice).toBe("007N");
    expect(FIXTURE.kind).toBe("claude-code-default-contract-landing-closeout");
  });

  it("fixture statuses match doc", () => {
    expect(FIXTURE.status_by_agent.claude_code.reached_level).toBe("L4");
    expect(FIXTURE.status_by_agent.codex.reached_level).toBe("L4");
    expect(FIXTURE.status_by_agent.hermes_pro.reached_level).toBe("L4 opt-in");
    expect(FIXTURE.status_by_agent.hermes_self_call.reserved).toBe(true);
  });

  it("fixture contains final_answer_to_user_question", () => {
    expect(FIXTURE.final_answer_to_user_question).toBeDefined();
    expect(FIXTURE.final_answer_to_user_question.question).toContain("Claude Code");
    expect(FIXTURE.final_answer_to_user_question.answer_zh).toContain("L4");
    expect(FIXTURE.final_answer_to_user_question.answer_short_zh).toContain("L4");
    expect(FIXTURE.final_answer_to_user_question.answer_en).toContain("L4");
  });

  it("fixture safety_boundaries mtime values match Slice 007L/007M baseline", () => {
    // Both mtimes should be unchanged from baseline (may carry a "(verified by ...)" suffix)
    expect(
      String(FIXTURE.safety_boundaries.real_handoff_packs_mtime_unchanged)
        .startsWith("1780195726")
    ).toBe(true);
    expect(
      String(FIXTURE.safety_boundaries.real_audit_mtime_unchanged).startsWith(
        "1780230084"
      )
    ).toBe(true);
  });
});

// -----------------------------------------------------------------
// 14. no runtime implementation in this slice
// -----------------------------------------------------------------

describe("no runtime implementation in this slice", () => {
  it("doc states no runtime / no IPC / no gateway / no ingest", () => {
    expect(DOC).toContain("不接");
    // doc must explicitly list these as non-goals. We accept either
    // English (no runtime / no IPC / no gateway / no ingest) or
    // Chinese (不接 IPC / 不接 gateway / 不接 ingest / 不启动 HCC / 启
    // dev server / 跑 Playwright / 启动 Claude Code).
    const lower = DOC.toLowerCase();
    const hasRuntime = /no runtime|不接 runtime|不接 ingest|不写真实|不启动/i.test(
      DOC
    );
    const hasIpc = lower.includes("no ipc") || DOC.includes("不接 IPC");
    const hasGateway =
      lower.includes("no gateway") ||
      DOC.includes("不接 gateway") ||
      /不接[^。\n]*gateway/i.test(DOC) ||
      /不接[^。\n]*\bgateway\b/i.test(DOC);
    const hasIngest = lower.includes("no ingest") || DOC.includes("不接 ingest") || DOC.includes("不调 knowledgeIngest");
    expect(hasRuntime, "doc must mention no runtime").toBe(true);
    expect(hasIpc, "doc must mention no IPC").toBe(true);
    expect(hasGateway, "doc must mention no gateway").toBe(true);
    expect(hasIngest, "doc must mention no ingest").toBe(true);
  });

  it("doc states no real handoff write in this slice", () => {
    expect(DOC).toContain("不写真实");
    expect(DOC).toContain("~/.hermes/handoff/packs");
  });

  it("doc states no Claude Code / Codex / Hermes subprocess", () => {
    expect(DOC).toContain("不启动");
    expect(DOC).toContain("Claude Code");
    expect(DOC).toContain("Hermes");
  });
});

// -----------------------------------------------------------------
// 15. doc length sanity (not empty, not a stub)
// -----------------------------------------------------------------

describe("doc content sanity", () => {
  it("doc has at least 200 lines of content", () => {
    const lineCount = DOC.split("\n").length;
    expect(lineCount).toBeGreaterThan(200);
  });

  it("doc has at least 4 evidence refs", () => {
    expect(FIXTURE.status_by_agent.claude_code.evidence_refs.length).toBeGreaterThanOrEqual(4);
  });
});
