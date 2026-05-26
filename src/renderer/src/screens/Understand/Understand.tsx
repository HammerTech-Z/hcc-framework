import { useState, useCallback, useEffect } from "react";
import { FileText, AlertCircle, CheckCircle, Loader, Clock, X } from "lucide-react";
import { useI18n } from "../../components/useI18n";

interface UnderstandingResult {
  summary: string;
  key_points: string[];
  entities: string[];
  risks: string[];
  todos: string[];
  suggested_playbook: string | null;
  suggested_playbook_reasoning?: string;
  confidence?: number;
  metadata: {
    source: "inline" | "file";
    type: string;
    length: number;
    timestamp: string;
  };
  saved_to_vault?: boolean;
}

interface HistoryFile {
  filename: string;
  modified: string;
  size: number;
}

type InputMode = "inline" | "file";

export default function Understand(): React.JSX.Element {
  const { t } = useI18n();
  const [inputMode, setInputMode] = useState<InputMode>("inline");
  const [input, setInput] = useState("");
  const [filePath, setFilePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UnderstandingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryFile[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [historyContent, setHistoryContent] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    window.hermesAPI.listUnderstandingHistory().then((res) => {
      setHistory(res.files || []);
    });
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (loading) return;
    const textToAnalyze = inputMode === "inline" ? input : "";
    const path = inputMode === "file" ? filePath : undefined;
    if (!textToAnalyze.trim() && !path?.trim()) {
      setError(t("understand.emptyState"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await window.hermesAPI.understandAnything(textToAnalyze, path);
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
        const hist = await window.hermesAPI.listUnderstandingHistory();
        setHistory(hist.files || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [input, filePath, inputMode, loading, t]);

  const handleViewHistory = async (filename: string) => {
    setSelectedHistory(filename);
    const res = await window.hermesAPI.readUnderstandingHistory(filename);
    if (res.content) {
      setHistoryContent(res.content);
    } else {
      setHistoryContent(t("understand.loadError"));
    }
  };

  const renderResult = (data: UnderstandingResult) => (
    <div className="space-y-4">
      <div className="understand-card">
        <h3 className="understand-card-label">
          <FileText size={14} />
          {t("understand.summary")}
        </h3>
        <p className="understand-card-text">{data.summary}</p>
      </div>

      <div className="understand-meta">
        <span>{t("understand.source")}: {data.metadata.source}</span>
        <span>{t("understand.type")}: {data.metadata.type}</span>
        <span>{t("understand.length")}: {data.metadata.length} {t("understand.chars")}</span>
      </div>

      {typeof data.saved_to_vault === "boolean" && (
        <div className={data.saved_to_vault ? "understand-card" : "card-risk"}>
          <div
            className="understand-card-label"
            style={{ color: data.saved_to_vault ? "var(--success)" : "var(--error)" }}
          >
            {data.saved_to_vault ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {data.saved_to_vault ? t("understand.savedToVault") : t("understand.saveFailed")}
          </div>
        </div>
      )}

      {data.key_points.length > 0 && (
        <div className="understand-card">
          <h3 className="understand-card-label">
            {t("understand.keyPoints")} ({data.key_points.length})
          </h3>
          <ul className="understand-card-text" style={{ paddingLeft: 16 }}>
            {data.key_points.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {data.entities.length > 0 && (
        <div className="understand-card">
          <h3 className="understand-card-label">
            {t("understand.entities")} ({data.entities.length})
          </h3>
          <div className="flex-gap-3" style={{ flexWrap: "wrap" }}>
            {data.entities.map((entity, i) => (
              <span key={i} className="tag-entity">{entity}</span>
            ))}
          </div>
        </div>
      )}

      {data.risks.length > 0 && (
        <div className="card-risk">
          <h3 className="understand-card-label" style={{ color: "var(--error)" }}>
            <AlertCircle size={14} />
            {t("understand.risks")} ({data.risks.length})
          </h3>
          <div style={{ color: "var(--error)", fontSize: 13 }}>
            {data.risks.map((risk, i) => <div key={i}>⚠️ {risk}</div>)}
          </div>
        </div>
      )}

      {data.todos.length > 0 && (
        <div className="card-todo">
          <h3 className="understand-card-label" style={{ color: "var(--warning)" }}>
            {t("understand.todos")} ({data.todos.length})
          </h3>
          <div style={{ color: "var(--warning)", fontSize: 13 }}>
            {data.todos.map((todo, i) => <div key={i}>☐ {todo}</div>)}
          </div>
        </div>
      )}

      {data.suggested_playbook && (
        <div className="understand-card">
          <h3 className="understand-card-label">
            <CheckCircle size={14} />
            {t("understand.suggestedPlaybook")}
          </h3>
          <div className="flex-gap-3">
            <code style={{ color: "var(--accent)", fontSize: 13 }}>{data.suggested_playbook}</code>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => window.hermesAPI.runPlaybook(data.suggested_playbook!)}
            >
              {t("understand.runPlaybook")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="understand-container">
      <div className="understand-header">
        {t("understand.title")}
        <button type="button" className="understand-history-btn" onClick={() => setShowHistory(!showHistory)}>
          <Clock size={14} />
          {t("understand.history")} ({history.length})
        </button>
      </div>

      {showHistory && (
        <div className="understand-history-panel" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{t("understand.history")}</h3>
            <button type="button" aria-label={t("understand.close")} onClick={() => setShowHistory(false)}
              style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
              <X size={14} />
            </button>
          </div>
          {history.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("understand.noHistory")}</p>
          ) : (
            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {history.slice(0, 10).map((f) => (
                <button key={f.filename} type="button" className="understand-history-item"
                  onClick={() => handleViewHistory(f.filename)}>
                  <div>{f.filename}</div>
                  <div className="understand-history-meta">
                    {new Date(f.modified).toLocaleString()} &bull; {f.size} {t("understand.bytes")}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedHistory && historyContent && (
        <div className="understand-modal-overlay">
          <div className="understand-modal">
            <div className="understand-modal-header">
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{selectedHistory}</h3>
              <button type="button" aria-label={t("understand.close")}
                onClick={() => { setSelectedHistory(null); setHistoryContent(null); }}
                style={{ color: "var(--text-muted)", cursor: "pointer", background: "none", border: "none" }}>
                <X size={14} />
              </button>
            </div>
            <pre className="understand-modal-content">{historyContent}</pre>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button"
          className={`btn ${inputMode === "inline" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setInputMode("inline")}>
          {t("understand.inlineText")}
        </button>
        <button type="button"
          className={`btn ${inputMode === "file" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setInputMode("file")}>
          {t("understand.filePath")}
        </button>
      </div>

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
        {inputMode === "inline" ? (
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={t("understand.textPlaceholder")} className="understand-area" />
        ) : (
          <input type="text" value={filePath} onChange={(e) => setFilePath(e.target.value)}
            placeholder={t("understand.filePlaceholder")} className="input" />
        )}
        <button type="button" className="btn btn-primary" disabled={loading} onClick={handleAnalyze}
          style={{ alignSelf: "flex-start" }}>
          {loading
            ? <><Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> {t("understand.analyzing")}</>
            : <><FileText size={14} /> {t("understand.analyze")}</>}
        </button>
      </div>

      {error && <div className="card-risk" style={{ marginTop: 16 }}>
        <div className="understand-card-label" style={{ color: "var(--error)" }}>
          <AlertCircle size={14} /> {t("understand.error")}
        </div>
        <p style={{ color: "var(--error)", fontSize: 13, marginTop: 4 }}>{error}</p>
      </div>}

      {result && <div style={{ marginTop: 16 }}>{renderResult(result)}</div>}

      {!result && !error && !loading && (
        <div className="understand-empty">
          <FileText size={48} style={{ display: "block", margin: "0 auto 16px", opacity: 0.3 }} />
          <p>{t("understand.emptyState")}</p>
        </div>
      )}
    </div>
  );
}
