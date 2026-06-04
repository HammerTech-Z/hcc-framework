// Hermes Pro — Knowledge Runtime Dispatch L5 Closeout (Slice 008L, no runtime)
// Pure closeout aggregation. No I/O, no IPC, no fetch, no real
// dispatch, no real handoff write, no agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";
import { existsSync } from "fs";
import { readFileSync } from "fs";
import * as path from "path";

import {
  buildTaskDispatchPrompt,
  assertTaskDispatchPromptBuilderNoRuntime,
  TASK_DISPATCH_BUILDER_SCHEMA_VERSION,
  TASK_DISPATCH_BUILDER_SLICE,
  TASK_DISPATCH_BUILDER_MODE,
  TASK_DISPATCH_SURFACE,
  TASK_DISPATCH_NO_L6,
} from "../src/main/task-dispatch-prompt-builder";

import {
  buildTaskPromptWithKnowledgeContractSurfaceB as buildSurfaceBPrompt,
  assertKnowledgeSurfaceBNoRuntime,
} from "../src/shared/lib/knowledge-runtime-injection-surface-b";

import closeoutFixture from "./fixtures/knowledge-reuse/runtime-dispatch-l5-closeout.json";
import chainFixture from "./fixtures/knowledge-reuse/task-dispatch-prompt-builder-chain.json";
import builderFixture from "./fixtures/knowledge-reuse/task-dispatch-prompt-builder.json";
import dispatchDesignFixture from "./fixtures/knowledge-reuse/runtime-dispatch-injection-design.json";
import surfaceBFixture from "./fixtures/knowledge-reuse/runtime-injection-surface-b.json";
import l5CloseoutFixture from "./fixtures/knowledge-reuse/runtime-injection-l5-closeout.json";
import snapshotsFixture from "./fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json";

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

describe("008L — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect(
      (closeoutFixture as { schema_version: string }).schema_version
    ).toBe("1.0.0");
  });
  it("slice is 008L", () => {
    expect((closeoutFixture as { slice: string }).slice).toBe("008L");
  });
  it("mode is l5_runtime_dispatch_closeout_no_l6", () => {
    expect((closeoutFixture as { mode: string }).mode).toBe(
      "l5_runtime_dispatch_closeout_no_l6"
    );
  });
  it("has layer_status / invariant_rollup / target_agent_matrix / surface_matrix / no_go_matrix / final_decision", () => {
    const fx = closeoutFixture as Record<string, unknown>;
    expect(fx.layer_status).toBeDefined();
    expect(fx.invariant_rollup).toBeDefined();
    expect(fx.target_agent_matrix).toBeDefined();
    expect(fx.surface_matrix).toBeDefined();
    expect(fx.no_go_matrix).toBeDefined();
    expect(fx.future_slices).toBeDefined();
    expect(fx.final_decision).toBeDefined();
  });
});

// -----------------------------------------------------------------
// 2. reviewed_slices
// -----------------------------------------------------------------

describe("008L — reviewed_slices", () => {
  it("lists 008A through 008K in order", () => {
    expect(
      (closeoutFixture as { reviewed_slices: string[] }).reviewed_slices
    ).toEqual([
      "008A",
      "008B",
      "008C",
      "008D",
      "008E",
      "008F",
      "008G",
      "008H",
      "008I",
      "008J",
      "008K",
    ]);
  });
});

// -----------------------------------------------------------------
// 3. layer status
// -----------------------------------------------------------------

