// Hermes Pro — Knowledge Runtime Dispatch Injection Design (Slice 008I, no implementation)
// Pure design review. No I/O, no IPC, no fetch, no real dispatch,
// no real handoff write, no agent subprocess.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";

import {
  buildTaskPromptWithKnowledgeContractSurfaceB,
  assertKnowledgeSurfaceBNoRuntime,
  SURFACE_B_SLICE,
  SURFACE_B_MODE,
  SURFACE_B_NAME,
} from "../src/shared/lib/knowledge-runtime-injection-surface-b";

import designFixture from "./fixtures/knowledge-reuse/runtime-dispatch-injection-design.json";
import closeoutFixture from "./fixtures/knowledge-reuse/runtime-injection-l5-closeout.json";

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

describe("008I — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect((designFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
  });
  it("slice is 008I", () => {
    expect((designFixture as { slice: string }).slice).toBe("008I");
  });
  it("mode is real_runtime_dispatch_design_no_implementation", () => {
    expect((designFixture as { mode: string }).mode).toBe(
      "real_runtime_dispatch_design_no_implementation"
    );
  });
  it("has discovered_surfaces / recommended_surface / rejected_surfaces", () => {
    const fx = designFixture as Record<string, unknown>;
    expect(Array.isArray(fx.discovered_surfaces)).toBe(true);
    expect(fx.recommended_surface).toBeDefined();
    expect(Array.isArray(fx.rejected_surfaces)).toBe(true);
  });
  it("has allowed_future_files / forbidden_future_files", () => {
    const fx = designFixture as Record<string, unknown>;
    expect(Array.isArray(fx.allowed_future_files)).toBe(true);
    expect(Array.isArray(fx.forbidden_future_files)).toBe(true);
  });
  it("has feature_flag_invariants / target_agent_matrix / trigger_matrix", () => {
    const fx = designFixture as Record<string, unknown>;
    expect(Array.isArray(fx.feature_flag_invariants)).toBe(true);
    expect(fx.target_agent_matrix).toBeDefined();
    expect(Array.isArray(fx.trigger_matrix)).toBe(true);
  });
  it("has rollback_plan / failure_modes / stop_conditions", () => {
    const fx = designFixture as Record<string, unknown>;
    expect(Array.isArray(fx.rollback_plan)).toBe(true);
    expect(Array.isArray(fx.failure_modes)).toBe(true);
    expect(Array.isArray(fx.stop_conditions)).toBe(true);
  });
  it("has go_no_go_decision", () => {
    const fx = designFixture as Record<string, unknown>;
    expect(fx.go_no_go_decision).toBeDefined();
  });
});

// -----------------------------------------------------------------
// 2. reviewed_slices
// -----------------------------------------------------------------

describe("008I — reviewed_slices", () => {
  it("lists 008A through 008H in order", () => {
    expect(
      (designFixture as { reviewed_slices: string[] }).reviewed_slices
    ).toEqual(["008A", "008B", "008C", "008D", "008E", "008F", "008G", "008H"]);
  });
  it("covers L4 + L5 dry-run + L5 closeout (008H)", () => {
    const rs = (designFixture as { reviewed_slices: string[] }).reviewed_slices;
    expect(rs).toContain("008H");
  });
});

// -----------------------------------------------------------------
// 3. discovered surfaces classification
// -----------------------------------------------------------------

