import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const missionSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Mission/Mission.tsx"),
  "utf-8",
);
const layoutSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Layout/Layout.tsx"),
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
    expect(missionSrc).toContain("Hard cutover not approved");
    expect(missionSrc).toContain("L6 live knowledge flush remains unapproved");
  });

  it("keeps BaiLongma and HCC Cockpit as one-release aliases", () => {
    expect(layoutSrc).toContain('view: "mission"');
    expect(layoutSrc).toContain('legacySource="bailongma"');
    expect(layoutSrc).toContain('legacySource="hcc"');
  });
});
