import { useState, useCallback } from "react";
import { Search, Plus } from "../../assets/icons";
import { Check, Loader2 } from "lucide-react";
import { useI18n } from "../../components/useI18n";

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
    <div className="knowledge-container">
      {/* Tab bar */}
      <div className="knowledge-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("search")}
          className={`knowledge-tab${activeTab === "search" ? " active" : ""}`}
        >
          <Search size={14} />
          {t("knowledge.search")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ingest")}
          className={`knowledge-tab${activeTab === "ingest" ? " active" : ""}`}
        >
          <Plus size={14} />
          {t("knowledge.ingest")}
        </button>
      </div>

      {/* Content */}
      <div className="knowledge-content">
        {activeTab === "search" && (
          <>
            <div className="knowledge-search-row">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
                className="knowledge-search-input"
                placeholder={t("knowledge.searchPlaceholder")}
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="knowledge-search-btn"
              >
                {loading && <Loader2 size={14} className="loading-spinner" />}
                {loading ? t("knowledge.searching") : t("knowledge.searchBtn")}
              </button>
            </div>

            {error && <div className="knowledge-error">{error}</div>}

            <div className="knowledge-results">
              {results.length === 0 && !loading && !error && (
                <p className="knowledge-empty">{t("knowledge.noResults")}</p>
              )}
              {results.map((r, i) => (
                <div key={i} className="knowledge-result-item">
                  <p className="knowledge-result-preview">{r.preview}</p>
                  <div className="knowledge-result-footer">
                    <span className="knowledge-result-file">
                      {r.file.split("/").pop()}
                    </span>
                    <span className="knowledge-result-score">
                      {(r.score * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "ingest" && (
          <>
            <div className="knowledge-form-group">
              <label className="knowledge-form-label">{t("knowledge.titleLabel")}</label>
              <input
                type="text"
                value={ingestTitle}
                onChange={(e) => setIngestTitle(e.target.value)}
                className="knowledge-form-input"
                placeholder={t("knowledge.titlePlaceholder")}
                disabled={ingesting}
              />
            </div>
            <div className="knowledge-form-group">
              <label className="knowledge-form-label">{t("knowledge.contentLabel")}</label>
              <textarea
                value={ingestContent}
                onChange={(e) => setIngestContent(e.target.value)}
                rows={8}
                className="knowledge-form-input knowledge-form-textarea"
                placeholder={t("knowledge.contentPlaceholder")}
                disabled={ingesting}
              />
            </div>

            {error && <div className="knowledge-error">{error}</div>}

            {ingestSuccess && (
              <div className="knowledge-success">
                <Check size={16} />
                {t("knowledge.ingestSuccess")}
              </div>
            )}

            <button
              type="button"
              onClick={handleIngest}
              disabled={ingesting || !ingestTitle.trim() || !ingestContent.trim()}
              className="knowledge-ingest-btn"
            >
              {ingesting && <Loader2 size={14} className="loading-spinner" />}
              {ingesting ? t("knowledge.ingesting") : t("knowledge.ingestBtn")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
