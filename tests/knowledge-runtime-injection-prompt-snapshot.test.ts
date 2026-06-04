// Hermes Pro — Knowledge Runtime Injection Prompt Snapshot Tests (Slice 008G, no runtime)
// Pure snapshot tests. No I/O, no IPC, no fetch, no real dispatch,
// no real handoff write, no agent subprocess.

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
  type KnowledgeSurfaceBInput,
  type KnowledgeSurfaceBOutput,
} from "../src/shared/lib/knowledge-runtime-injection-surface-b";

import fixture from "./fixtures/knowledge-reuse/runtime-injection-prompt-snapshots.json";

const BASELINE_HANDOFF_MTIME = 1780195726;
const BASELINE_AUDIT_MTIME = 1780230084;

const FORBIDDEN_DECEPTIVE: ReadonlyArray<string> = [
  "已保存",
  "写入成功",
  "已写入",
  "saved successfully",
  "written successfully",
  "will be written after confirm",
];

const FORBIDDEN_CALL: ReadonlyArray<string> = [
  "knowledgeIngest(",
  "knowledgeSearch(",
  "runPlaybook(",
  "triggerCronJob(",
  "sendMessage(",
  "fetch(",
];

type Expected = Record<string, unknown>;
type Snap = { id: string; input: KnowledgeSurfaceBInput; expected: Expected };

const SNAPSHOTS: ReadonlyArray<Snap> = (
  fixture as { snapshots: Snap[] }
).snapshots;

function runSnap(s: Snap): KnowledgeSurfaceBOutput {
  // Strip test-seam fields the helper may not accept; pass through
  // what fixture provides.
  return buildTaskPromptWithKnowledgeContractSurfaceB(s.input);
}

// -----------------------------------------------------------------
// 1. Fixture shape
// -----------------------------------------------------------------

