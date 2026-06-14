import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  adaptHermesPlanTaskToDryRun,
  HCC_HERMES_PLAN_TASK_ADAPTER_SCHEMA_VERSION,
  type HermesPlanTaskDescriptor,
} from "../../src/shared/lib/hcc-hermes-plan-task-adapter";

const REPO_ROOT = resolve(__dirname, "../..");

function makeTask(
  overrides: Partial<HermesPlanTaskDescriptor> = {},
): HermesPlanTaskDescriptor {
  return {
    task_id: "PLAN-TASK-001",
    title: "Read repo status",
    source_plan_ref: "plan:2026-06:task-001",
    requested_by_user: "u-001",
    authorization: { authorized: true, user_id: "u-001" },
    ...overrides,
  };
}

describe("HCC hermes plan task adapter: missing requested_by_user", () => {
  it("missing requested_by_user -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({ requested_by_user: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("missing requested_by_user");
  });

  it("whitespace-only requested_by_user -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({ requested_by_user: "   " }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC hermes plan task adapter: missing or false authorization", () => {
  it("missing authorization -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({ authorization: undefined as unknown as HermesPlanTaskDescriptor["authorization"] }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization");
  });

  it("authorization.authorized=false -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({ authorization: { authorized: false } }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC hermes plan task adapter: missing gate_input_override", () => {
  it("authorization true but no override -> NO-GO (auth != evidence)", () => {
    const r = adaptHermesPlanTaskToDryRun(makeTask());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("missing gate_input_override");
  });

  it("missing gate_input_override reason mentions evidence state", () => {
    const r = adaptHermesPlanTaskToDryRun(makeTask());
    expect(r.reason).toMatch(/evidence state/i);
  });
});

describe("HCC hermes plan task adapter: incomplete gate_input_override", () => {
  it("override with one evidence flag false -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({
        gate_input_override: {
          evidence_satisfied: {
            real_action_whitelist_present: true,
            rollback_rehearsal_present: true,
            budget_rate_limit_present: true,
            audit_artifact_persistence_present: true,
            rollback_rehearsal_passed: true,
            budget_caps_calibrated: true,
            audit_path_policy_valid: false,
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
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("incomplete gate_input_override");
  });

  it("override with blocker not resolved -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({
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
            night_run_ready_literal_false: false,
          },
          explicit_user_authorization_recorded: true,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("incomplete gate_input_override");
  });
});

describe("HCC hermes plan task adapter: all three gates satisfied", () => {
  it("authorization + fully-satisfied override -> GO-CANDIDATE_DRY_RUN_PRODUCED", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({
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
      }),
    );
    expect(r.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });
});

describe("HCC hermes plan task adapter: result invariants", () => {
  it("result has all literal-false execution fields", () => {
    const r = adaptHermesPlanTaskToDryRun(makeTask());
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("surface_result has literal-false execution fields", () => {
    const r = adaptHermesPlanTaskToDryRun(makeTask());
    expect(r.surface_result.would_execute).toBe(false);
    expect(r.surface_result.executed_commands).toEqual([]);
    expect(r.surface_result.subprocess_count).toBe(0);
    expect(r.surface_result.auto_executor_started).toBe(false);
    expect(r.surface_result.any_command_executed).toBe(false);
    expect(r.surface_result.real_execution_ready).toBe(false);
    expect(r.surface_result.unattended_ready).toBe(false);
    expect(r.surface_result.go_no_go).toBe("NO-GO");
  });

  it("task_id / title / source_plan_ref are preserved", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeTask({
        task_id: "PLAN-2026-X",
        title: "Inspect diff",
        source_plan_ref: "plan:2026-06:task-X",
      }),
    );
    expect(r.task_id).toBe("PLAN-2026-X");
    expect(r.title).toBe("Inspect diff");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-X");
  });
});

describe("HCC hermes plan task adapter: schema + invariants", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_HERMES_PLAN_TASK_ADAPTER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("night_run_ready=false + go_no_go=NO-GO preserved in controlled-executor", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

describe("HCC hermes plan task adapter: src static guard", () => {
  const modulePath = resolve(
    REPO_ROOT,
    "src/shared/lib/hcc-hermes-plan-task-adapter.ts",
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
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/submitDryRunAction/);
  });

  it("does NOT write ~/.hermes/** (only doc comment refs)", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/\bwriteFile\s*\(/);
  });
});