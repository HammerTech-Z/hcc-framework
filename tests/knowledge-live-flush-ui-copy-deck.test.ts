import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALL_FORBIDDEN_FLUSH_COPY_PHRASES,
  buildKnowledgeFlushCopyDeck,
  buildKnowledgeFlushUiFixtureProjection,
  flattenCopyDeckForScan,
  FORBIDDEN_FLUSH_DESTINATION_PHRASES,
  FORBIDDEN_FLUSH_PROMISE_PHRASES,
  scanForbiddenFlushUiCopy,
  UI_HELPER_FORBIDDEN_TOKENS,
  type KnowledgeFlushUiFixtureProjection,
} from "../src/shared/lib/knowledge-live-flush-ui-contract";

const HELPER_PATH = resolve(
  __dirname,
  "../src/shared/lib/knowledge-live-flush-ui-contract.ts"
);
const COPY_DECK_DOC = resolve(
  __dirname,
  "../docs/knowledge/knowledge-live-flush-ui-copy-deck-2026-06-03.md"
);
const FIXTURE_DIR = resolve(
  __dirname,
  "fixtures/knowledge-reuse/ui-confirmation"
);
const FIXTURE_DRAFT_READY = resolve(
  FIXTURE_DIR,
  "draft-ready-pass.json"
);
const FIXTURE_BLOCKED = resolve(
  FIXTURE_DIR,
  "blocked-by-source-fidelity.json"
);
const FIXTURE_PENDING = resolve(
  FIXTURE_DIR,
  "confirmation-captured-pending-adapter.json"
);

const DOC = readFileSync(COPY_DECK_DOC, "utf8");
const DRAFT_READY = JSON.parse(readFileSync(FIXTURE_DRAFT_READY, "utf8")) as KnowledgeFlushUiFixtureProjection;
const BLOCKED = JSON.parse(readFileSync(FIXTURE_BLOCKED, "utf8")) as KnowledgeFlushUiFixtureProjection;
const PENDING = JSON.parse(readFileSync(FIXTURE_PENDING, "utf8")) as KnowledgeFlushUiFixtureProjection;

const REQUIRED_FIXTURE_KEYS: ReadonlyArray<string> = [
  "schema_version",
  "state",
  "mode",
  "runtime_flush_allowed",
  "live_adapter_approval",
  "header_copy",
  "body_copy",
  "gate_cards",
  "risk_cards",
  "confirm_button",
  "terminal_copy",
  "forbidden_phrase_scan",
];

const REQUIRED_DOC_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Global copy rules",
  "## 4. State copy",
  "## 5. Gate card copy",
  "## 6. Risk card copy",
  "## 7. Confirmation phrase copy",
  "## 8. Disabled button reasons",
  "## 9. Success / terminal copy",
  "## 10. Rejection / cancel copy",
  "## 11. Forbidden phrases",
  "## 12. Future implementation notes",
];

// -----------------------------------------------------------------
// 1. copy deck doc exists and is well-formed
// -----------------------------------------------------------------

