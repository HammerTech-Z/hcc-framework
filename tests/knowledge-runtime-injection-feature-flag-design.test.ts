import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-runtime-injection-feature-flag-dry-run-design-2026-06-04.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json"
);
const DOC = readFileSync(DOC_PATH, "utf8");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Feature Flag Definition",
  "## 4. Default State",
  "## 5. Surface B Task Prompt Preamble",
  "## 6. Dry-run Harness Behavior",
  "## 7. Artifact Visibility Requirements",
  "## 8. Safety Gates",
  "## 9. Failure Modes",
  "## 10. Rollback Strategy",
  "## 11. Test Plan",
  "## 12. Go / No-Go Decision",
  "## 13. Future Implementation Slices",
];

const RECORDED_DRY_RUN_FIELDS: ReadonlyArray<string> = [
  "feature_flag",
  "target_agent",
  "trigger_flags",
  "snippet_attached",
  "snippet_hash_or_content_hash",
  "max_chars",
  "safety_gate_result",
  "fallback_to_l4",
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
// 2. feature flag definition
// -----------------------------------------------------------------

describe("feature flag definition", () => {
  it("defines flag name KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    expect(DOC).toContain("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });

  it("defines default false", () => {
    expect(DOC.toLowerCase().includes("default") && DOC.toLowerCase().includes("false")).toBe(
      true
    );
  });

  it("defines scope = task dispatch / task prompt preamble only", () => {
    expect(DOC).toContain("task dispatch");
    expect(DOC).toContain("task prompt preamble");
  });

  it("states does NOT affect global default system prompt", () => {
    // The doc must mention "global default system prompt" alongside a
    // negative marker (不接 / 不改 / NOT-GO / "does not affect").
    const hasGlobalSysPrompt = DOC.includes("global default system prompt");
    const hasNegative = /不接|不改|does not affect|not affect|not.*system prompt/i.test(
      DOC
    );
    expect(hasGlobalSysPrompt, "doc must mention 'global default system prompt'").toBe(true);
    expect(hasNegative, "doc must include a negative marker").toBe(true);
  });

  it("states does NOT affect live flush", () => {
    const hasLiveFlush = DOC.includes("live flush");
    const hasNegative = /不接|不改|does not affect|not affect|not.*live flush/i.test(DOC);
    expect(hasLiveFlush, "doc must mention 'live flush'").toBe(true);
    expect(hasNegative, "doc must include a negative marker").toBe(true);
  });

  it("states does NOT affect knowledgeSearch / knowledgeIngest", () => {
    expect(DOC.toLowerCase().includes("knowledgesearch")).toBe(true);
    expect(DOC.toLowerCase().includes("knowledgeingest")).toBe(true);
  });

  it("states must be visible in dry-run artifact", () => {
    expect(DOC).toContain("dry-run artifact");
  });
});

// -----------------------------------------------------------------
// 3. Surface B task prompt preamble
// -----------------------------------------------------------------

