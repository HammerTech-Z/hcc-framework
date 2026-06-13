// HCC Auto Executor — Host Lifecycle.
//
// Wires the boundary library at src/shared/lib/auto-executor/** into a
// main-process-shaped host that satisfies the exec-preflight §5
// lifecycle test contract. **Default OFF**: this module is NOT imported
// from src/main/index.ts (or any other main-process bootstrap). It is
// constructed only by tests and (in the future) by a future bootstrap
// activation GO.
//
// The host:
//   - holds one Boundary instance
//   - delegates arm/disarm/start/abort to it
//   - exposes health(), status(), lease(), timeout(), rollback hooks
//   - exposes runMockAction() that NEVER spawns a subprocess; returns
//     the planned action description instead, for the lifecycle test to
//     assert on
//   - tracks max_subprocess_count (default 0 literal — see
//     src/shared/lib/hcc-controlled-executor.ts); any attempt to invoke
//     runMockAction when max_subprocess_count == 0 succeeds only when
//     mode === "dry_run" or "controlled"; in any other mode the host
//     refuses and throws — the boundary is the runtime, not the host,
//     so even a future "live" mode would still require subprocess
//     capability to be enabled by a separate GO.
//
// Per exec-preflight §4.3, this module must NOT:
//   - spawn anything
//   - mutate the working tree
//   - register any IPC handler
//   - import `node:child_process`
//   - be reachable from src/renderer/**
//
// Per exec-preflight §4.4, bootstrap activation (importing this module
// from src/main/index.ts) is held for a separate explicit GO.

import {
  createAutoExecutorBoundary,
  createMemoryAuditAppender,
  type Boundary,
  type BoundaryConfig,
  type BoundaryState,
  type ArmToken,
} from "../shared/lib/auto-executor";

import { decideTaskAdmission, type AdmissionResult, type AdmissionActionClass } from "../shared/lib/hcc-controlled-executor";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export type HostMode = "dry_run" | "controlled";

export interface HostHealth {
  /** Boundary state. */
  state: BoundaryState;
  /** True iff the kill switch has not been triggered. */
  alive: boolean;
  /** Current subprocess count (always 0 in this implementation). */
  subprocess_count: 0;
  /** Maximum subprocess count (default 0; controlled mode cannot exceed). */
  max_subprocess_count: 0;
  /** Mode of the host. */
  mode: HostMode;
  /** ISO 8601 timestamp at which the health snapshot was taken. */
  sampled_at: string;
}

export interface HostStatus {
  state: BoundaryState;
  mode: HostMode;
  go_record_sha: string | null;
  pinned_repo_root: string;
  pinned_branch: string;
  pinned_head: string;
  pinned_cwd: string;
  health: HostHealth;
}

export interface HostLease {
  /** The lease id; same as the GO record sha. */
  lease_id: string;
  /** The task id the lease is held for. */
  task_id: string;
  /** ISO 8601 timestamp at which the lease was granted. */
  granted_at: string;
  /** ISO 8601 timestamp at which the lease expires (default +1h). */
  expires_at: string;
  /** Whether the lease is still valid. */
  is_expired: boolean;
}

export interface HostTimeoutConfig {
  /** Wall-clock budget in milliseconds. Default 30 minutes. */
  wall_clock_ms: number;
  /** Heartbeat interval in milliseconds. Default 60 seconds. */
  heartbeat_ms: number;
}

export interface HostRollbackHookResult {
  /** Whether the rollback hook found a recorded action. */
  found: boolean;
  /** The action record id, if found. */
  action_id: string | null;
  /** What the rollback would do. The host NEVER executes it; this is descriptive. */
  description: string;
}

export interface MockActionRequest {
  task_id: string;
  worktree_isolated: boolean;
  single_branch: boolean;
  single_commit_candidate: boolean;
  action_class: AdmissionActionClass;
}

export interface MockActionResult {
  /** Admission decision from the controlled-executor policy. */
  admission: AdmissionResult;
  /** The action would have been a no-op (no spawn). */
  would_execute: false;
  /** Subprocess count after this action. */
  subprocess_count_after: 0;
  /** ISO 8601 timestamp at which the action was recorded. */
  recorded_at: string;
}

