import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateUnattendedExecutionEnablement,
  HCC_UNATTENDED_EXECUTION_ENABLEMENT_SCHEMA_VERSION,
  type HCCUnattendedExecutionEnablementInput,
} from "../../src/shared/lib/hcc-unattended-execution-enablement";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = "2026-06-14T12:00:00.000Z";
const ISSUED = "2026-06-14T11:00:00.000Z";
const EXPIRES = "2026-06-14T13:00:00.000Z";

function makeInput(
  overrides: Partial<HCCUnattendedExecutionEnablementInput> = {},
): HCCUnattendedExecutionEnablementInput {
  return {
    task_id: "PLAN-UNATTEND-001",
    source_plan_ref: "plan:2026-06:task-unattend-001",
    requested_by_user: "u-requester",
    feature_flag_enabled: true,
    authorization: {
      authorized: true,
      authorization_id: "auth-unattended-001",
      authorized_by_user: "u-authorizer",
      scope: "controlled_unattended_enablement" as const,
      issued_at: ISSUED,
      expires_at: EXPIRES,
    },
    readiness_evidence: {
      real_action_whitelist_present: true,
      rollback_rehearsal_present: true,
      budget_rate_limit_present: true,
      audit_artifact_persistence_present: true,
      rollback_rehearsal_passed: true,
      budget_caps_calibrated: true,
      audit_path_policy_valid: true,
      verifier_satisfied: true,
    },
    final_dispatch_verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE",
    audit_write_verdict: "AUDIT-ACTUAL-WRITTEN",
    rollback_candidate_verdict: "ROLLBACK-ACTUAL-RECOVERY-CANDIDATE",
    budget: { present: true, exceeded: false },
    blockers: [],
    ...overrides,
  };
}

describe("HCC unattended execution enablement: all gates satisfied", () => {
  it("all 8 gates pass -> ENABLEMENT-CANDIDATE", () => {
    const r = evaluateUnattendedExecutionEnablement(makeInput(), NOW);
    expect(r.verdict).toBe("ENABLEMENT-CANDIDATE");
  });

  it("candidate flips unattended_ready_candidate to true", () => {
    const r = evaluateUnattendedExecutionEnablement(makeInput(), NOW);
    expect(r.unattended_ready_candidate).toBe(true);
  });

  it("candidate keeps unattended_ready: false (historical field)", () => {
    const r = evaluateUnattendedExecutionEnablement(makeInput(), NOW);
    expect(r.unattended_ready).toBe(false);
  });

  it("candidate keeps night_run_ready: false and go_no_go: NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(makeInput(), NOW);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("candidate keeps execution fields literal-false", () => {
    const r = evaluateUnattendedExecutionEnablement(makeInput(), NOW);
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });

  it("candidate preserves task identity", () => {
    const r = evaluateUnattendedExecutionEnablement(makeInput(), NOW);
    expect(r.task_id).toBe("PLAN-UNATTEND-001");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-unattend-001");
    expect(r.requested_by_user).toBe("u-requester");
    expect(r.authorization_id).toBe("auth-unattended-001");
  });
});

