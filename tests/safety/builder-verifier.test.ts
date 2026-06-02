// P2.5 Safety Foundation — Builder/Verifier Boundary tests

import { describe, it, expect } from 'vitest';
import {
  buildVerifierInput,
  validateVerifierInput,
  shouldRequireIndependentVerifier,
  FORBIDDEN_FIELDS,
} from '../../src/shared/lib/safety/builder-verifier';

// -----------------------------------------------------------------
// Shared fixtures
// -----------------------------------------------------------------

const VALID_TASK_RESULT = {
  taskId: 'task-001',
  handoffPackRef: '/handoff/packs/HANDOFF-P0.5-20260531-001.json',
  diffRef: '/diff/state/diff-20260531-001.json',
  verificationCommands: ['npx vitest run tests/safety', 'npm run typecheck'],
  acceptanceCriteria: ['tests pass', 'typecheck passes', 'no forbidden fields in verifier input'],
  changedFiles: [
    'src/shared/lib/safety/redaction-scanner.ts',
    'tests/safety/redaction-scanner.test.ts',
  ],
  artifactRefs: ['/tmp/p2-coverage-report.json'],
  builderMetadata: {
    builderId: 'claude-code-executor-01',
    modelId: 'anthropic/claude-sonnet-4',
    startedAt: '2026-05-31T12:00:00Z',
    finishedAt: '2026-05-31T12:05:00Z',
    outputArtifactRef: '/tmp/p2-coverage-report.json',
  },
};

const VALID_VERIFIER_INPUT = {
  taskId: 'task-001',
  handoffPackRef: '/handoff/packs/HANDOFF-P0.5-20260531-001.json',
  diffRef: '/diff/state/diff-20260531-001.json',
  verificationCommands: ['npx vitest run tests/safety'],
  acceptanceCriteria: ['tests pass', 'typecheck passes'],
  changedFiles: ['src/shared/lib/safety/builder-verifier.ts'],
  artifactRefs: [],
  builderMetadata: { builderId: 'claude-code-executor-01' },
};

// -----------------------------------------------------------------
// Tests: buildVerifierInput
// -----------------------------------------------------------------

describe('buildVerifierInput', () => {
  it('accepts valid task result and returns VerifierInput', () => {
    const input = buildVerifierInput(VALID_TASK_RESULT);
    expect(input.taskId).toBe('task-001');
    expect(input.handoffPackRef).toBe('/handoff/packs/HANDOFF-P0.5-20260531-001.json');
    expect(input.verificationCommands).toEqual(['npx vitest run tests/safety', 'npm run typecheck']);
    expect(input.builderMetadata.builderId).toBe('claude-code-executor-01');
  });

  it('rejects task result containing forbidden field "reasoning"', () => {
    const result = { ...VALID_TASK_RESULT, reasoning: 'I chose to implement X because...' };
    expect(() => buildVerifierInput(result)).toThrow('forbidden field "reasoning"');
  });

  it('rejects task result containing forbidden field "chain_of_thought"', () => {
    const result = { ...VALID_TASK_RESULT, chain_of_thought: ['step 1', 'step 2'] };
    expect(() => buildVerifierInput(result)).toThrow('forbidden field "chain_of_thought"');
  });

  it('rejects task result containing forbidden field "raw_messages"', () => {
    const result = { ...VALID_TASK_RESULT, raw_messages: [{ role: 'user', content: 'hello' }] };
    expect(() => buildVerifierInput(result)).toThrow('forbidden field "raw_messages"');
  });

  it('rejects task result containing forbidden field "chat_transcript"', () => {
    const result = { ...VALID_TASK_RESULT, chat_transcript: 'full transcript here' };
    expect(() => buildVerifierInput(result)).toThrow('forbidden field "chat_transcript"');
  });

  it('rejects forbidden field nested inside builderMetadata', () => {
    const result = {
      ...VALID_TASK_RESULT,
      builderMetadata: {
        ...VALID_TASK_RESULT.builderMetadata,
        internal_thought: 'secret reasoning',
      },
    };
    expect(() => buildVerifierInput(result)).toThrow('forbidden field "internal_thought"');
  });

  it('rejects forbidden field nested inside an array', () => {
    const result = {
      ...VALID_TASK_RESULT,
      extraArtifacts: [{ chain_of_thought: 'nested in array' }],
    };
    expect(() => buildVerifierInput(result)).toThrow('forbidden field "chain_of_thought"');
  });

  it('strips unknown extra fields (not forbidden but not in schema)', () => {
    const result = {
      ...VALID_TASK_RESULT,
      extraField: 'should be dropped',
      score: 0.95,
    };
    const input = buildVerifierInput(result);
    expect((input as unknown as Record<string, unknown>).extraField).toBeUndefined();
    expect((input as unknown as Record<string, unknown>).score).toBeUndefined();
  });
});

// -----------------------------------------------------------------
// Tests: validateVerifierInput
// -----------------------------------------------------------------

