// P2.5 Pre-flight Gate — pure main helper
// No IPC, no HCC, no CLI, no executor.
// Calls makePreflightDecision (shared) and appends a preflight audit entry.

import type {
  AuditActor,
  AuditDecision,
  Capability,
  PreflightResult,
  TrustLevel,
} from "@shared/lib/safety/types";
import { makePreflightDecision, isCapabilityAllowed } from "@shared/lib/safety/types";
import { createAuditLogStore, DEFAULT_AUDIT_DIR } from "./audit-log";

// -----------------------------------------------------------------
// Input / Output types
// -----------------------------------------------------------------

export interface PreflightInput {
  taskId: string;
  action: string;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  /** Risk level of the action — drives require_user_approval for high-risk. */
  riskLevel: "low" | "medium" | "high";
  /** Set to true when the user has already confirmed this high-risk action. */
  userHasConfirmed?: boolean;
  actor: AuditActor;
  /** Human-readable context summary, used in audit entry. */
  context: string;
  /** Evidence reference, used in audit entry. */
  evidenceRef: string;
  /**
   * Optional override for the audit directory.
   * When provided, the entry is written to this directory instead of ~/.hermes/audit/.
   * Tests MUST set this to a temp directory.
   */
  auditDir?: string;
}

interface PreflightCheckResult extends PreflightResult {
  /** Hash chain verification result after this entry is appended: -1 = clean. */
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
// Build AuditContext from preflight inputs
// -----------------------------------------------------------------

function buildAuditContext(
  sourceTrust: TrustLevel,
  requestedCapability: Capability,
  riskLevel: "low" | "medium" | "high",
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
    risk_level: riskLevel,
  };
}

// Import AuditContext locally to avoid re-declaring it
import type { AuditContext } from "@shared/lib/safety/types";

// -----------------------------------------------------------------
// checkPreflight — the single exported function
// -----------------------------------------------------------------

/**
 * Evaluate a preflight gate check for a task action.
 *
 * - Calls `makePreflightDecision` to determine allow / deny / require_user_approval.
 * - Appends a `preflight` audit entry to the default audit log (~/.hermes/audit/).
 * - Returns the decision together with the hash-chain verification result.
 *
 * No execution is performed; this is a pure decision helper.
 */
export function checkPreflight(input: PreflightInput): PreflightCheckResult {
  const decisionResult = makePreflightDecision(
    input.taskId,
    input.action,
    input.sourceTrust,
    input.requestedCapability,
    { userHasConfirmed: input.userHasConfirmed, riskLevel: input.riskLevel },
  );

  const auditContext = buildAuditContext(input.sourceTrust, input.requestedCapability, input.riskLevel);

  // Map PreflightDecision to AuditDecision
  const auditDecision: AuditDecision = (decisionResult.decision === "allow"
      ? "allow"
      : decisionResult.decision === "deny"
        ? "deny"
        : "need_approval") as AuditDecision;

  // Append to audit log via default store (uses ~/.hermes/audit/)
  // The append call is made for its side effect (persistence + hash chain).
  const auditDir = input.auditDir ?? DEFAULT_AUDIT_DIR;
  const store = createAuditLogStore({ auditDir });
  store.append({
    task_id: input.taskId,
    actor: input.actor,
    event: "preflight",
    decision: auditDecision,
    context: auditContext,
    evidence_ref: input.evidenceRef,
  });

  // Verify the chain after appending
  const chainClean = store.verify(input.taskId);

  return {
    ...decisionResult,
    chainClean,
  };
}