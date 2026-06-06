import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyRollbackBaseline,
} from "../src/shared/lib/model-strategy-dry-run";
import type { ProviderCatalogFixture } from "../src/shared/lib/provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "../src/shared/lib/smoke-test-matrix";

import { PROFILE_ROLLOUT_SIMULATION_SNAPSHOT } from "../src/shared/lib/profile-rollout-snapshot";
import {
  PROFILE_ROLLBACK_PREVIEW_AFFECTED_LANES,
  PROFILE_ROLLBACK_PREVIEW_DRY_RUN_ONLY,
  PROFILE_ROLLBACK_PREVIEW_MODE,
  PROFILE_ROLLBACK_PREVIEW_NO_LEGACY_BASELINE_LANES,
  PROFILE_ROLLBACK_PREVIEW_NO_LIVE_ROUTING,
  PROFILE_ROLLBACK_PREVIEW_NO_RUNTIME_ACTIVATION,
  PROFILE_ROLLBACK_PREVIEW_PROTECTED_LANES,
  PROFILE_ROLLBACK_PREVIEW_ROLLOUT_WRITES_TO_CONFIG,
  PROFILE_ROLLBACK_PREVIEW_SAFETY_LITERALS,
  PROFILE_ROLLBACK_PREVIEW_SCHEMA_VERSION,
  PROFILE_ROLLBACK_PREVIEW_SOURCE_CANDIDATE_ID,
  PROFILE_ROLLBACK_REASON_NO_LEGACY_BASELINE,
  previewRollback,
  type ProfileRollbackPreview,
} from "../src/shared/lib/profile-rollout-rollback-preview";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/profile-rollout-rollback-preview.ts"),
  "utf-8",
);

const fixture001 = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

const LEGACY_BASELINE: ModelStrategyRollbackBaseline = {
  daily_model: "minimax2.7",
  task_fallback_model: "deepseekV4pro",
  live_config_write_allowed: false,
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makePreview(): ProfileRollbackPreview {
  return previewRollback(
    PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
    PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline,
    smokeMatrix,
    catalog,
  );
}

describe("MODEL-STRATEGY-004B preview pins", () => {
  it("uses schema 1.0.0 and dry_run_rollback_preview mode", () => {
    const preview = makePreview();
    expect(PROFILE_ROLLBACK_PREVIEW_SCHEMA_VERSION).toBe("1.0.0");
    expect(PROFILE_ROLLBACK_PREVIEW_MODE).toBe("dry_run_rollback_preview");
    expect(preview.schema_version).toBe("1.0.0");
    expect(preview.mode).toBe("dry_run_rollback_preview");
  });

  it("declares dry_run_only / no_runtime_activation / no_live_routing / rollout_writes_to_config false", () => {
    const preview = makePreview();
    expect(PROFILE_ROLLBACK_PREVIEW_DRY_RUN_ONLY).toBe(true);
    expect(PROFILE_ROLLBACK_PREVIEW_NO_RUNTIME_ACTIVATION).toBe(true);
    expect(PROFILE_ROLLBACK_PREVIEW_NO_LIVE_ROUTING).toBe(true);
    expect(PROFILE_ROLLBACK_PREVIEW_ROLLOUT_WRITES_TO_CONFIG).toBe(false);
    expect(preview.dry_run_only).toBe(true);
    expect(preview.no_runtime_activation).toBe(true);
    expect(preview.no_live_routing).toBe(true);
    expect(preview.rollout_writes_to_config).toBe(false);
    expect(PROFILE_ROLLBACK_PREVIEW_SAFETY_LITERALS.rollout_writes_to_config).toBe(false);
  });
});

describe("MODEL-STRATEGY-004B baseline alias", () => {
  it("target_legacy_baseline deep-equals 001 rollback_baseline", () => {
    const expected: ModelStrategyRollbackBaseline = {
      daily_model: "minimax2.7",
      task_fallback_model: "deepseekV4pro",
      live_config_write_allowed: false,
    };
    const preview = makePreview();
    expect(preview.target_legacy_baseline).toEqual(expected);
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline).toEqual(expected);
  });

  it("source_candidate_profile_id is pinned to 001 fixture id", () => {
    const preview = makePreview();
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile.source).toBe(
      PROFILE_ROLLBACK_PREVIEW_SOURCE_CANDIDATE_ID,
    );
    expect(preview.source_candidate_profile_id).toBe(
      PROFILE_ROLLBACK_PREVIEW_SOURCE_CANDIDATE_ID,
    );
  });
});

