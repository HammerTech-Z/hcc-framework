import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  evaluateUnattendedReadyConsumer,
  HCC_UNATTENDED_READY_CONSUMER_SCHEMA_VERSION,
  type HCCUnattendedReadyConsumerInput,
} from "../../src/shared/lib/hcc-unattended-ready-consumer";

const REPO_ROOT = resolve(__dirname, "../..");

function makeInput(
  overrides: Partial<HCCUnattendedReadyConsumerInput> = {},
): HCCUnattendedReadyConsumerInput {
  return {
    task_id: "PLAN-URC-001",
    source_plan_ref: "plan:2026-06:task-urc-001",
    requested_by_user: "u-requester",
    feature_flag_enabled: true,
    enablement_result: {
      schema_version: "1.0.0" as const,
      verdict: "ENABLEMENT-CANDIDATE" as const,
      reason: "all 8 gates satisfied",
      task_id: "PLAN-URC-001",
      source_plan_ref: "plan:2026-06:task-urc-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-urc-001",
      unattended_ready_candidate: true,
      would_execute: false,
      executed_commands: [],
      subprocess_count: 0,
      auto_executor_started: false,
      any_command_executed: false,
      real_execution_ready: false,
      unattended_ready: false,
      night_run_ready: false,
      go_no_go: "NO-GO",
    },
    final_dispatch_result: {
      schema_version: "1.0.0" as const,
      verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" as const,
      reason: "all prior contracts satisfied",
      task_id: "PLAN-URC-001",
      source_plan_ref: "plan:2026-06:task-urc-001",
      requested_by_user: "u-requester",
      authorization_id: "auth-urc-001",
      dry_run_artifact_hash: "sha256:abc",
      planned_action_id: "act-urc-001",
      planned_action_kind: "file_write" as const,
      whitelist_action_id: "wl-urc-001",
      controlled_command_id: "cc-urc-001",
      real_execution_ready: true,
      would_execute: true,
      any_command_executed: true,
      executed_commands: ["cc-urc-001"],
      subprocess_count: 1,
      auto_executor_started: false,
      unattended_ready: false,
      night_run_ready: false,
      go_no_go: "NO-GO",
    },
    authorization: {
      authorized: true,
      authorization_id: "auth-urc-001",
      scope: "controlled_unattended_enablement" as const,
    },
    budget: { present: true, exceeded: false },
    confirmed_audit_written: true,
    confirmed_rollback_candidate: true,
    blockers_resolved: true,
    ...overrides,
  };
}

describe("HCC unattended ready consumer: all gates satisfied", () => {
  it("all gates pass -> UNATTENDED-READY-CANDIDATE with unattended_ready=true", () => {
    const r = evaluateUnattendedReadyConsumer(makeInput());
    expect(r.verdict).toBe("UNATTENDED-READY-CANDIDATE");
    expect(r.unattended_ready).toBe(true);
  });

  it("candidate keeps night_run_ready: false and go_no_go: NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(makeInput());
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
  });

  it("candidate has no execution side effects", () => {
    const r = evaluateUnattendedReadyConsumer(makeInput());
    expect(r.would_execute).toBe(false);
    expect(r.executed_commands).toEqual([]);
    expect(r.subprocess_count).toBe(0);
    expect(r.any_command_executed).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });

  it("candidate preserves identity", () => {
    const r = evaluateUnattendedReadyConsumer(makeInput());
    expect(r.task_id).toBe("PLAN-URC-001");
    expect(r.source_plan_ref).toBe("plan:2026-06:task-urc-001");
    expect(r.requested_by_user).toBe("u-requester");
    expect(r.authorization_id).toBe("auth-urc-001");
  });
});

describe("HCC unattended ready consumer: feature flag", () => {
  it("feature_flag_enabled=false -> NO-GO, unattended_ready=false", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({ feature_flag_enabled: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("feature_flag_enabled");
    expect(r.unattended_ready).toBe(false);
  });
});

describe("HCC unattended ready consumer: enablement result", () => {
  it("enablement verdict NO-GO -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        enablement_result: {
          ...makeInput().enablement_result,
          verdict: "NO-GO" as const,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("ENABLEMENT-CANDIDATE");
  });

  it("enablement unattended_ready_candidate=false -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        enablement_result: {
          ...makeInput().enablement_result,
          unattended_ready_candidate: false,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("unattended_ready_candidate");
  });
});

describe("HCC unattended ready consumer: final dispatch", () => {
  it("final dispatch verdict NO-GO -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        final_dispatch_result: {
          ...makeInput().final_dispatch_result,
          verdict: "NO-GO" as const,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE");
  });
});

describe("HCC unattended ready consumer: authorization", () => {
  it("authorization.authorized=false -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        authorization: { authorized: false, authorization_id: "x", scope: "controlled_unattended_enablement" },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization.authorized");
  });

  it("authorization.scope wrong -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        authorization: {
          authorized: true,
          authorization_id: "x",
          scope: "wrong" as never,
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scope");
  });
});

describe("HCC unattended ready consumer: identity cross-check", () => {
  it("enablement task_id mismatch -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        enablement_result: { ...makeInput().enablement_result, task_id: "OTHER" },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("task_id");
  });

  it("final dispatch source_plan_ref mismatch -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        final_dispatch_result: {
          ...makeInput().final_dispatch_result,
          source_plan_ref: "plan:other",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("enablement authorization_id mismatch -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({
        enablement_result: {
          ...makeInput().enablement_result,
          authorization_id: "auth-OTHER",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization_id");
  });
});

describe("HCC unattended ready consumer: budget", () => {
  it("budget.present=false -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({ budget: { present: false, exceeded: false } }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("budget.exceeded=true -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({ budget: { present: true, exceeded: true } }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended ready consumer: audit, rollback, blockers", () => {
  it("confirmed_audit_written=false -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({ confirmed_audit_written: false }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("confirmed_rollback_candidate=false -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({ confirmed_rollback_candidate: false }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("blockers_resolved=false -> NO-GO", () => {
    const r = evaluateUnattendedReadyConsumer(
      makeInput({ blockers_resolved: false }),
    );
    expect(r.verdict).toBe("NO-GO");
  });
});

describe("HCC unattended ready consumer: NO-GO always has unattended_ready=false", () => {
  it("any NO-GO path preserves unattended_ready=false", () => {
    const cases = [
      makeInput({ feature_flag_enabled: false }),
      makeInput({ budget: { present: false, exceeded: false } }),
      makeInput({ confirmed_audit_written: false }),
      makeInput({ blockers_resolved: false }),
    ];
    for (const c of cases) {
      const r = evaluateUnattendedReadyConsumer(c);
      expect(r.unattended_ready).toBe(false);
      expect(r.night_run_ready).toBe(false);
      expect(r.go_no_go).toBe("NO-GO");
      expect(r.would_execute).toBe(false);
    }
  });
});

describe("HCC unattended ready consumer: schema + static guard", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_READY_CONSUMER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("controlled-executor preserves night_run_ready:false + go_no_go:NO-GO", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-controlled-executor.ts"),
      "utf8",
    );
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
  });

  it("lib does NOT call spawn / exec / child_process / ipcMain / BrowserWindow / contextBridge / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(
        REPO_ROOT,
        "src/shared/lib/hcc-unattended-ready-consumer.ts",
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
        "src/shared/lib/hcc-unattended-ready-consumer.ts",
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
        "src/shared/lib/hcc-unattended-ready-consumer.ts",
      ),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });
});