describe("008G — fixture shape", () => {
  it("schema_version is 1.0.0", () => {
    expect((fixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
  });
  it("slice is 008G", () => {
    expect((fixture as { slice: string }).slice).toBe("008G");
  });
  it("mode is prompt_snapshot_tests", () => {
    expect((fixture as { mode: string }).mode).toBe("prompt_snapshot_tests");
  });
  it("source_helper is knowledge-runtime-injection-surface-b", () => {
    expect((fixture as { source_helper: string }).source_helper).toBe(
      "knowledge-runtime-injection-surface-b"
    );
  });
  it("source_slice is 008F", () => {
    expect((fixture as { source_slice: string }).source_slice).toBe("008F");
  });
  it("has at least 8 snapshots", () => {
    expect(SNAPSHOTS.length).toBeGreaterThanOrEqual(8);
  });
  it("each snapshot has id / input / expected", () => {
    for (const s of SNAPSHOTS) {
      expect(typeof s.id).toBe("string");
      expect(typeof s.input).toBe("object");
      expect(typeof s.expected).toBe("object");
    }
  });
  it("fixture has at least 20 invariants", () => {
    const inv = (fixture as { invariants: string[] }).invariants;
    expect(Array.isArray(inv)).toBe(true);
    expect(inv.length).toBeGreaterThanOrEqual(20);
  });
  it("forbidden_runtime_checked is true", () => {
    expect((fixture as { forbidden_runtime_checked: boolean })
      .forbidden_runtime_checked).toBe(true);
  });
  it("all 8 named snapshot ids present", () => {
    const ids = SNAPSHOTS.map((s) => s.id);
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
// 2. Byte-level prompt behavior
// -----------------------------------------------------------------

describe("008G — byte-level prompt behavior", () => {
  it("skip case: final_task_prompt equals baseTaskPrompt verbatim", () => {
    const s = SNAPSHOTS.find((x) => x.id === "flag_disabled_no_preamble")!;
    const out = runSnap(s);
    expect(out.final_task_prompt).toBe(s.input.baseTaskPrompt);
    expect(out.preamble_text).toBeNull();
  });

  it("attach case: preamble precedes base, separated by '\\n\\n'", () => {
    const s = SNAPSHOTS.find((x) => x.id === "claude_code_research_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    const preamble = out.preamble_text!;
    const separator = "\n\n";
    expect(out.final_task_prompt).toBe(
      `${preamble}${separator}${s.input.baseTaskPrompt}`
    );
  });

  it("attach case: preamble starts with header template", () => {
    const s = SNAPSHOTS.find((x) => x.id === "claude_code_research_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_text!).toMatch(
      /^# Hermes Knowledge Reuse Contract — Surface B dry-run preamble/
    );
  });

  it("attach case: preamble header includes target_agent + flag", () => {
    const s = SNAPSHOTS.find((x) => x.id === "claude_code_research_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_text!).toContain("# target_agent: claude_code");
    expect(out.preamble_text!).toContain(
      "# feature_flag: KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true"
    );
    expect(out.preamble_text!).toContain(
      "# runtime_flush_allowed: false | dry_run_only: true"
    );
  });

  it("attach case: preamble body comes from 007I contract snippet", () => {
    const s = SNAPSHOTS.find((x) => x.id === "claude_code_research_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_text!).toContain(
      "Hermes Pro internal knowledge store"
    );
    expect(out.preamble_text!).toContain("Do not write to MEMORY.md");
    expect(out.preamble_text!).toContain("Bucket semantics");
  });

  it("base prompt multiline preserved verbatim", () => {
    const s = SNAPSHOTS.find(
      (x) => x.id === "base_prompt_preserved_multiline"
    )!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    expect(out.base_task_prompt_preserved).toBe(true);
    expect(out.final_task_prompt).toContain(
      "do the thing\nmultiline\nwith $pecial & <chars> and unicode 你好"
    );
  });

  it("separator stable: no implicit drift between header and base", () => {
    const s = SNAPSHOTS.find((x) => x.id === "claude_code_research_preamble")!;
    const out = runSnap(s);
    // exactly one separator (the final \n\n between preamble and base)
    const parts = out.final_task_prompt.split("\n\n");
    // preamble contains its own internal \n\n (header end + body start);
    // we just assert the base appears as the final part.
    expect(parts[parts.length - 1]).toBe(s.input.baseTaskPrompt);
  });
});

// -----------------------------------------------------------------
// 3. Matrix coverage
// -----------------------------------------------------------------

describe("008G — matrix coverage", () => {
  it("flag disabled: no preamble, fallback L4", () => {
    const s = SNAPSHOTS.find((x) => x.id === "flag_disabled_no_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(false);
    expect(out.fallback_to_l4).toBe(true);
    expect(out.skip_reason).toBe("flag_disabled");
  });

  it("claude_code + research trigger: attach", () => {
    const s = SNAPSHOTS.find((x) => x.id === "claude_code_research_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    expect(out.trigger_flags.research_keyword).toBe(true);
  });

  it("codex + ingest_draft: attach", () => {
    const s = SNAPSHOTS.find((x) => x.id === "codex_ingest_draft_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    expect(out.trigger_flags.has_ingest_draft).toBe(true);
  });

  it("hermes_pro + local_known_and_newly_found: attach", () => {
    const s = SNAPSHOTS.find(
      (x) => x.id === "hermes_pro_local_newly_preamble"
    )!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    expect(out.trigger_flags.has_local_known_and_newly_found).toBe(true);
  });

  it("hermes reserved: skip with reserved marker", () => {
    const s = SNAPSHOTS.find((x) => x.id === "hermes_reserved_no_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(false);
    expect(out.skip_reason).toBe("hermes_self_call_reserved");
    expect(out.hermes_reserved_marker).toBe(true);
    expect(out.final_task_prompt).toBe(s.input.baseTaskPrompt);
  });

  it("ordinary code-only: skip with no_trigger_fired", () => {
    const s = SNAPSHOTS.find((x) => x.id === "ordinary_code_no_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(false);
    expect(out.skip_reason).toBe("no_trigger_fired");
    expect(out.trigger_flags.save_keyword).toBe(false);
    expect(out.trigger_flags.research_keyword).toBe(false);
  });

  it("truncated: truncated=true, max_chars respected", () => {
    const s = SNAPSHOTS.find((x) => x.id === "truncated_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    expect(out.truncated).toBe(true);
    expect(out.max_chars).toBe(64);
  });
});

// -----------------------------------------------------------------
// 4. Safety copy invariants
// -----------------------------------------------------------------

describe("008G — safety copy invariants", () => {
  it("no deceptive copy in preamble (across all snapshots)", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      const preamble = out.preamble_text ?? "";
      for (const phrase of FORBIDDEN_DECEPTIVE) {
        expect(preamble).not.toContain(phrase);
      }
    }
  });

  it("no Obsidian Vault / MEMORY.md / .wolf/cerebrum.md positive recommendation in preamble (007I source only)", () => {
    // 007I snippet MENTIONS these tokens inside 'Do not' clauses as
    // forbidden paths. The 007I invariant assertSnippetShape is the
    // canonical validator. We check the preamble includes the
    // explicit 'do not' framing for each forbidden path. Filter to
    // attach cases that use the 007I snippet source (no
    // overridePreambleText).
    for (const s of SNAPSHOTS) {
      if (s.expected.preamble_attached !== true) continue;
      if (s.input.overridePreambleText !== undefined) continue;
      const out = runSnap(s);
      const preamble = out.preamble_text!;
      expect(preamble).toMatch(/Do not ask[\s\S]*Obsidian/);
      expect(preamble).toMatch(/Do not write to MEMORY\.md/);
      expect(preamble).toMatch(/Do not invent new write paths/);
    }
  });

  it("no notes/<topic>.md positive recommendation in preamble (007I source only)", () => {
    for (const s of SNAPSHOTS) {
      if (s.expected.preamble_attached !== true) continue;
      if (s.input.overridePreambleText !== undefined) continue;
      const out = runSnap(s);
      const preamble = out.preamble_text!;
      expect(preamble).toMatch(/notes\/<topic>\.md/);
      expect(preamble).toMatch(
        /Do not write to MEMORY\.md[\s\S]*notes\/<topic>\.md/
      );
    }
  });

  it("truncated override case: preamble body comes from override, not 007I", () => {
    const s = SNAPSHOTS.find((x) => x.id === "truncated_preamble")!;
    const out = runSnap(s);
    expect(out.preamble_attached).toBe(true);
    expect(out.truncated).toBe(true);
    // override text "0123456789abcdef..." is the body, so 007I
    // framing checks would not apply — but preamble header still
    // must be present.
    expect(out.preamble_text).toMatch(
      /^# Hermes Knowledge Reuse Contract — Surface B dry-run preamble/
    );
    expect(out.preamble_text).toContain("# target_agent: claude_code");
    expect(out.preamble_text).toContain(
      "# feature_flag: KNOWLEDGE_CONTRACT_INJECTION_ENABLED=true"
    );
  });

  it("base prompt is preserved verbatim (no rewrite, no trim, no escape)", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.final_task_prompt).toContain(s.input.baseTaskPrompt);
    }
  });
});

// -----------------------------------------------------------------
// 5. Runtime flags
// -----------------------------------------------------------------

describe("008G — runtime flags (literal false)", () => {
  it("every snapshot has runtime_flush_allowed=false", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.runtime_flush_allowed).toBe(false);
    }
  });
  it("every snapshot has runtime_dispatch_allowed=false", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.runtime_dispatch_allowed).toBe(false);
    }
  });
  it("every snapshot has real_handoff_write_allowed=false", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.real_handoff_write_allowed).toBe(false);
    }
  });
  it("every snapshot has live_adapter_allowed=false", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.live_adapter_allowed).toBe(false);
    }
  });
  it("feature_flag_default_state is literal false", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.feature_flag_default_state).toBe(false);
    }
  });
  it("feature_flag_name is the literal string", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.feature_flag_name).toBe("KNOWLEDGE_CONTRACT_INJECTION_ENABLED");
    }
  });
});

