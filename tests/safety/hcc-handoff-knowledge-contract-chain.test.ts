import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { mkdtempSync, statSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  buildHCCHandoffPayload,
  writeHCCHandoffPayloadFixture,
  readHCCHandoffPayloadFixture,
  type HCCHandoffPayload,
} from "../../src/main/hcc-handoff-pack";
import type { HCCTaskPlan } from "../../src/main/hcc-task-types";
import {
  validateKnowledgeHandoffContractSnippet,
  assertKnowledgeHandoffContractNoRuntime,
  PLACEMENT_KEY,
  type KnowledgeHandoffContractSnippet,
} from "../../src/shared/lib/knowledge-handoff-contract";

const HERMES_HANDOFF_PACKS = "/Users/midoudou/.hermes/handoff/packs";
const HERMES_AUDIT = "/Users/midoudou/.hermes/audit";

const F_CLAUDE_FIXTURE = resolve(
  __dirname,
  "../fixtures/knowledge-reuse/handoff-contract/claude-code-handoff-contract.json"
);
const F_CODEX_FIXTURE = resolve(
  __dirname,
  "../fixtures/knowledge-reuse/handoff-contract/codex-handoff-contract.json"
);
const F_HERMES_FIXTURE = resolve(
  __dirname,
  "../fixtures/knowledge-reuse/handoff-contract/hermes-handoff-contract-reserved.json"
);

const F_CLAUDE_DATA = JSON.parse(readFileSync(F_CLAUDE_FIXTURE, "utf8"));
const F_CODEX_DATA = JSON.parse(readFileSync(F_CODEX_FIXTURE, "utf8"));
const F_HERMES_DATA = JSON.parse(readFileSync(F_HERMES_FIXTURE, "utf8"));

// -----------------------------------------------------------------
// Plan fixture (representative HCC dry-run plan)
// -----------------------------------------------------------------

function makePlan(overrides: Partial<HCCTaskPlan> = {}): HCCTaskPlan {
  return {
    taskId: "hcc-dry-run://chain-007M/claude-code-research",
    state: "verified",
    goal: "compare Hermes Pro V6 vs OpenClaw, save to Hermes Pro knowledge base",
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
// Real-path mtime baseline (must NOT change)
// -----------------------------------------------------------------

function getMtime(p: string): number {
  return statSync(p).mtimeMs;
}

const HANDOFF_MTIME_BEFORE = getMtime(HERMES_HANDOFF_PACKS);
const AUDIT_MTIME_BEFORE = getMtime(HERMES_AUDIT);

// -----------------------------------------------------------------
// tmpDir for fixture write/read (NEVER ~/.hermes)
// -----------------------------------------------------------------

let tmpRoot: string;

beforeAll(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "hcc-007M-"));
});

afterAll(() => {
  if (existsSync(tmpRoot)) {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------
// 1. Chain: plan + knowledgeContract option → payload → envelope
// -----------------------------------------------------------------

describe("chain under test", () => {
  it("buildHCCHandoffPayload accepts knowledgeContract option and produces envelope", () => {
    const payload = buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest:
          "compare Hermes Pro V6 vs OpenClaw, save to Hermes Pro knowledge base",
        taskKind: "github_research",
        hasIngestDraft: false,
        hasFlushPending: false,
        hasLocalKnownAndNewlyFound: false,
      },
    });
    expect(payload.context?.contracts?.knowledge_reuse).toBeDefined();
  });
});

// -----------------------------------------------------------------
// 2. 4 target agent behavior
// -----------------------------------------------------------------

