// P2.5 Safety Foundation — Knowledge Provenance / Trust Enforcement
// Pure shared function module; no IPC, no file I/O, no Node.js crypto.

import type { TrustLevel as P2SafetyTrustLevel, Capability } from './types';
import type { TrustLevel as TypedLinksTrustLevel, Provenance as TypedLinksProvenance } from '../typed-links';

// -----------------------------------------------------------------
// Inline capability ceiling (avoid circular import)
// -----------------------------------------------------------------

const TRUST_TO_CAP: Record<P2SafetyTrustLevel, Capability[]> = {
  trusted_user:        ['read_public', 'read_local', 'write_artifact', 'write_project', 'run_command', 'browser_action', 'credential_access', 'external_publish'],
  semi_trusted_local:  ['read_public', 'read_local', 'write_artifact'],
  untrusted_external:  ['read_public'],
  unattended_cron:     ['read_public'],
  archive_locked:      [],
};

function capabilityAllowed(trust: P2SafetyTrustLevel, cap: Capability): boolean {
  return (TRUST_TO_CAP[trust] ?? []).includes(cap);
}

// -----------------------------------------------------------------
// Cross-system trust level mapping
// -----------------------------------------------------------------

/** Maps typed-links TrustLevel → P2.5 Safety TrustLevel (lossy cast). */
export function toP2SafetyTrustLevel(t: TypedLinksTrustLevel): P2SafetyTrustLevel {
  switch (t) {
    case 'trusted_verified':  return 'trusted_user';
    case 'trusted_external':  return 'semi_trusted_local';
    case 'semi_trusted_local': return 'semi_trusted_local';
    case 'untrusted_external': return 'untrusted_external';
    case 'unknown':           return 'untrusted_external';
  }
}

const INSTRUCTION_ALLOWED: P2SafetyTrustLevel[] = ['trusted_user'];
const DATA_ALLOWED: P2SafetyTrustLevel[] = ['trusted_user', 'semi_trusted_local', 'untrusted_external'];
const CODE_CONTEXT_ALLOWED: P2SafetyTrustLevel[] = ['trusted_user', 'semi_trusted_local'];

function inArray<T>(arr: T[], val: T): boolean {
  return arr.includes(val);
}

// -----------------------------------------------------------------
// Input / Output schema
// -----------------------------------------------------------------

export type KnowledgeUse = 'data' | 'instruction' | 'evidence' | 'code_context';

export interface ClassifyInput {
  knowledgeId: string;
  provenance: TypedLinksProvenance;
  requestedUse: KnowledgeUse;
  /** Optional: if the request also requires a P2.5 capability check */
  requestedCapability?: Capability;
}

export interface ClassifyResult {
  knowledgeId: string;
  decision: 'allow' | 'deny' | 'require_user_approval';
  trustLevel: P2SafetyTrustLevel;
  /** Mirrors provenance.safe_to_use_as_instruction */
  safeToUseAsInstruction: boolean;
  reasons: string[];
}

// -----------------------------------------------------------------
// classifyKnowledgeUse — the runtime enforcement function
// Core rule: external content can only be used as data, never as instruction
// unless explicitly marked safe AND from a trusted source.
// -----------------------------------------------------------------

export function classifyKnowledgeUse(input: ClassifyInput): ClassifyResult {
  const { knowledgeId, provenance, requestedUse, requestedCapability } = input;

  const trust: P2SafetyTrustLevel = toP2SafetyTrustLevel(provenance.trust_level);
  const safe = provenance.safe_to_use_as_instruction;
  const reasons: string[] = [];

  // Rule 0: capability ceiling check first — if requested capability exceeds trust ceiling,
  // deny immediately regardless of use type (capability is more fundamental than use)
  if (requestedCapability && !capabilityAllowed(trust, requestedCapability)) {
    reasons.push(
      `capability "${requestedCapability}" not allowed for trust level "${trust}"`
    );
    return {
      knowledgeId,
      decision: 'require_user_approval',
      trustLevel: trust,
      safeToUseAsInstruction: safe,
      reasons,
    };
  }

  // Rule 1: archive_locked always denies high-privilege uses
  if (trust === 'archive_locked') {
    if (requestedUse === 'instruction' || requestedUse === 'code_context') {
      reasons.push(`archive_locked trust level denies use="${requestedUse}"`);
      return { knowledgeId, decision: 'deny', trustLevel: trust, safeToUseAsInstruction: false, reasons };
    }
  }

  // Rule 2: safe_to_use_as_instruction=false → deny instruction
  if (!safe && requestedUse === 'instruction') {
    reasons.push(
      `provenance.safe_to_use_as_instruction=false denies use="instruction" for "${knowledgeId}"`
    );
    return { knowledgeId, decision: 'deny', trustLevel: trust, safeToUseAsInstruction: false, reasons };
  }

  // Rule 3: untrusted_external → deny instruction
  if (trust === 'untrusted_external' && requestedUse === 'instruction') {
    reasons.push(
      `trust level "untrusted_external" denies use="instruction" for "${knowledgeId}"`
    );
    return { knowledgeId, decision: 'deny', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
  }

  // Rule 4: instruction use requires trusted_user
  if (requestedUse === 'instruction') {
    if (inArray(INSTRUCTION_ALLOWED, trust)) {
      reasons.push(`trust level "${trust}" allows use="instruction"`);
      return { knowledgeId, decision: 'allow', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
    }
    // safe=true but trust not in INSTRUCTION_ALLOWED → require user approval
    reasons.push(
      `safe_to_use_as_instruction=true but trust="${trust}" requires user approval for use="instruction"`
    );
    return {
      knowledgeId,
      decision: 'require_user_approval',
      trustLevel: trust,
      safeToUseAsInstruction: safe,
      reasons,
    };
  }

  // Rule 5: data / evidence — most trust levels allowed
  if (requestedUse === 'data' || requestedUse === 'evidence') {
    if (inArray(DATA_ALLOWED, trust)) {
      reasons.push(`trust level "${trust}" allows use="${requestedUse}"`);
      return { knowledgeId, decision: 'allow', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
    }
    reasons.push(`trust level "${trust}" denies use="${requestedUse}"`);
    return { knowledgeId, decision: 'deny', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
  }

  // Rule 6: code_context — medium trust required
  if (requestedUse === 'code_context') {
    if (inArray(CODE_CONTEXT_ALLOWED, trust)) {
      reasons.push(`trust level "${trust}" allows use="code_context"`);
      return { knowledgeId, decision: 'allow', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
    }
    reasons.push(`trust level "${trust}" denies use="code_context"`);
    return { knowledgeId, decision: 'deny', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
  }

  // Default: allow with info
  reasons.push(`use="${requestedUse}" permitted for trust="${trust}"`);
  return { knowledgeId, decision: 'allow', trustLevel: trust, safeToUseAsInstruction: safe, reasons };
}