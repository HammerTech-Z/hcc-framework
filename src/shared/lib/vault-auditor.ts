// Hermes Pro — Vault Auditor (read-only, no I/O, no LLM)
// Phase 0: Autonomous vault health audit.
// Pure functions. Caller reads files, passes content + metadata.
// Zero writes to any vault file.

/** A single vault file entry passed by the caller */
export interface VaultFileEntry {
  /** Absolute or vault-relative path, e.g. "tools/openhands-2026-06-12.md" */
  path: string;
  /** Full file content as string */
  content: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified time as ISO 8601 or Unix ms */
  mtime: number | string;
}

/** Status of a single wikilink resolution */
export type WikilinkStatus = "resolved" | "dead" | "ambiguous" | "external";

/** A single parsed wikilink */
export interface WikilinkRef {
  /** The source file containing this link */
  sourceFile: string;
  /** The raw wikilink text, e.g. "[[tools/openhands]]" */
  raw: string;
  /** The parsed target (without brackets and alias), e.g. "tools/openhands" */
  target: string;
  /** Optional display alias, e.g. "OpenHands" in "[[tools/openhands|OpenHands]]" */
  alias: string | null;
  /** Line number where this link appears (1-indexed) */
  line: number;
  /** Resolution status */
  status: WikilinkStatus;
  /** If resolved, the resolved file path relative to vault root */
  resolvedPath: string | null;
  /** If ambiguous, the candidate paths that matched */
  candidates: string[];
}

/** Overlap pair between two vault entries */
export interface ContentOverlapPair {
  fileA: string;
  fileB: string;
  /** Jaccard similarity [0,1] */
  similarity: number;
  /** Number of shared tokens */
  sharedTokens: number;
}

/** Staleness score for a vault entry */
export interface StalenessScore {
  file: string;
  /** Age in days since last modification */
  ageDays: number;
  /** Staleness score [0,1] — 0 = fresh, 1 = completely stale */
  score: number;
  /** Half-life used for this file's category */
  halfLifeDays: number;
  /** Category determined from file path */
  category: VaultCategory;
}

/** Vault content categories with different decay rates */
export type VaultCategory =
  | "tools"
  | "concepts"
  | "codebase"
  | "learning"
  | "decisions"
  | "design"
  | "patterns"
  | "pitfalls"
  | "synthesis"
  | "creative"
  | "other";

/** Category-specific half-life configuration (days) */
export const CATEGORY_HALF_LIFE: Record<VaultCategory, number> = {
  tools: 30,       // tool knowledge ages slowly
  concepts: 60,    // concepts are durable
  codebase: 14,    // codebase snapshots age fast
  learning: 45,    // learning notes moderately durable
  decisions: 90,   // ADRs are long-lived
  design: 60,      // design docs moderately durable
  patterns: 90,    // patterns are durable
  pitfalls: 90,    // pitfalls remain relevant
  synthesis: 14,   // synthesis ages fast (needs regeneration)
  creative: 30,    // creative notes moderate
  other: 30,       // default
};

/** Dead directory — claimed in index but empty or missing */
export interface DeadDirectory {
  path: string;
  claimedInIndex: boolean;
  actualFileCount: number;
  expectedMinFiles: number;
}

/** Complete vault health report */
export interface VaultHealthReport {
  generatedAt: string;
  vaultRoot: string;
  totalFiles: number;
  totalWikilinks: number;
  wikilinks: WikilinkRef[];
  deadLinks: WikilinkRef[];
  ambiguousLinks: WikilinkRef[];
  deadLinkRate: number;
  contentOverlaps: ContentOverlapPair[];
  stalenessScores: StalenessScore[];
  deadDirectories: DeadDirectory[];
  /** Files with no wikilinks at all */
  isolatedFiles: string[];
  /** Files with no inbound links */
  orphanFiles: string[];
}

// -----------------------------------------------------------------
// Wikilink Parsing
// -----------------------------------------------------------------

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Parse all wikilinks from a vault file's content.
 * Returns an array of parsed wikilinks with source file and line number.
 */
