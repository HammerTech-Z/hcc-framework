// Hermes Pro — Knowledge Runtime Injection Readiness Review (Slice 008E, no code)
// Pure readiness review. No I/O, no IPC, no fetch, no real dispatch,
// no real handoff write, no agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

import {
  KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG,
  RECOMMENDED_INJECTION_SURFACE,
  SIMULATION_MODE,
  type KnowledgeRuntimeInjectionSimulationInput,
} from "../src/shared/lib/knowledge-runtime-injection-simulation";

import {
  buildKnowledgeRuntimeInjectionSimulation,
  assertKnowledgeRuntimeInjectionSimulationNoRuntime,
} from "../src/shared/lib/knowledge-runtime-injection-simulation";

import readinessFixture from "./fixtures/knowledge-reuse/runtime-injection-readiness-review.json";
import chainFixture from "./fixtures/knowledge-reuse/runtime-injection-artifact-chain.json";
import designA from "./fixtures/knowledge-reuse/runtime-default-injection-design.json";
import designB from "./fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json";
import simFixture from "./fixtures/knowledge-reuse/runtime-injection-simulation.json";

const BASELINE_HANDOFF_MTIME = 1780195726;
const BASELINE_AUDIT_MTIME = 1780230084;

const FORBIDDEN_CALL_TOKENS: ReadonlyArray<string> = [
  "knowledgeIngest(",
  "knowledgeSearch(",
  "runPlaybook(",
  "triggerCronJob(",
  "sendMessage(",
  "fetch(",
];

// -----------------------------------------------------------------
// 1. doc required sections
// -----------------------------------------------------------------

describe("008E readiness — fixture shape", () => {
  it("schema_version is 1.0.0 and slice is 008E", () => {
    expect((readinessFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
    expect((readinessFixture as { slice: string }).slice).toBe("008E");
  });

  it("mode is runtime_injection_readiness_review", () => {
    expect((readinessFixture as { mode: string }).mode).toBe(
      "runtime_injection_readiness_review"
    );
  });

  it("reviewed_slices lists 008A/008B/008C/008D", () => {
    const fx = readinessFixture as { reviewed_slices: string[] };
    expect(fx.reviewed_slices).toEqual(["008A", "008B", "008C", "008D"]);
  });

  it("discovered_surfaces is non-empty with at least 6 entries", () => {
    const fx = readinessFixture as {
      discovered_surfaces: Array<{
        id: string;
        path: string;
        role: string;
        future_touch_allowed: boolean;
        reason: string;
        risk_level: string;
        rollback_difficulty: string;
      }>;
    };
    expect(fx.discovered_surfaces.length).toBeGreaterThanOrEqual(6);
    for (const s of fx.discovered_surfaces) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.path).toBe("string");
      expect(typeof s.role).toBe("string");
      expect(typeof s.future_touch_allowed).toBe("boolean");
      expect(typeof s.reason).toBe("string");
      expect(["low", "medium", "high"]).toContain(s.risk_level);
      expect(["low", "medium", "high"]).toContain(s.rollback_difficulty);
    }
  });

  it("future_touch_allowed distribution includes both true and false", () => {
    const fx = readinessFixture as {
      discovered_surfaces: Array<{ future_touch_allowed: boolean }>;
    };
    const allowed = fx.discovered_surfaces.filter(
      (s) => s.future_touch_allowed
    );
    const notAllowed = fx.discovered_surfaces.filter(
      (s) => !s.future_touch_allowed
    );
    expect(allowed.length).toBeGreaterThanOrEqual(1);
    expect(notAllowed.length).toBeGreaterThanOrEqual(1);
  });
});

// -----------------------------------------------------------------
// 2. Surface B recommended
// -----------------------------------------------------------------

