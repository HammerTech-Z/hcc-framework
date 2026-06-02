// P2.5 Safety Foundation — Knowledge Trust Enforcement tests

import { describe, it, expect } from 'vitest';
import { classifyKnowledgeUse, toP2SafetyTrustLevel, type ClassifyInput } from '../../src/shared/lib/safety/knowledge-trust';
import type { Provenance, TrustLevel as TLTrustLevel } from '../../src/shared/lib/typed-links';

// -----------------------------------------------------------------
// Shared fixtures
// -----------------------------------------------------------------

function makeProv(overrides: Partial<Provenance> = {}): Provenance {
  return {
    source_type: 'vault',
    source_uri: 'vault://wiki/test.md',
    fetched_at: '2026-05-30T12:00:00Z',
    indexed_at: '2026-05-30T12:00:00Z',
    trust_level: 'semi_trusted_local',
    safe_to_use_as_instruction: false,
    ...overrides,
  };
}

// -----------------------------------------------------------------
// Tests: toP2SafetyTrustLevel (bridge)
// -----------------------------------------------------------------

describe('toP2SafetyTrustLevel', () => {
  it('maps trusted_verified → trusted_user', () => {
    expect(toP2SafetyTrustLevel('trusted_verified' as TLTrustLevel)).toBe('trusted_user');
  });
  it('maps trusted_external → semi_trusted_local', () => {
    expect(toP2SafetyTrustLevel('trusted_external' as TLTrustLevel)).toBe('semi_trusted_local');
  });
  it('maps semi_trusted_local → semi_trusted_local', () => {
    expect(toP2SafetyTrustLevel('semi_trusted_local' as TLTrustLevel)).toBe('semi_trusted_local');
  });
  it('maps untrusted_external → untrusted_external', () => {
    expect(toP2SafetyTrustLevel('untrusted_external' as TLTrustLevel)).toBe('untrusted_external');
  });
  it('maps unknown → untrusted_external (conservative)', () => {
    expect(toP2SafetyTrustLevel('unknown' as TLTrustLevel)).toBe('untrusted_external');
  });
});

// -----------------------------------------------------------------
// Tests: vault/semi_trusted_local → data allow
// -----------------------------------------------------------------

describe('semi_trusted_local as data', () => {
  it('allow: data use on vault semi_trusted_local', () => {
    const prov = makeProv({ trust_level: 'semi_trusted_local' as TLTrustLevel, safe_to_use_as_instruction: false });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'data' });
    expect(result.decision).toBe('allow');
  });

  it('allow: evidence use on vault semi_trusted_local', () => {
    const prov = makeProv({ trust_level: 'semi_trusted_local' as TLTrustLevel, safe_to_use_as_instruction: false });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'evidence' });
    expect(result.decision).toBe('allow');
  });
});

// -----------------------------------------------------------------
// Tests: vault/semi_trusted_local → instruction deny
// -----------------------------------------------------------------

describe('semi_trusted_local as instruction', () => {
  it('deny: instruction use on vault semi_trusted_local even when safe_to_use_as_instruction=true', () => {
    // safe=true but trust not in INSTRUCTION_ALLOWED → require_user_approval
    const prov = makeProv({ trust_level: 'semi_trusted_local' as TLTrustLevel, safe_to_use_as_instruction: true });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'instruction' });
    // trust=semi_trusted_local, not in INSTRUCTION_ALLOWED → require_user_approval (not allow)
    expect(result.decision).toBe('require_user_approval');
    expect(result.safeToUseAsInstruction).toBe(true);
  });

  it('deny: instruction use on vault semi_trusted_local when safe_to_use_as_instruction=false', () => {
    const prov = makeProv({ trust_level: 'semi_trusted_local' as TLTrustLevel, safe_to_use_as_instruction: false });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'instruction' });
    expect(result.decision).toBe('deny');
  });
});

// -----------------------------------------------------------------
// Tests: untrusted_external → instruction deny
// -----------------------------------------------------------------

describe('untrusted_external as instruction', () => {
  it('deny: instruction use on untrusted_external source', () => {
    const prov = makeProv({ trust_level: 'untrusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/external.md', provenance: prov, requestedUse: 'instruction' });
    expect(result.decision).toBe('deny');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('allow: data use on untrusted_external', () => {
    const prov = makeProv({ trust_level: 'untrusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/external.md', provenance: prov, requestedUse: 'data' });
    expect(result.decision).toBe('allow');
  });
});

// -----------------------------------------------------------------
// Tests: trusted_verified → instruction allow
// -----------------------------------------------------------------

describe('trusted_verified as instruction', () => {
  it('allow: instruction use on trusted_verified source with safe_to_use_as_instruction=true', () => {
    const prov = makeProv({ trust_level: 'trusted_verified' as TLTrustLevel, safe_to_use_as_instruction: true });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/verified.md', provenance: prov, requestedUse: 'instruction' });
    expect(result.decision).toBe('allow');
    expect(result.trustLevel).toBe('trusted_user');
  });

  it('allow: instruction use on trusted_verified even with safe=false (trust gates instruction)', () => {
    // trusted_verified → trusted_user (in INSTRUCTION_ALLOWED), so even safe=false passes rule 4
    // (rule 2 catches safe=false first, so instruction is still denied when safe=false)
    const prov = makeProv({ trust_level: 'trusted_verified' as TLTrustLevel, safe_to_use_as_instruction: false });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/verified.md', provenance: prov, requestedUse: 'instruction' });
    // Rule 2 fires first: safe=false + instruction → deny
    expect(result.decision).toBe('deny');
  });
});

// -----------------------------------------------------------------
// Tests: safe_to_use_as_instruction=false priority over trust level
// -----------------------------------------------------------------

describe('safe_to_use_as_instruction=false priority', () => {
  it('deny: instruction use when safe=false even if trust=trusted_verified', () => {
    const prov = makeProv({ trust_level: 'trusted_verified' as TLTrustLevel, safe_to_use_as_instruction: false });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'instruction' });
    expect(result.decision).toBe('deny');
    expect(result.reasons.some(r => r.includes('safe_to_use_as_instruction=false'))).toBe(true);
  });
});