describe("008I — discovered surfaces", () => {
  it("discovered_surfaces includes surface_b_task_prompt_preamble", () => {
    const fx = designFixture as {
      discovered_surfaces: Array<{ id: string }>;
    };
    const ids = fx.discovered_surfaces.map((s) => s.id);
    expect(ids).toContain("surface_b_task_prompt_preamble");
  });
  it("discovered_surfaces includes new surface_b_chain_consumer", () => {
    const fx = designFixture as {
      discovered_surfaces: Array<{ id: string }>;
    };
    const ids = fx.discovered_surfaces.map((s) => s.id);
    expect(ids).toContain("surface_b_chain_consumer");
  });
  it("discovered_surfaces marks default_system_prompt_fragment as forbidden", () => {
    const fx = designFixture as {
      discovered_surfaces: Array<{ id: string; future_touch: string }>;
    };
    const sp = fx.discovered_surfaces.find(
      (s) => s.id === "default_system_prompt_fragment"
    );
    expect(sp).toBeDefined();
    expect(sp!.future_touch).toBe("forbidden");
  });
  it("discovered_surfaces marks ipc_gateway_live_adapter as forbidden", () => {
    const fx = designFixture as {
      discovered_surfaces: Array<{ id: string; future_touch: string }>;
    };
    const sp = fx.discovered_surfaces.find(
      (s) => s.id === "ipc_gateway_live_adapter"
    );
    expect(sp).toBeDefined();
    expect(sp!.future_touch).toBe("forbidden");
  });
  it("discovered_surfaces marks agent_subprocess_spawn as forbidden", () => {
    const fx = designFixture as {
      discovered_surfaces: Array<{ id: string; future_touch: string }>;
    };
    const sp = fx.discovered_surfaces.find(
      (s) => s.id === "agent_subprocess_spawn"
    );
    expect(sp).toBeDefined();
    expect(sp!.future_touch).toBe("forbidden");
  });
  it("existing_task_prompt_builder_chain marked do_not_modify", () => {
    const fx = designFixture as {
      discovered_surfaces: Array<{ id: string; future_touch: string }>;
    };
    const sp = fx.discovered_surfaces.find(
      (s) => s.id === "existing_task_prompt_builder_chain"
    );
    expect(sp).toBeDefined();
    expect(sp!.future_touch).toBe("do_not_modify");
  });
});

// -----------------------------------------------------------------
// 4. exactly one recommended dispatch surface
// -----------------------------------------------------------------

describe("008I — recommended surface", () => {
  it("has exactly one recommended surface", () => {
    const fx = designFixture as { recommended_surface: { id: string } };
    expect(fx.recommended_surface.id).toBe("surface_b_chain_consumer");
  });
  it("recommended surface is Phase 1 (real runtime dispatch, IF user 显式批)", () => {
    const fx = designFixture as {
      recommended_surface: { phase: string; name: string };
    };
    expect(fx.recommended_surface.phase).toContain("Phase 1");
    expect(fx.recommended_surface.name).toContain(
      "Real Runtime Dispatch"
    );
  });
  it("recommended rationale includes NEW file, pure, no chain mutation", () => {
    const fx = designFixture as {
      recommended_surface: { rationale: string[] };
    };
    const all = fx.recommended_surface.rationale.join("\n");
    expect(all).toMatch(/NEW file|new file/);
    expect(all).toMatch(/PURE|pure/);
    expect(all).toMatch(/not.*mutation|unchanged/);
  });
});

// -----------------------------------------------------------------
// 5. rejected surfaces
// -----------------------------------------------------------------

describe("008I — rejected surfaces", () => {
  it("rejects default_system_prompt_fragment", () => {
    const fx = designFixture as {
      rejected_surfaces: Array<{ id: string }>;
    };
    expect(fx.rejected_surfaces.map((s) => s.id)).toContain(
      "default_system_prompt_fragment"
    );
  });
  it("rejects ipc_gateway_live_adapter", () => {
    const fx = designFixture as {
      rejected_surfaces: Array<{ id: string }>;
    };
    expect(fx.rejected_surfaces.map((s) => s.id)).toContain(
      "ipc_gateway_live_adapter"
    );
  });
  it("rejects agent_subprocess_spawn", () => {
    const fx = designFixture as {
      rejected_surfaces: Array<{ id: string }>;
    };
    expect(fx.rejected_surfaces.map((s) => s.id)).toContain(
      "agent_subprocess_spawn"
    );
  });
  it("rejects in_place_mutation_of_existing_chain", () => {
    const fx = designFixture as {
      rejected_surfaces: Array<{ id: string }>;
    };
    expect(fx.rejected_surfaces.map((s) => s.id)).toContain(
      "in_place_mutation_of_existing_chain"
    );
  });
});

// -----------------------------------------------------------------
// 6. allowed / forbidden future files
// -----------------------------------------------------------------

