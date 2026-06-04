import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  validateLiveFlushRequest,
  validateHermesKnowledgeFrontmatter,
  HERMES_MANAGED_KNOWLEDGE_STORE,
  NEXT_REQUIRED_APPROVAL_LITERAL,
  LIVE_FLUSH_REQUEST_SCHEMA_VERSION,
  REQUIRED_FRONTMATTER_FIELDS,
  CREATED_BY_LITERAL,
} from "../src/shared/lib/knowledge-live-flush-contract";
import type { LiveFlushRequest } from "../src/shared/lib/knowledge-live-flush-contract";
import {
  buildKnowledgeIngestDraft,
  type KnowledgeFinding,
} from "../src/shared/lib/knowledge-reuse-protocol";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-live-flush-adapter-design-2026-06-03.md"
);
const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-live-flush-contract.ts"
);
const doc = readFileSync(DOC_PATH, "utf8");

function makeDraft(overrides: Partial<Parameters<typeof buildKnowledgeIngestDraft>[0]> = {}) {
  return buildKnowledgeIngestDraft({
    title: "Foo vs Bar",
    summary: "Comparison.",
    local_findings: [
      {
        source_type: "vault",
        source_uri: "vault://wiki/foo.md",
        finding: "vault note about foo",
        fetched_at: "2026-06-03T00:00:00+08:00",
        trust_level: "semi_trusted_local",
      } as KnowledgeFinding,
    ],
    web_findings: [
      {
        source_type: "github",
        source_uri: "https://github.com/example/bar",
        finding: "bar has 10k stars",
        fetched_at: "2026-06-03T00:00:00+08:00",
        trust_level: "untrusted_external",
      } as KnowledgeFinding,
    ],
    retrieval_keywords: ["foo", "bar"],
    trusted_user_confirmed: true,
    ...overrides,
  });
}

function makeValidRequest(overrides: Partial<LiveFlushRequest> = {}): LiveFlushRequest {
  const draft = makeDraft();
  return {
    schema_version: LIVE_FLUSH_REQUEST_SCHEMA_VERSION,
    mode: "pending_live_flush",
    created_at: "2026-06-03T10:00:00.000Z",
    draft_id: "01JABCDEF1234567890ABCDEF",
    user_confirmation: {
      confirmed_in_session: true,
      confirmed_at: "2026-06-03T10:00:00.000Z",
      confirmation_phrase: "我授权 flush",
    },
    ingest_draft: draft,
    source_fidelity_result: { ok: true, issues: [] },
    bucket_semantics_result: { ok: true, issues: [] },
    roadmap_guard_result: { allowed: true, reason: "non-locked target" },
    target_store: HERMES_MANAGED_KNOWLEDGE_STORE,
    runtime_adapter_required: true,
    runtime_flush_allowed: false,
    dry_run_artifact_ref:
      "tests/fixtures/knowledge-reuse/github-research-save-dry-run.json",
    next_required_approval: NEXT_REQUIRED_APPROVAL_LITERAL,
    ...overrides,
  };
}

// -----------------------------------------------------------------
// 1. design doc exists
// -----------------------------------------------------------------

