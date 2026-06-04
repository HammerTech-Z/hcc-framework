import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyKnowledgeFindingBucket,
  validateKnowledgeBucketSemantics,
  type KnowledgeSourceBucket,
} from "../src/shared/lib/knowledge-reuse-integration";

const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/tri-agent-evaluation-input.json"
);

interface FixtureFinding {
  id: string;
  source_type: string;
  source_uri: string;
  finding: string;
  fetched_at: string;
  trust_level: string;
  do_not_use_as_current_truth?: boolean;
  stale_reason?: string | null;
  expected_bucket?: string;
  must_not_be_in_bucket?: string[];
}

interface FixtureData {
  input_findings: FixtureFinding[];
  bucket_semantics?: {
    purpose: string;
    rules: string[];
    by_finding: Record<string, {
      expected_bucket: string;
      must_not_be_in_bucket?: string[];
      subtype?: string;
    }>;
  };
  next_action_must_not_promise_live_write?: boolean;
}

function loadFixture(): FixtureData {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

// -----------------------------------------------------------------
// 1. classifyKnowledgeFindingBucket — unit tests
// -----------------------------------------------------------------

describe("classifyKnowledgeFindingBucket", () => {
  it.each([
    { source_type: "local_plan", expected: "local_known" },
    { source_type: "vault", expected: "local_known" },
    { source_type: "knowledge_search", expected: "local_known" },
    { source_type: "gbrain_typed_link", expected: "local_known" },
    { source_type: "user_supplied", expected: "local_known" },
    { source_type: "github", expected: "newly_found" },
    { source_type: "web", expected: "newly_found" },
    { source_type: "url", expected: "newly_found" },
    { source_type: "unknown", expected: "newly_found" },
    { source_type: "llm_generated", expected: "newly_found" },
  ] as const)("maps $source_type → $expected", ({ source_type, expected }) => {
    expect(
      classifyKnowledgeFindingBucket({ source_type: source_type as any })
    ).toBe(expected);
  });

  it("maps stale findings to local_known even for web/github", () => {
    expect(
      classifyKnowledgeFindingBucket({ source_type: "web", is_historical: true })
    ).toBe("local_known");
    expect(
      classifyKnowledgeFindingBucket({ source_type: "github", is_historical: true })
    ).toBe("local_known");
  });

  it("maps non-stale local_plan to local_known", () => {
    expect(
      classifyKnowledgeFindingBucket({ source_type: "local_plan" })
    ).toBe("local_known");
  });
});

// -----------------------------------------------------------------
// 2. validateKnowledgeBucketSemantics — unit tests
// -----------------------------------------------------------------

describe("validateKnowledgeBucketSemantics", () => {
  it("passes for correctly bucketed findings", () => {
    const result = validateKnowledgeBucketSemantics(
      // local_known: local_plan + vault findings
      [
        { source_type: "local_plan", do_not_use_as_current_truth: false },
        { source_type: "vault", do_not_use_as_current_truth: false },
        { source_type: "local_plan", do_not_use_as_current_truth: true }, // stale in local_known ✓
      ],
      // newly_found: web + github findings
      [
        { source_type: "web", do_not_use_as_current_truth: false },
        { source_type: "github", do_not_use_as_current_truth: false },
      ]
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("flags when local_plan finding is in newly_found", () => {
    const result = validateKnowledgeBucketSemantics(
      [],
      [{ source_type: "local_plan", do_not_use_as_current_truth: false }]
    );
    expect(result.ok).toBe(false);
    expect(result.misplaced_in_newly_found).toBe(1);
    expect(result.issues[0].severity).toBe("soft_fail");
  });

  it("flags when stale finding is in newly_found instead of local_known", () => {
    const result = validateKnowledgeBucketSemantics(
      [],
      [{ source_type: "local_plan", do_not_use_as_current_truth: true }]
    );
    expect(result.ok).toBe(false);
    expect(result.misplaced_in_newly_found).toBe(1);
  });

  it("flags when web finding is in local_known (not freshly sourced)", () => {
    const result = validateKnowledgeBucketSemantics(
      [{ source_type: "web", do_not_use_as_current_truth: false }],
      []
    );
    expect(result.ok).toBe(false);
    expect(result.misplaced_in_local_known).toBe(1);
  });

  it("reports multiple misplacements", () => {
    const result = validateKnowledgeBucketSemantics(
      [{ source_type: "web", do_not_use_as_current_truth: false }],
      [
        { source_type: "local_plan", do_not_use_as_current_truth: false },
        { source_type: "vault", do_not_use_as_current_truth: false },
      ]
    );
    expect(result.ok).toBe(false);
    expect(result.misplaced_in_local_known).toBe(1);
    expect(result.misplaced_in_newly_found).toBe(2);
    expect(result.issues).toHaveLength(3);
  });
});

// -----------------------------------------------------------------
// 3. Fixture integration test
// -----------------------------------------------------------------

describe("fixture bucket assertions", () => {
  const fixture = loadFixture();
  const bucketSemantics = fixture.bucket_semantics!;

  it("has bucket_semantics section in fixture", () => {
    expect(bucketSemantics).toBeDefined();
    expect(bucketSemantics.purpose).toContain("Bucket classification rules");
    expect(bucketSemantics.rules.length).toBeGreaterThanOrEqual(5);
  });

  it("has next_action_must_not_promise_live_write flag", () => {
    expect(fixture.next_action_must_not_promise_live_write).toBe(true);
  });

  it("each finding has expected_bucket matching fixture assertions", () => {
    for (const finding of fixture.input_findings) {
      const expectedBucket = bucketSemantics.by_finding[finding.id]?.expected_bucket;
      expect(expectedBucket).toBeDefined();
      expect(finding.expected_bucket).toBe(expectedBucket);
    }
  });

  it("each finding has must_not_be_in_bucket consistent with expected_bucket", () => {
    for (const finding of fixture.input_findings) {
      const byId = bucketSemantics.by_finding[finding.id];
      if (!byId) continue;

      const actualMustNot = finding.must_not_be_in_bucket;
      expect(actualMustNot).toBeDefined();
      expect(actualMustNot).not.toContain(byId.expected_bucket);
      expect(actualMustNot).toContain(
        byId.expected_bucket === "local_known" ? "newly_found" : "local_known"
      );
    }
  });

  it("stale finding gets subtype historical-only in bucket semantics", () => {
    const stale = fixture.input_findings.find((f) => f.do_not_use_as_current_truth);
    expect(stale).toBeDefined();
    const staleBucket = bucketSemantics.by_finding[stale!.id];
    expect(staleBucket.subtype).toBe("historical-only");
    expect(stale!.expected_bucket).toBe("local_known");
  });

  it("local_plan/vault findings have expected_bucket=local_known", () => {
    const localTypes = fixture.input_findings.filter(
      (f) => f.source_type === "local_plan" || f.source_type === "vault"
    );
    for (const f of localTypes) {
      expect(f.expected_bucket).toBe("local_known");
    }
  });

  it("github/web findings have expected_bucket=newly_found", () => {
    const externalTypes = fixture.input_findings.filter(
      (f) => f.source_type === "github" || f.source_type === "web"
    );
    for (const f of externalTypes) {
      expect(f.expected_bucket).toBe("newly_found");
    }
  });
});
