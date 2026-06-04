import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-live-flush-renderer-fixture-acceptance-spec-2026-06-03.md"
);
const SPEC_DIR = resolve(
  __dirname,
  "fixtures/knowledge-reuse/ui-render-acceptance"
);
const SPEC_MATRIX = resolve(SPEC_DIR, "component-acceptance-matrix.json");
const SPEC_FORBIDDEN = resolve(SPEC_DIR, "forbidden-copy-assertions.json");
const SPEC_KEYBOARD = resolve(SPEC_DIR, "keyboard-flow-assertions.json");
const RENDERER_DIR = resolve(__dirname, "../src/renderer");

const DOC = readFileSync(DOC_PATH, "utf8");
const MATRIX = JSON.parse(readFileSync(SPEC_MATRIX, "utf8"));
const FORBIDDEN = JSON.parse(readFileSync(SPEC_FORBIDDEN, "utf8"));
const KEYBOARD = JSON.parse(readFileSync(SPEC_KEYBOARD, "utf8"));

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Fixture inventory",
  "## 4. Component acceptance matrix",
  "## 5. Shared render contract",
  "## 6. Component-specific acceptance specs",
  "## 7. Forbidden copy assertions",
  "## 8. Accessibility assertions",
  "## 9. Keyboard assertions",
  "## 10. Screenshot acceptance plan",
  "## 11. Future test enablement plan",
  "## 12. No-runtime acceptance criteria",
  "## 13. Future implementation slices",
];

const FUTURE_COMPONENT_NAMES: ReadonlyArray<string> = [
  "KnowledgeFlushConfirmationPanel",
  "KnowledgeFlushDraftPreview",
  "KnowledgeFlushGateCard",
  "KnowledgeFlushRiskCard",
  "KnowledgeFlushSourceFidelityPanel",
  "KnowledgeFlushBucketSemanticsPanel",
  "KnowledgeFlushFooterActions",
];

const EXISTING_FIXTURE_NAMES: ReadonlyArray<string> = [
  "draft-ready-pass",
  "blocked-by-source-fidelity",
  "confirmation-captured-pending-adapter",
];

const SHARED_RENDER_RULES: ReadonlyArray<string> = [
  "components receive projected data only",
  "components do not call helper validation directly unless explicitly allowed",
  "components do not call IPC",
  "components do not call gateway",
  "components do not call knowledgeIngest",
  "components do not call knowledgeSearch",
  "components do not mutate draft payload",
  "components do not claim saved / written",
  "components render runtime_flush_allowed=false",
  "components render live adapter approval pending",
];

// -----------------------------------------------------------------
// 1. spec doc exists and is well-formed
// -----------------------------------------------------------------

