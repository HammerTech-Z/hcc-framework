// HERMES-GOV-006 :: HCC Task Handoff / Progress / Danger Policy
//
// Pure data + validation helpers. No I/O, no runtime mutation, no IPC,
// no daemon, no cron, no weixin, no channel runtime, no live apply, and
// no HCC Auto Executor. This module models the coordination contract only.

export const HCC_TASK_HANDOFF_POLICY_SCHEMA_VERSION = "1.0.0" as const;

export type HCCProgressTrustLevel =
  | "unverified"
  | "ai_inferred"
  | "single_run"
  | "reproduced"
  | "human_confirmed";

export type HCCProgressSection =
  | "changed_this_round"
  | "last_successful_command"
  | "current_blocker"
  | "next_plan";

export const HCC_PROGRESS_REQUIRED_SECTIONS = [
  "changed_this_round",
  "last_successful_command",
  "current_blocker",
  "next_plan",
] as const satisfies readonly HCCProgressSection[];

export type HCCDangerAction =
  | "delete_file"
  | "install_dependency"
  | "bulk_code_change";

export type HCCDangerDecision = "requires_user_approval";

export type HCCExecutorOwner = "hcc" | "codex" | "claude_code";

export type HCCStepActionType =
  | "read"
  | "write"
  | "delete"
  | "execute"
  | "publish"
  | "privileged";

export interface HCCCompletedBaseline {
  id: string;
  summary: string;
  evidence_refs: readonly string[];
  verified: true;
  append_only: true;
}

export interface HCCInProgressTask {
  task_id: string;
  objective: string;
  owner: HCCExecutorOwner;
  status: "in_progress";
  evidence_ref: string;
}

export interface HCCNextStepPlan {
  task_id: string;
  objective: string;
  input_conditions: readonly string[];
  success_criteria: readonly string[];
  requires_user_authorization: boolean;
}

export interface HCCTaskHandoffPlan {
  schema_version: "1.0.0";
  completed_baseline: readonly HCCCompletedBaseline[];
  in_progress: HCCInProgressTask;
  next_step: HCCNextStepPlan;
}

export interface HCCProgressCommand {
  command: string;
  expected_success_signal: string;
  trust_level?: HCCProgressTrustLevel;
}

export interface HCCProgressRecord {
  schema_version: "1.0.0";
  changed_this_round: readonly string[];
  last_successful_command: HCCProgressCommand | null;
  current_blocker: string | null;
  next_plan: string;
}

export interface HCCDangerPolicyEntry {
  action: HCCDangerAction;
  decision: HCCDangerDecision;
  reason: string;
  user_approval_required: true;
  auto_approval_allowed_for: readonly [];
}

export const HCC_DANGER_POLICY_MATRIX: readonly HCCDangerPolicyEntry[] = [
  {
    action: "delete_file",
    decision: "requires_user_approval",
    reason: "Any file deletion is destructive and requires human review.",
    user_approval_required: true,
    auto_approval_allowed_for: [],
  },
  {
    action: "install_dependency",
    decision: "requires_user_approval",
    reason: "Dependency installation changes supply-chain and lockfile risk.",
    user_approval_required: true,
    auto_approval_allowed_for: [],
  },
  {
    action: "bulk_code_change",
    decision: "requires_user_approval",
    reason: "Cross-file bulk edits require explicit impact-scope approval.",
    user_approval_required: true,
    auto_approval_allowed_for: [],
  },
] as const;

export const HCC_STEP_ACTION_TYPE_TO_DANGER_ACTIONS = {
  read: [],
  write: ["bulk_code_change"],
  delete: ["delete_file"],
  execute: ["install_dependency"],
  publish: [],
  privileged: ["install_dependency", "bulk_code_change"],
} as const satisfies Record<HCCStepActionType, readonly HCCDangerAction[]>;

export interface HCCValidationResult {
  valid: boolean;
  errors: string[];
}

export interface HCCNoRuntimeAuthorizationReport {
  schema_version: "1.0.0";
  no_runtime: true;
  no_daemon: true;
  no_cron: true;
  no_weixin: true;
  no_channel_runtime: true;
  no_live_apply: true;
  no_hcc_auto_executor: true;
  no_progress_file_write: true;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function allNonEmptyStrings(values: readonly unknown[]): boolean {
  return values.every(isNonEmptyString);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  const allowed = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowed.has(key));
}

