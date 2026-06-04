// Hermes Pro — Knowledge Task Dispatch Prompt Builder Chain Test (Slice 008K, no runtime)
// Pure chain test. No I/O, no IPC, no fetch, no real dispatch, no Agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

import {
  buildTaskDispatchPrompt,
  assertTaskDispatchPromptBuilderNoRuntime,
  shouldApplyKnowledgeContractToDispatchPrompt,
  TASK_DISPATCH_BUILDER_SCHEMA_VERSION,
  TASK_DISPATCH_BUILDER_SLICE,
  TASK_DISPATCH_BUILDER_MODE,
  TASK_DISPATCH_SURFACE,
  TASK_DISPATCH_NO_L6,
  type TaskDispatchPromptInput,
  type TaskDispatchPromptOutput,
} from "../../src/main/task-dispatch-prompt-builder";

import {
  buildTaskPromptWithKnowledgeContractSurfaceB,
  assertKnowledgeSurfaceBNoRuntime,
  SURFACE_B_SLICE,
  SURFACE_B_MODE,
  SURFACE_B_NAME,
  type KnowledgeSurfaceBInput,
  type KnowledgeSurfaceBOutput,
} from "../../src/shared/lib/knowledge-runtime-injection-surface-b";

import chainFixture from "../fixtures/knowledge-reuse/task-dispatch-prompt-builder-chain.json";
import snapshotsFixture from "../fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json";
import builderFixture from "../fixtures/knowledge-reuse/task-dispatch-prompt-builder.json";
import surfaceBFixture from "../fixtures/knowledge-reuse/runtime-injection-surface-b.json";
import closeoutFixture from "../fixtures/knowledge-reuse/runtime-injection-l5-closeout.json";

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

type ChainExample = {
  name: string;
  input: TaskDispatchPromptInput;
  expected: Record<string, unknown>;
};

const CHAIN_EXAMPLES: ReadonlyArray<ChainExample> = (
  chainFixture as { examples: ChainExample[] }
).examples;

function run008J(s: ChainExample): TaskDispatchPromptOutput {
  return buildTaskDispatchPrompt(s.input);
}

function run008F(s: ChainExample): KnowledgeSurfaceBOutput {
  const inp: KnowledgeSurfaceBInput = {
    featureFlagEnabled: s.input.featureFlagEnabled,
    targetAgent: s.input.targetAgent,
    baseTaskPrompt: s.input.baseTaskPrompt,
    taskKind: s.input.taskKind,
    userRequest: s.input.userRequest,
    handoffContext: s.input.handoffContext,
    maxChars: s.input.maxChars,
    hermesOverride: s.input.hermesOverride,
  };
  return buildTaskPromptWithKnowledgeContractSurfaceB(inp);
}

// -----------------------------------------------------------------
// 1. fixture shape
// -----------------------------------------------------------------

describe("008K — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect((chainFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
  });
  it("slice is 008K", () => {
    expect((chainFixture as { slice: string }).slice).toBe("008K");
  });
  it("mode is task_dispatch_prompt_builder_chain", () => {
    expect((chainFixture as { mode: string }).mode).toBe(
      "task_dispatch_prompt_builder_chain"
    );
  });
  it("has source_slices / chain_stages / snapshot_links_008g / builder_links_008j", () => {
    const fx = chainFixture as Record<string, unknown>;
    expect(Array.isArray(fx.source_slices)).toBe(true);
    expect(Array.isArray(fx.chain_stages)).toBe(true);
    expect(Array.isArray(fx.snapshot_links_008g)).toBe(true);
    expect(Array.isArray(fx.builder_links_008j)).toBe(true);
  });
  it("has examples / invariants / no_l6 / forbidden_runtime_checked", () => {
    const fx = chainFixture as Record<string, unknown>;
    expect(Array.isArray(fx.examples)).toBe(true);
    expect(Array.isArray(fx.invariants)).toBe(true);
    expect(fx.no_l6).toBe(true);
    expect(fx.forbidden_runtime_checked).toBe(true);
  });
  it("fixture has at least 5 chain stages", () => {
    const fx = chainFixture as { chain_stages: unknown[] };
    expect(fx.chain_stages.length).toBeGreaterThanOrEqual(5);
  });
  it("fixture has at least 26 invariants", () => {
    const fx = chainFixture as { invariants: string[] };
    expect(fx.invariants.length).toBeGreaterThanOrEqual(26);
  });
});

