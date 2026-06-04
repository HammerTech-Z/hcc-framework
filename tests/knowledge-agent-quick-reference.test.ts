import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-agent-quick-reference-2026-06-03.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/github-research-save-dry-run.json"
);

const doc = readFileSync(DOC_PATH, "utf8");
const fixtureText = readFileSync(FIXTURE_PATH, "utf8");
const docLines = doc.split("\n");

// -----------------------------------------------------------------
// 1. file exists and is non-empty
// -----------------------------------------------------------------

describe("quick reference — file", () => {
  it("exists and is non-empty", () => {
    expect(doc.length).toBeGreaterThan(0);
  });

  it("is within 60-100 lines", () => {
    expect(docLines.length).toBeGreaterThanOrEqual(60);
    expect(docLines.length).toBeLessThanOrEqual(100);
  });
});

// -----------------------------------------------------------------
// 2. contains the 5 required sections
// -----------------------------------------------------------------

describe("quick reference — 5 required sections", () => {
  it("has 'When to use' section", () => {
    expect(doc).toMatch(/##\s*1\.\s*When to use|When to use/);
  });
  it("has 'Required answer shape' section", () => {
    expect(doc).toMatch(/Required answer shape/);
  });
  it("has 'What not to do' section", () => {
    expect(doc).toMatch(/What not to do/);
  });
  it("has 'Dry-run payload rules' section", () => {
    expect(doc).toMatch(/Dry-run payload rules/);
  });
  it("has 'User confirmation rule' section", () => {
    expect(doc).toMatch(/User confirmation rule/);
  });
});

// -----------------------------------------------------------------
// 3. contains the four-column answer shape
// -----------------------------------------------------------------

describe("quick reference — four-column answer", () => {
  it("mentions local_known, newly_found, judgment, ingest_draft", () => {
    expect(doc).toMatch(/local_known/);
    expect(doc).toMatch(/newly_found/);
    expect(doc).toMatch(/judgment/);
    expect(doc).toMatch(/ingest_draft/);
  });
});

// -----------------------------------------------------------------
// 4. contains the required payload invariants
// -----------------------------------------------------------------

describe("quick reference — payload invariants", () => {
  it("mentions mode: dry_run", () => {
    expect(doc).toMatch(/mode["']?\s*:\s*["']?dry_run/);
  });
  it("mentions runtime_flush_allowed: false", () => {
    expect(doc).toMatch(/runtime_flush_allowed["']?\s*:\s*false/);
  });
  it("mentions required_user_confirmation: true", () => {
    expect(doc).toMatch(/required_user_confirmation["']?\s*:\s*true/);
  });
  it("mentions flush_pending", () => {
    expect(doc).toMatch(/flush_pending/);
  });
});

// -----------------------------------------------------------------
// 5. contains the trust_level default for web/github
// -----------------------------------------------------------------

describe("quick reference — trust_level", () => {
  it("mentions untrusted_external as default for web/github", () => {
    expect(doc).toMatch(/untrusted_external/);
    expect(doc).toMatch(/web\/github|web.*github|github.*web/i);
  });
});

// -----------------------------------------------------------------
// 6. mentions stale / archive not current truth
// -----------------------------------------------------------------

describe("quick reference — stale handling", () => {
  it("mentions stale / archive not as current truth", () => {
    expect(doc).toMatch(/stale/);
    expect(doc).toMatch(/archive/);
    expect(doc).toMatch(/not.*current truth|current truth|作当前事实|当前事实/i);
  });
});

// -----------------------------------------------------------------
// 7. forbids Obsidian / MEMORY.md / .wolf / arbitrary note paths
// -----------------------------------------------------------------

describe("quick reference — forbidden write targets", () => {
  it("forbids Obsidian Vault path", () => {
    expect(doc).toMatch(/Obsidian/);
    expect(doc).toMatch(/\bVault\b.*Hermes Pro 内部|forbidden.*Obsidian/i);
  });

  it("forbids MEMORY.md", () => {
    expect(doc).toMatch(/MEMORY\.md/);
    expect(doc).toMatch(/MEMORY\.md.*Forbidden|Forbidden.*MEMORY\.md/i);
  });

  it("forbids .wolf / cerebrum.md", () => {
    expect(doc).toMatch(/\.wolf/);
    expect(doc).toMatch(/cerebrum\.md/);
    expect(doc).toMatch(/\.wolf.*Forbidden|Forbidden.*\.wolf/i);
  });

  it("forbids arbitrary note paths", () => {
    expect(doc).toMatch(/notes.*topic.*md|发明.*笔记|arbitrary|自定义/i);
  });
});

// -----------------------------------------------------------------
// 8. mentions trusted_user explicit confirmation
// -----------------------------------------------------------------

describe("quick reference — user confirmation", () => {
  it("mentions trusted_user", () => {
    expect(doc).toMatch(/trusted_user/);
  });

  it("requires explicit '我授权 flush' phrase", () => {
    expect(doc).toMatch(/我授权 flush/);
  });

  it("mentions runtime ingest unavailable => flush_pending", () => {
    expect(doc).toMatch(/runtime.*不可用|runtime.*unavailable|flush_pending/);
  });
});

// -----------------------------------------------------------------
// 9. mentions the 4 forbidden runtime actions as data fields
// -----------------------------------------------------------------

describe("quick reference — forbidden runtime actions", () => {
  it("lists knowledgeIngest / gateway / ipc / cron / handoff_write / audit_write / hcc_executor", () => {
    for (const action of [
      "knowledgeIngest",
      "gateway",
      "ipc",
      "cron",
      "handoff_write",
      "audit_write",
      "hcc_executor",
    ]) {
      expect(doc.includes(action), `missing action: ${action}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 10. must NOT recommend runtime calls
// -----------------------------------------------------------------

describe("quick reference — no runtime recommendation", () => {
  it("forbids actual runtime call syntax in the doc", () => {
    // The doc may mention forbidden_runtime_actions, but it must not
    // recommend an actual runtime call. The doc self-check uses
    // runtime-constructed patterns to avoid false positives on string
    // literals that name the forbidden tokens.
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
// 11. consistency with the golden fixture
// -----------------------------------------------------------------

describe("quick reference — fixture consistency", () => {
  it("shares the four-column field names with the golden fixture", () => {
    expect(fixtureText).toMatch(/"local_known"/);
    expect(fixtureText).toMatch(/"newly_found"/);
    expect(fixtureText).toMatch(/"judgment"/);
    expect(fixtureText).toMatch(/"ingest_draft"/);
    // The doc must mention the same keys.
    for (const k of ["local_known", "newly_found", "judgment", "ingest_draft"]) {
      expect(doc.includes(k), `doc missing field: ${k}`).toBe(true);
    }
  });

  it("shares the same payload invariants with the golden fixture", () => {
    expect(fixtureText).toMatch(/"mode"\s*:\s*"dry_run"/);
    expect(fixtureText).toMatch(/"runtime_flush_allowed"\s*:\s*false/);
    expect(fixtureText).toMatch(/"required_user_confirmation"\s*:\s*true/);
    expect(fixtureText).toMatch(/"flush_pending"\s*:\s*true/);
    expect(fixtureText).toMatch(/"roadmap_change_allowed"\s*:\s*false/);
    // The doc must mention the same invariants.
    expect(doc).toMatch(/mode.*dry_run|dry_run.*mode/);
    expect(doc).toMatch(/runtime_flush_allowed/);
    expect(doc).toMatch(/required_user_confirmation/);
    expect(doc).toMatch(/flush_pending/);
    expect(doc).toMatch(/roadmap_change_allowed/);
  });
});

// -----------------------------------------------------------------
// 12.5. doc must not contain fetch(
// -----------------------------------------------------------------

describe("quick reference — no fetch() recommendation", () => {
  it("does not show fetch() as a recommendation", () => {
    // The doc may mention forbidden_runtime_actions, but it must not
    // recommend an actual fetch() call.
    expect(doc.match(/(?<![A-Za-z0-9_])fetch\s*\(/)).toBeNull();
  });
});

// -----------------------------------------------------------------
// 12.6. Slice 006.8 — source fidelity rules
// -----------------------------------------------------------------

describe("quick reference — source fidelity rules (Slice 006.8)", () => {
  it("requires preserving source_uri exactly from input", () => {
    expect(doc).toMatch(/source_uri.*fetch|fetch.*source_uri|preserved.*source_uri/i);
  });

  it("requires preserving fetched_at exactly from input", () => {
    expect(doc).toMatch(/fetched_at.*改写|改写.*fetched_at|preserved.*fetched_at/i);
  });

  it("reserves vault source_type for vault:// URIs only", () => {
    expect(doc).toMatch(/vault[\s\S]*?vault:\/\/|vault:\/\/[\s\S]*?vault/);
    expect(doc).toMatch(/vault.*vault:\/\/|本地文件.*vault/);
  });
});

// -----------------------------------------------------------------
// 12. test source self-check — skipped here because the test file
//     itself intentionally contains the literal forbidden-token names
//     (e.g. "ipcMain") as data values for the doc-side self-check. The
//     canonical self-check lives on the doc (test 10 + test 12.5), not
//     on this test file.
// -----------------------------------------------------------------
