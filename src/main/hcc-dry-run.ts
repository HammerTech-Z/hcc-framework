// P3 Slice B: HCC Dry-Run Pipeline Runner
// Wires together all P2.5 helpers into a single sequential pipeline.
// No execution, no spawn, no IPC, no runPlaybook, no verificationCommands.
// Only: plan → preflight → lease → rollback point → action gate → verifier input → release lease.

import * as fs from "fs";

import type { FailureKind } from "./safety/retry-runtime";
import { createRetryRuntime } from "./safety/retry-runtime";
import {
  makePreflightDecision,
  isCapabilityAllowed,
  actionGateCheck,
} from "@shared/lib/safety/types";
import { createResourceLeaseManager } from "./safety/resource-lease";
import { createRollbackManager } from "./safety/rollback-strategy";
import { createAuditLogStore } from "./safety/audit-log";
import { buildVerifierInput, validateVerifierInput } from "@shared/lib/safety/builder-verifier";
import { buildHCCTaskPlan } from "./hcc-task-runner";

import type {
  HCCTaskRequest,
  HCCTaskPlan,
  HCCTaskResult,
  HCCPreflightResult,
  HCCLeaseResult,
  HCCActionGateResult,
} from "./hcc-task-types";

// -----------------------------------------------------------------
// Options
// -----------------------------------------------------------------

export interface DryRunOptions {
  auditDir: string;
  rollbackDir: string;
  now?: () => number;
}

// -----------------------------------------------------------------
// Extended HCCTaskResult for dry-run (Slice B)
// -----------------------------------------------------------------

export interface HCCTaskDryRunResult extends Omit<HCCTaskResult, "outcome"> {
  dryRun: true;
  outcome: "planned" | "failed" | "blocked";
  preflightDecision: "allow" | "deny" | "require_user_approval";
  leaseDecision: "allow" | "deny";
  rollbackPointRef: string | null;
  actionGateResults: HCCActionGateResult[];
  verifierInputValid: boolean;
  auditRefs: string[];
  stoppedAt?: string;
  reasons: string[];
}

// -----------------------------------------------------------------
// Internal pipeline state
// -----------------------------------------------------------------

interface PipelineState {
  taskId: string;
  request: HCCTaskRequest;
  plan: HCCTaskPlan;
  preflightResult?: HCCPreflightResult;
  leaseResult?: HCCLeaseResult;
  rollbackPointRef: string | null;
  actionGateResults: HCCActionGateResult[];
  verifierInputValid: boolean;
  auditRefs: string[];
  stoppedAt?: string;
  reasons: string[];
  outcome: "planned" | "failed" | "blocked";
}

// -----------------------------------------------------------------
// Core: runHCCTaskDryRun
// -----------------------------------------------------------------

