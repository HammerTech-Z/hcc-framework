import { useState, useEffect, useCallback, useRef } from "react";

type StepStatus = "pending" | "running" | "success" | "failed";

interface StepDef {
  id: string;
  label: string;
  hccStage: string;
}

interface PlaybookDef {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: StepDef[];
}

interface StepState {
  id: string;
  label: string;
  hccStage: string;
  status: StepStatus;
  error?: string;
  output?: string;
}

const HCC_COLORS: Record<string, string> = {
  HCC5: "#7C3AED",
  HCC6: "#D97706",
  HCC7: "#059669",
};

function PlaybookCard({
  playbook,
  selected,
  onSelect,
  disabled,
}: {
  playbook: PlaybookDef;
  selected: boolean;
  onSelect: () => void;
  disabled: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onSelect}
      className={`playbooks-card ${selected ? "selected" : ""} ${disabled ? "disabled" : ""}`}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <h3 className="playbooks-card-name">{playbook.name}</h3>
        <span className="playbooks-card-version">v{playbook.version}</span>
      </div>
      <p className="playbooks-card-desc">{playbook.description}</p>
      <div className="playbooks-card-phases">
        phases: {playbook.steps.length}
      </div>
    </div>
  );
}

function HCCBadge({ stage }: { stage: string }) {
  const stageMap: Record<string, string> = {
    stage_5_claude_code_execute: "HCC5",
    stage_6_review_test: "HCC6",
    stage_7_delivery: "HCC7",
  };
  const mapped = stageMap[stage];
  if (!mapped) return null;
  return (
    <span className="playbooks-hcc-badge" style={{
      background: `${HCC_COLORS[mapped]}22`,
      color: HCC_COLORS[mapped],
      marginLeft: 6,
    }}>
      {mapped.replace("HCC", "HCC-")}
    </span>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "pending":
      return <span style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid var(--text-muted)", display: "inline-block", flexShrink: 0 }} />;
    case "running":
      return <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#3B82F6", display: "inline-block", flexShrink: 0, animation: "pulse 1s infinite" }} />;
    case "success":
      return <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#10B981", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", flexShrink: 0 }}>✓</span>;
    case "failed":
      return <span style={{ width: 16, height: 16, borderRadius: "50%", background: "#EF4444", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", flexShrink: 0 }}>✗</span>;
  }
}

export function PlaybookRunner() {
  const [playbooks, setPlaybooks] = useState<PlaybookDef[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepState[]>([]);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupsRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    window.hermesAPI?.listPlaybooks().then(setPlaybooks).catch(() => {});
  }, []);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    if (window.hermesAPI?.onPlaybookStep) {
      cleanups.push(
        window.hermesAPI.onPlaybookStep((step) => {
          setSteps((prev) => {
            const idx = prev.findIndex((s) => s.id === step.id);
            const entry: StepState = {
              id: step.id,
              label: step.label,
              hccStage: step.hccStage,
              status: step.status as StepStatus,
              error: step.error,
              output: step.output,
            };
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = entry;
              return next;
            }
            return [...prev, entry];
          });
        }),
      );
    }
    if (window.hermesAPI?.onPlaybookDone) {
      cleanups.push(
        window.hermesAPI.onPlaybookDone((result) => {
          setRunning(false);
          setFinalStatus(result.finalStatus);
        }),
      );
    }
    if (window.hermesAPI?.onPlaybookError) {
      cleanups.push(
        window.hermesAPI.onPlaybookError((err) => {
          setRunning(false);
          setError(err);
          setFinalStatus("failed");
        }),
      );
    }
    cleanupsRef.current = cleanups;
    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleRun = useCallback(() => {
    if (!selectedId || running) return;
    setRunning(true);
    setSteps([]);
    setFinalStatus(null);
    setError(null);
    window.hermesAPI?.runPlaybook(selectedId);
  }, [selectedId, running]);

  const selected = playbooks.find((p) => p.id === selectedId);

  return (
    <div className="playbooks-container">
      <div className="playbooks-header">
        Playbook Runner
        {finalStatus && (
          <span style={{
            fontSize: 12, padding: "4px 8px", borderRadius: 4,
            background: finalStatus === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)",
            color: finalStatus === "success" ? "#10B981" : "#EF4444",
          }}>
            {finalStatus === "success" ? "PASS" : `FAIL: ${finalStatus}`}
          </span>
        )}
      </div>

      <div className="playbooks-grid">
        {playbooks.map((pb) => (
          <PlaybookCard
            key={pb.id}
            playbook={pb}
            selected={selectedId === pb.id}
            onSelect={() => setSelectedId(pb.id)}
            disabled={running}
          />
        ))}
      </div>

      {selected && !running && steps.length === 0 && (
        <div className="playbooks-detail">
          <h3 className="playbooks-detail-title">Selected: {selected.name}</h3>
          <div className="playbooks-steps">
            {selected.steps.map((s) => (
              <span key={s.id} className="playbooks-step-tag">{s.label}</span>
            ))}
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleRun}>
            Run Playbook (HCC Pipeline)
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <div className="playbooks-pipeline">
          <h3 className="playbooks-pipeline-title">HCC Pipeline Status</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {steps.map((step) => (
              <div key={step.id} className="playbooks-step-row">
                <StatusIcon status={step.status} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="playbooks-step-label">
                    {step.label}
                    <HCCBadge stage={step.hccStage} />
                    {step.status === "running" && (
                      <span style={{ color: "#3B82F6", fontSize: 12, marginLeft: 8 }}>running...</span>
                    )}
                  </div>
                  {step.output && step.status === "success" && (
                    <div className="playbooks-step-output">{step.output}</div>
                  )}
                  {step.error && (
                    <div style={{ fontSize: 12, color: "#EF4444", marginTop: 4, background: "rgba(239,68,68,0.1)", padding: 8, borderRadius: 4 }}>
                      {step.error}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="playbooks-error">
          <h3 style={{ fontSize: 13, fontWeight: 600, color: "#EF4444", marginBottom: 8 }}>Error</h3>
          <pre className="playbooks-error-text">{error}</pre>
        </div>
      )}
    </div>
  );
}

export default PlaybookRunner;
