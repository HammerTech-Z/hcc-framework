import { useState, useCallback, useEffect } from "react";
import Chat, { ChatMessage } from "../Chat/Chat";
import Sessions from "../Sessions/Sessions";
import Agents from "../Agents/Agents";
import Settings from "../Settings/Settings";
import Skills from "../Skills/Skills";
import Soul from "../Soul/Soul";
import Memory from "../Memory/Memory";
import Tools from "../Tools/Tools";
import Gateway from "../Gateway/Gateway";
import AgentMonitor from "../AgentMonitor";
import Office from "../Office/Office";
import Playbooks from "../Playbooks/Playbooks";
import Understand from "../Understand/Understand";
import Models from "../Models/Models";
import Providers from "../Providers/Providers";
import Schedules from "../Schedules/Schedules";
import BaiLongma from "../BaiLongma";
import HccCockpit from "../HccCockpit";
import RemoteNotice from "../../components/RemoteNotice";
import hermeslogo from "../../assets/hermes.png";
import {
  ChatBubble,
  Clock,
  Users,
  Settings as SettingsIcon,
  Puzzle,
  Sparkles,
  Brain,
  Wrench,
  Signal,
  Building,
  Layers,
  KeyRound,
  Timer,
  Download,
  Monitor,
  ChevronDown,
  X,
} from "../../assets/icons";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "../../components/useI18n";

type View =
  | "chat"
  | "sessions"
  | "agents"
  | "office"
  | "models"
  | "providers"
  | "skills"
  | "soul"
  | "memory"
  | "tools"
  | "schedules"
  | "gateway"
  | "monitor"
  | "playbooks"
  | "understand"
  | "hccCockpit"
  | "settings"
  | "bailongma";

interface NavItem {
  view: View;
  icon: LucideIcon;
  labelKey: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Work",
    items: [
      { view: "chat", icon: ChatBubble, labelKey: "navigation.chat" },
      { view: "sessions", icon: Clock, labelKey: "navigation.sessions" },
      { view: "office", icon: Building, labelKey: "navigation.office" },
      { view: "playbooks", icon: Layers, labelKey: "navigation.playbooks" },
      { view: "understand", icon: Sparkles, labelKey: "navigation.understand" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { view: "skills", icon: Puzzle, labelKey: "navigation.skills" },
      { view: "soul", icon: Sparkles, labelKey: "navigation.soul" },
      { view: "memory", icon: Brain, labelKey: "navigation.memory" },
    ],
  },
  {
    label: "Agents",
    items: [
      { view: "agents", icon: Users, labelKey: "navigation.agents" },
      { view: "bailongma", icon: Monitor, labelKey: "navigation.bailongma" },
      { view: "hccCockpit", icon: Monitor, labelKey: "navigation.hccCockpit" },
      { view: "monitor", icon: Monitor, labelKey: "navigation.monitor" },
    ],
  },
  {
    label: "System",
    items: [
      { view: "models", icon: Layers, labelKey: "navigation.models" },
      { view: "providers", icon: KeyRound, labelKey: "navigation.providers" },
      { view: "tools", icon: Wrench, labelKey: "navigation.tools" },
      { view: "schedules", icon: Timer, labelKey: "navigation.schedules" },
      { view: "gateway", icon: Signal, labelKey: "navigation.gateway" },
      { view: "settings", icon: SettingsIcon, labelKey: "navigation.settings" },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function Layout(): React.JSX.Element {
  const { t } = useI18n();
  const [view, setView] = useState<View>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeProfile, setActiveProfile] = useState("default");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  // Tabs lazy-mount on first visit, then stay mounted (display:none toggle).
  // Keeps IPC refetch / DOM rebuild off the tab-switch hot path.
  const [visitedViews, setVisitedViews] = useState<Set<View>>(
    () => new Set<View>(["chat"]),
  );
  // Remote-only mode — SSH tunnel has full access; only pure HTTP remote mode restricts screens
  const [remoteMode, setRemoteMode] = useState(false);

  const paneStyle = (target: View): React.CSSProperties => ({
    display: view === target ? "flex" : "none",
    flex: 1,
    flexDirection: "column",
    overflow: "hidden",
  });

  const goTo = useCallback((v: View) => {
    setVisitedViews((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
    setView(v);
  }, []);

  // Re-check remote mode on tab switch (picks up Settings changes)
  useEffect(() => {
    window.hermesAPI.isRemoteOnlyMode().then(setRemoteMode);
  }, [view]);

  // Auto-update state
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateState, setUpdateState] = useState<
    "available" | "downloading" | "ready" | null
  >(null);
  const [downloadPercent, setDownloadPercent] = useState(0);

  useEffect(() => {
    const cleanupAvailable = window.hermesAPI.onUpdateAvailable((info) => {
      setUpdateVersion(info.version);
      setUpdateState("available");
    });
    const cleanupProgress = window.hermesAPI.onUpdateDownloadProgress(
      (info) => {
        setDownloadPercent(info.percent);
      },
    );
    const cleanupDownloaded = window.hermesAPI.onUpdateDownloaded(() => {
      setUpdateState("ready");
    });
    return () => {
      cleanupAvailable();
      cleanupProgress();
      cleanupDownloaded();
    };
  }, []);

  async function handleUpdate(): Promise<void> {
    if (updateState === "available") {
      setUpdateState("downloading");
      await window.hermesAPI.downloadUpdate();
    } else if (updateState === "ready") {
      await window.hermesAPI.installUpdate();
    }
  }

  const handleNewChat = useCallback(() => {
    // Abort any in-flight chat before clearing
    window.hermesAPI.abortChat();
    setMessages([]);
    setCurrentSessionId(null);
    goTo("chat");
  }, [goTo]);

  // Listen for menu IPC events (Cmd+N, Cmd+K from app menu)
  useEffect(() => {
    const cleanupNewChat = window.hermesAPI.onMenuNewChat(() => {
      handleNewChat();
    });
    const cleanupSearch = window.hermesAPI.onMenuSearchSessions(() => {
      goTo("sessions");
    });
    return () => {
      cleanupNewChat();
      cleanupSearch();
    };
  }, [handleNewChat, goTo]);

  const handleSelectProfile = useCallback((name: string) => {
    setActiveProfile(name);
    setMessages([]);
    setCurrentSessionId(null);
  }, []);

  const handleResumeSession = useCallback(
    async (sessionId: string) => {
      const dbMessages = await window.hermesAPI.getSessionMessages(sessionId);
      const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
        id: `db-${m.id}`,
        role: m.role === "user" ? "user" : "agent",
        content: m.content,
      }));
      setMessages(chatMessages);
      setCurrentSessionId(sessionId);
      goTo("chat");
    },
    [goTo],
  );

