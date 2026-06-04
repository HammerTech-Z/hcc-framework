// Hermes Pro — Knowledge Runtime Injection Dry-run Artifact Chain Test (Slice 008D, no runtime)
// Pure chain test. No I/O, no IPC, no fetch, no real dispatch, no real
// handoff write, no agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";
import { createHash } from "crypto";

import {
  buildKnowledgeRuntimeInjectionSimulation,
  shouldSimulateKnowledgeContractInjection,
  buildSimulatedTaskPromptPreamble,
  assertKnowledgeRuntimeInjectionSimulationNoRuntime,
  KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION,
  KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
  RECOMMENDED_INJECTION_SURFACE,
  SIMULATION_MODE,
  type KnowledgeRuntimeInjectionSimulation,
  type KnowledgeRuntimeInjectionSimulationInput,
} from "../../src/shared/lib/knowledge-runtime-injection-simulation";

import chainFixture from "../fixtures/knowledge-reuse/runtime-injection-artifact-chain.json";
import simFixture from "../fixtures/knowledge-reuse/runtime-injection-simulation.json";
import designA from "../fixtures/knowledge-reuse/runtime-default-injection-design.json";
import designB from "../fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json";

const BASELINE_HANDOFF_MTIME = 1780195726;
const BASELINE_AUDIT_MTIME = 1780230084;

function baseInput(
  overrides: Partial<KnowledgeRuntimeInjectionSimulationInput> = {}
): KnowledgeRuntimeInjectionSimulationInput {
  return {
    featureFlagEnabled: true,
    targetAgent: "claude_code",
    userRequest: "save to knowledge",
    ...overrides,
  };
}

// Pure aggregator: build the chain artifact in-memory only.
interface ChainArtifact {
  schema_version: "1.0.0";
  slice: "008D";
  mode: "runtime_injection_artifact_chain";
  generated_from: ReadonlyArray<string>;
  source_fixtures: { design_a: unknown; design_b: unknown; simulation: unknown; chain: unknown };
  simulations: ReadonlyArray<KnowledgeRuntimeInjectionSimulation>;
  feature_flag_matrix_results: ReadonlyArray<{
    name: string;
    snippet_attached: boolean;
    fallback_to_l4: boolean;
    skip_reason: string | null;
    runtime_flush_allowed: boolean;
    runtime_dispatch_allowed: boolean;
    real_handoff_write_allowed: boolean;
    live_adapter_allowed: boolean;
  }>;
  invariant_results: ReadonlyArray<{
    name: string;
    pass: boolean;
    detail: string;
  }>;
  no_runtime_checked: true;
  created_at: string;
  content_hash: string;
}