describe("MODEL-STRATEGY-004B affected / protected / no-legacy-baseline lanes", () => {
  it("affected_lanes equals daily and light_task", () => {
    const preview = makePreview();
    expect(preview.affected_lanes).toEqual(["daily", "light_task"]);
    expect(PROFILE_ROLLBACK_PREVIEW_AFFECTED_LANES).toEqual([
      "daily",
      "light_task",
    ]);
  });

  it("protected_lanes includes task_fallback", () => {
    const preview = makePreview();
    expect(preview.protected_lanes).toContain("task_fallback");
    expect(PROFILE_ROLLBACK_PREVIEW_PROTECTED_LANES).toContain(
      "task_fallback",
    );
  });

  it("no_legacy_baseline_lanes includes daily_fallback, complex_code, god", () => {
    const preview = makePreview();
    expect(preview.no_legacy_baseline_lanes).toEqual(
      expect.arrayContaining(["daily_fallback", "complex_code", "god"]),
    );
    expect(PROFILE_ROLLBACK_PREVIEW_NO_LEGACY_BASELINE_LANES).toEqual(
      expect.arrayContaining(["daily_fallback", "complex_code", "god"]),
    );
  });

  it("estimated_steps_to_rollback is a positive integer", () => {
    const preview = makePreview();
    expect(preview.estimated_steps_to_rollback).toBeGreaterThanOrEqual(1);
    expect(Number.isInteger(preview.estimated_steps_to_rollback)).toBe(true);
  });
});

describe("MODEL-STRATEGY-004B per-lane preview semantics", () => {
  it("daily lane: candidate MiniMax 3.0 -> rollback target minimax2.7", () => {
    const preview = makePreview();
    const daily = preview.lane_previews.find((p) => p.lane === "daily")!;
    expect(daily.candidate_model).toBe("MiniMax 3.0");
    expect(daily.rollback_target_model).toBe("minimax2.7");
    expect(daily.requires_rollback).toBe(true);
    expect(daily.preserve_candidate).toBe(false);
    expect(daily.protected_lane).toBe(false);
  });

  it("light_task lane: candidate MiniMax 3.0 -> rollback target minimax2.7", () => {
    const preview = makePreview();
    const lt = preview.lane_previews.find((p) => p.lane === "light_task")!;
    expect(lt.candidate_model).toBe("MiniMax 3.0");
    expect(lt.rollback_target_model).toBe("minimax2.7");
    expect(lt.requires_rollback).toBe(true);
  });

  it("task_fallback lane: alias deepseekV4pro + protected + rollback_target null", () => {
    const preview = makePreview();
    const tf = preview.lane_previews.find((p) => p.lane === "task_fallback")!;
    expect(tf.candidate_model).toBe("deepseek-v4-pro");
    expect(tf.baseline_alias).toBe("deepseekV4pro");
    expect(tf.rollback_target_model).toBeNull();
    expect(tf.protected_lane).toBe(true);
    expect(tf.preserve_candidate).toBe(true);
    expect(tf.requires_rollback).toBe(false);
  });

  it.each(["daily_fallback", "complex_code", "god"] as const)(
    "%s lane: no legacy baseline + preserve_candidate true",
    (laneId) => {
      const preview = makePreview();
      const p = preview.lane_previews.find((p) => p.lane === laneId)!;
      expect(p.baseline_model).toBeNull();
      expect(p.rollback_target_model).toBeNull();
      expect(p.preserve_candidate).toBe(true);
      expect(p.protected_lane).toBe(false);
      expect(p.reason).toBe(PROFILE_ROLLBACK_REASON_NO_LEGACY_BASELINE);
    },
  );
});

