import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  scheduleControlledUnattendedRun,
  HCC_UNATTENDED_SCHEDULER_SCHEMA_VERSION,
  type HCCUnattendedSchedulerInput,
} from "../../src/shared/lib/hcc-unattended-scheduler";

const REPO_ROOT = resolve(__dirname, "../..");

function makeMockAdapter() {
  return {
    supportsKind: vi.fn(
      (k: string) =>
        k === "shell_command" || k === "file_write" || k === "config_patch",
    ),
    dispatch: vi.fn(async () => ({ controlled_command_id: "cc-unatt-sched-001" })),
  };
}

function makeReadyResult(
  overrides: Partial<{
    verdict: "UNATTENDED-READY-CANDIDATE" | "NO-GO";
    unattended_ready: boolean;
    authorization_id: string;
    task_id: string;
    source_plan_ref: string;
    requested_by_user: string;
  }> = {},
) {
  return {
    schema_version: "1.0.0" as const,
    verdict: "UNATTENDED-READY-CANDIDATE" as const,
    reason: "all gates satisfied",
    task_id: "PLAN-UNATT-SCHED-001",
    source_plan_ref: "plan:2026-06:task-unatt-sched-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-sched-001",
    enablement_verdict: "ENABLEMENT-CANDIDATE" as const,
    final_dispatch_verdict: "FINAL-CONTROLLED-REAL-DISPATCH-CANDIDATE" as const,
    unattended_ready: true,
    night_run_ready: false as const,
    go_no_go: "NO-GO" as const,
    auto_executor_started: false as const,
    would_execute: false as const,
    executed_commands: [] as const,
    subprocess_count: 0 as const,
    any_command_executed: false as const,
    real_execution_ready: false as const,
    ...overrides,
  };
}

function makeInput(
  overrides: Partial<HCCUnattendedSchedulerInput> = {},
): HCCUnattendedSchedulerInput {
  const adapter = makeMockAdapter();
  return {
    schedule_id: "sched-001",
    scheduler_window: {
      start_iso: "2026-06-15T20:00:00Z",
      end_iso: "2026-06-15T22:00:00Z",
      tz: "Asia/Shanghai",
    },
    task_id: "PLAN-UNATT-SCHED-001",
    source_plan_ref: "plan:2026-06:task-unatt-sched-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-sched-001",
    feature_flag_enabled: true,
    ready_result: makeReadyResult(),
    planned_action: {
      planned_action_id: "act-unatt-sched-001",
      planned_action_kind: "file_write" as const,
      target_path: "src/shared/lib/notes/unatt-sched-001.md",
    },
    budget: { present: true, exceeded: false },
    blockers_resolved: true,
    dispatch_adapter: adapter,
    ...overrides,
  };
}

describe("HCC controlled unattended scheduler: success path", () => {
  it("all gates pass -> CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED, runner called once", async () => {
    const adapter = makeMockAdapter();
    const r = await scheduleControlledUnattendedRun(
      makeInput({ dispatch_adapter: adapter }),
    );
    expect(r.verdict).toBe("CONTROLLED-UNATTENDED-SCHEDULER-DISPATCHED");
    expect(r.schedule_id).toBe("sched-001");
    expect(r.controlled_command_id).toBe("cc-unatt-sched-001");
    expect(adapter.dispatch).toHaveBeenCalledTimes(1);
    expect(adapter.dispatch).toHaveBeenCalledWith(
      "act-unatt-sched-001",
      "file_write",
      "src/shared/lib/notes/unatt-sched-001.md",
    );
  });

  it("success forwards any_command_executed / executed_commands / subprocess_count from runner", async () => {
    const r = await scheduleControlledUnattendedRun(makeInput());
    expect(r.any_command_executed).toBe(true);
    expect(r.subprocess_count).toBe(1);
    expect(r.executed_commands).toEqual(["cc-unatt-sched-001"]);
  });

  it("success preserves night_run_ready=false, go_no_go=NO-GO, auto_executor_started=false, would_execute=false", async () => {
    const r = await scheduleControlledUnattendedRun(makeInput());
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });

  it("success does NOT set go_no_go=GO", async () => {
    const r = await scheduleControlledUnattendedRun(makeInput());
    expect(r.go_no_go).not.toBe("GO");
  });
});

