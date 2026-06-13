// UI-CHAT-001c: Reference tab — absorbs Chat's internal reference panel.
// Shows Local Knowledge / Web Sources / Agent Judgment status cards.
// Read-only display; no live flush, no knowledgeIngest, no mutation.

import React from "react";
import { Database, Globe2, ShieldCheck } from "lucide-react";

export function ReferenceTab(): React.JSX.Element {
  return (
    <div data-testid="inspector-reference-tab">
      <div className="chat-reference-card">
        <div className="chat-reference-card-title">
          <Database size={13} />
          Local Knowledge
        </div>
        <div className="chat-reference-card-value">standby</div>
        <p>No live flush</p>
      </div>
      <div className="chat-reference-card">
        <div className="chat-reference-card-title">
          <Globe2 size={13} />
          Web Sources
        </div>
        <div className="chat-reference-card-value">manual</div>
        <p>Verify on request</p>
      </div>
      <div className="chat-reference-card">
        <div className="chat-reference-card-title">
          <ShieldCheck size={13} />
          Agent Judgment
        </div>
        <div className="chat-reference-card-value">idle</div>
        <p>Read-only UI state</p>
      </div>
    </div>
  );
}
