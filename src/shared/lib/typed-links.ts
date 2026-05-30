// GBrain Typed Links — pure in-memory inference (MVP)
// No IPC, no persistence, no Vault/Knowledge writes, no LLM.

export type RelationType =
  | "elaborates"
  | "supersedes"
  | "depends_on"
  | "repeats";

export type KnowledgeKind =
  | "vault_file"
  | "understand_result"
  | "horizon_summary"
  | "failure_lesson";

export interface TypedLink {
  id: string;
  /** vault://{path} */
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  /** [0, 1]; < 0.7 flagged as low-confidence */
  confidence: number;
  /** Must be non-empty; links with empty evidence are not generated */
  evidence: string;
  createdAt: string; // ISO 8601
  sourceKind: KnowledgeKind;
  targetKind: KnowledgeKind;
}

export interface KnowledgeNode {
  /** vault://{path} */
  id: string;
  kind: KnowledgeKind;
  /** Normalized for similarity checks */
  title: string;
  /** Normalized for similarity checks */
  content: string;
  /** Raw path for path-hierarchy rules */
  path: string;
  /** Modification time (ms); used for supersedes ordering */
  mtime?: number;
  tags?: string[];
}

export interface DependencyFixture {
  dependencies?: Array<{ source: string; target: string }>;
}

/** Returns [0, 1] similarity or null if unavailable */
export type SimilarityProvider = (
  a: KnowledgeNode,
  b: KnowledgeNode
) => number | null;

// --- Helpers ---

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeTitle(filename: string): string {
  return normalize(filename.replace(/\.md$/, ""));
}

