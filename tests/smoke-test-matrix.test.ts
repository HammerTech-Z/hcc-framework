import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

import type {
  ModelStrategyDryRunFixture,
} from "../src/shared/lib/model-strategy-dry-run";
import type {
  ProviderCatalogFixture,
} from "../src/shared/lib/provider-catalog-resolver";

import {
  assertLocalBaseUrlStructurallyReachable,
  assertSmokeTestMatrixNoRuntimeAccess,
  buildSmokeTestMatrixSummaries,
  SMOKE_TEST_AUTOMATIC_ROUTING_ENABLED,
  SMOKE_TEST_HCC_AUTO_EXECUTOR_ALLOWED,
  SMOKE_TEST_LIVE_CONFIG_WRITES_ALLOWED,
  SMOKE_TEST_MATRIX_MODE,
  SMOKE_TEST_MATRIX_SCHEMA_VERSION,
  SMOKE_TEST_NETWORK_PROBE_ALLOWED,
  SMOKE_TEST_RUNTIME_ROUTER_ALLOWED,
  type SmokeTestMatrixFixture,
  validateSmokeTestMatrix,
} from "../src/shared/lib/smoke-test-matrix";

import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05.json";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05.json";
import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05.json";

const ROOT = join(__dirname, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/smoke-test-matrix.ts"),
  "utf-8",
);
const matrixSrc = readFileSync(
  join(ROOT, "tests/fixtures/model-strategy/smoke-test-matrix-2026-06-05.json"),
  "utf-8",
);

const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const fixture001 = fixture001Json as ModelStrategyDryRunFixture;

function cloneMatrix(): SmokeTestMatrixFixture {
  return JSON.parse(JSON.stringify(smokeMatrix)) as SmokeTestMatrixFixture;
}

function cloneFixture(): ModelStrategyDryRunFixture {
  return JSON.parse(JSON.stringify(fixture001)) as ModelStrategyDryRunFixture;
}

function cloneCatalog(): ProviderCatalogFixture {
  return JSON.parse(JSON.stringify(catalog)) as ProviderCatalogFixture;
}

describe("MODEL-STRATEGY-002B smoke matrix fixture", () => {
  it("pins schema_version 1.0.0 and dry_run mode", () => {
    expect(SMOKE_TEST_MATRIX_SCHEMA_VERSION).toBe("1.0.0");
    expect(SMOKE_TEST_MATRIX_MODE).toBe("dry_run");
    expect(smokeMatrix.schema_version).toBe("1.0.0");
    expect(smokeMatrix.mode).toBe("dry_run");
    expect(smokeMatrix.status).toBe("planned");
    expect(smokeMatrix.check_type_for_local_fallback).toBe("structural_only");
  });

  it("keeps all safety literals hard false", () => {
    expect(SMOKE_TEST_LIVE_CONFIG_WRITES_ALLOWED).toBe(false);
    expect(SMOKE_TEST_AUTOMATIC_ROUTING_ENABLED).toBe(false);
    expect(SMOKE_TEST_HCC_AUTO_EXECUTOR_ALLOWED).toBe(false);
    expect(SMOKE_TEST_RUNTIME_ROUTER_ALLOWED).toBe(false);
    expect(SMOKE_TEST_NETWORK_PROBE_ALLOWED).toBe(false);

    expect(smokeMatrix.safety_invariants.live_config_writes_allowed).toBe(
      false,
    );
    expect(
      smokeMatrix.safety_invariants.automatic_runtime_routing_enabled,
    ).toBe(false);
    expect(smokeMatrix.safety_invariants.hcc_auto_executor_allowed).toBe(false);
    expect(smokeMatrix.safety_invariants.runtime_router_allowed).toBe(false);
    expect(smokeMatrix.safety_invariants.network_probe_allowed).toBe(false);
  });

  it("covers all six 001 lanes with unverified entries", () => {
    const lanes = smokeMatrix.matrix.map((entry) => entry.lane);
    expect(lanes).toEqual([
      "daily",
      "daily_fallback",
      "light_task",
      "complex_code",
      "task_fallback",
      "god",
    ]);
    expect(
      smokeMatrix.matrix.every(
        (entry) => entry.verification_state === "unverified",
      ),
    ).toBe(true);
  });

  it("uses structural_only check_type for every entry", () => {
    expect(
      smokeMatrix.matrix.every(
        (entry) => entry.check_type === "structural_only",
      ),
    ).toBe(true);
  });
});

