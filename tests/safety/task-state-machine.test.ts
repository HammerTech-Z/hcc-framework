import { describe, expect, it } from "vitest";
import {
  transition,
  validEvents,
  isCapabilityAllowed,
  makePreflightDecision,
  actionGateCheck,
  checkRetry,
  incrementRetry,
  MAX_RETRIES,
  type TaskState,
  type TaskEvent,
  type TrustLevel,
  type Capability,
} from "@shared/lib/safety/types";


// -----------------------------------------------------------------
// Trust / Capability
// -----------------------------------------------------------------
describe("isCapabilityAllowed", () => {
  it("trusted_user can do everything", () => {
    const all: Capability[] = [
      "read_public", "read_local", "write_artifact", "write_project",
      "run_command", "browser_action", "credential_access", "external_publish",
    ];
    for (const cap of all) {
      expect(isCapabilityAllowed("trusted_user", cap)).toBe(true);
    }
  });

  it("untrusted_external is readonly", () => {
    expect(isCapabilityAllowed("untrusted_external", "read_public")).toBe(true);
    expect(isCapabilityAllowed("untrusted_external", "write_project")).toBe(false);
    expect(isCapabilityAllowed("untrusted_external", "run_command")).toBe(false);
    expect(isCapabilityAllowed("untrusted_external", "browser_action")).toBe(false);
    expect(isCapabilityAllowed("untrusted_external", "credential_access")).toBe(false);
  });

  it("unattended_cron is readonly", () => {
    expect(isCapabilityAllowed("unattended_cron", "read_public")).toBe(true);
    expect(isCapabilityAllowed("unattended_cron", "write_artifact")).toBe(false);
    expect(isCapabilityAllowed("unattended_cron", "run_command")).toBe(false);
  });

  it("archive_locked has no capabilities", () => {
    for (const cap of [
      "read_public", "read_local", "write_artifact",
      "write_project", "run_command", "browser_action",
      "credential_access", "external_publish",
    ] as Capability[]) {
      expect(isCapabilityAllowed("archive_locked", cap)).toBe(false);
    }
  });

  it("semi_trusted_local allows read and write_artifact", () => {
    expect(isCapabilityAllowed("semi_trusted_local", "read_local")).toBe(true);
    expect(isCapabilityAllowed("semi_trusted_local", "write_artifact")).toBe(true);
    expect(isCapabilityAllowed("semi_trusted_local", "write_project")).toBe(false);
    expect(isCapabilityAllowed("semi_trusted_local", "run_command")).toBe(false);
  });
});

// -----------------------------------------------------------------
// Task State Machine — valid transitions
// -----------------------------------------------------------------
describe("transition", () => {
  type T = [TaskState, TaskEvent, TaskState | null];
  const cases: T[] = [
    // Normal flow
    ["received",      "classify",        "classified"],
    ["classified",     "plan",           "planned"],
    ["planned",        "approve",        "approved"],
    ["planned",        "reject",         "rejected"],
    ["planned",        "classify",        "ready_readonly"], // read-only branch
    ["ready_readonly", "execute",         "executing"],      // read-only shortcut
    ["approved",       "preflight_pass", "preflight"],      // preflight is a state
    ["approved",       "preflight_fail", "blocked"],
    ["preflight",      "execute",         "executing"],
    ["executing",      "verify_pass",    "verifying"],
    ["executing",      "verify_fail",    "failed"],
    ["verifying",      "verify_pass",    "done"],
    ["verifying",      "verify_fail",    "failed"],
    // Failed → rollback
    ["failed",         "execute",         "rollback_required"], // back-track label
    ["rollback_required", "rollback_success", "rolled_back"],
    ["rollback_required", "rollback_fail",   "escalation"],
    // Retry limit
    ["failed",         "retry_exhausted", "blocked"],
    ["rolled_back",    "retry_exhausted", "blocked"],
    // User override
    ["blocked",        "user_override",  "approved"],
    ["rejected",       "user_override",  "approved"],
    // Escalation
    ["escalation",     "escalate",       "escalation"],
  ];

  for (const [from, event, expected] of cases) {
    it(`${from} + ${event} → ${expected ?? "(invalid)"}`, () => {
      expect(transition(from, event)).toBe(expected);
    });
  }

  it("invalid transitions return null", () => {
    expect(transition("received", "approve")).toBeNull();
    expect(transition("done", "classify")).toBeNull();
    expect(transition("blocked", "plan")).toBeNull();
    expect(transition("rejected", "preflight_pass")).toBeNull();
  });
});

