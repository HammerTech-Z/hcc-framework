// UI Slice 3: dynamic shell boundary badge descriptor.
// Pure function over ScreenBoundaryContract. No renderer wiring, no IPC,
// no network. Consumed by Layout.tsx to replace the static "read-only shell"
// status badge with a per-view boundary indicator.

import type {
  ScreenBoundaryContract,
  ScreenBoundaryKind,
  ScreenBoundaryRiskLevel,
  ScreenViewId,
} from "../../../../shared/lib/screen-boundary-contract";

export interface BoundaryBadgeDescriptor {
  view: ScreenViewId;
  label: string;
  risk_level: ScreenBoundaryRiskLevel;
  // Short token for the boundary kind. Stable across refactors.
  kind_token: string;
  // P0 + has direct_gateway_methods → true. Drives title attribute.
  direct_gateway_risk: boolean;
  // Methods list used to populate title for P0 / direct_gateway views.
  risk_methods: readonly string[];
  // Write surface count for context. 0 for read-only views.
  write_surface_count: number;
  // CSS class modifier hook: shell-status-badge--<kind_token>--<risk>.
  class_modifier: string;
}

const KIND_LABEL: Readonly<Record<ScreenBoundaryKind, string>> = {
  read_only: "read-only",
  read_write_config: "config-write",
  read_write_runtime: "runtime-write",
  external_action: "external-action",
  mixed: "mixed",
};

export function getBoundaryBadgeLabel(kind: ScreenBoundaryKind): string {
  return KIND_LABEL[kind];
}

export function buildBoundaryBadgeDescriptor(
  contract: ScreenBoundaryContract | undefined,
): BoundaryBadgeDescriptor {
  if (!contract) {
    // Fallback when the contract lookup misses. Stable, short, safe.
    return {
      view: "chat",
      label: "boundary unknown",
      risk_level: "P3",
      kind_token: "unknown",
      direct_gateway_risk: false,
      risk_methods: [],
      write_surface_count: 0,
      class_modifier: "shell-status-badge--unknown--P3",
    };
  }
  const kindLabel = KIND_LABEL[contract.boundary_kind];
  const label = `${kindLabel} · ${contract.risk_level}`;
  const directGatewayRisk =
    contract.risk_level === "P0" && contract.direct_gateway_methods.length > 0;
  const class_modifier = `shell-status-badge--${contract.boundary_kind}--${contract.risk_level}`;
  return {
    view: contract.view,
    label,
    risk_level: contract.risk_level,
    kind_token: contract.boundary_kind,
    direct_gateway_risk: directGatewayRisk,
    risk_methods: contract.direct_gateway_methods,
    write_surface_count: contract.write_surfaces.length,
    class_modifier,
  };
}

export function buildBoundaryBadgeTitle(
  descriptor: BoundaryBadgeDescriptor,
): string {
  if (!descriptor.direct_gateway_risk) {
    return `view=${descriptor.view} · kind=${descriptor.kind_token} · risk=${descriptor.risk_level} · writes=${descriptor.write_surface_count}`;
  }
  return `view=${descriptor.view} · kind=${descriptor.kind_token} · risk=${descriptor.risk_level} · direct_gateway=${descriptor.risk_methods.join(",")}`;
}
