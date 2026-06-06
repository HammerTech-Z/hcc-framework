// UI Slice 7 P0 direct gateway risk callout polish invariants.
// Static checks: badge title carries direct gateway methods + status
// sentence; Inspector callout carries stable testids and required copy;
// non-direct-gateway views do not display the P0 callout; helper source
// is free of misleading recovery verbs; helper/inspector stay free of
// IPC and runtime form.

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
  type BoundaryBadgeDescriptor,
} from "../src/renderer/src/screens/Layout/boundary-badge";
import {
  buildBoundaryInspectorDescriptor,
  type BoundaryInspectorDescriptor,
} from "../src/renderer/src/screens/Layout/boundary-inspector";
import { getWriteActionDisplayState } from "../src/renderer/src/screens/Layout/write-action-display-state";

const ROOT = join(__dirname, "..");
const boundaryBadgeSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/boundary-badge.ts"),
  "utf-8",
);
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

const CONTRACT_BY_VIEW: Readonly<Record<ScreenViewId, () => ReturnType<typeof buildScreenBoundaryContract>["contracts"][number]>> =
  Object.fromEntries(
    buildScreenBoundaryContract().contracts.map((entry) => [
      entry.view,
      () => entry,
    ]),
  ) as Readonly<Record<ScreenViewId, () => ReturnType<typeof buildScreenBoundaryContract>["contracts"][number]>>;

const BADGE_BY_VIEW: Readonly<
  Record<ScreenViewId, () => BoundaryBadgeDescriptor>
> = Object.fromEntries(
  CANONICAL_ORDER.map((view) => [
    view,
    () => buildBoundaryBadgeDescriptor(CONTRACT_BY_VIEW[view]()),
  ]),
) as Readonly<Record<ScreenViewId, () => BoundaryBadgeDescriptor>>;

const INSPECTOR_BY_VIEW: Readonly<
  Record<ScreenViewId, () => BoundaryInspectorDescriptor>
> = Object.fromEntries(
  CANONICAL_ORDER.map((view) => [
    view,
    () =>
      buildBoundaryInspectorDescriptor(
        CONTRACT_BY_VIEW[view](),
        getWriteActionDisplayState(view)!,
      ),
  ]),
) as Readonly<Record<ScreenViewId, () => BoundaryInspectorDescriptor>>;

function badgeFor(view: ScreenViewId): BoundaryBadgeDescriptor {
  return BADGE_BY_VIEW[view]();
}

function inspectorFor(view: ScreenViewId): BoundaryInspectorDescriptor {
  return INSPECTOR_BY_VIEW[view]();
}

const DIRECT_GATEWAY_VIEWS = ["knowledge", "knowledgeControl"] as const;
const NON_DIRECT_GATEWAY_VIEWS = [
  "hccCockpit",
  "providers",
  "chat",
  "mission",
  "monitor",
  "settings",
] as const;

describe("UI Slice 7 badge title polish for direct gateway views", () => {
  it("knowledge badge title includes knowledgeSearch / knowledgeIngest / getGbrainStats", () => {
    const badge = badgeFor("knowledge");
    const title = buildBoundaryBadgeTitle(badge);
    expect(title).toContain("Direct gateway methods:");
    expect(title).toContain("knowledgeSearch");
    expect(title).toContain("knowledgeIngest");
    expect(title).toContain("getGbrainStats");
  });

  it("knowledgeControl badge title includes knowledgeSearch and the display-only status sentence", () => {
    const badge = badgeFor("knowledgeControl");
    const title = buildBoundaryBadgeTitle(badge);
    expect(title).toContain("Direct gateway methods:");
    expect(title).toContain("knowledgeSearch");
    expect(title).toContain("Status: display-only; IPC migration not applied");
  });

  it("non-direct-gateway views do not include the direct gateway sentence in the badge title", () => {
    for (const view of NON_DIRECT_GATEWAY_VIEWS) {
      const title = buildBoundaryBadgeTitle(badgeFor(view));
      expect(title).not.toContain("Direct gateway methods:");
      expect(title).not.toContain("IPC migration not applied");
    }
  });
});

describe("UI Slice 7 inspector callout polish for direct gateway views", () => {
  it("knowledge inspector descriptor carries direct_gateway_methods matching the contract", () => {
    const descriptor = inspectorFor("knowledge");
    expect(descriptor.direct_gateway_methods).toEqual(
      expect.arrayContaining([
        "knowledgeSearch",
        "knowledgeIngest",
        "getGbrainStats",
      ]),
    );
    expect(descriptor.risk_level).toBe("P0");
  });

  it("knowledgeControl inspector descriptor carries knowledgeSearch direct gateway", () => {
    const descriptor = inspectorFor("knowledgeControl");
    expect(descriptor.direct_gateway_methods).toContain("knowledgeSearch");
    expect(descriptor.risk_level).toBe("P0");
  });

  it("inspector source carries the P0 callout block with stable testids and required copy", () => {
    for (const testid of [
      "inspector-direct-gateway-callout",
      "inspector-direct-gateway-type",
      "inspector-direct-gateway-methods",
      "inspector-direct-gateway-meaning",
      "inspector-direct-gateway-status",
    ]) {
      expect(boundaryInspectorSrc).toContain(testid);
    }
    expect(boundaryInspectorSrc).toContain("risk type: direct gateway");
    expect(boundaryInspectorSrc).toContain(
      "meaning: bypasses main-process IPC boundary",
    );
    expect(boundaryInspectorSrc).toContain(
      "status: display-only, not fixed by this slice",
    );
  });
});

describe("UI Slice 7 misleading-phrase guards", () => {
  // Match each phrase as a whole word (case-insensitive). Guards against
  // shipping copy that tells the user the issue is gone. The exception
  // "not fixed" / "not fixed by this slice" is explicit and accurate.
  // "safe" is intentionally excluded: it is a legitimate fallback
  // descriptor in helper source ("safe fallback") and unrelated to the
  // P0 direct-gateway claim.
  const MISLEADING_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> =
    [
      // "fixed" but not preceded by "not "
      { label: "fixed (recovery verb)", pattern: /(?<!\bnot )\bfixed\b/i },
      { label: "migrated", pattern: /\bmigrated\b/i },
      { label: "protected by IPC", pattern: /\bprotected by IPC\b/i },
      { label: "resolved", pattern: /\bresolved\b/i },
      { label: "repaired", pattern: /\brepaired\b/i },
    ];

  function assertNoMisleading(
    label: string,
    source: string,
  ): void {
    for (const { label: phrase, pattern } of MISLEADING_PATTERNS) {
      const match = source.match(pattern);
      expect(
        match,
        `${label} contains misleading recovery verb (${phrase}): ${match?.[0] ?? ""}`,
      ).toBeNull();
    }
  }

  it("boundary-badge.ts source contains no misleading recovery verbs", () => {
    assertNoMisleading("boundary-badge.ts", boundaryBadgeSrc);
  });

  it("boundary-inspector.tsx source contains no misleading recovery verbs", () => {
    assertNoMisleading("boundary-inspector.tsx", boundaryInspectorSrc);
  });
});

describe("UI Slice 7 source purity", () => {
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
