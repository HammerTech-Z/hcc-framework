import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  runControlledDryRunEntrypoint,
  makeGoCandidateGateInput,
  makeNoGoGateInput,
  HCC_DRY_RUN_ENTRYPOINT_SCHEMA_VERSION,
  type DryRunArtifact,
} from "../../src/shared/lib/hcc-controlled-dry-run-entrypoint";

const REPO_ROOT = resolve(__dirname, "../..");

describe("HCC dry-run entrypoint: NO-GO when gate not satisfied", () => {
  it("default input → verdict NO-GO", () => {
    const a = runControlledDryRunEntrypoint(makeNoGoGateInput());
    expect(a.verdict).toBe("NO-GO");
    expect(a.would_execute).toBe(false);
    expect(a.executed_commands).toEqual([]);
    expect(a.auto_executor_started).toBe(false);
  });

  it("NO-GO artifact has all literal-false execution fields", () => {
    const a = runControlledDryRunEntrypoint(makeNoGoGateInput());
    expect(a.would_execute).toBe(false);
    expect(a.executed_commands).toEqual([]);
    expect(a.subprocess_count).toBe(0);
    expect(a.auto_executor_started).toBe(false);
    expect(a.any_command_executed).toBe(false);
    expect(a.real_execution_ready).toBe(false);
    expect(a.unattended_ready).toBe(false);
    expect(a.night_run_ready).toBe(false);
    expect(a.go_no_go).toBe("NO-GO");
  });
});

describe("HCC dry-run entrypoint: GO-CANDIDATE produces dry-run only", () => {
  it("all gates satisfied → GO-CANDIDATE_DRY_RUN_PRODUCED", () => {
    const a = runControlledDryRunEntrypoint(makeGoCandidateGateInput());
    expect(a.verdict).toBe("GO-CANDIDATE_DRY_RUN_PRODUCED");
  });

  it("GO-CANDIDATE_DRY_RUN_PRODUCED still has literal-false execution fields", () => {
    const a = runControlledDryRunEntrypoint(makeGoCandidateGateInput());
    expect(a.would_execute).toBe(false);
    expect(a.executed_commands).toEqual([]);
    expect(a.subprocess_count).toBe(0);
    expect(a.auto_executor_started).toBe(false);
    expect(a.any_command_executed).toBe(false);
    expect(a.real_execution_ready).toBe(false);
    expect(a.unattended_ready).toBe(false);
    expect(a.night_run_ready).toBe(false);
    expect(a.go_no_go).toBe("NO-GO");
  });

  it("GO-CANDIDATE_DRY_RUN_PRODUCED carries enablement report", () => {
    const a = runControlledDryRunEntrypoint(makeGoCandidateGateInput());
    expect(a.enablement.gate_verdict).toBe("GO-CANDIDATE");
    expect(a.enablement.go_candidate_but_not_started).toBe(true);
    // All 5 contract postures present
    expect(a.enablement.contracts.whitelist.default_deny).toBe(true);
    expect(a.enablement.contracts.rollback_rehearsal.would_execute).toBe(false);
    expect(a.enablement.contracts.budget.real_execution_ready).toBe(false);
    expect(a.enablement.contracts.audit_persistence.would_persist).toBe(false);
    expect(a.enablement.contracts.unattended_gate.night_run_ready).toBe(false);
  });

  it("artifact_kind is controlled_dry_run_entrypoint", () => {
    const a = runControlledDryRunEntrypoint(makeGoCandidateGateInput());
    expect(a.artifact_kind).toBe("controlled_dry_run_entrypoint");
  });

  it("readiness_level is controlled_executor_ready", () => {
    const a = runControlledDryRunEntrypoint(makeGoCandidateGateInput());
    expect(a.readiness_level).toBe("controlled_executor_ready");
  });
});

describe("HCC dry-run entrypoint: schema + invariants", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_DRY_RUN_ENTRYPOINT_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("night_run_ready=false + go_no_go=NO-GO in controlled-executor", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

describe("HCC dry-run entrypoint: helpers", () => {
  it("makeGoCandidateGateInput returns all-satisfied + auth=true", () => {
    const input = makeGoCandidateGateInput();
    expect(input.explicit_user_authorization_recorded).toBe(true);
    expect(Object.keys(input.evidence_satisfied).length).toBe(7);
    expect(Object.keys(input.verifier_satisfied).length).toBe(1);
    expect(Object.keys(input.blockers_resolved).length).toBe(4);
  });

  it("makeNoGoGateInput returns all-empty + auth=false", () => {
    const input = makeNoGoGateInput();
    expect(input.explicit_user_authorization_recorded).toBe(false);
    expect(Object.keys(input.evidence_satisfied).length).toBe(0);
  });
});

describe("HCC dry-run entrypoint: src static guard", () => {
  const modulePath = resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-dry-run-entrypoint.ts");
  const src = readFileSync(modulePath, "utf8");

  it("does NOT call spawn / exec / child_process", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/\bspawn\s*\(/);
    expect(s).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT call writeFile / appendFile / fs.write", () => {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(s).not.toMatch(/\bwriteFile\s*\(/);
    expect(s).not.toMatch(/\bappendFile\s*\(/);
  });

  it("does NOT import auto-executor-bootstrap / arm / start / host", () => {
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});