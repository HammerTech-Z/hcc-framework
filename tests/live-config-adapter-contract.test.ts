import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import type { ModelStrategyDryRunFixture } from "../src/shared/lib/model-strategy-dry-run";
import type { ProviderCatalogFixture } from "../src/shared/lib/provider-catalog-resolver";
import type { SmokeTestMatrixFixture } from "../src/shared/lib/smoke-test-matrix";
import {
  buildLaneProviderRequirements,
} from "../src/shared/lib/lane-provider-requirements";
import {
  buildLiveConfigApprovalContract,
  LIVE_CONFIG_ADAPTER_APPROVAL_STATE,
  LIVE_CONFIG_ADAPTER_CONTRACT_MODE,
  LIVE_CONFIG_ADAPTER_CONTRACT_SCHEMA_VERSION,
  LIVE_CONFIG_ADAPTER_EXPLICIT_APPROVAL_PHRASE,
  LIVE_CONFIG_ADAPTER_FUTURE_STATE,
  type LiveConfigApprovalContract,
} from "../src/shared/lib/live-config-adapter-contract";

import fixture001Json from "./fixtures/model-strategy/model-strategy-dry-run-2026-06-05";
import catalogJson from "./fixtures/model-strategy/provider-catalog-2026-06-05";
import smokeMatrixJson from "./fixtures/model-strategy/smoke-test-matrix-2026-06-05";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/live-config-adapter-contract.ts"),
  "utf-8",
);

const fixture001 = fixture001Json as ModelStrategyDryRunFixture;
const catalog = catalogJson as ProviderCatalogFixture;
const smokeMatrix = smokeMatrixJson as SmokeTestMatrixFixture;

const EXPECTED_LANE_ORDER = [
  "daily",
  "daily_fallback",
  "light_task",
  "complex_code",
  "task_fallback",
  "god",
] as const;

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeContract(): LiveConfigApprovalContract {
  return buildLiveConfigApprovalContract(fixture001);
}

describe("MODEL-STRATEGY-006B schema pins", () => {
  it("uses schema 1.0.0 and approval_contract_only mode", () => {
    expect(LIVE_CONFIG_ADAPTER_CONTRACT_SCHEMA_VERSION).toBe("1.0.0");
    expect(LIVE_CONFIG_ADAPTER_CONTRACT_MODE).toBe("approval_contract_only");

    const contract = makeContract();
    expect(contract.schema_version).toBe("1.0.0");
    expect(contract.mode).toBe("approval_contract_only");
    expect(contract.reference_only).toBe(true);
  });

  it("keeps approval_state not_approved and future state literal pinned", () => {
    const contract = makeContract();
    expect(LIVE_CONFIG_ADAPTER_APPROVAL_STATE).toBe("not_approved");
    expect(contract.approval_state).toBe("not_approved");
    expect(contract.explicit_approval_phrase).toBe(
      "我授权写入 ~/.hermes/config.yaml",
    );
    expect(contract.explicit_approval_phrase).toBe(
      LIVE_CONFIG_ADAPTER_EXPLICIT_APPROVAL_PHRASE,
    );
    expect(contract.future_live_adapter_state).toBe(
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    );
    expect(contract.future_live_adapter_state).toBe(
      LIVE_CONFIG_ADAPTER_FUTURE_STATE,
    );
  });

  it("declares canonical 001 lane order", () => {
    const contract = makeContract();
    expect(contract.lane_order).toEqual(EXPECTED_LANE_ORDER);
    expect(contract.lane_order).toEqual(fixture001.lanes.map((l) => l.lane));
  });
});

