import { Database, FileStack, GitBranch, ShieldCheck } from "lucide-react";
import type { KnowledgeControlItem } from "../knowledge-control-model";
import TrustBadge from "./TrustBadge";

function formatDate(value: string | null): string {
  if (!value) return "not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="knowledge-control-inspector-section">
      <div className="knowledge-control-inspector-title">{title}</div>
      {children}
    </section>
  );
}

export default function KnowledgeInspector({
  item,
}: {
  item: KnowledgeControlItem | null;
}): React.JSX.Element {
  if (!item) {
    return (
      <aside className="knowledge-control-inspector">
        <div className="knowledge-control-inspector-empty">
          <Database size={18} />
          <span>Select a knowledge card</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className="knowledge-control-inspector">
      <div className="knowledge-control-inspector-head">
        <div>
          <div className="knowledge-control-inspector-kicker">{item.sourceType}</div>
          <h2>{item.title}</h2>
        </div>
        <TrustBadge item={item} />
      </div>

      <Section title="Provenance">
        <div className="knowledge-control-detail-row">
          <span>path</span>
          <strong>{item.path}</strong>
        </div>
        <div className="knowledge-control-detail-row">
          <span>captured</span>
          <strong>{formatDate(item.capturedAt)}</strong>
        </div>
        <div className="knowledge-control-detail-row">
          <span>verified</span>
          <strong>{formatDate(item.verifiedAt)}</strong>
        </div>
        <div className="knowledge-control-detail-row">
          <span>source refs</span>
          <strong>{item.provenanceCount}</strong>
        </div>
      </Section>

      <Section title="Linked Notes">
        {item.linkedNotes.length === 0 ? (
          <div className="knowledge-control-muted">No links detected.</div>
        ) : (
          item.linkedNotes.map((link) => (
            <div key={link} className="knowledge-control-chip-row">
              <GitBranch size={12} />
              <span>{link}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Related Tasks">
        {item.linkedTasks.length === 0 ? (
          <div className="knowledge-control-muted">No task references detected.</div>
        ) : (
          item.linkedTasks.map((task) => (
            <div key={task} className="knowledge-control-chip-row">
              <FileStack size={12} />
              <span>{task}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Answer Policy">
        <div className="knowledge-control-policy">
          <ShieldCheck size={13} />
          <span>
            {item.allowPromptUse === "yes"
              ? "Can be used in future answers."
              : item.allowPromptUse === "prefer_local"
              ? "Prefer local knowledge before web sources."
              : item.allowPromptUse === "ask_first"
              ? "Ask before using in answers."
              : "Do not use without review."}
          </span>
        </div>
        <div className="knowledge-control-muted">
          Read-only board. Ingest and promotion remain outside this surface.
        </div>
      </Section>

      <Section title="Audit Trail">
        <div className="knowledge-control-detail-row">
          <span>lifecycle</span>
          <strong>{item.lifecycle}</strong>
        </div>
        <div className="knowledge-control-detail-row">
          <span>redaction</span>
          <strong>{item.redactionStatus}</strong>
        </div>
      </Section>
    </aside>
  );
}