describe("copy deck doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_DOC_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });

  it("contains the global copy rules bullet list (8 rules)", () => {
    // Each rule begins with a numbered prefix "1. **" / "2. **" ...
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const re = new RegExp(`^${n}\\. \\*\\*`, "m");
      expect(DOC.match(re), `missing rule #${n}`).not.toBeNull();
    }
  });

  it("explicitly forbids the 6 chinese/english promise phrases", () => {
    const samples = [
      "已保存",
      "写入成功",
      "已写入",
      "保存成功",
      "saved successfully",
      "written successfully",
    ];
    for (const s of samples) {
      expect(DOC.includes(s), `forbidden phrase "${s}" not in doc`).toBe(true);
    }
  });

  it("explicitly forbids the implied-promise phrases", () => {
    const samples = [
      "确认后将写入",
      "will be written after confirm",
    ];
    for (const s of samples) {
      expect(DOC.includes(s), `implied-promise phrase "${s}" not in doc`).toBe(true);
    }
  });

  it("explicitly forbids Obsidian Vault / MEMORY.md / .wolf destinations", () => {
    const samples = [
      "Obsidian Vault path",
      "MEMORY.md",
      ".wolf/cerebrum",
    ];
    for (const s of samples) {
      expect(DOC.includes(s), `forbidden destination "${s}" not in doc`).toBe(true);
    }
  });

  it("states the 3 hard global rules: runtime_flush_allowed=false / live adapter approval pending / confirmation only makes eligible", () => {
    expect(DOC.includes("runtime_flush_allowed = false")).toBe(true);
    expect(DOC.toLowerCase().includes("live adapter approval pending")).toBe(true);
    expect(DOC.includes("confirmation only makes the draft eligible")).toBe(true);
  });

  it("states no UI implementation in this slice", () => {
    expect(DOC.includes("不实现 renderer 真实 UI 组件") || DOC.includes("不实现真实 UI 组件")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. fixtures exist and parse
// -----------------------------------------------------------------

describe("golden UI fixtures — existence and shape", () => {
  const fixtures = [
    { name: "draft-ready-pass", data: DRAFT_READY },
    { name: "blocked-by-source-fidelity", data: BLOCKED },
    { name: "confirmation-captured-pending-adapter", data: PENDING },
  ];

  it.each(fixtures)("$name parses as JSON and has 12 required keys", ({ data }) => {
    for (const key of REQUIRED_FIXTURE_KEYS) {
      expect(key in data, `missing key: ${key}`).toBe(true);
    }
    expect(data.schema_version).toBe("1.0.0");
  });

  it.each(fixtures)("$name has runtime_flush_allowed=false", ({ data }) => {
    expect(data.runtime_flush_allowed).toBe(false);
  });

  it.each(fixtures)("$name has mode=pending_live_flush", ({ data }) => {
    expect(data.mode).toBe("pending_live_flush");
  });

  it.each(fixtures)("$name has live_adapter_approval in {pending, not_yet_approved, approved}", ({ data }) => {
    expect(["pending", "not_yet_approved", "approved"]).toContain(
      data.live_adapter_approval
    );
  });
});

// -----------------------------------------------------------------
// 3. fixtures have NO forbidden promise copy
// -----------------------------------------------------------------

describe("golden UI fixtures — no forbidden promise copy", () => {
  const fixtures = [
    { name: "draft-ready-pass", data: DRAFT_READY },
    { name: "blocked-by-source-fidelity", data: BLOCKED },
    { name: "confirmation-captured-pending-adapter", data: PENDING },
  ];

  function flattenFixture(f: KnowledgeFlushUiFixtureProjection): string[] {
    const out: string[] = [];
    out.push(f.header_copy.title);
    out.push(f.header_copy.subtitle);
    out.push(f.header_copy.pending_badge);
    out.push(f.body_copy.step_intro);
    for (const g of f.gate_cards) out.push(g.copy);
    for (const r of f.risk_cards) out.push(r.copy);
    out.push(f.confirm_button.label);
    if (f.confirm_button.disabled_reason) out.push(f.confirm_button.disabled_reason);
    out.push(f.terminal_copy.title);
    out.push(f.terminal_copy.body);
    out.push(f.terminal_copy.next_step);
    return out;
  }

  it.each(fixtures)("$name contains none of the 8 forbidden promise phrases", ({ data }) => {
    const texts = flattenFixture(data);
    const scan = scanForbiddenFlushUiCopy({ text: texts });
    // We only care about the 8 most-deceptive phrases here.
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
    const deceptiveHits = scan.hits.filter((h) =>
      deceptive.some((d) => d.toLowerCase() === h.phrase.toLowerCase())
    );
    expect(deceptiveHits.length, JSON.stringify(deceptiveHits, null, 2)).toBe(0);
  });
});

// -----------------------------------------------------------------
// 4. draft-ready-pass: confirm disabled with explicit reason
// -----------------------------------------------------------------

describe("draft-ready-pass — confirm disabled until phrase+ack", () => {
  it("confirm_button.enabled is false", () => {
    expect(DRAFT_READY.confirm_button.enabled).toBe(false);
  });
  it("confirm_button.disabled_reason mentions both awaiting_phrase and awaiting_risks_ack", () => {
    const reason = DRAFT_READY.confirm_button.disabled_reason ?? "";
    expect(reason.toLowerCase()).toContain("confirmation phrase");
    expect(reason.toLowerCase()).toContain("risks");
  });
  it("gate cards are 5 with no failures", () => {
    expect(DRAFT_READY.gate_cards.length).toBe(5);
    for (const g of DRAFT_READY.gate_cards) {
      expect(["pass", "warn"]).toContain(g.status);
    }
  });
  it("does not contain \"已保存\" or \"写入成功\" anywhere", () => {
    const texts = [
      DRAFT_READY.header_copy.title,
      DRAFT_READY.header_copy.subtitle,
      DRAFT_READY.terminal_copy.body,
      DRAFT_READY.terminal_copy.next_step,
    ];
    for (const t of texts) {
      expect(t.includes("已保存")).toBe(false);
      expect(t.includes("写入成功")).toBe(false);
    }
  });
});

// -----------------------------------------------------------------
// 5. blocked-by-source-fidelity: source_fidelity fail, terminal points to edit/review
// -----------------------------------------------------------------

describe("blocked-by-source-fidelity — source_fidelity fail, terminal points to edit/review", () => {
  it("confirm_button.enabled is false", () => {
    expect(BLOCKED.confirm_button.enabled).toBe(false);
  });
  it("confirm_button.disabled_reason is the blocked_by_validation copy", () => {
    const reason = BLOCKED.confirm_button.disabled_reason ?? "";
    expect(reason.toLowerCase()).toContain("gates failed");
  });
  it("source_fidelity gate is fail", () => {
    const sf = BLOCKED.gate_cards.find((g) => g.gate === "source_fidelity");
    expect(sf).toBeDefined();
    expect(sf?.status).toBe("fail");
  });
  it("terminal_copy points to edit/review, not to write", () => {
    expect(BLOCKED.terminal_copy.next_step.toLowerCase()).toContain("edit");
    expect(BLOCKED.terminal_copy.next_step.toLowerCase()).toContain("review");
  });
  it("does not promise a write", () => {
    expect(BLOCKED.terminal_copy.body.includes("已保存")).toBe(false);
    expect(BLOCKED.terminal_copy.body.includes("写入成功")).toBe(false);
  });
});

// -----------------------------------------------------------------
// 6. confirmation-captured-pending-adapter: pending adapter, no write promised
// -----------------------------------------------------------------

describe("confirmation-captured-pending-adapter — pending adapter, no write promised", () => {
  it("confirm_button.enabled is false", () => {
    expect(PENDING.confirm_button.enabled).toBe(false);
  });
  it("confirm_button.label is 'Awaiting live flush adapter approval'", () => {
    expect(PENDING.confirm_button.label).toBe("Awaiting live flush adapter approval");
  });
  it("live_adapter_approval is pending", () => {
    expect(PENDING.live_adapter_approval).toBe("pending");
  });
  it("terminal_copy.title is 'Confirmation captured' (not 'saved' or 'written')", () => {
    expect(PENDING.terminal_copy.title).toBe("Confirmation captured");
    expect(PENDING.terminal_copy.title.toLowerCase()).not.toContain("saved");
    expect(PENDING.terminal_copy.title.toLowerCase()).not.toContain("written");
  });
  it("terminal_copy.body contains 'pending_live_flush' and 'no write'", () => {
    const body = PENDING.terminal_copy.body.toLowerCase();
    expect(body.includes("pending_live_flush")).toBe(true);
    expect(body.includes("no write")).toBe(true);
  });
  it("does not contain '已保存' or '写入成功' anywhere", () => {
    const all = [
      PENDING.header_copy.title,
      PENDING.header_copy.subtitle,
      PENDING.terminal_copy.body,
      PENDING.terminal_copy.next_step,
    ];
    for (const t of all) {
      expect(t.includes("已保存")).toBe(false);
      expect(t.includes("写入成功")).toBe(false);
    }
  });
});

// -----------------------------------------------------------------
// 7. scanner catches known-bad phrases
// -----------------------------------------------------------------

describe("scanForbiddenFlushUiCopy", () => {
  it("returns ok=true for safe copy", () => {
    const scan = scanForbiddenFlushUiCopy({ text: "This is a safe copy deck entry." });
    expect(scan.ok).toBe(true);
    expect(scan.hits.length).toBe(0);
  });

  it.each(FORBIDDEN_FLUSH_PROMISE_PHRASES)("catches promise phrase: %s", (phrase) => {
    const scan = scanForbiddenFlushUiCopy({ text: `Status: ${phrase}, everything is great.` });
    expect(scan.ok).toBe(false);
    const hit = scan.hits.find((h) => h.phrase === phrase);
    expect(hit, `expected hit for "${phrase}"`).toBeDefined();
  });

  it.each(FORBIDDEN_FLUSH_DESTINATION_PHRASES)("catches destination phrase: %s", (phrase) => {
    const scan = scanForbiddenFlushUiCopy({ text: `Please enter ${phrase} as the destination.` });
    expect(scan.ok).toBe(false);
    const hit = scan.hits.find((h) => h.phrase === phrase);
    expect(hit, `expected hit for "${phrase}"`).toBeDefined();
  });

  it("is case-insensitive", () => {
    const scan = scanForbiddenFlushUiCopy({ text: "SAVED SUCCESSFULLY" });
    expect(scan.ok).toBe(false);
    expect(scan.hits.some((h) => h.phrase === "saved successfully")).toBe(true);
  });

  it("accepts an array of texts and tracks index", () => {
    const scan = scanForbiddenFlushUiCopy({
      text: ["safe text", "second safe text", "third one is bad: 已保存"],
    });
    expect(scan.ok).toBe(false);
    expect(scan.hits.length).toBeGreaterThanOrEqual(1);
    const bad = scan.hits.find((h) => h.phrase === "已保存");
    expect(bad?.index).toBe(2);
  });
});

// -----------------------------------------------------------------
// 8. copy deck produced by buildKnowledgeFlushCopyDeck() has no forbidden phrases
// -----------------------------------------------------------------

describe("buildKnowledgeFlushCopyDeck — itself is clean", () => {
  it("the canonical copy deck contains zero forbidden promise phrases", () => {
    const deck = buildKnowledgeFlushCopyDeck();
    const texts = flattenCopyDeckForScan(deck);
    const scan = scanForbiddenFlushUiCopy({ text: texts });
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
    const deceptiveHits = scan.hits.filter((h) =>
      deceptive.some((d) => d.toLowerCase() === h.phrase.toLowerCase())
    );
    expect(deceptiveHits.length, JSON.stringify(deceptiveHits, null, 2)).toBe(0);
  });

  it("the canonical copy deck does not ask for any forbidden destination", () => {
    const deck = buildKnowledgeFlushCopyDeck();
    const texts = flattenCopyDeckForScan(deck);
    const scan = scanForbiddenFlushUiCopy({ text: texts });
    const destHits = scan.hits.filter((h) =>
      FORBIDDEN_FLUSH_DESTINATION_PHRASES.some(
        (d) => d.toLowerCase() === h.phrase.toLowerCase()
      )
    );
    expect(destHits.length, JSON.stringify(destHits, null, 2)).toBe(0);
  });

  it("the canonical copy deck mentions runtime_flush_allowed = false at least once", () => {
    const deck = buildKnowledgeFlushCopyDeck();
    const texts = flattenCopyDeckForScan(deck);
    expect(texts.some((t) => t.includes("runtime_flush_allowed = false"))).toBe(true);
  });

  it("the canonical copy deck mentions 'pending_live_flush' or 'Pending live flush' at least once", () => {
    const deck = buildKnowledgeFlushCopyDeck();
    const texts = flattenCopyDeckForScan(deck);
    const matches = texts.some(
      (t) => t.includes("pending_live_flush") || t.includes("Pending live flush")
    );
    expect(matches).toBe(true);
  });
});

// -----------------------------------------------------------------
// 9. buildKnowledgeFlushUiFixtureProjection — sanity
// -----------------------------------------------------------------

describe("buildKnowledgeFlushUiFixtureProjection", () => {
  it("draft_ready_pass projects to a 5-pass-gate projection", () => {
    const p = buildKnowledgeFlushUiFixtureProjection({
      state: "draft_ready_pass",
      draft_id: "01JABC",
    });
    expect(p.state).toBe("draft_ready_pass");
    expect(p.runtime_flush_allowed).toBe(false);
    expect(p.gate_cards.length).toBe(5);
    expect(p.gate_cards.every((g) => g.status === "pass")).toBe(true);
    expect(p.confirm_button.enabled).toBe(false);
  });

  it("blocked_by_source_fidelity projects with source_fidelity=fail", () => {
    const p = buildKnowledgeFlushUiFixtureProjection({
      state: "blocked_by_source_fidelity",
      draft_id: "01JABC",
    });
    const sf = p.gate_cards.find((g) => g.gate === "source_fidelity");
    expect(sf?.status).toBe("fail");
    expect(p.confirm_button.enabled).toBe(false);
  });

  it("confirmation_captured_pending_adapter projects to a terminal state with confirm disabled", () => {
    const p = buildKnowledgeFlushUiFixtureProjection({
      state: "confirmation_captured_pending_adapter",
      draft_id: "01JABC",
    });
    expect(p.confirm_button.enabled).toBe(false);
    expect(p.confirm_button.label).toBe("Awaiting live flush adapter approval");
    expect(p.terminal_copy.title).toBe("Confirmation captured");
  });

  it("every projection carries runtime_flush_allowed=false", () => {
    const states = [
      "draft_ready_pass",
      "blocked_by_source_fidelity",
      "confirmation_captured_pending_adapter",
    ] as const;
    for (const s of states) {
      const p = buildKnowledgeFlushUiFixtureProjection({ state: s, draft_id: "x" });
      expect(p.runtime_flush_allowed).toBe(false);
      expect(p.mode).toBe("pending_live_flush");
    }
  });
});

// -----------------------------------------------------------------
// 10. ALL_FORBIDDEN_FLUSH_COPY_PHRASES is well-formed
// -----------------------------------------------------------------

describe("ALL_FORBIDDEN_FLUSH_COPY_PHRASES", () => {
  it("contains the 8 deceptive phrase set", () => {
    const set = new Set(ALL_FORBIDDEN_FLUSH_COPY_PHRASES.map((p) => p.toLowerCase()));
    const must = [
      "已保存",
      "写入成功",
      "已写入",
      "保存成功",
      "saved successfully",
      "written successfully",
      "确认后将写入",
      "will be written after confirm",
    ];
    for (const m of must) {
      expect(set.has(m.toLowerCase()), `missing forbidden phrase: ${m}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 11. helper source self-check — no runtime / IPC / network tokens
// -----------------------------------------------------------------

describe("live flush UI helper (007D extension) — source self-check", () => {
  it("does not contain runtime / IPC / network call tokens as imports or calls", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    const lines = src.split(/\n/);
    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const token of UI_HELPER_FORBIDDEN_TOKENS) {
      const callRe = new RegExp("\\b" + escapeRegex(token) + "\\s*\\(");
      const importRe = new RegExp("^\\s*import\\s.*\\b" + escapeRegex(token) + "\\b", "m");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
        if (callRe.test(line) || importRe.test(line)) {
          throw new Error(
            `UI helper line contains forbidden runtime token "${token}": ${line}`
          );
        }
      }
    }
  });

  it("does not import from runtime / preload layers", () => {
    const src = readFileSync(HELPER_PATH, "utf8");
    expect(src.includes('from "../preload')).toBe(false);
    expect(src.includes('from "../main')).toBe(false);
    expect(src.includes("window.hermesAPI")).toBe(false);
  });
});