// -----------------------------------------------------------------
// 6. Forgery rejection
// -----------------------------------------------------------------

describe("008G — forgery rejection", () => {
  it("forged runtime_flush_allowed=true is rejected", () => {
    const s = SNAPSHOTS[0];
    const out = runSnap(s);
    const forged = {
      ...out,
      runtime_flush_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /runtime_flush_allowed/
    );
  });
  it("forged runtime_dispatch_allowed=true is rejected", () => {
    const s = SNAPSHOTS[0];
    const out = runSnap(s);
    const forged = {
      ...out,
      runtime_dispatch_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /runtime_dispatch_allowed/
    );
  });
  it("forged real_handoff_write_allowed=true is rejected", () => {
    const s = SNAPSHOTS[0];
    const out = runSnap(s);
    const forged = {
      ...out,
      real_handoff_write_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /real_handoff_write_allowed/
    );
  });
  it("forged live_adapter_allowed=true is rejected", () => {
    const s = SNAPSHOTS[0];
    const out = runSnap(s);
    const forged = {
      ...out,
      live_adapter_allowed: true as unknown as false,
    } as unknown as KnowledgeSurfaceBOutput;
    expect(() => assertKnowledgeSurfaceBNoRuntime(forged)).toThrow(
      /live_adapter_allowed/
    );
  });
  it("normally produced output passes no-runtime guard", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(() => assertKnowledgeSurfaceBNoRuntime(out)).not.toThrow();
    }
  });
});