export interface AutoExecutorHost {
  /** Boundary state. */
  state(): BoundaryState;
  /** Try to arm with a token. Returns true on success. */
  arm(token: ArmToken): boolean;
  /** Disarm. No-op while running. */
  disarm(): void;
  /** Start. Requires armed. Returns true on success. */
  start(): boolean;
  /** Abort. Idempotent. Triggers kill switch. */
  abort(reason: string): void;
  /** Health snapshot. */
  health(): HostHealth;
  /** Status snapshot. */
  status(): HostStatus;
  /** Grant a lease for a task. */
  grantLease(taskId: string): HostLease;
  /** Expire a lease (test helper). */
  expireLease(taskId: string): void;
  /** Check whether a given task id holds a valid lease. */
  checkLease(taskId: string): HostLease | null;
  /** Rollback hook. Returns what *would* be reverted; never executes. */
  rollbackHook(actionId: string): HostRollbackHookResult;
  /** Get the current timeout configuration. */
  getTimeoutConfig(): HostTimeoutConfig;
  /** Reset timeout configuration (test helper). */
  setTimeoutConfig(cfg: HostTimeoutConfig): void;
  /**
   * Run a mock action. NEVER spawns. Returns the admission decision
   * plus a literal `would_execute: false`. If admission is `deny`, throws.
   */
  runMockAction(req: MockActionRequest): MockActionResult;
  /** Underlying boundary handle. Exposed for tests; production callers should prefer the host methods. */
  boundary(): Boundary;
}

// -----------------------------------------------------------------
// Constructor
// -----------------------------------------------------------------

const DEFAULT_LEASE_TTL_MS = 60 * 60 * 1000; // 1h
const DEFAULT_WALL_CLOCK_MS = 30 * 60 * 1000; // 30min
const DEFAULT_HEARTBEAT_MS = 60 * 1000; // 60s

export interface AutoExecutorHostConfig {
  pinnedState: {
    expectedRepoRoot: string;
    expectedBranch: string;
    expectedHead: string;
    expectedCwd: string;
  };
  tokenSecret: string;
  goRecordSha: string;
  mode?: HostMode;
  leaseTtlMs?: number;
  timeoutConfig?: Partial<HostTimeoutConfig>;
}