describe("008I — allowed future files", () => {
  it("allowed new file: src/main/task-dispatch-prompt-builder.ts (NEW, 008J)", () => {
    const fx = designFixture as {
      allowed_future_files: Array<{ path: string }>;
    };
    const paths = fx.allowed_future_files.map((f) => f.path);
    expect(paths).toContain(
      "src/main/task-dispatch-prompt-builder.ts (NEW, 008J)"
    );
  });
  it("allowed new test file", () => {
    const fx = designFixture as {
      allowed_future_files: Array<{ path: string }>;
    };
    const paths = fx.allowed_future_files.map((f) => f.path);
    expect(paths.some((p) => p.includes("task-dispatch-prompt-builder.test.ts"))).toBe(
      true
    );
  });
  it("allowed new fixture", () => {
    const fx = designFixture as {
      allowed_future_files: Array<{ path: string }>;
    };
    const paths = fx.allowed_future_files.map((f) => f.path);
    expect(paths.some((p) => p.includes("task-dispatch-prompt-builder.json"))).toBe(
      true
    );
  });
});

describe("008I — forbidden future files", () => {
  it("forbids any src/main/dispatch/ directory", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files.some((f) => f.includes("src/main/dispatch/"))).toBe(
      true
    );
  });
  it("forbids src/main/agent-launcher.ts", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("src/main/agent-launcher.ts (any Agent subprocess spawn wrapper)");
  });
  it("forbids src/main/system-prompt-fragment.ts", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("src/main/system-prompt-fragment.ts (any default system prompt mutation)");
  });
  it("forbids live handoff/audit writer files", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("src/main/live-handoff-writer.ts (any real ~/.hermes/handoff/packs writer)");
    expect(fx.forbidden_future_files).toContain("src/main/live-audit-writer.ts (any real ~/.hermes/audit writer)");
  });
  it("forbids knowledge-flush.ts", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("src/main/knowledge-flush.ts (any real knowledgeIngest / knowledgeSearch adapter)");
  });
  it("forbids gateway.ts", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("src/main/gateway.ts (any HTTP gateway to Hermes backend)");
  });
  it("forbids modifications to hermes.ts / index.ts / cronjobs.ts / skills.ts", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("modifications to src/main/hermes.ts (no real execution entry point)");
    expect(fx.forbidden_future_files).toContain("modifications to src/main/index.ts (no new IPC handlers)");
    expect(fx.forbidden_future_files).toContain("modifications to src/main/cronjobs.ts (no new cron delivery)");
    expect(fx.forbidden_future_files).toContain("modifications to src/main/skills.ts (no skill dispatch change)");
  });
  it("forbids modifications to CLAUDE.md / AGENTS.md / locked roadmap", () => {
    const fx = designFixture as { forbidden_future_files: string[] };
    expect(fx.forbidden_future_files).toContain("modifications to CLAUDE.md (no agent default system prompt change)");
    expect(fx.forbidden_future_files).toContain("modifications to AGENTS.md (no Codex default system prompt change)");
    expect(fx.forbidden_future_files).toContain("modifications to docs/roadmap-locked-2026-05-28.md (no locked roadmap change)");
  });
});

// -----------------------------------------------------------------
// 7. feature flag invariants
// -----------------------------------------------------------------

