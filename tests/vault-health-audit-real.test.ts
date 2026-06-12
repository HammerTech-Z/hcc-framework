// Hermes Pro — Real Vault Health Audit (Phase 0)
// Reads real vault files, generates health report via vault-auditor + vault-bridge-auditor.
// Run: npx vitest run tests/vault-health-audit-real.test.ts
// Output saved to: docs/knowledge/vault-health-report-2026-06-12.md

import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  generateHealthReport,
  type VaultFileEntry,
} from "../src/shared/lib/vault-auditor";
import {
  generateBridgeReport,
  detectTopicCoverage,
  detectCrossVaultGaps,
  findSharedBasenames,
  countWikilinks,
  parseFrontmatter,
  type BridgeFileEntry,
} from "../src/shared/lib/vault-bridge-auditor";

// -----------------------------------------------------------------
// Config
// -----------------------------------------------------------------

const HERMES_VAULT_ROOT = path.resolve(
  process.env.HOME || "/Users/midoudou",
  ".hermes/vault/wiki",
);
const OBSIDIAN_VAULT_ROOT = path.resolve(
  process.env.HOME || "/Users/midoudou",
  "Desktop/赵铁锤的武器库",
);
const OUTPUT_PATH = path.resolve(
  __dirname,
  "../docs/knowledge/vault-health-report-2026-06-12.md",
);

// -----------------------------------------------------------------
// File Discovery
// -----------------------------------------------------------------

function discoverMdFiles(dir: string, maxFiles = 500): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...discoverMdFiles(full, maxFiles - files.length));
      } else if (entry.name.endsWith(".md")) {
        files.push(full);
      }
      if (files.length >= maxFiles) break;
    }
  } catch {
    // Directory may not exist
  }
  return files;
}

function readVaultEntries(root: string, vault: "hermes" | "obsidian"): BridgeFileEntry[] {
  const files = discoverMdFiles(root);
  return files.map((fp) => {
    try {
      const content = fs.readFileSync(fp, "utf-8");
      const stat = fs.statSync(fp);
      return {
        path: path.relative(root, fp),
        content,
        sizeBytes: stat.size,
        mtime: stat.mtimeMs,
        vault,
      };
    } catch {
      return null;
    }
  }).filter(Boolean) as BridgeFileEntry[];
}

// -----------------------------------------------------------------
// Report Formatting
// -----------------------------------------------------------------

