import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import {
  assertModelStrategyNoLiveConfigWrites,
  buildModelStrategyLaneSummaries,
  deriveLaneBlockedReason,
  MODEL_STRATEGY_AUTOMATIC_ROUTING_ENABLED,
  MODEL_STRATEGY_HCC_AUTO_EXECUTOR_ALLOWED,
  MODEL_STRATEGY_LIVE_CONFIG_WRITES_ALLOWED,
  MODEL_STRATEGY_MODE,
  MODEL_STRATEGY_RUNTIME_ROUTER_ALLOWED,
  MODEL_STRATEGY_SCHEMA_VERSION,
  validateModelStrategyDryRunFixture,
  type ModelStrategyDryRunFixture,
} from "../src/shared/lib/model-strategy-dry-run";

import fixtureJson from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/model-strategy-dry-run.ts"),
  "utf-8",
);
const docSrc = readFileSync(
  join(ROOT, "docs/model-strategy/hermes-model-strategy-2026-06-05.md"),
  "utf-8",
);

const fixture = fixtureJson as ModelStrategyDryRunFixture;

function cloneFixture(): ModelStrategyDryRunFixture {
  return JSON.parse(JSON.stringify(fixture)) as ModelStrategyDryRunFixture;
}

describe("MODEL-STRATEGY-001 dry-run fixture", () => {
  it("uses dry-run schema, planned status, and hard false safety literals", () => {
    expect(fixture.schema_version).toBe(MODEL_STRATEGY_SCHEMA_VERSION);
    expect(fixture.schema_version).toBe("1.0.0");
    expect(fixture.mode).toBe(MODEL_STRATEGY_MODE);
    expect(fixture.mode).toBe("dry_run");
    expect(fixture.status).toBe("planned");

    expect(MODEL_STRATEGY_LIVE_CONFIG_WRITES_ALLOWED).toBe(false);
    expect(MODEL_STRATEGY_AUTOMATIC_ROUTING_ENABLED).toBe(false);
    expect(MODEL_STRATEGY_HCC_AUTO_EXECUTOR_ALLOWED).toBe(false);
    expect(MODEL_STRATEGY_RUNTIME_ROUTER_ALLOWED).toBe(false);
    expect(fixture.safety_invariants.live_config_writes_allowed).toBe(false);
    expect(fixture.safety_invariants.automatic_runtime_routing_enabled).toBe(false);
    expect(fixture.safety_invariants.hcc_auto_executor_allowed).toBe(false);
    expect(fixture.safety_invariants.runtime_router_allowed).toBe(false);
    expect(fixture.safety_invariants.secrets_inline_allowed).toBe(false);
  });

  it("locks the six lane ids and current user-selected candidates", () => {
    expect(fixture.lanes.map((lane) => lane.lane)).toEqual([
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]);

    expect(fixture.lanes.find((lane) => lane.lane === "daily")?.candidate_model).toBe(
      "MiniMax 3.0",
    );
    expect(
      fixture.lanes.find((lane) => lane.lane === "light_task")?.candidate_model,
    ).toBe("MiniMax 3.0");
    expect(
      fixture.lanes.find((lane) => lane.lane === "complex_code")?.candidate_model,
    ).toBe("gpt-5.5");
  });

  it("maps the local fallback lane to provider=custom with local as label only", () => {
    const local = fixture.lanes.find((lane) => lane.lane === "daily_fallback")!;
    expect(local.provider).toBe("custom");
    expect(local.lane_provider_label).toBe("local");
    expect(local.base_url).toBe("http://localhost:1234/v1");
    expect(local.requires_multimodal_smoke_test).toBe(true);
  });

  it("keeps premium lanes behind explicit user intent", () => {
    const complexCode = fixture.lanes.find((lane) => lane.lane === "complex_code")!;
    const god = fixture.lanes.find((lane) => lane.lane === "god")!;
    expect(complexCode.requires_user_intent).toBe(true);
    expect(god.requires_user_intent).toBe(true);
    expect(god.candidate_model).toBe("provider_current_opus");
  });

  it("validates the committed dry-run fixture", () => {
    const result = validateModelStrategyDryRunFixture(fixture);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(() => assertModelStrategyNoLiveConfigWrites(fixture)).not.toThrow();
  });

  it("builds UI-ready lane summaries without enabling lanes", () => {
    const summaries = buildModelStrategyLaneSummaries(fixture);
    expect(summaries).toHaveLength(6);
    expect(summaries.every((summary) => summary.verificationState === "unverified")).toBe(
      true,
    );
    expect(summaries.find((summary) => summary.lane === "daily")?.blockedReason).toBe(
      "provider_catalog_resolution_required",
    );
    expect(
      summaries.find((summary) => summary.lane === "daily_fallback")?.blockedReason,
    ).toBe("multimodal_smoke_test_required");
  });

  it("derives smoke-test blocked reasons deterministically", () => {
    const complexCode = fixture.lanes.find((lane) => lane.lane === "complex_code")!;
    expect(deriveLaneBlockedReason(complexCode)).toBe("smoke_test_required");
    expect(deriveLaneBlockedReason({ ...complexCode, verification_state: "verified" })).toBe(
      null,
    );
  });
});

describe("MODEL-STRATEGY-001 negative invariants", () => {
  it("rejects live config writes", () => {
    const bad = cloneFixture();
    bad.safety_invariants.live_config_writes_allowed = true as false;
    const result = validateModelStrategyDryRunFixture(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("live_config_write_allowed");
    expect(() => assertModelStrategyNoLiveConfigWrites(bad)).toThrow(
      /live_config_write_allowed/,
    );
  });

  it("rejects provider=local in the live-mapped fallback lane", () => {
    const bad = cloneFixture();
    const local = bad.lanes.find((lane) => lane.lane === "daily_fallback")!;
    local.provider = "local" as "custom";
    const result = validateModelStrategyDryRunFixture(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "local_fallback_must_map_to_custom_provider",
    );
  });

  it("rejects MiniMax 3.0 lanes without provider catalog resolution", () => {
    const bad = cloneFixture();
    const daily = bad.lanes.find((lane) => lane.lane === "daily")!;
    daily.requires_provider_catalog_resolution = false;
    const result = validateModelStrategyDryRunFixture(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "minimax_requires_catalog_resolution",
    );
  });

  it("rejects missing user-intent gate on complex_code", () => {
    const bad = cloneFixture();
    const complexCode = bad.lanes.find((lane) => lane.lane === "complex_code")!;
    complexCode.requires_user_intent = false;
    const result = validateModelStrategyDryRunFixture(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "missing_user_intent_gate",
    );
  });
});

describe("MODEL-STRATEGY-001 source and doc guardrails", () => {
  it("helper source stays pure and does not reference runtime surfaces", () => {
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
    ]) {
      expect(helperSrc).not.toContain(forbidden);
    }
  });

  it("plan doc stays dry-run and names the exact non-go boundaries", () => {
    expect(docSrc).toContain("Status: planned, dry-run only");
    expect(docSrc).toContain("Do not change `~/.hermes/config.yaml`");
    expect(docSrc).toContain("Do not enable automatic runtime routing");
    expect(docSrc).toContain("Do not enable HCC Auto Executor");
    expect(docSrc).toContain("Do not change `docs/roadmap-locked-2026-05-28.md`");
    expect(docSrc).toContain("candidate_model: gpt-5.5");
    expect(docSrc).toContain("candidate_model: MiniMax 3.0");
    expect(docSrc).toContain("lane_provider_label: local");
  });
});
