// HCC Real Action Whitelist — first version contract.
//
// Models the allow / deny / requires_user_approval surface for
// "real" action classes that a future real-execution slice might be
// allowed to take. This slice is a **contract** only: nothing in the
// contract admits a real command, spawns anything, writes to
// `~/.hermes/**`, registers IPC, starts a timer, or transitions
// `night_run_ready` to true.
//
// Default deny. The contract is a closed-by-default matrix; any
// candidate action must be added to the matrix before the contract
// permits it, and a candidate that implies unattended execution is
// refused at the gate.
//
// Per HCC governance:
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO (HCC origin commit `ec15ad1`)
//   - Auto Executor 常驻 must NOT be armed implicitly
//   - `night_run_ready` is a type-level `false` literal in
//     `src/shared/lib/hcc-controlled-executor.ts`
//
// Risk levels (literal in source):
//   - "low"        : repo-local read / status inspection
//   - "moderate"   : dry-run-able repo-local mutation, no live side effects
//   - "high"       : real command execution, spawn, network, or filesystem
//                    write outside the repo
//   - "forbidden"  : hard-wired deny (spawn, IPC, hermes writes, etc.)

export const HCC_REAL_ACTION_WHITELIST_SCHEMA_VERSION = "1.0.0" as const;

export type HCCRealActionDecision =
  | "allow"
  | "deny"
  | "requires_user_approval";

export type HCCRealActionRiskLevel =
  | "low"
  | "moderate"
  | "high"
  | "forbidden";

/** Allowed surfaces for a real action. Default empty (closed-by-default). */
export type HCCRealActionSurface =
  | "repo_local_read"
  | "repo_local_dry_run_mutate"
  | "test_run_dry"
  | "docs_propose_only"
  | "shell_spawn"
  | "git_push"
  | "git_destructive"
  | "hermes_config_write"
  | "package_install"
  | "ipc_register"
  | "timer_register"
  | "browser_action"
  | "external_publish"
  | "credential_access"
  | "live_apply";

/**
 * A real action descriptor. Submitted for evaluation only.
 * This is a *contract* type, not a *command* type. The
 * `command_invocation` field is informational; the whitelist
 * evaluates by `id` and `surfaces`, not by command string.
 */
export interface HCCRealActionDescriptor {
  id: string;
  description?: string;
  surfaces: readonly HCCRealActionSurface[];
  /** If true, the action implies unattended execution. */
  implies_unattended: boolean;
  /** If true, the action touches `~/.hermes/**`. */
  touches_hermes_config: boolean;
  /** If true, the action may execute real shell commands. */
  requires_shell_spawn: boolean;
  /** If true, the action must be auto-applied. */
  auto_apply: boolean;
}

/**
 * The whitelist entry shape. Each candidate action is registered
 * with: id, risk level, allowed surfaces, required verifier,
 * rollback requirement, and default decision.
 */
export interface HCCRealActionWhitelistEntry {
  id: string;
  risk_level: HCCRealActionRiskLevel;
  allowed_surfaces: readonly HCCRealActionSurface[];
  default_decision: HCCRealActionDecision;
  /** When decision is `requires_user_approval`, this gate is enforced. */
  approval_required: boolean;
  /** Required verifier id (e.g. "verifier-001"). */
  required_verifier: string | null;
  /** Rollback strategy reference. */
  rollback_strategy: "git_revert_commit" | "git_reset_to_origin" | "manual_cherry_pick_drop" | null;
  /** Literal: no action in this whitelist can imply unattended execution. */
  may_imply_unattended: false;
  /** Literal: no action in this whitelist may touch `~/.hermes/**`. */
  may_touch_hermes_config: false;
  /** Literal: no action in this whitelist may shell-spawn. */
  may_shell_spawn: false;
}

export interface HCCRealActionEvaluation {
  schema_version: "1.0.0";
  action_id: string;
  decision: HCCRealActionDecision;
  reason: string;
  matched_entry: HCCRealActionWhitelistEntry | null;
}

// -----------------------------------------------------------------
// Default-deny helpers
// -----------------------------------------------------------------

function deny(actionId: string, reason: string): HCCRealActionEvaluation {
  return {
    schema_version: "1.0.0",
    action_id: actionId,
    decision: "deny",
    reason,
    matched_entry: null,
  };
}

// -----------------------------------------------------------------
// Hard-deny surface predicates (closed-by-default)
// -----------------------------------------------------------------

const FORBIDDEN_SURFACES: readonly HCCRealActionSurface[] = [
  "shell_spawn",
  "git_push",
  "git_destructive",
  "hermes_config_write",
  "package_install",
  "ipc_register",
  "timer_register",
  "browser_action",
  "external_publish",
  "credential_access",
  "live_apply",
];

export function isForbiddenSurface(surface: HCCRealActionSurface): boolean {
  return FORBIDDEN_SURFACES.includes(surface);
}

// -----------------------------------------------------------------
// Built-in whitelist (closed-by-default; default deny for unknown ids)
// -----------------------------------------------------------------

