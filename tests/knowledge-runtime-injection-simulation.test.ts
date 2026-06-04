// Hermes Pro — Knowledge Runtime Injection Simulation (Slice 008C, no runtime)
// Pure simulation tests. No I/O, no IPC, no fetch, no real dispatch.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

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
} from "../src/shared/lib/knowledge-runtime-injection-simulation";

import fixture from "./fixtures/knowledge-reuse/runtime-injection-simulation.json";

const BASELINE_HANDOFF_MTIME = 1780195726;
const BASELINE_AUDIT_MTIME = 1780230084;

function baseInput(
  overrides: Partial<KnowledgeRuntimeInjectionSimulationInput> = {}
): KnowledgeRuntimeInjectionSimulationInput {
  return {
    featureFlagEnabled: true,
    targetAgent: "claude_code",
    userRequest: "save this to the knowledge base",
    ...overrides,
  };
}

describe("knowledge-runtime-injection-simulation — schema/mode", () => {
  it("uses 1.0.0 schema and runtime_injection_simulation mode", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.schema_version).toBe(
      KNOWLEDGE_RUNTIME_INJECTION_SIMULATION_SCHEMA_VERSION
    );
    expect(sim.schema_version).toBe("1.0.0");
    expect(sim.mode).toBe(SIMULATION_MODE);
    expect(sim.mode).toBe("runtime_injection_simulation");
  });

  it("uses task_prompt_preamble surface and the canonical flag name", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.surface).toBe(RECOMMENDED_INJECTION_SURFACE);
    expect(sim.surface).toBe("task_prompt_preamble");
    expect(sim.feature_flag.name).toBe(
      KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG
    );
    expect(sim.feature_flag.name).toBe(
      "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"
    );
    expect(sim.feature_flag.default_state).toBe(false);
  });
});

describe("knowledge-runtime-injection-simulation — feature flag behavior", () => {
  it("flag disabled skips injection and falls back to L4", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({ featureFlagEnabled: false })
    );
    expect(sim.snippet_attached).toBe(false);
    expect(sim.fallback_to_l4).toBe(true);
    expect(sim.skip_reason).toBe("flag_disabled");
    expect(sim.feature_flag.enabled).toBe(false);
    expect(sim.simulated_preamble).toBeNull();
    expect(sim.safety_gate_result.pass).toBe(false);
    expect(sim.safety_gate_result.reason).toBe("flag_disabled");
  });

  it("flag enabled + claude_code + save keyword attaches snippet", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.fallback_to_l4).toBe(false);
    expect(sim.skip_reason).toBeNull();
    expect(sim.target_agent).toBe("claude_code");
    expect(sim.trigger_flags.save_keyword).toBe(true);
    expect(sim.safety_gate_result.pass).toBe(true);
  });

  it("flag enabled + codex + research + tool_comparison attaches snippet", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "codex",
        userRequest: "compare gpt-4 vs claude vs qwen on coding tasks",
        taskKind: "tool_comparison",
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.target_agent).toBe("codex");
    expect(sim.trigger_flags.research_keyword).toBe(true);
    expect(sim.trigger_flags.research_task_kind).toBe(true);
  });

  it("flag enabled + hermes_pro + research attaches snippet", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "hermes_pro",
        userRequest: "research github project X for a later decision",
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.target_agent).toBe("hermes_pro");
    expect(sim.trigger_flags.research_keyword).toBe(true);
    expect(sim.hermes_reserved_marker).toBe(false);
  });
});

