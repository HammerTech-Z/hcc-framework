// Hermes Pro — Knowledge Runtime Dispatch Pause / Observation (Slice 008M, no new capability)
// Pure observation pack. No I/O, no IPC, no fetch, no real dispatch,
// no real handoff write, no agent subprocess. 0 src change. 0 fixture mutation.

import { describe, it, expect } from "vitest";
import { statSync } from "fs";
import { existsSync } from "fs";
import { readFileSync } from "fs";
import * as path from "path";

import {
  buildTaskDispatchPrompt,
  TASK_DISPATCH_BUILDER_SCHEMA_VERSION,
  TASK_DISPATCH_BUILDER_SLICE,
  TASK_DISPATCH_BUILDER_MODE,
  TASK_DISPATCH_SURFACE,
  TASK_DISPATCH_NO_L6,
} from "../src/main/task-dispatch-prompt-builder";

import pauseFixture from "./fixtures/knowledge-reuse/runtime-dispatch-pause-observation.json";
import closeoutFixture from "./fixtures/knowledge-reuse/runtime-dispatch-l5-closeout.json";
import builderFixture from "./fixtures/knowledge-reuse/task-dispatch-prompt-builder.json";

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

describe("008M — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect((pauseFixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
  });
  it("slice is 008M", () => {
    expect((pauseFixture as { slice: string }).slice).toBe("008M");
  });
  it("mode is pause_observation_no_new_capability", () => {
    expect((pauseFixture as { mode: string }).mode).toBe(
      "pause_observation_no_new_capability"
    );
  });
  it("has current_state / l5_entry_point / feature_flag / not_go_matrix / resume_branches / observation_checklist", () => {
    const fx = pauseFixture as Record<string, unknown>;
    expect(fx.current_state).toBeDefined();
    expect(fx.l5_entry_point).toBeDefined();
    expect(fx.feature_flag).toBeDefined();
    expect(fx.not_go_matrix).toBeDefined();
    expect(Array.isArray(fx.resume_branches)).toBe(true);
    expect(Array.isArray(fx.observation_checklist)).toBe(true);
  });
  it("declares no_new_capability / no_src_change / no_fixture_mutation as true", () => {
    const fx = pauseFixture as {
      no_new_capability: boolean;
      no_src_change: boolean;
      no_fixture_mutation: boolean;
    };
    expect(fx.no_new_capability).toBe(true);
    expect(fx.no_src_change).toBe(true);
    expect(fx.no_fixture_mutation).toBe(true);
  });
  it("reviewed_slices lists 008A through 008L", () => {
    const fx = pauseFixture as { reviewed_slices: string[] };
    expect(fx.reviewed_slices).toEqual([
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
      "008L",
    ]);
  });
});

// -----------------------------------------------------------------
// 2. L4/L5/L6 status
// -----------------------------------------------------------------

describe("008M — L4/L5/L6 status", () => {
  it("L0_to_L4 reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L0_to_L4).toMatch(/reached/);
  });
  it("L5 dry-run surface B reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L5_dry_run_surface_b_prompt_preamble).toMatch(/reached/);
  });
  it("L5 task dispatch prompt builder reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L5_task_dispatch_prompt_builder).toMatch(/reached/);
  });
  it("L5 real agent subprocess not reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L5_real_agent_subprocess).toMatch(/not_reached/);
  });
  it("L5 real runtime dispatch invocation not reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L5_real_runtime_dispatch_invocation).toMatch(/not_reached/);
  });
  it("L5 real default system prompt injection not reached (Surface C frozen)", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L5_real_runtime_default_injection_into_default_system_prompt).toMatch(
      /not_reached/
    );
  });
  it("L6 live knowledge search not reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L6_live_knowledge_search).toMatch(/not_reached/);
  });
  it("L6 live knowledge ingest not reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L6_live_knowledge_ingest).toMatch(/not_reached/);
  });
  it("L6 live flush not reached", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.L6_live_flush).toMatch(/not_reached/);
  });
  it("recommended_state is pause_observation", () => {
    const cs = (pauseFixture as { current_state: Record<string, string> })
      .current_state;
    expect(cs.recommended_state).toBe("pause_observation");
  });
});

