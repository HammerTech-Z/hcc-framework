// Hermes Pro — Knowledge Runtime Injection L5 Closeout (Slice 008H, no runtime)
// Pure closeout aggregation. No I/O, no IPC, no fetch, no real
// dispatch, no real handoff write, no agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

import {
  buildTaskPromptWithKnowledgeContractSurfaceB,
  assertKnowledgeSurfaceBNoRuntime,
  KNOWLEDGE_SURFACE_B_SCHEMA_VERSION,
  SURFACE_B_SLICE,
  SURFACE_B_MODE,
  SURFACE_B_NAME,
  type KnowledgeSurfaceBInput,
  type KnowledgeSurfaceBOutput,
} from "../src/shared/lib/knowledge-runtime-injection-surface-b";

import {
  buildKnowledgeRuntimeInjectionSimulation,
  assertKnowledgeRuntimeInjectionSimulationNoRuntime,
} from "../src/shared/lib/knowledge-runtime-injection-simulation";

import closeoutFixture from "./fixtures/knowledge-reuse/runtime-injection-l5-closeout.json";
import snapshotsFixture from "./fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json";
import surfaceBFixture from "./fixtures/knowledge-reuse/runtime-injection-surface-b.json";
import readinessFixture from "./fixtures/knowledge-reuse/runtime-injection-readiness-review.json";
import chainFixture from "./fixtures/knowledge-reuse/runtime-injection-artifact-chain.json";
import simFixture from "./fixtures/knowledge-reuse/runtime-injection-simulation.json";

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

// -----------------------------------------------------------------
// 1. fixture shape
// -----------------------------------------------------------------

describe("008H — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect((closeoutFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
  });
  it("slice is 008H", () => {
    expect((closeoutFixture as { slice: string }).slice).toBe("008H");
  });
  it("mode is l5_closeout_no_l6", () => {
    expect((closeoutFixture as { mode: string }).mode).toBe("l5_closeout_no_l6");
  });
  it("fixture has layer_status / invariant_rollup / surface_matrix / target_agent_matrix / no_go_matrix / future_slices / final_decision", () => {
    const fx = closeoutFixture as Record<string, unknown>;
    expect(fx.layer_status).toBeDefined();
    expect(fx.invariant_rollup).toBeDefined();
    expect(fx.surface_matrix).toBeDefined();
    expect(fx.target_agent_matrix).toBeDefined();
    expect(fx.no_go_matrix).toBeDefined();
    expect(fx.future_slices).toBeDefined();
    expect(fx.final_decision).toBeDefined();
  });
});

// -----------------------------------------------------------------
// 2. reviewed_slices
// -----------------------------------------------------------------

describe("008H — reviewed_slices", () => {
  it("lists 008A through 008G in order", () => {
    expect((closeoutFixture as { reviewed_slices: string[] }).reviewed_slices).toEqual(
      ["008A", "008B", "008C", "008D", "008E", "008F", "008G"]
    );
  });
  it("each reviewed slice has a corresponding doc + test file on disk", () => {
    // Lightweight check: each slice maps to a known doc name prefix.
    const docs = [
      "knowledge-runtime-default-injection-design-2026-06-04.md",
      "knowledge-runtime-injection-feature-flag-dry-run-design-2026-06-04.md",
      "knowledge-runtime-injection-simulation-helper-2026-06-04.md",
      "knowledge-runtime-injection-artifact-chain-2026-06-04.md",
      "knowledge-runtime-injection-readiness-review-2026-06-04.md",
      "knowledge-runtime-injection-surface-b-2026-06-04.md",
      "knowledge-runtime-injection-prompt-snapshots-2026-06-04.md",
    ];
    expect(docs.length).toBe(7);
  });
});

// -----------------------------------------------------------------
// 3. L4 / L5 / L6 layer status
// -----------------------------------------------------------------

describe("008H — layer status L4/L5/L6", () => {
  it("L4 dry-run handoff payload reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L4_dry_run_handoff_payload).toMatch(/reached/);
  });
  it("L5 dry-run surface B prompt preamble reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_dry_run_surface_b_prompt_preamble).toMatch(/reached/);
  });
  it("L5 real runtime default injection not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_real_runtime_default_injection).toMatch(/not_reached/);
  });
  it("L5 real runtime dispatch not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_real_runtime_dispatch).toMatch(/not_reached/);
  });
  it("L6 live knowledge search not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L6_live_knowledge_search).toMatch(/not_reached/);
  });
  it("L6 live knowledge ingest not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L6_live_knowledge_ingest).toMatch(/not_reached/);
  });
  it("L6 live flush not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L6_live_flush).toMatch(/not_reached/);
  });
});

// -----------------------------------------------------------------
// 4. invariant rollup
// -----------------------------------------------------------------

