import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildFlushPendingNotice,
  assertNoRuntimeKnowledgeFlush,
  FORBIDDEN_RUNTIME_ACTIONS,
  type HermesKnowledgeReuseDryRunPayload,
} from "../src/shared/lib/knowledge-reuse-integration";

const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/github-research-save-dry-run.json"
);

function loadFixture(): HermesKnowledgeReuseDryRunPayload {
  const raw = readFileSync(FIXTURE_PATH, "utf8");
  return JSON.parse(raw) as HermesKnowledgeReuseDryRunPayload;
}

// -----------------------------------------------------------------
// 1. fixture parses
// -----------------------------------------------------------------

describe("fixture — basic parse & shape", () => {
  it("is valid JSON and matches HermesKnowledgeReuseDryRunPayload shape", () => {
    const payload = loadFixture();
    expect(payload).toBeDefined();
    expect(payload.schema_version).toBe("1.0.0");
    expect(typeof payload.created_at).toBe("string");
    expect(typeof payload.query).toBe("string");
  });
});

// -----------------------------------------------------------------
// 2. mode === "dry_run"
// -----------------------------------------------------------------

describe("fixture — mode", () => {
  it("mode is always 'dry_run'", () => {
    const payload = loadFixture();
    expect(payload.mode).toBe("dry_run");
  });
});

// -----------------------------------------------------------------
// 3. runtime_flush_allowed === false
// -----------------------------------------------------------------

describe("fixture — runtime_flush_allowed", () => {
  it("is always false", () => {
    const payload = loadFixture();
    expect(payload.runtime_flush_allowed).toBe(false);
  });
});

// -----------------------------------------------------------------
// 4. required_user_confirmation === true
// -----------------------------------------------------------------

