// BaiLongma P2: 主驾驶舱 — 读所有可用 preload API
// Hard boundaries: no new IPC handles, no writes, read-only via existing preload APIs
// P2 panels use ONLY: getGatewayState, listVaultFiles, knowledgeSearch, listPipelineRuns, getEvents, listCronJobs

import React, { useState, useEffect } from "react";

// ----- Types -----

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

interface PipelineRun {
  runId: string;
  taskName: string;
  status: string;
  conclusion: string;
  createdAt: string;
  updatedAt: string;
  artifactCount: number;
}

interface SystemEvent {
  ts: string;
  event: string;
  task_id?: string;
  role?: string;
  [k: string]: unknown;
}

interface PhaseInfo {
  label: string;
  detail: string;
  status: "passed" | "active" | "pending";
}

interface RiskItem {
  text: string;
  type: "blocker" | "warning";
}

// ----- Stage data (read-only, synchronized with NEXT_STEP.md) -----

const STAGES: PhaseInfo[] = [
  { label: "P0", detail: "knowledgeSearch 固定查询 0 超时 — PASS", status: "passed" },
  { label: "P0.5", detail: "Handoff Pack & Verifier Report 生成 — PASS", status: "passed" },
  { label: "P1", detail: "GBrain typed links MVP — PASS", status: "passed" },
  { label: "P1.5", detail: "Usage Feedback Ledger in-memory — PASS", status: "passed" },
  { label: "P2", detail: "BaiLongma 主驾驶舱升级 — PASS", status: "passed" },
  { label: "P2.5", detail: "安全基座 — PASS", status: "passed" },
  { label: "P3", detail: "dry-run 001-006 + 008 + 009 + harness 8 artifact — PASS / real execution paused", status: "active" },
  { label: "P3.5", detail: "Hermes Agent soft switch ACTIVE（candidate v0.15.1 1-2 天观察期） / hard cutover 未批准", status: "active" },
  { label: "P7", detail: "WeChat/iLink 低优先级 4 个 cron job deliver=local — 已完成", status: "passed" },
  { label: "Prod", detail: "BaiLongma Productionization — NOT APPROVED（保持只读增强）", status: "pending" },
];

// ----- Helpers -----

function timeAgo(ts: string): string {
  const d = new Date(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 3600)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

// ----- Sub-panels -----

function StageBar({ stages }: { stages: PhaseInfo[] }) {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">当前阶段 / 总体进度</div>
      {stages.map((s) => (
        <div key={s.label} className="bailongma-stage-row">
          <span className={`bailongma-stage-badge ${s.status}`}>{s.label}</span>
          <span className={`bailongma-stage-status ${s.status}`}>
            {s.status === "passed" ? "✓" : s.status === "active" ? "▶" : "○"}
          </span>
          <span className="bailongma-stage-detail">{s.detail}</span>
        </div>
      ))}
    </div>
  );
}

function GatewayPanel({ gw }: { gw: GatewayState | null }) {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">Gateway / Knowledge 状态</div>
      {gw ? (
        <>
          <div className="bailongma-brain-item">
            <span className={gw.gateway_state === "running" ? "bailongma-status-done" : "bailongma-status-pending"}>
              {gw.gateway_state === "running" ? "✓" : "!"}
            </span>
            <span>Gateway: {gw.gateway_state}</span>
            <span className="bailongma-text-muted">pid={gw.pid}</span>
          </div>
          <div className="bailongma-brain-item">
            <span className="bailongma-status-done">✓</span>
            <span>Active agents: {gw.active_agents}</span>
          </div>
          {Object.entries(gw.platforms).map(([name, p]) => (
            <div key={name} className="bailongma-brain-item">
              <span className={p.state === "connected" || p.state === "running" ? "bailongma-status-done" : "bailongma-status-pending"}>
                {p.state === "connected" || p.state === "running" ? "✓" : "!"}
              </span>
              <span>{name}: {p.state}</span>
            </div>
          ))}
          <div className="bailongma-brain-item">
            <span className="bailongma-text-muted">更新: {timeAgo(gw.updated_at)} 前</span>
          </div>
        </>
      ) : (
        <div className="bailongma-brain-item">
          <span className="bailongma-status-pending">?</span>
          <span>Gateway 未连接</span>
        </div>
      )}
    </div>
  );
}

function VaultStatsPanel({ groups }: { groups: VaultGroup[] }) {
  const totalFiles = groups.reduce((s, g) => s + g.files.length, 0);
  const dirs = groups.map((g) => g.dir);
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">Knowledge / Vault 状态</div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-done">✓</span>
        <span>Vault: {totalFiles} 文件</span>
      </div>
      {dirs.map((d) => {
        const cnt = groups.find((g) => g.dir === d)?.files.length ?? 0;
        return (
          <div key={d} className="bailongma-brain-item">
            <span className="bailongma-text-muted">·</span>
            <span>{d}: {cnt} files</span>
          </div>
        );
      })}
      <div className="bailongma-panel-title" style={{ marginTop: 8 }}>Handoff Pack 状态</div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-pending">—</span>
        <span>无 preload IPC — 未接线</span>
      </div>
    </div>
  );
}

