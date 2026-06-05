import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import type {
  ModelStrategyDryRunFixture,
} from "../src/shared/lib/model-strategy-dry-run";
import type {
  ProviderCatalogFixture,
} from "../src/shared/lib/provider-catalog-resolver";
import type {
  SmokeTestMatrixFixture,
} from "../src/shared/lib/smoke-test-matrix";

import {
  assertUiStatusNoRuntimeAccess,
  buildModelStrategyDisabledStatuses,
  UI_STATUS_AUTOMATIC_ROUTING_ENABLED,
  UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED,
  UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED,
  UI_STATUS_REASON_CATALOG_ENTRY_MISSING,
  UI_STATUS_REASON_LOCAL_FALLBACK_STRUCTURAL_ONLY,
  UI_STATUS_REASON_MULTIMODAL_SMOKE_TEST_REQUIRED,
  UI_STATUS_REASON_PROVIDER_CATALOG_RESOLUTION_REQUIRED,
  UI_STATUS_REASON_ROLLBACK_GUARD_PRESENT,
  UI_STATUS_REASON_SMOKE_MATRIX_ENTRY_MISSING,
  UI_STATUS_REASON_SMOKE_TEST_REQUIRED,
  UI_STATUS_REASON_USER_INTENT_REQUIRED,
  UI_STATUS_RUNTIME_ROUTER_ALLOWED,
  UI_STATUS_SCHEMA_VERSION,
  UI_STATUS_UI_ENABLEMENT_ALLOWED,
  validateModelStrategyDisabledStatuses,
} from "../src/shared/lib/model-strategy-ui-status";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/model-strategy-ui-status.ts"),
  "utf-8",
);

const fixture001 = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

function cloneFixture(): ModelStrategyDryRunFixture {
  return JSON.parse(JSON.stringify(fixture001)) as ModelStrategyDryRunFixture;
}

function cloneCatalog(): ProviderCatalogFixture {
  return JSON.parse(JSON.stringify(catalog)) as ProviderCatalogFixture;
}

function cloneSmokeMatrix(): SmokeTestMatrixFixture {
  return JSON.parse(JSON.stringify(smokeMatrix)) as SmokeTestMatrixFixture;
}

describe("MODEL-STRATEGY-002C UI status safety literals", () => {
  it("pins schema_version 1.0.0 and keeps all safety literals hard false", () => {
    expect(UI_STATUS_SCHEMA_VERSION).toBe("1.0.0");
    expect(UI_STATUS_LIVE_CONFIG_WRITES_ALLOWED).toBe(false);
    expect(UI_STATUS_AUTOMATIC_ROUTING_ENABLED).toBe(false);
    expect(UI_STATUS_HCC_AUTO_EXECUTOR_ALLOWED).toBe(false);
    expect(UI_STATUS_RUNTIME_ROUTER_ALLOWED).toBe(false);
    expect(UI_STATUS_UI_ENABLEMENT_ALLOWED).toBe(false);
  });
});

describe("MODEL-STRATEGY-002C default disabled statuses", () => {
  it("returns six lane statuses, all enabled=false and disabled=true", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    expect(result.statuses).toHaveLength(6);
    expect(result.statuses.map((s) => s.lane)).toEqual([
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]);
    expect(
      result.statuses.every(
        (status) => status.enabled === false && status.disabled === true,
      ),
    ).toBe(true);

    const validation = validateModelStrategyDisabledStatuses(result);
    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([]);
    expect(() => assertUiStatusNoRuntimeAccess(result)).not.toThrow();
  });

  it("keeps enabled=false even if a lane verification_state is forced to verified", () => {
    const bad = cloneFixture();
    const daily = bad.lanes.find((lane) => lane.lane === "daily")!;
    (daily as { verification_state?: string }).verification_state = "verified";
    const result = buildModelStrategyDisabledStatuses(bad, catalog, smokeMatrix);
    const dailyStatus = result.statuses.find((s) => s.lane === "daily")!;
    expect(dailyStatus.enabled).toBe(false);
    expect(dailyStatus.disabled).toBe(true);
  });
});