describe("fixture — required_user_confirmation", () => {
  it("is always true", () => {
    const payload = loadFixture();
    expect(payload.required_user_confirmation).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. flush_pending === true
// -----------------------------------------------------------------

describe("fixture — flush_pending", () => {
  it("is true (draft exists)", () => {
    const payload = loadFixture();
    expect(payload.flush_pending).toBe(true);
    expect(payload.ingest_draft).not.toBeNull();
  });
});

// -----------------------------------------------------------------
// 6. four-column answer: local_known / newly_found / judgment /
//    ingest_draft all present
// -----------------------------------------------------------------

describe("fixture — four-column answer", () => {
  it("contains local_known, newly_found, judgment, ingest_draft", () => {
    const payload = loadFixture();
    expect(Array.isArray(payload.local_known)).toBe(true);
    expect(payload.local_known.length).toBeGreaterThan(0);
    expect(Array.isArray(payload.newly_found)).toBe(true);
    expect(payload.newly_found.length).toBeGreaterThan(0);
    expect(typeof payload.judgment).toBe("string");
    expect(payload.judgment.length).toBeGreaterThan(0);
    expect(payload.ingest_draft).not.toBeNull();
  });
});

// -----------------------------------------------------------------
// 7. github / web findings default untrusted_external
// -----------------------------------------------------------------

describe("fixture — github/web default trust_level", () => {
  it("every github / web finding is untrusted_external", () => {
    const payload = loadFixture();
    for (const f of payload.newly_found) {
      expect(
        f.source_type === "github" || f.source_type === "web"
      ).toBe(true);
      expect(f.trust_level).toBe("untrusted_external");
    }
  });
});

// -----------------------------------------------------------------
// 8. stale source flagging
// -----------------------------------------------------------------

describe("fixture — stale source", () => {
  it("contains at least one local_known finding with do_not_use_as_current_truth=true", () => {
    const payload = loadFixture();
    const stale = payload.local_known.filter(
      (f) => f.do_not_use_as_current_truth === true
    );
    expect(stale.length).toBeGreaterThanOrEqual(1);
    for (const s of stale) {
      expect(s.trust_level).toBe("untrusted_external");
    }
  });
});

// -----------------------------------------------------------------
// 9. ingest_draft.roadmap_change_allowed === false
// -----------------------------------------------------------------

describe("fixture — ingest_draft roadmap_change_allowed", () => {
  it("is false", () => {
    const payload = loadFixture();
    expect(payload.ingest_draft?.roadmap_change_allowed).toBe(false);
  });
});

// -----------------------------------------------------------------
// 10. ingest_draft.safe_to_use_as_instruction === false (unless confirmed)
// -----------------------------------------------------------------

describe("fixture — ingest_draft safe_to_use_as_instruction", () => {
  it("is false in the fixture (no trusted_user confirmation yet)", () => {
    const payload = loadFixture();
    expect(payload.ingest_draft?.safe_to_use_as_instruction).toBe(false);
    expect(payload.ingest_draft?.user_authorized_flush).toBe(false);
  });
});

// -----------------------------------------------------------------
// 11. forbidden_runtime_actions contains the 7 expected entries
// -----------------------------------------------------------------

describe("fixture — forbidden_runtime_actions", () => {
  it("contains knowledgeIngest, gateway, ipc, cron, handoff_write, audit_write, hcc_executor", () => {
    const payload = loadFixture();
    const set = new Set<string>(payload.forbidden_runtime_actions);
    for (const action of FORBIDDEN_RUNTIME_ACTIONS) {
      expect(set.has(action), `missing action: ${action}`).toBe(true);
    }
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
// 12. fixture must NOT recommend MEMORY.md / .wolf / Obsidian Vault
//     paths
// -----------------------------------------------------------------

describe("fixture — no forbidden write targets", () => {
  it("does not mention MEMORY.md as a write target", () => {
    const text = readFileSync(FIXTURE_PATH, "utf8");
    expect(text).not.toMatch(/write.*MEMORY\.md|save.*MEMORY\.md|写入.*MEMORY\.md/);
  });

  it("does not mention .wolf as a write target", () => {
    const text = readFileSync(FIXTURE_PATH, "utf8");
    expect(text).not.toMatch(/write.*\.wolf|save.*\.wolf|写入.*\.wolf/);
  });

  it("does not mention Obsidian Vault as a write target", () => {
    const text = readFileSync(FIXTURE_PATH, "utf8");
    expect(text).not.toMatch(/ObsidianVault|Obsidian Vault|Obsidian.*Vault/i);
  });
});

// -----------------------------------------------------------------
// 13. fixture passes assertNoRuntimeKnowledgeFlush
// -----------------------------------------------------------------

describe("fixture — assertNoRuntimeKnowledgeFlush", () => {
  it("passes the dry-run guard", () => {
    const payload = loadFixture();
    const res = assertNoRuntimeKnowledgeFlush({ payload });
    expect(res.runtime_flush_attempted).toBe(false);
    expect(res.blocked).toBe(true);
  });
});

// -----------------------------------------------------------------
// 14. buildFlushPendingNotice aligns with the fixture's draft
// -----------------------------------------------------------------

describe("fixture — buildFlushPendingNotice consistency", () => {
  it("notice.ingest_draft === fixture.ingest_draft and notice.flush_pending=true", () => {
    const payload = loadFixture();
    expect(payload.ingest_draft).not.toBeNull();
    const notice = buildFlushPendingNotice({
      draft: payload.ingest_draft!,
      runtime_ingest_unavailable: true,
    });
    expect(notice.flush_pending).toBe(true);
    expect(notice.user_must_confirm_to_flush).toBe(true);
    expect(notice.ingest_draft).toEqual(payload.ingest_draft);
  });
});

// -----------------------------------------------------------------
// 15. fixture covers all five required source flavors
// -----------------------------------------------------------------

describe("fixture — coverage of source flavors", () => {
  it("contains at least: 1 local_plan (fresh), 1 vault, 1 github, 1 web, 1 stale local_plan", () => {
    const payload = loadFixture();
    const all = [...payload.local_known, ...payload.newly_found];
    const fresh = all.filter((f) => !f.do_not_use_as_current_truth);

    const hasLocalPlan = fresh.some(
      (f) => f.source_type === "local_plan" && f.trust_level === "trusted_verified"
    );
    const hasVault = fresh.some(
      (f) => f.source_type === "vault" && f.trust_level === "semi_trusted_local"
    );
    const hasGithub = payload.newly_found.some(
      (f) => f.source_type === "github" && f.trust_level === "untrusted_external"
    );
    const hasWeb = payload.newly_found.some(
      (f) => f.source_type === "web" && f.trust_level === "untrusted_external"
    );
    const hasStale = payload.local_known.some(
      (f) => f.do_not_use_as_current_truth === true
    );

    expect(hasLocalPlan, "missing fresh local_plan/trusted_verified").toBe(true);
    expect(hasVault, "missing vault/semi_trusted_local").toBe(true);
    expect(hasGithub, "missing github/untrusted_external").toBe(true);
    expect(hasWeb, "missing web/untrusted_external").toBe(true);
    expect(hasStale, "missing stale local_plan").toBe(true);
  });
});

// -----------------------------------------------------------------
// 16. fixture includes retrieved-keyword hygiene
// -----------------------------------------------------------------

describe("fixture — retrieval_keywords", () => {
  it("ingest_draft.retrieval_keywords is normalized, lowercase, deduped", () => {
    const payload = loadFixture();
    const kws = payload.ingest_draft?.retrieval_keywords ?? [];
    expect(kws.length).toBeGreaterThan(0);
    for (const k of kws) {
      expect(k).toBe(k.toLowerCase());
    }
    const set = new Set(kws);
    expect(set.size).toBe(kws.length);
  });
});

// -----------------------------------------------------------------
// 17. fixture JSON round-trip is stable
// -----------------------------------------------------------------

describe("fixture — JSON round-trip", () => {
  it("survives JSON.stringify + JSON.parse with all invariants intact", () => {
    const payload = loadFixture();
    const restored = JSON.parse(JSON.stringify(payload));
    expect(restored).toEqual(payload);
    expect(restored.runtime_flush_allowed).toBe(false);
    expect(restored.mode).toBe("dry_run");
    expect(restored.required_user_confirmation).toBe(true);
    expect(restored.flush_pending).toBe(true);
    expect(restored.ingest_draft.roadmap_change_allowed).toBe(false);
    expect(restored.ingest_draft.safe_to_use_as_instruction).toBe(false);
  });
});
