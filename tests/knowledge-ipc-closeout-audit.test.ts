// Knowledge IPC Migration Closeout Audit tests.
// Verifies the final post-migration state across preload, screen
// boundary contract, write-action display, and badge descriptor.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildScreenBoundaryContract,
  SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS,
} from "../src/shared/lib/screen-boundary-contract";
import { buildWriteActionDisplayState } from "../src/renderer/src/screens/Layout/write-action-display-state";
import {
  buildBoundaryBadgeDescriptor,
  buildBoundaryBadgeTitle,
} from "../src/renderer/src/screens/Layout/boundary-badge";

const ROOT = join(__dirname, "..");
const preloadSrc = readFileSync(
  join(ROOT, "src/preload/index.ts"),
  "utf-8",
);

const result = buildScreenBoundaryContract();

function byView(view: string) {
  const found = result.contracts.find((c) => c.view === view);
  if (!found) throw new Error(`view not found: ${view}`);
  return found;
}

describe("Knowledge IPC Migration Closeout Audit", () => {
  it("preload source no longer contains any /knowledge raw gateway URL", () => {
    expect(preloadSrc.includes("http://127.0.0.1:8643/knowledge")).toBe(false);
  });

  it("preload source uses ipcRenderer.invoke for all 3 knowledge channels", () => {
    expect(preloadSrc).toContain('ipcRenderer.invoke("knowledge-search"');
    expect(preloadSrc).toContain('ipcRenderer.invoke("knowledge-ingest"');
    expect(preloadSrc).toContain('ipcRenderer.invoke("knowledge-stats"');
  });

  it("knowledge view has no active direct_gateway_methods", () => {
    const knowledge = byView("knowledge");
    expect(knowledge.direct_gateway_methods).toEqual([]);
    expect(knowledge.risk_level).not.toBe("P0");
    expect(knowledge.migrated_ipc_methods).toEqual(
      expect.arrayContaining([
        "knowledgeSearch",
        "knowledgeIngest",
        "getGbrainStats",
      ]),
    );
  });

  it("knowledgeControl view has no active direct_gateway_methods", () => {
    const knowledgeControl = byView("knowledgeControl");
    expect(knowledgeControl.direct_gateway_methods).toEqual([]);
    expect(knowledgeControl.risk_level).not.toBe("P0");
    expect(knowledgeControl.migrated_ipc_methods).toEqual(
      expect.arrayContaining(["knowledgeSearch", "getGbrainStats"]),
    );
  });

  it("knowledge view api_methods no longer carry the direct_gateway flag", () => {
    const knowledge = byView("knowledge");
    const offenders = knowledge.api_methods.filter((m) => m.direct_gateway);
    expect(offenders).toEqual([]);
  });

  it("knowledgeControl view api_methods no longer carry the direct_gateway flag", () => {
    const knowledgeControl = byView("knowledgeControl");
    const offenders = knowledgeControl.api_methods.filter(
      (m) => m.direct_gateway,
    );
    expect(offenders).toEqual([]);
  });

  it("write-action display state for knowledge reports no direct_gateway risk", () => {
    const knowledge = byView("knowledge");
    const state = buildWriteActionDisplayState(knowledge);
    expect(state.direct_gateway_risk).toBe(false);
    expect(state.direct_gateway_methods).toEqual([]);
    expect(state.migrated_ipc_methods.length).toBeGreaterThan(0);
  });

  it("write-action display state for knowledgeControl reports no direct_gateway risk", () => {
    const knowledgeControl = byView("knowledgeControl");
    const state = buildWriteActionDisplayState(knowledgeControl);
    expect(state.direct_gateway_risk).toBe(false);
    expect(state.direct_gateway_methods).toEqual([]);
    expect(state.migrated_ipc_methods.length).toBeGreaterThan(0);
  });

  it("boundary badge for knowledge does not show P0 direct-gateway callout", () => {
    const knowledge = byView("knowledge");
    const descriptor = buildBoundaryBadgeDescriptor(knowledge);
    expect(descriptor.direct_gateway_risk).toBe(false);
    const title = buildBoundaryBadgeTitle(descriptor);
    expect(title).not.toContain("Direct gateway methods:");
    expect(title).not.toContain("IPC migration not applied");
    expect(title).toContain("IPC bridge active");
  });

  it("boundary badge for knowledgeControl does not show P0 direct-gateway callout", () => {
    const knowledgeControl = byView("knowledgeControl");
    const descriptor = buildBoundaryBadgeDescriptor(knowledgeControl);
    expect(descriptor.direct_gateway_risk).toBe(false);
    const title = buildBoundaryBadgeTitle(descriptor);
    expect(title).not.toContain("Direct gateway methods:");
    expect(title).toContain("IPC bridge active");
  });

  it("knowledge view remains write-capable for knowledgeIngest", () => {
    // The migration removed the direct-gateway bypass, not the write
    // capability itself. knowledgeIngest is still a write path that
    // must only be triggered by explicit user action.
    const knowledge = byView("knowledge");
    const ingest = knowledge.api_methods.find(
      (m) => m.name === "knowledgeIngest",
    );
    expect(ingest).toBeDefined();
    expect(ingest!.mutates).toBe(true);
    expect(knowledge.write_surfaces).toContain(
      "knowledge_ingest_explicit_user_action",
    );
  });

  it("SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS declares direct gateway fix applied", () => {
    // Knowledge IPC Migration Closeout flipped the global
    // direct_gateway_fix_applied from false to true. All other safety
    // invariants remain locked to their original UI Slice 1 values.
    expect(SCREEN_BOUNDARY_CONTRACT_SAFETY_LITERALS).toEqual({
      no_renderer_wiring: true,
      new_ipc_allowed: false,
      runtime_activation_allowed: false,
      config_writes_allowed_by_contract: false,
      hcc_auto_executor_allowed: false,
      direct_gateway_fix_applied: true,
    });
  });

  it("buildScreenBoundaryContract result safety_invariants.direct_gateway_fix_applied is true", () => {
    const built = buildScreenBoundaryContract();
    expect(built.safety_invariants.direct_gateway_fix_applied).toBe(true);
  });

  it("every contract safety_invariants.direct_gateway_fix_applied is true", () => {
    const built = buildScreenBoundaryContract();
    for (const entry of built.contracts) {
      expect(entry.safety_invariants.direct_gateway_fix_applied).toBe(true);
    }
  });
});