describe("MODEL-STRATEGY-006B safety invariants", () => {
  it("all 9 allowed-style invariants are hard false", () => {
    const contract = makeContract();
    expect(contract.safety_invariants).toEqual({
      live_config_writes_allowed: false,
      automatic_routing_enabled: false,
      runtime_router_allowed: false,
      hcc_auto_executor_allowed: false,
      credential_pool_allowed: false,
      keychain_integration_allowed: false,
      local_runtime_activation_allowed: false,
      api_key_write_allowed: false,
      secret_write_allowed: false,
    });
    expect(Object.values(contract.safety_invariants).every((v) => v === false)).toBe(
      true,
    );
  });

  it("backup and rollback specs remain dry-run and approval-gated", () => {
    const contract = makeContract();
    for (const spec of [contract.backup_spec, contract.rollback_spec]) {
      expect(spec.dry_run_only).toBe(true);
      expect(spec.requires_explicit_approval).toBe(true);
      expect(spec.backup_command.length).toBeGreaterThan(0);
      expect(spec.verify_backup_command.length).toBeGreaterThan(0);
      expect(spec.rollback_command.length).toBeGreaterThan(0);
      expect(spec.rollback_command).toContain("mv ");
      expect(spec.rollback_command).not.toContain("rm ");
    }
  });
});

describe("MODEL-STRATEGY-006B write field spec", () => {
  it("emits 6 write field entries in fixed order", () => {
    const contract = makeContract();
    expect(contract.write_field_spec).toHaveLength(6);
    expect(contract.write_field_spec.map((f) => f.config_path)).toEqual([
      "provider_defaults[<lane>].provider",
      "provider_defaults[<lane>].base_url",
      "provider_defaults[<lane>].model_id",
      "provider_defaults[<lane>].api_key",
      "rollback_baseline",
      "candidate_profile",
    ]);
  });

  it("api_key is never allowed to write and requires redaction", () => {
    const contract = makeContract();
    const apiKeyField = contract.write_field_spec.find((f) =>
      f.config_path.endsWith(".api_key"),
    )!;
    expect(apiKeyField.allowed_value_source).toBe("not_allowed_to_write");
    expect(apiKeyField.secret_redaction_required).toBe(true);
    expect(apiKeyField.requires_pre_write_backup).toBe(true);
    expect(apiKeyField.applies_to_lanes).toEqual(EXPECTED_LANE_ORDER);
  });

  it("provider/model are catalog-derived, base_url is user input, candidate_profile is projection only", () => {
    const contract = makeContract();
    const byPath = new Map(contract.write_field_spec.map((f) => [f.config_path, f]));
    expect(byPath.get("provider_defaults[<lane>].provider")?.allowed_value_source).toBe(
      "derived_from_catalog_only",
    );
    expect(byPath.get("provider_defaults[<lane>].model_id")?.allowed_value_source).toBe(
      "derived_from_catalog_only",
    );
    expect(byPath.get("provider_defaults[<lane>].base_url")?.allowed_value_source).toBe(
      "user_input",
    );
    expect(byPath.get("candidate_profile")?.allowed_value_source).toBe(
      "not_allowed_to_write",
    );
  });
});

describe("MODEL-STRATEGY-006B validation check vocabulary", () => {
  it("has 5 pre-write and 4 post-write checks under 200 chars", () => {
    const contract = makeContract();
    expect(contract.pre_write_validation_checks).toHaveLength(5);
    expect(contract.post_write_verification_checks).toHaveLength(4);
    for (const check of [
      ...contract.pre_write_validation_checks,
      ...contract.post_write_verification_checks,
    ]) {
      expect(check.length).toBeGreaterThan(0);
      expect(check.length).toBeLessThan(200);
    }
  });

  it("names backup verification pre-write and no-secret verification post-write", () => {
    const contract = makeContract();
    expect(contract.pre_write_validation_checks).toContain(
      "backup file created and verified",
    );
    expect(contract.post_write_verification_checks).toContain(
      "no API key / token / secret-like values in written config",
    );
  });
});