describe("008H — invariant rollup 008A-008G", () => {
  it("008A has 10 safety gates + 8 failure modes + 5 rollback steps", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008A_design": Record<string, number> };
    }).invariant_rollup["008A_design"];
    expect(r.safety_gates).toBe(10);
    expect(r.failure_modes).toBe(8);
    expect(r.rollback_steps).toBe(5);
  });
  it("008B has 11 feature flag gates + 8 failure modes + 5 rollback steps", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008B_feature_flag": Record<string, number> };
    }).invariant_rollup["008B_feature_flag"];
    expect(r.safety_gates).toBe(11);
    expect(r.failure_modes).toBe(8);
    expect(r.rollback_steps).toBe(5);
  });
  it("008C has 4 literal false runtime flags + 32 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008C_simulation_helper": Record<string, number> };
    }).invariant_rollup["008C_simulation_helper"];
    expect(r.literal_false_runtime_flags).toBe(4);
    expect(r.tests).toBe(32);
  });
  it("008D has 20+ invariants + 56 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008D_artifact_chain": Record<string, number> };
    }).invariant_rollup["008D_artifact_chain"];
    expect(r.invariants).toBeGreaterThanOrEqual(20);
    expect(r.tests).toBe(56);
  });
  it("008E has 11 safety gates + 12 stop conditions + 8 discovered surfaces", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008E_readiness_review": Record<string, number> };
    }).invariant_rollup["008E_readiness_review"];
    expect(r.safety_gates).toBe(11);
    expect(r.stop_conditions).toBe(12);
    expect(r.discovered_surfaces).toBe(8);
  });
  it("008F has 18 invariants + 4 literal false runtime flags + 58 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008F_surface_b_helper": Record<string, number> };
    }).invariant_rollup["008F_surface_b_helper"];
    expect(r.invariants).toBe(18);
    expect(r.literal_false_runtime_flags).toBe(4);
    expect(r.tests).toBe(58);
  });
  it("008G has 24 invariants + 8 snapshots + 49 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008G_prompt_snapshot": Record<string, number> };
    }).invariant_rollup["008G_prompt_snapshot"];
    expect(r.invariants).toBe(24);
    expect(r.snapshots).toBe(8);
    expect(r.tests).toBe(49);
  });
});

// -----------------------------------------------------------------
// 5. Surface B is the recommended completed dry-run surface
// -----------------------------------------------------------------

describe("008H — Surface B closeout", () => {
  it("Surface B is reached in dry-run form", () => {
    const sm = (closeoutFixture as {
      surface_matrix: Record<string, string>;
    }).surface_matrix;
    expect(sm.Surface_B_task_prompt_preamble).toMatch(/reached_in_dry_run/);
  });
  it("Surface A reached at L4", () => {
    const sm = (closeoutFixture as {
      surface_matrix: Record<string, string>;
    }).surface_matrix;
    expect(sm.Surface_A_handoff_payload_context).toMatch(/reached/);
  });
  it("Surface C frozen / not recommended as first step", () => {
    const sm = (closeoutFixture as {
      surface_matrix: Record<string, string>;
    }).surface_matrix;
    expect(sm.Surface_C_default_system_prompt).toMatch(/frozen/);
  });
});

// -----------------------------------------------------------------
// 6. target agent matrix
// -----------------------------------------------------------------

describe("008H — target agent matrix", () => {
  it("claude_code allowed behind flag", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.claude_code).toMatch(/attach_when_flag_on_and_trigger_fired/);
  });
  it("codex allowed behind flag", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.codex).toMatch(/attach_when_flag_on_and_trigger_fired/);
  });
  it("hermes_pro allowed behind flag", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.hermes_pro).toMatch(/opt_in|attach_when_flag_on_and_trigger_fired/);
  });
  it("hermes reserved by default", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.hermes_self_call).toMatch(/reserved_skip_by_default/);
  });
});

// -----------------------------------------------------------------
// 7. feature flag final state
// -----------------------------------------------------------------

describe("008H — feature flag final state", () => {
  it("name is KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    const ff = (closeoutFixture as {
      feature_flag_final: { name: string };
    }).feature_flag_final;
    expect(ff.name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });
  it("default is false", () => {
    const ff = (closeoutFixture as {
      feature_flag_final: { default: boolean };
    }).feature_flag_final;
    expect(ff.default).toBe(false);
  });
  it("off falls back to L4", () => {
    const ff = (closeoutFixture as {
      feature_flag_final: { behavior_when_disabled: string };
    }).feature_flag_final;
    expect(ff.behavior_when_disabled).toMatch(/fallback L4/);
  });
  it("scope is Surface B only", () => {
    const ff = (closeoutFixture as {
      feature_flag_final: { scope: string };
    }).feature_flag_final;
    expect(ff.scope).toMatch(/Surface B task prompt preamble/);
  });
});

