import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join, resolve } from "path";

import type {
  ModelStrategyDryRunFixture,
  ModelStrategyRollbackBaseline,
} from "../src/shared/lib/model-strategy-dry-run";
import type { ProviderCatalogFixture } from "../src/shared/lib/provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "../src/shared/lib/smoke-test-matrix";

import {
  PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
  type ProfileRolloutSimulationSnapshot,
} from "../src/shared/lib/profile-rollout-snapshot";
import {
  assertProfileRolloutNoRuntimeAccess,
  compareProfiles,
  PROFILE_ROLLOUT_SAFETY_LITERALS,
  simulateRolloutStep,
  validateProfileRolloutSimulation,
} from "../src/shared/lib/profile-rollout-simulation";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const ROOT = join(__dirname, "..");

const snapshotSrc = readFileSync(
  join(ROOT, "src/shared/lib/profile-rollout-snapshot.ts"),
  "utf-8",
);
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/profile-rollout-simulation.ts"),
  "utf-8",
);

const fixture001 = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

const EXPECTED_STEP_KINDS: readonly string[] = [
  "shadow_observation",
  "user_opt_in",
  "internal_only",
  "release_candidate_preview",
];

function cloneSnapshot(): ProfileRolloutSimulationSnapshot {
  return JSON.parse(JSON.stringify(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT));
}

function cloneFixture001(): ModelStrategyDryRunFixture {
  return JSON.parse(JSON.stringify(fixture001)) as ModelStrategyDryRunFixture;
}

describe("MODEL-STRATEGY-004A snapshot pins", () => {
  it("uses schema_version 1.0.0 and dry_run_simulation mode", () => {
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.schema_version).toBe("1.0.0");
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.mode).toBe(
      "dry_run_simulation",
    );
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.status).toBe("planned");
  });

  it("legacy_baseline deep-equals 001 rollback_baseline", () => {
    const expected: ModelStrategyRollbackBaseline = {
      daily_model: "minimax2.7",
      task_fallback_model: "deepseekV4pro",
      live_config_write_allowed: false,
    };
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline).toEqual(
      expected,
    );
  });

  it("candidate profile mirrors 001 dry-run lanes and forces unverified state", () => {
    const cp = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile;
    expect(cp.source).toBe("model-strategy-dry-run-2026-06-05");
    expect(cp.lanes.map((l) => l.lane)).toEqual(fixture001.lanes.map((l) => l.lane));
    expect(cp.lanes.every((l) => l.verification_state === "unverified")).toBe(
      true,
    );
  });

  it("MiniMax 3.0 and gpt-5.5 candidate lanes are never marked verified", () => {
    const cp = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile;
    for (const lane of cp.lanes) {
      if (lane.candidate_model === "MiniMax 3.0") {
        expect(lane.verification_state).not.toBe("verified");
      }
      if (lane.candidate_model === "gpt-5.5") {
        expect(lane.verification_state).not.toBe("verified");
      }
    }
  });

  it("rollout_steps has 4 stages in canonical order", () => {
    const steps = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.rollout_steps;
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => s.kind)).toEqual(EXPECTED_STEP_KINDS);
    expect(steps.map((s) => s.step_index)).toEqual([0, 1, 2, 3]);
  });

  it("no rollout step uses general_availability", () => {
    const steps = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.rollout_steps;
    for (const step of steps) {
      expect(step.kind).not.toBe("general_availability");
      expect(step.kind).not.toContain("general_availability");
    }
  });

  it("every step declares dry_run_only: true", () => {
    const steps = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.rollout_steps;
    expect(steps.every((s) => s.dry_run_only === true)).toBe(true);
  });

  it("safety invariants are all false including rollout_writes_to_config", () => {
    const si = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.safety_invariants;
    expect(si.live_config_writes_allowed).toBe(false);
    expect(si.automatic_runtime_routing_enabled).toBe(false);
    expect(si.hcc_auto_executor_allowed).toBe(false);
    expect(si.runtime_router_allowed).toBe(false);
    expect(si.rollout_writes_to_config).toBe(false);
    expect(PROFILE_ROLLOUT_SAFETY_LITERALS.rollout_writes_to_config).toBe(
      false,
    );
  });
});

describe("MODEL-STRATEGY-004A compareProfiles", () => {
  it("returns daily delta minimax2.7 -> MiniMax 3.0", () => {
    const deltas = compareProfiles(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline,
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
    );
    const daily = deltas.find((d) => d.lane === "daily")!;
    expect(daily.baseline_model).toBe("minimax2.7");
    expect(daily.candidate_model).toBe("MiniMax 3.0");
    expect(daily.is_primary_baseline).toBe(false);
  });

  it("maps deepseekV4pro legacy alias to deepseek-v4-pro canonical candidate", () => {
    const deltas = compareProfiles(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline,
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
    );
    const tf = deltas.find((d) => d.lane === "task_fallback")!;
    expect(tf.baseline_model).toBe("deepseekV4pro");
    expect(tf.candidate_model).toBe("deepseek-v4-pro");
    expect(tf.is_legacy_alias_drift).toBe(false);
  });

  it("does not invent verified production baseline for lanes not in legacy", () => {
    const deltas = compareProfiles(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.legacy_baseline,
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile,
    );
    for (const d of deltas) {
      if (d.lane === "complex_code" || d.lane === "god" || d.lane === "daily_fallback") {
        expect(d.baseline_model).toBeNull();
        expect(d.is_primary_baseline).toBe(false);
      }
    }
  });
});

