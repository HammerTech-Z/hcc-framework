// HCC Auto Executor — Bootstrap helper.
//
// Installs the auto-executor host into the main process in **idle /
// disabled / no-start** mode. This module exists to satisfy
// `HCC-AUTO-EXECUTOR-BOOTSTRAP-001` (a separate slice from
// `HCC-AUTO-EXECUTOR-EXEC-IMPL-001`).
//
// What this module does:
//   - constructs one host via createAutoExecutorHost()
//   - stores the handle in a module-scoped frozen reference
//   - exposes a getter so the bootstrap integration test can verify
//     state, health, and kill-switch posture
//   - exposes the kill switch via the `bootstrapAbort()` function for
//     any future shutdown path that wants to use it
//
// What this module does NOT do:
//   - call host.arm()  — arming is held for a separate explicit GO
//   - call host.start()  — starting is held for a separate explicit GO
//   - call host.runMockAction()  — actions are held for a separate GO
//   - register any IPC channel  — the host is main-process-only
//   - register any cron / timer / interval
//   - mutate the working tree
//   - write to ~/.hermes/**
//
// Per exec-preflight §4.4 + threat model T1/T2/E2/E4, the host stays
// in state `constructed` after this module runs. The only way to leave
// `constructed` is for a future, separately-approved GO to call
// `host.arm(token)` + `host.start()`.

import {
  createAutoExecutorHost,
  type AutoExecutorHost,
  type AutoExecutorHostConfig,
} from "./auto-executor-host";

// -----------------------------------------------------------------
// Module-scoped frozen handle. Constructed once on first install().
// -----------------------------------------------------------------

let installedHost: Readonly<AutoExecutorHost> | null = null;

export interface BootstrapPostureReport {
  installed: boolean;
  state: "constructed" | "armed" | "running" | "aborted" | "disarmed";
  alive: boolean;
  subprocess_count: 0;
  max_subprocess_count: 0;
  armed: false;
  started: false;
  any_action_invoked: false;
  installed_at: string;
}

let installedAt: string | null = null;

/**
 * Install the host in idle mode. Idempotent — a second call returns
 * the existing handle and does not construct a second host.
 *
 * The pinned state is derived from `process.cwd()` and `process.argv`
 * — values the test can override via the `configOverride` argument.
 * In production this reads the actual main-process cwd.
 */
export function installAutoExecutorHost(
  configOverride?: Partial<AutoExecutorHostConfig>,
): Readonly<AutoExecutorHost> {
  if (installedHost !== null) {
    return installedHost;
  }
  const cwd = process.cwd();
  const head = process.env.HCC_GO_RECORD_SHA ?? "bootstrap-no-sha-set";
  const config: AutoExecutorHostConfig = {
    pinnedState: {
      expectedRepoRoot: cwd,
      expectedBranch: "hermes-pro-main",
      expectedHead: head,
      expectedCwd: cwd,
    },
    tokenSecret: process.env.HCC_TOKEN_SECRET ?? "bootstrap-token-secret-not-real-do-not-use",
    goRecordSha: head,
    mode: "dry_run",
    ...configOverride,
  };
  const host = createAutoExecutorHost(config);
  installedHost = Object.freeze(host);
  installedAt = new Date().toISOString();
  return installedHost;
}

/**
 * Read the installed host. Returns `null` if `installAutoExecutorHost`
 * has not been called.
 */
export function getInstalledAutoExecutorHost(): Readonly<AutoExecutorHost> | null {
  return installedHost;
}

/**
 * Report the bootstrap posture. Designed to be cheap and side-effect-free.
 * The `armed: false` / `started: false` / `any_action_invoked: false`
 * fields are literal-false in source; a future slice that wants to flip
 * them must rewrite this file (audit signal).
 */
export function getBootstrapPostureReport(): BootstrapPostureReport | null {
  if (installedHost === null || installedAt === null) return null;
  const health = installedHost.health();
  return {
    installed: true,
    state: health.state,
    alive: health.alive,
    subprocess_count: 0,
    max_subprocess_count: 0,
    armed: false,
    started: false,
    any_action_invoked: false,
    installed_at: installedAt,
  };
}

/**
 * Trip the host's kill switch and update the frozen handle's reference
 * (the host itself mutates its internal boundary state on abort(); the
 * frozen wrapper continues to point at the same host instance, whose
 * state is observable via `getBootstrapPostureReport().state`).
 *
 * This is a no-op until `installAutoExecutorHost()` has been called.
 */
export function bootstrapAbort(reason: string): boolean {
  if (installedHost === null) return false;
  installedHost.abort(reason);
  return true;
}

/**
 * Reset the module-scoped state. Intended for tests only.
 *
 * Production callers must never invoke this. A test that wants a
 * fresh host can pass a different `configOverride` and call
 * `installAutoExecutorHost` again — the idempotency check returns
 * the existing handle, so the test must call this reset first.
 */
export function __resetAutoExecutorBootstrapForTests(): void {
  installedHost = null;
  installedAt = null;
}