// Hermes Pro — Knowledge Runtime Injection Surface B (Slice 008F, no runtime)
// Pure function tests for Surface B dry-run implementation.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

import {
  buildTaskPromptWithKnowledgeContractSurfaceB,
  buildKnowledgeContractSurfaceBPreamble,
  shouldApplyKnowledgeContractSurfaceB,
  assertKnowledgeSurfaceBNoRuntime,
  KNOWLEDGE_SURFACE_B_SCHEMA_VERSION,
  SURFACE_B_SLICE,
  SURFACE_B_MODE,
  SURFACE_B_NAME,
  KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
  DEFAULT_SURFACE_B_MAX_CHARS,
  type KnowledgeSurfaceBInput,
  type KnowledgeSurfaceBOutput,
} from "../src/shared/lib/knowledge-runtime-injection-surface-b";

import fixture from "./fixtures/knowledge-reuse/runtime-injection-surface-b.json";

const BASELINE_HANDOFF_MTIME = 1780195726;
const BASELINE_AUDIT_MTIME = 1780230084;

function baseInput(
  overrides: Partial<KnowledgeSurfaceBInput> = {}
): KnowledgeSurfaceBInput {
  return {
    featureFlagEnabled: true,
    targetAgent: "claude_code",
    userRequest: "save to knowledge",
    baseTaskPrompt: "task: research X",
    ...overrides,
  };
}

// -----------------------------------------------------------------
// 1. helper exports
// -----------------------------------------------------------------

describe("008F — helper exports", () => {
  it("schema_version is 1.0.0", () => {
    expect(KNOWLEDGE_SURFACE_B_SCHEMA_VERSION).toBe("1.0.0");
  });
  it("slice is 008F", () => {
    expect(SURFACE_B_SLICE).toBe("008F");
  });
  it("mode is surface_b_dry_run_implementation", () => {
    expect(SURFACE_B_MODE).toBe("surface_b_dry_run_implementation");
  });
  it("surface is task_prompt_preamble", () => {
    expect(SURFACE_B_NAME).toBe("task_prompt_preamble");
  });
  it("feature flag name is KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    expect(KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG).toBe(
      "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"
    );
  });
  it("default max_chars is 2048", () => {
    expect(DEFAULT_SURFACE_B_MAX_CHARS).toBe(2048);
  });
});

// -----------------------------------------------------------------
// 2. flag disabled
// -----------------------------------------------------------------

describe("008F — flag disabled", () => {
  it("skips preamble and falls back to L4", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ featureFlagEnabled: false })
    );
    expect(out.preamble_attached).toBe(false);
    expect(out.fallback_to_l4).toBe(true);
    expect(out.skip_reason).toBe("flag_disabled");
    expect(out.feature_flag_enabled).toBe(false);
    expect(out.preamble_text).toBeNull();
    expect(out.final_task_prompt).toBe("task: research X");
  });
});

// -----------------------------------------------------------------
// 3. target agent matrix
// -----------------------------------------------------------------

describe("008F — target agent matrix", () => {
  it("claude_code + flag + research attaches", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ targetAgent: "claude_code", userRequest: "research X" })
    );
    expect(out.target_agent).toBe("claude_code");
    expect(out.preamble_attached).toBe(true);
  });
  it("codex + flag + ingest_draft attaches", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        targetAgent: "codex",
        userRequest: "",
        handoffContext: { hasIngestDraft: true },
      })
    );
    expect(out.target_agent).toBe("codex");
    expect(out.preamble_attached).toBe(true);
  });
  it("hermes_pro + flag + local+newly attaches", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        targetAgent: "hermes_pro",
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(out.target_agent).toBe("hermes_pro");
    expect(out.preamble_attached).toBe(true);
  });
  it("hermes self-call + flag + save → reserved skip", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" })
    );
    expect(out.target_agent).toBe("hermes");
    expect(out.preamble_attached).toBe(false);
    expect(out.skip_reason).toBe("hermes_self_call_reserved");
    expect(out.hermes_reserved_marker).toBe(true);
  });
  it("hermes + flag + save + hermesOverride → attach with reserved marker", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        targetAgent: "hermes",
        userRequest: "save to knowledge",
        hermesOverride: true,
      })
    );
    expect(out.preamble_attached).toBe(true);
    expect(out.preamble_text).toContain(
      "[reserved — no default attach for hermes self-call]"
    );
    expect(out.hermes_reserved_marker).toBe(false);
  });
});

// -----------------------------------------------------------------
// 4. trigger matrix
// -----------------------------------------------------------------

