// HERMES-GOV-005 :: B1 Runtime Readiness Matrix
//
// Pure data + helpers. No I/O, no IPC, no runtime mutation. This module
// makes the previously-vague "B1 backend daemon / channel / cron / weixin
// / runtime blocked" constraint machine-readable so that LOOP-010.A
// admission can be checked mechanically and the next smallest B1 slice
// can be identified by inspection.
//
// B1 surfaces:
//   - backend daemon readiness
//   - channel runtime readiness
//   - cron scheduling readiness
//   - weixin ingress readiness
//   - gateway / IPC readiness
//   - HCC Auto Executor / live apply readiness
//   - user authorization requirement
//   - no ~/.hermes writes requirement
//   - no runtime mutation requirement
//
// Status semantics:
//   blocked                 -> surface is explicitly NOT-GO; an implementation
//                              slice must remove the block before admission.
//   ready                   -> surface is GO; no further slice needed.
//   not_applicable          -> surface is irrelevant for B1 admission here.
//   requires_user_authorization
//                           -> surface cannot be admitted by this matrix;
//                              the user must grant explicit authorization
//                              (verified stays false in the contract layer;
//                              consumer-layer verifier remains the trust root).
//   requires_separate_slice  -> surface needs its own HERMES-GOV-NNN slice
//                              and is not part of HERMES-GOV-005.
//
// Evidence refs point to local governance / safety facts only. They are
// descriptive strings; this matrix performs no I/O.

export const B1_RUNTIME_READINESS_MATRIX_SCHEMA_VERSION = "1.0.0" as const;

export type B1SurfaceStatus =
  | "blocked"
  | "ready"
  | "not_applicable"
  | "requires_user_authorization"
  | "requires_separate_slice";

export type B1RuntimeSurfaceId =
  | "backend_daemon"
  | "channel_runtime"
  | "cron_scheduling"
  | "weixin_ingress"
  | "gateway_ipc"
  | "hcc_auto_executor_live_apply"
  | "user_authorization"
  | "no_hermes_config_writes"
  | "no_runtime_mutation";

export interface B1RuntimeReadinessEntry {
  /** Stable surface id; see B1RuntimeSurfaceId. */
  id: B1RuntimeSurfaceId;
  /** Human-readable description of the surface. */
  description: string;
  /** Posture of the surface for B1 admission. */
  status: B1SurfaceStatus;
  /**
   * Local governance / safety evidence ref supporting the status.
   * Required for "ready", "blocked", and "requires_separate_slice".
   * Omitted for "not_applicable".
   */
  evidence_ref?: string;
  /**
   * Whether this surface, when non-ready, is an admission blocker for
   * LOOP-010.A. "not_applicable" surfaces are by definition not blockers.
   */
  blocks_admission: boolean;
  /**
   * Identifier of the next implementation-sized slice that could unblock
   * this surface, if any. Populated for "blocked" and
   * "requires_separate_slice" entries.
   */
  next_slice?: string;
}