describe("008L — layer status L4/L5/L6", () => {
  it("L4 reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L4_dry_run_handoff_payload).toMatch(/reached/);
  });
  it("L5 dry_run_surface_b reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_dry_run_surface_b_prompt_preamble).toMatch(/reached/);
  });
  it("L5 task dispatch prompt builder reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_task_dispatch_prompt_builder).toMatch(/reached/);
  });
  it("L5 real agent subprocess not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_real_agent_subprocess).toMatch(/not_reached/);
  });
  it("L5 real runtime dispatch invocation not reached", () => {
    const ls = (closeoutFixture as { layer_status: Record<string, string> })
      .layer_status;
    expect(ls.L5_real_runtime_dispatch_invocation).toMatch(/not_reached/);
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
// 4. invariant rollup 008A-008K
// -----------------------------------------------------------------

describe("008L — invariant rollup 008A-008K", () => {
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
  it("008H is rollup, 71 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008H_l5_closeout": { tests: number } };
    }).invariant_rollup["008H_l5_closeout"];
    expect(r.tests).toBe(71);
  });
  it("008I has 79 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: { "008I_dispatch_design": { tests: number } };
    }).invariant_rollup["008I_dispatch_design"];
    expect(r.tests).toBe(79);
  });
  it("008J has 24 invariants + 4 literal false runtime flags + no_l6: true + 70 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: {
        "008J_task_dispatch_prompt_builder": {
          invariants: number;
          literal_false_runtime_flags: number;
          no_l6: boolean;
          tests: number;
        };
      };
    }).invariant_rollup["008J_task_dispatch_prompt_builder"];
    expect(r.invariants).toBe(24);
    expect(r.literal_false_runtime_flags).toBe(4);
    expect(r.no_l6).toBe(true);
    expect(r.tests).toBe(70);
  });
  it("008K has 33 invariants + 5 chain stages + 62 tests", () => {
    const r = (closeoutFixture as {
      invariant_rollup: {
        "008K_chain_test": {
          invariants: number;
          chain_stages: number;
          tests: number;
        };
      };
    }).invariant_rollup["008K_chain_test"];
    expect(r.invariants).toBe(33);
    expect(r.chain_stages).toBe(5);
    expect(r.tests).toBe(62);
  });
});

// -----------------------------------------------------------------
// 5. 008J builder file existence + uniqueness
// -----------------------------------------------------------------

describe("008L — 008J builder file is the L5 main-side entry point", () => {
  it("src/main/task-dispatch-prompt-builder.ts exists", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    expect(existsSync(p)).toBe(true);
  });
  it("008J builder source declares schema_version 1.0.0 + slice 008J", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("TASK_DISPATCH_BUILDER_SCHEMA_VERSION");
    expect(src).toContain("TASK_DISPATCH_BUILDER_SLICE");
    expect(src).toContain("008J");
    expect(src).toContain("task_dispatch_prompt_builder");
  });
  it("008J builder consumes 008F helper (buildTaskPromptWithKnowledgeContractSurfaceB)", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("buildTaskPromptWithKnowledgeContractSurfaceB");
    expect(src).toContain("assertKnowledgeSurfaceBNoRuntime");
  });
  it("008J builder does not import runtime tokens (knowledgeIngest / spawn / child_process)", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    const src = readFileSync(p, "utf8");
    // Check import statements only (not comments or scanner arrays).
    const importLines = src
      .split("\n")
      .filter((l) => l.trim().startsWith("import ") || l.includes("require("));
    const importBlob = importLines.join("\n");
    expect(importBlob).not.toMatch(/\bknowledgeIngest\b/);
    expect(importBlob).not.toMatch(/\bknowledgeSearch\b/);
    expect(importBlob).not.toMatch(/\brunPlaybook\b/);
    expect(importBlob).not.toMatch(/\btriggerCronJob\b/);
    expect(importBlob).not.toMatch(/\bsendMessage\b/);
    expect(importBlob).not.toMatch(/\bspawn\b/);
    expect(importBlob).not.toMatch(/\bchild_process\b/);
  });
  it("008J builder has 4 literal false runtime flags", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("RUNTIME_FLUSH_ALLOWED_LITERAL = false");
    expect(src).toContain("RUNTIME_DISPATCH_ALLOWED_LITERAL = false");
    expect(src).toContain("REAL_HANDOFF_WRITE_ALLOWED_LITERAL = false");
    expect(src).toContain("LIVE_ADAPTER_ALLOWED_LITERAL = false");
  });
  it("008J builder has no_l6: true literal", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    const src = readFileSync(p, "utf8");
    expect(src).toContain("TASK_DISPATCH_NO_L6 = true");
  });
});

