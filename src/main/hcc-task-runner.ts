// P3 Slice A: HCC Task Runner — dry-run plan builder
// No execution, no spawn, no IPC, no runPlaybook.
// Only builds plans by mapping HCC types to P2.5 helper inputs.

import * as fs from "fs";
import * as path from "path";

import type { FailureKind } from "./safety/retry-runtime";
import {
  makePreflightDecision,
  isCapabilityAllowed,
} from "@shared/lib/safety/types";
import { createResourceLeaseManager } from "./safety/resource-lease";
import { buildVerifierInput, validateVerifierInput } from "@shared/lib/safety/builder-verifier";
import {
  DEFAULT_CODE_DOMAIN_PROFILE,
  validateDomainProfile,
} from "@shared/lib/safety/domain-profile";

import type {
  HCCTaskRequest,
  HCCTaskPlan,
  HCCTaskSafetyPlan,
  HCCTaskResult,
  HCCPreflightInput,
  HCCLeaseInput,
  HCCRollbackInput,
  HCCPlannedStep,
  HCCPreflightResult,
  HCCLeaseResult,
  HCCCodeGraphContext,
  CodeGraphImpact,
  CodeGraphStatus,
  DomainProfile,
  VerifierInput,
} from "./hcc-task-types";

// -----------------------------------------------------------------
// buildHCCTaskPlan — maps request → plan with P2.5 input shapes
// -----------------------------------------------------------------

export function buildHCCTaskPlan(request: HCCTaskRequest): HCCTaskPlan {
  const validationErrors: string[] = [];

  // Rule: worktreePath must be absolute
  if (!path.isAbsolute(request.worktreePath)) {
    validationErrors.push(
      `worktreePath must be absolute: got "${request.worktreePath}"`,
    );
  }

  // Rule: worktreePath must exist
  if (!fs.existsSync(request.worktreePath)) {
    validationErrors.push(
      `worktreePath does not exist: "${request.worktreePath}"`,
    );
  }

  // Rule: no steps are executed in Slice A — echo dry-run placeholder
  const stepPlans: HCCPlannedStep[] = (request.steps ?? []).map((step) => ({
    stepId: step.stepId,
    action: step.action,
    actionType: step.actionType,
    command: `[DRY-RUN] ${step.command ?? step.action}`, // NOT executed
    capability: step.capability,
    riskLevel: step.riskLevel,
    // Slice A placeholder: actionGateResult set with allow/deny based on risk
    actionGateResult: {
      stepId: step.stepId,
      action: step.action,
      actionType: step.actionType,
      decision: (step.riskLevel === "high" && step.actionType === "delete") ? "deny" as const : "allow" as const,
      reasons: ["[SLICE-A] action gate placeholder — no real execution"],
      isIrreversible: step.actionType === "delete" || step.actionType === "publish",
    },
  }));

  // Build P2.5 helper input shapes
  const preflightInput = buildPreflightInput(request);
  const leaseInput = buildLeaseInput(request);
  const rollbackInput = buildRollbackInput(request);

  // Build read-only CodeGraph context from request.
  // HCC never executes CodeGraph — it only consumes an externally produced impact.
  const codeGraph = buildCodeGraphContext(request, validationErrors);

  // Resolve and validate Domain Profile.
  // Code tasks without an override get DEFAULT_CODE_DOMAIN_PROFILE.
  // Non-code tasks without a profile get null (not blocking).
  const domainProfile = buildDomainProfile(request, validationErrors);

  // Build VerifierInput section (dry-run only — verifier is never invoked).
  // Empty verificationCommands / acceptanceCriteria / changedFiles block the plan.
  const verifierSection = buildHCCVerifierInput(request, domainProfile, codeGraph);
  if (!verifierSection.verifierInputValid) {
    for (const err of verifierSection.verifierInputValidationErrors) {
      validationErrors.push(`verifierInput: ${err}`);
    }
  }

  const safetyPlan = buildHCCTaskSafetyPlan(
    { request, preflightInput, leaseInput, rollbackInput, stepPlans },
    validationErrors,
  );

  return {
    taskId: request.taskId,
    goal: request.goal,
    worktreePath: request.worktreePath,
    sourceTrust: request.sourceTrust,
    requestedCapability: request.requestedCapability,
    riskLevel: request.riskLevel,
    priority: request.priority,
    state: validationErrors.length > 0 ? "blocked" : "planned",
    validationErrors,
    preflightInput,
    leaseInput,
    rollbackInput,
    stepPlans,
    safetyPlan,
    codeGraph,
    domainProfile,
    verifierInput: verifierSection.verifierInput,
    verifierInputValid: verifierSection.verifierInputValid,
    verifierInputValidationErrors: verifierSection.verifierInputValidationErrors,
    verifierBoundary: null, // resolved at call site via shouldRequireIndependentVerifier
    // Slice A: no execution, so never executable
    executable: false,
  };
}

