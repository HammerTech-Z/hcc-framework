import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildPendingLiveFlushRequest,
  buildHermesKnowledgeFrontmatter,
  classifyLiveFlushFailure,
  assertLiveFlushStillDryRun,
  HERMES_MANAGED_KNOWLEDGE_STORE,
  CREATED_BY_LITERAL,
  NEXT_REQUIRED_APPROVAL_LITERAL,
  REQUIRED_FRONTMATTER_FIELDS,
  type LiveFlushRequest,
  type LiveFlushFailureCode,
} from "../src/shared/lib/knowledge-live-flush-contract";
import {
  buildKnowledgeIngestDraft,
  type KnowledgeFinding,
  type KnowledgeIngestDraft,
} from "../src/shared/lib/knowledge-reuse-protocol";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-live-flush-contract.ts"
);
const GOLDEN_FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/github-research-save-dry-run.json"
);

const goldenFixture = JSON.parse(readFileSync(GOLDEN_FIXTURE_PATH, "utf8"));

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

function makeLiveFindings(): KnowledgeFinding[] {
  return [
    {
      source_type: "vault",
      source_uri: "vault://wiki/foo.md",
      finding: "vault note about foo",
      fetched_at: "2026-06-03T00:00:00+08:00",
      trust_level: "semi_trusted_local",
    },
    {
      source_type: "github",
      source_uri: "https://github.com/example/bar",
      finding: "bar has 10k stars",
      fetched_at: "2026-06-03T00:00:00+08:00",
      trust_level: "untrusted_external",
    },
    {
      source_type: "local_plan",
      source_uri: "/Users/x/Desktop/知识/过时计划/old.md",
      finding: "stale",
      fetched_at: "2026-05-20T00:00:00+08:00",
      trust_level: "untrusted_external",
      do_not_use_as_current_truth: true,
    },
  ];
}

function makeDraft(): KnowledgeIngestDraft {
  return buildKnowledgeIngestDraft({
    title: "Foo vs Bar",
    summary: "Comparison.",
    local_findings: [makeLiveFindings()[0], makeLiveFindings()[2]],
    web_findings: [makeLiveFindings()[1]],
    retrieval_keywords: ["foo", "bar"],
    trusted_user_confirmed: true,
  });
}

function makeRequest(overrides: Partial<LiveFlushRequest> = {}): LiveFlushRequest {
  return buildPendingLiveFlushRequest({
    ingest_draft: makeDraft(),
    draft_id: "01JABCDEF1234567890ABCDEF",
    dry_run_artifact_ref: "tests/fixtures/knowledge-reuse/github-research-save-dry-run.json",
    user_confirmation: {
      confirmed_in_session: true,
      confirmed_at: "2026-06-03T10:00:00.000Z",
      confirmation_phrase: "我授权 flush",
    },
    source_fidelity_result: { ok: true, issues: [] },
    bucket_semantics_result: { ok: true, issues: [] },
    roadmap_guard_result: { allowed: true, reason: "non-locked target" },
    ...overrides,
  });
}

// -----------------------------------------------------------------
// 1. buildPendingLiveFlushRequest fields
// -----------------------------------------------------------------