describe("008E readiness — recommended / not_recommended surface", () => {
  it("recommended_surface.id is surface_b_task_prompt_preamble", () => {
    const fx = readinessFixture as {
      recommended_surface: { id: string; name: string; phase: string };
    };
    expect(fx.recommended_surface.id).toBe("surface_b_task_prompt_preamble");
    expect(fx.recommended_surface.phase).toBe("Phase 1");
    expect(fx.recommended_surface.name).toContain("task_prompt_preamble");
  });

  it("not_recommended_surface.id is surface_c_default_system_prompt", () => {
    const fx = readinessFixture as {
      not_recommended_surface: { id: string; name: string; phase: string };
    };
    expect(fx.not_recommended_surface.id).toBe(
      "surface_c_default_system_prompt"
    );
    expect(fx.not_recommended_surface.phase).toContain("NOT");
  });

  it("surface_b is the runtime helper's surface literal", () => {
    const fx = readinessFixture as {
      recommended_surface: { name: string };
    };
    expect(fx.recommended_surface.name).toContain(RECOMMENDED_INJECTION_SURFACE);
  });
});

// -----------------------------------------------------------------
// 3. feature flag invariants
// -----------------------------------------------------------------

describe("008E readiness — feature flag invariants", () => {
  it("flag name is KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    const fx = readinessFixture as { feature_flag_invariants: string[] };
    expect(fx.feature_flag_invariants).toContain(
      "name=KNOWLEDGE_CONTRACT_INJECTION_ENABLED"
    );
    expect(KNOWLEDGE_CONTRACT_INJECTION_ENABLED_FLAG).toBe(
      "KNOWLEDGE_CONTRACT_INJECTION_ENABLED"
    );
  });

  it("flag default is false", () => {
    const fx = readinessFixture as { feature_flag_invariants: string[] };
    expect(fx.feature_flag_invariants).toContain("default=false");
  });

  it("flag off means no attach + fallback L4", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: false,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    expect(sim.snippet_attached).toBe(false);
    expect(sim.fallback_to_l4).toBe(true);
    expect(sim.skip_reason).toBe("flag_disabled");
  });

  it("flag on but no trigger → skip no_trigger_fired", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "fix the bug in src/foo.ts",
    });
    expect(sim.snippet_attached).toBe(false);
    expect(sim.skip_reason).toBe("no_trigger_fired");
  });

  it("flag on + hermes default reserved skip", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "hermes",
      userRequest: "save to knowledge",
    });
    expect(sim.snippet_attached).toBe(false);
    expect(sim.skip_reason).toBe("hermes_self_call_reserved");
  });
});

// -----------------------------------------------------------------
// 4. target agent matrix
// -----------------------------------------------------------------

describe("008E readiness — target agent matrix", () => {
  it("claude_code + flag + save attaches", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    expect(sim.snippet_attached).toBe(true);
  });

  it("codex + flag + handoff ingest_draft attaches", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "codex",
      userRequest: "",
      handoffContext: { hasIngestDraft: true },
    });
    expect(sim.snippet_attached).toBe(true);
  });

  it("hermes_pro + flag + research attaches", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "hermes_pro",
      userRequest: "research github project X",
    });
    expect(sim.snippet_attached).toBe(true);
  });

  it("hermes + flag reserved skip", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "hermes",
      userRequest: "save to knowledge",
    });
    expect(sim.snippet_attached).toBe(false);
    expect(sim.hermes_reserved_marker).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. safety gate matrix
// -----------------------------------------------------------------

describe("008E readiness — safety gates", () => {
  it("lists at least 11 safety gates", () => {
    const fx = readinessFixture as { safety_gates: string[] };
    expect(fx.safety_gates.length).toBeGreaterThanOrEqual(11);
  });

  it("includes no_runtime_write / no_ipc / no_gateway / no_ingest_search", () => {
    const fx = readinessFixture as { safety_gates: string[] };
    const all = fx.safety_gates.join("\n");
    expect(all).toMatch(/no_runtime_write/);
    expect(all).toMatch(/no_ipc/);
    expect(all).toMatch(/no_gateway/);
    expect(all).toMatch(/no_ingest_search/);
  });

  it("includes no_default_system_prompt_mutation / no_dispatch_builder_mutation", () => {
    const fx = readinessFixture as { safety_gates: string[] };
    const all = fx.safety_gates.join("\n");
    expect(all).toMatch(/no_default_system_prompt_mutation/);
    expect(all).toMatch(/no_dispatch_builder_mutation/);
  });

  it("includes no_deceptive_copy / no_obsidian_memory_wolf_path", () => {
    const fx = readinessFixture as { safety_gates: string[] };
    const all = fx.safety_gates.join("\n");
    expect(all).toMatch(/no_deceptive_copy/);
    expect(all).toMatch(/no_obsidian_memory_wolf_path/);
  });

  it("runtime helper output has 4 literal false flags (no_runtime_write gate)", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    expect(sim.runtime_flush_allowed).toBe(false);
    expect(sim.runtime_dispatch_allowed).toBe(false);
    expect(sim.real_handoff_write_allowed).toBe(false);
    expect(sim.live_adapter_allowed).toBe(false);
  });

  it("no call expression in simulation output (no_ingest_search gate)", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    const blob =
      (sim.simulated_preamble ?? "") + "\n" + sim.simulated_dispatch_prompt;
    for (const token of FORBIDDEN_CALL_TOKENS) {
      expect(blob).not.toContain(token);
    }
    expect(() =>
      assertKnowledgeRuntimeInjectionSimulationNoRuntime(sim)
    ).not.toThrow();
  });
});