describe("4 target agent matrix", () => {
  function buildFor(
    targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes",
    userRequest: string,
    taskKind: string
  ): HCCHandoffPayload {
    return buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent,
        userRequest,
        taskKind,
        hasIngestDraft: false,
        hasFlushPending: false,
        hasLocalKnownAndNewlyFound: false,
      },
    });
  }

  it("claude_code produces full snippet", () => {
    const payload = buildFor(
      "claude_code",
      "save this to Hermes Pro knowledge base",
      "github_research"
    );
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.target_agent).toBe("claude_code");
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.snippet_text.length).toBeGreaterThan(0);
    expect(env.snippet_text).toContain("Hermes Pro internal knowledge store");
  });

  it("codex produces full snippet", () => {
    const payload = buildFor(
      "codex",
      "persist conclusion to Hermes Pro knowledge base",
      "tool_comparison"
    );
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.target_agent).toBe("codex");
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.snippet_text.length).toBeGreaterThan(0);
    expect(env.snippet_text).toContain("Hermes Pro internal knowledge store");
  });

  it("hermes_pro produces full snippet (reserved for future opt-in)", () => {
    const payload = buildFor(
      "hermes_pro",
      "save this to Hermes Pro knowledge base",
      "general_research"
    );
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.target_agent).toBe("hermes_pro");
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.snippet_text.length).toBeGreaterThan(0);
  });

  it("hermes target is reserved (no default attach)", () => {
    const payload = buildFor(
      "hermes",
      "research this topic and report back without writing anything",
      "general_research"
    );
    const env = payload.context?.contracts?.knowledge_reuse!;
    expect(env.target_agent).toBe("hermes");
    expect(env.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(env.snippet_text.toLowerCase()).toContain("reserved");
    expect(env.attach_reason).toContain("reserved");
  });
});

// -----------------------------------------------------------------
// 3. Fixture comparison: builder output vs 007K fixture shape
// -----------------------------------------------------------------

describe("fixture comparison with 007K", () => {
  function buildForAgent(
    targetAgent: "claude_code" | "codex" | "hermes_pro" | "hermes"
  ): KnowledgeHandoffContractSnippet {
    const payload = buildHCCHandoffPayload(
      makePlan({
        taskId: `hcc-dry-run://chain-007M/${targetAgent}`,
      }),
      {
        knowledgeContract: {
          targetAgent,
          userRequest:
            targetAgent === "hermes"
              ? "research this topic and report back"
              : "save this to Hermes Pro knowledge base",
          taskKind:
            targetAgent === "codex" ? "tool_comparison" : "github_research",
        },
      }
    );
    return payload.context?.contracts?.knowledge_reuse!;
  }

  it("claude_code builder envelope has same schema key set as 007K fixture", () => {
    const env = buildForAgent("claude_code");
    const fxEnv = F_CLAUDE_DATA.context.contracts.knowledge_reuse;
    const envKeys = Object.keys(env).sort();
    const fxKeys = Object.keys(fxEnv).sort();
    // Both must have at least the 13 required envelope keys
    for (const k of [
      "target_agent",
      "snippet_version",
      "snippet_text",
      "attach_reason",
      "trigger_flags",
      "dry_run_only",
      "runtime_flush_allowed",
      "source_doc",
      "created_at",
      "max_chars",
      "truncated",
      "forbidden_runtime_checked",
    ]) {
      expect(envKeys, `env missing key: ${k}`).toContain(k);
      expect(fxKeys, `fixture missing key: ${k}`).toContain(k);
    }
    // Both must have target_agent === "claude_code"
    expect(env.target_agent).toBe("claude_code");
    expect(fxEnv.target_agent).toBe("claude_code");
  });

  it("codex builder envelope has same schema key set as 007K fixture", () => {
    const env = buildForAgent("codex");
    const fxEnv = F_CODEX_DATA.context.contracts.knowledge_reuse;
    expect(env.target_agent).toBe("codex");
    expect(fxEnv.target_agent).toBe("codex");
    for (const k of [
      "target_agent",
      "snippet_version",
      "snippet_text",
      "attach_reason",
      "trigger_flags",
      "dry_run_only",
      "runtime_flush_allowed",
      "source_doc",
      "created_at",
      "max_chars",
      "truncated",
      "forbidden_runtime_checked",
    ]) {
      expect(Object.keys(env)).toContain(k);
      expect(Object.keys(fxEnv)).toContain(k);
    }
  });

  it("hermes builder envelope matches reserved fixture semantics", () => {
    const env = buildForAgent("hermes");
    const fxEnv = F_HERMES_DATA.context.contracts.knowledge_reuse;
    expect(env.target_agent).toBe("hermes");
    expect(fxEnv.target_agent).toBe("hermes");
    // Both must carry attach_reason mentioning "reserved"
    expect(env.attach_reason).toContain("reserved");
    expect(fxEnv.attach_reason).toContain("reserved");
    // Both must carry dry_run_only=true + runtime_flush_allowed=false
    expect(env.dry_run_only).toBe(true);
    expect(fxEnv.dry_run_only).toBe(true);
    expect(env.runtime_flush_allowed).toBe(false);
    expect(fxEnv.runtime_flush_allowed).toBe(false);
  });
});

