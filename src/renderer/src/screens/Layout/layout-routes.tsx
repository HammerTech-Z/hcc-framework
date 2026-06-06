// UI Slice 2: Layout route/map table.
// Renderer-only. No IPC, no fetch, no shell bridge.
// 21 routes correspond 1:1 to CONTRACTS view order in screen-boundary-contract.ts
// (UI Slice 1 descriptor). Behavior parity with pre-refactor Layout.tsx is the
// contract: chat is the only non-lazy view; the 20 others are lazy-mounted and
// toggled via display:none. remoteMode restricted routes render <RemoteNotice />.
//
// Source layout-routes.test.ts enforces length, order, lazy flags,
// remote_notice_feature count, legacy_source invariants, and source purity.

import React from "react";
import Chat, { type ChatMessage } from "../Chat/Chat";
import Sessions from "../Sessions/Sessions";
import Agents from "../Agents/Agents";
import Settings from "../Settings/Settings";
import Skills from "../Skills/Skills";
import Soul from "../Soul/Soul";
import Memory from "../Memory/Memory";
import Knowledge from "../Knowledge";
import KnowledgeControl from "../KnowledgeControl";
import Tools from "../Tools/Tools";
import Gateway from "../Gateway/Gateway";
import AgentMonitor from "../AgentMonitor";
import Office from "../Office/Office";
import Playbooks from "../Playbooks/Playbooks";
import Understand from "../Understand/Understand";
import Models from "../Models/Models";
import Providers from "../Providers/Providers";
import Schedules from "../Schedules/Schedules";
import Mission from "../Mission";
import RemoteNotice from "../../components/RemoteNotice";

export type LayoutViewId =
  | "chat"
  | "sessions"
  | "agents"
  | "office"
  | "models"
  | "providers"
  | "skills"
  | "soul"
  | "memory"
  | "knowledgeControl"
  | "knowledge"
  | "tools"
  | "schedules"
  | "gateway"
  | "monitor"
  | "playbooks"
  | "understand"
  | "mission"
  | "hccCockpit"
  | "settings"
  | "bailongma";

export interface RouteRenderProps {
  view: LayoutViewId;
  activeView: LayoutViewId;
  activeProfile: string;
  remoteMode: boolean;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentSessionId: string | null;
  onNewChat: () => void;
  onResumeSession: (sessionId: string) => void;
  onSelectProfile: (name: string) => void;
  onChatWith: (name: string) => void;
}

export interface LayoutRoute {
  view: LayoutViewId;
  // false → always mounted (chat only). true → lazy mounted via visitedViews.
  lazy: boolean;
  // Component name (string) for test introspection. Stable across refactors.
  component_name: string;
  // Source guard marker for legacy Mission aliases: null | "bailongma" | "hcc".
  legacy_source: "bailongma" | "hcc" | null;
  // RemoteNotice feature label. null means no remote notice (always render the
  // component when visited).
  remote_notice_feature: string | null;
  // Sidebar group label derived from UI Slice 1 contract.
  sidebar_group: "Work" | "Knowledge" | "Agents" | "System";
  // Pure render fn. Receives full RouteRenderProps; Layout owns state.
  render: (props: RouteRenderProps) => React.ReactNode;
}

// Helper: render a remote-restricted route through RemoteNotice when remoteMode
// is on, else render the component. Kept inline to keep the table readable.
function remoteGuarded(
  feature: string,
  component: React.ReactNode,
  remoteMode: boolean,
): React.ReactNode {
  return remoteMode ? <RemoteNotice feature={feature} /> : component;
}

function renderChat(props: RouteRenderProps): React.ReactNode {
  return (
    <Chat
      messages={props.messages}
      setMessages={props.setMessages}
      sessionId={props.currentSessionId}
      profile={props.activeProfile}
      onNewChat={props.onNewChat}
    />
  );
}

function renderSessions(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Sessions",
    <Sessions
      onResumeSession={props.onResumeSession}
      onNewChat={props.onNewChat}
      currentSessionId={props.currentSessionId}
    />,
    props.remoteMode,
  );
}

function renderAgents(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Profiles",
    <Agents
      activeProfile={props.activeProfile}
      onSelectProfile={props.onSelectProfile}
      onChatWith={props.onChatWith}
    />,
    props.remoteMode,
  );
}

function renderOffice(props: RouteRenderProps): React.ReactNode {
  return <Office visible={props.activeView === "office"} />;
}

function renderModels(): React.ReactNode {
  return <Models />;
}

function renderProviders(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Providers",
    <Providers
      profile={props.activeProfile}
      visible={props.activeView === "providers"}
    />,
    props.remoteMode,
  );
}

function renderSkills(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Skills",
    <Skills profile={props.activeProfile} />,
    props.remoteMode,
  );
}

function renderSoul(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Persona",
    <Soul profile={props.activeProfile} />,
    props.remoteMode,
  );
}

function renderMemory(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Memory",
    <Memory profile={props.activeProfile} />,
    props.remoteMode,
  );
}

function renderKnowledgeControl(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Knowledge Control",
    <KnowledgeControl />,
    props.remoteMode,
  );
}

function renderKnowledge(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded("Knowledge", <Knowledge />, props.remoteMode);
}

function renderTools(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Tools",
    <Tools profile={props.activeProfile} />,
    props.remoteMode,
  );
}

