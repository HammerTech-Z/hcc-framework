// P2.5 Safety Foundation — Builder / Verifier Boundary
// Pure shared types + validation functions; no IPC, no file I/O, no Node.js crypto.

// -----------------------------------------------------------------
// Schema
// -----------------------------------------------------------------

/**
 * BuilderMetadata captures only the factual output of a builder agent.
 * It intentionally excludes reasoning, chain-of-thought, or raw chat.
 */
export interface BuilderMetadata {
  builderId: string;
  /** e.g. "anthropic/claude-sonnet-4" — optional because some builders are unnamed */
  modelId?: string;
  startedAt?: string;   // ISO 8601
  finishedAt?: string; // ISO 8601
  outputArtifactRef?: string;
}

/** Fields a builder is allowed to share with an independent verifier. */
export interface VerifierInput {
  taskId: string;
  handoffPackRef: string;
  diffRef: string;
  /** Shell commands or API calls the verifier should run to confirm correctness */
  verificationCommands: string[];
  /** Human-readable criteria that must all be true for the task to be accepted */
  acceptanceCriteria: string[];
  /** Absolute paths of files changed by the builder */
  changedFiles: string[];
  /** Paths or URIs of produced artifacts (reports, binaries, etc.) */
  artifactRefs: string[];
  builderMetadata: BuilderMetadata;
  /**
   * When a verifier runs in the same agent context as the builder,
   * the isolation level must be declared so reviewers can judge independence.
   * Default: "independent" (recommended).
   */
  isolationLevel?: 'independent' | 'fresh_context' | 'same_agent_same_context';
  /**
   * Optional verifier annotation — set by the verifier only, not the builder.
   * Verifier records how they actually performed verification
   * (e.g. "ran verificationCommands in fresh shell, inspected diffRef manually").
   */
  verifierNotes?: string;
}

/** The boundary rule: what a BuilderVerifierBoundary expresses about a task */
export interface BuilderVerifierBoundary {
  taskId: string;
  /**
   * "allow"  — builder ≠ verifier and isolation is acceptable
   * "deny"   — builder === verifier (same-agent same-context is not independent verification)
   * "warn"   — isolationLevel is "fresh_context" (reviewer should double-check)
   */
  verdict: 'allow' | 'deny' | 'warn';
  reason: string;
}

// -----------------------------------------------------------------
// Forbidden fields
// These fields may NOT appear in VerifierInput (builder may not share them).
// They leak builder reasoning and break the independence guarantee.
// -----------------------------------------------------------------

export const FORBIDDEN_FIELDS = [
  'reasoning',
  'chain_of_thought',
  'raw_prompt',
  'raw_messages',
  'chat_transcript',
  'internal_thought',
  ' scratch_pad',
  'working_memory',
] as const;

export type ForbiddenField = (typeof FORBIDDEN_FIELDS)[number];

function containsForbiddenField(obj: unknown, path: string[] = []): ForbiddenField | null {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') return null;

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const found = containsForbiddenField(obj[i], [...path, String(i)]);
      if (found) return found;
    }
    return null;
  }

  if (typeof obj === 'object') {
    for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
      if (FORBIDDEN_FIELDS.includes(key as ForbiddenField)) {
        return key as ForbiddenField;
      }
      const found = containsForbiddenField(val, [...path, key]);
      if (found) return found;
    }
    return null;
  }

  return null;
}

// -----------------------------------------------------------------
// buildVerifierInput
// Constructs VerifierInput from a task result, stripping forbidden fields.
// -----------------------------------------------------------------

export interface TaskResult {
  taskId: string;
  handoffPackRef: string;
  diffRef: string;
  verificationCommands: string[];
  acceptanceCriteria: string[];
  changedFiles: string[];
  artifactRefs: string[];
  builderMetadata: BuilderMetadata;
  [key: string]: unknown; // allows extra fields that will be filtered
}

export function buildVerifierInput(result: TaskResult): VerifierInput {
  const forbidden = containsForbiddenField(result);
  if (forbidden) {
    throw new Error(
      `buildVerifierInput: task result contains forbidden field "${forbidden}" — ` +
      `reasoning/chain_of_thought/raw_messages may not be shared with verifier`
    );
  }

  const {
    taskId, handoffPackRef, diffRef, verificationCommands,
    acceptanceCriteria, changedFiles, artifactRefs, builderMetadata,
  } = result;

  return {
    taskId,
    handoffPackRef,
    diffRef,
    verificationCommands,
    acceptanceCriteria,
    changedFiles,
    artifactRefs,
    builderMetadata,
  };
}

// -----------------------------------------------------------------
// validateVerifierInput
// Checks VerifierInput for required fields and absence of forbidden content.
// -----------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateVerifierInput(input: VerifierInput): ValidationResult {
  const errors: string[] = [];

  // Required scalar fields
  if (!input.taskId) errors.push('taskId is required');
  if (!input.handoffPackRef) errors.push('handoffPackRef is required');
  if (!input.diffRef) errors.push('diffRef is required');

  // Required non-empty arrays
  if (!Array.isArray(input.verificationCommands) || input.verificationCommands.length === 0) {
    errors.push('verificationCommands must be a non-empty array');
  }
  if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length === 0) {
    errors.push('acceptanceCriteria must be a non-empty array');
  }
  if (!Array.isArray(input.changedFiles) || input.changedFiles.length === 0) {
    errors.push('changedFiles must be a non-empty array');
  }

  // No forbidden fields anywhere (including nested in builderMetadata)
  const forbidden = containsForbiddenField(input);
  if (forbidden) {
    errors.push(`forbidden field "${forbidden}" must not appear in verifier input`);
  }

  // BuilderMetadata required fields
  if (!input.builderMetadata) {
    errors.push('builderMetadata is required');
  } else {
    if (!input.builderMetadata.builderId) {
      errors.push('builderMetadata.builderId is required');
    }
  }

  return { valid: errors.length === 0, errors };
}

// -----------------------------------------------------------------
// shouldRequireIndependentVerifier
// Enforces the core separation rule: builder must not verify their own work.
// -----------------------------------------------------------------

export interface VerifierCheckOptions {
  verifierId: string;
  /**
   * If true, the caller is asserting that verification happened in a
   * fresh context (new conversation / new agent instance).  This is
   * the only configuration where same-agent verification is permissible.
   * Default: false.
   */
  freshContext?: boolean;
}

export function shouldRequireIndependentVerifier(
  input: VerifierInput,
  opts: VerifierCheckOptions
): BuilderVerifierBoundary {
  const { verifierId, freshContext = false } = opts;

  // Same agent, same context → not independent verification
  if (input.isolationLevel === 'same_agent_same_context') {
    return {
      taskId: input.taskId,
      verdict: 'deny',
      reason: 'same_agent_same_context provides no independent verification — builder cannot verify their own output',
    };
  }

  // builderId === verifierId always fails unless isolationLevel is fresh_context
  if (input.builderMetadata.builderId === verifierId) {
    if (freshContext || input.isolationLevel === 'fresh_context') {
      return {
        taskId: input.taskId,
        verdict: 'warn',
        reason: 'verifierId matches builderId but isolationLevel=fresh_context — independence depends on true context isolation',
      };
    }
    return {
      taskId: input.taskId,
      verdict: 'deny',
      reason: `verifierId "${verifierId}" matches builderId "${input.builderMetadata.builderId}" — independent verification required`,
    };
  }

  // Default: independent
  return {
    taskId: input.taskId,
    verdict: 'allow',
    reason: 'builder and verifier are different identities with acceptable isolation',
  };
}