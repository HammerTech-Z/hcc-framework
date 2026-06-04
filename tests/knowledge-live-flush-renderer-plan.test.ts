import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-live-flush-renderer-implementation-plan-2026-06-03.md"
);
const DOC = readFileSync(DOC_PATH, "utf8");

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Current prerequisites",
  "## 4. Proposed renderer entry point",
  "## 5. Component boundary plan",
  "## 6. Data flow plan",
  "## 7. Helper usage contract",
  "## 8. i18n key plan",
  "## 9. Accessibility plan",
  "## 10. Keyboard flow",
  "## 11. Visual states",
  "## 12. Test plan",
  "## 13. Playwright screenshot plan",
  "## 14. Forbidden copy scan plan",
  "## 15. No-runtime acceptance criteria",
  "## 16. Future implementation slices",
];

const FUTURE_COMPONENT_NAMES: ReadonlyArray<string> = [
  "KnowledgeFlushConfirmationPanel",
  "KnowledgeFlushGateCard",
  "KnowledgeFlushRiskCard",
  "KnowledgeFlushDraftPreview",
  "KnowledgeFlushSourceFidelityPanel",
  "KnowledgeFlushBucketSemanticsPanel",
  "KnowledgeFlushFooterActions",
];

// -----------------------------------------------------------------
// 1. doc exists and is well-formed
// -----------------------------------------------------------------

