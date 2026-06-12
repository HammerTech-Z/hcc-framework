// Hermes Pro — Vault Bridge Auditor (read-only, no writes)
// Phase 0: Cross-vault health audit.
// Indexes the Obsidian vault, detects gaps between Hermes Vault and Obsidian Vault.
// Pure functions. Caller reads files, passes content + metadata.

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

/** A single file entry from either vault */
export interface BridgeFileEntry {
  /** Relative path within the vault */
  path: string;
  /** File content */
  content: string;
  /** File size in bytes */
  sizeBytes: number;
  /** Last modified time (Unix ms or ISO 8601) */
  mtime: number | string;
  /** Which vault this file belongs to */
  vault: "hermes" | "obsidian";
}

/** Frontmatter extracted from a vault file */
export interface FileFrontmatter {
  title: string | null;
  tags: string[];
  type: string | null;       // entity, concept, source, query, comparison, synthesis
  related: string[];         // [[wikilink]] targets from frontmatter
  created: string | null;
  updated: string | null;
  authors: string[];
  year: number | null;
}

/** A topic detected from file content + frontmatter */
export interface DetectedTopic {
  /** Canonical topic name */
  name: string;
  /** Files in Hermes vault covering this topic */
  hermesFiles: string[];
  /** Files in Obsidian vault covering this topic */
  obsidianFiles: string[];
  /** Topic coverage: both = present in both, hermes_only, obsidian_only */
  coverage: "both" | "hermes_only" | "obsidian_only";
}

/** Gap: exists in one vault but not the other */
export interface CrossVaultGap {
  topic: string;
  /** Where the content exists */
  presentIn: "hermes" | "obsidian";
  /** Related files */
  files: string[];
  /** Severity of the gap */
  severity: "high" | "medium" | "low";
  /** Suggested action */
  suggestion: string;
}

/** Complete bridge audit report */
export interface BridgeAuditReport {
  generatedAt: string;
  hermesVaultRoot: string;
  obsidianVaultRoot: string;
  hermesFileCount: number;
  obsidianFileCount: number;
  topics: DetectedTopic[];
  gaps: CrossVaultGap[];
  /** Obsidian files with frontmatter type info */
  obsidianStructuredFiles: number;
  /** Hermes files with wikilinks */
  hermesLinkedFiles: number;
  /** Obsidian files with wikilinks */
  obsidianLinkedFiles: number;
  /** Files that exist in both vaults (same basename) */
  sharedBasenames: string[];
  /** Files unique to each vault */
  uniqueToHermes: string[];
  uniqueToObsidian: string[];
}

// -----------------------------------------------------------------
// Frontmatter Parsing
// -----------------------------------------------------------------

const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Supports Obsidian-style and standard markdown frontmatter.
 */
