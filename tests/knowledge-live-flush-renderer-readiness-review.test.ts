import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-live-flush-renderer-readiness-review-2026-06-03.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/ui-render-acceptance/readiness-review.json"
);
const RENDERER_DIR = resolve(__dirname, "../src/renderer");

const DOC = readFileSync(DOC_PATH, "utf8");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Scope reviewed",
  "## 4. Cross-document consistency review",
  "## 5. Helper readiness review",
  "## 6. Fixture readiness review",
  "## 7. Component implementation order",
  "## 8. PR gate",
  "## 9. Test gate",
  "## 10. Forbidden copy gate",
  "## 11. Accessibility gate",
  "## 12. Keyboard gate",
  "## 13. Screenshot gate",
  "## 14. Runtime safety gate",
  "## 15. Blockers",
  "## 16. Go / No-go decision",
  "## 17. Future implementation slices",
];

const RECOMMENDED_COMPONENT_ORDER: ReadonlyArray<string> = [
  "KnowledgeFlushGateCard",
  "KnowledgeFlushRiskCard",
  "KnowledgeFlushDraftPreview",
  "KnowledgeFlushSourceFidelityPanel",
  "KnowledgeFlushBucketSemanticsPanel",
  "KnowledgeFlushFooterActions",
  "KnowledgeFlushConfirmationPanel",
];

// -----------------------------------------------------------------
// 1. readiness doc exists and is well-formed
// -----------------------------------------------------------------