// -----------------------------------------------------------------
// buildHCCTaskSafetyPlan — derives safety decisions from plan inputs
// Uses real P2.5 helpers with temp audit dir (no real audit writes).
// -----------------------------------------------------------------

export function buildHCCTaskSafetyPlan(
  ctx: {
    request: HCCTaskRequest;
    preflightInput: HCCPreflightInput;
    leaseInput: HCCLeaseInput;
    rollbackInput: HCCRollbackInput;
    stepPlans: HCCPlannedStep[];
  },
  validationErrors: string[],
): HCCTaskSafetyPlan {
  const { request, preflightInput, leaseInput, stepPlans } = ctx;

  // --- Preflight decision (read-only, uses temp audit dir) ---
  const tempAuditDir = fs.mkdtempSync(
    path.join(require("os").tmpdir(), "hcc-test-audit-"),
  );

  const preflightResult = runPreflightCheck(preflightInput, tempAuditDir);

  // --- Lease decision (read-only) ---
  const leaseResult = runLeaseCheck(leaseInput, tempAuditDir);

  // --- Rollback point creation (read-only dry-run, no actual writes) ---
  // In Slice A we only verify the rollback input shape is valid.
  // createRollbackPoint is NOT called (would write to ~/.hermes/rollback).
  // Slice B wires the real call with user confirmation.
  const rollbackPointId: string | null =
    validationErrors.length === 0 ? "[DRY-RUN-PENDING]" : null;

  // --- Retry plan (static, no runtime state in Slice A) ---
  const retryPlan: { maxRetries: number; deadEndActions: string[]; retryFailureKinds: FailureKind[] } = {
    maxRetries: 2,
    deadEndActions: Array.from(["delete", "publish"]),
    retryFailureKinds: [
      "agent_error",
      "task_failure",
      "execution_error",
      "verification_error",
      "resource_exhaustion",
      "external_dependency_error",
    ] as FailureKind[],
  };

  // --- Build verifier input is done in buildHCCVerifierInput (see below) ---
  // The dry-run plan section does not construct verifier input inline;
  // buildHCCVerifierInput is called from buildHCCTaskPlan with the full context.

  // --- Requires user approval check ---
  const requiresUserApproval =
    preflightResult.decision === "require_user_approval" ||
    request.riskLevel === "high";

  const verifierRequired = preflightResult.verifierRequired;

  // --- Step action gate results (not called in Slice A — placeholder) ---
  const stepActionGateResults = stepPlans.map((step) => ({
    stepId: step.stepId,
    action: step.action,
    actionType: step.actionType,
    decision: "allow" as const,
    reasons: ["[SLICE-A] action gate not called — no execution"],
    isIrreversible: step.actionType === "delete" || step.actionType === "publish",
  }));

  // --- Cleanup temp audit dir ---
  try {
    fs.rmSync(tempAuditDir, { recursive: true, force: true });
  } catch {
    // non-fatal
  }

  return {
    requiresUserApproval,
    rollbackPointId,
    verifierRequired,
    preflightDecision: preflightResult.decision,
    leaseDecision: leaseResult.decision,
    stepActionGateResults,
    retryPlan,
    changedFiles: [],
    artifactRefs: [],
  };
}

