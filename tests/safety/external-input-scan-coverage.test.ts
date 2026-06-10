import { describe, it, expect } from "vitest";
import {
  NEXT_TASK_CONTEXT_LIVE_INGRESS_SCAN_GATE,
  assertNextTaskContextIngressScanDecisionNoRuntime,
  scanNextTaskContextLiveIngress,
} from "@shared/lib/safety/next-task-context-ingress-scan-gate";
import { scanForSensitiveContent } from "@shared/lib/safety/redaction-scanner";
import type { RedactionFinding } from "@shared/lib/safety/redaction-scanner";

// ── Scan coverage matrix ─────────────────────────────────────────────────
// B2-SCAN entries track the scan posture for every external ingress path.
// Each entry must carry an evidence ref when covered, must not block
// admission when blocked, and must raise an admission gate when gapped.
// ─────────────────────────────────────────────────────────────────────────

type ScanStatus = "covered" | "blocked" | "gap";

interface ScanEntry {
  id: string;
  description: string;
  status: ScanStatus;
  evidenceRef?: string;
  requiredIngress: boolean;
}

const B2_SCAN_MATRIX: ScanEntry[] = [
  {
    id: "post_task_reflection_contract_scans",
    description: "Post-task reflection contract scans for external data",
    status: "covered",
    evidenceRef: "B2-SCAN-001 :: reflection-contract-scan trace 2026-06-09",
    requiredIngress: true,
  },
  {
    id: "redaction_scanner_handoff_cloud_payload",
    description: "Redaction scanner handoff for cloud payload content",
    status: "covered",
    evidenceRef: "B2-SCAN-002 :: redaction-handoff-cloud-payload trace 2026-06-09",
    requiredIngress: true,
  },
  {
    id: "hcc_verifier_input_boundary",
    description: "HCC verifier input boundary validation for external sources",
    status: "covered",
    evidenceRef: "B2-SCAN-003 :: hcc-verifier-input-boundary trace 2026-06-09",
    requiredIngress: true,
  },
  {
    id: "live_knowledge_ingest_external_content",
    description: "Live knowledge ingest of external content (untrusted)",
    status: "gap",
    requiredIngress: true,
  },
  {
    id: "next_task_context_live_ingress",
    description: "Next task context live ingress from external sources",
    status: "covered",
    evidenceRef: NEXT_TASK_CONTEXT_LIVE_INGRESS_SCAN_GATE.evidence_ref,
    requiredIngress: true,
  },
  {
    id: "cron_weixin_channel_runtime_ingress",
    description: "Cron-based Weixin channel runtime ingress",
    status: "blocked",
    evidenceRef: "B2-SCAN-006 :: weixin-channel-ingress blocked pending third-party audit",
    requiredIngress: false,
  },
];

const coveredEntries = () => B2_SCAN_MATRIX.filter((e) => e.status === "covered");
const blockedEntries = () => B2_SCAN_MATRIX.filter((e) => e.status === "blocked");
const gapEntries = () => B2_SCAN_MATRIX.filter((e) => e.status === "gap");
const requiredGapEntries = () => gapEntries().filter((e) => e.requiredIngress);
const matrixEntry = (id: string) => B2_SCAN_MATRIX.find((e) => e.id === id);

