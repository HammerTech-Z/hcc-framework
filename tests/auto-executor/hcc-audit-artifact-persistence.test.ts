import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  checkAuditPath,
  buildAuditArtifact,
  getAuditArtifactPersistencePosture,
  HCC_AUDIT_ARTIFACT_PERSISTENCE_SCHEMA_VERSION,
  type HCCAuditArtifactDescriptor,
} from "../../src/shared/lib/hcc-audit-artifact-persistence";

const REPO_ROOT = resolve(__dirname, "../..");
const PINNED_HEAD = "c5b769b3b02488cde464164c904ceaad289c3a4f";

function mkArtifactInput(overrides: Record<string, string> = {}) {
  return {
    run_id: "HCC-AUDIT-001",
    source_commit: PINNED_HEAD,
    action_id: "read_repo_status",
    whitelist_decision: "allow",
    budget_verdict: "within_budget",
    rollback_rehearsal_decision: "rehearse",
    ...overrides,
  };
}

describe("HCC audit artifact persistence: path policy — allowed", () => {
  it("docs/audit/hcc/ is allowed", () => {
    const r = checkAuditPath("docs/audit/hcc/hcc-run-001.json");
    expect(r.decision).toBe("allowed");
  });

  it("docs/audit/hcc/subdir/file.md is allowed", () => {
    const r = checkAuditPath("docs/audit/hcc/p3-010/artifact.md");
    expect(r.decision).toBe("allowed");
  });
});

describe("HCC audit artifact persistence: path policy — denied", () => {
  it("~/.hermes/ path is denied", () => {
    const r = checkAuditPath("~/.hermes/audit/run-001.json");
    expect(r.decision).toBe("denied");
    expect(r.reason).toContain("~/.hermes");
  });

  it("~/.hermes/config.yaml is denied", () => {
    const r = checkAuditPath("~/.hermes/config.yaml");
    expect(r.decision).toBe("denied");
  });

  it("absolute path /Users/.../src/main is denied", () => {
    const r = checkAuditPath("/Users/midoudou/hermes-pro/src/main/index.ts");
    expect(r.decision).toBe("denied");
  });

  it("src/main/ file is denied", () => {
    const r = checkAuditPath("src/main/auto-executor-host.ts");
    expect(r.decision).toBe("denied");
    expect(r.reason).toContain("src/main");
  });

  it("src/renderer/ file is denied", () => {
    const r = checkAuditPath("src/renderer/src/App.tsx");
    expect(r.decision).toBe("denied");
    expect(r.reason).toContain("src/renderer");
  });

  it("src/preload/ file is denied", () => {
    const r = checkAuditPath("src/preload/index.ts");
    expect(r.decision).toBe("denied");
    expect(r.reason).toContain("src/preload");
  });

  it("package.json is denied (exact)", () => {
    const r = checkAuditPath("package.json");
    expect(r.decision).toBe("denied");
  });

  it("package-lock.json is denied (exact)", () => {
    const r = checkAuditPath("package-lock.json");
    expect(r.decision).toBe("denied");
  });

  it("path not under allowed prefix is denied", () => {
    const r = checkAuditPath("docs/readme.md");
    expect(r.decision).toBe("denied");
    expect(r.reason).toContain("must start with");
  });

  it("docs/closeout/... is denied (not under docs/audit/hcc/)", () => {
    const r = checkAuditPath("docs/closeout/some-report.md");
    expect(r.decision).toBe("denied");
  });
});