// -----------------------------------------------------------------
// 3. pause recommended
// -----------------------------------------------------------------

describe("008M — pause recommended", () => {
  it("recommended_state literal is pause_observation", () => {
    expect(
      (pauseFixture as { current_state: { recommended_state: string } })
        .current_state.recommended_state
    ).toBe("pause_observation");
  });
  it("declares no_new_capability = true", () => {
    expect(
      (pauseFixture as { no_new_capability: boolean }).no_new_capability
    ).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. resume branches
// -----------------------------------------------------------------

describe("008M — resume branches", () => {
  it("has at least 4 resume branches", () => {
    const fx = pauseFixture as { resume_branches: unknown[] };
    expect(fx.resume_branches.length).toBeGreaterThanOrEqual(4);
  });
  it("007H-1 Renderer GateCard is a resume branch", () => {
    const fx = pauseFixture as {
      resume_branches: Array<{ id: string; name: string; trigger: string }>;
    };
    const b = fx.resume_branches.find((x) => x.id === "007H-1");
    expect(b).toBeDefined();
    expect(b!.name).toContain("Renderer GateCard");
    expect(b!.trigger).toMatch(/user explicit approval/);
  });
  it("008N L6 live adapter design only is a resume branch", () => {
    const fx = pauseFixture as {
      resume_branches: Array<{ id: string; name: string; explicit_not_implementation?: boolean }>;
    };
    const b = fx.resume_branches.find((x) => x.id === "008N");
    expect(b).toBeDefined();
    expect(b!.name).toMatch(/L6 Live Adapter/);
    expect(b!.explicit_not_implementation).toBe(true);
  });
  it("008O 008J+ chain integration is a resume branch", () => {
    const fx = pauseFixture as {
      resume_branches: Array<{ id: string; name: string; explicit_not_in_place_mutation?: boolean }>;
    };
    const b = fx.resume_branches.find((x) => x.id === "008O");
    expect(b).toBeDefined();
    expect(b!.name).toMatch(/Chain Integration/);
    expect(b!.explicit_not_in_place_mutation).toBe(true);
  });
  it("surface_C_ADR is a resume branch with explicit_not_recommended_as_first_step", () => {
    const fx = pauseFixture as {
      resume_branches: Array<{ id: string; name: string; explicit_not_recommended_as_first_step?: boolean }>;
    };
    const b = fx.resume_branches.find((x) => x.id === "surface_C_ADR");
    expect(b).toBeDefined();
    expect(b!.name).toMatch(/Surface C/);
    expect(b!.explicit_not_recommended_as_first_step).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. NOT-GO matrix
// -----------------------------------------------------------------

describe("008M — NOT-GO matrix", () => {
  it("real_agent_subprocess NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.real_agent_subprocess).toMatch(/NOT-GO/);
  });
  it("real_runtime_dispatch_invocation NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.real_runtime_dispatch_invocation).toMatch(/NOT-GO/);
  });
  it("real_handoff_write_to_handoff_packs NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.real_handoff_write_to_handoff_packs).toMatch(/NOT-GO/);
  });
  it("real_audit_log_write_to_audit NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.real_audit_log_write_to_audit).toMatch(/NOT-GO/);
  });
  it("ipc_adapter NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.ipc_adapter).toMatch(/NOT-GO/);
  });
  it("live_knowledge_search NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.live_knowledge_search).toMatch(/NOT-GO/);
  });
  it("live_knowledge_ingest NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.live_knowledge_ingest).toMatch(/NOT-GO/);
  });
  it("live_flush NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.live_flush).toMatch(/NOT-GO/);
  });
  it("default_system_prompt_mutation NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.default_system_prompt_mutation).toMatch(/NOT-GO/);
  });
  it("in_place_mutation_of_existing_dispatch_chain NOT-GO", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.in_place_mutation_of_existing_dispatch_chain).toMatch(/NOT-GO/);
  });
  it("renderer_ui_implementation NOT-GO (留 007H-1)", () => {
    const no = (pauseFixture as { not_go_matrix: Record<string, string> })
      .not_go_matrix;
    expect(no.renderer_ui_implementation).toMatch(/NOT-GO/);
  });
});

