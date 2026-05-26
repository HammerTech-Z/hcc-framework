import { useEffect, useState } from "react";
import { useI18n } from "../../components/useI18n";

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
  const [gw, setGw] = useState<GatewayState | null>(null);
  const [vault, setVault] = useState<VaultGroup[]>([]);
  const [cronHistory, setCronHistory] = useState<CronRun[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [health, setHealth] = useState<number | null>(null);
  const [trends, setTrends] = useState<DailyTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    checkHealth();
    const dataInterval = setInterval(load, 30000);
    const healthInterval = setInterval(() => checkHealth(), 30000);
    return () => {
      cancelled = true;
      clearInterval(dataInterval);
      clearInterval(healthInterval);
    };
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
  const maxSessions = Math.max(1, ...trends.map((t) => t.sessions));

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

      {/* Session Trends */}
      <div className="settings-section">
        <div className="settings-section-title">{t("monitor.charts.sessionTrends")}</div>
        <div className="monitor-chart-container">
          <div className="monitor-chart">
            {trends.map((t) => {
              const barHeight = Math.max(2, (t.sessions / maxSessions) * 80);
              const isToday = t.label === "Today";
              return (
                <div key={t.date} className="monitor-chart-bar-col">
                  <div
                    className="monitor-chart-bar"
                    style={{
                      height: `${barHeight}px`,
                      background: isToday
                        ? "var(--accent, #8fb6d8)"
                        : t.sessions > 0
                          ? "var(--text-secondary)"
                          : "var(--bg-tertiary)",
                      opacity: isToday ? 1 : t.sessions > 0 ? 0.5 : 0.3,
                    }}
                  >
                    {t.sessions > 0 && (
                      <div className="monitor-chart-bar-count">{t.sessions}</div>
                    )}
                  </div>
                  <div
                    className={`monitor-chart-label${isToday ? " monitor-chart-label-today" : ""}`}
                  >
                    {t.label}
                  </div>
                </div>
              );
            })}
          </div>
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
