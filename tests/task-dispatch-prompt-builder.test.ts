// Hermes Pro — Knowledge Task Dispatch Prompt Builder (Slice 008J, no runtime)
// Pure tests. No I/O, no IPC, no real dispatch, no Agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

import {
  buildTaskDispatchPrompt,
  shouldApplyKnowledgeContractToDispatchPrompt,
  assertTaskDispatchPromptBuilderNoRuntime,
  TASK_DISPATCH_BUILDER_SCHEMA_VERSION,
  TASK_DISPATCH_BUILDER_SLICE,
  TASK_DISPATCH_BUILDER_MODE,
  TASK_DISPATCH_SURFACE,
  KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
  DEFAULT_TASK_DISPATCH_MAX_CHARS,
  TASK_DISPATCH_NO_L6,
  type TaskDispatchPromptInput,
  type TaskDispatchPromptOutput,
} from "../src/main/task-dispatch-prompt-builder";

import fixture from "./fixtures/knowledge-reuse/task-dispatch-prompt-builder.json";

const BASELINE_HANDOFF_MTIME = 1780195726;
const BASELINE_AUDIT_MTIME = 1780230084;

const FORBIDDEN_CALL: ReadonlyArray<string> = [
  "knowledgeIngest(",
  "knowledgeSearch(",
  "runPlaybook(",
  "triggerCronJob(",
  "sendMessage(",
  "fetch(",
];

const FORBIDDEN_DECEPTIVE: ReadonlyArray<string> = [
  "已保存",
  "写入成功",
  "saved successfully",
  "will be written after confirm",
];

function baseInput(
  overrides: Partial<TaskDispatchPromptInput> = {}
): TaskDispatchPromptInput {
  return {
    featureFlagEnabled: true,
    targetAgent: "claude_code",
    userRequest: "save to knowledge",
    baseTaskPrompt: "task: research X",
    ...overrides,
  };
}

// -----------------------------------------------------------------
// 1. exports
// -----------------------------------------------------------------

describe("008J — helper exports", () => {
  it("schema_version is 1.0.0", () => {
    expect(TASK_DISPATCH_BUILDER_SCHEMA_VERSION).toBe("1.0.0");
  });
  it("slice is 008J", () => {
    expect(TASK_DISPATCH_BUILDER_SLICE).toBe("008J");
  });
  it("mode is task_dispatch_prompt_builder", () => {
    expect(TASK_DISPATCH_BUILDER_MODE).toBe("task_dispatch_prompt_builder");
  });
  it("surface is task_prompt_preamble", () => {
    expect(TASK_DISPATCH_SURFACE).toBe("task_prompt_preamble");
  });
  it("flag name is KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    expect(KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG).toBe(
      "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"
    );
  });
  it("default max_chars is 2048", () => {
    expect(DEFAULT_TASK_DISPATCH_MAX_CHARS).toBe(2048);
  });
  it("no_l6 is literal true", () => {
    expect(TASK_DISPATCH_NO_L6).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. fixture shape
// -----------------------------------------------------------------

describe("008J — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect((fixture as { schema_version: string }).schema_version).toBe("1.0.0");
  });
  it("slice is 008J", () => {
    expect((fixture as { slice: string }).slice).toBe("008J");
  });
  it("mode is task_dispatch_prompt_builder", () => {
    expect((fixture as { mode: string }).mode).toBe("task_dispatch_prompt_builder");
  });
  it("source_helper is knowledge-runtime-injection-surface-b", () => {
    expect((fixture as { source_helper: string }).source_helper).toBe(
      "knowledge-runtime-injection-surface-b"
    );
  });
  it("has at least 8 examples", () => {
    const fx = fixture as { examples: unknown[] };
    expect(fx.examples.length).toBeGreaterThanOrEqual(8);
  });
  it("has at least 22 invariants", () => {
    const fx = fixture as { invariants: string[] };
    expect(fx.invariants.length).toBeGreaterThanOrEqual(22);
  });
  it("forbidden_runtime_checked is true", () => {
    expect((fixture as { forbidden_runtime_checked: boolean })
      .forbidden_runtime_checked).toBe(true);
  });
  it("no_l6 is true", () => {
    expect((fixture as { no_l6: boolean }).no_l6).toBe(true);
  });
  it("all 8 named example ids present", () => {
    const ids = (fixture as { examples: Array<{ name: string }> }).examples.map(
      (e) => e.name
    );
    expect(ids).toContain("flag_disabled_no_attach");
    expect(ids).toContain("claude_code_research_attach");
    expect(ids).toContain("codex_ingest_draft_attach");
    expect(ids).toContain("hermes_pro_local_newly_attach");
    expect(ids).toContain("hermes_reserved_skip");
    expect(ids).toContain("ordinary_code_skip");
    expect(ids).toContain("truncated_prompt");
    expect(ids).toContain("multiline_base_prompt_preserved");
  });
});

