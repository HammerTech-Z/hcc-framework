import { describe, expect, it } from "vitest";
import {
  HCC_DANGER_POLICY_MATRIX,
  HCC_PROGRESS_REQUIRED_SECTIONS,
  HCC_STEP_ACTION_TYPE_TO_DANGER_ACTIONS,
  HCC_TASK_HANDOFF_POLICY_SCHEMA_VERSION,
  assertHCCHandoffPolicyNoRuntimeAuthorization,
  assertNoDangerPolicyAutoApproval,
  dangerActionsForHCCStepActionType,
  getDangerPolicyForAction,
  validateHCCProgressRecord,
  validateHCCTaskHandoffPlan,
  type HCCDangerAction,
  type HCCProgressRecord,
  type HCCTaskHandoffPlan,
} from "@shared/lib/safety/hcc-task-handoff-policy";
import type { HCCStep } from "../../src/main/hcc-task-types";

const completePlan = (
  overrides: Partial<HCCTaskHandoffPlan> = {},
): HCCTaskHandoffPlan => ({
  schema_version: "1.0.0",
  completed_baseline: [
    {
      id: "HERMES-GOV-005",
      summary: "B1 runtime readiness matrix committed and pushed",
      evidence_refs: [
        "git: c9492be4afd59cfc2651568d2c4ca19ee10fd321",
      ],
      verified: true,
      append_only: true,
    },
  ],
  in_progress: {
    task_id: "HERMES-GOV-006",
    objective: "Add pure handoff progress and danger policy",
    owner: "codex",
    status: "in_progress",
    evidence_ref: "docs/plan/progress.md",
  },
  next_step: {
    task_id: "HERMES-GOV-007",
    objective: "Refine gateway / IPC readiness after user review",
    input_conditions: ["HERMES-GOV-006 committed and pushed"],
    success_criteria: ["B1 gateway / IPC readiness remains pure"],
    requires_user_authorization: true,
  },
  ...overrides,
});

const completeProgress = (
  overrides: Partial<HCCProgressRecord> = {},
): HCCProgressRecord => ({
  schema_version: "1.0.0",
  changed_this_round: [
    "Added hcc-task-handoff-policy pure contract",
  ],
  last_successful_command: {
    command: "npx vitest run tests/safety/hcc-task-handoff-policy.test.ts",
    expected_success_signal: "Test Files 1 passed",
    trust_level: "reproduced",
  },
  current_blocker: null,
  next_plan: "Ask user to approve commit after Codex audit",
  ...overrides,
});