// -----------------------------------------------------------------
// 6. feature flag
// -----------------------------------------------------------------

describe("008M — feature flag", () => {
  it("name=KNOWLEDGE_CONTRACT_INJECTION_ENABLED", () => {
    const ff = (pauseFixture as { feature_flag: { name: string } })
      .feature_flag;
    expect(ff.name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
  });
  it("default=false", () => {
    const ff = (pauseFixture as { feature_flag: { default: boolean } })
      .feature_flag;
    expect(ff.default).toBe(false);
  });
  it("off falls back to L4", () => {
    const ff = (pauseFixture as {
      feature_flag: { behavior_when_disabled: string };
    }).feature_flag;
    expect(ff.behavior_when_disabled).toMatch(/fallback L4/);
  });
  it("scope covers Surface B + 008J entry point", () => {
    const ff = (pauseFixture as { feature_flag: { scope: string } })
      .feature_flag;
    expect(ff.scope).toMatch(/Surface B/);
    expect(ff.scope).toMatch(/008J/);
  });
  it("does_not_affect includes 10 entries", () => {
    const ff = (pauseFixture as {
      feature_flag: { does_not_affect: string[] };
    }).feature_flag;
    expect(ff.does_not_affect.length).toBeGreaterThanOrEqual(10);
    expect(ff.does_not_affect).toContain("live flush");
    expect(ff.does_not_affect).toContain("knowledgeSearch");
    expect(ff.does_not_affect).toContain("knowledgeIngest");
    expect(ff.does_not_affect).toContain(
      "real handoff write to ~/.hermes/handoff/packs"
    );
  });
});

// -----------------------------------------------------------------
// 7. entry point uniqueness
// -----------------------------------------------------------------

describe("008M — L5 entry point uniqueness", () => {
  it("l5_entry_point.file is src/main/task-dispatch-prompt-builder.ts", () => {
    const ep = (pauseFixture as { l5_entry_point: { file: string } })
      .l5_entry_point;
    expect(ep.file).toBe("src/main/task-dispatch-prompt-builder.ts");
  });
  it("entry point file exists", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    expect(existsSync(p)).toBe(true);
  });
  it("l5_entry_point.pattern mentions NEW pure file", () => {
    const ep = (pauseFixture as { l5_entry_point: { pattern: string } })
      .l5_entry_point;
    expect(ep.pattern).toMatch(/NEW pure file/);
  });
  it("l5_entry_point declares no in-place chain mutation", () => {
    const ep = (pauseFixture as { l5_entry_point: { pattern: string } })
      .l5_entry_point;
    expect(ep.pattern).toMatch(/no in-place mutation/);
  });
  it("l5_entry_point.side_effects is none (pure function)", () => {
    const ep = (pauseFixture as { l5_entry_point: { side_effects: string } })
      .l5_entry_point;
    expect(ep.side_effects).toMatch(/none/);
  });
  it("l5_entry_point exports references the 3 expected functions", () => {
    const ep = (pauseFixture as {
      l5_entry_point: { exports: string | string[] };
    }).l5_entry_point;
    const exp = Array.isArray(ep.exports)
      ? ep.exports.join("\n")
      : String(ep.exports);
    expect(exp).toContain("buildTaskDispatchPrompt");
    expect(exp).toContain("shouldApplyKnowledgeContractToDispatchPrompt");
    expect(exp).toContain("assertTaskDispatchPromptBuilderNoRuntime");
  });
  it("l5_entry_point has 4 literal false runtime flags", () => {
    const ep = (pauseFixture as {
      l5_entry_point: { literal_false_runtime_flags: string[] };
    }).l5_entry_point;
    expect(ep.literal_false_runtime_flags.length).toBe(4);
    expect(ep.literal_false_runtime_flags).toContain(
      "runtime_flush_allowed"
    );
    expect(ep.literal_false_runtime_flags).toContain(
      "runtime_dispatch_allowed"
    );
    expect(ep.literal_false_runtime_flags).toContain(
      "real_handoff_write_allowed"
    );
    expect(ep.literal_false_runtime_flags).toContain("live_adapter_allowed");
  });
  it("l5_entry_point has no_l6 = true literal", () => {
    const ep = (pauseFixture as { l5_entry_point: { literal_constants: string[] } })
      .l5_entry_point;
    expect(
      ep.literal_constants.some(
        (c) => c.includes("TASK_DISPATCH_NO_L6") && c.includes("true")
      )
    ).toBe(true);
  });
  it("008J builder file does not import runtime tokens", () => {
    const p = path.join(
      process.cwd(),
      "src",
      "main",
      "task-dispatch-prompt-builder.ts"
    );
    const src = readFileSync(p, "utf8");
    const importLines = src
      .split("\n")
      .filter((l) => l.trim().startsWith("import ") || l.includes("require("));
    const importBlob = importLines.join("\n");
    expect(importBlob).not.toMatch(/\bspawn\b/);
    expect(importBlob).not.toMatch(/\bchild_process\b/);
    expect(importBlob).not.toMatch(/\bknowledgeIngest\b/);
    expect(importBlob).not.toMatch(/\bknowledgeSearch\b/);
    expect(importBlob).not.toMatch(/\brunPlaybook\b/);
    expect(importBlob).not.toMatch(/\btriggerCronJob\b/);
    expect(importBlob).not.toMatch(/\bsendMessage\b/);
  });
});

