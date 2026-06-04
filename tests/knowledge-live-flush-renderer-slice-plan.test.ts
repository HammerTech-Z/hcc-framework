import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const DOC_PATH = resolve(
  __dirname,
  "../docs/knowledge/knowledge-live-flush-renderer-slice-plan-2026-06-03.md"
);
const FIXTURE_PATH = resolve(
  __dirname,
  "fixtures/knowledge-reuse/ui-render-acceptance/renderer-slice-plan.json"
);
const RENDERER_DIR = resolve(__dirname, "../src/renderer");

const DOC = readFileSync(DOC_PATH, "utf8");
const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));

const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "## 1. Purpose",
  "## 2. Non-goals",
  "## 3. Preconditions",
  "## 4. Slice overview",
  "## 5. Slice dependency graph",
  "## 6. Per-slice implementation plan",
  "## 7. Files allowed per slice",
  "## 8. Tests per slice",
  "## 9. Acceptance criteria per slice",
  "## 10. Forbidden actions per slice",
  "## 11. Rollback plan",
  "## 12. PR gate",
  "## 13. Merge order",
  "## 14. Stop conditions",
  "## 15. Future runtime boundary",
  "## 16. Final readiness criteria",
];

const REQUIRED_SLICE_IDS: ReadonlyArray<string> = [
  "007H-1",
  "007H-2",
  "007H-3",
  "007H-4",
  "007H-5",
  "007H-6",
  "007H-7",
];

const READINESS_COMPONENT_ORDER: ReadonlyArray<string> = [
  "KnowledgeFlushGateCard",
  "KnowledgeFlushRiskCard",
  "KnowledgeFlushDraftPreview",
  "KnowledgeFlushSourceFidelityPanel",
  "KnowledgeFlushBucketSemanticsPanel",
  "KnowledgeFlushFooterActions",
  "KnowledgeFlushConfirmationPanel",
];

const REQUIRED_FIELDS_PER_SLICE: ReadonlyArray<string> = [
  "id",
  "name",
  "goal",
  "allowed_files",
  "disallowed_files",
  "required_tests",
  "acceptance_criteria",
  "forbidden_copy_assertions",
  "no_runtime_assertions",
  "rollback_point",
  "merge_prerequisite",
];

// -----------------------------------------------------------------
// 1. plan doc exists and is well-formed
// -----------------------------------------------------------------

