import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const cockpitSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/HccCockpit/HccCockpit.tsx"),
  "utf-8",
);

describe("HCC Cockpit read-only boundary", () => {
  const allowedReadApis = [
    "listPipelineRuns",
    "listPlaybooks",
    "getCronJobHistory",
    "getEvents",
    "getGatewayState",
    "checkGatewayHealth",
  ];

  const forbiddenMutationApis = [
    "runPlaybook",
    "createCronJob",
    "pauseCronJob",
    "resumeCronJob",
    "triggerCronJob",
    "readVaultFile",
    "addMemoryEntry",
    "updateMemoryEntry",
    "removeMemoryEntry",
    "writeSoul",
    "sendMessage",
    "runLlmChecker",
    "understandAnything",
    "startSshTunnel",
    "stopSshTunnel",
    "addMcpServer",
    "removeMcpServer",
    "toggleMcpServer",
    "testMcpServer",
  ];

  it("only calls the approved read APIs", () => {
    const calls = [
      ...cockpitSrc.matchAll(/window\.hermesAPI\.([A-Za-z0-9_]+)/g),
    ].map((match) => match[1]);

    expect([...new Set(calls)].sort()).toEqual([...allowedReadApis].sort());
  });

  it("does not reference mutation APIs", () => {
    for (const api of forbiddenMutationApis) {
      expect(cockpitSrc).not.toContain(`window.hermesAPI.${api}`);
    }
  });

  it("keeps visible execution controls disabled", () => {
    expect(cockpitSrc).toContain("Run playbook disabled");
    expect(cockpitSrc).toContain("Auto fix disabled");
    expect(cockpitSrc).toContain("Deliver disabled");
  });
});
