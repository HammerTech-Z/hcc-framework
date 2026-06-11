// StatusBadge — UI-CN-001a (2026-06-11).
// Pure presentational component. Zero IPC, zero runtime, zero network.
// Renders a bilingual boundary badge: 中文 · English in primary text,
// full English anchor strings in title attribute for test stability.
//
// Labels are sourced from the single source of truth in
// src/renderer/src/screens/Layout/boundary-badge.ts (KIND_LABEL_CN /
// getBoundaryKindLabel). No duplicate table is maintained here.

import type { ScreenBoundaryKind } from "../../../../shared/lib/screen-boundary-contract";
import { getBoundaryKindLabel } from "../../screens/Layout/boundary-badge";

export interface StatusBadgeProps {
  kind: ScreenBoundaryKind;
  className?: string;
  /** Override the default tooltip. Useful for appending dynamic context
   *  (view name, risk level, IPC bridge status) from the caller. */
  tooltip?: string;
}

export function StatusBadge({
  kind,
  className = "",
  tooltip,
}: StatusBadgeProps): React.ReactElement {
  const label = getBoundaryKindLabel(kind);
  const title = tooltip ?? label.tooltip;
  return (
    <span
      className={`hp-status-badge ${className}`.trim()}
      title={title}
    >
      {label.primary}
    </span>
  );
}
