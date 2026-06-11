import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import { getTransitiveImports, FORBIDDEN_RE } from "./_helpers/import-graph";

const ROOT = join(__dirname, "..");
const missionSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Mission/Mission.tsx"),
  "utf-8",
);
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
  "utf-8",
);
const layoutRoutesSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/layout-routes.tsx"),
  "utf-8",
);

describe("Mission Control read-only boundary", () => {
  const allowedReadApis = [
    "getGatewayState",
    "listVaultFiles",
    "listPipelineRuns",
    "getEvents",
    "listCronJobs",
    "listPlaybooks",
    "getCronJobHistory",
    "checkGatewayHealth",
  ];

  const forbiddenMutationApis = [
    "runPlaybook",
    "triggerCronJob",
    "createCronJob",
    "pauseCronJob",
    "resumeCronJob",
    "startGateway",
    "stopGateway",
    "knowledgeIngest",
    "readVaultFile",
    "addMemoryEntry",
    "updateMemoryEntry",
    "removeMemoryEntry",
    "writeSoul",
    "sendMessage",
    "setConfig",
    "setEnv",
    "openExternal",
  ];

  it("only calls approved read APIs", () => {
    const calls = [
      ...missionSrc.matchAll(/window\.hermesAPI\.([A-Za-z0-9_]+)/g),
    ].map((match) => match[1]);

    expect([...new Set(calls)].sort()).toEqual([...allowedReadApis].sort());
  });

  it("does not reference mutation APIs as callable preload methods", () => {
    for (const api of forbiddenMutationApis) {
      expect(missionSrc).not.toContain(`window.hermesAPI.${api}`);
    }
  });

  it("keeps the required safety boundary labels visible", () => {
    expect(missionSrc).toContain("Read-only");
    expect(missionSrc).toContain("No new IPC");
    expect(missionSrc).toContain("No writes");
    expect(missionSrc).toContain("Productionization NOT APPROVED");
  });

  it("renders bilingual read-only disclaimer (UI-CN-001b)", () => {
    expect(missionSrc).toContain("本页仅展示状态，不会自动执行任何操作。");
    expect(missionSrc).toContain("Status display only · No automatic execution");
  });

  it("renders three-section layout (UI-MACOS-001b)", () => {
    // Health summary row
    expect(missionSrc).toContain("mission-health-row");
    expect(missionSrc).toContain("网关");
    expect(missionSrc).toContain("冻结");
    // Focus area with stage track + blockers
    expect(missionSrc).toContain("阶段轨道");
    expect(missionSrc).toContain("阻塞项 · Blockers");
    expect(missionSrc).toContain("下一步");
    // Collapsible details
    expect(missionSrc).toContain("mission-collapsible");
    expect(missionSrc).toContain("流水线 · Pipelines");
    expect(missionSrc).toContain("定时任务 · Cron Jobs");
    expect(missionSrc).toContain("defaultCollapsed");
  });

  it("has zero execution controls in the restructured layout", () => {
    // No playbook/cron/gateway/mutation/runtime controls anywhere.
    // The only buttons are the collapsible section headers (expand/collapse).
    expect(missionSrc).not.toContain("runPlaybook");
  });

  it("keeps BaiLongma and HCC Cockpit as one-release aliases", () => {
    // UI Slice 2: aliases now live in LAYOUT_ROUTES with distinct legacy_source.
    expect(layoutSrc).toContain('view: "mission"');
    expect(layoutRoutesSrc).toContain('view: "mission"');
    expect(layoutRoutesSrc).toContain('legacySource="bailongma"');
    expect(layoutRoutesSrc).toContain('legacySource="hcc"');
  });

  describe("UI-SAFETY-001 import-graph hardened boundary", () => {
    const missionEntry = resolve(ROOT, "src/renderer/src/screens/Mission/Mission.tsx");

    it("transitive imports of Mission contain no forbidden API calls", () => {
      const modules = getTransitiveImports(missionEntry);

      expect(modules.size).toBeGreaterThan(0);

      for (const mod of modules) {
        if (mod.endsWith(".d.ts")) continue;
        if (mod === missionEntry) continue; // already covered by string-based assertions

        const src = readFileSync(mod, "utf-8");
        if (FORBIDDEN_RE.test(src)) {
          const match = src.match(FORBIDDEN_RE);
          throw new Error(
            `Import-graph violation in ${mod}: ` +
              `contains forbidden API call \`${match?.[0]?.trim()}\`. ` +
              `This module is transitively imported by Mission.tsx.`,
          );
        }
      }
    });
  });
});
