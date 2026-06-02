// P3 Domain Profile — shared types and defaults for Quality Loop
// Pure types and pure constants. No IPC, no I/O, no execution.
// Quality Loop and Verifier consume these profiles; HCC only carries them.

export type DomainProfileName =
  | "code"
  | "miniapp"
  | "manga"
  | "hermes-self";

export interface DomainVerifierSpec {
  /** Hard checks must pass. Failing any of these blocks the task. */
  hardChecks: string[];
  /** Soft checks inform the verifier but do not block on their own. */
  softChecks: string[];
  /** Human-readable pass criteria describing what "PASS" means for this profile. */
  passCriteria: string;
}

export interface DomainProfile {
  name: DomainProfileName;
  artifactTypes: string[];
  verifier: DomainVerifierSpec;
  /** Rollback policy statement — describes allowed rollback primitives. */
  rollback: string;
  /** Cost signals the Quality Loop should track (tokens, time, file count, etc.). */
  costSignals: string[];
}

export const DEFAULT_CODE_DOMAIN_PROFILE: DomainProfile = {
  name: "code",
  artifactTypes: ["patch", "diff", "test_report", "typecheck_log"],
  verifier: {
    hardChecks: [
      "typecheck",
      "unit_tests",
      "targeted_tests",
    ],
    softChecks: [
      "lint",
      "code_review",
    ],
    passCriteria:
      "typecheck exits 0 AND all relevant unit/targeted tests pass AND no unsafe action gate bypass recorded in audit log",
  },
  rollback:
    "use rollback point captured before execution OR reverse the patch via git apply -R; never use git reset --hard and never rewrite upstream history",
  costSignals: [
    "tokens",
    "test_runtime",
    "changed_files",
  ],
};

export interface DomainProfileValidationError {
  field: "name" | "hardChecks" | "softChecks" | "passCriteria" | "rollback" | "costSignals" | "artifactTypes";
  reason: string;
}

export interface DomainProfileValidationResult {
  valid: boolean;
  errors: DomainProfileValidationError[];
}

export function validateDomainProfile(
  profile: DomainProfile,
): DomainProfileValidationResult {
  const errors: DomainProfileValidationError[] = [];

  if (!profile.name) {
    errors.push({ field: "name", reason: "name is required" });
  }

  if (!Array.isArray(profile.verifier?.hardChecks) || profile.verifier.hardChecks.length === 0) {
    errors.push({ field: "hardChecks", reason: "verifier.hardChecks must be a non-empty array" });
  }

  if (!Array.isArray(profile.verifier?.softChecks)) {
    errors.push({ field: "softChecks", reason: "verifier.softChecks must be an array" });
  }

  if (typeof profile.verifier?.passCriteria !== "string" || profile.verifier.passCriteria.trim().length === 0) {
    errors.push({ field: "passCriteria", reason: "verifier.passCriteria must be a non-empty string" });
  }

  if (typeof profile.rollback !== "string" || profile.rollback.trim().length === 0) {
    errors.push({ field: "rollback", reason: "rollback must be a non-empty string" });
  }

  if (!Array.isArray(profile.costSignals) || profile.costSignals.length === 0) {
    errors.push({ field: "costSignals", reason: "costSignals must be a non-empty array" });
  }

  if (!Array.isArray(profile.artifactTypes) || profile.artifactTypes.length === 0) {
    errors.push({ field: "artifactTypes", reason: "artifactTypes must be a non-empty array" });
  }

  return { valid: errors.length === 0, errors };
}
