import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyLaneId,
  ModelStrategyVerificationState,
} from "../src/shared/lib/model-strategy-dry-run";
import type { ProviderCatalogFixture } from "../src/shared/lib/provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "../src/shared/lib/smoke-test-matrix";
import type {
  ProfileRollbackPreview,
} from "../src/shared/lib/profile-rollout-rollback-preview";
import {
  PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
  type ProfileRolloutSimulationSnapshot,
} from "../src/shared/lib/profile-rollout-snapshot";
import { previewRollback } from "../src/shared/lib/profile-rollout-rollback-preview";
import {
  buildProfileRolloutUiStatus,
  PROFILE_ROLLOUT_UI_STATUS_AUTOMATIC_ROUTING_ENABLED,
  PROFILE_ROLLOUT_UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED,
  PROFILE_ROLLOUT_UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED,
  PROFILE_ROLLOUT_UI_STATUS_ROLLOUT_WRITES_TO_CONFIG,
  PROFILE_ROLLOUT_UI_STATUS_RUNTIME_ROUTER_ALLOWED,
  PROFILE_ROLLOUT_UI_STATUS_SAFETY_LITERALS,
  PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION,
  PROFILE_ROLLOUT_UI_STATUS_SOURCE_SNAPSHOT_ID,
  type ProfileRolloutStepToken,
} from "../src/shared/lib/profile-rollout-ui-status";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/profile-rollout-ui-status.ts"),
  "utf-8",
);

const fixture001 = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

const STEP_TOKEN_MAP: readonly [0 | 1 | 2 | 3, ProfileRolloutStepToken, string][] = [
  [0, "rollout_step_shadow", "shadow_observation"],
  [1, "rollout_step_user_opt_in", "user_opt_in"],
  [2, "rollout_step_internal_only", "internal_only"],
  [3, "rollout_step_release_candidate_preview", "release_candidate_preview"],
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeResult(stepIndex: 0 | 1 | 2 | 3, rollbackPreview?: ProfileRollbackPreview) {
  return buildProfileRolloutUiStatus(
    PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
    stepIndex,
    smokeMatrix,
    catalog,
    rollbackPreview,
  );
}

describe("MODEL-STRATEGY-004C schema pins", () => {
  it("uses schema 1.0.0 and source_snapshot_id", () => {
    const result = makeResult(0);
    expect(PROFILE_ROLLOUT_UI_STATUS_SCHEMA_VERSION).toBe("1.0.0");
    expect(PROFILE_ROLLOUT_UI_STATUS_SOURCE_SNAPSHOT_ID).toBe(
      "model-strategy-dry-run-2026-06-05",
    );
    expect(result.schema_version).toBe("1.0.0");
    expect(result.source_snapshot_id).toBe(
      "model-strategy-dry-run-2026-06-05",
    );
  });

  it("emits 6 lane statuses", () => {
    const result = makeResult(0);
    expect(result.statuses).toHaveLength(6);
    expect(result.statuses.map((s) => s.lane)).toEqual([
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]);
  });

  it("every status has enabled=false and disabled=true", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      for (const s of result.statuses) {
        expect(s.enabled).toBe(false);
        expect(s.disabled).toBe(true);
      }
    }
  });

  it("never flips to enabled=true even if verification_state=verified is injected", () => {
    const tampered = deepClone(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
    );
    const daily = tampered.current_candidate_profile.lanes.find(
      (l) => l.candidate_model === "MiniMax 3.0",
    )!;
    (daily as { verification_state: ModelStrategyVerificationState }).verification_state =
      "verified";
    const result = buildProfileRolloutUiStatus(
      tampered,
      0,
      smokeMatrix,
      catalog,
    );
    const dailyStatus = result.statuses.find((s) => s.lane === "daily")!;
    expect(dailyStatus.enabled).toBe(false);
    expect(dailyStatus.disabled).toBe(true);
    expect(dailyStatus.verificationState).toBe("verified");
  });

  it("uses only the existing 002C verificationState enum", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      for (const s of result.statuses) {
        const allowed: ModelStrategyVerificationState[] = [
          "unverified",
          "blocked",
          "verified",
          "unavailable",
        ];
        expect(allowed).toContain(s.verificationState);
      }
    }
  });
});

describe("MODEL-STRATEGY-004C step token mapping", () => {
  it.each(STEP_TOKEN_MAP)(
    "step %i (%s) -> disabledReason contains %s",
    (stepIndex, expectedToken, _kindLabel) => {
      const result = makeResult(stepIndex);
      expect(result.step_kind).toBe(_kindLabel);
      for (const s of result.statuses) {
        expect(s.disabledReason).toContain(expectedToken);
      }
    },
  );

  it("helper source does not contain general_availability", () => {
    expect(helperSrc).not.toContain("general_availability");
  });

  it("disabledReason puts step token first, then candidate tokens", () => {
    for (const [stepIndex, token, _] of STEP_TOKEN_MAP) {
      const result = makeResult(stepIndex);
      const daily = result.statuses.find((s) => s.lane === "daily")!;
      const parts = daily.disabledReason.split("|");
      expect(parts[0]).toBe(token);
      expect(parts).toContain("provider_catalog_resolution_required");
    }
  });
});

