// Hermes Pro — Contradiction Probe (Phase 2)
// Detects potential contradictions between high-similarity article pairs.
// Uses regex-based classification by default (zero LLM cost).
// Optional: Haiku judge for higher accuracy.
// Pure functions. No I/O, no writes to vault.

import { tokenizeContent, jaccardSimilarity } from "./vault-auditor";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

/** A single entry for contradiction analysis */
export interface ProbeEntry {
  path: string;
  content: string;
  /** Last modified timestamp for staleness context */
  mtime: number | string;
}

/** Severity of a detected contradiction */
export type ContradictionSeverity = "definite" | "likely" | "possible";

/** A detected contradiction between two articles */
export interface Contradiction {
  fileA: string;
  fileB: string;
  severity: ContradictionSeverity;
  /** The specific claim phrases that conflict */
  claimA: string | null;
  claimB: string | null;
  /** Why this might be a contradiction */
  evidence: string;
  /** Confidence [0, 1] */
  confidence: number;
}

/** Result of a contradiction probe run */
export interface ContradictionProbeResult {
  candidates: number;
  contradictions: Contradiction[];
  /** Pairs that were checked */
  checkedPairs: Array<{ fileA: string; fileB: string; similarity: number }>;
}

// -----------------------------------------------------------------
// Regex-Based Contradiction Patterns
// -----------------------------------------------------------------

/**
 * Regex patterns that indicate potential contradictions.
 * Each pattern has two variants: the positive claim and its negation/reversal.
 */
const CONTRADICTION_PAIRS: Array<{
  patternA: RegExp;
  patternB: RegExp;
  label: string;
  severity: ContradictionSeverity;
}> = [
  {
    // Deprecation vs recommendation
    patternA: /(?:deprecat|remov|dropped?|no longer (?:us|support|recommend|maintain))/i,
    patternB: /(?:recommend|use|adopt|prefer|standard|best practice)/i,
    label: "deprecation_vs_recommendation",
    severity: "likely",
  },
  {
    // Complete vs incomplete
    patternA: /(?:complete|finish|done|ready|production|GA|general availab)/i,
    patternB: /(?:incomplete|unfinish|not ready|TODO|FIXME|WIP|work in progress|experimental|alpha|beta)/i,
    label: "complete_vs_incomplete",
    severity: "possible",
  },
  {
    // Pass vs fail
    patternA: /\b(?:PASS|pass(?:ed)?|success|work(?:ing|s)|verified|valid(?:ated)?)\b/i,
    patternB: /\b(?:FAIL|fail(?:ed)?|error|broken?|bug|issue|problem|not work(?:ing)?)\b/i,
    label: "pass_vs_fail",
    severity: "likely",
  },
  {
    // Enable vs disable
    patternA: /(?:enabl|activ|turn on|switch on|approved?|authoriz)/i,
    patternB: /(?:disabl|deactivat|turn off|switch off|NOT APPROVED|not approved?|frozen|block(?:ed)?)/i,
    label: "enable_vs_disable",
    severity: "definite",
  },
  {
    // Increase vs decrease
    patternA: /(?:increas|grow|ris(e|ing)|higher?|more|faster|better|improv)/i,
    patternB: /(?:decreas|shrink|fall(?:ing)?|lower|less|slower|worse|regress)/i,
    label: "increase_vs_decrease",
    severity: "possible",
  },
  {
    // Always vs never
    patternA: /\b(?:always|must|required?|mandatory|essential)\b/i,
    patternB: /\b(?:never|must not|should not|cannot|forbidden|prohibit)\b/i,
    label: "always_vs_never",
    severity: "likely",
  },
  {
    // Support vs not support
    patternA: /(?:support(?:ed|s)?|compatibl|work with|availab)/i,
    patternB: /(?:not support|unsupport|incompatibl|doesn.?t work|unavailab)/i,
    label: "support_vs_not_support",
    severity: "likely",
  },
];

// -----------------------------------------------------------------
// Contradiction Detection
// -----------------------------------------------------------------

/**
 * Extract claims from text using simple sentence-level heuristics.
 * Claims are sentences containing key signal words (recommend, should, must, never, etc.).
 */
export function extractClaims(content: string): string[] {
  const sentences = content
    .replace(/\n/g, " ")
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && s.length < 500);

  const signalWords = /\b(?:is|are|was|were|should|must|can|cannot|will|won't|does|doesn'?t|recommend|support|use|work|pass|fail|approv|deprecat|enabl|disabl|always|never)\b/i;

  return sentences.filter((s) => signalWords.test(s));
}