// -----------------------------------------------------------------
// 3. flag disabled
// -----------------------------------------------------------------

describe("008J — flag disabled", () => {
  it("skips attach, falls back to L4", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ featureFlagEnabled: false })
    );
    expect(out.knowledge_contract_attached).toBe(false);
    expect(out.fallback_to_l4).toBe(true);
    expect(out.skip_reason).toBe("flag_disabled");
    expect(out.feature_flag_enabled).toBe(false);
    expect(out.preamble_text).toBeNull();
    expect(out.final_task_prompt).toBe("task: research X");
  });
});

// -----------------------------------------------------------------
// 4. target agent matrix
// -----------------------------------------------------------------

describe("008J — target agent matrix", () => {
  it("claude_code + flag + research attaches", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ targetAgent: "claude_code", userRequest: "research X" })
    );
    expect(out.target_agent).toBe("claude_code");
    expect(out.knowledge_contract_attached).toBe(true);
  });
  it("codex + flag + ingest_draft attaches", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({
        targetAgent: "codex",
        userRequest: "",
        handoffContext: { hasIngestDraft: true },
      })
    );
    expect(out.target_agent).toBe("codex");
    expect(out.knowledge_contract_attached).toBe(true);
  });
  it("hermes_pro + flag + local+newly attaches", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({
        targetAgent: "hermes_pro",
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(out.target_agent).toBe("hermes_pro");
    expect(out.knowledge_contract_attached).toBe(true);
  });
  it("hermes self-call + flag + save → reserved skip", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" })
    );
    expect(out.target_agent).toBe("hermes");
    expect(out.knowledge_contract_attached).toBe(false);
    expect(out.skip_reason).toBe("hermes_self_call_reserved");
    expect(out.hermes_reserved_marker).toBe(true);
  });
  it("hermes + flag + save + hermesOverride → attach with reserved marker", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({
        targetAgent: "hermes",
        userRequest: "save to knowledge",
        hermesOverride: true,
      })
    );
    expect(out.knowledge_contract_attached).toBe(true);
    expect(out.preamble_text).toContain(
      "[reserved — no default attach for hermes self-call]"
    );
    expect(out.hermes_reserved_marker).toBe(false);
  });
});

// -----------------------------------------------------------------
// 5. trigger matrix
// -----------------------------------------------------------------

