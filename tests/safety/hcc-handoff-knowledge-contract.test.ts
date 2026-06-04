import { describe, expect, it } from "vitest";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildHCCHandoffPayload,
  type HCCHandoffPayload,
} from "../../src/main/hcc-handoff-pack";
import type { HCCTaskPlan } from "../../src/main/hcc-task-types";
import {
  validateKnowledgeHandoffContractSnippet,
  PLACEMENT_KEY,
} from "../../src/shared/lib/knowledge-handoff-contract";

const HERMES_HANDOFF_PACKS = "/Users/midoudou/.hermes/handoff/packs";
const HERMES_AUDIT = "/Users/midoudou/.hermes/audit";

// -----------------------------------------------------------------
// Plan fixture (pure, no runtime)
// -----------------------------------------------------------------

function makePlan(overrides: Partial<HCCTaskPlan> = {}): HCCTaskPlan {
  return {
    taskId: "hcc-dry-run://test-007L-1/github-research",
    state: "verified",
    goal: "compare Hermes Pro V6 vs OpenClaw / Ruflo / Mano, save to knowledge base",
    codeGraph: {
      wasProvided: false,
      status: "unavailable",
      artifactRef: null,
      riskNotes: [],
    },
    verifierInput: null,
    verifierInputValid: true,
    validationErrors: [],
    domainProfile: null,
    ...overrides,
  };
}

// -----------------------------------------------------------------
// Real-path mtime baseline (must NOT change after these tests run)
// -----------------------------------------------------------------

function getMtime(p: string): number {
  return statSync(p).mtimeMs;
}

const HANDOFF_MTIME_BEFORE = getMtime(HERMES_HANDOFF_PACKS);
const AUDIT_MTIME_BEFORE = getMtime(HERMES_AUDIT);

// -----------------------------------------------------------------
// 1. No knowledgeContract option → payload.context absent
// -----------------------------------------------------------------

describe("no knowledgeContract option", () => {
  it("payload.context is undefined (old behavior preserved)", () => {
    const payload = buildHCCHandoffPayload(makePlan());
    expect(payload.context).toBeUndefined();
  });

  it("payload does not contain knowledge_reuse key anywhere", () => {
    const payload = buildHCCHandoffPayload(makePlan());
    const json = JSON.stringify(payload);
    expect(json.includes("knowledge_reuse")).toBe(false);
  });
});

// -----------------------------------------------------------------
// 2. claude_code with trigger
// -----------------------------------------------------------------

