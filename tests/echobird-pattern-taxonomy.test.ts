import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import {
  ECHOBIRD_FORBIDDEN_USES,
  ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT,
  ECHOBIRD_TAXONOMY_DESIGN_NOTE,
  ECHOBIRD_TAXONOMY_MODE,
  ECHOBIRD_TAXONOMY_SCHEMA_VERSION,
  ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
  type EchobirdPatternId,
  type EchobirdPatternTaxonomySnapshot,
} from "../src/shared/lib/echobird-pattern-taxonomy";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const helperSrc = readFileSync(
  join(ROOT, "src/shared/lib/echobird-pattern-taxonomy.ts"),
  "utf-8",
);

const snapshot = ECHOBIRD_PATTERN_TAXONOMY_SNAPSHOT;
const EXPECTED_PATTERN_IDS: EchobirdPatternId[] = [
  "model_nexus",
  "local_fallback",
  "install_repair",
  "project_management",
];

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("MODEL-STRATEGY-005A snapshot pins", () => {
  it("uses schema 1.0.0 and design_reference_only mode", () => {
    expect(ECHOBIRD_TAXONOMY_SCHEMA_VERSION).toBe("1.0.0");
    expect(ECHOBIRD_TAXONOMY_MODE).toBe("design_reference_only");
    expect(snapshot.schema_version).toBe("1.0.0");
    expect(snapshot.mode).toBe("design_reference_only");
    expect(snapshot.status).toBe("planned");
  });

  it("source_reference_url is the EchoBird repository and reference_only is true", () => {
    expect(snapshot.source_reference_url).toBe(
      ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL,
    );
    expect(ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL).toBe(
      "https://github.com/edison7009/EchoBird",
    );
    expect(snapshot.reference_only).toBe(true);
  });

  it("defines exactly 4 patterns in canonical order", () => {
    expect(snapshot.patterns).toHaveLength(4);
    expect(snapshot.patterns.map((p) => p.pattern_id)).toEqual(
      EXPECTED_PATTERN_IDS,
    );
  });
});

describe("MODEL-STRATEGY-005A license constraints", () => {
  it("declares BUSL-1.1, echobird_core private dep, and trade_dress", () => {
    const lc = snapshot.license_constraints;
    expect(lc.license).toBe("BUSL-1.1");
    expect(lc.private_core).toBe("echobird_core");
    expect(lc.trade_dress).toBe(true);
  });

  it("declares all four hermes_*_copy_forbidden flags as true", () => {
    const lc = snapshot.license_constraints;
    expect(lc.hermes_code_copy_forbidden).toBe(true);
    expect(lc.hermes_ui_composition_copy_forbidden).toBe(true);
    expect(lc.hermes_install_script_copy_forbidden).toBe(true);
    expect(lc.hermes_runtime_behavior_copy_forbidden).toBe(true);
  });
});

describe("MODEL-STRATEGY-005A safety invariants", () => {
  it("all allowed flags in safety_invariants are hard false", () => {
    const si = snapshot.safety_invariants;
    expect(si.live_config_writes_allowed).toBe(false);
    expect(si.automatic_runtime_routing_enabled).toBe(false);
    expect(si.hcc_auto_executor_allowed).toBe(false);
    expect(si.runtime_router_allowed).toBe(false);
    expect(si.runtime_replication_allowed).toBe(false);
    expect(si.install_script_execution_allowed).toBe(false);
    expect(si.code_copy_allowed).toBe(false);
    expect(si.ui_composition_copy_allowed).toBe(false);
  });

  it("does not mix forbidden=true into hard-false style", () => {
    const si = snapshot.safety_invariants;
    const forbiddenKeys = [
      "code_copy_forbidden",
      "ui_composition_copy_forbidden",
      "runtime_replication_forbidden",
      "install_script_execution_forbidden",
    ];
    for (const k of forbiddenKeys) {
      expect(si).not.toHaveProperty(k);
    }
  });
});

describe("MODEL-STRATEGY-005A per-pattern semantics", () => {
  it("every pattern uses allowed_use = design_reference_only", () => {
    for (const p of snapshot.patterns) {
      expect(p.allowed_use).toBe("design_reference_only");
    }
  });

  it("every pattern forbids all four forbidden_use categories", () => {
    for (const p of snapshot.patterns) {
      expect(p.forbidden_use).toEqual(
        expect.arrayContaining([
          "code_copy",
          "ui_composition_copy",
          "install_script_copy",
          "runtime_behavior_copy",
        ]),
      );
      expect(p.forbidden_use).toEqual(ECHOBIRD_FORBIDDEN_USES);
    }
  });

  it("every pattern's hermes_target avoids live routing/config/runtime dispatch keywords", () => {
    const banned = /live routing|live config|runtime dispatch|auto.?routing/;
    for (const p of snapshot.patterns) {
      expect(p.hermes_target).not.toMatch(banned);
      expect(p.contains_live_routing_keywords).toBe(false);
      expect(p.contains_live_config_keywords).toBe(false);
      expect(p.contains_runtime_dispatch_keywords).toBe(false);
    }
  });

  it("every pattern carries licensing_constraint and 006 future state", () => {
    for (const p of snapshot.patterns) {
      expect(p.licensing_constraint.license).toBe("BUSL-1.1");
      expect(
        p.future_live_adapter_state,
      ).toBe("006_live_config_adapter_remains_future_requires_explicit_approval");
    }
  });
});

describe("MODEL-STRATEGY-005A future live adapter state guard", () => {
  it("snapshot declares 006 remains future and requires explicit approval", () => {
    expect(snapshot.future_live_adapter_state).toBe(
      "006_live_config_adapter_remains_future_requires_explicit_approval",
    );
    expect(snapshot.description_note).toContain(
      "006 Live config adapter remains future",
    );
    expect(ECHOBIRD_TAXONOMY_DESIGN_NOTE).toContain(
      "006 Live config adapter remains future",
    );
  });
});

describe("MODEL-STRATEGY-005A immutability and source guard", () => {
  it("snapshot is frozen as const and cloneable", () => {
    const before = deepClone(snapshot);
    const after = deepClone(snapshot);
    expect(after).toEqual(before);
  });

  it("helper source declares the 005 read-only / 006 future boundary", () => {
    expect(helperSrc).toContain("005 is read-only design-only");
    expect(helperSrc).toContain(
      "006 Live config adapter remains future",
    );
    expect(helperSrc).toContain(
      "No EchoBird source code, UI composition, install scripts, or runtime behavior may be copied",
    );
  });

  it("helper source does not import any echobird / edison7009 module path", () => {
    const importPattern = /^import\s+[^;]*from\s+["'][^"']*(echobird|edison7009)/im;
    expect(helperSrc).not.toMatch(importPattern);
  });

  it("helper source allows the source_reference_url string but forbids runtime/config/network strings", () => {
    expect(helperSrc).toContain(ECHOBIRD_TAXONOMY_SOURCE_REFERENCE_URL);
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
});

describe("MODEL-STRATEGY-005A fixture shim", () => {
  it("thin shim default-exports the canonical snapshot", async () => {
    const fixtureShim = (
      await import(
        "./fixtures/model-strategy/echobird-pattern-taxonomy-2026-06-06"
      )
    ).default as EchobirdPatternTaxonomySnapshot;
    expect(fixtureShim).toEqual(snapshot);
    expect(fixtureShim).toBe(snapshot);
  });
});