describe("B2 external input scan coverage matrix", () => {
  it("covered entries must have evidence refs", () => {
    for (const entry of coveredEntries()) {
      expect(entry.evidenceRef, `${entry.id} missing evidenceRef`).toBeDefined();
      expect(entry.evidenceRef, `${entry.id} evidenceRef empty`).not.toBe("");
    }
  });

  it("blocked entries are not admission blockers", () => {
    for (const entry of blockedEntries()) {
      expect(entry.requiredIngress, `${entry.id} should not block admission`).toBe(false);
    }
  });

  it("gap entries are admission blockers (requiredIngress === true)", () => {
    for (const entry of gapEntries()) {
      expect(entry.requiredIngress, `${entry.id} gap entry must be an admission blocker`).toBe(true);
    }
  });

  it("LOOP-010.A admission is NOT-GO while any required ingress entry is gap", () => {
    const requiredGaps = requiredGapEntries();
    const admissionGo = requiredGaps.length === 0;
    expect(admissionGo).toBe(false);
    expect(requiredGaps.map((gap) => gap.id)).toEqual([
      "live_knowledge_ingest_external_content",
    ]);
    for (const gap of requiredGaps) {
      expect(gap.status).toBe("gap");
    }
  });

  it("marks next_task_context_live_ingress as mechanically covered by a pure scan gate", () => {
    const entry = matrixEntry("next_task_context_live_ingress");
    expect(entry).toMatchObject({
      status: "covered",
      evidenceRef: NEXT_TASK_CONTEXT_LIVE_INGRESS_SCAN_GATE.evidence_ref,
      requiredIngress: true,
    });
    expect(NEXT_TASK_CONTEXT_LIVE_INGRESS_SCAN_GATE).toMatchObject({
      coverage_status: "covered",
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
    });
  });

  it("allows clean next-task context live ingress only after a cloud_payload scan pass", () => {
    const decision = scanNextTaskContextLiveIngress({
      source: "post_task_reflection",
      sourceRef: "post-task-reflection://unit-test/clean",
      content: "Reflection summary: focused tests passed; no secrets included.",
    });
    assertNextTaskContextIngressScanDecisionNoRuntime(decision);
    expect(decision.allowed).toBe(true);
    expect(decision.scan.status).toBe("pass");
    expect(decision.scan.findings).toHaveLength(0);
  });

  it("blocks next-task context live ingress when the cloud_payload scan fails", () => {
    const decision = scanNextTaskContextLiveIngress({
      source: "post_task_reflection",
      sourceRef: "post-task-reflection://unit-test/secret",
      content: "Reflection summary accidentally includes sk_abcdef1234567890abcdef123456",
    });
    assertNextTaskContextIngressScanDecisionNoRuntime(decision);
    expect(decision.allowed).toBe(false);
    expect(decision.scan.status).toBe("fail");
    expect(decision.reason).toContain("blocked by scan");
    expect(decision.scan.redactedContent).toContain("[REDACTED:api_key]");
  });

  describe("redaction scanner — cloud_payload mode", () => {
    it("returns fail for cloud_payload content containing a fake high-severity API key", () => {
      const result = scanForSensitiveContent({
        content: "sk_abcdef1234567890abcdef123456",
        mode: "cloud_payload",
      });
      expect(result.status).toBe("fail");
      expect(result.findings.some((f: RedactionFinding) => f.kind === "api_key")).toBe(true);
      expect(result.findings.some((f: RedactionFinding) => f.severity === "high")).toBe(true);
      expect(result.redactedContent).toContain("[REDACTED:api_key]");
      expect(result.summary).toContain("blocked");
    });

    it("returns pass for cloud_payload content with no secrets", () => {
      const result = scanForSensitiveContent({
        content: "just some safe markdown content here",
        mode: "cloud_payload",
      });
      expect(result.status).toBe("pass");
      expect(result.findings).toHaveLength(0);
      expect(result.redactedContent).toBe("just some safe markdown content here");
      expect(result.summary).toBe("No sensitive content detected.");
    });

    it("returns fail for cloud_payload content containing a JWT token", () => {
      const result = scanForSensitiveContent({
        content: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
        mode: "cloud_payload",
      });
      expect(result.status).toBe("fail");
      expect(result.findings.some((f: RedactionFinding) => f.kind === "api_key" || f.kind === "token")).toBe(true);
    });

    it("returns fail for cloud_payload content containing a GitHub PAT", () => {
      const result = scanForSensitiveContent({
        content: "ghp_abcdef1234567890ABCDEF",
        mode: "cloud_payload",
      });
      expect(result.status).toBe("fail");
      expect(result.findings.some((f: RedactionFinding) => f.kind === "api_key")).toBe(true);
    });

    it("returns pass for cloud_payload content with benign release notes", () => {
      const result = scanForSensitiveContent({
        content: "Release notes: Fixed a bug in the scheduler. No secrets here. tags: bugfix, scheduler, v2.1.0",
        mode: "cloud_payload",
      });
      expect(result.status).toBe("pass");
      expect(result.findings).toHaveLength(0);
    });

    it("returns fail for cloud_payload content containing a private key", () => {
      const result = scanForSensitiveContent({
        content: "-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBQJBAMHCggTest\n-----END RSA PRIVATE KEY-----",
        mode: "cloud_payload",
      });
      expect(result.status).toBe("fail");
      expect(result.findings.some((f: RedactionFinding) => f.kind === "private_key")).toBe(true);
      expect(result.redactedContent).toContain("[REDACTED:private_key]");
    });
  });
});