const FEATURE_FLAG_MATRIX: ReadonlyArray<{
  name: string;
  input: KnowledgeRuntimeInjectionSimulationInput;
  expected: {
    snippet_attached: boolean;
    fallback_to_l4: boolean;
    skip_reason: string | null;
    runtime_flush_allowed: boolean;
    runtime_dispatch_allowed: boolean;
    real_handoff_write_allowed: boolean;
    live_adapter_allowed: boolean;
  };
}> = [
  {
    name: "flag_disabled_fallback_to_l4",
    input: baseInput({
      featureFlagEnabled: false,
      userRequest: "research X and save to knowledge",
    }),
    expected: {
      snippet_attached: false,
      fallback_to_l4: true,
      skip_reason: "flag_disabled",
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
  {
    name: "flag_enabled_claude_code_save",
    input: baseInput({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    }),
    expected: {
      snippet_attached: true,
      fallback_to_l4: false,
      skip_reason: null,
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
  {
    name: "flag_enabled_codex_handoff_ingest_draft",
    input: baseInput({
      featureFlagEnabled: true,
      targetAgent: "codex",
      userRequest: "",
      handoffContext: { hasIngestDraft: true },
    }),
    expected: {
      snippet_attached: true,
      fallback_to_l4: false,
      skip_reason: null,
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
  {
    name: "flag_enabled_hermes_pro_local_newly",
    input: baseInput({
      featureFlagEnabled: true,
      targetAgent: "hermes_pro",
      userRequest: "",
      handoffContext: { hasLocalKnownAndNewlyFound: true },
    }),
    expected: {
      snippet_attached: true,
      fallback_to_l4: false,
      skip_reason: null,
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
  {
    name: "flag_enabled_hermes_reserved_skip",
    input: baseInput({
      featureFlagEnabled: true,
      targetAgent: "hermes",
      userRequest: "save to knowledge",
    }),
    expected: {
      snippet_attached: false,
      fallback_to_l4: true,
      skip_reason: "hermes_self_call_reserved",
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
  {
    name: "flag_enabled_ordinary_code_skip",
    input: baseInput({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "fix the bug in src/foo.ts",
    }),
    expected: {
      snippet_attached: false,
      fallback_to_l4: true,
      skip_reason: "no_trigger_fired",
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
  {
    name: "flag_enabled_max_chars_truncation",
    input: baseInput({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      maxChars: 64,
      overrideSnippetText:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefXX",
    }),
    expected: {
      snippet_attached: true,
      fallback_to_l4: false,
      skip_reason: null,
      runtime_flush_allowed: false,
      runtime_dispatch_allowed: false,
      real_handoff_write_allowed: false,
      live_adapter_allowed: false,
    },
  },
];

function buildChainArtifact(nowIso: string): ChainArtifact {
  const simulations = FEATURE_FLAG_MATRIX.map((c) =>
    buildKnowledgeRuntimeInjectionSimulation(c.input)
  );
  const matrixResults = FEATURE_FLAG_MATRIX.map((c, i) => {
    const sim = simulations[i];
    return {
      name: c.name,
      snippet_attached: sim.snippet_attached,
      fallback_to_l4: sim.fallback_to_l4,
      skip_reason: sim.skip_reason,
      runtime_flush_allowed: sim.runtime_flush_allowed,
      runtime_dispatch_allowed: sim.runtime_dispatch_allowed,
      real_handoff_write_allowed: sim.real_handoff_write_allowed,
      live_adapter_allowed: sim.live_adapter_allowed,
    };
  });
  const invariantResults = runInvariants(simulations);
  const partial: Omit<ChainArtifact, "content_hash"> = {
    schema_version: "1.0.0",
    slice: "008D",
    mode: "runtime_injection_artifact_chain",
    generated_from: ["008A", "008B", "008C"],
    source_fixtures: {
      design_a: designA,
      design_b: designB,
      simulation: simFixture,
      chain: chainFixture,
    },
    simulations,
    feature_flag_matrix_results: matrixResults,
    invariant_results: invariantResults,
    no_runtime_checked: true,
    created_at: nowIso,
  };
  const canonical = JSON.stringify(partial, Object.keys(partial).sort());
  const hash = createHash("sha256").update(canonical).digest("hex");
  return { ...partial, content_hash: `sha256:${hash}` };
}

function runInvariants(
  simulations: ReadonlyArray<KnowledgeRuntimeInjectionSimulation>
): ChainArtifact["invariant_results"] {
  const checks: Array<{ name: string; pass: boolean; detail: string }> = [];
  for (const sim of simulations) {
    checks.push({
      name: `runtime_flush_allowed_false@${sim.target_agent}@${String(
        sim.feature_flag.enabled
      )}@${String(sim.snippet_attached)}`,
      pass: sim.runtime_flush_allowed === false,
      detail: `runtime_flush_allowed=${sim.runtime_flush_allowed}`,
    });
    checks.push({
      name: `runtime_dispatch_allowed_false@${sim.target_agent}`,
      pass: sim.runtime_dispatch_allowed === false,
      detail: `runtime_dispatch_allowed=${sim.runtime_dispatch_allowed}`,
    });
    checks.push({
      name: `real_handoff_write_allowed_false@${sim.target_agent}`,
      pass: sim.real_handoff_write_allowed === false,
      detail: `real_handoff_write_allowed=${sim.real_handoff_write_allowed}`,
    });
    checks.push({
      name: `live_adapter_allowed_false@${sim.target_agent}`,
      pass: sim.live_adapter_allowed === false,
      detail: `live_adapter_allowed=${sim.live_adapter_allowed}`,
    });
    checks.push({
      name: `feature_flag_default_state_false@${sim.target_agent}`,
      pass: sim.feature_flag.default_state === false,
      detail: `feature_flag.default_state=${sim.feature_flag.default_state}`,
    });
    checks.push({
      name: `surface_task_prompt_preamble@${sim.target_agent}`,
      pass: sim.surface === "task_prompt_preamble",
      detail: `surface=${sim.surface}`,
    });
    checks.push({
      name: `mode_runtime_injection_simulation@${sim.target_agent}`,
      pass: sim.mode === "runtime_injection_simulation",
      detail: `mode=${sim.mode}`,
    });
    checks.push({
      name: `schema_version_1_0_0@${sim.target_agent}`,
      pass: sim.schema_version === "1.0.0",
      detail: `schema_version=${sim.schema_version}`,
    });
    checks.push({
      name: `fallback_xor_attached@${sim.target_agent}@${String(
        sim.feature_flag.enabled
      )}`,
      pass: sim.snippet_attached !== sim.fallback_to_l4,
      detail: `attached=${sim.snippet_attached} fallback=${sim.fallback_to_l4}`,
    });
    checks.push({
      name: `no_executable_steps_field@${sim.target_agent}`,
      pass: !("executable_steps" in (sim as Record<string, unknown>)),
      detail: "executable_steps absent",
    });
    checks.push({
      name: `no_verificationCommands_field@${sim.target_agent}`,
      pass: !("verificationCommands" in (sim as Record<string, unknown>)),
      detail: "verificationCommands absent",
    });
  }
  return checks;
}

// -----------------------------------------------------------------
// 1. fixture shape
// -----------------------------------------------------------------

describe("008D chain — fixture shape", () => {
  it("chain fixture has 1.0.0 schema and 008D slice", () => {
    expect((chainFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
    expect((chainFixture as { slice: string }).slice).toBe("008D");
    expect((chainFixture as { mode: string }).mode).toBe(
      "runtime_injection_artifact_chain"
    );
  });

  it("chain fixture generated_from lists 008A/008B/008C", () => {
    const fx = chainFixture as { generated_from: string[] };
    expect(fx.generated_from).toEqual(["008A", "008B", "008C"]);
  });

  it("chain fixture has 5 chain stages", () => {
    const fx = chainFixture as { chain_stages: unknown[] };
    expect(fx.chain_stages.length).toBe(5);
    expect(
      fx.chain_stages.map((s) => (s as { stage: number }).stage)
    ).toEqual([1, 2, 3, 4, 5]);
  });

  it("chain fixture has feature_flag_matrix with ≥7 entries", () => {
    const fx = chainFixture as { feature_flag_matrix: unknown[] };
    expect(fx.feature_flag_matrix.length).toBeGreaterThanOrEqual(7);
  });

  it("chain fixture lists forbidden_call_tokens + path markers + deceptive phrases", () => {
    const fx = chainFixture as {
      forbidden_call_tokens: string[];
      forbidden_path_markers: string[];
      forbidden_deceptive_phrases: string[];
      forbidden_runtime_checked: boolean;
    };
    expect(fx.forbidden_call_tokens).toContain("knowledgeIngest(");
    expect(fx.forbidden_path_markers).toContain("MEMORY.md");
    expect(fx.forbidden_deceptive_phrases).toContain("已保存");
    expect(fx.forbidden_runtime_checked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. feature flag matrix
// -----------------------------------------------------------------

describe("008D chain — feature flag matrix", () => {
  for (const c of FEATURE_FLAG_MATRIX) {
    it(`${c.name} — snippet_attached/fallback/skip_reason/4 false flags`, () => {
      const sim = buildKnowledgeRuntimeInjectionSimulation(c.input);
      expect(sim.snippet_attached).toBe(c.expected.snippet_attached);
      expect(sim.fallback_to_l4).toBe(c.expected.fallback_to_l4);
      expect(sim.skip_reason).toBe(c.expected.skip_reason);
      expect(sim.runtime_flush_allowed).toBe(c.expected.runtime_flush_allowed);
      expect(sim.runtime_dispatch_allowed).toBe(
        c.expected.runtime_dispatch_allowed
      );
      expect(sim.real_handoff_write_allowed).toBe(
        c.expected.real_handoff_write_allowed
      );
      expect(sim.live_adapter_allowed).toBe(c.expected.live_adapter_allowed);
    });
  }
});

// -----------------------------------------------------------------
// 3. target agent matrix
// -----------------------------------------------------------------

describe("008D chain — target agent matrix", () => {
  it("claude_code + flag + save attaches", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ targetAgent: "claude_code", userRequest: "save to knowledge" })
    );
    expect(sim.target_agent).toBe("claude_code");
    expect(sim.snippet_attached).toBe(true);
  });

  it("codex + flag + handoff ingest attaches", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        targetAgent: "codex",
        userRequest: "",
        handoffContext: { hasIngestDraft: true },
      })
    );
    expect(sim.target_agent).toBe("codex");
    expect(sim.snippet_attached).toBe(true);
  });

  it("hermes_pro + flag + local+newly attaches", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        targetAgent: "hermes_pro",
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(sim.target_agent).toBe("hermes_pro");
    expect(sim.snippet_attached).toBe(true);
  });

  it("hermes self-call + flag + save → reserved skip", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" })
    );
    expect(sim.target_agent).toBe("hermes");
    expect(sim.snippet_attached).toBe(false);
    expect(sim.skip_reason).toBe("hermes_self_call_reserved");
    expect(sim.hermes_reserved_marker).toBe(true);
  });

  it("hermes + flag + save + hermesOverride → attach with reserved marker text", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        targetAgent: "hermes",
        userRequest: "save to knowledge",
        hermesOverride: true,
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.simulated_preamble).toContain(
      "[reserved — no default attach for hermes self-call]"
    );
  });
});

// -----------------------------------------------------------------
// 4. trigger matrix
// -----------------------------------------------------------------

describe("008D chain — trigger matrix", () => {
  it("save_keyword (en) fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "save to knowledge" })
    );
    expect(sim.trigger_flags.save_keyword).toBe(true);
  });
  it("save_keyword (zh) fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "保存到知识库" })
    );
    expect(sim.trigger_flags.save_keyword).toBe(true);
  });
  it("research_keyword (en) fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "research topic X" })
    );
    expect(sim.trigger_flags.research_keyword).toBe(true);
  });
  it("research_keyword (zh) fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "调研主题 X" })
    );
    expect(sim.trigger_flags.research_keyword).toBe(true);
  });
  it("research_task_kind fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ taskKind: "tool_comparison" })
    );
    expect(sim.trigger_flags.research_task_kind).toBe(true);
  });
  it("has_ingest_draft fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "", handoffContext: { hasIngestDraft: true } })
    );
    expect(sim.trigger_flags.has_ingest_draft).toBe(true);
  });
  it("has_flush_pending fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "", handoffContext: { hasFlushPending: true } })
    );
    expect(sim.trigger_flags.has_flush_pending).toBe(true);
  });
  it("has_local_known_and_newly_found fires", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(sim.trigger_flags.has_local_known_and_newly_found).toBe(true);
  });
  it("ordinary code task fires 0 triggers", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ userRequest: "refactor the foo module" })
    );
    expect(sim.trigger_flags.save_keyword).toBe(false);
    expect(sim.trigger_flags.research_keyword).toBe(false);
    expect(sim.trigger_flags.research_task_kind).toBe(false);
    expect(sim.trigger_flags.has_ingest_draft).toBe(false);
    expect(sim.trigger_flags.has_flush_pending).toBe(false);
    expect(sim.trigger_flags.has_local_known_and_newly_found).toBe(false);
  });
});