describe("008J — trigger matrix", () => {
  it("save_keyword (en) fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "save to knowledge" })
    );
    expect(out.trigger_flags.save_keyword).toBe(true);
  });
  it("save_keyword (zh) fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "保存到知识库" })
    );
    expect(out.trigger_flags.save_keyword).toBe(true);
  });
  it("research_keyword (en) fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "research topic X" })
    );
    expect(out.trigger_flags.research_keyword).toBe(true);
  });
  it("research_keyword (zh) fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "调研主题 X" })
    );
    expect(out.trigger_flags.research_keyword).toBe(true);
  });
  it("research_task_kind fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ taskKind: "tool_comparison" })
    );
    expect(out.trigger_flags.research_task_kind).toBe(true);
  });
  it("has_ingest_draft fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "", handoffContext: { hasIngestDraft: true } })
    );
    expect(out.trigger_flags.has_ingest_draft).toBe(true);
  });
  it("has_flush_pending fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "", handoffContext: { hasFlushPending: true } })
    );
    expect(out.trigger_flags.has_flush_pending).toBe(true);
  });
  it("has_local_known_and_newly_found fires", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(out.trigger_flags.has_local_known_and_newly_found).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. hermes reserved
// -----------------------------------------------------------------

describe("008J — hermes reserved", () => {
  it("hermes + flag + save → skip + hermes_reserved_marker true", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" })
    );
    expect(out.knowledge_contract_attached).toBe(false);
    expect(out.hermes_reserved_marker).toBe(true);
  });
  it("hermes + flag off → reserved marker still true (target)", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({
        featureFlagEnabled: false,
        targetAgent: "hermes",
        userRequest: "save to knowledge",
      })
    );
    expect(out.hermes_reserved_marker).toBe(true);
    expect(out.skip_reason).toBe("flag_disabled");
  });
  it("hermes + hermesOverride + trigger → attach + reserved_marker false", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({
        targetAgent: "hermes",
        userRequest: "save to knowledge",
        hermesOverride: true,
      })
    );
    expect(out.knowledge_contract_attached).toBe(true);
    expect(out.hermes_reserved_marker).toBe(false);
  });
});

// -----------------------------------------------------------------
// 7. ordinary code skip
// -----------------------------------------------------------------

describe("008J — ordinary code skip", () => {
  it("code-only task → skip + fallback", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "fix the bug in src/foo.ts" })
    );
    expect(out.knowledge_contract_attached).toBe(false);
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
    const out = buildTaskDispatchPrompt(
      baseInput({ userRequest: "refactor the foo module" })
    );
    expect(out.skip_reason).toBe("no_trigger_fired");
  });
});

// -----------------------------------------------------------------
// 8. base prompt preservation
// -----------------------------------------------------------------

describe("008J — base prompt preservation", () => {
  it("base_task_prompt_preserved is true (literal)", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.base_task_prompt_preserved).toBe(true);
  });
  it("base prompt appears verbatim in final_task_prompt when attached", () => {
    const prompt = "do the thing\nmultiline\nwith $pecial & <chars> 你好";
    const out = buildTaskDispatchPrompt(
      baseInput({ baseTaskPrompt: prompt })
    );
    expect(out.knowledge_contract_attached).toBe(true);
    expect(out.final_task_prompt).toContain(prompt);
  });
  it("final_task_prompt equals base when skipped", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ featureFlagEnabled: false })
    );
    expect(out.final_task_prompt).toBe("task: research X");
  });
  it("preamble precedes base when attached", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const preamble = out.preamble_text!;
    const baseIdx = out.final_task_prompt.indexOf("task: research X");
    const preambleIdx = out.final_task_prompt.indexOf(preamble);
    expect(preambleIdx).toBeGreaterThanOrEqual(0);
    expect(baseIdx).toBeGreaterThan(preambleIdx);
  });
});

// -----------------------------------------------------------------
// 9. multiline prompt preservation
// -----------------------------------------------------------------

describe("008J — multiline prompt preservation", () => {
  it("multiline base prompt preserved verbatim", () => {
    const prompt = "line1\nline2\nline3\n\nwith blank line and unicode 你好";
    const out = buildTaskDispatchPrompt(
      baseInput({ baseTaskPrompt: prompt })
    );
    expect(out.knowledge_contract_attached).toBe(true);
    expect(out.base_task_prompt_preserved).toBe(true);
    expect(out.final_task_prompt).toContain(prompt);
  });
  it("special characters preserved", () => {
    const prompt = "with $pecial & <chars> 'quotes' \"more\" `backticks`";
    const out = buildTaskDispatchPrompt(
      baseInput({ baseTaskPrompt: prompt })
    );
    expect(out.final_task_prompt).toContain(prompt);
  });
});

// -----------------------------------------------------------------
// 10. truncation
// -----------------------------------------------------------------

