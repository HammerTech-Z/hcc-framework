// Hermes Pro — Synthesis Engine (Phase 7)
// Generates cross-topic synthesis pages connecting related concepts.
// Dry-run by default: produces SynthesisDraft for human review.
// Pure functions. No I/O, no writes to vault files.

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

/** A single vault entry for synthesis analysis */
export interface SynthesisEntry {
  path: string;
  content: string;
  /** Category of this entry */
  category: string;
  /** Source of this entry (cron, human, horizon, etc.) */
  source: string;
}

/** A topic cluster — group of related files */
export interface TopicCluster {
  /** Cluster name (derived from shared keywords) */
  name: string;
  /** Files in this cluster */
  files: string[];
  /** Shared keywords that define this cluster */
  keywords: string[];
  /** Internal link density (how many cross-references within the cluster) */
  internalLinkDensity: number;
  /** Average staleness (lower is fresher) */
  averageAge: number | null;
}

/** A cross-cluster connection */
export interface CrossClusterConnection {
  clusterA: string;
  clusterB: string;
  /** Shared files that appear in both clusters */
  sharedFiles: string[];
  /** Shared keywords */
  sharedKeywords: string[];
  /** Strength of connection [0, 1] */
  strength: number;
}

/** A synthesis draft page */
export interface SynthesisDraft {
  /** Suggested file path for the synthesis page */
  suggestedPath: string;
  /** Page title */
  title: string;
  /** Clusters involved */
  clusters: string[];
  /** Cross-cluster connections */
  connections: CrossClusterConnection[];
  /** Key files to cite */
  citedFiles: string[];
  /** Auto-generated summary */
  summary: string;
  /** Markdown content for the page */
  markdownContent: string;
}

/** Complete synthesis result */
export interface SynthesisResult {
  clusters: TopicCluster[];
  connections: CrossClusterConnection[];
  drafts: SynthesisDraft[];
}

// -----------------------------------------------------------------
// Keyword Extraction
// -----------------------------------------------------------------

/**
 * Extract meaningful keywords from content, weighted by TF.
 * Returns top N keywords with their frequencies.
 */
export function extractKeywords(
  content: string,
  topN = 15,
): Array<{ word: string; freq: number }> {
  // Tokenize without deduplication — we need raw frequencies
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

  const tokens = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/[#>*\-_\n\r\t|]/g, " ")
    .replace(/[^\w\s]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word, count]) => ({ word, freq: count }));
}

// -----------------------------------------------------------------
// Topic Clustering
// -----------------------------------------------------------------

/**
 * Group files into topic clusters based on shared keywords.
 * Uses a greedy clustering approach: each file's top keywords determine
 * which cluster it belongs to.
 */
export function clusterByKeywords(
  entries: SynthesisEntry[],
  minClusterSize = 2,
): TopicCluster[] {
  // Extract keywords for each entry
  const entryKeywords = entries.map((entry) => ({
    entry,
    keywords: extractKeywords(entry.content, 10).map((k) => k.word),
  }));

  // Build a keyword → entries index
  const keywordIndex = new Map<string, Set<number>>();
  for (let i = 0; i < entryKeywords.length; i++) {
    for (const kw of entryKeywords[i].keywords) {
      const existing = keywordIndex.get(kw) ?? new Set();
      existing.add(i);
      keywordIndex.set(kw, existing);
    }
  }

  // Find keywords that cluster at least minClusterSize files
  const clusterKeywords = [...keywordIndex.entries()]
    .filter(([, indices]) => indices.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size);

  // Greedy clustering: assign each file to its best cluster
  const assigned = new Set<number>();
  const clusters: TopicCluster[] = [];

  for (const [keyword, indices] of clusterKeywords) {
    const unassignedIndices = [...indices].filter((i) => !assigned.has(i));
    if (unassignedIndices.length < minClusterSize) continue;

    const files = unassignedIndices.map((i) => entryKeywords[i].entry.path);
    const clusterFiles = entryKeywords.filter((_, i) => unassignedIndices.includes(i));

    // Mark as assigned
    for (const i of unassignedIndices) {
      assigned.add(i);
    }

    // Compute internal link density
    const allKeywords = new Set(clusterFiles.flatMap((ek) => ek.keywords));
    const internalLinkDensity = allKeywords.size > 0
      ? [...allKeywords].filter((k) =>
          clusterFiles.every((ek) => ek.keywords.includes(k)),
        ).length / allKeywords.size
      : 0;

    clusters.push({
      name: keyword,
      files,
      keywords: [...allKeywords].slice(0, 20),
      internalLinkDensity,
      averageAge: null, // Requires file mtime, left for caller to populate
    });

    if (assigned.size >= entries.length) break;
  }

  return clusters;
}

