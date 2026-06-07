// UI Slice 5 write-action visual gating descriptor invariants.
// Pure static checks: every view produces a state; read-only screens have
// has_write_action false; write-capable screens have explicit_user_action
// true; P0 + direct_gateway screens flag direct_gateway_risk; safety
// literals are hard-coded; helper source has no IPC / runtime form.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildScreenBoundaryContract,
  type ScreenViewId,
} from "../src/shared/lib/screen-boundary-contract";
import {
  buildAllWriteActionDisplayStates,
  buildWriteActionDisplayState,
  getWriteActionDisplayState,
  type WriteActionDisplayState,
} from "../src/renderer/src/screens/Layout/write-action-display-state";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/write-action-display-state.ts"),
  "utf-8",
);

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

const STATE_BY_VIEW: Readonly<Record<ScreenViewId, WriteActionDisplayState>> =
  Object.fromEntries(
    buildAllWriteActionDisplayStates().map((state) => [state.view, state]),
  ) as Readonly<Record<ScreenViewId, WriteActionDisplayState>>;

function stateFor(view: ScreenViewId): WriteActionDisplayState {
  const state = STATE_BY_VIEW[view];
  if (!state) throw new Error(`missing state for ${view}`);
  return state;
}

const EXPECTED_SAFETY = {
  ui_only: true,
  disables_actions: false,
  runtime_activation_allowed: false,
  ipc_allowed: false,
  config_write_allowed_by_descriptor: false,
} as const;

describe("UI Slice 5 display state shape", () => {
  it("emits a state for every one of the 21 views", () => {
    const all = buildAllWriteActionDisplayStates();
    expect(all).toHaveLength(21);
    for (const view of CANONICAL_ORDER) {
      const state = stateFor(view);
      expect(state.view).toBe(view);
      expect(state.display_label.length).toBeGreaterThan(0);
      expect(state.short_copy).toContain(`risk=${state.risk_level}`);
    }
  });

  it("buildWriteActionDisplayState and getWriteActionDisplayState agree on shape", () => {
    const sample = buildScreenBoundaryContract().contracts[0]!;
    const direct = buildWriteActionDisplayState(sample);
    const viaLookup = getWriteActionDisplayState(sample.view);
    expect(viaLookup).toEqual(direct);
  });
});

describe("UI Slice 5 read-only view classification", () => {
  it("hccCockpit / bailongma / mission / monitor are read-only and have no write action", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
    ] as const) {
      const state = stateFor(view);
      expect(state.boundary_kind).toBe("read_only");
      expect(state.has_write_action).toBe(false);
      expect(state.write_action_kind).toBe("none");
      expect(state.explicit_user_action_required).toBe(false);
      expect(state.needs_future_gating).toBe(false);
      expect(state.write_surfaces).toEqual([]);
      expect(state.short_copy).toBe("No write surfaces registered · risk=P3");
      expect(state.badge_tone).toBe("neutral");
    }
  });
});

describe("UI Slice 5 write-capable view classification", () => {
  it("providers is read_write_config / P1 / has_write_action / explicit_user_action", () => {
    const state = stateFor("providers");
    expect(state.boundary_kind).toBe("read_write_config");
    expect(state.risk_level).toBe("P1");
    expect(state.has_write_action).toBe(true);
    expect(state.write_action_kind).toBe("config");
    expect(state.explicit_user_action_required).toBe(true);
    expect(state.needs_future_gating).toBe(true);
    expect(state.write_surfaces).toEqual(
      expect.arrayContaining(["credential_pool", "provider_config"]),
    );
    expect(state.short_copy).toBe(
      "Config write surfaces present · risk=P1",
    );
  });

  it("chat is mixed / P1 with llm_inference + chat_runtime_config", () => {
    const state = stateFor("chat");
    expect(state.boundary_kind).toBe("mixed");
    expect(state.risk_level).toBe("P1");
    expect(state.write_action_kind).toBe("mixed");
    expect(state.write_surfaces).toEqual(
      expect.arrayContaining(["llm_inference", "chat_runtime_config"]),
    );
  });

  it("schedules is read_write_runtime / P1 with cron surfaces", () => {
    const state = stateFor("schedules");
    expect(state.boundary_kind).toBe("read_write_runtime");
    expect(state.risk_level).toBe("P1");
    expect(state.write_action_kind).toBe("runtime");
    expect(state.write_surfaces).toEqual(
      expect.arrayContaining(["cron_management", "manual_cron_trigger"]),
    );
  });

  it("gateway is mixed / P1 with gateway_lifecycle", () => {
    const state = stateFor("gateway");
    expect(state.boundary_kind).toBe("mixed");
    expect(state.risk_level).toBe("P1");
    expect(state.write_action_kind).toBe("mixed");
    expect(state.write_surfaces).toContain("gateway_lifecycle");
  });
});

describe("UI Slice 5 P0 + direct_gateway risk surfacing", () => {
  it("knowledge is mixed / no direct_gateway_risk after IPC migration closeout", () => {
    const state = stateFor("knowledge");
    expect(state.boundary_kind).toBe("mixed");
    expect(state.risk_level).not.toBe("P0");
    expect(state.direct_gateway_risk).toBe(false);
    expect(state.direct_gateway_methods).toEqual([]);
    expect(state.migrated_ipc_methods).toEqual(
      expect.arrayContaining([
        "knowledgeSearch",
        "knowledgeIngest",
        "getGbrainStats",
      ]),
    );
  });

  it("knowledgeControl is read_only / no direct_gateway_risk after IPC migration closeout", () => {
    const state = stateFor("knowledgeControl");
    expect(state.boundary_kind).toBe("read_only");
    expect(state.risk_level).not.toBe("P0");
    expect(state.write_action_kind).toBe("none");
    expect(state.direct_gateway_risk).toBe(false);
    expect(state.direct_gateway_methods).toEqual([]);
    expect(state.migrated_ipc_methods).toEqual(
      expect.arrayContaining(["knowledgeSearch", "getGbrainStats"]),
    );
  });

  it("non-P0 screens have direct_gateway_risk false", () => {
    for (const view of CANONICAL_ORDER) {
      const state = stateFor(view);
      if (state.risk_level !== "P0") {
        expect(state.direct_gateway_risk).toBe(false);
      }
    }
  });
});

describe("UI Slice 5 safety literals & source purity", () => {
  it("every state carries the hard-coded safety block (ui_only true, all others false)", () => {
    for (const view of CANONICAL_ORDER) {
      const state = stateFor(view);
      expect(state.safety).toEqual(EXPECTED_SAFETY);
    }
  });

  it("write-action-display-state.ts contains no IPC, fetch, or hermesAPI", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      "setModelConfig(",
      "setEnv(",
      "startGateway(",
      "runPlaybook(",
      "triggerCronJob(",
    ]) {
      expect(helperSrc).not.toContain(forbidden);
    }
  });
});