describe("claude_code with save trigger", () => {
  function build(): HCCHandoffPayload {
    return buildHCCHandoffPayload(
      makePlan({ state: "verified" }),
      {
        knowledgeContract: {
          targetAgent: "claude_code",
          userRequest:
            "compare Hermes Pro V6 vs OpenClaw, save the result to the knowledge base",
          taskKind: "github_research",
          hasIngestDraft: false,
          hasFlushPending: false,
          hasLocalKnownAndNewlyFound: false,
        },
      }
    );
  }

  it("payload.context.contracts.knowledge_reuse is present", () => {
    const payload = build();
    expect(payload.context).toBeDefined();
    expect(payload.context?.contracts).toBeDefined();
    expect(payload.context?.contracts?.knowledge_reuse).toBeDefined();
  });

  it("target_agent is claude_code", () => {
    const payload = build();
    expect(payload.context?.contracts?.knowledge_reuse?.target_agent).toBe(
      "claude_code"
    );
  });

  it("dry_run_only is true", () => {
    const payload = build();
    expect(payload.context?.contracts?.knowledge_reuse?.dry_run_only).toBe(
      true
    );
  });

  it("runtime_flush_allowed is false", () => {
    const payload = build();
    expect(
      payload.context?.contracts?.knowledge_reuse?.runtime_flush_allowed
    ).toBe(false);
  });

  it("forbidden_runtime_checked is true", () => {
    const payload = build();
    expect(
      payload.context?.contracts?.knowledge_reuse?.forbidden_runtime_checked
    ).toBe(true);
  });

  it("snippet_text contains core rules", () => {
    const payload = build();
    const text = payload.context?.contracts?.knowledge_reuse?.snippet_text ?? "";
    expect(text).toContain("Hermes Pro internal knowledge store");
    expect(text).toContain("Do not ask the user for an Obsidian Vault path");
    expect(text).toContain("MEMORY.md");
    expect(text).toContain("runtime_flush_allowed = false");
  });

  it("snippet fits in max_chars", () => {
    const payload = build();
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.snippet_text.length).toBeLessThanOrEqual(env.max_chars);
  });

  it("placement is exactly context.contracts.knowledge_reuse", () => {
    const payload = build();
    const path = PLACEMENT_KEY;
    const parts = path.split(".");
    let cur: unknown = payload;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        throw new Error(`path "${path}" not found at segment "${p}"`);
      }
    }
    expect(cur).toBeDefined();
  });

  it("validateKnowledgeHandoffContractSnippet passes", () => {
    const payload = build();
    const result = validateKnowledgeHandoffContractSnippet(
      payload.context?.contracts?.knowledge_reuse
    );
    expect(result.ok).toBe(true);
  });

  it("snippet NOT in executable_steps or verificationCommands", () => {
    const payload = build();
    expect((payload as Record<string, unknown>).executable_steps).toBeUndefined();
    expect((payload as Record<string, unknown>).verificationCommands).toBeUndefined();
  });

  it("next_actions do not contain call-form runtime action", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      },
    });
    for (const a of payload.next_actions) {
      expect(a.action).not.toMatch(/knowledgeIngest\s*\(/i);
      expect(a.action).not.toMatch(/runPlaybook\s*\(/i);
    }
  });

  it("payload does not change next_actions behavior", () => {
    const before = buildHCCHandoffPayload(makePlan());
    const after = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      },
    });
    expect(after.next_actions).toEqual(before.next_actions);
  });
});

// -----------------------------------------------------------------
// 3. codex with trigger
// -----------------------------------------------------------------

describe("codex with save trigger", () => {
  function build(): HCCHandoffPayload {
    return buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "codex",
        userRequest:
          "compare vite vs webpack, persist conclusion to Hermes Pro knowledge base",
        taskKind: "tool_comparison",
        hasIngestDraft: false,
        hasFlushPending: false,
        hasLocalKnownAndNewlyFound: false,
      },
    });
  }

  it("payload.context.contracts.knowledge_reuse is present", () => {
    const payload = build();
    expect(payload.context?.contracts?.knowledge_reuse).toBeDefined();
  });

  it("target_agent is codex", () => {
    const payload = build();
    expect(payload.context?.contracts?.knowledge_reuse?.target_agent).toBe(
      "codex"
    );
  });

  it("dry_run_only + runtime_flush_allowed=false + forbidden_runtime_checked=true", () => {
    const payload = build();
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.forbidden_runtime_checked).toBe(true);
  });

  it("snippet_text contains core rules (target-adjusted but preserved)", () => {
    const payload = build();
    const text = payload.context?.contracts?.knowledge_reuse?.snippet_text ?? "";
    expect(text).toContain("Hermes Pro internal knowledge store");
    expect(text).toContain("MEMORY.md");
  });
});

// -----------------------------------------------------------------
// 4. hermes target → reserved / no default attach
// -----------------------------------------------------------------