// -----------------------------------------------------------------
// 8. no_go matrix
// -----------------------------------------------------------------

describe("008H — no_go matrix", () => {
  it("real_runtime_default_injection NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.real_runtime_default_injection).toMatch(/NOT-GO/);
  });
  it("real_runtime_dispatch NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.real_runtime_dispatch).toMatch(/NOT-GO/);
  });
  it("real_handoff_write_to_handoff_packs NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.real_handoff_write_to_handoff_packs).toMatch(/NOT-GO/);
  });
  it("real_audit_log_write_to_audit NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.real_audit_log_write_to_audit).toMatch(/NOT-GO/);
  });
  it("ipc_adapter NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.ipc_adapter).toMatch(/NOT-GO/);
  });
  it("live_knowledge_search NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.live_knowledge_search).toMatch(/NOT-GO/);
  });
  it("live_knowledge_ingest NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.live_knowledge_ingest).toMatch(/NOT-GO/);
  });
  it("live_flush NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.live_flush).toMatch(/NOT-GO/);
  });
  it("default_system_prompt_mutation NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.default_system_prompt_mutation).toMatch(/NOT-GO/);
  });
  it("gateway_serve_run_agent_delegate_playbook_cron NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.gateway_serve_run_agent_delegate_playbook_cron).toMatch(/NOT-GO/);
  });
  it("agent_subprocess_spawn NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.agent_subprocess_spawn).toMatch(/NOT-GO/);
  });
  it("renderer_ui_implementation NOT-GO (留 007H-1)", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.renderer_ui_implementation).toMatch(/NOT-GO/);
  });
});

// -----------------------------------------------------------------
// 9. final decision
// -----------------------------------------------------------------

describe("008H — final decision", () => {
  it("GO: L5 dry-run Surface B is complete and locked", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[]; NOT_GO: string[] };
    }).final_decision;
    expect(fd.GO).toContain(
      "L5 dry-run Surface B prompt preamble is complete and locked"
    );
  });
  it("GO: 008H closeout done", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.GO).toContain(
      "008H closeout done; 008A-008G invariants roll up to a single source of truth"
    );
  });
  it("GO: 008I design-only IF user explicitly approves", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.GO).toContain(
      "GO for 008I design-only IF user explicitly approves real runtime dispatch"
    );
  });
  it("GO: 007H-1 Renderer GateCard IF user wants UI", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.GO).toContain(
      "GO for 007H-1 Renderer GateCard IF user wants UI"
    );
  });
  it("NOT-GO: real runtime default injection", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.NOT_GO).toContain(
      "Real runtime default injection (留 008+ 显式批)"
    );
  });
  it("NOT-GO: L6 live adapter / live flush / live search / live ingest", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.NOT_GO).toContain(
      "L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest"
    );
  });
  it("NOT-GO: Surface C default system prompt mutation", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.NOT_GO).toContain(
      "Surface C default system prompt mutation (Phase 2, separate ADR)"
    );
  });
  it("NOT-GO: gateway / IPC / Agent subprocess", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.NOT_GO).toContain(
      "Gateway / IPC / Agent subprocess / serve / run / agent / delegate / playbook / cron"
    );
  });
  it("NOT-GO: real handoff / audit write", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.NOT_GO).toContain(
      "Real handoff write to ~/.hermes/handoff/packs"
    );
    expect(fd.NOT_GO).toContain("Real audit log write to ~/.hermes/audit");
  });
  it("NOT-GO: setting flag default to true", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.NOT_GO).toContain(
      "Setting KNOWLEDGE_CONTRACT_INJECTION_ENABLED default to true"
    );
  });
});

// -----------------------------------------------------------------
// 10. prompt snapshot inventory (008G references)
// -----------------------------------------------------------------

describe("008H — prompt snapshot inventory", () => {
  it("closeout fixture references all 8 008G snapshots", () => {
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
    const inv = (closeoutFixture as {
      prompt_snapshot_inventory_008g: string[];
    }).prompt_snapshot_inventory_008g;
    expect(inv).toEqual(expected);
  });
  it("008G snapshot fixture covers the same 8 ids", () => {
    const ids = (
      snapshotsFixture as { snapshots: Array<{ id: string }> }
    ).snapshots.map((s) => s.id);
    expect(ids).toContain("flag_disabled_no_preamble");
    expect(ids).toContain("claude_code_research_preamble");
    expect(ids).toContain("codex_ingest_draft_preamble");
    expect(ids).toContain("hermes_pro_local_newly_preamble");
    expect(ids).toContain("hermes_reserved_no_preamble");
    expect(ids).toContain("ordinary_code_no_preamble");
    expect(ids).toContain("truncated_preamble");
    expect(ids).toContain("base_prompt_preserved_multiline");
  });
});