describe('validateVerifierInput', () => {
  it('passes valid VerifierInput', () => {
    const result = validateVerifierInput(VALID_VERIFIER_INPUT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when handoffPackRef is missing', () => {
    const input = { ...VALID_VERIFIER_INPUT, handoffPackRef: '' };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('handoffPackRef is required');
  });

  it('fails when diffRef is missing', () => {
    const input = { ...VALID_VERIFIER_INPUT, diffRef: '' };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('diffRef is required');
  });

  it('fails when verificationCommands is empty', () => {
    const input = { ...VALID_VERIFIER_INPUT, verificationCommands: [] };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('verificationCommands must be a non-empty array');
  });

  it('fails when acceptanceCriteria is empty', () => {
    const input = { ...VALID_VERIFIER_INPUT, acceptanceCriteria: [] };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('acceptanceCriteria must be a non-empty array');
  });

  it('fails when changedFiles is empty', () => {
    const input = { ...VALID_VERIFIER_INPUT, changedFiles: [] };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('changedFiles must be a non-empty array');
  });

  it('fails when builderMetadata.builderId is missing', () => {
    const input = {
      ...VALID_VERIFIER_INPUT,
      builderMetadata: { builderId: '' },
    };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('builderMetadata.builderId is required');
  });

  it('fails when input contains forbidden field "reasoning"', () => {
    const input = { ...VALID_VERIFIER_INPUT, reasoning: 'thought process' };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden field'))).toBe(true);
  });

  it('fails when input contains forbidden field "chain_of_thought"', () => {
    const input = { ...VALID_VERIFIER_INPUT, chain_of_thought: [] };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden field'))).toBe(true);
  });

  it('fails when input contains forbidden field "raw_messages"', () => {
    const input = { ...VALID_VERIFIER_INPUT, raw_messages: [] };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden field'))).toBe(true);
  });

  it('fails when input contains forbidden field "chat_transcript"', () => {
    const input = { ...VALID_VERIFIER_INPUT, chat_transcript: 'transcript' };
    const result = validateVerifierInput(input);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('forbidden field'))).toBe(true);
  });
});

// -----------------------------------------------------------------
// Tests: shouldRequireIndependentVerifier
// -----------------------------------------------------------------

describe('shouldRequireIndependentVerifier', () => {
  it('returns allow when builderId !== verifierId', () => {
    const boundary = shouldRequireIndependentVerifier(VALID_VERIFIER_INPUT, {
      verifierId: 'hermes-reviewer-01',
    });
    expect(boundary.verdict).toBe('allow');
  });

  it('returns deny when builderId === verifierId with no isolation', () => {
    const boundary = shouldRequireIndependentVerifier(VALID_VERIFIER_INPUT, {
      verifierId: 'claude-code-executor-01',
    });
    expect(boundary.verdict).toBe('deny');
    expect(boundary.reason).toContain('matches builderId');
  });

  it('returns deny when isolationLevel is same_agent_same_context', () => {
    const input = { ...VALID_VERIFIER_INPUT, isolationLevel: 'same_agent_same_context' as const };
    const boundary = shouldRequireIndependentVerifier(input, {
      verifierId: 'any-verifier',
    });
    expect(boundary.verdict).toBe('deny');
    expect(boundary.reason).toContain('same_agent_same_context');
  });

  it('returns warn when builderId === verifierId but isolationLevel is fresh_context', () => {
    const input = { ...VALID_VERIFIER_INPUT, isolationLevel: 'fresh_context' as const };
    const boundary = shouldRequireIndependentVerifier(input, {
      verifierId: 'claude-code-executor-01',
      freshContext: true,
    });
    expect(boundary.verdict).toBe('warn');
    expect(boundary.reason).toContain('fresh_context');
  });

  it('returns warn when builderId === verifierId and freshContext=true but no isolationLevel', () => {
    const boundary = shouldRequireIndependentVerifier(VALID_VERIFIER_INPUT, {
      verifierId: 'claude-code-executor-01',
      freshContext: true,
    });
    expect(boundary.verdict).toBe('warn');
  });

  it('returns allow for independent with fresh_context isolationLevel', () => {
    const input = { ...VALID_VERIFIER_INPUT, isolationLevel: 'fresh_context' as const };
    const boundary = shouldRequireIndependentVerifier(input, {
      verifierId: 'hermes-reviewer-01',
    });
    expect(boundary.verdict).toBe('allow');
  });
});

// -----------------------------------------------------------------
// Tests: shared module purity (no Node-only imports)
// -----------------------------------------------------------------

describe('shared module purity', () => {
  it('FORBIDDEN_FIELDS is a non-empty array', () => {
    expect(Array.isArray(FORBIDDEN_FIELDS)).toBe(true);
    expect(FORBIDDEN_FIELDS.length).toBeGreaterThan(0);
  });

  it('FORBIDDEN_FIELDS includes all required fields', () => {
    const required = ['reasoning', 'chain_of_thought', 'raw_prompt', 'raw_messages', 'chat_transcript'];
    for (const field of required) {
      expect(FORBIDDEN_FIELDS).toContain(field);
    }
  });

  it('buildVerifierInput does not throw for a valid result', () => {
    expect(() => buildVerifierInput(VALID_TASK_RESULT)).not.toThrow();
  });

  it('validateVerifierInput is a pure function (no side effects)', () => {
    const copy = JSON.parse(JSON.stringify(VALID_VERIFIER_INPUT));
    validateVerifierInput(copy);
    expect(JSON.stringify(copy)).toBe(JSON.stringify(VALID_VERIFIER_INPUT));
  });
});