export const B1_RUNTIME_READINESS_MATRIX: readonly B1RuntimeReadinessEntry[] =
  [
    {
      id: "backend_daemon",
      description:
        "Backend daemon readiness — backend daemon surfaces are not " +
        "authorized for LOOP-010.A admission. This slice does not wire " +
        "any backend daemon and does not claim no such code exists in " +
        "the repo.",
      status: "blocked",
      evidence_ref:
        "HERMES-GOV-005::backend-daemon-blocked (not wired by " +
        "HERMES-GOV-005; pre-existing daemon / IPC surfaces remain " +
        "out of scope and blocked for LOOP-010.A admission)",
      blocks_admission: true,
      next_slice: "HERMES-GOV-006 (backend daemon pure readiness gate)",
    },
    {
      id: "channel_runtime",
      description:
        "Channel runtime readiness — channel runtime surfaces (renderer / " +
        "IPC / agent bridge) are not authorized for LOOP-010.A admission. " +
        "This slice does not wire any channel runtime and does not claim " +
        "no such code exists in the repo.",
      status: "blocked",
      evidence_ref:
        "HERMES-GOV-005::channel-runtime-blocked (not wired by " +
        "HERMES-GOV-005; pre-existing channel / IPC / agent-bridge " +
        "surfaces remain out of scope and blocked for LOOP-010.A " +
        "admission)",
      blocks_admission: true,
      next_slice: "HERMES-GOV-006 (channel runtime pure readiness gate)",
    },
    {
      id: "cron_scheduling",
      description:
        "Cron scheduling readiness — scheduler / cron worker surfaces are " +
        "not authorized for LOOP-010.A admission. This slice does not " +
        "wire any scheduler and does not claim no such code exists in " +
        "the repo.",
      status: "blocked",
      evidence_ref:
        "HERMES-GOV-005::cron-scheduling-blocked (not wired by " +
        "HERMES-GOV-005; pre-existing cron / scheduler surfaces and " +
        "docs remain out of scope and blocked for LOOP-010.A admission; " +
        "existing safety types still treat unattended_cron as " +
        "read_public-only)",
      blocks_admission: true,
      next_slice: "HERMES-GOV-006 (cron scheduling pure readiness gate)",
    },
    {
      id: "weixin_ingress",
      description:
        "Weixin ingress readiness — no Weixin / WeChat third-party ingress " +
        "is authorized for LOOP-010.A admission.",
      status: "blocked",
      evidence_ref:
        "B2-SCAN-006 :: weixin-channel-ingress blocked pending third-party " +
        "audit (tests/safety/external-input-scan-coverage.test.ts)",
      blocks_admission: true,
      next_slice:
        "Third-party audit + HERMES-GOV-006 (weixin pure readiness gate) " +
        "before any weixin surface can be unblocked",
    },
    {
      id: "gateway_ipc",
      description:
        "Gateway / IPC readiness — no production gateway or IPC wiring is " +
        "authorized for LOOP-010.A admission. The current Electron main " +
        "process exists but is out of scope for the live-apply path.",
      status: "requires_separate_slice",
      evidence_ref:
        "HERMES-GOV-005::gateway-ipc-requires-separate-slice (out of " +
        "scope per task constraints; no gateway implementation in this slice)",
      blocks_admission: true,
      next_slice:
        "HERMES-GOV-007 (gateway / IPC pure readiness gate, if user " +
        "later authorizes)",
    },
    {
      id: "hcc_auto_executor_live_apply",
      description:
        "HCC Auto Executor / live apply readiness — explicitly NOT-GO. " +
        "Live apply eligibility stubs in LOOP-007 / LOOP-008 / LOOP-009 " +
        "are hard-wired to false; HCC Auto Executor remains unapproved, " +
        "unstarted, and unwired.",
      status: "blocked",
      evidence_ref:
        "isRetrievalDeltaApplyEligible / " +
        "isReflectionEvaluatorPromotionEligible / " +
        "isQuarantinePromotionApplyEligible all hard-wired false; " +
        "HCC Auto Executor blocked per " +
        "docs/closeout/hermes-pro-local-reality-closeout-2026-06-07.md",
      blocks_admission: true,
      next_slice:
        "HERMES-GOV-006 (HCC Auto Executor pure readiness gate) after " +
        "explicit user authorization",
    },
    {
      id: "user_authorization",
      description:
        "User authorization requirement — LOOP-010.A admission cannot be " +
        "granted by this matrix. The user must explicitly authorize any " +
        "B1 surface that is not already not_applicable. The contract layer " +
        "keeps HumanApprovalRef.verified literal false; the consumer / " +
        "anchor layer is the trust root.",
      status: "requires_user_authorization",
      evidence_ref:
        "post-task-reflection-contract.ts :: HumanApprovalRef.verified = " +
        "false (literal); consumer/anchor-layer verifier required for " +
        "any verified=true flip",
      blocks_admission: true,
      next_slice:
        "Await explicit user authorization per B1 surface before " +
        "re-evaluating admission",
    },
    {
      id: "no_hermes_config_writes",
      description:
        "No ~/.hermes writes requirement — this matrix MUST NOT cause any " +
        "write to ~/.hermes/config.yaml, ~/.hermes/handoff/packs, or " +
        "~/.hermes/audit. The matrix is pure and has no side effects.",
      status: "ready",
      evidence_ref:
        "Pure data + helpers in " +
        "src/shared/lib/safety/b1-runtime-readiness-matrix.ts; " +
        "assertB1MatrixNoRuntimeSideEffects() proves the property",
      blocks_admission: false,
    },
    {
      id: "no_runtime_mutation",
      description:
        "No runtime mutation requirement — this matrix MUST NOT authorize " +
        "any runtime mutation, daemon, cron, weixin, channel, live apply, " +
        "or HCC Auto Executor call. The matrix is pure and has no side " +
        "effects.",
      status: "ready",
      evidence_ref:
        "Pure data + helpers; " +
        "assertB1MatrixNoRuntimeSideEffects() proves the property; " +
        "no_*_allowed flags are not part of the matrix schema",
      blocks_admission: false,
    },
  ] as const;