// -----------------------------------------------------------------
// 7. JSON round-trip
// -----------------------------------------------------------------

describe("008G — JSON round-trip", () => {
  it("snapshot fixture is round-trip stable", () => {
    const blob = JSON.stringify(fixture);
    const round = JSON.parse(blob);
    expect(round).toEqual(fixture);
  });
  it("each snapshot output is round-trip stable", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      const round = JSON.parse(JSON.stringify(out)) as KnowledgeSurfaceBOutput;
      expect(round).toEqual(out);
      expect(() => assertKnowledgeSurfaceBNoRuntime(round)).not.toThrow();
    }
  });
  it("schema_version matches across runtime + fixture", () => {
    expect(KNOWLEDGE_SURFACE_B_SCHEMA_VERSION).toBe("1.0.0");
    expect((fixture as { schema_version: string }).schema_version).toBe(
      "1.0.0"
    );
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.schema_version).toBe("1.0.0");
    }
  });
  it("slice + mode + surface literals match across runtime + fixture", () => {
    expect(SURFACE_B_SLICE).toBe("008F");
    expect(SURFACE_B_MODE).toBe("surface_b_dry_run_implementation");
    expect(SURFACE_B_NAME).toBe("task_prompt_preamble");
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(out.slice).toBe("008F");
      expect(out.mode).toBe("surface_b_dry_run_implementation");
      expect(out.surface).toBe("task_prompt_preamble");
    }
  });
});

// -----------------------------------------------------------------
// 8. Forbidden token scanner
// -----------------------------------------------------------------

describe("008G — forbidden token scanner", () => {
  it("no call expression in preamble_text or final_task_prompt", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      const blob = `${out.preamble_text ?? ""}\n${out.final_task_prompt}`;
      for (const t of FORBIDDEN_CALL) {
        expect(blob).not.toContain(t);
      }
    }
  });

  it("shouldApply mirrors preamble_attached across full fixture", () => {
    for (const s of SNAPSHOTS) {
      const out = runSnap(s);
      expect(shouldApplyKnowledgeContractSurfaceB(s.input)).toBe(
        out.preamble_attached
      );
    }
  });

  it("preamble helper returns null + empty hash when skip", () => {
    for (const s of SNAPSHOTS) {
      if (s.expected.preamble_attached === false) {
        const r = buildKnowledgeContractSurfaceBPreamble(s.input);
        expect(r.preamble).toBeNull();
        expect(r.hash).toBe("");
        expect(r.truncated).toBe(false);
      }
    }
  });

  it("preamble helper returns non-null + sha256 hash when attach", () => {
    for (const s of SNAPSHOTS) {
      if (s.expected.preamble_attached === true) {
        const r = buildKnowledgeContractSurfaceBPreamble(s.input);
        expect(r.preamble).not.toBeNull();
        expect(r.hash).toMatch(/^[a-f0-9]{64}$/);
      }
    }
  });
});

// -----------------------------------------------------------------
// 9. mtime guard
// -----------------------------------------------------------------

describe("008G — no real handoff/audit write", () => {
  it("does not change ~/.hermes/handoff/packs or ~/.hermes/audit mtime", () => {
    const beforeHandoff = Math.floor(
      statSync("/Users/midoudou/.hermes/handoff/packs").mtimeMs / 1000
    );
    const beforeAudit = Math.floor(
      statSync("/Users/midoudou/.hermes/audit").mtimeMs / 1000
    );
    // Run all snapshots to prove no I/O side effect.
    for (const s of SNAPSHOTS) {
      runSnap(s);
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
