import type { KnowledgeControlItem } from "../knowledge-control-model";

export default function TrustBadge({
  item,
}: {
  item: Pick<KnowledgeControlItem, "trustLevel" | "stale" | "redactionStatus" | "verifiedAt" | "provenanceCount">;
}): React.JSX.Element {
  const label = item.stale ? "stale" : item.trustLevel;
  const provenanceMissing =
    item.provenanceCount === 0 && item.trustLevel === "unverified" && !item.verifiedAt;
  return (
    <span className={`knowledge-control-trust knowledge-control-trust-${label}`}>
      {label}
      {provenanceMissing && (
        <span className="knowledge-control-trust-warn"> · 来源未验证</span>
      )}
      {item.redactionStatus !== "clean" && (
        <span className="knowledge-control-redaction"> · {item.redactionStatus}</span>
      )}
    </span>
  );
}