describe("008J — truncation", () => {
  it("default max_chars is 2048", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.max_chars).toBe(2048);
  });
  it("explicit max_chars is preserved on output", () => {
    const out = buildTaskDispatchPrompt(
      baseInput({ maxChars: 256 })
    );
    expect(out.max_chars).toBe(256);
  });
  it("truncation flag routed from 008F helper", () => {
    // 008J delegates to 008F; the actual truncation is decided by
    // 008F based on snippet body length + maxChars. We just verify
    // 008J exposes the truncated boolean.
    const out = buildTaskDispatchPrompt(baseInput({ maxChars: 1 }));
    expect(typeof out.truncated).toBe("boolean");
  });
});

// -----------------------------------------------------------------
// 11. consumes 008F helper
// -----------------------------------------------------------------

describe("008J — consumes 008F helper behavior", () => {
  it("preamble header matches 008F format", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.preamble_text).toMatch(
      /^# Hermes Knowledge Reuse Contract — Surface B dry-run preamble/
    );
    expect(out.preamble_text).toContain("# target_agent: claude_code");
    expect(out.preamble_text).toContain(
      "# feature_flag: KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true"
    );
    expect(out.preamble_text).toContain(
      "# runtime_flush_allowed: false | dry_run_only: true"
    );
  });
  it("preamble body comes from 007I (via 008F)", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.preamble_text).toContain("Hermes Pro internal knowledge store");
    expect(out.preamble_text).toContain("Do not write to MEMORY.md");
    expect(out.preamble_text).toContain("Bucket semantics");
  });
  it("shouldApply mirrors knowledge_contract_attached across full fixture", () => {
    for (const s of (fixture as {
      examples: Array<{
        name: string;
        input: TaskDispatchPromptInput;
        expected: { knowledge_contract_attached?: boolean };
      }>;
    }).examples) {
      const out = buildTaskDispatchPrompt(s.input);
      expect(out.knowledge_contract_attached).toBe(
        s.expected.knowledge_contract_attached === true
      );
      expect(shouldApplyKnowledgeContractToDispatchPrompt(s.input)).toBe(
        s.expected.knowledge_contract_attached === true
      );
    }
  });
});

// -----------------------------------------------------------------
// 12. hard safety flags
// -----------------------------------------------------------------

describe("008J — hard safety flags (literal false)", () => {
  it("runtime_flush_allowed=false", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.runtime_flush_allowed).toBe(false);
  });
  it("runtime_dispatch_allowed=false", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.runtime_dispatch_allowed).toBe(false);
  });
  it("real_handoff_write_allowed=false", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.real_handoff_write_allowed).toBe(false);
  });
  it("live_adapter_allowed=false", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.live_adapter_allowed).toBe(false);
  });
  it("feature_flag_default_state=false", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.feature_flag_default_state).toBe(false);
  });
  it("no_l6 is true (literal)", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.no_l6).toBe(true);
  });
  it("feature_flag_name is the literal string", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    expect(out.feature_flag_name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });
});

// -----------------------------------------------------------------
// 13. forged runtime flags rejected
// -----------------------------------------------------------------

describe("008J — forged runtime flags rejected", () => {
  it("forged runtime_flush_allowed=true throws", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const forged = {
      ...out,
      runtime_flush_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /runtime_flush_allowed/
    );
  });
  it("forged runtime_dispatch_allowed=true throws", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const forged = {
      ...out,
      runtime_dispatch_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /runtime_dispatch_allowed/
    );
  });
  it("forged real_handoff_write_allowed=true throws", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const forged = {
      ...out,
      real_handoff_write_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /real_handoff_write_allowed/
    );
  });
  it("forged live_adapter_allowed=true throws", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const forged = {
      ...out,
      live_adapter_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /live_adapter_allowed/
    );
  });
  it("poisoned preamble containing knowledgeIngest( throws", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const poisoned: TaskDispatchPromptOutput = {
      ...out,
      preamble_text: (out.preamble_text ?? "") + "\nknowledgeIngest(x)",
    };
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(poisoned)).toThrow(
      /knowledgeIngest\(/
    );
  });
  it("poisoned final_task_prompt containing runPlaybook( throws", () => {
    const out = buildTaskDispatchPrompt(baseInput());
    const poisoned: TaskDispatchPromptOutput = {
      ...out,
      final_task_prompt: out.final_task_prompt + "\nrunPlaybook(noop)",
    };
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(poisoned)).toThrow(
      /runPlaybook\(/
    );
  });
  it("normally produced output passes no-runtime guard", () => {
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      expect(() => assertTaskDispatchPromptBuilderNoRuntime(out)).not.toThrow();
    }
  });
});