describe("MODEL-STRATEGY-002C per-lane disabled reasons", () => {
  it("MiniMax daily/light_task reasons include provider_catalog_resolution_required", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const daily = result.statuses.find((s) => s.lane === "daily")!;
    expect(daily.disabledReason).toContain(
      UI_STATUS_REASON_PROVIDER_CATALOG_RESOLUTION_REQUIRED,
    );
    expect(daily.catalogStatus).toBe("unresolved");

    const lightTask = result.statuses.find((s) => s.lane === "light_task")!;
    expect(lightTask.disabledReason).toContain(
      UI_STATUS_REASON_PROVIDER_CATALOG_RESOLUTION_REQUIRED,
    );
  });

  it("daily_fallback shows structural_only and local base URL status", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const local = result.statuses.find((s) => s.lane === "daily_fallback")!;
    expect(local.disabledReason).toContain(
      UI_STATUS_REASON_LOCAL_FALLBACK_STRUCTURAL_ONLY,
    );
    expect(local.smokeStatus).toBe("structural_only");
    expect(local.label).toBe("local");
    expect(local.candidateModel).toBe("gemma-4-12b-it");
  });

  it("complex_code includes user_intent and smoke required reasons", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const complexCode = result.statuses.find(
      (s) => s.lane === "complex_code",
    )!;
    expect(complexCode.disabledReason).toContain(
      UI_STATUS_REASON_USER_INTENT_REQUIRED,
    );
    expect(complexCode.disabledReason).toContain(
      UI_STATUS_REASON_SMOKE_TEST_REQUIRED,
    );
    expect(complexCode.requiresUserIntent).toBe(true);
    expect(complexCode.smokeStatus).toBe("required");
  });

  it("task_fallback deepseek shows rollback_guard_present and canonical status", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const taskFallback = result.statuses.find(
      (s) => s.lane === "task_fallback",
    )!;
    expect(taskFallback.disabledReason).toContain(
      UI_STATUS_REASON_ROLLBACK_GUARD_PRESENT,
    );
    expect(taskFallback.candidateModel).toBe("deepseek-v4-pro");
    expect(taskFallback.provider).toBe("deepseek");
    expect(taskFallback.catalogStatus).toBe("resolved");
  });
});

describe("MODEL-STRATEGY-002C degraded inputs", () => {
  it("marks catalog as missing when provider catalog drops an entry", () => {
    const badCatalog = cloneCatalog();
    (badCatalog.provider_catalog as ProviderCatalogFixture["provider_catalog"]) =
      badCatalog.provider_catalog.filter(
        (entry) => entry.provider_id !== "openai",
      );
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      badCatalog,
      smokeMatrix,
    );
    const complexCode = result.statuses.find(
      (s) => s.lane === "complex_code",
    )!;
    expect(complexCode.catalogStatus).toBe("missing");
    expect(complexCode.disabledReason).toContain(
      UI_STATUS_REASON_CATALOG_ENTRY_MISSING,
    );
  });

  it("marks smoke as missing when matrix drops a smoke-required lane", () => {
    const badMatrix = cloneSmokeMatrix();
    (badMatrix.matrix as SmokeTestMatrixFixture["matrix"]) = badMatrix.matrix.filter(
      (entry) => entry.lane !== "complex_code",
    );
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      badMatrix,
    );
    const complexCode = result.statuses.find(
      (s) => s.lane === "complex_code",
    )!;
    expect(complexCode.smokeStatus).toBe("missing");
    expect(complexCode.disabledReason).toContain(
      UI_STATUS_REASON_SMOKE_MATRIX_ENTRY_MISSING,
    );
  });
});

describe("MODEL-STRATEGY-002C negative invariants", () => {
  it("rejects statuses that mark any lane enabled=true", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const tampered = {
      ...result,
      statuses: result.statuses.map((status, idx) =>
        idx === 0
          ? { ...status, enabled: true as unknown as false }
          : status,
      ),
    };
    const validation = validateModelStrategyDisabledStatuses(tampered);
    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain(
      "ui_status_enabled_unexpectedly",
    );
    expect(() => assertUiStatusNoRuntimeAccess(tampered)).toThrow(
      /ui_status_enabled_unexpectedly/,
    );
  });

  it("rejects statuses that flip a safety literal to true", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const tampered = {
      ...result,
      statuses: result.statuses.map((status) => ({
        ...status,
        safety_invariants: {
          ...status.safety_invariants,
          ui_enablement_allowed: true as unknown as false,
        },
      })),
    };
    const validation = validateModelStrategyDisabledStatuses(tampered);
    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain(
      "ui_status_safety_invariant_breach",
    );
    expect(() => assertUiStatusNoRuntimeAccess(tampered)).toThrow(
      /ui_status_safety_invariant_breach/,
    );
  });

  it("rejects empty disabledReason", () => {
    const result = buildModelStrategyDisabledStatuses(
      fixture001,
      catalog,
      smokeMatrix,
    );
    const tampered = {
      ...result,
      statuses: result.statuses.map((status) => ({
        ...status,
        disabledReason: "",
      })),
    };
    const validation = validateModelStrategyDisabledStatuses(tampered);
    expect(validation.ok).toBe(false);
    expect(validation.issues.map((issue) => issue.code)).toContain(
      "ui_status_disabled_reason_missing",
    );
  });
});

describe("MODEL-STRATEGY-002C source and fixture guardrails", () => {
  it("helper source stays pure and avoids runtime/UI surfaces", () => {
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
      "react",
      "vue",
      "svelte",
    ]) {
      expect(helperSrc.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it("does not import any UI framework or renderer", () => {
    for (const framework of ["react", "vue", "svelte", "solid-js", "preact"]) {
      expect(helperSrc).not.toMatch(
        new RegExp(`from\\s+["']${framework}`, "i"),
      );
      expect(helperSrc).not.toMatch(
        new RegExp(`from\\s+["']@?${framework}`, "i"),
      );
    }
  });
});
