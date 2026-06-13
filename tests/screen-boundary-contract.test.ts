import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";

import {
  buildScreenBoundaryContract,
  getScreenBoundaryContract,
  SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS,
  SCREEN_BOUNDARY_CONTRACT_SCHEMA_VERSION,
  SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT,
  type ScreenBoundaryContract,
  type ScreenBoundaryKind,
  type ScreenViewId,
} from "../src/shared/lib/screen-boundary-contract";
import {
  getTransitiveImports,
  FORBIDDEN_RE,
} from "./_helpers/import-graph";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/screen-boundary-contract.ts"),
  "utf-8",
);
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);
const modelStrategyPanelSrc = readFileSync(
  join(
    ROOT,
    "src/renderer/src/screens/HccCockpit/ModelStrategyDryRunPanel.tsx",
  ),
  "utf-8",
);

const CANONICAL_LAYOUT_ORDER: readonly ScreenViewId[] = [
  "chat",
  "sessions",
  "office",
  "mission",
  "playbooks",
  "understand",
  "skills",
  "knowledgeControl",
  "knowledge",
  "soul",
  "memory",
  "agents",
  "bailongma",
  "hccCockpit",
  "monitor",
  "models",
  "providers",
  "tools",
  "schedules",
  "gateway",
  "settings",
  "shell",
];

function result() {
  return buildScreenBoundaryContract();
}

function byView(view: ScreenViewId): ScreenBoundaryContract {
  const entry = getScreenBoundaryContract(view);
  expect(entry).toBeDefined();
  return entry!;
}

function methods(view: ScreenViewId): string[] {
  return byView(view).api_methods.map((method) => method.name);
}

function extractLayoutNavViews(): string[] {
  return [...layoutSrc.matchAll(/view:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );
}

describe("UI Slice 1 screen boundary contract schema", () => {
  it("uses schema 1.0.0 and emits 22 Layout view contracts", () => {
    const built = result();
    expect(SCREEN_BOUNDARY_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT).toBe(22);
    expect(built.schema_version).toBe("1.0.0");
    expect(built.mode).toBe("ui_slice_1_contract_descriptor");
    expect(built.view_count).toBe(22);
    expect(built.contracts).toHaveLength(22);
  });

  it("matches the actual Layout NAV_GROUPS order (shell excluded — pseudo-view)", () => {
    const navViews = CANONICAL_LAYOUT_ORDER.filter((v) => v !== "shell");
    expect(extractLayoutNavViews()).toEqual(navViews);
    expect(result().contracts.map((entry) => entry.view)).toEqual([
      ...CANONICAL_LAYOUT_ORDER,
    ]);
  });

  it("each contract view appears in Layout route table rendering", () => {
    // shell is a pseudo-view — not in layout-routes.tsx
    const navViews = CANONICAL_LAYOUT_ORDER.filter((v) => v !== "shell");
    const layoutRoutesSrc = readFileSync(
      join(ROOT, "src/renderer/src/screens/Layout/layout-routes.tsx"),
      "utf-8",
    );
    for (const view of navViews) {
      expect(layoutRoutesSrc).toContain(`view: "${view}"`);
    }
    expect(layoutSrc).toContain("paneStyle(route.view)");
  });

  it("preserves the four sidebar group counts from Layout", () => {
    const counts = result().contracts.reduce<Record<string, number>>(
      (acc, entry) => {
        acc[entry.sidebar_group] = (acc[entry.sidebar_group] ?? 0) + 1;
        return acc;
      },
      {},
    );
    expect(counts).toEqual({
      Work: 7,
      Knowledge: 5,
      Agents: 4,
      System: 6,
    });
  });
});

describe("UI Slice 1 read-only and write-capable classifications", () => {
  it("keeps HccCockpit, BaiLongma, Mission, and Monitor read_only", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
    ] as const) {
      const entry = byView(view);
      expect(entry.boundary_kind).toBe("read_only");
      expect(entry.write_surfaces).toEqual([]);
      expect(entry.api_methods.every((method) => !method.mutates)).toBe(true);
    }
  });

  it("classifies current write-capable Layout views", () => {
    const expected: Readonly<Record<ScreenViewId, ScreenBoundaryKind>> = {
      chat: "mixed",
      sessions: "read_write_runtime",
      office: "external_action",
      mission: "read_only",
      playbooks: "read_write_runtime",
      understand: "read_write_runtime",
      skills: "read_write_config",
      knowledgeControl: "read_only",
      knowledge: "mixed",
      soul: "read_write_config",
      memory: "mixed",
      agents: "read_write_config",
      bailongma: "read_only",
      hccCockpit: "read_only",
      monitor: "read_only",
      models: "read_write_config",
      providers: "read_write_config",
      tools: "read_write_config",
      schedules: "read_write_runtime",
      gateway: "mixed",
      settings: "mixed",
      shell: "mixed",
    };

    for (const entry of result().contracts) {
      expect(entry.boundary_kind).toBe(expected[entry.view]);
    }
  });

  it("captures high-risk model/provider configuration surfaces", () => {
    expect(byView("providers").risk_level).toBe("P1");
    expect(methods("providers")).toEqual(
      expect.arrayContaining([
        "setCredentialPool",
        "setEnv",
        "setModelConfig",
        "addModel",
      ]),
    );
    expect(byView("models").write_surfaces).toEqual(
      expect.arrayContaining(["model_catalog", "model_env"]),
    );
  });

  it("captures primary runtime action surfaces", () => {
    expect(methods("chat")).toEqual(
      expect.arrayContaining(["sendMessage", "abortChat"]),
    );
    expect(methods("schedules")).toContain("triggerCronJob");
    expect(methods("playbooks")).toContain("runPlaybook");
    expect(methods("gateway")).toEqual(
      expect.arrayContaining(["startGateway", "stopGateway"]),
    );
  });
});