describe("renderer implementation plan doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. Future component names — boundary plan lists 7 components
// -----------------------------------------------------------------

describe("component boundary plan", () => {
  it.each(FUTURE_COMPONENT_NAMES)("mentions future component: %s", (name) => {
    expect(DOC.includes(name), `future component not in doc: ${name}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 3. Data flow no-runtime rules
// -----------------------------------------------------------------

describe("data flow no-runtime rules", () => {
  const requiredRules: ReadonlyArray<string> = [
    "renderer consumes already-built pending/dry-run payload",
    "renderer calls only pure helper projections",
    "renderer does not call knowledgeIngest",
    "renderer does not call gateway",
    "renderer does not call IPC",
    "confirm action only changes UI state",
    "no live write from renderer in this phase",
  ];

  it.each(requiredRules)("states rule: %s", (rule) => {
    // Case-insensitive substring search to accept variants like "Renderer does not"
    const lower = DOC.toLowerCase();
    const needle = rule.toLowerCase();
    expect(lower.includes(needle), `rule not in doc: ${rule}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 4. Helper usage contract
// -----------------------------------------------------------------

describe("helper usage contract", () => {
  const helperFunctions: ReadonlyArray<string> = [
    "projectRequestToSummary",
    "projectGates",
    "projectRisks",
    "computeConfirmButtonEnabled",
    "buildKnowledgeFlushCopyDeck",
    "scanForbiddenFlushUiCopy",
    "reduceConfirmation",
  ];

  it.each(helperFunctions)("mentions helper: %s", (fn) => {
    expect(DOC.includes(fn), `helper not in doc: ${fn}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. i18n namespace knowledge.flush.*
// -----------------------------------------------------------------

describe("i18n key plan", () => {
  const requiredI18nSubkeys: ReadonlyArray<string> = [
    "knowledge.flush.header.title",
    "knowledge.flush.body.reviewRequest.intro",
    "knowledge.flush.gate.userConfirmation.label",
    "knowledge.flush.risk.roadmapMutation.label",
    "knowledge.flush.confirmation.inputLabel",
    "knowledge.flush.disabledReason.awaitingPhrase",
    "knowledge.flush.terminal.approved.title",
    "knowledge.flush.safetyFooter",
    "knowledge.flush.scanner.label",
  ];

  it.each(requiredI18nSubkeys)("lists i18n key: %s", (k) => {
    expect(DOC.includes(k), `i18n key not in doc: ${k}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. Accessibility plan
// -----------------------------------------------------------------

describe("accessibility plan", () => {
  it("contains focus order section", () => {
    expect(DOC.includes("### 9.1 Focus order")).toBe(true);
  });
  it("contains ARIA labels section", () => {
    expect(DOC.includes("### 9.2 ARIA labels")).toBe(true);
  });
  it("contains keyboard-only confirmation flow", () => {
    expect(DOC.includes("### 9.3 Keyboard-only confirmation flow")).toBe(true);
  });
  it("contains disabled button explanation", () => {
    // Confirm button has aria-disabled + aria-describedby
    expect(DOC.includes("aria-disabled")).toBe(true);
    expect(DOC.includes("aria-describedby")).toBe(true);
  });
  it("contains screen-reader announcement for blocking gates", () => {
    expect(DOC.includes("aria-live=\"assertive\"") || DOC.includes('aria-live="assertive"')).toBe(true);
  });
  it("contains reduced motion / no animation requirement", () => {
    expect(DOC.toLowerCase().includes("reduced motion")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 7. Keyboard flow
// -----------------------------------------------------------------

describe("keyboard flow", () => {
  it("contains tab order", () => {
    expect(DOC.toLowerCase().includes("tab order") || DOC.includes("9.1 Focus order")).toBe(true);
  });
  it("contains review step navigation", () => {
    expect(DOC.toLowerCase().includes("step 1 (review_request)")).toBe(true);
  });
  it("contains risk acknowledgement toggle", () => {
    expect(DOC.toLowerCase().includes("risks_acknowledged")).toBe(true);
  });
  it("contains phrase input behavior", () => {
    expect(DOC.toLowerCase().includes("phrase")).toBe(true);
  });
  it("contains confirm button disabled/enabled logic", () => {
    expect(DOC.includes("Confirm Flush enabled")).toBe(true);
  });
  it("contains escape/cancel behavior", () => {
    expect(DOC.includes("Escape")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 8. Playwright screenshot plan for 3 fixtures
// -----------------------------------------------------------------

describe("Playwright screenshot plan", () => {
  it("mentions draft-ready-pass fixture", () => {
    expect(DOC.includes("draft-ready-pass")).toBe(true);
  });
  it("mentions blocked-by-source-fidelity fixture", () => {
    expect(DOC.includes("blocked-by-source-fidelity")).toBe(true);
  });
  it("mentions confirmation-captured-pending-adapter fixture", () => {
    expect(DOC.includes("confirmation-captured-pending-adapter")).toBe(true);
  });
  it("states screenshot only after future renderer implementation", () => {
    expect(
      DOC.toLowerCase().includes("screenshot only after") ||
        DOC.toLowerCase().includes("after future renderer")
    ).toBe(true);
  });
  it("states current slice does not start dev server", () => {
    const phrase = "不启 dev server";
    expect(DOC.includes(phrase) || DOC.toLowerCase().includes("not start dev server")).toBe(true);
  });
  it("states current slice does not run Playwright", () => {
    expect(DOC.includes("不跑 Playwright") || DOC.toLowerCase().includes("does not run playwright")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 9. No renderer implementation in this slice
// -----------------------------------------------------------------

describe("no renderer implementation in this slice", () => {
  it("states no React components added", () => {
    expect(DOC.includes("不实现任何 React 组件") || DOC.toLowerCase().includes("no .tsx files")).toBe(true);
  });
  it("states src/renderer/src/** not modified", () => {
    expect(
      DOC.includes("不改 `src/renderer/src/**`") ||
        DOC.toLowerCase().includes("does not modify src/renderer/src")
    ).toBe(true);
  });
  it("states no IPC / preload changes", () => {
    expect(DOC.includes("不接 IPC") || DOC.toLowerCase().includes("no ipc")).toBe(true);
    expect(DOC.includes("不改 preload") || DOC.toLowerCase().includes("no preload")).toBe(true);
  });
  it("states confirm only changes UI state, not live write", () => {
    expect(
      DOC.toLowerCase().includes("confirm only changes ui state") ||
        DOC.toLowerCase().includes("approve action only changes ui state")
    ).toBe(true);
  });
});

// -----------------------------------------------------------------
// 10. Forbidden copy scan plan
// -----------------------------------------------------------------

describe("forbidden copy scan plan", () => {
  it("contains § 14 'Forbidden copy scan plan' section", () => {
    expect(DOC.includes("## 14. Forbidden copy scan plan")).toBe(true);
  });
  it("mentions scanner function", () => {
    expect(DOC.includes("scanForbiddenFlushUiCopy")).toBe(true);
  });
  it("mentions the 3 fixture scan expectation", () => {
    expect(DOC.includes("forbidden_phrase_scan")).toBe(true);
  });
  it("mentions new copy must pass scanner before merge", () => {
    expect(DOC.toLowerCase().includes("must pass scanner") || DOC.toLowerCase().includes("expect ok=true")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 11. No-runtime acceptance criteria
// -----------------------------------------------------------------

describe("no-runtime acceptance criteria", () => {
  it("contains § 15 'No-runtime acceptance criteria' section", () => {
    expect(DOC.includes("## 15. No-runtime acceptance criteria")).toBe(true);
  });
  it("lists 0-knowledgeIngest acceptance criterion", () => {
    const lower = DOC.toLowerCase();
    expect(lower.includes("knowledgeingest") && lower.includes("0")).toBe(true);
  });
  it("lists 0-knowledgeSearch acceptance criterion", () => {
    expect(DOC.toLowerCase().includes("knowledgesearch") && DOC.toLowerCase().includes("0")).toBe(true);
  });
  it("lists 0-fetch acceptance criterion", () => {
    expect(DOC.toLowerCase().includes("fetch(") && DOC.toLowerCase().includes("0")).toBe(true);
  });
  it("lists typecheck + git diff + vitest as part of acceptance", () => {
    expect(DOC.includes("npm run typecheck")).toBe(true);
    expect(DOC.includes("git diff --check")).toBe(true);
    expect(DOC.includes("npx vitest run")).toBe(true);
  });
  it("lists 15 acceptance criteria", () => {
    // Each rule is enumerated 1-15 in § 15
    for (let i = 1; i <= 15; i += 1) {
      const needle = `${i}. \``;
      expect(DOC.includes(needle), `missing acceptance #${i}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 12. Future implementation slices
// -----------------------------------------------------------------

describe("future implementation slices", () => {
  it("references Slice 007F as next", () => {
    expect(DOC.includes("Slice 007F")).toBe(true);
  });
  it("references Slice 008A as real adapter design", () => {
    expect(DOC.includes("008A")).toBe(true);
  });
  it("references Slice 008 as real live adapter (last)", () => {
    expect(DOC.includes("### 16.3 Slice 008")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 13. Confirm-only-changes-state invariant appears in data flow
// -----------------------------------------------------------------

describe("approve-only-state invariant", () => {
  it("data flow diagram shows approve → state, not IPC", () => {
    // Look for the data flow tree section
    const dataFlow = DOC.split("## 6. Data flow plan")[1] ?? "";
    expect(dataFlow.toLowerCase().includes("state.phase = \"approved\"")).toBe(true);
    expect(dataFlow.toLowerCase().includes("不") && dataFlow.includes("IPC")).toBe(true);
  });
});