describe("008I — feature flag invariants", () => {
  it("name=KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    expect(fx.feature_flag_invariants).toContain(
      "name=KNOWLEDGE_CONTRACT_INJECTION_ENABLED"
    );
  });
  it("default=false", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    expect(fx.feature_flag_invariants).toContain(
      "default=false (must stay false until 008J+ explicit user approval)"
    );
  });
  it("off=return base task prompt verbatim", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    const all = fx.feature_flag_invariants.join("\n");
    expect(all).toMatch(/off=.*base task prompt verbatim/);
  });
  it("on reads flag and calls 008F helper, uses composed prompt if apply else base", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    const all = fx.feature_flag_invariants.join("\n");
    expect(all).toMatch(/on=.*flag.*008F helper/);
    expect(all).toMatch(/if apply/);
  });
  it("scope is Surface B only", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    expect(fx.feature_flag_invariants).toContain(
      "scope=Surface B task prompt preamble ONLY"
    );
  });
  it("does_not_affect includes default system prompt / live flush / knowledgeSearch / knowledgeIngest", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    const all = fx.feature_flag_invariants.join("\n");
    expect(all).toMatch(/default system prompt/);
    expect(all).toMatch(/live flush/);
    expect(all).toMatch(/knowledgeSearch/);
    expect(all).toMatch(/knowledgeIngest/);
  });
  it("does_not_affect includes IPC / gateway / handoff/audit write", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    const all = fx.feature_flag_invariants.join("\n");
    expect(all).toMatch(/IPC/);
    expect(all).toMatch(/gateway/);
    expect(all).toMatch(/handoff\/audit write/);
  });
  it("evaluation point is before dispatch chain sends prompt to target agent", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    const all = fx.feature_flag_invariants.join("\n");
    expect(all).toMatch(/evaluation_point=before/);
  });
  it("rollback=set flag false; entry point returns base", () => {
    const fx = designFixture as { feature_flag_invariants: string[] };
    const all = fx.feature_flag_invariants.join("\n");
    expect(all).toMatch(/rollback=set flag false/);
  });
});

// -----------------------------------------------------------------
// 8. target agent matrix
// -----------------------------------------------------------------

describe("008I — target agent matrix", () => {
  it("claude_code allowed behind flag", () => {
    const fx = designFixture as { target_agent_matrix: Record<string, string> };
    expect(fx.target_agent_matrix.claude_code).toMatch(/allowed_behind_flag/);
  });
  it("codex allowed behind flag", () => {
    const fx = designFixture as { target_agent_matrix: Record<string, string> };
    expect(fx.target_agent_matrix.codex).toMatch(/allowed_behind_flag/);
  });
  it("hermes_pro allowed behind flag", () => {
    const fx = designFixture as { target_agent_matrix: Record<string, string> };
    expect(fx.target_agent_matrix.hermes_pro).toMatch(/allowed_behind_flag/);
  });
  it("hermes_self_call reserved_skip_by_default", () => {
    const fx = designFixture as { target_agent_matrix: Record<string, string> };
    expect(fx.target_agent_matrix.hermes_self_call).toMatch(/reserved_skip_by_default/);
  });
});

// -----------------------------------------------------------------
// 9. trigger matrix
// -----------------------------------------------------------------

describe("008I — trigger matrix", () => {
  it("trigger_matrix has 6 trigger conditions", () => {
    const fx = designFixture as { trigger_matrix: string[] };
    expect(fx.trigger_matrix.length).toBeGreaterThanOrEqual(6);
  });
  it("trigger_matrix includes save_keyword / research_keyword", () => {
    const fx = designFixture as { trigger_matrix: string[] };
    const all = fx.trigger_matrix.join("\n");
    expect(all).toMatch(/save_keyword/);
    expect(all).toMatch(/research_keyword/);
  });
  it("trigger_matrix includes research_task_kind", () => {
    const fx = designFixture as { trigger_matrix: string[] };
    const all = fx.trigger_matrix.join("\n");
    expect(all).toMatch(/research_task_kind/);
  });
  it("trigger_matrix includes 3 handoff context triggers", () => {
    const fx = designFixture as { trigger_matrix: string[] };
    const all = fx.trigger_matrix.join("\n");
    expect(all).toMatch(/has_ingest_draft/);
    expect(all).toMatch(/has_flush_pending/);
    expect(all).toMatch(/has_local_known_and_newly_found/);
  });
});

// -----------------------------------------------------------------
// 10. rollback plan
// -----------------------------------------------------------------