describe("buildPendingLiveFlushRequest — fields", () => {
  it("emits all 14 required fields with correct types", () => {
    const req = makeRequest();
    expect(req.schema_version).toBe("1.0.0");
    expect(req.mode).toBe("pending_live_flush");
    expect(typeof req.created_at).toBe("string");
    expect(req.draft_id).toBe("01JABCDEF1234567890ABCDEF");
    expect(req.user_confirmation.confirmed_in_session).toBe(true);
    expect(req.user_confirmation.confirmation_phrase).toBe("我授权 flush");
    expect(req.ingest_draft.title).toBe("Foo vs Bar");
    expect(req.source_fidelity_result.ok).toBe(true);
    expect(req.bucket_semantics_result.ok).toBe(true);
    expect(req.roadmap_guard_result.allowed).toBe(true);
    expect(req.target_store).toBe(HERMES_MANAGED_KNOWLEDGE_STORE);
    expect(req.runtime_adapter_required).toBe(true);
    expect(req.runtime_flush_allowed).toBe(false);
    expect(req.dry_run_artifact_ref).toContain("github-research-save-dry-run.json");
    expect(req.next_required_approval).toBe(NEXT_REQUIRED_APPROVAL_LITERAL);
  });

  it("runtime_flush_allowed is always false", () => {
    expect(makeRequest().runtime_flush_allowed).toBe(false);
  });

  it("runtime_adapter_required is always true", () => {
    expect(makeRequest().runtime_adapter_required).toBe(true);
  });

  it("target_store is always hermes_managed_knowledge_store", () => {
    expect(makeRequest().target_store).toBe(HERMES_MANAGED_KNOWLEDGE_STORE);
  });

  it("next_required_approval is non-empty", () => {
    expect(makeRequest().next_required_approval.length).toBeGreaterThan(0);
  });

  it("throws when ingest_draft is missing", () => {
    expect(() =>
      buildPendingLiveFlushRequest({
        // @ts-expect-error testing guard
        ingest_draft: undefined,
        draft_id: "x",
        dry_run_artifact_ref: "x",
        user_confirmation: {
          confirmed_in_session: true,
          confirmed_at: "2026-06-03T10:00:00.000Z",
          confirmation_phrase: "我授权 flush",
        },
        source_fidelity_result: { ok: true, issues: [] },
        bucket_semantics_result: { ok: true, issues: [] },
        roadmap_guard_result: { allowed: true, reason: "x" },
      })
    ).toThrow(/ingest_draft is required/);
  });

  it("throws when roadmap_change_allowed is true", () => {
    const draft = makeDraft();
    expect(() =>
      buildPendingLiveFlushRequest({
        ingest_draft: {
          ...draft,
          // @ts-expect-error testing guard
          roadmap_change_allowed: true,
        },
        draft_id: "x",
        dry_run_artifact_ref: "x",
        user_confirmation: {
          confirmed_in_session: true,
          confirmed_at: "2026-06-03T10:00:00.000Z",
          confirmation_phrase: "我授权 flush",
        },
        source_fidelity_result: { ok: true, issues: [] },
        bucket_semantics_result: { ok: true, issues: [] },
        roadmap_guard_result: { allowed: true, reason: "x" },
      })
    ).toThrow(/roadmap_change_allowed/);
  });
});

// -----------------------------------------------------------------
// 2. buildHermesKnowledgeFrontmatter fields
// -----------------------------------------------------------------

describe("buildHermesKnowledgeFrontmatter — fields", () => {
  it("emits all 16 required frontmatter fields", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    for (const field of REQUIRED_FRONTMATTER_FIELDS) {
      expect(field in fm, `missing field: ${field}`).toBe(true);
    }
    expect(REQUIRED_FRONTMATTER_FIELDS.length).toBe(16);
  });

  it("created_by is the literal 'Hermes Pro Knowledge Reuse Adapter'", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    expect(fm.created_by).toBe(CREATED_BY_LITERAL);
  });

  it("preserves source_uri and fetched_at exactly from the first non-stale source", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    expect(fm.source_uri).toBe("vault://wiki/foo.md");
    expect(fm.fetched_at).toBe("2026-06-03T00:00:00+08:00");
    expect(fm.provenance.source_uri).toBe("vault://wiki/foo.md");
    expect(fm.provenance.fetched_at).toBe("2026-06-03T00:00:00+08:00");
  });

  it("preserves vault source_type only for vault:// URI", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    expect(fm.source_type).toBe("vault");
    expect(fm.source_uri.startsWith("vault://")).toBe(true);
  });

  it("places stale sources in stale_sources, NOT in local_findings", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    expect(fm.stale_sources.length).toBe(1);
    expect(fm.stale_sources[0].do_not_use_as_current_truth).toBe(true);
    expect(fm.stale_sources[0].source_uri).toBe(
      "/Users/x/Desktop/知识/过时计划/old.md"
    );
    // Stale finding must NOT appear in local_findings or web_findings.
    const localUris = (fm.local_findings as KnowledgeFinding[]).map(
      (f) => f.source_uri
    );
    const webUris = (fm.web_findings as KnowledgeFinding[]).map(
      (f) => f.source_uri
    );
    expect(localUris).not.toContain("/Users/x/Desktop/知识/过时计划/old.md");
    expect(webUris).not.toContain("/Users/x/Desktop/知识/过时计划/old.md");
  });

  it("preserves source_uri exactly across the round-trip to JSON", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    const json = JSON.stringify(fm);
    const restored = JSON.parse(json);
    expect(restored.source_uri).toBe(fm.source_uri);
    expect(restored.fetched_at).toBe(fm.fetched_at);
  });
});

// -----------------------------------------------------------------
// 3. classifyLiveFlushFailure — 8 codes
// -----------------------------------------------------------------

