// P3 Slice A: HCC Task Types
// Pure types that map HCC task fields to P2.5 helper inputs.
// No execution, no IPC, no spawn.

import type {
  TrustLevel,
  Capability,
  AuditActor,
} from "@shared/lib/safety/types";
import type { ResourceType, Priority } from "./safety/resource-lease";
import type { FailureKind } from "./safety/retry-runtime";
import type { DomainProfile } from "@shared/lib/safety/domain-profile";
import type {
  VerifierInput,
  BuilderVerifierBoundary,
} from "@shared/lib/safety/builder-verifier";

// -----------------------------------------------------------------
// CodeGraph Impact — read-only result passed in from external CodeGraph call
// HCC does NOT execute CodeGraph; it only consumes the impact description.
// -----------------------------------------------------------------

export type CodeGraphStatus =
  | "not_required"
  | "available"
  | "missing"
  | "failed";

export interface CodeGraphImpact {
  status: CodeGraphStatus;
  nodes?: number;
  edges?: number;
  changedFiles?: string[];
  impactedFiles?: string[];
  impactedSymbols?: string[];
  riskNotes?: string[];
  artifactRef?: string | null;
}

export interface HCCCodeGraphContext {
  status: CodeGraphStatus;
  nodes: number;
  edges: number;
  changedFiles: string[];
  impactedFiles: string[];
  impactedSymbols: string[];
  riskNotes: string[];
  artifactRef: string | null;
  /** True if CodeGraph was supplied on the request. False for not_required/missing. */
  wasProvided: boolean;
}

// Re-export DomainProfile types from shared lib so downstream consumers
// (Quality Loop, Verifier) can import from a single place.
export type {
  DomainProfile,
  DomainProfileName,
  DomainVerifierSpec,
  DomainProfileValidationError,
  DomainProfileValidationResult,
} from "@shared/lib/safety/domain-profile";

// Re-export Builder/Verifier boundary types so plan consumers can
// import the full plan shape and boundary types from a single place.
export type {
  VerifierInput,
  BuilderVerifierBoundary,
  BuilderMetadata,
  TaskResult,
  ValidationResult,
  ForbiddenField,
} from "@shared/lib/safety/builder-verifier";
export { FORBIDDEN_FIELDS } from "@shared/lib/safety/builder-verifier";

// -----------------------------------------------------------------
// HCC Task Request — external input shape
// -----------------------------------------------------------------

export interface HCCTaskRequest {
  taskId: string;
  goal: string;
  /** Absolute path to the worktree this task targets. Required. */
  worktreePath: string;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  riskLevel: "low" | "medium" | "high";
  priority: Priority;
  actor: AuditActor;
  evidenceRef: string;
  /** Steps are NOT executed in Slice A — only used for planning. */
  steps?: HCCStep[];
  verificationCommands?: string[];
  acceptanceCriteria?: string[];
  /** Optional CodeGraph impact result. If absent, context is missing/not_required. */
  codeGraphImpact?: CodeGraphImpact;
  /** Whether this is a code task. Defaults to false. Code tasks may require CodeGraph. */
  isCodeTask?: boolean;
  /** Optional domain profile override. If absent, code tasks get DEFAULT_CODE_DOMAIN_PROFILE. */
  domainProfile?: DomainProfile;
}

export interface HCCStep {
  stepId: string;
  action: string;
  actionType: "read" | "write" | "delete" | "execute" | "publish" | "privileged";
  /** Shell command to execute — NOT called in Slice A. */
  command?: string;
  capability: Capability;
  riskLevel: "low" | "medium" | "high";
}

// -----------------------------------------------------------------
// HCC Task Context — internal working state
// -----------------------------------------------------------------

export interface HCCTaskContext {
  request: HCCTaskRequest;
  /** Validated worktree path — must be absolute and exist. */
  validatedWorktreePath: string;
  state: HCCState;
  preflightResult?: HCCPreflightResult;
  leaseResult?: HCCLeaseResult;
  rollbackPointId?: string;
  steps: HCCPlannedStep[];
  safetyPlan: HCCTaskSafetyPlan;
  codeGraph: HCCCodeGraphContext;
  /** Resolved domain profile, validated. null for non-code tasks without a profile. */
  domainProfile: DomainProfile | null;
}

export type HCCState =
  | "received"
  | "validated"
  | "planned"
  | "preflight_pass"
  | "preflight_fail"
  | "lease_acquired"
  | "lease_denied"
  | "rollback_created"
  | "executable"
  | "blocked"
  | "rolled_back";

