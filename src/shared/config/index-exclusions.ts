/**
 * P2.5 Index Exclusion Configuration
 *
 * Canonical source of truth for paths that must never be indexed or returned
 * as search results by the Knowledge/Vault/G brain retrieval pipeline.
 *
 * These rules are enforced at the scanner/indexer layer — NOT，靠提示词。
 *
 * 硬排除目标（P2.5 §12）：
 * - /过时计划/          — 过时计划目录
 * - /docs/archive/      — 归档目录
 * - *.before-*          — 历史备份文件
 * - .noindex marker     — 显式声明不索引
 * - .ignore marker      — 显式声明忽略
 * - HERMES-ARCHIVE-LOCK.md — 归档锁文件（所在目录整目录排除）
 *
 * 外部内容和归档内容只能作为历史证据，不能作为当前计划来源。
 */

/**
 * Path fragments that, when present in a file path, cause the file to be excluded
 * from vault indexing and search results.
 *
 * 这些路径片段对应 P2.5 §12 明确列出的硬排除目标。
 */
export const EXCLUDED_PATH_FRAGMENTS: readonly string[] = Object.freeze([
  // P2.5 §12 明确列出
  "/过时计划/",
  "/docs/archive/",
  // 系统目录（Obsidian 内部）
  "/.obsidian/",
  "/.trash/",
  // macOS Spotlight 元数据
  "/.DocumentRevisions-V1/",
  "/.MobileBackups/",
  "/.TemporaryItems/",
] as const);

/**
 * File name patterns (fnmatch-style) that cause a file to be excluded from
 * vault indexing and search results.
 */
export const EXCLUDED_FILE_NAME_PATTERNS: readonly string[] = Object.freeze([
  // P2.5 §12 明确列出
  "*.before-*",
  // 临时 / 锁文件
  "*.tmp",
  "*.swp",
  "*.bak",
  ".DS_Store",
  "Thumbs.db",
] as const);

/**
 * Directory-level marker files. If a directory contains any of these files,
 * the entire directory (and all its descendants) is excluded from indexing.
 *
 * P2.5 §12 明确列出：.noindex / .ignore / HERMES-ARCHIVE-LOCK.md
 */
export const EXCLUDED_DIR_MARKERS: readonly string[] = Object.freeze([
  ".noindex",
  ".ignore",
  "HERMES-ARCHIVE-LOCK.md",
] as const);

/**
 * Check whether a file path should be excluded from vault indexing purely
 * based on its path string — no filesystem access required.
 *
 * NOTE: Marker-based exclusion (.noindex / .ignore / HERMES-ARCHIVE-LOCK.md)
 * requires filesystem access (checking if the parent directory contains the
 * marker file). The TS pure function cannot stat(). The Python layer in
 * knowledge_agent.py._scan_vault() implements this part.
 * This function covers path-fragment and filename-pattern exclusions.
 *
 * @param filePath  - The full absolute or relative path string to check.
 * @param markers   - Unused in pure TS; marker exclusion is handled by Python.
 *                    Kept for API symmetry with the Python implementation.
 * @returns true if the file MUST NOT be indexed; false otherwise.
 */
export function shouldExcludeFromIndex(
  filePath: string,
  markers: readonly string[] = EXCLUDED_DIR_MARKERS,
): boolean {
  if (!filePath || typeof filePath !== "string") {
    return true;
  }

  // 1. Path fragment checks
  for (const fragment of EXCLUDED_PATH_FRAGMENTS) {
    if (filePath.includes(fragment)) {
      return true;
    }
  }

  // 2. File name pattern checks
  const fileName = getBaseName(filePath);
  for (const pattern of EXCLUDED_FILE_NAME_PATTERNS) {
    if (fnmatch(fileName, pattern)) {
      return true;
    }
  }

  // 3. Marker checks — delegated to Python layer (requires stat())
  void markers;

  return false;
}

/**
 * Returns a human-readable explanation of why a path was excluded, or null
 * if it was not excluded.
 */
export function explainIndexExclusion(
  filePath: string,
  markers: readonly string[] = EXCLUDED_DIR_MARKERS,
): string | null {
  if (!filePath || typeof filePath !== "string") {
    return "Invalid path: not a non-empty string";
  }

  // Path fragment match
  for (const fragment of EXCLUDED_PATH_FRAGMENTS) {
    if (filePath.includes(fragment)) {
      return `excluded: path contains "${fragment}" (P2.5 §12 hard rule)`;
    }
  }

  // File name pattern match
  const fileName = getBaseName(filePath);
  for (const pattern of EXCLUDED_FILE_NAME_PATTERNS) {
    if (fnmatch(fileName, pattern)) {
      return `excluded: filename matches "${pattern}" (P2.5 §12 hard rule)`;
    }
  }

  // Marker-based exclusion — delegated to Python layer
  void markers;

  return null;
}

/**
 * Returns the base name (last path segment) of a file path.
 */
function getBaseName(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
}

/**
 * Simple fnmatch: '*' matches any sequence of characters.
 * Supports: "*.before-*", "*.tmp", "*", etc.
 *
 * For patterns with '*' on both sides (e.g. "*.before-*" — prefix="" and suffix non-empty),
 * we check: name contains the substring AFTER the first '*'.
 * This is the correct interpretation for "*.before-*" = "filename contains .before-".
 */
function fnmatch(name: string, pattern: string): boolean {
  if (pattern === "*") return true;
  if (!pattern.includes("*")) return name === pattern;

  const starIdx = pattern.indexOf("*");
  const prefix = pattern.slice(0, starIdx);
  const suffix = pattern.slice(starIdx + 1);

  if (prefix === "") {
    // "*suffix" — for "*.before-*" this means: name contains "before-" (the literal part after *)
    // Strip any trailing '*' from suffix for the "contains" check (that '*' is the second wildcard)
    const literalSuffix = suffix.replace(/\*+$/, "");
    return name.includes(literalSuffix);
  }
  if (suffix === "") {
    // "prefix*" — name must start with prefix
    return name.startsWith(prefix);
  }
  // "prefix*suffix*" — name must start with prefix AND contain literal part of suffix
  const literalSuffix = suffix.replace(/\*+$/, "");
  return name.startsWith(prefix) && name.includes(literalSuffix);
}