describe("MODEL-STRATEGY-002B matrix resolution against 002A catalog", () => {
  it("resolves every matrix entry in 002A provider catalog", () => {
    const result = validateSmokeTestMatrix(fixture001, catalog, smokeMatrix);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);

    for (const entry of smokeMatrix.matrix) {
      const catalogEntry = catalog.provider_catalog.find(
        (c) =>
          c.provider_id === entry.provider_id &&
          c.model_id === entry.model_id,
      );
      expect(catalogEntry).toBeTruthy();
    }
  });

  it("complex_code gpt-5.5 carries user_intent_gate_check", () => {
    const entry = smokeMatrix.matrix.find(
      (e) => e.lane === "complex_code",
    )!;
    expect(entry.checks).toContain("user_intent_gate_check");
  });

  it("task_fallback deepseek carries rollback_baseline_match_check", () => {
    const entry = smokeMatrix.matrix.find(
      (e) => e.lane === "task_fallback",
    )!;
    expect(entry.checks).toContain("rollback_baseline_match_check");
    expect(entry.provider_id).toBe("deepseek");
    expect(entry.model_id).toBe("deepseek-v4-pro");
  });

  it("daily_fallback carries local_base_url_structure_check", () => {
    const entry = smokeMatrix.matrix.find(
      (e) => e.lane === "daily_fallback",
    )!;
    expect(entry.check_type).toBe("structural_only");
    expect(entry.checks).toContain("local_base_url_structure_check");
    expect(entry.checks).toContain("loopback_host_check");
    expect(entry.checks).toContain("path_prefix_check");
  });
});

describe("MODEL-STRATEGY-002B local base url structural check", () => {
  it("passes for http://localhost:1234/v1", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://localhost:1234/v1",
    );
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("passes for https://127.0.0.1:443/v1/chat", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "https://127.0.0.1:443/v1/chat",
    );
    expect(result.ok).toBe(true);
  });

  it("passes for http://[::1]:8080/v1", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://[::1]:8080/v1",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a non-loopback host", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://example.com/v1",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("host_not_loopback");
  });

  it("rejects ftp scheme", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "ftp://localhost:1234/v1",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("scheme_not_http_or_https");
  });

  it("rejects non-numeric port", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://localhost:abc/v1",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("port_invalid");
  });

  it("rejects missing port", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://localhost/v1",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("port_missing");
  });

  it("rejects out-of-range port", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://localhost:70000/v1",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("port_invalid");
  });

  it("rejects path that does not start with /v1", () => {
    const result = assertLocalBaseUrlStructurallyReachable(
      "http://localhost:1234/not-v1",
    );
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("path_prefix_not_v1");
  });

  it("rejects unparseable url", () => {
    const result = assertLocalBaseUrlStructurallyReachable("not a url");
    expect(result.ok).toBe(false);
    expect(result.issues).toContain("url_parse_failed");
  });
});

describe("MODEL-STRATEGY-002B matrix summaries", () => {
  it("builds summaries without enabling any lane", () => {
    const summaries = buildSmokeTestMatrixSummaries(smokeMatrix);
    expect(summaries).toHaveLength(6);
    expect(
      summaries.every((s) => s.verification_state === "unverified"),
    ).toBe(true);
    const complexCode = summaries.find((s) => s.lane === "complex_code")!;
    expect(complexCode.required_checks_present).toContain(
      "user_intent_gate_check",
    );
    expect(complexCode.required_checks_missing).toEqual([]);
    const taskFallback = summaries.find((s) => s.lane === "task_fallback")!;
    expect(taskFallback.required_checks_present).toContain(
      "rollback_baseline_match_check",
    );
  });
});