describe("live flush design — file", () => {
  it("exists and is non-empty", () => {
    expect(doc.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------
// 2. required top-level sections
// -----------------------------------------------------------------

describe("live flush design — required sections", () => {
  const required = [
    "Purpose",
    "Non-goals",
    "Preconditions",
    "User confirmation gate",
    "Draft validation gate",
    "Source fidelity gate",
    "Bucket semantics gate",
    "Roadmap mutation guard",
    "FlushRequest schema",
    "Metadata / frontmatter schema",
    "Failure modes",
    "Rollback",
    "Future implementation slices",
  ];
  it.each(required)("contains section: %s", (name) => {
    expect(doc).toMatch(new RegExp(`##\\s*\\d+\\.\\s*${name}|${name}`));
  });
});

// -----------------------------------------------------------------
// 3. states Slice 007A does not perform real write
// -----------------------------------------------------------------

describe("live flush design — no real write in this slice", () => {
  it("states Slice 007A does not perform real write", () => {
    expect(doc).toMatch(/007A[^]*不[^]*真实写入|不[^]*真实写入[^]*007A/);
  });
  it("states user confirmation does not mean immediate write", () => {
    expect(doc).toMatch(/用户确认[^]*不等于[^]*立即写入|confirmation[^]*不[^]*立即/i);
  });
  it("states runtime_flush_allowed remains false in this slice", () => {
    expect(doc).toMatch(/runtime_flush_allowed[^]*false[^]*本 slice|本 slice[^]*runtime_flush_allowed[^]*false/);
  });
  it("states live adapter requires separate approval", () => {
    expect(doc).toMatch(/live adapter[^]*单独批准|单独批准[^]*live adapter/);
  });
});

// -----------------------------------------------------------------
// 4. forbidden write targets mentioned (NOT recommended)
// -----------------------------------------------------------------

describe("live flush design — forbidden write targets", () => {
  it("mentions Obsidian path as forbidden", () => {
    expect(doc).toMatch(/Obsidian/);
  });
  it("mentions MEMORY.md as forbidden", () => {
    expect(doc).toMatch(/MEMORY\.md/);
  });
  it("mentions .wolf as forbidden", () => {
    expect(doc).toMatch(/\.wolf/);
  });
  it("mentions arbitrary note paths as forbidden", () => {
    expect(doc).toMatch(/任意|arbitrary|自定义/);
  });
});

// -----------------------------------------------------------------
// 5. does not recommend runtime calls
// -----------------------------------------------------------------

describe("live flush design — no runtime recommendation", () => {
  it("does not recommend knowledgeIngest( / knowledgeSearch( / fetch( in the doc", () => {
    const patterns: Array<{ label: string; regex: RegExp }> = [
      { label: "knowledgeIngest(", regex: new RegExp("knowledge" + "Ingest" + "\\s*\\(") },
      { label: "knowledgeSearch(", regex: new RegExp("knowledge" + "Search" + "\\s*\\(") },
      { label: "fetch(", regex: new RegExp("(?<![A-Za-z0-9_])" + "fetch" + "\\s*\\(") },
    ];
    for (const p of patterns) {
      expect(doc.match(p.regex), `doc must not contain: ${p.label}`).toBeNull();
    }
  });
});

// -----------------------------------------------------------------
// 6. FlushRequest schema mentions required fields
// -----------------------------------------------------------------

describe("live flush design — FlushRequest schema fields", () => {
  it("mentions schema_version / mode / draft_id / user_confirmation / ingest_draft", () => {
    expect(doc).toMatch(/schema_version/);
    expect(doc).toMatch(/pending_live_flush/);
    expect(doc).toMatch(/draft_id/);
    expect(doc).toMatch(/user_confirmation/);
    expect(doc).toMatch(/ingest_draft/);
  });
  it("mentions target_store / runtime_flush_allowed / next_required_approval", () => {
    expect(doc).toMatch(/target_store/);
    expect(doc).toMatch(/runtime_flush_allowed/);
    expect(doc).toMatch(/next_required_approval/);
  });
});

// -----------------------------------------------------------------
// 7. metadata / frontmatter schema fields
// -----------------------------------------------------------------

describe("live flush design — frontmatter fields", () => {
  it("mentions title / summary / source_type / source_uri / fetched_at", () => {
    for (const k of ["title", "summary", "source_type", "source_uri", "fetched_at"]) {
      expect(doc.includes(k), `frontmatter missing: ${k}`).toBe(true);
    }
  });
  it("mentions trust_level / safe_to_use_as_instruction / retrieval_keywords", () => {
    for (const k of [
      "trust_level",
      "safe_to_use_as_instruction",
      "retrieval_keywords",
    ]) {
      expect(doc.includes(k), `frontmatter missing: ${k}`).toBe(true);
    }
  });
  it("mentions local_findings / web_findings / stale_sources", () => {
    for (const k of ["local_findings", "web_findings", "stale_sources"]) {
      expect(doc.includes(k), `frontmatter missing: ${k}`).toBe(true);
    }
  });
  it("mentions provenance / created_by / created_from_draft_id / user_confirmed_at", () => {
    for (const k of [
      "provenance",
      "created_by",
      "created_from_draft_id",
      "user_confirmed_at",
    ]) {
      expect(doc.includes(k), `frontmatter missing: ${k}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 8. validator — happy path
// -----------------------------------------------------------------

describe("validateLiveFlushRequest — happy path", () => {
  it("a fully valid request returns ok=true and eligible_for_live_flush=true", () => {
    const res = validateLiveFlushRequest(makeValidRequest());
    expect(res.ok).toBe(true);
    expect(res.eligible_for_live_flush).toBe(true);
    expect(res.issues).toEqual([]);
  });
});

// -----------------------------------------------------------------
// 9. validator — invariant failures
// -----------------------------------------------------------------

describe("validateLiveFlushRequest — invariant failures", () => {
  it("rejects when runtime_flush_allowed !== false", () => {
    const req = makeValidRequest({ runtime_flush_allowed: true as never });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "runtime_flush_allowed")
    ).toBe(true);
  });

  it("rejects when target_store !== hermes_managed_knowledge_store", () => {
    const req = makeValidRequest({
      target_store: "external_obsidian" as never,
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "target_store")).toBe(true);
  });

  it("rejects when ingest_draft.roadmap_change_allowed !== false", () => {
    const draft = makeDraft();
    const req = makeValidRequest({
      ingest_draft: {
        ...draft,
        // @ts-expect-error — tampered
        roadmap_change_allowed: true,
      },
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "ingest_draft.roadmap_change_allowed")
    ).toBe(true);
  });

  it("rejects when ingest_draft.user_authorized_flush !== true", () => {
    const draft = makeDraft({ trusted_user_confirmed: false });
    const req = makeValidRequest({ ingest_draft: draft });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "ingest_draft.user_authorized_flush")
    ).toBe(true);
  });

  it("rejects when source_fidelity_result.ok === false", () => {
    const req = makeValidRequest({
      source_fidelity_result: {
        ok: false,
        issues: [{ field: "fetched_at", message: "drift", severity: "hard_fail" }],
      },
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "source_fidelity_result.hard_fail")
    ).toBe(true);
  });

  it("rejects when bucket_semantics_result.ok === false", () => {
    const req = makeValidRequest({
      bucket_semantics_result: { ok: false, issues: [] },
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "bucket_semantics_result.failed")
    ).toBe(true);
  });

  it("rejects when roadmap_guard_result.allowed !== true", () => {
    const req = makeValidRequest({
      roadmap_guard_result: { allowed: false, reason: "locked" },
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "roadmap_guard_result.not_allowed")
    ).toBe(true);
  });

  it("rejects when user_confirmation.confirmation_phrase is unknown", () => {
    const req = makeValidRequest({
      user_confirmation: {
        confirmed_in_session: true,
        confirmed_at: "2026-06-03T10:00:00.000Z",
        confirmation_phrase: "go ahead",
      },
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "user_confirmation.phrase.unknown")
    ).toBe(true);
  });

  it("rejects when schema_version is wrong", () => {
    const req = makeValidRequest({
      schema_version: "9.9.9" as never,
    });
    const res = validateLiveFlushRequest(req);
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "schema_version")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 10. validator — frontmatter
// -----------------------------------------------------------------

describe("validateHermesKnowledgeFrontmatter", () => {
  const validFm = {
    title: "Foo vs Bar",
    summary: "Comparison.",
    source_type: "vault",
    source_uri: "vault://wiki/foo.md",
    fetched_at: "2026-06-03T00:00:00+08:00",
    indexed_at: "2026-06-03T10:00:00.000Z",
    trust_level: "trusted_verified",
    safe_to_use_as_instruction: true,
    retrieval_keywords: ["foo", "bar"],
    local_findings: [],
    web_findings: [],
    stale_sources: [],
    provenance: {
      source_type: "vault",
      source_uri: "vault://wiki/foo.md",
      fetched_at: "2026-06-03T00:00:00+08:00",
      indexed_at: "2026-06-03T10:00:00.000Z",
      trust_level: "trusted_verified",
      safe_to_use_as_instruction: true,
    },
    created_by: CREATED_BY_LITERAL,
    created_from_draft_id: "01JABCDEF1234567890ABCDEF",
    user_confirmed_at: "2026-06-03T10:00:00.000Z",
  };

  it("valid frontmatter returns ok=true", () => {
    const res = validateHermesKnowledgeFrontmatter(validFm);
    expect(res.ok).toBe(true);
    expect(res.eligible_for_live_flush).toBe(false);
  });

  it("rejects when created_by is wrong", () => {
    const res = validateHermesKnowledgeFrontmatter({
      ...validFm,
      created_by: "some human",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "frontmatter.created_by")).toBe(true);
  });

  it("rejects when trust_level is invalid", () => {
    const res = validateHermesKnowledgeFrontmatter({
      ...validFm,
      trust_level: "trust_me_bro",
    });
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "frontmatter.trust_level")
    ).toBe(true);
  });

  it("flags missing required fields", () => {
    const broken = { ...validFm };
    delete (broken as Record<string, unknown>).summary;
    const res = validateHermesKnowledgeFrontmatter(broken);
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.code === "frontmatter.missing.summary")
    ).toBe(true);
  });

  it("REQUIRED_FRONTMATTER_FIELDS has 16 entries", () => {
    expect(REQUIRED_FRONTMATTER_FIELDS.length).toBe(16);
  });
});

// -----------------------------------------------------------------
// 11. helper source self-check
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