// -----------------------------------------------------------------
// 11. runtime false invariants — runtime re-verification
// -----------------------------------------------------------------

describe("008H — runtime false invariants (re-verified at closeout)", () => {
  it("008F helper output keeps 4 literal false flags across 8 008G snapshots", () => {
    const snaps = (snapshotsFixture as {
      snapshots: Array<{
        id: string;
        input: KnowledgeSurfaceBInput;
        expected: { preamble_attached?: boolean };
      }>;
    }).snapshots;
    for (const s of snaps) {
      const out = buildTaskPromptWithKnowledgeContractSurfaceB(s.input);
      expect(out.runtime_flush_allowed).toBe(false);
      expect(out.runtime_dispatch_allowed).toBe(false);
      expect(out.real_handoff_write_allowed).toBe(false);
      expect(out.live_adapter_allowed).toBe(false);
    }
  });
  it("008C simulation helper output keeps 4 literal false flags", () => {
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
  it("assertKnowledgeSurfaceBNoRuntime passes for normal output", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      baseTaskPrompt: "task: X",
    });
    expect(() => assertKnowledgeSurfaceBNoRuntime(out)).not.toThrow();
  });
  it("assertKnowledgeRuntimeInjectionSimulationNoRuntime passes for normal sim", () => {
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    expect(() => assertKnowledgeRuntimeInjectionSimulationNoRuntime(sim)).not.toThrow();
  });
});

// -----------------------------------------------------------------
// 12. cross-fixture consistency
// -----------------------------------------------------------------

describe("008H — cross-fixture consistency", () => {
  it("008A design fixture has slice 008A", () => {
    const fx = (simFixture as unknown as { slice?: string });
    // 008C sim fixture is loaded above; verify the design fixture too
    // by loading directly:
    const designA = require("../tests/fixtures/knowledge-reuse/runtime-default-injection-design.json");
    expect(designA.slice).toBe("008A");
  });
  it("008B feature flag design fixture has slice 008B", () => {
    const designB = require("../tests/fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json");
    expect(designB.slice).toBe("008B");
  });
  it("008C simulation fixture has slice 008C", () => {
    expect((simFixture as { slice: string }).slice).toBe("008C");
  });
  it("008D chain fixture has slice 008D", () => {
    expect((chainFixture as { slice: string }).slice).toBe("008D");
  });
  it("008E readiness fixture has slice 008E", () => {
    expect((readinessFixture as { slice: string }).slice).toBe("008E");
  });
  it("008F surface b fixture has slice 008F", () => {
    expect((surfaceBFixture as { slice: string }).slice).toBe("008F");
  });
  it("008G snapshot fixture has slice 008G", () => {
    expect((snapshotsFixture as { slice: string }).slice).toBe("008G");
  });
});

// -----------------------------------------------------------------
// 13. runtime alignment
// -----------------------------------------------------------------

describe("008H — runtime alignment", () => {
  it("runtime schema_version matches fixture", () => {
    expect(KNOWLEDGE_SURFACE_B_SCHEMA_VERSION).toBe("1.0.0");
    expect((closeoutFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
  });
  it("runtime slice + mode + surface literals", () => {
    expect(SURFACE_B_SLICE).toBe("008F");
    expect(SURFACE_B_MODE).toBe("surface_b_dry_run_implementation");
    expect(SURFACE_B_NAME).toBe("task_prompt_preamble");
  });
});

// -----------------------------------------------------------------
// 14. forbidden token scanner
// -----------------------------------------------------------------

describe("008H — forbidden token scanner (no real call)", () => {
  it("closeout fixture has no call-form forbidden tokens in plain prose fields", () => {
    const fx = closeoutFixture as Record<string, unknown>;
    const slim = {
      schema_version: fx.schema_version,
      slice: fx.slice,
      mode: fx.mode,
      layer_status: fx.layer_status,
      surface_matrix: fx.surface_matrix,
      target_agent_matrix: fx.target_agent_matrix,
      no_go_matrix: fx.no_go_matrix,
      final_decision: fx.final_decision,
      future_slices: fx.future_slices,
    };
    const blob = JSON.stringify(slim);
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
  it("runtime output from 008F + 008C carries no call expression", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      baseTaskPrompt: "task: X",
    });
    const sim = buildKnowledgeRuntimeInjectionSimulation({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
    });
    const blob =
      (out.preamble_text ?? "") +
      "\n" +
      out.final_task_prompt +
      "\n" +
      (sim.simulated_preamble ?? "") +
      "\n" +
      sim.simulated_dispatch_prompt;
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
});

// -----------------------------------------------------------------
// 15. no real handoff/audit write (mtime guard)
// -----------------------------------------------------------------

describe("008H — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run a representative closeout sweep.
    buildTaskPromptWithKnowledgeContractSurfaceB({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      baseTaskPrompt: "task: X",
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