function GBrainPanel() {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">GBrain Typed Links 状态</div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-done">✓</span>
        <span>typed-links.ts 已实现</span>
      </div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-pending">—</span>
        <span>无 typed links 统计 IPC — 未接线</span>
      </div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-pending">—</span>
        <span>Knowledge screen 可本地计算，但 BaiLongma 不做估算</span>
      </div>
    </div>
  );
}

function UsageFeedbackPanel() {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">Usage Feedback Ledger 状态</div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-done">✓</span>
        <span>usage-feedback.ts 已实现</span>
      </div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-pending">—</span>
        <span>in-memory only — 无法从 renderer 轮询</span>
      </div>
      <div className="bailongma-brain-item">
        <span className="bailongma-text-muted">P1.5: append-only ledger</span>
      </div>
    </div>
  );
}

function RisksPanel({ risks }: { risks: RiskItem[] }) {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">风险 / 阻塞</div>
      {risks.length === 0 ? (
        <div className="bailongma-brain-item">
          <span className="bailongma-status-done">✓</span>
          <span>无阻塞风险</span>
        </div>
      ) : (
        risks.map((r, i) => (
          <div key={i} className="bailongma-brain-item">
            <span className={r.type === "blocker" ? "bailongma-status-pending" : "bailongma-status-warn"}>
              {r.type === "blocker" ? "✗" : "!"}
            </span>
            <span>{r.text}</span>
          </div>
        ))
      )}
    </div>
  );
}

function NextActionsPanel() {
  const nextItems = [
    "P3 真实执行入口仍需用户单独批准（HCC Auto Executor paused）",
    "BaiLongma Productionization 仍未批准，当前保持只读增强",
    "Hermes Agent hard cutover 未批准，P3.5 soft switch 观察期内仅 read-only",
    "P7 已完成 WeChat/iLink 低优先级 4 job deliver=local；高优先级投递策略仍待决策",
    "hidden view 后台轮询已暂停（Layout.tsx visitedViews 模式）",
  ];
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">下一步行动</div>
      {nextItems.map((item, i) => (
        <div key={i} className="bailongma-brain-item">
          <span className="bailongma-stage-badge" style={{ fontSize: 10 }}>{i + 1}</span>
          <span>{item}</span>
        </div>
      ))}
    </div>
  );
}

function PipelineArtifactsPanel({ runs }: { runs: PipelineRun[] }) {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">artifacts / verification</div>
      <div className="bailongma-brain-item">
        <span className="bailongma-status-done">✓</span>
        <span>listPipelineRuns() 可用</span>
      </div>
      <div className="bailongma-text-muted" style={{ padding: "4px 0" }}>最近 pipeline runs:</div>
      {runs.slice(0, 5).map((r) => (
        <div key={r.runId} className="bailongma-brain-item">
          <span className={r.conclusion === "success" ? "bailongma-status-done" : r.conclusion === "failed" ? "bailongma-status-pending" : "bailongma-status-warn"}>
            {r.conclusion === "success" ? "✓" : r.conclusion === "failed" ? "✗" : "?"}
          </span>
          <span>{r.taskName || r.runId.slice(0, 8)}</span>
          <span className="bailongma-text-muted">{r.conclusion}</span>
        </div>
      ))}
      {runs.length === 0 && (
        <div className="bailongma-brain-item">
          <span className="bailongma-text-muted">暂无 pipeline runs</span>
        </div>
      )}
    </div>
  );
}

function CronSummaryPanel({ totalJobs, failedJobs }: { totalJobs: number; failedJobs: number }) {
  return (
    <div className="bailongma-panel">
      <div className="bailongma-panel-title">Cron Jobs 快照</div>
      <div className="bailongma-stats">
        <div className="bailongma-stat">
          <span className="bailongma-stat-value">{totalJobs}</span>
          <span className="bailongma-stat-label">total</span>
        </div>
        <div className="bailongma-stat">
          <span className="bailongma-stat-value bailongma-stat-ok">{totalJobs - failedJobs}</span>
          <span className="bailongma-stat-label">ok</span>
        </div>
        <div className="bailongma-stat">
          <span className={`bailongma-stat-value ${failedJobs > 0 ? "bailongma-stat-err" : "bailongma-stat-ok"}`}>
            {failedJobs}
          </span>
          <span className="bailongma-stat-label">errors</span>
        </div>
      </div>
      <div className="bailongma-panel-title" style={{ marginTop: 8 }}>最近系统事件</div>
    </div>
  );
}

// ----- Main component -----