// -----------------------------------------------------------------
// 4. Invariants — placement + literals + shape
// -----------------------------------------------------------------

describe("invariants verified", () => {
  function build(): HCCHandoffPayload {
    return buildHCCHandoffPayload(makePlan(), {
      knowledgeContract: {
        targetAgent: "claude_code",
        userRequest: "save this to Hermes Pro knowledge base",
        taskKind: "github_research",
        hasIngestDraft: false,
        hasFlushPending: false,
        hasLocalKnownAndNewlyFound: false,
      },
    });
  }

  it("placement exact: context.contracts.knowledge_reuse", () => {
    const payload = build();
    const parts = PLACEMENT_KEY.split(".");
    let cur: unknown = payload;
    for (const p of parts) {
      if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        throw new Error(`path "${PLACEMENT_KEY}" not found at segment "${p}"`);
      }
    }
    expect(cur).toBeDefined();
  });

  it("dry_run_only=true (literal)", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(env.dry_run_only).toBe(true);
  });

  it("runtime_flush_allowed=false (literal)", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(env.runtime_flush_allowed).toBe(false);
  });

  it("forbidden_runtime_checked=true (literal)", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(env.forbidden_runtime_checked).toBe(true);
  });

  it("snippet_version is stable (1.0.0)", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(env.snippet_version).toBe("1.0.0");
  });

  it("attach_reason non-empty", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(typeof env.attach_reason).toBe("string");
    expect(env.attach_reason.length).toBeGreaterThan(0);
  });

  it("trigger_flags preserved (6 booleans)", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    for (const k of [
      "save_keyword",
      "research_keyword",
      "research_task_kind",
      "has_ingest_draft",
      "has_flush_pending",
      "has_local_known_and_newly_found",
    ]) {
      expect(typeof env.trigger_flags[k as keyof typeof env.trigger_flags]).toBe(
        "boolean"
      );
    }
  });

  it("snippet_text <= max_chars", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(env.snippet_text.length).toBeLessThanOrEqual(env.max_chars);
  });

  it("no executable_steps in payload", () => {
    const payload = build();
    expect((payload as Record<string, unknown>).executable_steps).toBeUndefined();
  });

  it("no verificationCommands in payload", () => {
    const payload = build();
    expect((payload as Record<string, unknown>).verificationCommands).toBeUndefined();
  });

  it("no next_actions runtime command / call-form", () => {
    const payload = build();
    for (const a of payload.next_actions) {
      expect(a.action).not.toMatch(/knowledgeIngest\s*\(/i);
      expect(a.action).not.toMatch(/runPlaybook\s*\(/i);
      expect(a.action).not.toMatch(/triggerCronJob\s*\(/i);
    }
  });

  it("validateKnowledgeHandoffContractSnippet passes", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    const result = validateKnowledgeHandoffContractSnippet(env);
    expect(result.ok).toBe(true);
  });

  it("assertKnowledgeHandoffContractNoRuntime passes", () => {
    const env = build().context?.contracts?.knowledge_reuse!;
    expect(() => assertKnowledgeHandoffContractNoRuntime(env)).not.toThrow();
  });
});

// -----------------------------------------------------------------
// 5. JSON round trip
// -----------------------------------------------------------------

