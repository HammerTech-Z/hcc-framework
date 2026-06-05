# Hermes Pro — v2.2 UI 设计规范

> Superseded / historical reference (2026-06-05): 当前 UI redesign 方向以
> `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md` 为准。
> 本文保留为 P2-era 视觉方案与 token 历史参考，不作为当前 UI implementation 任务入口。

> 基于 BaiLongma（执行手册-v1.2）+ Voltagent + Linear 设计系统
> 目标：知识库状态可视化，让用户看见碎片从识别到被用上的全程
> 更新：Phase 0 配套组件（T0.1-T0.5）

---

## 1. 设计定位

### 视觉定位
- **深色为主**：沿用 BaiLongma 深空主题（`--bg0: #0a1118`）
- **简洁克制**：参考 Voltagent/Llinear 的 hairline 边框系统
- **数据驱动**：参考 Supabase/Linear 的统计面板布局

### 设计参考
| 项目 | 参考内容 |
|------|---------|
| BaiLongma | 颜色系统、6套主题、玻璃拟态 |
| Voltagent | 深色卡片、hairline边框、简洁排版 |
| Linear | 数据面板布局、状态指示器 |
| Supabase | 统计卡片、pill标签 |

---

## 2. 颜色系统

### 深空主题（默认）

```css
/* 深空主题 — 基于 BaiLongma */
:root, [data-theme="deep-space"] {
  /* 背景层 */
  --bg-deep: #060c12;
  --bg0: #0a1118;      /* 主背景 */
  --bg1: #101820;      /* 卡片背景 */
  --panel: rgba(16, 24, 32, 0.85);  /* 玻璃面板 */

  /* 文字 */
  --ink: #d7e2ee;      /* 主文字 */
  --ink2: #a8bccf;     /* 次要文字 */
  --dim: #5a7080;      /* 弱化文字 */

  /* 边框 */
  --line: #1e2e3e;     /* 头发丝边框 */
  --line-strong: #2a3d50;  /* 强调边框 */

  /* 强调色 */
  --cool: #8fb6d8;     /* 蓝调强调 */
  --warm: #d39872;     /* 暖调强调 */

  /* 节点 */
  --node-low: #1a2e40;
  --node-high: #2a4a60;

  /* 发光效果 */
  --glow-halo: rgba(80, 140, 200, 0.15);
  --glow-tint1: rgba(80, 140, 200, 0.08);
  --glow-tint2: rgba(200, 120, 60, 0.06);
}

/* 赛博绿主题 */
[data-theme="phosphor"] {
  --bg0: #050806;
  --bg1: #0a0f0a;
  --ink: #c8f0c8;
  --ink2: #90c890;
  --cool: #9fe09a;
  --line: #0f1f0f;
  --line-strong: #183018;
}

/* 紫罗兰主题 */
[data-theme="violet"] {
  --bg0: #0d0a1a;
  --bg1: #140f22;
  --ink: #e4deff;
  --ink2: #b8a8f0;
  --cool: #b098f0;
  --line: #1a1430;
  --line-strong: #28204a;
}

/* 玫瑰主题 */
[data-theme="rose"] {
  --bg0: #1a0f16;
  --bg1: #22141e;
  --ink: #f4e0e4;
  --ink2: #d8b0b8;
  --cool: #e89aa8;
  --line: #2a1520;
  --line-strong: #3a2030;
}

/* 北极光（浅色）*/
[data-theme="arctic"] {
  --bg0: #f0f4f8;
  --bg1: #ffffff;
  --ink: #1a2a3a;
  --ink2: #4a5a6a;
  --cool: #4a8ab8;
  --line: #d0dce8;
  --line-strong: #b0c0d0;
}

/* 沙色（浅色）*/
[data-theme="sand"] {
  --bg0: #f5f0e8;
  --bg1: #faf6ee;
  --ink: #2a2418;
  --ink2: #6a5a48;
  --cool: #c8a878;
  --line: #e0d4c0;
  --line-strong: #c8b898;
}
```

### 语义颜色

