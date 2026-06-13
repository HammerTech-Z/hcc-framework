// UI-CHAT-001c: three-tab inspector (上下文 / 引用 / 边界).
// Replaces single-purpose BoundaryInspectorPanel with tabbed layout.
// No IPC, no runtime actions, no new event subscriptions.

import React, { useState } from "react";
import type { BoundaryInspectorDescriptor } from "../../screens/Layout/boundary-inspector";
import { ContextTab } from "./ContextTab";
import { ReferenceTab } from "./ReferenceTab";
import { BoundaryTab } from "./BoundaryTab";

type TabId = "context" | "reference" | "boundary";

interface TabDef {
  id: TabId;
  label: string;
}

const TABS: TabDef[] = [
  { id: "context", label: "上下文" },
  { id: "reference", label: "引用" },
  { id: "boundary", label: "边界" },
];

export function InspectorTabs({
  view,
  descriptor,
}: {
  view: string;
  descriptor: BoundaryInspectorDescriptor;
}): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>("context");

  return (
    <div className="hp-inspector-tabs">
      <div className="hp-inspector-tab-bar" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="hp-inspector-tab"
            data-active={activeTab === tab.id ? "" : undefined}
            data-testid={`inspector-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="hp-inspector-tab-panel" role="tabpanel">
        {activeTab === "context" && <ContextTab view={view} />}
        {activeTab === "reference" && <ReferenceTab />}
        {activeTab === "boundary" && <BoundaryTab descriptor={descriptor} />}
      </div>
    </div>
  );
}