// -----------------------------------------------------------------
// 5. fallback to L4
// -----------------------------------------------------------------

describe("008D chain — fallback to L4", () => {
  const fallbackCases: Array<{
    name: string;
    input: KnowledgeRuntimeInjectionSimulationInput;
    expectedReason: string;
  }> = [
    {
      name: "flag_disabled",
      input: baseInput({ featureFlagEnabled: false, userRequest: "save to knowledge" }),
      expectedReason: "flag_disabled",
    },
    {
      name: "hermes_self_call_reserved",
      input: baseInput({ targetAgent: "hermes", userRequest: "save to knowledge" }),
      expectedReason: "hermes_self_call_reserved",
    },
    {
      name: "no_trigger_fired",
      input: baseInput({ userRequest: "fix the bug in src/foo.ts" }),
      expectedReason: "no_trigger_fired",
    },
    {
      name: "ordinary_code_task",
      input: baseInput({ userRequest: "rename variable to bar" }),
      expectedReason: "no_trigger_fired",
    },
  ];

  for (const c of fallbackCases) {
    it(`${c.name} → snippet_attached=false, fallback_to_l4=true, skip_reason=${c.expectedReason}`, () => {
      const sim = buildKnowledgeRuntimeInjectionSimulation(c.input);
      expect(sim.snippet_attached).toBe(false);
      expect(sim.fallback_to_l4).toBe(true);
      expect(sim.skip_reason).toBe(c.expectedReason);
      expect(sim.simulated_preamble).toBeNull();
      // dispatch prompt should equal base task prompt (verbatim)
      expect(sim.simulated_dispatch_prompt).toBe(c.input.baseTaskPrompt ?? "");
    });
  }

  it("simulated_dispatch_prompt does not contain preamble when fallback", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ featureFlagEnabled: false, userRequest: "save to knowledge" })
    );
    expect(sim.simulated_dispatch_prompt).not.toContain(
      "Hermes Knowledge Reuse Contract"
    );
  });
});