```css
/* 状态色 */
--accent: #003f7a;           /* 主强调（蓝色）*/
--accent-hover: #0055a4;
--accent-subtle: rgba(0, 63, 122, 0.15);

--success: #22c55e;
--success-bg: rgba(34, 197, 94, 0.1);

--error: #ef4444;
--error-bg: rgba(239, 68, 68, 0.1);

--warning: #f59e0b;
--warning-bg: rgba(245, 158, 11, 0.1);
```

---

## 3. 排版系统

### 字体

```css
/* 字体栈 — macOS 原生优先 */
--font-sans: "SF Pro", "Google Sans", Inter, system-ui, -apple-system, sans-serif;
--font-mono: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", monospace;

/* 字号层级 */
--text-xs: 0.75rem;    /* 12px - 标签 */
--text-sm: 0.875rem;   /* 14px - 次要 */
--text-base: 1rem;     /* 16px - 正文 */
--text-lg: 1.125rem;   /* 18px - 标题 */
--text-xl: 1.25rem;    /* 20px - 大标题 */
--text-2xl: 1.5rem;    /* 24px - 区块标题 */
--text-3xl: 1.875rem;  /* 30px - 页面标题 */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 排版层级

| Token | 字号 | 字重 | 行高 | 用途 |
|-------|------|------|------|------|
| `text-3xl` | 30px | 600 | 1.2 | 页面标题 |
| `text-2xl` | 24px | 600 | 1.25 | 区块标题 |
| `text-xl` | 20px | 600 | 1.3 | 卡片标题 |
| `text-lg` | 18px | 500 | 1.4 | 小标题 |
| `text-base` | 16px | 400 | 1.5 | 正文 |
| `text-sm` | 14px | 400 | 1.5 | 次要文字 |
| `text-xs` | 12px | 500 | 1.4 | 标签/角标 |
| `code` | 13px | 400 | 1.5 | 代码 |

---

## 4. 间距系统

### 基础间距（基于 4px）

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;  /* 40px */
--space-12: 3rem;     /* 48px */
```

### 组件间距

| 场景 | 间距 |
|------|------|
| 卡片内边距 | 24px |
| 卡片间距 | 16px |
| 分区间距 | 32px |
| 表单元素间距 | 12px |
| 列表项间距 | 8px |

---

## 5. 圆角系统

```css
--radius-none: 0;
--radius-xs: 4px;     /* 小标签、徽章 */
--radius-sm: 6px;      /* 按钮、输入框 */
--radius-md: 8px;      /* 卡片 */
--radius-lg: 12px;     /* 大卡片、面板 */
--radius-xl: 16px;     /* 模态框 */
--radius-full: 9999px; /* 胶囊标签 */
```

---

## 6. 阴影与深度

### 深度层级（基于 Voltagent/LLinear）

```css
/* Level 0 — 纯平 */
box-shadow: none;

/* Level 1 — Hairline 边框 */
border: 1px solid var(--line);

/* Level 2 — 微发光 */
box-shadow: 0 0 15px rgba(92, 88, 85, 0.2);

/* Level 3 — 面板悬浮 */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

/* Level 4 — 模态 */
box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(148, 163, 184, 0.1) inset;
```

### 玻璃拟态（BaiLongma）

```css
.glass-panel {
  background: var(--panel);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--line);
}

.glass-sidebar {
  background: rgba(10, 17, 24, 0.85);
  backdrop-filter: blur(24px);
  border-right: 1px solid var(--line);
}
```

---

## 7. P2 知识库组件

### 7.1 统计卡片（StatsCard）

用于展示：今日入库数、分区数、调用次数

```tsx
interface StatsCardProps {
  label: string;        // "今日入库"
  value: number | string;
  icon: React.ReactNode;
  trend?: { value: number; positive: boolean };
  color?: 'cool' | 'warm' | 'success' | 'error';
}

<div className="stats-card">
  <div className="stats-icon">{icon}</div>
  <div className="stats-content">
    <span className="stats-label">{label}</span>
    <span className="stats-value">{value}</span>
    {trend && (
      <span className={`stats-trend ${trend.positive ? 'positive' : 'negative'}`}>
        {trend.positive ? '+' : ''}{trend.value}%
      </span>
    )}
  </div>
</div>

/* 样式 */
.stats-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.stats-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--node-low);
  border-radius: var(--radius-md);
  color: var(--cool);
}

.stats-label {
  font-size: var(--text-sm);
  color: var(--dim);
}

.stats-value {
  font-size: var(--text-2xl);
  font-weight: var(--font-semibold);
  color: var(--ink);
}
```

