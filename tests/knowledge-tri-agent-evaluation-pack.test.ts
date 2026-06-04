import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-tri-agent-dry-run-evaluation-pack-2026-06-03.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/tri-agent-evaluation-input.json"
);
const QUICK_REF_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md"
);
const GOLDEN_FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/github-research-save-dry-run.json"
);

const doc = readFileSync(DOC_PATH, "utf8");
const fixtureText = readFileSync(FIXTURE_PATH, "utf8");
const quickRef = readFileSync(QUICK_REF_PATH, "utf8");
const goldenFixture = readFileSync(GOLDEN_FIXTURE_PATH, "utf8");

// -----------------------------------------------------------------
// 1. file exists and is non-empty
// -----------------------------------------------------------------

describe("evaluation pack — file", () => {
  it("exists and is non-empty", () => {
    expect(doc.length).toBeGreaterThan(0);
  });

  it("the input fixture exists and parses", () => {
    const fixture = JSON.parse(fixtureText);
    expect(fixture.schema_version).toBe("1.0.0");
    expect(fixture.input_findings.length).toBe(5);
  });
});

// -----------------------------------------------------------------
// 2. contains the 7 required sections
// -----------------------------------------------------------------

describe("evaluation pack — required sections", () => {
  it("contains Purpose", () => {
    expect(doc).toMatch(/##\s*1\.\s*Purpose|^Purpose/m);
  });
  it("contains Shared input prompt", () => {
    expect(doc).toMatch(/Shared input prompt/);
  });
  it("contains Expected compliant answer shape", () => {
    expect(doc).toMatch(/Expected compliant answer shape/);
  });
  it("contains Acceptance checklist", () => {
    expect(doc).toMatch(/Acceptance checklist/);
  });
  it("contains Reject cases", () => {
    expect(doc).toMatch(/Reject cases/);
  });
  it("contains Manual scoring rubric", () => {
    expect(doc).toMatch(/Manual scoring rubric/);
  });
  it("contains Next action after pass/fail", () => {
    expect(doc).toMatch(/Next action after pass\/fail/);
  });
});

// -----------------------------------------------------------------
// 3. four-column + payload invariants in expected compliant shape
// -----------------------------------------------------------------

describe("evaluation pack — four-column answer", () => {
  it("mentions local_known, newly_found, judgment, ingest_draft, flush_pending", () => {
    for (const k of ["local_known", "newly_found", "judgment", "ingest_draft", "flush_pending"]) {
      expect(doc.includes(k), `missing field: ${k}`).toBe(true);
    }
  });

  it("mentions runtime_flush_allowed, required_user_confirmation, mode dry_run", () => {
    expect(doc).toMatch(/runtime_flush_allowed/);
    expect(doc).toMatch(/required_user_confirmation/);
    expect(doc).toMatch(/dry_run/);
  });
});

// -----------------------------------------------------------------
// 4. untrusted_external default
// -----------------------------------------------------------------

describe("evaluation pack — untrusted_external", () => {
  it("explicitly mentions untrusted_external as default for web/github", () => {
    expect(doc).toMatch(/untrusted_external/);
  });
});

// -----------------------------------------------------------------
// 5. stale / archive not current truth
// -----------------------------------------------------------------

describe("evaluation pack — stale / archive", () => {
  it("explicitly states stale / archive are NOT current truth", () => {
    expect(doc).toMatch(/stale/);
    expect(doc).toMatch(/archive/);
    expect(doc).toMatch(/not.*current truth|current truth|historical/i);
  });

  it("the input fixture contains a stale finding with do_not_use_as_current_truth=true", () => {
    const fixture = JSON.parse(fixtureText);
    const stale = fixture.input_findings.filter(
      (f: { do_not_use_as_current_truth: boolean }) =>
        f.do_not_use_as_current_truth === true
    );
    expect(stale.length).toBe(1);
  });
});

// -----------------------------------------------------------------
// 6. reject cases (5 必含)
// -----------------------------------------------------------------

describe("evaluation pack — reject cases", () => {
  it("contains all 5 reject case literals", () => {
    // Use regex to allow optional backticks around the path tokens.
    const cases: Array<{ name: string; regex: RegExp }> = [
      { name: "R1", regex: /请提供 Obsidian Vault 路径/ },
      { name: "R2", regex: /我会写入\s*`?MEMORY\.md`?/ },
      { name: "R3", regex: /我会写入\s*`?\.wolf\/cerebrum\.md`?/ },
      { name: "R4", regex: /已保存到知识库/ },
      { name: "R5", regex: /我会直接调用\s*`?knowledgeIngest`?/ },
    ];
    for (const c of cases) {
      expect(doc.match(c.regex), `missing reject case ${c.name}: ${c.regex}`).toBeTruthy();
    }
  });
});

// -----------------------------------------------------------------
// 7. acceptance checklist (10 必含项)
// -----------------------------------------------------------------

describe("evaluation pack — acceptance checklist", () => {
  it("covers 10 acceptance items", () => {
    const required = [
      /Obsidian Vault path/,
      /MEMORY\.md/,
      /\.wolf\/cerebrum\.md/,
      /自定义笔记/,
      /已保存到知识库/,
      /live flush/,
      /untrusted_external/,
      /stale/,
      /用户确认/,
      /flush_pending/,
    ];
    for (const r of required) {
      expect(doc.match(r), `missing acceptance item: ${r}`).toBeTruthy();
    }
  });
});

// -----------------------------------------------------------------
// 8. scoring rubric
// -----------------------------------------------------------------

describe("evaluation pack — scoring rubric", () => {
  it("defines PASS / SOFT FAIL / HARD FAIL", () => {
    expect(doc).toMatch(/\bPASS\b/);
    expect(doc).toMatch(/SOFT FAIL/);
    expect(doc).toMatch(/HARD FAIL/);
  });
});

// -----------------------------------------------------------------
// 9. explicit "no agent runtime startup" declaration
// -----------------------------------------------------------------

describe("evaluation pack — does not actually start agents", () => {
  it("explicitly states no Claude/Codex/Hermes subprocess is started", () => {
    expect(doc).toMatch(/不实际启动.*Claude|不实际启动.*Codex|不实际启动.*Hermes/);
  });
});

// -----------------------------------------------------------------
// 10. 007 live flush is still pending approval
// -----------------------------------------------------------------

describe("evaluation pack — 007 pending", () => {
  it("states 007 live flush is pending approval", () => {
    // Match either "007 ... 待批" or "007 ... 待用户明确批准" or
    // "Slice 007 live flush adapter ... 待批/待用户" variants.
    const regex = /007[^]*?(待批|待用户明确批准|待用户.*批)|live\s+flush[^]*?(待批|待用户明确批准)/;
    expect(doc.match(regex), "doc must mark 007 as pending approval").toBeTruthy();
  });
});

// -----------------------------------------------------------------
// 11. doc must NOT recommend any runtime call
// -----------------------------------------------------------------

describe("evaluation pack — no runtime recommendation", () => {
  it("does not recommend runtime calls in the doc body", () => {
    // Build the runtime call regexes at runtime to avoid false positives on
    // string literals that name the forbidden tokens.
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
// 12. consistency with quick reference (Slice 006.6)
// -----------------------------------------------------------------

describe("evaluation pack — quick reference consistency", () => {
  it("shares the four-column field names with the quick reference", () => {
    for (const k of ["local_known", "newly_found", "judgment", "ingest_draft"]) {
      expect(quickRef.includes(k), `quick ref missing: ${k}`).toBe(true);
      expect(doc.includes(k), `evaluation pack missing: ${k}`).toBe(true);
    }
  });

  it("shares the same payload invariants with the quick reference", () => {
    for (const invariant of [
      /mode.*dry_run|dry_run.*mode/,
      /runtime_flush_allowed/,
      /required_user_confirmation/,
      /flush_pending/,
      /roadmap_change_allowed/,
    ]) {
      expect(quickRef.match(invariant), `quick ref missing invariant: ${invariant}`).toBeTruthy();
      expect(doc.match(invariant), `eval pack missing invariant: ${invariant}`).toBeTruthy();
    }
  });
});

// -----------------------------------------------------------------
// 13. consistency with golden fixture (Slice 006.5) forbidden actions
// -----------------------------------------------------------------

describe("evaluation pack — golden fixture forbidden actions consistency", () => {
  it("the 7 forbidden_runtime_actions match", () => {
    const expected = [
      "knowledgeIngest",
      "gateway",
      "ipc",
      "cron",
      "handoff_write",
      "audit_write",
      "hcc_executor",
    ];
    for (const action of expected) {
      expect(goldenFixture.includes(action), `golden fixture missing: ${action}`).toBe(true);
      expect(doc.includes(action), `eval pack missing: ${action}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 14. input fixture: 5 source flavors covered
// -----------------------------------------------------------------

describe("evaluation pack — input fixture coverage", () => {
  it("covers local_plan (fresh) + vault + github + web + stale local_plan", () => {
    const fixture = JSON.parse(fixtureText);
    const all = fixture.input_findings;
    const hasFreshLocal = all.some(
      (f: { source_type: string; do_not_use_as_current_truth: boolean }) =>
        f.source_type === "local_plan" && f.do_not_use_as_current_truth === false
    );
    const hasVault = all.some(
      (f: { source_type: string }) => f.source_type === "vault"
    );
    const hasGithub = all.some(
      (f: { source_type: string }) => f.source_type === "github"
    );
    const hasWeb = all.some(
      (f: { source_type: string }) => f.source_type === "web"
    );
    const hasStale = all.some(
      (f: { do_not_use_as_current_truth: boolean }) =>
        f.do_not_use_as_current_truth === true
    );
    expect(hasFreshLocal).toBe(true);
    expect(hasVault).toBe(true);
    expect(hasGithub).toBe(true);
    expect(hasWeb).toBe(true);
    expect(hasStale).toBe(true);
  });
});

// -----------------------------------------------------------------
// 15. input fixture: user explicitly says "save to knowledge"
// -----------------------------------------------------------------

describe("evaluation pack — user request", () => {
  it("input fixture's user_request includes a save-to-knowledge directive", () => {
    const fixture = JSON.parse(fixtureText);
    expect(fixture.user_request).toMatch(/保存|save/i);
  });
});

// -----------------------------------------------------------------
// 16. Slice 006.8 — source fidelity acceptance + soft-fail rules
// -----------------------------------------------------------------

describe("evaluation pack — source fidelity acceptance (Slice 006.8)", () => {
  it("requires fetched_at preserved exactly", () => {
    expect(doc).toMatch(/fetched_at[^]*逐字保留|逐字保留[^]*fetched_at/);
  });

  it("requires source_uri preserved exactly", () => {
    expect(doc).toMatch(/source_uri[^]*逐字保留|逐字保留[^]*source_uri/);
  });

  it("requires vault source_type only for vault:// URIs", () => {
    expect(doc).toMatch(/vault[\s\S]*?vault:\/\//);
  });

  it("requires local docs paths to keep local_plan / non-vault classification", () => {
    expect(doc).toMatch(/local_plan[\s\S]*?非 vault|本地[\s\S]*?local_plan/);
  });
});

describe("evaluation pack — soft-fail rules (Slice 006.8)", () => {
  it("timestamp drift => SOFT FAIL", () => {
    expect(doc).toMatch(/时间漂移|fetched_at[^]*漂移|漂移[^]*fetched_at|SOFT FAIL/);
  });

  it("provenance source_type mismatch => SOFT FAIL", () => {
    expect(doc).toMatch(/provenance[\s\S]*?不匹配|source_type[\s\S]*?不匹配|不匹配[\s\S]*?source_type/);
  });

  it("vault label on non-vault URI => SOFT FAIL, HARD FAIL only with instruction authority claim", () => {
    expect(doc).toMatch(/vault[\s\S]*?(SOFT FAIL|HARD FAIL)/);
    expect(doc).toMatch(/trusted vault instruction authority|trusted vault authority|instruction authority/);
  });
});

describe("evaluation pack — input fixture fidelity block (Slice 006.8)", () => {
  it("contains fidelity.expected_stale_fetched_at", () => {
    const fixture = JSON.parse(fixtureText);
    expect(fixture.fidelity).toBeDefined();
    expect(fixture.fidelity.expected_stale_fetched_at).toBe(
      "2026-05-20T00:00:00+08:00"
    );
  });

  it("contains fidelity.vault_uri_prefix = 'vault://'", () => {
    const fixture = JSON.parse(fixtureText);
    expect(fixture.fidelity.vault_uri_prefix).toBe("vault://");
  });

  it("contains fidelity.local_plan_uri_prefix = '/Users/'", () => {
    const fixture = JSON.parse(fixtureText);
    expect(fixture.fidelity.local_plan_uri_prefix).toBe("/Users/");
  });

  it("f-5 stale fetched_at is 2026-05-20T00:00:00+08:00 (year NOT drifted)", () => {
    const fixture = JSON.parse(fixtureText);
    const f5 = fixture.input_findings.find(
      (f: { id: string }) => f.id === "f-5"
    );
    expect(f5).toBeDefined();
    expect(f5.fetched_at).toBe("2026-05-20T00:00:00+08:00");
    expect(f5.fetched_at).not.toMatch(/^2025-/); // year must NOT be 2025
  });
});
