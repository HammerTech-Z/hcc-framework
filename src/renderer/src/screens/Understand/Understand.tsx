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
  metadata: {
    source: "inline" | "file";
    type: string;
    length: number;
    timestamp: string;
  };
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

  // Load history on mount
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
        // Refresh history
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
      setHistoryContent("Error loading file");
    }
  };

  const renderResult = (data: UnderstandingResult) => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
          <FileText size={14} />
          {t("understand.summary")}
        </h3>
        <p className="text-sm text-gray-200">{data.summary}</p>
      </div>

      {/* Metadata */}
      <div className="text-xs text-gray-500 flex gap-4">
        <span>{t("understand.source")}: {data.metadata.source}</span>
        <span>{t("understand.type")}: {data.metadata.type}</span>
        <span>{t("understand.length")}: {data.metadata.length} {t("understand.chars")}</span>
      </div>

      {/* Key Points */}
      {data.key_points.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-green-400 mb-2">
            {t("understand.keyPoints")} ({data.key_points.length})
          </h3>
          <ul className="text-sm text-gray-300 space-y-1">
            {data.key_points.map((point, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-green-500">•</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Entities */}
      {data.entities.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-purple-400 mb-2">
            {t("understand.entities")} ({data.entities.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.entities.map((entity, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs bg-purple-900/30 text-purple-300 rounded"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      {data.risks.length > 0 && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
            <AlertCircle size={14} />
            {t("understand.risks")} ({data.risks.length})
          </h3>
          <ul className="text-sm text-red-300 space-y-1">
            {data.risks.map((risk, i) => (
              <li key={i}>⚠️ {risk}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Todos */}
      {data.todos.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-yellow-400 mb-2">
            {t("understand.todos")} ({data.todos.length})
          </h3>
          <ul className="text-sm text-yellow-300 space-y-1">
            {data.todos.map((todo, i) => (
              <li key={i}>☐ {todo}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Playbook */}
      {data.suggested_playbook && (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
            <CheckCircle size={14} />
            {t("understand.suggestedPlaybook")}
          </h3>
          <div className="flex items-center gap-3">
            <code className="text-sm text-blue-300">{data.suggested_playbook}</code>
            <button
              type="button"
              onClick={() => {
                window.hermesAPI.runPlaybook(data.suggested_playbook!);
              }}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
            >
              {t("understand.runPlaybook")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          {t("understand.title")}
        </h2>
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded flex items-center gap-2"
        >
          <Clock size={14} />
          {t("understand.history")} ({history.length})
        </button>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">{t("understand.history")}</h3>
            <button
              type="button"
              aria-label="Close history"
              onClick={() => setShowHistory(false)}
              className="text-gray-500 hover:text-gray-300"
            >
              <X size={14} />
            </button>
          </div>
          {history.length === 0 ? (
            <p className="text-sm text-gray-500">{t("understand.noHistory")}</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {history.slice(0, 10).map((f) => (
                <button
                  key={f.filename}
                  type="button"
                  onClick={() => handleViewHistory(f.filename)}
                  className="w-full text-left px-3 py-2 bg-gray-700/50 hover:bg-gray-700 rounded text-sm"
                >
                  <div className="text-gray-300">{f.filename}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(f.modified).toLocaleString()} • {f.size} bytes
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Content Modal */}
      {selectedHistory && historyContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300">{selectedHistory}</h3>
              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setSelectedHistory(null);
                  setHistoryContent(null);
                }}
                className="text-gray-500 hover:text-gray-300"
              >
                <X size={14} />
              </button>
            </div>
            <pre className="text-sm text-gray-400 whitespace-pre-wrap font-mono">
              {historyContent}
            </pre>
          </div>
        </div>
      )}

      {/* Input Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setInputMode("inline")}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            inputMode === "inline"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {t("understand.inlineText")}
        </button>
        <button
          onClick={() => setInputMode("file")}
          className={`px-4 py-2 text-sm rounded transition-colors ${
            inputMode === "file"
              ? "bg-blue-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          {t("understand.filePath")}
        </button>
      </div>

      {/* Input */}
      <div className="space-y-3">
        {inputMode === "inline" ? (
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("understand.textPlaceholder")}
            className="w-full h-40 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y"
          />
        ) : (
          <input
            type="text"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            placeholder={t("understand.filePlaceholder")}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader size={14} className="animate-spin" />
              {t("understand.analyzing")}
            </>
          ) : (
            <>
              <FileText size={14} />
              {t("understand.analyze")}
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} />
            {t("understand.error")}
          </div>
          <p className="text-red-300 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && renderResult(result)}

      {/* Empty State */}
      {!result && !error && !loading && (
        <div className="text-center py-12 text-gray-500">
          <FileText size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm">
            {t("understand.emptyState")}
          </p>
        </div>
      )}
    </div>
  );
}