describe("knowledge-runtime-injection-simulation — skip / fallback", () => {
  it("hermes self-call skips by default", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "hermes",
        userRequest: "save to knowledge",
        handoffContext: { hasIngestDraft: true },
      })
    );
    expect(sim.snippet_attached).toBe(false);
    expect(sim.fallback_to_l4).toBe(true);
    expect(sim.skip_reason).toBe("hermes_self_call_reserved");
    expect(sim.hermes_reserved_marker).toBe(true);
  });

  it("ordinary code-only task skips", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "fix the bug in src/foo.ts",
      })
    );
    expect(sim.snippet_attached).toBe(false);
    expect(sim.fallback_to_l4).toBe(true);
    expect(sim.skip_reason).toBe("no_trigger_fired");
    expect(sim.trigger_flags.save_keyword).toBe(false);
    expect(sim.trigger_flags.research_keyword).toBe(false);
    expect(sim.trigger_flags.research_task_kind).toBe(false);
    expect(sim.trigger_flags.has_ingest_draft).toBe(false);
    expect(sim.trigger_flags.has_flush_pending).toBe(false);
    expect(sim.trigger_flags.has_local_known_and_newly_found).toBe(false);
  });

  it("handoff context has_ingest_draft triggers attach", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "",
        handoffContext: { hasIngestDraft: true },
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.trigger_flags.has_ingest_draft).toBe(true);
  });

  it("handoff context has_flush_pending triggers attach", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "",
        handoffContext: { hasFlushPending: true },
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.trigger_flags.has_flush_pending).toBe(true);
  });

  it("local_known + newly_found triggers attach", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "",
        handoffContext: { hasLocalKnownAndNewlyFound: true },
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.trigger_flags.has_local_known_and_newly_found).toBe(true);
  });
});

describe("knowledge-runtime-injection-simulation — max_chars", () => {
  it("enforces max_chars and records truncated=true", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
        maxChars: 64,
        overrideSnippetText:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdefXX",
      })
    );
    expect(sim.snippet_attached).toBe(true);
    expect(sim.max_chars).toBe(64);
    expect(sim.truncated).toBe(true);
    expect(sim.simulated_preamble).not.toBeNull();
    // The wrapped preamble contains header + body; verify the body
    // substring inside is <= max_chars.
    const wrapped = sim.simulated_preamble!;
    const bodyStart = wrapped.indexOf("0123456789abcdef");
    expect(bodyStart).toBeGreaterThanOrEqual(0);
    const bodyInWrap = wrapped.slice(bodyStart);
    expect(bodyInWrap.length).toBeLessThanOrEqual(64);
  });

  it("default max_chars is 2048", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.max_chars).toBe(2048);
  });
});

describe("knowledge-runtime-injection-simulation — simulated_dispatch_prompt", () => {
  it("includes preamble only when attached", () => {
    const attached = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
        baseTaskPrompt: "task: research X",
      })
    );
    expect(attached.simulated_dispatch_prompt).toContain(
      "Hermes Knowledge Reuse Contract"
    );
    expect(attached.simulated_dispatch_prompt).toContain("task: research X");

    const skipped = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: false,
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
        baseTaskPrompt: "task: research X",
      })
    );
    expect(skipped.simulated_dispatch_prompt).not.toContain(
      "Hermes Knowledge Reuse Contract"
    );
    expect(skipped.simulated_dispatch_prompt).toBe("task: research X");
  });

  it("preserves base task prompt verbatim when present", () => {
    const prompt =
      "do the thing\nmultiline\nwith $pecial & <chars> and unicode 你好";
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
        baseTaskPrompt: prompt,
      })
    );
    expect(sim.simulated_dispatch_prompt).toContain(prompt);
  });

  it("empty base prompt yields dispatch prompt starting with preamble", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      })
    );
    expect(sim.simulated_dispatch_prompt.startsWith(sim.simulated_preamble!)).toBe(
      true
    );
  });
});

describe("knowledge-runtime-injection-simulation — hard safety flags", () => {
  it("runtime_flush_allowed=false", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.runtime_flush_allowed).toBe(false);
  });

  it("runtime_dispatch_allowed=false", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.runtime_dispatch_allowed).toBe(false);
  });

  it("real_handoff_write_allowed=false", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.real_handoff_write_allowed).toBe(false);
  });

  it("live_adapter_allowed=false", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(sim.live_adapter_allowed).toBe(false);
  });
});