// -----------------------------------------------------------------
// P2.5 helper input builders
// -----------------------------------------------------------------

function buildPreflightInput(request: HCCTaskRequest): HCCPreflightInput {
  return {
    taskId: request.taskId,
    action: request.goal,
    sourceTrust: request.sourceTrust,
    requestedCapability: request.requestedCapability,
    riskLevel: request.riskLevel,
    actor: request.actor,
    context: `HCC plan for task ${request.taskId}: ${request.goal}`,
    evidenceRef: request.evidenceRef,
  };
}

function buildLeaseInput(request: HCCTaskRequest): HCCLeaseInput {
  return {
    taskId: request.taskId,
    resourceType: "worktree",
    resourceId: request.worktreePath,
    priority: request.priority,
    ttlMs: 5 * 60 * 1000, // 5 minutes default
    actor: request.actor,
    evidenceRef: request.evidenceRef,
  };
}

function buildRollbackInput(request: HCCTaskRequest): HCCRollbackInput {
  return {
    taskId: request.taskId,
    worktreePath: request.worktreePath,
    actor: request.actor,
    evidenceRef: request.evidenceRef,
    reason: `HCC task plan: ${request.goal}`,
    createdFiles: [], // populated in Slice B after execution
  };
}

// -----------------------------------------------------------------
// buildCodeGraphContext — derive read-only CodeGraph context from request
// HCC never invokes CodeGraph. It only normalizes whatever the caller
// passed in. If the request did not provide codeGraphImpact, the status
// is "missing" for code tasks and "not_required" otherwise.
// On failed status, the reason is recorded as a risk note but the plan
// remains dry-run (executable=false) — Slice A never executes anything.
// -----------------------------------------------------------------

function buildCodeGraphContext(
  request: HCCTaskRequest,
  validationErrors: string[],
): HCCCodeGraphContext {
  const impact: CodeGraphImpact | undefined = request.codeGraphImpact;
  const isCodeTask = request.isCodeTask === true;

  // No impact provided: derive a synthetic status.
  if (!impact) {
    return {
      status: isCodeTask ? "missing" : "not_required",
      nodes: 0,
      edges: 0,
      changedFiles: [],
      impactedFiles: [],
      impactedSymbols: [],
      riskNotes: isCodeTask
        ? ["CodeGraph impact not provided for code task"]
        : [],
      artifactRef: null,
      wasProvided: false,
    };
  }

  // Impact provided: normalize fields and surface failures as risk notes.
  const status: CodeGraphStatus = impact.status;
  const riskNotes: string[] = [...(impact.riskNotes ?? [])];

  if (status === "failed") {
    riskNotes.push(
      `CodeGraph reported failure: ${impact.riskNotes?.join("; ") ?? "no reason given"}`,
    );
    validationErrors.push("CodeGraph impact status is failed");
  }

  return {
    status,
    nodes: impact.nodes ?? 0,
    edges: impact.edges ?? 0,
    changedFiles: impact.changedFiles ?? [],
    impactedFiles: impact.impactedFiles ?? [],
    impactedSymbols: impact.impactedSymbols ?? [],
    riskNotes,
    artifactRef: impact.artifactRef ?? null,
    wasProvided: true,
  };
}

// -----------------------------------------------------------------
// buildDomainProfile — resolve and validate Domain Profile for the plan
// Code tasks without an override get DEFAULT_CODE_DOMAIN_PROFILE.
// A provided profile is validated; invalid profile blocks the plan.
// Non-code tasks without a profile get null (not blocking).
// -----------------------------------------------------------------