const HCC_REAL_ACTION_WHITELIST: readonly HCCRealActionWhitelistEntry[] = [
  {
    id: "read_repo_status",
    risk_level: "low",
    allowed_surfaces: ["repo_local_read"],
    default_decision: "allow",
    approval_required: false,
    required_verifier: null,
    rollback_strategy: null,
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  },
  {
    id: "git_diff_inspection",
    risk_level: "low",
    allowed_surfaces: ["repo_local_read"],
    default_decision: "allow",
    approval_required: false,
    required_verifier: null,
    rollback_strategy: null,
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  },
  {
    id: "propose_test_run",
    risk_level: "low",
    allowed_surfaces: ["test_run_dry"],
    default_decision: "allow",
    approval_required: false,
    required_verifier: "verifier-test-proposal",
    rollback_strategy: null,
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  },
  {
    id: "propose_docs_update",
    risk_level: "low",
    allowed_surfaces: ["docs_propose_only"],
    default_decision: "allow",
    approval_required: false,
    required_verifier: "verifier-docs-proposal",
    rollback_strategy: "git_revert_commit",
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  },
  {
    id: "repo_local_dry_run_mutate",
    risk_level: "moderate",
    allowed_surfaces: ["repo_local_dry_run_mutate"],
    default_decision: "requires_user_approval",
    approval_required: true,
    required_verifier: "verifier-dry-run-mutate",
    rollback_strategy: "git_revert_commit",
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  },
  {
    id: "real_command_execution",
    risk_level: "high",
    allowed_surfaces: [],
    default_decision: "deny",
    approval_required: true,
    required_verifier: "verifier-real-execution",
    rollback_strategy: "git_revert_commit",
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  },
];

// -----------------------------------------------------------------
// Decision function
// -----------------------------------------------------------------

export interface HCCRealActionDecisionInput {
  descriptor: HCCRealActionDescriptor;
  /** Optional override for unattended readiness. Default false. */
  unattended_ready?: boolean;
}

export function decideRealAction(
  input: HCCRealActionDecisionInput,
): HCCRealActionEvaluation {
  const { descriptor } = input;
  const unattendedReady = input.unattended_ready ?? false;

  // 1. Hard-deny: shell spawn, git push, hermes writes, package install,
  //    IPC, timer, browser, external publish, credential, live apply.
  for (const surface of descriptor.surfaces) {
    if (isForbiddenSurface(surface)) {
      return deny(
        descriptor.id,
        `forbidden surface '${surface}' — closed-by-default`,
      );
    }
  }

  // 2. Hard-deny: any descriptor that implies unattended execution.
  if (descriptor.implies_unattended) {
    return deny(descriptor.id, "implies_unattended: refused by contract");
  }

  // 3. Hard-deny: any descriptor that touches `~/.hermes/**`.
  if (descriptor.touches_hermes_config) {
    return deny(descriptor.id, "touches_hermes_config: refused by contract");
  }

  // 4. Hard-deny: any descriptor that requires shell spawn.
  if (descriptor.requires_shell_spawn) {
    return deny(descriptor.id, "requires_shell_spawn: refused by contract");
  }

  // 5. Hard-deny: any descriptor that must auto-apply.
  if (descriptor.auto_apply) {
    return deny(descriptor.id, "auto_apply: refused by contract");
  }

  // 6. The whitelist cannot imply unattended readiness. If a caller
  //    claims unattended_ready=true, every entry is denied.
  if (unattendedReady) {
    return deny(
      descriptor.id,
      "unattended_ready=true: whitelist cannot imply unattended readiness",
    );
  }

  // 7. Default-deny for unknown ids.
  const entry = HCC_REAL_ACTION_WHITELIST.find((e) => e.id === descriptor.id);
  if (!entry) {
    return deny(descriptor.id, "unknown action id: default deny");
  }

  // 8. Entry is matched. Verify the descriptor's surfaces are within
  //    the entry's allowed_surfaces.
  for (const surface of descriptor.surfaces) {
    if (!entry.allowed_surfaces.includes(surface)) {
      return deny(
        descriptor.id,
        `surface '${surface}' not in entry.allowed_surfaces`,
      );
    }
  }

  // 9. The entry is a low/moderate action. The whitelist entry's
  //    `default_decision` is the result. A future slice can flip
  //    default_decision per-entry without changing this function.
  return {
    schema_version: "1.0.0",
    action_id: descriptor.id,
    decision: entry.default_decision,
    reason: `whitelist entry '${entry.id}' (risk=${entry.risk_level})`,
    matched_entry: entry,
  };
}

// -----------------------------------------------------------------
// Posture
// -----------------------------------------------------------------

export interface HCCRealActionWhitelistPosture {
  schema_version: "1.0.0";
  total_entries: number;
  allow_entries: number;
  approval_entries: number;
  deny_entries: number;
  default_deny: true;
  night_run_ready: false;
  go_no_go: "NO-GO";
  may_imply_unattended: false;
  may_touch_hermes_config: false;
  may_shell_spawn: false;
}

export function getHccRealActionWhitelistPosture(): HCCRealActionWhitelistPosture {
  return {
    schema_version: "1.0.0",
    total_entries: HCC_REAL_ACTION_WHITELIST.length,
    allow_entries: HCC_REAL_ACTION_WHITELIST.filter(
      (e) => e.default_decision === "allow",
    ).length,
    approval_entries: HCC_REAL_ACTION_WHITELIST.filter(
      (e) => e.default_decision === "requires_user_approval",
    ).length,
    deny_entries: HCC_REAL_ACTION_WHITELIST.filter(
      (e) => e.default_decision === "deny",
    ).length,
    default_deny: true,
    night_run_ready: false,
    go_no_go: "NO-GO",
    may_imply_unattended: false,
    may_touch_hermes_config: false,
    may_shell_spawn: false,
  };
}