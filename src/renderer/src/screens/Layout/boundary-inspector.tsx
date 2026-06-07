// UI Slice 4: Inspector boundary detail panel.
// Pure presentational component over ScreenBoundaryContract. No IPC, no
// network, no runtime action. Consumed by Layout.tsx to render the right
// shell-inspector panel with per-view boundary detail.

import React from "react";
import type {
  ScreenBoundaryContract,
  ScreenViewId,
} from "../../../../shared/lib/screen-boundary-contract";
import type { WriteActionDisplayState } from "./write-action-display-state";

export interface BoundaryInspectorDescriptor {
  view: ScreenViewId;
  display_label: string;
  sidebar_group: ScreenBoundaryContract["sidebar_group"];
  boundary_kind: ScreenBoundaryContract["boundary_kind"];
  risk_level: ScreenBoundaryContract["risk_level"];
  api_methods_count: number;
  mutating_methods_count: number;
  write_surfaces: readonly string[];
  direct_gateway_methods: readonly string[];
  migrated_ipc_methods: readonly string[];
  remote_mode_restricted: boolean;
  model_strategy_relevant: boolean;
  notes: readonly string[];
  safety_invariants: ScreenBoundaryContract["safety_invariants"];
  // UI Slice 6: write-action visual gating descriptor, computed upstream.
  write_action: WriteActionDisplayState;
}

export function buildBoundaryInspectorDescriptor(
  contract: ScreenBoundaryContract | undefined,
  writeAction: WriteActionDisplayState,
): BoundaryInspectorDescriptor {
  if (!contract) {
    return {
      view: "chat",
      display_label: "Chat",
      sidebar_group: "Work",
      boundary_kind: "read_only",
      risk_level: "P3",
      api_methods_count: 0,
      mutating_methods_count: 0,
      write_surfaces: [],
      direct_gateway_methods: [],
      migrated_ipc_methods: [],
      remote_mode_restricted: false,
      model_strategy_relevant: false,
      notes: ["contract lookup missed; showing safe fallback"],
      safety_invariants: {
        new_ipc_allowed: false,
        runtime_activation_allowed: false,
        config_writes_allowed_by_contract: false,
        hcc_auto_executor_allowed: false,
        direct_gateway_fix_applied: false,
      },
      write_action: writeAction,
    };
  }
  return {
    view: contract.view,
    display_label: contract.display_label,
    sidebar_group: contract.sidebar_group,
    boundary_kind: contract.boundary_kind,
    risk_level: contract.risk_level,
    api_methods_count: contract.api_methods.length,
    mutating_methods_count: contract.api_methods.filter((m) => m.mutates)
      .length,
    write_surfaces: contract.write_surfaces,
    direct_gateway_methods: contract.direct_gateway_methods,
    migrated_ipc_methods: contract.migrated_ipc_methods,
    remote_mode_restricted: contract.remote_mode_restricted,
    model_strategy_relevant: contract.model_strategy_relevant,
    notes: contract.notes,
    safety_invariants: contract.safety_invariants,
    write_action: writeAction,
  };
}

function section(
  label: string,
  children: React.ReactNode,
): React.ReactElement {
  return (
    <div className="shell-inspector-section">
      <span className="shell-inspector-label">{label}</span>
      {children}
    </div>
  );
}

