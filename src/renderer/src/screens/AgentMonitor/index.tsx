import { useEffect, useState } from "react";
import { useI18n } from "../../components/useI18n";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useChartColors } from "../../hooks/useChartColors";

interface GatewayState {
  pid: number;
  kind: string;
  gateway_state: string;
  active_agents: number;
  platforms: Record<string, { state: string }>;
  updated_at: string;
}

interface VaultGroup {
  dir: string;
  files: { path: string; name: string; size: number; mtime: number }[];
}

interface CronRun {
  jobId: string;
  time: string;
  failed: boolean;
  preview: string;
}

interface EventEntry {
  ts: string;
  event: string;
  task_id?: string;
  role?: string;
  [k: string]: unknown;
}

interface CachedSession {
  id: string;
  title: string;
  startedAt: number;
  source: string;
  messageCount: number;
  model: string;
}

interface DailyTrend {
  date: string;
  sessions: number;
  messages: number;
  label: string;
}

interface PipelineRunInfo {
  runId: string;
  taskName: string;
  status: string;
  conclusion: string;
  kind: string;
  loopType: string;
  createdAt: string;
  updatedAt: string;
  artifactCount: number;
  artifacts: { name: string; path: string }[];
}

const PLATFORM_DISPLAY: Record<string, { label: string; icon: string }> = {
  weixin: { label: "微信", icon: "💬" },
  wecom: { label: "企微", icon: "🏢" },
  api: { label: "API", icon: "🔌" },
  api_server: { label: "API", icon: "🔌" },
  telegram: { label: "TG", icon: "✈️" },
};

const DIR_ICON: Record<string, string> = {
  wiki: "📚",
  skills: "🛠️",
  "failure-lessons": "💥",
};

function timeAgo(ts: string): string {
  const d = new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function fmtMtime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function buildTrends(sessions: CachedSession[], t: (key: string) => string): DailyTrend[] {
  const days: Record<string, { sessions: number; messages: number; label: string }> = {};
  const now = Date.now();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? t("monitor.time.today")
        : i === 1
          ? t("monitor.time.yesterday")
          : d.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
    days[key] = { sessions: 0, messages: 0, label };
  }
  for (const s of sessions) {
    const key = new Date(s.startedAt).toISOString().slice(0, 10);
    if (days[key]) {
      days[key].sessions += 1;
      days[key].messages += s.messageCount || 0;
    }
  }
  return Object.entries(days).map(([date, data]) => ({ date, ...data }));
}