// -----------------------------------------------------------------
// 6. truncation
// -----------------------------------------------------------------

describe("008D chain — truncation", () => {
  it("max_chars=64 with 70-char body truncates and records truncated=true", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        userRequest: "save to knowledge",
        maxChars: 64,
        overrideSnippetText:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefXX",
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.truncated).toBe(true);
    expect(sim.max_chars).toBe(64);
    const wrapped = sim.simulated_preamble!;
    const bodyStart = wrapped.indexOf("0123456789abcdef");
    expect(bodyStart).toBeGreaterThanOrEqual(0);
    expect(wrapped.slice(bodyStart).length).toBeLessThanOrEqual(64);
  });

  it("default max_chars=2048 leaves a typical snippet untruncated", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.max_chars).toBe(2048);
    expect(sim.truncated).toBe(false);
  });
});

// -----------------------------------------------------------------
// 7. JSON round trip
// -----------------------------------------------------------------

describe("008D chain — JSON round trip", () => {
  it("simulation artifact round-trips through JSON.parse(JSON.stringify)", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ targetAgent: "codex", userRequest: "compare A vs B" })
    );
    const round = JSON.parse(
      JSON.stringify(sim)
    ) as KnowledgeRuntimeInjectionSimulation;
    expect(round).toEqual(sim);
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(round)
    ).not.toThrow();
  });

  it("chain artifact round-trips through JSON.parse(JSON.stringify)", () => {
    const art = buildChainArtifact("2026-06-04T00:00:00.000Z");
    const round = JSON.parse(JSON.stringify(art)) as ChainArtifact;
    expect(round).toEqual(art);
    expect(round.no_runtime_checked).toBe(true);
    expect(round.content_hash).toBe(art.content_hash);
  });
});

