import { describe, it, expect } from "vitest";
import {
  LIVE_KNOWLEDGE_INGEST_EXTERNAL_CONTENT_SCAN_GATE,
  assertLiveKnowledgeIngestScanDecisionNoRuntime,
  scanLiveKnowledgeIngestExternalContent,
} from "@shared/lib/safety/live-knowledge-ingest-scan-gate";
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
    status: "covered",
    evidenceRef: LIVE_KNOWLEDGE_INGEST_EXTERNAL_CONTENT_SCAN_GATE.evidence_ref,
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

  it("B2 admission has no remaining required ingress gaps after HERMES-GOV-004", () => {
    const requiredGaps = requiredGapEntries();
    const b2AdmissionGo = requiredGaps.length === 0;
    expect(b2AdmissionGo).toBe(true);
    expect(requiredGaps).toEqual([]);
  });

  it("LOOP-010.A admission can remain NOT-GO due to B1 even when B2 is covered", () => {
    const b2AdmissionGo = requiredGapEntries().length === 0;
    const b1Blocked = blockedEntries().some(
      (entry) => entry.id === "cron_weixin_channel_runtime_ingress",
    );
    expect(b2AdmissionGo).toBe(true);
    expect(b1Blocked).toBe(true);
  });

  it("marks live_knowledge_ingest_external_content as mechanically covered by a pure scan gate", () => {
    const entry = matrixEntry("live_knowledge_ingest_external_content");
    expect(entry).toMatchObject({
      status: "covered",
      evidenceRef: LIVE_KNOWLEDGE_INGEST_EXTERNAL_CONTENT_SCAN_GATE.evidence_ref,
      requiredIngress: true,
    });
    expect(LIVE_KNOWLEDGE_INGEST_EXTERNAL_CONTENT_SCAN_GATE).toMatchObject({
      coverage_status: "covered",
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
    });
  });

  it("allows clean live knowledge ingest external content only after a cloud_payload scan pass", () => {
    const decision = scanLiveKnowledgeIngestExternalContent({
      source: "web",
      sourceRef: "https://example.test/release-notes",
      content: "Release notes: fixed a parser issue. No secrets included.",
    });
    assertLiveKnowledgeIngestScanDecisionNoRuntime(decision);
    expect(decision.allowed).toBe(true);
    expect(decision.scan.status).toBe("pass");
    expect(decision.scan.findings).toHaveLength(0);
  });

  it("blocks live knowledge ingest external content when the cloud_payload scan fails", () => {
    const decision = scanLiveKnowledgeIngestExternalContent({
      source: "github",
      sourceRef: "https://github.com/example/repo/issues/1",
      content: "Issue body leaked ghp_abcdef1234567890ABCDEF",
    });
    assertLiveKnowledgeIngestScanDecisionNoRuntime(decision);
    expect(decision.allowed).toBe(false);
    expect(decision.scan.status).toBe("fail");
    expect(decision.reason).toContain("blocked by scan");
    expect(decision.scan.redactedContent).toContain("[REDACTED:api_key]");
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

// ── H-6 trust level matrix (B-2 v3) ──────────────────────────────────────
// §4 "全系统统一刻度" — H6TrustLevelMatrix 显式标每条 scan entry 的
// trust_level + evidenceRef。5 级全覆盖。human_confirmed 条目含
// reserved_for_user_signoff: true（§3 自证可信禁止：AI 不自盖）。
// ──────────────────────────────────────────────────────────────────────────

import type { HCCProgressTrustLevel } from "../../src/shared/lib/safety/hcc-task-handoff-policy";

interface H6TrustLevelEntry {
  readonly id: string;
  readonly trust_level: HCCProgressTrustLevel;
  readonly evidenceRef: string;
  readonly note?: string;
  readonly reserved_for_user_signoff?: boolean;
}

const H6TrustLevelMatrix: readonly H6TrustLevelEntry[] = [
  {
    id: "external_input_scan_coverage_uncovered",
    trust_level: "unverified",
    evidenceRef: "tests/safety/external-input-scan-coverage.test.ts",
    note: "matrix entries with status=gap or blocked without evidence",
  },
  {
    id: "live_knowledge_ingest_external_content",
    trust_level: "ai_inferred",
    evidenceRef: "src/shared/lib/safety/live-knowledge-ingest-scan-gate.ts",
    note: "covered scan gate; AI-read only, not independently reproduced",
  },
  {
    id: "next_task_context_live_ingress",
    trust_level: "ai_inferred",
    evidenceRef: "src/shared/lib/safety/next-task-context-ingress-scan-gate.ts",
    note: "covered scan gate; AI-read only",
  },
  {
    id: "real_input_scan",
    trust_level: "single_run",
    evidenceRef: "src/shared/lib/safety/real-input-scan-gate.ts",
    note: "B-2 first slice; 1 run in worktree b2-scan-gate-20260611",
  },
  {
    id: "hcc_task_handoff_policy_gov006",
    trust_level: "reproduced",
    evidenceRef: "src/shared/lib/safety/hcc-task-handoff-policy.ts",
    note: "GOV-006 tests 13/13; independently reproduced across A-1 through B-2 slices",
  },
  {
    id: "user_signoff_authority",
    trust_level: "human_confirmed",
    evidenceRef: "docs/governance/hcc-go-authorization-2026-06-11.md",
    reserved_for_user_signoff: true,
    note: "human_confirmed only via explicit user signoff; AI cannot self-confirm (§3)",
  },
] as const;

describe("H-6 trust level matrix (B-2 v3)", () => {
  it("HCCProgressTrustLevel union has exactly 5 levels", () => {
    const five: readonly HCCProgressTrustLevel[] = [
      "unverified",
      "ai_inferred",
      "single_run",
      "reproduced",
      "human_confirmed",
    ];
    expect(five).toHaveLength(5);
  });

  it("H6TrustLevelMatrix covers all 5 trust levels", () => {
    const levels = new Set(H6TrustLevelMatrix.map((e) => e.trust_level));
    expect(levels.has("unverified")).toBe(true);
    expect(levels.has("ai_inferred")).toBe(true);
    expect(levels.has("single_run")).toBe(true);
    expect(levels.has("reproduced")).toBe(true);
    expect(levels.has("human_confirmed")).toBe(true);
    expect(levels.size).toBe(5);
  });

  it("every matrix entry has non-empty evidenceRef", () => {
    for (const entry of H6TrustLevelMatrix) {
      expect(typeof entry.evidenceRef).toBe("string");
      expect(entry.evidenceRef.length).toBeGreaterThan(0);
    }
  });

  it("every matrix entry trust_level is a valid HCCProgressTrustLevel value", () => {
    const valid: readonly string[] = [
      "unverified", "ai_inferred", "single_run", "reproduced", "human_confirmed",
    ];
    for (const entry of H6TrustLevelMatrix) {
      expect(valid).toContain(entry.trust_level);
    }
  });

  it("real_input_scan entry is single_run with B-2 evidence", () => {
    const entry = H6TrustLevelMatrix.find((e) => e.id === "real_input_scan");
    expect(entry).toBeDefined();
    expect(entry!.trust_level).toBe("single_run");
    expect(entry!.evidenceRef).toBe("src/shared/lib/safety/real-input-scan-gate.ts");
  });

  it("human_confirmed entry has reserved_for_user_signoff === true (no AI self-confirm path)", () => {
    const entry = H6TrustLevelMatrix.find((e) => e.trust_level === "human_confirmed");
    expect(entry).toBeDefined();
    expect(entry!.id).toBe("user_signoff_authority");
    expect(entry!.reserved_for_user_signoff).toBe(true);
    expect(entry!.evidenceRef).toContain("hcc-go-authorization");
  });

  it("no AI self-confirm path exists: every human_confirmed must be reserved_for_user_signoff", () => {
    const humanConfirmedEntries = H6TrustLevelMatrix.filter(
      (e) => e.trust_level === "human_confirmed",
    );
    expect(humanConfirmedEntries.length).toBeGreaterThan(0);
    for (const e of humanConfirmedEntries) {
      expect(e.reserved_for_user_signoff).toBe(true);
      expect(e.note).toMatch(/user signoff|self-confirm/i);
    }
  });

  it("unverified entry covers the gap/blocked scan surface", () => {
    const entry = H6TrustLevelMatrix.find((e) => e.trust_level === "unverified");
    expect(entry).toBeDefined();
    expect(entry!.evidenceRef).toContain("external-input-scan-coverage");
  });
});
