import React, { useState } from 'react';

// 内联playbook数据，无外部依赖
const playbooks = [
  {
    id: "code_dev",
    name: "code_dev",
    description: "编码闭环 — Karpathy规划 → 执行 → Bellard审核 → 交付 → 知识库反哺",
    version: 1,
    states: ["planning", "executing", "reviewing", "delivering", "escalated"],
    maxRounds: 3,
    provider: "deepseek"
  },
  {
    id: "manga_industrial",
    name: "manga_industrial",
    description: "AI漫剧多Agent协作生产流水线 — 8节点标准工艺",
    version: 2,
    nodes: ["planning", "storyboard", "asset", "first_frame", "video_prompt", "audio", "video_generation", "editing"],
    provider: "image/video/audio adapters"
  }
];

function PlaybookCard({ playbook, selected, onSelect }: { playbook: typeof playbooks[0]; selected: boolean; onSelect: () => void }) {
  const nodeCount = 'nodes' in playbook ? playbook.nodes.length : playbook.states.length;
  const nodeLabel = 'nodes' in playbook ? 'nodes' : 'states';

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-lg border cursor-pointer transition-all ${
        selected
          ? 'border-blue-500 bg-blue-900/20'
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-mono text-blue-400">{playbook.name}</h3>
        <span className="text-xs text-gray-500">v{playbook.version}</span>
      </div>
      <p className="text-xs text-gray-400 mb-3 line-clamp-2">{playbook.description}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{nodeLabel}: {nodeCount}</span>
        <span>provider: {playbook.provider}</span>
      </div>
      {'maxRounds' in playbook && (
        <p className="text-xs text-yellow-500 mt-2">max_rounds: {playbook.maxRounds}</p>
      )}
    </div>
  );
}

export function PlaybookRunner() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const selected = playbooks.find(p => p.id === selectedId);

  const handleRun = () => {
    if (!selectedId) return;
    setRunning(true);
    // TODO: 触发hermes执行
    setTimeout(() => setRunning(false), 2000);
  };

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Playbook Runner</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {playbooks.map(pb => (
          <PlaybookCard
            key={pb.id}
            playbook={pb}
            selected={selectedId === pb.id}
            onSelect={() => setSelectedId(pb.id)}
          />
        ))}
      </div>

      {selected && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-white mb-3">Selected: {selected.name}</h3>
          <div className="flex flex-wrap gap-2 mb-4">
            {'nodes' in selected
              ? selected.nodes.map(n => (
                  <span key={n} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                    {n}
                  </span>
                ))
              : selected.states.map(s => (
                  <span key={s} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                    {s}
                  </span>
                ))
            }
          </div>
          <button
            onClick={handleRun}
            disabled={running}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            {running ? 'Running...' : 'Run Playbook'}
          </button>
        </div>
      )}
    </div>
  );
}

export default PlaybookRunner;