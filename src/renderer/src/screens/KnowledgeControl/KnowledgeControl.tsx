import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Database, FileSearch, ShieldCheck } from "lucide-react";
import {
  buildKnowledgeControlItem,
  type KnowledgeControlItem,
} from "./knowledge-control-model";
import KnowledgeColumn, { KNOWLEDGE_COLUMNS } from "./components/KnowledgeColumn";
import KnowledgeFilterBar from "./components/KnowledgeFilterBar";
import KnowledgeInspector from "./components/KnowledgeInspector";

type HermesApi = Window["hermesAPI"];
type VaultGroup = Awaited<ReturnType<HermesApi["listVaultFiles"]>>[number];
type VaultStats = Awaited<ReturnType<HermesApi["getVaultStats"]>>;
type GBrainStats = Awaited<ReturnType<HermesApi["getGbrainStats"]>>;
type SearchResult = Awaited<ReturnType<HermesApi["knowledgeSearch"]>>["results"][number];
type VaultFileResult = Awaited<ReturnType<HermesApi["readVaultFile"]>>;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function matchesFilter(item: KnowledgeControlItem, filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "stale") return item.stale;
  return item.sourceType === filter;
}

export default function KnowledgeControl(): React.JSX.Element {
  const [items, setItems] = useState<KnowledgeControlItem[]>([]);
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [gbrainStats, setGbrainStats] = useState<GBrainStats | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groups, vaultStats, gbrain] = await Promise.all([
        window.hermesAPI.listVaultFiles(),
        window.hermesAPI.getVaultStats().catch(() => null),
        window.hermesAPI.getGbrainStats().catch(() => null),
      ]);

      const fileInputs = await Promise.all(
        groups.flatMap((group: VaultGroup) =>
          group.files.map(async (file) => {
            const result = await window.hermesAPI
              .readVaultFile(file.path)
              .catch((): VaultFileResult => ({}));
            return {
              path: file.path,
              name: file.name,
              dir: group.dir,
              size: file.size,
              mtime: file.mtime,
              content: result.content,
              frontmatter: result.frontmatter ?? null,
            };
          }),
        ),
      );

      const nextItems = fileInputs
        .map(buildKnowledgeControlItem)
        .sort((a, b) => b.mtime - a.mtime);

      setItems(nextItems);
      setStats(vaultStats);
      setGbrainStats(gbrain);
      setSelectedId((current) => current && nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Knowledge Control");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  const runSearch = useCallback(async (value: string) => {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    const result = await window.hermesAPI.knowledgeSearch(value, 6).catch(() => null);
    setSearchResults(result?.results ?? []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runSearch(query);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, runSearch]);

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    return items.filter((item) => {
      const textMatch =
        !text ||
        item.title.toLowerCase().includes(text) ||
        item.path.toLowerCase().includes(text) ||
        item.preview.toLowerCase().includes(text);
      return textMatch && matchesFilter(item, activeFilter);
    });
  }, [activeFilter, items, query]);

  const selected = items.find((item) => item.id === selectedId) ?? null;
  const totalSize = stats?.totalSize ?? items.reduce((sum, item) => sum + item.size, 0);
  const verifiedCount = items.filter((item) => item.trustLevel === "verified" || item.trustLevel === "authoritative").length;
  const staleCount = items.filter((item) => item.stale).length;

  return (
    <div className="knowledge-control-container">
      <div className="knowledge-control-hero">
        <div>
          <div className="knowledge-control-eyebrow">Local Knowledge OS</div>
          <h1>Knowledge Control</h1>
          <p>
            Read-only board for vault inventory, provenance, trust, stale state,
            and answer policy. Ingest remains in the existing Knowledge screen.
          </p>
        </div>
        <div className="knowledge-control-boundary">
          Read-only · No ingest writes · No live flush · No board writes
        </div>
      </div>

      <div className="knowledge-control-stats">
        <div className="knowledge-control-stat">
          <Database size={14} />
          <strong>{stats?.totalFiles ?? items.length}</strong>
          <span>vault files</span>
        </div>
        <div className="knowledge-control-stat">
          <ShieldCheck size={14} />
          <strong>{verifiedCount}</strong>
          <span>verified</span>
        </div>
        <div className="knowledge-control-stat">
          <FileSearch size={14} />
          <strong>{staleCount}</strong>
          <span>stale</span>
        </div>
        <div className="knowledge-control-stat">
          <Brain size={14} />
          <strong>{gbrainStats?.total_chunks ?? 0}</strong>
          <span>gbrain chunks</span>
        </div>
        <div className="knowledge-control-stat">
          <span className="knowledge-control-stat-dot" />
          <strong>{formatSize(totalSize)}</strong>
          <span>vault size</span>
        </div>
      </div>

      <KnowledgeFilterBar
        query={query}
        activeFilter={activeFilter}
        loading={loading}
        onQueryChange={setQuery}
        onFilterChange={setActiveFilter}
        onRefresh={loadBoard}
      />

      {error && <div className="knowledge-control-error">{error}</div>}

      <div className="knowledge-control-workspace">
        <div className="knowledge-control-board">
          {KNOWLEDGE_COLUMNS.map((column) => (
            <KnowledgeColumn
              key={column}
              lifecycle={column}
              items={filteredItems.filter((item) => item.lifecycle === column)}
              selectedId={selectedId}
              onSelect={(item) => setSelectedId(item.id)}
            />
          ))}
        </div>
        <KnowledgeInspector item={selected} />
      </div>

      <div className="knowledge-control-search-summary">
        <span>Read-only search preview</span>
        {searchResults.length === 0 ? (
          <em>No gateway search results for the current filter.</em>
        ) : (
          searchResults.map((result) => (
            <div key={`${result.file}-${result.score}`} className="knowledge-control-search-hit">
              <strong>{result.file}</strong>
              <span>{result.preview}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