export default function AgentMonitor() {
  const { t } = useI18n();
  const chartColors = useChartColors();
  const [gw, setGw] = useState<GatewayState | null>(null);
  const [vault, setVault] = useState<VaultGroup[]>([]);
  const [cronHistory, setCronHistory] = useState<CronRun[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [health, setHealth] = useState<number | null>(null);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current execution tracking
  interface ExecStep {
    id: string;
    label: string;
    status: string;
    hccStage?: string;
    output?: string;
    error?: string;
  }
  interface ExecState {
    steps: ExecStep[];
    overallStatus: "running" | "done" | "error";
    startTime: number;
    endTime?: number;
    errorMessage?: string;
    runId?: string;
    playbookName?: string;
  }
  const [exec, setExec] = useState<ExecState | null>(null);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRunInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [gwRes, vaultRes, cronRes, evRes, sessions] = await Promise.all([
          window.hermesAPI.getGatewayState(),
          window.hermesAPI.listVaultFiles(),
          window.hermesAPI.getCronJobHistory(50),
          window.hermesAPI.getEvents(30),
          window.hermesAPI.listCachedSessions(500),
        ]);
        if (cancelled) return;
        if (gwRes) setGw(gwRes);
        if (vaultRes) setVault(vaultRes);
        if (cronRes) setCronHistory(cronRes);
        if (evRes) setEvents(evRes);
        if (sessions) setTrends(buildTrends(sessions, t));
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadPipelineRuns() {
      try {
        const runs = await window.hermesAPI.listPipelineRuns(50);
        if (!cancelled) setPipelineRuns(runs);
      } catch {
        if (!cancelled) setPipelineRuns([]);
      }
    }

    async function checkHealth(retried = false) {
      try {
        const r = await window.hermesAPI.checkGatewayHealth();
        if (cancelled) return;
        setHealth(r.status);
        if (r.status !== 200 && !retried) {
          setTimeout(() => checkHealth(true), 5000);
        }
      } catch {
        if (!cancelled) setHealth(0);
      }
    }

    load();
    loadPipelineRuns();
    checkHealth();
    const dataInterval = setInterval(load, 30000);
    const pipelineInterval = setInterval(loadPipelineRuns, 30000);
    const healthInterval = setInterval(() => checkHealth(), 30000);
    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(pipelineInterval);
      clearInterval(healthInterval);
    };
  }, []);

  // Subscribe to playbook execution events
  useEffect(() => {
    const cleanups: Array<() => void> = [];

    if (window.hermesAPI?.onPlaybookStep) {
      cleanups.push(
        window.hermesAPI.onPlaybookStep((step) => {
          setExec((prev) => {
            const now = Date.now();
            // First step starts a new tracking session
            if (!prev || prev.overallStatus === "done" || prev.overallStatus === "error") {
              return {
                steps: [{
                  id: step.id,
                  label: step.label,
                  status: step.status,
                  hccStage: step.hccStage,
                  output: step.output,
                  error: step.error,
                }],
                overallStatus: "running",
                startTime: now,
              };
            }
            // Update existing step or append new one
            const idx = prev.steps.findIndex((s) => s.id === step.id);
            const entry = { id: step.id, label: step.label, status: step.status, hccStage: step.hccStage, output: step.output, error: step.error };
            const steps = idx >= 0
              ? prev.steps.map((s, i) => (i === idx ? entry : s))
              : [...prev.steps, entry];
            return { ...prev, steps };
          });
        }),
      );
    }

    if (window.hermesAPI?.onPlaybookDone) {
      cleanups.push(
        window.hermesAPI.onPlaybookDone((result) => {
          setExec((prev) => prev ? { ...prev, overallStatus: "done", endTime: Date.now(), runId: result.runId } : null);
        }),
      );
    }

    if (window.hermesAPI?.onPlaybookError) {
      cleanups.push(
        window.hermesAPI.onPlaybookError((err) => {
          setExec((prev) => prev ? { ...prev, overallStatus: "error", endTime: Date.now(), errorMessage: err } : null);
        }),
      );
    }

    return () => cleanups.forEach((fn) => fn());
  }, []);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full"
        style={{ color: "var(--text-muted)" }}
      >
        {t("monitor.loading")}
      </div>
    );
  }

  const totalSessions = trends.reduce((s, t) => s + t.sessions, 0);
  const totalMessages = trends.reduce((s, t) => s + t.messages, 0);
  const activeDays = trends.filter((t) => t.sessions > 0).length;

  function fmtElapsed(start: number, end?: number): string {
    const sec = Math.floor(((end ?? Date.now()) - start) / 1000);
    if (sec < 60) return `${sec}s`;
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  }

  const HCC_COLORS: Record<string, string> = {
    stage_5_claude_code_execute: "#7C3AED",
    stage_6_review_test: "#D97706",
    stage_7_delivery: "#059669",
  };

  return (
    <div className="monitor-container custom-scrollbar">
      {/* Header */}
      <div className="monitor-header">
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {t("monitor.title")}
          </h1>
          <p className="monitor-summary-label" style={{ margin: "2px 0 0" }}>
            {t("monitor.subtitle")}
          </p>
        </div>
      </div>

      {error && <div className="monitor-error">{error}</div>}

      {/* Summary row */}
      <div className="monitor-summary-row">
        {[
          { label: t("monitor.summary.activeDays"), value: activeDays.toString() },
          { label: t("monitor.summary.sessions"), value: totalSessions.toLocaleString() },
          { label: t("monitor.summary.messages"), value: totalMessages.toLocaleString() },
          {
            label: t("monitor.summary.gateway"),
            value: health === 200 ? t("monitor.status.online") : health === null ? "..." : t("monitor.status.offline"),
            valueColor: health === 200 ? "var(--success)" : "var(--error)",
          },
          { label: t("monitor.summary.activeAgents"), value: (gw?.active_agents ?? "?").toString() },
        ].map((m) => (
          <div key={m.label} className="monitor-summary-card">
            <div
              className="monitor-summary-value"
              style={m.valueColor ? { color: m.valueColor } : undefined}
            >
              {m.value}
            </div>
            <div className="monitor-summary-label">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Current Execution */}
      <div className="settings-section">
        <div className="settings-section-title">{t("monitor.execution.title")}</div>
        {!exec ? (
          <div className="monitor-empty">{t("monitor.execution.noActive")}</div>
        ) : (
          <>
            <div className="monitor-exec-header">
              <span className="monitor-exec-name">
                {exec.playbookName || `Run ${exec.runId || ""}`}
              </span>
              <span
                className="monitor-exec-status"
                style={{
                  color: exec.overallStatus === "running"
                    ? "var(--accent-text)"
                    : exec.overallStatus === "done"
                      ? "var(--success)"
                      : "var(--error)",
                }}
              >
                {exec.overallStatus === "running"
                  ? t("monitor.execution.running")
                  : exec.overallStatus === "done"
                    ? t("monitor.execution.completed")
                    : t("monitor.execution.failed")}
                {exec.overallStatus === "running" && ` · ${fmtElapsed(exec.startTime)}`}
                {exec.endTime && ` · ${fmtElapsed(exec.startTime, exec.endTime)}`}
              </span>
            </div>
            <div className="monitor-exec-steps">
              {exec.steps.map((step) => (
                <div key={step.id} className="monitor-exec-step">
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#fff",
                      flexShrink: 0,
                      background:
                        step.status === "success"
                          ? "var(--success)"
                          : step.status === "failed"
                            ? "var(--error)"
                            : step.status === "running"
                              ? "var(--accent)"
                              : "var(--text-muted)",
                    }}
                  >
                    {step.status === "success" ? "✓" : step.status === "failed" ? "✗" : ""}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="monitor-exec-step-label">
                      {step.label}
                      {step.hccStage && HCC_COLORS[step.hccStage] && (
                        <span
                          className="monitor-hcc-badge"
                          style={{
                            background: `${HCC_COLORS[step.hccStage]}22`,
                            color: HCC_COLORS[step.hccStage],
                          }}
                        >
                          {step.hccStage.replace("stage_5", "HCC-5").replace("stage_6", "HCC-6").replace("stage_7", "HCC-7")}
                        </span>
                      )}
                    </div>
                    {step.output && (
                      <div className="monitor-exec-step-output">{step.output}</div>
                    )}
                    {step.error && (
                      <div className="monitor-exec-step-error">{step.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {exec.errorMessage && (
              <div className="monitor-exec-step-error" style={{ marginTop: 8 }}>
                {exec.errorMessage}
              </div>
            )}
          </>
        )}
      </div>

      {/* Session Trends */}
      <div className="settings-section">
        <div className="settings-section-title">{t("monitor.charts.sessionTrends")}</div>
        <div className="monitor-chart-container">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trends} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.background} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: chartColors.muted }}
                axisLine={{ stroke: chartColors.background }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: chartColors.muted }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                }}
                labelStyle={{ color: chartColors.secondary }}
                cursor={{ fill: chartColors.background }}
              />
              <Bar
                dataKey="sessions"
                fill={chartColors.primary}
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* System Status */}
      <div className="settings-section">
        <div className="settings-section-title">{t("monitor.system.title")}</div>
        <div className="monitor-badge-group">
          <MonitorBadge
            label={t("monitor.system.gateway", { state: gw?.gateway_state || "unknown" })}
            ok={gw?.gateway_state === "running"}
            suffix={gw?.pid ? t("monitor.system.pid", { pid: gw.pid }) : undefined}
          />
          <MonitorBadge
            label={t("monitor.system.health")}
            ok={health === 200}
            suffix={health === 200 ? "200" : health === null ? "..." : t("monitor.status.down")}
          />
          {gw?.platforms &&
            Object.entries(gw.platforms).map(([name, p]) => {
              const display = PLATFORM_DISPLAY[name] || { label: name, icon: "📡" };
              return (
                <MonitorBadge
                  key={name}
                  label={`${display.icon} ${display.label}`}
                  ok={p.state === "connected" || p.state === "running"}
                />
              );
            })}
        </div>
        {gw?.updated_at && (
          <div className="monitor-updated-at">
            {t("monitor.time.updated", { time: timeAgo(gw.updated_at) })}
          </div>
        )}
      </div>

      {/* Flywheel + Knowledge */}
      <div className="monitor-row">
        <div className="settings-section monitor-panel">
          <div className="settings-section-title">{t("monitor.flywheel.title")}</div>
          <div className="monitor-list">
            {(cronHistory || []).slice(0, 20).map((run, i) => (
              <div key={i} className="monitor-list-item">
                <span
                  className="monitor-list-icon"
                  style={{
                    color: run.failed ? "var(--error)" : "var(--success)",
                  }}
                >
                  {run.failed ? "✕" : "✓"}
                </span>
                <span className="monitor-list-mono" style={{ width: "48px" }}>
                  {run.jobId.slice(0, 8)}
                </span>
                <span className="monitor-list-time">
                  {run.time ? timeAgo(run.time) : ""}
                </span>
                <span className="monitor-list-desc">
                  {run.preview.replace(/^# Cron Job:\s*/, "").slice(0, 60)}
                </span>
              </div>
            ))}
            {(!cronHistory || cronHistory.length === 0) && (
              <div className="monitor-empty">{t("monitor.flywheel.empty")}</div>
            )}
          </div>
        </div>

        <div className="settings-section monitor-panel">
          <div className="settings-section-title">{t("monitor.knowledge.title")}</div>
          <div className="monitor-list">
            {[...vault]
              .flatMap((g) => (g.files || []).map((f) => ({ ...f, dir: g.dir })))
              .sort((a, b) => b.mtime - a.mtime)
              .slice(0, 10)
              .map((f) => (
                <div key={f.path} className="monitor-list-item">
                  <span className="monitor-list-icon">{DIR_ICON[f.dir] || "📄"}</span>
                  <span className="monitor-list-title">
                    {f.name.replace(/\.md$/, "")}
                  </span>
                  <span className="monitor-list-time">{fmtMtime(f.mtime)}</span>
                </div>
              ))}
            {vault.length === 0 && (
              <div className="monitor-empty">{t("monitor.knowledge.empty")}</div>
            )}
          </div>
        </div>
      </div>

      {/* Events */}
      <div className="settings-section">
        <div className="settings-section-title">{t("monitor.events.title")}</div>
        <div className="monitor-list" style={{ maxHeight: "200px" }}>
          {(events || []).filter(Boolean).map((ev, i) => {
            const isFailure = ev.event?.includes("fail") || ev.event?.includes("error");
            return (
              <div key={i} className="monitor-list-item">
                <span className="monitor-event-time">{ev.ts ? timeAgo(ev.ts) : "—"}</span>
                <span
                  className={`monitor-event-name${isFailure ? " monitor-event-failure" : ""}`}
                >
                  {ev.event || "—"}
                </span>
                <span className="monitor-event-detail">
                  {[ev.role, ev.task_id].filter(Boolean).join(" ")}
                </span>
              </div>
            );
          })}
          {(!events || events.length === 0) && (
            <div className="monitor-empty">{t("monitor.events.empty")}</div>
          )}
        </div>
      </div>

      {/* Pipeline Runs Section */}
      <div className="settings-section">
        <div className="settings-section-title">Pipeline Runs</div>
        {pipelineRuns.length === 0 ? (
          <div className="monitor-empty">No pipeline runs</div>
        ) : (
          <div className="monitor-list">
            {pipelineRuns.map((run) => (
              <div key={run.runId} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "12px", color: "var(--accent)" }}>{run.runId}</span>
                  <span style={{
                    fontSize: "10px",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    background: run.status === "completed" ? "#05966922" : run.status === "failed" ? "#DC262622" : "#D9770622",
                    color: run.status === "completed" ? "#059669" : run.status === "failed" ? "#DC2626" : "#D97706",
                  }}>
                    {run.status}
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", marginBottom: "2px" }}>
                  {run.taskName || run.runId}
                </div>
                {run.conclusion && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "2px" }}>{run.conclusion}</div>
                )}
                <div style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {run.kind && <span>{run.kind}</span>}
                  {run.createdAt && <span>{new Date(run.createdAt).toLocaleString("zh-CN")}</span>}
                  <span>{run.artifactCount} artifacts</span>
                </div>
                {run.artifacts.length > 0 && (
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                    {run.artifacts.slice(0, 3).map((a) => a.name).join(", ")}
                    {run.artifacts.length > 3 && <span style={{ marginLeft: "4px" }}>+{run.artifacts.length - 3} more</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MonitorBadge({
  label,
  ok,
  suffix,
}: {
  label: string;
  ok: boolean;
  suffix?: string;
}) {
  return (
    <span className={`monitor-badge ${ok ? "monitor-badge-on" : "monitor-badge-off"}`}>
      {label}
      {suffix !== undefined ? ` ${suffix}` : ok ? " ✅" : " ❌"}
    </span>
  );
}