describe("classifyLiveFlushFailure — 8 codes", () => {
  const cases: Array<{
    name: string;
    code: LiveFlushFailureCode;
    request?: unknown;
  }> = [
    {
      name: "runtime_flush_forbidden",
      code: "runtime_flush_forbidden",
      // @ts-expect-error testing
      request: { runtime_flush_allowed: true },
    },
    {
      name: "runtime_adapter_not_approved",
      code: "runtime_adapter_not_approved",
      request: {
        runtime_flush_allowed: false,
        // @ts-expect-error testing
        next_required_approval: "",
      },
    },
    {
      name: "roadmap_mutation_blocked",
      code: "roadmap_mutation_blocked",
      request: {
        runtime_flush_allowed: false,
        next_required_approval: "x",
        // @ts-expect-error testing
        ingest_draft: { roadmap_change_allowed: true },
      },
    },
    {
      name: "source_fidelity_failed",
      code: "source_fidelity_failed",
      request: {
        runtime_flush_allowed: false,
        next_required_approval: "x",
        // @ts-expect-error testing
        ingest_draft: { roadmap_change_allowed: false },
        // @ts-expect-error testing
        source_fidelity_result: { ok: false },
      },
    },
    {
      name: "bucket_semantics_failed",
      code: "bucket_semantics_failed",
      request: {
        runtime_flush_allowed: false,
        next_required_approval: "x",
        // @ts-expect-error testing
        ingest_draft: { roadmap_change_allowed: false },
        source_fidelity_result: { ok: true, issues: [] },
        // @ts-expect-error testing
        bucket_semantics_result: { ok: false },
      },
    },
    {
      name: "missing_user_confirmation",
      code: "missing_user_confirmation",
      request: {
        runtime_flush_allowed: false,
        next_required_approval: "x",
        // @ts-expect-error testing
        ingest_draft: { roadmap_change_allowed: false },
        source_fidelity_result: { ok: true, issues: [] },
        bucket_semantics_result: { ok: true, issues: [] },
      },
    },
    {
      name: "stale_source_used_as_current_truth",
      code: "stale_source_used_as_current_truth",
      request: {
        runtime_flush_allowed: false,
        next_required_approval: "x",
        // @ts-expect-error testing
        ingest_draft: {
          roadmap_change_allowed: false,
          local_findings: [
            { do_not_use_as_current_truth: true, source_uri: "stale" },
          ],
        },
        source_fidelity_result: { ok: true, issues: [] },
        bucket_semantics_result: { ok: true, issues: [] },
        user_confirmation: { confirmed_in_session: true },
      },
    },
    {
      name: "secret_like_field_detected (via request_validation)",
      code: "secret_like_field_detected",
      request: {
        runtime_flush_allowed: false,
        next_required_approval: "x",
        // @ts-expect-error testing
        ingest_draft: { roadmap_change_allowed: false },
        source_fidelity_result: { ok: true, issues: [] },
        bucket_semantics_result: { ok: true, issues: [] },
        user_confirmation: { confirmed_in_session: true },
      },
    },
  ];

  it.each(cases.slice(0, 7))(
    "classifies $name as $code",
    ({ name, code, request }) => {
      const result = classifyLiveFlushFailure({ request });
      expect(result.code, `${name} mismatch`).toBe(code);
    }
  );

  it("classifies secret_like_field_detected when request_validation contains 'secret' code", () => {
    const result = classifyLiveFlushFailure({
      request_validation: {
        ok: false,
        issues: [
          {
            code: "ingest_draft.secret",
            message: "secret-like field detected",
            severity: "block" as const,
          },
        ],
        eligible_for_live_flush: false,
      },
    });
    expect(result.code).toBe("secret_like_field_detected");
  });
});

// -----------------------------------------------------------------
// 4. assertLiveFlushStillDryRun
// -----------------------------------------------------------------

