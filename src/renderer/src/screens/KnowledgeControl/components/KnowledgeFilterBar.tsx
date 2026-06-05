import { RefreshCw, Search } from "lucide-react";

export default function KnowledgeFilterBar({
  query,
  activeFilter,
  loading,
  onQueryChange,
  onFilterChange,
  onRefresh,
}: {
  query: string;
  activeFilter: string;
  loading: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: string) => void;
  onRefresh: () => void;
}): React.JSX.Element {
  const filters = ["all", "github", "web", "local_note", "agent_report", "conversation", "stale"];

  return (
    <div className="knowledge-control-filterbar">
      <div className="knowledge-control-search">
        <Search size={14} />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search local knowledge inventory"
        />
      </div>
      <div className="knowledge-control-filters">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={activeFilter === filter ? "active" : ""}
            onClick={() => onFilterChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="knowledge-control-refresh"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={13} />
        {loading ? "Reading" : "Refresh"}
      </button>
    </div>
  );
}
