import type { KnowledgeControlItem, KnowledgeLifecycle } from "../knowledge-control-model";
import KnowledgeCard from "./KnowledgeCard";

const COLUMN_LABELS: Record<KnowledgeLifecycle, string> = {
  inbox: "收件箱",
  candidate: "候选",
  verified: "已验证",
  linked: "已链接",
  stale: "过期",
  archived: "归档",
};

const COLUMN_HINTS: Record<KnowledgeLifecycle, string> = {
  inbox: "Captured, unreviewed",
  candidate: "Needs verification",
  verified: "Trusted local reference",
  linked: "Connected notes",
  stale: "Needs web re-check",
  archived: "Retained, inactive",
};

export const KNOWLEDGE_COLUMNS: KnowledgeLifecycle[] = [
  "inbox",
  "candidate",
  "verified",
  "linked",
  "stale",
  "archived",
];

export default function KnowledgeColumn({
  lifecycle,
  items,
  selectedId,
  onSelect,
}: {
  lifecycle: KnowledgeLifecycle;
  items: KnowledgeControlItem[];
  selectedId: string | null;
  onSelect: (item: KnowledgeControlItem) => void;
}): React.JSX.Element {
  return (
    <section className="knowledge-control-column">
      <div className="knowledge-control-column-header">
        <div>
          <span>{COLUMN_LABELS[lifecycle]}</span>
          <small>{COLUMN_HINTS[lifecycle]}</small>
        </div>
        <strong>{items.length}</strong>
      </div>
      <div className="knowledge-control-column-body">
        {items.length === 0 ? (
          <div className="knowledge-control-empty">No cards</div>
        ) : (
          items.map((item) => (
            <KnowledgeCard
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </section>
  );
}