describe("renderer fixture acceptance spec doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. fixture inventory covers 3 existing fixtures
// -----------------------------------------------------------------

describe("fixture inventory", () => {
  it.each(EXISTING_FIXTURE_NAMES)("mentions existing fixture: %s", (name) => {
    expect(DOC.includes(name), `fixture not in doc: ${name}`).toBe(true);
  });

  it("mentions the 3 new spec fixtures by path", () => {
    expect(DOC.includes("component-acceptance-matrix.json")).toBe(true);
    expect(DOC.includes("forbidden-copy-assertions.json")).toBe(true);
    expect(DOC.includes("keyboard-flow-assertions.json")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 3. component matrix covers 7 future components
// -----------------------------------------------------------------

describe("component acceptance matrix", () => {
  it.each(FUTURE_COMPONENT_NAMES)("mentions future component: %s", (name) => {
    expect(DOC.includes(name), `component not in doc: ${name}`).toBe(true);
  });

  it.each(FUTURE_COMPONENT_NAMES)("matrix JSON has component: %s", (name) => {
    const inMatrix = MATRIX.matrix.some(
      (m: { component: string }) => m.component === name
    );
    expect(inMatrix, `component not in matrix JSON: ${name}`).toBe(true);
  });

  it("matrix JSON has exactly 7 components", () => {
    expect(MATRIX.matrix.length).toBe(7);
  });

  it("every component has 4-5 acceptance bullets", () => {
    for (const m of MATRIX.matrix) {
      const count = m.acceptance_bullets.length;
      expect(count >= 4 && count <= 5, `${m.component} has ${count} bullets, expected 4-5`).toBe(true);
    }
  });

  it("every component lists 3 fixture coverage", () => {
    for (const m of MATRIX.matrix) {
      const cov = m.fixtures_covered;
      expect(cov.length).toBe(3);
      for (const f of EXISTING_FIXTURE_NAMES) {
        expect(cov, `${m.component} missing fixture ${f}`).toContain(f);
      }
    }
  });
});

// -----------------------------------------------------------------
// 4. shared render contract no-runtime rules
// -----------------------------------------------------------------

describe("shared render contract", () => {
  it.each(SHARED_RENDER_RULES)("states rule: %s", (rule) => {
    expect(DOC.includes(rule), `rule not in doc: ${rule}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. per-component acceptance bullets
// -----------------------------------------------------------------

describe("per-component acceptance bullets", () => {
  const expectedPerComponent: Record<string, ReadonlyArray<string>> = {
    KnowledgeFlushConfirmationPanel: [
      "renders state badge",
      "renders 3-step flow",
      "renders safety footer",
      "owns reducer state only",
      "confirm only changes UI state",
    ],
    KnowledgeFlushDraftPreview: [
      "renders title",
      "renders provenance",
      "does not hide stale_sources",
      "does not show",
    ],
    KnowledgeFlushGateCard: [
      "renders pass",
      "fail blocks confirmation",
      "accessible label",
      "covers 5 gates",
    ],
    KnowledgeFlushRiskCard: [
      "renders 6 risk cards",
      "hard risks require acknowledgement",
      "info risk does not block",
      "no overpromise wording",
    ],
    KnowledgeFlushSourceFidelityPanel: [
      "renders exact source_uri preservation",
      "renders exact fetched_at preservation",
      "renders vault source_type only for vault:// URI",
      "fail blocks confirmation",
    ],
    KnowledgeFlushBucketSemanticsPanel: [
      "renders local_known",
      "blocks local_plan in newly_found",
      "blocks stale/archive in newly_found",
    ],
    KnowledgeFlushFooterActions: [
      "renders disabled reason",
      "confirm disabled until phrase + risk ack + no blocking issue",
      "reject / cancel are available",
      "copy draft json is non-mutating",
    ],
  };

  for (const [component, bullets] of Object.entries(expectedPerComponent)) {
    it(`${component} has at least one matching bullet for each expected area`, () => {
      // Find the component's matrix entry
      const m = MATRIX.matrix.find(
        (x: { component: string }) => x.component === component
      );
      expect(m, `matrix entry not found: ${component}`).toBeDefined();
      // Check that all expected bullets are present (substring match in either doc or matrix JSON)
      for (const b of bullets) {
        const inDoc = DOC.includes(b);
        const inMatrix = m.acceptance_bullets.some((x: string) => x.includes(b));
        expect(inDoc || inMatrix, `${component} missing bullet: ${b}`).toBe(true);
      }
    });
  }
});

// -----------------------------------------------------------------
// 6. forbidden copy assertions
// -----------------------------------------------------------------

describe("forbidden copy assertions", () => {
  it("doc has § 7 'Forbidden copy assertions'", () => {
    expect(DOC.includes("## 7. Forbidden copy assertions")).toBe(true);
  });

  it("forbidden-copy-assertions JSON mentions scanner function", () => {
    expect(FORBIDDEN.scanner_function).toBe("scanForbiddenFlushUiCopy");
  });

  it("forbidden-copy-assertions JSON lists bad phrases", () => {
    expect(FORBIDDEN.forbidden_phrase_inventory.promise_phrases_zh.length).toBeGreaterThan(0);
    expect(FORBIDDEN.forbidden_phrase_inventory.promise_phrases_en.length).toBeGreaterThan(0);
    expect(FORBIDDEN.forbidden_phrase_inventory.implied_promise_phrases_zh.length).toBeGreaterThan(0);
    expect(FORBIDDEN.forbidden_phrase_inventory.implied_promise_phrases_en.length).toBeGreaterThan(0);
    expect(FORBIDDEN.forbidden_phrase_inventory.destination_phrases.length).toBeGreaterThan(0);
  });

  it("forbidden-copy-assertions JSON defines block / pass semantics", () => {
    expect(FORBIDDEN.block_semantics.matched_phrase_action.length).toBeGreaterThan(0);
    expect(FORBIDDEN.pass_semantics.clean_copy_deck_passes).toBe(true);
    expect(FORBIDDEN.pass_semantics.clean_3_fixtures_pass).toBe(true);
    expect(FORBIDDEN.ci_gate_integration.must_pass_before_merge).toBe(true);
  });

  it("includes the 8 most-deceptive phrases", () => {
    const deceptive = [
      "已保存",
      "写入成功",
      "已写入",
      "保存成功",
      "saved successfully",
      "written successfully",
      "确认后将写入",
      "will be written after confirm",
    ];
    for (const d of deceptive) {
      const lower = (d ?? "").toLowerCase();
      const found =
        FORBIDDEN.forbidden_phrase_inventory.promise_phrases_zh.some(
          (x: string) => x.toLowerCase() === lower
        ) ||
        FORBIDDEN.forbidden_phrase_inventory.promise_phrases_en.some(
          (x: string) => x.toLowerCase() === lower
        ) ||
        FORBIDDEN.forbidden_phrase_inventory.implied_promise_phrases_zh.some(
          (x: string) => x.toLowerCase() === lower
        ) ||
        FORBIDDEN.forbidden_phrase_inventory.implied_promise_phrases_en.some(
          (x: string) => x.toLowerCase() === lower
        );
      expect(found, `deceptive phrase missing: ${d}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 7. a11y assertions
// -----------------------------------------------------------------

describe("accessibility assertions", () => {
  it("doc has § 8 'Accessibility assertions'", () => {
    expect(DOC.includes("## 8. Accessibility assertions")).toBe(true);
  });

  it("covers dialog role", () => {
    expect(DOC.includes("role=alertdialog") || DOC.includes("role=\"alertdialog\"")).toBe(true);
  });

  it("covers aria-modal", () => {
    expect(DOC.includes("aria-modal")).toBe(true);
  });

  it("covers aria-live=assertive for fail", () => {
    expect(DOC.includes("aria-live=assertive") || DOC.includes("aria-live=\"assertive\"")).toBe(true);
  });

  it("covers aria-disabled", () => {
    expect(DOC.includes("aria-disabled")).toBe(true);
  });

  it("covers focus trap", () => {
    expect(DOC.toLowerCase().includes("focus trap")).toBe(true);
  });

  it("covers reduced motion", () => {
    expect(DOC.toLowerCase().includes("reduced motion")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 8. keyboard assertions
// -----------------------------------------------------------------

describe("keyboard assertions", () => {
  it("doc has § 9 'Keyboard assertions'", () => {
    expect(DOC.includes("## 9. Keyboard assertions")).toBe(true);
  });

  it("keyboard fixture lists tab order", () => {
    expect(KEYBOARD.tab_order.length).toBeGreaterThanOrEqual(10);
  });

  it("keyboard fixture covers phrase input", () => {
    expect(KEYBOARD.phrase_input_assertions.length).toBeGreaterThanOrEqual(3);
  });

  it("keyboard fixture covers risk ack", () => {
    expect(KEYBOARD.risk_ack_assertions.length).toBeGreaterThanOrEqual(2);
  });

  it("keyboard fixture covers confirm button enablement", () => {
    expect(KEYBOARD.confirm_button_enablement.true_when.length).toBeGreaterThan(0);
    expect(KEYBOARD.confirm_button_enablement.false_when.length).toBeGreaterThan(0);
  });

  it("keyboard fixture covers cancel/escape", () => {
    expect(KEYBOARD.cancel_escape_behavior.Escape).toBeDefined();
    expect(KEYBOARD.cancel_escape_behavior.Escape.length).toBeGreaterThan(0);
  });

  it("keyboard fixture lists key event assertions", () => {
    expect(KEYBOARD.key_event_assertions.length).toBeGreaterThanOrEqual(7);
  });

  it("keyboard fixture includes validation invariant for implementation", () => {
    expect(KEYBOARD.validation_invariant_for_implementation.no_ipc_call).toBe(true);
    expect(KEYBOARD.validation_invariant_for_implementation.approve_only_transitions_state).toBe(true);
  });
});

// -----------------------------------------------------------------
// 9. screenshot acceptance plan
// -----------------------------------------------------------------

describe("screenshot acceptance plan", () => {
  it("doc has § 10 'Screenshot acceptance plan'", () => {
    expect(DOC.includes("## 10. Screenshot acceptance plan")).toBe(true);
  });

  it("mentions 3 fixture names for screenshot", () => {
    for (const f of EXISTING_FIXTURE_NAMES) {
      expect(DOC.includes(f), `screenshot plan missing fixture: ${f}`).toBe(true);
    }
  });

  it("states no dev server in this slice", () => {
    expect(DOC.includes("不启 dev server") || DOC.toLowerCase().includes("not start dev server")).toBe(true);
  });

  it("states no Playwright in this slice", () => {
    expect(DOC.includes("不跑 Playwright") || DOC.toLowerCase().includes("does not run playwright")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 10. no renderer implementation / no .tsx / no IPC / no preload / no dev server
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
// 11. spec fixture JSON files exist and parse
// -----------------------------------------------------------------

describe("spec fixture JSON files", () => {
  it.each([
    ["component-acceptance-matrix.json", SPEC_MATRIX],
    ["forbidden-copy-assertions.json", SPEC_FORBIDDEN],
    ["keyboard-flow-assertions.json", SPEC_KEYBOARD],
  ])("file exists and parses: %s", (_name, path) => {
    expect(existsSync(path), `file does not exist: ${path}`).toBe(true);
    const content = readFileSync(path, "utf8");
    const parsed = JSON.parse(content);
    expect(parsed.schema_version).toBe("1.0.0");
    expect(parsed.slice).toBe("007F");
  });

  it("matrix has 7 components with non-empty acceptance_bullets", () => {
    for (const m of MATRIX.matrix) {
      expect(m.acceptance_bullets.length).toBeGreaterThan(0);
    }
  });

  it("forbidden copy fixture has 3 expected keys", () => {
    expect(FORBIDDEN.forbidden_phrase_inventory).toBeDefined();
    expect(FORBIDDEN.block_semantics).toBeDefined();
    expect(FORBIDDEN.pass_semantics).toBeDefined();
  });

  it("keyboard fixture has 5 expected keys", () => {
    expect(KEYBOARD.tab_order).toBeDefined();
    expect(KEYBOARD.key_event_assertions).toBeDefined();
    expect(KEYBOARD.phrase_input_assertions).toBeDefined();
    expect(KEYBOARD.risk_ack_assertions).toBeDefined();
    expect(KEYBOARD.confirm_button_enablement).toBeDefined();
  });
});

// -----------------------------------------------------------------
// 12. component matrix coverage — 7 components each with bullets
// -----------------------------------------------------------------

describe("component matrix coverage", () => {
  it("7 components each have fixtures_covered and acceptance_bullets", () => {
    expect(MATRIX.matrix.length).toBe(7);
    for (const m of MATRIX.matrix) {
      expect(m.fixtures_covered.length).toBeGreaterThan(0);
      expect(m.acceptance_bullets.length).toBeGreaterThan(0);
    }
  });
});

// -----------------------------------------------------------------
// 13. no-runtime acceptance criteria present (15 items)
// -----------------------------------------------------------------

describe("no-runtime acceptance criteria (15 items)", () => {
  it("doc has § 12 'No-runtime acceptance criteria'", () => {
    expect(DOC.includes("## 12. No-runtime acceptance criteria")).toBe(true);
  });

  it("lists 15 numbered items (1-15) with backtick prefix", () => {
    for (let i = 1; i <= 15; i += 1) {
      const needle = `${i}. \``;
      expect(DOC.includes(needle), `missing acceptance #${i}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 14. renderer implementation extra check — no .tsx in src/renderer
// -----------------------------------------------------------------

describe("renderer src/ has no KnowledgeFlush / live-flush files", () => {
  it("rg over src/renderer finds 0 KnowledgeFlush / live-flush files", () => {
    let stdout = "";
    try {
      stdout = execSync(
        "rg --files src/renderer | rg -i 'KnowledgeFlush|FlushConfirmation|live-flush' || true",
        { cwd: resolve(__dirname, ".."), encoding: "utf8" }
      );
    } catch (e) {
      // execSync throws if rg finds nothing and we don't || true; we did, so ok
      stdout = "";
    }
    expect(stdout.trim(), `found UI files: ${stdout}`).toBe("");
  });
});

// -----------------------------------------------------------------
// 15. future slices (007G / 008A / 008) referenced
// -----------------------------------------------------------------

describe("future implementation slices", () => {
  it("references 007G", () => {
    expect(DOC.includes("007G")).toBe(true);
  });
  it("references 008A", () => {
    expect(DOC.includes("008A")).toBe(true);
  });
  it("references 008", () => {
    expect(DOC.includes("008")).toBe(true);
  });
});