describe("008I — rollback plan", () => {
  it("rollback has at least 5 steps", () => {
    const fx = designFixture as { rollback_plan: string[] };
    expect(fx.rollback_plan.length).toBeGreaterThanOrEqual(5);
  });
  it("step 1: set flag false at evaluation point", () => {
    const fx = designFixture as { rollback_plan: string[] };
    expect(fx.rollback_plan[0]).toMatch(/set KNOWLEDGE_CONTRACT_INJECTION_ENABLED=false/);
  });
  it("preserves mtime baseline (no real handoff/audit write at any point)", () => {
    const fx = designFixture as { rollback_plan: string[] };
    const all = fx.rollback_plan.join("\n");
    expect(all).toMatch(/mtime guard baseline/);
    expect(all).toMatch(/handoff_packs=1780195726/);
    expect(all).toMatch(/audit=1780230084/);
  });
  it("keeps knowledgeIngest / knowledgeSearch / live flush NOT called", () => {
    const fx = designFixture as { rollback_plan: string[] };
    const all = fx.rollback_plan.join("\n");
    expect(all).toMatch(/knowledgeIngest.*NOT called/);
    expect(all).toMatch(/live flush.*NOT called|live flush still NOT/);
  });
});

// -----------------------------------------------------------------
// 11. failure modes
// -----------------------------------------------------------------

describe("008I — failure modes", () => {
  it("has at least 8 failure modes", () => {
    const fx = designFixture as { failure_modes: unknown[] };
    expect(fx.failure_modes.length).toBeGreaterThanOrEqual(8);
  });
  it("covers flag_enabled_for_wrong_task / flag_disabled_but_expected", () => {
    const fx = designFixture as {
      failure_modes: Array<{ name: string }>;
    };
    const names = fx.failure_modes.map((m) => m.name);
    expect(names).toContain("flag_enabled_for_wrong_task");
    expect(names).toContain("flag_disabled_but_expected");
  });
  it("covers target_agent_blocked / runtime_token_detected / prompt_overpromise_detected", () => {
    const fx = designFixture as {
      failure_modes: Array<{ name: string }>;
    };
    const names = fx.failure_modes.map((m) => m.name);
    expect(names).toContain("target_agent_blocked");
    expect(names).toContain("runtime_token_detected");
    expect(names).toContain("prompt_overpromise_detected");
  });
  it("covers default_system_prompt_mutation_discovered / ipc_gateway_required", () => {
    const fx = designFixture as {
      failure_modes: Array<{ name: string }>;
    };
    const names = fx.failure_modes.map((m) => m.name);
    expect(names).toContain("default_system_prompt_mutation_discovered");
    expect(names).toContain("ipc_gateway_required");
  });
});

// -----------------------------------------------------------------
// 12. stop conditions (≥ 12)
// -----------------------------------------------------------------

describe("008I — stop conditions", () => {
  it("has at least 12 stop conditions", () => {
    const fx = designFixture as { stop_conditions: unknown[] };
    expect(fx.stop_conditions.length).toBeGreaterThanOrEqual(12);
  });
  it("covers default system prompt / IPC / live handoff", () => {
    const fx = designFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/default system prompt/);
    expect(all).toMatch(/IPC.*gateway/);
    expect(all).toMatch(/real handoff writer/);
  });
  it("covers ordinary code task / flag default / hermes self-call", () => {
    const fx = designFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/ordinary code-only/);
    expect(all).toMatch(/feature flag default/);
    expect(all).toMatch(/hermes self-call/);
  });
  it("covers base prompt overwrite / runtime flag forge / deceptive copy / mtime", () => {
    const fx = designFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/base task prompt is overwritten/);
    expect(all).toMatch(/forged/);
    expect(all).toMatch(/deceptive/);
    expect(all).toMatch(/mtime/);
  });
  it("covers call expression leak / Agent subprocess / renderer UI", () => {
    const fx = designFixture as { stop_conditions: string[] };
    const all = fx.stop_conditions.join("\n");
    expect(all).toMatch(/knowledgeIngest.*call expression/);
    expect(all).toMatch(/Agent subprocess/);
    expect(all).toMatch(/renderer UI/);
  });
});

// -----------------------------------------------------------------
// 13. Go / No-go
// -----------------------------------------------------------------