function renderSchedules(props: RouteRenderProps): React.ReactNode {
  return <Schedules profile={props.activeProfile} />;
}

function renderGateway(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded(
    "Gateway",
    <Gateway profile={props.activeProfile} />,
    props.remoteMode,
  );
}

function renderMonitor(props: RouteRenderProps): React.ReactNode {
  return remoteGuarded("Monitor", <AgentMonitor />, props.remoteMode);
}

function renderPlaybooks(): React.ReactNode {
  return <Playbooks />;
}

function renderUnderstand(): React.ReactNode {
  return <Understand />;
}

function renderMission(props: RouteRenderProps): React.ReactNode {
  return <Mission profile={props.activeProfile} />;
}

function renderBailongma(props: RouteRenderProps): React.ReactNode {
  return <Mission profile={props.activeProfile} legacySource="bailongma" />;
}

function renderHccCockpit(props: RouteRenderProps): React.ReactNode {
  return <Mission profile={props.activeProfile} legacySource="hcc" />;
}

function renderSettings(props: RouteRenderProps): React.ReactNode {
  return <Settings profile={props.activeProfile} />;
}

export const LAYOUT_ROUTES: readonly LayoutRoute[] = [
  {
    view: "chat",
    lazy: false,
    component_name: "Chat",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "Work",
    render: renderChat,
  },
  {
    view: "sessions",
    lazy: true,
    component_name: "Sessions",
    legacy_source: null,
    remote_notice_feature: "Sessions",
    sidebar_group: "Work",
    render: renderSessions,
  },
  {
    view: "office",
    lazy: true,
    component_name: "Office",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "Work",
    render: renderOffice,
  },
  {
    view: "mission",
    lazy: true,
    component_name: "Mission",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "Work",
    render: renderMission,
  },
  {
    view: "playbooks",
    lazy: true,
    component_name: "Playbooks",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "Work",
    render: renderPlaybooks,
  },
  {
    view: "understand",
    lazy: true,
    component_name: "Understand",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "Work",
    render: renderUnderstand,
  },
  {
    view: "skills",
    lazy: true,
    component_name: "Skills",
    legacy_source: null,
    remote_notice_feature: "Skills",
    sidebar_group: "Knowledge",
    render: renderSkills,
  },
  {
    view: "knowledgeControl",
    lazy: true,
    component_name: "KnowledgeControl",
    legacy_source: null,
    remote_notice_feature: "Knowledge Control",
    sidebar_group: "Knowledge",
    render: renderKnowledgeControl,
  },
  {
    view: "knowledge",
    lazy: true,
    component_name: "Knowledge",
    legacy_source: null,
    remote_notice_feature: "Knowledge",
    sidebar_group: "Knowledge",
    render: renderKnowledge,
  },
  {
    view: "soul",
    lazy: true,
    component_name: "Soul",
    legacy_source: null,
    remote_notice_feature: "Persona",
    sidebar_group: "Knowledge",
    render: renderSoul,
  },
  {
    view: "memory",
    lazy: true,
    component_name: "Memory",
    legacy_source: null,
    remote_notice_feature: "Memory",
    sidebar_group: "Knowledge",
    render: renderMemory,
  },
  {
    view: "agents",
    lazy: true,
    component_name: "Agents",
    legacy_source: null,
    remote_notice_feature: "Profiles",
    sidebar_group: "Agents",
    render: renderAgents,
  },
  {
    view: "bailongma",
    lazy: true,
    component_name: "Mission",
    legacy_source: "bailongma",
    remote_notice_feature: null,
    sidebar_group: "Agents",
    render: renderBailongma,
  },
  {
    view: "hccCockpit",
    lazy: true,
    component_name: "Mission",
    legacy_source: "hcc",
    remote_notice_feature: null,
    sidebar_group: "Agents",
    render: renderHccCockpit,
  },
  {
    view: "monitor",
    lazy: true,
    component_name: "AgentMonitor",
    legacy_source: null,
    remote_notice_feature: "Monitor",
    sidebar_group: "Agents",
    render: renderMonitor,
  },
  {
    view: "models",
    lazy: true,
    component_name: "Models",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "System",
    render: renderModels,
  },
  {
    view: "providers",
    lazy: true,
    component_name: "Providers",
    legacy_source: null,
    remote_notice_feature: "Providers",
    sidebar_group: "System",
    render: renderProviders,
  },
  {
    view: "tools",
    lazy: true,
    component_name: "Tools",
    legacy_source: null,
    remote_notice_feature: "Tools",
    sidebar_group: "System",
    render: renderTools,
  },
  {
    view: "schedules",
    lazy: true,
    component_name: "Schedules",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "System",
    render: renderSchedules,
  },
  {
    view: "gateway",
    lazy: true,
    component_name: "Gateway",
    legacy_source: null,
    remote_notice_feature: "Gateway",
    sidebar_group: "System",
    render: renderGateway,
  },
  {
    view: "settings",
    lazy: true,
    component_name: "Settings",
    legacy_source: null,
    remote_notice_feature: null,
    sidebar_group: "System",
    render: renderSettings,
  },
] as const;

export const LAYOUT_REMOTE_RESTRICTED_VIEWS: readonly LayoutViewId[] =
  LAYOUT_ROUTES.filter((route) => route.remote_notice_feature !== null).map(
    (route) => route.view,
  );
