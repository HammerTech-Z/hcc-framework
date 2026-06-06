// UI Slice 3 Layout boundary badge invariants.
// Static checks: 21 views produce a badge label; read-only / write
// classifications match UI Slice 1; P0 + direct_gateway views surface
// risk methods; badge helper has no IPC; Layout.tsx stays free of new
// runtime-config writes.

import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  buildScreenBoundaryContract,
  type ScreenViewId,
} from "../src/shared/lib/screen-boundary-contract";
import {
  buildBoundaryBadgeDescriptor,
  buildBoundaryBadgeTitle,
  getBoundaryBadgeLabel,
  type BoundaryBadgeDescriptor,
} from "../src/renderer/src/screens/Layout/boundary-badge";

const ROOT = join(__dirname, "..");
const boundaryBadgeSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/boundary-badge.ts"),
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

const VIEW_TO_CONTRACT: Readonly<Record<ScreenViewId, () => BoundaryBadgeDescriptor>> =
  Object.fromEntries(
    buildScreenBoundaryContract().contracts.map((entry) => [
      entry.view,
      () => buildBoundaryBadgeDescriptor(entry),
    ]),
  ) as Readonly<Record<ScreenViewId, () => BoundaryBadgeDescriptor>>;

function descriptorFor(view: ScreenViewId): BoundaryBadgeDescriptor {
  return VIEW_TO_CONTRACT[view]();
}

describe("UI Slice 3 boundary badge shape", () => {
  it("emits a descriptor for every one of the 21 views", () => {
    for (const view of CANONICAL_ORDER) {
      const descriptor = descriptorFor(view);
      expect(descriptor.view).toBe(view);
      expect(descriptor.label.length).toBeGreaterThan(0);
      expect(descriptor.class_modifier).toMatch(/^shell-status-badge--/);
    }
  });

  it("keeps the static 'read-only shell' badge fully replaced in Layout.tsx", () => {
    expect(layoutSrc).not.toContain('>read-only shell<');
    // Dynamic badge is wired in.
    expect(layoutSrc).toContain("buildBoundaryBadgeDescriptor");
    expect(layoutSrc).toContain("buildBoundaryBadgeTitle");
    expect(layoutSrc).toContain("boundaryBadge.class_modifier");
    expect(layoutSrc).toContain("getScreenBoundaryContract");
  });
});

describe("UI Slice 3 boundary badge per-view classification", () => {
  it("hccCockpit / bailongma / mission / monitor show read-only · P3", () => {
    for (const view of [
      "hccCockpit",
      "bailongma",
      "mission",
      "monitor",
    ] as const) {
      const descriptor = descriptorFor(view);
      expect(descriptor.kind_token).toBe("read_only");
      expect(descriptor.risk_level).toBe("P3");
      expect(descriptor.label).toBe("read-only · P3");
      expect(descriptor.write_surface_count).toBe(0);
      expect(descriptor.direct_gateway_risk).toBe(false);
    }
  });

  it("providers shows config-write · P1", () => {
    const descriptor = descriptorFor("providers");
    expect(descriptor.kind_token).toBe("read_write_config");
    expect(descriptor.risk_level).toBe("P1");
    expect(descriptor.label).toBe("config-write · P1");
    expect(descriptor.write_surface_count).toBeGreaterThan(0);
  });

  it("chat shows mixed · P1", () => {
    const descriptor = descriptorFor("chat");
    expect(descriptor.kind_token).toBe("mixed");
    expect(descriptor.risk_level).toBe("P1");
    expect(descriptor.label).toBe("mixed · P1");
  });

  it("knowledge shows mixed · P0 and exposes direct_gateway risk", () => {
    const descriptor = descriptorFor("knowledge");
    expect(descriptor.kind_token).toBe("mixed");
    expect(descriptor.risk_level).toBe("P0");
    expect(descriptor.label).toBe("mixed · P0");
    expect(descriptor.direct_gateway_risk).toBe(true);
    expect(descriptor.risk_methods).toEqual(
      expect.arrayContaining([
        "knowledgeSearch",
        "knowledgeIngest",
        "getGbrainStats",
      ]),
    );
    const title = buildBoundaryBadgeTitle(descriptor);
    // UI Slice 7: title carries the "Direct gateway methods:" sentence and
    // the "Status: display-only; IPC migration not applied" status line.
    expect(title).toContain("Direct gateway methods:");
    expect(title).toContain("knowledgeSearch");
    expect(title).toContain("knowledgeIngest");
    expect(title).toContain("IPC migration not applied");
  });

  it("knowledgeControl shows external-action · P0 with direct_gateway risk", () => {
    const descriptor = descriptorFor("knowledgeControl");
    expect(descriptor.kind_token).toBe("external_action");
    expect(descriptor.risk_level).toBe("P0");
    expect(descriptor.direct_gateway_risk).toBe(true);
    expect(descriptor.risk_methods).toContain("knowledgeSearch");
  });

  it("playbooks / understand / schedules show runtime-write", () => {
    for (const view of ["playbooks", "understand", "schedules"] as const) {
      const descriptor = descriptorFor(view);
      expect(descriptor.kind_token).toBe("read_write_runtime");
      expect(getBoundaryBadgeLabel(descriptor.kind_token)).toBe("runtime-write");
    }
  });

  it("memory / settings / gateway show mixed", () => {
    for (const view of ["memory", "settings", "gateway"] as const) {
      const descriptor = descriptorFor(view);
      expect(descriptor.kind_token).toBe("mixed");
    }
  });

  it("non-P0 views do not flag direct_gateway risk", () => {
    for (const view of CANONICAL_ORDER) {
      const descriptor = descriptorFor(view);
      if (descriptor.risk_level !== "P0") {
        expect(descriptor.direct_gateway_risk).toBe(false);
      }
    }
  });
});

describe("UI Slice 3 boundary badge source purity", () => {
  it("boundary-badge.ts contains no IPC, fetch, or hermesAPI", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
    ]) {
      expect(boundaryBadgeSrc).not.toContain(forbidden);
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