### 7.2 分区卡片（SectionCard）

用于展示：分区分布、各分区碎片数

```tsx
interface SectionCardProps {
  section: 'tools' | 'creative' | 'decisions' | 'pitfalls' | 'learning';
  count: number;
  lastUpdated: string;
  onClick?: () => void;
}

<div className="section-card">
  <div className="section-header">
    <span className="section-icon">{getSectionIcon(section)}</span>
    <span className="section-name">{getSectionName(section)}</span>
  </div>
  <div className="section-stats">
    <span className="section-count">{count}</span>
    <span className="section-label">条碎片</span>
  </div>
  <div className="section-footer">
    <span className="section-updated">最后更新: {lastUpdated}</span>
  </div>
</div>

/* 样式 */
.section-card {
  padding: var(--space-5);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.section-card:hover {
  border-color: var(--cool);
  box-shadow: var(--glow-halo);
}

.section-icon {
  font-size: 24px;
}

.section-name {
  font-size: var(--text-base);
  font-weight: var(--font-medium);
  color: var(--ink);
}

.section-count {
  font-size: var(--text-xl);
  font-weight: var(--font-semibold);
  color: var(--ink);
}
```

### 7.3 学习方向卡片（LearningDirectionCard）

用于展示：K3 反推的学习方向

```tsx
interface LearningDirectionCardProps {
  directions: Array<{
    topic: string;
    confidence: number;
    sources: string[];
  }>;
  generatedAt: string;
}

<div className="direction-card">
  <div className="direction-header">
    <span className="direction-icon">🎯</span>
    <span className="direction-title">当前学习方向</span>
    <span className="direction-time">{generatedAt}</span>
  </div>
  <div className="direction-list">
    {directions.map((d, i) => (
      <div key={i} className="direction-item">
        <div className="direction-rank">{i + 1}</div>
        <div className="direction-content">
          <span className="direction-topic">{d.topic}</span>
          <div className="direction-confidence">
            <div className="confidence-bar">
              <div className="confidence-fill" style={{ width: `${d.confidence * 100}%` }} />
            </div>
            <span className="confidence-value">{Math.round(d.confidence * 100)}%</span>
          </div>
          <span className="direction-sources">来源: {d.sources.join(', ')}</span>
        </div>
      </div>
    ))}
  </div>
</div>
```

### 7.4 调用记录（UsageTrace）

用于展示：碎片从入库到被调用的全过程

```tsx
interface UsageTraceProps {
  trace: {
    fragment: { title: string; section: string; ingestedAt: string };
    usage: { task: string; usedAt: string; relevance: number };
  }[];
}

<div className="usage-trace">
  {trace.map((t, i) => (
    <div key={i} className="trace-item">
      <div className="trace-line">
        <div className="trace-dot" />
        {i < trace.length - 1 && <div className="trace-connector" />}
      </div>
      <div className="trace-content">
        <div className="trace-phase">
          {i === 0 ? '入库' : i === trace.length - 1 ? '调用' : '传递'}
        </div>
        <div className="trace-title">
          {i === 0 ? t.fragment.title : t.usage.task}
        </div>
        <div className="trace-meta">
          {i === 0 ? (
            <span>{t.fragment.section} · {t.fragment.ingestedAt}</span>
          ) : (
            <span>相关度 {Math.round(t.usage.relevance * 100)}% · {t.usage.usedAt}</span>
          )}
        </div>
      </div>
    </div>
  ))}
</div>

/* 样式 */
.trace-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--cool);
  border: 2px solid var(--bg1);
}

.trace-connector {
  width: 2px;
  height: 40px;
  background: var(--line);
}

.usage-trace {
  padding: var(--space-4);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}
```

