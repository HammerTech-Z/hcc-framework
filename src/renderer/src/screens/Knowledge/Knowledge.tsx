import { useState, useCallback } from "react";
import { useI18n } from "../../components/useI18n";
import { Search, Plus } from "../../assets/icons";
import { Check, Loader2 } from "lucide-react";

interface SearchResult {
  file: string;
  score: number;
  preview: string;
}

export default function Knowledge() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingesting, setIngesting] = useState(false);
  const [ingestSuccess, setIngestSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "ingest">("search");

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await window.hermesAPI.knowledgeSearch(query, 10);
      setResults(res.results || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜索失败");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleIngest = useCallback(async () => {
    if (!ingestTitle.trim() || !ingestContent.trim()) return;
    setIngesting(true);
    setError(null);
    setIngestSuccess(false);
    try {
      const res = await window.hermesAPI.knowledgeIngest(ingestTitle, ingestContent);
      if (res.status === "ok" || res.status === "success") {
        setIngestSuccess(true);
        setIngestTitle("");
        setIngestContent("");
      } else {
        setError(res.message || "存入失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "存入失败");
    } finally {
      setIngesting(false);
    }
  }, [ingestTitle, ingestContent]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "search"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Search size={14} />
            {t("knowledge.search") || "搜索"}
          </div>
        </button>
        <button
          onClick={() => setActiveTab("ingest")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "ingest"
              ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text)]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Plus size={14} />
            {t("knowledge.ingest") || "存入"}
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "search" && (
          <div className="space-y-4">
            {/* Search input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
                className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t("knowledge.searchPlaceholder") || "输入关键词搜索知识库..."}
                disabled={loading}
              />
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? (t("knowledge.searching") || "搜索中...") : (t("knowledge.searchBtn") || "搜索")}
              </button>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] rounded text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            <div className="space-y-2">
              {results.length === 0 && !loading && !error && (
                <p className="text-[var(--text-secondary)] text-sm text-center py-8">
                  {t("knowledge.noResults") || "暂无结果"}
                </p>
              )}
              {results.map((r, i) => (
                <div
                  key={i}
                  className="p-3 border border-[var(--border)] rounded bg-[var(--bg-secondary)] hover:border-[var(--accent)] transition-colors"
                >
                  <p className="text-sm text-[var(--text)] line-clamp-3">{r.preview}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--text-secondary)] truncate max-w-[70%]">
                      {r.file.split("/").pop()}
                    </span>
                    <span className="text-xs text-[var(--accent)] font-mono">
                      {(r.score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "ingest" && (
          <div className="space-y-4">
            {/* Ingest form */}
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                {t("knowledge.titleLabel") || "标题"}
              </label>
              <input
                type="text"
                value={ingestTitle}
                onChange={(e) => setIngestTitle(e.target.value)}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
                placeholder={t("knowledge.titlePlaceholder") || "输入笔记标题..."}
                disabled={ingesting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text)] mb-1.5">
                {t("knowledge.contentLabel") || "内容"}
              </label>
              <textarea
                value={ingestContent}
                onChange={(e) => setIngestContent(e.target.value)}
                rows={8}
                className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                placeholder={t("knowledge.contentPlaceholder") || "输入笔记内容..."}
                disabled={ingesting}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-[var(--error-bg)] border border-[var(--error)] text-[var(--error)] rounded text-sm">
                {error}
              </div>
            )}

            {/* Success */}
            {ingestSuccess && (
              <div className="p-3 bg-[var(--success-bg)] border border-[var(--success)] text-[var(--success)] rounded text-sm flex items-center gap-2">
                <Check size={16} />
                {t("knowledge.ingestSuccess") || "已存入知识库"}
              </div>
            )}

            <button
              onClick={handleIngest}
              disabled={ingesting || !ingestTitle.trim() || !ingestContent.trim()}
              className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
            >
              {ingesting && <Loader2 size={14} className="animate-spin" />}
              {ingesting ? (t("knowledge.ingesting") || "存入中...") : (t("knowledge.ingestBtn") || "存入知识库")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}