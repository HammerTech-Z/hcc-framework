import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateControlledRealRunnerCandidate,
  HCC_CONTROLLED_REAL_RUNNER_SCHEMA_VERSION,
  type HCCControlledRealRunnerInput,
} from "../../src/shared/lib/hcc-controlled-real-runner";
import { evaluateRealExecutionAuthorization } from "../../src/shared/lib/hcc-real-execution-authorization";

const REPO_ROOT = resolve(__dirname, "../..");

const NOW = "2026-06-14T12:00:00.000Z";
const ISSUED = "2026-06-14T11:00:00.000Z";
const EXPIRES = "2026-06-14T13:00:00.000Z";
const HASH = "sha256:abc123";

function makeValidAuthorization() {
  return evaluateRealExecutionAuthorization(
    {
      task_id: "PLAN-RUN-001",
      source_plan_ref: "plan:2026-06:task-run-001",
      requested_by_user: "u-requester",
      authorized_by_user: "u-authorizer",
      authorization_id: "auth-run-001",
      authorization_scope: "controlled_real_execution_candidate",
      issued_at: ISSUED,
      expires_at: EXPIRES,
      one_shot: true,
      dry_run_verdict: "GO-CANDIDATE_DRY_RUN_PRODUCED",
      dry_run_artifact_hash: HASH,
      reason: "explicit authorization for controlled real execution",
    },
    NOW,
  );
}

function makeInput(
  overrides: Partial<HCCControlledRealRunnerInput> = {},
): HCCControlledRealRunnerInput {
  return {
    task_id: "PLAN-RUN-001",
    source_plan_ref: "plan:2026-06:task-run-001",
    requested_by_user: "u-requester",
    authorization_result: makeValidAuthorization(),
    dry_run_artifact_hash: HASH,
    planned_action_id: "act-001",
    planned_action_kind: "shell_command",
    whitelist_action_id: "wl-001",
    ...overrides,
  };
}

describe("HCC controlled real-runner: valid candidate", () => {
  it("all checks pass -> CONTROLLED-REAL-RUNNER-CANDIDATE", () => {
    const r = evaluateControlledRealRunnerCandidate(makeInput());
    expect(r.verdict).toBe("CONTROLLED-REAL-RUNNER-CANDIDATE");
  });

  it("candidate flips real_execution_ready_candidate to true", () => {
    const r = evaluateControlledRealRunnerCandidate(makeInput());
    expect(r.real_execution_ready_candidate).toBe(true);
  });

  it("candidate keeps real_execution_ready: false", () => {
    const r = evaluateControlledRealRunnerCandidate(makeInput());
    expect(r.real_execution_ready).toBe(false);
  });

  it("candidate keeps all other execution fields literal-false / zero", () => {
    const r = evaluateControlledRealRunnerCandidate(makeInput());
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.auto_executor_started).toBe(false);
    expect(r.any_command_executed).toBe(false);
    expect(r.unattended_ready).toBe(false);
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
  });

  it("candidate preserves task_id / source_plan_ref / planned_action identity", () => {
    const r = evaluateControlledRealRunnerCandidate(makeInput());
    expect(r.task_id).toBe("PLAN-RUN-001");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-run-001");
    expect(r.planned_action_id).toBe("act-001");
    expect(r.planned_action_kind).toBe("shell_command");
    expect(r.whitelist_action_id).toBe("wl-001");
    expect(r.authorization_id).toBe("auth-run-001");
  });

  it("candidate reason explains the candidate does not mean execution ready", () => {
    const r = evaluateControlledRealRunnerCandidate(makeInput());
    expect(r.reason).toMatch(/NOT ready|not started|not executed/i);
  });
});

describe("HCC controlled real-runner: authorization verdict guard", () => {
  it("NO-GO authorization -> NO-GO", () => {
    const auth = makeValidAuthorization();
    const noGoAuth = { ...auth, verdict: "NO-GO" as const };
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ authorization_result: noGoAuth }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("REAL-EXECUTION-AUTH-CANDIDATE");
  });
});

describe("HCC controlled real-runner: identity mismatch guards", () => {
  it("task_id mismatch -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ task_id: "PLAN-RUN-OTHER" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("task_id");
  });

  it("source_plan_ref mismatch -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ source_plan_ref: "plan:2026-06:task-other" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("source_plan_ref");
  });

  it("requested_by_user mismatch -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ requested_by_user: "u-other" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("requested_by_user");
  });

  it("dry_run_artifact_hash mismatch -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ dry_run_artifact_hash: "sha256:different" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dry_run_artifact_hash");
  });
});

describe("HCC controlled real-runner: planned-action identity guards", () => {
  it("missing planned_action_id -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ planned_action_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("planned_action_id");
  });

  it("unsupported planned_action_kind -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({
        planned_action_kind: "remote_exec" as never,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("planned_action_kind");
  });

  it("missing whitelist_action_id -> NO-GO", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ whitelist_action_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("whitelist_action_id");
  });
});

describe("HCC controlled real-runner: NO-GO preserves literal-false", () => {
  it("any NO-GO keeps execution fields literal-false and candidate flag false", () => {
    const r = evaluateControlledRealRunnerCandidate(
      makeInput({ task_id: "" }),
    );
    expect(r.real_execution_ready_candidate).toBe(false);
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

describe("HCC controlled real-runner: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_CONTROLLED_REAL_RUNNER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("runner lib does NOT set real_execution_ready: true", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-real-runner.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/real_execution_ready:\s*true/);
  });

  it("runner lib does NOT set would_execute: true", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-real-runner.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/would_execute:\s*true/);
  });

  it("runner lib does NOT set any_command_executed: true", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-real-runner.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/any_command_executed:\s*true/);
  });

  it("runner lib does NOT call submitDryRunAction / spawn / exec / child_process", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-real-runner.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
    expect(src).not.toMatch(/\bspawn\s*\(/);
    expect(src).not.toMatch(/child_process/);
  });

  it("runner lib does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-real-runner.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });
});