### 7.5 Agent 状态行（AgentStatusRow）

用于展示：EmployeeLibrary/AgentMonitor 中的 Agent 状态

```tsx
interface AgentStatusRowProps {
  agent: {
    name: string;
    status: 'idle' | 'running' | 'thinking' | 'complete' | 'failed';
    model?: string;
    startedAt?: string;
    progress?: number;
  };
}

<div className="agent-status-row">
  <div className={`status-indicator status-${agent.status}`} />
  <span className="agent-name">{agent.name}</span>
  {agent.model && <span className="agent-model">{agent.model}</span>}
  {agent.status === 'running' && agent.progress !== undefined && (
    <div className="agent-progress">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${agent.progress}%` }} />
      </div>
      <span className="progress-text">{agent.progress}%</span>
    </div>
  )}
  {agent.startedAt && (
    <span className="agent-time">{timeAgo(agent.startedAt)}</span>
  )}
</div>

/* 样式 */
.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-idle { background: var(--dim); }
.status-running { background: var(--cool); }
.status-thinking { background: var(--warm); animation: pulse 1.5s infinite; }
.status-complete { background: var(--success); }
.status-failed { background: var(--error); }
```

---

## 8. 知识库主面板布局

```
┌─────────────────────────────────────────────────────────────┐
│  知识库                                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │今日入库 │ │ 总碎片  │ │ 分区数  │ │ 调用次数│           │
│  │   3    │ │   28    │ │   7     │ │   15    │           │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
├─────────────────────────────────────────────────────────────┤
│  当前学习方向                              [生成于 10:30]  │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 1. AI Agent 设计模式           ████████░░ 78%        │ │
│  │ 2. 知识库架构                  ██████░░░░ 62%        │ │
│  │ 3. 多 Agent 协作               ████░░░░░░ 45%        │ │
│  └───────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  分区分布                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ 📚 工具      │ │ 🎨 创作      │ │ 💡 决策      │      │
│  │     8 条     │ │     5 条     │ │     3 条     │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │
│  │ 💥 踩坑      │ │ 📖 学习      │ │ 🧠 代码      │      │
│  │     2 条     │ │    10 条     │ │     0 条     │      │
│  └──────────────┘ └──────────────┘ └──────────────┘      │
├─────────────────────────────────────────────────────────────┤
│  最近调用记录                                              │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ● 入库  Claude Code 使用评估  tools  2026-05-21      │ │
│  │ │                                                    │ │
│  │ ● 调用  hermes-pro 界面优化    相关度 92%  10:25    │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Phase 0 新增组件（T0.x 配套）

### 9.1 Playbook 卡片（PlaybookCard）

用于：PlaybookRunner 展示 playbook 列表，点击运行

```tsx
interface PlaybookCardProps {
  id: string;
  filename: string;
  description?: string;
  onRun: (id: string) => void;
  disabled?: boolean;
}

<div className="playbook-card">
  <div className="playbook-header">
    <span className="playbook-icon">⚡</span>
    <span className="playbook-name">{id}</span>
  </div>
  {description && (
    <p className="playbook-desc">{description}</p>
  )}
  <div className="playbook-footer">
    <button
      className="playbook-run-btn"
      onClick={() => onRun(id)}
      disabled={disabled}
    >
      运行
    </button>
  </div>
</div>

/* 样式 */
.playbook-card {
  padding: var(--space-5);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.playbook-card:hover {
  border-color: var(--cool);
}

.playbook-run-btn {
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.playbook-run-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 9.2 SSE 事件流面板（SSEEventPanel）

用于：PlaybookRunner 显示实时 SSE 事件流

```tsx
interface SSEEventPanelProps {
  runId: string;
  events: SSEEvent[];
  onClose: () => void;
}

interface SSEEvent {
  type: 'message' | 'tool_call' | 'tool_result' | 'done' | 'error';
  content: string;
  timestamp: number;
}