// -----------------------------------------------------------------
// Cross-Cluster Connections
// -----------------------------------------------------------------

/**
 * Detect connections between clusters based on shared files and keywords.
 */
export function detectCrossClusterConnections(
  clusters: TopicCluster[],
  minStrength = 0.1,
): CrossClusterConnection[] {
  const connections: CrossClusterConnection[] = [];

  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i];
      const b = clusters[j];

      // Shared files
      const sharedFiles = a.files.filter((f) => b.files.includes(f));

      // Shared keywords
      const sharedKeywords = a.keywords.filter((k) => b.keywords.includes(k));

      // Strength: combination of file overlap and keyword overlap
      const fileOverlap = a.files.length + b.files.length > 0
        ? (2 * sharedFiles.length) / (a.files.length + b.files.length)
        : 0;
      const keywordOverlap = a.keywords.length + b.keywords.length > 0
        ? (2 * sharedKeywords.length) / (a.keywords.length + b.keywords.length)
        : 0;
      const strength = (fileOverlap * 0.3 + keywordOverlap * 0.7);

      if (strength >= minStrength) {
        connections.push({
          clusterA: a.name,
          clusterB: b.name,
          sharedFiles,
          sharedKeywords,
          strength: Math.round(strength * 1000) / 1000,
        });
      }
    }
  }

  return connections.sort((a, b) => b.strength - a.strength);
}

// -----------------------------------------------------------------
// Synthesis Draft Generation
// -----------------------------------------------------------------

/**
 * Generate synthesis draft pages from clusters and connections.
 */
export function generateSynthesisDrafts(
  clusters: TopicCluster[],
  connections: CrossClusterConnection[],
): SynthesisDraft[] {
  const drafts: SynthesisDraft[] = [];

  // Generate a draft for each cluster with at least 3 files
  for (const cluster of clusters) {
    if (cluster.files.length < 3) continue;

    const title = `Cross-Topic: ${cluster.name}`;
    const slug = cluster.name.toLowerCase().replace(/\s+/g, "-");
    const suggestedPath = `synthesis/${slug}-overview.md`;

    // Find connections involving this cluster
    const clusterConnections = connections.filter(
      (c) => c.clusterA === cluster.name || c.clusterB === cluster.name,
    );

    // Collect cited files (files in this cluster + shared files from connections)
    const citedFiles = new Set(cluster.files);
    for (const conn of clusterConnections) {
      for (const f of conn.sharedFiles) citedFiles.add(f);
    }

    // Summary
    const summary = `Synthesis across ${cluster.files.length} files in the "${cluster.name}" cluster, linking to ${clusterConnections.length} other topic(s).`;

    // Build markdown
    const fileLinks = cluster.files
      .map((f) => {
        const basename = f.split("/").pop()?.replace(/\.md$/, "") ?? f;
        return `- [[${f}|${basename}]]`;
      })
      .join("\n");

    const connectionLinks = clusterConnections
      .map((c) => {
        const other = c.clusterA === cluster.name ? c.clusterB : c.clusterA;
        return `- [[synthesis/${other.toLowerCase().replace(/\s+/g, "-")}-overview|${other}]]`;
      })
      .join("\n");

    const markdownContent = `# ${title}

> Auto-generated synthesis draft — review and refine before publishing.
> Generated: ${new Date().toISOString().split("T")[0]}

## Summary

${summary}

## Files in this cluster

${fileLinks}

## Cross-cluster connections

${connectionLinks || "- None yet. Run synthesis engine regularly to detect new connections."}

## Key themes

${cluster.keywords.slice(0, 10).map((k) => `- \`${k}\``).join("\n")}

---

<!-- This page was auto-generated by the Phase 7 synthesis engine. -->
<!-- Review the content, add your own insights, and remove this comment when done. -->
`;

    drafts.push({
      suggestedPath,
      title,
      clusters: [cluster.name],
      connections: clusterConnections,
      citedFiles: [...citedFiles],
      summary,
      markdownContent,
    });
  }

  return drafts;
}

// -----------------------------------------------------------------
// Full Pipeline
// -----------------------------------------------------------------

/**
 * Run the full synthesis pipeline: cluster → connect → draft.
 */
export function runSynthesisPipeline(entries: SynthesisEntry[]): SynthesisResult {
  const clusters = clusterByKeywords(entries);
  const connections = detectCrossClusterConnections(clusters);
  const drafts = generateSynthesisDrafts(clusters, connections);

  return { clusters, connections, drafts };
}
