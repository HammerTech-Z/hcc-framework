// P2.5 Action Gate — pure main helper
// No IPC, no HCC, no CLI, no executor.
// Calls actionGateCheck (shared) and appends an action_gate audit entry.

import type {
  AuditActor,
  AuditDecision,
  Capability,
  TrustLevel,
} from "@shared/lib/safety/types";
import { actionGateCheck, isCapabilityAllowed } from "@shared/lib/safety/types";
import { createAuditLogStore, DEFAULT_AUDIT_DIR } from "./audit-log";

// -----------------------------------------------------------------
// Action types (irreversible / destructive / external / privileged)
// -----------------------------------------------------------------

export type ActionType =
  | "read"
  | "write"
  | "delete"
  | "execute"
  | "publish"
  | "privileged";

const IRREVERSIBLE_TYPES: ActionType[] = ["delete", "publish"];

const DESTRUCTIVE_TYPES: ActionType[] = ["delete"];

const EXTERNAL_TYPES: ActionType[] = ["publish"];

const PRIVILEGED_TYPES: ActionType[] = ["execute", "privileged"];

// -----------------------------------------------------------------
// Input / Output types
// -----------------------------------------------------------------

export interface ActionGateInput {
  taskId: string;
  action: string;
  actionType: ActionType;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  userHasConfirmed: boolean;
  actor: AuditActor;
  context: string;
  evidenceRef: string;
  /**
   * Optional override for the audit directory.
   * When provided, the entry is written to this directory instead of ~/.hermes/audit/.
   * Tests MUST set this to a temp directory.
   */
  auditDir?: string;
}

interface ActionGateCheckResult {
  taskId: string;
  action: string;
  actionType: ActionType;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  decision: "allow" | "deny" | "require_user_approval";
  reasons: string[];
  isIrreversible: boolean;
  chainClean: number;
}

// -----------------------------------------------------------------
// Internal trust-to-capability map (mirrors shared/types.ts)
// Kept here so buildAuditContext stays pure (no Node-only imports).
// -----------------------------------------------------------------

const TRUST_CAPABILITY_MAP: Record<TrustLevel, Capability[]> = {
  trusted_user: [
    "read_public",
    "read_local",
    "write_artifact",
    "write_project",
    "run_command",
    "browser_action",
    "credential_access",
    "external_publish",
  ],
  semi_trusted_local: ["read_public", "read_local", "write_artifact"],
  untrusted_external: ["read_public"],
  unattended_cron: ["read_public"],
  archive_locked: [],
};

// -----------------------------------------------------------------
// Build AuditContext
// -----------------------------------------------------------------

interface AuditContext {
  trust_level: TrustLevel;
  requested_capability: Capability;
  allowed_capability_set: Capability[];
  matched_rule: string;
  allowlist_hit: string | null;
  path_check: "pass" | "fail" | "not_applicable";
  risk_level: "low" | "medium" | "high";
  action_type: ActionType;
  is_irreversible: boolean;
}

function buildAuditContext(
  sourceTrust: TrustLevel,
  requestedCapability: Capability,
  actionType: ActionType,
  isIrreversible: boolean,
): AuditContext {
  const allowed = TRUST_CAPABILITY_MAP[sourceTrust] ?? [];
  const matchedRule = isCapabilityAllowed(sourceTrust, requestedCapability)
    ? "trust_ceiling"
    : "capability_not_allowed";

  return {
    trust_level: sourceTrust,
    requested_capability: requestedCapability,
    allowed_capability_set: allowed,
    matched_rule: matchedRule,
    allowlist_hit: null,
    path_check: "not_applicable",
    risk_level: isIrreversible ? "high" : "medium",
    action_type: actionType,
    is_irreversible: isIrreversible,
  };
}

// -----------------------------------------------------------------
// Derive isIrreversible from action type + capability
// -----------------------------------------------------------------

function computeIsIrreversible(actionType: ActionType): boolean {
  return IRREVERSIBLE_TYPES.includes(actionType);
}

// -----------------------------------------------------------------
// checkActionGate — the single exported function
// -----------------------------------------------------------------

/**
 * Evaluate an action gate check for a task action.
 *
 * - Checks trust ceiling first (capability not allowed → deny).
 * - Marks irreversible / destructive / external / privileged actions as high-risk.
 * - Calls `actionGateCheck` (from shared/types.ts) to determine allow / deny / require_user_approval.
 * - Appends an `action_gate` audit entry to the default audit log (~/.hermes/audit/).
 * - Returns the decision together with the hash-chain verification result.
 *
 * No execution is performed; this is a pure decision helper.
 */