<div className="sse-panel">
  <div className="sse-header">
    <span className="sse-status">
      <span className="status-dot running" />
      运行中: {runId.slice(0, 8)}...
    </span>
    <button className="sse-close" onClick={onClose}>×</button>
  </div>
  <div className="sse-events">
    {events.map((e, i) => (
      <div key={i} className={`event-item event-${e.type}`}>
        <span className="event-type">[{e.type}]</span>
        <pre className="event-content">{e.content}</pre>
      </div>
    ))}
  </div>
</div>

/* 样式 */
.sse-panel {
  height: 400px;
  display: flex;
  flex-direction: column;
  background: var(--bg-deep);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.sse-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--line);
}

.status-dot.running {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 1.5s infinite;
}

.sse-events {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-3);
}

.event-item {
  display: flex;
  gap: var(--space-2);
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--line);
}

.event-type {
  color: var(--dim);
  font-size: var(--text-xs);
  font-family: var(--font-mono);
}

.event-content {
  font-size: var(--text-sm);
  color: var(--ink2);
  white-space: pre-wrap;
  margin: 0;
}

.event-done .event-type { color: var(--success); }
.event-error .event-type { color: var(--error); }
.event-tool_call .event-type { color: var(--warm); }
```

### 9.3 Memory 编辑器（MemoryEditor）

用于：Settings Memory Tab 编辑 MEMORY.md 和 USER.md

```tsx
interface MemoryEditorProps {
  onSave?: (content: string) => void;
}

const MEMORY_LIMIT = 2200;
const USER_LIMIT = 1375;

function MemoryTab() {
  const [memory, setMemory] = useState("");
  const [user, setUser] = useState("");
  const [savedMemory, setSavedMemory] = useState("");
  const [savedUser, setSavedUser] = useState("");

  useEffect(() => {
    window.api.memory.read().then(info => {
      setMemory(info.memory.content);
      setUser(info.user.content);
      setSavedMemory(info.memory.content);
      setSavedUser(info.user.content);
    });
  }, []);

  const dirty = memory !== savedMemory || user !== savedUser;

  const handleSave = async () => {
    await window.api.memory.write({ memory, user });
    setSavedMemory(memory);
    setSavedUser(user);
  };

  return (
    <div className="memory-tab">
      <div className="memory-section">
        <div className="memory-header">
          <span className="memory-title">MEMORY.md</span>
          <span className="memory-count">{memory.length} / {MEMORY_LIMIT}</span>
        </div>
        <textarea
          value={memory}
          onChange={e => setMemory(e.target.value.slice(0, MEMORY_LIMIT))}
          className="memory-textarea"
        />
      </div>

      <div className="memory-section">
        <div className="memory-header">
          <span className="memory-title">USER.md</span>
          <span className="memory-count">{user.length} / {USER_LIMIT}</span>
        </div>
        <textarea
          value={user}
          onChange={e => setUser(e.target.value.slice(0, USER_LIMIT))}
          className="memory-textarea"
        />
      </div>

      <button className="memory-save" disabled={!dirty} onClick={handleSave}>
        保存 {dirty && "*"}
      </button>
    </div>
  );
}

