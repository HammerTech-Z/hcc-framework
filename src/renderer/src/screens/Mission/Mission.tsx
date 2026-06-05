import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  FileStack,
  Gauge,
  GitBranch,
  Lock,
  ShieldCheck,
  Timer,
} from "lucide-react";

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

const STAGES = [
  { label: "P0", detail: "knowledgeSearch fixed-query timeout closed", state: "passed" },
  { label: "P1", detail: "typed links + usage feedback foundations closed", state: "passed" },
  { label: "P2.5", detail: "safety foundation closed", state: "passed" },
  { label: "P3", detail: "dry-run harness PASS; real execution paused", state: "active" },
  { label: "P3.5", detail: "soft switch KEEP v0.15.1; hard cutover not approved", state: "active" },
  { label: "P7", detail: "low-priority WeChat/iLink jobs deliver=local", state: "passed" },
  { label: "Prod", detail: "Productionization NOT APPROVED", state: "pending" },
] as const;

const GUARDRAILS = [
  "Read-only cockpit: no new IPC, no writes, no runtime action.",
  "HCC Auto Executor paused; P3 real execution still requires explicit approval.",
  "Productionization NOT APPROVED; this surface only consolidates existing facts.",
  "Hard cutover not approved; Hermes soft switch decision is KEEP v0.15.1.",
];

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

function MissionStat({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "error" | "muted";
}) {
  return (
    <div className={`mission-stat tone-${tone}`}>
      <span className="mission-stat-value">{value}</span>
      <span className="mission-stat-label">{label}</span>
    </div>
  );
}

function MissionPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
}) {
  return (
    <section className="mission-panel">
      <div className="mission-panel-title">
        <Icon size={14} />
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
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

  const vaultFiles = data.vaultGroups.reduce((sum, group) => sum + group.files.length, 0);
  const failedRuns = data.runs.filter((run) => statusTone(run.status) === "error" || isFailureText(run.conclusion)).length;
  const failedJobs = data.jobs.filter((job) => job.last_status === "error" || Boolean(job.last_error)).length;
  const failedCronHistory = data.cronHistory.filter((item) => item.failed).length;
  const activeRun = data.runs[0];
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

      <div className="mission-stat-grid">
        <MissionStat label="pipeline runs" value={data.runs.length} tone={failedRuns > 0 ? "error" : "ok"} />
        <MissionStat label="vault files" value={vaultFiles} tone={vaultFiles > 0 ? "ok" : "muted"} />
        <MissionStat label="cron jobs" value={data.jobs.length} tone={failedJobs > 0 ? "warn" : "ok"} />
        <MissionStat label="playbooks" value={data.playbooks.length} tone="muted" />
        <MissionStat label="events" value={data.events.length} tone="muted" />
        <MissionStat label="gateway" value={gatewayHealthy ? "healthy" : "unknown"} tone={gatewayHealthy ? "ok" : "warn"} />
      </div>

      <div className="mission-grid">
        <MissionPanel title="Stage Map" icon={GitBranch}>
          <div className="mission-stage-list">
            {STAGES.map((stage) => (
              <div key={stage.label} className={`mission-stage-row ${stage.state}`}>
                <span className="mission-stage-badge">{stage.label}</span>
                <span className="mission-stage-detail">{stage.detail}</span>
              </div>
            ))}
          </div>
        </MissionPanel>

        <MissionPanel title="Active Run" icon={Gauge}>
          <div className="mission-active-run">
            <div className="mission-active-title">{activeRun?.taskName || "No pipeline run selected"}</div>
            <div className="mission-active-id">{activeRun?.runId || "read-only idle"}</div>
            <span className={`mission-pill tone-${statusTone(activeRun?.status)}`}>
              {activeRun?.status || "idle"}
            </span>
          </div>
          <div className="mission-detail-row">
            <span>conclusion</span>
            <strong>{activeRun?.conclusion || "No conclusion captured."}</strong>
          </div>
          <div className="mission-detail-row">
            <span>artifacts</span>
            <strong>{activeRun?.artifactCount ?? 0}</strong>
          </div>
          <div className="mission-detail-row">
            <span>updated</span>
            <strong>{timeAgo(activeRun?.updatedAt)}</strong>
          </div>
        </MissionPanel>

        <MissionPanel title="Knowledge + Vault" icon={Database}>
          {data.vaultGroups.length === 0 ? (
            <div className="mission-empty">No vault groups reported.</div>
          ) : (
            data.vaultGroups.slice(0, 6).map((group) => (
              <div key={group.dir} className="mission-list-row">
                <span>{group.dir}</span>
                <strong>{group.files.length} files</strong>
              </div>
            ))
          )}
          <div className="mission-muted-line">L6 live knowledge flush remains unapproved.</div>
        </MissionPanel>

        <MissionPanel title="HCC Readiness" icon={ShieldCheck}>
          <div className="mission-list-row">
            <span>Playbook catalog</span>
            <strong>{data.playbooks.length}</strong>
          </div>
          <div className="mission-list-row">
            <span>Failed cron history</span>
            <strong>{failedCronHistory}</strong>
          </div>
          <div className="mission-list-row">
            <span>Active agents</span>
            <strong>{data.gateway?.active_agents ?? 0}</strong>
          </div>
          <div className="mission-muted-line">Execution controls are intentionally absent.</div>
        </MissionPanel>

        <MissionPanel title="Guardrails" icon={Lock}>
          <div className="mission-guardrail-list">
            {GUARDRAILS.map((item) => (
              <div key={item} className="mission-guardrail-item">
                <CheckCircle2 size={13} />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </MissionPanel>

        <MissionPanel title="Blockers + Warnings" icon={AlertTriangle}>
          {blockerSignals.length === 0 ? (
            <div className="mission-empty">No blocking signal found in read-only sources.</div>
          ) : (
            blockerSignals.map((signal) => (
              <div key={signal} className="mission-warning-row">{signal}</div>
            ))
          )}
        </MissionPanel>
      </div>

      <div className="mission-lower-grid">
        <MissionPanel title="Pipeline Artifacts" icon={Archive}>
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
        </MissionPanel>

        <MissionPanel title="Cron Snapshot" icon={Timer}>
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
        </MissionPanel>

        <MissionPanel title="Event Timeline" icon={Clock3}>
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
        </MissionPanel>

        <MissionPanel title="Source Contract" icon={FileStack}>
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
        </MissionPanel>
      </div>
    </div>
  );
}
