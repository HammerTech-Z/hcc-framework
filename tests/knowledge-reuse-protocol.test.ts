import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildKnowledgeIngestDraft,
  buildKnowledgeReusePlan,
  classifyKnowledgeSource,
  assertKnowledgeDoesNotModifyRoadmap,
  STALE_PLAN_PATTERNS,
  RESEARCH_STEP_ORDER,
  type KnowledgeIngestDraft,
  type KnowledgeFinding,
} from "../src/shared/lib/knowledge-reuse-protocol";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-reuse-protocol.ts"
);

function makeFinding(overrides: Partial<KnowledgeFinding> = {}): KnowledgeFinding {
  return {
    source_type: "vault",
    source_uri: "vault://notes/foo.md",
    finding: "vault has a note about foo",
    fetched_at: "2026-06-01T00:00:00.000Z",
    trust_level: "semi_trusted_local",
    ...overrides,
  };
}

function makeMinimalDraft(
  overrides: Partial<Parameters<typeof buildKnowledgeIngestDraft>[0]> = {}
): Parameters<typeof buildKnowledgeIngestDraft>[0] {
  return {
    title: "Foo vs Bar",
    summary: "Comparison of foo and bar libraries.",
    local_findings: [
      makeFinding({
        source_type: "vault",
        source_uri: "vault://notes/foo.md",
        finding: "vault says foo is faster",
      }),
    ],
    web_findings: [
      makeFinding({
        source_type: "github",
        source_uri: "https://github.com/example/bar",
        finding: "bar has 10k stars",
        trust_level: "untrusted_external",
        fetched_at: "2026-06-01T12:00:00.000Z",
      }),
    ],
    retrieval_keywords: ["Foo", "foo", "Bar", "comparison"],
    ...overrides,
  };
}

// -----------------------------------------------------------------
// 1. github_research default step order
// -----------------------------------------------------------------

describe("buildKnowledgeReusePlan", () => {
  it("emits the canonical step order for github_research", () => {
    const plan = buildKnowledgeReusePlan({
      task_kind: "github_research",
      query: "compare repo A vs repo B",
      local_lookup_done: true,
    });
    expect(plan.steps.map((s) => s.id)).toEqual([...RESEARCH_STEP_ORDER]);
    expect(plan.steps.map((s) => s.id)).toEqual([
      "local_plan",
      "knowledge_search",
      "vault_gbrain",
      "web_github",
      "answer",
      "optional_ingest_draft",
    ]);
    expect(plan.task_kind).toBe("github_research");
    expect(plan.local_lookup_done).toBe(true);
    expect(plan.local_lookup_skip_reason).toBeNull();
    expect(plan.steps.find((s) => s.id === "optional_ingest_draft")?.required).toBe(false);
    expect(plan.steps.find((s) => s.id === "local_plan")?.required).toBe(true);
  });

  it("uses the same order for tool_comparison and technical_selection", () => {
    for (const kind of [
      "tool_comparison",
      "technical_selection",
      "project_research",
      "general_research",
    ] as const) {
      const plan = buildKnowledgeReusePlan({
        task_kind: kind,
        query: "x",
        local_lookup_done: false,
        local_lookup_skip_reason: "no time",
      });
      expect(plan.steps.map((s) => s.id)).toEqual([...RESEARCH_STEP_ORDER]);
      expect(plan.local_lookup_done).toBe(false);
      expect(plan.local_lookup_skip_reason).toBe("no time");
    }
  });

  it("forces a non-empty skip reason when local_lookup_done is false", () => {
    const plan = buildKnowledgeReusePlan({
      task_kind: "general_research",
      query: "x",
      local_lookup_done: false,
    });
    expect(plan.local_lookup_skip_reason).toBeTruthy();
  });
});

// -----------------------------------------------------------------
// 2. ingest draft contains required fields
// -----------------------------------------------------------------

describe("buildKnowledgeIngestDraft", () => {
  it("includes title / summary / sources / provenance / trust_level / retrieval_keywords", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraft());
    expect(draft.title).toBe("Foo vs Bar");
    expect(draft.summary.length).toBeGreaterThan(0);
    expect(draft.sources.length).toBe(2);
    expect(draft.provenance).toBeDefined();
    expect(draft.provenance.source_type).toBe("vault");
    expect(draft.provenance.source_uri).toBe("vault://notes/foo.md");
    expect(draft.trust_level).toBeDefined();
    expect(draft.retrieval_keywords).toEqual(["foo", "bar", "comparison"]);
  });

  it("preserves split between local_findings and web_findings", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraft());
    expect(draft.local_findings).toHaveLength(1);
    expect(draft.web_findings).toHaveLength(1);
    expect(draft.local_findings[0].source_type).toBe("vault");
    expect(draft.web_findings[0].source_type).toBe("github");
  });
});