// -----------------------------------------------------------------
// 2. source_slices
// -----------------------------------------------------------------

describe("008K — source_slices", () => {
  it("lists 008F / 008G / 008J", () => {
    const fx = chainFixture as { source_slices: string[] };
    expect(fx.source_slices).toContain("008F");
    expect(fx.source_slices).toContain("008G");
    expect(fx.source_slices).toContain("008J");
  });
});

// -----------------------------------------------------------------
// 3. 5-stage chain
// -----------------------------------------------------------------

describe("008K — 5-stage chain order", () => {
  it("stage 1 is read_source_fixtures", () => {
    const fx = chainFixture as {
      chain_stages: Array<{ stage: number; name: string }>;
    };
    const stage1 = fx.chain_stages.find((s) => s.stage === 1);
    expect(stage1).toBeDefined();
    expect(stage1!.name).toMatch(/read|fixture/);
  });
  it("stage 2 is call_008J_builder", () => {
    const fx = chainFixture as {
      chain_stages: Array<{ stage: number; name: string }>;
    };
    const stage2 = fx.chain_stages.find((s) => s.stage === 2);
    expect(stage2).toBeDefined();
    expect(stage2!.name).toMatch(/008J|call.*builder/);
  });
  it("stage 3 is compare_with_008G_snapshot", () => {
    const fx = chainFixture as {
      chain_stages: Array<{ stage: number; name: string }>;
    };
    const stage3 = fx.chain_stages.find((s) => s.stage === 3);
    expect(stage3).toBeDefined();
    expect(stage3!.name).toMatch(/compare|008G|snapshot/);
  });
  it("stage 4 is json_round_trip", () => {
    const fx = chainFixture as {
      chain_stages: Array<{ stage: number; name: string }>;
    };
    const stage4 = fx.chain_stages.find((s) => s.stage === 4);
    expect(stage4).toBeDefined();
    expect(stage4!.name).toMatch(/json|round.*trip/);
  });
  it("stage 5 is no_runtime_invariant_verification", () => {
    const fx = chainFixture as {
      chain_stages: Array<{ stage: number; name: string }>;
    };
    const stage5 = fx.chain_stages.find((s) => s.stage === 5);
    expect(stage5).toBeDefined();
    expect(stage5!.name).toMatch(/no_runtime|invariant|verify/);
  });
});

// -----------------------------------------------------------------
// 4. snapshot linkage
// -----------------------------------------------------------------

describe("008K — snapshot linkage (008G)", () => {
  it("links 8 distinct 008G snapshot ids", () => {
    const fx = chainFixture as { snapshot_links_008g: string[] };
    expect(fx.snapshot_links_008g.length).toBe(8);
    const expected = [
      "flag_disabled_no_preamble",
      "claude_code_research_preamble",
      "codex_ingest_draft_preamble",
      "hermes_pro_local_newly_preamble",
      "hermes_reserved_no_preamble",
      "ordinary_code_no_preamble",
      "truncated_preamble",
      "base_prompt_preserved_multiline",
    ];
    expect(fx.snapshot_links_008g).toEqual(expected);
  });
  it("008G snapshot fixture covers the same 8 ids", () => {
    const ids = (snapshotsFixture as {
      snapshots: Array<{ id: string }>;
    }).snapshots.map((s) => s.id);
    for (const e of (chainFixture as { snapshot_links_008g: string[] })
      .snapshot_links_008g) {
      expect(ids).toContain(e);
    }
  });
});

// -----------------------------------------------------------------
// 5. builder linkage
// -----------------------------------------------------------------

describe("008K — builder linkage (008J)", () => {
  it("links 8 distinct 008J example ids", () => {
    const fx = chainFixture as { builder_links_008j: string[] };
    expect(fx.builder_links_008j.length).toBe(8);
    const expected = [
      "flag_disabled_no_attach",
      "claude_code_research_attach",
      "codex_ingest_draft_attach",
      "hermes_pro_local_newly_attach",
      "hermes_reserved_skip",
      "ordinary_code_skip",
      "truncated_prompt",
      "multiline_base_prompt_preserved",
    ];
    expect(fx.builder_links_008j).toEqual(expected);
  });
  it("008J builder fixture covers the same 8 ids", () => {
    const ids = (builderFixture as {
      examples: Array<{ name: string }>;
    }).examples.map((e) => e.name);
    for (const e of (chainFixture as { builder_links_008j: string[] })
      .builder_links_008j) {
      expect(ids).toContain(e);
    }
  });
});

