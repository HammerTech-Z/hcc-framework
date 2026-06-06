import { useState, useCallback, useEffect } from "react";
import { type ChatMessage } from "../Chat/Chat";
import { LAYOUT_ROUTES } from "./layout-routes";
import {
  buildBoundaryBadgeDescriptor,
  buildBoundaryBadgeTitle,
} from "./boundary-badge";
import {
  BoundaryInspectorPanel,
  buildBoundaryInspectorDescriptor,
} from "./boundary-inspector";
import { getScreenBoundaryContract } from "../../../../shared/lib/screen-boundary-contract";
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
      { view: "mission", icon: Monitor, labelKey: "navigation.mission" },
      { view: "playbooks", icon: Layers, labelKey: "navigation.playbooks" },
      { view: "understand", icon: Sparkles, labelKey: "navigation.understand" },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { view: "skills", icon: Puzzle, labelKey: "navigation.skills" },
      { view: "knowledgeControl", icon: Brain, labelKey: "navigation.knowledgeControl" },
      { view: "knowledge", icon: Puzzle, labelKey: "navigation.knowledge" },
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

  useEffect(() => {
    function handleShellShortcut(event: KeyboardEvent): void {
      const key = event.key.toLowerCase();
      if (event.metaKey && event.key === "\\") {
        event.preventDefault();
        setSidebarCollapsed((value) => !value);
      }
      if (event.metaKey && event.altKey && key === "i") {
        event.preventDefault();
        setInspectorOpen((value) => !value);
      }
    }

    window.addEventListener("keydown", handleShellShortcut);
    return () => window.removeEventListener("keydown", handleShellShortcut);
  }, []);

  const activeItem = NAV_ITEMS.find((item) => item.view === view);
  const activeLabel = activeItem ? t(activeItem.labelKey) : t("common.appName");
  const boundaryContract = getScreenBoundaryContract(view);
  const boundaryBadge = buildBoundaryBadgeDescriptor(boundaryContract);
  const boundaryBadgeTitle = buildBoundaryBadgeTitle(boundaryBadge);
  const boundaryInspector = buildBoundaryInspectorDescriptor(boundaryContract);

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
            aria-pressed={sidebarCollapsed}
          >
            <ChevronDown size={14} />
          </button>
        </div>

        <nav className="sidebar-nav overflow-y-auto custom-scrollbar" aria-label="Primary navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="sidebar-nav-group">
              <div className="sidebar-nav-group-label">{group.label}</div>
              {group.items.map(({ view: v, icon: Icon, labelKey }) => (
                <button
                  key={v}
                  className={`sidebar-nav-item ${view === v ? "active" : ""}`}
                  onClick={() => goTo(v)}
                  title={sidebarCollapsed ? t(labelKey) : undefined}
                  aria-current={view === v ? "page" : undefined}
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
            <span
              className={`shell-status-badge ${boundaryBadge.class_modifier}`}
              data-view={boundaryBadge.view}
              data-kind={boundaryBadge.kind_token}
              data-risk={boundaryBadge.risk_level}
              data-direct-gateway-risk={
                boundaryBadge.direct_gateway_risk ? "true" : "false"
              }
              title={boundaryBadgeTitle}
            >
              {boundaryBadge.label}
            </span>
            <span className="shell-status-badge">KEEP v0.15.1</span>
            <span className="shell-status-badge">profile: {activeProfile}</span>
            <button
              type="button"
              className={`shell-inspector-toggle ${inspectorOpen ? "active" : ""}`}
              onClick={() => setInspectorOpen((value) => !value)}
              aria-label={inspectorOpen ? "Close inspector" : "Open inspector"}
              aria-expanded={inspectorOpen}
              aria-pressed={inspectorOpen}
            >
              Inspector
            </button>
          </div>
        </header>

        <main className="content" aria-label={activeLabel}>
          {LAYOUT_ROUTES.map((route) => {
            const mounted = !route.lazy || visitedViews.has(route.view);
            if (!mounted) return null;
            return (
              <div
                key={route.view}
                style={paneStyle(route.view)}
                data-view={route.view}
              >
                {route.render({
                  view: route.view,
                  activeView: view,
                  activeProfile,
                  remoteMode,
                  messages,
                  setMessages,
                  currentSessionId,
                  onNewChat: handleNewChat,
                  onResumeSession: handleResumeSession,
                  onSelectProfile: handleSelectProfile,
                  onChatWith: (name: string) => {
                    handleSelectProfile(name);
                    goTo("chat");
                  },
                })}
              </div>
            );
          })}
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
          <BoundaryInspectorPanel descriptor={boundaryInspector} />
        </div>
      </aside>
    </div>
  );
}

export default Layout;