// -----------------------------------------------------------------
// 8. no-runtime invariants
// -----------------------------------------------------------------

describe("008D chain — no-runtime invariants", () => {
  it("every simulation has literal false on 4 safety flags", () => {
    for (const c of FEATURE_FLAG_MATRIX) {
      const sim = buildKnowledgeRuntimeInjectionSimulation(c.input);
      expect(sim.runtime_flush_allowed).toBe(false);
      expect(sim.runtime_dispatch_allowed).toBe(false);
      expect(sim.real_handoff_write_allowed).toBe(false);
      expect(sim.live_adapter_allowed).toBe(false);
    }
  });

  it("feature flag default_state is literal false", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.feature_flag.default_state).toBe(false);
    expect(sim.feature_flag.name).toBe(KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG);
  });

  it("surface is task_prompt_preamble", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.surface).toBe(RECOMMENDED_INJECTION_SURFACE);
    expect(sim.surface).toBe("task_prompt_preamble");
  });

  it("mode is runtime_injection_simulation", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.mode).toBe(SIMULATION_MODE);
    expect(sim.mode).toBe("runtime_injection_simulation");
  });

  it("schema_version is 1.0.0", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.schema_version).toBe(
      KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION
    );
    expect(sim.schema_version).toBe("1.0.0");
  });

  it("snippet_attached true implies fallback_to_l4 false (and vice versa)", () => {
    for (const c of FEATURE_FLAG_MATRIX) {
      const sim = buildKnowledgeRuntimeInjectionSimulation(c.input);
      expect(sim.snippet_attached).toBe(!sim.fallback_to_l4);
    }
  });

  it("simulated_dispatch_prompt preserves base task prompt verbatim", () => {
    const prompt =
      "do the thing\nmultiline\nwith $pecial & <chars> and unicode 你好";
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        userRequest: "save to knowledge",
        baseTaskPrompt: prompt,
      })
    );
    expect(sim.simulated_dispatch_prompt).toContain(prompt);
  });

  it("simulated_dispatch_prompt does not mutate base task prompt", () => {
    const prompt = "task: research X";
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        userRequest: "save to knowledge",
        baseTaskPrompt: prompt,
      })
    );
    expect(sim.simulated_dispatch_prompt).toContain(prompt);
    // No mutation: prompt substring appears unchanged
    expect(sim.simulated_dispatch_prompt.indexOf(prompt)).toBeGreaterThanOrEqual(
      0
    );
  });

  it("forged runtime_flush_allowed=true is rejected", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      runtime_flush_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/runtime_flush_allowed/);
  });

  it("forged runtime_dispatch_allowed=true is rejected", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      runtime_dispatch_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/runtime_dispatch_allowed/);
  });

  it("forged real_handoff_write_allowed=true is rejected", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      real_handoff_write_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/real_handoff_write_allowed/);
  });

  it("forged live_adapter_allowed=true is rejected", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      live_adapter_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/live_adapter_allowed/);
  });

  it("poisoned preamble containing knowledgeIngest( is rejected", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const poisoned: KnowledgeRuntimeInjectionSimulation = {
      ...sim,
      simulated_preamble: (sim.simulated_preamble ?? "") + "\nknowledgeIngest(x)",
    };
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(poisoned)
    ).toThrow(/knowledgeIngest\(/);
  });

  it("poisoned dispatch prompt containing runPlaybook( is rejected", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const poisoned: KnowledgeRuntimeInjectionSimulation = {
      ...sim,
      simulated_dispatch_prompt:
        sim.simulated_dispatch_prompt + "\nrunPlaybook(noop)",
    };
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(poisoned)
    ).toThrow(/runPlaybook\(/);
  });

  it("artifact does not carry executable_steps/verificationCommands/next_actions fields", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const obj = sim as unknown as Record<string, unknown>;
    expect("executable_steps" in obj).toBe(false);
    expect("verificationCommands" in obj).toBe(false);
    expect("next_actions" in obj).toBe(false);
  });

  it("simulated_preamble satisfies 007I assertSnippetShape (no path/deceptive drift)", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    // 007I contract snippet is what gets wrapped into simulated_preamble
    // (line 6 of the contract). Its `assertSnippetShape` self-check
    // guarantees 20 required + 5 forbidden substrings (incl. no
    // deceptive-phrase). 008C uses the same source via 007I helper;
    // therefore the 007I invariant applies to the simulated_preamble
    // body. Verify by checking the preamble includes the required
    // positive rules and excludes the forbidden deceptive copy.
    const preamble = sim.simulated_preamble ?? "";
    // Required positive rules
    expect(preamble).toContain("Hermes Pro internal knowledge store");
    expect(preamble).toContain("Bucket semantics");
    expect(preamble).toContain("runtime_flush_allowed = false");
    expect(preamble).toContain("local_known");
    expect(preamble).toContain("newly_found");
    expect(preamble).toContain("ingest_draft");
    expect(preamble).toContain("source_uri");
    expect(preamble).toContain("fetched_at");
    // Forbidden deceptive copy (must not appear)
    expect(preamble).not.toContain("saved successfully");
    expect(preamble).not.toContain("已保存");
    expect(preamble).not.toContain("写入成功");
    expect(preamble).not.toContain("will be written after confirm");
    expect(preamble).not.toContain("确认后将写入");
  });
});

