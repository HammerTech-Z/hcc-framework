import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateRealExecutionAuthorization,
  HCC_REAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION,
  type HCCRealExecutionAuthorizationInput,
} from "../../src/shared/lib/hcc-real-execution-authorization";

const REPO_ROOT = resolve(__dirname, "../..");
const NOW = "2026-06-14T12:00:00.000Z";
const ISSUED = "2026-06-14T11:00:00.000Z";
const EXPIRES = "2026-06-14T13:00:00.000Z";

function makeValid(
  overrides: Partial<HCCRealExecutionAuthorizationInput> = {},
): HCCRealExecutionAuthorizationInput {
  return {
    task_id: "PLAN-REAL-001",
    source_plan_ref: "plan:2026-06:task-real-001",
    requested_by_user: "u-requester",
    authorized_by_user: "u-authorizer",
    authorization_id: "auth-001",
    authorization_scope: "controlled_real_execution_candidate",
    issued_at: ISSUED,
    expires_at: EXPIRES,
    one_shot: true,
    dry_run_verdict: "GO-CANDIDATE_DRY_RUN_PRODUCED",
    dry_run_artifact_hash: "sha256:abc123",
    reason: "explicit authorization for controlled real execution",
    ...overrides,
  };
}

describe("HCC real-execution authorization: valid record", () => {
  it("all required fields satisfied -> REAL-EXECUTION-AUTH-CANDIDATE", () => {
    const r = evaluateRealExecutionAuthorization(makeValid(), NOW);
    expect(r.verdict).toBe("REAL-EXECUTION-AUTH-CANDIDATE");
  });

  it("candidate still has literal-false execution fields", () => {
    const r = evaluateRealExecutionAuthorization(makeValid(), NOW);
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("candidate preserves task_id / source_plan_ref / authorization_id", () => {
    const r = evaluateRealExecutionAuthorization(makeValid(), NOW);
    expect(r.task_id).toBe("PLAN-REAL-001");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-real-001");
    expect(r.authorization_id).toBe("auth-001");
    expect(r.requested_by_user).toBe("u-requester");
    expect(r.authorized_by_user).toBe("u-authorizer");
  });

  it("result one_shot is false (caller-issued, contract-asserted only)", () => {
    const r = evaluateRealExecutionAuthorization(makeValid(), NOW);
    expect(r.one_shot).toBe(false);
  });
});

describe("HCC real-execution authorization: missing required fields", () => {
  it("missing task_id -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ task_id: "" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("task_id");
  });

  it("missing source_plan_ref -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ source_plan_ref: "" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("source_plan_ref");
  });

  it("missing requested_by_user -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ requested_by_user: "" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("requested_by_user");
  });

  it("missing authorized_by_user -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ authorized_by_user: "" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorized_by_user");
  });

  it("missing authorization_id -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ authorization_id: "" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization_id");
  });

  it("whitespace-only requested_by_user -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ requested_by_user: "   " }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC real-execution authorization: scope / verdict / one_shot guards", () => {
  it("wrong authorization_scope (cast to bypass type) -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({
        authorization_scope: "read_only" as never,
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization_scope");
  });

  it("missing dry_run_verdict (cast) -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({
        dry_run_verdict: undefined as never,
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dry_run_verdict");
  });

  it("one_shot=false -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ one_shot: false }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("one_shot");
  });

  it("missing dry_run_artifact_hash -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ dry_run_artifact_hash: "" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/dry_run_artifact_hash|evidence_hash/);
  });
});

describe("HCC real-execution authorization: timestamp / expiry guards", () => {
  it("issued_at >= expires_at -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({
        issued_at: EXPIRES,
        expires_at: ISSUED,
      }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("issued_at");
  });

  it("now > expires_at -> NO-GO (expired)", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid(),
      "2026-06-14T14:00:00.000Z",
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toMatch(/expired/);
  });

  it("invalid issued_at -> NO-GO", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ issued_at: "not-a-date" }),
      NOW,
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("issued_at");
  });
});

describe("HCC real-execution authorization: NO-GO preserves literal-false", () => {
  it("any NO-GO still has literal-false execution fields", () => {
    const r = evaluateRealExecutionAuthorization(
      makeValid({ task_id: "" }),
      NOW,
    );
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });
});

describe("HCC real-execution authorization: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_REAL_EXECUTION_AUTHORIZATION_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("contract does NOT set real_execution_ready: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-real-execution-authorization.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/real_execution_ready:\s*true/);
  });

  it("contract does NOT set would_execute: true", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-real-execution-authorization.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/would_execute:\s*true/);
  });

  it("contract does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-real-execution-authorization.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  it("contract does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-real-execution-authorization.ts",
      ),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});
