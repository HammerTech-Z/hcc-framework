import { useEffect, useMemo, useState } from "react";

type HermesApi = Window["hermesAPI"];
type GatewayState = Awaited<ReturnType<HermesApi["getGatewayState"]>>;
type VaultGroup = Awaited<ReturnType<HermesApi["listVaultFiles"]>>[number];
type PipelineRun = Awaited<ReturnType<HermesApi["listPipelineRuns"]>>[number];
type EventItem = Awaited<ReturnType<HermesApi["getEvents"]>>[number];
type CronJob = Awaited<ReturnType<HermesApi["listCronJobs"]>>[number];
type Playbook = Awaited<ReturnType<HermesApi["listPlaybooks"]>>[number];
type CronHistoryItem = Awaited<ReturnType<HermesApi["getCronJobHistory"]>>[number];

interface MissionData {
  gateway: GatewayState | null;
  vaultGroups: VaultGroup[];
  runs: PipelineRun[];
  events: EventItem[];
  jobs: CronJob[];
  playbooks: Playbook[];
  cronHistory: CronHistoryItem[];
  health: { status: number; ok: boolean } | null;
}

interface MissionProps {
  profile?: string;
  legacySource?: "bailongma" | "hcc";
}

function timeAgo(value?: string | null): string {
  if (!value) return "unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function statusTone(value?: string | null): "ok" | "warn" | "error" | "muted" {
  const text = (value || "").toLowerCase();
  if (text === "completed" || text === "success" || text === "pass") return "ok";
  if (text === "failed" || text === "error") return "error";
  if (text === "running" || text === "pending" || text === "active") return "warn";
  return "muted";
}

function isFailureText(value?: string | null): boolean {
  const text = (value || "").toLowerCase();
  return text.includes("fail") || text.includes("error") || text.includes("blocked");
}