export function parseFrontmatter(content: string): FileFrontmatter {
  const match = content.match(FRONTMATTER_RE);
  if (!match) {
    return {
      title: null,
      tags: [],
      type: null,
      related: [],
      created: null,
      updated: null,
      authors: [],
      year: null,
    };
  }

  const fm = match[1];
  const result: FileFrontmatter = {
    title: null,
    tags: [],
    type: null,
    related: [],
    created: null,
    updated: null,
    authors: [],
    year: null,
  };

  // Simple line-by-line YAML parsing (sufficient for frontmatter)
  const lines = fm.split("\n");
  let currentArrayKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Array items: "- value"
    if (trimmed.startsWith("- ") && currentArrayKey) {
      const value = trimmed.slice(2).trim().replace(/^["']|["']$/g, "");
      const arr = result[currentArrayKey as keyof FileFrontmatter];
      if (Array.isArray(arr)) {
        (arr as string[]).push(value);
      }
      continue;
    }

    // Key-value: "key: value"
    const kv = trimmed.match(/^(\w[\w_-]*):\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1].trim();
    let value = kv[2].trim().replace(/^["']|["']$/g, "");

    if (value === "" || value === "[]") {
      currentArrayKey = key;
      // Initialize empty array
      if (key === "tags" || key === "related" || key === "authors") {
        if (key === "tags") result.tags = [];
        else if (key === "related") result.related = [];
        else if (key === "authors") result.authors = [];
      }
      continue;
    }

    currentArrayKey = null;

    if (value.startsWith("[") && value.endsWith("]")) {
      // Inline array: [a, b, c]
      const inner = value.slice(1, -1);
      const items = inner
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      if (key === "tags") result.tags = items;
      else if (key === "related") result.related = items;
      else if (key === "authors") result.authors = items;
    } else if (key === "year") {
      result.year = parseInt(value, 10) || null;
    } else if (key === "title") {
      result.title = value;
    } else if (key === "type") {
      result.type = value;
    } else if (key === "created") {
      result.created = value;
    } else if (key === "updated") {
      result.updated = value;
    }
  }

  return result;
}

// -----------------------------------------------------------------
// Topic Detection
// -----------------------------------------------------------------

/** Known topic keywords mapped to topics */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  "agent-architecture": ["agent", "multi-agent", "delegate_task", "agentic", "subagent", "sub-agent"],
  "mcp-protocol": ["mcp", "model context protocol", "mcp server", "mcp tool"],
  "llm-wiki": ["llm-wiki", "llm wiki", "llmwiki", "karpathy wiki", "wiki knowledge"],
  "knowledge-base": ["knowledge base", "knowledgebase", "知识库", "vault", "知识图谱"],
  "claude-code": ["claude code", "claude-code", "claude.ai", "anthropic claude"],
  "ai-models": ["gpt", "claude", "deepseek", "minimax", "gemini", "ollama", "llm model"],
  "horizon-radar": ["horizon", "news radar", "AI动态", "AI新闻"],
  "hermes-pro": ["hermes pro", "hermes-pro", "hermes desktop", "hermes agent"],
  "code-engineering": ["code engineering", "agentic engineering", "vibe coding", "coding agent"],
  "security": ["security", "safety", "安全", "audit", "redaction", "secret"],
  "ui-design": ["design system", "ui design", "interface design", "frontend", "css"],
  "ai-comic": ["ai漫剧", "ai漫画", "ai video", "anime", "comic generation"],
};

/**
 * Detect topic coverage across both vaults.
 */
export function detectTopicCoverage(
  hermesEntries: BridgeFileEntry[],
  obsidianEntries: BridgeFileEntry[],
): DetectedTopic[] {
  const topics: DetectedTopic[] = [];

  for (const [topicName, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const hermesFiles: string[] = [];
    const obsidianFiles: string[] = [];

    for (const entry of hermesEntries) {
      const lowerContent = entry.content.toLowerCase();
      const lowerPath = entry.path.toLowerCase();
      if (keywords.some((kw) => lowerContent.includes(kw) || lowerPath.includes(kw.replace(/\s+/g, "-")))) {
        hermesFiles.push(entry.path);
      }
    }

    for (const entry of obsidianEntries) {
      const lowerContent = entry.content.toLowerCase();
      const lowerPath = entry.path.toLowerCase();
      if (keywords.some((kw) => lowerContent.includes(kw) || lowerPath.includes(kw.replace(/\s+/g, "-")))) {
        obsidianFiles.push(entry.path);
      }
    }

    const coverage: DetectedTopic["coverage"] =
      hermesFiles.length > 0 && obsidianFiles.length > 0 ? "both"
      : hermesFiles.length > 0 ? "hermes_only"
      : obsidianFiles.length > 0 ? "obsidian_only"
      : "hermes_only"; // shouldn't happen with matched keywords but handle gracefully

    if (hermesFiles.length > 0 || obsidianFiles.length > 0) {
      topics.push({
        name: topicName,
        hermesFiles,
        obsidianFiles,
        coverage,
      });
    }
  }

  return topics.sort((a, b) => {
    // "both" first, then single-vault topics
    const order = { both: 0, hermes_only: 1, obsidian_only: 2 };
    return order[a.coverage] - order[b.coverage];
  });
}

/**
 * Detect gaps: topics present in one vault but not the other.
 */
export function detectCrossVaultGaps(topics: DetectedTopic[]): CrossVaultGap[] {
  const gaps: CrossVaultGap[] = [];

  for (const topic of topics) {
    if (topic.coverage === "both") continue;

    const presentIn = topic.coverage === "hermes_only" ? "hermes" : "obsidian";
    const files = presentIn === "hermes" ? topic.hermesFiles : topic.obsidianFiles;

    // Determine severity
    let severity: CrossVaultGap["severity"] = "low";
    if (topic.name === "knowledge-base" || topic.name === "agent-architecture" || topic.name === "hermes-pro") {
      severity = "high";
    } else if (topic.name === "mcp-protocol" || topic.name === "claude-code" || topic.name === "llm-wiki") {
      severity = "medium";
    }

    const otherVault = presentIn === "hermes" ? "Obsidian" : "Hermes";
    gaps.push({
      topic: topic.name,
      presentIn,
      files,
      severity,
      suggestion: `Bridge ${topic.name} content from ${presentIn} vault to ${otherVault} vault`,
    });
  }

  return gaps.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
}

// -----------------------------------------------------------------
// Basename Cross-Reference
// -----------------------------------------------------------------

/**
 * Find files that share the same basename across vaults.
 */
export function findSharedBasenames(
  hermesPaths: string[],
  obsidianPaths: string[],
): string[] {
  const hermesBasenames = new Map<string, string>();
  for (const p of hermesPaths) {
    const bn = p.split("/").pop()?.replace(/\.md$/i, "")?.toLowerCase() ?? "";
    hermesBasenames.set(bn, p);
  }

  const shared: string[] = [];
  for (const p of obsidianPaths) {
    const bn = p.split("/").pop()?.replace(/\.md$/i, "")?.toLowerCase() ?? "";
    if (hermesBasenames.has(bn)) {
      shared.push(bn);
    }
  }

  return shared.sort();
}

/**
 * Count wikilinks in vault file contents.
 */
export function countWikilinks(entries: BridgeFileEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    const matches = entry.content.match(/\[\[([^\]]+)\]\]/g);
    if (matches) count += matches.length;
  }
  return count;
}

// -----------------------------------------------------------------
// Report Generation
// -----------------------------------------------------------------

/**
 * Generate a complete bridge audit report.
 */
export function generateBridgeReport(params: {
  hermesRoot: string;
  obsidianRoot: string;
  hermesEntries: BridgeFileEntry[];
  obsidianEntries: BridgeFileEntry[];
  nowMs?: number;
}): BridgeAuditReport {
  const { hermesRoot, obsidianRoot, hermesEntries, obsidianEntries, nowMs } = params;

  const hermesPaths = hermesEntries.map((e) => e.path);
  const obsidianPaths = obsidianEntries.map((e) => e.path);

  // Topic coverage
  const topics = detectTopicCoverage(hermesEntries, obsidianEntries);
  const gaps = detectCrossVaultGaps(topics);

  // Structured files count (Obsidian frontmatter)
  let obsidianStructuredFiles = 0;
  for (const entry of obsidianEntries) {
    const fm = parseFrontmatter(entry.content);
    if (fm.type || fm.tags.length > 0) obsidianStructuredFiles++;
  }

  // Wikilink counts
  const hermesLinkedFiles = hermesEntries.filter(
    (e) => /\[\[[^\]]+\]\]/.test(e.content),
  ).length;
  const obsidianLinkedFiles = obsidianEntries.filter(
    (e) => /\[\[[^\]]+\]\]/.test(e.content),
  ).length;

  // Shared basenames
  const sharedBasenames = findSharedBasenames(hermesPaths, obsidianPaths);

  // Unique files
  const hermesBasenameSet = new Set(
    hermesPaths.map((p) => p.split("/").pop()?.replace(/\.md$/i, "")?.toLowerCase() ?? ""),
  );
  const obsidianBasenameSet = new Set(
    obsidianPaths.map((p) => p.split("/").pop()?.replace(/\.md$/i, "")?.toLowerCase() ?? ""),
  );

  const uniqueToHermes = hermesPaths.filter(
    (p) => !obsidianBasenameSet.has(p.split("/").pop()?.replace(/\.md$/i, "")?.toLowerCase() ?? ""),
  );
  const uniqueToObsidian = obsidianPaths.filter(
    (p) => !hermesBasenameSet.has(p.split("/").pop()?.replace(/\.md$/i, "")?.toLowerCase() ?? ""),
  );

  return {
    generatedAt: new Date(nowMs ?? Date.now()).toISOString(),
    hermesVaultRoot: hermesRoot,
    obsidianVaultRoot: obsidianRoot,
    hermesFileCount: hermesEntries.length,
    obsidianFileCount: obsidianEntries.length,
    topics,
    gaps,
    obsidianStructuredFiles,
    hermesLinkedFiles,
    obsidianLinkedFiles,
    sharedBasenames,
    uniqueToHermes,
    uniqueToObsidian,
  };
}
