import { useEffect, useState } from "react";

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

function buildTrends(sessions: CachedSession[]): DailyTrend[] {
  const days: Record<string, { sessions: number; messages: number; label: string }> = {};
  const now = Date.now();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? "Today"
        : i === 1
          ? "Yest"
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
        if (sessions) setTrends(buildTrends(sessions));
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
        Loading monitor...
      </div>
    );
  }

  const cardStyle: React.CSSProperties = {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "16px",
  };

  const panelTitleStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.8px",
    marginBottom: "14px",
  };

  const totalSessions = trends.reduce((s, t) => s + t.sessions, 0);
  const totalMessages = trends.reduce((s, t) => s + t.messages, 0);
  const activeDays = trends.filter((t) => t.sessions > 0).length;
  const maxSessions = Math.max(1, ...trends.map((t) => t.sessions));

  return (
    <div
      className="custom-scrollbar"
      style={{ padding: "24px 32px", overflowY: "auto", height: "100%" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            P4 Monitor
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Gateway · Trends · Flywheel · Knowledge · Events
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "var(--error-bg)",
            color: "var(--error)",
            border: "1px solid var(--error)",
            borderRadius: "var(--radius-md)",
            padding: "10px 14px",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {error}
        </div>
      )}

      {/* Summary row */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "14px",
          flexWrap: "wrap",
        }}
      >
        {[
          { label: "Active Days (14d)", value: activeDays.toString() },
          { label: "Sessions (14d)", value: totalSessions.toLocaleString() },
          { label: "Messages (14d)", value: totalMessages.toLocaleString() },
          {
            label: "Gateway 8643",
            value: health === 200 ? "Online" : health === null ? "..." : "Offline",
            valueColor: health === 200 ? "var(--success)" : "var(--error)",
          },
          { label: "Active Agents", value: (gw?.active_agents ?? "?").toString() },
        ].map((m) => (
          <div
            key={m.label}
            style={{
              background: "var(--bg-tertiary)",
              borderRadius: "var(--radius-md)",
              padding: "12px 16px",
              textAlign: "center",
              flex: 1,
              minWidth: "100px",
            }}
          >
            <div
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: m.valueColor ?? "var(--text-primary)",
                lineHeight: 1.2,
              }}
            >
              {m.value}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Session Trends */}
      <div style={{ ...cardStyle, marginBottom: "14px" }}>
        <div style={panelTitleStyle}>📈 Session Trends (14 days)</div>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "3px",
            height: "100px",
            paddingTop: "8px",
          }}
        >
          {trends.map((t) => {
            const barHeight = Math.max(2, (t.sessions / maxSessions) * 80);
            const isToday = t.label === "Today";
            return (
              <div
                key={t.date}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: "28px",
                    height: `${barHeight}px`,
                    borderRadius: "4px 4px 0 0",
                    background: isToday
                      ? "var(--cool, #8fb6d8)"
                      : t.sessions > 0
                        ? "var(--text-secondary)"
                        : "var(--bg-tertiary)",
                    opacity: isToday ? 1 : t.sessions > 0 ? 0.5 : 0.3,
                    marginTop: "auto",
                    position: "relative",
                  }}
                >
                  {t.sessions > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: "-15px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "9px",
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.sessions}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontSize: "8px",
                    color: "var(--text-muted)",
                    marginTop: "4px",
                    whiteSpace: "nowrap",
                    fontWeight: isToday ? 600 : 400,
                  }}
                >
                  {t.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* System Status */}
      <div style={{ ...cardStyle, marginBottom: "14px" }}>
        <div style={panelTitleStyle}>⚡ System Status</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <Badge
            label={`Gateway: ${gw?.gateway_state || "unknown"}`}
            ok={gw?.gateway_state === "running"}
            suffix={gw?.pid ? `(PID ${gw.pid})` : undefined}
          />
          <Badge
            label="8643 Health"
            ok={health === 200}
            suffix={health === 200 ? "200" : health === null ? "..." : "DOWN"}
          />
          {gw?.platforms &&
            Object.entries(gw.platforms).map(([name, p]) => {
              const { label, icon } = PLATFORM_DISPLAY[name] || { label: name, icon: "📡" };
              return (
                <Badge
                  key={name}
                  label={`${icon} ${label}`}
                  ok={p.state === "connected" || p.state === "running"}
                />
              );
            })}
        </div>
        {gw?.updated_at && (
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "8px" }}>
            Updated {timeAgo(gw.updated_at)} ago
          </div>
        )}
      </div>

      {/* Flywheel + Knowledge */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "14px" }}>
        <div style={{ flex: 1, ...cardStyle }}>
          <div style={panelTitleStyle}>🔄 Knowledge Flywheel</div>
          <div className="custom-scrollbar" style={{ maxHeight: "260px", overflowY: "auto" }}>
            {(cronHistory || []).slice(0, 20).map((run, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  fontSize: "13px",
                  borderBottom: i < 19 ? "1px solid var(--border)" : "none",
                }}
              >
                <span
                  style={{
                    color: run.failed ? "var(--error)" : "var(--success)",
                    width: "16px",
                    textAlign: "center",
                    fontWeight: 700,
                  }}
                >
                  {run.failed ? "✕" : "✓"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    width: "48px",
                  }}
                >
                  {run.jobId.slice(0, 8)}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {run.time ? timeAgo(run.time) : ""}
                </span>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {run.preview.replace(/^# Cron Job:\s*/, "").slice(0, 60)}
                </span>
              </div>
            ))}
            {(!cronHistory || cronHistory.length === 0) && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  padding: "16px 0",
                  textAlign: "center",
                }}
              >
                No cron history
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, ...cardStyle }}>
          <div style={panelTitleStyle}>📥 Recent Knowledge</div>
          <div className="custom-scrollbar" style={{ maxHeight: "260px", overflowY: "auto" }}>
            {[...vault]
              .flatMap((g) => (g.files || []).map((f) => ({ ...f, dir: g.dir })))
              .sort((a, b) => b.mtime - a.mtime)
              .slice(0, 10)
              .map((f) => (
                <div
                  key={f.path}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    fontSize: "13px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span style={{ flexShrink: 0 }}>{DIR_ICON[f.dir] || "📄"}</span>
                  <span
                    style={{
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {f.name.replace(/\.md$/, "")}
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", flexShrink: 0 }}>
                    {fmtMtime(f.mtime)}
                  </span>
                </div>
              ))}
            {vault.length === 0 && (
              <div
                style={{
                  color: "var(--text-muted)",
                  fontSize: "13px",
                  padding: "16px 0",
                  textAlign: "center",
                }}
              >
                No vault content
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Events */}
      <div style={cardStyle}>
        <div style={panelTitleStyle}>📊 Events</div>
        <div className="custom-scrollbar" style={{ maxHeight: "200px", overflowY: "auto" }}>
          {(events || []).filter(Boolean).map((ev, i) => {
            const isFailure = ev.event?.includes("fail") || ev.event?.includes("error");
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 10px",
                  fontSize: "13px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    width: "48px",
                    flexShrink: 0,
                  }}
                >
                  {ev.ts ? timeAgo(ev.ts) : "—"}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    width: "96px",
                    flexShrink: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: isFailure ? "var(--error)" : "var(--text-primary)",
                  }}
                >
                  {ev.event || "—"}
                </span>
                <span
                  style={{
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {[ev.role, ev.task_id].filter(Boolean).join(" ")}
                </span>
              </div>
            );
          })}
          {(!events || events.length === 0) && (
            <div
              style={{
                color: "var(--text-muted)",
                fontSize: "13px",
                padding: "16px 0",
                textAlign: "center",
              }}
            >
              No events yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({
  label,
  ok,
  suffix,
}: {
  label: string;
  ok: boolean;
  suffix?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 600,
        background: ok ? "var(--success-bg)" : "var(--error-bg)",
        color: ok ? "var(--success)" : "var(--error)",
        border: "1px solid var(--border)",
      }}
    >
      {label}
      {suffix !== undefined ? ` ${suffix}` : ok ? " ✅" : " ❌"}
    </span>
  );
}