describe("008F — trigger matrix", () => {
  it("save_keyword (en) fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "save to knowledge" })
    );
    expect(out.trigger_flags.save_keyword).toBe(true);
  });
  it("save_keyword (zh) fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "保存到知识库" })
    );
    expect(out.trigger_flags.save_keyword).toBe(true);
  });
  it("research_keyword (en) fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "research topic X" })
    );
    expect(out.trigger_flags.research_keyword).toBe(true);
  });
  it("research_keyword (zh) fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "调研主题 X" })
    );
    expect(out.trigger_flags.research_keyword).toBe(true);
  });
  it("research_task_kind fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ taskKind: "tool_comparison" })
    );
    expect(out.trigger_flags.research_task_kind).toBe(true);
  });
  it("has_ingest_draft fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "", handoffContext: { hasIngestDraft: true } })
    );
    expect(out.trigger_flags.has_ingest_draft).toBe(true);
  });
  it("has_flush_pending fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "", handoffContext: { hasFlushPending: true } })
    );
    expect(out.trigger_flags.has_flush_pending).toBe(true);
  });
  it("has_local_known_and_newly_found fires", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(out.trigger_flags.has_local_known_and_newly_found).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. hermes reserved
// -----------------------------------------------------------------

describe("008F — hermes reserved", () => {
  it("hermes + flag + save → skip + hermes_reserved_marker true", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" })
    );
    expect(out.preamble_attached).toBe(false);
    expect(out.hermes_reserved_marker).toBe(true);
  });
  it("hermes + flag off → skip + hermes_reserved_marker still true (target)", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        featureFlagEnabled: false,
        targetAgent: "hermes",
        userRequest: "save to knowledge",
      })
    );
    // hermes_reserved_marker = targetAgent==='hermes' && hermesOverride!==true
    expect(out.hermes_reserved_marker).toBe(true);
    expect(out.skip_reason).toBe("flag_disabled");
  });
  it("hermes + hermesOverride + trigger → attach + reserved_marker false", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        targetAgent: "hermes",
        userRequest: "save to knowledge",
        hermesOverride: true,
      })
    );
    expect(out.preamble_attached).toBe(true);
    expect(out.hermes_reserved_marker).toBe(false);
  });
});

// -----------------------------------------------------------------
// 6. ordinary code skip
// -----------------------------------------------------------------

describe("008F — ordinary code skip", () => {
  it("code-only task → skip + fallback", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "fix the bug in src/foo.ts" })
    );
    expect(out.preamble_attached).toBe(false);
    expect(out.fallback_to_l4).toBe(true);
    expect(out.skip_reason).toBe("no_trigger_fired");
    expect(out.trigger_flags.save_keyword).toBe(false);
    expect(out.trigger_flags.research_keyword).toBe(false);
    expect(out.trigger_flags.research_task_kind).toBe(false);
    expect(out.trigger_flags.has_ingest_draft).toBe(false);
    expect(out.trigger_flags.has_flush_pending).toBe(false);
    expect(out.trigger_flags.has_local_known_and_newly_found).toBe(false);
  });
  it("refactor-only task → skip", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ userRequest: "refactor the foo module" })
    );
    expect(out.skip_reason).toBe("no_trigger_fired");
  });
});

// -----------------------------------------------------------------
// 7. base prompt preservation
// -----------------------------------------------------------------

describe("008F — base task prompt preservation", () => {
  it("base_task_prompt_preserved is true (literal)", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.base_task_prompt_preserved).toBe(true);
  });
  it("base prompt appears verbatim in final_task_prompt when attached", () => {
    const prompt = "do the thing\nmultiline\nwith $pecial & <chars> 你好";
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ baseTaskPrompt: prompt })
    );
    expect(out.preamble_attached).toBe(true);
    expect(out.final_task_prompt).toContain(prompt);
  });
  it("final_task_prompt equals base when skipped", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ featureFlagEnabled: false })
    );
    expect(out.final_task_prompt).toBe("task: research X");
  });
  it("preamble precedes base when attached", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const preamble = out.preamble_text!;
    const baseIdx = out.final_task_prompt.indexOf("task: research X");
    const preambleIdx = out.final_task_prompt.indexOf(preamble);
    expect(preambleIdx).toBeGreaterThanOrEqual(0);
    expect(baseIdx).toBeGreaterThan(preambleIdx);
  });
});

// -----------------------------------------------------------------
// 8. preamble attached only when allowed
// -----------------------------------------------------------------