  const activeItem = NAV_ITEMS.find((item) => item.view === view);
  const activeLabel = activeItem ? t(activeItem.labelKey) : t("common.appName");

  return (
    <div
      className={`layout ${sidebarCollapsed ? "layout-sidebar-collapsed" : ""} ${
        inspectorOpen ? "layout-inspector-open" : ""
      }`}
    >
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={hermeslogo} height={30} alt="" />
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <nav className="sidebar-nav overflow-y-auto custom-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="sidebar-nav-group">
              <div className="sidebar-nav-group-label">{group.label}</div>
              {group.items.map(({ view: v, icon: Icon, labelKey }) => (
                <button
                  key={v}
                  className={`sidebar-nav-item ${view === v ? "active" : ""}`}
                  onClick={() => goTo(v)}
                  title={sidebarCollapsed ? t(labelKey) : undefined}
                >
                  <Icon size={16} />
                  <span className="sidebar-nav-label">{t(labelKey)}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          {updateState && (
            <button className="sidebar-update-btn" onClick={handleUpdate}>
              <Download size={13} />
              {updateState === "available" && (
                <span>
                  {t("common.updateAvailable", { version: updateVersion })}
                </span>
              )}
              {updateState === "downloading" && (
                <span>
                  {t("common.downloading", { percent: downloadPercent })}
                </span>
              )}
              {updateState === "ready" && (
                <span>{t("common.restartToUpdate")}</span>
              )}
            </button>
          )}
          <div className="sidebar-footer-text">
            {activeProfile === "default" ? t("common.appName") : activeProfile}
          </div>
        </div>
      </aside>

      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar-title">
            <span className="shell-topbar-kicker">Hermes Pro</span>
            <span className="shell-topbar-view">{activeLabel}</span>
          </div>
          <div className="shell-status-strip" aria-label="System status">
            <span className="shell-status-badge">read-only shell</span>
            <span className="shell-status-badge">KEEP v0.15.1</span>
            <span className="shell-status-badge">profile: {activeProfile}</span>
            <button
              type="button"
              className={`shell-inspector-toggle ${inspectorOpen ? "active" : ""}`}
              onClick={() => setInspectorOpen((value) => !value)}
            >
              Inspector
            </button>
          </div>
        </header>

        <main className="content">
          <div style={paneStyle("chat")}>
            <Chat
              messages={messages}
              setMessages={setMessages}
              sessionId={currentSessionId}
              profile={activeProfile}
              onNewChat={handleNewChat}
            />
          </div>

          {visitedViews.has("sessions") && (
            <div style={paneStyle("sessions")}>
              {remoteMode ? (
                <RemoteNotice feature="Sessions" />
              ) : (
                <Sessions
                  onResumeSession={handleResumeSession}
                  onNewChat={handleNewChat}
                  currentSessionId={currentSessionId}
                />
              )}
            </div>
          )}

        {visitedViews.has("agents") && (
          <div style={paneStyle("agents")}>
            {remoteMode ? (
              <RemoteNotice feature="Profiles" />
            ) : (
              <Agents
                activeProfile={activeProfile}
                onSelectProfile={handleSelectProfile}
                onChatWith={(name: string) => {
                  handleSelectProfile(name);
                  goTo("chat");
                }}
              />
            )}
          </div>
        )}

        {visitedViews.has("office") && (
          <div style={paneStyle("office")}>
            <Office visible={view === "office"} />
          </div>
        )}

        {visitedViews.has("models") && (
          <div style={paneStyle("models")}>
            <Models />
          </div>
        )}

        {visitedViews.has("providers") && (
          <div style={paneStyle("providers")}>
            {remoteMode ? (
              <RemoteNotice feature="Providers" />
            ) : (
              <Providers
                profile={activeProfile}
                visible={view === "providers"}
              />
            )}
          </div>
        )}

        {visitedViews.has("skills") && (
          <div style={paneStyle("skills")}>
            {remoteMode ? (
              <RemoteNotice feature="Skills" />
            ) : (
              <Skills profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("soul") && (
          <div style={paneStyle("soul")}>
            {remoteMode ? (
              <RemoteNotice feature="Persona" />
            ) : (
              <Soul profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("memory") && (
          <div style={paneStyle("memory")}>
            {remoteMode ? (
              <RemoteNotice feature="Memory" />
            ) : (
              <Memory profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("tools") && (
          <div style={paneStyle("tools")}>
            {remoteMode ? (
              <RemoteNotice feature="Tools" />
            ) : (
              <Tools profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("schedules") && (
          <div style={paneStyle("schedules")}>
            <Schedules profile={activeProfile} />
          </div>
        )}

        {visitedViews.has("gateway") && (
          <div style={paneStyle("gateway")}>
            {remoteMode ? (
              <RemoteNotice feature="Gateway" />
            ) : (
              <Gateway profile={activeProfile} />
            )}
          </div>
        )}

        {visitedViews.has("monitor") && (
          <div style={paneStyle("monitor")}>
            {remoteMode ? (
              <RemoteNotice feature="Monitor" />
            ) : (
              <AgentMonitor />
            )}
          </div>
        )}

        {visitedViews.has("playbooks") && (
          <div style={paneStyle("playbooks")}>
            <Playbooks />
          </div>
        )}

        {visitedViews.has("understand") && (
          <div style={paneStyle("understand")}>
            <Understand />
          </div>
        )}

        {visitedViews.has("bailongma") && (
          <div style={paneStyle("bailongma")}>
            <BaiLongma profile={activeProfile} />
          </div>
        )}

        {visitedViews.has("hccCockpit") && (
          <div style={paneStyle("hccCockpit")}>
            <HccCockpit />
          </div>
        )}

          {visitedViews.has("settings") && (
            <div style={paneStyle("settings")}>
              <Settings profile={activeProfile} />
            </div>
          )}
        </main>
      </div>

      <aside className="shell-inspector" hidden={!inspectorOpen}>
        <div className="shell-inspector-header">
          <span>Inspector</span>
          <button
            type="button"
            className="shell-inspector-close"
            onClick={() => setInspectorOpen(false)}
            aria-label="Close inspector"
          >
            <X size={13} />
          </button>
        </div>
        <div className="shell-inspector-body">
          <div className="shell-inspector-section">
            <span className="shell-inspector-label">Current view</span>
            <strong>{activeLabel}</strong>
          </div>
          <div className="shell-inspector-section">
            <span className="shell-inspector-label">Boundary</span>
            <span>Slice 2 shell only. No new IPC or runtime action.</span>
          </div>
          <div className="shell-inspector-section">
            <span className="shell-inspector-label">Future use</span>
            <span>References, provenance, run details, and safety context.</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default Layout;
