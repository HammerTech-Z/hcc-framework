import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  callControlledDryRun,
  HCC_CALL_SURFACE_SCHEMA_VERSION,
  type DryRunCallInput,
  type DryRunCallResult,
} from "../../src/shared/lib/hcc-controlled-dry-run-call-surface";

const REPO_ROOT = resolve(__dirname, "../..");

function makeInput(overrides: Partial<DryRunCallInput> = {}): DryRunCallInput {
  return {
    mode: "default_no_go",
    ...overrides,
  };
}

describe("HCC dry-run call surface: default_no_go mode", () => {
  it("default_no_go produces NO-GO artifact", () => {
    const r = callControlledDryRun(makeInput({ mode: "default_no_go" }));
    expect(r.artifact.verdict).toBe("NO-GO");
    expect(r.artifact.would_execute).toBe(false);
  });

  it("surface result has all literal-false execution fields", () => {
    const r = callControlledDryRun(makeInput());
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC dry-run call surface: explicit_no_go mode", () => {
  it("explicit_no_go produces NO-GO artifact", () => {
    const r = callControlledDryRun(makeInput({ mode: "explicit_no_go" }));
    expect(r.artifact.verdict).toBe("NO-GO");
  });
});

describe("HCC dry-run call surface: explicit_user_authorized_go_candidate", () => {
  it("without auth record -> NO-GO (mode is descriptive, not sufficient)", () => {
    const r = callControlledDryRun(
      makeInput({ mode: "explicit_user_authorized_go_candidate" }),
    );
    expect(r.artifact.verdict).toBe("NO-GO");
  });

  it("with authorized=true -> GO-CANDIDATE_DRY_RUN_PRODUCED", () => {
    const r = callControlledDryRun(
      makeInput({
        mode: "explicit_user_authorized_go_candidate",
        explicit_user_authorization_record: { authorized: true },
      }),
    );
    expect(r.artifact.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });

  it("with authorized=false -> NO-GO (auth false forces NO-GO)", () => {
    const r = callControlledDryRun(
      makeInput({
        mode: "explicit_user_authorized_go_candidate",
        explicit_user_authorization_record: { authorized: false },
      }),
    );
    expect(r.artifact.verdict).toBe("NO-GO");
  });

  it("GO-CANDIDATE result still has literal-false execution fields", () => {
    const r = callControlledDryRun(
      makeInput({
        mode: "explicit_user_authorized_go_candidate",
        explicit_user_authorization_record: { authorized: true },
      }),
    );
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC dry-run call surface: gate_input_override", () => {
  it("override takes precedence over mode", () => {
    const r = callControlledDryRun({
      mode: "default_no_go",
      gate_input_override: {
        evidence_satisfied: {
          real_action_whitelist_present: true,
          rollback_rehearsal_present: true,
          budget_rate_limit_present: true,
          audit_artifact_persistence_present: true,
          rollback_rehearsal_passed: true,
          budget_caps_calibrated: true,
          audit_path_policy_valid: true,
        },
        verifier_satisfied: { verifier_required: true },
        blockers_resolved: {
          p3_real_execution_not_approved: true,
          hermes_config_write_not_approved: true,
          auto_executor_self_arming_forbidden: true,
          night_run_ready_literal_false: true,
        },
        explicit_user_authorization_recorded: true,
      },
    });
    expect(r.artifact.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });

  it("override with no auth produces NO-GO", () => {
    const r = callControlledDryRun({
      mode: "explicit_user_authorized_go_candidate",
      gate_input_override: {
        evidence_satisfied: {},
        verifier_satisfied: {},
        blockers_resolved: {},
        explicit_user_authorization_recorded: false,
      },
    });
    expect(r.artifact.verdict).toBe("NO-GO");
  });
});

describe("HCC dry-run call surface: explicit_user_authorization_record", () => {
  it("auth_record.authorized=true overrides gate input's auth field", () => {
    const r = callControlledDryRun({
      mode: "default_no_go",
      explicit_user_authorization_record: { authorized: true, user_id: "u-001" },
    });
    // mode=default_no_go -> base gate input has auth=false; override
    // would set it to true, but base has no evidence/verifiers. So
    // verdict is still NO-GO (gates unsatisfied). Auth override
    // alone does not flip verdict.
    expect(r.artifact.verdict).toBe("NO-GO");
  });

  it("auth_record.authorized=true + go_candidate mode + base satisfied = GO-CANDIDATE", () => {
    const r = callControlledDryRun({
      mode: "explicit_user_authorized_go_candidate",
      explicit_user_authorization_record: { authorized: true },
    });
    expect(r.artifact.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });
});

describe("HCC dry-run call surface: plan_execution_id", () => {
  it("plan_execution_id is accepted and does not affect verdict", () => {
    const r = callControlledDryRun({
      mode: "explicit_user_authorized_go_candidate",
      explicit_user_authorization_record: { authorized: true },
      plan_execution_id: "PLAN-2026-001",
    });
    expect(r.artifact.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });
});

describe("HCC dry-run call surface: schema + invariants", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_CALL_SURFACE_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("night_run_ready=false / go_no_go=NO-GO preserved in controlled-executor", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

describe("HCC dry-run call surface: src static guard", () => {
  const modulePath = resolve(
    REPO_ROOT,
    "src/shared/lib/hcc-controlled-dry-run-call-surface.ts",
  );
  const src = readFileSync(modulePath, "utf8");

  it("does NOT call spawn / exec / child_process", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/\bspawn\s*\(/);
    expect(s).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT import bootstrap / arm / start / host", () => {
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("does NOT call submitDryRunAction", () => {
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("does NOT write ~/.hermes/** (only doc comment refs)", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/\bwriteFile\s*\(/);
  });
});