describe("HERMES-GOV-006 HCC task handoff policy", () => {
  it("pins schema_version on handoff and progress contracts", () => {
    expect(HCC_TASK_HANDOFF_POLICY_SCHEMA_VERSION).toBe("1.0.0");
    expect(completePlan().schema_version).toBe("1.0.0");
    expect(completeProgress().schema_version).toBe("1.0.0");
  });

  it("accepts a handoff plan with exactly one in_progress task", () => {
    const result = validateHCCTaskHandoffPlan(completePlan());
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects multiple in_progress tasks", () => {
    const malformed = {
      ...completePlan(),
      in_progress: [
        completePlan().in_progress,
        {
          ...completePlan().in_progress,
          task_id: "HERMES-GOV-006B",
        },
      ],
    } as unknown as HCCTaskHandoffPlan;
    const result = validateHCCTaskHandoffPlan(malformed);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "in_progress must be exactly one task object",
    );
  });

  it("requires completed baselines to carry evidence refs and append-only markers", () => {
    const missingEvidence = completePlan({
      completed_baseline: [
        {
          id: "HERMES-GOV-005",
          summary: "missing evidence",
          evidence_refs: [],
          verified: true,
          append_only: true,
        },
      ],
    });
    const result = validateHCCTaskHandoffPlan(missingEvidence);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "completed_baseline[0].evidence_refs must contain evidence refs",
    );

    const notAppendOnly = completePlan({
      completed_baseline: [
        {
          ...completePlan().completed_baseline[0],
          append_only: false as true,
        },
      ],
    });
    expect(validateHCCTaskHandoffPlan(notAppendOnly).errors).toContain(
      "completed_baseline[0].append_only must be true",
    );
  });

  it("requires next_step input conditions and success criteria", () => {
    const noInputs = completePlan({
      next_step: {
        ...completePlan().next_step,
        input_conditions: [],
      },
    });
    expect(validateHCCTaskHandoffPlan(noInputs).errors).toContain(
      "next_step.input_conditions must be non-empty",
    );

    const noSuccess = completePlan({
      next_step: {
        ...completePlan().next_step,
        success_criteria: [],
      },
    });
    expect(validateHCCTaskHandoffPlan(noSuccess).errors).toContain(
      "next_step.success_criteria must be non-empty",
    );
  });

  it("defines the progress record as exactly four business sections plus schema_version", () => {
    expect(HCC_PROGRESS_REQUIRED_SECTIONS).toEqual([
      "changed_this_round",
      "last_successful_command",
      "current_blocker",
      "next_plan",
    ]);
    expect(validateHCCProgressRecord(completeProgress())).toEqual({
      valid: true,
      errors: [],
    });

    const extra = {
      ...completeProgress(),
      hidden_notes: "not allowed",
    } as unknown as HCCProgressRecord;
    const result = validateHCCProgressRecord(extra);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "progress record must contain exactly the four sections",
    );
  });

  it("rejects progress records with missing next_plan", () => {
    const result = validateHCCProgressRecord(
      completeProgress({ next_plan: "" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("next_plan must be non-empty");
  });

  it("requires reproducible last_successful_command format when present", () => {
    expect(
      validateHCCProgressRecord(
        completeProgress({
          last_successful_command: {
            command: "npm run typecheck",
            expected_success_signal: "typecheck:web",
            trust_level: "human_confirmed",
          },
        }),
      ).valid,
    ).toBe(true);

    const result = validateHCCProgressRecord(
      completeProgress({
        last_successful_command: {
          command: "",
          expected_success_signal: "",
          trust_level: "single_run",
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "last_successful_command.command is required",
    );
    expect(result.errors).toContain(
      "last_successful_command.expected_success_signal is required",
    );
  });

  it("keeps optional last_successful_command trust_level bounded", () => {
    const result = validateHCCProgressRecord(
      completeProgress({
        last_successful_command: {
          command: "npm run typecheck",
          expected_success_signal: "typecheck:web",
          trust_level: "invented" as "reproduced",
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "last_successful_command.trust_level is invalid",
    );
  });

  it("requires user approval for delete_file / install_dependency / bulk_code_change", () => {
    for (const action of [
      "delete_file",
      "install_dependency",
      "bulk_code_change",
    ] as const satisfies readonly HCCDangerAction[]) {
      const policy = getDangerPolicyForAction(action);
      expect(policy.decision).toBe("requires_user_approval");
      expect(policy.user_approval_required).toBe(true);
      expect(policy.auto_approval_allowed_for).toEqual([]);
    }
  });

  it("does not provide any HCC / Codex / Claude Code self-approval path", () => {
    const result = assertNoDangerPolicyAutoApproval();
    expect(result).toEqual({ valid: true, errors: [] });
    for (const entry of HCC_DANGER_POLICY_MATRIX) {
      expect(entry.auto_approval_allowed_for).not.toContain("hcc");
      expect(entry.auto_approval_allowed_for).not.toContain("codex");
      expect(entry.auto_approval_allowed_for).not.toContain("claude_code");
    }
  });

  it("maps every HCCStep.actionType to a danger matrix bucket", () => {
    const mapping = HCC_STEP_ACTION_TYPE_TO_DANGER_ACTIONS satisfies Record<
      HCCStep["actionType"],
      readonly HCCDangerAction[]
    >;

    expect(Object.keys(mapping).sort()).toEqual(
      ([
        "delete",
        "execute",
        "privileged",
        "publish",
        "read",
        "write",
      ] satisfies HCCStep["actionType"][]).sort(),
    );
    expect(dangerActionsForHCCStepActionType("delete")).toContain(
      "delete_file",
    );
    expect(dangerActionsForHCCStepActionType("execute")).toContain(
      "install_dependency",
    );
    expect(dangerActionsForHCCStepActionType("write")).toContain(
      "bulk_code_change",
    );
  });

  it("does not authorize runtime / daemon / cron / weixin / channel / live apply / HCC Auto Executor", () => {
    expect(assertHCCHandoffPolicyNoRuntimeAuthorization()).toEqual({
      schema_version: "1.0.0",
      no_runtime: true,
      no_daemon: true,
      no_cron: true,
      no_weixin: true,
      no_channel_runtime: true,
      no_live_apply: true,
      no_hcc_auto_executor: true,
      no_progress_file_write: true,
    });
  });
});