function formatMarkdownReport(
  hermesReport: ReturnType<typeof generateHealthReport>,
  bridgeReport: ReturnType<typeof generateBridgeReport>,
): string {
  const lines: string[] = [];

  lines.push("# Hermes Pro — Vault Health Report");
  lines.push("");
  lines.push(`> Generated: ${hermesReport.generatedAt}`);
  lines.push(`> Hermes Vault: ${hermesReport.vaultRoot}`);
  lines.push(`> Obsidian Vault: ${bridgeReport.obsidianVaultRoot}`);
  lines.push("");

  // Section 1: Summary
  lines.push("## 1. Summary");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Hermes Vault files | ${hermesReport.totalFiles} |`);
  lines.push(`| Obsidian Vault files | ${bridgeReport.obsidianFileCount} |`);
  lines.push(`| Total wikilinks | ${hermesReport.totalWikilinks} |`);
  lines.push(`| Dead links | ${hermesReport.deadLinks.length} |`);
  lines.push(`| Dead link rate | ${(hermesReport.deadLinkRate * 100).toFixed(1)}% |`);
  lines.push(`| Ambiguous links | ${hermesReport.ambiguousLinks.length} |`);
  lines.push(`| Content overlap pairs | ${hermesReport.contentOverlaps.length} |`);
  lines.push(`| Dead directories | ${hermesReport.deadDirectories.length} |`);
  lines.push(`| Isolated files (no outbound links) | ${hermesReport.isolatedFiles.length} |`);
  lines.push(`| Orphan files (no inbound links) | ${hermesReport.orphanFiles.length} |`);
  lines.push(`| Cross-vault gaps | ${bridgeReport.gaps.length} |`);
  lines.push(`| Shared basenames | ${bridgeReport.sharedBasenames.length} |`);
  lines.push("");

  // Section 2: Dead Links
  lines.push("## 2. Dead Wikilinks");
  lines.push("");
  if (hermesReport.deadLinks.length === 0) {
    lines.push("No dead links found.");
  } else {
    lines.push("| Source File | Target | Line |");
    lines.push("|-------------|--------|------|");
    for (const link of hermesReport.deadLinks.slice(0, 50)) {
      lines.push(`| ${link.sourceFile} | \`${link.target}\` | ${link.line} |`);
    }
    if (hermesReport.deadLinks.length > 50) {
      lines.push(`| ... | +${hermesReport.deadLinks.length - 50} more | |`);
    }
  }
  lines.push("");

  // Section 3: Ambiguous Links
  lines.push("## 3. Ambiguous Wikilinks");
  lines.push("");
  if (hermesReport.ambiguousLinks.length === 0) {
    lines.push("No ambiguous links found.");
  } else {
    lines.push("| Source | Target | Candidates |");
    lines.push("|--------|--------|------------|");
    for (const link of hermesReport.ambiguousLinks) {
      lines.push(
        `| ${link.sourceFile} | \`${link.target}\` | ${link.candidates.join(", ")} |`,
      );
    }
  }
  lines.push("");

  // Section 4: Dead Directories
  lines.push("## 4. Dead Directories");
  lines.push("");
  if (hermesReport.deadDirectories.length === 0) {
    lines.push("All claimed directories have sufficient content.");
  } else {
    lines.push("| Directory | Claimed | Actual Files | Expected Min |");
    lines.push("|-----------|---------|-------------|-------------|");
    for (const dd of hermesReport.deadDirectories) {
      lines.push(
        `| \`${dd.path}\` | yes | ${dd.actualFileCount} | ${dd.expectedMinFiles} |`,
      );
    }
  }
  lines.push("");

  // Section 5: Staleness (Top 20 most stale)
  lines.push("## 5. Staleness Scores (Top 20)");
  lines.push("");
  lines.push("| File | Age (days) | Score | Category |");
  lines.push("|------|-----------|-------|----------|");
  for (const s of hermesReport.stalenessScores.slice(0, 20)) {
    lines.push(
      `| ${s.file} | ${s.ageDays.toFixed(1)} | ${(s.score * 100).toFixed(1)}% | ${s.category} |`,
    );
  }
  lines.push("");

  // Section 6: Content Overlaps
  lines.push("## 6. Content Overlaps (>80%)");
  lines.push("");
  if (hermesReport.contentOverlaps.length === 0) {
    lines.push("No significant content overlaps detected.");
  } else {
    lines.push("| File A | File B | Similarity | Shared Tokens |");
    lines.push("|--------|--------|-----------|---------------|");
    for (const o of hermesReport.contentOverlaps) {
      lines.push(
        `| ${o.fileA} | ${o.fileB} | ${(o.similarity * 100).toFixed(1)}% | ${o.sharedTokens} |`,
      );
    }
  }
  lines.push("");

  // Section 7: Cross-Vault Gaps
  lines.push("## 7. Cross-Vault Gaps");
  lines.push("");
  if (bridgeReport.gaps.length === 0) {
    lines.push("No cross-vault gaps detected.");
  } else {
    lines.push("| Topic | Present In | Severity | Suggestion |");
    lines.push("|-------|-----------|----------|------------|");
    for (const g of bridgeReport.gaps) {
      lines.push(
        `| ${g.topic} | ${g.presentIn} | ${g.severity} | ${g.suggestion} |`,
      );
    }
  }
  lines.push("");

  // Section 8: Topic Coverage
  lines.push("## 8. Topic Coverage");
  lines.push("");
  lines.push("| Topic | Hermes Files | Obsidian Files | Coverage |");
  lines.push("|-------|-------------|----------------|----------|");
  for (const t of bridgeReport.topics) {
    lines.push(
      `| ${t.name} | ${t.hermesFiles.length} | ${t.obsidianFiles.length} | ${t.coverage} |`,
    );
  }
  lines.push("");

  // Section 9: Obsidian Wikilink Stats
  lines.push("## 9. Obsidian Vault Wikilink Stats");
  lines.push("");
  lines.push(`- Files with wikilinks: ${bridgeReport.obsidianLinkedFiles} / ${bridgeReport.obsidianFileCount}`);
  lines.push(
    `- Files with frontmatter: ${bridgeReport.obsidianStructuredFiles} / ${bridgeReport.obsidianFileCount}`,
  );
  lines.push(`- Shared basenames between vaults: ${bridgeReport.sharedBasenames.length}`);
  lines.push("");

  return lines.join("\n");
}

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe("Real Vault Health Audit", () => {
  it("reads Hermes vault files", () => {
    const entries = readVaultEntries(HERMES_VAULT_ROOT, "hermes");
    expect(entries.length).toBeGreaterThan(0);
    console.log(`Hermes vault: ${entries.length} files`);
  });

  it("reads Obsidian vault files", () => {
    const entries = readVaultEntries(OBSIDIAN_VAULT_ROOT, "obsidian");
    expect(entries.length).toBeGreaterThan(0);
    console.log(`Obsidian vault: ${entries.length} files`);
  });

  it("generates and saves complete health report", () => {
    const hermesEntries = readVaultEntries(HERMES_VAULT_ROOT, "hermes");
    const obsidianEntries = readVaultEntries(OBSIDIAN_VAULT_ROOT, "obsidian");

    // Hermes vault audit
    const hermesVaultPaths = hermesEntries.map((e) => e.path);
    const indexClaims = [
      { path: "tools", description: "工具知识" },
      { path: "concepts", description: "概念知识" },
      { path: "patterns", description: "最佳实践 / 复用 SOP" },
      { path: "codebase", description: "项目级代码知识图谱" },
      { path: "design", description: "UI 设计基线" },
      { path: "learning", description: "学习摘要" },
      { path: "creative", description: "AI视频/编剧/摄影/导演笔记" },
      { path: "decisions", description: "项目决策和理由" },
      { path: "pitfalls", description: "踩坑记录" },
      { path: "synthesis", description: "跨主题合成" },
    ];

    const hermesReport = generateHealthReport({
      vaultRoot: HERMES_VAULT_ROOT,
      entries: hermesEntries.map((e) => ({
        path: e.path,
        content: e.content,
        sizeBytes: e.sizeBytes,
        mtime: e.mtime,
      })),
      indexClaims,
      knownPaths: hermesVaultPaths,
    });

    // Bridge audit
    const bridgeReport = generateBridgeReport({
      hermesRoot: HERMES_VAULT_ROOT,
      obsidianRoot: OBSIDIAN_VAULT_ROOT,
      hermesEntries,
      obsidianEntries,
    });

    // Output stats
    console.log(`\n=== Vault Health Audit Results ===`);
    console.log(`Hermes files: ${hermesReport.totalFiles}`);
    console.log(`Obsidian files: ${bridgeReport.obsidianFileCount}`);
    console.log(`Total wikilinks: ${hermesReport.totalWikilinks}`);
    console.log(`Dead links: ${hermesReport.deadLinks.length} (${(hermesReport.deadLinkRate * 100).toFixed(1)}%)`);
    console.log(`Ambiguous links: ${hermesReport.ambiguousLinks.length}`);
    console.log(`Content overlaps: ${hermesReport.contentOverlaps.length}`);
    console.log(`Dead directories: ${hermesReport.deadDirectories.length}`);
    console.log(`Isolated files: ${hermesReport.isolatedFiles.length}`);
    console.log(`Orphan files: ${hermesReport.orphanFiles.length}`);
    console.log(`Cross-vault gaps: ${bridgeReport.gaps.length}`);
    console.log(`Shared basenames: ${bridgeReport.sharedBasenames.length}`);

    // Generate markdown report
    const md = formatMarkdownReport(hermesReport, bridgeReport);

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, md, "utf-8");
    console.log(`\nReport saved to: ${OUTPUT_PATH}`);

    // Basic assertions
    expect(hermesReport.totalFiles).toBeGreaterThan(0);
    expect(bridgeReport.obsidianFileCount).toBeGreaterThan(0);
  });
});
