import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateEnablement,
  allEvidenceSatisfied,
  allVerifiersSatisfied,
  allBlockersResolved,
  HCC_ENABLEMENT_SCHEMA_VERSION,
  type HCCEnablementReport,
} from "../../src/shared/lib/hcc-enablement";

const REPO_ROOT = resolve(__dirname, "../..");

describe("HCC enablement: default NOT enabled", () => {
  it("default input produces gate_verdict=NO-GO", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.gate_verdict).toBe("NO-GO");
    expect(r.go_candidate_but_not_started).toBe(false);
  });

  it("default report has all literal-false execution fields", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.any_file_written).toBe(false);
  });
});

describe("HCC enablement: GO-CANDIDATE is not started", () => {
  it("all gates satisfied -> gate_verdict=GO-CANDIDATE but go_candidate_but_not_started=true", () => {
    const r = evaluateEnablement({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      blockers_resolved: allBlockersResolved(),
      explicit_user_authorization_recorded: true,
    });
    expect(r.gate_verdict).toBe("GO-CANDIDATE");
    expect(r.go_candidate_but_not_started).toBe(true);
    // GO-CANDIDATE is NOT started.
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.any_file_written).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC enablement: all contract postures aggregated", () => {
  it("aggregates whitelist posture", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.contracts.whitelist.default_deny).toBe(true);
    expect(r.contracts.whitelist.night_run_ready).toBe(false);
    expect(r.contracts.whitelist.go_no_go).toBe("NO-GO");
  });

  it("aggregates rollback rehearsal posture", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.contracts.rollback_rehearsal.would_execute).toBe(false);
    expect(r.contracts.rollback_rehearsal.implies_real_execution).toBe(false);
    expect(r.contracts.rollback_rehearsal.implies_unattended).toBe(false);
    expect(r.contracts.rollback_rehearsal.night_run_ready).toBe(false);
  });

  it("aggregates budget posture", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.contracts.budget.real_execution_ready).toBe(false);
    expect(r.contracts.budget.unattended_ready).toBe(false);
    expect(r.contracts.budget.night_run_ready).toBe(false);
    expect(r.contracts.budget.go_no_go).toBe("NO-GO");
  });

  it("aggregates audit persistence posture", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.contracts.audit_persistence.would_persist).toBe(false);
    expect(r.contracts.audit_persistence.real_execution_ready).toBe(false);
    expect(r.contracts.audit_persistence.unattended_ready).toBe(false);
    expect(r.contracts.audit_persistence.night_run_ready).toBe(false);
  });

  it("aggregates unattended gate posture", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.contracts.unattended_gate.unattended_ready).toBe(false);
    expect(r.contracts.unattended_gate.night_run_ready).toBe(false);
    expect(r.contracts.unattended_gate.go_no_go).toBe("NO-GO");
  });
});

describe("HCC enablement: readiness level", () => {
  it("readiness_level = controlled_executor_ready (not night_run_ready)", () => {
    const r = evaluateEnablement({
      evidence_satisfied: {},
      verifier_satisfied: {},
      blockers_resolved: {},
    });
    expect(r.readiness_level).toBe("controlled_executor_ready");
  });
});

describe("HCC enablement: schema + invariants", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_ENABLEMENT_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("night_run_ready=false + go_no_go=NO-GO in controlled-executor", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("enablement report go_no_go is always NO-GO even at GO-CANDIDATE", () => {
    const r = evaluateEnablement({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      blockers_resolved: allBlockersResolved(),
      explicit_user_authorization_recorded: true,
    });
    expect(r.gate_verdict).toBe("GO-CANDIDATE");
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC enablement: src static guard", () => {
  it("does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-enablement.ts"),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bspawn\s*\(/);
    expect(stripped).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-enablement.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-enablement.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT write files", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-enablement.ts"),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bwriteFile\s*\(/);
  });
});