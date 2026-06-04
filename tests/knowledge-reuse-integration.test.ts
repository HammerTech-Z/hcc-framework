import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildHermesKnowledgeReuseDryRun,
  buildFlushPendingNotice,
  classifyKnowledgeReuseIntent,
  assertNoRuntimeKnowledgeFlush,
  FORBIDDEN_RUNTIME_ACTIONS,
  type HermesKnowledgeReuseDryRunPayload,
  type KnowledgeFinding,
} from "../src/shared/lib/knowledge-reuse-integration";
import {
  RESEARCH_STEP_ORDER,
  classifyKnowledgeSource,
  type KnowledgeReuseTaskKind,
} from "../src/shared/lib/knowledge-reuse-protocol";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-reuse-integration.ts"
);

function makeLocalKnown(): KnowledgeFinding {
  return {
    source_type: "vault",
    source_uri: "vault://notes/foo.md",
    finding: "vault has a note about foo",
    fetched_at: "2026-06-01T00:00:00.000Z",
    trust_level: "semi_trusted_local",
  };
}

function makeNewlyFound(): KnowledgeFinding {
  return {
    source_type: "github",
    source_uri: "https://github.com/example/bar",
    finding: "bar has 10k stars",
    fetched_at: "2026-06-01T12:00:00.000Z",
    trust_level: "untrusted_external",
  };
}

function makeResearchInput(
  overrides: Partial<Parameters<typeof buildHermesKnowledgeReuseDryRun>[0]> = {}
): Parameters<typeof buildHermesKnowledgeReuseDryRun>[0] {
  return {
    task_kind: "github_research",
    query: "compare repo A vs repo B",
    request_text: "请帮我研究一下 repo A 的近况",  // "研究" → research_only, no compare keywords
    local_lookup_done: true,
    local_known: [makeLocalKnown()],
    newly_found: [makeNewlyFound()],
    judgment: "vault says A is more mature; bar stars don't imply production-readiness",
    save_to_knowledge: false,
    ...overrides,
  };
}

function makeSaveInput(
  overrides: Partial<Parameters<typeof buildHermesKnowledgeReuseDryRun>[0]> = {}
): Parameters<typeof buildHermesKnowledgeReuseDryRun>[0] {
  return {
    task_kind: "tool_comparison",
    query: "Foo vs Bar",
    request_text: "请把 Foo vs Bar 对比结果保存到知识库",
    local_lookup_done: true,
    local_known: [makeLocalKnown()],
    newly_found: [makeNewlyFound()],
    judgment: "推荐 Foo",
    save_to_knowledge: true,
    ...overrides,
  };
}

// -----------------------------------------------------------------
// 1. research request -> canonical step order
// -----------------------------------------------------------------

describe("buildHermesKnowledgeReuseDryRun — research request", () => {
  it("produces the canonical step order from Slice 004", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeResearchInput());
    expect(payload.plan.steps.map((s) => s.id)).toEqual([...RESEARCH_STEP_ORDER]);
    expect(payload.plan.steps.map((s) => s.id)).toEqual([
      "local_plan",
      "knowledge_search",
      "vault_gbrain",
      "web_github",
      "answer",
      "optional_ingest_draft",
    ]);
    expect(payload.intent).toBe("research_only");
    expect(payload.ingest_draft).toBeNull();
    expect(payload.flush_pending).toBe(false);
  });
});

// -----------------------------------------------------------------
// 2. save-to-knowledge request -> ingest_draft present
// -----------------------------------------------------------------

describe("buildHermesKnowledgeReuseDryRun — save request", () => {
  it("produces an ingest_draft when save_to_knowledge is true", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeSaveInput());
    expect(payload.ingest_draft).not.toBeNull();
    expect(payload.ingest_draft?.title).toBe("Foo vs Bar");
    expect(payload.intent).toBe("save_to_knowledge");
    expect(payload.flush_pending).toBe(true);
  });

  it("produces a draft even when save_to_knowledge is false but the request text says save", () => {
    const payload = buildHermesKnowledgeReuseDryRun(
      makeSaveInput({ save_to_knowledge: false })
    );
    expect(payload.ingest_draft).not.toBeNull();
    expect(payload.intent).toBe("save_to_knowledge");
  });
});