function extractHorizonDate(path: string): number | null {
  const m = path.match(/horizon-(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

// Visible for testing
export const STR = {
  inSubPathOf: (a: string, b: string) =>
    `\u201c${a}\u201d is in sub-path of \u201c${b}\u201d`,
  newerThan: (a: string, ad: string, b: string, bd: string) =>
    `\u201c${a}\u201d (${ad}) is newer than \u201c${b}\u201d (${bd})`,
  topicOverlap: (a: string, b: string) =>
    `\u201c${a}\u201d and \u201c${b}\u201d have topic overlap`,
  dependsOn: (a: string, b: string) =>
    `\u201c${a}\u201d depends on \u201c${b}\u201d`,
  repeatExact: (a: string, b: string) =>
    `\u201c${a}\u201d and \u201c${b}\u201d are near-duplicates (exact match)`,
  repeatSim: (a: string, b: string, pct: string) =>
    `\u201c${a}\u201d and \u201c${b}\u201d similarity ${pct}% (provider)`,
  unknownDate: "\u672a\u77e5",
  empty: "",
};

// ---------- inferTypedLinks ----------

export function inferTypedLinks(
  nodes: KnowledgeNode[],
  deps: DependencyFixture = {},
  similarityProvider?: SimilarityProvider
): TypedLink[] {
  const links: TypedLink[] = [];
  const now = new Date().toISOString();

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const horizonNodes = nodes.filter((n) => n.kind === "horizon_summary");
  const vaultNodes = nodes.filter((n) => n.kind === "vault_file");

  // --- elaborates: source is a descendant of target via path containment ---
  for (const source of nodes) {
    for (const target of nodes) {
      if (source.id === target.id) continue;
      // target.path is a proper prefix of source.path
      if (!source.path.startsWith(target.path + "/")) continue;

      const evidence = STR.inSubPathOf(source.title, target.title);
      if (!evidence.trim()) continue;

      links.push({
        id: `elaborates-${source.id}-${target.id}`,
        sourceId: source.id,
        targetId: target.id,
        relationType: "elaborates",
        confidence: 0.85,
        evidence,
        createdAt: now,
        sourceKind: source.kind,
        targetKind: target.kind,
      });
    }
  }

  // --- supersedes: horizon summary supersedes a vault file ---
  for (const horizon of horizonNodes) {
    const horizonDate = extractHorizonDate(horizon.path);
    for (const vault of vaultNodes) {
      // vault mtime must be a real known value (> Jan 1, 2000) for time-based supersedes
      const vaultDate = vault.mtime ?? 0;
      const vaultIsReal = vaultDate > 1000 * 60 * 60 * 24 * 365 * 30; // > year 2000
      const timeBased =
        horizonDate !== null && vaultIsReal && horizonDate > vaultDate;
      const titleBased =
        normalizeTitle(horizon.title).includes(normalizeTitle(vault.title)) ||
        normalizeTitle(vault.title).includes(normalizeTitle(horizon.title));

      if (!timeBased && !titleBased) continue;

      let evidence: string;
      if (timeBased && horizonDate !== null) {
        const hDate = new Date(horizonDate).toLocaleDateString("zh-CN");
        const vDate =
          vaultDate > 0
            ? new Date(vaultDate).toLocaleDateString("zh-CN")
            : STR.unknownDate;
        evidence = STR.newerThan(horizon.title, hDate, vault.title, vDate);
      } else {
        evidence = STR.topicOverlap(horizon.title, vault.title);
      }

      links.push({
        id: `supersedes-${horizon.id}-${vault.id}`,
        sourceId: horizon.id,
        targetId: vault.id,
        relationType: "supersedes",
        confidence: 0.8,
        evidence,
        createdAt: now,
        sourceKind: horizon.kind,
        targetKind: vault.kind,
      });
    }
  }

  // --- depends_on: from dependency fixture ---
  const depsList = deps.dependencies ?? [];
  for (const dep of depsList) {
    const source = nodeMap.get(dep.source);
    const target = nodeMap.get(dep.target);
    if (!source || !target) continue;
    if (!dep.source.trim() || !dep.target.trim()) continue;

    const evidence = STR.dependsOn(source.title, target.title);
    links.push({
      id: `depends_on-${dep.source}-${dep.target}`,
      sourceId: dep.source,
      targetId: dep.target,
      relationType: "depends_on",
      confidence: 0.9,
      evidence,
      createdAt: now,
      sourceKind: source.kind,
      targetKind: target.kind,
    });
  }

  // --- repeats: exact match fallback (always runs, no provider needed) ---
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      const exactMatch =
        normalize(a.title) === normalize(b.title) &&
        normalize(a.content.slice(0, 200)) ===
          normalize(b.content.slice(0, 200)) &&
        normalize(a.title).length > 3;

      if (!exactMatch) continue;

      const sim = similarityProvider
        ? similarityProvider(a, b)
        : null;
      if (sim !== null && sim < 1.0) continue;

      const score = sim !== null ? Math.max(sim, 1.0) : 1.0;
      const evidence = STR.repeatExact(a.title, b.title);

      links.push({
        id: `repeats-${a.id}-${b.id}`,
        sourceId: a.id,
        targetId: b.id,
        relationType: "repeats",
        confidence: score,
        evidence,
        createdAt: now,
        sourceKind: a.kind,
        targetKind: b.kind,
      });
    }
  }

  // --- repeats: injected similarity provider ---
  if (similarityProvider) {
    const THRESHOLD = 0.85;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        // Skip if exact-match fallback already handled this pair
        const wasExact =
          normalize(a.title) === normalize(b.title) &&
          normalize(a.content.slice(0, 200)) ===
            normalize(b.content.slice(0, 200)) &&
          normalize(a.title).length > 3;
        if (wasExact) continue;

        const sim = similarityProvider(a, b);
        if (sim === null) continue;

        const score = sim;
        if (score < THRESHOLD) continue;

        const evidence = STR.repeatSim(
          a.title,
          b.title,
          (score * 100).toFixed(1)
        );

        links.push({
          id: `repeats-${a.id}-${b.id}`,
          sourceId: a.id,
          targetId: b.id,
          relationType: "repeats",
          confidence: score,
          evidence,
          createdAt: now,
          sourceKind: a.kind,
          targetKind: b.kind,
        });
      }
    }
  }

  return links;
}

export function buildKnowledgeNodes(
  vaultFiles: Array<{
    path: string;
    name: string;
    size: number;
    mtime: number;
  }>,
  horizonFiles: Array<{
    path: string;
    name: string;
    size: number;
    mtime: number;
  }>,
  vaultFileContents: Map<string, string>,
  horizonFileContents: Map<string, string>
): KnowledgeNode[] {
  const nodes: KnowledgeNode[] = [];

  for (const f of vaultFiles) {
    const id = `vault://${f.path}`;
    const content = vaultFileContents.get(f.path) ?? "";
    nodes.push({
      id,
      kind: "vault_file",
      title: f.name,
      content,
      path: f.path,
      mtime: f.mtime,
    });
  }

  for (const f of horizonFiles) {
    const id = `vault://${f.path}`;
    const content = horizonFileContents.get(f.path) ?? "";
    nodes.push({
      id,
      kind: "horizon_summary",
      title: f.name,
      content,
      path: f.path,
      mtime: f.mtime,
    });
  }

  return nodes;
}