// P2.5 Safety Foundation — shared types
// Pure types only; no IPC, no file I/O, no Node.js crypto.
// Hash chain utilities live in src/main/safety/audit-hash.ts

export type TrustLevel =
  | "trusted_user"
  | "semi_trusted_local"
  | "untrusted_external"
  | "unattended_cron"
  | "archive_locked";

export type Capability =
  | "read_public"
  | "read_local"
  | "write_artifact"
  | "write_project"
  | "run_command"
  | "browser_action"
  | "credential_access"
  | "external_publish";

export const TRUST_TO_CAPABILITY: Record<TrustLevel, Capability[]> = {
  trusted_user:        ["read_public", "read_local", "write_artifact", "write_project", "run_command", "browser_action", "credential_access", "external_publish"],
  semi_trusted_local:  ["read_public", "read_local", "write_artifact"],
  untrusted_external:  ["read_public"],
  unattended_cron:     ["read_public"],
  archive_locked:      [],
};

export function isCapabilityAllowed(trustLevel: TrustLevel, requested: Capability): boolean {
  const ceiling = TRUST_TO_CAPABILITY[trustLevel] ?? [];
  return ceiling.includes(requested);
}

export type TaskState =
  | "received" | "classified" | "planned" | "awaiting_approval" | "ready_readonly"
  | "approved" | "preflight" | "executing" | "verifying" | "done" | "failed"
  | "rollback_required" | "rolled_back" | "blocked" | "rejected" | "escalation";

export type TaskEvent =
  | "classify" | "plan" | "approve" | "reject"
  | "preflight_pass" | "preflight_fail"
  | "execute" | "verify_pass" | "verify_fail"
  | "rollback_success" | "rollback_fail"
  | "retry_exhausted" | "user_override" | "escalate";

type TransitionRule = { from: TaskState; event: TaskEvent; to: TaskState };

const TRANSITIONS: TransitionRule[] = [
  { from: "received",           event: "classify",          to: "classified" },
  { from: "classified",         event: "plan",              to: "planned" },
  { from: "planned",           event: "approve",            to: "approved" },
  { from: "planned",           event: "reject",             to: "rejected" },
  { from: "planned",           event: "classify",           to: "ready_readonly" },
  { from: "ready_readonly",    event: "execute",            to: "executing" },
  { from: "approved",          event: "preflight_pass",     to: "preflight" },
  { from: "approved",          event: "preflight_fail",     to: "blocked" },
  { from: "preflight",         event: "execute",            to: "executing" },
  { from: "preflight",         event: "preflight_fail",     to: "blocked" },
  { from: "executing",         event: "verify_pass",        to: "verifying" },
  { from: "executing",         event: "verify_fail",        to: "failed" },
  { from: "verifying",         event: "verify_pass",        to: "done" },
  { from: "verifying",         event: "verify_fail",        to: "failed" },
  { from: "failed",            event: "execute",            to: "rollback_required" },
  { from: "rollback_required", event: "rollback_success",   to: "rolled_back" },
  { from: "rollback_required", event: "rollback_fail",      to: "escalation" },
  { from: "failed",            event: "retry_exhausted",   to: "blocked" },
  { from: "rolled_back",       event: "retry_exhausted",    to: "blocked" },
  { from: "blocked",           event: "user_override",      to: "approved" },
  { from: "rejected",          event: "user_override",      to: "approved" },
  { from: "escalation",        event: "escalate",           to: "escalation" },
];

export function transition(currentState: TaskState, event: TaskEvent): TaskState | null {
  const rule = TRANSITIONS.find((t) => t.from === currentState && t.event === event);
  return rule ? rule.to : null;
}

export function validEvents(state: TaskState): TaskEvent[] {
  return TRANSITIONS.filter((t) => t.from === state).map((t) => t.event);
}
export type PreflightDecision = 'allow' | 'deny' | 'require_user_approval';

export interface PreflightResult {
  taskId: string;
  action: string;
  sourceTrust: TrustLevel;
  requestedCapability: Capability;
  decision: PreflightDecision;
  reasons: string[];
  rollbackPoint: string | null;
  verifierRequired: boolean;
}

export function makePreflightDecision(
  taskId: string,
  action: string,
  sourceTrust: TrustLevel,
  requestedCapability: Capability,
  options?: { userHasConfirmed?: boolean; customReasons?: string[]; riskLevel?: "low" | "medium" | "high" },
): PreflightResult {
  const reasons = options?.customReasons ?? [];
  if (!isCapabilityAllowed(sourceTrust, requestedCapability)) {
    return {
      taskId, action, sourceTrust, requestedCapability,
      decision: 'deny',
      reasons: [`capability ${requestedCapability} not allowed for trust level ${sourceTrust}`, ...reasons],
      rollbackPoint: null, verifierRequired: false,
    };
  }
  // High-risk actions always require user confirmation, regardless of capability allowance.
  // riskLevel overrides the capability-based heuristic.
  const effectiveRisk: "low" | "medium" | "high" = options?.riskLevel ?? (
    ['credential_access', 'external_publish', 'browser_action'].includes(requestedCapability)
      ? 'high'
      : 'low'
  );
  if (effectiveRisk === 'high') {
    if (options?.userHasConfirmed) {
      return {
        taskId, action, sourceTrust, requestedCapability,
        decision: 'allow',
        reasons: ['user explicitly confirmed high-risk action', ...reasons],
        rollbackPoint: null, verifierRequired: true,
      };
    }
    return {
      taskId, action, sourceTrust, requestedCapability,
      decision: 'require_user_approval',
      reasons: [`high-risk action (riskLevel=${effectiveRisk}) requires user confirmation`, ...reasons],
      rollbackPoint: null, verifierRequired: true,
    };
  }
  return {
    taskId, action, sourceTrust, requestedCapability,
    decision: 'allow', reasons: [...reasons],
    rollbackPoint: null, verifierRequired: false,
  };
}

