// HCC Controlled Dry-Run Call Surface.
//
// Library/internal call surface for Hermes Pro plan execution.
// Invokes runControlledDryRunEntrypoint(gateInput) and returns the
// dry-run artifact. The call surface is pure: nothing in this module
// starts the Auto Executor, executes any command, spawns any
// subprocess, writes to `~/.hermes/**`, registers IPC, or starts a
// timer.
//
// This module is a *library*, not a hook. `src/main/index.ts` does NOT
// import this module. The trigger surface is held for a future slice.
//
// Per HCC governance (origin `ccfcf72`):
//   - real execution / unattended execution / `~/.hermes/**` writes
//     remain NOT APPROVED / NO-GO
//   - `night_run_ready` is a type-level `false` literal
//   - `go_no_go` is a type-level `"NO-GO"` literal
//   - Auto Executor must NOT self-arm or self-start

import {
  runControlledDryRunEntrypoint,
  makeGoCandidateGateInput,
  makeNoGoGateInput,
  type DryRunArtifact,
} from "./hcc-controlled-dry-run-entrypoint";
import type { HCCUnattendedGoNoGoInput } from "./hcc-unattended-go-no-go";

export const HCC_CALL_SURFACE_SCHEMA_VERSION = "1.0.0" as const;

// -----------------------------------------------------------------
// Call surface input
// -----------------------------------------------------------------

export type DryRunCallMode =
  | "explicit_user_authorized_go_candidate"
  | "explicit_no_go"
  | "default_no_go";

export interface DryRunCallInput {
  /** Which mode to apply. Determines the gate input. */
  mode: DryRunCallMode;
  /**
   * Optional override of the gate input. When provided, takes
   * precedence over `mode`. The override is the only path to inject
   * arbitrary gate state; the call surface does NOT auto-arm.
   */
  gate_input_override?: HCCUnattendedGoNoGoInput;
  /**
   * Optional plan-execution context. The call surface carries it
   * forward into the artifact metadata without interpreting it.
   */
  plan_execution_id?: string;
  /**
   * Optional explicit user authorization record. When set, it
   * OVERRIDES the gate input's
   * `explicit_user_authorization_recorded` field. Use only for
   * explicit user actions; not auto-triggered.
   */
  explicit_user_authorization_record?: {
    authorized: boolean;
    user_id?: string;
    authorization_token?: string;
  };
}

export interface DryRunCallResult {
  schema_version: "1.0.0";
  /** The mode used to derive the gate input. */
  mode: DryRunCallMode;
  /** The artifact produced by the entrypoint. */
  artifact: DryRunArtifact;
  /** Surface-level literal-false execution fields. */
  would_execute: false;
  executed_commands: readonly [];
  subprocess_count: 0;
  auto_executor_started: false;
  any_command_executed: false;
  real_execution_ready: false;
  unattended_ready: false;
  go_no_go: "NO-GO";
  /** Generated at. */
  generated_at: string;
}

// -----------------------------------------------------------------
// Gate input resolution
// -----------------------------------------------------------------

function resolveGateInput(input: DryRunCallInput): HCCUnattendedGoNoGoInput {
  if (input.gate_input_override) {
    return applyAuthOverride(input.gate_input_override, input.explicit_user_authorization_record);
  }
  switch (input.mode) {
    case "explicit_user_authorized_go_candidate": {
      // Per HCC governance: this mode REQUIRES an explicit
      // `explicit_user_authorization_record` with `authorized: true`.
      // The mode name is descriptive; the actual authorization must
      // be recorded, not inferred from the mode string.
      if (!input.explicit_user_authorization_record || input.explicit_user_authorization_record.authorized !== true) {
        // Downgrade to NO-GO when no explicit record is present.
        return makeNoGoGateInput();
      }
      const base = makeGoCandidateGateInput();
      return applyAuthOverride(base, input.explicit_user_authorization_record);
    }
    case "explicit_no_go": {
      return makeNoGoGateInput();
    }
    case "default_no_go": {
      return makeNoGoGateInput();
    }
  }
}

function applyAuthOverride(
  base: HCCUnattendedGoNoGoInput,
  auth?: DryRunCallInput["explicit_user_authorization_record"],
): HCCUnattendedGoNoGoInput {
  if (!auth) return base;
  return {
    ...base,
    explicit_user_authorization_recorded: auth.authorized,
  };
}

// -----------------------------------------------------------------
// Call surface
// -----------------------------------------------------------------

/**
 * Invoke the controlled dry-run entrypoint and return the artifact.
 *
 * The call surface is pure: it does NOT start the Auto Executor,
 * execute any command, write to `~/.hermes/**`, register IPC, or
 * start a timer. The artifact's literal-false fields are preserved.
 */
export function callControlledDryRun(input: DryRunCallInput): DryRunCallResult {
  const gateInput = resolveGateInput(input);
  const artifact = runControlledDryRunEntrypoint(gateInput);

  return {
    schema_version: "1.0.0",
    mode: input.mode,
    artifact,
    would_execute: false,
    executed_commands: [],
    subprocess_count: 0,
    auto_executor_started: false,
    any_command_executed: false,
    real_execution_ready: false,
    unattended_ready: false,
    go_no_go: "NO-GO",
    generated_at: new Date().toISOString(),
  };
}