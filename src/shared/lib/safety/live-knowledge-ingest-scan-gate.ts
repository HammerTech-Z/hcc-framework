import {
  scanForSensitiveContent,
  type ScanResult,
} from "./redaction-scanner";

export type LiveKnowledgeIngestExternalSource =
  | "web"
  | "github"
  | "user_paste"
  | "imported_document"
  | "local_llm_wiki";

export interface LiveKnowledgeIngestScanInput {
  source: LiveKnowledgeIngestExternalSource;
  sourceRef: string;
  content: string;
}

export interface LiveKnowledgeIngestScanDecision {
  schema_version: "1.0.0";
  ingress: "live_knowledge_ingest_external_content";
  source: LiveKnowledgeIngestExternalSource;
  sourceRef: string;
  covered: true;
  allowed: boolean;
  reason: string;
  scanner_mode: "cloud_payload";
  scan: ScanResult;
  dry_run_only: true;
  knowledge_ingest_call_allowed: false;
  persistence_allowed: false;
  runtime_mutation_allowed: false;
  backend_daemon_allowed: false;
  cron_allowed: false;
  weixin_allowed: false;
  channel_runtime_allowed: false;
  live_apply_allowed: false;
  hcc_auto_executor_allowed: false;
}

export const LIVE_KNOWLEDGE_INGEST_EXTERNAL_CONTENT_SCAN_GATE = {
  schema_version: "1.0.0",
  ingress: "live_knowledge_ingest_external_content",
  coverage_status: "covered",
  evidence_ref: "HERMES-GOV-004::live-knowledge-ingest-external-content-scan-gate",
  scanner_mode: "cloud_payload",
  dry_run_only: true,
  knowledge_ingest_call_allowed: false,
  persistence_allowed: false,
  runtime_mutation_allowed: false,
  backend_daemon_allowed: false,
  cron_allowed: false,
  weixin_allowed: false,
  channel_runtime_allowed: false,
  live_apply_allowed: false,
  hcc_auto_executor_allowed: false,
} as const;

export function scanLiveKnowledgeIngestExternalContent(
  input: LiveKnowledgeIngestScanInput,
): LiveKnowledgeIngestScanDecision {
  const scan = scanForSensitiveContent({
    content: input.content,
    sourceRef: input.sourceRef,
    mode: "cloud_payload",
  });
  const allowed = scan.status === "pass";
  return {
    schema_version: "1.0.0",
    ingress: "live_knowledge_ingest_external_content",
    source: input.source,
    sourceRef: input.sourceRef,
    covered: true,
    allowed,
    reason: allowed
      ? "live knowledge ingest external content passed sensitive-content scan"
      : `live knowledge ingest external content blocked by scan: ${scan.summary}`,
    scanner_mode: "cloud_payload",
    scan,
    dry_run_only: true,
    knowledge_ingest_call_allowed: false,
    persistence_allowed: false,
    runtime_mutation_allowed: false,
    backend_daemon_allowed: false,
    cron_allowed: false,
    weixin_allowed: false,
    channel_runtime_allowed: false,
    live_apply_allowed: false,
    hcc_auto_executor_allowed: false,
  };
}

export function assertLiveKnowledgeIngestScanDecisionNoRuntime(
  decision: LiveKnowledgeIngestScanDecision,
): void {
  const forbiddenFlags = [
    "knowledge_ingest_call_allowed",
    "persistence_allowed",
    "runtime_mutation_allowed",
    "backend_daemon_allowed",
    "cron_allowed",
    "weixin_allowed",
    "channel_runtime_allowed",
    "live_apply_allowed",
    "hcc_auto_executor_allowed",
  ] as const;

  if (decision.schema_version !== "1.0.0") {
    throw new Error("live_knowledge_ingest_scan.schema_version is invalid");
  }
  if (decision.ingress !== "live_knowledge_ingest_external_content") {
    throw new Error("live_knowledge_ingest_scan.ingress is invalid");
  }
  if (decision.covered !== true) {
    throw new Error("live_knowledge_ingest_scan.covered must be true");
  }
  if (decision.dry_run_only !== true) {
    throw new Error("live_knowledge_ingest_scan.dry_run_only must be true");
  }
  for (const flag of forbiddenFlags) {
    if (decision[flag] !== false) {
      throw new Error(`live_knowledge_ingest_scan.${flag} must be false`);
    }
  }
  if (decision.scanner_mode !== "cloud_payload") {
    throw new Error("live_knowledge_ingest_scan.scanner_mode is invalid");
  }
  if (decision.allowed !== (decision.scan.status === "pass")) {
    throw new Error("live_knowledge_ingest_scan.allowed mismatches scan");
  }
}