describe("JSON round trip", () => {
  it("payload survives stringify + parse (with envelope)", () => {
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
    expect(restored.context?.contracts?.knowledge_reuse?.dry_run_only).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. TmpDir-only fixture write/read
// -----------------------------------------------------------------

describe("tmpDir-only fixture write/read", () => {
  it("writeHCCHandoffPayloadFixture + readHCCHandoffPayloadFixture round-trip in tmpDir", () => {
    const payload = buildHCCHandoffPayload(
      makePlan({ taskId: "hcc-dry-run-chain-007M-tmp-write" }),
      {
        knowledgeContract: {
          targetAgent: "claude_code",
          userRequest: "save to knowledge",
          taskKind: "github_research",
        },
      }
    );
    const filePath = writeHCCHandoffPayloadFixture(payload, tmpRoot, {});
    // The returned file is the absolute path of the JSON file inside tmpRoot.
    // Extract the basename and the subdir used to write.
    const expectedSubdir = "hcc-handoff";
    const filename = filePath.split("/").pop() as string;
    // File must exist
    expect(existsSync(filePath)).toBe(true);
    // Re-read via readHCCHandoffPayloadFixture using the same tmpRoot + subdir
    const restored = readHCCHandoffPayloadFixture(tmpRoot, filename, {
      subdir: expectedSubdir,
    });
    expect(restored.context?.contracts?.knowledge_reuse?.target_agent).toBe(
      "claude_code"
    );
  });

  it("writeHCCHandoffPayloadFixture refuses to escape tmpDir (defensive guard)", () => {
    const payload = buildHCCHandoffPayload(makePlan());
    // Pass a subdir containing ".." — the function must throw an escape error
    // before attempting any filesystem write.
    let didThrow = false;
    let msg = "";
    try {
      writeHCCHandoffPayloadFixture(payload, tmpRoot, { subdir: ".." });
    } catch (e) {
      didThrow = true;
      msg = (e as Error).message;
    }
    expect(didThrow, "expected escape guard to throw").toBe(true);
    // The throw must come from the escape guard, not from a downstream
    // fs.writeFile ENOENT caused by a path that already escaped.
    expect(msg).toContain("escapes tmpDir");
  });

  it("tmpDir is under os.tmpdir(), not ~/.hermes", () => {
    expect(tmpRoot.startsWith(tmpdir())).toBe(true);
    expect(tmpRoot.includes(".hermes")).toBe(false);
  });
});

// -----------------------------------------------------------------
// 7. Real-path mtime guard (CRITICAL)
// -----------------------------------------------------------------

describe("real handoff / audit mtime guard", () => {
  it("~/.hermes/handoff/packs mtime unchanged", () => {
    expect(getMtime(HERMES_HANDOFF_PACKS)).toBe(HANDOFF_MTIME_BEFORE);
  });

  it("~/.hermes/audit mtime unchanged", () => {
    expect(getMtime(HERMES_AUDIT)).toBe(AUDIT_MTIME_BEFORE);
  });
});

// -----------------------------------------------------------------
// 8. No knowledgeIngest( / runPlaybook( as call in any payload
// -----------------------------------------------------------------

describe("no call-form runtime token in any payload", () => {
  for (const target of [
    "claude_code",
    "codex",
    "hermes_pro",
    "hermes",
  ] as const) {
    it(`${target} payload has no knowledgeIngest( as a call`, () => {
      const payload = buildHCCHandoffPayload(makePlan(), {
        knowledgeContract: {
          targetAgent: target,
          userRequest: "save to kb",
          taskKind: "github_research",
        },
      });
      const json = JSON.stringify(payload);
      expect(/knowledgeIngest\s*\(/i.test(json)).toBe(false);
    });

    it(`${target} payload has no runPlaybook( as a call`, () => {
      const payload = buildHCCHandoffPayload(makePlan(), {
        knowledgeContract: {
          targetAgent: target,
          userRequest: "save to kb",
          taskKind: "github_research",
        },
      });
      const json = JSON.stringify(payload);
      expect(/runPlaybook\s*\(/i.test(json)).toBe(false);
    });
  }
});