export function runHCCTaskDryRun(
  request: HCCTaskRequest,
  options: DryRunOptions,
): HCCTaskDryRunResult {
  const { auditDir, rollbackDir } = options;

  try {
    fs.mkdirSync(auditDir, { recursive: true });
    fs.mkdirSync(rollbackDir, { recursive: true });
  } catch {
    // non-fatal
  }

  const auditStore = createAuditLogStore({ auditDir });
  const rollbackManager = createRollbackManager({ rollbackDir, auditDir });
  const retryRuntime = createRetryRuntime({ auditDir });

  const state: PipelineState = {
    taskId: request.taskId,
    request,
    plan: buildHCCTaskPlan(request),
    preflightResult: undefined,
    leaseResult: undefined,
    rollbackPointRef: null,
    actionGateResults: [],
    verifierInputValid: false,
    auditRefs: [],
    stoppedAt: undefined,
    reasons: [],
    outcome: "planned",
  };

  function appendAudit(
    event: "preflight" | "action_gate" | "resource_lease" | "rollback" | "retry_check",
    decision: "allow" | "deny" | "need_approval" | "info",
    extra: Record<string, unknown> = {},
  ): void {
    try {
      const entry = auditStore.append({
        task_id: request.taskId,
        actor: request.actor,
        event,
        decision,
        context: {
          trust_level: request.sourceTrust,
          requested_capability: request.requestedCapability,
          allowed_capability_set: [],
          matched_rule: "hcc-dry-run",
          allowlist_hit: null,
          path_check: "not_applicable",
          risk_level: request.riskLevel,
          ...extra,
        },
        evidence_ref: request.evidenceRef,
      });
      state.auditRefs.push(entry.entry_hash);
    } catch {
      // non-fatal
    }
  }

  function recordFailure(signature: string, kind: FailureKind): void {
    try {
      retryRuntime.recordFailure({
        taskId: request.taskId,
        failureSignature: signature,
        failureKind: kind,
        actor: request.actor,
        evidenceRef: request.evidenceRef,
      });
    } catch {
      // non-fatal
    }
  }

  function checkShouldRetry(signature: string): boolean {
    try {
      return retryRuntime.shouldRetry({
        taskId: request.taskId,
        failureSignature: signature,
        actor: request.actor,
        evidenceRef: request.evidenceRef,
      }).decision === "allow";
    } catch {
      return false;
    }
  }

  // leaseMgr is at function scope so releaseLeaseQuietly can use the SAME instance
  const leaseMgr = createResourceLeaseManager();

  function releaseLeaseQuietly(): void {
    try {
      leaseMgr.releaseLease({
        taskId: request.taskId,
        resourceId: request.worktreePath,
        actor: request.actor,
        evidenceRef: request.evidenceRef,
        auditDir,
      });
    } catch {
      // non-fatal
    }
  }

  // PHASE 1: validate worktreePath
  if (state.plan.validationErrors.length > 0) {
    state.outcome = "blocked";
    state.stoppedAt = "validation";
    state.reasons = [...state.plan.validationErrors];
    appendAudit("preflight", "deny", { reason: "validation errors" });
    return buildDryRunResult(state);
  }

  // PHASE 2: preflight check
  {
    const preflightInput = state.plan.preflightInput;

    if (!isCapabilityAllowed(preflightInput.sourceTrust, preflightInput.requestedCapability)) {
      const reason = "capability not allowed";
      state.preflightResult = { decision: "deny", reasons: [reason], rollbackPoint: null, verifierRequired: false };
      state.outcome = "blocked";
      state.stoppedAt = "preflight";
      state.reasons = [reason];
      appendAudit("preflight", "deny", { reason });
      return buildDryRunResult(state);
    }

    const pfResult = makePreflightDecision(
      preflightInput.taskId,
      preflightInput.action,
      preflightInput.sourceTrust,
      preflightInput.requestedCapability,
      { riskLevel: preflightInput.riskLevel },
    );

    state.preflightResult = {
      decision: pfResult.decision,
      reasons: pfResult.reasons,
      rollbackPoint: pfResult.rollbackPoint,
      verifierRequired: pfResult.verifierRequired,
    };

    appendAudit("preflight", pfResult.decision === "allow" ? "allow" : "deny", {
      preflight_decision: pfResult.decision,
      preflight_reasons: pfResult.reasons,
    });

    if (pfResult.decision === "deny") {
      state.outcome = "blocked";
      state.stoppedAt = "preflight";
      state.reasons = [...pfResult.reasons];
      return buildDryRunResult(state);
    }

    if (pfResult.decision === "require_user_approval") {
      state.outcome = "blocked";
      state.stoppedAt = "preflight";
      state.reasons = [...pfResult.reasons];
      return buildDryRunResult(state);
    }
  }

  // PHASE 3: acquire lease
  {
    const leaseResult = leaseMgr.acquireLease({
      taskId: request.taskId,
      resourceType: "worktree",
      resourceId: request.worktreePath,
      priority: request.priority,
      ttlMs: 5 * 60 * 1000,
      actor: request.actor,
      evidenceRef: request.evidenceRef,
      auditDir,
    });

    state.leaseResult = {
      decision: leaseResult.decision,
      reasons: leaseResult.reasons,
      leaseId: leaseResult.lease?.taskId ?? null,
      acquiredAt: leaseResult.lease?.acquiredAt ?? null,
      resourceId: leaseResult.lease?.resourceId ?? null,
    };

    appendAudit("resource_lease", leaseResult.decision, {
      lease_decision: leaseResult.decision,
      lease_reasons: leaseResult.reasons,
      lease_id: leaseResult.lease?.taskId ?? null,
    });

    if (leaseResult.decision === "deny") {
      state.outcome = "blocked";
      state.stoppedAt = "lease";
      state.reasons = [...leaseResult.reasons];
      return buildDryRunResult(state);
    }
  }

  // PHASE 4: create rollback point
  {
    const rollbackResult = rollbackManager.createRollbackPoint({
      taskId: request.taskId,
      worktreePath: request.worktreePath,
      actor: request.actor,
      evidenceRef: request.evidenceRef,
      reason: `HCC dry-run: ${request.goal}`,
      createdFiles: [],
    });

    state.rollbackPointRef = rollbackResult.rollbackPoint?.rollbackId ?? null;

    appendAudit("rollback", rollbackResult.decision === "allow" ? "allow" : "deny", {
      rollback_decision: rollbackResult.decision,
      rollback_id: state.rollbackPointRef,
    });

    if (rollbackResult.decision === "deny") {
      const sig = `rollback::${request.taskId}`;
      recordFailure(sig, "execution_error");

      if (!checkShouldRetry(sig)) {
        state.outcome = "failed";
        state.stoppedAt = "rollback";
        state.reasons = [...rollbackResult.reasons, "max retries exhausted"];
      } else {
        state.outcome = "blocked";
        state.stoppedAt = "rollback";
        state.reasons = [...rollbackResult.reasons];
      }

      releaseLeaseQuietly();
      return buildDryRunResult(state);
    }
  }

  // PHASE 5: action gate check for each step
  {
    const allResults: HCCActionGateResult[] = [];

    for (const step of state.plan.stepPlans) {
      const stepDecision = actionGateCheck({
        taskId: request.taskId,
        sourceTrust: request.sourceTrust,
        isIrreversible: step.actionType === "delete" || step.actionType === "publish",
        userHasConfirmed: false,
      });

      const result: HCCActionGateResult = {
        stepId: step.stepId,
        action: step.action,
        actionType: step.actionType,
        decision: stepDecision,
        reasons: stepDecision === "allow"
          ? ["action gate allows this step in dry-run"]
          : stepDecision === "require_user_approval"
            ? ["irreversible action requires user confirmation"]
            : ["action gate denies this step"],
        isIrreversible: step.actionType === "delete" || step.actionType === "publish",
      };

      allResults.push(result);

      appendAudit("action_gate", stepDecision === "allow" ? "allow" : stepDecision === "deny" ? "deny" : "need_approval", {
        step_id: step.stepId,
        step_action: step.action,
        action_type: step.actionType,
        decision: stepDecision,
      });

      if (stepDecision === "deny") {
        state.outcome = "blocked";
        state.stoppedAt = `action_gate:${step.stepId}`;
        state.reasons = [`step ${step.stepId} denied by action gate`];
        releaseLeaseQuietly();
        return buildDryRunResult(state);
      }

      if (stepDecision === "require_user_approval") {
        state.outcome = "blocked";
        state.stoppedAt = `action_gate:${step.stepId}`;
        state.reasons = [`step ${step.stepId} requires user approval`];
        releaseLeaseQuietly();
        return buildDryRunResult(state);
      }
    }

    state.actionGateResults = allResults;
  }

  // PHASE 6: build and validate verifier input
  {
    const verifierInput = buildVerifierInput({
      taskId: request.taskId,
      handoffPackRef: request.evidenceRef,
      diffRef: `rollback:${state.rollbackPointRef ?? "no-rollback"}`,
      verificationCommands: request.verificationCommands ?? [],
      acceptanceCriteria: request.acceptanceCriteria ?? [],
      changedFiles: [],
      artifactRefs: [],
      builderMetadata: { builderId: "hcc-dry-run", startedAt: new Date().toISOString() },
    });

    // In dry-run: only validate if verification commands were provided.
    // Empty verificationCommands means nothing to verify → verifier input is vacuously valid.
    const hasVerificationCommands =
      Array.isArray(request.verificationCommands) && request.verificationCommands.length > 0;

    if (hasVerificationCommands) {
      const validation = validateVerifierInput(verifierInput);
      state.verifierInputValid = validation.valid;

      appendAudit("preflight", validation.valid ? "info" : "deny", {
        verifier_input_valid: validation.valid,
        verifier_errors: validation.errors,
      });

      if (!validation.valid) {
        state.outcome = "failed";
        state.stoppedAt = "verifier_input";
        state.reasons = [...validation.errors];
        releaseLeaseQuietly();
        return buildDryRunResult(state);
      }
    } else {
      // No verification commands → vacuously valid, nothing to verify
      state.verifierInputValid = true;
      appendAudit("preflight", "info", {
        verifier_input_valid: true,
        note: "no verification commands in dry-run",
      });
    }
  }

  // PHASE 7: release lease
  releaseLeaseQuietly();

  // All phases passed
  state.outcome = "planned";
  state.stoppedAt = undefined;
  state.reasons = [];

  return buildDryRunResult(state);
}

