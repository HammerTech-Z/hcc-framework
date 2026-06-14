import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  adaptHermesPlanTaskToDryRun,
  type HermesPlanTaskDescriptor,
} from "../../src/shared/lib/hcc-hermes-plan-task-adapter";

const REPO_ROOT = resolve(__dirname, "../..");

/**
 * Local/test harness for the Hermes Pro plan dry-run path.
 *
 * Proves the flow:
 *   HermesPlanTaskDescriptor
 *     -> adaptHermesPlanTaskToDryRun()
 *     -> HermesPlanTaskAdapterResult
 *
 * This is dry-run only. Real execution remains NO-GO. The harness never
 * calls submitDryRunAction, never spawns a subprocess, never writes to
 * ~/.hermes/**, and never arms/starts Auto Executor.
 */

function makeFullySatisfiedOverride() {
  return {
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
  };
}

function makeFixtureTask(
  overrides: Partial<HermesPlanTaskDescriptor> = {},
): HermesPlanTaskDescriptor {
  return {
    task_id: "PLAN-HARNESS-001",
    title: "Inspect repo status for Hermes Pro plan",
    source_plan_ref: "plan:2026-06:task-harness-001",
    requested_by_user: "u-harness",
    authorization: { authorized: true, user_id: "u-harness" },
    ...overrides,
  };
}

describe("HCC hermes plan dry-run harness: GO path (controlled dry-run, no real exec)", () => {
  it("fixture with all three gates satisfied -> GO-CANDIDATE_DRY_RUN_PRODUCED", () => {
    const task = makeFixtureTask({ gate_input_override: makeFullySatisfiedOverride() });
    const r = adaptHermesPlanTaskToDryRun(task);
    expect(r.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });

  it("all execution fields remain literal false / zero", () => {
    const task = makeFixtureTask({ gate_input_override: makeFullySatisfiedOverride() });
    const r = adaptHermesPlanTaskToDryRun(task);
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

  it("surface_result also stays literal-false", () => {
    const task = makeFixtureTask({ gate_input_override: makeFullySatisfiedOverride() });
    const r = adaptHermesPlanTaskToDryRun(task);
    expect(r.surface_result.would_execute).toBe(false);
    expect(r.surface_result.executed_commands).toEqual([]);
    expect(r.surface_result.subprocess_count).toBe(0);
    expect(r.surface_result.auto_executor_started).toBe(false);
    expect(r.surface_result.any_command_executed).toBe(false);
    expect(r.surface_result.real_execution_ready).toBe(false);
    expect(r.surface_result.unattended_ready).toBe(false);
    expect(r.surface_result.go_no_go).toBe("NO-GO");
  });

  it("task_id / title / source_plan_ref are preserved end-to-end", () => {
    const task = makeFixtureTask({
      task_id: "PLAN-HARNESS-2026-X",
      title: "Inspect diff for harness",
      source_plan_ref: "plan:2026-06:task-harness-X",
      gate_input_override: makeFullySatisfiedOverride(),
    });
    const r = adaptHermesPlanTaskToDryRun(task);
    expect(r.task_id).toBe("PLAN-HARNESS-2026-X");
    expect(r.title).toBe("Inspect diff for harness");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-harness-X");
  });
});

describe("HCC hermes plan dry-run harness: negative — auth true, override missing", () => {
  it("auth true but no gate_input_override -> NO-GO (auth != evidence)", () => {
    const r = adaptHermesPlanTaskToDryRun(makeFixtureTask());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("missing gate_input_override");
  });
});

describe("HCC hermes plan dry-run harness: negative — gate_input_override incomplete", () => {
  it("one evidence flag false -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeFixtureTask({
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

  it("a blocker not resolved -> NO-GO", () => {
    const r = adaptHermesPlanTaskToDryRun(
      makeFixtureTask({
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

describe("HCC hermes plan dry-run harness: src static guard", () => {
  const modulePath = resolve(
    REPO_ROOT,
    "src/shared/lib/hcc-hermes-plan-task-adapter.ts",
  );
  const src = readFileSync(modulePath, "utf8");

  it("adapter does NOT set real_execution_ready: true", () => {
    expect(src).not.toMatch(/real_execution_ready:\s*true/);
  });

  it("adapter does NOT set would_execute: true", () => {
    expect(src).not.toMatch(/would_execute:\s*true/);
  });

  it("adapter does NOT call submitDryRunAction", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/submitDryRunAction/);
  });

  it("adapter does NOT call spawn / exec / child_process", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/\bspawn\s*\(/);
    expect(s).not.toMatch(/child_process/);
  });

  it("adapter does NOT import bootstrap / arm / start / host", () => {
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("adapter does NOT call ipcMain / setInterval / setTimeout", () => {
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });
});
