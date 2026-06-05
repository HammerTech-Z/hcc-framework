import type { KnowledgeControlItem } from "../knowledge-control-model";

export default function TrustBadge({
  item,
}: {
  item: Pick<KnowledgeControlItem, "trustLevel" | "stale" | "redactionStatus">;
}): React.JSX.Element {
  const label = item.stale ? "stale" : item.trustLevel;
  return (
    <span className={`knowledge-control-trust knowledge-control-trust-${label}`}>
      {label}
      {item.redactionStatus !== "clean" && (
        <span className="knowledge-control-redaction"> · {item.redactionStatus}</span>
      )}
    </span>
  );
}
