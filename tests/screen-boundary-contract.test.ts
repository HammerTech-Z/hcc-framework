import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

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
  it("uses schema 1.0.0 and emits 21 Layout view contracts", () => {
    const built = result();
    expect(SCREEN_BOUNDARY_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(SCREEN_BOUNDARY_CONTRACT_VIEW_COUNT).toBe(21);
    expect(built.schema_version).toBe("1.0.0");
    expect(built.mode).toBe("ui_slice_1_contract_descriptor");
    expect(built.view_count).toBe(21);
    expect(built.contracts).toHaveLength(21);
  });

  it("matches the actual Layout NAV_GROUPS order", () => {
    expect(extractLayoutNavViews()).toEqual([...CANONICAL_LAYOUT_ORDER]);
    expect(result().contracts.map((entry) => entry.view)).toEqual([
      ...CANONICAL_LAYOUT_ORDER,
    ]);
  });

  it("each contract view appears in Layout paneStyle rendering", () => {
    for (const view of CANONICAL_LAYOUT_ORDER) {
      expect(layoutSrc).toContain(`paneStyle("${view}")`);
    }
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
      Work: 6,
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
      knowledgeControl: "external_action",
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
  it("registers knowledgeSearch and knowledgeIngest direct gateway methods as P0", () => {
    const knowledge = byView("knowledge");
    expect(knowledge.risk_level).toBe("P0");
    expect(knowledge.direct_gateway_methods).toEqual(
      expect.arrayContaining(["knowledgeSearch", "knowledgeIngest"]),
    );
    expect(
      knowledge.api_methods.filter((method) => method.direct_gateway).map(
        (method) => method.name,
      ),
    ).toEqual(
      expect.arrayContaining([
        "getGbrainStats",
        "knowledgeSearch",
        "knowledgeIngest",
      ]),
    );

    const knowledgeControl = byView("knowledgeControl");
    expect(knowledgeControl.risk_level).toBe("P0");
    expect(knowledgeControl.direct_gateway_methods).toEqual(["knowledgeSearch"]);
  });

  it("does not claim the direct gateway issue is fixed", () => {
    expect(SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS.direct_gateway_fix_applied)
      .toBe(false);
    expect(result().safety_invariants.direct_gateway_fix_applied).toBe(false);
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
  it("all safety invariants remain hard false except no_renderer_wiring", () => {
    expect(SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS).toEqual({
      no_renderer_wiring: true,
      new_ipc_allowed: false,
      runtime_activation_allowed: false,
      config_writes_allowed_by_contract: false,
      hcc_auto_executor_allowed: false,
      direct_gateway_fix_applied: false,
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
        direct_gateway_fix_applied: false,
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
