// BaiLongma POC-1: Read-only static UI skeleton
// Hard boundaries: no IPC, no writes, mock ACUI events only

import React from "react";

// ACUI Types (local, not from shared/types.ts per 05-poc-implementation-review.md)
// POC defines types for reference but uses static mock data instead of runtime state

interface Focus {
  id: string;
  label: string;
  active: boolean;
}

interface Step {
  id: string;
  label: string;
  state: "pending" | "running" | "completed";
}

interface ContextItem {
  label: string;
  status: "pending" | "done";
}

interface EventLogItem {
  time: string;
  type: string;
  desc: string;
}

// Static mock data per 05-poc-implementation-review.md Section 6
const MOCK_FOCUS: Focus = { id: "f-001", label: "cron 失败诊断", active: true };
const MOCK_STEPS: Step[] = [
  { id: "s-1", label: "gather context", state: "completed" },
  { id: "s-2", label: "plan diagnosis", state: "completed" },
  { id: "s-3", label: "run diagnosis", state: "completed" },
];
const MOCK_CONTEXT: ContextItem[] = [
  { label: "cron history (5 runs)", status: "done" },
  { label: "gateway state", status: "done" },
  { label: "events (30 items)", status: "done" },
];
const MOCK_ARTIFACTS = [
  { type: "diagnosis", id: "a-1", summary: "rate_limited", ts: "12:05:23" },
];
const MOCK_ERRORS = [{ code: "rate_limited", msg: "WeChat iLink daily limit", resolved: true }];
const MOCK_EVENTS: EventLogItem[] = [
  { time: "12:05:00", type: "task.created", desc: "task_id=poc-1, goal=diagnose" },
  { time: "12:05:01", type: "ui_show", desc: "TaskHeader, id=hdr-1" },
  { time: "12:05:02", type: "step.state_change", desc: "s-1 → running" },
  { time: "12:05:10", type: "context.gathered", desc: "cron history + gateway + events" },
  { time: "12:05:11", type: "step.state_change", desc: "s-1 → completed" },
  { time: "12:05:12", type: "step.state_change", desc: "s-2 → running" },
  { time: "12:05:18", type: "step.state_change", desc: "s-2 → completed" },
  { time: "12:05:19", type: "step.state_change", desc: "s-3 → running" },
  { time: "12:05:22", type: "artifact.created", desc: "id=a-1, type=diagnosis" },
  { time: "12:05:23", type: "ui_show", desc: "DiagnosisCard, id=diag-1" },
  { time: "12:05:24", type: "step.state_change", desc: "s-3 → completed" },
  { time: "12:05:25", type: "task.state_change", desc: "state=completed" },
];

function StepIndicator({ state }: { state: Step["state"] }): React.ReactNode {
  if (state === "completed") return <span className="bailongma-step-done">✓</span>;
  if (state === "running") return <span className="bailongma-step-running">●</span>;
  return <span className="bailongma-step-pending">○</span>;
}

function ContextStatus({ status }: { status: ContextItem["status"] }): React.ReactNode {
  return status === "done" ? (
    <span className="bailongma-status-done">✓</span>
  ) : (
    <span className="bailongma-status-pending">...</span>
  );
}

function BaiLongma(): React.JSX.Element {
  return (
    <div className="bailongma-container">
      {/* POC Header */}
      <div className="bailongma-poc-badge">
        Read-only POC · No IPC · No writes · Mock ACUI events
      </div>

      {/* 3-Column Cockpit */}
      <div className="bailongma-cockpit">
        {/* Left: Focus Stack */}
        <div className="bailongma-panel bailongma-panel-left">
          <div className="bailongma-panel-title">Focus Stack</div>
          <div className="bailongma-focus-item">
            <span className="bailongma-focus-dot">●</span>
            <span>{MOCK_FOCUS.label}</span>
          </div>
        </div>

        {/* Center: Task Canvas */}
        <div className="bailongma-panel bailongma-panel-center">
          <div className="bailongma-panel-title">Task Canvas</div>

          {/* Task Header */}
          <div className="bailongma-task-header">
            <div className="bailongma-task-goal">Goal: {MOCK_FOCUS.label}</div>
            <div className="bailongma-task-state">✓ completed</div>
          </div>

          {/* Steps */}
          <div className="bailongma-steps">
            {MOCK_STEPS.map((step, i) => (
              <div key={step.id} className="bailongma-step">
                <span className="bailongma-step-num">[{i + 1}]</span>
                <StepIndicator state={step.state} />
                <span className="bailongma-step-label">{step.label}</span>
              </div>
            ))}
          </div>

          {/* Diagnosis Card */}
          <div className="bailongma-diagnosis-card">
            <div className="bailongma-diagnosis-header">● Diagnosis</div>
            <div className="bailongma-diagnosis-body">
              <div className="bailongma-diagnosis-error">
                Error: {MOCK_ERRORS[0].code}
              </div>
              <div className="bailongma-diagnosis-msg">
                {MOCK_ERRORS[0].msg}
              </div>
              <div className="bailongma-diagnosis-suggestion">
                Suggestion: Reduce push frequency, check iLink quota
              </div>
            </div>
          </div>

          {/* Action Buttons (no-op in POC) */}
          <div className="bailongma-actions">
            <button className="btn btn-secondary" disabled>Open Schedules</button>
            <button className="btn btn-ghost" disabled>Dismiss</button>
          </div>
        </div>

        {/* Right: Brain UI */}
        <div className="bailongma-panel bailongma-panel-right">
          {/* Context */}
          <div className="bailongma-brain-section">
            <div className="bailongma-panel-title">Context</div>
            {MOCK_CONTEXT.map((item) => (
              <div key={item.label} className="bailongma-brain-item">
                <ContextStatus status={item.status} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          {/* Artifacts */}
          <div className="bailongma-brain-section">
            <div className="bailongma-panel-title">Artifacts</div>
            {MOCK_ARTIFACTS.map((a) => (
              <div key={a.id} className="bailongma-brain-item">
                <span className="bailongma-artifact-tag">diagnosis:</span>
                <span>{a.id} @ {a.ts}</span>
              </div>
            ))}
          </div>

          {/* Errors */}
          <div className="bailongma-brain-section">
            <div className="bailongma-panel-title">Errors</div>
            {MOCK_ERRORS.map((e, i) => (
              <div key={i} className="bailongma-brain-item">
                <span className={e.resolved ? "bailongma-status-done" : "bailongma-status-pending"}>
                  {e.resolved ? "✓" : "!"}
                </span>
                <span>{e.code}: {e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ACUI Event Log (bottom drawer) */}
      <div className="bailongma-event-log">
        <div className="bailongma-event-log-title">ACUI Event Log</div>
        <div className="bailongma-event-list">
          {MOCK_EVENTS.map((e, i) => (
            <div key={i} className="bailongma-event-item">
              <span className="bailongma-event-time">{e.time}</span>
              <span className="bailongma-event-type">[{e.type}]</span>
              <span className="bailongma-event-desc">{e.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default BaiLongma;