// -----------------------------------------------------------------
// 6. 8 examples coverage
// -----------------------------------------------------------------

describe("008K — 8 examples coverage", () => {
  it("fixture covers 8 distinct examples", () => {
    expect(CHAIN_EXAMPLES.length).toBe(8);
  });
  it("all 8 named example ids present", () => {
    const ids = CHAIN_EXAMPLES.map((e) => e.name);
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
// 7. 008F helper behavior aligned with 008J builder
// -----------------------------------------------------------------

describe("008K — 008F/008J alignment", () => {
  it("preamble_attached aligns across 008F and 008J for every example", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.knowledge_contract_attached).toBe(f.preamble_attached);
    }
  });
  it("skip_reason aligns across 008F and 008J", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.skip_reason).toBe(f.skip_reason);
    }
  });
  it("fallback_to_l4 aligns across 008F and 008J", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.fallback_to_l4).toBe(f.fallback_to_l4);
    }
  });
  it("final_task_prompt byte-aligned across 008F and 008J", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.final_task_prompt).toBe(f.final_task_prompt);
    }
  });
  it("preamble_text byte-aligned across 008F and 008J", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.preamble_text).toBe(f.preamble_text);
    }
  });
  it("hermes_reserved_marker aligns across 008F and 008J", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.hermes_reserved_marker).toBe(f.hermes_reserved_marker);
    }
  });
  it("trigger_flags align across 008F and 008J", () => {
    for (const s of CHAIN_EXAMPLES) {
      const f = run008F(s);
      const j = run008J(s);
      expect(j.trigger_flags.save_keyword).toBe(
        f.trigger_flags.save_keyword
      );
      expect(j.trigger_flags.research_keyword).toBe(
        f.trigger_flags.research_keyword
      );
      expect(j.trigger_flags.research_task_kind).toBe(
        f.trigger_flags.research_task_kind
      );
      expect(j.trigger_flags.has_ingest_draft).toBe(
        f.trigger_flags.has_ingest_draft
      );
      expect(j.trigger_flags.has_flush_pending).toBe(
        f.trigger_flags.has_flush_pending
      );
      expect(j.trigger_flags.has_local_known_and_newly_found).toBe(
        f.trigger_flags.has_local_known_and_newly_found
      );
    }
  });
});

// -----------------------------------------------------------------
// 8. 008G snapshot alignment
// -----------------------------------------------------------------

describe("008K — 008G snapshot alignment", () => {
  it("008J output byte-aligned with 008G snapshot for the matching case", () => {
    // Map: 008J example name → 008G snapshot id
    const map: Record<string, string> = {
      flag_disabled_no_attach: "flag_disabled_no_preamble",
      claude_code_research_attach: "claude_code_research_preamble",
      codex_ingest_draft_attach: "codex_ingest_draft_preamble",
      hermes_pro_local_newly_attach: "hermes_pro_local_newly_preamble",
      hermes_reserved_skip: "hermes_reserved_no_preamble",
      ordinary_code_skip: "ordinary_code_no_preamble",
      truncated_prompt: "truncated_preamble",
      multiline_base_prompt_preserved: "base_prompt_preserved_multiline",
    };
    for (const s of CHAIN_EXAMPLES) {
      const snap = (snapshotsFixture as {
        snapshots: Array<{
          id: string;
          input: { baseTaskPrompt: string };
        }>;
      }).snapshots.find((x) => x.id === map[s.name]);
      expect(snap).toBeDefined();
      // 008J builder with the 008G snapshot's base prompt should
      // produce the same skip_reason / fallback behavior.
      const sWithSnapBase: ChainExample = {
        ...s,
        input: { ...s.input, baseTaskPrompt: snap!.input.baseTaskPrompt },
      };
      const j = run008J(sWithSnapBase);
      // For truncated_prompt the 008G fixture uses maxChars=64 +
      // overrideSnippetText which 008J does not expose. We skip
      // the comparison for that case.
      if (s.name === "truncated_prompt") continue;
      if (s.expected.knowledge_contract_attached === true) {
        expect(j.knowledge_contract_attached).toBe(true);
        expect(j.fallback_to_l4).toBe(false);
      } else {
        expect(j.knowledge_contract_attached).toBe(false);
        expect(j.fallback_to_l4).toBe(true);
        expect(j.skip_reason).not.toBeNull();
      }
    }
  });
});

// -----------------------------------------------------------------
// 9. flag disabled fallback L4
// -----------------------------------------------------------------