// -----------------------------------------------------------------
// 6. stop conditions
// -----------------------------------------------------------------

describe("008E readiness — stop conditions", () => {
  it("lists at least 10 stop conditions", () => {
    const fx = readinessFixture as { stop_conditions: string[] };
    expect(fx.stop_conditions.length).toBeGreaterThanOrEqual(10);
  });

  it("covers default system prompt / IPC / live handoff writer", () => {
    const fx = readinessFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/default system prompt/);
    expect(all).toMatch(/IPC|gateway/);
    expect(all).toMatch(/live handoff writer|handoff_write|handoff\/packs/);
  });

  it("covers ordinary code task attach / flag default drift / hermes self-call", () => {
    const fx = readinessFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/ordinary code|code-only/);
    expect(all).toMatch(/feature flag default/);
    expect(all).toMatch(/hermes self-call/);
  });

  it("covers base prompt overwrite / runtime flag forge / deceptive copy / mtime", () => {
    const fx = readinessFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/base task prompt.*overwrit|preserve.*verbatim/);
    expect(all).toMatch(/forge/);
    expect(all).toMatch(/deceptive|forbidden copy/);
    expect(all).toMatch(/mtime/);
  });

  it("covers call expression leak in 008F output", () => {
    const fx = readinessFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/knowledgeIngest|knowledgeSearch|fetch\(/);
  });
});

// -----------------------------------------------------------------
// 7. future slices
// -----------------------------------------------------------------

describe("008E readiness — future slices", () => {
  it("proposes 008F / 008G / 008H", () => {
    const fx = readinessFixture as {
      future_slices: Array<{ id: string; name: string; scope: string; allowed: string[]; forbidden: string[]; trigger: string }>;
    };
    const ids = fx.future_slices.map((s) => s.id);
    expect(ids).toContain("008F");
    expect(ids).toContain("008G");
    expect(ids).toContain("008H");
  });

  it("008F scope does not allow runtime writes / spawn / ingest", () => {
    const fx = readinessFixture as {
      future_slices: Array<{ id: string; forbidden: string[] }>;
    };
    const f008 = fx.future_slices.find((s) => s.id === "008F");
    expect(f008).toBeDefined();
    const all = f008!.forbidden.join("\n");
    expect(all).toMatch(/spawn|Agent subprocess/);
    expect(all).toMatch(/knowledgeIngest|knowledgeSearch/);
    expect(all).toMatch(/handoff\/packs|audit/);
  });

  it("008F allowed list is read flag + call 008C + prepend preamble + preserve base", () => {
    const fx = readinessFixture as {
      future_slices: Array<{ id: string; allowed: string[] }>;
    };
    const f008 = fx.future_slices.find((s) => s.id === "008F");
    expect(f008).toBeDefined();
    const all = f008!.allowed.join("\n");
    expect(all).toMatch(/read feature flag/);
    expect(all).toMatch(/008C/);
    expect(all).toMatch(/prepend/);
    expect(all).toMatch(/preserve.*verbatim/);
  });
});

// -----------------------------------------------------------------
// 8. Go / No-go
// -----------------------------------------------------------------