describe("HCC audit artifact persistence: artifact shape", () => {
  it("builds artifact with literal-false execution + readiness fields", () => {
    const a: HCCAuditArtifactDescriptor = buildAuditArtifact(mkArtifactInput());
    expect(a.schema_version).toBe("1.0.0");
    expect(a.run_id).toBe("HCC-AUDIT-001");
    expect(a.source_commit).toBe(PINNED_HEAD);
    expect(a.action_id).toBe("read_repo_status");
    expect(a.whitelist_decision).toBe("allow");
    expect(a.budget_verdict).toBe("within_budget");
    expect(a.rollback_rehearsal_decision).toBe("rehearse");
    expect(a.verifier_required).toBe(true);
    expect(a.would_persist).toBe(false);
    expect(a.persisted_paths).toEqual([]);
    expect(a.executed_commands).toEqual([]);
    expect(a.real_execution_ready).toBe(false);
    expect(a.unattended_ready).toBe(false);
    expect(a.night_run_ready).toBe(false);
    expect(a.go_no_go).toBe("NO-GO");
    expect(a.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("artifact with dangerous whitelist decision still records false execution", () => {
    const a = buildAuditArtifact(mkArtifactInput({
      whitelist_decision: "requires_user_approval",
    }));
    expect(a.whitelist_decision).toBe("requires_user_approval");
    expect(a.would_persist).toBe(false);
    expect(a.executed_commands).toEqual([]);
    expect(a.real_execution_ready).toBe(false);
  });

  it("artifact with hard_stop budget verdict records posture correctly", () => {
    const a = buildAuditArtifact(mkArtifactInput({
      budget_verdict: "hard_stop_required",
    }));
    expect(a.budget_verdict).toBe("hard_stop_required");
    expect(a.night_run_ready).toBe(false);
    expect(a.go_no_go).toBe("NO-GO");
  });
});

describe("HCC audit artifact persistence: contract does not imply real / unattended execution", () => {
  it("built artifact would_persist=false (no disk write)", () => {
    const a = buildAuditArtifact(mkArtifactInput());
    expect(a.would_persist).toBe(false);
    expect(a.persisted_paths).toEqual([]);
  });

  it("built artifact real_execution_ready=false and unattended_ready=false", () => {
    const a = buildAuditArtifact(mkArtifactInput());
    expect(a.real_execution_ready).toBe(false);
    expect(a.unattended_ready).toBe(false);
  });

  it("built artifact night_run_ready=false and go_no_go=NO-GO", () => {
    const a = buildAuditArtifact(mkArtifactInput());
    expect(a.night_run_ready).toBe(false);
    expect(a.go_no_go).toBe("NO-GO");
  });
});

describe("HCC audit artifact persistence: posture", () => {
  it("posture: would_persist=false, executed_commands=[], readiness=false", () => {
    const p = getAuditArtifactPersistencePosture();
    expect(p.would_persist).toBe(false);
    expect(p.executed_commands).toEqual([]);
    expect(p.real_execution_ready).toBe(false);
    expect(p.unattended_ready).toBe(false);
    expect(p.night_run_ready).toBe(false);
    expect(p.go_no_go).toBe("NO-GO");
  });

  it("posture: allowed_prefix is docs/audit/hcc", () => {
    const p = getAuditArtifactPersistencePosture();
    expect(p.allowed_prefix).toBe("docs/audit/hcc");
  });

  it("posture: denied_prefixes includes ~/.hermes, src/main, src/renderer, src/preload, package.json, package-lock.json", () => {
    const p = getAuditArtifactPersistencePosture();
    expect(p.denied_prefixes).toContain("~/.hermes");
    expect(p.denied_prefixes).toContain("src/main");
    expect(p.denied_prefixes).toContain("src/renderer");
    expect(p.denied_prefixes).toContain("src/preload");
    expect(p.denied_prefixes).toContain("package.json");
    expect(p.denied_prefixes).toContain("package-lock.json");
  });
});

describe("HCC audit artifact persistence: controlled-executor invariants", () => {
  it("schema version is 1.0.0", () => {
    expect(HCC_AUDIT_ARTIFACT_PERSISTENCE_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("night_run_ready=false / go_no_go=NO-GO preserved in controlled-executor", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });
});

describe("HCC audit artifact persistence: src static guard", () => {
  it("does NOT call spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-artifact-persistence.ts"),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bspawn\s*\(/);
    expect(stripped).not.toMatch(/child_process/);
  });

  it("does NOT call ipcMain", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-artifact-persistence.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/ipcMain/);
  });

  it("does NOT call setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-artifact-persistence.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/set(?:Interval|Immediate|Timeout)\s*\(/);
  });

  it("does NOT call writeFile / appendFile / fs.write", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-artifact-persistence.ts"),
      "utf8",
    );
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bwriteFile\s*\(/);
    expect(stripped).not.toMatch(/\bappendFile\s*\(/);
    expect(stripped).not.toMatch(/fs\.write/);
  });

  it("~/.hermes only appears in denied_prefixes constant (not as a write instruction)", () => {
    // The string "~/.hermes" is a denied prefix in the path policy — it is
    // not a write instruction. Verify the module has no writeFile/appendFile calls.
    // This is already covered by the test above; this test documents the intent.
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-audit-artifact-persistence.ts"),
      "utf8",
    );
    // The module contains the literal "~/.hermes" as a denied prefix value.
    // That is by design. No write function is called with this path.
    expect(src).toContain("~/.hermes");
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(stripped).not.toMatch(/\bwriteFile\s*\(/);
    expect(stripped).not.toMatch(/\bappendFile\s*\(/);
  });
});