describe("HCC unattended execution enablement: Gate 1 — feature flag", () => {
  it("feature_flag_enabled=false -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ feature_flag_enabled: false }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("feature_flag_enabled");
    expect(r.unattended_ready_candidate).toBe(false);
  });

  it("feature_flag_enabled missing (undefined cast) -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ feature_flag_enabled: undefined as never }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended execution enablement: Gate 2 — authorization", () => {
  it("authorization.authorized=false -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ authorization: { ...makeInput().authorization, authorized: false } }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization.authorized");
  });

  it("authorization missing (undefined) -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ authorization: undefined as never }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization");
  });

  it("authorization.scope wrong -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        authorization: {
          ...makeInput().authorization,
          scope: "wrong_scope" as never,
        },
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scope");
  });

  it("authorization expired -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput(),
      "2026-06-14T14:00:00.000Z",
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("expired");
  });

  it("authorization.issued_at >= expires_at -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        authorization: {
          ...makeInput().authorization,
          issued_at: EXPIRES,
          expires_at: ISSUED,
        },
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("authorization.authorization_id empty -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        authorization: {
          ...makeInput().authorization,
          authorization_id: "",
        },
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended execution enablement: Gate 3 — readiness evidence", () => {
  it("one evidence flag false -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        readiness_evidence: {
          ...makeInput().readiness_evidence,
          real_action_whitelist_present: false,
        },
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("real_action_whitelist_present");
  });

  it("verifier_satisfied=false -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        readiness_evidence: {
          ...makeInput().readiness_evidence,
          verifier_satisfied: false,
        },
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("verifier_satisfied");
  });

  it("all 8 evidence flags independently guarded (budget rate limit false)", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        readiness_evidence: {
          ...makeInput().readiness_evidence,
          budget_rate_limit_present: false,
        },
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended execution enablement: Gates 4-6 — verdicts", () => {
  it("final_dispatch_verdict != CANDIDATE -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ final_dispatch_verdict: "NO-GO" as never }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("final_dispatch_verdict");
  });

  it("audit_write_verdict != WRITTEN -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        audit_write_verdict: "AUDIT-ACTUAL-WRITE-CANDIDATE" as never,
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("audit_write_verdict");
  });

  it("rollback_candidate_verdict != CANDIDATE -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ rollback_candidate_verdict: "NO-GO" as never }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("rollback_candidate_verdict");
  });
});

describe("HCC unattended execution enablement: Gate 7 — budget", () => {
  it("budget.present=false -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ budget: { present: false, exceeded: false } }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("budget.present");
  });

  it("budget.exceeded=true -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ budget: { present: true, exceeded: true } }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("budget.exceeded");
  });
});

describe("HCC unattended execution enablement: Gate 8 — blockers", () => {
  it("one unresolved blocker -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        blockers: [
          { id: "BLOCK-001", resolved: false, description: "network firewall not configured" },
        ],
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("BLOCK-001");
  });

  it("mixed (one resolved + one unresolved) -> NO-GO", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        blockers: [
          { id: "BLOCK-002", resolved: true, description: "done" },
          { id: "BLOCK-003", resolved: false, description: "pending security review" },
        ],
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("BLOCK-003");
  });

  it("all resolved -> ENABLEMENT-CANDIDATE", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({
        blockers: [
          { id: "BLOCK-004", resolved: true, description: "done" },
        ],
      }),
      NOW,
    );
    expect(r.verdict).toBe("ENABLEMENT-CANDIDATE");
  });
});

describe("HCC unattended execution enablement: NO-GO preserves literal-false", () => {
  it("any NO-GO keeps unattended_ready_candidate=false + unattended_ready=false", () => {
    const r = evaluateUnattendedExecutionEnablement(
      makeInput({ feature_flag_enabled: false }),
      NOW,
    );
    expect(r.unattended_ready_candidate).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.would_execute).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });
});

describe("HCC unattended execution enablement: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_EXECUTION_ENABLEMENT_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("lib does NOT set unattended_ready: true (only unattended_ready_candidate)", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-execution-enablement.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/unattended_ready:\s*true/);
  });

  it("lib does NOT set night_run_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-execution-enablement.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/night_run_ready:\s*true/);
  });

  it("lib does NOT set go_no_go: \"GO\"", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-execution-enablement.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("lib does NOT call spawn / exec / child_process / ipcMain / BrowserWindow / contextBridge / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-execution-enablement.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/\bexec\s*\(/);
    expect(src).not.toMatch(/child_process/);
    expect(src).not.toMatch(/ipcMain/);
    expect(src).not.toMatch(/BrowserWindow/);
    expect(src).not.toMatch(/contextBridge/);
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-execution-enablement.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("lib does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-execution-enablement.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});