function buildDomainProfile(
  request: HCCTaskRequest,
  validationErrors: string[],
): DomainProfile | null {
  const isCodeTask = request.isCodeTask === true;

  if (request.domainProfile) {
    const result = validateDomainProfile(request.domainProfile);
    if (!result.valid) {
      for (const err of result.errors) {
        validationErrors.push(
          `domainProfile.${err.field}: ${err.reason}`,
        );
      }
      // Return the profile as-is so consumers can still inspect it,
      // but validationErrors causes plan.state = "blocked".
      return request.domainProfile;
    }
    return request.domainProfile;
  }

  if (isCodeTask) {
    return DEFAULT_CODE_DOMAIN_PROFILE;
  }

  return null;
}

// -----------------------------------------------------------------
// P2.5 helper dry-run runners (temp audit dir, no real writes)
// -----------------------------------------------------------------

function runPreflightCheck(
  input: HCCPreflightInput,
  _auditDir: string,
): HCCPreflightResult {
  // Uses makePreflightDecision (pure, no side effects)
  // and also checks capability trust ceiling using the imported helper.
  if (!isCapabilityAllowed(input.sourceTrust, input.requestedCapability)) {
    return {
      decision: "deny",
      reasons: [
        `capability ${input.requestedCapability} not allowed for ${input.sourceTrust}`,
      ],
      rollbackPoint: null,
      verifierRequired: false,
    };
  }

  const result = makePreflightDecision(
    input.taskId,
    input.action,
    input.sourceTrust,
    input.requestedCapability,
    { riskLevel: input.riskLevel },
  );

  return {
    decision: result.decision,
    reasons: result.reasons,
    rollbackPoint: result.rollbackPoint,
    verifierRequired: result.verifierRequired,
  };
}

function runLeaseCheck(
  input: HCCLeaseInput,
  auditDir: string,
): HCCLeaseResult {
  // Uses in-memory resource lease manager with temp audit dir.
  // No real lease persistence in Slice A.
  const manager = createResourceLeaseManager();

  const acquireResult = manager.acquireLease({
    taskId: input.taskId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    priority: input.priority,
    ttlMs: input.ttlMs,
    actor: input.actor,
    evidenceRef: input.evidenceRef,
    auditDir,
  });

  return {
    decision: acquireResult.decision,
    reasons: acquireResult.reasons,
    leaseId: acquireResult.lease?.taskId ?? null,
    acquiredAt: acquireResult.lease?.acquiredAt ?? null,
    resourceId: acquireResult.lease?.resourceId ?? null,
  };
}

// -----------------------------------------------------------------
// Build HCCTaskResult from a plan
// -----------------------------------------------------------------

export function buildHCCTaskResult(plan: HCCTaskPlan): HCCTaskResult {
  const hasBlockingErrors = plan.validationErrors.length > 0;
  const needsApproval = plan.safetyPlan.requiresUserApproval;
  const leaseDenied = plan.safetyPlan.leaseDecision === "deny";

  let summary: string;
  if (hasBlockingErrors) {
    summary = `HCC plan blocked: ${plan.validationErrors.join("; ")}`;
  } else if (leaseDenied) {
    summary = `HCC plan denied: resource lease for "${plan.worktreePath}" is held by a higher-priority task`;
  } else if (needsApproval) {
    summary = `HCC plan requires user approval before execution: preflight=${plan.safetyPlan.preflightDecision}`;
  } else {
    summary = `HCC plan ready (dry-run): preflight=${plan.safetyPlan.preflightDecision}, lease=${plan.safetyPlan.leaseDecision}, rollback=${plan.safetyPlan.rollbackPointId ?? "N/A"}. No execution in Slice A.`;
  }

  return {
    taskId: plan.taskId,
    plan,
    summary,
    outcome: hasBlockingErrors || needsApproval || leaseDenied ? "planned" : "planned",
  };
}

