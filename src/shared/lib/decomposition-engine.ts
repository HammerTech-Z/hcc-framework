// Hermes Pro — Decomposition Engine (Phase 6)
// Detects oversized vault files and proposes splitting into sub-pages.
// Dry-run by default: produces DecompositionProposal for human review.
// Pure functions. No I/O, no writes to vault files.

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

/** Thresholds for triggering decomposition */
export interface DecompositionThresholds {
  /** Maximum lines before a file is considered oversized */
  maxLines: number;
  /** Maximum size in bytes before a file is considered oversized */
  maxSizeBytes: number;
  /** Minimum number of H2 headings to consider splitting */
  minHeadings: number;
}

export const DEFAULT_DECOMPOSITION_THRESHOLDS: DecompositionThresholds = {
  maxLines: 500,
  maxSizeBytes: 10 * 1024, // 10KB
  minHeadings: 3,
};

/** A proposed sub-page extracted from the parent */
export interface SubPageProposal {
  /** Suggested filename for the sub-page */
  suggestedPath: string;
  /** The H2 heading that starts this section */
  heading: string;
  /** Approximate line range in the original file */
  lineRange: { start: number; end: number };
  /** Estimated content length */
  estimatedLines: number;
}

/** Complete decomposition proposal for one file */
export interface DecompositionProposal {
  /** The oversized file */
  sourceFile: string;
  /** Why decomposition is recommended */
  reason: string;
  /** Current file metrics */
  currentLines: number;
  currentSizeBytes: number;
  /** Proposed sub-pages */
  subPages: SubPageProposal[];
  /** Suggested hub page content */
  hubPageContent: string | null;
}

/** Result of running decomposition analysis */
export interface DecompositionResult {
  analyzed: number;
  oversized: DecompositionProposal[];
}

// -----------------------------------------------------------------
// Heading Extraction
// -----------------------------------------------------------------

interface HeadingSection {
  level: number;
  heading: string;
  lineStart: number;
  lineEnd: number; // exclusive
  subHeadings: HeadingSection[];
}

/**
 * Extract H1 and H2 heading structure from markdown content.
 */
export function extractHeadingStructure(content: string): HeadingSection[] {
  const lines = content.split("\n");
  const sections: HeadingSection[] = [];
  const stack: HeadingSection[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1Match = line.match(/^#\s+(.+)/);
    const h2Match = line.match(/^##\s+(.+)/);
    const h3Match = line.match(/^###\s+(.+)/);

    if (h1Match || h2Match || h3Match) {
      const level = h1Match ? 1 : h2Match ? 2 : 3;
      const heading = (h1Match ?? h2Match ?? h3Match)![1].trim();
      const section: HeadingSection = {
        level,
        heading,
        lineStart: i,
        lineEnd: lines.length,
        subHeadings: [],
      };

      // Close previous sections at this level or deeper
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        const prev = stack.pop()!;
        prev.lineEnd = i;
      }

      if (stack.length === 0) {
        sections.push(section);
      } else {
        stack[stack.length - 1].subHeadings.push(section);
      }
      stack.push(section);
    }
  }

  return sections;
}

// -----------------------------------------------------------------
// Decomposition Analysis
// -----------------------------------------------------------------

/**
 * Slugify a heading into a filename-safe string.
 */
export function slugifyHeading(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\w\s一-鿿-]/g, "") // remove special chars, keep CJK
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

/**
 * Analyze a file for decomposition candidates.
 * Returns null if the file doesn't need decomposition.
 */
export function analyzeDecomposition(
  sourceFile: string,
  content: string,
  thresholds: DecompositionThresholds = DEFAULT_DECOMPOSITION_THRESHOLDS,
): DecompositionProposal | null {
  const lines = content.split("\n");
  const sizeBytes = content.length;

  // Check thresholds
  if (lines.length < thresholds.maxLines && sizeBytes < thresholds.maxSizeBytes) {
    return null;
  }

  // Extract heading structure
  const sections = extractHeadingStructure(content);
  const h2Sections = sections.flatMap((s) => [s, ...s.subHeadings]).filter((s) => s.level === 2);

  if (h2Sections.length < thresholds.minHeadings) {
    return null;
  }

  // Build sub-page proposals from H2 sections
  const sourceDir = sourceFile.split("/").slice(0, -1).join("/");
  const sourceBasename = sourceFile.split("/").pop()?.replace(/\.md$/, "") ?? "doc";
  const subPages: SubPageProposal[] = [];

  for (const section of h2Sections) {
    const slug = slugifyHeading(section.heading);
    const estimatedLines = section.lineEnd - section.lineStart;

    // Only propose sections with meaningful content (>20 lines)
    if (estimatedLines < 20) continue;

    subPages.push({
      suggestedPath: `${sourceDir}/${sourceBasename}-${slug}.md`,
      heading: section.heading,
      lineRange: { start: section.lineStart + 1, end: section.lineEnd },
      estimatedLines,
    });
  }

  if (subPages.length === 0) return null;

  // Build hub page content
  const hubLinks = subPages
    .map((sp) => {
      const relativePath = sp.suggestedPath.split("/").pop()?.replace(/\.md$/, "");
      return `- [[${relativePath}|${sp.heading}]]`;
    })
    .join("\n");

  const hubPageContent = `# ${sourceBasename} (Hub)\n\n> Auto-generated decomposition proposal. Review before applying.\n\n## Sections\n\n${hubLinks}\n\n---\n\n## Remaining Content\n\n<!-- Content not moved to sub-pages belongs here -->\n`;

  const reason = lines.length >= thresholds.maxLines
    ? `File has ${lines.length} lines (threshold: ${thresholds.maxLines})`
    : `File size is ${sizeBytes} bytes (threshold: ${thresholds.maxSizeBytes})`;

  return {
    sourceFile,
    reason,
    currentLines: lines.length,
    currentSizeBytes: sizeBytes,
    subPages,
    hubPageContent,
  };
}

/**
 * Run decomposition analysis on multiple files.
 */
export function runDecompositionAnalysis(
  files: Array<{ path: string; content: string }>,
  thresholds: DecompositionThresholds = DEFAULT_DECOMPOSITION_THRESHOLDS,
): DecompositionResult {
  const oversized: DecompositionProposal[] = [];

  for (const file of files) {
    const proposal = analyzeDecomposition(file.path, file.content, thresholds);
    if (proposal) {
      oversized.push(proposal);
    }
  }

  // Sort by most oversized first
  oversized.sort((a, b) => b.currentLines - a.currentLines);

  return {
    analyzed: files.length,
    oversized,
  };
}