describe("MODEL-STRATEGY-006B cross-slice alignment", () => {
  it("rollback baseline matches 001 fixture exactly", () => {
    const contract = makeContract();
    expect(contract.rollback_baseline_reference).toEqual({
      daily_model: "minimax2.7",
      task_fallback_model: "deepseekV4pro",
      live_config_write_allowed: false,
    });
    expect(contract.rollback_baseline_reference.daily_model).toBe(
      fixture001.rollback_baseline.daily_model,
    );
    expect(contract.rollback_baseline_reference.task_fallback_model).toBe(
      fixture001.rollback_baseline.task_fallback_model,
    );
  });

  it("api_key not_allowed_to_write aligns with 006A user-provided credentials", () => {
    const requirements = buildLaneProviderRequirements(
      fixture001,
      catalog,
      smokeMatrix,
    );
    expect(requirements.credential_source).toBe("user_provided");
    expect(
      requirements.requirements.every((r) => r.credential_source === "user_provided"),
    ).toBe(true);

    const contract = makeContract();
    const apiKeyField = contract.write_field_spec.find((f) =>
      f.config_path.endsWith(".api_key"),
    )!;
    expect(apiKeyField.allowed_value_source).toBe("not_allowed_to_write");
    expect(contract.safety_invariants.api_key_write_allowed).toBe(false);
    expect(contract.safety_invariants.secret_write_allowed).toBe(false);
  });

  it("all lane-scoped field specs use 001 lane identifiers", () => {
    const contract = makeContract();
    for (const field of contract.write_field_spec) {
      for (const lane of field.applies_to_lanes) {
        expect(EXPECTED_LANE_ORDER).toContain(lane);
      }
    }
  });
});

describe("MODEL-STRATEGY-006B immutability and determinism", () => {
  it("does not modify the 001 fixture input", () => {
    const before = deepClone(fixture001);
    buildLiveConfigApprovalContract(fixture001);
    expect(fixture001).toEqual(before);
  });

  it("serializes deterministically across two calls", () => {
    const a = buildLiveConfigApprovalContract(fixture001);
    const b = buildLiveConfigApprovalContract(fixture001);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).toEqual(b);
  });
});

describe("MODEL-STRATEGY-006B negative invariants", () => {
  it("does not accept injected approval_state approved", () => {
    const contract = buildLiveConfigApprovalContract(fixture001, {
      approval_state: "approved",
    });
    expect(contract.approval_state).toBe("not_approved");
  });

  it("does not adopt injected secret-like backup command", () => {
    const contract = buildLiveConfigApprovalContract(fixture001, {
      backup_command:
        "cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak && echo sk-abcdef1234567890",
    });
    expect(contract.backup_spec.backup_command).not.toContain(
      "sk-abcdef1234567890",
    );
    expect(contract.backup_spec.backup_command).toBe(
      "cp ~/.hermes/config.yaml ~/.hermes/config.yaml.bak.<timestamp>",
    );
  });
});

describe("MODEL-STRATEGY-006B source guardrails", () => {
  it("helper source has no runtime, network, IPC, handoff, or audit call surfaces", () => {
    for (const forbidden of [
      "window.hermesAPI",
      "ipcRenderer",
      "ipcMain",
      "fetch(",
      "spawn(",
      "exec(",
      "fs.writeFileSync(",
      "fs.writeFile(",
      "writeFileSync(",
      "writeFile(",
      "setModelConfig",
      "setEnv",
      "saveModelConfig",
      "startGateway",
      "runPlaybook",
      "triggerCronJob",
      "knowledgeIngest",
      "handoff/packs",
      ".hermes/audit",
      "general_availability",
      "cp -f",
      "rm -rf",
    ]) {
      expect(helperSrc).not.toContain(forbidden);
    }
  });

  it("shell-like backup strings exist only as contract field values", () => {
    const contract = makeContract();
    expect(contract.backup_spec.backup_command).toContain("cp ");
    expect(contract.backup_spec.verify_backup_command).toContain("diff ");
    expect(contract.rollback_spec.rollback_command).toContain("mv ");
    expect(helperSrc).toContain("backup_command");
    expect(helperSrc).toContain("rollback_command");
  });
});