describe("008F — preamble attached only when allowed", () => {
  it("shouldApply mirrors preamble_attached for matrix", () => {
    const cases: Array<{ input: KnowledgeSurfaceBInput; expected: boolean }> = [
      { input: baseInput({ featureFlagEnabled: false }), expected: false },
      { input: baseInput({ userRequest: "fix the bug" }), expected: false },
      {
        input: baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" }),
        expected: false,
      },
      {
        input: baseInput({ targetAgent: "claude_code", userRequest: "save to knowledge" }),
        expected: true,
      },
      {
        input: baseInput({
          targetAgent: "codex",
          userRequest: "",
          handoffContext: { hasIngestDraft: true },
        }),
        expected: true,
      },
    ];
    for (const c of cases) {
      expect(shouldApplyKnowledgeContractSurfaceB(c.input)).toBe(c.expected);
      const out = buildTaskPromptWithKnowledgeContractSurfaceB(c.input);
      expect(out.preamble_attached).toBe(c.expected);
    }
  });
});

// -----------------------------------------------------------------
// 9. maxChars truncation
// -----------------------------------------------------------------

describe("008F — maxChars truncation", () => {
  it("truncates preamble body to maxChars and records truncated=true", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({
        maxChars: 64,
        overridePreambleText:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefXX",
      })
    );
    expect(out.preamble_attached).toBe(true);
    expect(out.max_chars).toBe(64);
    expect(out.truncated).toBe(true);
    const bodyStart = out.preamble_text!.indexOf("0123456789abcdef");
    expect(bodyStart).toBeGreaterThanOrEqual(0);
    expect(out.preamble_text!.slice(bodyStart).length).toBeLessThanOrEqual(64);
  });
  it("default max_chars=2048 leaves normal preamble untruncated", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.max_chars).toBe(2048);
    expect(out.truncated).toBe(false);
  });
});

// -----------------------------------------------------------------
// 10. hard safety flags
// -----------------------------------------------------------------

describe("008F — hard safety flags (literal false)", () => {
  it("runtime_flush_allowed=false", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.runtime_flush_allowed).toBe(false);
  });
  it("runtime_dispatch_allowed=false", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.runtime_dispatch_allowed).toBe(false);
  });
  it("real_handoff_write_allowed=false", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.real_handoff_write_allowed).toBe(false);
  });
  it("live_adapter_allowed=false", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.live_adapter_allowed).toBe(false);
  });
  it("feature_flag_default_state=false", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.feature_flag_default_state).toBe(false);
  });
  it("feature_flag_name is the literal string", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(out.feature_flag_name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });
});

// -----------------------------------------------------------------
// 11. forged runtime flags rejected
// -----------------------------------------------------------------

describe("008F — forged runtime flags rejected", () => {
  it("forged runtime_flush_allowed=true throws", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const forged = {
      ...out,
      runtime_flush_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /runtime_flush_allowed/
    );
  });
  it("forged runtime_dispatch_allowed=true throws", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const forged = {
      ...out,
      runtime_dispatch_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /runtime_dispatch_allowed/
    );
  });
  it("forged real_handoff_write_allowed=true throws", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const forged = {
      ...out,
      real_handoff_write_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /real_handoff_write_allowed/
    );
  });
  it("forged live_adapter_allowed=true throws", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const forged = {
      ...out,
      live_adapter_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /live_adapter_allowed/
    );
  });
  it("poisoned preamble containing knowledgeIngest( throws", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const poisoned: KnowledgeSurfaceBOutput = {
      ...out,
      preamble_text: (out.preamble_text ?? "") + "\nknowledgeIngest(x)",
    };
    expect(() => assertKnowledgeSurfaceBNoRuntime(poisoned)).toThrow(
      /knowledgeIngest\(/
    );
  });
  it("poisoned final_task_prompt containing runPlaybook( throws", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const poisoned: KnowledgeSurfaceBOutput = {
      ...out,
      final_task_prompt: out.final_task_prompt + "\nrunPlaybook(noop)",
    };
    expect(() => assertKnowledgeSurfaceBNoRuntime(poisoned)).toThrow(
      /runPlaybook\(/
    );
  });
  it("normally produced output passes", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    expect(() => assertKnowledgeSurfaceBNoRuntime(out)).not.toThrow();
  });
});

// -----------------------------------------------------------------
// 12. fixture examples
// -----------------------------------------------------------------

