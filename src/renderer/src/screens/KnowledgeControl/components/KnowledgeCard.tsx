import { FileText, Link2 } from "lucide-react";
import type { KnowledgeControlItem } from "../knowledge-control-model";
import TrustBadge from "./TrustBadge";

function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

const PROMPT_USE_LABEL: Record<KnowledgeControlItem["allowPromptUse"], string> = {
  yes: "可用于回答",
  prefer_local: "优先本地",
  ask_first: "需先询问",
  no: "禁止用于回答",
};

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
      <div className="knowledge-control-card-title">{item.title}</div>
      <div className="knowledge-control-card-meta-row">
        <span className="knowledge-control-source">{item.sourceType}</span>
        <TrustBadge item={item} />
        <span className="knowledge-control-prompt-use" data-allowed={item.allowPromptUse}>
          {PROMPT_USE_LABEL[item.allowPromptUse]}
        </span>
      </div>
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