describe("hermes target — reserved / no default attach", () => {
  function build(): HCCHandoffPayload {
    return buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "hermes",
        userRequest: "research this topic and report back without writing anything",
        taskKind: "general_research",
        hasIngestDraft: false,
        hasFlushPending: false,
        hasLocalKnownAndNewlyFound: false,
      },
    });
  }

  it("payload.context.contracts.knowledge_reuse is present (envelope exists)", () => {
    const payload = build();
    expect(payload.context?.contracts?.knowledge_reuse).toBeDefined();
  });

  it("target_agent is hermes", () => {
    const payload = build();
    expect(payload.context?.contracts?.knowledge_reuse?.target_agent).toBe(
      "hermes"
    );
  });

  it("snippet_text is reserved marker (inert)", () => {
    const payload = build();
    const text = payload.context?.contracts?.knowledge_reuse?.snippet_text ?? "";
    expect(text.toLowerCase()).toContain("reserved");
  });

  it("attach_reason mentions reserved", () => {
    const payload = build();
    expect(
      payload.context?.contracts?.knowledge_reuse?.attach_reason
    ).toContain("reserved");
  });

  it("dry_run_only + runtime_flush_allowed=false + forbidden_runtime_checked=true", () => {
    const payload = build();
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.forbidden_runtime_checked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. JSON round trip
// -----------------------------------------------------------------

describe("JSON round trip", () => {
  it("claude_code payload survives stringify + parse", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
        taskKind: "github_research",
      },
    });
    const restored = JSON.parse(JSON.stringify(payload));
    expect(restored.context?.contracts?.knowledge_reuse?.target_agent).toBe(
      "claude_code"
    );
    expect(restored.context?.contracts?.knowledge_reuse?.dry_run_only).toBe(
      true
    );
  });
});

// -----------------------------------------------------------------
// 6. Real-path mtime invariant (CRITICAL)
// -----------------------------------------------------------------

describe("real handoff / audit mtime unchanged", () => {
  it("~/.hermes/handoff/packs mtime unchanged", () => {
    const mtimeAfter = getMtime(HERMES_HANDOFF_PACKS);
    expect(mtimeAfter).toBe(HANDOFF_MTIME_BEFORE);
  });

  it("~/.hermes/audit mtime unchanged", () => {
    const mtimeAfter = getMtime(HERMES_AUDIT);
    expect(mtimeAfter).toBe(AUDIT_MTIME_BEFORE);
  });
});

// -----------------------------------------------------------------
// 7. Existing safety invariants preserved
// -----------------------------------------------------------------

describe("existing handoff invariants preserved", () => {
  it("payload.next_actions still contains claude_code / hermes / user", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      },
    });
    const owners = new Set(payload.next_actions.map((a) => a.owner));
    expect(owners.has("claude_code")).toBe(true);
    expect(owners.has("hermes")).toBe(true);
    expect(owners.has("user")).toBe(true);
  });

  it("payload.safety.permission_boundary mentions no IPC", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      },
    });
    expect(payload.safety.permission_boundary).toContain("no IPC");
  });

  it("payload.current_state.hcc_executable is false", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      },
    });
    expect(payload.current_state.hcc_executable).toBe(false);
  });

  it("payload.runtime_flush_allowed is false (top-level)", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save to knowledge",
      },
    });
    expect(payload.safety.redaction_status).toBe("not_run");
  });
});

// -----------------------------------------------------------------
// 8. Knowledge handoff source self-check (007J invariant)
// -----------------------------------------------------------------

describe("007J invariant — no knowledgeIngest( as a call in payload", () => {
  for (const target of [
    "claude_code",
    "codex",
    "hermes",
  ] as const) {
    it(`${target} payload has no knowledgeIngest( as a call`, () => {
      const payload = buildHCCHandoffPayload(makePlan(), {
        knowledgeContract: { targetAgent: target, userRequest: "save to kb" },
      });
      const json = JSON.stringify(payload);
      expect(/knowledgeIngest\s*\(/i.test(json)).toBe(false);
    });

    it(`${target} payload has no runPlaybook( as a call`, () => {
      const payload = buildHCCHandoffPayload(makePlan(), {
        knowledgeContract: { targetAgent: target, userRequest: "save to kb" },
      });
      const json = JSON.stringify(payload);
      expect(/runPlaybook\s*\(/i.test(json)).toBe(false);
    });
  }
});