describe("MODEL-STRATEGY-004A simulateRolloutStep", () => {
  it("shadow_observation step projects 6 lanes and never marks any as gates_satisfied", () => {
    const result = simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      0,
      smokeMatrix,
      catalog,
    );
    expect(result.dry_run_only).toBe(true);
    expect(result.no_runtime_activation).toBe(true);
    expect(result.no_live_routing).toBe(true);
    expect(result.step_kind).toBe("shadow_observation");
    expect(result.projected_models).toHaveLength(6);
    expect(result.blocked_lanes).toEqual([]);
    for (const ev of result.lane_evaluations) {
      expect(ev.gates_satisfied).toBe(false);
      expect(ev.gates_evaluated).toBe(false);
      expect(ev.gate_status).toBe("shadow_projection");
      expect(ev.pending_gates.length).toBeGreaterThan(0);
    }
  });

  it("shadow_observation step does not flip MiniMax 3.0 / gpt-5.5 / deepseek-v4-pro to verified", () => {
    const result = simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      0,
      smokeMatrix,
      catalog,
    );
    for (const ev of result.lane_evaluations) {
      expect(ev.gates_satisfied).toBe(false);
      expect(ev.gates_evaluated).toBe(false);
      if (
        ev.candidate_model === "MiniMax 3.0" ||
        ev.candidate_model === "gpt-5.5" ||
        ev.candidate_model === "deepseek-v4-pro"
      ) {
        expect(ev.gate_status).toBe("shadow_projection");
      }
    }
  });

  it("shadow_observation step produces a gate evaluation per (lane, gate)", () => {
    const result = simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      0,
      smokeMatrix,
      catalog,
    );
    for (const ev of result.lane_evaluations) {
      expect(ev.gate_evaluations.length).toBeGreaterThan(0);
      expect(ev.required_gates.length).toBeGreaterThan(0);
      expect(ev.pending_gates.length).toBeGreaterThan(0);
    }
  });

  it("does not modify snapshot, smoke matrix, or catalog", () => {
    const snapBefore = cloneSnapshot();
    const smokeBefore = JSON.parse(JSON.stringify(smokeMatrix));
    const catalogBefore = JSON.parse(JSON.stringify(catalog));
    simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      0,
      smokeMatrix,
      catalog,
    );
    expect(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT).toEqual(snapBefore);
    expect(smokeMatrix).toEqual(smokeBefore);
    expect(catalog).toEqual(catalogBefore);
  });

  it("user_opt_in step sets gate_status to user_intent_required for eligible lanes", () => {
    const result = simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      1,
      smokeMatrix,
      catalog,
    );
    expect(result.step_kind).toBe("user_opt_in");
    expect(result.lane_evaluations).toHaveLength(6);
    const complexCode = result.lane_evaluations.find(
      (e) => e.lane === "complex_code",
    )!;
    expect(complexCode.gate_status).toBe("user_intent_required");
    expect(complexCode.gates_satisfied).toBe(false);
    expect(complexCode.required_gates).toContain("user_intent");
    expect(complexCode.pending_gates).toContain("user_intent");
  });

  it("internal_only step sets gate_status to rollback_baseline_required for task_fallback", () => {
    const result = simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      2,
      smokeMatrix,
      catalog,
    );
    expect(result.step_kind).toBe("internal_only");
    const taskFallback = result.lane_evaluations.find(
      (e) => e.lane === "task_fallback",
    )!;
    expect(taskFallback.gate_status).toBe("rollback_baseline_required");
    expect(taskFallback.gates_satisfied).toBe(false);
    expect(taskFallback.pending_gates).toContain("rollback_baseline_match");
  });

  it("release_candidate_preview step sets gate_status to smoke_test_pending or rollback_baseline_required", () => {
    const result = simulateRolloutStep(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
      3,
      smokeMatrix,
      catalog,
    );
    expect(result.step_kind).toBe("release_candidate_preview");
    const daily = result.lane_evaluations.find((e) => e.lane === "daily")!;
    expect(daily.gate_status).toMatch(
      /smoke_test_pending|rollback_baseline_required/,
    );
    expect(daily.gates_satisfied).toBe(false);
  });

  it("every step is dry_run_only, no_runtime_activation, no_live_routing and never flips any lane to verified", () => {
    for (const step of [0, 1, 2, 3] as const) {
      const result = simulateRolloutStep(
        PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
        step,
        smokeMatrix,
        catalog,
      );
      expect(result.dry_run_only).toBe(true);
      expect(result.no_runtime_activation).toBe(true);
      expect(result.no_live_routing).toBe(true);
      expect(result.step_kind).not.toBe("general_availability");
      for (const ev of result.lane_evaluations) {
        expect(ev.gates_satisfied).toBe(false);
        expect(ev.gates_evaluated).toBe(false);
      }
    }
  });
});