describe("assertLiveFlushStillDryRun", () => {
  it("returns still_dry_run=true for a valid pending request", () => {
    const res = assertLiveFlushStillDryRun({ payload: makeRequest() });
    expect(res.still_dry_run).toBe(true);
  });

  it("rejects runtime_flush_allowed=true", () => {
    const tampered = { ...makeRequest(), runtime_flush_allowed: true as never };
    expect(() => assertLiveFlushStillDryRun({ payload: tampered })).toThrow(
      /runtime_flush_allowed/
    );
  });

  it("rejects when mode is not pending_live_flush", () => {
    const tampered = { ...makeRequest(), mode: "live_flush" as never };
    expect(() => assertLiveFlushStillDryRun({ payload: tampered })).toThrow(
      /mode/
    );
  });

  it("rejects when target_store is not hermes_managed_knowledge_store", () => {
    const tampered = {
      ...makeRequest(),
      target_store: "external_obsidian" as never,
    };
    expect(() => assertLiveFlushStillDryRun({ payload: tampered })).toThrow(
      /target_store/
    );
  });

  it("rejects when next_required_approval is empty", () => {
    const tampered = { ...makeRequest(), next_required_approval: "" };
    expect(() => assertLiveFlushStillDryRun({ payload: tampered })).toThrow(
      /next_required_approval/
    );
  });

  it("rejects when caller claims claiming_live_flush_approved=true", () => {
    expect(() =>
      assertLiveFlushStillDryRun({
        payload: makeRequest(),
        claiming_live_flush_approved: true,
      })
    ).toThrow(/claiming_live_flush_approved=true/);
  });

  it("rejects payload with forged live_adapter_approved=true", () => {
    const tampered = {
      ...makeRequest(),
      // @ts-expect-error testing
      live_adapter_approved: true,
    };
    expect(() => assertLiveFlushStillDryRun({ payload: tampered })).toThrow(
      /live_adapter_approved=true/
    );
  });

  it("rejects payload with forged flushed=true", () => {
    const tampered = {
      ...makeRequest(),
      // @ts-expect-error testing
      flushed: true,
    };
    expect(() => assertLiveFlushStillDryRun({ payload: tampered })).toThrow(
      /flushed=true/
    );
  });
});

// -----------------------------------------------------------------
// 5. JSON round trip
// -----------------------------------------------------------------

describe("JSON round trip", () => {
  it("request survives JSON.stringify + JSON.parse", () => {
    const req = makeRequest();
    const restored: LiveFlushRequest = JSON.parse(JSON.stringify(req));
    expect(restored).toEqual(req);
    expect(restored.runtime_flush_allowed).toBe(false);
    expect(restored.mode).toBe("pending_live_flush");
  });

  it("frontmatter survives JSON.stringify + JSON.parse", () => {
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF1234567890ABCDEF",
      source_findings: makeLiveFindings(),
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    const restored = JSON.parse(JSON.stringify(fm));
    expect(restored).toEqual(fm);
    expect(restored.source_uri).toBe(fm.source_uri);
    expect(restored.fetched_at).toBe(fm.fetched_at);
  });
});

// -----------------------------------------------------------------
// 6. helper invariants match the golden fixture (Slice 006.5)
// -----------------------------------------------------------------

describe("consistency with golden fixture (Slice 006.5)", () => {
  it("preserves source_uri exactly as in the golden fixture", () => {
    const localKnown = goldenFixture.local_known as KnowledgeFinding[];
    const f1 = localKnown.find((f) => f.do_not_use_as_current_truth !== true);
    expect(f1).toBeDefined();
    const fm = buildHermesKnowledgeFrontmatter({
      ingest_draft: makeDraft(),
      draft_id: "01JABCDEF",
      source_findings: [f1 as KnowledgeFinding],
      user_confirmed_at: "2026-06-03T10:00:00.000Z",
    });
    expect(fm.source_uri).toBe(f1?.source_uri);
  });
});

// -----------------------------------------------------------------
// 7. helper source self-check
// -----------------------------------------------------------------

describe("live flush contract helper — source self-check", () => {
  it("does not contain runtime call tokens", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const code = src
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const tokens: Array<{ label: string; needle: string }> = [
      { label: "ipcMain", needle: ["ipc", "Main"].join("") },
      { label: "ipcRenderer", needle: ["ipc", "Renderer"].join("") },
      { label: "triggerCronJob", needle: ["trigger", "Cron", "Job"].join("") },
      { label: "sendMessage", needle: ["send", "Message"].join("") },
      { label: "runPlaybook", needle: ["run", "Playbook"].join("") },
      { label: "childProcess", needle: ["child", "_", "process"].join("") },
    ];
    for (const t of tokens) {
      expect(
        code.includes(t.needle),
        `helper must not contain: ${t.label}`
      ).toBe(false);
    }
    const knowledgeIngest = new RegExp("knowledge" + "Ingest" + "\\s*\\(");
    const knowledgeSearch = new RegExp("knowledge" + "Search" + "\\s*\\(");
    expect(code.match(knowledgeIngest), "no knowledgeIngest( call").toBeNull();
    expect(code.match(knowledgeSearch), "no knowledgeSearch( call").toBeNull();
  });
});