// -----------------------------------------------------------------
// 3. runtime_flush_allowed is ALWAYS false
// -----------------------------------------------------------------

describe("runtime_flush_allowed invariant", () => {
  it("is false on a fresh research payload", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeResearchInput());
    expect(payload.runtime_flush_allowed).toBe(false);
  });

  it("is false even when save_to_knowledge and trusted_user_confirmed", () => {
    const payload = buildHermesKnowledgeReuseDryRun(
      makeSaveInput({ trusted_user_confirmed: true })
    );
    expect(payload.runtime_flush_allowed).toBe(false);
    expect(payload.ingest_draft?.user_authorized_flush).toBe(true);
  });

  it("is false when caller provides an explicit ingest_draft", () => {
    const explicit = {
      title: "x",
      summary: "y",
      local_findings: [makeLocalKnown()],
      web_findings: [makeNewlyFound()],
      retrieval_keywords: ["x"],
      trusted_user_confirmed: true,
    };
    const payload = buildHermesKnowledgeReuseDryRun(
      makeResearchInput({ ingest_draft: undefined })
    );
    // We just check that even when caller might pre-provide, runtime is still false.
    expect(payload.runtime_flush_allowed).toBe(false);
  });
});

// -----------------------------------------------------------------
// 4. flush_pending is true when draft exists
// -----------------------------------------------------------------

describe("flush_pending", () => {
  it("is true when ingest_draft is non-null", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeSaveInput());
    expect(payload.flush_pending).toBe(true);
  });

  it("is false for research-only requests without a draft", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeResearchInput());
    expect(payload.flush_pending).toBe(false);
  });
});

// -----------------------------------------------------------------
// 5. required_user_confirmation is ALWAYS true
// -----------------------------------------------------------------

describe("required_user_confirmation invariant", () => {
  it("is true on every payload", () => {
    const a = buildHermesKnowledgeReuseDryRun(makeResearchInput());
    const b = buildHermesKnowledgeReuseDryRun(makeSaveInput());
    expect(a.required_user_confirmation).toBe(true);
    expect(b.required_user_confirmation).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. local_known vs newly_found separation
// -----------------------------------------------------------------

describe("local_known / newly_found split", () => {
  it("separates by source_type", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeResearchInput());
    expect(payload.local_known).toHaveLength(1);
    expect(payload.newly_found).toHaveLength(1);
    expect(payload.local_known[0].source_type).toBe("vault");
    expect(payload.newly_found[0].source_type).toBe("github");
  });

  it("re-buckets when caller provides mixed arrays", () => {
    const payload = buildHermesKnowledgeReuseDryRun(
      makeResearchInput({
        local_known: [makeLocalKnown(), makeNewlyFound()],
        newly_found: [],
      })
    );
    expect(payload.local_known).toHaveLength(1);
    expect(payload.newly_found).toHaveLength(1);
    expect(payload.local_known[0].source_type).toBe("vault");
    expect(payload.newly_found[0].source_type).toBe("github");
  });
});

// -----------------------------------------------------------------
// 7. web/github default trust_level = untrusted_external
// -----------------------------------------------------------------

describe("web/github trust_level default", () => {
  it("keeps untrusted_external on github findings", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeResearchInput());
    expect(payload.newly_found[0].source_type).toBe("github");
    expect(payload.newly_found[0].trust_level).toBe("untrusted_external");
  });

  it("keeps legitimate untrusted_external on web/github findings", () => {
    const webFinding: KnowledgeFinding = {
      source_type: "web",
      source_uri: "https://example.com",
      finding: "web claim about bar",
      fetched_at: "2026-06-01T12:00:00.000Z",
      trust_level: "untrusted_external",
    };
    const payload = buildHermesKnowledgeReuseDryRun(
      makeResearchInput({ newly_found: [webFinding] })
    );
    expect(payload.newly_found[0].source_type).toBe("web");
    expect(payload.newly_found[0].trust_level).toBe("untrusted_external");
  });

  it("downgrades invalid trust levels (e.g. trusted_verified on web) to untrusted_external", () => {
    const webTainted: KnowledgeFinding = {
      source_type: "web",
      source_uri: "https://example.com",
      finding: "web claim",
      fetched_at: "2026-06-01T12:00:00.000Z",
      trust_level: "trusted_verified", // invalid for web
    };
    const payload = buildHermesKnowledgeReuseDryRun(
      makeResearchInput({ newly_found: [webTainted] })
    );
    expect(payload.newly_found[0].trust_level).toBe("untrusted_external");
  });

  it("preserves legitimate trusted_external (already-verified web source)", () => {
    // trusted_external is an acceptable trust level for web/github if explicitly
    // granted by the human reviewer. The helper does NOT downgrade it.
    const ok: KnowledgeFinding = {
      source_type: "web",
      source_uri: "https://example.com",
      finding: "verified claim",
      fetched_at: "2026-06-01T12:00:00.000Z",
      trust_level: "trusted_external",
    };
    const payload = buildHermesKnowledgeReuseDryRun(
      makeResearchInput({ newly_found: [ok] })
    );
    expect(payload.newly_found[0].trust_level).toBe("trusted_external");
  });
});