describe("008F — fixture examples", () => {
  it("fixture has 1.0.0 schema, 008F slice, surface_b_dry_run_implementation mode", () => {
    const fx = fixture as { schema_version: string; slice: string; mode: string };
    expect(fx.schema_version).toBe("1.0.0");
    expect(fx.slice).toBe("008F");
    expect(fx.mode).toBe("surface_b_dry_run_implementation");
  });
  it("fixture has ≥7 examples", () => {
    const fx = fixture as { examples: unknown[] };
    expect(fx.examples.length).toBeGreaterThanOrEqual(7);
  });
  it("fixture lists at least 16 invariants", () => {
    const fx = fixture as { invariants: string[] };
    expect(fx.invariants.length).toBeGreaterThanOrEqual(16);
  });
  it("fixture marks forbidden_runtime_checked true", () => {
    const fx = fixture as { forbidden_runtime_checked: boolean };
    expect(fx.forbidden_runtime_checked).toBe(true);
  });
  it("each example covers the documented case", () => {
    const fx = fixture as {
      examples: Array<{ name: string; input: Record<string, unknown>; expected: Record<string, unknown> }>;
    };
    const names = fx.examples.map((e) => e.name);
    expect(names).toContain("flag_disabled");
    expect(names).toContain("claude_code_research_attach");
    expect(names).toContain("codex_ingest_draft_attach");
    expect(names).toContain("hermes_pro_local_newly_attach");
    expect(names).toContain("hermes_reserved_skip");
    expect(names).toContain("ordinary_code_skip");
    expect(names).toContain("truncated_preamble");
  });
});

// -----------------------------------------------------------------
// 13. JSON round-trip
// -----------------------------------------------------------------

describe("008F — JSON round-trip", () => {
  it("output round-trips through JSON.parse(JSON.stringify)", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(
      baseInput({ targetAgent: "codex", userRequest: "compare A vs B" })
    );
    const round = JSON.parse(JSON.stringify(out)) as KnowledgeSurfaceBOutput;
    expect(round).toEqual(out);
    expect(() => assertKnowledgeSurfaceBNoRuntime(round)).not.toThrow();
  });
  it("round-trip preserves all 4 hard false flags", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const round = JSON.parse(JSON.stringify(out)) as KnowledgeSurfaceBOutput;
    expect(round.runtime_flush_allowed).toBe(false);
    expect(round.runtime_dispatch_allowed).toBe(false);
    expect(round.real_handoff_write_allowed).toBe(false);
    expect(round.live_adapter_allowed).toBe(false);
  });
});

// -----------------------------------------------------------------
// 14. forbidden token scanner
// -----------------------------------------------------------------

describe("008F — forbidden token scanner", () => {
  const FORBIDDEN_TOKENS: ReadonlyArray<string> = [
    "knowledgeIngest(",
    "knowledgeSearch(",
    "runPlaybook(",
    "triggerCronJob(",
    "sendMessage(",
    "fetch(",
  ];
  it("surface B output contains no call expression in preamble_text", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    for (const t of FORBIDDEN_TOKENS) {
      expect(out.preamble_text ?? "").not.toContain(t);
    }
  });
  it("surface B output contains no call expression in final_task_prompt", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    for (const t of FORBIDDEN_TOKENS) {
      expect(out.final_task_prompt).not.toContain(t);
    }
  });
  it("deceptive copy absent from preamble (no 已保存 / saved successfully / etc.)", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const preamble = out.preamble_text ?? "";
    expect(preamble).not.toContain("已保存");
    expect(preamble).not.toContain("写入成功");
    expect(preamble).not.toContain("saved successfully");
    expect(preamble).not.toContain("will be written after confirm");
  });
  it("buildKnowledgeContractSurfaceBPreamble returns null + empty hash when not apply", () => {
    const r = buildKnowledgeContractSurfaceBPreamble(
      baseInput({ featureFlagEnabled: false })
    );
    expect(r.preamble).toBeNull();
    expect(r.hash).toBe("");
    expect(r.truncated).toBe(false);
  });
  it("buildKnowledgeContractSurfaceBPreamble returns non-null + 64-char hash when apply", () => {
    const r = buildKnowledgeContractSurfaceBPreamble(baseInput());
    expect(r.preamble).not.toBeNull();
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// -----------------------------------------------------------------
// 15. no real handoff/audit write (mtime guard)
// -----------------------------------------------------------------

describe("008F — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    buildTaskPromptWithKnowledgeContractSurfaceB(baseInput());
    const afterHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const afterAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    expect(beforeHandoff).toBe(BASELINE_HANDOFF_MTIME);
    expect(beforeAudit).toBe(BASELINE_AUDIT_MTIME);
    expect(afterHandoff).toBe(beforeHandoff);
    expect(afterAudit).toBe(beforeAudit);
  });
});