// -----------------------------------------------------------------
// 6. 008K chain fixture linkage
// -----------------------------------------------------------------

describe("008L — 008K chain fixture linkage", () => {
  it("008K chain fixture references 008G snapshots", () => {
    const links = (chainFixture as { snapshot_links_008g: string[] })
      .snapshot_links_008g;
    expect(links).toContain("flag_disabled_no_preamble");
    expect(links).toContain("claude_code_research_preamble");
    expect(links).toContain("codex_ingest_draft_preamble");
    expect(links).toContain("hermes_pro_local_newly_preamble");
    expect(links).toContain("hermes_reserved_no_preamble");
    expect(links).toContain("ordinary_code_no_preamble");
    expect(links).toContain("truncated_preamble");
    expect(links).toContain("base_prompt_preserved_multiline");
  });
  it("008K chain fixture references 008J examples", () => {
    const links = (chainFixture as { builder_links_008j: string[] })
      .builder_links_008j;
    expect(links).toContain("flag_disabled_no_attach");
    expect(links).toContain("claude_code_research_attach");
    expect(links).toContain("codex_ingest_draft_attach");
    expect(links).toContain("hermes_pro_local_newly_attach");
    expect(links).toContain("hermes_reserved_skip");
    expect(links).toContain("ordinary_code_skip");
    expect(links).toContain("truncated_prompt");
    expect(links).toContain("multiline_base_prompt_preserved");
  });
  it("008G snapshot fixture covers the same 8 ids", () => {
    const ids = (snapshotsFixture as {
      snapshots: Array<{ id: string }>;
    }).snapshots.map((s) => s.id);
    for (const id of (chainFixture as { snapshot_links_008g: string[] })
      .snapshot_links_008g) {
      expect(ids).toContain(id);
    }
  });
  it("008J builder fixture covers the same 8 ids", () => {
    const ids = (builderFixture as {
      examples: Array<{ name: string }>;
    }).examples.map((e) => e.name);
    for (const id of (chainFixture as { builder_links_008j: string[] })
      .builder_links_008j) {
      expect(ids).toContain(id);
    }
  });
});

// -----------------------------------------------------------------
// 7. Surface B completed; Surface C frozen
// -----------------------------------------------------------------

describe("008L — Surface matrix", () => {
  it("Surface A reached (L4)", () => {
    const sm = (closeoutFixture as { surface_matrix: Record<string, string> })
      .surface_matrix;
    expect(sm.Surface_A_handoff_payload_context).toMatch(/reached/);
  });
  it("Surface B reached (L5)", () => {
    const sm = (closeoutFixture as { surface_matrix: Record<string, string> })
      .surface_matrix;
    expect(sm.Surface_B_task_prompt_preamble).toMatch(/reached/);
    expect(sm.Surface_B_task_prompt_preamble).toMatch(
      /buildTaskDispatchPrompt/
    );
  });
  it("Surface C frozen (NOT recommended as first step)", () => {
    const sm = (closeoutFixture as { surface_matrix: Record<string, string> })
      .surface_matrix;
    expect(sm.Surface_C_default_system_prompt).toMatch(/frozen/);
  });
});

// -----------------------------------------------------------------
// 8. target agent matrix
// -----------------------------------------------------------------

describe("008L — target agent matrix", () => {
  it("claude_code allowed behind flag", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.claude_code).toMatch(/allowed_behind_flag/);
  });
  it("codex allowed behind flag", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.codex).toMatch(/allowed_behind_flag/);
  });
  it("hermes_pro allowed behind flag", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.hermes_pro).toMatch(/allowed_behind_flag/);
  });
  it("hermes self-call reserved_skip_by_default", () => {
    const tam = (closeoutFixture as {
      target_agent_matrix: Record<string, string>;
    }).target_agent_matrix;
    expect(tam.hermes_self_call).toMatch(/reserved_skip_by_default/);
  });
});