describe("UI Slice 1 direct gateway risk registration", () => {
  it("knowledge and knowledgeControl have no active direct_gateway_methods after IPC migration closeout", () => {
    const knowledge = byView("knowledge");
    expect(knowledge.risk_level).not.toBe("P0");
    expect(knowledge.direct_gateway_methods).toEqual([]);
    expect(knowledge.migrated_ipc_methods).toEqual(
      expect.arrayContaining([
        "knowledgeSearch",
        "knowledgeIngest",
        "getGbrainStats",
      ]),
    );
    expect(
      knowledge.api_methods.filter((method) => method.direct_gateway).map(
        (method) => method.name,
      ),
    ).toEqual([]);

    const knowledgeControl = byView("knowledgeControl");
    expect(knowledgeControl.risk_level).not.toBe("P0");
    expect(knowledgeControl.direct_gateway_methods).toEqual([]);
    expect(knowledgeControl.migrated_ipc_methods).toEqual(
      expect.arrayContaining(["knowledgeSearch", "getGbrainStats"]),
    );
  });

  it("declares the direct gateway fix applied after the Knowledge IPC migration closeout", () => {
    expect(SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS.direct_gateway_fix_applied)
      .toBe(true);
    expect(result().safety_invariants.direct_gateway_fix_applied).toBe(true);
    for (const entry of result().contracts) {
      expect(entry.safety_invariants.direct_gateway_fix_applied).toBe(true);
    }
  });
});

describe("UI Slice 1 MODEL-STRATEGY cross-slice guardrails", () => {
  it("marks HccCockpit and provider/model/settings surfaces as model-strategy relevant", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
      "models",
      "providers",
      "settings",
      "chat",
    ] as const) {
      expect(byView(view).model_strategy_relevant).toBe(true);
    }
  });

  it("ModelStrategyDryRunPanel has zero IPC, direct gateway, or hermesAPI calls", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      "knowledgeIngest",
      "knowledgeSearch",
      "setModelConfig",
      "setEnv",
      "startGateway",
      "runPlaybook",
      "triggerCronJob",
    ]) {
      expect(modelStrategyPanelSrc).not.toContain(forbidden);
    }
  });
});

