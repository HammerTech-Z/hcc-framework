// HCC Audit Artifact Persistence — first version contract.
//
// Defines the audit artifact shape and the path policy for where
// artifacts WOULD be persisted. The contract is a *descriptor* only:
// nothing in this module writes to disk, spawns anything, writes to
// `~/.hermes/**`, registers IPC, starts a timer, or transitions
// `night_run_ready` to true.
//
// Per HCC governance:
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO (HCC origin `c5b769b`)
//   - `night_run_ready` is a type-level `false` literal
//   - Auto Executor IDLE must NOT be armed implicitly
//
// Path policy:
//   - allowed: docs/audit/hcc/**/**  (repo-local only)
//   - denied:  ~/.hermes/**
//   - denied:  absolute paths outside repo
//   - denied:  src/main, src/renderer, src/preload, package.json, package-lock.json

export const HCC_AUDIT_ARTIFACT_PERSISTENCE_SCHEMA_VERSION = "1.0.0" as const;

// -----------------------------------------------------------------
// Path policy
// -----------------------------------------------------------------

export const HCC_AUDIT_ALLOWED_PREFIX = "docs/audit/hcc" as const;

export const HCC_AUDIT_DENIED_PREFIXES = [
  "~/.hermes",
  "src/main",
  "src/renderer",
  "src/preload",
  "package.json",
  "package-lock.json",
] as const;

export const HCC_AUDIT_DENIED_EXACT = [
  "package.json",
  "package-lock.json",
] as const;

export type HCCAuditPathDecision = "allowed" | "denied";

export interface HCCAuditPathCheckResult {
  path: string;
  decision: HCCAuditPathDecision;
  reason: string;
}

/**
 * Check whether a proposed audit artifact path is within the allowed
 * surface. The contract does NOT write to this path; it only validates
 * the intent.
 */
export function checkAuditPath(
  proposedPath: string,
): HCCAuditPathCheckResult {
  // Gate 1: hermes-home prefix.
  if (proposedPath.startsWith("~/.hermes") || proposedPath.startsWith("/") && proposedPath.includes("/.hermes/")) {
    return { path: proposedPath, decision: "denied", reason: "path under ~/.hermes/** is forbidden" };
  }

  // Gate 2: absolute path outside repo.
  if (proposedPath.startsWith("/") && !proposedPath.startsWith("/tmp/")) {
    return { path: proposedPath, decision: "denied", reason: "absolute path outside repo root (non-tmp) is forbidden" };
  }

  // Gate 3: denied prefixes.
  for (const denied of HCC_AUDIT_DENIED_PREFIXES) {
    if (denied.startsWith("~")) continue; // hermes already handled
    if (proposedPath === denied || proposedPath.startsWith(denied + "/") || proposedPath.startsWith(denied)) {
      return { path: proposedPath, decision: "denied", reason: `path under '${denied}' is forbidden` };
    }
  }

  // Gate 4: denied exact file names.
  for (const exact of HCC_AUDIT_DENIED_EXACT) {
    if (proposedPath === exact || proposedPath.endsWith("/" + exact)) {
      return { path: proposedPath, decision: "denied", reason: `exact path '${exact}' is forbidden` };
    }
  }

  // Gate 5: must be under allowed prefix.
  if (!proposedPath.startsWith(HCC_AUDIT_ALLOWED_PREFIX)) {
    return { path: proposedPath, decision: "denied", reason: `path must start with '${HCC_AUDIT_ALLOWED_PREFIX}'` };
  }

  return { path: proposedPath, decision: "allowed", reason: `path under '${HCC_AUDIT_ALLOWED_PREFIX}' is allowed (contract only, no write)` };
}

// -----------------------------------------------------------------
// Artifact descriptor
// -----------------------------------------------------------------

export interface HCCAuditArtifactDescriptor {
  schema_version: "1.0.0";
  /** Unique run id; typically the task id or GO record sha. */
  run_id: string;
  /** Commit sha at which the artifact was generated. */
  source_commit: string;
  /** Action id from the real action whitelist. */
  action_id: string;
  /** Decision from the real action whitelist. */
  whitelist_decision: string;
  /** Verdict from the budget / rate limit check. */
  budget_verdict: string;
  /** Decision from the rollback rehearsal. */
  rollback_rehearsal_decision: string;
  /** Verifier is always required. */
  verifier_required: true;
  /** Whether the artifact WOULD be persisted. The contract sets this to false — real persistence is a future slice. */
  would_persist: false;
  /** The proposed path(s) that passed the path check. Always empty in this contract. */
  persisted_paths: readonly [];
  /** Literal: no command was ever executed. */
  executed_commands: readonly [];
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** Literal. */
  go_no_go: "NO-GO";
  /** ISO 8601. */
  generated_at: string;
}

export interface HCCAuditArtifactBuildInput {
  run_id: string;
  source_commit: string;
  action_id: string;
  whitelist_decision: string;
  budget_verdict: string;
  rollback_rehearsal_decision: string;
}

/**
 * Build an audit artifact descriptor. The contract sets `would_persist: false`
 * and `persisted_paths: []` — real persistence is a future slice.
 * The descriptor is a pure object; this function does NOT write to disk.
 */
export function buildAuditArtifact(
  input: HCCAuditArtifactBuildInput,
): HCCAuditArtifactDescriptor {
  return {
    schema_version: "1.0.0",
    run_id: input.run_id,
    source_commit: input.source_commit,
    action_id: input.action_id,
    whitelist_decision: input.whitelist_decision,
    budget_verdict: input.budget_verdict,
    rollback_rehearsal_decision: input.rollback_rehearsal_decision,
    verifier_required: true,
    would_persist: false,
    persisted_paths: [],
    executed_commands: [],
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
    generated_at: new Date().toISOString(),
  };
}

// -----------------------------------------------------------------
// Posture
// -----------------------------------------------------------------

export interface HCCAuditArtifactPersistencePosture {
  schema_version: "1.0.0";
  allowed_prefix: string;
  denied_prefixes: readonly string[];
  denied_exact: readonly string[];
  /** Literal: no artifact is ever written to disk. */
  would_persist: false;
  /** Literal: the persistence contract never executes commands. */
  executed_commands: readonly [];
  /** Literal. */
  real_execution_ready: false;
  /** Literal. */
  unattended_ready: false;
  /** Literal. */
  night_run_ready: false;
  /** Literal. */
  go_no_go: "NO-GO";
}

export function getAuditArtifactPersistencePosture(): HCCAuditArtifactPersistencePosture {
  return {
    schema_version: "1.0.0",
    allowed_prefix: HCC_AUDIT_ALLOWED_PREFIX,
    denied_prefixes: [...HCC_AUDIT_DENIED_PREFIXES],
    denied_exact: [...HCC_AUDIT_DENIED_EXACT],
    would_persist: false,
    executed_commands: [],
    real_execution_ready: false,
    unattended_ready: false,
    night_run_ready: false,
    go_no_go: "NO-GO",
  };
}