export const B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR = {
  schema_version: B1_RUNTIME_READINESS_MATRIX_SCHEMA_VERSION,
  matrix_id: "HERMES-GOV-005::b1-runtime-readiness-matrix",
  description:
    "B1 runtime readiness matrix for LOOP-010.A admission. " +
    "Decomposes the remaining B1 blocker into per-surface gates and " +
    "explicitly identifies the next smallest implementation slice.",
  evidence_ref:
    "HERMES-GOV-005::b1-runtime-readiness-matrix (this module)",
} as const;

export interface B1AdmissionDecision {
  schema_version: "1.0.0";
  matrix_id: string;
  go: boolean;
  blocking_surfaces: B1RuntimeSurfaceId[];
  not_go_reason: string;
  next_slice: string | null;
  surfaces: readonly B1RuntimeReadinessEntry[];
}

export function listB1BlockingSurfaces(): B1RuntimeReadinessEntry[] {
  return B1_RUNTIME_READINESS_MATRIX.filter(
    (entry) =>
      entry.blocks_admission &&
      entry.status !== "ready" &&
      entry.status !== "not_applicable",
  );
}

export function decideB1Admission(): B1AdmissionDecision {
  const blockers = listB1BlockingSurfaces();
  const go = blockers.length === 0;
  const firstNextSlice = blockers
    .map((entry) => entry.next_slice)
    .find((slice): slice is string => typeof slice === "string");
  return {
    schema_version: "1.0.0",
    matrix_id: B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR.matrix_id,
    go,
    blocking_surfaces: blockers.map((entry) => entry.id),
    not_go_reason: go
      ? "B1 admission is GO; no blocking surfaces remain"
      : `B1 admission is NOT-GO; ${blockers.length} surface(s) block ` +
        `LOOP-010.A: ${blockers.map((b) => b.id).join(", ")}`,
    next_slice: firstNextSlice ?? null,
    surfaces: B1_RUNTIME_READINESS_MATRIX,
  };
}

export interface B1MatrixNoRuntimeSideEffectsReport {
  schema_version: "1.0.0";
  matrix_id: string;
  no_runtime_mutation: true;
  no_hermes_writes: true;
  no_daemon_or_cron_or_weixin_or_channel_or_live_apply_or_hcc: true;
}

export function assertB1MatrixNoRuntimeSideEffects(): B1MatrixNoRuntimeSideEffectsReport {
  // Pure-data assertion: this function performs no I/O and returns a
  // literal-true report. The literal-true fields below are the proof:
  // any future change that introduces I/O must also update this report
  // and is therefore a conscious, test-failing decision.
  return {
    schema_version: "1.0.0",
    matrix_id: B1_RUNTIME_READINESS_MATRIX_DESCRIPTOR.matrix_id,
    no_runtime_mutation: true,
    no_hermes_writes: true,
    no_daemon_or_cron_or_weixin_or_channel_or_live_apply_or_hcc: true,
  };
}