export function BoundaryInspectorPanel({
  descriptor,
}: {
  descriptor: BoundaryInspectorDescriptor;
}): React.ReactElement {
  const isReadOnly = descriptor.boundary_kind === "read_only";
  const hasDirectGateway = descriptor.direct_gateway_methods.length > 0;
  const hasWrites = descriptor.write_surfaces.length > 0;

  return (
    <div data-view={descriptor.view} data-risk={descriptor.risk_level}>
      {section(
        "Current view",
        <strong>{descriptor.display_label}</strong>,
      )}
      {section(
        "View id",
        <code data-testid="inspector-view-id">{descriptor.view}</code>,
      )}
      {section(
        "Sidebar group",
        <span data-testid="inspector-sidebar-group">
          {descriptor.sidebar_group}
        </span>,
      )}
      {section(
        "Boundary kind",
        <span data-testid="inspector-boundary-kind">
          {descriptor.boundary_kind}
        </span>,
      )}
      {section(
        "Risk level",
        <span data-testid="inspector-risk-level">
          {descriptor.risk_level}
        </span>,
      )}
      {section(
        "API methods",
        <span data-testid="inspector-api-methods">
          {descriptor.api_methods_count} ({descriptor.mutating_methods_count}{" "}
          mutating)
        </span>,
      )}
      {section(
        "Write surfaces",
        hasWrites ? (
          <ul
            className="shell-inspector-list"
            data-testid="inspector-write-surfaces"
          >
            {descriptor.write_surfaces.map((surface) => (
              <li key={surface}>{surface}</li>
            ))}
          </ul>
        ) : (
          <span
            data-testid="inspector-no-write-surfaces"
            data-read-only="true"
          >
            no write surfaces
          </span>
        ),
      )}
      {hasDirectGateway && (
        <div
          className="shell-inspector-section"
          data-testid="inspector-direct-gateway-callout"
          data-risk="P0"
          data-callout="direct-gateway"
        >
          <span className="shell-inspector-label">
            Direct gateway risk
          </span>
          <div data-testid="inspector-direct-gateway-type">
            <strong>risk type: direct gateway</strong>
          </div>
          <div data-testid="inspector-direct-gateway-methods">
            <strong>methods: </strong>
            {descriptor.direct_gateway_methods.join(", ")}
          </div>
          <div data-testid="inspector-direct-gateway-meaning">
            meaning: bypasses main-process IPC boundary
          </div>
          <div data-testid="inspector-direct-gateway-status">
            status: display-only, not fixed by this slice
          </div>
        </div>
      )}
      {section(
        "Remote mode",
        <span data-testid="inspector-remote-mode">
          {descriptor.remote_mode_restricted
            ? "restricted in remote mode"
            : "available in remote mode"}
        </span>,
      )}
      {section(
        "Model strategy",
        <span data-testid="inspector-model-strategy">
          {descriptor.model_strategy_relevant ? "relevant" : "not relevant"}
        </span>,
      )}
      {section(
        "Notes",
        descriptor.notes.length > 0 ? (
          <ul
            className="shell-inspector-list"
            data-testid="inspector-notes"
          >
            {descriptor.notes.map((note, index) => (
              <li key={`${descriptor.view}-note-${index}`}>{note}</li>
            ))}
          </ul>
        ) : (
          <span data-testid="inspector-no-notes">no notes</span>
        ),
      )}
      {section(
        "Safety invariants",
        <ul
          className="shell-inspector-list"
          data-testid="inspector-safety-invariants"
        >
          <li>
            new_ipc_allowed:{" "}
            {String(descriptor.safety_invariants.new_ipc_allowed)}
          </li>
          <li>
            runtime_activation_allowed:{" "}
            {String(descriptor.safety_invariants.runtime_activation_allowed)}
          </li>
          <li>
            config_writes_allowed_by_contract:{" "}
            {String(
              descriptor.safety_invariants.config_writes_allowed_by_contract,
            )}
          </li>
          <li>
            hcc_auto_executor_allowed:{" "}
            {String(descriptor.safety_invariants.hcc_auto_executor_allowed)}
          </li>
          <li>
            direct_gateway_fix_applied:{" "}
            {String(descriptor.safety_invariants.direct_gateway_fix_applied)}
          </li>
        </ul>,
      )}
      {section(
        "Write action state",
        <div data-testid="inspector-write-action-state">
          <div
            className="shell-inspector-row"
            data-testid="inspector-write-action-summary"
            data-tone={descriptor.write_action.badge_tone}
            data-has-write-action={
              descriptor.write_action.has_write_action ? "true" : "false"
            }
          >
            <span data-testid="inspector-write-action-label">
              {descriptor.write_action.display_label}
            </span>
            <span data-testid="inspector-write-action-copy">
              {descriptor.write_action.short_copy}
            </span>
          </div>
          <ul
            className="shell-inspector-list"
            data-testid="inspector-write-action-fields"
          >
            <li>
              has_write_action:{" "}
              {String(descriptor.write_action.has_write_action)}
            </li>
            <li>
              write_action_kind: {descriptor.write_action.write_action_kind}
            </li>
            <li>
              explicit_user_action_required:{" "}
              {String(descriptor.write_action.explicit_user_action_required)}
            </li>
            <li>
              future_gating_required:{" "}
              {String(descriptor.write_action.needs_future_gating)}
            </li>
            <li>display_tone: {descriptor.write_action.badge_tone}</li>
          </ul>
          {descriptor.write_action.write_surfaces.length > 0 ? (
            <ul
              className="shell-inspector-list"
              data-testid="inspector-write-action-surfaces"
            >
              {descriptor.write_action.write_surfaces.map((surface) => (
                <li key={`${descriptor.view}-wa-${surface}`}>{surface}</li>
              ))}
            </ul>
          ) : (
            <span
              data-testid="inspector-write-action-no-surfaces"
              data-read-only="true"
            >
              No write surfaces registered
            </span>
          )}
          {descriptor.write_action.direct_gateway_risk && (
            <div
              className="shell-inspector-section"
              data-testid="inspector-write-action-direct-gateway"
              data-risk="P0"
            >
              <span className="shell-inspector-label">
                Write-action direct gateway risk
              </span>
              <strong>
                direct gateway:{" "}
                {descriptor.write_action.direct_gateway_methods.join(", ")}
              </strong>
            </div>
          )}
        </div>,
      )}
      {isReadOnly && (
        <div
          className="shell-inspector-section"
          data-testid="inspector-read-only-banner"
        >
          <span className="shell-inspector-label">Read-only</span>
          <span>Display surface only. No write methods declared.</span>
        </div>
      )}
    </div>
  );
}
