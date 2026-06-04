import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildKnowledgeIngestDraft,
  RESEARCH_STEP_ORDER,
  type KnowledgeFinding,
} from "../src/shared/lib/knowledge-reuse-protocol";

const CONTRACT_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-agent-prompt-contract-2026-06-02.md"
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

function makeMinimalDraftInput() {
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
    retrieval_keywords: ["foo", "bar", "comparison"],
  };
}

// -----------------------------------------------------------------
// Load the contract once for content-driven tests
// -----------------------------------------------------------------

const contractText = readFileSync(CONTRACT_PATH, "utf8");

// -----------------------------------------------------------------
// 1. Document must mention forbidden targets as a teaching artifact
//    (negative pattern: do NOT teach agents to use these targets)
// -----------------------------------------------------------------

describe("forbidden targets", () => {
  it("forbids MEMORY.md", () => {
    expect(contractText).toMatch(/MEMORY\.md/);
    // It must appear in a "forbidden" or "do not" context
    expect(contractText).toMatch(/不得.*MEMORY\.md|不要.*MEMORY\.md|forbidden.*MEMORY\.md/i);
  });

  it("forbids .wolf/", () => {
    expect(contractText).toMatch(/\.wolf\//);
    expect(contractText).toMatch(/不得.*\.wolf|不要.*\.wolf|forbidden.*\.wolf/i);
  });

  it("forbids arbitrary Obsidian vault paths", () => {
    expect(contractText).toMatch(/Obsidian/i);
    expect(contractText).toMatch(/不得.*Obsidian|不要.*Obsidian|forbidden.*Obsidian/i);
  });
});

// -----------------------------------------------------------------
// 2. Document must reference KnowledgeIngestDraft
// -----------------------------------------------------------------

describe("KnowledgeIngestDraft reference", () => {
  it("mentions KnowledgeIngestDraft by name", () => {
    expect(contractText).toMatch(/KnowledgeIngestDraft/);
  });

  it("lists required draft fields", () => {
    for (const field of [
      "title",
      "summary",
      "local_findings",
      "web_findings",
      "sources",
      "provenance",
      "trust_level",
      "fetched_at",
      "retrieval_keywords",
      "comparison",
      "decision",
      "safe_to_use_as_instruction",
      "roadmap_change_allowed",
    ]) {
      expect(contractText.includes(field), `field "${field}" missing`).toBe(true);
    }
  });

  it("hardcodes roadmap_change_allowed to false", () => {
    expect(contractText).toMatch(/roadmap_change_allowed.*false|false.*roadmap_change_allowed/);
  });
});

// -----------------------------------------------------------------
// 3. Document must require user confirmation before any write
// -----------------------------------------------------------------

describe("user confirmation gate", () => {
  it("requires trusted_user confirmation before flush", () => {
    expect(contractText).toMatch(/trusted_user|用户.*授权|user.*confirm/i);
  });

  it("explicitly forbids silent writes", () => {
    expect(contractText).toMatch(/不得.*静默|不直接写|不得.*直接写|不得.*模拟|不.*mock/);
  });
});

// -----------------------------------------------------------------
// 4. Document must require local-known vs newly-found split
// -----------------------------------------------------------------

describe("local-known vs newly-found split", () => {
  it("mentions local-known and newly-found in the answer shape", () => {
    expect(contractText).toMatch(/local-known/);
    expect(contractText).toMatch(/newly-found/);
  });

  it("also separates Agent judgment into its own column", () => {
    expect(contractText).toMatch(/judgment|判断/);
  });

  it("shows the four-column answer shape", () => {
    expect(contractText).toMatch(/1\..*本地.*\n.*2\..*新查/s);
  });
});

// -----------------------------------------------------------------
// 5. Document must mention provenance / trust_level / fetched_at /
//    retrieval_keywords
// -----------------------------------------------------------------

describe("provenance + trust_level + fetched_at + retrieval_keywords", () => {
  it("mentions provenance", () => {
    expect(contractText.toLowerCase()).toContain("provenance");
  });
  it("mentions trust_level", () => {
    expect(contractText).toMatch(/trust_level/);
  });
  it("mentions fetched_at", () => {
    expect(contractText).toMatch(/fetched_at/);
  });
  it("mentions retrieval_keywords", () => {
    expect(contractText).toMatch(/retrieval_keywords/);
  });
});

// -----------------------------------------------------------------
// 6. Document must address runtime ingest unavailable => flush pending
// -----------------------------------------------------------------

describe("runtime ingest unavailable => flush pending", () => {
  it("mentions flush_pending", () => {
    expect(contractText).toMatch(/flush_pending/);
  });

  it("forbids faking a successful flush", () => {
    expect(contractText).toMatch(/不得.*伪造|不得.*模拟|不得.*假装/);
  });
});

// -----------------------------------------------------------------
// 7. Document must NOT recommend runtime-triggering commands
// -----------------------------------------------------------------

describe("document does not recommend runtime triggers", () => {
  it("forbids hermes serve / run / agent / delegate / gateway", () => {
    for (const cmd of ["serve", "run", "agent", "delegate", "gateway"]) {
      // The doc MUST contain the command name in a "forbidden" context
      expect(contractText.includes(cmd), `command "${cmd}" should be mentioned`).toBe(true);
    }
    // Verify each appears in a forbidden context (preceded by 启动 / forbid)
    for (const cmd of ["serve", "run", "agent", "delegate", "gateway"]) {
      const regex = new RegExp(
        `(启动|禁止|不得|forbidden|不得启动).*${cmd}`,
        "i"
      );
      expect(contractText.match(regex), `"${cmd}" not in forbidden context`).toBeTruthy();
    }
  });

  it("forbids runPlaybook / triggerCronJob / sendMessage", () => {
    for (const tok of ["runPlaybook", "triggerCronJob", "sendMessage"]) {
      expect(contractText.includes(tok), `token "${tok}" should be mentioned`).toBe(true);
    }
  });

  it("forbids writing ~/.hermes/handoff and ~/.hermes/audit", () => {
    expect(contractText).toMatch(/~\/\.hermes\/handoff/);
    expect(contractText).toMatch(/~\/\.hermes\/audit/);
  });
});

// -----------------------------------------------------------------
// 8. Document must NOT require starting gateway / serve / run / agent
//    / delegate / playbook
// -----------------------------------------------------------------

describe("document does not require runtime startup", () => {
  it("explicitly forbids HCC Auto Executor startup", () => {
    expect(contractText).toMatch(/HCC.*Auto.*Executor|启动.*HCC/);
  });

  it("explicitly forbids hard cutover / Round 2 C", () => {
    expect(contractText).toMatch(/hard cutover/);
    expect(contractText).toMatch(/Round 2 C/);
  });

  it("explicitly forbids cron / WeChat / iLink delivery", () => {
    expect(contractText).toMatch(/cron/i);
    expect(contractText).toMatch(/WeChat/);
    expect(contractText).toMatch(/iLink/);
  });
});

// -----------------------------------------------------------------
// 9. Cross-check: the helper module still produces a safe draft
//    and the contract doc does not contradict the helper invariants
// -----------------------------------------------------------------

describe("contract <-> helper consistency", () => {
  it("helper buildKnowledgeIngestDraft produces roadmap_change_allowed: false", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraftInput());
    expect(draft.roadmap_change_allowed).toBe(false);
  });

  it("helper buildKnowledgeIngestDraft defaults safe_to_use_as_instruction: false", () => {
    const draft = buildKnowledgeIngestDraft(makeMinimalDraftInput());
    expect(draft.safe_to_use_as_instruction).toBe(false);
  });

  it("helper only flips safe_to_use_as_instruction with trusted_user_confirmed", () => {
    const draft = buildKnowledgeIngestDraft({
      ...makeMinimalDraftInput(),
      trusted_user_confirmed: true,
    });
    expect(draft.safe_to_use_as_instruction).toBe(true);
    expect(draft.user_authorized_flush).toBe(true);
    // Hard invariant must still hold
    expect(draft.roadmap_change_allowed).toBe(false);
  });

  it("helper preserves canonical step order from Slice 004", () => {
    expect(RESEARCH_STEP_ORDER).toEqual([
      "local_plan",
      "knowledge_search",
      "vault_gbrain",
      "web_github",
      "answer",
      "optional_ingest_draft",
    ]);
  });
});

// -----------------------------------------------------------------
// 10. JSON round-trip of the helper output still works
// -----------------------------------------------------------------

describe("JSON round-trip (cross-slice)", () => {
  it("draft round-trips through JSON with all invariants intact", () => {
    const draft = buildKnowledgeIngestDraft({
      ...makeMinimalDraftInput(),
      trusted_user_confirmed: true,
    });
    const restored = JSON.parse(JSON.stringify(draft));
    expect(restored).toEqual(draft);
    expect(restored.roadmap_change_allowed).toBe(false);
    expect(restored.safe_to_use_as_instruction).toBe(true);
    expect(restored.user_authorized_flush).toBe(true);
  });
});
