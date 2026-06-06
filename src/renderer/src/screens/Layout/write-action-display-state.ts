// UI Slice 5: write-action visual gating descriptor.
// Pure data projection. No renderer wiring, no IPC, no network, no runtime
// action. Answers "is this view write-capable, and what should the UI badge
// surface show?" without disabling anything. Downstream UI (Inspector panel,
// future gating) consumes this descriptor; nothing consumes it yet.

import {
  buildScreenBoundaryContract,
  type ScreenBoundaryContract,
  type ScreenBoundaryKind,
  type ScreenBoundaryRiskLevel,
  type ScreenViewId,
} from "../../../../shared/lib/screen-boundary-contract";

export type WriteActionKind =
  | "none"
  | "config"
  | "runtime"
  | "external"
  | "mixed";

export type WriteActionTone = "neutral" | "info" | "warn" | "danger";

export interface WriteActionDisplayState {
  view: ScreenViewId;
  boundary_kind: ScreenBoundaryKind;
  risk_level: ScreenBoundaryRiskLevel;
  has_write_action: boolean;
  write_action_kind: WriteActionKind;
  explicit_user_action_required: boolean;
  // True for write-capable views (non-read_only) — signals downstream UI
  // that a future gating layer is plausible. NOT a permission verdict.
  needs_future_gating: boolean;
  // P0 + direct_gateway_methods.length > 0.
  direct_gateway_risk: boolean;
  direct_gateway_methods: readonly string[];
  write_surfaces: readonly string[];
  display_label: string;
  badge_tone: WriteActionTone;
  short_copy: string;
  // Stable safety literals. Hard-coded; downstream must not mutate.
  safety: {
    ui_only: true;
    disables_actions: false;
    runtime_activation_allowed: false;
    ipc_allowed: false;
    config_write_allowed_by_descriptor: false;
  };
}

const BOUNDARY_TO_KIND: Readonly<
  Record<ScreenBoundaryKind, WriteActionKind>
> = {
  read_only: "none",
  read_write_config: "config",
  read_write_runtime: "runtime",
  external_action: "external",
  mixed: "mixed",
};

const TONE_BY_KIND: Readonly<Record<WriteActionKind, WriteActionTone>> = {
  none: "neutral",
  config: "info",
  runtime: "warn",
  external: "warn",
  mixed: "warn",
};

const COPY_BY_KIND: Readonly<Record<WriteActionKind, string>> = {
  none: "No write surfaces registered",
  config: "Config write surfaces present",
  runtime: "Runtime write surfaces present",
  external: "External action surfaces present",
  mixed: "Mixed write surfaces present",
};

function buildCopy(
  kind: WriteActionKind,
  risk: ScreenBoundaryRiskLevel,
): string {
  const base = COPY_BY_KIND[kind];
  return `${base} · risk=${risk}`;
}

function buildDisplayLabel(
  contract: ScreenBoundaryContract,
  kind: WriteActionKind,
): string {
  if (kind === "none") {
    return `${contract.display_label} · read-only`;
  }
  return `${contract.display_label} · write-capable`;
}

export function buildWriteActionDisplayState(
  contract: ScreenBoundaryContract,
): WriteActionDisplayState {
  const kind = BOUNDARY_TO_KIND[contract.boundary_kind];
  const hasWriteAction = kind !== "none";
  const directGatewayRisk =
    contract.risk_level === "P0" && contract.direct_gateway_methods.length > 0;
  return {
    view: contract.view,
    boundary_kind: contract.boundary_kind,
    risk_level: contract.risk_level,
    has_write_action: hasWriteAction,
    write_action_kind: kind,
    explicit_user_action_required: hasWriteAction,
    needs_future_gating: hasWriteAction,
    direct_gateway_risk: directGatewayRisk,
    direct_gateway_methods: contract.direct_gateway_methods,
    write_surfaces: contract.write_surfaces,
    display_label: buildDisplayLabel(contract, kind),
    badge_tone: TONE_BY_KIND[kind],
    short_copy: buildCopy(kind, contract.risk_level),
    safety: {
      ui_only: true,
      disables_actions: false,
      runtime_activation_allowed: false,
      ipc_allowed: false,
      config_write_allowed_by_descriptor: false,
    },
  };
}

export function buildAllWriteActionDisplayStates(): readonly WriteActionDisplayState[] {
  // Read from the shared contract result. Self-contained; never call into
  // main/preload. The shared helper is already pure data.
  return buildScreenBoundaryContract().contracts.map(
    buildWriteActionDisplayState,
  );
}

export function getWriteActionDisplayState(
  view: ScreenViewId,
): WriteActionDisplayState | undefined {
  return buildAllWriteActionDisplayStates().find(
    (state) => state.view === view,
  );
}
