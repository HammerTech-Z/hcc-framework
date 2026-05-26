import React, { useState } from 'react';

type FilterStatus = 'all' | 'online' | 'working' | 'offline';

// 内联数据源，无需外部导入
const employees = [
  { id: "hermes", name: "Hermes", role: "大脑/调度者", status: "online", skills: ["task_routing", "reflection", "evolution"], skillStatus: "N/A" },
  { id: "karpathy-planner", name: "Karpathy Planner", role: "规划者", status: "working", skills: ["task_planning", "risk_analysis", "HP+PM.skill"], skillStatus: "✅" },
  { id: "claude-code-executor", name: "Code Executor", role: "执行者", status: "working", skills: ["code_generation", "bash", "worktree"], skillStatus: "✅" },
  { id: "bellard-reviewer", name: "Bellard Reviewer", role: "审核者", status: "online", skills: ["code_review", "test_execution", "HP+Reviewer.skill"], skillStatus: "✅" },
  { id: "knowledge-agent", name: "Knowledge Agent", role: "知识摄取者", status: "offline", skills: ["web_scraping", "transcription", "markdown"], skillStatus: "N/A" },
  { id: "product-owner", name: "PO - Product Owner", role: "产品负责人", status: "online", skills: ["task_planning", "HP+PO.skill"], skillStatus: "✅" },
  { id: "architect", name: "Architect", role: "系统架构师", status: "online", skills: ["task_planning", "HP+Architect.skill"], skillStatus: "✅" },
  { id: "qa-engineer", name: "QA Engineer", role: "测试工程师", status: "online", skills: ["code-review-and-quality", "HP+QA.skill"], skillStatus: "✅" },
];

interface EmployeeCardProps {
  id: string;
  name: string;
  role: string;
  status: string;
  skillCount: number;
  skillStatus: string;
}

function EmployeeCard({ id, name, role, status, skillCount, skillStatus }: EmployeeCardProps) {
  const isOnline = status === "online";
  const statusColor = isOnline ? "bg-green-900/50 text-green-400" : "bg-gray-700 text-gray-400";
  const skillColor = skillStatus.startsWith("✅") ? "text-green-400"
    : skillStatus.startsWith("⏳") ? "text-yellow-400"
    : skillStatus.startsWith("❌") ? "text-red-400"
    : "text-gray-400";

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="text-xs text-gray-500 font-mono">{id}</p>
          <h3 className="text-sm font-medium text-white">{name}</h3>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${statusColor}`}>
          {isOnline ? '●' : '○'} {status}
        </span>
      </div>
      <p className="text-sm text-gray-400 mb-3">{role}</p>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">skills: {skillCount}</span>
        <span className={skillColor}>{skillStatus}</span>
      </div>
    </div>
  );
}

export function EmployeeLibrary() {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const filteredEmployees = employees.filter(emp => statusFilter === 'all' || emp.status === statusFilter);

  const filterButtons: { label: string; value: FilterStatus }[] = [
    { label: '全部', value: 'all' },
    { label: '在线', value: 'online' },
    { label: '工作中', value: 'working' },
    { label: '离线', value: 'offline' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Employee Library</h2>
      <div className="flex gap-2 mb-4">
        {filterButtons.map(btn => (
          <button
            key={btn.value}
            onClick={() => setStatusFilter(btn.value)}
            className={`px-3 py-1 rounded text-sm ${
              statusFilter === btn.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredEmployees.map((emp) => (
          <EmployeeCard
            key={emp.id}
            id={emp.id}
            name={emp.name}
            role={emp.role}
            status={emp.status}
            skillCount={emp.skills.length}
            skillStatus={emp.skillStatus}
          />
        ))}
      </div>
    </div>
  );
}

export default EmployeeLibrary;