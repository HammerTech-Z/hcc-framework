// Hermes Pro — Staleness Scorer (Phase 2)
// Enhanced time-decay scoring with configurable profiles.
// Pure computation. Zero LLM, zero I/O.
//
// Already partially implemented in vault-auditor.ts.
// This module adds: configurable profiles, batch scoring, threshold alerts.

import { classifyPath, computeStaleness, type StalenessScore, type VaultCategory, CATEGORY_HALF_LIFE } from "./vault-auditor";

// Re-export for convenience
export { classifyPath, computeStaleness, CATEGORY_HALF_LIFE };
export type { StalenessScore, VaultCategory };

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

/** Configuration for staleness alert thresholds */
export interface StalenessThresholds {
  /** Score above which a file is considered "stale" */
  stale: number;
  /** Score above which a file is considered "critical" (needs regeneration) */
  critical: number;
  /** Score above which a file should be archived */
  archive: number;
}

/** Default thresholds */
export const DEFAULT_THRESHOLDS: StalenessThresholds = {
  stale: 0.4,     // >40% stale → needs attention
  critical: 0.6,  // >60% → needs regeneration
  archive: 0.85,  // >85% → candidate for archival
};

/** File with staleness classification */
export interface ClassifiedStaleness extends StalenessScore {
  level: "fresh" | "aging" | "stale" | "critical" | "archive";
}

/** Complete staleness audit result */
export interface StalenessAudit {
  scored: ClassifiedStaleness[];
  thresholds: StalenessThresholds;
  summary: {
    total: number;
    fresh: number;
    aging: number;
    stale: number;
    critical: number;
    archive: number;
    /** Average staleness score across all files */
    averageScore: number;
    /** Category with highest average staleness */
    stalestCategory: VaultCategory | null;
  };
}

// -----------------------------------------------------------------
// Classification
// -----------------------------------------------------------------

/**
 * Classify a staleness score into a severity level.
 */
export function classifyStaleness(
  score: number,
  thresholds: StalenessThresholds = DEFAULT_THRESHOLDS,
): ClassifiedStaleness["level"] {
  if (score >= thresholds.archive) return "archive";
  if (score >= thresholds.critical) return "critical";
  if (score >= thresholds.stale) return "stale";
  if (score >= 0.15) return "aging";
  return "fresh";
}

// -----------------------------------------------------------------
// Batch Audit
// -----------------------------------------------------------------

/**
 * Run a staleness audit on a batch of files.
 */
export function runStalenessAudit(
  files: Array<{ path: string; mtime: number | string }>,
  thresholds: StalenessThresholds = DEFAULT_THRESHOLDS,
  nowMs?: number,
): StalenessAudit {
  const scored: ClassifiedStaleness[] = files.map((f) => {
    const base = computeStaleness(f.path, f.mtime, nowMs);
    const level = classifyStaleness(base.score, thresholds);
    return { ...base, level };
  });

  // Sort by staleness (most stale first)
  scored.sort((a, b) => b.score - a.score);

  // Summary
  const fresh = scored.filter((s) => s.level === "fresh").length;
  const aging = scored.filter((s) => s.level === "aging").length;
  const stale = scored.filter((s) => s.level === "stale").length;
  const critical = scored.filter((s) => s.level === "critical").length;
  const archive = scored.filter((s) => s.level === "archive").length;

  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);
  const averageScore = scored.length > 0 ? totalScore / scored.length : 0;

  // Stalest category
  const categoryScores = new Map<VaultCategory, number[]>();
  for (const s of scored) {
    const existing = categoryScores.get(s.category) ?? [];
    existing.push(s.score);
    categoryScores.set(s.category, existing);
  }

  let highestAvg = 0;
  let stalestCategory: VaultCategory | null = null;
  for (const [cat, scores] of categoryScores) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg > highestAvg) {
      highestAvg = avg;
      stalestCategory = cat;
    }
  }

  return {
    scored,
    thresholds,
    summary: {
      total: scored.length,
      fresh,
      aging,
      stale,
      critical,
      archive,
      averageScore: Math.round(averageScore * 1000) / 1000,
      stalestCategory,
    },
  };
}

// -----------------------------------------------------------------
// Half-Life Customization
// -----------------------------------------------------------------

/**
 * Create a custom half-life profile by overriding defaults.
 */
export function createHalfLifeProfile(
  overrides: Partial<Record<VaultCategory, number>>,
): Record<VaultCategory, number> {
  return { ...CATEGORY_HALF_LIFE, ...overrides };
}
