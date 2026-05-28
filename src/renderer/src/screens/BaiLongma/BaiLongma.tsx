// BaiLongma POC-2: Real readonly cron data integration
// Hard boundaries: no new IPC handles, no writes, read-only via existing preload APIs

import React, { useState, useEffect } from "react";

// Cron Job type from preload API (read-only)
interface CronJob {
  id: string;
  name: string;
  schedule: string;
  state: "active" | "paused" | "completed";
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

// Error classification from job.last_error
type ErrorType = "rate_limited" | "permission_required" | "connection_failed" | "unknown";

interface ClassifiedError {
  jobId: string;
  jobName: string;
  errorType: ErrorType;
  rawError: string;
}

// Step state for task progression
type StepState = "pending" | "running" | "completed";

// ACUI Event log item
interface EventLogItem {
  time: string;
  type: string;
  desc: string;
}

// Classify error type from last_error string
function classifyError(lastError: string | null): ErrorType {
  if (!lastError) return "unknown";
  const err = lastError.toLowerCase();
  if (err.includes("rate limit") || err.includes("rate_limited") || err.includes("429")) {
    return "rate_limited";
  }
  if (err.includes("401") || err.includes("403") || err.includes("unauthorized") ||
      err.includes("authentication") || err.includes("auth") || err.includes("permission")) {
    return "permission_required";
  }
  if (err.includes("connect") || err.includes("timeout") || err.includes("econnrefused") ||
      err.includes("enotfound") || err.includes("socket")) {
    return "connection_failed";
  }
  return "unknown";
}

// Error display text for UI
function errorTypeLabel(t: ErrorType): string {
  switch (t) {
    case "rate_limited": return "Rate Limited";
    case "permission_required": return "Permission Required";
    case "connection_failed": return "Connection Failed";
    default: return "Unknown";
  }
}

// Generate summary events from real job data
function generateSummaryEvents(
  totalJobs: number,
  failedJobs: number,
  errorTypes: Map<ErrorType, number>,
): EventLogItem[] {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", { hour12: false });

  const events: EventLogItem[] = [
    { time: timeStr, type: "task.created", desc: `task_id=poc-2, goal=cron failure diagnosis` },
    { time: timeStr, type: "ui_show", desc: `TaskHeader, id=hdr-2, props={loading: false}` },
    { time: timeStr, type: "step.state_change", desc: `s-1 → running (load jobs)` },
  ];

  if (failedJobs > 0) {
    const rateLimited = errorTypes.get("rate_limited") || 0;
    const permErrors = errorTypes.get("permission_required") || 0;
    const connErrors = errorTypes.get("connection_failed") || 0;

    events.push({
      time: timeStr,
      type: "context.gathered",
      desc: `loaded ${totalJobs} jobs, ${failedJobs} failed (rate=${rateLimited}, perm=${permErrors}, conn=${connErrors})`,
    });
    events.push({ time: timeStr, type: "step.state_change", desc: `s-1 → completed` });
    events.push({ time: timeStr, type: "step.state_change", desc: `s-2 → running` });
    events.push({
      time: timeStr,
      type: "artifact.created",
      desc: `id=a-1, type=diagnosis, summary=${failedJobs} failed jobs analyzed`,
    });
    events.push({ time: timeStr, type: "ui_show", desc: `DiagnosisCard, id=diag-1` });
    events.push({ time: timeStr, type: "step.state_change", desc: `s-2 → completed` });
  } else {
    events.push({
      time: timeStr,
      type: "context.gathered",
      desc: `loaded ${totalJobs} jobs, 0 failed`,
    });
    events.push({ time: timeStr, type: "step.state_change", desc: `s-1 → completed` });
    events.push({ time: timeStr, type: "step.state_change", desc: `s-2 → running` });
    events.push({
      time: timeStr,
      type: "artifact.created",
      desc: `id=a-1, type=diagnosis, summary=no failures found`,
    });
    events.push({ time: timeStr, type: "ui_show", desc: `DiagnosisCard, id=diag-1` });
    events.push({ time: timeStr, type: "step.state_change", desc: `s-2 → completed` });
  }

  events.push({ time: timeStr, type: "task.state_change", desc: `state=completed` });
  return events;
}

// Step indicator component
function StepIndicator({ state }: { state: StepState }): React.ReactNode {
  if (state === "completed") return <span className="bailongma-step-done">✓</span>;
  if (state === "running") return <span className="bailongma-step-running">●</span>;
  return <span className="bailongma-step-pending">○</span>;
}

// Props interface
interface BaiLongmaProps {
  profile?: string;
}

// Main component
function BaiLongma({ profile }: BaiLongmaProps): React.JSX.Element {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cron jobs via existing preload API (read-only)
  useEffect(() => {
    let cancelled = false;

    async function loadJobs(): Promise<void> {
      try {
        const list = await window.hermesAPI.listCronJobs(true, profile);
        if (!cancelled) {
          setJobs(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadJobs();
    return () => { cancelled = true; };
  }, [profile]);

  // Compute stats from real data
  const totalJobs = jobs.length;
  const failedJobs = jobs.filter(
    (j) => j.last_status === "error" || (j.last_error && j.last_error.length > 0),
  );
  const classifiedErrors: ClassifiedError[] = failedJobs.map((j) => ({
    jobId: j.id,
    jobName: j.name,
    errorType: classifyError(j.last_error),
    rawError: j.last_error || "unknown",
  }));

  // Error type counts for summary
  const errorTypeCounts = new Map<ErrorType, number>();
  classifiedErrors.forEach((e) => {
    errorTypeCounts.set(e.errorType, (errorTypeCounts.get(e.errorType) || 0) + 1);
  });

  // Steps always completed in POC view (diagnostic completed)
  const steps = [
    { id: "s-1", label: "gather context", state: "completed" as StepState },
    { id: "s-2", label: "analyze failures", state: "completed" as StepState },
  ];

  // Generate summary events based on real data
  const events = generateSummaryEvents(totalJobs, failedJobs.length, errorTypeCounts);

  // Loading state
  if (loading) {
    return (
      <div className="bailongma-container">
        <div className="bailongma-poc-badge">
          Read-only POC · No new IPC · No writes · Analyzing cron data...
        </div>
        <div className="bailongma-loading">
          <div className="bailongma-spinner" />
          <span>Loading readonly cron status...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bailongma-container">
        <div className="bailongma-poc-badge">
          Read-only POC · No new IPC · No writes · Error occurred
        </div>
        <div className="bailongma-error-state">
          <div className="bailongma-error-icon">!</div>
          <div className="bailongma-error-title">Failed to load cron jobs</div>
          <div className="bailongma-error-msg">{error}</div>
          <div className="bailongma-error-hint">Read-only mode — no retry or write actions.</div>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="bailongma-container">
      {/* POC Header */}
      <div className="bailongma-poc-badge">
        Read-only POC · No new IPC · No writes · Real cron data
      </div>

      {/* 3-Column Cockpit */}
      <div className="bailongma-cockpit">
        {/* Left: Focus Stack */}
        <div className="bailongma-panel bailongma-panel-left">
          <div className="bailongma-panel-title">Focus Stack</div>
          <div className="bailongma-focus-item">
            <span className="bailongma-focus-dot">●</span>
            <span>cron failure diagnosis</span>
          </div>

          {/* Job Summary Stats */}
          <div className="bailongma-stats">
            <div className="bailongma-stat">
              <span className="bailongma-stat-value">{totalJobs}</span>
              <span className="bailongma-stat-label">total jobs</span>
            </div>
            <div className="bailongma-stat">
              <span className="bailongma-stat-value bailongma-stat-ok">
                {totalJobs - failedJobs.length}
              </span>
              <span className="bailongma-stat-label">ok</span>
            </div>
            <div className="bailongma-stat">
              <span className="bailongma-stat-value bailongma-stat-err">
                {failedJobs.length}
              </span>
              <span className="bailongma-stat-label">errors</span>
            </div>
          </div>
        </div>

        {/* Center: Task Canvas */}
        <div className="bailongma-panel bailongma-panel-center">
          <div className="bailongma-panel-title">Task Canvas</div>

          {/* Task Header */}
          <div className="bailongma-task-header">
            <div className="bailongma-task-goal">Goal: cron failure diagnosis</div>
            <div className="bailongma-task-state">✓ completed</div>
          </div>

          {/* Steps */}
          <div className="bailongma-steps">
            {steps.map((step, i) => (
              <div key={step.id} className="bailongma-step">
                <span className="bailongma-step-num">[{i + 1}]</span>
                <StepIndicator state={step.state} />
                <span className="bailongma-step-label">{step.label}</span>
              </div>
            ))}
          </div>

          {/* Diagnosis Card */}
          {failedJobs.length > 0 ? (
            <div className="bailongma-diagnosis-card">
              <div className="bailongma-diagnosis-header">● {failedJobs.length} Failed Jobs</div>
              <div className="bailongma-diagnosis-body">
                <div className="bailongma-diagnosis-error">
                  {failedJobs.length} jobs with errors
                </div>
                {Array.from(errorTypeCounts.entries()).map(([type, count]) => (
                  <div key={type} className="bailongma-error-type-row">
                    <span className="bailongma-error-type-badge">{errorTypeLabel(type)}</span>
                    <span className="bailongma-error-type-count">×{count}</span>
                  </div>
                ))}
                <div className="bailongma-diagnosis-suggestion">
                  Suggestion: Review failed jobs in Schedules screen
                </div>
              </div>
            </div>
          ) : (
            <div className="bailongma-diagnosis-card bailongma-diagnosis-ok">
              <div className="bailongma-diagnosis-header">✓ All Jobs OK</div>
              <div className="bailongma-diagnosis-body">
                <div className="bailongma-diagnosis-msg">
                  No failed cron jobs detected.
                </div>
              </div>
            </div>
          )}

          {/* Failed Job List */}
          {failedJobs.length > 0 && (
            <div className="bailongma-failed-list">
              <div className="bailongma-failed-list-title">Failed Jobs</div>
              {classifiedErrors.slice(0, 5).map((e) => (
                <div key={e.jobId} className="bailongma-failed-item">
                  <span className="bailongma-failed-badge" data-type={e.errorType}>
                    {errorTypeLabel(e.errorType).slice(0, 3)}
                  </span>
                  <span className="bailongma-failed-name">{e.jobName}</span>
                </div>
              ))}
              {classifiedErrors.length > 5 && (
                <div className="bailongma-failed-more">
                  +{classifiedErrors.length - 5} more failures
                </div>
              )}
            </div>
          )}

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
            <div className="bailongma-brain-item">
              <span className="bailongma-status-done">✓</span>
              <span>listCronJobs (read-only)</span>
            </div>
            <div className="bailongma-brain-item">
              <span className="bailongma-status-done">✓</span>
              <span>error classification</span>
            </div>
          </div>

          {/* Artifacts */}
          <div className="bailongma-brain-section">
            <div className="bailongma-panel-title">Artifacts</div>
            <div className="bailongma-brain-item">
              <span className="bailongma-artifact-tag">diagnosis:</span>
              <span>{failedJobs.length} failures / {totalJobs} total</span>
            </div>
          </div>

          {/* Errors */}
          <div className="bailongma-brain-section">
            <div className="bailongma-panel-title">Errors</div>
            {classifiedErrors.length === 0 ? (
              <div className="bailongma-brain-item">
                <span className="bailongma-status-done">✓</span>
                <span>no errors</span>
              </div>
            ) : (
              classifiedErrors.slice(0, 3).map((e, i) => (
                <div key={i} className="bailongma-brain-item">
                  <span className="bailongma-status-pending">!</span>
                  <span>{e.errorType}: {e.jobName.slice(0, 20)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ACUI Event Log (bottom drawer) */}
      <div className="bailongma-event-log">
        <div className="bailongma-event-log-title">ACUI Event Log (from real data)</div>
        <div className="bailongma-event-list">
          {events.map((e, i) => (
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