// -----------------------------------------------------------------
// validEvents
// -----------------------------------------------------------------
describe("validEvents", () => {
  it("received has exactly classify", () => {
    expect(validEvents("received")).toEqual(["classify"]);
  });

  it("blocked has exactly user_override", () => {
    expect(validEvents("blocked")).toEqual(["user_override"]);
  });

  it("failed has two events", () => {
    const ev = validEvents("failed").sort();
    expect(ev).toContain("execute");
    expect(ev).toContain("retry_exhausted");
  });

  it("done has no valid events", () => {
    expect(validEvents("done")).toEqual([]);
  });
});

// -----------------------------------------------------------------
// Preflight Decision
// -----------------------------------------------------------------
describe("makePreflightDecision", () => {
  it("denies capability not in trust ceiling", () => {
    const r = makePreflightDecision(
      "t1", "run_command", "untrusted_external", "run_command",
    );
    expect(r.decision).toBe("deny");
    expect(r.reasons[0]).toContain("not allowed");
  });

  it("denies write_project for unattended_cron", () => {
    const r = makePreflightDecision(
      "t2", "write_project", "unattended_cron", "write_project",
    );
    expect(r.decision).toBe("deny");
  });

  it("allows read_public for trusted_user without extra reasons", () => {
    const r = makePreflightDecision(
      "t3", "read_public", "trusted_user", "read_public",
    );
    expect(r.decision).toBe("allow");
  });

  it("high-risk capability requires user approval without confirmation", () => {
    const r = makePreflightDecision(
      "t4", "credential_access", "trusted_user", "credential_access",
    );
    expect(r.decision).toBe("require_user_approval");
  });

  it("high-risk capability allows with user confirmation", () => {
    const r = makePreflightDecision(
      "t5", "credential_access", "trusted_user", "credential_access",
      { userHasConfirmed: true },
    );
    expect(r.decision).toBe("allow");
    expect(r.reasons[0]).toContain("user explicitly confirmed");
  });

  it("browser_action always needs approval", () => {
    const r = makePreflightDecision(
      "t6", "browser_action", "trusted_user", "browser_action",
    );
    expect(r.decision).toBe("require_user_approval");
  });

  it("external_publish always needs approval", () => {
    const r = makePreflightDecision(
      "t7", "external_publish", "trusted_user", "external_publish",
    );
    expect(r.decision).toBe("require_user_approval");
  });
});

// -----------------------------------------------------------------
// Action Gate
// -----------------------------------------------------------------
describe("actionGateCheck", () => {
  it("irreversible without confirmation → require_user_approval", () => {
    const r = actionGateCheck({
      taskId: "t1",
      sourceTrust: "trusted_user",
      isIrreversible: true,
      userHasConfirmed: false,
    });
    expect(r).toBe("require_user_approval");
  });

  it("irreversible with confirmation → allow", () => {
    const r = actionGateCheck({
      taskId: "t2",
      sourceTrust: "trusted_user",
      isIrreversible: true,
      userHasConfirmed: true,
    });
    expect(r).toBe("allow");
  });

  it("reversible → always allow", () => {
    const r = actionGateCheck({
      taskId: "t3",
      sourceTrust: "untrusted_external",
      isIrreversible: false,
      userHasConfirmed: false,
    });
    expect(r).toBe("allow");
  });
});


// -----------------------------------------------------------------
// Retry State
// -----------------------------------------------------------------
describe("checkRetry / incrementRetry", () => {
  it("first attempt is allowed, count 0", () => {
    const state = new Map<string, { taskId: string; failureSignature: string; count: number }>();
    const result = checkRetry("t1", "sig1", state);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(0);
  });

  it("after one increment count is 1, still allowed", () => {
    const state = new Map<string, { taskId: string; failureSignature: string; count: number }>();
    incrementRetry("t1", "sig1", state);
    const result = checkRetry("t1", "sig1", state);
    expect(result.allowed).toBe(true);
    expect(result.count).toBe(1);
  });

  it("after MAX_RETRIES increments, retry is blocked", () => {
    const state = new Map<string, { taskId: string; failureSignature: string; count: number }>();
    for (let i = 0; i < MAX_RETRIES; i++) {
      incrementRetry("t1", "sig1", state);
    }
    const result = checkRetry("t1", "sig1", state);
    expect(result.allowed).toBe(false);
    expect(result.count).toBe(MAX_RETRIES);
  });

  it("different signatures have independent retry counts", () => {
    const state = new Map<string, { taskId: string; failureSignature: string; count: number }>();
    for (let i = 0; i < MAX_RETRIES; i++) incrementRetry("t1", "sigA", state);
    for (let i = 0; i < 1; i++) incrementRetry("t1", "sigB", state);
    expect(checkRetry("t1", "sigA", state).allowed).toBe(false);
    expect(checkRetry("t1", "sigB", state).allowed).toBe(true);
  });
});