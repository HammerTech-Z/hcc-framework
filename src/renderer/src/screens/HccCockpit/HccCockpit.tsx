import { useEffect, useMemo, useState } from "react";

import { ModelStrategyDryRunPanel } from "./ModelStrategyDryRunPanel";

type HermesApi = Window["hermesAPI"];
type PipelineRun = Awaited<ReturnType<HermesApi["listPipelineRuns"]>>[number];
type Playbook = Awaited<ReturnType<HermesApi["listPlaybooks"]>>[number];
type CronHistoryItem = Awaited<ReturnType<HermesApi["getCronJobHistory"]>>[number];
type EventItem = Awaited<ReturnType<HermesApi["getEvents"]>>[number];
type GatewayState = Awaited<ReturnType<HermesApi["getGatewayState"]>>;

type HccStage = "discovery" | "plan" | "execute" | "verify" | "deliver";

interface HccCockpitData {
  runs: PipelineRun[];
  playbooks: Playbook[];
  cronHistory: CronHistoryItem[];
  events: EventItem[];
  gateway: GatewayState;
  health: { status: number; ok: boolean } | null;
}

interface AcuiEvent {
  time: string;
  type: string;
  desc: string;
}

const HCC_STAGES: Array<{ id: HccStage; label: string; title: string }> = [
  { id: "discovery", label: "discovery / diagnose", title: "发现" },
  { id: "plan", label: "plan", title: "方案" },
  { id: "execute", label: "execute", title: "修复" },
  { id: "verify", label: "verify", title: "验证" },
  { id: "deliver", label: "deliver", title: "交付" },
];

const STAGE_INDEX: Record<HccStage, number> = {
  discovery: 0,
  plan: 1,
  execute: 2,
  verify: 3,
  deliver: 4,
};

function safeTime(value?: string): string {
  if (!value) return "unknown";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value;
  return time.toLocaleString("zh-CN");
}

function shortTime(value?: string): string {
  if (!value) return "--:--:--";
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value.slice(0, 19);
  return time.toLocaleTimeString("zh-CN", { hour12: false });
}

function isFailureText(value?: string): boolean {
  const text = (value || "").toLowerCase();
  return text.includes("fail") || text.includes("error") || text.includes("blocked");
}

function deriveStage(run?: PipelineRun): HccStage {
  if (!run) return "discovery";

  const text = [
    run.status,
    run.conclusion,
    run.kind,
    run.loopType,
    ...run.artifacts.map((artifact) => artifact.name),
  ].join(" ").toLowerCase();

  if (text.includes("deliver") || text.includes("delivery") || text.includes("handoff")) {
    return "deliver";
  }
  if (text.includes("verify") || text.includes("review") || text.includes("test")) {
    return "verify";
  }
  if (text.includes("execute") || text.includes("fix") || text.includes("repair")) {
    return "execute";
  }
  if (text.includes("plan") || text.includes("proposal") || text.includes("方案")) {
    return "plan";
  }
  if (run.status === "completed") return "deliver";
  if (run.status === "failed") return "verify";
  if (run.status === "running") return "execute";
  return "discovery";
}

function statusTone(status?: string): "ok" | "warn" | "error" | "muted" {
  const value = (status || "").toLowerCase();
  if (value === "completed" || value === "success" || value === "pass") return "ok";
  if (value === "failed" || value === "error") return "error";
  if (value === "running" || value === "pending") return "warn";
  return "muted";
}

function summarizeBlockers(runs: PipelineRun[], cronHistory: CronHistoryItem[], events: EventItem[]): string[] {
  const blockers: string[] = [];

  const failedRun = runs.find((run) => statusTone(run.status) === "error" || isFailureText(run.conclusion));
  if (failedRun) {
    blockers.push(failedRun.conclusion || `${failedRun.runId} ended with ${failedRun.status}`);
  }

  const failedCron = cronHistory.find((item) => item.failed);
  if (failedCron) {
    blockers.push(`cron ${failedCron.jobId}: ${failedCron.preview.replace(/\s+/g, " ").slice(0, 120)}`);
  }

  const failureEvent = events.find((event) => isFailureText(event.event));
  if (failureEvent) {
    blockers.push(`event ${failureEvent.event}${eventDetail(failureEvent)}`);
  }

  return blockers.length > 0 ? blockers.slice(0, 3) : ["No blocking signal found in read-only sources."];
}

