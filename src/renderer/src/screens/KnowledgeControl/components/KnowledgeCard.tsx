import { FileText, Link2 } from "lucide-react";
import type { KnowledgeControlItem } from "../knowledge-control-model";
import TrustBadge from "./TrustBadge";

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export default function KnowledgeCard({
  item,
  selected,
  onSelect,
}: {
  item: KnowledgeControlItem;
  selected: boolean;
  onSelect: (item: KnowledgeControlItem) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`knowledge-control-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect(item)}
    >
      <div className="knowledge-control-card-top">
        <span className="knowledge-control-source">{item.sourceType}</span>
        <TrustBadge item={item} />
      </div>
      <div className="knowledge-control-card-title">{item.title}</div>
      <p>{item.preview}</p>
      <div className="knowledge-control-card-meta">
        <span>
          <FileText size={11} />
          {item.kind}
        </span>
        <span>
          <Link2 size={11} />
          {item.linkedNotes.length}
        </span>
        <span>{shortDate(item.verifiedAt || item.capturedAt)}</span>
      </div>
    </button>
  );
}