describe("renderer slice plan doc", () => {
  it("exists at the canonical path", () => {
    expect(DOC.length).toBeGreaterThan(0);
  });

  it.each(REQUIRED_SECTIONS)("contains section: %s", (section) => {
    expect(DOC.includes(section), `missing section: ${section}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 2. all 7 implementation slices (007H-1 ~ 007H-7) present
// -----------------------------------------------------------------

describe("implementation slices", () => {
  it.each(REQUIRED_SLICE_IDS)("mentions slice: %s", (id) => {
    expect(DOC.includes(id), `slice not in doc: ${id}`).toBe(true);
  });

  it("mentions optional QA slice 007H-8", () => {
    expect(DOC.includes("007H-8")).toBe(true);
  });

  it("mentions final closeout slice 007H-9", () => {
    expect(DOC.includes("007H-9")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 3. dependency graph
// -----------------------------------------------------------------

describe("slice dependency graph", () => {
  it("contains § 5 'Slice dependency graph'", () => {
    expect(DOC.includes("## 5. Slice dependency graph")).toBe(true);
  });

  it("fixture dependencies object has 7 implementation slices", () => {
    const deps = FIXTURE.dependencies;
    for (const id of REQUIRED_SLICE_IDS) {
      expect(deps, `dependency missing: ${id}`).toHaveProperty(id);
    }
  });

  it("007H-1 and 007H-2 have no dependencies", () => {
    expect(FIXTURE.dependencies["007H-1"]).toEqual([]);
    expect(FIXTURE.dependencies["007H-2"]).toEqual([]);
  });

  it("007H-3 depends on 007H-1 and 007H-2", () => {
    const d3 = FIXTURE.dependencies["007H-3"];
    expect(d3).toContain("007H-1");
    expect(d3).toContain("007H-2");
  });

  it("007H-7 depends on 007H-1 through 007H-6", () => {
    const d7 = FIXTURE.dependencies["007H-7"];
    for (const dep of ["007H-1", "007H-2", "007H-3", "007H-4", "007H-5", "007H-6"]) {
      expect(d7, `007H-7 missing dep ${dep}`).toContain(dep);
    }
  });
});

// -----------------------------------------------------------------
// 4. per-slice schema
// -----------------------------------------------------------------

describe("per-slice schema", () => {
  it.each(REQUIRED_SLICE_IDS)("slice %s has all required fields", (id) => {
    const slice = FIXTURE.slices.find((s: { id: string }) => s.id === id);
    expect(slice, `slice not found: ${id}`).toBeDefined();
    for (const f of REQUIRED_FIELDS_PER_SLICE) {
      expect(slice, `${id} missing field: ${f}`).toHaveProperty(f);
    }
  });

  it("007H-1 has goal mentioning GateCard", () => {
    const s = FIXTURE.slices.find((x: { id: string }) => x.id === "007H-1");
    expect(s.goal).toContain("KnowledgeFlushGateCard");
  });

  it("007H-7 has disallowed files including Knowledge.tsx (only allowed here)", () => {
    const s = FIXTURE.slices.find((x: { id: string }) => x.id === "007H-7");
    expect(s.allowed_files.some((f: string) => f.includes("Knowledge.tsx"))).toBe(true);
  });

  it("007H-1 has forbidden copy assertions", () => {
    const s = FIXTURE.slices.find((x: { id: string }) => x.id === "007H-1");
    expect(s.forbidden_copy_assertions.length).toBeGreaterThan(0);
  });

  it("007H-6 has no-runtime assertions mentioning approve only dispatches", () => {
    const s = FIXTURE.slices.find((x: { id: string }) => x.id === "007H-6");
    const joined = s.no_runtime_assertions.join(" ").toLowerCase();
    expect(joined.includes("dispatch") || joined.includes("reducer")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 5. stop conditions
// -----------------------------------------------------------------

describe("stop conditions", () => {
  it("doc has § 14 'Stop conditions'", () => {
    expect(DOC.includes("## 14. Stop conditions")).toBe(true);
  });

  it("fixture stop_conditions has at least 8 items", () => {
    expect(FIXTURE.stop_conditions.length).toBeGreaterThanOrEqual(8);
  });

  it("stop conditions forbid IPC / preload diff", () => {
    const joined = FIXTURE.stop_conditions.join(" ").toLowerCase();
    expect(joined.includes("ipc") && joined.includes("preload")).toBe(true);
  });

  it("stop conditions forbid knowledgeIngest / gateway / runtime", () => {
    const joined = FIXTURE.stop_conditions.join(" ").toLowerCase();
    expect(joined.includes("knowledgeingest") && joined.includes("gateway")).toBe(true);
  });

  it("stop conditions forbid saved / written / will write copy", () => {
    const joined = FIXTURE.stop_conditions.join(" ").toLowerCase();
    expect(joined.includes("saved") || joined.includes("已保存")).toBe(true);
    expect(joined.includes("written") || joined.includes("写入成功")).toBe(true);
  });

  it("stop conditions forbid Obsidian / MEMORY / .wolf", () => {
    const joined = FIXTURE.stop_conditions.join(" ").toLowerCase();
    expect(joined.includes("obsidian") || joined.includes("memory.md") || joined.includes(".wolf")).toBe(true);
  });

  it("stop conditions forbid HCC / cron / handoff / audit touch", () => {
    const joined = FIXTURE.stop_conditions.join(" ").toLowerCase();
    expect(joined.includes("hcc") && joined.includes("cron")).toBe(true);
  });
});

// -----------------------------------------------------------------
// 6. PR gate
// -----------------------------------------------------------------

describe("PR gate", () => {
  it("doc has § 12 'PR gate'", () => {
    expect(DOC.includes("## 12. PR gate")).toBe(true);
  });

  const expectedGateItems: ReadonlyArray<string> = [
    "no IPC / preload diff",
    "no knowledgeIngest / gateway / runtime call",
    "no forbidden copy",
    "fixtures render clean",
    "typecheck EXIT 0",
    "vitest full suite PASS",
    "git diff --check clean",
  ];

  it.each(expectedGateItems)("mentions PR gate item: %s", (item) => {
    expect(DOC.includes(item), `PR gate item missing: ${item}`).toBe(true);
  });
});

// -----------------------------------------------------------------
// 7. merge order
// -----------------------------------------------------------------

describe("merge order", () => {
  it("doc has § 13 'Merge order'", () => {
    expect(DOC.includes("## 13. Merge order")).toBe(true);
  });

  it("fixture merge_order has 9 entries", () => {
    expect(FIXTURE.merge_order.length).toBe(9);
  });

  it("fixture merge_order starts with 007H-1 and ends with 007H-9", () => {
    expect(FIXTURE.merge_order[0]).toBe("007H-1");
    expect(FIXTURE.merge_order[FIXTURE.merge_order.length - 1]).toBe("007H-9");
  });

  it("fixture merge_order contains all 9 slices in order", () => {
    const expected = [
      "007H-1",
      "007H-2",
      "007H-3",
      "007H-4",
      "007H-5",
      "007H-6",
      "007H-7",
      "007H-8",
      "007H-9",
    ];
    expect(FIXTURE.merge_order).toEqual(expected);
  });
});

// -----------------------------------------------------------------
// 8. fixture merge_order matches readiness component order
// -----------------------------------------------------------------

describe("fixture slice 1-7 order matches readiness component order", () => {
  it("007H-1 maps to KnowledgeFlushGateCard, etc.", () => {
    const expectations: Array<[string, string]> = [
      ["007H-1", "KnowledgeFlushGateCard"],
      ["007H-2", "KnowledgeFlushRiskCard"],
      ["007H-3", "KnowledgeFlushDraftPreview"],
      ["007H-4", "KnowledgeFlushSourceFidelityPanel"],
      ["007H-5", "KnowledgeFlushBucketSemanticsPanel"],
      ["007H-6", "KnowledgeFlushFooterActions"],
      ["007H-7", "KnowledgeFlushConfirmationPanel"],
    ];
    for (const [sliceId, component] of expectations) {
      const slice = FIXTURE.slices.find(
        (s: { id: string; allowed_files: string[] }) => s.id === sliceId
      );
      const found = slice.allowed_files.some((f: string) => f.includes(component));
      expect(found, `${sliceId} should target ${component}`).toBe(true);
    }
  });

  it("all 7 readiness components appear in fixture across slices 1-7", () => {
    const allAllowed = FIXTURE.slices
      .filter((s: { id: string }) => REQUIRED_SLICE_IDS.includes(s.id))
      .flatMap((s: { allowed_files: string[] }) => s.allowed_files)
      .join(" ");
    for (const c of READINESS_COMPONENT_ORDER) {
      expect(allAllowed.includes(c), `component not in fixture: ${c}`).toBe(true);
    }
  });
});

// -----------------------------------------------------------------
// 9. NOT-GO statements
// -----------------------------------------------------------------

describe("NOT-GO statements", () => {
  it("doc states GO for renderer implementation planning", () => {
    expect(DOC.includes("GO for renderer implementation planning")).toBe(true);
  });

  it("doc states NOT-GO for actual implementation in this slice", () => {
    expect(DOC).toContain("不是");
    expect(DOC.toLowerCase()).toContain("actual implementation");
  });

  it("doc states NOT-GO for runtime / live adapter", () => {
    const lower = DOC.toLowerCase();
    expect(lower).toContain("runtime");
    expect(lower).toContain("live adapter");
    expect(DOC).toContain("不是");
  });

  it("doc states NOT-GO for IPC / preload", () => {
    const lower = DOC.toLowerCase();
    expect(lower).toContain("ipc");
    expect(lower).toContain("preload");
    expect(DOC).toContain("不是");
  });

  it("doc states NOT-GO for real write", () => {
    expect(DOC.toLowerCase()).toContain("real write");
    expect(DOC).toContain("不是");
  });

  it("fixture decision.not_go_for covers all 4 NOT-GO areas", () => {
    const notGo = FIXTURE.decision.not_go_for;
    expect(notGo.some((s: string) => s.toLowerCase().includes("actual implementation"))).toBe(true);
    expect(notGo.some((s: string) => s.toLowerCase().includes("runtime"))).toBe(true);
    expect(notGo.some((s: string) => s.toLowerCase().includes("ipc"))).toBe(true);
    expect(notGo.some((s: string) => s.toLowerCase().includes("real write"))).toBe(true);
  });
});

// -----------------------------------------------------------------
// 10. planning fixture JSON
// -----------------------------------------------------------------

describe("planning fixture JSON", () => {
  it("file exists and parses", () => {
    expect(existsSync(FIXTURE_PATH)).toBe(true);
    expect(FIXTURE.schema_version).toBe("1.0.0");
    expect(FIXTURE.slice).toBe("007H");
    expect(FIXTURE.kind).toBe("renderer-implementation-slice-plan");
  });

  it("slices count matches doc (7 implementation + 007H-8 + 007H-9 = 9)", () => {
    expect(FIXTURE.slices.length).toBe(9);
  });

  it("contains 7 implementation slices (007H-1 ~ 007H-7)", () => {
    const implSlices = FIXTURE.slices.filter((s: { id: string }) =>
      REQUIRED_SLICE_IDS.includes(s.id)
    );
    expect(implSlices.length).toBe(7);
  });

  it("contains allowed_files_global", () => {
    expect(FIXTURE.allowed_files_global.length).toBeGreaterThan(0);
  });

  it("contains disallowed_files_global with preload / main", () => {
    const joined = FIXTURE.disallowed_files_global.join(" ");
    expect(joined.includes("src/preload/**")).toBe(true);
    expect(joined.includes("src/main/**")).toBe(true);
  });

  it("contains decision.go + decision.not_go_for", () => {
    expect(FIXTURE.decision.go).toBe("GO for renderer implementation planning");
    expect(FIXTURE.decision.not_go_for.length).toBeGreaterThanOrEqual(4);
  });

  it("contains still_forbidden token list", () => {
    expect(FIXTURE.still_forbidden).toContain("knowledgeIngest(");
    expect(FIXTURE.still_forbidden).toContain("ipcMain");
    expect(FIXTURE.still_forbidden).toContain("runPlaybook");
  });
});

// -----------------------------------------------------------------
// 11. no renderer implementation in this slice
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
// 12. extra: walk src/renderer for KnowledgeFlush / live-flush files
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
// 13. global allowed / disallowed discipline
// -----------------------------------------------------------------

describe("global files discipline", () => {
  it("allowed_files_global includes Flush/ component path", () => {
    expect(
      FIXTURE.allowed_files_global.some((f: string) => f.includes("Flush/"))
    ).toBe(true);
  });

  it("allowed_files_global includes .tsx", () => {
    expect(
      FIXTURE.allowed_files_global.some((f: string) => f.endsWith(".tsx"))
    ).toBe(true);
  });

  it("disallowed_files_global includes preload / main / shared/lib", () => {
    const joined = FIXTURE.disallowed_files_global.join(" ");
    expect(joined).toContain("src/preload/**");
    expect(joined).toContain("src/main/**");
    expect(joined).toContain("src/shared/lib/knowledge-live-flush-ui-contract.ts");
  });

  it("disallowed_files_global includes package.json / vite config", () => {
    const joined = FIXTURE.disallowed_files_global.join(" ");
    expect(joined).toContain("package.json");
    expect(joined).toContain("electron.vite.config.ts");
  });

  it("disallowed_files_global includes .env* and i18n", () => {
    const joined = FIXTURE.disallowed_files_global.join(" ");
    expect(joined).toContain(".env");
    expect(joined).toContain("i18n");
  });
});