// -----------------------------------------------------------------
// HCC Planned Step — request steps enriched with safety bindings
// -----------------------------------------------------------------

export interface HCCPlannedStep {
  stepId: string;
  action: string;
  actionType: HCCStep["actionType"];
  command: string; // echo-dry-run placeholder in Slice A
  capability: Capability;
  riskLevel: "low" | "medium" | "high";
  actionGateResult?: HCCActionGateResult;
}

// -----------------------------------------------------------------
// HCC Task Plan — output of buildHCCTaskPlan
// -----------------------------------------------------------------

export interface HCCTaskPlan {
  taskId: string;
  goal: string;
  worktreePath: string;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  riskLevel: "low" | "medium" | "high";
  priority: Priority;
  state: HCCState;
  validationErrors: string[];
  preflightInput: HCCPreflightInput;
  leaseInput: HCCLeaseInput;
  rollbackInput: HCCRollbackInput;
  stepPlans: HCCPlannedStep[];
  safetyPlan: HCCTaskSafetyPlan;
  /** Read-only CodeGraph context, derived from request.codeGraphImpact. */
  codeGraph: HCCCodeGraphContext;
  /** Resolved domain profile, validated. null for non-code tasks without a profile. */
  domainProfile: DomainProfile | null;
  /**
   * Builder/Verifier boundary section. Verifier input is constructed but the
   * verifier itself is never invoked in Slice A. `verifierInputValid=false`
   * means the plan cannot be sent to a verifier yet.
   */
  verifierInput: VerifierInput | null;
  verifierInputValid: boolean;
  verifierInputValidationErrors: string[];
  verifierBoundary: BuilderVerifierBoundary | null;
  /** In Slice A, this is always false — no execution permitted. */
  executable: false;
}

export interface HCCPreflightInput {
  taskId: string;
  action: string;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  riskLevel: "low" | "medium" | "high";
  actor: AuditActor;
  context: string;
  evidenceRef: string;
}

export interface HCCLeaseInput {
  taskId: string;
  resourceType: ResourceType;
  resourceId: string;
  priority: Priority;
  ttlMs: number;
  actor: AuditActor;
  evidenceRef: string;
}

export interface HCCRollbackInput {
  taskId: string;
  worktreePath: string;
  actor: AuditActor;
  evidenceRef: string;
  reason: string;
  createdFiles: string[];
}

// -----------------------------------------------------------------
// HCC Safety Plan — output of buildHCCTaskSafetyPlan
// -----------------------------------------------------------------

export interface HCCTaskSafetyPlan {
  requiresUserApproval: boolean;
  rollbackPointId: string | null;
  verifierRequired: boolean;
  preflightDecision: "allow" | "deny" | "require_user_approval";
  leaseDecision: "allow" | "deny";
  /** In Slice A, no steps are executed so no action gate calls happen yet. */
  stepActionGateResults: HCCActionGateResult[];
  retryPlan: HCCRetryPlan;
  changedFiles: string[];
  artifactRefs: string[];
}

export interface HCCActionGateResult {
  stepId: string;
  action: string;
  actionType: HCCStep["actionType"];
  decision: "allow" | "deny" | "require_user_approval";
  reasons: string[];
  isIrreversible: boolean;
}

export interface HCCRetryPlan {
  maxRetries: number;
  deadEndActions: string[];
  retryFailureKinds: FailureKind[];
}

// -----------------------------------------------------------------
// HCC Task Result — plan outcome
// -----------------------------------------------------------------

export interface HCCTaskResult {
  taskId: string;
  plan: HCCTaskPlan;
  /** Human-readable summary of why the plan is or is not executable. */
  summary: string;
  /** Slice A always returns 'planned' since no execution occurs. */
  outcome: "planned" | "executed" | "failed" | "rolled_back";
}

// -----------------------------------------------------------------
// HCC Preflight / Lease / Rollback result wrappers
// -----------------------------------------------------------------

export interface HCCPreflightResult {
  decision: "allow" | "deny" | "require_user_approval";
  reasons: string[];
  rollbackPoint: string | null;
  verifierRequired: boolean;
}

export interface HCCLeaseResult {
  decision: "allow" | "deny";
  reasons: string[];
  leaseId: string | null;
  acquiredAt: string | null;
  resourceId: string | null;
}