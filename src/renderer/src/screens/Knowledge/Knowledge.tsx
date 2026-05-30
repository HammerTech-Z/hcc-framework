import { useState, useCallback } from "react";
import { Search, Plus, Brain } from "../../assets/icons";
import { Check, Loader2, FileText, RadioTower, Link } from "lucide-react";
import { useI18n } from "../../components/useI18n";
import type { KnowledgeNode, TypedLink } from "../../../../shared/lib/typed-links";
import { inferTypedLinks } from "../../../../shared/lib/typed-links";

interface SearchResult {
  file: string;
  score: number;
  preview: string;
}

interface VaultGroup {
  dir: string;
  files: Array<{ path: string; name: string; size: number; mtime: number }>;
}

interface VaultStats {
  totalFiles: number;
  totalSize: number;
  directories: Array<{ name: string; fileCount: number; latestUpdate: string }>;
}

interface GBrainStats {
  total_pages: number;
  total_chunks: number;
  by_type: Record<string, number>;
  timeline: Array<{ week: string; count: number }>;
  source: string;
  generated_at: string;
}

const DIR_ICON: Record<string, string> = {
  wiki: "📚",
  skills: "🛠️",
  "failure-lessons": "💥",
  raw: "📋",
};

// ---------------------------------------------------------------------------
// TypedLinksView — GBrain read-only typed links tab
// ---------------------------------------------------------------------------

const REL_TYPE_LABELS: Record<string, string> = {
  elaborates: "elaborates",
  supersedes: "supersedes",
  depends_on: "depends_on",
  repeats: "repeats",
};