describe("008I — Go / No-go", () => {
  it("GO for 008J only IF user explicitly approves", () => {
    const fx = designFixture as { go_no_go_decision: { go: string[] } };
    expect(fx.go_no_go_decision.go).toContain(
      "GO for 008J Real Runtime Dispatch Implementation — ONLY if user explicitly approves"
    );
  });
  it("GO for 007H-1 IF user wants UI", () => {
    const fx = designFixture as { go_no_go_decision: { go: string[] } };
    expect(fx.go_no_go_decision.go).toContain(
      "GO for 007H-1 Renderer GateCard — IF user wants UI"
    );
  });
  it("NOT-GO: implementation in 008I", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for implementation in 008I (008I is design only)"
    );
  });
  it("NOT-GO: default system prompt mutation", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for default system prompt mutation (Surface C留 Phase 2 + separate ADR)"
    );
  });
  it("NOT-GO: L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for L6 live adapter / live flush / live knowledgeSearch / live knowledgeIngest"
    );
  });
  it("NOT-GO: gateway / IPC / Agent subprocess", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for gateway / IPC / Agent subprocess unless separately approved"
    );
  });
  it("NOT-GO: real handoff/audit write", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for real handoff/audit write (留 008+ 显式批)"
    );
  });
  it("NOT-GO: setting flag default to true", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for setting KNOWLEDGE_CONTRACT_INJECTION_ENABLED default to true (留 008J+ 显式批)"
    );
  });
  it("NOT-GO: in-place mutation of existing dispatch chain", () => {
    const fx = designFixture as { go_no_go_decision: { not_go: string[] } };
    expect(fx.go_no_go_decision.not_go).toContain(
      "NOT-GO for in-place mutation of existing dispatch chain (new file only)"
    );
  });
});

// -----------------------------------------------------------------
// 14. cross-fixture consistency (008I aligns with 008H)
// -----------------------------------------------------------------

describe("008I — cross-fixture consistency", () => {
  it("008I reviewed_slices includes 008H", () => {
    const rs = (designFixture as { reviewed_slices: string[] }).reviewed_slices;
    expect(rs).toContain("008H");
  });
  it("008H closeout fixture has reviewed_slices covering 008A-008G", () => {
    const rs = (closeoutFixture as { reviewed_slices: string[] }).reviewed_slices;
    expect(rs).toEqual(["008A", "008B", "008C", "008D", "008E", "008F", "008G"]);
  });
});

// -----------------------------------------------------------------
// 15. runtime alignment (008I consumes 008F helper exports)
// -----------------------------------------------------------------

describe("008I — runtime alignment", () => {
  it("008F runtime exports consumed by 008I design", () => {
    expect(SURFACE_B_SLICE).toBe("008F");
    expect(SURFACE_B_MODE).toBe("surface_b_dry_run_implementation");
    expect(SURFACE_B_NAME).toBe("task_prompt_preamble");
  });
  it("008F helper output is still pure (no I/O, 4 false runtime flags)", () => {
    const out = buildTaskPromptWithKnowledgeContractSurfaceB({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      baseTaskPrompt: "task: X",
    });
    expect(out.runtime_flush_allowed).toBe(false);
    expect(out.runtime_dispatch_allowed).toBe(false);
    expect(out.real_handoff_write_allowed).toBe(false);
    expect(out.live_adapter_allowed).toBe(false);
    expect(() => assertKnowledgeSurfaceBNoRuntime(out)).not.toThrow();
  });
});

// -----------------------------------------------------------------
// 16. forbidden token scanner
// -----------------------------------------------------------------

describe("008I — forbidden token scanner (no real call)", () => {
  it("design fixture has no call-form forbidden tokens in plain prose fields", () => {
    const fx = designFixture as Record<string, unknown>;
    const slim = {
      schema_version: fx.schema_version,
      slice: fx.slice,
      mode: fx.mode,
      reviewed_slices: fx.reviewed_slices,
      recommended_surface: fx.recommended_surface,
      rejected_surfaces: fx.rejected_surfaces,
      target_agent_matrix: fx.target_agent_matrix,
      go_no_go_decision: fx.go_no_go_decision,
    };
    const blob = JSON.stringify(slim);
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
});

// -----------------------------------------------------------------
// 17. mtime guard
// -----------------------------------------------------------------

describe("008I — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
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