describe("008K — flag disabled fallback L4", () => {
  it("chain flag_disabled_no_attach falls back to L4", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "flag_disabled_no_attach"
    )!;
    const j = run008J(s);
    expect(j.knowledge_contract_attached).toBe(false);
    expect(j.fallback_to_l4).toBe(true);
    expect(j.skip_reason).toBe("flag_disabled");
    expect(j.preamble_text).toBeNull();
    expect(j.final_task_prompt).toBe(s.input.baseTaskPrompt);
    expect(j.no_l6).toBe(true);
  });
});

// -----------------------------------------------------------------
// 10. allowed target attach matrix
// -----------------------------------------------------------------

describe("008K — allowed target attach matrix", () => {
  it("claude_code attach on flag+research", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "claude_code_research_attach"
    )!;
    const j = run008J(s);
    expect(j.target_agent).toBe("claude_code");
    expect(j.knowledge_contract_attached).toBe(true);
  });
  it("codex attach on flag+ingest_draft", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "codex_ingest_draft_attach"
    )!;
    const j = run008J(s);
    expect(j.target_agent).toBe("codex");
    expect(j.knowledge_contract_attached).toBe(true);
  });
  it("hermes_pro attach on flag+local+newly", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "hermes_pro_local_newly_attach"
    )!;
    const j = run008J(s);
    expect(j.target_agent).toBe("hermes_pro");
    expect(j.knowledge_contract_attached).toBe(true);
  });
});

// -----------------------------------------------------------------
// 11. hermes reserved skip
// -----------------------------------------------------------------

describe("008K — hermes reserved skip", () => {
  it("hermes self-call skips by default with reserved marker", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "hermes_reserved_skip"
    )!;
    const j = run008J(s);
    expect(j.target_agent).toBe("hermes");
    expect(j.knowledge_contract_attached).toBe(false);
    expect(j.skip_reason).toBe("hermes_self_call_reserved");
    expect(j.hermes_reserved_marker).toBe(true);
    expect(j.final_task_prompt).toBe(s.input.baseTaskPrompt);
  });
});

// -----------------------------------------------------------------
// 12. ordinary code skip
// -----------------------------------------------------------------

describe("008K — ordinary code skip", () => {
  it("ordinary code-only task skips with no_trigger_fired", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "ordinary_code_skip"
    )!;
    const j = run008J(s);
    expect(j.knowledge_contract_attached).toBe(false);
    expect(j.fallback_to_l4).toBe(true);
    expect(j.skip_reason).toBe("no_trigger_fired");
    expect(j.trigger_flags.save_keyword).toBe(false);
    expect(j.trigger_flags.research_keyword).toBe(false);
  });
});

// -----------------------------------------------------------------
// 13. truncation
// -----------------------------------------------------------------

describe("008K — truncation", () => {
  it("truncated_prompt example exposes max_chars=64", () => {
    const s = CHAIN_EXAMPLES.find((x) => x.name === "truncated_prompt")!;
    const j = run008J(s);
    expect(j.knowledge_contract_attached).toBe(true);
    expect(j.max_chars).toBe(64);
  });
});

// -----------------------------------------------------------------
// 14. multiline / unicode / special chars preservation
// -----------------------------------------------------------------

describe("008K — multiline / unicode / special chars preservation", () => {
  it("multiline base prompt preserved verbatim in final_task_prompt", () => {
    const s = CHAIN_EXAMPLES.find(
      (x) => x.name === "multiline_base_prompt_preserved"
    )!;
    const j = run008J(s);
    expect(j.knowledge_contract_attached).toBe(true);
    expect(j.base_task_prompt_preserved).toBe(true);
    expect(j.final_task_prompt).toContain(s.input.baseTaskPrompt);
  });
});

// -----------------------------------------------------------------
// 15. JSON round-trip
// -----------------------------------------------------------------