describe("MODEL-STRATEGY-004A cross-slice resolve", () => {
  it("candidate profile 6 lanes resolve in 002A provider catalog", () => {
    const cp = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile;
    for (const lane of cp.lanes) {
      const direct = catalog.provider_catalog.find(
        (e) =>
          e.provider_id === lane.provider &&
          e.model_id === lane.candidate_model,
      );
      const legacy = catalog.provider_catalog.find(
        (e) => e.legacy_aliases?.includes(lane.candidate_model) ?? false,
      );
      expect(direct ?? legacy).toBeTruthy();
    }
  });

  it("candidate profile 6 lanes resolve in 002B smoke matrix", () => {
    const cp = PROFILE_ROLLOUT_SIMULATION_SNAPSHOT.current_candidate_profile;
    const lanes = cp.lanes.map((l) => l.lane);
    const matrixLanes = smokeMatrix.matrix.map((e) => e.lane);
    for (const l of lanes) {
      expect(matrixLanes).toContain(l);
    }
  });

  it("deepseekV4pro legacy alias maps to deepseek-v4-pro canonical candidate in 002A catalog", () => {
    const deepseek = catalog.provider_catalog.find(
      (e) => e.provider_id === "deepseek",
    )!;
    expect(deepseek.legacy_aliases).toContain("deepseekV4pro");
    expect(deepseek.model_id).toBe("deepseek-v4-pro");
  });
});

describe("MODEL-STRATEGY-004A validation", () => {
  it("accepts the canonical snapshot", () => {
    const result = validateProfileRolloutSimulation(
      PROFILE_ROLLOUT_SIMULATION_SNAPSHOT,
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(() =>
      assertProfileRolloutNoRuntimeAccess(PROFILE_ROLLOUT_SIMULATION_SNAPSHOT),
    ).not.toThrow();
  });

  it("rejects live_config_writes_allowed = true", () => {
    const bad = cloneSnapshot();
    (
      bad.safety_invariants as { live_config_writes_allowed: boolean }
    ).live_config_writes_allowed = true;
    const result = validateProfileRolloutSimulation(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain(
      "live_config_writes_allowed",
    );
    expect(() => assertProfileRolloutNoRuntimeAccess(bad)).toThrow(
      /live_config_writes_allowed/,
    );
  });

  it("rejects rollout_writes_to_config = true", () => {
    const bad = cloneSnapshot();
    (
      bad.safety_invariants as { rollout_writes_to_config: boolean }
    ).rollout_writes_to_config = true;
    const result = validateProfileRolloutSimulation(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain(
      "rollout_writes_to_config",
    );
    expect(() => assertProfileRolloutNoRuntimeAccess(bad)).toThrow(
      /rollout_writes_to_config/,
    );
  });

  it("rejects MiniMax 3.0 candidate lane marked verified", () => {
    const bad = cloneSnapshot();
    const daily = bad.current_candidate_profile.lanes.find(
      (l) => l.candidate_model === "MiniMax 3.0",
    )!;
    (
      daily as { verification_state: "verified" | "unverified" }
    ).verification_state = "verified";
    const result = validateProfileRolloutSimulation(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain(
      "minimax_candidate_must_be_unverified",
    );
  });

  it("rejects gpt-5.5 candidate lane marked verified", () => {
    const bad = cloneSnapshot();
    const cc = bad.current_candidate_profile.lanes.find(
      (l) => l.candidate_model === "gpt-5.5",
    )!;
    (
      cc as { verification_state: "verified" | "unverified" }
    ).verification_state = "verified";
    const result = validateProfileRolloutSimulation(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain(
      "gpt_5_5_candidate_must_be_unverified",
    );
  });

  it("rejects a step missing dry_run_only", () => {
    const bad = cloneSnapshot();
    (
      bad.rollout_steps[0] as { dry_run_only?: boolean }
    ).dry_run_only = false as unknown as true;
    const result = validateProfileRolloutSimulation(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((i) => i.code)).toContain(
      "rollout_step_dry_run_only_false",
    );
  });
});

describe("MODEL-STRATEGY-004A source guardrails", () => {
  it("snapshot source does not reference runtime/config/network surfaces", () => {
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
    expect(snapshotSrc).not.toContain("general_availability");
  });

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