interface BaiLongmaProps {
  profile?: string;
}

export default function BaiLongma({ profile }: BaiLongmaProps): React.JSX.Element {
  const [gw, setGw] = useState<GatewayState | null>(null);
  const [vaultGroups, setVaultGroups] = useState<VaultGroup[]>([]);
  const [pipelineRuns, setPipelineRuns] = useState<PipelineRun[]>([]);
  const [events, setEvents] = useState<SystemEvent[]>([]);
  const [jobs, setJobs] = useState<{ last_status: string | null; last_error: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all data via existing preload APIs
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [gwRes, vaultRes, runsRes, evRes, cronRes] = await Promise.all([
          window.hermesAPI.getGatewayState().catch(() => null),
          window.hermesAPI.listVaultFiles().catch(() => []),
          window.hermesAPI.listPipelineRuns(20).catch(() => []),
          window.hermesAPI.getEvents(20).catch(() => []),
          window.hermesAPI.listCronJobs(true, profile).catch(() => []),
        ]);
        if (cancelled) return;

        if (gwRes) setGw(gwRes);
        if (vaultRes) setVaultGroups(vaultRes);
        if (runsRes) setPipelineRuns(runsRes);
        if (evRes) setEvents(evRes);
        if (cronRes) setJobs(cronRes);

        setError(null);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [profile]);

  const totalJobs = jobs.length;
  const failedJobs = jobs.filter((j) => j.last_status === "error" || (j.last_error && j.last_error.length > 0)).length;

  const risks: RiskItem[] = [
    { text: "HCC Auto Executor — paused（未批准、未启动、未接线）", type: "blocker" },
    { text: "P3 真实执行 — 仍需用户显式批准（不调用 runPlaybook / trigger / send）", type: "blocker" },
    { text: "BaiLongma Productionization — NOT APPROVED（仅允许只读增强）", type: "blocker" },
    { text: "Hermes Agent hard cutover — 未批准（仅 P3.5 soft switch 观察期 ACTIVE）", type: "blocker" },
    { text: "P7 WeChat/iLink — 低优先级 4 个 cron job 已切 deliver=local（高优先级投递策略仍待决策）", type: "warning" },
    { text: "Handoff Pack — 无 preload IPC，标注未接线", type: "warning" },
    { text: "Usage Feedback Ledger — in-memory only，无法从 renderer 轮询", type: "warning" },
    { text: "GBrain typed links — 无独立 IPC，由 Knowledge screen 计算", type: "warning" },
    { text: "hidden view polling — Layout.tsx visitedViews 模式，无主动轮询", type: "warning" },
  ];

  if (loading) {
    return (
      <div className="bailongma-container">
        <div className="bailongma-poc-badge">BaiLongma Read-only Cockpit · 只读 · 无新增 IPC · 无写入</div>
        <div className="bailongma-loading">
          <div className="bailongma-spinner" />
          <span>Loading cockpit...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bailongma-container">
        <div className="bailongma-poc-badge">BaiLongma Read-only Cockpit · 出错了</div>
        <div className="bailongma-error-state">
          <div className="bailongma-error-icon">!</div>
          <div className="bailongma-error-title">加载失败</div>
          <div className="bailongma-error-msg">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bailongma-container">
      <div className="bailongma-poc-badge">BaiLongma Read-only Cockpit · 只读 · 无新增 IPC · 无写入 · P3.5 soft switch 观察期</div>

      {/* Top: Stage progress */}
      <StageBar stages={STAGES} />

      {/* Middle: 3-column cockpit */}
      <div className="bailongma-cockpit">
        {/* Left column */}
        <div className="bailongma-col-left">
          <GatewayPanel gw={gw} />
          <VaultStatsPanel groups={vaultGroups} />
        </div>

        {/* Center column */}
        <div className="bailongma-col-center">
          <GBrainPanel />
          <UsageFeedbackPanel />
          <RisksPanel risks={risks} />
        </div>

        {/* Right column */}
        <div className="bailongma-col-right">
          <PipelineArtifactsPanel runs={pipelineRuns} />
          <NextActionsPanel />
          <CronSummaryPanel totalJobs={totalJobs} failedJobs={failedJobs} />
        </div>
      </div>

      {/* Bottom: Recent events */}
      <div className="bailongma-event-log">
        <div className="bailongma-event-log-title">
          最近系统事件（最新 {events.length} 条，来自 getEvents API）
        </div>
        <div className="bailongma-event-list">
          {events.map((e, i) => (
            <div key={i} className="bailongma-event-item">
              <span className="bailongma-event-time">{e.ts ? timeAgo(e.ts) : ""}</span>
              <span className="bailongma-event-type">[{e.event}]</span>
              <span className="bailongma-event-desc">
                {e.task_id ? `task=${e.task_id}` : ""} {e.role ? `role=${e.role}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
