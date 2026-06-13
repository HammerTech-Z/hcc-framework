// UI-CHAT-001c: Context tab — live page-specific info.
// Shows current route/view name. Future: session/model/token context
// per route (read-only, existing API surface only).

import React from "react";

const VIEW_DISPLAY_LABELS: Record<string, string> = {
  chat: "Chat",
  sessions: "Sessions",
  agents: "Agents",
  office: "Office",
  models: "Models",
  providers: "Providers",
  skills: "Skills",
  soul: "Soul",
  memory: "Memory",
  knowledgeControl: "Knowledge Control",
  knowledge: "Knowledge",
  tools: "Tools",
  schedules: "Schedules",
  gateway: "Gateway",
  monitor: "Monitor",
  playbooks: "Playbooks",
  understand: "Understand",
  mission: "Mission",
  hccCockpit: "HCC Cockpit",
  settings: "Settings",
  bailongma: "BaiLongma",
};

export function ContextTab({ view }: { view: string }): React.JSX.Element {
  const label = VIEW_DISPLAY_LABELS[view] ?? view;

  return (
    <div data-testid="inspector-context-tab">
      <div className="shell-inspector-section">
        <span className="shell-inspector-label">Current view</span>
        <strong>{label}</strong>
      </div>
      <div className="shell-inspector-section">
        <span className="shell-inspector-label">View id</span>
        <code data-testid="inspector-context-view-id">{view}</code>
      </div>
      <div className="shell-inspector-section">
        <span className="shell-inspector-label">Page context</span>
        <span className="shell-inspector-muted">
          {view === "chat"
            ? "Chat session — messages, model routing, agent context."
            : `Static page — ${label} display surface.`}
        </span>
      </div>
    </div>
  );
}