// -----------------------------------------------------------------
// 8. runtime flags + no_l6 (re-verified at pause)
// -----------------------------------------------------------------

describe("008M — runtime flags + no_l6 (re-verified)", () => {
  it("008J builder output keeps 4 literal false flags + no_l6 across 008J fixture examples", () => {
    const examples = (builderFixture as {
      examples: Array<{
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
  it("runtime schema_version matches across runtime + fixtures", () => {
    expect(TASK_DISPATCH_BUILDER_SCHEMA_VERSION).toBe("1.0.0");
    expect(
      (pauseFixture as { schema_version: string }).schema_version
    ).toBe("1.0.0");
    expect(
      (closeoutFixture as { schema_version: string }).schema_version
    ).toBe("1.0.0");
  });
  it("008J slice / mode / surface / no_l6 literals match across runtime + fixtures", () => {
    expect(TASK_DISPATCH_BUILDER_SLICE).toBe("008J");
    expect(TASK_DISPATCH_BUILDER_MODE).toBe("task_dispatch_prompt_builder");
    expect(TASK_DISPATCH_SURFACE).toBe("task_prompt_preamble");
    expect(TASK_DISPATCH_NO_L6).toBe(true);
  });
});

// -----------------------------------------------------------------
// 9. observation checklist
// -----------------------------------------------------------------

describe("008M — observation checklist", () => {
  it("has at least 8 observation items", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string; check: string; expected: string }>;
    };
    expect(fx.observation_checklist.length).toBeGreaterThanOrEqual(8);
  });
  it("covers claude_code_asks_obsidian_or_memory_path", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "claude_code_asks_obsidian_or_memory_path"
    );
  });
  it("covers no_false_save_claim", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "no_false_save_claim"
    );
  });
  it("covers no_source_uri_drift", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "no_source_uri_drift"
    );
  });
  it("covers no_ordinary_code_injection", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "no_ordinary_code_injection"
    );
  });
  it("covers feature_flag_default_false", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "feature_flag_default_false"
    );
  });
  it("covers runtime_flags_all_false", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "runtime_flags_all_false"
    );
  });
  it("covers no_l6_true", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "no_l6_true"
    );
  });
  it("covers mtime_baseline_preserved", () => {
    const fx = pauseFixture as {
      observation_checklist: Array<{ item: string }>;
    };
    expect(fx.observation_checklist.map((i) => i.item)).toContain(
      "mtime_baseline_preserved"
    );
  });
});

