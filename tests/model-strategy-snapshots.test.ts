import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  MODEL_STRATEGY_DRY_RUN_SNAPSHOT,
  PROVIDER_CATALOG_SNAPSHOT,
  SMOKE_TEST_MATRIX_SNAPSHOT,
} from "../src/shared/lib/model-strategy-snapshots";

const ROOT = join(__dirname, "..");
const snapshotSrc = readFileSync(
  join(ROOT, "src/shared/lib/model-strategy-snapshots.ts"),
  "utf-8",
);

describe("MODEL-STRATEGY-003A-0 canonical snapshots", () => {
  it("dry-run snapshot pins the six lanes in canonical order", () => {
    expect(MODEL_STRATEGY_DRY_RUN_SNAPSHOT.lanes.map((lane) => lane.lane)).toEqual([
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]);
  });

  it("dry-run snapshot keeps safety invariants all false", () => {
    expect(MODEL_STRATEGY_DRY_RUN_SNAPSHOT.safety_invariants).toEqual({
      live_config_writes_allowed: false,
      automatic_runtime_routing_enabled: false,
      hcc_auto_executor_allowed: false,
      runtime_router_allowed: false,
      secrets_inline_allowed: false,
    });
  });

  it("provider catalog snapshot exposes the five canonical providers", () => {
    const ids = new Set(
      PROVIDER_CATALOG_SNAPSHOT.provider_catalog.map((entry) => entry.provider_id),
    );
    expect(ids).toEqual(
      new Set(["minimax", "openai", "deepseek", "anthropic", "custom"]),
    );
    expect(PROVIDER_CATALOG_SNAPSHOT.provider_catalog).toHaveLength(5);
  });

  it("provider catalog snapshot keeps safety invariants all false", () => {
    expect(PROVIDER_CATALOG_SNAPSHOT.safety_invariants).toEqual({
      live_config_writes_allowed: false,
      automatic_runtime_routing_enabled: false,
      hcc_auto_executor_allowed: false,
      runtime_router_allowed: false,
      secrets_inline_allowed: false,
    });
  });

  it("smoke matrix snapshot covers the six lanes and uses structural_only", () => {
    const lanes = SMOKE_TEST_MATRIX_SNAPSHOT.matrix.map((entry) => entry.lane);
    expect(lanes).toEqual([
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]);
    expect(
      SMOKE_TEST_MATRIX_SNAPSHOT.matrix.every(
        (entry) => entry.check_type === "structural_only",
      ),
    ).toBe(true);
    expect(SMOKE_TEST_MATRIX_SNAPSHOT.check_type_for_local_fallback).toBe(
      "structural_only",
    );
  });

  it("smoke matrix snapshot keeps safety invariants all false", () => {
    expect(SMOKE_TEST_MATRIX_SNAPSHOT.safety_invariants).toEqual({
      live_config_writes_allowed: false,
      automatic_runtime_routing_enabled: false,
      hcc_auto_executor_allowed: false,
      runtime_router_allowed: false,
      network_probe_allowed: false,
    });
  });

  it("snapshots are typed and frozen at compile time", () => {
    expect(MODEL_STRATEGY_DRY_RUN_SNAPSHOT.mode).toBe("dry_run");
    expect(PROVIDER_CATALOG_SNAPSHOT.mode).toBe("dry_run");
    expect(SMOKE_TEST_MATRIX_SNAPSHOT.mode).toBe("dry_run");
  });
});

describe("MODEL-STRATEGY-003A-0 snapshot source guardrails", () => {
  it("snapshot module does not reference runtime or forbidden strings", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      "spawn(",
      "exec(",
      "config.yaml",
      "setModelConfig",
      "setEnv",
      "startGateway",
      "runPlaybook",
      "triggerCronJob",
      "knowledgeIngest",
      "handoff/packs",
      ".hermes/audit",
      "http.request(",
      "https.request(",
      "net.connect(",
      "dns.lookup(",
      "https.Agent",
    ]) {
      expect(snapshotSrc).not.toContain(forbidden);
    }
  });
});
