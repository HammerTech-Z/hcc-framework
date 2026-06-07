// UI Slice 6 Inspector write-action integration invariants.
// Static checks: Slice 5 helper is the single source for the Inspector
// write-action section; Layout.tsx passes the descriptor through;
// per-view display matches Slice 5 contract; boundary-inspector.tsx
// stays free of IPC and runtime form; Layout.tsx stays free of new
// runtime-config write call forms.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildScreenBoundaryContract,
  type ScreenViewId,
} from "../src/shared/lib/screen-boundary-contract";
import {
  getWriteActionDisplayState,
  type WriteActionDisplayState,
} from "../src/renderer/src/screens/Layout/write-action-display-state";
import {
  buildBoundaryInspectorDescriptor,
  type BoundaryInspectorDescriptor,
} from "../src/renderer/src/screens/Layout/boundary-inspector";

const ROOT = join(__dirname, "..");
const boundaryInspectorSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/boundary-inspector.tsx"),
  "utf-8",
);
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
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

const WRITE_ACTION_BY_VIEW: Readonly<
  Record<ScreenViewId, WriteActionDisplayState>
> = Object.fromEntries(
  CANONICAL_ORDER.map((view) => [view, getWriteActionDisplayState(view)!]),
) as Readonly<Record<ScreenViewId, WriteActionDisplayState>>;

const INSPECTOR_BY_VIEW: Readonly<
  Record<ScreenViewId, BoundaryInspectorDescriptor>
> = Object.fromEntries(
  buildScreenBoundaryContract().contracts.map((entry) => [
    entry.view,
    buildBoundaryInspectorDescriptor(
      entry,
      getWriteActionDisplayState(entry.view)!,
    ),
  ]),
) as Readonly<Record<ScreenViewId, BoundaryInspectorDescriptor>>;

function writeAction(view: ScreenViewId): WriteActionDisplayState {
  return WRITE_ACTION_BY_VIEW[view];
}
function inspector(view: ScreenViewId): BoundaryInspectorDescriptor {
  return INSPECTOR_BY_VIEW[view];
}

describe("UI Slice 6 inspector write-action wiring", () => {
  it("Layout.tsx imports getWriteActionDisplayState and forwards it to the inspector descriptor", () => {
    expect(layoutSrc).toContain("getWriteActionDisplayState");
    expect(layoutSrc).toContain("buildBoundaryInspectorDescriptor");
  });

  it("inspector descriptor for every view carries the matching write_action slice-5 state", () => {
    for (const view of CANONICAL_ORDER) {
      expect(inspector(view).write_action).toEqual(writeAction(view));
    }
  });
});

describe("UI Slice 6 inspector write-action per-view classification", () => {
  it("hccCockpit / bailongma / mission / monitor show no write action", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
    ] as const) {
      const wa = inspector(view).write_action;
      expect(wa.has_write_action).toBe(false);
      expect(wa.write_action_kind).toBe("none");
      expect(wa.explicit_user_action_required).toBe(false);
      expect(wa.needs_future_gating).toBe(false);
      expect(wa.write_surfaces).toEqual([]);
    }
  });

  it("providers inspector write action shows config / P1 / explicit user action required", () => {
    const wa = inspector("providers").write_action;
    expect(wa.has_write_action).toBe(true);
    expect(wa.write_action_kind).toBe("config");
    expect(wa.explicit_user_action_required).toBe(true);
    expect(wa.risk_level).toBe("P1");
    expect(wa.write_surfaces).toEqual(
      expect.arrayContaining(["credential_pool", "provider_config"]),
    );
  });

  it("chat inspector write action shows mixed / P1 with llm_inference surface", () => {
    const wa = inspector("chat").write_action;
    expect(wa.write_action_kind).toBe("mixed");
    expect(wa.risk_level).toBe("P1");
    expect(wa.write_surfaces).toContain("llm_inference");
  });

  it("schedules inspector write action shows runtime / P1 with cron surfaces", () => {
    const wa = inspector("schedules").write_action;
    expect(wa.write_action_kind).toBe("runtime");
    expect(wa.risk_level).toBe("P1");
    expect(wa.write_surfaces).toEqual(
      expect.arrayContaining(["cron_management", "manual_cron_trigger"]),
    );
  });

  it("knowledge inspector write action shows no P0 / no direct_gateway risk after IPC migration closeout", () => {
    const wa = inspector("knowledge").write_action;
    expect(wa.risk_level).not.toBe("P0");
    expect(wa.direct_gateway_risk).toBe(false);
    expect(wa.direct_gateway_methods).toEqual([]);
    expect(wa.migrated_ipc_methods).toEqual(
      expect.arrayContaining([
        "knowledgeSearch",
        "knowledgeIngest",
        "getGbrainStats",
      ]),
    );
  });

  it("knowledgeControl inspector write action shows no P0 / no direct_gateway risk after IPC migration closeout", () => {
    const wa = inspector("knowledgeControl").write_action;
    expect(wa.risk_level).not.toBe("P0");
    expect(wa.write_action_kind).toBe("none");
    expect(wa.direct_gateway_risk).toBe(false);
    expect(wa.direct_gateway_methods).toEqual([]);
    expect(wa.migrated_ipc_methods).toEqual(
      expect.arrayContaining(["knowledgeSearch", "getGbrainStats"]),
    );
  });
});

describe("UI Slice 6 component surface & source purity", () => {
  it("boundary-inspector.tsx exposes the write-action section with required testids", () => {
    expect(boundaryInspectorSrc).toContain("Write action state");
    expect(boundaryInspectorSrc).toContain(
      "inspector-write-action-state",
    );
    expect(boundaryInspectorSrc).toContain(
      "inspector-write-action-summary",
    );
    expect(boundaryInspectorSrc).toContain(
      "inspector-write-action-fields",
    );
    expect(boundaryInspectorSrc).toContain(
      "inspector-write-action-no-surfaces",
    );
    expect(boundaryInspectorSrc).toContain(
      "inspector-write-action-direct-gateway",
    );
  });

  it("boundary-inspector.tsx contains no IPC, fetch, or hermesAPI", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
    ]) {
      expect(boundaryInspectorSrc).not.toContain(forbidden);
    }
  });

  it("Layout.tsx contains no new runtime-config write call forms", () => {
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
