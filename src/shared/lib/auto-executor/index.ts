/**
 * Auto Executor — boundary public surface.
 *
 * Default OFF: this module exports a library, not a runtime. The main
 * process bootstrap does NOT import this module. The boundary only
 * exists when a future executor runtime explicitly imports and
 * constructs it, and only operates when it is explicitly armed and
 * started (each of which requires a valid token).
 *
 * For the design rationale and STRIDE mapping, see
 * `docs/security/hcc-auto-executor-threat-model-2026-06-13.md`.
 * For the per-precondition minimum designs, see
 * `docs/plan/hcc-auto-executor-auth-impl-preflight-2026-06-13.md`.
 */

export { assertPinnedStateMatches, type GuardReport, type PinnedState, type LiveState, type GuardRefusalReason } from "./worktree-guard";

export { createKillSwitch, watchControlFile, type KillSwitch, type KillSwitchConfig } from "./kill-switch";

export { createActionRecord, revertAction, makeRevertFn, type ActionRecord, type PreState, type PostState, type RawRevertFn } from "./rollback";

export {
  createAuditBoundary,
  createMemoryAuditAppender,
  type AuditAppender,
  type AuditBoundary,
} from "./audit-log-boundary";

export {
  createSafeExec,
  type SafeExecConfig,
  type SafeExecAllowlist,
  type SafeExecRequestInput,
  type SafeExecReport,
  type SafeExecApproved,
  type SafeExecRefused,
  type SafeExecRefusalReason,
} from "./safe-exec";

export {
  createSecretAccessor,
  createMemorySecretStore,
  SecretNotAllowedError,
  type SecretAccessor,
  type SecretAccessorConfig,
  type SecretStore,
  type SecretValue,
} from "./secret-accessor";

export {
  createHermesWriteGuard,
  type HermesWriteGuardConfig,
  type PerWriteToken,
  type WriteVerdict,
  type WriteRefusalReason,
} from "./hermes-write-guard";

export {
  createAutoExecutorBoundary,
  mintArmToken,
  type Boundary,
  type BoundaryConfig,
  type BoundaryState,
  type ArmToken,
} from "./boundary";