// -----------------------------------------------------------------
// Build dry-run result from pipeline state
// -----------------------------------------------------------------

function buildDryRunResult(state: PipelineState): HCCTaskDryRunResult {
  const preflightDecision = state.preflightResult?.decision ?? "deny";
  const leaseDecision = state.leaseResult?.decision ?? "deny";

  let summary: string;
  if (state.outcome === "failed") {
    summary = `HCC dry-run failed at ${state.stoppedAt}: ${state.reasons.join("; ")}`;
  } else if (state.outcome === "blocked") {
    summary = `HCC dry-run blocked at ${state.stoppedAt}: ${state.reasons.join("; ")}`;
  } else {
    summary = `HCC dry-run completed: preflight=${preflightDecision}, lease=${leaseDecision}, rollback=${state.rollbackPointRef ?? "none"}, verifier=${state.verifierInputValid}`;
  }

  return {
    taskId: state.taskId,
    plan: state.plan,
    summary,
    outcome: state.outcome,
    dryRun: true,
    preflightDecision,
    leaseDecision,
    rollbackPointRef: state.rollbackPointRef,
    actionGateResults: state.actionGateResults,
    verifierInputValid: state.verifierInputValid,
    auditRefs: state.auditRefs,
    stoppedAt: state.stoppedAt,
    reasons: state.reasons,
  };
}
