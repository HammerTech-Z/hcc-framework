// UI Slice 4 Layout boundary inspector invariants.
// Static checks: every view produces a descriptor; read-only / write-capable
// classifications match UI Slice 1; P0 + direct_gateway views surface risk
// methods + clear banner; helper has no IPC; Layout.tsx stays free of new
// runtime-config writes.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildScreenBoundaryContract,
  type ScreenViewId,
} from "../src/shared/lib/screen-boundary-contract";
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

const VIEW_TO_DESCRIPTOR: Readonly<
  Record<ScreenViewId, () => BoundaryInspectorDescriptor>
> = Object.fromEntries(
  buildScreenBoundaryContract().contracts.map((entry) => [
    entry.view,
    () => buildBoundaryInspectorDescriptor(entry),
  ]),
) as Readonly<Record<ScreenViewId, () => BoundaryInspectorDescriptor>>;

function descriptorFor(view: ScreenViewId): BoundaryInspectorDescriptor {
  return VIEW_TO_DESCRIPTOR[view]();
}

describe("UI Slice 4 inspector descriptor shape", () => {
  it("emits a descriptor for every one of the 21 views", () => {
    for (const view of CANONICAL_ORDER) {
      const d = descriptorFor(view);
      expect(d.view).toBe(view);
      expect(d.display_label.length).toBeGreaterThan(0);
      expect(d.api_methods_count).toBeGreaterThanOrEqual(0);
      expect(d.mutating_methods_count).toBeLessThanOrEqual(d.api_methods_count);
    }
  });

  it("replaces the static 'Future use' and static 'UI slice guardrails' text in Layout.tsx", () => {
    expect(layoutSrc).not.toContain(
      "UI slice guardrails. No new IPC or runtime action.",
    );
    expect(layoutSrc).not.toContain(
      "References, provenance, run details, and safety context.",
    );
    // Inspector is wired in.
    expect(layoutSrc).toContain("BoundaryInspectorPanel");
    expect(layoutSrc).toContain("buildBoundaryInspectorDescriptor");
  });
});

describe("UI Slice 4 inspector per-view classification", () => {
  it("hccCockpit / bailongma / mission / monitor show read_only + no write surfaces", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
    ] as const) {
      const d = descriptorFor(view);
      expect(d.boundary_kind).toBe("read_only");
      expect(d.risk_level).toBe("P3");
      expect(d.write_surfaces).toEqual([]);
      expect(d.mutating_methods_count).toBe(0);
    }
  });

  it("providers shows read_write_config + P1 + credential/model config write surfaces", () => {
    const d = descriptorFor("providers");
    expect(d.boundary_kind).toBe("read_write_config");
    expect(d.risk_level).toBe("P1");
    expect(d.write_surfaces).toEqual(
      expect.arrayContaining([
        "credential_pool",
        "provider_config",
        "model_config",
      ]),
    );
    expect(d.mutating_methods_count).toBeGreaterThan(0);
  });

  it("chat shows mixed + P1 + mutating methods", () => {
    const d = descriptorFor("chat");
    expect(d.boundary_kind).toBe("mixed");
    expect(d.risk_level).toBe("P1");
    expect(d.write_surfaces).toEqual(
      expect.arrayContaining([
        "llm_inference",
        "chat_abort",
        "chat_runtime_config",
      ]),
    );
    expect(d.mutating_methods_count).toBeGreaterThan(0);
  });

  it("knowledge shows P0 + direct_gateway_methods include knowledgeSearch / knowledgeIngest", () => {
    const d = descriptorFor("knowledge");
    expect(d.risk_level).toBe("P0");
    expect(d.direct_gateway_methods).toEqual(
      expect.arrayContaining(["knowledgeSearch", "knowledgeIngest"]),
    );
    // Banner text path covered by component source check below.
  });

  it("knowledgeControl shows P0 + direct_gateway_methods include knowledgeSearch", () => {
    const d = descriptorFor("knowledgeControl");
    expect(d.risk_level).toBe("P0");
    expect(d.direct_gateway_methods).toContain("knowledgeSearch");
  });

  it("read_only views also carry a notes / safety invariant block", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
    ] as const) {
      const d = descriptorFor(view);
      expect(d.notes.length).toBeGreaterThan(0);
      expect(d.safety_invariants.new_ipc_allowed).toBe(false);
      expect(d.safety_invariants.runtime_activation_allowed).toBe(false);
      expect(d.safety_invariants.hcc_auto_executor_allowed).toBe(false);
    }
  });
});

describe("UI Slice 4 inspector component & source purity", () => {
  it("boundary-inspector.tsx renders direct gateway banner for P0 + direct_gateway views", () => {
    // Banner label is present and shows the joined method list.
    expect(boundaryInspectorSrc).toContain("Direct gateway risk");
    expect(boundaryInspectorSrc).toContain("direct gateway:");
    expect(boundaryInspectorSrc).toContain("direct_gateway_methods.join");
    // read-only banner path present.
    expect(boundaryInspectorSrc).toContain("Read-only");
    expect(boundaryInspectorSrc).toContain("no write surfaces");
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