// -----------------------------------------------------------------
// 9. feature flag final state
// -----------------------------------------------------------------

describe("008L — feature flag final state", () => {
  it("name=KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    const ff = (closeoutFixture as {
      feature_flag_final: { name: string };
    }).feature_flag_final;
    expect(ff.name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });
  it("default=false", () => {
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
  it("scope covers Surface B + 008J entry point", () => {
    const ff = (closeoutFixture as {
      feature_flag_final: { scope: string };
    }).feature_flag_final;
    expect(ff.scope).toMatch(/Surface B/);
    expect(ff.scope).toMatch(/008J/);
  });
});

// -----------------------------------------------------------------
// 10. no_go_matrix
// -----------------------------------------------------------------

describe("008L — no_go_matrix", () => {
  it("real_agent_subprocess NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.real_agent_subprocess).toMatch(/NOT-GO/);
  });
  it("real_runtime_dispatch_invocation NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.real_runtime_dispatch_invocation).toMatch(/NOT-GO/);
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
  it("in_place_mutation_of_existing_dispatch_chain NOT-GO", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.in_place_mutation_of_existing_dispatch_chain).toMatch(/NOT-GO/);
  });
  it("renderer_ui_implementation NOT-GO (留 007H-1)", () => {
    const no = (closeoutFixture as {
      no_go_matrix: Record<string, string>;
    }).no_go_matrix;
    expect(no.renderer_ui_implementation).toMatch(/NOT-GO/);
  });
});

// -----------------------------------------------------------------
// 11. runtime false invariants (re-verified at closeout)
// -----------------------------------------------------------------

describe("008L — runtime false invariants (re-verified)", () => {
  it("008J builder output keeps 4 literal false flags + no_l6 across builder fixture examples", () => {
    const examples = (builderFixture as {
      examples: Array<{
        name: string;
        input: Parameters<typeof buildTaskDispatchPrompt>[0];
      }>;
    }).examples;
    for (const e of examples) {
      const out = buildTaskDispatchPrompt(e.input);
      expect(out.runtime_flush_allowed).toBe(false);
      expect(out.runtime_dispatch_allowed).toBe(false);
      expect(out.real_handoff_write_allowed).toBe(false);
      expect(out.live_adapter_allowed).toBe(false);
      expect(out.no_l6).toBe(true);
    }
  });
  it("008J builder + 008F helper no-runtime guard cross-validation passes", () => {
    const examples = (builderFixture as {
      examples: Array<{
        name: string;
        input: Parameters<typeof buildTaskDispatchPrompt>[0];
      }>;
    }).examples;
    for (const e of examples) {
      const j = buildTaskDispatchPrompt(e.input);
      expect(() =>
        assertTaskDispatchPromptBuilderNoRuntime(j)
      ).not.toThrow();
      // Cross-validate via 008F helper on the same input.
      const f = buildSurfaceBPrompt({
        featureFlagEnabled: e.input.featureFlagEnabled,
        targetAgent: e.input.targetAgent,
        baseTaskPrompt: e.input.baseTaskPrompt,
        taskKind: e.input.taskKind,
        userRequest: e.input.userRequest,
        handoffContext: e.input.handoffContext,
        maxChars: e.input.maxChars,
        hermesOverride: e.input.hermesOverride,
      });
      expect(() => assertKnowledgeSurfaceBNoRuntime(f)).not.toThrow();
    }
  });
  it("runtime schema_version matches across 008L fixture + 008J + 008F", () => {
    expect(TASK_DISPATCH_BUILDER_SCHEMA_VERSION).toBe("1.0.0");
    expect(
      (closeoutFixture as { schema_version: string }).schema_version
    ).toBe("1.0.0");
    expect(TASK_DISPATCH_BUILDER_SLICE).toBe("008J");
    expect(TASK_DISPATCH_BUILDER_MODE).toBe("task_dispatch_prompt_builder");
    expect(TASK_DISPATCH_SURFACE).toBe("task_prompt_preamble");
    expect(TASK_DISPATCH_NO_L6).toBe(true);
  });
});