describe("readiness review doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. references 007C/007D/007E/007F
// -----------------------------------------------------------------

describe("references upstream slices", () => {
  it.each(["007C", "007D", "007E", "007F"])("references slice: %s", (slice) => {
    expect(DOC.includes(slice), `slice not in doc: ${slice}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 3. consistency checks: states / actions / gates / risks / components
// -----------------------------------------------------------------

describe("cross-document consistency checks", () => {
  it("covers 5 gates consistently", () => {
    const gates = [
      "user_confirmation",
      "source_fidelity",
      "bucket_semantics",
      "roadmap_guard",
      "secret_guard",
    ];
    for (const g of gates) {
      expect(DOC.includes(g), `gate missing: ${g}`).toBe(true);
    }
  });

  it("covers 6 risks consistently", () => {
    const risks = [
      "roadmap_mutation",
      "stale_source_promotion",
      "secret_leak",
      "vault_authority_claim",
      "external_instruction_authority",
      "live_flush_pending_hardening",
    ];
    for (const r of risks) {
      expect(DOC.includes(r), `risk missing: ${r}`).toBe(true);
    }
  });

  it("covers 7 components consistently", () => {
    for (const c of RECOMMENDED_COMPONENT_ORDER) {
      expect(DOC.includes(c), `component missing: ${c}`).toBe(true);
    }
  });

  it("covers UI states", () => {
    expect(DOC.toLowerCase().includes("ui states")).toBe(true);
  });

  it("covers user actions", () => {
    expect(DOC.toLowerCase().includes("user actions")).toBe(true);
  });

  it("covers no-runtime wording", () => {
    expect(DOC.toLowerCase().includes("no-runtime wording")).toBe(true);
  });

  it("covers no-overpromise wording", () => {
    expect(DOC.toLowerCase().includes("no-overpromise wording")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. recommended component order
// -----------------------------------------------------------------

describe("component implementation order", () => {
  it("contains the recommended 7-component order exactly", () => {
    // Find the order in the doc — locate the section header, then find each
    // component in canonical sequence
    let cursor = 0;
    for (const c of RECOMMENDED_COMPONENT_ORDER) {
      const idx = DOC.indexOf(c, cursor);
      expect(idx, `component ${c} not found after cursor ${cursor}`).toBeGreaterThan(cursor);
      cursor = idx;
    }
  });

  it("explains 'leaf components first' rationale", () => {
    expect(DOC.toLowerCase().includes("leaf components first") || DOC.toLowerCase().includes("先 leaf")).toBe(true);
  });

  it("explains 'composed panels next' rationale", () => {
    expect(
      DOC.toLowerCase().includes("composed panel") || DOC.toLowerCase().includes("后 composed")
    ).toBe(true);
  });

  it("explains 'top-level container last' rationale", () => {
    expect(
      DOC.toLowerCase().includes("top-level") || DOC.toLowerCase().includes("最后 top-level")
    ).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. PR gate items
// -----------------------------------------------------------------

describe("PR gate", () => {
  const prGateItems: ReadonlyArray<string> = [
    "no IPC / preload diff unless explicitly approved",
    "no knowledgeIngest / gateway / runtime calls",
    "no forbidden promise copy",
    "no forbidden destination copy",
    "fixtures render clean",
    "typecheck pass",
    "vitest pass",
    "git diff --check clean",
    "screenshot plan deferred",
  ];

  it.each(prGateItems)("mentions PR gate item: %s", (item) => {
    expect(DOC.includes(item), `PR gate item missing: ${item}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. Test gate items
// -----------------------------------------------------------------

describe("Test gate", () => {
  const testGateItems: ReadonlyArray<string> = [
    "existing pure helper tests",
    "copy deck tests",
    "renderer fixture acceptance tests",
    "future component tests",
    "future Playwright screenshots",
  ];

  it.each(testGateItems)("mentions Test gate item: %s", (item) => {
    expect(DOC.includes(item), `Test gate item missing: ${item}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 7. Runtime safety gate
// -----------------------------------------------------------------

describe("Runtime safety gate", () => {
  it("contains § 14 'Runtime safety gate'", () => {
    expect(DOC.includes("## 14. Runtime safety gate")).toBe(true);
  });
  it("forbids knowledgeIngest / gateway in runtime safety gate", () => {
    const lower = DOC.toLowerCase();
    expect(lower.includes("no ipc calls") || lower.includes("no knowledgeingest")).toBe(true);
    expect(lower.includes("no fetch") || lower.includes("no axios")).toBe(true);
  });
  it("forbids overpromise copy", () => {
    expect(DOC.includes("已保存")).toBe(true);
    expect(DOC.includes("写入成功")).toBe(true);
  });
  it("forbids destination copy", () => {
    expect(DOC.includes("MEMORY.md")).toBe(true);
  });
  it("states approve only transitions state", () => {
    expect(DOC.toLowerCase().includes("approve action only transitions state")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 8. GO for renderer implementation planning only
// -----------------------------------------------------------------

describe("go / no-go decision", () => {
  it("doc states GO for renderer implementation planning only", () => {
    expect(DOC.includes("GO for renderer implementation planning only")).toBe(true);
  });

  it("doc explicitly NOT-GO for runtime", () => {
    expect(DOC.toLowerCase().includes("not ") && DOC.toLowerCase().includes("go for runtime")).toBe(true);
  });

  it("doc explicitly NOT-GO for IPC", () => {
    const lower = DOC.toLowerCase();
    expect(lower.includes("not ") && lower.includes("go for ipc")).toBe(true);
  });

  it("doc explicitly NOT-GO for live adapter", () => {
    const lower = DOC.toLowerCase();
    expect(lower.includes("not ") && lower.includes("go for live adapter")).toBe(true);
  });

  it("doc explicitly NOT-GO for real write", () => {
    const lower = DOC.toLowerCase();
    expect(lower.includes("not ") && lower.includes("go for real write")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 9. readiness fixture exists and parses
// -----------------------------------------------------------------

describe("readiness review fixture JSON", () => {
  it("file exists and parses", () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true);
    expect(FIXTURE.schema_version).toBe("1.0.0");
    expect(FIXTURE.slice).toBe("007G");
    expect(FIXTURE.kind).toBe("readiness-review");
  });

  it("contains reviewed_slices for 007C/007D/007E/007F", () => {
    const ids = FIXTURE.reviewed_slices.map((s: { id: string }) => s.id);
    for (const id of ["007C", "007D", "007E", "007F"]) {
      expect(ids, `reviewed_slices missing: ${id}`).toContain(id);
    }
  });

  it("contains 7 components in component_order", () => {
    expect(FIXTURE.component_order.length).toBe(7);
  });

  it("fixture component_order matches doc recommended order", () => {
    const fixtureOrder = FIXTURE.component_order.map(
      (c: { component: string }) => c.component
    );
    expect(fixtureOrder).toEqual(RECOMMENDED_COMPONENT_ORDER);
  });

  it("contains gates (PR / test / forbidden / a11y / keyboard / screenshot / runtime)", () => {
    expect(FIXTURE.gates.pr_gate.length).toBeGreaterThan(0);
    expect(FIXTURE.gates.test_gate.length).toBeGreaterThan(0);
    expect(FIXTURE.gates.forbidden_copy_gate.length).toBeGreaterThan(0);
    expect(FIXTURE.gates.accessibility_gate.length).toBeGreaterThan(0);
    expect(FIXTURE.gates.keyboard_gate.length).toBeGreaterThan(0);
    expect(FIXTURE.gates.screenshot_gate.length).toBeGreaterThan(0);
    expect(FIXTURE.gates.runtime_safety_gate.length).toBeGreaterThan(0);
  });

  it("contains blockers (4)", () => {
    expect(FIXTURE.blockers.length).toBe(4);
  });

  it("decision.go states 'GO for renderer implementation planning only'", () => {
    expect(FIXTURE.decision.go).toBe("GO for renderer implementation planning only");
  });

  it("decision.not_go_for includes runtime/IPC/live adapter/real write", () => {
    const notGoFor = FIXTURE.decision.not_go_for;
    for (const expected of [
      "runtime (no live knowledgeIngest call)",
      "IPC (no window.hermesAPI call)",
      "live adapter (Slice 008 not approved)",
      "real write (no Hermes Knowledge / Vault / any file write)",
    ]) {
      expect(notGoFor, `decision.not_go_for missing: ${expected}`).toContain(expected);
    }
  });

  it("contains still_forbidden token list", () => {
    expect(FIXTURE.still_forbidden.length).toBeGreaterThan(0);
    expect(FIXTURE.still_forbidden).toContain("knowledgeIngest(");
    expect(FIXTURE.still_forbidden).toContain("ipcMain");
    expect(FIXTURE.still_forbidden).toContain("runPlaybook");
  });
});

// -----------------------------------------------------------------
// 10. no renderer implementation in this slice
// -----------------------------------------------------------------

describe("no renderer implementation in this slice", () => {
  it("doc states no .tsx files added", () => {
    expect(DOC.includes("不新增任何 `.tsx` 文件") || DOC.toLowerCase().includes("no .tsx files")).toBe(true);
  });

  it("doc states no IPC", () => {
    expect(DOC.includes("不接 IPC") || DOC.toLowerCase().includes("no ipc")).toBe(true);
  });

  it("doc states no preload", () => {
    expect(DOC.includes("不改 preload") || DOC.toLowerCase().includes("no preload")).toBe(true);
  });

  it("doc states no dev server", () => {
    expect(DOC.includes("不启 dev server") || DOC.toLowerCase().includes("not start dev server")).toBe(true);
  });

  it("doc states no Playwright", () => {
    expect(DOC.includes("不跑 Playwright") || DOC.toLowerCase().includes("does not run playwright")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 11. extra: walk src/renderer for KnowledgeFlush / live-flush files
// -----------------------------------------------------------------

describe("renderer src/ has no KnowledgeFlush / live-flush files", () => {
  it("walk src/renderer and find 0 KnowledgeFlush / FlushConfirmation / live-flush files", () => {
    if (!existsSync(RENDERER_DIR)) {
      return;
    }
    const hits: string[] = [];
    const stack: string[] = [RENDERER_DIR];
    while (stack.length > 0) {
      const dir = stack.pop() as string;
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of entries) {
        const p = join(dir, name);
        let s;
        try {
          s = statSync(p);
        } catch {
          continue;
        }
        if (s.isDirectory()) {
          stack.push(p);
        } else if (s.isFile()) {
          const lower = name.toLowerCase();
          if (
            lower.includes("knowledgeflush") ||
            lower.includes("flushconfirmation") ||
            lower.includes("live-flush")
          ) {
            hits.push(p);
          }
        }
      }
    }
    expect(hits.length, `found UI files: ${hits.join("\n")}`).toBe(0);
  });
});

// -----------------------------------------------------------------
// 12. future slices
// -----------------------------------------------------------------

describe("future implementation slices", () => {
  it("references 007H", () => {
    expect(DOC.includes("007H")).toBe(true);
  });
  it("references 008A", () => {
    expect(DOC.includes("008A")).toBe(true);
  });
  it("references 008", () => {
    expect(DOC.includes("008")).toBe(true);
  });
});