function TypedLinksView() {
  const [links, setLinks] = useState<TypedLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build KnowledgeNode[] from vault files via preload IPC
      const groups = await window.hermesAPI.listVaultFiles();
      const nodes: KnowledgeNode[] = [];

      for (const group of groups) {
        for (const file of group.files) {
          const result = await window.hermesAPI.readVaultFile(file.path);
          if (result.content !== undefined) {
            // Determine kind from path
            const kind =
              file.path.includes("/tools/horizon-") || file.name.startsWith("horizon-")
                ? "horizon_summary"
                : file.path.includes("/failure-lessons/") || file.name.endsWith(".fl.json")
                ? "failure_lesson"
                : file.path.includes("/wiki/understand/") || file.path.includes("understand-")
                ? "understand_result"
                : "vault_file";

            // Extract title from filename or frontmatter
            const title =
              (result.frontmatter?.title as string) ||
              file.name.replace(/\.md$/, "").replace(/[-_]/g, " ");

            nodes.push({
              id: `vault://${file.path}`,
              kind,
              title,
              content: result.content,
              path: file.path,
              mtime: file.mtime,
            });
          }
        }
      }

      const inferred = inferTypedLinks(nodes);
      setLinks(inferred);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const grouped = links.reduce<Record<string, TypedLink[]>>((acc, link) => {
    (acc[link.relationType] ??= []).push(link);
    return acc;
  }, {});

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {links.length === 0 ? "无推断链接" : `${links.length} 条链接`}
        </span>
        <button
          type="button"
          onClick={loadLinks}
          style={{
            padding: "4px 12px",
            fontSize: 12,
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            cursor: "pointer",
          }}
        >
          {loading ? "计算中…" : "刷新"}
        </button>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
          <div className="loading-spinner" />
        </div>
      ) : error ? (
        <div className="knowledge-error">{error}</div>
      ) : links.length === 0 ? (
        <p className="knowledge-empty">暂无推断链接</p>
      ) : (
        <div>
          {(["elaborates", "supersedes", "depends_on", "repeats"] as const).map((rel) => {
            const items = grouped[rel];
            if (!items?.length) return null;
            return (
              <div key={rel} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 8,
                }}>
                  {REL_TYPE_LABELS[rel]} ({items.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((link) => {
                    const isCollapsed = collapsed.has(link.id);
                    const isLowConfidence = link.confidence < 0.7;
                    return (
                      <div
                        key={link.id}
                        className="knowledge-result-item"
                        style={{ padding: "8px 12px" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <Link size={12} style={{ flexShrink: 0, color: "var(--accent)" }} />
                              <span style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: "var(--text-primary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {link.sourceId.replace("vault://", "")}
                              </span>
                              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>→</span>
                              <span style={{
                                fontSize: 12,
                                color: "var(--text-secondary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}>
                                {link.targetId.replace("vault://", "")}
                              </span>
                              {isLowConfidence && (
                                <span style={{
                                  fontSize: 10,
                                  padding: "1px 5px",
                                  background: "var(--warning-bg, rgba(245,158,11,0.15))",
                                  color: "var(--warning, #f59e0b)",
                                  borderRadius: 4,
                                }}>
                                  低置信
                                </span>
                              )}
                            </div>
                            <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                              <span>置信: {link.confidence.toFixed(2)}</span>
                              {link.createdAt && <span>{new Date(link.createdAt).toLocaleDateString("zh-CN")}</span>}
                            </div>
                            {!isCollapsed && (
                              <div style={{
                                marginTop: 6,
                                fontSize: 11,
                                color: "var(--text-secondary)",
                                background: "var(--bg-secondary)",
                                borderRadius: 4,
                                padding: "4px 8px",
                                fontStyle: "italic",
                              }}>
                                {link.evidence}
                              </div>
                            )}
                          </div>
                          {link.evidence && (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(link.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: 10,
                                color: "var(--text-muted)",
                                padding: "2px 4px",
                                flexShrink: 0,
                              }}
                            >
                              {isCollapsed ? "证据" : "隐藏"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type KnowledgeTab = "search" | "ingest" | "vault" | "gbrain" | "horizon" | "links";

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
  const [activeTab, setActiveTab] = useState<KnowledgeTab>("search");

  // Vault state
  const [vaultGroups, setVaultGroups] = useState<VaultGroup[]>([]);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  // GBrain stats state
  const [gbrainStats, setGbrainStats] = useState<GBrainStats | null>(null);
  const [gbrainLoading, setGbrainLoading] = useState(false);
  const [gbrainError, setGbrainError] = useState<string | null>(null);

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

  // Vault loading
  const loadVault = useCallback(async () => {
    setVaultLoading(true);
    try {
      const [groups, stats] = await Promise.all([
        window.hermesAPI.listVaultFiles(),
        window.hermesAPI.getVaultStats(),
      ]);
      setVaultGroups(groups);
      setVaultStats(stats);
    } catch {
      /* ignore */
    } finally {
      setVaultLoading(false);
    }
  }, []);

  const handleVaultSelect = useCallback(async (filePath: string) => {
    if (selectedFile === filePath) {
      setSelectedFile(null);
      setFileContent(null);
      return;
    }
    setSelectedFile(filePath);
    setFileLoading(true);
    setFileContent(null);
    try {
      const res = await window.hermesAPI.readVaultFile(filePath);
      if (res.content) setFileContent(res.content);
    } catch {
      /* ignore */
    } finally {
      setFileLoading(false);
    }
  }, [selectedFile]);

  // GBrain stats loading
  const loadGBrain = useCallback(async () => {
    setGbrainLoading(true);
    setGbrainError(null);
    try {
      const stats = await window.hermesAPI.getGbrainStats();
      setGbrainStats(stats);
    } catch (err) {
      setGbrainError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setGbrainLoading(false);
    }
  }, []);

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
        <button
          type="button"
          onClick={() => { setActiveTab("vault"); loadVault(); }}
          className={`knowledge-tab${activeTab === "vault" ? " active" : ""}`}
        >
          <FileText size={14} />
          {t("knowledge.vault")}
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("gbrain"); loadGBrain(); }}
          className={`knowledge-tab${activeTab === "gbrain" ? " active" : ""}`}
        >
          <Brain size={14} />
          GBrain
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("horizon"); loadVault(); }}
          className={`knowledge-tab${activeTab === "horizon" ? " active" : ""}`}
        >
          <RadioTower size={14} />
          {t("knowledge.horizon")}
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("links"); }}
          className={`knowledge-tab${activeTab === "links" ? " active" : ""}`}
        >
          <Link size={14} />
          Links
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

        {activeTab === "vault" && (
          <>
            {vaultStats && vaultStats.totalFiles > 0 && (
              <div className="knowledge-result-item" style={{ background: "var(--bg-tertiary)", marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {vaultStats.totalFiles} files · {fmtSize(vaultStats.totalSize)} · {vaultStats.directories.length} directories
                </span>
              </div>
            )}

            {vaultLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div className="loading-spinner" />
              </div>
            ) : vaultGroups.length === 0 ? (
              <p className="knowledge-empty">{t("knowledge.vaultEmpty")}</p>
            ) : (
              vaultGroups.map((group) => (
                <div key={group.dir} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, padding: "0 4px" }}>
                    {DIR_ICON[group.dir] || "📄"} {group.dir}
                  </div>
                  {group.files.map((f) => (
                    <div key={f.path}>
                      <div className="knowledge-result-item" style={{ cursor: "pointer", marginBottom: 4 }} onClick={() => handleVaultSelect(f.path)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {f.name.replace(/\.md$/, "")}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>
                            {fmtDate(f.mtime)}
                          </span>
                        </div>
                      </div>
                      {selectedFile === f.path && (
                        <div className="knowledge-result-item" style={{ marginBottom: 8, background: "var(--bg-tertiary)" }}>
                          {fileLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                              <div className="loading-spinner" />
                            </div>
                          ) : fileContent ? (
                            <pre style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "var(--font-mono)", maxHeight: 300, overflowY: "auto", margin: 0 }}>
                              {fileContent.slice(0, 2000)}{fileContent.length > 2000 ? "\n...(truncated)" : ""}
                            </pre>
                          ) : (
                            <p className="knowledge-empty">{t("knowledge.vaultLoadError")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        )}

        {activeTab === "horizon" && (
          <>
            {vaultLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div className="loading-spinner" />
              </div>
            ) : (() => {
              const horizonGroup = vaultGroups.find(g => g.dir === "wiki/tools");
              const horizonFiles = horizonGroup
                ? horizonGroup.files.filter(f => f.name.toLowerCase().includes("horizon"))
                : [];
              return horizonFiles.length === 0 ? (
                <p className="knowledge-empty">{t("knowledge.horizonEmpty")}</p>
              ) : (
                <>
                  <div className="knowledge-result-item" style={{ background: "var(--bg-tertiary)", marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {t("knowledge.horizonRecent")} ({horizonFiles.length})
                    </span>
                  </div>
                  {horizonFiles.map((f) => (
                    <div key={f.path}>
                      <div className="knowledge-result-item" style={{ cursor: "pointer", marginBottom: 4 }} onClick={() => handleVaultSelect(f.path)}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 13, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                            {f.name.replace(/\.md$/, "")}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, marginLeft: 8 }}>
                            {fmtDate(f.mtime)} · {fmtSize(f.size)}
                          </span>
                        </div>
                      </div>
                      {selectedFile === f.path && (
                        <div className="knowledge-result-item" style={{ marginBottom: 8, background: "var(--bg-tertiary)" }}>
                          {fileLoading ? (
                            <div style={{ display: "flex", justifyContent: "center", padding: 16 }}>
                              <div className="loading-spinner" />
                            </div>
                          ) : fileContent ? (
                            <pre style={{ fontSize: 12, color: "var(--text-secondary)", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "var(--font-mono)", maxHeight: 300, overflowY: "auto", margin: 0 }}>
                              {fileContent.slice(0, 2000)}{fileContent.length > 2000 ? "\n...(truncated)" : ""}
                            </pre>
                          ) : (
                            <p className="knowledge-empty">{t("knowledge.horizonLoadError")}</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              );
            })()}
          </>
        )}

        {activeTab === "gbrain" && (
          <>
            {gbrainLoading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <div className="loading-spinner" />
              </div>
            ) : gbrainError ? (
              <div className="knowledge-error">{gbrainError}</div>
            ) : gbrainStats ? (
              <div>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                  <div className="knowledge-result-item" style={{ textAlign: "center", padding: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
                      {gbrainStats.total_pages.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("knowledge.gbrainPages")}</div>
                  </div>
                  <div className="knowledge-result-item" style={{ textAlign: "center", padding: 16 }}>
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)" }}>
                      {gbrainStats.total_chunks.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("knowledge.gbrainChunks")}</div>
                  </div>
                </div>

                {/* Type distribution */}
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  {t("knowledge.gbrainTypeDistribution")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                  {Object.entries(gbrainStats.by_type).map(([type, count]) => (
                    <div key={type} style={{
                      padding: "4px 10px",
                      background: "var(--bg-tertiary)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}>
                      <span style={{ color: "var(--text-secondary)" }}>{type}</span>
                      <span style={{ color: "var(--text-primary)", fontWeight: 600, marginLeft: 6 }}>
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Timeline */}
                {gbrainStats.timeline.length > 0 && (
                  <>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                      {t("knowledge.gbrainRecentActivity")}
                    </div>
                    <div className="knowledge-result-item" style={{ padding: 12 }}>
                      {gbrainStats.timeline.map((entry, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                          <span style={{ color: "var(--text-secondary)" }}>
                            {entry.week.split(" ")[0]}
                          </span>
                          <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                            {entry.count.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12, textAlign: "center" }}>
                  {t("knowledge.gbrainSource")}: {gbrainStats.source} · {new Date(gbrainStats.generated_at).toLocaleString()}
                </div>
              </div>
            ) : (
              <p className="knowledge-empty">{t("knowledge.gbrainNoData")}</p>
            )}
          </>
        )}

        {activeTab === "links" && (
          <TypedLinksView />
        )}
      </div>
    </div>
  );
}