describe("MODEL-STRATEGY-002B negative invariants", () => {
  it("rejects a missing lane matrix entry", () => {
    const bad = cloneMatrix();
    (bad.matrix as SmokeTestMatrixFixture["matrix"]) = bad.matrix.filter(
      (entry) => entry.lane !== "god",
    );
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "missing_lane_matrix_entry",
    );
  });

  it("rejects empty checks on a smoke-required lane", () => {
    const bad = cloneMatrix();
    const complexCode = bad.matrix.find(
      (entry) => entry.lane === "complex_code",
    )!;
    (complexCode as { checks: string[] }).checks = [];
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "smoke_required_lane_empty_checks",
    );
  });

  it("rejects matrix provider/model not in catalog", () => {
    const bad = cloneMatrix();
    const complexCode = bad.matrix.find(
      (entry) => entry.lane === "complex_code",
    )!;
    (complexCode as { model_id?: string }).model_id = "gpt-6.0-not-in-catalog";
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "matrix_model_not_in_catalog",
    );
  });

  it("rejects local fallback without structural_only", () => {
    const bad = cloneMatrix();
    const local = bad.matrix.find(
      (entry) => entry.lane === "daily_fallback",
    )!;
    (local as { check_type?: string }).check_type = "live_probe";
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "local_fallback_must_be_structural_only",
    );
  });

  it("rejects local fallback missing local_base_url_structure_check", () => {
    const bad = cloneMatrix();
    const local = bad.matrix.find(
      (entry) => entry.lane === "daily_fallback",
    )!;
    (local as { checks: string[] }).checks = ["loopback_host_check"];
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "local_fallback_required_check_missing",
    );
  });

  it("rejects complex_code missing user_intent_gate_check", () => {
    const bad = cloneMatrix();
    const complexCode = bad.matrix.find(
      (entry) => entry.lane === "complex_code",
    )!;
    (complexCode as { checks: string[] }).checks = [
      "provider_catalog_resolution_check",
    ];
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "complex_code_required_check_missing",
    );
  });

  it("rejects task_fallback missing rollback_baseline_match_check", () => {
    const bad = cloneMatrix();
    const taskFallback = bad.matrix.find(
      (entry) => entry.lane === "task_fallback",
    )!;
    (taskFallback as { checks: string[] }).checks = [
      "provider_catalog_resolution_check",
    ];
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "task_fallback_required_check_missing",
    );
  });

  it("rejects local fallback if 002A catalog host drifts off loopback", () => {
    const bad = cloneCatalog();
    const custom = bad.provider_catalog.find(
      (entry) => entry.provider_id === "custom",
    )!;
    (custom as { base_url?: string }).base_url = "http://example.com:1234/v1";
    const result = validateSmokeTestMatrix(fixture001, bad, smokeMatrix);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "local_fallback_host_not_loopback",
    );
  });

  it("rejects local fallback if 002A catalog path drifts off /v1", () => {
    const bad = cloneCatalog();
    const custom = bad.provider_catalog.find(
      (entry) => entry.provider_id === "custom",
    )!;
    (custom as { base_url?: string }).base_url = "http://localhost:1234/chat";
    const result = validateSmokeTestMatrix(fixture001, bad, smokeMatrix);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "local_fallback_path_prefix_not_v1",
    );
  });

  it("rejects a verified lane", () => {
    const bad = cloneMatrix();
    const complexCode = bad.matrix.find(
      (entry) => entry.lane === "complex_code",
    )!;
    (complexCode as { verification_state?: string }).verification_state =
      "verified";
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "lane_prematurely_verified",
    );
  });

  it("rejects an unsafe safety_invariants block", () => {
    const bad = cloneMatrix();
    (
      bad.safety_invariants as { network_probe_allowed: boolean }
    ).network_probe_allowed = true;
    const result = validateSmokeTestMatrix(fixture001, catalog, bad);
    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain(
      "network_probe_allowed",
    );
    expect(() => assertSmokeTestMatrixNoRuntimeAccess(bad)).toThrow(
      /network_probe_allowed/,
    );
  });
});

describe("MODEL-STRATEGY-002B source and fixture guardrails", () => {
  it("helper source stays pure and does not reference runtime or network surfaces", () => {
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

  it("matrix fixture pins structural_only and forbids network_probe", () => {
    expect(matrixSrc).toContain("\"check_type_for_local_fallback\": \"structural_only\"");
    expect(matrixSrc).toContain("\"network_probe_allowed\": false");
    expect(matrixSrc).toContain("\"live_config_writes_allowed\": false");
  });
});