// -----------------------------------------------------------------
// Convenience: full request → result pipeline
// -----------------------------------------------------------------

export function buildHCCTaskFromRequest(request: HCCTaskRequest): HCCTaskResult {
  const plan = buildHCCTaskPlan(request);
  return buildHCCTaskResult(plan);
}

// -----------------------------------------------------------------
// HCC plan → VerifierInput construction (dry-run only)
// Returns the full verifier section to attach to HCCTaskPlan.
// The verifier itself is NEVER invoked here — only the input is
// constructed and locally validated. Builder/Verifier separation
// is enforced at the boundary via shouldRequireIndependentVerifier
// at the call site, not here.
// -----------------------------------------------------------------

export interface HCCVerifierSection {
  verifierInput: VerifierInput | null;
  verifierInputValid: boolean;
  verifierInputValidationErrors: string[];
}

export function buildHCCVerifierInput(
  request: HCCTaskRequest,
  domainProfile: DomainProfile | null,
  codeGraph: HCCCodeGraphContext,
): HCCVerifierSection {
  // No domain profile → task is not subject to the Quality Loop verifier
  // contract. The plan carries no verifier input and validation is vacuous.
  if (!domainProfile) {
    return {
      verifierInput: null,
      verifierInputValid: true,
      verifierInputValidationErrors: [],
    };
  }

  // 1. Map verificationCommands:
  //    - request.verificationCommands if present
  //    - else map domainProfile.verifier.hardChecks to "[VERIFY] <name>" plan-data strings
  //    - else []
  let verificationCommands: string[] = request.verificationCommands ?? [];
  if (verificationCommands.length === 0) {
    verificationCommands = domainProfile.verifier.hardChecks.map(
      (check) => `[VERIFY] ${check}`,
    );
  }

  // 2. Map acceptanceCriteria:
  //    - request.acceptanceCriteria if present
  //    - else [domainProfile.verifier.passCriteria] if present
  //    - else []
  let acceptanceCriteria: string[] = request.acceptanceCriteria ?? [];
  if (acceptanceCriteria.length === 0) {
    acceptanceCriteria = [domainProfile.verifier.passCriteria];
  }

  // 3. Map changedFiles:
  //    - request.changedFiles if present
  //    - else codeGraph.changedFiles
  //    - else []
  const changedFiles: string[] = codeGraph.changedFiles;

  // 4. artifactRefs: dry-run plan ref + CodeGraph artifactRef if present
  const artifactRefs: string[] = [
    `hcc-dry-run://${request.taskId}/plan`,
  ];
  if (codeGraph.artifactRef) {
    artifactRefs.push(codeGraph.artifactRef);
  }

  // 5. Dry-run refs
  const handoffPackRef = `hcc-dry-run://${request.taskId}/handoff`;
  const diffRef = `hcc-dry-run://${request.taskId}/diff`;

  // 6. Build the raw task result. The FORBIDDEN_FIELDS guard runs inside
  //    buildVerifierInput. We never include reasoning / chat_transcript / etc.
  let verifierInput: VerifierInput | null = null;
  try {
    verifierInput = buildVerifierInput({
      taskId: request.taskId,
      handoffPackRef,
      diffRef,
      verificationCommands,
      acceptanceCriteria,
      changedFiles,
      artifactRefs,
      builderMetadata: {
        builderId: "hcc-task-runner",
        startedAt: new Date().toISOString(),
        outputArtifactRef: `hcc-dry-run://${request.taskId}/plan`,
      },
    });
  } catch {
    // buildVerifierInput throws on forbidden fields; we never inject them,
    // so this branch is defensive.
    return {
      verifierInput: null,
      verifierInputValid: false,
      verifierInputValidationErrors: ["forbidden field detected in dry-run input"],
    };
  }

  const validation = validateVerifierInput(verifierInput);
  return {
    verifierInput,
    verifierInputValid: validation.valid,
    verifierInputValidationErrors: validation.errors,
  };
}