export default function Mission({
  profile = "default",
  legacySource,
}: MissionProps): React.JSX.Element {
  const [data, setData] = useState<MissionData>({
    gateway: null,
    vaultGroups: [],
    runs: [],
    events: [],
    jobs: [],
    playbooks: [],
    cronHistory: [],
    health: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [
          gateway,
          vaultGroups,
          runs,
          events,
          jobs,
          playbooks,
          cronHistory,
          health,
        ] = await Promise.all([
          window.hermesAPI.getGatewayState().catch(() => null),
          window.hermesAPI.listVaultFiles().catch(() => []),
          window.hermesAPI.listPipelineRuns(30).catch(() => []),
          window.hermesAPI.getEvents(40).catch(() => []),
          window.hermesAPI.listCronJobs(true, profile).catch(() => []),
          window.hermesAPI.listPlaybooks().catch(() => []),
          window.hermesAPI.getCronJobHistory(30).catch(() => []),
          window.hermesAPI.checkGatewayHealth().catch(() => null),
        ]);

        if (cancelled) return;
        setData({
          gateway,
          vaultGroups,
          runs,
          events,
          jobs,
          playbooks,
          cronHistory,
          health,
        });
        setError(null);
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  const gatewayHealthy = data.health?.ok || data.health?.status === 200;

  const blockerSignals = useMemo(() => {
    const signals: string[] = [];
    const failedRun = data.runs.find((run) => statusTone(run.status) === "error" || isFailureText(run.conclusion));
    if (failedRun) signals.push(failedRun.conclusion || `${failedRun.runId} ended with ${failedRun.status}`);
    const failedJob = data.jobs.find((job) => job.last_status === "error" || job.last_error);
    if (failedJob) signals.push(`${failedJob.name}: ${failedJob.last_error || failedJob.last_status}`);
    const failedHistory = data.cronHistory.find((item) => item.failed);
    if (failedHistory) signals.push(`${failedHistory.jobId}: ${failedHistory.preview.replace(/\s+/g, " ").slice(0, 120)}`);
    const failureEvent = data.events.find((event) => isFailureText(event.event));
    if (failureEvent) signals.push(`event ${failureEvent.event}`);
    return signals.slice(0, 4);
  }, [data.cronHistory, data.events, data.jobs, data.runs]);

  if (loading) {
    return (
      <div className="mission-container">
        <div className="mission-boundary-badge">
          Mission Control · read-only · no new IPC · loading existing facts
        </div>
        <div className="mission-loading">
          <div className="mission-spinner" />
          <span>Loading Mission Control...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mission-container">
        <div className="mission-boundary-badge">
          Mission Control · read-only · no writes attempted
        </div>
        <div className="mission-error-state">
          <div className="mission-error-icon">!</div>
          <div className="mission-error-title">Mission Control failed to load</div>
          <div className="mission-error-msg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mission-container">
      <div className="hp-readonly-disclaimer">
        本页仅展示状态，不会自动执行任何操作。<br />
        Status display only · No automatic execution
      </div>

      <div className="mission-hero">
        <div>
          <div className="mission-eyebrow">
            {legacySource ? `Legacy alias: ${legacySource}` : "Hermes Pro"}
          </div>
          <h1>Mission Control</h1>
          <p>
            Read-only cockpit for BaiLongma, HCC, gateway, vault, pipeline,
            cron, and event facts.
          </p>
        </div>
        <div className="mission-boundary-badge">
          Read-only · No new IPC · No writes · Productionization NOT APPROVED
        </div>
      </div>

      {/* ── Section 1: Health Summary Row ── */}
      <section className="mission-health-row" aria-label="Health Summary">
        <div className="mission-health-indicator tone-ok">
          <span className="mission-health-value">
            {gatewayHealthy ? "正常" : "异常"}
          </span>
          <span className="mission-health-label">网关</span>
        </div>
        <div className="mission-health-indicator tone-active">
          <span className="mission-health-value">
            {data.runs.filter((r) => r.status === "running").length}
          </span>
          <span className="mission-health-label">进行中</span>
        </div>
        <div className="mission-health-indicator tone-muted">
          <span className="mission-health-value">—</span>
          <span className="mission-health-label">待审批</span>
        </div>
        <div className={`mission-health-indicator ${data.jobs.filter((j) => j.last_status === "error").length > 0 ? "tone-frozen" : "tone-muted"}`}>
          <span className="mission-health-value">
            {data.jobs.filter((j) => j.last_status === "error").length}
          </span>
          <span className="mission-health-label">冻结</span>
        </div>
      </section>

      {/* ── Section 2: Focus Area ── */}
      <section className="mission-focus" aria-label="Focus Area">
        {/* Stage track: 5 HCC phases */}
        <div className="mission-stage-track">
          <div className="mission-stage-track-label">阶段轨道 · Stage Track</div>
          <div className="mission-stage-track-nodes">
            {(["discovery", "plan", "execute", "verify", "deliver"] as const).map((stageId) => {
              const labels: Record<string, string> = {
                discovery: "发现", plan: "方案", execute: "修复",
                verify: "验证", deliver: "交付",
              };
              // Read-only API surface does not expose HCC phase identifiers
              // (pipeline run status values are lifecycle states, not HCC
              // phases). All five nodes are rendered neutral until a reliable
              // phase source becomes available — no false active/done state.
              return (
                <div
                  key={stageId}
                  className="mission-stage-node"
                >
                  <span className="mission-stage-dot" />
                  <span className="mission-stage-label">{labels[stageId]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Blocker summary */}
        <div className="mission-blocker-summary">
          <div className="mission-blocker-label">阻塞项 · Blockers</div>
          {blockerSignals.length === 0 ? (
            <div className="mission-blocker-none">未发现阻塞信号，来源只读。</div>
          ) : (
            blockerSignals.map((signal) => (
              <div key={signal} className="mission-blocker-item">{signal}</div>
            ))
          )}
        </div>

        {/* Next action hint */}
        <div className="mission-next-action">
          <span className="mission-next-action-label">下一步：</span>
          {blockerSignals.length > 0 ? (
            <span>检查阻塞项或前往 Playbooks 页重试。</span>
          ) : (
            <span>所有流水线正常或暂无活跃任务。没有可自动执行的控件。</span>
          )}
        </div>
      </section>

      {/* ── Section 3: Collapsible Details ── */}
      <section className="mission-details" aria-label="Expandable Details">
        <MissionCollapsibleSection title="流水线 · Pipelines" defaultCollapsed>
          <div className="mission-compact-list">
            {data.runs.slice(0, 8).map((run) => (
              <div key={run.runId} className="mission-compact-row">
                <span className={`mission-status-dot tone-${statusTone(run.status)}`} />
                <span>{run.taskName || run.runId}</span>
                <strong>{run.artifactCount}</strong>
              </div>
            ))}
            {data.runs.length === 0 && <div className="mission-empty">No pipeline runs found.</div>}
          </div>
        </MissionCollapsibleSection>

        <MissionCollapsibleSection title="定时任务 · Cron Jobs" defaultCollapsed>
          <div className="mission-compact-list">
            {data.jobs.slice(0, 8).map((job) => (
              <div key={job.id} className="mission-compact-row">
                <span className={`mission-status-dot tone-${job.last_status === "error" ? "error" : "ok"}`} />
                <span>{job.name}</span>
                <strong>{job.deliver.join(", ") || "local"}</strong>
              </div>
            ))}
            {data.jobs.length === 0 && <div className="mission-empty">No cron jobs found.</div>}
          </div>
        </MissionCollapsibleSection>

        <MissionCollapsibleSection title="事件日志 · Events" defaultCollapsed>
          <div className="mission-event-list">
            {data.events.slice(0, 10).map((event, index) => (
              <div key={`${event.ts}-${index}`} className="mission-event-row">
                <span>{timeAgo(event.ts)}</span>
                <strong>[{event.event || "event"}]</strong>
                <em>{[event.role, event.task_id].filter(Boolean).join(" ") || "read-only source"}</em>
              </div>
            ))}
            {data.events.length === 0 && <div className="mission-empty">No events in timeline.</div>}
          </div>
        </MissionCollapsibleSection>

        <MissionCollapsibleSection title="源合约 · Source Contract" defaultCollapsed>
          <div className="mission-source-grid">
            <span>gateway</span>
            <span>vault</span>
            <span>pipeline</span>
            <span>events</span>
            <span>cron</span>
            <span>playbooks</span>
            <span>health</span>
            <span>profile: {profile}</span>
          </div>
        </MissionCollapsibleSection>
      </section>
    </div>
  );
}

/** Collapsible section for Mission details. Pure UI — zero IPC, zero runtime. */
function MissionCollapsibleSection({
  title,
  defaultCollapsed = true,
  children,
}: {
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <div className={`mission-collapsible ${collapsed ? "collapsed" : ""}`}>
      <button
        type="button"
        className="mission-collapsible-header"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={collapsed ? "false" : "true"}
      >
        <span className="mission-collapsible-caret">{collapsed ? "▸" : "▾"}</span>
        <span className="mission-collapsible-title">{title}</span>
      </button>
      {!collapsed && <div className="mission-collapsible-body">{children}</div>}
    </div>
  );
}