// -----------------------------------------------------------------
// 12. final decision
// -----------------------------------------------------------------

describe("008L — final decision", () => {
  it("GO: L5 runtime dispatch prompt builder layer is complete and locked", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.go).toContain(
      "L5 runtime dispatch prompt builder layer is complete and locked (008J + 008K)"
    );
  });
  it("GO: 008L closeout done; 008A-008K invariants roll up", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.go).toContain(
      "008L closeout done; 008A-008K invariants roll up to a single source of truth"
    );
  });
  it("GO: pause / observation (recommended for current state)", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.go).toContain(
      "GO for pause / observation (recommended for current state)"
    );
  });
  it("GO: 007H-1 Renderer GateCard IF user wants UI", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.go).toContain(
      "GO for 007H-1 Renderer GateCard IF user wants UI"
    );
  });
  it("GO: L6 live adapter design only IF user explicitly approves", () => {
    const fd = (closeoutFixture as {
      final_decision: { GO: string[] };
    }).final_decision;
    expect(fd.go).toContain(
      "GO for L6 live adapter design only IF user explicitly approves"
    );
  });
  it("NOT-GO: real Agent subprocess", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain("Real Agent subprocess");
  });
  it("NOT-GO: real runtime dispatch invocation", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "Real runtime dispatch invocation (008J+ chain integration留 008+ 显式批)"
    );
  });
  it("NOT-GO: L6 live adapter / live flush / live search / live ingest", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest"
    );
  });
  it("NOT-GO: Surface C default system prompt mutation", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "Surface C default system prompt mutation (Phase 2, separate ADR)"
    );
  });
  it("NOT-GO: gateway / IPC / serve / run / agent / delegate / playbook / cron", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "Gateway / IPC / serve / run / agent / delegate / playbook / cron"
    );
  });
  it("NOT-GO: real handoff / audit write", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "Real handoff write to ~/.hermes/handoff/packs"
    );
    expect(fd.not_go).toContain("Real audit log write to ~/.hermes/audit");
  });
  it("NOT-GO: setting flag default to true", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "Setting KNOWLEDGE_CONTRACT_INJECTION_ENABLED default to true"
    );
  });
  it("NOT-GO: in-place mutation of existing dispatch chain", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "In-place mutation of existing dispatch chain (NEW file only per 008I design)"
    );
  });
  it("NOT-GO: renderer UI implementation (留 007H-1)", () => {
    const fd = (closeoutFixture as {
      final_decision: { NOT_GO: string[] };
    }).final_decision;
    expect(fd.not_go).toContain(
      "Renderer UI implementation (留 007H-1 显式批)"
    );
  });
});

// -----------------------------------------------------------------
// 13. prompt snapshot inventory (008G references)
// -----------------------------------------------------------------

describe("008L — prompt snapshot inventory", () => {
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
  it("closeout fixture references all 8 008J examples", () => {
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
    const inv = (closeoutFixture as {
      task_dispatch_examples_008j: string[];
    }).task_dispatch_examples_008j;
    expect(inv).toEqual(expected);
  });
});

// -----------------------------------------------------------------
// 14. cross-fixture consistency
// -----------------------------------------------------------------