describe("HCC controlled unattended scheduler: feature flag + identity gates", () => {
  it("feature_flag_enabled=false -> NO-GO, runner/adapter NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await scheduleControlledUnattendedRun(
      makeInput({ feature_flag_enabled: false, dispatch_adapter: adapter }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("feature_flag_enabled");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("missing schedule_id -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ schedule_id: "" }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("schedule_id");
  });

  it("missing scheduler_window -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ scheduler_window: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scheduler_window");
  });

  it("malformed scheduler_window (empty tz) -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({
        scheduler_window: {
          start_iso: "2026-06-15T20:00:00Z",
          end_iso: "2026-06-15T22:00:00Z",
          tz: "",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scheduler_window");
  });

  it("authorization_id mismatch -> NO-GO, runner NOT called", async () => {
    const adapter = makeMockAdapter();
    const r = await scheduleControlledUnattendedRun(
      makeInput({
        authorization_id: "auth-OTHER",
        ready_result: makeReadyResult(),
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("authorization_id");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("ready_result.authorization_id mismatch -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await scheduleControlledUnattendedRun(
      makeInput({
        authorization_id: "auth-unatt-sched-001",
        ready_result: makeReadyResult({ authorization_id: "auth-OTHER" }),
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });
});

describe("HCC controlled unattended scheduler: budget + blockers", () => {
  it("budget missing -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ budget: { present: false, exceeded: false } }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("budget");
  });

  it("budget exceeded -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ budget: { present: true, exceeded: true } }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("budget");
  });

  it("blockers_resolved=false -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ blockers_resolved: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("blockers_resolved");
  });
});

describe("HCC controlled unattended scheduler: ready_result gates", () => {
  it("ready_result.verdict not UNATTENDED-READY-CANDIDATE -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await scheduleControlledUnattendedRun(
      makeInput({
        ready_result: makeReadyResult({ verdict: "NO-GO" }),
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("UNATTENDED-READY-CANDIDATE");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });

  it("ready_result.unattended_ready=false -> NO-GO", async () => {
    const adapter = makeMockAdapter();
    const r = await scheduleControlledUnattendedRun(
      makeInput({
        ready_result: makeReadyResult({ unattended_ready: false }),
        dispatch_adapter: adapter,
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });
});

describe("HCC controlled unattended scheduler: planned_action + adapter gates", () => {
  it("unsupported planned_action_kind -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({
        planned_action: {
          planned_action_id: "act",
          planned_action_kind: "remote_exec" as never,
          target_path: "x",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("missing planned_action -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ planned_action: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
  });

  it("missing dispatch_adapter -> NO-GO", async () => {
    const r = await scheduleControlledUnattendedRun(
      makeInput({ dispatch_adapter: undefined as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("dispatch_adapter");
  });

  it("adapter.supportsKind returns false -> NO-GO, dispatch NOT called", async () => {
    const adapter = {
      supportsKind: vi.fn(() => false),
      dispatch: vi.fn(async () => ({ controlled_command_id: "x" })),
    };
    const r = await scheduleControlledUnattendedRun(
      makeInput({ dispatch_adapter: adapter as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(adapter.dispatch).not.toHaveBeenCalled();
  });
});

describe("HCC controlled unattended scheduler: runner NO-GO propagation", () => {
  it("runner returns NO-GO -> scheduler returns NO-GO with runner reason", async () => {
    // Force the runner to NO-GO by passing a ready_result that mismatches
    // the input authorization_id. The scheduler catches this earlier than
    // the runner, so to hit the runner-level NO-GO we need a path that
    // the scheduler permits but the runner rejects. The runner rejects
    // on empty `controlled_command_id` returned by the adapter.
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(async () => ({ controlled_command_id: "" })),
    };
    const r = await scheduleControlledUnattendedRun(
      makeInput({ dispatch_adapter: adapter as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    // The runner's empty-id check happens before the scheduler sees the
    // result, so the scheduler reports the runner's reason.
    expect(r.reason).toContain("runUnattendedControlledDispatch");
  });
});

describe("HCC controlled unattended scheduler: typed throws", () => {
  it("adapter throws -> typed NO-GO with propagated reason", async () => {
    const adapter = {
      supportsKind: vi.fn(() => true),
      dispatch: vi.fn(() => {
        throw new Error("adapter boom");
      }),
    };
    const r = await scheduleControlledUnattendedRun(
      makeInput({ dispatch_adapter: adapter as never }),
    );
    expect(r.verdict).toBe("NO-GO");
    // The runner already catches adapter throws and surfaces a typed
    // NO-GO; the scheduler forwards the runner's reason.
    expect(r.reason).toMatch(/runUnattendedControlledDispatch|adapter/i);
  });
});

describe("HCC controlled unattended scheduler: NO-GO preserves side-effect fields", () => {
  it("any NO-GO path keeps any_command_executed=false, subprocess_count=0, executed_commands=[]", async () => {
    const cases = [
      makeInput({ feature_flag_enabled: false }),
      makeInput({ schedule_id: "" }),
      makeInput({
        scheduler_window: undefined as never,
      }),
      makeInput({
        authorization_id: "auth-OTHER",
      }),
      makeInput({ budget: { present: false, exceeded: false } }),
      makeInput({ blockers_resolved: false }),
      makeInput({
        ready_result: makeReadyResult({ verdict: "NO-GO" }),
      }),
      makeInput({ dispatch_adapter: undefined as never }),
    ];
    for (const c of cases) {
      const r = await scheduleControlledUnattendedRun(c);
      expect(r.verdict).toBe("NO-GO");
      expect(r.any_command_executed).toBe(false);
      expect(r.subprocess_count).toBe(0);
      expect(r.executed_commands).toEqual([]);
      expect(r.controlled_command_id).toBe("");
      expect(r.unattended_ready).toBe(false);
      expect(r.night_run_ready).toBe(false);
      expect(r.go_no_go).toBe("NO-GO");
    }
  });
});

describe("HCC controlled unattended scheduler: schema + static guards", () => {
  it("schema version = 1.0.0", () => {
    expect(HCC_UNATTENDED_SCHEDULER_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("scheduler preserves night_run_ready:false + go_no_go:NO-GO literals in source", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-scheduler.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
    // Must NOT set go_no_go to the literal string GO. We strip
    // comments so the regex does not self-match the assertion text
    // (the runner test relies on the same strip).
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("scheduler does NOT call spawn / exec / child_process / ipcMain / BrowserWindow / contextBridge / setInterval / setTimeout", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-scheduler.ts"),
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

  it("scheduler does NOT import bootstrap / arm / start / host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-scheduler.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("scheduler does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-scheduler.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("scheduler does NOT contain forbidden night-run/夜间 substring", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-scheduler.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/night-run/);
    expect(src).not.toMatch(/夜间/);
  });
});