/**
 * Detect contradictions between a pair of articles using regex patterns.
 * Returns empty array if no contradictions found.
 */
export function detectPairContradictions(
  entryA: ProbeEntry,
  entryB: ProbeEntry,
): Contradiction[] {
  const contradictions: Contradiction[] = [];

  // Only check pairs with reasonable content size
  if (entryA.content.length < 50 || entryB.content.length < 50) {
    return contradictions;
  }

  const claimsA = extractClaims(entryA.content);
  const claimsB = extractClaims(entryB.content);

  for (const pair of CONTRADICTION_PAIRS) {
    const matchesA = claimsA.filter((c) => pair.patternA.test(c));
    const matchesB = claimsB.filter((c) => pair.patternB.test(c));

    if (matchesA.length > 0 && matchesB.length > 0) {
      // Found a contradiction: A claims positive, B claims negative
      contradictions.push({
        fileA: entryA.path,
        fileB: entryB.path,
        severity: pair.severity,
        claimA: matchesA[0] ?? null,
        claimB: matchesB[0] ?? null,
        evidence: `Pattern "${pair.label}": file A has ${matchesA.length} match(es) for positive, file B has ${matchesB.length} match(es) for negative`,
        confidence: 0.7,
      });
    }

    // Check the reverse: A claims negative, B claims positive
    const revMatchesA = claimsA.filter((c) => pair.patternB.test(c));
    const revMatchesB = claimsB.filter((c) => pair.patternA.test(c));

    if (revMatchesA.length > 0 && revMatchesB.length > 0) {
      contradictions.push({
        fileA: entryA.path,
        fileB: entryB.path,
        severity: pair.severity,
        claimA: revMatchesA[0] ?? null,
        claimB: revMatchesB[0] ?? null,
        evidence: `Pattern "${pair.label}" (reversed): file A has ${revMatchesA.length} match(es) for negative, file B has ${revMatchesB.length} match(es) for positive`,
        confidence: 0.7,
      });
    }
  }

  return contradictions;
}

// -----------------------------------------------------------------
// Batch Probe
// -----------------------------------------------------------------

/**
 * Compute pairwise similarity for all entries and probe high-similarity pairs
 * for contradictions. Only checks pairs above the similarity threshold.
 *
 * @param entries - All vault entries to analyze
 * @param similarityThreshold - Only check pairs above this Jaccard similarity (default 0.3)
 * @param maxPairs - Maximum number of pairs to check (default 100)
 */
export function runContradictionProbe(
  entries: ProbeEntry[],
  similarityThreshold = 0.3,
  maxPairs = 100,
): ContradictionProbeResult {
  // Compute similarity matrix (limited to maxPairs)
  const pairs: Array<{ fileA: string; fileB: string; similarity: number; entryA: ProbeEntry; entryB: ProbeEntry }> = [];

  for (let i = 0; i < entries.length && pairs.length < maxPairs * 2; i++) {
    const tokensA = tokenizeContent(entries[i].content);
    if (tokensA.size === 0) continue;

    for (let j = i + 1; j < entries.length && pairs.length < maxPairs * 2; j++) {
      const tokensB = tokenizeContent(entries[j].content);
      if (tokensB.size === 0) continue;

      const sim = jaccardSimilarity(tokensA, tokensB);
      if (sim >= similarityThreshold) {
        pairs.push({
          fileA: entries[i].path,
          fileB: entries[j].path,
          similarity: Math.round(sim * 1000) / 1000,
          entryA: entries[i],
          entryB: entries[j],
        });
      }
    }
  }

  // Sort by similarity descending, take top maxPairs
  pairs.sort((a, b) => b.similarity - a.similarity);
  const topPairs = pairs.slice(0, maxPairs);

  // Probe each pair for contradictions
  const allContradictions: Contradiction[] = [];
  for (const pair of topPairs) {
    const contradictions = detectPairContradictions(pair.entryA, pair.entryB);
    allContradictions.push(...contradictions);
  }

  // Sort by severity then confidence
  const severityOrder: Record<ContradictionSeverity, number> = {
    definite: 0,
    likely: 1,
    possible: 2,
  };
  allContradictions.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  return {
    candidates: entries.length,
    contradictions: allContradictions,
    checkedPairs: topPairs.map((p) => ({
      fileA: p.fileA,
      fileB: p.fileB,
      similarity: p.similarity,
    })),
  };
}