// -----------------------------------------------------------------
// 3. roadmap_change_allowed is always false
// -----------------------------------------------------------------

describe("roadmap_change_allowed invariant", () => {
  it("is false on a fresh draft", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraft());
    expect(draft.roadmap_change_allowed).toBe(false);
  });

  it("stays false even when trusted_user_confirmed is true", () => {
    const draft = buildKnowledgeIngestDraft(
      makeMinimalDraft({ trusted_user_confirmed: true })
    );
    expect(draft.roadmap_change_allowed).toBe(false);
    expect(draft.user_authorized_flush).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. safe_to_use_as_instruction default false
// -----------------------------------------------------------------

describe("safe_to_use_as_instruction", () => {
  it("defaults to false", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraft());
    expect(draft.safe_to_use_as_instruction).toBe(false);
  });

  it("flips to true only with trusted_user_confirmed", () => {
    const draft = buildKnowledgeIngestDraft(
      makeMinimalDraft({ trusted_user_confirmed: true })
    );
    expect(draft.safe_to_use_as_instruction).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. local vs web bucket separation
// -----------------------------------------------------------------

describe("classifyKnowledgeSource — local vs external", () => {
  it("buckets local sources as local", () => {
    for (const source_type of [
      "local_plan",
      "knowledge_search",
      "vault",
      "gbrain_typed_link",
      "user_supplied",
    ] as const) {
      const c = classifyKnowledgeSource({
        source_type,
        source_uri: "vault://x.md",
        fetched_at: "2026-06-01T00:00:00.000Z",
      });
      expect(c.bucket).toBe("local");
    }
  });

  it("buckets external sources as external", () => {
    for (const source_type of ["web", "github"] as const) {
      const c = classifyKnowledgeSource({
        source_type,
        source_uri: "https://example.com",
        fetched_at: "2026-06-01T00:00:00.000Z",
      });
      expect(c.bucket).toBe("external");
    }
  });
});

// -----------------------------------------------------------------
// 6. stale plan paths
// -----------------------------------------------------------------

describe("stale plan paths are flagged", () => {
  it.each(STALE_PLAN_PATTERNS)(
    "flags %s as do_not_use_as_current_truth when source_type is local_plan",
    (pattern) => {
      const c = classifyKnowledgeSource({
        source_type: "local_plan",
        source_uri: pattern,
      });
      expect(c.do_not_use_as_current_truth).toBe(true);
      expect(c.trust_level).toBe("untrusted_external");
    }
  );

  it("does not flag a fresh local plan path", () => {
    const c = classifyKnowledgeSource({
      source_type: "local_plan",
      source_uri: "docs/current-fusion-plan-2026-05-30.md",
    });
    expect(c.do_not_use_as_current_truth).toBe(false);
    expect(c.trust_level).toBe("trusted_verified");
  });
});

// -----------------------------------------------------------------
// 7. assertKnowledgeDoesNotModifyRoadmap
// -----------------------------------------------------------------

describe("assertKnowledgeDoesNotModifyRoadmap", () => {
  it("rejects mutation of a locked roadmap target", () => {
    expect(() =>
      assertKnowledgeDoesNotModifyRoadmap({
        target: "docs/roadmap-locked-2026-05-28.md",
        is_locked_roadmap: true,
        mutation: "edit",
      })
    ).toThrow(/locked-roadmap registry/);
  });

  it("rejects ingest_draft that fails the safe-draft invariant", () => {
    const badDraft: KnowledgeIngestDraft = {
      ...buildKnowledgeIngestDraft(makeMinimalDraft()),
      // Simulate a tampered draft (this should never happen in real code,
      // but the guard must reject it).
      // @ts-expect-error -- intentionally bad to test the guard
      roadmap_change_allowed: true,
    };
    expect(() =>
      assertKnowledgeDoesNotModifyRoadmap({
        target: "docs/notes/foo.md",
        is_locked_roadmap: false,
        mutation: "append",
        ingest_draft: badDraft,
      })
    ).toThrow(/roadmap_change_allowed must be false/);
  });

  it("rejects ingest_draft without user_authorized_flush", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraft());
    expect(() =>
      assertKnowledgeDoesNotModifyRoadmap({
        target: "docs/notes/foo.md",
        is_locked_roadmap: false,
        mutation: "append",
        ingest_draft: draft,
      })
    ).toThrow(/user_authorized_flush must be true/);
  });

  it("allows a non-locked target with a confirmed safe draft", () => {
    const draft = buildKnowledgeIngestDraft(
      makeMinimalDraft({ trusted_user_confirmed: true })
    );
    const res = assertKnowledgeDoesNotModifyRoadmap({
      target: "docs/notes/foo.md",
      is_locked_roadmap: false,
      mutation: "append",
      ingest_draft: draft,
    });
    expect(res.allowed).toBe(true);
  });

  it("allows a non-locked target with no ingest_draft", () => {
    const res = assertKnowledgeDoesNotModifyRoadmap({
      target: "docs/notes/foo.md",
      is_locked_roadmap: false,
      mutation: "edit",
    });
    expect(res.allowed).toBe(true);
  });
});

// -----------------------------------------------------------------
// 8. no secret / API key fields
// -----------------------------------------------------------------

describe("secret guard", () => {
  it("rejects a field literally named api_key", () => {
    expect(() =>
      buildKnowledgeIngestDraft(
        // @ts-expect-error -- intentionally bad input
        {
          title: "x",
          summary: "y",
          api_key: "sk-1234567890abcdef1234",
          local_findings: [],
          web_findings: [],
          retrieval_keywords: [],
        }
      )
    ).toThrow(/secret-like key forbidden/);
  });

  it("rejects a Bearer-shaped string", () => {
    expect(() =>
      buildKnowledgeIngestDraft({
        title: "x",
        summary: "Authorization: Bearer abcdefghijklmnop1234",
        local_findings: [],
        web_findings: [],
        retrieval_keywords: [],
      })
    ).toThrow(/Bearer-shaped string forbidden/);
  });

  it("rejects an sk- shaped key inside a finding", () => {
    expect(() =>
      buildKnowledgeIngestDraft({
        title: "x",
        summary: "y",
        local_findings: [
          {
            source_type: "vault",
            source_uri: "vault://x.md",
            finding: "leaked sk-abcdefghijklmnop1234",
            fetched_at: null,
            trust_level: "semi_trusted_local",
          },
        ],
        web_findings: [],
        retrieval_keywords: [],
      })
    ).toThrow(/sk- shaped key forbidden/);
  });
});

// -----------------------------------------------------------------
// 9. source file must not contain forbidden runtime call names
// -----------------------------------------------------------------

describe("source code self-check", () => {
  it("does not import or call forbidden runtime APIs", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    // The substring "fetch" appears in field names like "fetched_at" — those are not
    // runtime calls. Strip comments first, then strip obvious field-name occurrences.
    const code = src
      .replace(/\/\/[^\n]*/g, "") // strip line comments
      .replace(/\/\*[\s\S]*?\*\//g, ""); // strip block comments
    const forbiddenTokens: Array<{ needle: string; regex: RegExp }> = [
      { needle: "fetch", regex: /(?<![A-Za-z0-9_])fetch(?![A-Za-z0-9_])/g },
      { needle: "axios", regex: /(?<![A-Za-z0-9_])axios(?![A-Za-z0-9_])/g },
      { needle: "child_process", regex: /child_process/g },
      { needle: "ipcMain", regex: /ipcMain/g },
      { needle: "knowledgeIngest(", regex: /knowledgeIngest\s*\(/g },
      { needle: "knowledgeSearch(", regex: /knowledgeSearch\s*\(/g },
      { needle: "runPlaybook", regex: /runPlaybook/g },
      { needle: "sendMessage", regex: /sendMessage/g },
      { needle: "triggerCronJob", regex: /triggerCronJob/g },
    ];
    for (const { needle, regex } of forbiddenTokens) {
      const hit = code.match(regex);
      expect(hit, `source must not contain token: ${needle}`).toBeNull();
    }
  });
});

// -----------------------------------------------------------------
// 10. JSON round-trip
// -----------------------------------------------------------------

describe("JSON round-trip", () => {
  it("draft survives JSON.stringify + JSON.parse", () => {
    const draft = buildKnowledgeIngestDraft(
      makeMinimalDraft({ trusted_user_confirmed: true })
    );
    const json = JSON.stringify(draft);
    const restored: KnowledgeIngestDraft = JSON.parse(json);
    expect(restored).toEqual(draft);
    expect(restored.roadmap_change_allowed).toBe(false);
    expect(restored.safe_to_use_as_instruction).toBe(true);
    expect(restored.user_authorized_flush).toBe(true);
    expect(restored.retrieval_keywords).toEqual(["foo", "bar", "comparison"]);
  });

  it("plan survives JSON.stringify + JSON.parse", () => {
    const plan = buildKnowledgeReusePlan({
      task_kind: "tool_comparison",
      query: "x",
      local_lookup_done: false,
      local_lookup_skip_reason: "skipped",
    });
    const restored = JSON.parse(JSON.stringify(plan));
    expect(restored).toEqual(plan);
  });
});