/* 样式 */
.memory-tab {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.memory-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.memory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.memory-title {
  font-weight: var(--font-medium);
  color: var(--ink);
}

.memory-count {
  font-size: var(--text-xs);
  color: var(--dim);
  font-family: var(--font-mono);
}

.memory-textarea {
  min-height: 200px;
  padding: var(--space-3);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  resize: vertical;
}

.memory-save {
  align-self: flex-end;
  padding: var(--space-2) var(--space-4);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.memory-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 9.4 MCP 服务器卡片（MCPServerCard）

用于：Settings MCP Tab 展示已配置的 MCP 服务器

```tsx
interface MCPServerCardProps {
  server: {
    name: string;
    type: 'stdio' | 'http';
    command?: string;
    url?: string;
    enabled: boolean;
  };
  onEdit: (server: MCPServer) => void;
  onDelete: (name: string) => void;
  onToggle: (name: string, enabled: boolean) => void;
}

<div className="mcp-card">
  <div className="mcp-header">
    <span className="mcp-name">{server.name}</span>
    <span className={`mcp-badge ${server.type}`}>{server.type}</span>
  </div>
  <div className="mcp-details">
    {server.command && <code className="mcp-cmd">{server.command}</code>}
    {server.url && <code className="mcp-url">{server.url}</code>}
  </div>
  <div className="mcp-actions">
    <label className="mcp-toggle">
      <input
        type="checkbox"
        checked={server.enabled}
        onChange={e => onToggle(server.name, e.target.checked)}
      />
      <span>启用</span>
    </label>
    <button className="mcp-edit" onClick={() => onEdit(server)}>编辑</button>
    <button className="mcp-delete" onClick={() => onDelete(server.name)}>删除</button>
  </div>
</div>

/* 样式 */
.mcp-card {
  padding: var(--space-4);
  background: var(--bg1);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
}

.mcp-badge.stdio { background: var(--node-low); color: var(--cool); }
.mcp-badge.http { background: var(--node-low); color: var(--warm); }

.mcp-cmd, .mcp-url {
  display: block;
  font-size: var(--text-xs);
  color: var(--dim);
  background: var(--bg-deep);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-xs);
  margin-top: var(--space-2);
  word-break: break-all;
}

.mcp-actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin-top: var(--space-3);
}

.mcp-delete {
  color: var(--error);
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--text-sm);
}
```

### 9.5 流状态指示器（StreamIndicator）

用于：显示 SSE 连接状态

```tsx
interface StreamIndicatorProps {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  message?: string;
}

<div className={`stream-indicator stream-${status}`}>
  <span className="stream-dot" />
  <span className="stream-label">{getStatusLabel(status)}</span>
  {message && <span className="stream-msg">{message}</span>}
</div>

/* 样式 */
.stream-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
}

.stream-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.stream-connecting .stream-dot { background: var(--warning); animation: pulse 1s infinite; }
.stream-connected .stream-dot { background: var(--success); }
.stream-disconnected .stream-dot { background: var(--dim); }
.stream-error .stream-dot { background: var(--error); }

.stream-label { font-weight: var(--font-medium); }
.stream-msg { color: var(--dim); }
```

---

## 10. 实现清单

| 组件 | 来源 | 优先级 | 状态 |
|------|------|--------|------|
| 颜色变量定义 | P2-v2.2 | P0 | 待实现 |
| 统计卡片 (StatsCard) | P2-v2.2 | P0 | 待实现 |
| 分区卡片 (SectionCard) | P2-v2.2 | P0 | 待实现 |
| 学习方向卡片 (LearningDirectionCard) | P2-v2.2 | P1 | 待实现 |
| 调用记录 (UsageTrace) | P2-v2.2 | P1 | 待实现 |
| Agent 状态行 (AgentStatusRow) | P2-v2.2 | P2 | 待实现 |
| 知识库主面板布局 | P2-v2.2 | P0 | 待实现 |
| 6 套主题切换 | P2-v2.2 | P1 | 待实现 |
| 玻璃拟态面板 | P2-v2.2 | P2 | 待实现 |
| Playbook 卡片 (PlaybookCard) | T0.1 Phase0 | P0 | 新增 |
| SSE 事件流面板 (SSEEventPanel) | T0.1 Phase0 | P0 | 新增 |
| Memory 编辑器 (MemoryEditor) | T0.2 Phase0 | P0 | 新增 |
| MCP 服务器卡片 (MCPServerCard) | T0.4 Phase0 | P1 | 新增 |
| 流状态指示器 (StreamIndicator) | T0.1 Phase0 | P1 | 新增 |

---

## 11. Do's and Don'ts

### Do
- 使用 `var(--line)` 头发丝边框而非阴影作为默认卡片样式
- 深色主题为主，浅色主题可选
- 保持简洁，参考 Voltagent 的克制美学
- 数据面板使用 Linear 的精确间距

### Don't
- 不要使用渐变背景（除非玻璃拟态）
- 不要混用多种强调色
- 不要在卡片上使用多个阴影层级
- 不要使用纯黑色（#000），使用 `var(--bg-deep)` 替代