export function parseWikilinks(
  sourceFile: string,
  content: string,
): Omit<WikilinkRef, "status" | "resolvedPath" | "candidates">[] {
  const links: Omit<WikilinkRef, "status" | "resolvedPath" | "candidates">[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let match: RegExpExecArray | null;
    WIKILINK_RE.lastIndex = 0;

    while ((match = WIKILINK_RE.exec(line)) !== null) {
      links.push({
        sourceFile,
        raw: match[0],
        target: match[1].trim(),
        alias: match[2]?.trim() ?? null,
        line: i + 1,
      });
    }
  }

  return links;
}

// -----------------------------------------------------------------
// Wikilink Resolution
// -----------------------------------------------------------------

/**
 * Resolve wikilinks against a set of known file paths.
 * Supports: `[[filename]]`, `[[dir/filename]]`, `[[dir/filename|alias]]`
 * Resolution rules (Obsidian-compatible):
 * 1. Exact path match (with or without .md extension)
 * 2. Shortest unique basename match across all directories
 * 3. Ambiguous if basename matches multiple files in different dirs
 * 4. Dead if no match found
 * 5. External if target starts with http:// or https://
 */
export function resolveWikilinks(
  links: Omit<WikilinkRef, "status" | "resolvedPath" | "candidates">[],
  knownPaths: string[],
): WikilinkRef[] {
  // Build basename index: basename -> list of full paths
  const basenameIndex = new Map<string, string[]>();
  for (const p of knownPaths) {
    const basename = p.split("/").pop()?.replace(/\.md$/, "") ?? p;
    const existing = basenameIndex.get(basename) ?? [];
    existing.push(p);
    basenameIndex.set(basename, existing);
  }

  return links.map((link): WikilinkRef => {
    // External links
    if (link.target.startsWith("http://") || link.target.startsWith("https://")) {
      return { ...link, status: "external", resolvedPath: null, candidates: [] };
    }

    // Normalize target: strip .md if present, normalize slashes
    const normalized = link.target.replace(/\.md$/, "").replace(/\\/g, "/");

    // Rule 1: Exact path match
    const exactMatch = knownPaths.find(
      (p) => p === normalized || p === `${normalized}.md` || p.replace(/\.md$/, "") === normalized,
    );
    if (exactMatch) {
      return { ...link, status: "resolved", resolvedPath: exactMatch, candidates: [exactMatch] };
    }

    // Rule 2: Basename match
    const basename = normalized.split("/").pop()!;
    const matches = basenameIndex.get(basename) ?? [];

    if (matches.length === 1) {
      return { ...link, status: "resolved", resolvedPath: matches[0], candidates: matches };
    }

    if (matches.length > 1) {
      // Check for path prefix match among candidates
      const targetDir = normalized.includes("/") ? normalized.split("/").slice(0, -1).join("/") : null;
      if (targetDir) {
        const dirMatches = matches.filter((m) => m.includes(targetDir!));
        if (dirMatches.length === 1) {
          return { ...link, status: "resolved", resolvedPath: dirMatches[0], candidates: dirMatches };
        }
      }

      return { ...link, status: "ambiguous", resolvedPath: null, candidates: matches };
    }

    // Rule 5: Dead link
    return { ...link, status: "dead", resolvedPath: null, candidates: [] };
  });
}

// -----------------------------------------------------------------
// Staleness Scoring
// -----------------------------------------------------------------

/**
 * Determine the vault category from a file path.
 */
export function classifyPath(filePath: string): VaultCategory {
  const normalized = filePath.replace(/\\/g, "/");
  const parts = normalized.split("/");

  for (const part of parts) {
    if (part in CATEGORY_HALF_LIFE) {
      return part as VaultCategory;
    }
  }

  return "other";
}

/**
 * Compute staleness score for a vault entry.
 * Uses exponential decay: score = 1 - 2^(-age/halfLife)
 * score 0 = fresh (modified today), score → 1 = completely stale.
 */