describe("008L — cross-fixture consistency", () => {
  it("008A design fixture has slice 008A", () => {
    const designA = require("../tests/fixtures/knowledge-reuse/runtime-default-injection-design.json");
    expect(designA.slice).toBe("008A");
  });
  it("008B feature flag design fixture has slice 008B", () => {
    const designB = require("../tests/fixtures/knowledge-reuse/runtime-injection-feature-flag-dry-run-design.json");
    expect(designB.slice).toBe("008B");
  });
  it("008C simulation fixture has slice 008C", () => {
    const sim = require("../tests/fixtures/knowledge-reuse/runtime-injection-simulation.json");
    expect(sim.slice).toBe("008C");
  });
  it("008D chain fixture has slice 008D", () => {
    const chain = require("../tests/fixtures/knowledge-reuse/runtime-injection-artifact-chain.json");
    expect(chain.slice).toBe("008D");
  });
  it("008E readiness fixture has slice 008E", () => {
    const readiness = require("../tests/fixtures/knowledge-reuse/runtime-injection-readiness-review.json");
    expect(readiness.slice).toBe("008E");
  });
  it("008F surface b fixture has slice 008F", () => {
    expect((surfaceBFixture as { slice: string }).slice).toBe("008F");
  });
  it("008G snapshot fixture has slice 008G", () => {
    expect((snapshotsFixture as { slice: string }).slice).toBe("008G");
  });
  it("008H l5 closeout fixture has slice 008H", () => {
    expect((l5CloseoutFixture as { slice: string }).slice).toBe("008H");
  });
  it("008I dispatch design fixture has slice 008I", () => {
    expect((dispatchDesignFixture as { slice: string }).slice).toBe("008I");
  });
  it("008J builder fixture has slice 008J", () => {
    expect((builderFixture as { slice: string }).slice).toBe("008J");
  });
  it("008K chain fixture has slice 008K", () => {
    expect((chainFixture as { slice: string }).slice).toBe("008K");
  });
});

// -----------------------------------------------------------------
// 15. forbidden token scanner
// -----------------------------------------------------------------

describe("008L — forbidden token scanner (no real call)", () => {
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
  it("runtime output from 008J builder + 008F helper carries no call expression", () => {
    const j = buildTaskDispatchPrompt({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      baseTaskPrompt: "task: X",
    });
    const f = buildSurfaceBPrompt({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      baseTaskPrompt: "task: X",
      userRequest: "save to knowledge",
    });
    const blob =
      (j.preamble_text ?? "") +
      "\n" +
      j.final_task_prompt +
      "\n" +
      (f.preamble_text ?? "") +
      "\n" +
      f.final_task_prompt;
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
});

// -----------------------------------------------------------------
// 16. stop conditions
// -----------------------------------------------------------------

describe("008L — stop conditions", () => {
  it("has at least 15 stop conditions", () => {
    const fx = closeoutFixture as { stop_conditions: unknown[] };
    expect(fx.stop_conditions.length).toBeGreaterThanOrEqual(15);
  });
  it("covers default system prompt / IPC / live handoff", () => {
    const fx = (closeoutFixture as { stop_conditions: string[] })
      .stop_conditions;
    const all = fx.join("\n");
    expect(all).toMatch(/default system prompt/);
    expect(all).toMatch(/IPC.*gateway/);
    expect(all).toMatch(/real handoff writer/);
  });
  it("covers ordinary code task / flag default / hermes self-call", () => {
    const fx = (closeoutFixture as { stop_conditions: string[] })
      .stop_conditions;
    const all = fx.join("\n");
    expect(all).toMatch(/ordinary code-only/);
    expect(all).toMatch(/feature flag default/);
    expect(all).toMatch(/hermes self-call/);
  });
  it("covers runtime flag forge / deceptive copy / mtime", () => {
    const fx = (closeoutFixture as { stop_conditions: string[] })
      .stop_conditions;
    const all = fx.join("\n");
    expect(all).toMatch(/forged/);
    expect(all).toMatch(/deceptive/);
    expect(all).toMatch(/mtime/);
  });
  it("covers Agent subprocess / in-place mutation / renderer UI", () => {
    const fx = (closeoutFixture as { stop_conditions: string[] })
      .stop_conditions;
    const all = fx.join("\n");
    expect(all).toMatch(/Agent subprocess/);
    expect(all).toMatch(/in-place mutation/);
    expect(all).toMatch(/renderer UI/);
  });
});

// -----------------------------------------------------------------
// 17. mtime guard
// -----------------------------------------------------------------

describe("008L — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run a representative closeout sweep.
    buildTaskDispatchPrompt({
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