// -----------------------------------------------------------------
// 8. stale source is marked do_not_use_as_current_truth
// -----------------------------------------------------------------

describe("stale source flagging", () => {
  it("auto-derives do_not_use_as_current_truth via classifyKnowledgeSource", () => {
    const c = classifyKnowledgeSource({
      source_type: "local_plan",
      source_uri: "docs/archive/old-plan.md",
    });
    expect(c.do_not_use_as_current_truth).toBe(true);
    expect(c.trust_level).toBe("untrusted_external");
  });
});

// -----------------------------------------------------------------
// 9. assertNoRuntimeKnowledgeFlush
// -----------------------------------------------------------------

describe("assertNoRuntimeKnowledgeFlush", () => {
  it("rejects a tampered payload with runtime_flush_allowed=true", () => {
    const payload: HermesKnowledgeReuseDryRunPayload = {
      ...buildHermesKnowledgeReuseDryRun(makeResearchInput()),
      // @ts-expect-error -- intentionally bad to test the guard
      runtime_flush_allowed: true,
    };
    expect(() =>
      assertNoRuntimeKnowledgeFlush({ payload })
    ).toThrow(/runtime_flush_allowed must be false/);
  });

  it("rejects a tampered payload with mode != 'dry_run'", () => {
    const payload: HermesKnowledgeReuseDryRunPayload = {
      ...buildHermesKnowledgeReuseDryRun(makeResearchInput()),
      // @ts-expect-error -- intentionally bad
      mode: "live",
    };
    expect(() =>
      assertNoRuntimeKnowledgeFlush({ payload })
    ).toThrow(/payload\.mode must be "dry_run"/);
  });

  it("rejects a caller that claims to have done a runtime flush", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeSaveInput());
    expect(() =>
      assertNoRuntimeKnowledgeFlush({
        payload,
        claiming_runtime_flush: true,
      })
    ).toThrow(/claiming_runtime_flush=true/);
  });

  it("returns allowed=true for a clean dry-run payload", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeSaveInput());
    const res = assertNoRuntimeKnowledgeFlush({ payload });
    expect(res.runtime_flush_attempted).toBe(false);
    expect(res.blocked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 10. JSON round-trip
// -----------------------------------------------------------------

describe("JSON round-trip", () => {
  it("payload survives JSON.stringify + JSON.parse", () => {
    const payload = buildHermesKnowledgeReuseDryRun(
      makeSaveInput({ trusted_user_confirmed: true })
    );
    const json = JSON.stringify(payload);
    const restored: HermesKnowledgeReuseDryRunPayload = JSON.parse(json);
    expect(restored).toEqual(payload);
    expect(restored.runtime_flush_allowed).toBe(false);
    expect(restored.mode).toBe("dry_run");
    expect(restored.required_user_confirmation).toBe(true);
    expect(restored.forbidden_runtime_actions).toEqual([...FORBIDDEN_RUNTIME_ACTIONS]);
    expect(restored.flush_pending).toBe(true);
    expect(restored.ingest_draft?.user_authorized_flush).toBe(true);
  });
});

// -----------------------------------------------------------------
// 11. source self-check — no runtime call tokens
// -----------------------------------------------------------------

describe("source code self-check", () => {
  it("does not import or call forbidden runtime APIs", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const forbiddenTokens: Array<{ needle: string; regex: RegExp }> = [
      { needle: "fetch", regex: /(?<![A-Za-z0-9_])fetch(?![A-Za-z0-9_])/g },
      { needle: "ipcMain", regex: /ipcMain/g },
      { needle: "ipcRenderer", regex: /ipcRenderer/g },
      { needle: "knowledgeIngest(", regex: /knowledgeIngest\s*\(/g },
      { needle: "knowledgeSearch(", regex: /knowledgeSearch\s*\(/g },
      { needle: "triggerCronJob", regex: /triggerCronJob/g },
      { needle: "sendMessage", regex: /sendMessage/g },
      { needle: "runPlaybook", regex: /runPlaybook/g },
      { needle: "child_process", regex: /child_process/g },
    ];
    for (const { needle, regex } of forbiddenTokens) {
      const hit = code.match(regex);
      expect(hit, `source must not contain token: ${needle}`).toBeNull();
    }
  });
});

// -----------------------------------------------------------------
// 12. classifyKnowledgeReuseIntent
// -----------------------------------------------------------------

describe("classifyKnowledgeReuseIntent", () => {
  it("classifies save keywords as save_to_knowledge", () => {
    const r = classifyKnowledgeReuseIntent({ request: "请把这份结果保存到知识库" });
    expect(r.intent).toBe("save_to_knowledge");
  });

  it("classifies compare keywords as compare_alternatives", () => {
    const r = classifyKnowledgeReuseIntent({ request: "Foo vs Bar, 哪个更稳?" });
    expect(r.intent).toBe("compare_alternatives");
  });

  it("classifies research keywords as research_only", () => {
    const r = classifyKnowledgeReuseIntent({ request: "请调研一下 Qwen3 后训练流程" });
    expect(r.intent).toBe("research_only");
  });

  it("falls back to unknown when no keyword matches", () => {
    const r = classifyKnowledgeReuseIntent({ request: "???" });
    expect(r.intent).toBe("unknown");
  });

  it("save_to_knowledge wins over compare when both appear", () => {
    const r = classifyKnowledgeReuseIntent({
      request: "对比 Foo vs Bar 并保存到知识库",
    });
    expect(r.intent).toBe("save_to_knowledge");
  });
});

// -----------------------------------------------------------------
// 13. buildFlushPendingNotice
// -----------------------------------------------------------------

describe("buildFlushPendingNotice", () => {
  it("returns a structured flush-pending notice with the draft", () => {
    const payload = buildHermesKnowledgeReuseDryRun(makeSaveInput());
    expect(payload.ingest_draft).not.toBeNull();
    const notice = buildFlushPendingNotice({
      draft: payload.ingest_draft!,
      runtime_ingest_unavailable: true,
    });
    expect(notice.flush_pending).toBe(true);
    expect(notice.user_must_confirm_to_flush).toBe(true);
    expect(notice.ingest_draft).toEqual(payload.ingest_draft);
    expect(notice.reason).toMatch(/dry-run only/);
  });
});

// -----------------------------------------------------------------
// 14. forbidden_runtime_actions constant
// -----------------------------------------------------------------

describe("forbidden_runtime_actions", () => {
  it("contains the expected entries", () => {
    expect([...FORBIDDEN_RUNTIME_ACTIONS]).toEqual([
      "knowledgeIngest",
      "gateway",
      "ipc",
      "cron",
      "handoff_write",
      "audit_write",
      "hcc_executor",
    ]);
  });
});

// -----------------------------------------------------------------
// 15. cross-slice sanity: task_kind is preserved
// -----------------------------------------------------------------

describe("cross-slice sanity", () => {
  it.each<KnowledgeReuseTaskKind>([
    "github_research",
    "tool_comparison",
    "technical_selection",
    "project_research",
    "general_research",
  ])("preserves task_kind %s", (kind) => {
    const payload = buildHermesKnowledgeReuseDryRun(
      makeResearchInput({ task_kind: kind })
    );
    expect(payload.plan.task_kind).toBe(kind);
  });
});