export type ActionGateDecision = 'allow' | 'deny' | 'require_user_approval';

export interface ActionGateContext {
  taskId: string;
  sourceTrust: TrustLevel;
  isIrreversible: boolean;
  userHasConfirmed: boolean;
}

export function actionGateCheck(ctx: ActionGateContext): ActionGateDecision {
  if (ctx.isIrreversible && !ctx.userHasConfirmed) return 'require_user_approval';
  return 'allow';
}

// -----------------------------------------------------------------
// Audit Log — shared types (from §6)
// Hash implementation (SHA-256) lives in src/main/safety/audit-hash.ts
// -----------------------------------------------------------------

export type AuditEvent =
  | "preflight" | "action_gate" | "capability_grant"
  | "state_transition" | "rollback" | "user_override" | "redaction_fail"
  | "resource_lease" | "retry_check";

export type AuditActor = 'codex' | 'claude' | 'hermes' | 'user' | 'system';
export type AuditDecision = 'allow' | 'deny' | 'need_approval' | 'info';

// -----------------------------------------------------------------
// Retry Context (for audit extension, §5.4)
// Defined here so it is available to AuditContext.
// -----------------------------------------------------------------

export interface RetryContext {
  failure_signature: string;
  failure_kind:
    | "agent_error"
    | "task_failure"
    | "execution_error"
    | "verification_error"
    | "resource_exhaustion"
    | "external_dependency_error";
  attempt_count: number;
  max_retries: number;
  dead_end: boolean;
  /** Retries never auto-expand capability — always false */
  can_expand_capability: false;
  reason: string;
}

export interface AuditContext {
  trust_level: TrustLevel;
  requested_capability: Capability;
  allowed_capability_set: Capability[];
  matched_rule: string;
  allowlist_hit: string | null;
  path_check: 'pass' | 'fail' | 'not_applicable';
  /** Risk level of the action at preflight time. */
  risk_level: 'low' | 'medium' | 'high';
  /** Additional resource-type fields for resource_lease events (optional for other events). */
  resource_type?: "worktree" | "local_llm" | "gateway" | "browser";
  resource_id?: string;
  priority?: "interactive" | "cron" | "background";
  existing_lease?: {
    task_id: string;
    priority: "interactive" | "cron" | "background";
    expires_at: number;
    is_expired: boolean;
  } | null;
  /** Extended context for retry_check events. */
  retry_context?: RetryContext;
}

/** Audit entry — entry_hash is computed by audit-hash.ts (Node crypto). */
export interface AuditEntry {
  seq: number;
  prev_hash: string;
  entry_hash: string;
  ts: string;
  task_id: string;
  actor: AuditActor;
  event: AuditEvent;
  decision: AuditDecision;
  context: AuditContext;
  evidence_ref: string;
}

/** Hash input fields (per p2-5 spec: actor NOT included in hash). */
export interface AuditHashInput {
  seq: number;
  prev_hash: string;
  ts: string;
  task_id: string;
  event: AuditEvent;
  decision: AuditDecision;
  context: AuditContext;
  evidence_ref: string;
}
// -----------------------------------------------------------------
// Retry State (from §5.4)
// -----------------------------------------------------------------

export interface RetryState {
  taskId: string;
  failureSignature: string;
  count: number;
}

export const MAX_RETRIES = 2;

export function checkRetry(
  taskId: string,
  failureSignature: string,
  state: Map<string, RetryState>
): { allowed: boolean; count: number } {
  const key = `${taskId}::${failureSignature}`;
  const current = state.get(key);
  if (!current) return { allowed: true, count: 0 };
  if (current.count >= MAX_RETRIES) return { allowed: false, count: current.count };
  return { allowed: true, count: current.count };
}

export function incrementRetry(
  taskId: string,
  failureSignature: string,
  state: Map<string, RetryState>
): RetryState {
  const key = `${taskId}::${failureSignature}`;
  const existing = state.get(key);
  const next: RetryState = {
    taskId,
    failureSignature,
    count: existing ? existing.count + 1 : 1,
  };
  state.set(key, next);
  return next;
}

// -----------------------------------------------------------------
// Retry Context (for audit extension, §5.4)
// -----------------------------------------------------------------
// Provenance schema (from §10)
// -----------------------------------------------------------------

export type SourceType =
  | "chat" | "wechat" | "feishu" | "web" | "github"
  | "local_file" | "cron" | "archive";

export interface Provenance {
  source_type: SourceType;
  source_uri: string;
  fetched_at: string | null; // ISO 8601
  trust_level: TrustLevel;
  license_or_terms: 'unknown' | 'checked' | 'restricted';
  contains_instructions: boolean;
  /** 外部内容默认 false */
  safe_to_use_as_instruction: boolean;
}