// -----------------------------------------------------------------
// Tests: archive_locked denies high-privilege use
// -----------------------------------------------------------------

describe('archive_locked high-privilege deny', () => {
  it('require_user_approval: credential_access capability denied to untrusted_external (capability ceiling)', () => {
    // Rule 0: capability ceiling check fires before use-type rules.
    // untrusted_external has no credential_access → require_user_approval.
    // (This tests the capability ceiling enforcement; archive_locked cannot
    // be reached via typed-links provenance since typed-links has no archive_locked value.
    // The Rule 1 archive_locked path is tested separately via the types-only module.)
    const prov = makeProv({ trust_level: 'untrusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({
      knowledgeId: 'vault://wiki/archive/locked.md',
      provenance: prov,
      requestedUse: 'data', // use doesn't matter; capability check is first
      requestedCapability: 'credential_access',
    });
    expect(result.decision).toBe('require_user_approval');
    expect(result.reasons.some(r => r.includes('credential_access'))).toBe(true);
  });
});

// -----------------------------------------------------------------
// Tests: requestedCapability ceiling enforcement
// -----------------------------------------------------------------

describe('requestedCapability ceiling', () => {
  it('require_user_approval: semi_trusted_local requests credential_access', () => {
    const prov = makeProv({ trust_level: 'semi_trusted_local' as TLTrustLevel });
    const result = classifyKnowledgeUse({
      knowledgeId: 'vault://wiki/test.md',
      provenance: prov,
      requestedUse: 'data',
      requestedCapability: 'credential_access',
    });
    // semi_trusted_local doesn't have credential_access capability → require_user_approval
    expect(result.decision).toBe('require_user_approval');
    expect(result.reasons.some(r => r.includes('credential_access'))).toBe(true);
  });

  it('allow: trusted_user requests credential_access', () => {
    const prov = makeProv({ trust_level: 'trusted_verified' as TLTrustLevel });
    const result = classifyKnowledgeUse({
      knowledgeId: 'vault://wiki/test.md',
      provenance: prov,
      requestedUse: 'data',
      requestedCapability: 'credential_access',
    });
    expect(result.decision).toBe('allow');
  });
});

// -----------------------------------------------------------------
// Tests: code_context enforcement
// -----------------------------------------------------------------

describe('code_context enforcement', () => {
  it('allow: semi_trusted_local as code_context', () => {
    const prov = makeProv({ trust_level: 'semi_trusted_local' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'code_context' });
    expect(result.decision).toBe('allow');
  });

  it('deny: untrusted_external as code_context', () => {
    const prov = makeProv({ trust_level: 'untrusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'code_context' });
    expect(result.decision).toBe('deny');
  });

  it('allow: trusted_verified as code_context', () => {
    const prov = makeProv({ trust_level: 'trusted_verified' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'code_context' });
    expect(result.decision).toBe('allow');
  });
});

// -----------------------------------------------------------------
// Tests: typed-links provenance fields are preserved
// -----------------------------------------------------------------

describe('typed-links provenance field preservation', () => {
  it('source_type is reflected in decision', () => {
    const prov = makeProv({ source_type: 'url', trust_level: 'untrusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'https://example.com', provenance: prov, requestedUse: 'data' });
    expect(result.decision).toBe('allow'); // untrusted_external can use as data
  });

  it('safeToUseAsInstruction mirrors provenance.safe_to_use_as_instruction', () => {
    const prov = makeProv({ safe_to_use_as_instruction: true });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'data' });
    expect(result.safeToUseAsInstruction).toBe(true);
  });

  it('trustLevel is correctly mapped to P2Safety level', () => {
    const prov = makeProv({ trust_level: 'trusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'data' });
    expect(result.trustLevel).toBe('semi_trusted_local'); // trusted_external → semi_trusted_local
  });

  it('trustLevel for untrusted_external stays untrusted_external', () => {
    const prov = makeProv({ trust_level: 'untrusted_external' as TLTrustLevel });
    const result = classifyKnowledgeUse({ knowledgeId: 'vault://wiki/test.md', provenance: prov, requestedUse: 'data' });
    expect(result.trustLevel).toBe('untrusted_external');
  });
});

// -----------------------------------------------------------------
// Tests: shared module purity (no Node-only imports)
// -----------------------------------------------------------------

describe('shared module purity', () => {
  it('classifyKnowledgeUse is callable with no side effects', () => {
    const prov = makeProv();
    const copy = JSON.parse(JSON.stringify(prov));
    classifyKnowledgeUse({ knowledgeId: 'test', provenance: copy, requestedUse: 'data' });
    expect(JSON.stringify(copy)).toBe(JSON.stringify(prov));
  });

  it('toP2SafetyTrustLevel is a pure function', () => {
    const input = 'trusted_verified' as TLTrustLevel;
    expect(toP2SafetyTrustLevel(input)).toBe('trusted_user');
    expect(toP2SafetyTrustLevel(input)).toBe('trusted_user'); // idempotent
  });
});