describe("UI Slice 1 purity and safety literals", () => {
  it("all safety invariants remain hard false except no_renderer_wiring and direct_gateway_fix_applied", () => {
    expect(SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS).toEqual({
      no_renderer_wiring: true,
      new_ipc_allowed: false,
      runtime_activation_allowed: false,
      config_writes_allowed_by_contract: false,
      hcc_auto_executor_allowed: false,
      direct_gateway_fix_applied: true,
    });

    const built = result();
    expect(built.safety_invariants).toEqual(
      SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS,
    );
    for (const entry of built.contracts) {
      expect(entry.safety_invariants).toEqual({
        new_ipc_allowed: false,
        runtime_activation_allowed: false,
        config_writes_allowed_by_contract: false,
        hcc_auto_executor_allowed: false,
        direct_gateway_fix_applied: true,
      });
    }
  });

  it("buildScreenBoundaryContract is deterministic and returns fresh mutable copies", () => {
    const first = result();
    const second = result();
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.contracts[0]).not.toBe(second.contracts[0]);
    expect(first.contracts[0].api_methods[0]).not.toBe(
      second.contracts[0].api_methods[0],
    );

    first.contracts[0].notes.push("mutated outside helper");
    expect(result().contracts[0].notes).not.toContain("mutated outside helper");
  });

  it("helper source has no renderer, IPC, network, or runtime call forms", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      ".invoke(",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
      "knowledgeIngest(",
      "knowledgeSearch(",
      "handoff/packs",
      ".hermes/audit",
      "config.yaml",
      "general_availability",
    ]) {
      expect(helperSrc).not.toContain(forbidden);
    }
  });

  it("helper source does not import renderer, main, preload, or Electron modules", () => {
    expect(helperSrc).not.toMatch(/from\s+["'][^"']*renderer[^"']*["']/);
    expect(helperSrc).not.toMatch(/from\s+["'][^"']*preload[^"']*["']/);
    expect(helperSrc).not.toMatch(/from\s+["'][^"']*main[^"']*["']/);
    expect(helperSrc).not.toContain("electron");
  });
});

describe("UI-SAFETY-001 import-graph hardened boundaries", () => {
  const contract = buildScreenBoundaryContract();

  // Unique entry modules for read-only views with import-graph enforcement.
  // Deduplicated: bailongma / hccCockpit share the Mission component.
  const COMPONENT_ENTRIES: Record<string, string> = {
    mission: resolve(ROOT, "src/renderer/src/screens/Mission/Mission.tsx"),
    bailongma: resolve(ROOT, "src/renderer/src/screens/Mission/Mission.tsx"),
    hccCockpit: resolve(ROOT, "src/renderer/src/screens/Mission/Mission.tsx"),
    knowledgeControl: resolve(
      ROOT,
      "src/renderer/src/screens/KnowledgeControl/KnowledgeControl.tsx",
    ),
  };

  const importGraphViews = contract.contracts.filter(
    (c) => c.enforcement === "import-graph",
  );

  const uniqueEntries = [
    ...new Set(
      importGraphViews
        .map((c) => COMPONENT_ENTRIES[c.view])
        .filter(Boolean),
    ),
  ];

  it("every import-graph view has a mapped component entry", () => {
    for (const c of importGraphViews) {
      expect(
        COMPONENT_ENTRIES[c.view],
        `${c.view} has enforcement=import-graph but no COMPONENT_ENTRIES mapping`,
      ).toBeDefined();
    }
  });

  it("all read_only views are import-graph enforced (monitor documented exemption)", () => {
    // monitor has boundary_kind=read_only but enforcement="static-string" by
    // explicit decision (see contract notes: no dedicated monitor boundary
    // test exists yet — tests/monitor-control-readonly.test.ts is the gate
    // to upgrade it). This assertion enforces the invariant for every other
    // read_only view AND asserts that monitor is the ONLY allowed exemption,
    // and that the exemption is documented in the contract.
    let monitorFound = false;
    for (const c of contract.contracts) {
      if (c.boundary_kind !== "read_only") continue;

      if (c.view === "monitor") {
        monitorFound = true;
        expect(c.enforcement, "monitor must be explicitly static-string").toBe(
          "static-string",
        );
        expect(
          c.notes.join("\n"),
          "monitor must carry the documented exemption note",
        ).toMatch(/no dedicated monitor boundary test/);
        continue;
      }

      expect(
        c.enforcement,
        `${c.view} is read_only but enforcement is "${c.enforcement}"`,
      ).toBe("import-graph");
    }
    expect(monitorFound, "monitor view must be present in contracts").toBe(true);
  });

  it("non-read_only views use static-string enforcement (no downgrade)", () => {
    for (const c of contract.contracts) {
      if (c.boundary_kind !== "read_only") {
        expect(
          c.enforcement,
          `${c.view} is non-read_only and must stay at static-string for now`,
        ).toBe("static-string");
      }
    }
  });

  describe("import-graph clean for each read-only screen", () => {
    for (const entry of uniqueEntries) {
      const label = entry.split("src/renderer/src/screens/")[1] ?? entry;

      it(`transitive imports of ${label} contain no forbidden API calls`, () => {
        const modules = getTransitiveImports(entry);

        expect(modules.size).toBeGreaterThan(0);

        for (const mod of modules) {
          // Skip .d.ts declaration files
          if (mod.endsWith(".d.ts")) continue;

          const src = readFileSync(mod, "utf-8");

          // The entry module itself is already checked by existing string-based
          // assertions; the import-graph test focuses on transitive dependencies
          // that the string-based test would miss (wrappers, helpers, etc.).
          if (mod === entry) continue;

          if (FORBIDDEN_RE.test(src)) {
            const match = src.match(FORBIDDEN_RE);
            throw new Error(
              `Import-graph violation in ${mod}: ` +
                `contains forbidden API call \`${match?.[0]?.trim()}\`. ` +
                `This module is transitively imported by ${entry}.`,
            );
          }
        }
      });
    }
  });

  // Negative-fixture: prove import-graph catches what string-based test misses.
  // Creates a real temp entry -> wrapper -> forbidden module chain, then
  // asserts both that getTransitiveImports walks the chain AND that the
  // FORBIDDEN_RE scan flags the forbidden module.
  it("negative fixture: import-graph catches wrapper-then-forbidden chain", () => {
    const { mkdirSync, writeFileSync, rmSync, mkdtempSync } = require("fs");
    const { tmpdir } = require("os");
    const { join, dirname } = require("path");

    // Create isolated temp dir so this test cannot affect real source.
    const tmpDir = mkdtempSync(join(tmpdir(), "ui-safety-negfx-"));

    try {
      // forbidden.ts: a module that calls a forbidden API (ipcRenderer.invoke).
      // This file is NOT in the project source — created fresh for this test.
      const forbidden = join(tmpDir, "forbidden.ts");
      writeFileSync(
        forbidden,
        `// Negative-fixture module: contains a forbidden API call.\n` +
          `// The import-graph + FORBIDDEN_RE scan must flag this file.\n` +
          `export async function run() {\n` +
          `  return await window.hermesAPI.runPlaybook({}) ;\n` +
          `}\n`,
      );

      // wrapper.ts: re-exports from forbidden.ts (the trap).
      // The wrapper itself does NOT contain the literal "window.hermesAPI"
      // call — it only re-exports. String-based scans on `entry.ts` would
      // miss the violation; the import-graph scan must follow the chain.
      const wrapper = join(tmpDir, "wrapper.ts");
      writeFileSync(
        wrapper,
        `// Re-export from forbidden module. Wrapper hides the call.\n` +
          `export { run } from "./forbidden";\n`,
      );

      // entry.ts: the screen entry that imports the wrapper (not forbidden).
      // Same pattern as a real read-only screen: imports a clean-looking
      // component that quietly chains into a forbidden module.
      const entry = join(tmpDir, "entry.ts");
      writeFileSync(
        entry,
        `// Entry screen — appears clean on the surface.\n` +
          `import { run } from "./wrapper";\n` +
          `export function go() { return run(); }\n`,
      );

      // 1. The import graph MUST walk entry -> wrapper -> forbidden.
      const modules = getTransitiveImports(entry);
      expect(modules.has(forbidden), "import-graph must reach forbidden.ts").toBe(
        true,
      );
      expect(modules.has(wrapper), "import-graph must reach wrapper.ts").toBe(
        true,
      );
      expect(modules.has(entry), "import-graph must include entry itself").toBe(
        true,
      );

      // 2. The forbidden module's source MUST match FORBIDDEN_RE.
      const forbiddenSrc = readFileSync(forbidden, "utf-8");
      expect(FORBIDDEN_RE.test(forbiddenSrc)).toBe(true);

      // 3. The wrapper's source MUST NOT match FORBIDDEN_RE (it only re-exports).
      //    This proves string-based scanning on the entry alone would miss
      //    the violation — the wrapper shields the call syntactically.
      const wrapperSrc = readFileSync(wrapper, "utf-8");
      expect(
        FORBIDDEN_RE.test(wrapperSrc),
        "wrapper itself must not contain forbidden literal " +
          "(this proves the test setup hides the call behind re-export)",
      ).toBe(false);

      // 4. The entry's source MUST NOT match FORBIDDEN_RE.
      //    Same reasoning — entry appears clean.
      const entrySrc = readFileSync(entry, "utf-8");
      expect(
        FORBIDDEN_RE.test(entrySrc),
        "entry itself must not contain forbidden literal " +
          "(this proves the test setup hides the call behind a wrapper)",
      ).toBe(false);

      // 5. The wrapper resolves to a tmp path under the configured
      //    SRC-root filter, so a real call would scan it too.
      //    (Confirm the helper only includes existing files.)
      expect(modules.size).toBeGreaterThanOrEqual(3);
    } finally {
      // Clean up the temp dir regardless of pass/fail.
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // Negative-fixture (deeply nested): the import graph MUST follow
  // require() and dynamic import() calls that are wrapped in functions,
  // methods, or IIFEs — not just top-level statements. This is the case
  // a top-level-only AST walk would silently miss.
  it("negative fixture: import-graph follows wrapped require() and dynamic import()", () => {
    const { mkdirSync, writeFileSync, rmSync, mkdtempSync } = require("fs");
    const { tmpdir } = require("os");
    const { join } = require("path");

    const tmpDir = mkdtempSync(join(tmpdir(), "ui-safety-negfx-nested-"));

    try {
      // forbidden.ts — same as previous fixture.
      const forbidden = join(tmpDir, "forbidden.ts");
      writeFileSync(
        forbidden,
        `// Nested-call fixture: contains a forbidden API call.\n` +
          `export async function run() {\n` +
          `  return await window.hermesAPI.runPlaybook({}) ;\n` +
          `}\n`,
      );

      // forbidden-2.ts — second module loaded via dynamic import.
      const forbidden2 = join(tmpDir, "forbidden-2.ts");
      writeFileSync(
        forbidden2,
        `// Dynamic-import fixture: contains a forbidden API call.\n` +
          `export async function trigger() {\n` +
          `  return await window.hermesAPI.sendMessage({}) ;\n` +
          `}\n`,
      );

      // wrapper.ts — calls require() inside a function (NOT at top level).
      // A top-level-only AST walk would never visit this require().
      const wrapper = join(tmpDir, "wrapper.ts");
      writeFileSync(
        wrapper,
        `// Function-wrapped require: the call sits inside load(),\n` +
          `// never at the top level of this file.\n` +
          `export function load() {\n` +
          `  // eslint-disable-next-line @typescript-eslint/no-require-imports\n` +
          `  const mod = require("./forbidden");\n` +
          `  return mod;\n` +
          `}\n` +
          `\n` +
          `export async function loadAsync() {\n` +
          `  // Dynamic import inside an async function — also nested.\n` +
          `  const mod = await import("./forbidden-2");\n` +
          `  return mod;\n` +
          `}\n`,
      );

      // entry.ts — clean-looking surface, imports the wrapper.
      const entry = join(tmpDir, "entry.ts");
      writeFileSync(
        entry,
        `// Clean entry: only the wrapper is visible at the top level.\n` +
          `import { load, loadAsync } from "./wrapper";\n` +
          `export async function go() {\n` +
          `  await load();\n` +
          `  await loadAsync();\n` +
          `}\n`,
      );

      // 1. The import graph MUST follow the wrapped require() and
      //    dynamic import() calls — even though they are not at the
      //    top level of wrapper.ts.
      const modules = getTransitiveImports(entry);
      expect(
        modules.has(forbidden),
        "import-graph must reach forbidden.ts via require() inside a function",
      ).toBe(true);
      expect(
        modules.has(forbidden2),
        "import-graph must reach forbidden-2.ts via dynamic import() inside an async function",
      ).toBe(true);
      expect(
        modules.has(wrapper),
        "import-graph must reach wrapper.ts",
      ).toBe(true);

      // 2. Both forbidden modules' sources MUST match FORBIDDEN_RE.
      //    (The whole point: the import-graph walks them, so a caller
      //    using assertImportGraphClean() would catch the violation.)
      expect(FORBIDDEN_RE.test(readFileSync(forbidden, "utf-8"))).toBe(true);
      expect(FORBIDDEN_RE.test(readFileSync(forbidden2, "utf-8"))).toBe(true);

      // 3. The wrapper source contains the call to require("./forbidden")
      //    and import("./forbidden-2") syntactically, but those are
      //    import statements, not the FORBIDDEN_RE pattern itself. The
      //    wrapper MUST NOT contain a direct forbidden API call —
      //    otherwise the fixture doesn't actually test the deep walk.
      const wrapperSrc = readFileSync(wrapper, "utf-8");
      expect(
        FORBIDDEN_RE.test(wrapperSrc),
        "wrapper must not contain a direct forbidden API call " +
          "(it only references forbidden modules via require/import)",
      ).toBe(false);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
