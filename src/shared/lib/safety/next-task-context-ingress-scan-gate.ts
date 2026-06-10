import {
  scanForSensitiveContent,
  type ScanResult,
} from "./redaction-scanner";

export type NextTaskContextIngressSource =
  | "post_task_reflection"
  | "knowledge_ingest_draft"
  | "usage_feedback"
  | "skill_candidate"
  | "dead_end"
  | "local_llm_wiki";

export interface NextTaskContextIngressScanInput {
  source: NextTaskContextIngressSource;
  sourceRef: string;
  content: string;
}

export interface NextTaskContextIngressScanDecision {
  schema_version: "1.0.0";
  ingress: "next_task_context_live_ingress";
  source: NextTaskContextIngressSource;
  sourceRef: string;
  covered: true;
  allowed: boolean;
  reason: string;
  scanner_mode: "cloud_payload";
  scan: ScanResult;
  dry_run_only: true;
  next_task_context_write_allowed: false;
  runtime_mutation_allowed: false;
  backend_daemon_allowed: false;
  cron_allowed: false;
  weixin_allowed: false;
  channel_runtime_allowed: false;
  live_apply_allowed: false;
  hcc_auto_executor_allowed: false;
}

export const NEXT_TASK_CONTEXT_LIVE_INGRESS_SCAN_GATE = {
  schema_version: "1.0.0",
  ingress: "next_task_context_live_ingress",
  coverage_status: "covered",
  evidence_ref: "HERMES-GOV-003::next-task-context-live-ingress-scan-gate",
  scanner_mode: "cloud_payload",
  dry_run_only: true,
  next_task_context_write_allowed: false,
  runtime_mutation_allowed: false,
  backend_daemon_allowed: false,
  cron_allowed: false,
  weixin_allowed: false,
  channel_runtime_allowed: false,
  live_apply_allowed: false,
  hcc_auto_executor_allowed: false,
} as const;

export function scanNextTaskContextLiveIngress(
  input: NextTaskContextIngressScanInput,
): NextTaskContextIngressScanDecision {
  const scan = scanForSensitiveContent({
    content: input.content,
    sourceRef: input.sourceRef,
    mode: "cloud_payload",
  });
  const allowed = scan.status === "pass";
  return {
    schema_version: "1.0.0",
    ingress: "next_task_context_live_ingress",
    source: input.source,
    sourceRef: input.sourceRef,
    covered: true,
    allowed,
    reason: allowed
      ? "next-task context live ingress passed sensitive-content scan"
      : `next-task context live ingress blocked by scan: ${scan.summary}`,
    scanner_mode: "cloud_payload",
    scan,
    dry_run_only: true,
    next_task_context_write_allowed: false,
    runtime_mutation_allowed: false,
    backend_daemon_allowed: false,
    cron_allowed: false,
    weixin_allowed: false,
    channel_runtime_allowed: false,
    live_apply_allowed: false,
    hcc_auto_executor_allowed: false,
  };
}

export function assertNextTaskContextIngressScanDecisionNoRuntime(
  decision: NextTaskContextIngressScanDecision,
): void {
  const forbiddenFlags = [
    "next_task_context_write_allowed",
    "runtime_mutation_allowed",
    "backend_daemon_allowed",
    "cron_allowed",
    "weixin_allowed",
    "channel_runtime_allowed",
    "live_apply_allowed",
    "hcc_auto_executor_allowed",
  ] as const;

  if (decision.schema_version !== "1.0.0") {
    throw new Error("next_task_context_ingress_scan.schema_version is invalid");
  }
  if (decision.ingress !== "next_task_context_live_ingress") {
    throw new Error("next_task_context_ingress_scan.ingress is invalid");
  }
  if (decision.covered !== true) {
    throw new Error("next_task_context_ingress_scan.covered must be true");
  }
  if (decision.dry_run_only !== true) {
    throw new Error("next_task_context_ingress_scan.dry_run_only must be true");
  }
  for (const flag of forbiddenFlags) {
    if (decision[flag] !== false) {
      throw new Error(`next_task_context_ingress_scan.${flag} must be false`);
    }
  }
  if (decision.scanner_mode !== "cloud_payload") {
    throw new Error("next_task_context_ingress_scan.scanner_mode is invalid");
  }
  if (decision.allowed !== (decision.scan.status === "pass")) {
    throw new Error("next_task_context_ingress_scan.allowed mismatches scan");
  }
}