// -----------------------------------------------------------------
// 10. mtime preserved (observation period invariant)
// -----------------------------------------------------------------

describe("008M — mtime preserved (observation period invariant)", () => {
  it("mtime baseline equals 1780195726 (handoff) and 1780230084 (audit)", () => {
    expect(
      (pauseFixture as { mtime_baseline: { handoff_packs: number; audit: number } })
        .mtime_baseline
    ).toEqual({ handoff_packs: 1780195726, audit: 1780230084 });
  });
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run a representative 008J builder call to prove no I/O side effect.
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

// -----------------------------------------------------------------
// 11. forbidden token scanner
// -----------------------------------------------------------------

describe("008M — forbidden token scanner (no real call)", () => {
  it("pause fixture has no call-form forbidden tokens in plain prose fields", () => {
    const fx = pauseFixture as Record<string, unknown>;
    const slim = {
      schema_version: fx.schema_version,
      slice: fx.slice,
      mode: fx.mode,
      current_state: fx.current_state,
      l5_entry_point: fx.l5_entry_point,
      feature_flag: fx.feature_flag,
      not_go_matrix: fx.not_go_matrix,
      observation_checklist: fx.observation_checklist,
      rollback_during_pause: fx.rollback_during_pause,
    };
    const blob = JSON.stringify(slim);
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
  it("runtime output from 008J builder carries no call expression", () => {
    const out = buildTaskDispatchPrompt({
      featureFlagEnabled: true,
      targetAgent: "claude_code",
      userRequest: "save to knowledge",
      baseTaskPrompt: "task: X",
    });
    const blob = `${out.preamble_text ?? ""}\n${out.final_task_prompt}`;
    for (const t of FORBIDDEN_CALL) {
      expect(blob).not.toContain(t);
    }
  });
});

// -----------------------------------------------------------------
// 12. rollback during pause
// -----------------------------------------------------------------

describe("008M — rollback during pause", () => {
  it("rollback.during_pause.no_code_to_revert mentions NEW file pattern", () => {
    const r = (
      pauseFixture as { rollback_during_pause: { no_code_to_revert: string } }
    ).rollback_during_pause;
    const v = String(r.no_code_to_revert);
    expect(v).toMatch(/NEW file/);
    expect(v).toMatch(/0 修改/);
  });
  it("rollback.during_pause.feature_flag_off_immediate documents instant rollback", () => {
    const r = (
      pauseFixture as {
        rollback_during_pause: { feature_flag_off_immediate: string };
      }
    ).rollback_during_pause;
    expect(r.feature_flag_off_immediate).toMatch(/KNOWLEDGE_CONTRACT_INJECTION_ENABLED=false/);
    expect(r.feature_flag_off_immediate).toMatch(/verbatim/);
  });
  it("rollback.during_pause.fall_back_to_L4 mentions HCC handoff payload", () => {
    const r = (
      pauseFixture as { rollback_during_pause: { fall_back_to_L4: string } }
    ).rollback_during_pause;
    expect(r.fall_back_to_L4).toMatch(/L4/);
    expect(r.fall_back_to_L4).toMatch(/handoff/);
  });
});

// -----------------------------------------------------------------
// 13. cross-fixture consistency
// -----------------------------------------------------------------

describe("008M — cross-fixture consistency", () => {
  it("008L closeout fixture is loaded", () => {
    expect((closeoutFixture as { slice: string }).slice).toBe("008L");
  });
  it("008J builder fixture is loaded", () => {
    expect((builderFixture as { slice: string }).slice).toBe("008J");
  });
  it("pause fixture reviewed_slices includes 008L", () => {
    const fx = pauseFixture as { reviewed_slices: string[] };
    expect(fx.reviewed_slices).toContain("008L");
  });
});