// -----------------------------------------------------------------
// 14. JSON round-trip
// -----------------------------------------------------------------

describe("008J — JSON round-trip", () => {
  it("snapshot fixture is round-trip stable", () => {
    const blob = JSON.stringify(fixture);
    const round = JSON.parse(blob);
    expect(round).toEqual(fixture);
  });
  it("each example output is round-trip stable", () => {
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      const round = JSON.parse(
        JSON.stringify(out)
      ) as TaskDispatchPromptOutput;
      expect(round).toEqual(out);
      expect(() => assertTaskDispatchPromptBuilderNoRuntime(round)).not.toThrow();
    }
  });
  it("schema_version matches across runtime + fixture", () => {
    expect(TASK_DISPATCH_BUILDER_SCHEMA_VERSION).toBe("1.0.0");
    expect((fixture as { schema_version: string }).schema_version).toBe("1.0.0");
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      expect(out.schema_version).toBe("1.0.0");
    }
  });
  it("slice + mode + surface literals match across runtime + fixture", () => {
    expect(TASK_DISPATCH_BUILDER_SLICE).toBe("008J");
    expect(TASK_DISPATCH_BUILDER_MODE).toBe("task_dispatch_prompt_builder");
    expect(TASK_DISPATCH_SURFACE).toBe("task_prompt_preamble");
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      expect(out.slice).toBe("008J");
      expect(out.mode).toBe("task_dispatch_prompt_builder");
      expect(out.surface).toBe("task_prompt_preamble");
    }
  });
});

// -----------------------------------------------------------------
// 15. forbidden copy scanner
// -----------------------------------------------------------------

describe("008J — forbidden copy scanner", () => {
  it("no deceptive copy in preamble (across all examples)", () => {
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      const preamble = out.preamble_text ?? "";
      for (const phrase of FORBIDDEN_DECEPTIVE) {
        expect(preamble).not.toContain(phrase);
      }
    }
  });
  it("preamble does not positively recommend Obsidian / MEMORY.md / .wolf (attach cases, 007I source only)", () => {
    for (const s of (fixture as { examples: Array<{ name: string; input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      if (!out.knowledge_contract_attached) continue;
      // truncated_prompt fixture uses overrideSnippetText; the 007I
      // body is replaced and the framing check does not apply.
      if (s.name === "truncated_prompt") continue;
      // 007I mentions these tokens inside 'Do not' clauses. Verify
      // the explicit 'do not' framing is intact.
      expect(out.preamble_text).toMatch(/Do not ask[\s\S]*Obsidian/);
      expect(out.preamble_text).toMatch(/Do not write to MEMORY\.md/);
      expect(out.preamble_text).toMatch(/Do not invent new write paths/);
    }
  });
});

// -----------------------------------------------------------------
// 16. forbidden runtime call scanner
// -----------------------------------------------------------------

describe("008J — forbidden runtime call scanner", () => {
  it("no call expression in preamble_text or final_task_prompt", () => {
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      const out = buildTaskDispatchPrompt(s.input);
      const blob = `${out.preamble_text ?? ""}\n${out.final_task_prompt}`;
      for (const t of FORBIDDEN_CALL) {
        expect(blob).not.toContain(t);
      }
    }
  });
  it("dispatch prompt output is a returned string only (no side effect)", () => {
    // The output is plain data; no spawn / no IPC / no fetch / no
    // knowledgeIngest call appears anywhere in the output blob.
    const out = buildTaskDispatchPrompt(baseInput());
    const blob = JSON.stringify(out);
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
});

// -----------------------------------------------------------------
// 17. mtime guard
// -----------------------------------------------------------------

describe("008J — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run all examples to prove no I/O side effect.
    for (const s of (fixture as { examples: Array<{ input: TaskDispatchPromptInput }> })
      .examples) {
      buildTaskDispatchPrompt(s.input);
    }
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
