// Hermes Pro — Wikilink Resolver (Phase 1)
// Wraps vault-auditor wikilink parsing with fix-proposal generation.
// Dry-run by default: reports only. Fix mode requires user approval.
// Pure functions. No I/O, no writes to vault files.

import type { WikilinkRef } from "./vault-auditor";

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

/** Fix action type */
export type FixAction =
  | { kind: "create_stub"; target: string; suggestedPath: string }
  | { kind: "rename_link"; sourceFile: string; line: number; oldTarget: string; newTarget: string }
  | { kind: "choose_candidate"; sourceFile: string; line: number; target: string; chosenPath: string }
  | { kind: "remove_link"; sourceFile: string; line: number; target: string; reason: string };

/** A wikilink with fix proposals attached */
export interface FixableWikilink extends WikilinkRef {
  /** Available fix actions (empty if no fix needed) */
  fixes: FixAction[];
}

/** Complete wikilink fix report */
export interface WikilinkFixReport {
  generatedAt: string;
  totalWikilinks: number;
  deadLinkCount: number;
  deadLinkRate: number;
  ambiguousCount: number;
  fixableLinks: FixableWikilink[];
  /** Number of links that can be auto-fixed without ambiguity */
  autoFixableCount: number;
  /** Number of fixes that require human decision */
  humanDecisionCount: number;
}

// -----------------------------------------------------------------
// Fix Proposal Generation
// -----------------------------------------------------------------

/**
 * Generate a suggested path for a dead link target.
 * Uses heuristics: looks for files with similar basenames, or suggests
 * creating a stub in the same directory as the source file.
 */
export function suggestPathForDeadTarget(
  target: string,
  sourceFile: string,
  knownPaths: string[],
): string | null {
  const targetBasename = target.split("/").pop()?.toLowerCase() ?? "";

  // Look for files with similar basename (fuzzy match: edit distance ≤ 2)
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const p of knownPaths) {
    const bn = p.split("/").pop()?.replace(/\.md$/, "")?.toLowerCase() ?? "";
    const score = basenameSimilarity(targetBasename, bn);
    if (score > bestScore && score > 0.6) {
      bestScore = score;
      bestMatch = p;
    }
  }

  if (bestMatch && bestScore > 0.8) {
    return bestMatch; // High confidence rename suggestion
  }

  // Suggest creating stub in same category directory as source
  const sourceDir = sourceFile.split("/").slice(0, -1).join("/");
  const suggestedPath = `${sourceDir}/${targetBasename}.md`;

  return suggestedPath;
}

/**
 * Simple basename similarity based on common prefix/suffix and length ratio.
 * Returns [0, 1].
 */
function basenameSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  // Substring: one string fully contains the other
  if (a.includes(b) || b.includes(a)) return 0.85;

  // Word-level matching: split on common delimiters
  const aWords = new Set(a.split(/[-_\s]+/).filter(Boolean));
  const bWords = new Set(b.split(/[-_\s]+/).filter(Boolean));
  const intersection = new Set([...aWords].filter((w) => bWords.has(w)));
  const union = new Set([...aWords, ...bWords]);
  const wordScore = union.size > 0 ? intersection.size / union.size : 0;

  // Character-level matching as fallback
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  let matches = 0;
  let j = 0;
  for (let i = 0; i < longer.length && j < shorter.length; i++) {
    if (longer[i] === shorter[j]) { matches++; j++; }
  }
  const matchScore = matches / longer.length;
  const lengthScore = Math.min(a.length, b.length) / Math.max(a.length, b.length);

  return Math.max(wordScore, (lengthScore + matchScore) / 2);
}

// -----------------------------------------------------------------
// Fix Proposal Builder
// -----------------------------------------------------------------

/**
 * Generate fix proposals for all dead and ambiguous wikilinks.
 */
export function generateFixes(
  wikilinks: WikilinkRef[],
  knownPaths: string[],
): FixableWikilink[] {
  return wikilinks
    .filter((l) => l.status === "dead" || l.status === "ambiguous")
    .map((link): FixableWikilink => {
      const fixes: FixAction[] = [];

      if (link.status === "dead") {
        const suggestedPath = suggestPathForDeadTarget(link.target, link.sourceFile, knownPaths);

        if (suggestedPath && knownPaths.includes(suggestedPath)) {
          // The suggested path already exists — propose rename
          fixes.push({
            kind: "rename_link",
            sourceFile: link.sourceFile,
            line: link.line,
            oldTarget: link.target,
            newTarget: suggestedPath,
          });
        } else if (suggestedPath) {
          // Create a stub page
          fixes.push({
            kind: "create_stub",
            target: link.target,
            suggestedPath,
          });
        }

        // Always offer to remove dead link
        fixes.push({
          kind: "remove_link",
          sourceFile: link.sourceFile,
          line: link.line,
          target: link.target,
          reason: "Target file does not exist in vault",
        });
      }

      if (link.status === "ambiguous") {
        for (const candidate of link.candidates) {
          fixes.push({
            kind: "choose_candidate",
            sourceFile: link.sourceFile,
            line: link.line,
            target: link.target,
            chosenPath: candidate,
          });
        }
      }

      return { ...link, fixes };
    });
}

// -----------------------------------------------------------------
// Report Generation
// -----------------------------------------------------------------

/**
 * Generate a complete wikilink fix report from vault files and known paths.
 * Pure function — callers must provide parsed wikilinks.
 */
export function generateWikilinkFixReport(
  wikilinks: WikilinkRef[],
  knownPaths: string[],
): WikilinkFixReport {
  const fixableLinks = generateFixes(wikilinks, knownPaths);

  const deadLinks = wikilinks.filter((l) => l.status === "dead");
  const resolvableLinks = wikilinks.filter((l) => l.status !== "external");
  const deadLinkRate = resolvableLinks.length > 0
    ? deadLinks.length / resolvableLinks.length
    : 0;

  const autoFixableCount = fixableLinks.filter(
    (l) => l.fixes.length === 1 && l.fixes[0].kind === "rename_link",
  ).length;
  const humanDecisionCount = fixableLinks.length - autoFixableCount;

  return {
    generatedAt: new Date().toISOString(),
    totalWikilinks: wikilinks.length,
    deadLinkCount: deadLinks.length,
    deadLinkRate: Math.round(deadLinkRate * 1000) / 1000,
    ambiguousCount: wikilinks.filter((l) => l.status === "ambiguous").length,
    fixableLinks,
    autoFixableCount,
    humanDecisionCount,
  };
}