export function computeStaleness(
  filePath: string,
  mtime: number | string,
  nowMs?: number,
): StalenessScore {
  const category = classifyPath(filePath);
  const halfLifeDays = CATEGORY_HALF_LIFE[category];

  const mtimeMs = typeof mtime === "string" ? new Date(mtime).getTime() : mtime;
  const now = nowMs ?? Date.now();
  const ageMs = now - mtimeMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  // Exponential decay: score = 1 - 2^(-age/halfLife)
  const score = 1 - Math.pow(2, -ageDays / halfLifeDays);

  return {
    file: filePath,
    ageDays: Math.round(ageDays * 100) / 100,
    score: Math.round(score * 1000) / 1000,
    halfLifeDays,
    category,
  };
}

// -----------------------------------------------------------------
// Content Overlap Detection
// -----------------------------------------------------------------

/**
 * Tokenize content into lowercase word tokens (filtered).
 * Strips markdown syntax, punctuation, and common stop words.
 */
export function tokenizeContent(content: string): Set<string> {
  const STOP_WORDS = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "can", "shall", "to", "of", "in", "for",
    "on", "with", "at", "by", "from", "as", "into", "through", "during",
    "before", "after", "above", "below", "between", "and", "but", "or",
    "not", "no", "this", "that", "these", "those", "it", "its", "they",
    "them", "their", "we", "us", "our", "you", "your", "he", "she", "his",
    "her", "also", "very", "just", "then", "now", "if", "so", "than",
    "too", "all", "each", "every", "both", "few", "more", "most", "other",
    "some", "such", "only", "own", "same", "one", "two", "new", "use",
    "used", "using", "make", "made", "like", "over",
  ]);

  // Strip markdown links, code blocks, headings
  const stripped = content
    .replace(/```[\s\S]*?```/g, " ") // code blocks
    .replace(/`[^`]+`/g, " ")        // inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // markdown links
    .replace(/\[\[([^\]]*)\]\]/g, "$1")       // wikilinks
    .replace(/[#>*\-_\n\r\t|]/g, " ")         // markdown syntax
    .replace(/[^\w\s]/g, "")                  // punctuation
    .toLowerCase();

  const tokens = stripped.split(/\s+/).filter((t) => {
    return t.length > 2 && !STOP_WORDS.has(t);
  });

  return new Set(tokens);
}

/**
 * Compute Jaccard similarity between two token sets.
 */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = new Set([...a].filter((x) => b.has(x)));
  const union = new Set([...a, ...b]);
  return intersection.size / union.size;
}

/**
 * Detect content overlap between vault entries.
 * Only reports pairs with similarity above threshold (default 0.8).
 */
export function detectOverlaps(
  entries: VaultFileEntry[],
  threshold = 0.8,
): ContentOverlapPair[] {
  const tokenized = entries.map((e) => ({
    file: e.path,
    tokens: tokenizeContent(e.content),
  }));

  const overlaps: ContentOverlapPair[] = [];

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const sim = jaccardSimilarity(tokenized[i].tokens, tokenized[j].tokens);
      if (sim >= threshold) {
        const sharedTokens = new Set(
          [...tokenized[i].tokens].filter((x) => tokenized[j].tokens.has(x)),
        );
        overlaps.push({
          fileA: tokenized[i].file,
          fileB: tokenized[j].file,
          similarity: Math.round(sim * 1000) / 1000,
          sharedTokens: sharedTokens.size,
        });
      }
    }
  }

  return overlaps.sort((a, b) => b.similarity - a.similarity);
}

// -----------------------------------------------------------------
// Dead Directory Detection
// -----------------------------------------------------------------

/**
 * Compare claimed directories (from index.md) against actual file counts.
 */
export function detectDeadDirectories(
  indexClaims: Array<{ path: string; description: string }>,
  actualFileCounts: Map<string, number>,
  minExpectedFiles = 3,
): DeadDirectory[] {
  return indexClaims
    .filter((claim) => {
      const count = actualFileCounts.get(claim.path) ?? 0;
      return count < minExpectedFiles;
    })
    .map((claim) => ({
      path: claim.path,
      claimedInIndex: true,
      actualFileCount: actualFileCounts.get(claim.path) ?? 0,
      expectedMinFiles: minExpectedFiles,
    }));
}

// -----------------------------------------------------------------
// Orphan Detection
// -----------------------------------------------------------------

/**
 * Find files that have no inbound links from other files.
 */
export function findOrphanFiles(
  wikilinks: WikilinkRef[],
  allFilePaths: string[],
): string[] {
  // Files that are targets of any resolved link
  const targets = new Set(
    wikilinks
      .filter((l) => l.status === "resolved" && l.resolvedPath)
      .map((l) => l.resolvedPath!),
  );

  // Also match by basename
  const basenameTargets = new Set<string>();
  for (const t of targets) {
    const bn = t.split("/").pop()?.replace(/\.md$/, "") ?? t;
    basenameTargets.add(bn);
  }

  return allFilePaths.filter((f) => {
    const basename = f.split("/").pop()?.replace(/\.md$/, "") ?? f;
    return !targets.has(f) && !basenameTargets.has(basename);
  });
}

// -----------------------------------------------------------------
// Report Generation
// -----------------------------------------------------------------

/**
 * Generate a complete vault health report.
 * Pure function — all data must be passed in.
 */
export function generateHealthReport(params: {
  vaultRoot: string;
  entries: VaultFileEntry[];
  indexClaims: Array<{ path: string; description: string }>;
  knownPaths: string[];
  overlapThreshold?: number;
  nowMs?: number;
}): VaultHealthReport {
  const { vaultRoot, entries, indexClaims, knownPaths, overlapThreshold, nowMs } = params;

  // Parse all wikilinks
  const rawLinks = entries.flatMap((e) => parseWikilinks(e.path, e.content));

  // Resolve wikilinks
  const resolvedLinks = resolveWikilinks(rawLinks, knownPaths);
  const deadLinks = resolvedLinks.filter((l) => l.status === "dead");
  const ambiguousLinks = resolvedLinks.filter((l) => l.status === "ambiguous");

  // Dead link rate
  const resolvableLinks = resolvedLinks.filter((l) => l.status !== "external");
  const deadLinkRate = resolvableLinks.length > 0
    ? deadLinks.length / resolvableLinks.length
    : 0;

  // Content overlaps
  const contentOverlaps = detectOverlaps(entries, overlapThreshold);

  // Staleness scores
  const stalenessScores = entries.map((e) => computeStaleness(e.path, e.mtime, nowMs));
  stalenessScores.sort((a, b) => b.score - a.score);

  // Dead directories
  const actualFileCounts = new Map<string, number>();
  for (const e of entries) {
    // Count files per directory (use parent dir)
    const dir = e.path.split("/").slice(0, -1).join("/") || ".";
    actualFileCounts.set(dir, (actualFileCounts.get(dir) ?? 0) + 1);
  }
  const deadDirectories = detectDeadDirectories(indexClaims, actualFileCounts);

  // Isolated files (no outbound wikilinks)
  const filesWithLinks = new Set(resolvedLinks.map((l) => l.sourceFile));
  const isolatedFiles = entries.map((e) => e.path).filter((f) => !filesWithLinks.has(f));

  // Orphan files (no inbound links)
  const orphanFiles = findOrphanFiles(resolvedLinks, knownPaths);

  return {
    generatedAt: new Date(nowMs ?? Date.now()).toISOString(),
    vaultRoot,
    totalFiles: entries.length,
    totalWikilinks: resolvedLinks.length,
    wikilinks: resolvedLinks,
    deadLinks,
    ambiguousLinks,
    deadLinkRate: Math.round(deadLinkRate * 1000) / 1000,
    contentOverlaps,
    stalenessScores,
    deadDirectories,
    isolatedFiles,
    orphanFiles,
  };
}