export function validateHCCTaskHandoffPlan(
  plan: HCCTaskHandoffPlan,
): HCCValidationResult {
  const errors: string[] = [];

  if (!isObject(plan)) {
    return { valid: false, errors: ["handoff plan must be an object"] };
  }
  if (plan.schema_version !== HCC_TASK_HANDOFF_POLICY_SCHEMA_VERSION) {
    errors.push("handoff plan schema_version must be 1.0.0");
  }

  if (!Array.isArray(plan.completed_baseline)) {
    errors.push("completed_baseline must be an array");
  } else {
    for (const [index, baseline] of plan.completed_baseline.entries()) {
      if (!isObject(baseline)) {
        errors.push(`completed_baseline[${index}] must be an object`);
        continue;
      }
      if (!isNonEmptyString(baseline.id)) {
        errors.push(`completed_baseline[${index}].id is required`);
      }
      if (!isNonEmptyString(baseline.summary)) {
        errors.push(`completed_baseline[${index}].summary is required`);
      }
      if (
        !Array.isArray(baseline.evidence_refs) ||
        baseline.evidence_refs.length === 0 ||
        !allNonEmptyStrings(baseline.evidence_refs)
      ) {
        errors.push(
          `completed_baseline[${index}].evidence_refs must contain evidence refs`,
        );
      }
      if (baseline.verified !== true) {
        errors.push(`completed_baseline[${index}].verified must be true`);
      }
      if (baseline.append_only !== true) {
        errors.push(`completed_baseline[${index}].append_only must be true`);
      }
    }
  }

  if (!isObject(plan.in_progress)) {
    errors.push("in_progress must be exactly one task object");
  } else {
    if (Array.isArray(plan.in_progress)) {
      errors.push("in_progress must not be an array");
    }
    if (!isNonEmptyString(plan.in_progress.task_id)) {
      errors.push("in_progress.task_id is required");
    }
    if (!isNonEmptyString(plan.in_progress.objective)) {
      errors.push("in_progress.objective is required");
    }
    if (plan.in_progress.status !== "in_progress") {
      errors.push("in_progress.status must be in_progress");
    }
    if (!isNonEmptyString(plan.in_progress.evidence_ref)) {
      errors.push("in_progress.evidence_ref is required");
    }
  }

  if (!isObject(plan.next_step)) {
    errors.push("next_step must be an object");
  } else {
    if (!isNonEmptyString(plan.next_step.task_id)) {
      errors.push("next_step.task_id is required");
    }
    if (!isNonEmptyString(plan.next_step.objective)) {
      errors.push("next_step.objective is required");
    }
    if (
      !Array.isArray(plan.next_step.input_conditions) ||
      plan.next_step.input_conditions.length === 0 ||
      !allNonEmptyStrings(plan.next_step.input_conditions)
    ) {
      errors.push("next_step.input_conditions must be non-empty");
    }
    if (
      !Array.isArray(plan.next_step.success_criteria) ||
      plan.next_step.success_criteria.length === 0 ||
      !allNonEmptyStrings(plan.next_step.success_criteria)
    ) {
      errors.push("next_step.success_criteria must be non-empty");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateHCCProgressRecord(
  record: HCCProgressRecord,
): HCCValidationResult {
  const errors: string[] = [];

  if (!isObject(record)) {
    return { valid: false, errors: ["progress record must be an object"] };
  }
  if (
    !hasOnlyKeys(record, [
      "schema_version",
      "changed_this_round",
      "last_successful_command",
      "current_blocker",
      "next_plan",
    ])
  ) {
    errors.push("progress record must contain exactly the four sections");
  }
  if (record.schema_version !== HCC_TASK_HANDOFF_POLICY_SCHEMA_VERSION) {
    errors.push("progress record schema_version must be 1.0.0");
  }
  if (!Array.isArray(record.changed_this_round)) {
    errors.push("changed_this_round must be an array");
  }
  if (!isNonEmptyString(record.next_plan)) {
    errors.push("next_plan must be non-empty");
  }

  if (record.last_successful_command !== null) {
    if (!isObject(record.last_successful_command)) {
      errors.push("last_successful_command must be an object or null");
    } else {
      const cmd = record.last_successful_command;
      if (!isNonEmptyString(cmd.command)) {
        errors.push("last_successful_command.command is required");
      }
      if (!isNonEmptyString(cmd.expected_success_signal)) {
        errors.push(
          "last_successful_command.expected_success_signal is required",
        );
      }
      if (
        "trust_level" in cmd &&
        ![
          "unverified",
          "ai_inferred",
          "single_run",
          "reproduced",
          "human_confirmed",
        ].includes(String(cmd.trust_level))
      ) {
        errors.push("last_successful_command.trust_level is invalid");
      }
    }
  }

  if (
    record.current_blocker !== null &&
    typeof record.current_blocker !== "string"
  ) {
    errors.push("current_blocker must be a string or null");
  }

  return { valid: errors.length === 0, errors };
}

export function getDangerPolicyForAction(
  action: HCCDangerAction,
): HCCDangerPolicyEntry {
  const entry = HCC_DANGER_POLICY_MATRIX.find((item) => item.action === action);
  if (!entry) {
    throw new Error(`unknown HCC danger action: ${action}`);
  }
  return entry;
}

export function dangerActionsForHCCStepActionType(
  actionType: HCCStepActionType,
): readonly HCCDangerAction[] {
  return HCC_STEP_ACTION_TYPE_TO_DANGER_ACTIONS[actionType];
}

export function assertNoDangerPolicyAutoApproval(): HCCValidationResult {
  const errors = HCC_DANGER_POLICY_MATRIX.flatMap((entry) => {
    const out: string[] = [];
    if (entry.decision !== "requires_user_approval") {
      out.push(`${entry.action} must require user approval`);
    }
    if (entry.user_approval_required !== true) {
      out.push(`${entry.action} must set user_approval_required=true`);
    }
    if (entry.auto_approval_allowed_for.length !== 0) {
      out.push(`${entry.action} must not allow AI auto approval`);
    }
    return out;
  });
  return { valid: errors.length === 0, errors };
}

export function assertHCCHandoffPolicyNoRuntimeAuthorization(): HCCNoRuntimeAuthorizationReport {
  return {
    schema_version: HCC_TASK_HANDOFF_POLICY_SCHEMA_VERSION,
    no_runtime: true,
    no_daemon: true,
    no_cron: true,
    no_weixin: true,
    no_channel_runtime: true,
    no_live_apply: true,
    no_hcc_auto_executor: true,
    no_progress_file_write: true,
  };
}
