// HCC Shared Invocation Service.
//
// Shared facade for the user-explicit local invoker. This service
// is the single canonical entrypoint future Terminal Hermes
// agent and Hermes Pro app callers will share. It does NOT
// itself add product entrypoints: there is no CLI, no IPC, no
// renderer, no preload, no app boot, no timer, no cron, no
// auto-arm path wired here. Future slices will adapt the
// service to specific callers.
//
// Per HCC governance (origin `7179eee`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO at the executor level
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//
// The service consumes the same `HCCUserExplicitInvocationFixture`
// + `explicit_user_trigger_token` + injected `dispatch_adapter`
// protocol as the local invoker, and re-uses the same input /
// result schema. There is no fallback, no default execution,
// and no implicit caller. The service is a thin wrapper; the
// authoritative contract remains the final dispatch
// (composed of the 4 prior contracts) reached via the local
// invoker.

import {
  checkUserExplicitFixture,
  invokeUserExplicitControlledRealDispatch,
  type HCCUserExplicitInvocationFixture,
} from "./hcc-user-explicit-local-invoker";
import type { HCCFinalControlledRealDispatchResult } from "./hcc-final-controlled-real-dispatch";

export const HCC_SHARED_INVOCATION_SERVICE_SCHEMA_VERSION =
  "1.0.0" as const;

/**
 * Re-export the canonical fixture type so future product
 * callers (Terminal Hermes agent, Hermes Pro app) import
 * everything from one place. The shape MUST stay identical
 * to the local invoker's fixture; this slice does not extend
 * or alter it.
 */
export type HCCSharedInvocationFixture = HCCUserExplicitInvocationFixture;

/**
 * Re-export the canonical result type. Future product
 * callers receive this exact shape so the schema stays
 * stable across the terminal / app boundary.
 */
export type HCCSharedInvocationResult =
  HCCFinalControlledRealDispatchResult;

/**
 * Re-export the sync guard so callers can pre-validate a
 * fixture before they go async.
 */
export const checkSharedInvocationFixture = checkUserExplicitFixture;

/**
 * The single canonical shared entrypoint. Async. Delegates to
 * the local invoker after re-running the guard. The guard is
 * idempotent and side-effect free; re-running it here means a
 * caller who imports the guard separately and the caller who
 * calls this entrypoint get the same behavior either way.
 *
 * The entrypoint is the ONLY way to reach the final dispatch
 * from outside the lib. There is no other path.
 */
export async function invokeSharedControlledRealDispatch(
  fixture: HCCSharedInvocationFixture,
): Promise<HCCSharedInvocationResult> {
  return await invokeUserExplicitControlledRealDispatch(fixture);
}

/**
 * Service-level metadata. Pure projection. Returns a frozen
 * snapshot of the service version and protocol identifier so
 * future product adapters can cross-check the version they
 * are wired against.
 */
export function getSharedInvocationServiceMetadata(): {
  schema_version: typeof HCC_SHARED_INVOCATION_SERVICE_SCHEMA_VERSION;
  service: "hcc-shared-invocation-service";
  protocol: "user-explicit-fixture";
  fallback: false;
  default_execution: false;
  implicit_caller: false;
} {
  return {
    schema_version: HCC_SHARED_INVOCATION_SERVICE_SCHEMA_VERSION,
    service: "hcc-shared-invocation-service",
    protocol: "user-explicit-fixture",
    fallback: false,
    default_execution: false,
    implicit_caller: false,
  };
}
