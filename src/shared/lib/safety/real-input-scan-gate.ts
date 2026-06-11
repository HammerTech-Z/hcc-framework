// B-2 HCC first slice — Real Input Scan Gate (green)
//
// Covers: vault_import + local_file_import (only existing entry points).
// Does NOT cover: weixin / feishu / external_link / github / web
// (entries do not exist; gate is not built per plan B-2 spec
// "微信/飞书/外链 gate 不建").
//
// trust_level reuses HCCProgressTrustLevel from A-1 GOV-006 (5-level
// union). Decision carries all `*_allowed = false` flags to lock out
// runtime / persistence / daemon / weixin / channel / live_apply /
// hcc_auto_executor paths.
//
// Pure data + helpers. No I/O, no IPC, no runtime mutation, no daemon,
// no cron, no weixin, no channel runtime, no live apply, no HCC Auto
// Executor, no ~/.hermes writes, no ~/.hermes/vault reads. Caller
// passes `content` + `sourceRef` — adapter does not read the vault
// or any filesystem path itself.

import {
  scanForSensitiveContent,
  type ScanResult,
} from "./redaction-scanner";

import type { HCCProgressTrustLevel } from "./hcc-task-handoff-policy";

// ── types ───────────────────────────────────────────────────────────────────

export type RealInputSource = "vault_import" | "local_file_import";

export interface RealInputScanInput {
  source: RealInputSource;
  sourceRef: string;
  content: string;
}

export interface RealInputScanDecision {
  schema_version: "1.0.0";
  ingress: "real_input_scan";
  source: RealInputSource;
  sourceRef: string;
  covered: true;
  allowed: boolean;
  reason: string;
  scanner_mode: "cloud_payload";
  scan: ScanResult;
  dry_run_only: true;
  trust_level: HCCProgressTrustLevel;
  evidence_ref: string;
  runtime_mutation_allowed: false;
  persistence_allowed: false;
  backend_daemon_allowed: false;
  cron_allowed: false;
  weixin_allowed: false;
  channel_runtime_allowed: false;
  live_apply_allowed: false;
  hcc_auto_executor_allowed: false;
}

// ── descriptor ──────────────────────────────────────────────────────────────

export const REAL_INPUT_SCAN_GATE = {
  schema_version: "1.0.0",
  ingress: "real_input_scan",
  coverage_status: "covered",
  evidence_ref: "HERMES-GOV-006::real-input-scan-gate",
  scanner_mode: "cloud_payload",
  dry_run_only: true,
  sources: ["vault_import", "local_file_import"] as const,
  // Gates NOT built (per plan B-2 spec):
  not_applicable_sources: [
    "weixin",
    "feishu",
    "external_link",
    "github",
    "web",
  ] as const,
  runtime_mutation_allowed: false,
  persistence_allowed: false,
  backend_daemon_allowed: false,
  cron_allowed: false,
  weixin_allowed: false,
  channel_runtime_allowed: false,
  live_apply_allowed: false,
  hcc_auto_executor_allowed: false,
} as const;

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Scan a real-input content payload (caller-supplied; no filesystem reads).
 * Returns a `RealInputScanDecision` with trust_level fixed to `single_run`
 * (caller may down/up via separate review pipeline).
 */
export function scanRealInput(input: RealInputScanInput): RealInputScanDecision {
  const scan = scanForSensitiveContent({
    content: input.content,
    sourceRef: input.sourceRef,
    mode: "cloud_payload",
  });
  const allowed = scan.status === "pass";
  return {
    schema_version: "1.0.0",
    ingress: "real_input_scan",
    source: input.source,
    sourceRef: input.sourceRef,
    covered: true,
    allowed,
    reason: allowed
      ? "real input passed sensitive-content scan"
      : `real input blocked by scan: ${scan.summary}`,
    scanner_mode: "cloud_payload",
    scan,
    dry_run_only: true,
    trust_level: "single_run",
    evidence_ref: "HERMES-GOV-006::real-input-scan-gate",
    runtime_mutation_allowed: false,
    persistence_allowed: false,
    backend_daemon_allowed: false,
    cron_allowed: false,
    weixin_allowed: false,
    channel_runtime_allowed: false,
    live_apply_allowed: false,
    hcc_auto_executor_allowed: false,
  };
}

/**
 * Assert that a decision's runtime/persistence/weixin/etc. flags are all
 * `false`. Throws on any forbidden flag flipped to `true`.
 */
export function assertRealInputScanDecisionNoRuntime(
  decision: RealInputScanDecision,
): void {
  const forbiddenFlags = [
    "runtime_mutation_allowed",
    "persistence_allowed",
    "backend_daemon_allowed",
    "cron_allowed",
    "weixin_allowed",
    "channel_runtime_allowed",
    "live_apply_allowed",
    "hcc_auto_executor_allowed",
  ] as const;
  const violations: string[] = [];
  for (const flag of forbiddenFlags) {
    // Decision declares all `*_allowed: false` as literal types; this loop
    // exists to fail loudly if a future edit changes one to boolean.
    // Cast to boolean for the equality check (TS2367 workaround).
    if ((decision as unknown as Record<string, boolean>)[flag] === true) {
      violations.push(flag);
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `real_input_scan_gate: forbidden flag(s) flipped to true: ${violations.join(", ")}`,
    );
  }
}
