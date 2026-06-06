// UI Slice 2 Layout route/map table invariants.
// 16 asserts across 7 groups. All asserts are string/file-level — no React
// render, no IPC, no live state. Pure hermetic static checks.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  LAYOUT_ROUTES,
  LAYOUT_REMOTE_RESTRICTED_VIEWS,
  type LayoutViewId,
} from "../src/renderer/src/screens/Layout/layout-routes";
import {
  buildScreenBoundaryContract,
  type ScreenViewId,
} from "../src/shared/lib/screen-boundary-contract";

const ROOT = join(__dirname, "..");
const layoutRoutesSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/layout-routes.tsx"),
  "utf-8",
);
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);
const modelStrategyPanelSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/HccCockpit/ModelStrategyDryRunPanel.tsx"),
  "utf-8",
);

// UI Slice 1 canonical order — must match CONTRACTS view order.
const CANONICAL_ORDER: readonly ScreenViewId[] = [
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
];

const EXPECTED_REMOTE_RESTRICTED: readonly LayoutViewId[] = [
  "sessions",
  "agents",
  "providers",
  "skills",
  "soul",
  "memory",
  "knowledgeControl",
  "knowledge",
  "tools",
  "gateway",
  "monitor",
];

describe("UI Slice 2 route table shape", () => {
  it("emits exactly 21 routes", () => {
    expect(LAYOUT_ROUTES).toHaveLength(21);
  });

  it("matches UI Slice 1 CONTRACTS view order exactly", () => {
    const contractOrder = buildScreenBoundaryContract().contracts.map(
      (entry) => entry.view,
    );
    expect(contractOrder).toEqual([...CANONICAL_ORDER]);
    expect(LAYOUT_ROUTES.map((r) => r.view)).toEqual([...CANONICAL_ORDER]);
  });

  it("has no duplicate views and the view set covers all 21 unique views", () => {
    const views = LAYOUT_ROUTES.map((r) => r.view);
    expect(new Set(views).size).toBe(21);
    expect(new Set(views)).toEqual(new Set(CANONICAL_ORDER));
  });

  it("preserves the four sidebar group counts (Work 6 / Knowledge 5 / Agents 4 / System 6)", () => {
    const counts: Record<string, number> = {};
    for (const route of LAYOUT_ROUTES) {
      counts[route.sidebar_group] = (counts[route.sidebar_group] ?? 0) + 1;
    }
    expect(counts).toEqual({
      Work: 6,
      Knowledge: 5,
      Agents: 4,
      System: 6,
    });
  });
});

describe("UI Slice 2 lazy mount policy", () => {
  it("chat is the only non-lazy route (lazy: false)", () => {
    const nonLazy = LAYOUT_ROUTES.filter((r) => r.lazy === false);
    expect(nonLazy.map((r) => r.view)).toEqual(["chat"]);
    const chat = LAYOUT_ROUTES.find((r) => r.view === "chat");
    expect(chat?.lazy).toBe(false);
  });

  it("the other 20 routes are lazy: true", () => {
    const lazyViews = LAYOUT_ROUTES.filter((r) => r.lazy === true).map(
      (r) => r.view,
    );
    expect(lazyViews).toHaveLength(20);
    expect(new Set(lazyViews)).toEqual(
      new Set(CANONICAL_ORDER.filter((v) => v !== "chat")),
    );
  });
});

describe("UI Slice 2 remote notice guards", () => {
  it("has exactly 11 routes with remote_notice_feature set", () => {
    const withNotice = LAYOUT_ROUTES.filter(
      (r) => r.remote_notice_feature !== null,
    );
    expect(withNotice).toHaveLength(11);
  });

  it("remote restricted view set matches expected 11 views exactly", () => {
    expect([...LAYOUT_REMOTE_RESTRICTED_VIEWS].sort()).toEqual(
      [...EXPECTED_REMOTE_RESTRICTED].sort(),
    );
    for (const view of EXPECTED_REMOTE_RESTRICTED) {
      const route = LAYOUT_ROUTES.find((r) => r.view === view);
      expect(route?.remote_notice_feature).not.toBeNull();
    }
    for (const route of LAYOUT_ROUTES) {
      if (route.remote_notice_feature !== null) {
        expect(EXPECTED_REMOTE_RESTRICTED).toContain(route.view);
      }
    }
  });
});

describe("UI Slice 2 legacy Mission aliases", () => {
  it("mission / bailongma / hccCockpit all use Mission component with distinct legacy_source", () => {
    const mission = LAYOUT_ROUTES.find((r) => r.view === "mission");
    const bailongma = LAYOUT_ROUTES.find((r) => r.view === "bailongma");
    const hcc = LAYOUT_ROUTES.find((r) => r.view === "hccCockpit");
    expect(mission?.component_name).toBe("Mission");
    expect(bailongma?.component_name).toBe("Mission");
    expect(hcc?.component_name).toBe("Mission");
    expect(mission?.legacy_source).toBeNull();
    expect(bailongma?.legacy_source).toBe("bailongma");
    expect(hcc?.legacy_source).toBe("hcc");
  });

  it("office route carries visible prop semantics via source guard", () => {
    const office = LAYOUT_ROUTES.find((r) => r.view === "office");
    expect(office?.component_name).toBe("Office");
    // renderOffice forwards activeView === "office" as the `visible` prop.
    expect(layoutRoutesSrc).toMatch(
      /function\s+renderOffice\b[\s\S]*?Office\s+visible[\s\S]*?activeView\s*===\s*"office"/,
    );
  });
});

describe("UI Slice 2 Layout.tsx refactor cleanup", () => {
  it("no longer contains 21 hand-written paneStyle(\"view\") blocks", () => {
    // paneStyle function definition is allowed; per-view invocations are not.
    for (const view of CANONICAL_ORDER) {
      expect(layoutSrc).not.toContain(`paneStyle("${view}")`);
    }
    // paneStyle helper must still exist.
    expect(layoutSrc).toMatch(/paneStyle\s*=\s*\(/);
  });

  it("no longer contains 21 hand-written visitedViews.has(\"view\") blocks", () => {
    for (const view of CANONICAL_ORDER) {
      expect(layoutSrc).not.toContain(`visitedViews.has("${view}")`);
    }
    // Generic visitedViews.has(route.view) is allowed.
    expect(layoutSrc).toContain("visitedViews.has(route.view)");
  });
});

describe("UI Slice 2 source purity", () => {
  // Strip comments before purity checks so doc text mentioning the forbidden
  // names does not trip the assertion.
  const codeOnly = layoutRoutesSrc
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("layout-routes.tsx contains no IPC, fetch, or hermesAPI", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
    ]) {
      expect(codeOnly).not.toContain(forbidden);
    }
  });

  it("Layout.tsx contains no new fetch / ipcRenderer / ipcMain / runtime config write calls", () => {
    for (const forbidden of [
      "fetch(",
      "ipcRenderer",
      "ipcMain",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
    ]) {
      expect(layoutSrc).not.toContain(forbidden);
    }
  });
});

describe("UI Slice 2 cross-slice regression", () => {
  it("screen-boundary-contract descriptor still emits 21 view contracts in canonical order", () => {
    const built = buildScreenBoundaryContract();
    expect(built.contracts).toHaveLength(21);
    expect(built.contracts.map((c) => c.view)).toEqual([...CANONICAL_ORDER]);
  });

  it("ModelStrategyDryRunPanel source guard remains zero IPC", () => {
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
