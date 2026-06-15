import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  runTerminalUnattendedScheduledDispatch,
  HCC_UNATTENDED_TERMINAL_ENTRYPOINT_SCHEMA_VERSION,
  type HCCUnattendedTerminalEntrypointInput,
} from "../../src/shared/lib/hcc-unattended-terminal-entrypoint";
import {
  runAppUnattendedScheduledDispatch,
  HCC_UNATTENDED_APP_ENTRYPOINT_SCHEMA_VERSION,
  type HCCUnattendedAppEntrypointInput,
} from "../../src/shared/lib/hcc-unattended-app-entrypoint";
import * as schedulerModule from "../../src/shared/lib/hcc-unattended-scheduler";

const REPO_ROOT = resolve(__dirname, "../..");

// Each test starts from a clean spy state. Some scheduler tests
// install their own mock implementation; others install a spy.
// Calling vi.restoreAllMocks() between tests prevents spy call
// counts from leaking across tests.
beforeEach(() => {
  vi.restoreAllMocks();
});

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
  }> = {},
) {
  return {
    schema_version: "1.0.0" as const,
    verdict: "UNATTENDED-READY-CANDIDATE" as const,
    reason: "all gates satisfied",
    task_id: "PLAN-UNATT-EP-001",
    source_plan_ref: "plan:2026-06:task-unatt-ep-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-ep-001",
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

function makeSchedulerInput() {
  const adapter = makeMockAdapter();
  return {
    schedule_id: "sched-ep-001",
    scheduler_window: {
      start_iso: "2026-06-15T20:00:00Z",
      end_iso: "2026-06-15T22:00:00Z",
      tz: "Asia/Shanghai",
    },
    task_id: "PLAN-UNATT-EP-001",
    source_plan_ref: "plan:2026-06:task-unatt-ep-001",
    requested_by_user: "u-requester",
    authorization_id: "auth-unatt-ep-001",
    feature_flag_enabled: true,
    ready_result: makeReadyResult(),
    planned_action: {
      planned_action_id: "act-unatt-ep-001",
      planned_action_kind: "file_write" as const,
      target_path: "src/shared/lib/notes/unatt-ep-001.md",
    },
    budget: { present: true, exceeded: false },
    blockers_resolved: true,
    dispatch_adapter: adapter,
  };
}

function makeTerminalInput(
  overrides: Partial<HCCUnattendedTerminalEntrypointInput> = {},
): HCCUnattendedTerminalEntrypointInput {
  return {
    invocation: {
      terminal_agent_session_id: "term-sess-001",
      terminal_invocation_id: "term-inv-001",
      explicit_unattended_trigger_token: "term-trigger-001",
    },
    feature_flag_enabled: true,
    scheduler_input: makeSchedulerInput(),
    ...overrides,
  };
}

function makeAppInput(
  overrides: Partial<HCCUnattendedAppEntrypointInput> = {},
): HCCUnattendedAppEntrypointInput {
  return {
    invocation: {
      app_session_id: "app-sess-001",
      app_invocation_id: "app-inv-001",
      user_confirmation: true,
      explicit_unattended_trigger_token: "app-trigger-001",
    },
    feature_flag_enabled: true,
    scheduler_input: makeSchedulerInput(),
    ...overrides,
  };
}

describe("HCC product entrypoint (terminal): success path", () => {
  it("all gates pass -> TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED, scheduler called once", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runTerminalUnattendedScheduledDispatch(
      makeTerminalInput(),
    );
    expect(r.verdict).toBe("TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED");
    expect(r.terminal_agent_session_id).toBe("term-sess-001");
    expect(r.terminal_invocation_id).toBe("term-inv-001");
    expect(r.explicit_unattended_trigger_token).toBe("term-trigger-001");
    expect(r.controlled_command_id).toBe("cc-unatt-sched-001");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("success preserves night_run_ready=false, go_no_go=NO-GO, auto_executor_started=false", async () => {
    const r = await runTerminalUnattendedScheduledDispatch(makeTerminalInput());
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });
});

describe("HCC product entrypoint (app): success path", () => {
  it("all gates pass -> APP-UNATTENDED-SCHEDULED-DISPATCHED, scheduler called once", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runAppUnattendedScheduledDispatch(makeAppInput());
    expect(r.verdict).toBe("APP-UNATTENDED-SCHEDULED-DISPATCHED");
    expect(r.app_session_id).toBe("app-sess-001");
    expect(r.app_invocation_id).toBe("app-inv-001");
    expect(r.user_confirmation).toBe(true);
    expect(r.explicit_unattended_trigger_token).toBe("app-trigger-001");
    expect(r.controlled_command_id).toBe("cc-unatt-sched-001");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("success preserves night_run_ready=false, go_no_go=NO-GO, auto_executor_started=false", async () => {
    const r = await runAppUnattendedScheduledDispatch(makeAppInput());
    expect(r.night_run_ready).toBe(false);
    expect(r.go_no_go).toBe("NO-GO");
    expect(r.auto_executor_started).toBe(false);
    expect(r.would_execute).toBe(false);
    expect(r.real_execution_ready).toBe(false);
  });
});

describe("HCC product entrypoint (terminal): NO-GO gates", () => {
  it("missing feature flag -> NO-GO, scheduler NOT called", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runTerminalUnattendedScheduledDispatch(
      makeTerminalInput({ feature_flag_enabled: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing explicit trigger token -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runTerminalUnattendedScheduledDispatch(
      makeTerminalInput({
        invocation: {
          terminal_agent_session_id: "term-sess-001",
          terminal_invocation_id: "term-inv-001",
          explicit_unattended_trigger_token: "",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing terminal_session_id -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runTerminalUnattendedScheduledDispatch(
      makeTerminalInput({
        invocation: {
          terminal_agent_session_id: "",
          terminal_invocation_id: "term-inv-001",
          explicit_unattended_trigger_token: "term-trigger-001",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing terminal_invocation_id -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runTerminalUnattendedScheduledDispatch(
      makeTerminalInput({
        invocation: {
          terminal_agent_session_id: "term-sess-001",
          terminal_invocation_id: "",
          explicit_unattended_trigger_token: "term-trigger-001",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("HCC product entrypoint (app): NO-GO gates", () => {
  it("missing feature flag -> NO-GO, scheduler NOT called", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runAppUnattendedScheduledDispatch(
      makeAppInput({ feature_flag_enabled: false }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing explicit trigger token -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runAppUnattendedScheduledDispatch(
      makeAppInput({
        invocation: {
          app_session_id: "app-sess-001",
          app_invocation_id: "app-inv-001",
          user_confirmation: true,
          explicit_unattended_trigger_token: "",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing app_session_id -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runAppUnattendedScheduledDispatch(
      makeAppInput({
        invocation: {
          app_session_id: "",
          app_invocation_id: "app-inv-001",
          user_confirmation: true,
          explicit_unattended_trigger_token: "app-trigger-001",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("missing app_invocation_id -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runAppUnattendedScheduledDispatch(
      makeAppInput({
        invocation: {
          app_session_id: "app-sess-001",
          app_invocation_id: "",
          user_confirmation: true,
          explicit_unattended_trigger_token: "app-trigger-001",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });

  it("user_confirmation=false -> NO-GO", async () => {
    const spy = vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun");
    const r = await runAppUnattendedScheduledDispatch(
      makeAppInput({
        invocation: {
          app_session_id: "app-sess-001",
          app_invocation_id: "app-inv-001",
          user_confirmation: false,
          explicit_unattended_trigger_token: "app-trigger-001",
        },
      }),
    );
    expect(r.verdict).toBe("NO-GO");
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("HCC product entrypoint: scheduler NO-GO propagation", () => {
  it("terminal: scheduler returns NO-GO -> typed NO-GO with propagated reason", async () => {
    vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun").mockResolvedValueOnce(
      {
        schema_version: "1.0.0" as const,
        verdict: "NO-GO" as const,
        reason: "scheduler refused for testing",
        schedule_id: "sched-ep-001",
        task_id: "",
        source_plan_ref: "",
        requested_by_user: "",
        authorization_id: "",
        planned_action_id: "",
        planned_action_kind: "",
        controlled_command_id: "",
        any_command_executed: false,
        executed_commands: [] as const,
        subprocess_count: 0,
        would_execute: false as const,
        auto_executor_started: false as const,
        unattended_ready: false,
        night_run_ready: false as const,
        go_no_go: "NO-GO" as const,
        real_execution_ready: false as const,
      },
    );
    const r = await runTerminalUnattendedScheduledDispatch(makeTerminalInput());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scheduler refused for testing");
  });

  it("app: scheduler returns NO-GO -> typed NO-GO with propagated reason", async () => {
    vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun").mockResolvedValueOnce(
      {
        schema_version: "1.0.0" as const,
        verdict: "NO-GO" as const,
        reason: "scheduler refused for testing (app)",
        schedule_id: "sched-ep-001",
        task_id: "",
        source_plan_ref: "",
        requested_by_user: "",
        authorization_id: "",
        planned_action_id: "",
        planned_action_kind: "",
        controlled_command_id: "",
        any_command_executed: false,
        executed_commands: [] as const,
        subprocess_count: 0,
        would_execute: false as const,
        auto_executor_started: false as const,
        unattended_ready: false,
        night_run_ready: false as const,
        go_no_go: "NO-GO" as const,
        real_execution_ready: false as const,
      },
    );
    const r = await runAppUnattendedScheduledDispatch(makeAppInput());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scheduler refused for testing (app)");
  });
});

describe("HCC product entrypoint: scheduler throw propagation", () => {
  it("terminal: scheduler throws -> typed NO-GO with propagated reason", async () => {
    vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun").mockRejectedValueOnce(
      new Error("scheduler boom"),
    );
    const r = await runTerminalUnattendedScheduledDispatch(makeTerminalInput());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("scheduler boom");
  });

  it("app: scheduler throws -> typed NO-GO with propagated reason", async () => {
    vi.spyOn(schedulerModule, "scheduleControlledUnattendedRun").mockRejectedValueOnce(
      new Error("app scheduler boom"),
    );
    const r = await runAppUnattendedScheduledDispatch(makeAppInput());
    expect(r.verdict).toBe("NO-GO");
    expect(r.reason).toContain("app scheduler boom");
  });
});

describe("HCC product entrypoint: schema + static guards", () => {
  it("schema versions = 1.0.0", () => {
    expect(HCC_UNATTENDED_TERMINAL_ENTRYPOINT_SCHEMA_VERSION).toBe("1.0.0");
    expect(HCC_UNATTENDED_APP_ENTRYPOINT_SCHEMA_VERSION).toBe("1.0.0");
  });

  it("terminal source preserves night_run_ready:false + go_no_go:NO-GO literals", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-terminal-entrypoint.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("app source preserves night_run_ready:false + go_no_go:NO-GO literals", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-app-entrypoint.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).toMatch(/night_run_ready:\s*false/);
    expect(src).toMatch(/go_no_go:\s*"NO-GO"/);
    expect(src).not.toMatch(/go_no_go:\s*"GO"/);
  });

  it("terminal source does NOT call spawn/exec/child_process/timer/ipc", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-terminal-entrypoint.ts"),
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

  it("app source does NOT call spawn/exec/child_process/timer/ipc", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-app-entrypoint.ts"),
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

  it("terminal source does NOT import bootstrap/arm/start/host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-terminal-entrypoint.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("app source does NOT import bootstrap/arm/start/host", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-app-entrypoint.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/auto-executor-bootstrap/);
    expect(src).not.toMatch(/auto-executor-arm/);
    expect(src).not.toMatch(/auto-executor-start/);
    expect(src).not.toMatch(/auto-executor-host/);
  });

  it("terminal source does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-terminal-entrypoint.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("app source does NOT call submitDryRunAction", () => {
    const src = readFileSync(
      resolve(REPO_ROOT, "src/shared/lib/hcc-unattended-app-entrypoint.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(src).not.toMatch(/submitDryRunAction/);
  });

  it("neither source contains a .hermes write", () => {
    for (const f of [
      "src/shared/lib/hcc-unattended-terminal-entrypoint.ts",
      "src/shared/lib/hcc-unattended-app-entrypoint.ts",
    ]) {
      const src = readFileSync(resolve(REPO_ROOT, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      expect(src).not.toMatch(/\.hermes/);
    }
  });
});