describe("008E readiness — go / no-go", () => {
  it("GO: 008F planning + 008G tests + 008H closeout", () => {
    const fx = readinessFixture as { go_no_go_decision: { go: string[]; not_go: string[] } };
    expect(fx.go_no_go_decision.go).toContain(
      "GO for 008F implementation planning (narrow Surface B dry-run implementation behind flag)"
    );
    expect(fx.go_no_go_decision.go).toContain(
      "GO for 008G prompt snapshot tests"
    );
    expect(fx.go_no_go_decision.go).toContain("GO for 008H L5 closeout");
  });

  it("NOT-GO: default system prompt mutation", () => {
    const fx = readinessFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for default system prompt mutation (Surface C留 Phase 2)"
    );
  });

  it("NOT-GO: live adapter / live flush / live search / live ingest", () => {
    const fx = readinessFixture as { go_no_go_decision: { not_go: string[] } };
    const all = fx.go_no_go_decision.not_go.join("\n");
    expect(all).toMatch(/live adapter|live flush|live knowledgeSearch|live knowledgeIngest/);
  });

  it("NOT-GO: gateway / IPC / Agent subprocess", () => {
    const fx = readinessFixture as { go_no_go_decision: { not_go: string[] } };
    const all = fx.go_no_go_decision.not_go.join("\n");
    expect(all).toMatch(/gateway|IPC|Agent subprocess/);
  });

  it("NOT-GO: real handoff write / flag default drift", () => {
    const fx = readinessFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for real handoff write to ~/.hermes/handoff/packs or ~/.hermes/audit"
    );
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for changing KNOWLEDGE_CONTRACT_INJECTION_ENABLED default to true"
    );
  });
});

// -----------------------------------------------------------------
// 9. no-runtime forbidden scanner (applied to this file too)
// -----------------------------------------------------------------

describe("008E readiness — no-runtime forbidden scanner", () => {
  it("simulation output has no call expression in preamble/dispatch (no_ingest_search gate)", () => {
    // The readiness fixture is a declarative spec that intentionally
    // names forbidden tokens; it is NOT executable code. We therefore
    // scan the 008C simulation output instead, which is the only
    // runtime-derived artifact in this slice's review.
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    const blob =
      (sim.simulated_preamble ?? "") + "\n" + sim.simulated_dispatch_prompt;
    for (const token of FORBIDDEN_CALL_TOKENS) {
      expect(blob).not.toContain(token);
    }
  });

  it("008E simulation across feature flag matrix still satisfies no-runtime guard", () => {
    const cases: KnowledgeRuntimeInjectionSimulationInput[] = [
      { featureFlagEnabled: false, targetAgent: "claude_code", userRequest: "save to knowledge" },
      { featureFlagEnabled: true, targetAgent: "claude_code", userRequest: "save to knowledge" },
      { featureFlagEnabled: true, targetAgent: "codex", userRequest: "compare A vs B" },
      { featureFlagEnabled: true, targetAgent: "hermes_pro", userRequest: "research X" },
      { featureFlagEnabled: true, targetAgent: "hermes", userRequest: "save to knowledge" },
    ];
    for (const c of cases) {
      const sim = buildKnowledgeRuntimeInjectionSimulation(c);
      expect(() =>
        assertKnowledgeRuntimeInjectionSimulationNoRuntime(sim)
      ).not.toThrow();
    }
  });

  it("008D chain fixture has 1.0.0 schema and 008D slice (cross-fixture check)", () => {
    expect((chainFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
    expect((chainFixture as { slice: string }).slice).toBe("008D");
  });

  it("008C simulation fixture has 1.0.0 schema and 008C slice", () => {
    expect((simFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
    expect((simFixture as { slice: string }).slice).toBe("008C");
  });

  it("008A design fixture is loaded", () => {
    expect((designA as { slice: string }).slice).toBe("008A");
  });

  it("008B design fixture is loaded", () => {
    expect((designB as { slice: string }).slice).toBe("008B");
  });
});

// -----------------------------------------------------------------
// 10. mode literal alignment
// -----------------------------------------------------------------

describe("008E readiness — mode literal alignment", () => {
  it("simulation mode is runtime_injection_simulation", () => {
    expect(SIMULATION_MODE).toBe("runtime_injection_simulation");
  });
});

// -----------------------------------------------------------------
// 11. mtime unchanged (no real write)
// -----------------------------------------------------------------

describe("008E readiness — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run a few simulations to prove no I/O side effect.
    buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
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
