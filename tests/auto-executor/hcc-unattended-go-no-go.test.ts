import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateUnattendedGoNoGo,
  getUnattendedGoNoGoPosture,
  HCC_UNATTENDED_GO_NO_GO_SCHEMA_VERSION,
  HCC_UNATTENDED_EVIDENCE_GATES,
  HCC_UNATTENDED_VERIFIER_GATES,
  HCC_UNATTENDED_BLOCKERS,
  type HCCUnattendedGoNoGoInput,
  type HCCUnattendedGoNoGoReport,
} from "../../src/shared/lib/hcc-unattended-go-no-go";

const REPO_ROOT = resolve(__dirname, "../..");

function allEvidenceSatisfied(): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const g of HCC_UNATTENDED_EVIDENCE_GATES) r[g.id] = true;
  return r;
}

function allVerifiersSatisfied(): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const g of HCC_UNATTENDED_VERIFIER_GATES) r[g.id] = true;
  return r;
}

function allBlockersResolved(): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const b of HCC_UNATTENDED_BLOCKERS) r[b.id] = true;
  return r;
}

function noBlockersResolved(): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  for (const b of HCC_UNATTENDED_BLOCKERS) r[b.id] = false;
  return r;
}

function defaultInput(
  overrides: Partial<HCCUnattendedGoNoGoInput> = {},
): HCCUnattendedGoNoGoInput {
  return {
    evidence_satisfied: {},
    verifier_satisfied: {},
    explicit_user_authorization_recorded: false,
    blockers_resolved: noBlockersResolved(),
    ...overrides,
  };
}

describe("HCC unattended GO/NO-GO: default NO-GO", () => {
  it("default input returns NO-GO", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput());
    expect(r.verdict).toBe("NO-GO");
    expect(r.explicit_user_authorization_recorded).toBe(false);
  });

  it("all literal-false execution fields are false in NO-GO report", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput());
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.any_file_written).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
  });
});

describe("HCC unattended GO/NO-GO: missing authorization -> NO-GO", () => {
  it("all evidence + verifiers satisfied but authorization false -> NO-GO", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: false,
    }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("explicit_user_authorization");
  });
});

describe("HCC unattended GO/NO-GO: missing evidence -> NO-GO", () => {
  it("authorization true but one evidence missing -> NO-GO", () => {
    const evidence = allEvidenceSatisfied();
    evidence["real_action_whitelist_present"] = false;
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: evidence,
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
    }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("evidence");
  });

  it("authorization true but all evidence false -> NO-GO", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: {},
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
    }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("evidence");
  });
});

describe("HCC unattended GO/NO-GO: missing verifier -> NO-GO", () => {
  it("authorization + evidence true but verifier missing -> NO-GO", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: {},
      explicit_user_authorization_recorded: true,
    }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("verifier");
  });
});

describe("HCC unattended GO/NO-GO: GO-CANDIDATE only", () => {
  it("all gates satisfied + auth true + blockers resolved -> GO-CANDIDATE (NOT started)", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
      blockers_resolved: allBlockersResolved(),
    }));
    expect(r.verdict).toBe("GO-CANDIDATE");
    // GO-CANDIDATE is NOT "started."
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.any_file_written).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
  });

  it("GO-CANDIDATE still has literal-false posture", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
      blockers_resolved: allBlockersResolved(),
    }));
    expect(r.auto_executor_started).toBe(false);
    expect(r.night_run_ready).toBe(false);
  });
});

describe("HCC unattended GO/NO-GO: blocker gate -> NO-GO", () => {
  it("all evidence + verifier + auth true but no blockers resolved -> NO-GO", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
      blockers_resolved: noBlockersResolved(),
    }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("blocker");
  });

  it("one blocker unresolved -> NO-GO", () => {
    const blockers = allBlockersResolved();
    blockers["p3_real_execution_not_approved"] = false;
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
      blockers_resolved: blockers,
    }));
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("blocker");
    expect(r.reason).toContain("p3_real_execution_not_approved");
  });

  it("all evidence + verifier + auth true + all blockers resolved -> GO-CANDIDATE", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
      blockers_resolved: allBlockersResolved(),
    }));
    expect(r.verdict).toBe("GO-CANDIDATE");
    // GO-CANDIDATE still literal-false for all execution fields
    expect(r.auto_executor_started).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.any_file_written).toBe(false);
  });
});

describe("HCC unattended GO/NO-GO: evidence gate count", () => {
  it("evidence gates = 7, verifier gates = 1, blockers = 4", () => {
    expect(HCC_UNATTENDED_EVIDENCE_GATES.length).toBe(7);
    expect(HCC_UNATTENDED_VERIFIER_GATES.length).toBe(1);
    expect(HCC_UNATTENDED_BLOCKERS.length).toBe(4);
  });

  it("all evidence gates and blockers have unique ids", () => {
    const evidenceIds = HCC_UNATTENDED_EVIDENCE_GATES.map((g) => g.id);
    const verifierIds = HCC_UNATTENDED_VERIFIER_GATES.map((g) => g.id);
    const blockerIds = HCC_UNATTENDED_BLOCKERS.map((b) => b.id);
    const all = [...evidenceIds, ...verifierIds, ...blockerIds];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("HCC unattended GO/NO-GO: posture", () => {
  it("posture: unattended_ready=false, night_run_ready=false, go_no_go=NO-GO", () => {
    const p = getUnattendedGoNoGoPosture();
    expect(p.unattended_ready).toBe(false);
    expect(p.night_run_ready).toBe(false);
    expect(p.go_no_go).toBe("NO-GO");
    expect(p.real_execution_ready).toBe(false);
    expect(p.auto_executor_started).toBe(false);
    expect(p.any_command_executed).toBe(false);
    expect(p.any_file_written).toBe(false);
  });
});

describe("HCC unattended GO/NO-GO: schema + invariants", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_GO_NO_GO_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("night_run_ready=false + go_no_go=NO-GO in controlled-executor", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("GO-CANDIDATE report still has night_run_ready=false", () => {
    const r = evaluateUnattendedGoNoGo(defaultInput({
      evidence_satisfied: allEvidenceSatisfied(),
      verifier_satisfied: allVerifiersSatisfied(),
      explicit_user_authorization_recorded: true,
      blockers_resolved: allBlockersResolved(),
    }));
    expect(r.night_run_ready).toBe(false);
  });
});

describe("HCC unattended GO/NO-GO: src static guard", () => {
  it("does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-go-no-go.ts"),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bspawn\s*\(/);
    expect(stripped).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-go-no-go.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-go-no-go.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT write to ~/.hermes/** (denied prefix check only)", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-go-no-go.ts"),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    // Only the string path reference in the blocker constant.
    // No writeFile, appendFile, or fs.write call.
    expect(stripped).not.toMatch(/\bwriteFile\s*\(/);
    expect(stripped).not.toMatch(/\bappendFile\s*\(/);
  });
});