describe("MODEL-STRATEGY-004C per-lane flag semantics", () => {
  it("daily: rollbackAvailable true, protectedLane false, preserveCandidate false, noLegacyBaseline false", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      const daily = result.statuses.find((s) => s.lane === "daily")!;
      expect(daily.rollbackAvailable).toBe(true);
      expect(daily.protectedLane).toBe(false);
      expect(daily.preserveCandidate).toBe(false);
      expect(daily.noLegacyBaseline).toBe(false);
    }
  });

  it("light_task: rollbackAvailable true", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      const lt = result.statuses.find((s) => s.lane === "light_task")!;
      expect(lt.rollbackAvailable).toBe(true);
      expect(lt.protectedLane).toBe(false);
    }
  });

  it("task_fallback: protectedLane true for every step, rollbackAvailable false, preserveCandidate true", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      const tf = result.statuses.find((s) => s.lane === "task_fallback")!;
      expect(tf.protectedLane).toBe(true);
      expect(tf.rollbackAvailable).toBe(false);
      expect(tf.preserveCandidate).toBe(true);
    }
  });

  it.each<ModelStrategyLaneId>(["daily_fallback", "complex_code", "god"])(
    "%s: preserveCandidate true, noLegacyBaseline true",
    (laneId) => {
      for (const step of [0, 1, 2, 3] as const) {
        const result = makeResult(step);
        const s = result.statuses.find((s) => s.lane === laneId)!;
        expect(s.preserveCandidate).toBe(true);
        expect(s.noLegacyBaseline).toBe(true);
        expect(s.protectedLane).toBe(false);
        expect(s.rollbackAvailable).toBe(false);
      }
    },
  );

  it("uses rollbackPreview when provided and aligns per-lane flags", () => {
    const preview = previewRollback(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline,
      smokeMatrix,
      catalog,
    );
    const result = makeResult(0, preview);
    const daily = result.statuses.find((s) => s.lane === "daily")!;
    expect(daily.rollbackAvailable).toBe(true);
    expect(daily.protectedLane).toBe(false);
    const tf = result.statuses.find((s) => s.lane === "task_fallback")!;
    expect(tf.protectedLane).toBe(true);
    expect(tf.preserveCandidate).toBe(true);
  });
});

describe("MODEL-STRATEGY-004C safety invariants", () => {
  it("all 5 safety invariants are hard false including rollout_writes_to_config", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      for (const s of result.statuses) {
        expect(s.safety_invariants.live_config_writes_allowed).toBe(false);
        expect(s.safety_invariants.automatic_runtime_routing_enabled).toBe(false);
        expect(s.safety_invariants.hcc_auto_executor_allowed).toBe(false);
        expect(s.safety_invariants.runtime_router_allowed).toBe(false);
        expect(s.safety_invariants.rollout_writes_to_config).toBe(false);
      }
    }
    expect(PROFILE_ROLLOUT_UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED).toBe(false);
    expect(PROFILE_ROLLOUT_UI_STATUS_AUTOMATIC_ROUTING_ENABLED).toBe(false);
    expect(PROFILE_ROLLOUT_UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED).toBe(false);
    expect(PROFILE_ROLLOUT_UI_STATUS_RUNTIME_ROUTER_ALLOWED).toBe(false);
    expect(PROFILE_ROLLOUT_UI_STATUS_ROLLOUT_WRITES_TO_CONFIG).toBe(false);
    expect(
      PROFILE_ROLLOUT_UI_STATUS_SAFETY_LITERALS.rollout_writes_to_config,
    ).toBe(false);
  });
});

describe("MODEL-STRATEGY-004C immutability", () => {
  it("does not modify snapshot, smoke matrix, catalog, or rollbackPreview", () => {
    const snapBefore = deepClone(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT);
    const smBefore = deepClone(smokeMatrix);
    const catBefore = deepClone(catalog);
    const preview = previewRollback(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline,
      smokeMatrix,
      catalog,
    );
    const previewBefore = deepClone(preview);
    makeResult(0, preview);
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT).toEqual(snapBefore);
    expect(smokeMatrix).toEqual(smBefore);
    expect(catalog).toEqual(catBefore);
    expect(preview).toEqual(previewBefore);
  });
});

describe("MODEL-STRATEGY-004C cross-slice alignment", () => {
  it("status fields align with 002C shape (enabled / disabled / disabledReason / verificationState)", () => {
    const result = makeResult(0);
    for (const s of result.statuses) {
      expect(s).toHaveProperty("enabled", false);
      expect(s).toHaveProperty("disabled", true);
      expect(s).toHaveProperty("disabledReason");
      expect(s).toHaveProperty("verificationState");
    }
  });

  it("pendingGates come from 004A simulateRolloutStep and are not invented locally", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = makeResult(step);
      for (const s of result.statuses) {
        expect(Array.isArray(s.pendingGates)).toBe(true);
        for (const g of s.pendingGates) {
          expect([
            "smoke_test",
            "user_intent",
            "catalog_resolution",
            "rollback_baseline_match",
          ]).toContain(g);
        }
      }
    }
  });
});

describe("MODEL-STRATEGY-004C source guardrails", () => {
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
  });

  it("helper source uses rollout_writes_to_config only as a literal field, not a runtime call", () => {
    expect(helperSrc).toContain("rollout_writes_to_config");
    expect(helperSrc).toMatch(/rollout_writes_to_config[^a-zA-Z_].*false/);
  });
});