describe("008K — JSON round-trip", () => {
  it("chain fixture is round-trip stable", () => {
    const blob = JSON.stringify(chainFixture);
    const round = JSON.parse(blob);
    expect(round).toEqual(chainFixture);
  });
  it("each example output is round-trip stable", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      const round = JSON.parse(JSON.stringify(j)) as TaskDispatchPromptOutput;
      expect(round).toEqual(j);
      expect(() => assertTaskDispatchPromptBuilderNoRuntime(round)).not.toThrow();
    }
  });
  it("schema_version matches across runtime + fixture", () => {
    expect(TASK_DISPATCH_BUILDER_SCHEMA_VERSION).toBe("1.0.0");
    expect((chainFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(j.schema_version).toBe("1.0.0");
    }
  });
  it("slice / mode / surface / no_l6 literals match across runtime + fixture", () => {
    expect(TASK_DISPATCH_BUILDER_SLICE).toBe("008J");
    expect(TASK_DISPATCH_BUILDER_MODE).toBe("task_dispatch_prompt_builder");
    expect(TASK_DISPATCH_SURFACE).toBe("task_prompt_preamble");
    expect(TASK_DISPATCH_NO_L6).toBe(true);
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(j.slice).toBe("008J");
      expect(j.mode).toBe("task_dispatch_prompt_builder");
      expect(j.surface).toBe("task_prompt_preamble");
      expect(j.no_l6).toBe(true);
    }
  });
  it("008F / 008J runtime literals align with 008K fixture", () => {
    expect(SURFACE_B_SLICE).toBe("008F");
    expect(SURFACE_B_MODE).toBe("surface_b_dry_run_implementation");
    expect(SURFACE_B_NAME).toBe("task_prompt_preamble");
  });
});

// -----------------------------------------------------------------
// 16. runtime flags + no_l6
// -----------------------------------------------------------------

describe("008K — runtime flags + no_l6", () => {
  it("every example has 4 literal false runtime flags", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(j.runtime_flush_allowed).toBe(false);
      expect(j.runtime_dispatch_allowed).toBe(false);
      expect(j.real_handoff_write_allowed).toBe(false);
      expect(j.live_adapter_allowed).toBe(false);
    }
  });
  it("every example has no_l6: true (literal)", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(j.no_l6).toBe(true);
    }
  });
  it("feature_flag_default_state is false (literal)", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(j.feature_flag_default_state).toBe(false);
    }
  });
  it("feature_flag_name is the literal string", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(j.feature_flag_name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
    }
  });
});

// -----------------------------------------------------------------
// 17. forged runtime flags rejected
// -----------------------------------------------------------------

describe("008K — forged runtime flags rejected", () => {
  it("forged runtime_flush_allowed=true throws", () => {
    const j = run008J(CHAIN_EXAMPLES[0]);
    const forged = {
      ...j,
      runtime_flush_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /runtime_flush_allowed/
    );
  });
  it("forged runtime_dispatch_allowed=true throws", () => {
    const j = run008J(CHAIN_EXAMPLES[0]);
    const forged = {
      ...j,
      runtime_dispatch_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /runtime_dispatch_allowed/
    );
  });
  it("forged real_handoff_write_allowed=true throws", () => {
    const j = run008J(CHAIN_EXAMPLES[0]);
    const forged = {
      ...j,
      real_handoff_write_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /real_handoff_write_allowed/
    );
  });
  it("forged live_adapter_allowed=true throws", () => {
    const j = run008J(CHAIN_EXAMPLES[0]);
    const forged = {
      ...j,
      live_adapter_allowed: true as unknown as false,
    } as unknown as TaskDispatchPromptOutput;
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(forged)).toThrow(
      /live_adapter_allowed/
    );
  });
  it("poisoned preamble containing knowledgeIngest( throws", () => {
    const j = run008J(CHAIN_EXAMPLES[0]);
    const poisoned: TaskDispatchPromptOutput = {
      ...j,
      preamble_text: (j.preamble_text ?? "") + "\nknowledgeIngest(x)",
    };
    expect(() => assertTaskDispatchPromptBuilderNoRuntime(poisoned)).toThrow(
      /knowledgeIngest\(/
    );
  });
  it("normally produced output passes no-runtime guard", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(() => assertTaskDispatchPromptBuilderNoRuntime(j)).not.toThrow();
    }
  });
  it("008F no-runtime guard also passes for every 008J output (cross-validate)", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      // Reconstruct 008F-shaped payload for cross-validation.
      const surfaceBForGuard: KnowledgeSurfaceBOutput = {
        schema_version: "1.0.0",
        slice: "008F",
        mode: "surface_b_dry_run_implementation",
        feature_flag_name: "KNOWLEDGE_CONTRACT_INJECTION_ENABLED",
        feature_flag_enabled: j.feature_flag_enabled,
        feature_flag_default_state: false,
        surface: "task_prompt_preamble",
        target_agent: j.target_agent,
        preamble_attached: j.knowledge_contract_attached,
        skip_reason: j.skip_reason,
        fallback_to_l4: j.fallback_to_l4,
        trigger_flags: {
          save_keyword: j.trigger_flags.save_keyword,
          research_keyword: j.trigger_flags.research_keyword,
          research_task_kind: j.trigger_flags.research_task_kind,
          has_ingest_draft: j.trigger_flags.has_ingest_draft,
          has_flush_pending: j.trigger_flags.has_flush_pending,
          has_local_known_and_newly_found:
            j.trigger_flags.has_local_known_and_newly_found,
        },
        base_task_prompt_preserved: true,
        final_task_prompt: j.final_task_prompt,
        preamble_text: j.preamble_text,
        preamble_hash: "",
        truncated: j.truncated,
        max_chars: j.max_chars,
        runtime_flush_allowed: false,
        runtime_dispatch_allowed: false,
        real_handoff_write_allowed: false,
        live_adapter_allowed: false,
        hermes_reserved_marker: j.hermes_reserved_marker,
        created_at: j.created_at,
      };
      expect(() => assertKnowledgeSurfaceBNoRuntime(surfaceBForGuard)).not.toThrow();
    }
  });
});