describe("MODEL-STRATEGY-004B immutability", () => {
  it("does not modify any of the four inputs", () => {
    const cpBefore = deepClone(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
    );
    const lbBefore = deepClone(LEGACY_BASELINE);
    const smBefore = deepClone(smokeMatrix);
    const catBefore = deepClone(catalog);
    const snapBefore = deepClone(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT);
    makePreview();
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile).toEqual(
      cpBefore,
    );
    expect(LEGACY_BASELINE).toEqual(lbBefore);
    expect(smokeMatrix).toEqual(smBefore);
    expect(catalog).toEqual(catBefore);
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT).toEqual(snapBefore);
  });

  it("accepts direct 001 fixture with custom legacy baseline", () => {
    const lb: ModelStrategyRollbackBaseline = {
      daily_model: "minimax2.7",
      task_fallback_model: "deepseekV4pro",
      live_config_write_allowed: false,
    };
    const preview = previewRollback(fixture001, lb, smokeMatrix, catalog);
    expect(preview.target_legacy_baseline).toEqual(lb);
    expect(preview.affected_lanes).toEqual(["daily", "light_task"]);
  });
});

describe("MODEL-STRATEGY-004B cross-slice resolve", () => {
  it("candidate profile 6 lanes resolve in 002A provider catalog", () => {
    const preview = makePreview();
    for (const lane of preview.lane_previews) {
      const direct = catalog.provider_catalog.find(
        (e) => e.model_id === lane.candidate_model,
      );
      const legacy = catalog.provider_catalog.find(
        (e) => e.legacy_aliases?.includes(lane.candidate_model) ?? false,
      );
      expect(direct ?? legacy).toBeTruthy();
    }
  });

  it("preview lane ids align with 002B smoke matrix lane ids", () => {
    const preview = makePreview();
    const previewLanes = preview.lane_previews.map((p) => p.lane);
    const matrixLanes = smokeMatrix.matrix.map((e) => e.lane);
    for (const l of previewLanes) {
      expect(matrixLanes).toContain(l);
    }
  });

  it("002A deepseek legacy_aliases still contains deepseekV4pro", () => {
    const deepseek = catalog.provider_catalog.find(
      (e) => e.provider_id === "deepseek",
    )!;
    expect(deepseek.legacy_aliases).toContain("deepseekV4pro");
  });
});

describe("MODEL-STRATEGY-004B negative invariant: no invented production baseline", () => {
  it("injected verified candidate lane does not invent production baseline", () => {
    const tampered = deepClone(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
    );
    const daily = tampered.lanes.find((l) => l.candidate_model === "MiniMax 3.0")!;
    (daily as { verification_state?: string }).verification_state = "verified";
    const preview = previewRollback(tampered, LEGACY_BASELINE, smokeMatrix, catalog);
    const dailyPreview = preview.lane_previews.find((p) => p.lane === "daily")!;
    expect(dailyPreview.rollback_target_model).toBe("minimax2.7");
    expect(dailyPreview.baseline_model).toBe("minimax2.7");
    expect(dailyPreview.preserve_candidate).toBe(false);
    expect(dailyPreview.requires_rollback).toBe(true);
  });
});

describe("MODEL-STRATEGY-004B source guardrails", () => {
  it("helper source does not reference runtime/config/network surfaces", () => {
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
      expect(helperSrc).not.toContain(forbidden);
    }
    expect(helperSrc).not.toContain("general_availability");
  });

  it("helper source uses rollout_writes_to_config as a literal field, not a runtime call", () => {
    expect(helperSrc).toContain("rollout_writes_to_config");
    expect(helperSrc).toMatch(/rollout_writes_to_config[^a-zA-Z_].*false/);
  });
});