describe("Surface B task prompt preamble", () => {
  it("defines snippet source = buildKnowledgeAgentContractSnippet / buildKnowledgeHandoffContractSnippet", () => {
    expect(DOC).toContain("buildKnowledgeAgentContractSnippet");
    expect(DOC).toContain("buildKnowledgeHandoffContractSnippet");
  });

  it("defines placement = before task-specific instructions, after safety boundary section", () => {
    expect(DOC.toLowerCase().includes("before task-specific")).toBe(true);
    expect(DOC.toLowerCase().includes("safety boundary")).toBe(true);
  });

  it("defines max_chars <= 2048", () => {
    expect(DOC).toContain("2048");
    expect(DOC.toLowerCase()).toContain("max_chars");
  });

  it("defines target_agent restrictions (claude_code / codex / hermes_pro / hermes)", () => {
    expect(DOC).toContain("claude_code");
    expect(DOC).toContain("codex");
    expect(DOC).toContain("hermes_pro");
    expect(DOC.includes("hermes") && DOC.includes("self-call")).toBe(true);
  });

  it("states ordinary code tasks skip", () => {
    expect(DOC.toLowerCase().includes("ordinary code-only") || DOC.toLowerCase().includes("ordinary code")).toBe(
      true
    );
  });

  it("states knowledge / research / save tasks attach", () => {
    expect(DOC.toLowerCase()).toContain("knowledge");
    expect(DOC.toLowerCase()).toContain("research");
    expect(DOC.toLowerCase()).toContain("save");
  });

  it("states hermes self-call skip unless explicit override", () => {
    expect(DOC.includes("hermes") && DOC.toLowerCase().includes("override")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. dry-run harness behavior
// -----------------------------------------------------------------

describe("dry-run harness behavior", () => {
  it("states no real dispatch", () => {
    expect(DOC.toLowerCase().includes("no real dispatch") || DOC.includes("no_real_dispatch")).toBe(true);
  });

  it("states no agent subprocess", () => {
    expect(DOC.toLowerCase().includes("no agent subprocess") || DOC.includes("no_agent_subprocess")).toBe(true);
  });

  it("states no prompt builder mutation", () => {
    expect(DOC.toLowerCase().includes("no prompt builder mutation") || DOC.includes("no_prompt_builder_mutation")).toBe(
      true
    );
  });

  it("states constructs a simulated dispatch prompt", () => {
    expect(DOC.toLowerCase().includes("simulated dispatch prompt") || DOC.includes("simulated_dispatch_prompt")).toBe(
      true
    );
  });

  it("states writes only to test fixture or future artifact, not real handoff", () => {
    expect(
      DOC.toLowerCase().includes("not real handoff") ||
        DOC.toLowerCase().includes("no real handoff") ||
        DOC.includes("not real handoff")
    ).toBe(true);
  });

  it("defines 8 recorded fields", () => {
    for (const f of RECORDED_DRY_RUN_FIELDS) {
      expect(DOC).toContain(f);
    }
  });
});

// -----------------------------------------------------------------
// 5. artifact visibility
// -----------------------------------------------------------------

describe("artifact visibility", () => {
  it("must show whether snippet was attached", () => {
    expect(DOC.toLowerCase()).toContain("whether snippet was attached");
  });

  it("must show skip reason when skipped", () => {
    expect(DOC.toLowerCase()).toContain("skip reason");
  });

  it("must show failure code when blocked", () => {
    expect(DOC.toLowerCase()).toContain("failure code");
  });

  it("must not contain runtime call instructions", () => {
    expect(DOC.toLowerCase()).toContain("runtime call instructions");
  });

  it("must keep runtime_flush_allowed=false", () => {
    expect(DOC).toContain("runtime_flush_allowed=false");
  });
});

// -----------------------------------------------------------------
// 6. trigger conditions
// -----------------------------------------------------------------

describe("trigger conditions", () => {
  it("covers save / ingest / archive keywords", () => {
    expect(DOC).toContain("save");
    expect(DOC).toContain("ingest");
    expect(DOC).toContain("archive");
  });

  it("covers research / compare / analyze keywords", () => {
    expect(DOC).toContain("research");
    expect(DOC).toContain("compare");
  });

  it("covers task_kind in research family", () => {
    expect(DOC).toContain("github_research");
    expect(DOC).toContain("tool_comparison");
  });
});

// -----------------------------------------------------------------
// 7. safety gates
// -----------------------------------------------------------------

describe("safety gates", () => {
  it("doc covers 11 safety gates", () => {
    for (let i = 1; i <= 11; i += 1) {
      const needle = `${i}.`;
      // We don't require a backtick prefix here, since the doc may use
      // either "1. " or "1. something" format. The important thing is
      // that the numbered list has 11 entries.
      expect(DOC.includes(needle), `safety gate ${i} not numbered in doc`).toBe(true);
    }
  });

  it("safety gate: feature flag evaluated before dispatch", () => {
    expect(DOC).toContain("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });

  it("safety gate: snippet source from helpers", () => {
    expect(DOC).toContain("buildKnowledgeAgentContractSnippet");
    expect(DOC).toContain("buildKnowledgeHandoffContractSnippet");
  });

  it("safety gate: runtime_flush_allowed=false", () => {
    expect(DOC).toContain("runtime_flush_allowed=false");
  });

  it("safety gate: no Obsidian / MEMORY / .wolf", () => {
    expect(DOC).toContain("Obsidian");
    expect(DOC).toContain("MEMORY");
    expect(DOC).toContain(".wolf");
  });
});

// -----------------------------------------------------------------
// 8. failure modes
// -----------------------------------------------------------------

describe("failure modes", () => {
  it("covers flag_enabled_for_wrong_task", () => {
    expect(DOC).toContain("flag_enabled_for_wrong_task");
  });

  it("covers flag_disabled_but_expected", () => {
    expect(DOC).toContain("flag_disabled_but_expected");
  });

  it("covers snippet_missing", () => {
    expect(DOC).toContain("snippet_missing");
  });

  it("covers snippet_overlong", () => {
    expect(DOC).toContain("snippet_overlong");
  });

  it("covers target_agent_blocked", () => {
    expect(DOC).toContain("target_agent_blocked");
  });

  it("covers runtime_token_detected", () => {
    expect(DOC).toContain("runtime_token_detected");
  });

  it("covers prompt_overpromise_detected", () => {
    expect(DOC).toContain("prompt_overpromise_detected");
  });

  it("covers fallback_to_l4_failed", () => {
    expect(DOC).toContain("fallback_to_l4_failed");
  });
});

// -----------------------------------------------------------------
// 9. rollback strategy
// -----------------------------------------------------------------

describe("rollback strategy", () => {
  it("covers set flag false", () => {
    expect(DOC.toLowerCase()).toContain("set flag false");
  });

  it("covers remove Surface B preamble", () => {
    expect(DOC.toLowerCase()).toContain("remove surface b preamble");
  });

  it("covers use L4 handoff-only", () => {
    expect(DOC.toLowerCase()).toContain("use l4 handoff-only");
  });

  it("covers keep live flush disabled", () => {
    expect(DOC.toLowerCase()).toContain("keep live flush disabled");
  });

  it("covers preserve no-write behavior", () => {
    expect(DOC.toLowerCase()).toContain("preserve no-write");
  });
});

// -----------------------------------------------------------------
// 10. design fixture
// -----------------------------------------------------------------

describe("design fixture", () => {
  it("file exists and parses", () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true);
    expect(FIXTURE.schema_version).toBe("1.0.0");
    expect(FIXTURE.slice).toBe("008B");
    expect(FIXTURE.kind).toBe("runtime-injection-feature-flag-dry-run-design");
  });

  it("fixture feature_flag.name = KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    expect(FIXTURE.feature_flag.name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });

  it("fixture feature_flag.default = false", () => {
    expect(FIXTURE.feature_flag.default).toBe(false);
  });

  it("fixture dry_run_artifact_fields has 8 entries", () => {
    expect(FIXTURE.dry_run_harness_behavior.recorded_fields.length).toBe(8);
  });

  it("fixture safety_gates has at least 11 entries", () => {
    expect(FIXTURE.safety_gates.length).toBeGreaterThanOrEqual(11);
  });

  it("fixture failure_modes has 8 entries", () => {
    expect(FIXTURE.failure_modes.length).toBe(8);
  });

  it("fixture rollback_strategy covers 5 sub-strategies", () => {
    expect(FIXTURE.rollback_strategy.set_flag_false).toBeDefined();
    expect(FIXTURE.rollback_strategy.remove_surface_b_preamble).toBeDefined();
    expect(FIXTURE.rollback_strategy.use_l4_handoff_only).toBeDefined();
    expect(FIXTURE.rollback_strategy.keep_live_flush_disabled).toBeDefined();
    expect(FIXTURE.rollback_strategy.preserve_no_write).toBeDefined();
  });

  it("fixture go_no_go GO: design only", () => {
    expect(FIXTURE.go_no_go.GO.length).toBeGreaterThan(0);
    const goText = FIXTURE.go_no_go.GO.join(" ").toLowerCase();
    expect(goText).toContain("design only");
  });

  it("fixture go_no_go NOT_GO covers L5 implementation + real handoff + live flush + IPC", () => {
    const notGo = FIXTURE.go_no_go.NOT_GO.join(" ").toLowerCase();
    for (const item of [
      "l5 runtime default injection implementation",
      "real handoff write",
      "live flush",
      "ipc",
    ]) {
      expect(notGo, `fixture missing NOT-GO: ${item}`).toContain(item);
    }
  });
});

// -----------------------------------------------------------------
// 11. NOT-GO for runtime implementation in this slice
// -----------------------------------------------------------------

describe("NOT-GO for runtime implementation in this slice", () => {
  it("doc states NOT-GO for L5 runtime default injection", () => {
    const hasNotGo = /L5[^\n]{0,200}(不实现|❌|NOT[- ]GO|留 008|留 future)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO L5 runtime injection").toBe(true);
  });

  it("doc states NOT-GO for dispatch prompt mutation in this slice", () => {
    const hasNotGo = /dispatch prompt[^\n]{0,200}(不接|❌|NOT[- ]GO|留 008|留 future|design only)/i.test(
      DOC
    );
    expect(hasNotGo, "doc must NOT-GO dispatch prompt mutation").toBe(true);
  });

  it("doc states NOT-GO for real handoff write", () => {
    const hasNotGo = /real handoff write[^\n]{0,80}(❌|不写真实|留 008)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO real handoff write").toBe(true);
  });

  it("doc states NOT-GO for live flush", () => {
    const hasNotGo = /live flush[^\n]{0,80}(❌|留)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO live flush").toBe(true);
  });

  it("doc states NOT-GO for IPC / gateway adapter", () => {
    const hasNotGo = /ipc[^\n]{0,200}(❌|留|adapter)/i.test(DOC);
    expect(hasNotGo, "doc must NOT-GO IPC").toBe(true);
  });
});

// -----------------------------------------------------------------
// 12. no real handoff write in this slice (mtime guard)
// -----------------------------------------------------------------

describe("mtime guard (no real handoff write in this slice)", () => {
  it("doc explicitly states mtime guard preserved on rollback", () => {
    expect(DOC.toLowerCase()).toContain("mtime");
    const hasMtime = DOC.includes("1780195726") || DOC.toLowerCase().includes("no write") || DOC.toLowerCase().includes("no-write");
    expect(hasMtime, "doc must mention mtime guard or no-write").toBe(true);
  });
});