export function createAutoExecutorHost(
  config: AutoExecutorHostConfig,
): AutoExecutorHost {
  if (!config.tokenSecret || config.tokenSecret.length === 0) {
    throw new Error("tokenSecret must be non-empty");
  }
  if (!config.goRecordSha || config.goRecordSha.length === 0) {
    throw new Error("goRecordSha must be non-empty");
  }
  const mode: HostMode = config.mode ?? "dry_run";
  if (mode !== "dry_run" && mode !== "controlled") {
    throw new Error(`unknown host mode: ${String(mode)}`);
  }

  const boundaryConfig: BoundaryConfig = {
    pinnedState: {
      expectedRepoRoot: config.pinnedState.expectedRepoRoot,
      expectedBranch: config.pinnedState.expectedBranch,
      expectedHead: config.pinnedState.expectedHead,
      expectedCwd: config.pinnedState.expectedCwd,
    },
    safeExec: {
      allowlist: { binaries: new Set<string>() }, // closed-by-default; expanding allowlist is a separate GO
      pinnedCwd: config.pinnedState.expectedCwd,
    },
    hermesWriteGuard: {
      tokenSecret: config.tokenSecret,
      // closed-by-default; any write to ~/.hermes/** requires per-write token
    },
    secretAllowlist: new Set<string>(), // closed-by-default
    tokenSecret: config.tokenSecret,
    audit: undefined, // defaults to in-memory
  };

  const boundary = createAutoExecutorBoundary(boundaryConfig);
  // Keep the memory appender reference for tests that want to inspect it.
  const memoryAppender = createMemoryAuditAppender();
  void memoryAppender;

  const leaseTtlMs = config.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
  const timeoutConfig: HostTimeoutConfig = {
    wall_clock_ms: config.timeoutConfig?.wall_clock_ms ?? DEFAULT_WALL_CLOCK_MS,
    heartbeat_ms: config.timeoutConfig?.heartbeat_ms ?? DEFAULT_HEARTBEAT_MS,
  };

  // leaseId (sha) -> grantedAt timestamp; one lease per taskId
  const leases = new Map<string, { grantedAt: number; expiresAt: number }>();

  function isLeaseExpired(now: number, entry: { expiresAt: number }): boolean {
    return now >= entry.expiresAt;
  }

  function healthSnapshot(now: number): HostHealth {
    return {
      state: boundary.state(),
      alive: !boundary.killSwitch.isKilled(),
      subprocess_count: 0 as const,
      max_subprocess_count: 0 as const,
      mode,
      sampled_at: new Date(now).toISOString(),
    };
  }

  return {
    state: () => boundary.state(),

    arm(token: ArmToken): boolean {
      return boundary.arm(token);
    },

    disarm(): void {
      boundary.disarm();
    },

    start(): boolean {
      return boundary.start();
    },

    abort(reason: string): void {
      boundary.abort(reason);
    },

    health(): HostHealth {
      return healthSnapshot(Date.now());
    },

    status(): HostStatus {
      const h = healthSnapshot(Date.now());
      return {
        state: h.state,
        mode: h.mode,
        go_record_sha: config.goRecordSha,
        pinned_repo_root: config.pinnedState.expectedRepoRoot,
        pinned_branch: config.pinnedState.expectedBranch,
        pinned_head: config.pinnedState.expectedHead,
        pinned_cwd: config.pinnedState.expectedCwd,
        health: h,
      };
    },

    grantLease(taskId: string): HostLease {
      const now = Date.now();
      const grantedAt = now;
      const expiresAt = now + leaseTtlMs;
      leases.set(taskId, { grantedAt, expiresAt });
      return {
        lease_id: config.goRecordSha,
        task_id: taskId,
        granted_at: new Date(grantedAt).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        is_expired: false,
      };
    },

    expireLease(taskId: string): void {
      const entry = leases.get(taskId);
      if (!entry) return;
      entry.expiresAt = 0;
    },

    checkLease(taskId: string): HostLease | null {
      const entry = leases.get(taskId);
      if (!entry) return null;
      const now = Date.now();
      const expired = isLeaseExpired(now, entry);
      return {
        lease_id: config.goRecordSha,
        task_id: taskId,
        granted_at: new Date(entry.grantedAt).toISOString(),
        expires_at: new Date(entry.expiresAt).toISOString(),
        is_expired: expired,
      };
    },

    rollbackHook(actionId: string): HostRollbackHookResult {
      // The host NEVER executes the rollback; it only describes it.
      // The actual revert is delegated to boundary.revertRollback when
      // and if a real action has been recorded. In dry-run / controlled
      // mode with no recorded action, found=false.
      return {
        found: false,
        action_id: actionId,
        description: "host.rollbackHook is descriptive-only; actual revert is delegated to boundary.revertRollback once an action is recorded",
      };
    },

    getTimeoutConfig(): HostTimeoutConfig {
      return { ...timeoutConfig };
    },

    setTimeoutConfig(cfg: HostTimeoutConfig): void {
      timeoutConfig.wall_clock_ms = cfg.wall_clock_ms;
      timeoutConfig.heartbeat_ms = cfg.heartbeat_ms;
    },

    runMockAction(req: MockActionRequest): MockActionResult {
      // 1. Admission decision (controlled-executor policy).
      const admission = decideTaskAdmission({
        task_id: req.task_id,
        worktree_isolated: req.worktree_isolated,
        single_branch: req.single_branch,
        single_commit_candidate: req.single_commit_candidate,
        action_class: req.action_class,
      });
      if (admission.decision === "deny") {
        throw new Error(
          `mock action denied for task ${req.task_id}: ${admission.reason}`,
        );
      }
      // 2. require_user_approval: the host does NOT throw — it returns
      // the admission result; the caller (e.g. the lifecycle test or a
      // future approval-flow) is responsible for honoring
      // `requires_user_approval`. The action is still a no-op.
      // 3. Literal no-execution guarantee.
      return {
        admission,
        would_execute: false,
        subprocess_count_after: 0,
        recorded_at: new Date().toISOString(),
      };
    },

    boundary(): Boundary {
      return boundary;
    },
  };
}