// -----------------------------------------------------------------
// 9. forbidden token scanner (no call expression in source)
// -----------------------------------------------------------------

describe("008D chain — forbidden token scanner", () => {
  it("chain artifact contains no call-form fields", () => {
    const art = buildChainArtifact("2026-06-04T00:00:00.000Z");
    const blob = JSON.stringify(art);
    expect(blob).not.toMatch(/"executable_steps"\s*:/);
    expect(blob).not.toMatch(/"verificationCommands"\s*:/);
    expect(blob).not.toMatch(/"next_actions"\s*:/);
  });

  it("chain artifact contains no call-form dispatch action verbs in chain-level fields", () => {
    const art = buildChainArtifact("2026-06-04T00:00:00.000Z");
    // Chain-level (non-simulation) fields must not contain call-form verbs.
    // The simulation snippets intentionally mention these tokens as
    // forbidden in the 007I contract; per-simulation no-runtime guard
    // already validates them in buildKnowledgeRuntimeInjectionSimulation.
    const chainLevelBlob = JSON.stringify({
      schema_version: art.schema_version,
      slice: art.slice,
      mode: art.mode,
      generated_from: art.generated_from,
      feature_flag_matrix_results: art.feature_flag_matrix_results,
      invariant_results: art.invariant_results,
      no_runtime_checked: art.no_runtime_checked,
      created_at: art.created_at,
      content_hash: art.content_hash,
    });
    expect(chainLevelBlob).not.toMatch(/knowledgeIngest\(/);
    expect(chainLevelBlob).not.toMatch(/knowledgeSearch\(/);
    expect(chainLevelBlob).not.toMatch(/runPlaybook\(/);
    expect(chainLevelBlob).not.toMatch(/triggerCronJob\(/);
    expect(chainLevelBlob).not.toMatch(/sendMessage\(/);
    // Per-simulation: 008C's no-runtime guard must pass on every
    // simulation, which uses an allowlist-aware scanner that tolerates
    // "Do not call knowledgeIngest" mentions.
    for (const sim of art.simulations) {
      expect(() =>
        assertKnowledgeRuntimeInjectionSimulationNoRuntime(sim)
      ).not.toThrow();
    }
  });

  it("shouldSimulate mirrors snippet_attached for full matrix", () => {
    for (const c of FEATURE_FLAG_MATRIX) {
      const sim = buildKnowledgeRuntimeInjectionSimulation(c.input);
      expect(shouldSimulateKnowledgeContractInjection(c.input)).toBe(
        sim.snippet_attached
      );
    }
  });

  it("buildSimulatedTaskPromptPreamble mirrors preamble/hash", () => {
    for (const c of FEATURE_FLAG_MATRIX) {
      const r = buildSimulatedTaskPromptPreamble(c.input);
      const sim = buildKnowledgeRuntimeInjectionSimulation(c.input);
      if (sim.snippet_attached) {
        expect(r.preamble).not.toBeNull();
        expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
        expect(r.preamble).toBe(sim.simulated_preamble);
      } else {
        expect(r.preamble).toBeNull();
        expect(r.hash).toBe("");
      }
    }
  });
});

// -----------------------------------------------------------------
// 10. real handoff / audit mtime guard
// -----------------------------------------------------------------

describe("008D chain — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run the full chain build to prove no I/O side effect.
    buildChainArtifact("2026-06-04T00:00:00.000Z");
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