function eventDetail(event: EventItem): string {
  const parts = [event.role, event.task_id].filter(Boolean);
  return parts.length > 0 ? ` (${parts.join(" ")})` : "";
}

function generateAcuiEvents(data: HccCockpitData, selectedRun?: PipelineRun): AcuiEvent[] {
  const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const activeStage = deriveStage(selectedRun);

  return [
    {
      time: now,
      type: "task.created",
      desc: "task_id=hcc-cockpit, goal=readonly HCC execution overview",
    },
    {
      time: now,
      type: "context.gathered",
      desc: `pipeline_runs=${data.runs.length}, playbooks=${data.playbooks.length}, cron_history=${data.cronHistory.length}, events=${data.events.length}`,
    },
    {
      time: now,
      type: "ui_show",
      desc: "FocusStack, TaskCanvas, BrainUI, EventLog",
    },
    {
      time: now,
      type: "stage.inferred",
      desc: `run=${selectedRun?.runId || "none"}, stage=${activeStage}, readonly=true`,
    },
    {
      time: now,
      type: "safety.guard",
      desc: "runPlaybook/writeIPC/cronMutation/vaultWrite/modelAction/wechatSend disabled",
    },
  ];
}

function StageRail({ activeStage }: { activeStage: HccStage }): React.JSX.Element {
  const activeIndex = STAGE_INDEX[activeStage];

  return (
    <div className="hcc-cockpit-stage-rail" aria-label="HCC stages">
      {HCC_STAGES.map((stage, index) => {
        const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
        return (
          <div key={stage.id} className={`hcc-cockpit-stage hcc-cockpit-stage-${state}`}>
            <div className="hcc-cockpit-stage-dot">
              {state === "done" ? "✓" : index + 1}
            </div>
            <div className="hcc-cockpit-stage-copy">
              <span className="hcc-cockpit-stage-title">{stage.title}</span>
              <span className="hcc-cockpit-stage-label">{stage.label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HccCockpit(): React.JSX.Element {
  const [data, setData] = useState<HccCockpitData>({
    runs: [],
    playbooks: [],
    cronHistory: [],
    events: [],
    gateway: null,
    health: null,
  });
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [runs, playbooks, cronHistory, events, gateway, health] = await Promise.all([
          window.hermesAPI.listPipelineRuns(30),
          window.hermesAPI.listPlaybooks(),
          window.hermesAPI.getCronJobHistory(30),
          window.hermesAPI.getEvents(40),
          window.hermesAPI.getGatewayState(),
          window.hermesAPI.checkGatewayHealth(),
        ]);

        if (cancelled) return;
        setData({ runs, playbooks, cronHistory, events, gateway, health });
        setSelectedRunId((current) => current || runs[0]?.runId || null);
        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const selectedRun = data.runs.find((run) => run.runId === selectedRunId) || data.runs[0];
  const activeStage = deriveStage(selectedRun);
  const blockers = useMemo(
    () => summarizeBlockers(data.runs, data.cronHistory, data.events),
    [data.runs, data.cronHistory, data.events],
  );
  const acuiEvents = useMemo(() => generateAcuiEvents(data, selectedRun), [data, selectedRun]);
  const failedRuns = data.runs.filter((run) => statusTone(run.status) === "error").length;
  const failedCronRuns = data.cronHistory.filter((item) => item.failed).length;
  const gatewayHealthy = data.health?.ok || data.health?.status === 200;

  if (loading) {
    return (
      <div className="hcc-cockpit-container">
        <div className="hcc-cockpit-readonly-badge">
          HCC Execution Cockpit · read-only · loading existing pipeline state
        </div>
        <div className="bailongma-loading">
          <div className="bailongma-spinner" />
          <span>Loading HCC cockpit data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hcc-cockpit-container">
        <div className="hcc-cockpit-readonly-badge">
          HCC Execution Cockpit · read-only · no writes attempted
        </div>
        <div className="bailongma-error-state">
          <div className="bailongma-error-icon">!</div>
          <div className="bailongma-error-title">Failed to load HCC cockpit</div>
          <div className="bailongma-error-msg">{error}</div>
          <div className="bailongma-error-hint">Read-only mode: no retry action was triggered.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="hcc-cockpit-container">
      <div className="hcc-cockpit-readonly-badge">
        HCC 自动执行驾驶舱 · Read-only POC · No new IPC · No writes · No model/tool execution
      </div>

      <div className="hcc-cockpit-model-strategy-slot">
        <ModelStrategyDryRunPanel />
      </div>

      <div className="hcc-cockpit-grid">
        <aside className="hcc-cockpit-panel hcc-cockpit-focus">
          <div className="hcc-cockpit-panel-title">Focus Stack</div>
          <button
            type="button"
            className={`hcc-cockpit-focus-item ${selectedRun ? "active" : ""}`}
            onClick={() => selectedRun && setSelectedRunId(selectedRun.runId)}
          >
            <span className="hcc-cockpit-focus-dot" />
            <span>{selectedRun?.taskName || "No current HCC run"}</span>
          </button>

          <div className="hcc-cockpit-stat-grid">
            <div className="hcc-cockpit-stat">
              <span className="hcc-cockpit-stat-value">{data.runs.length}</span>
              <span className="hcc-cockpit-stat-label">runs</span>
            </div>
            <div className="hcc-cockpit-stat">
              <span className="hcc-cockpit-stat-value">{data.playbooks.length}</span>
              <span className="hcc-cockpit-stat-label">playbooks</span>
            </div>
            <div className="hcc-cockpit-stat">
              <span className={`hcc-cockpit-stat-value ${failedRuns > 0 ? "is-error" : "is-ok"}`}>
                {failedRuns}
              </span>
              <span className="hcc-cockpit-stat-label">failed</span>
            </div>
          </div>

          <div className="hcc-cockpit-panel-subtitle">Recent Pipeline Runs</div>
          <div className="hcc-cockpit-run-list">
            {data.runs.length === 0 ? (
              <div className="hcc-cockpit-empty">No HCC pipeline runs found.</div>
            ) : (
              data.runs.slice(0, 8).map((run) => (
                <button
                  key={run.runId}
                  type="button"
                  className={`hcc-cockpit-run-item ${run.runId === selectedRun?.runId ? "selected" : ""}`}
                  onClick={() => setSelectedRunId(run.runId)}
                >
                  <span className={`hcc-cockpit-status-dot tone-${statusTone(run.status)}`} />
                  <span className="hcc-cockpit-run-name">{run.taskName || run.runId}</span>
                  <span className="hcc-cockpit-run-meta">{run.status || "unknown"}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        <main className="hcc-cockpit-panel hcc-cockpit-canvas">
          <div className="hcc-cockpit-panel-title">Task Canvas</div>

          <div className="hcc-cockpit-task-header">
            <div>
              <div className="hcc-cockpit-eyebrow">current HCC run</div>
              <h2>{selectedRun?.taskName || "Readonly HCC overview"}</h2>
              <p>{selectedRun?.runId || "No pipeline run is selected."}</p>
            </div>
            <span className={`hcc-cockpit-status-pill tone-${statusTone(selectedRun?.status)}`}>
              {selectedRun?.status || "idle"}
            </span>
          </div>

          <StageRail activeStage={activeStage} />

          <section className="hcc-cockpit-section">
            <div className="hcc-cockpit-section-title">Conclusion</div>
            <div className="hcc-cockpit-conclusion">
              {selectedRun?.conclusion || "No conclusion captured yet in run metadata."}
            </div>
            <div className="hcc-cockpit-detail-row">
              <span>created</span>
              <strong>{safeTime(selectedRun?.createdAt)}</strong>
            </div>
            <div className="hcc-cockpit-detail-row">
              <span>updated</span>
              <strong>{safeTime(selectedRun?.updatedAt)}</strong>
            </div>
            <div className="hcc-cockpit-detail-row">
              <span>artifacts</span>
              <strong>{selectedRun?.artifactCount ?? 0}</strong>
            </div>
          </section>

          <section className="hcc-cockpit-section">
            <div className="hcc-cockpit-section-title">Readonly Execution Controls</div>
            <div className="hcc-cockpit-actions">
              <button type="button" className="btn btn-primary" disabled>
                Run playbook disabled
              </button>
              <button type="button" className="btn btn-secondary" disabled>
                Auto fix disabled
              </button>
              <button type="button" className="btn btn-ghost" disabled>
                Deliver disabled
              </button>
            </div>
            <div className="hcc-cockpit-guardrail">
              First phase cockpit only: no cron mutation, no Memory/Vault/Knowledge writes, no WeChat send, no dangerous model action.
            </div>
          </section>
        </main>

        <aside className="hcc-cockpit-panel hcc-cockpit-brain">
          <div className="hcc-cockpit-panel-title">Brain UI</div>

          <section className="hcc-cockpit-brain-section">
            <div className="hcc-cockpit-panel-subtitle">Context</div>
            <div className="hcc-cockpit-brain-item">
              <span className={`hcc-cockpit-status-dot tone-${gatewayHealthy ? "ok" : "error"}`} />
              <span>gateway {gatewayHealthy ? "healthy" : "not healthy"} ({data.health?.status ?? "n/a"})</span>
            </div>
            <div className="hcc-cockpit-brain-item">
              <span className="hcc-cockpit-status-dot tone-muted" />
              <span>{data.gateway?.active_agents ?? 0} active agents</span>
            </div>
            <div className="hcc-cockpit-brain-item">
              <span className={`hcc-cockpit-status-dot tone-${failedCronRuns > 0 ? "warn" : "ok"}`} />
              <span>{failedCronRuns} failed cron history items</span>
            </div>
          </section>

          <section className="hcc-cockpit-brain-section">
            <div className="hcc-cockpit-panel-subtitle">Artifacts</div>
            {selectedRun?.artifacts.length ? (
              selectedRun.artifacts.slice(0, 6).map((artifact) => (
                <div key={artifact.path} className="hcc-cockpit-artifact">
                  {artifact.name}
                </div>
              ))
            ) : (
              <div className="hcc-cockpit-empty">No artifacts listed.</div>
            )}
          </section>

          <section className="hcc-cockpit-brain-section">
            <div className="hcc-cockpit-panel-subtitle">Blockers</div>
            {blockers.map((blocker, index) => (
              <div key={`${index}-${blocker}`} className="hcc-cockpit-blocker">
                {blocker}
              </div>
            ))}
          </section>
        </aside>
      </div>

      <div className="hcc-cockpit-event-log">
        <div className="hcc-cockpit-event-header">
          <span>ACUI Event Log</span>
          <span className="hcc-cockpit-event-meta">
            readonly · auto-refresh 30s
          </span>
        </div>
        <div className="hcc-cockpit-event-list">
          <div className="hcc-cockpit-event-section-label">ACUI Synthesis</div>
          {acuiEvents.map((event, idx) => (
            <div key={`acui-${idx}`} className="hcc-cockpit-event-row hcc-cockpit-event-acui">
              <span className="hcc-cockpit-event-time">{event.time}</span>
              <span className="hcc-cockpit-event-type">[{event.type}]</span>
              <span className="hcc-cockpit-event-desc">{event.desc}</span>
            </div>
          ))}
          <div className="hcc-cockpit-event-divider" />
          <div className="hcc-cockpit-event-section-label">Real Events ({data.events.length})</div>
          {data.events.length === 0 ? (
            <div className="hcc-cockpit-event-row">
              <span className="hcc-cockpit-event-empty">No events in timeline.</span>
            </div>
          ) : (
            data.events.slice(0, 8).map((event, index) => (
              <div
                key={`event-${event.ts}-${index}`}
                className={`hcc-cockpit-event-row ${isFailureText(event.event) ? "hcc-cockpit-event-failure" : ""}`}
              >
                <span className="hcc-cockpit-event-time">{shortTime(event.ts)}</span>
                <span className="hcc-cockpit-event-type">[{event.event || "event"}]</span>
                <span className="hcc-cockpit-event-desc">
                  {[event.role, event.task_id].filter(Boolean).join(" ") || "readonly event source"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default HccCockpit;