describe("knowledge-runtime-injection-simulation — no-runtime guard", () => {
  it("passes for normally produced payload", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(sim)
    ).not.toThrow();
  });

  it("rejects forged runtime_flush_allowed=true", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      runtime_flush_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/runtime_flush_allowed/);
  });

  it("rejects forged runtime_dispatch_allowed=true", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      runtime_dispatch_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/runtime_dispatch_allowed/);
  });

  it("rejects forged real_handoff_write_allowed=true", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      real_handoff_write_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/real_handoff_write_allowed/);
  });

  it("rejects forged live_adapter_allowed=true", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const forged = {
      ...sim,
      live_adapter_allowed: true as unknown as false,
    } as unknown as KnowledgeRuntimeInjectionSimulation;
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(forged)
    ).toThrow(/live_adapter_allowed/);
  });

  it("rejects simulated output containing forbidden call expression", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(baseInput());
    const poisoned: KnowledgeRuntimeInjectionSimulation = {
      ...sim,
      simulated_preamble: (sim.simulated_preamble ?? "") + "\nknowledgeIngest(x)",
    };
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(poisoned)
    ).toThrow(/knowledgeIngest\(/);
  });
});

describe("knowledge-runtime-injection-simulation — shouldSimulate / build helpers", () => {
  it("shouldSimulateKnowledgeContractInjection mirrors snippet_attached", () => {
    const cases: Array<{
      input: KnowledgeRuntimeInjectionSimulationInput;
      expected: boolean;
    }> = [
      {
        input: baseInput({
          featureFlagEnabled: false,
          userRequest: "save to knowledge",
        }),
        expected: false,
      },
      {
        input: baseInput({ userRequest: "fix the bug" }),
        expected: false,
      },
      {
        input: baseInput({
          targetAgent: "hermes",
          userRequest: "save to knowledge",
        }),
        expected: false,
      },
      {
        input: baseInput({
          targetAgent: "claude_code",
          userRequest: "save to knowledge",
        }),
        expected: true,
      },
      {
        input: baseInput({
          targetAgent: "claude_code",
          userRequest: "",
          handoffContext: { hasIngestDraft: true },
        }),
        expected: true,
      },
    ];
    for (const c of cases) {
      expect(shouldSimulateKnowledgeContractInjection(c.input)).toBe(
        c.expected
      );
    }
  });

  it("buildSimulatedTaskPromptPreamble returns null when no attach", () => {
    const r = buildSimulatedTaskPromptPreamble(
      baseInput({ featureFlagEnabled: false })
    );
    expect(r.preamble).toBeNull();
    expect(r.truncated).toBe(false);
    expect(r.hash).toBe("");
  });

  it("buildSimulatedTaskPromptPreamble returns non-null + hash when attach", () => {
    const r = buildSimulatedTaskPromptPreamble(
      baseInput({ userRequest: "save to knowledge" })
    );
    expect(r.preamble).not.toBeNull();
    expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("knowledge-runtime-injection-simulation — JSON round trip", () => {
  it("round-trips through JSON.parse(JSON.stringify(...))", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation(
      baseInput({
        featureFlagEnabled: true,
        targetAgent: "codex",
        userRequest: "compare A vs B",
        baseTaskPrompt: "task: X",
      })
    );
    const round = JSON.parse(JSON.stringify(sim)) as KnowledgeRuntimeInjectionSimulation;
    expect(round).toEqual(sim);
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(round)
    ).not.toThrow();
  });

  it("fixture has expected number of examples", () => {
    const fx = fixture as { examples: unknown[] };
    expect(Array.isArray(fx.examples)).toBe(true);
    expect(fx.examples.length).toBeGreaterThanOrEqual(7);
  });
});

describe("knowledge-runtime-injection-simulation — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    // Read baseline mtime now; tests do not write, so before==after.
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run a build to prove no I/O side effect.
    buildKnowledgeRuntimeInjectionSimulation(baseInput());
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
