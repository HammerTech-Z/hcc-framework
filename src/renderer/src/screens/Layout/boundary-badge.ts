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
  // Knowledge IPC Migration closeout: methods previously direct-gateway
  // now routed through the main-process IPC bridge.
  migrated_ipc_methods: readonly string[];
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

// Bilingual badge labels — UI-CN-001a (2026-06-11).
// Primary text uses 中文 · English format; tooltip preserves full English
// anchor strings for test stability.
const KIND_LABEL_CN: Readonly<
  Record<ScreenBoundaryKind, { primary: string; tooltip: string }>
> = {
  read_only: {
    primary: "只读 · Read-only",
    tooltip:
      "风险分级 P3 · 无写入接口 · 无新增 IPC · Read-only · No writes · Productionization NOT APPROVED",
  },
  mixed: {
    primary: "读写混合 · Mixed",
    tooltip: "含发送/中止/配置写入 · 风险分级 P1",
  },
  read_write_runtime: {
    primary: "可执行 · Runtime",
    tooltip: "本页可触发运行时动作，操作前将要求确认",
  },
  read_write_config: {
    primary: "配置写入 · Config",
    tooltip: "修改将影响凭据/模型默认值",
  },
  external_action: {
    primary: "外部动作 · External",
    tooltip: "本页可触发外部进程/网络调用",
  },
};

export function getBoundaryBadgeLabel(kind: ScreenBoundaryKind): string {
  return KIND_LABEL[kind];
}

export function getBoundaryKindLabel(kind: ScreenBoundaryKind): {
  primary: string;
  tooltip: string;
} {
  return KIND_LABEL_CN[kind];
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
      migrated_ipc_methods: [],
      write_surface_count: 0,
      class_modifier: "shell-status-badge--unknown--P3",
    };
  }
  // UI-CN-001a: use bilingual label as primary text. English anchors
  // preserved in `buildBoundaryBadgeTitle` → `title` attribute.
  const cnLabel = getBoundaryKindLabel(contract.boundary_kind);
  const label = cnLabel.primary;
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
    migrated_ipc_methods: contract.migrated_ipc_methods,
    write_surface_count: contract.write_surfaces.length,
    class_modifier,
  };
}

export function buildBoundaryBadgeTitle(
  descriptor: BoundaryBadgeDescriptor,
): string {
  // UI-CN-001a: prepend the bilingual tooltip (English anchor strings)
  // so they survive in the title attribute even when visible text is
  // bilingual.
  const cnAnchor = KIND_LABEL_CN[descriptor.kind_token as ScreenBoundaryKind]
    ?.tooltip;
  const prefix = cnAnchor ? `${cnAnchor}\n` : "";

  if (!descriptor.direct_gateway_risk) {
    const lines: string[] = [
      `${prefix}view=${descriptor.view}`,
      `kind=${descriptor.kind_token}`,
      `risk=${descriptor.risk_level}`,
      `writes=${descriptor.write_surface_count}`,
    ];
    if (descriptor.migrated_ipc_methods.length > 0) {
      lines.push(
        `IPC bridge active: ${descriptor.migrated_ipc_methods.join(", ")}`,
      );
    }
    return lines.join(" · ");
  }
  return [
    `view=${descriptor.view}`,
    `kind=${descriptor.kind_token}`,
    `risk=${descriptor.risk_level}`,
    `Direct gateway methods: ${descriptor.risk_methods.join(", ")}`,
    "Status: display-only; IPC migration not applied",
  ].join(" · ");
}