export function checkActionGate(input: ActionGateInput): ActionGateCheckResult {
  const auditDir = input.auditDir ?? DEFAULT_AUDIT_DIR;
  const reasons: string[] = [];

  // Step 1: Trust ceiling check — capability must be allowed for this trust level
  if (!isCapabilityAllowed(input.sourceTrust, input.requestedCapability)) {
    createAuditLogStore({ auditDir }).append({
      task_id: input.taskId,
      actor: input.actor,
      event: "action_gate",
      decision: "deny",
      context: buildAuditContext(
        input.sourceTrust,
        input.requestedCapability,
        input.actionType,
        computeIsIrreversible(input.actionType),
      ),
      evidence_ref: input.evidenceRef,
    });
    createAuditLogStore({ auditDir }).verify(input.taskId); // side-effect: verify chain

    return {
      taskId: input.taskId,
      action: input.action,
      actionType: input.actionType,
      sourceTrust: input.sourceTrust,
      requestedCapability: input.requestedCapability,
      decision: "deny",
      reasons: [
        `capability ${input.requestedCapability} not allowed for trust level ${input.sourceTrust}`,
      ],
      isIrreversible: computeIsIrreversible(input.actionType),
      chainClean: -1,
    };
  }

  // Step 2: Determine if this is an irreversible action
  const isIrreversible = computeIsIrreversible(input.actionType);

  // Step 3: Additional risk flags
  const isDestructive = DESTRUCTIVE_TYPES.includes(input.actionType);
  const isExternal = EXTERNAL_TYPES.includes(input.actionType);
  const isPrivileged = PRIVILEGED_TYPES.includes(input.actionType);

  // Step 4: archive_locked default — deny all writes/deletes/publishes/executes
  if (
    input.sourceTrust === "archive_locked" &&
    (isDestructive || isExternal || isPrivileged || input.actionType === "write")
  ) {
    createAuditLogStore({ auditDir }).append({
      task_id: input.taskId,
      actor: input.actor,
      event: "action_gate",
      decision: "deny",
      context: buildAuditContext(
        input.sourceTrust,
        input.requestedCapability,
        input.actionType,
        computeIsIrreversible(input.actionType),
      ),
      evidence_ref: input.evidenceRef,
    });
    createAuditLogStore({ auditDir }).verify(input.taskId);

    return {
      taskId: input.taskId,
      action: input.action,
      actionType: input.actionType,
      sourceTrust: input.sourceTrust,
      requestedCapability: input.requestedCapability,
      decision: "deny",
      reasons: [`archive_locked denied: action type ${input.actionType} not permitted`],
      isIrreversible: computeIsIrreversible(input.actionType),
      chainClean: -1,
    };
  }

  // Step 5: untrusted_external cannot trigger privileged/external actions
  if (
    input.sourceTrust === "untrusted_external" &&
    (isPrivileged || isExternal)
  ) {
    createAuditLogStore({ auditDir }).append({
      task_id: input.taskId,
      actor: input.actor,
      event: "action_gate",
      decision: "deny",
      context: buildAuditContext(
        input.sourceTrust,
        input.requestedCapability,
        input.actionType,
        computeIsIrreversible(input.actionType),
      ),
      evidence_ref: input.evidenceRef,
    });
    createAuditLogStore({ auditDir }).verify(input.taskId);

    return {
      taskId: input.taskId,
      action: input.action,
      actionType: input.actionType,
      sourceTrust: input.sourceTrust,
      requestedCapability: input.requestedCapability,
      decision: "deny",
      reasons: [
        `untrusted_external cannot trigger ${input.actionType} action type`,
      ],
      isIrreversible: computeIsIrreversible(input.actionType),
      chainClean: -1,
    };
  }

  // Step 6: Call shared actionGateCheck for the final decision
  const sharedResult = actionGateCheck({
    taskId: input.taskId,
    sourceTrust: input.sourceTrust,
    isIrreversible,
    userHasConfirmed: input.userHasConfirmed,
  });

  // Map shared ActionGateDecision to our decision type
  const decision: "allow" | "deny" | "require_user_approval" =
    sharedResult === "allow"
      ? "allow"
      : sharedResult === "deny"
        ? "deny"
        : "require_user_approval";

  if (decision === "deny" || decision === "require_user_approval") {
    if (isIrreversible) reasons.push(`irreversible action type: ${input.actionType}`);
    if (isDestructive) reasons.push(`destructive action type: ${input.actionType}`);
    if (isExternal) reasons.push(`external publish action`);
    if (isPrivileged) reasons.push(`privileged action type: ${input.actionType}`);
  }

  // Step 7: Append audit entry
  const auditDecision: AuditDecision =
    decision === "allow" ? "allow" : decision === "deny" ? "deny" : "need_approval";

  createAuditLogStore({ auditDir }).append({
    task_id: input.taskId,
    actor: input.actor,
    event: "action_gate",
    decision: auditDecision,
    context: buildAuditContext(
      input.sourceTrust,
      input.requestedCapability,
      input.actionType,
      isIrreversible,
    ),
    evidence_ref: input.evidenceRef,
  });

  // Step 8: Verify hash chain
  const chainClean = createAuditLogStore({ auditDir }).verify(input.taskId);

  return {
    taskId: input.taskId,
    action: input.action,
    actionType: input.actionType,
    sourceTrust: input.sourceTrust,
    requestedCapability: input.requestedCapability,
    decision,
    reasons,
    isIrreversible,
    chainClean,
  };
}