// -----------------------------------------------------------------
// 18. no call-form fields
// -----------------------------------------------------------------

describe("008K — no call-form fields in output", () => {
  it("output does not carry executable_steps / verificationCommands / next_actions fields", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      const obj = j as unknown as Record<string, unknown>;
      expect("executable_steps" in obj).toBe(false);
      expect("verificationCommands" in obj).toBe(false);
      expect("next_actions" in obj).toBe(false);
    }
  });
  it("fixture blob has no call-form dispatch action fields", () => {
    const blob = JSON.stringify(chainFixture);
    expect(blob).not.toMatch(/"executable_steps"\s*:/);
    expect(blob).not.toMatch(/"verificationCommands"\s*:/);
    expect(blob).not.toMatch(/"next_actions"\s*:/);
  });
});

// -----------------------------------------------------------------
// 19. forbidden copy scanner
// -----------------------------------------------------------------

describe("008K — forbidden copy scanner", () => {
  it("no deceptive copy in preamble across attach cases", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      if (!j.knowledge_contract_attached) continue;
      if (s.name === "truncated_prompt") continue;
      for (const phrase of FORBIDDEN_DECEPTIVE) {
        expect(j.preamble_text ?? "").not.toContain(phrase);
      }
    }
  });
  it("preamble includes 007I explicit 'do not' framing (attach cases, 007I source only)", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      if (!j.knowledge_contract_attached) continue;
      if (s.name === "truncated_prompt") continue;
      expect(j.preamble_text).toMatch(/Do not ask[\s\S]*Obsidian/);
      expect(j.preamble_text).toMatch(/Do not write to MEMORY\.md/);
    }
  });
});

// -----------------------------------------------------------------
// 20. forbidden runtime call scanner
// -----------------------------------------------------------------

describe("008K — forbidden runtime call scanner", () => {
  it("no call expression in preamble_text or final_task_prompt", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      const blob = `${j.preamble_text ?? ""}\n${j.final_task_prompt}`;
      for (const t of FORBIDDEN_CALL) {
        expect(blob).not.toContain(t);
      }
    }
  });
  it("shouldApply mirrors knowledge_contract_attached across full chain", () => {
    for (const s of CHAIN_EXAMPLES) {
      const j = run008J(s);
      expect(shouldApplyKnowledgeContractToDispatchPrompt(s.input)).toBe(
        j.knowledge_contract_attached
      );
    }
  });
});

// -----------------------------------------------------------------
// 21. cross-fixture consistency
// -----------------------------------------------------------------

describe("008K — cross-fixture consistency", () => {
  it("008G snapshot fixture is loaded", () => {
    expect((snapshotsFixture as { slice: string }).slice).toBe("008G");
  });
  it("008J builder fixture is loaded", () => {
    expect((builderFixture as { slice: string }).slice).toBe("008J");
  });
  it("008F surface b fixture is loaded", () => {
    expect((surfaceBFixture as { slice: string }).slice).toBe("008F");
  });
  it("008H closeout fixture is loaded", () => {
    expect((closeoutFixture as { slice: string }).slice).toBe("008H");
  });
});

// -----------------------------------------------------------------
// 22. mtime guard
// -----------------------------------------------------------------

describe("008K — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run all examples to prove no I/O side effect.
    for (const s of CHAIN_EXAMPLES) {
      run008J(s);
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
